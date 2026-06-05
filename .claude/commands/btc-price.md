---
description: Fetch and cross-verify the Bitcoin price from 3 independent sources
allowed-tools: Bash, Agent, WebFetch
---

# /btc-price — fetch & verify Bitcoin price across 3 sources

This command runs the same **fan-out → cross-verify → synthesize** pattern that
Claude Code's bundled `/deep-research` workflow uses, applied to a single,
well-defined question: *what is the current BTC/USD price, and do independent
sources agree?*

## Fast path (deterministic engine)

If the environment can reach the price APIs, just run the bundled engine — it
does the parallel fetch and the consensus math itself:

```
node scripts/btc-price-verify.mjs --json
```

It pulls from CoinGecko, Coinbase, and Kraken in parallel, takes the **median**
as the consensus price, flags any source deviating more than the tolerance
(default 1%), and exits non-zero if fewer than two sources agree.

## Workflow path (orchestrated subagents)

When you want the agentic version — for example the price hosts are blocked but
search/other tools are available, or you want narrative cross-checking — fan the
work out to three independent agents, one per source, then verify:

1. **Fan out (parallel).** Spawn three subagents in a single message so they run
   concurrently. Each is pinned to exactly one source and must return only a
   compact JSON object `{source, price_usd, timestamp_utc, ok}`:
   - Agent A → CoinGecko: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`
   - Agent B → Coinbase:  `https://api.coinbase.com/v2/prices/BTC-USD/spot`
   - Agent C → Kraken:    `https://api.kraken.com/0/public/Ticker?pair=XBTUSD`

2. **Cross-verify.** Collect the three results. Compute the median as the
   consensus price. Mark any source more than 1% from the median as an outlier.
   Declare the price VERIFIED only if at least two sources agree within
   tolerance.

3. **Synthesize.** Report the consensus price, each source's value and its
   deviation, the spread, which sources agreed, and the final verdict. Name any
   source that failed or was an outlier — never silently drop it.

## Notes

- Three sources is the minimum for a real cross-check: with two you can detect a
  disagreement but not which one is wrong; the median of three breaks the tie.
- Add a fourth source by adding one entry to the `SOURCES` array in
  `scripts/btc-price-verify.mjs` — the verification math needs no changes.
- `node scripts/btc-price-verify.mjs --self-test` runs the whole pipeline
  offline against mock data (one deliberate outlier) to prove the logic.
