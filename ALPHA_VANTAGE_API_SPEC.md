# Alpha Vantage API Specification

## API Gateway Introduction

This API specification documents the Alpha Vantage API endpoints as accessed through our Azure API Management Gateway. All requests are routed through the gateway, which handles authentication and forwards requests to the underlying Alpha Vantage service.

**Base URL**: `https://jp-gw2.azure-api.net/alphavantage/query`

**Authentication**: 
- All requests must include the `Ocp-Apim-Subscription-Key` header with your subscription key
- The same subscription key used for the LLM API should be used for these endpoints
- **Note**: The `apikey` query parameter is not required when using the API Gateway - authentication is handled via the subscription key header

**Example Request**:
```bash
curl -H "Ocp-Apim-Subscription-Key: YOUR_SUBSCRIPTION_KEY" \
  "https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_DAILY&symbol=IBM"
```

---

## Table of Contents

1. [Core Stock APIs](#core-stock-apis)
2. [Options Data APIs](#options-data-apis)
3. [Alpha Intelligence™ APIs](#alpha-intelligence-apis)
4. [Fundamental Data APIs](#fundamental-data-apis)
5. [Forex (FX) APIs](#forex-fx-apis)
6. [Cryptocurrencies APIs](#cryptocurrencies-apis)
7. [Commodities APIs](#commodities-apis)
8. [Economic Indicators APIs](#economic-indicators-apis)
9. [Technical Indicators APIs](#technical-indicators-apis)

---

## Core Stock APIs

### TIME_SERIES_INTRADAY

**Description**: Returns current and 20+ years of historical intraday OHLCV time series of the equity specified, covering pre-market and post-market hours where applicable (e.g., 4:00am to 8:00pm Eastern Time for the US market). You can query both raw (as-traded) and split/dividend-adjusted intraday data from this endpoint.

**Premium**: ✅ **Yes** (Premium endpoint)

**Parameters**:
- **Required**:
  - `function`: `TIME_SERIES_INTRADAY`
  - `symbol`: The name of the equity (e.g., `IBM`)
  - `interval`: Time interval between two consecutive data points. Supported values: `1min`, `5min`, `15min`, `30min`, `60min`
- **Optional**:
  - `adjusted`: By default `true` - output time series is adjusted by historical split and dividend events. Set `false` to query raw (as-traded) intraday values
  - `extended_hours`: By default `true` - includes regular trading hours and extended (pre-market and post-market) trading hours. Set `false` for regular trading hours only (9:30am to 4:00pm US Eastern Time)
  - `month`: Query a specific month in history (format: `YYYY-MM`, e.g., `2009-01`). Any month since 2000-01 is supported
  - `outputsize`: `compact` (default, returns latest 100 data points) or `full` (returns trailing 30 days or full month if `month` is specified)
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min
```

---

### TIME_SERIES_DAILY

**Description**: Returns daily time series (date, open, high, low, close, volume) of the equity specified, covering up to 20 years of historical data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `TIME_SERIES_DAILY`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `outputsize`: `compact` (default, returns latest 100 data points) or `full` (returns full-length time series)
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_DAILY&symbol=IBM
```

---

### TIME_SERIES_DAILY_ADJUSTED

**Description**: Returns daily time series (date, open, high, low, close, adjusted close, volume, dividend amount, split coefficient) of the equity specified, covering up to 20 years of historical data.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `TIME_SERIES_DAILY_ADJUSTED`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `outputsize`: `compact` (default, returns latest 100 data points) or `full` (returns full-length time series)
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=IBM
```

---

### TIME_SERIES_WEEKLY

**Description**: Returns weekly time series (last trading day of each week, open, high, low, close, volume) of the equity specified, covering up to 20 years of historical data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `TIME_SERIES_WEEKLY`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_WEEKLY&symbol=IBM```

---

### TIME_SERIES_WEEKLY_ADJUSTED

**Description**: Returns weekly adjusted time series (last trading day of each week, open, high, low, close, adjusted close, volume, dividend amount) of the equity specified, covering up to 20 years of historical data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `TIME_SERIES_WEEKLY_ADJUSTED`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=IBM```

---

### TIME_SERIES_MONTHLY

**Description**: Returns monthly time series (last trading day of each month, open, high, low, close, volume) of the equity specified, covering up to 20 years of historical data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `TIME_SERIES_MONTHLY`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_MONTHLY&symbol=IBM```

---

### TIME_SERIES_MONTHLY_ADJUSTED

**Description**: Returns monthly adjusted time series (last trading day of each month, open, high, low, close, adjusted close, volume, dividend amount) of the equity specified, covering up to 20 years of historical data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `TIME_SERIES_MONTHLY_ADJUSTED`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=IBM```

---

### GLOBAL_QUOTE

**Description**: Returns the latest price and volume information for a specified equity.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `GLOBAL_QUOTE`
  - `symbol`: The name of the equity (e.g., `IBM`)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=GLOBAL_QUOTE&symbol=IBM```

---

### REALTIME_BULK_QUOTES

**Description**: Returns realtime quotes for US-traded symbols in bulk, accepting up to 100 symbols per API request and covering both regular and extended (pre-market and post-market) trading hours.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `REALTIME_BULK_QUOTES`
  - `symbol`: Comma-separated list of up to 100 stock ticker symbols (e.g., `IBM,MSFT,AAPL`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=REALTIME_BULK_QUOTES&symbol=IBM,MSFT,AAPL```

---

### SYMBOL_SEARCH

**Description**: Returns the best-matching symbols and market information based on keywords of your choice. The search results also contain match scores that provide you with the relevance of each symbol in the search query.

**Premium**: ❌ **No** (Free - Utility)

**Parameters**:
- **Required**:
  - `function`: `SYMBOL_SEARCH`
  - `keywords`: Keywords to search for (e.g., `microsoft`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=SYMBOL_SEARCH&keywords=microsoft```

---

### MARKET_STATUS

**Description**: Returns the current market status (open vs. closed) of major trading venues for equities, forex, and cryptocurrencies in the world.

**Premium**: ❌ **No** (Free - Utility)

**Parameters**:
- **Required**:
  - `function`: `MARKET_STATUS`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MARKET_STATUS```

---

## Options Data APIs

### REALTIME_OPTIONS

**Description**: Returns realtime options data for a specified equity symbol.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `REALTIME_OPTIONS`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=REALTIME_OPTIONS&symbol=IBM```

---

### HISTORICAL_OPTIONS

**Description**: Returns historical options data for a specified equity symbol.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `HISTORICAL_OPTIONS`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=HISTORICAL_OPTIONS&symbol=IBM```

---

## Alpha Intelligence™ APIs

### NEWS_SENTIMENT

**Description**: Returns news and sentiment data for a specified equity symbol, sourced from over 50 major financial news outlets around the world in real-time.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `NEWS_SENTIMENT`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `tickers`: Comma-separated list of tickers to filter news (e.g., `IBM,MSFT`)
  - `topics`: Filter by topics (e.g., `technology`, `finance`, `earnings`)
  - `time_from`: Start time in YYYYMMDDTHHMM format
  - `time_to`: End time in YYYYMMDDTHHMM format
  - `sort`: Sort order - `LATEST` (default), `EARLIEST`, `RELEVANCE`
  - `limit`: Number of results to return (default: 50, max: 1000)
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=NEWS_SENTIMENT&symbol=IBM```

---

### EARNINGS_CALL_TRANSCRIPT

**Description**: Returns earnings call transcript data for a specified equity symbol.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `EARNINGS_CALL_TRANSCRIPT`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `year`: Year of the earnings call (e.g., `2023`)
  - `quarter`: Quarter of the earnings call (1, 2, 3, or 4)
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=EARNINGS_CALL_TRANSCRIPT&symbol=IBM```

---

### TOP_GAINERS_LOSERS

**Description**: Returns the top 20 gainers, losers, and most actively traded tickers in the US market.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `TOP_GAINERS_LOSERS`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TOP_GAINERS_LOSERS```

---

### INSIDER_TRANSACTIONS

**Description**: Returns insider transaction data for a specified equity symbol, including buy/sell transactions by company insiders.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `INSIDER_TRANSACTIONS`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=INSIDER_TRANSACTIONS&symbol=IBM```

---

### ANALYTICS_FIXED_WINDOW

**Description**: Returns analytics data for a specified equity symbol using a fixed time window.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `ANALYTICS_FIXED_WINDOW`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ANALYTICS_FIXED_WINDOW&symbol=IBM```

---

### ANALYTICS_SLIDING_WINDOW

**Description**: Returns analytics data for a specified equity symbol using a sliding time window.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `ANALYTICS_SLIDING_WINDOW`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ANALYTICS_SLIDING_WINDOW&symbol=IBM```

---

## Fundamental Data APIs

### OVERVIEW

**Description**: Returns the company information, financial ratios, and other key metrics for the equity specified.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `OVERVIEW`
  - `symbol`: The name of the equity (e.g., `IBM`)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=OVERVIEW&symbol=IBM```

---

### ETF_PROFILE

**Description**: Returns the ETF profile and holdings data for a specified ETF symbol.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `ETF_PROFILE`
  - `symbol`: The name of the ETF (e.g., `SPY`)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ETF_PROFILE&symbol=SPY```

---

### DIVIDENDS

**Description**: Returns the dividend data for a specified equity symbol.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `DIVIDENDS`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=DIVIDENDS&symbol=IBM```

---

### SPLITS

**Description**: Returns the stock split data for a specified equity symbol.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `SPLITS`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=SPLITS&symbol=IBM```

---

### INCOME_STATEMENT

**Description**: Returns the annual and quarterly income statements for the equity specified.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `INCOME_STATEMENT`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=INCOME_STATEMENT&symbol=IBM```

---

### BALANCE_SHEET

**Description**: Returns the annual and quarterly balance sheets for the equity specified.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `BALANCE_SHEET`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=BALANCE_SHEET&symbol=IBM```

---

### CASH_FLOW

**Description**: Returns the annual and quarterly cash flow statements for the equity specified.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `CASH_FLOW`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=CASH_FLOW&symbol=IBM```

---

### SHARES_OUTSTANDING

**Description**: Returns the shares outstanding data for a specified equity symbol.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `SHARES_OUTSTANDING`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=SHARES_OUTSTANDING&symbol=IBM```

---

### EARNINGS

**Description**: Returns the annual and quarterly earnings (EPS) data for the equity specified.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `EARNINGS`
  - `symbol`: The name of the equity (e.g., `IBM`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=EARNINGS&symbol=IBM```

---

### EARNINGS_CALENDAR

**Description**: Returns the earnings calendar data for upcoming earnings announcements.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `EARNINGS_CALENDAR`
- **Optional**:
  - `symbol`: Filter by specific symbol
  - `horizon`: Time horizon (e.g., `3month`, `6month`, `12month`)
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=EARNINGS_CALENDAR```

---

### IPO_CALENDAR

**Description**: Returns the IPO calendar data for upcoming initial public offerings.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `IPO_CALENDAR`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=IPO_CALENDAR```

---

### LISTING_STATUS

**Description**: Returns the listing and delisting status of equities.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `LISTING_STATUS`
- **Optional**:
  - `date`: Filter by date (format: `YYYY-MM-DD`)
  - `state`: Filter by state (`active` or `delisted`)
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=LISTING_STATUS```

---

## Forex (FX) APIs

### CURRENCY_EXCHANGE_RATE

**Description**: Returns the realtime exchange rate for any pair of cryptocurrency (e.g., Bitcoin) or physical currency (e.g., USD). This function handles both crypto-to-fiat and fiat-to-fiat conversions.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `CURRENCY_EXCHANGE_RATE`
  - `from_currency`: The currency you would like to get the exchange rate for (e.g., `USD`)
  - `to_currency`: The destination currency for the exchange rate (e.g., `JPY`)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=JPY```

---

### FX_INTRADAY

**Description**: Returns intraday time series (timestamp, open, high, low, close) of the FX currency pair specified, updated realtime.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `FX_INTRADAY`
  - `from_symbol`: The symbol of the currency you would like to get (e.g., `EUR`)
  - `to_symbol`: The symbol of the currency you would like to convert into (e.g., `USD`)
  - `interval`: Time interval between two consecutive data points. Supported values: `1min`, `5min`, `15min`, `30min`, `60min`
- **Optional**:
  - `outputsize`: `compact` (default) or `full`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=FX_INTRADAY&from_symbol=EUR&to_symbol=USD&interval=5min```

---

### FX_DAILY

**Description**: Returns the daily time series (date, open, high, low, close) of the FX currency pair specified, updated realtime.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `FX_DAILY`
  - `from_symbol`: The symbol of the currency you would like to get (e.g., `EUR`)
  - `to_symbol`: The symbol of the currency you would like to convert into (e.g., `USD`)
- **Optional**:
  - `outputsize`: `compact` (default) or `full`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD```

---

### FX_WEEKLY

**Description**: Returns the weekly time series (last trading day of each week, open, high, low, close) of the FX currency pair specified, updated realtime.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `FX_WEEKLY`
  - `from_symbol`: The symbol of the currency you would like to get (e.g., `EUR`)
  - `to_symbol`: The symbol of the currency you would like to convert into (e.g., `USD`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=FX_WEEKLY&from_symbol=EUR&to_symbol=USD```

---

### FX_MONTHLY

**Description**: Returns the monthly time series (last trading day of each month, open, high, low, close) of the FX currency pair specified, updated realtime.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `FX_MONTHLY`
  - `from_symbol`: The symbol of the currency you would like to get (e.g., `EUR`)
  - `to_symbol`: The symbol of the currency you would like to convert into (e.g., `USD`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=FX_MONTHLY&from_symbol=EUR&to_symbol=USD```

---

## Cryptocurrencies APIs

**Note**: The `CURRENCY_EXCHANGE_RATE` function (documented in the Forex section) handles both cryptocurrency and physical currency exchange rates. Use `from_currency=BTC` and `to_currency=USD` for crypto-to-fiat conversions.

### CRYPTO_INTRADAY

**Description**: Returns intraday time series (timestamp, open, high, low, close, volume) of the cryptocurrency pair specified, updated realtime.

**Premium**: ✅ **Yes** (Premium)

**Parameters**:
- **Required**:
  - `function`: `CRYPTO_INTRADAY`
  - `symbol`: The digital/crypto or physical currency symbol (e.g., `BTC`)
  - `market`: The physical/exchange market you want to obtain data for (e.g., `USD`)
  - `interval`: Time interval between two consecutive data points. Supported values: `1min`, `5min`, `15min`, `30min`, `60min`
- **Optional**:
  - `outputsize`: `compact` (default) or `full`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=CRYPTO_INTRADAY&symbol=BTC&market=USD&interval=5min```

---

### DIGITAL_CURRENCY_DAILY

**Description**: Returns the daily time series (date, open, high, low, close, volume) of the digital currency specified, updated realtime.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `DIGITAL_CURRENCY_DAILY`
  - `symbol`: The digital/crypto or physical currency symbol (e.g., `BTC`)
  - `market`: The physical/exchange market you want to obtain data for (e.g., `USD`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD```

---

### DIGITAL_CURRENCY_WEEKLY

**Description**: Returns the weekly time series (last trading day of each week, open, high, low, close, volume) of the digital currency specified, updated realtime.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `DIGITAL_CURRENCY_WEEKLY`
  - `symbol`: The digital/crypto or physical currency symbol (e.g., `BTC`)
  - `market`: The physical/exchange market you want to obtain data for (e.g., `USD`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=DIGITAL_CURRENCY_WEEKLY&symbol=BTC&market=USD```

---

### DIGITAL_CURRENCY_MONTHLY

**Description**: Returns the monthly time series (last trading day of each month, open, high, low, close, volume) of the digital currency specified, updated realtime.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `DIGITAL_CURRENCY_MONTHLY`
  - `symbol`: The digital/crypto or physical currency symbol (e.g., `BTC`)
  - `market`: The physical/exchange market you want to obtain data for (e.g., `USD`)
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=DIGITAL_CURRENCY_MONTHLY&symbol=BTC&market=USD```

---

## Commodities APIs

### WTI

**Description**: Returns the West Texas Intermediate (WTI) crude oil prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `WTI`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=WTI```

---

### BRENT

**Description**: Returns the Brent crude oil prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `BRENT`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=BRENT```

---

### NATURAL_GAS

**Description**: Returns the natural gas prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `NATURAL_GAS`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=NATURAL_GAS```

---

### COPPER

**Description**: Returns the copper prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `COPPER`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=COPPER```

---

### ALUMINUM

**Description**: Returns the aluminum prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `ALUMINUM`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ALUMINUM```

---

### WHEAT

**Description**: Returns the wheat prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `WHEAT`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=WHEAT```

---

### CORN

**Description**: Returns the corn prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `CORN`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=CORN```

---

### COTTON

**Description**: Returns the cotton prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `COTTON`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=COTTON```

---

### SUGAR

**Description**: Returns the sugar prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `SUGAR`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=SUGAR```

---

### COFFEE

**Description**: Returns the coffee prices.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `COFFEE`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=COFFEE```

---

### GLOBAL_COMMODITIES_INDEX

**Description**: Returns the global commodities index.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `GLOBAL_COMMODITIES_INDEX`
- **Optional**:
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=GLOBAL_COMMODITIES_INDEX```

---

## Economic Indicators APIs

### REAL_GDP

**Description**: Returns the real GDP (Gross Domestic Product) data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `REAL_GDP`
- **Optional**:
  - `interval`: `annual` (default) or `quarterly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=REAL_GDP```

---

### REAL_GDP_PER_CAPITA

**Description**: Returns the real GDP per capita data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `REAL_GDP_PER_CAPITA`
- **Optional**:
  - `interval`: `annual` (default) or `quarterly`
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=REAL_GDP_PER_CAPITA```

---

### TREASURY_YIELD

**Description**: Returns the US Treasury yield data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `TREASURY_YIELD`
  - `interval`: `daily` (default), `weekly`, `monthly`
  - `maturity`: `3month`, `2year`, `5year`, `7year`, `10year`, `30year`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TREASURY_YIELD&interval=daily&maturity=10year```

---

### FEDERAL_FUNDS_RATE

**Description**: Returns the federal funds (interest) rate data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `FEDERAL_FUNDS_RATE`
  - `interval`: `daily` (default), `weekly`, `monthly`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=FEDERAL_FUNDS_RATE&interval=daily```

---

### CPI

**Description**: Returns the Consumer Price Index (CPI) data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `CPI`
  - `interval`: `monthly` (default) or `semiannual`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=CPI&interval=monthly```

---

### INFLATION

**Description**: Returns the inflation data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `INFLATION`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=INFLATION```

---

### RETAIL_SALES

**Description**: Returns the retail sales data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `RETAIL_SALES`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=RETAIL_SALES```

---

### DURABLES

**Description**: Returns the monthly manufacturers' new orders of durable goods in the United States.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `DURABLES`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=DURABLES```

---

### UNEMPLOYMENT

**Description**: Returns the unemployment rate data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `UNEMPLOYMENT`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=UNEMPLOYMENT```

---

### NONFARM_PAYROLL

**Description**: Returns the nonfarm payroll data.

**Premium**: ❌ **No** (Free)

**Parameters**:
- **Required**:
  - `function`: `NONFARM_PAYROLL`
- **Optional**:
  - `datatype`: `json` (default) or `csv`

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=NONFARM_PAYROLL```

---

## Technical Indicators APIs

All technical indicators require the following common parameters:
- **Required**:
  - `function`: The technical indicator function name
  - `symbol`: The name of the ticker (e.g., `IBM`)
  - `interval`: Time interval between two consecutive data points. Supported values: `1min`, `5min`, `15min`, `30min`, `60min`, `daily`, `weekly`, `monthly`
  - `series_type`: The desired price type in the time series. Four types are supported: `close`, `open`, `high`, `low`
- **Optional**:
  - `month`: Query a specific month in history (format: `YYYY-MM`, e.g., `2009-01`)
  - `datatype`: `json` (default) or `csv`

Most technical indicators are **Free**, unless otherwise specified.

---

### SMA (Simple Moving Average)

**Description**: Returns the Simple Moving Average (SMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=SMA&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### EMA (Exponential Moving Average)

**Description**: Returns the Exponential Moving Average (EMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=EMA&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### WMA (Weighted Moving Average)

**Description**: Returns the Weighted Moving Average (WMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=WMA&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### DEMA (Double Exponential Moving Average)

**Description**: Returns the Double Exponential Moving Average (DEMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=DEMA&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### TEMA (Triple Exponential Moving Average)

**Description**: Returns the Triple Exponential Moving Average (TEMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TEMA&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### TRIMA (Triangular Moving Average)

**Description**: Returns the Triangular Moving Average (TRIMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TRIMA&symbol=IBM&interval=daily&time_period=60&series_type=close
```

---

### KAMA (Kaufman Adaptive Moving Average)

**Description**: Returns the Kaufman Adaptive Moving Average (KAMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=KAMA&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### MAMA (MESA Adaptive Moving Average)

**Description**: Returns the MESA Adaptive Moving Average (MAMA) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `fastlimit`: Upper limit for the adaptive factor (positive number)
  - `slowlimit`: Lower limit for the adaptive factor (positive number)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MAMA&symbol=IBM&interval=daily&series_type=close&fastlimit=0.01&slowlimit=0.01```

---

### VWAP (Volume Weighted Average Price)

**Description**: Returns the Volume Weighted Average Price (VWAP) values.

**Premium**: ✅ **Yes** (Premium)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=VWAP&symbol=IBM&interval=60min```

---

### T3

**Description**: Returns the T3 values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each moving average value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=T3&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### MACD (Moving Average Convergence/Divergence)

**Description**: Returns the Moving Average Convergence/Divergence (MACD) values.

**Premium**: ✅ **Yes** (Premium)

**Additional Parameters**:
- **Optional**:
  - `series_type`: `close` (default), `open`, `high`, `low`
  - `fastperiod`: Positive integer (default: 12)
  - `slowperiod`: Positive integer (default: 26)
  - `signalperiod`: Positive integer (default: 9)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MACD&symbol=IBM&interval=daily&series_type=close```

---

### MACDEXT (MACD with controllable MA type)

**Description**: Returns the MACD with controllable MA type values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `series_type`: `close` (default), `open`, `high`, `low`
  - `fastperiod`: Positive integer (default: 12)
  - `slowperiod`: Positive integer (default: 26)
  - `signalperiod`: Positive integer (default: 9)
  - `fastmatype`: Moving average type for fast period (default: 0)
  - `slowmatype`: Moving average type for slow period (default: 0)
  - `signalmatype`: Moving average type for signal period (default: 0)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MACDEXT&symbol=IBM&interval=daily&series_type=close```

---

### STOCH (Stochastic Oscillator)

**Description**: Returns the Stochastic Oscillator (STOCH) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `fastkperiod`: Period for the fast %K (positive integer, default: 5)
  - `slowkperiod`: Period for the slow %K (positive integer, default: 3)
  - `slowdperiod`: Period for the slow %D (positive integer, default: 3)
  - `slowkmatype`: Moving average type for slow %K (default: 0)
  - `slowdmatype`: Moving average type for slow %D (default: 0)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=STOCH&symbol=IBM&interval=daily```

---

### STOCHF (Stochastic Fast)

**Description**: Returns the Stochastic Fast (STOCHF) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `fastkperiod`: Period for the fast %K (positive integer, default: 5)
  - `fastdperiod`: Period for the fast %D (positive integer, default: 3)
  - `fastdmatype`: Moving average type for fast %D (default: 0)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=STOCHF&symbol=IBM&interval=daily```

---

### RSI (Relative Strength Index)

**Description**: Returns the Relative Strength Index (RSI) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each RSI value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=RSI&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### STOCHRSI (Stochastic Relative Strength Index)

**Description**: Returns the Stochastic Relative Strength Index (STOCHRSI) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each STOCHRSI value (positive integer)
- **Optional**:
  - `fastkperiod`: Period for the fast %K (positive integer, default: 5)
  - `fastdperiod`: Period for the fast %D (positive integer, default: 3)
  - `fastdmatype`: Moving average type for fast %D (default: 0)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=STOCHRSI&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### WILLR (Williams' %R)

**Description**: Returns the Williams' %R (WILLR) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each WILLR value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=WILLR&symbol=IBM&interval=daily&time_period=60```

---

### ADX (Average Directional Movement Index)

**Description**: Returns the Average Directional Movement Index (ADX) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each ADX value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ADX&symbol=IBM&interval=daily&time_period=60```

---

### ADXR (Average Directional Movement Index Rating)

**Description**: Returns the Average Directional Movement Index Rating (ADXR) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each ADXR value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ADXR&symbol=IBM&interval=daily&time_period=60```

---

### APO (Absolute Price Oscillator)

**Description**: Returns the Absolute Price Oscillator (APO) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `fastperiod`: Period for the fast MA (positive integer, default: 12)
  - `slowperiod`: Period for the slow MA (positive integer, default: 26)
  - `matype`: Moving average type (default: 0)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=APO&symbol=IBM&interval=daily&series_type=close```

---

### PPO (Percentage Price Oscillator)

**Description**: Returns the Percentage Price Oscillator (PPO) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `fastperiod`: Period for the fast MA (positive integer, default: 12)
  - `slowperiod`: Period for the slow MA (positive integer, default: 26)
  - `matype`: Moving average type (default: 0)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=PPO&symbol=IBM&interval=daily&series_type=close```

---

### MOM (Momentum)

**Description**: Returns the Momentum (MOM) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each MOM value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MOM&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### BOP (Balance of Power)

**Description**: Returns the Balance of Power (BOP) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=BOP&symbol=IBM&interval=daily```

---

### CCI (Commodity Channel Index)

**Description**: Returns the Commodity Channel Index (CCI) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each CCI value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=CCI&symbol=IBM&interval=daily&time_period=60```

---

### CMO (Chande Momentum Oscillator)

**Description**: Returns the Chande Momentum Oscillator (CMO) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each CMO value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=CMO&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### ROC (Rate of Change)

**Description**: Returns the Rate of Change (ROC) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each ROC value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ROC&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### ROCR (Rate of Change Ratio)

**Description**: Returns the Rate of Change Ratio (ROCR) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each ROCR value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ROCR&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### AROON (Aroon)

**Description**: Returns the Aroon values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each Aroon value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=AROON&symbol=IBM&interval=daily&time_period=60```

---

### AROONOSC (Aroon Oscillator)

**Description**: Returns the Aroon Oscillator (AROONOSC) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each AROONOSC value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=AROONOSC&symbol=IBM&interval=daily&time_period=60```

---

### MFI (Money Flow Index)

**Description**: Returns the Money Flow Index (MFI) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each MFI value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MFI&symbol=IBM&interval=daily&time_period=60```

---

### TRIX (1-day Rate-Of-Change (ROC) of a Triple Smooth EMA)

**Description**: Returns the TRIX values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each TRIX value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TRIX&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### ULTOSC (Ultimate Oscillator)

**Description**: Returns the Ultimate Oscillator (ULTOSC) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `timeperiod1`: First time period (positive integer, default: 7)
  - `timeperiod2`: Second time period (positive integer, default: 14)
  - `timeperiod3`: Third time period (positive integer, default: 28)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ULTOSC&symbol=IBM&interval=daily```

---

### DX (Directional Movement Index)

**Description**: Returns the Directional Movement Index (DX) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each DX value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=DX&symbol=IBM&interval=daily&time_period=60```

---

### MINUS_DI (Minus Directional Indicator)

**Description**: Returns the Minus Directional Indicator (MINUS_DI) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each MINUS_DI value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MINUS_DI&symbol=IBM&interval=daily&time_period=60```

---

### PLUS_DI (Plus Directional Indicator)

**Description**: Returns the Plus Directional Indicator (PLUS_DI) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each PLUS_DI value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=PLUS_DI&symbol=IBM&interval=daily&time_period=60```

---

### MINUS_DM (Minus Directional Movement)

**Description**: Returns the Minus Directional Movement (MINUS_DM) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each MINUS_DM value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MINUS_DM&symbol=IBM&interval=daily&time_period=60```

---

### PLUS_DM (Plus Directional Movement)

**Description**: Returns the Plus Directional Movement (PLUS_DM) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each PLUS_DM value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=PLUS_DM&symbol=IBM&interval=daily&time_period=60```

---

### BBANDS (Bollinger Bands)

**Description**: Returns the Bollinger Bands (BBANDS) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each BBANDS value (positive integer)
- **Optional**:
  - `nbdevup`: Number of standard deviations for upper band (positive number, default: 2)
  - `nbdevdn`: Number of standard deviations for lower band (positive number, default: 2)
  - `matype`: Moving average type (default: 0)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=BBANDS&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### MIDPOINT (MidPoint over period)

**Description**: Returns the MidPoint over period values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each MIDPOINT value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MIDPOINT&symbol=IBM&interval=daily&time_period=60&series_type=close```

---

### MIDPRICE (Midpoint Price over period)

**Description**: Returns the Midpoint Price over period values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each MIDPRICE value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=MIDPRICE&symbol=IBM&interval=daily&time_period=60```

---

### SAR (Parabolic SAR)

**Description**: Returns the Parabolic SAR (SAR) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `acceleration`: Acceleration factor used up to the maximum value (positive number, default: 0.01)
  - `maximum`: Acceleration factor maximum value (positive number, default: 0.20)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=SAR&symbol=IBM&interval=daily```

---

### TRANGE (True Range)

**Description**: Returns the True Range (TRANGE) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=TRANGE&symbol=IBM&interval=daily```

---

### ATR (Average True Range)

**Description**: Returns the Average True Range (ATR) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each ATR value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ATR&symbol=IBM&interval=daily&time_period=60```

---

### NATR (Normalized Average True Range)

**Description**: Returns the Normalized Average True Range (NATR) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Required**:
  - `time_period`: Number of data points used to calculate each NATR value (positive integer)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=NATR&symbol=IBM&interval=daily&time_period=60```

---

### AD (Chaikin A/D Line)

**Description**: Returns the Chaikin A/D Line (AD) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=AD&symbol=IBM&interval=daily```

---

### ADOSC (Chaikin A/D Oscillator)

**Description**: Returns the Chaikin A/D Oscillator (ADOSC) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**:
- **Optional**:
  - `fastperiod`: Period for the fast MA (positive integer, default: 3)
  - `slowperiod`: Period for the slow MA (positive integer, default: 10)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=ADOSC&symbol=IBM&interval=daily```

---

### OBV (On Balance Volume)

**Description**: Returns the On Balance Volume (OBV) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=OBV&symbol=IBM&interval=daily```

---

### HT_TRENDLINE (Hilbert Transform - Instantaneous Trendline)

**Description**: Returns the Hilbert Transform - Instantaneous Trendline (HT_TRENDLINE) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=HT_TRENDLINE&symbol=IBM&interval=daily&series_type=close```

---

### HT_SINE (Hilbert Transform - SineWave)

**Description**: Returns the Hilbert Transform - SineWave (HT_SINE) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=HT_SINE&symbol=IBM&interval=daily&series_type=close```

---

### HT_TRENDMODE (Hilbert Transform - Trend vs Cycle Mode)

**Description**: Returns the Hilbert Transform - Trend vs Cycle Mode (HT_TRENDMODE) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=HT_TRENDMODE&symbol=IBM&interval=daily&series_type=close```

---

### HT_DCPERIOD (Hilbert Transform - Dominant Cycle Period)

**Description**: Returns the Hilbert Transform - Dominant Cycle Period (HT_DCPERIOD) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=HT_DCPERIOD&symbol=IBM&interval=daily&series_type=close```

---

### HT_DCPHASE (Hilbert Transform - Dominant Cycle Phase)

**Description**: Returns the Hilbert Transform - Dominant Cycle Phase (HT_DCPHASE) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=HT_DCPHASE&symbol=IBM&interval=daily&series_type=close```

---

### HT_PHASOR (Hilbert Transform - Phasor Components)

**Description**: Returns the Hilbert Transform - Phasor Components (HT_PHASOR) values.

**Premium**: ❌ **No** (Free)

**Additional Parameters**: None (uses common parameters only)

**Example**:
```
https://jp-gw2.azure-api.net/alphavantage/query?function=HT_PHASOR&symbol=IBM&interval=weekly&series_type=close
```

---

## Summary

### Premium Endpoints
The following endpoints require a premium subscription:

1. **Core Stock APIs**:
   - `TIME_SERIES_INTRADAY`
   - `TIME_SERIES_DAILY_ADJUSTED`
   - `REALTIME_BULK_QUOTES`

2. **Options Data APIs**:
   - `REALTIME_OPTIONS`
   - `HISTORICAL_OPTIONS`

3. **Alpha Intelligence™ APIs**:
   - `NEWS_SENTIMENT`
   - `EARNINGS_CALL_TRANSCRIPT`
   - `TOP_GAINERS_LOSERS`
   - `INSIDER_TRANSACTIONS`
   - `ANALYTICS_FIXED_WINDOW`
   - `ANALYTICS_SLIDING_WINDOW`

4. **Forex APIs**:
   - `FX_INTRADAY`

5. **Cryptocurrencies APIs**:
   - `CRYPTO_INTRADAY`
   
**Note**: `CURRENCY_EXCHANGE_RATE` (in Forex section) handles both crypto and physical currency exchange rates.

6. **Technical Indicators**:
   - `VWAP`
   - `MACD`

### Free Endpoints
All other endpoints listed in this specification are available through the API Gateway with your subscription key, subject to rate limits.

---

**Note**: This specification is based on the Alpha Vantage API documentation as of the latest update. For the most current information, please refer to the official documentation at https://www.alphavantage.co/documentation/

**Authentication**: All requests must include the `Ocp-Apim-Subscription-Key` header with your subscription key. Use the same subscription key that you use for the LLM API.

