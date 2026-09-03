/**
 * Gemini generateContent usage → USD estimate from published per-1M-token rates.
 * Rates are (cached / non-cached input / output) in USD per 1M tokens.
 */

const MODEL_PRICING_USD_PER_1M = {
  "gemini-3.8-flash": { cached: 0.075, input: 0.75, output: 3.75 },
  "gemini-3.7-flash": { cached: 0.075, input: 0.75, output: 3.75 },
  "gemini-3.5-flash-lite": { cached: 0.03, input: 0.3, output: 2.5 },
  "gemini-3.5-flash": { cached: 0.15, input: 1.5, output: 9 },
  "gemini-3.1-pro-preview": { cached: 0.2, input: 2, output: 12 },
  "gemini-3.1-flash-lite": { cached: 0.025, input: 0.25, output: 1.5 },
  "gemini-3.1-flash-lite-preview": { cached: 0.025, input: 0.25, output: 1.5 },
};

const DEFAULT_MODEL_KEY = "gemini-3.8-flash";

const SORTED_MODEL_KEYS = Object.keys(MODEL_PRICING_USD_PER_1M).sort(
  (a, b) => b.length - a.length
);

/**
 * @param {string} [modelVersion]
 * @returns {keyof typeof MODEL_PRICING_USD_PER_1M}
 */
export function resolveModelPricingKey(modelVersion) {
  if (!modelVersion || typeof modelVersion !== "string") {
    return DEFAULT_MODEL_KEY;
  }
  const mv = modelVersion.trim();
  const exact = SORTED_MODEL_KEYS.find((k) => mv === k);
  if (exact) {
    return exact;
  }
  const prefix = SORTED_MODEL_KEYS.find((k) => mv.startsWith(k));
  return prefix || DEFAULT_MODEL_KEY;
}

/**
 * @param {string} [modelVersion] — e.g. response.modelVersion
 * @param {object} [usageMetadata] — e.g. response.usageMetadata
 * @returns {object | null}
 */
export function computeGeminiResponseCostUsd(modelVersion, usageMetadata) {
  if (!usageMetadata || typeof usageMetadata !== "object") {
    console.log("[UsageCost] computeGeminiResponseCostUsd: skipped (no usageMetadata)", {
      modelVersion,
      usageMetadataType: usageMetadata === undefined ? "undefined" : typeof usageMetadata,
    });
    return null;
  }

  const pricingKey = resolveModelPricingKey(modelVersion);
  const pricing = MODEL_PRICING_USD_PER_1M[pricingKey];

  const cached = Math.max(0, Number(usageMetadata.cachedContentTokenCount) || 0);
  const promptSide =
    (Number(usageMetadata.promptTokenCount) || 0) +
    (Number(usageMetadata.toolUsePromptTokenCount) || 0);
  const uncachedInput = Math.max(0, promptSide - cached);
  const output =
    (Number(usageMetadata.candidatesTokenCount) || 0) +
    (Number(usageMetadata.thoughtsTokenCount) || 0);

  const usd =
    (cached / 1_000_000) * pricing.cached +
    (uncachedInput / 1_000_000) * pricing.input +
    (output / 1_000_000) * pricing.output;

  const result = {
    usd,
    modelVersion: modelVersion || pricingKey,
    pricingModelKey: pricingKey,
    cachedTokens: cached,
    uncachedInputTokens: uncachedInput,
    outputTokens: output,
  };

  console.log("[UsageCost] computeGeminiResponseCostUsd: computed", {
    ...result,
    rawUsageKeys: Object.keys(usageMetadata),
    resolvedFromModelVersion: modelVersion,
  });

  return result;
}

/** @type {null | function(object): void} */
let usageCostReporter = null;

/**
 * Register a listener for every reported Gemini usage cost (chat + auxiliary APIs).
 * Used by App for toast and local ledger rows.
 * @param {function(object): void | null | undefined} fn
 */
export function setUsageCostReporter(fn) {
  usageCostReporter = typeof fn === "function" ? fn : null;
}

/**
 * Notify reporter from any generateContent response (parsed JSON body).
 * @param {object} responseObj
 * @param {object} [extra] e.g. { source: 'conversationMetadata' }
 * @param {object|null} [precomputed] pass compute result to avoid recomputing; omit to compute from responseObj
 */
export function reportApiUsageCost(responseObj, extra = {}, precomputed) {
  if (!responseObj || typeof responseObj !== "object") {
    console.log("[UsageCost] reportApiUsageCost: skipped (no response object)", extra);
    return;
  }

  const cost =
    precomputed !== undefined
      ? precomputed
      : computeGeminiResponseCostUsd(
          responseObj.modelVersion,
          responseObj.usageMetadata
        );

  if (!cost) {
    console.warn("[UsageCost] reportApiUsageCost: no cost to report", {
      ...extra,
      modelVersion: responseObj.modelVersion,
      hasUsageMetadata: !!responseObj.usageMetadata,
      responseTopKeys: Object.keys(responseObj),
    });
    return;
  }

  const payload = { ...cost, ...extra };
  console.log("[UsageCost] reportApiUsageCost → reporter", payload);

  if (typeof usageCostReporter === "function") {
    try {
      usageCostReporter(payload);
    } catch (e) {
      console.error("[UsageCost] usageCostReporter threw", e);
    }
  } else {
    console.warn(
      "[UsageCost] reportApiUsageCost: no reporter registered (call setUsageCostReporter from App)"
    );
  }
}
