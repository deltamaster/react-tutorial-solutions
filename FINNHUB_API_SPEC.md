# Finnhub API Specification

## API Gateway Introduction

This API specification documents the Finnhub API endpoints as accessed through our Azure API Management Gateway. All requests are routed through the gateway, which handles authentication and forwards requests to the underlying Finnhub service.

**Base URL**: `https://jp-gw2.azure-api.net/finnhub`

**Authentication**: 
- All requests must include the `Ocp-Apim-Subscription-Key` header with your subscription key
- The same subscription key used for the LLM API should be used for these endpoints
- **Note**: The `token` query parameter is not required when using the API Gateway - authentication is handled via the subscription key header

**Example Request**:
```bash
curl -H "Ocp-Apim-Subscription-Key: YOUR_SUBSCRIPTION_KEY" \
  "https://jp-gw2.azure-api.net/finnhub/quote?symbol=AAPL"
```

---

## Table of Contents

1. [Stock Data APIs](#stock-data-apis)
2. [Company Information APIs](#company-information-apis)
3. [News & Sentiment APIs](#news--sentiment-apis)
4. [Calendar APIs](#calendar-apis)
5. [Market Data APIs](#market-data-apis)

---

## Stock Data APIs

### Quote

**Description**: Get real-time quote data for US stocks. Updated real-time during market hours. Constant polling is not recommended. Use websocket if you need real-time updates.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Required**:
  - `symbol`: Symbol of the company (e.g., `AAPL`)

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/quote?symbol=AAPL
```

---

### Stock Candle

**Description**: Get candlestick data (OHLCV) for stocks. Daily data will be adjusted for Splits. Intraday data will remain unadjusted. Only 1 month of intraday will be returned at a time. Support resolution: 1, 5, 15, 30, 60, D, W, M

**Premium**: ✅ **Yes** (Premium subscription required)

**Parameters**:
- **Required**:
  - `symbol`: Symbol (e.g., `AAPL`)
  - `resolution`: Resolution supported values: `1`, `5`, `15`, `30`, `60`, `D`, `W`, `M`
  - `from`: From timestamp (Unix seconds, e.g., `1609459200`)
  - `to`: To timestamp (Unix seconds, e.g., `1640995200`)

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/candle?symbol=AAPL&resolution=D&from=1609459200&to=1640995200
```

---

### Recommendation Trends

**Description**: Get latest analyst recommendation trends for a company.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Required**:
  - `symbol`: Symbol of the company (e.g., `AAPL`)

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/recommendation?symbol=AAPL
```

---

## Company Information APIs

### Company Profile 2

**Description**: Get general information of a company. You can query by symbol, ISIN, or CUSIP. This is the free version of Company Profile.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Required** (at least one):
  - `symbol`: Symbol of the company (e.g., `AAPL`)
  - `isin`: ISIN
  - `cusip`: CUSIP

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/profile2?symbol=AAPL
```

---

### Peers

**Description**: Get company peers. Return a list of peers operating in the same country and sector/industry.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Required**:
  - `symbol`: Symbol of the company (e.g., `AAPL`)
- **Optional**:
  - `grouping`: Grouping method (`industry` or `sector`)

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/peers?symbol=AAPL
```

---

### Key Metrics (Basic Financials)

**Description**: Get company basic financials such as margin, P/E ratio, 52-week high/low etc.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Required**:
  - `symbol`: Symbol of the company (e.g., `AAPL`)
  - `metric`: Metric type. Can be `all` (default) or specific metric

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/metric?symbol=AAPL&metric=all
```

---

### Financials

**Description**: Get standardized balance sheet, income statement and cash flow for global companies going back 30+ years.

**Premium**: ✅ **Yes** (Premium subscription required)

**Parameters**:
- **Required**:
  - `symbol`: Symbol of the company (e.g., `AAPL`)
  - `statement`: Statement type - `bs` (balance sheet), `ic` (income statement), or `cf` (cash flow)
  - `freq`: Frequency - `annual` or `quarterly`

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/financials?symbol=AAPL&statement=bs&freq=annual
```

---

## News & Sentiment APIs

### Company News

**Description**: List latest company news by symbol. This endpoint is available for North American companies.

**Premium**: ❌ **No** (Free - Rate limited)
- **Free Tier**: 1 year of historical news and new updates

**Parameters**:
- **Required**:
  - `symbol`: Company symbol (e.g., `AAPL`)
  - `from`: From date (YYYY-MM-DD, e.g., `2023-01-01`)
  - `to`: To date (YYYY-MM-DD, e.g., `2023-12-31`)

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/company-news?symbol=AAPL&from=2023-01-01&to=2023-12-31
```

---

## Calendar APIs

### Earnings Calendar

**Description**: Get earnings calendar. Earnings data is updated daily at 9am EST with the latest data available from the previous trading day.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Optional**:
  - `from`: From date (YYYY-MM-DD, e.g., `2023-01-01`)
  - `to`: To date (YYYY-MM-DD, e.g., `2023-12-31`)
  - `symbol`: Filter by specific symbol (e.g., `AAPL`)

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/calendar/earnings?from=2023-01-01&to=2023-12-31
```

---

### IPO Calendar

**Description**: Get IPO calendar. Upcoming and historical IPO dates published in the past 3 months.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Required**:
  - `from`: From date (YYYY-MM-DD, e.g., `2023-01-01`)
  - `to`: To date (YYYY-MM-DD, e.g., `2023-12-31`)

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/calendar/ipo?from=2023-01-01&to=2023-12-31
```

---

## Market Data APIs

### Stock Symbols

**Description**: List supported stocks. Returns all supported stocks with their symbols, names, and other metadata. We use the following symbology to identify stocks on Finnhub: `Exchange_Ticker.Exchange_Code`.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**:
- **Required**:
  - `exchange`: Exchange you want to get the list of symbols from (e.g., `US`)
- **Optional**:
  - `mic`: Mic code
  - `securityType`: Security type
  - `currency`: Currency

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/symbol?exchange=US
```

---

### Sector Performance

**Description**: Get sector performance calculated from S&P500 companies.

**Premium**: ❌ **No** (Free - Rate limited)

**Parameters**: None

**Example**:
```
https://jp-gw2.azure-api.net/finnhub/stock/sectors
```

---

## Summary

### Rate Limits

Finnhub API has rate limits based on your subscription tier:
- **Free Tier**: 60 API calls/minute
- **Basic Tier**: 120 API calls/minute
- **Professional Tier**: 300 API calls/minute
- **Enterprise Tier**: Custom rate limits

### Free Tier Endpoints

The following endpoints are available on the free tier (subject to rate limits):
- Quote (`/quote`)
- Recommendation Trends (`/stock/recommendation`)
- Company Profile 2 (`/stock/profile2`)
- Peers (`/stock/peers`)
- Key Metrics (`/stock/metric`) - Also known as Company Basic Financials
- Company News (`/company-news`) - Free tier: 1 year of historical news
- Earnings Calendar (`/calendar/earnings`)
- IPO Calendar (`/calendar/ipo`)
- Stock Symbols (`/stock/symbol`)
- Sector Performance (`/stock/sectors`)

### Premium Endpoints

The following endpoints require a premium subscription:
- Stock Candle (`/stock/candle`) - Historical candlestick data
- Financials (`/stock/financials`) - Detailed financial statements
- Crypto Candle (`/crypto/candle`) - Cryptocurrency candlestick data
- Forex Rates (`/forex/rates`) - Forex exchange rates
- Forex Candle (`/forex/candle`) - Forex candlestick data
- Economic Data (`/economic`) - Economic indicators

**Note**: This specification is based on the official Finnhub API documentation. For the most current information, please refer to the official documentation at https://finnhub.io/docs/api/

**Authentication**: All requests must include the `Ocp-Apim-Subscription-Key` header with your subscription key. Use the same subscription key that you use for the LLM API.
