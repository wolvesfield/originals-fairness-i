/**
 * Cloudflare Worker — CORS Proxy for Stake/Roobet API
 *
 * DEPLOY INSTRUCTIONS:
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 * 2. Paste this entire file as the worker script
 * 3. Deploy — you get a URL like https://my-cors-proxy.YOUR_SUBDOMAIN.workers.dev
 * 4. In the app, go to "API Connections" → Proxy tab
 * 5. Set "Custom CORS Proxy" to: https://my-cors-proxy.YOUR_SUBDOMAIN.workers.dev/?url=
 * 6. Done — 100k free requests/day, no 403 errors
 *
 * This worker forwards requests to any target URL, adding proper CORS headers.
 * It supports POST (for GraphQL) and GET requests.
 * It injects browser-like headers for Stake.com to bypass Cloudflare fingerprinting.
 */

const ALLOWED_ORIGINS = [
  'https://arcanadraconi.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

// Browser-mimicking headers for Stake.com (from HAR capture of real Chrome session)
const STAKE_BROWSER_HEADERS = {
  'Origin': 'https://stake.com',
  'Referer': 'https://stake.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'Accept': 'application/graphql+json, application/json',
};

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-access-token, x-language, x-operation-name, Authorization, Accept, Origin, Referer',
    'Access-Control-Max-Age': '86400',
  };
}

function isStakeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'stake.com' || parsed.hostname.endsWith('.stake.com');
  } catch {
    return false;
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing ?url= parameter', usage: 'GET/POST /?url=https://target.com/api' }),
        { status: 400, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Build forwarded headers — pass through content-type, auth tokens, etc.
    const forwardHeaders = new Headers();

    // If targeting Stake, inject browser-like headers FIRST
    const targetIsStake = isStakeUrl(targetUrl);
    if (targetIsStake) {
      for (const [key, value] of Object.entries(STAKE_BROWSER_HEADERS)) {
        forwardHeaders.set(key, value);
      }
    }

    // Then overlay request headers (so auth tokens like x-access-token come through)
    for (const [key, value] of request.headers.entries()) {
      const lower = key.toLowerCase();
      // Skip hop-by-hop, host, and CF-specific headers
      if (['host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor',
           'cf-ipcountry', 'x-forwarded-for', 'x-real-ip',
           'connection', 'keep-alive', 'cdn-loop'].includes(lower)) continue;
      // For Stake: don't let the real origin/referer leak through
      if (targetIsStake && ['origin', 'referer', 'sec-fetch-site'].includes(lower)) continue;
      forwardHeaders.set(key, value);
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      // Clone response with CORS headers
      const responseHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(corsHeaders(origin))) {
        responseHeaders.set(key, value);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy fetch failed', detail: err.message }),
        { status: 502, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }
  }
};
