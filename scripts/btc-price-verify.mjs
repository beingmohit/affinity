#!/usr/bin/env node
// btc-price-verify.mjs
//
// Fetch the current Bitcoin (BTC/USD) spot price from three independent
// sources in parallel, then cross-verify them: compute a consensus price
// (the median), measure how far apart the sources are, and flag any source
// that disagrees with the consensus by more than a tolerance.
//
// This is the deterministic "verify" engine behind the /btc-price workflow.
// It has no dependencies and runs on Node 18+ (uses the global `fetch`).
//
// Usage:
//   node scripts/btc-price-verify.mjs                 # fetch live, human report
//   node scripts/btc-price-verify.mjs --json          # fetch live, JSON only
//   node scripts/btc-price-verify.mjs --tolerance 1.5 # outlier threshold in %
//   node scripts/btc-price-verify.mjs --self-test     # offline, uses mock data
//
// Exit codes:
//   0  consensus reached (>= 2 sources agree within tolerance)
//   1  no consensus (sources disagree too much, or < 2 sources responded)
//   2  bad arguments

const DEFAULT_TOLERANCE_PCT = 1.0; // a source is an outlier if it deviates
                                   // from the median by more than this %.
const TIMEOUT_MS = 8000;

// --- Source adapters -------------------------------------------------------
// Each adapter knows one API: its URL and how to dig the USD spot price out
// of that API's particular response shape. Adding a fourth source is just
// another entry here.
const SOURCES = [
  {
    name: "CoinGecko",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true",
    parse: (j) => ({
      price: Number(j.bitcoin.usd),
      ts: j.bitcoin.last_updated_at
        ? new Date(j.bitcoin.last_updated_at * 1000).toISOString()
        : new Date().toISOString(),
    }),
  },
  {
    name: "Coinbase",
    url: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
    parse: (j) => ({
      price: Number(j.data.amount),
      ts: new Date().toISOString(),
    }),
  },
  {
    name: "Kraken",
    url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
    parse: (j) => {
      if (j.error && j.error.length) throw new Error(j.error.join("; "));
      // Kraken keys the result by an internal pair code (e.g. XXBTZUSD).
      const key = Object.keys(j.result)[0];
      return { price: Number(j.result[key].c[0]), ts: new Date().toISOString() };
    },
  },
];

// --- Fetching --------------------------------------------------------------
async function fetchSource(src) {
  try {
    const res = await fetch(src.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": "btc-price-verify/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const { price, ts } = src.parse(json);
    if (!Number.isFinite(price) || price <= 0) throw new Error("no valid price in response");
    return { source: src.name, ok: true, price_usd: price, timestamp_utc: ts };
  } catch (err) {
    return { source: src.name, ok: false, error: String(err.message || err) };
  }
}

// --- Verification ----------------------------------------------------------
function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function verify(results, tolerancePct) {
  const ok = results.filter((r) => r.ok);
  const prices = ok.map((r) => r.price_usd);

  if (prices.length === 0) {
    return { consensus: false, reason: "no sources responded", report: null };
  }

  const consensusPrice = median(prices);
  const annotated = ok.map((r) => {
    const deviationPct = ((r.price_usd - consensusPrice) / consensusPrice) * 100;
    return {
      ...r,
      deviation_pct: Number(deviationPct.toFixed(4)),
      outlier: Math.abs(deviationPct) > tolerancePct,
    };
  });

  const agreeing = annotated.filter((r) => !r.outlier);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const spreadPct = ((hi - lo) / consensusPrice) * 100;

  return {
    consensus: agreeing.length >= 2,
    consensus_price_usd: Number(consensusPrice.toFixed(2)),
    tolerance_pct: tolerancePct,
    sources_ok: ok.length,
    sources_total: results.length,
    spread_pct: Number(spreadPct.toFixed(4)),
    agreeing: agreeing.map((r) => r.source),
    outliers: annotated.filter((r) => r.outlier).map((r) => r.source),
    sources: annotated,
    failed: results.filter((r) => !r.ok),
  };
}

// --- Mock data for offline self-test --------------------------------------
function mockResults() {
  const now = new Date().toISOString();
  return [
    { source: "CoinGecko", ok: true, price_usd: 67012.34, timestamp_utc: now },
    { source: "Coinbase", ok: true, price_usd: 67050.0, timestamp_utc: now },
    { source: "Kraken", ok: true, price_usd: 69500.1, timestamp_utc: now }, // deliberate outlier
  ];
}

// --- CLI -------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { json: false, selfTest: false, tolerance: DEFAULT_TOLERANCE_PCT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--self-test") opts.selfTest = true;
    else if (a === "--tolerance") {
      opts.tolerance = Number(argv[++i]);
      if (!Number.isFinite(opts.tolerance) || opts.tolerance <= 0) {
        console.error("--tolerance must be a positive number (percent)");
        process.exit(2);
      }
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

function printHuman(v) {
  if (!v.report && v.consensus === false && !v.sources) {
    console.log(`No consensus: ${v.reason}`);
    return;
  }
  console.log("Bitcoin price verification (BTC/USD)");
  console.log("====================================");
  for (const s of v.sources) {
    const tag = s.outlier ? "  OUTLIER" : "  ok";
    console.log(
      `  ${s.source.padEnd(10)} $${s.price_usd.toLocaleString("en-US")}  ` +
        `(${s.deviation_pct >= 0 ? "+" : ""}${s.deviation_pct}% vs consensus)${tag}`
    );
  }
  for (const f of v.failed) console.log(`  ${f.source.padEnd(10)} FAILED: ${f.error}`);
  console.log("------------------------------------");
  console.log(`  Consensus price : $${v.consensus_price_usd.toLocaleString("en-US")} (median)`);
  console.log(`  Sources agreeing: ${v.agreeing.join(", ") || "none"}`);
  console.log(`  Spread          : ${v.spread_pct}%  (tolerance ${v.tolerance_pct}%)`);
  console.log(`  Verdict         : ${v.consensus ? "VERIFIED ✓" : "NOT VERIFIED ✗"}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const results = opts.selfTest
    ? mockResults()
    : await Promise.all(SOURCES.map(fetchSource));
  const v = verify(results, opts.tolerance);

  if (opts.json) console.log(JSON.stringify(v, null, 2));
  else printHuman(v);

  process.exit(v.consensus ? 0 : 1);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
