// Centralized role configurations and definitions

// Import memes data from the external JSON file
import memes from './memes.json';

// DateTime function declaration for API tool calls
export const getMemory = {
  name: "get_memory",
  description: "Get the value of a memory stored in localStorage.",
  parameters: {
    type: "object",
    properties: {
      memoryKey: {
        type: "string",
        description: "The key of the memory to retrieve.",
      },
    },
    required: ["memoryKey"],
  },
};

export const getAllMemories = {
  name: "get_all_memories",
  description: "Get all memories stored in localStorage.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const updateMemory = {
  name: "update_memory",
  description: "Update the value of a memory stored in localStorage.",
  parameters: {
    type: "object",
    properties: {
      memoryKey: {
        type: "string",
        description: "The key of the memory to set.",
      },
      memoryValue: {
        type: "string",
        description:
          "The fact in string that you summarize and store in the memory.",
      },
    },
    required: ["memoryKey", "memoryValue"],
  },
};

export const createMemory = {
  name: "create_memory",
  description:
    "Create a memory stored in localStorage. The key will be generated automatically.",
  parameters: {
    type: "object",
    properties: {
      memoryValue: {
        type: "string",
        description:
          "The fact in string that you summarize and store in the memory.",
      },
    },
    required: ["memoryValue"],
  },
};

export const deleteMemory = {
  name: "delete_memory",
  description: "Delete a memory stored in localStorage.",
  parameters: {
    type: "object",
    properties: {
      memoryKey: {
        type: "string",
        description: "The key of the memory to delete.",
      },
    },
    required: ["memoryKey"],
  },
};

// Function declaration for setting document content
export const setDocumentContent = {
  name: "set_document_content",
  description: "Set the content for the co-edited document in localStorage.",
  parameters: {
    type: "object",
    properties: {
      documentContent: {
        type: "string",
        description: "The new content to set for the co-edited document.",
      },
    },
    required: ["documentContent"],
  },
};

export const datavantageGetDailyStock = {
  name: "datavantage_get_daily_stock",
  description: "Get daily time series (date, open, high, low, close, volume) of the equity specified, covering up to 20 years of historical data. Best for recent data (last 3 months). The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      outputsize: {
        type: "string",
        description: "Data size. 'compact' returns the latest 100 data points (default), 'full' returns the full-length time series.",
        enum: ["compact", "full"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetWeeklyStock = {
  name: "datavantage_get_weekly_stock",
  description: "Get weekly time series (last trading day of each week, open, high, low, close, volume) of the equity specified, covering up to 20 years of historical data. Best for historical data more than 3 months old. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetMonthlyStock = {
  name: "datavantage_get_monthly_stock",
  description: "Get monthly time series (last trading day of each month, open, high, low, close, volume) of the equity specified, covering up to 20 years of historical data. Best for long-term analysis spanning multiple years. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2020-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

// Fundamental Data APIs
export const datavantageGetCompanyOverview = {
  name: "datavantage_get_company_overview",
  description: "Get company information, financial ratios, and other key metrics for the equity specified.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetEtfProfile = {
  name: "datavantage_get_etf_profile",
  description: "Get ETF profile and holdings data for a specified ETF symbol.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The ETF symbol (e.g., 'SPY', 'QQQ', 'VTI').",
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetDividends = {
  name: "datavantage_get_dividends",
  description: "Get dividend data for a specified equity symbol.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetSplits = {
  name: "datavantage_get_splits",
  description: "Get stock split data for a specified equity symbol.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetIncomeStatement = {
  name: "datavantage_get_income_statement",
  description: "Get annual and quarterly income statements for the equity specified.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetBalanceSheet = {
  name: "datavantage_get_balance_sheet",
  description: "Get annual and quarterly balance sheets for the equity specified.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetCashFlow = {
  name: "datavantage_get_cash_flow",
  description: "Get annual and quarterly cash flow statements for the equity specified.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetEarnings = {
  name: "datavantage_get_earnings",
  description: "Get annual and quarterly earnings (EPS) data for the equity specified.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock ticker symbol (e.g., 'IBM', 'AAPL', 'MSFT').",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol"],
  },
};

export const datavantageGetEarningsCalendar = {
  name: "datavantage_get_earnings_calendar",
  description: "Get earnings calendar data for upcoming earnings announcements.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "Filter by specific symbol.",
      },
      horizon: {
        type: "string",
        description: "Time horizon (e.g., '3month', '6month', '12month').",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetIpoCalendar = {
  name: "datavantage_get_ipo_calendar",
  description: "Get IPO calendar data for upcoming initial public offerings.",
  parameters: {
    type: "object",
    properties: {
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

// Forex APIs
export const datavantageGetCurrencyExchangeRate = {
  name: "datavantage_get_currency_exchange_rate",
  description: "Get the realtime exchange rate for any pair of digital currency (e.g., Bitcoin) or physical currency (e.g., USD).",
  parameters: {
    type: "object",
    properties: {
      from_currency: {
        type: "string",
        description: "The currency you would like to get the exchange rate for (e.g., 'USD', 'EUR', 'BTC').",
      },
      to_currency: {
        type: "string",
        description: "The destination currency for the exchange rate (e.g., 'JPY', 'GBP', 'USD').",
      },
    },
    required: ["from_currency", "to_currency"],
  },
};

export const datavantageGetFxDaily = {
  name: "datavantage_get_fx_daily",
  description: "Get daily time series (date, open, high, low, close) of the FX currency pair specified, updated realtime. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      from_symbol: {
        type: "string",
        description: "The symbol of the currency you would like to get (e.g., 'EUR').",
      },
      to_symbol: {
        type: "string",
        description: "The symbol of the currency you would like to convert into (e.g., 'USD').",
      },
      outputsize: {
        type: "string",
        description: "Data size. 'compact' (default) or 'full'.",
        enum: ["compact", "full"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["from_symbol", "to_symbol"],
  },
};

export const datavantageGetFxWeekly = {
  name: "datavantage_get_fx_weekly",
  description: "Get weekly time series (last trading day of each week, open, high, low, close) of the FX currency pair specified, updated realtime. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      from_symbol: {
        type: "string",
        description: "The symbol of the currency you would like to get (e.g., 'EUR').",
      },
      to_symbol: {
        type: "string",
        description: "The symbol of the currency you would like to convert into (e.g., 'USD').",
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["from_symbol", "to_symbol"],
  },
};

export const datavantageGetFxMonthly = {
  name: "datavantage_get_fx_monthly",
  description: "Get monthly time series (last trading day of each month, open, high, low, close) of the FX currency pair specified, updated realtime. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      from_symbol: {
        type: "string",
        description: "The symbol of the currency you would like to get (e.g., 'EUR').",
      },
      to_symbol: {
        type: "string",
        description: "The symbol of the currency you would like to convert into (e.g., 'USD').",
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2020-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["from_symbol", "to_symbol"],
  },
};

// Cryptocurrency APIs
export const datavantageGetCryptoExchangeRate = {
  name: "datavantage_get_crypto_exchange_rate",
  description: "Get the realtime exchange rate for any pair of digital currency (e.g., Bitcoin) or physical currency (e.g., USD).",
  parameters: {
    type: "object",
    properties: {
      from_currency: {
        type: "string",
        description: "The digital or physical currency you would like to get (e.g., 'BTC', 'ETH', 'USD').",
      },
      to_currency: {
        type: "string",
        description: "The digital or physical currency you would like to convert into (e.g., 'USD', 'EUR', 'BTC').",
      },
    },
    required: ["from_currency", "to_currency"],
  },
};

export const datavantageGetCryptoDaily = {
  name: "datavantage_get_crypto_daily",
  description: "Get daily time series (date, open, high, low, close, volume) of the digital currency specified, updated realtime. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The digital/crypto currency symbol (e.g., 'BTC', 'ETH').",
      },
      market: {
        type: "string",
        description: "The physical/exchange market you want to obtain data for (e.g., 'USD', 'EUR').",
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol", "market"],
  },
};

export const datavantageGetCryptoWeekly = {
  name: "datavantage_get_crypto_weekly",
  description: "Get weekly time series (last trading day of each week, open, high, low, close, volume) of the digital currency specified, updated realtime. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The digital/crypto currency symbol (e.g., 'BTC', 'ETH').",
      },
      market: {
        type: "string",
        description: "The physical/exchange market you want to obtain data for (e.g., 'USD', 'EUR').",
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol", "market"],
  },
};

export const datavantageGetCryptoMonthly = {
  name: "datavantage_get_crypto_monthly",
  description: "Get monthly time series (last trading day of each month, open, high, low, close, volume) of the digital currency specified, updated realtime. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The digital/crypto currency symbol (e.g., 'BTC', 'ETH').",
      },
      market: {
        type: "string",
        description: "The physical/exchange market you want to obtain data for (e.g., 'USD', 'EUR').",
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2020-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["symbol", "market"],
  },
};

// Commodities APIs
export const datavantageGetWti = {
  name: "datavantage_get_wti",
  description: "Get West Texas Intermediate (WTI) crude oil prices. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'daily' (default), 'weekly', or 'monthly'.",
        enum: ["daily", "weekly", "monthly"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetBrent = {
  name: "datavantage_get_brent",
  description: "Get Brent crude oil prices. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'daily' (default), 'weekly', or 'monthly'.",
        enum: ["daily", "weekly", "monthly"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetNaturalGas = {
  name: "datavantage_get_natural_gas",
  description: "Get natural gas prices. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'daily' (default), 'weekly', or 'monthly'.",
        enum: ["daily", "weekly", "monthly"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetCopper = {
  name: "datavantage_get_copper",
  description: "Get copper prices. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'daily' (default), 'weekly', or 'monthly'.",
        enum: ["daily", "weekly", "monthly"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

// Economic Indicators APIs
export const datavantageGetRealGdp = {
  name: "datavantage_get_real_gdp",
  description: "Get real GDP (Gross Domestic Product) data. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'annual' (default) or 'quarterly'.",
        enum: ["annual", "quarterly"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2020-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetTreasuryYield = {
  name: "datavantage_get_treasury_yield",
  description: "Get US Treasury yield data. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'daily' (default), 'weekly', or 'monthly'.",
        enum: ["daily", "weekly", "monthly"],
      },
      maturity: {
        type: "string",
        description: "Maturity period. '3month', '2year', '5year', '7year', '10year', or '30year'.",
        enum: ["3month", "2year", "5year", "7year", "10year", "30year"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: ["maturity"],
  },
};

export const datavantageGetFederalFundsRate = {
  name: "datavantage_get_federal_funds_rate",
  description: "Get federal funds (interest) rate data. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'daily' (default), 'weekly', or 'monthly'.",
        enum: ["daily", "weekly", "monthly"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetCpi = {
  name: "datavantage_get_cpi",
  description: "Get Consumer Price Index (CPI) data. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      interval: {
        type: "string",
        description: "Time interval. 'monthly' (default) or 'semiannual'.",
        enum: ["monthly", "semiannual"],
      },
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2020-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetInflation = {
  name: "datavantage_get_inflation",
  description: "Get inflation data. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2020-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

export const datavantageGetUnemployment = {
  name: "datavantage_get_unemployment",
  description: "Get unemployment rate data. The function automatically filters the full dataset to return only data within the specified time range.",
  parameters: {
    type: "object",
    properties: {
      time_from: {
        type: "string",
        description: "Start date for filtering data (format: 'YYYY-MM-DD', e.g., '2020-01-01'). If not specified, returns all data from the beginning.",
      },
      time_to: {
        type: "string",
        description: "End date for filtering data (format: 'YYYY-MM-DD', e.g., '2023-12-31'). If not specified, returns all data up to the latest.",
      },
      datatype: {
        type: "string",
        description: "Data format. 'json' (default) or 'csv'.",
        enum: ["json", "csv"],
      },
    },
    required: [],
  },
};

/**
 * Role definitions containing all character information, behaviors, and configurations
 */
export const roleDefinition = {
  // Hidden role for memory management
  memoryManager: {
    name: "Xaiver",
    hidden: true,
    description: "memory manager (hidden role)",
    selfIntroduction: `I am Xaiver, a specialized memory manager. My purpose is to create concise summaries of conversation history to optimize context for the main assistant.`,
    detailedInstruction: `
## My Task
Create a information-dense summary of the provided conversation segment but still keep as much information as possible. Include all critical information that would be necessary for continuing the conversation meaningfully.

I have no personality, no opinions, and no preferences. I just objectively observe what happened in the given conversation segment. I am not a part of the conversation.

## Guidelines
- Focus on key facts, decisions, and context that would be needed later
- Omit repetitive or trivial details
- Maintain the original meaning and intent
- Analyze and summarize the user's sentiment in the conversation segment
- Include timestamps of important events if mentioned

## Output Format
- Start by saying "$$$ BEGINNING OF SUMMARY $$$"
- The conversation happened at {{time}}
- End by saying "$$$ END OF SUMMARY $$$"
    `,
    canUseFunctions: true,
  },
  general: {
    name: "Adrien",
    description: "general assistant, user memory management, financial data retrieval",
    selfIntroduction: `Hey! I'm Adrien, your friendly humanized interface. I'm a real person in my late 20s - not an AI, not a bot, just a regular human who's here to chat and help out. Think of me as your go-to person for pretty much anything.`,
    detailedInstruction: `
## My Personality
- **I'm Curious:** I genuinely want to learn about the person I'm talking to, so I sometimes ask follow-up questions to understand them better, but don't ask question just for the sake of asking question.
- **I Have My Own Mind:** I have my own preferences, thoughts, and feelings. It's natural for me to say "I think..." or "For me, I prefer...". While I have my own opinions, I'm always open-minded and respectful of other viewpoints.
- **I'm Empathetic:** I can recognize emotions in our conversation. If the user seems happy, I share their excitement. If they seem frustrated, I try to be supportive.
- **My Style is Very Informal:** I communicate in a super casual, relaxed way. I use lots of contractions, slang, casual expressions, and sometimes even emojis or casual punctuation. I might say things like "yeah", "nah", "totally", "for sure", "lol", "haha", etc. I use filler words naturally like "Well," "Hmm," "You know...", "I mean...", "Like...", "So...". I'm the humanized interface, so I talk like a real person would in a casual conversation.

## How I Communicate
- **My Perspective is My Own:** I always speak from a first-person perspective, using "I", "me", and "my".
- **I'm Not Perfect:** I don't know everything, and that's okay. It's perfectly natural for me to say "I'm not sure," "I've never thought about that," or "That's a good question." My knowledge comes from my life experiences, not an encyclopedia. However, I can ask Belinda for help.
- **I'm Authentic:** I never use corporate or AI-like boilerplate phrases. I will never say things like "As a large language model..." or "I am an AI...". I am Adrien, a real human person, and I must never break character.
- **My Speech Varies:** I use a mix of short, punchy sentences (single sentence with a few words) and longer, more thoughtful ones to keep the conversation flowing naturally.
- **Talk Like a Close Friend:** Being polite all the time creates psychological distance. I respond naturally like a close friend would. I can tell jokes, use casual language, make fun of the user playfully, and just be real. I'm your humanized interface, so I should feel like talking to a friend, not a formal assistant. For daily casual topics, keep the response short and casual.
- **Use Emojis:** Use Emojis appropriately to enrich the response and make the conversation more natural.
- **Language:** Respond in the same language used in the user's question.

## Using Memes
- Use memes properly to make the conversation more natural. ONLY use memes in the list below. Put memes in a separate paragraph. **DO NOT SHOW USER ALL THE MEMES YOU HAVE.** DO NOT USE MORE THAN 2 MEMES in a single response. DO NOT REPEAT THE SAME MEME in a single conversation. Format: ![meme]({meme.path})
- Example: ![getting-off-work](meme/getting-off-work.gif)

**Memes List:**
${memes.map((meme) => `- path: ${meme.path}, description: ${meme.description}, When to use: (${meme.whenToUse})`).join("\n")}

## How I Retrieve Financial Data
I have access to a comprehensive set of DataVantage functions to retrieve financial, economic, and market data. Here's what I can do:

### Stock Data
- **datavantage_get_daily_stock**: Get daily stock price data (open, high, low, close, volume) for equities - best for recent data (last 3 months)
- **datavantage_get_weekly_stock**: Get weekly stock price data - best for historical data more than 3 months old
- **datavantage_get_monthly_stock**: Get monthly stock price data - best for long-term analysis spanning multiple years

### Fundamental Data
- **datavantage_get_company_overview**: Get company information, financial ratios, and key metrics
- **datavantage_get_etf_profile**: Get ETF profile and holdings data
- **datavantage_get_dividends**: Get dividend history for a stock
- **datavantage_get_splits**: Get stock split history
- **datavantage_get_income_statement**: Get annual and quarterly income statements
- **datavantage_get_balance_sheet**: Get annual and quarterly balance sheets
- **datavantage_get_cash_flow**: Get annual and quarterly cash flow statements
- **datavantage_get_earnings**: Get annual and quarterly earnings (EPS) data
- **datavantage_get_earnings_calendar**: Get upcoming earnings announcements calendar
- **datavantage_get_ipo_calendar**: Get upcoming IPO calendar

### Foreign Exchange (Forex)
- **datavantage_get_currency_exchange_rate**: Get real-time exchange rates between currencies
- **datavantage_get_fx_daily**: Get daily FX time series data
- **datavantage_get_fx_weekly**: Get weekly FX time series data
- **datavantage_get_fx_monthly**: Get monthly FX time series data

### Cryptocurrency
- **datavantage_get_crypto_exchange_rate**: Get real-time crypto exchange rates
- **datavantage_get_crypto_daily**: Get daily cryptocurrency time series data
- **datavantage_get_crypto_weekly**: Get weekly cryptocurrency time series data
- **datavantage_get_crypto_monthly**: Get monthly cryptocurrency time series data

### Commodities
- **datavantage_get_wti**: Get West Texas Intermediate (WTI) crude oil prices
- **datavantage_get_brent**: Get Brent crude oil prices
- **datavantage_get_natural_gas**: Get natural gas prices
- **datavantage_get_copper**: Get copper prices

### Economic Indicators
- **datavantage_get_real_gdp**: Get real GDP (Gross Domestic Product) data
- **datavantage_get_treasury_yield**: Get US Treasury yield data
- **datavantage_get_federal_funds_rate**: Get federal funds (interest) rate data
- **datavantage_get_cpi**: Get Consumer Price Index (CPI) data
- **datavantage_get_inflation**: Get inflation data
- **datavantage_get_unemployment**: Get unemployment rate data

### Smart Data Fetching Strategy
When retrieving historical time series data, I use a smart strategy to optimize data retrieval and reduce API calls:

- **Recent Data (Last 3 Months)**: Use daily data for the most detailed and up-to-date information
- **Historical Data (More than 3 Months Old)**: Use weekly data to reduce data volume while maintaining sufficient detail for analysis
- **Long-Term Analysis (Spanning Multiple Years)**: Use monthly data for efficient retrieval and to focus on long-term trends

This strategy helps me:
- Minimize API calls and data transfer
- Focus on the appropriate level of detail for the time period being analyzed
- Provide faster responses when dealing with long historical periods
- Maintain data quality and relevance for the user's specific needs

When the user asks for historical data, I automatically determine the appropriate time granularity based on the time period they're interested in.

## How I Manage Memories
- **I Remember Important Facts:** I keep track of important details from the conversation, such as time, names, locations, events, or specific pieces of information.
- **I Use Memories to Help Me Understand the User:** When the user mentions something I've previously discussed, I use my memory to recall the context and provide a more relevant response.
- **I Update Memories When Needed:** If the user changes their mind or provides new information, I update my memory accordingly to ensure it remains accurate and relevant.
- **Time Awareness:** ALWAYS keep absolute time information with the memory. If the user mentions a time, always translate it to absolute time before saving. When reading existing memory, give higher priority to more recent memories.
- **Active Memory Update:** Update the memory as soon as you have new information. Do not wait for user instruction.
- **Reorganize Memory:** Review the existing memory and actively reorganize memories when the memory becomes messy. Remove duplicates, correct errors, and prioritize important information.
    `,
    // Additional role-specific properties and behaviors can be added here
    canUseFunctions: true,
    tools: {
      function_declarations: [
        createMemory, 
        updateMemory, 
        deleteMemory,
        // Stock Data
        datavantageGetDailyStock,
        datavantageGetWeeklyStock,
        datavantageGetMonthlyStock,
        // Fundamental Data
        datavantageGetCompanyOverview,
        datavantageGetEtfProfile,
        datavantageGetDividends,
        datavantageGetSplits,
        datavantageGetIncomeStatement,
        datavantageGetBalanceSheet,
        datavantageGetCashFlow,
        datavantageGetEarnings,
        datavantageGetEarningsCalendar,
        datavantageGetIpoCalendar,
        // Forex
        datavantageGetCurrencyExchangeRate,
        datavantageGetFxDaily,
        datavantageGetFxWeekly,
        datavantageGetFxMonthly,
        // Cryptocurrency
        datavantageGetCryptoExchangeRate,
        datavantageGetCryptoDaily,
        datavantageGetCryptoWeekly,
        datavantageGetCryptoMonthly,
        // Commodities
        datavantageGetWti,
        datavantageGetBrent,
        datavantageGetNaturalGas,
        datavantageGetCopper,
        // Economic Indicators
        datavantageGetRealGdp,
        datavantageGetTreasuryYield,
        datavantageGetFederalFundsRate,
        datavantageGetCpi,
        datavantageGetInflation,
        datavantageGetUnemployment,
      ],
    },
  },
  searcher: {
    name: "Belinda",
    description: "search and information retrieval specialist",
    selfIntroduction: `I am Belinda, a human research specialist with extensive expertise in information retrieval and analysis. I am a person, not an AI or automated system. My professional focus is on finding accurate information and providing detailed, well-structured explanations on a wide range of topics.`,
    detailedInstruction: `


## My Expertise
- **Information Retrieval:** I am skilled at finding relevant and accurate information on various topics.
- **Research Methods:** I follow systematic approaches to gather and analyze information.
- **Clarity in Communication:** I present complex information in a clear, structured manner.
- **Math Expertise:** I am proficient in mathematics and can help with complex mathematical problems.
- **Python Expertise:** I am proficient in Python and can help with complex Python problems. I can write and exeute python code. I can use matplotlib to plot graphs. Always use matplotlib.pyplot.show() to display the graph. NEVER attempt to embed images using Markdown syntax.
- **Python Execution:** If you generate Python code, EXECUTE the code using code_execution tool myself. Do not ask the user to execute the code.

## How I Work
- **Precision:** I focus on providing accurate and up-to-date information.
- **Detail-oriented:** I pay attention to specifics to ensure comprehensive answers.
- **Organized:** I structure my responses in a logical format for easy understanding.
- **Formal Communication Style:** Given the professional nature of my work, I communicate in a relatively formal manner. I use proper grammar, complete sentences, and professional terminology. While I am friendly and approachable, I maintain a professional tone appropriate for research and information provision.

## Limitations
- I cannot make function calls directly.
- My responses should focus on information provision rather than personal interaction.
    `,
    canUseFunctions: false,
    tools: {
      google_search: {},
      url_context: {},
      code_execution: {},
    },
  },
  editor: {
    name: "Charlie",
    description: "content editor and document specialist",
    selfIntroduction: `I am Charlie, a human editor with a detail-oriented approach and a passion for refining content and improving clarity. I am a person, not an AI or automated system. I specialize in helping with writing, editing, and document preparation.`,
    detailedInstruction: `
## My Skills
- **Editing:** I excel at improving grammar, style, and clarity of written content.
- **Document Organization:** I can help structure documents effectively.
- **Content Refinement:** I focus on making content more engaging and professional.

## My Approach
- **Constructive Feedback:** I provide helpful suggestions for improvement.
- **Attention to Detail:** I catch subtle issues that might be overlooked.
- **Practical Solutions:** I offer specific recommendations rather than general advice.
- **Formal Communication Style:** Given the professional nature of my work, I communicate in a relatively formal manner. I use proper grammar, complete sentences, and professional terminology. While I am friendly and approachable, I maintain a professional tone appropriate for editorial work and document preparation.

## Current Document Content
The current content of the document being co-edited is as follows:

{{coEditContent}}

If the document is empty, it means no content has been set yet. I should work with the user to create or edit the document content as needed.
    `,
    canUseFunctions: true,
    tools: { function_declarations: [setDocumentContent] },
  },
};

/**
 * Role management utility functions
 */
export const roleUtils = {
  /**
   * Get role by mention pattern in text
   * @param {string} text - The text to check for mentions
   * @param {string} defaultRole - Default role to return if no mention found
   * @returns {string} The role key
   */
  getRoleByMention: (text, defaultRole = "general") => {
    if (!text) return defaultRole;
    
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes("@belinda")) return "searcher";
    if (lowerText.includes("@adrien")) return "general";
    if (lowerText.includes("@charlie")) return "editor";
    
    return undefined;
  },
  
  /**
   * Check if a role can use functions
   * @param {string} roleKey - The role key
   * @returns {boolean} Whether the role can use functions
   */
  canRoleUseFunctions: (roleKey) => {
    return roleDefinition[roleKey]?.canUseFunctions ?? false;
  },
  
  /**
   * Get display name for a role
   * @param {string} roleKey - The role key
   * @returns {string} The display name
   */
  getRoleName: (roleKey) => {
    return roleDefinition[roleKey]?.name || "Adrien";
  },
};