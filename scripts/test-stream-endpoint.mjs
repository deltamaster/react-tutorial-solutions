#!/usr/bin/env node
/**
 * Smoke test for Gemini streaming via Azure APIM.
 * Usage: APIM_SUBSCRIPTION_KEY=... node scripts/test-stream-endpoint.mjs
 */
const key = process.env.APIM_SUBSCRIPTION_KEY || process.argv[2];
if (!key) {
  console.error('Missing APIM subscription key. Set APIM_SUBSCRIPTION_KEY or pass as first argument.');
  process.exit(1);
}

const url =
  'https://jp-gw2.azure-api.net/gemini/models/gemini-3.8-flash:streamGenerateContent?alt=sse';
const body = {
  contents: [{ role: 'user', parts: [{ text: 'Say hello in exactly three words.' }] }],
};

const started = Date.now();
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': key,
  },
  body: JSON.stringify(body),
});

console.log('HTTP', response.status, response.statusText);
console.log('Content-Type:', response.headers.get('content-type'));

if (!response.ok) {
  console.log(await response.text());
  process.exit(1);
}

if (!response.body) {
  console.error('No response body for streaming');
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let eventCount = 0;
let assembledText = '';
let firstChunkMs = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  if (firstChunkMs === null) firstChunkMs = Date.now() - started;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload) continue;
    eventCount += 1;
    try {
      const chunk = JSON.parse(payload);
      const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text) assembledText += text;
      const finishReason = chunk?.candidates?.[0]?.finishReason;
      if (finishReason) {
        console.log('finishReason:', finishReason);
      }
    } catch (error) {
      console.warn('Non-JSON SSE payload:', payload.slice(0, 120));
    }
  }
}

console.log('events:', eventCount);
console.log('first chunk ms:', firstChunkMs);
console.log('total ms:', Date.now() - started);
console.log('assembled text:', JSON.stringify(assembledText));
