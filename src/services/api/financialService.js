/**
 * Financial API Service
 * Handles AlphaVantage and Finnhub API calls
 */

import { getSubscriptionKey } from '../../utils/settingsService';
import { validateRequiredParams, alphavantageQueue, finnhubQueue } from './apiClient';
import { generateCacheKey, getCachedResponse, setCachedResponse, hasCachedResponse } from './apiCache';
import memoryService from '../../utils/memoryService';
import coEditService from '../../utils/coEditService';

// Commodity symbols that are NOT valid for currency endpoints
// These should use commodity endpoints instead
const COMMODITY_SYMBOLS = new Set([
  'XAU', // Gold
  'XAG', // Silver
  'XPT', // Platinum
  'XPD', // Palladium
]);

// Cryptocurrency symbols that are NOT valid for FX endpoints (but ARE valid for exchange_rate)
const CRYPTO_SYMBOLS = new Set([
  'BTC', // Bitcoin
  'ETH', // Ethereum
]);

/**
 * Validate currency symbols based on endpoint type
 * @param {string} symbol - The currency symbol to validate
 * @param {string} endpointType - 'fx' for FX endpoints (only real currencies), 'exchange_rate' for exchange rate endpoint (real currencies + crypto, but NOT commodities)
 * @returns {object|null} Error object if invalid, null if valid
 */
function validateCurrencySymbol(symbol, endpointType = 'fx') {
  if (!symbol) return null;
  
  const upperSymbol = symbol.toUpperCase();
  
  // Commodities are invalid for both FX and exchange_rate endpoints
  if (COMMODITY_SYMBOLS.has(upperSymbol)) {
    const commodityName = upperSymbol === 'XAU' ? 'Gold' : 
                          upperSymbol === 'XAG' ? 'Silver' : 
                          upperSymbol === 'XPT' ? 'Platinum' : 
                          upperSymbol === 'XPD' ? 'Palladium' : upperSymbol;
    
    return {
      success: false,
      error: `Invalid currency symbol '${symbol}'. ${endpointType === 'fx' ? 'FX endpoints' : 'Exchange rate endpoint'} only accept real currencies (e.g., USD, EUR, GBP, JPY)${endpointType === 'exchange_rate' ? ' or cryptocurrencies (e.g., BTC, ETH)' : ''}. For ${commodityName}, use the commodity endpoints instead.`,
    };
  }
  
  // Cryptocurrencies are invalid for FX endpoints (but valid for exchange_rate)
  if (endpointType === 'fx' && CRYPTO_SYMBOLS.has(upperSymbol)) {
    return {
      success: false,
      error: `Invalid currency symbol '${symbol}'. FX endpoints only accept real currencies (e.g., USD, EUR, GBP, JPY). For ${upperSymbol}, use the cryptocurrency time series endpoints instead.`,
    };
  }
  
  return null;
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use validateCurrencySymbol instead
 */
function validateFxCurrency(symbol) {
  return validateCurrencySymbol(symbol, 'fx');
}

/**
 * Helper function to filter time series data by date range
 * @param {object} data - The time series data to filter
 * @param {string} timeFrom - Start date (YYYY-MM-DD format)
 * @param {string} timeTo - End date (YYYY-MM-DD format)
 * @returns {object} Filtered time series data
 */
function filterTimeSeriesData(data, timeFrom, timeTo) {
  // Deep clone the data to avoid mutating the original
  const filteredData = JSON.parse(JSON.stringify(data));
  
  // Find time series keys (they vary by function: "Time Series (Daily)", "Weekly Time Series", "data", etc.)
  const timeSeriesKeys = Object.keys(data).filter(key => 
    key.toLowerCase().includes('time series') || 
    key.toLowerCase().includes('weekly') ||
    key.toLowerCase().includes('monthly') ||
    key.toLowerCase().includes('fx') ||
    key.toLowerCase().includes('digital currency') ||
    key.toLowerCase() === 'data' // Economic indicators often use "data" key
  );
  
  if (timeSeriesKeys.length === 0) {
    return data; // No time series data found, return as-is
  }
  
  // Parse date strings to Date objects for comparison
  // Use start of day for fromDate and end of day for toDate to include full days
  const fromDate = timeFrom ? new Date(timeFrom + 'T00:00:00') : null;
  const toDate = timeTo ? new Date(timeTo + 'T23:59:59') : null;
  
  // Validate dates
  if (fromDate && isNaN(fromDate.getTime())) {
    console.warn(`Invalid time_from date: ${timeFrom}, skipping filter`);
    return data;
  }
  if (toDate && isNaN(toDate.getTime())) {
    console.warn(`Invalid time_to date: ${timeTo}, skipping filter`);
    return data;
  }
  
  // Filter each time series
  timeSeriesKeys.forEach(key => {
    const timeSeries = filteredData[key];
    if (!timeSeries || typeof timeSeries !== 'object') return;
    
    // Handle both object format (date keys) and array format (for some economic indicators)
    if (Array.isArray(timeSeries)) {
      // If it's an array, filter array elements
      const filteredArray = timeSeries.filter(item => {
        if (!item || typeof item !== 'object') return true; // Keep non-object items
        
        // Look for date fields (common: 'date', 'time', 'timestamp')
        const dateStr = item.date || item.time || item.timestamp;
        if (!dateStr) return true; // Keep items without date fields
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return true; // Keep items with unparseable dates
        
        // Check if date is within range
        if (fromDate && date < fromDate) return false;
        if (toDate && date > toDate) return false;
        return true;
      }).slice(0, 1000); // Limit to 1000 elements
      
      filteredData[key] = filteredArray;
      return;
    }
    
    // Handle object format (date keys)
    const filteredSeries = {};
    const entries = [];
    
    // Collect and filter entries
    Object.keys(timeSeries).forEach(dateStr => {
      // Try multiple date parsing strategies
      let date = new Date(dateStr);
      
      // If standard parsing fails, try YYYY-MM-DD format explicitly
      if (isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        date = new Date(dateStr + 'T00:00:00');
      }
      
      // Skip if date parsing failed
      if (isNaN(date.getTime())) {
        // Keep the entry if we can't parse the date (might be a different format)
        entries.push({ dateStr, data: timeSeries[dateStr] });
        return;
      }
      
      // Check if date is within range
      let include = true;
      if (fromDate && date < fromDate) include = false;
      if (toDate && date > toDate) include = false;
      
      if (include) {
        entries.push({ dateStr, data: timeSeries[dateStr] });
      }
    });
    
    // Sort entries by date (newest first, as Alpha Vantage typically returns them)
    entries.sort((a, b) => {
      let dateA = new Date(a.dateStr);
      let dateB = new Date(b.dateStr);
      
      // Try YYYY-MM-DD format if standard parsing fails
      if (isNaN(dateA.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(a.dateStr)) {
        dateA = new Date(a.dateStr + 'T00:00:00');
      }
      if (isNaN(dateB.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(b.dateStr)) {
        dateB = new Date(b.dateStr + 'T00:00:00');
      }
      
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Limit to 1000 elements maximum
    const limitedEntries = entries.slice(0, 1000);
    
    // Reconstruct the filtered series
    limitedEntries.forEach(({ dateStr, data }) => {
      filteredSeries[dateStr] = data;
    });
    
    filteredData[key] = filteredSeries;
  });
  
  return filteredData;
}

/**
 * Helper function for AlphaVantage API calls
 * @param {string} functionName - The AlphaVantage function name
 * @param {object} params - API parameters
 * @param {string[]} requiredParams - Required parameter names
 * @param {boolean} filterTimeSeries - Whether to filter time series data
 * @returns {Promise<object>} API response with success/data or error
 */
async function callAlphaVantageAPI(functionName, params, requiredParams = [], filterTimeSeries = false) {
  const validationError = validateRequiredParams(params, requiredParams);
  if (validationError) return validationError;
  
  const subscriptionKey = getSubscriptionKey();
  if (!subscriptionKey) {
    return {
      success: false,
      error: 'Subscription key is required. Please configure your subscription key in settings.',
    };
  }
  
  // Generate cache key - include all params including time_from/time_to for filtering
  // This ensures different time ranges are cached separately
  const cacheKey = generateCacheKey('alphavantage', functionName, params);
  
  // Check cache first
  if (hasCachedResponse(cacheKey)) {
    return getCachedResponse(cacheKey);
  }
  
  // Enqueue the request to maintain rate limiting
  return alphavantageQueue.enqueue(async () => {
    try {
      // Extract time range parameters for filtering (don't send to API)
      const { time_from, time_to, ...apiParams } = params;
      
      // Filter out undefined/null values to avoid adding them to query string
      const cleanParams = Object.fromEntries(
        Object.entries(apiParams).filter(([_, value]) => value !== undefined && value !== null)
      );
      
      const queryParams = new URLSearchParams({
        function: functionName,
        ...cleanParams,
      });
      
      const apiUrl = `https://jp-gw2.azure-api.net/alphavantage/query?${queryParams.toString()}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const errorResult = {
          success: false,
          error: `API request failed with status ${response.status}: ${errorText}`,
          status: response.status,
          statusCode: response.status,
          errorType: response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'server_error' : 'api_error',
        };
        // Don't cache errors
        return errorResult;
      }
      
      let data = await response.json();
      
      // Check for rate limit error message in response
      // AlphaVantage returns rate limit errors as successful HTTP responses with an "Information" field
      if (data && data.Information && typeof data.Information === 'string') {
        const infoMessage = data.Information.toLowerCase();
        if (infoMessage.includes('rate limit') || 
            infoMessage.includes('25 requests per day') || 
            infoMessage.includes('spreading out your free api requests') ||
            infoMessage.includes('premium plans')) {
          return {
            success: false,
            error: data.Information,
            errorType: 'rate_limit',
            status: 429,
            statusCode: 429,
          };
        }
      }
      
      // Filter time series data if time range is specified
      if (filterTimeSeries && (time_from || time_to)) {
        data = filterTimeSeriesData(data, time_from, time_to);
      }
      
      const result = {
        success: true,
        data: data,
      };
      
      // Cache successful responses
      setCachedResponse(cacheKey, result);
      
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: `Failed to fetch data: ${error.message || String(error)}`,
        ...(error.status && { status: error.status }),
        ...(error.statusCode && { statusCode: error.statusCode }),
        ...(error.errorType && { errorType: error.errorType }),
      };
      // Don't cache errors
      return errorResult;
    }
  });
}

/**
 * Helper function for Finnhub API calls
 * @param {string} endpoint - The Finnhub API endpoint
 * @param {object} params - API parameters
 * @param {string[]} requiredParams - Required parameter names
 * @returns {Promise<object>} API response with success/data or error
 */
async function callFinnhubAPI(endpoint, params, requiredParams = []) {
  const validationError = validateRequiredParams(params, requiredParams);
  if (validationError) return validationError;
  
  const subscriptionKey = getSubscriptionKey();
  if (!subscriptionKey) {
    return {
      success: false,
      error: 'Subscription key is required. Please configure your subscription key in settings.',
    };
  }
  
  // Generate cache key
  const cacheKey = generateCacheKey('finnhub', endpoint, params);
  
  // Check cache first
  if (hasCachedResponse(cacheKey)) {
    return getCachedResponse(cacheKey);
  }
  
  // Enqueue the request to maintain rate limiting
  return finnhubQueue.enqueue(async () => {
    try {
      // Filter out undefined/null values to avoid adding them to query string
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
      );
      
      const queryParams = new URLSearchParams(cleanParams);
      
      const apiUrl = `https://jp-gw2.azure-api.net/finnhub/${endpoint}?${queryParams.toString()}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const errorResult = {
          success: false,
          error: `API request failed with status ${response.status}: ${errorText}`,
          status: response.status,
          statusCode: response.status,
          errorType: response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'server_error' : 'api_error',
        };
        // Don't cache errors
        return errorResult;
      }
      
      const data = await response.json();
      
      const result = {
        success: true,
        data: data,
      };
      
      // Cache successful responses
      setCachedResponse(cacheKey, result);
      
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: `Failed to fetch data: ${error.message || String(error)}`,
        ...(error.status && { status: error.status }),
        ...(error.statusCode && { statusCode: error.statusCode }),
        ...(error.errorType && { errorType: error.errorType }),
      };
      // Don't cache errors
      return errorResult;
    }
  });
}

/**
 * Toolbox implementation for API function calls
 * This object contains all the financial API functions that can be called by the AI model
 */
export const toolbox = {
  get_memory: (args) => {
    const validationError = validateRequiredParams(args, ['memoryKey']);
    if (validationError) return validationError;
    
    const memoryKey = args.memoryKey;
    console.log("get_memory", memoryKey);
    return memoryService.getMemory(memoryKey);
  },
  
  get_all_memories: () => {
    return memoryService.getAllMemories();
  },
  
  update_memory: (args) => {
    const validationError = validateRequiredParams(args, ['memoryKey', 'memoryValue']);
    if (validationError) return validationError;
    
    const memoryKey = args.memoryKey;
    const memoryValue = args.memoryValue;
    return memoryService.setMemory(memoryKey, memoryValue);
  },
  
  delete_memory: (args) => {
    const validationError = validateRequiredParams(args, ['memoryKey']);
    if (validationError) return validationError;
    
    const memoryKey = args.memoryKey;
    return memoryService.deleteMemory(memoryKey);
  },
  
  create_memory: (args) => {
    const validationError = validateRequiredParams(args, ['memoryValue']);
    if (validationError) return validationError;
    
    const memoryKey = crypto.randomUUID();
    const memoryValue = args.memoryValue;
    return memoryService.setMemory(memoryKey, memoryValue);
  },
  
  set_document_content: (args) => {
    const validationError = validateRequiredParams(args, ['documentContent']);
    if (validationError) return validationError;
    
    const documentContent = args.documentContent;
    console.log("Setting document content");
    return coEditService.setDocumentContent(documentContent);
  },
  
  alphavantage_get_daily_stock: async (args) => {
    return callAlphaVantageAPI('TIME_SERIES_DAILY', {
      symbol: args.symbol,
      outputsize: 'compact', // Always use compact (full requires premium)
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['symbol'], true);
  },
  
  alphavantage_get_weekly_stock: async (args) => {
    return callAlphaVantageAPI('TIME_SERIES_WEEKLY', {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['symbol'], true);
  },
  
  alphavantage_get_monthly_stock: async (args) => {
    return callAlphaVantageAPI('TIME_SERIES_MONTHLY', {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['symbol'], true);
  },
  
  // Fundamental Data APIs
  alphavantage_get_company_overview: async (args) => {
    return callAlphaVantageAPI('OVERVIEW', {
      symbol: args.symbol,
    }, ['symbol']);
  },
  
  alphavantage_get_etf_profile: async (args) => {
    return callAlphaVantageAPI('ETF_PROFILE', {
      symbol: args.symbol,
    }, ['symbol']);
  },
  
  alphavantage_get_dividends: async (args) => {
    return callAlphaVantageAPI('DIVIDENDS', {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
    }, ['symbol']);
  },
  
  alphavantage_get_splits: async (args) => {
    return callAlphaVantageAPI('SPLITS', {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
    }, ['symbol']);
  },
  
  alphavantage_get_income_statement: async (args) => {
    return callAlphaVantageAPI('INCOME_STATEMENT', {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
    }, ['symbol']);
  },
  
  alphavantage_get_balance_sheet: async (args) => {
    return callAlphaVantageAPI('BALANCE_SHEET', {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
    }, ['symbol']);
  },
  
  alphavantage_get_cash_flow: async (args) => {
    return callAlphaVantageAPI('CASH_FLOW', {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
    }, ['symbol']);
  },
  
  // Legacy alias - redirects to consolidated financial_data
  alphavantage_get_earnings: async (args) => {
    return toolbox.alphavantage_get_financial_data({
      ...args,
      data_type: 'earnings',
    });
  },
  
  alphavantage_get_earnings_calendar: async (args) => {
    return callAlphaVantageAPI('EARNINGS_CALENDAR', {
      symbol: args.symbol,
      horizon: args.horizon,
      datatype: args.datatype || 'json',
    }, []);
  },
  
  alphavantage_get_ipo_calendar: async (args) => {
    return callAlphaVantageAPI('IPO_CALENDAR', {
      datatype: args.datatype || 'json',
    }, []);
  },
  
  // Forex APIs
  alphavantage_get_currency_exchange_rate: async (args) => {
    // Validate that symbols are not commodities (XAU, XAG, etc.)
    const fromValidation = validateCurrencySymbol(args.from_currency, 'exchange_rate');
    if (fromValidation) return fromValidation;
    
    const toValidation = validateCurrencySymbol(args.to_currency, 'exchange_rate');
    if (toValidation) return toValidation;
    
    return callAlphaVantageAPI('CURRENCY_EXCHANGE_RATE', {
      from_currency: args.from_currency,
      to_currency: args.to_currency,
    }, ['from_currency', 'to_currency']);
  },
  
  alphavantage_get_fx_daily: async (args) => {
    // Validate that FX symbols are real currencies, not commodities
    const fromValidation = validateFxCurrency(args.from_symbol);
    if (fromValidation) return fromValidation;
    
    const toValidation = validateFxCurrency(args.to_symbol);
    if (toValidation) return toValidation;
    
    return callAlphaVantageAPI('FX_DAILY', {
      from_symbol: args.from_symbol,
      to_symbol: args.to_symbol,
      outputsize: 'compact', // Always use compact (full requires premium)
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['from_symbol', 'to_symbol'], true);
  },
  
  alphavantage_get_fx_weekly: async (args) => {
    // Validate that FX symbols are real currencies, not commodities
    const fromValidation = validateFxCurrency(args.from_symbol);
    if (fromValidation) return fromValidation;
    
    const toValidation = validateFxCurrency(args.to_symbol);
    if (toValidation) return toValidation;
    
    return callAlphaVantageAPI('FX_WEEKLY', {
      from_symbol: args.from_symbol,
      to_symbol: args.to_symbol,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['from_symbol', 'to_symbol'], true);
  },
  
  alphavantage_get_fx_monthly: async (args) => {
    // Validate that FX symbols are real currencies, not commodities
    const fromValidation = validateFxCurrency(args.from_symbol);
    if (fromValidation) return fromValidation;
    
    const toValidation = validateFxCurrency(args.to_symbol);
    if (toValidation) return toValidation;
    
    return callAlphaVantageAPI('FX_MONTHLY', {
      from_symbol: args.from_symbol,
      to_symbol: args.to_symbol,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['from_symbol', 'to_symbol'], true);
  },
  
  // Cryptocurrency APIs
  // Note: Uses CURRENCY_EXCHANGE_RATE which handles both crypto and physical currencies
  alphavantage_get_crypto_exchange_rate: async (args) => {
    // Validate that symbols are not commodities (XAU, XAG, etc.)
    const fromValidation = validateCurrencySymbol(args.from_currency, 'exchange_rate');
    if (fromValidation) return fromValidation;
    
    const toValidation = validateCurrencySymbol(args.to_currency, 'exchange_rate');
    if (toValidation) return toValidation;
    
    return callAlphaVantageAPI('CURRENCY_EXCHANGE_RATE', {
      from_currency: args.from_currency,
      to_currency: args.to_currency,
    }, ['from_currency', 'to_currency']);
  },
  
  alphavantage_get_crypto_daily: async (args) => {
    return callAlphaVantageAPI('DIGITAL_CURRENCY_DAILY', {
      symbol: args.symbol,
      market: args.market,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['symbol', 'market'], true);
  },
  
  alphavantage_get_crypto_weekly: async (args) => {
    return callAlphaVantageAPI('DIGITAL_CURRENCY_WEEKLY', {
      symbol: args.symbol,
      market: args.market,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['symbol', 'market'], true);
  },
  
  alphavantage_get_crypto_monthly: async (args) => {
    return callAlphaVantageAPI('DIGITAL_CURRENCY_MONTHLY', {
      symbol: args.symbol,
      market: args.market,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['symbol', 'market'], true);
  },
  
  // Commodities APIs
  alphavantage_get_wti: async (args) => {
    return callAlphaVantageAPI('WTI', {
      interval: args.interval || 'daily',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  alphavantage_get_brent: async (args) => {
    return callAlphaVantageAPI('BRENT', {
      interval: args.interval || 'daily',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  alphavantage_get_natural_gas: async (args) => {
    return callAlphaVantageAPI('NATURAL_GAS', {
      interval: args.interval || 'daily',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  alphavantage_get_copper: async (args) => {
    return callAlphaVantageAPI('COPPER', {
      interval: args.interval || 'daily',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  // Economic Indicators APIs
  alphavantage_get_real_gdp: async (args) => {
    return callAlphaVantageAPI('REAL_GDP', {
      interval: args.interval || 'annual',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  alphavantage_get_treasury_yield: async (args) => {
    return callAlphaVantageAPI('TREASURY_YIELD', {
      interval: args.interval || 'daily',
      maturity: args.maturity,
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, ['maturity'], true);
  },
  
  alphavantage_get_federal_funds_rate: async (args) => {
    return callAlphaVantageAPI('FEDERAL_FUNDS_RATE', {
      interval: args.interval || 'daily',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  alphavantage_get_cpi: async (args) => {
    return callAlphaVantageAPI('CPI', {
      interval: args.interval || 'monthly',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  alphavantage_get_inflation: async (args) => {
    return callAlphaVantageAPI('INFLATION', {
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  alphavantage_get_unemployment: async (args) => {
    return callAlphaVantageAPI('UNEMPLOYMENT', {
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  // Finnhub Stock Data APIs
  finnhub_get_quote: async (args) => {
    return callFinnhubAPI('quote', {
      symbol: args.symbol,
    }, ['symbol']);
  },
  
  finnhub_get_recommendation: async (args) => {
    return callFinnhubAPI('stock/recommendation', {
      symbol: args.symbol,
    }, ['symbol']);
  },
  
  // Finnhub Company Information APIs
  finnhub_get_company_profile: async (args) => {
    if (!args.symbol && !args.isin && !args.cusip) {
      return {
        success: false,
        error: 'At least one of symbol, isin, or cusip must be provided.',
      };
    }
    return callFinnhubAPI('stock/profile2', {
      symbol: args.symbol,
      isin: args.isin,
      cusip: args.cusip,
    }, []);
  },
  
  finnhub_get_peers: async (args) => {
    return callFinnhubAPI('stock/peers', {
      symbol: args.symbol,
    }, ['symbol']);
  },
  
  finnhub_get_key_metrics: async (args) => {
    // Call the API to get the full response
    const result = await callFinnhubAPI('stock/metric', {
      symbol: args.symbol,
      metric: args.metric || 'all',
    }, ['symbol']);
    
    // If there's an error, return it
    if (!result.success || result.error) {
      return result;
    }
    
    const data = result.data;
    
    // If metric_type is NOT provided, return only .metric (like jq .metric)
    // series_type and date range are ignored when metric_type is not specified
    if (!args.metric_type) {
      return {
        success: true,
        data: data.metric,
      };
    }
    
    // If metric_type IS provided, return series data
    // Determine series type: use quarterly if date range < 5 years
    let seriesType = args.series_type || 'annual';
    if (!args.series_type && args.from && args.to) {
      const fromDate = new Date(args.from);
      const toDate = new Date(args.to);
      const yearsDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24 * 365.25);
      if (yearsDiff < 5) {
        seriesType = 'quarterly';
      }
    }
    
    // Get the series data
    if (!data.series || !data.series[seriesType] || !data.series[seriesType][args.metric_type]) {
      return {
        success: false,
        error: `Metric type '${args.metric_type}' not found in ${seriesType} series data.`,
      };
    }
    
    let seriesData = data.series[seriesType][args.metric_type];
    
    // Filter by date range if provided
    if (args.from || args.to) {
      const fromDate = args.from ? new Date(args.from) : null;
      const toDate = args.to ? new Date(args.to) : null;
      
      seriesData = seriesData.filter(item => {
        const itemDate = new Date(item.period);
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        return true;
      });
    }
    
    // Return filtered series data
    return {
      success: true,
      data: {
        symbol: data.symbol,
        metricType: args.metric_type,
        seriesType: seriesType,
        series: seriesData,
      },
    };
  },
  
  // Finnhub News & Sentiment APIs
  finnhub_get_company_news: async (args) => {
    return callFinnhubAPI('company-news', {
      symbol: args.symbol,
      from: args.from,
      to: args.to,
    }, ['symbol', 'from', 'to']);
  },
  
  // Finnhub Calendar APIs
  finnhub_get_earnings_calendar: async (args) => {
    return callFinnhubAPI('calendar/earnings', {
      from: args.from,
      to: args.to,
      symbol: args.symbol,
    }, []);
  },
  
  finnhub_get_ipo_calendar: async (args) => {
    return callFinnhubAPI('calendar/ipo', {
      from: args.from,
      to: args.to,
    }, []);
  },
  
  // Finnhub Market Data APIs
  finnhub_get_stock_symbols: async (args) => {
    return callFinnhubAPI('stock/symbol', {
      exchange: args.exchange,
      mic: args.mic,
      securityType: args.securityType,
      currency: args.currency,
    }, ['exchange']);
  },
  
  finnhub_get_sector_performance: async (args) => {
    return callFinnhubAPI('stock/sectors', {}, []);
  },
  
  // ===== CONSOLIDATED FUNCTIONS =====
  // These consolidate multiple similar functions to reduce token usage
  
  // Consolidated AlphaVantage Fundamental Data (replaces company_overview/etf_profile/dividends/splits)
  alphavantage_get_fundamental_data: async (args) => {
    const dataType = args.data_type || 'company_overview';
    const functionMap = {
      'company_overview': 'OVERVIEW',
      'etf_profile': 'ETF_PROFILE',
      'dividends': 'DIVIDENDS',
      'splits': 'SPLITS',
    };
    const functionName = functionMap[dataType];
    if (!functionName) {
      return {
        success: false,
        error: `Invalid data_type: ${dataType}. Must be 'company_overview', 'etf_profile', 'dividends', or 'splits'.`,
      };
    }
    return callAlphaVantageAPI(functionName, {
      symbol: args.symbol,
      datatype: args.datatype || 'json',
    }, ['symbol']);
  },
  
  // Consolidated Exchange Rate (replaces currency_exchange_rate and crypto_exchange_rate - same endpoint)
  alphavantage_get_exchange_rate: async (args) => {
    // Validate that symbols are not commodities (XAU, XAG, etc.)
    const fromValidation = validateCurrencySymbol(args.from_currency, 'exchange_rate');
    if (fromValidation) return fromValidation;
    
    const toValidation = validateCurrencySymbol(args.to_currency, 'exchange_rate');
    if (toValidation) return toValidation;
    
    return callAlphaVantageAPI('CURRENCY_EXCHANGE_RATE', {
      from_currency: args.from_currency,
      to_currency: args.to_currency,
    }, ['from_currency', 'to_currency']);
  },
  
  // Consolidated Finnhub Stock Data (replaces quote and recommendation)
  finnhub_get_stock_data: async (args) => {
    const dataType = args.data_type || 'quote';
    if (dataType === 'quote') {
      return callFinnhubAPI('quote', {
        symbol: args.symbol,
      }, ['symbol']);
    } else if (dataType === 'recommendation') {
      return callFinnhubAPI('stock/recommendation', {
        symbol: args.symbol,
      }, ['symbol']);
    } else {
      return {
        success: false,
        error: `Invalid data_type: ${dataType}. Must be 'quote' or 'recommendation'.`,
      };
    }
  },
  
  // Consolidated Finnhub Company Info (replaces company_profile and peers)
  finnhub_get_company_info: async (args) => {
    const infoType = args.info_type || 'profile';
    if (infoType === 'profile') {
      if (!args.symbol && !args.isin && !args.cusip) {
        return {
          success: false,
          error: 'At least one of symbol, isin, or cusip must be provided.',
        };
      }
      return callFinnhubAPI('stock/profile2', {
        symbol: args.symbol,
        isin: args.isin,
        cusip: args.cusip,
      }, []);
    } else if (infoType === 'peers') {
      return callFinnhubAPI('stock/peers', {
        symbol: args.symbol,
      }, ['symbol']);
    } else {
      return {
        success: false,
        error: `Invalid info_type: ${infoType}. Must be 'profile' or 'peers'.`,
      };
    }
  },
  
  // Consolidated Finnhub Market Data (replaces stock_symbols and sector_performance)
  finnhub_get_market_data: async (args) => {
    const dataType = args.data_type || 'symbols';
    if (dataType === 'symbols') {
      return callFinnhubAPI('stock/symbol', {
        exchange: args.exchange,
        mic: args.mic,
        securityType: args.securityType,
        currency: args.currency,
      }, ['exchange']);
    } else if (dataType === 'sector_performance') {
      return callFinnhubAPI('stock/sectors', {}, []);
    } else {
      return {
        success: false,
        error: `Invalid data_type: ${dataType}. Must be 'symbols' or 'sector_performance'.`,
      };
    }
  },
  
  // Consolidated Time Series (replaces stock/fx/crypto time series)
  alphavantage_get_time_series: async (args) => {
    const seriesType = args.series_type || 'stock';
    const interval = args.interval || 'daily';
    
    let functionName, params, requiredParams;
    
    if (seriesType === 'stock') {
      const functionMap = {
        'daily': 'TIME_SERIES_DAILY',
        'weekly': 'TIME_SERIES_WEEKLY',
        'monthly': 'TIME_SERIES_MONTHLY',
      };
      functionName = functionMap[interval];
      params = {
        symbol: args.symbol,
        outputsize: 'compact', // Always use compact (full requires premium)
        datatype: args.datatype || 'json',
        time_from: args.time_from,
        time_to: args.time_to,
      };
      requiredParams = ['symbol'];
    } else if (seriesType === 'fx') {
      // Validate that FX symbols are real currencies, not commodities
      const fromValidation = validateFxCurrency(args.from_symbol);
      if (fromValidation) return fromValidation;
      
      const toValidation = validateFxCurrency(args.to_symbol);
      if (toValidation) return toValidation;
      
      const functionMap = {
        'daily': 'FX_DAILY',
        'weekly': 'FX_WEEKLY',
        'monthly': 'FX_MONTHLY',
      };
      functionName = functionMap[interval];
      params = {
        from_symbol: args.from_symbol,
        to_symbol: args.to_symbol,
        outputsize: 'compact', // Always use compact (full requires premium)
        datatype: args.datatype || 'json',
        time_from: args.time_from,
        time_to: args.time_to,
      };
      requiredParams = ['from_symbol', 'to_symbol'];
    } else if (seriesType === 'crypto') {
      const functionMap = {
        'daily': 'DIGITAL_CURRENCY_DAILY',
        'weekly': 'DIGITAL_CURRENCY_WEEKLY',
        'monthly': 'DIGITAL_CURRENCY_MONTHLY',
      };
      functionName = functionMap[interval];
      params = {
        symbol: args.symbol,
        market: args.market,
        datatype: args.datatype || 'json',
        time_from: args.time_from,
        time_to: args.time_to,
      };
      requiredParams = ['symbol', 'market'];
    } else {
      return {
        success: false,
        error: `Invalid series_type: ${seriesType}. Must be 'stock', 'fx', or 'crypto'.`,
      };
    }
    
    if (!functionName) {
      return {
        success: false,
        error: `Invalid interval: ${interval}. Must be 'daily', 'weekly', or 'monthly'.`,
      };
    }
    
    return callAlphaVantageAPI(functionName, params, requiredParams, true);
  },
  
  // Consolidated Financial Data (replaces financial_statement and earnings)
  alphavantage_get_financial_data: async (args) => {
    const dataType = args.data_type || 'financial_statement';
    
    if (dataType === 'earnings') {
      // Handle earnings
      const result = await callAlphaVantageAPI('EARNINGS', {
        symbol: args.symbol,
        datatype: args.datatype || 'json',
      }, ['symbol']);
      
      if (!result.success || !result.data) {
        return result;
      }
      
      const reportType = (args.report_type || 'annual').toLowerCase();
      const reportsKey = reportType === 'annual' ? 'annualEarnings' : 'quarterlyEarnings';
      const reports = result.data[reportsKey];
      
      if (!reports || !Array.isArray(reports) || reports.length === 0) {
        return {
          success: false,
          error: `No ${reportType} earnings reports found in the response.`,
        };
      }
      
      let matchingReport = null;
      
      if (args.date) {
        const targetDate = new Date(args.date);
        if (isNaN(targetDate.getTime())) {
          return {
            success: false,
            error: `Invalid date format: ${args.date}. Please use YYYY-MM-DD format.`,
          };
        }
        
        const targetYear = targetDate.getFullYear();
        const targetQuarter = Math.floor(targetDate.getMonth() / 3) + 1;
        
        if (reportType === 'annual') {
          matchingReport = reports.find(report => {
            const reportDate = new Date(report.fiscalDateEnding);
            return reportDate.getFullYear() === targetYear;
          });
        } else {
          matchingReport = reports.find(report => {
            const reportDate = new Date(report.fiscalDateEnding);
            const reportYear = reportDate.getFullYear();
            const reportQuarter = Math.floor(reportDate.getMonth() / 3) + 1;
            return reportYear === targetYear && reportQuarter === targetQuarter;
          });
        }
        
        if (!matchingReport) {
          return {
            success: false,
            error: `No ${reportType} earnings report found for ${args.date}. Available dates: ${reports.slice(0, 5).map(r => r.fiscalDateEnding).join(', ')}...`,
          };
        }
      } else {
        matchingReport = reports[0];
      }
      
      return {
        success: true,
        data: {
          symbol: result.data.symbol,
          [reportsKey]: [matchingReport],
        },
      };
    } else {
      // Handle financial statements (income/balance/cashflow)
      const statementType = args.statement_type || 'income';
      const functionMap = {
        'income': 'INCOME_STATEMENT',
        'balance': 'BALANCE_SHEET',
        'cashflow': 'CASH_FLOW',
      };
      const functionName = functionMap[statementType];
      if (!functionName) {
        return {
          success: false,
          error: `Invalid statement_type: ${statementType}. Must be 'income', 'balance', or 'cashflow'.`,
        };
      }
      
      const result = await callAlphaVantageAPI(functionName, {
        symbol: args.symbol,
        datatype: args.datatype || 'json',
      }, ['symbol']);
      
      if (!result.success || !result.data) {
        return result;
      }
      
      const reportType = (args.report_type || 'annual').toLowerCase();
      const reportsKey = reportType === 'annual' ? 'annualReports' : 'quarterlyReports';
      const reports = result.data[reportsKey];
      
      if (!reports || !Array.isArray(reports) || reports.length === 0) {
        return {
          success: false,
          error: `No ${reportType} reports found in the response.`,
        };
      }
      
      let matchingReport = null;
      
      if (args.date) {
        const targetDate = new Date(args.date);
        if (isNaN(targetDate.getTime())) {
          return {
            success: false,
            error: `Invalid date format: ${args.date}. Please use YYYY-MM-DD format.`,
          };
        }
        
        const targetYear = targetDate.getFullYear();
        const targetQuarter = Math.floor(targetDate.getMonth() / 3) + 1;
        
        if (reportType === 'annual') {
          matchingReport = reports.find(report => {
            const reportDate = new Date(report.fiscalDateEnding);
            return reportDate.getFullYear() === targetYear;
          });
        } else {
          matchingReport = reports.find(report => {
            const reportDate = new Date(report.fiscalDateEnding);
            const reportYear = reportDate.getFullYear();
            const reportQuarter = Math.floor(reportDate.getMonth() / 3) + 1;
            return reportYear === targetYear && reportQuarter === targetQuarter;
          });
        }
        
        if (!matchingReport) {
          return {
            success: false,
            error: `No ${reportType} report found for ${args.date}. Available dates: ${reports.slice(0, 5).map(r => r.fiscalDateEnding).join(', ')}...`,
          };
        }
      } else {
        matchingReport = reports[0];
      }
      
      return {
        success: true,
        data: {
          symbol: result.data.symbol,
          [reportsKey]: [matchingReport],
        },
      };
    }
  },
  
  // Legacy alias - redirects to consolidated financial_data
  alphavantage_get_financial_statement: async (args) => {
    return toolbox.alphavantage_get_financial_data({
      ...args,
      data_type: 'financial_statement',
    });
  },
  
  // Consolidated Commodities (replaces wti/brent/natural_gas/copper)
  alphavantage_get_commodity: async (args) => {
    const commodity = args.commodity || 'wti';
    const functionMap = {
      'wti': 'WTI',
      'brent': 'BRENT',
      'natural_gas': 'NATURAL_GAS',
      'copper': 'COPPER',
    };
    const functionName = functionMap[commodity];
    if (!functionName) {
      return {
        success: false,
        error: `Invalid commodity: ${commodity}. Must be 'wti', 'brent', 'natural_gas', or 'copper'.`,
      };
    }
    return callAlphaVantageAPI(functionName, {
      interval: args.interval || 'daily',
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    }, [], true);
  },
  
  // Consolidated Economic Indicators (replaces real_gdp/treasury_yield/federal_funds_rate/cpi/inflation/unemployment)
  alphavantage_get_economic_indicator: async (args) => {
    const indicator = args.indicator || 'real_gdp';
    const functionMap = {
      'real_gdp': 'REAL_GDP',
      'treasury_yield': 'TREASURY_YIELD',
      'federal_funds_rate': 'FEDERAL_FUNDS_RATE',
      'cpi': 'CPI',
      'inflation': 'INFLATION',
      'unemployment': 'UNEMPLOYMENT',
    };
    const functionName = functionMap[indicator];
    if (!functionName) {
      return {
        success: false,
        error: `Invalid indicator: ${indicator}. Must be 'real_gdp', 'treasury_yield', 'federal_funds_rate', 'cpi', 'inflation', or 'unemployment'.`,
      };
    }
    
    // Require time range for economic indicators to avoid returning massive datasets
    if (!args.time_from && !args.time_to) {
      return {
        success: false,
        error: 'Time range is required. Please specify either time_from or time_to (or both) to filter the economic indicator data.',
      };
    }
    
    const params = {
      datatype: args.datatype || 'json',
      time_from: args.time_from,
      time_to: args.time_to,
    };
    
    // Add interval for indicators that support it
    if (['real_gdp', 'treasury_yield', 'federal_funds_rate', 'cpi'].includes(indicator)) {
      params.interval = args.interval || (indicator === 'real_gdp' ? 'annual' : indicator === 'cpi' ? 'monthly' : 'daily');
    }
    
    // Add maturity for treasury_yield
    if (indicator === 'treasury_yield') {
      params.maturity = args.maturity;
    }
    
    const requiredParams = indicator === 'treasury_yield' ? ['maturity'] : [];
    
    return callAlphaVantageAPI(functionName, params, requiredParams, true);
  },
  
  // Consolidated Calendar APIs (replaces earnings_calendar/ipo_calendar for both AlphaVantage and Finnhub)
  get_calendar: async (args) => {
    const calendarType = args.calendar_type || 'earnings';
    const source = args.source || 'alphavantage';
    
    if (source === 'alphavantage') {
      const functionMap = {
        'earnings': 'EARNINGS_CALENDAR',
        'ipo': 'IPO_CALENDAR',
      };
      const functionName = functionMap[calendarType];
      if (!functionName) {
        return {
          success: false,
          error: `Invalid calendar_type: ${calendarType}. Must be 'earnings' or 'ipo'.`,
        };
      }
      return callAlphaVantageAPI(functionName, {
        symbol: args.symbol,
        horizon: args.horizon,
        datatype: args.datatype || 'json',
      }, []);
    } else if (source === 'finnhub') {
      const endpointMap = {
        'earnings': 'calendar/earnings',
        'ipo': 'calendar/ipo',
      };
      const endpoint = endpointMap[calendarType];
      if (!endpoint) {
        return {
          success: false,
          error: `Invalid calendar_type: ${calendarType}. Must be 'earnings' or 'ipo'.`,
        };
      }
      return callFinnhubAPI(endpoint, {
        from: args.from,
        to: args.to,
        symbol: args.symbol,
      }, []);
    } else {
      return {
        success: false,
        error: `Invalid source: ${source}. Must be 'alphavantage' or 'finnhub'.`,
      };
    }
  },
};
