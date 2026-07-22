# Agent Harness Comparison — Building On Top For Multimodal + Sandbox Integrations

A head-to-head evaluation of four open-source agent harnesses as a **foundation to build a product on top of**, with emphasis on extensibility across five integration axes: **browser automation, image, video, computer use, and sandboxing**.

Evidence is drawn from **both** direct source-code inspection (shallow clones at HEAD) **and** each project's **official online documentation** (cited inline).

| Harness | Repo | Docs | Lang / Runtime | License | Backer |
|---|---|---|---|---|---|
| **Pi** | `badlogic/pi-mono` / `earendil-works/pi` | pi.dev/docs | TypeScript / Node ≥22 | MIT | Earendil Inc. (Mario Zechner) |
| **OpenCode** | `sst/opencode` → `anomalyco/opencode` | opencode.ai/docs | TypeScript / Bun | MIT | Anomaly (formerly SST) |
| **Deep Agents** | `langchain-ai/deepagents` | docs.langchain.com/oss/python/deepagents | Python ≥3.11 (LangGraph) | MIT | LangChain |
| **Codex CLI** | `openai/codex` | developers.openai.com/codex | Rust core + TS SDK | Apache-2.0 | OpenAI |

> Analyzed at HEAD as of 2026-07: pi-mono `9b3a205`, opencode `411eff7`, deepagents `465b9de`, codex `bd5b55e`. Versions per docs: Pi `0.81.1` (~75.5k★), OpenCode `1.18.x` (V2 in private beta), Deep Agents `0.6.12`, Codex bundled into ChatGPT (no standalone version).

---

## 1. What each one is (per the docs)

- **Pi** — A deliberately **minimal** harness: "Adapt Pi to your workflows, not the other way around" (pi.dev). Ships ~7 built-in tools and *intentionally omits* subagents, plan mode, **and MCP** — the author's stance is ["what if you don't need MCP at all?"](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/). You embed via `createAgentSession()`. Layered: `pi-ai` → `pi-agent-core` → `pi-coding-agent`. No hosted product.
- **OpenCode** — "The open source AI coding agent," usable as TUI, desktop app, or IDE extension, built on a **client/server** model (`opencode serve`, OpenAPI 3.1 spec at `/doc`). The SST org **rebranded to Anomaly** in 2026. A **V2** Effect-based core with an in-process embedded-host SDK (`@opencode-ai/sdk-next`) is in **private beta**. Sells a paid model gateway, "OpenCode Zen."
- **Deep Agents** — LangChain's "batteries-included agent harness" for long-running tasks, built on LangGraph. Single entry `create_deep_agent()` returns a LangGraph runnable (streaming, checkpointing, human-in-the-loop free). Docs are the most integration-rich of the four. A hosted **Managed Deep Agents** runtime on LangSmith is in private beta.
- **Codex CLI** — OpenAI's coding agent, spanning **CLI (Apache-2.0 OSS)**, **Codex cloud** (OpenAI-managed containers), a **desktop app**, and **IDE extensions**. ⚠️ Critically: many flashy capabilities (browser, computer use, image-gen) are **product features tied to OpenAI models / ChatGPT plans — not part of the OSS `codex-rs` repo you'd build on.**

---

## 2. Integration axes — the deciding table

Legend: ✅ built-in · 🟡 partial / ecosystem / documented add-on · ❌ absent (must hand-build). **This table scores the open-source harness you would build on** — see the Codex footnote for product-only capabilities.

| Axis | Pi | OpenCode | Deep Agents | Codex (OSS) |
|---|:--:|:--:|:--:|:--:|
| **Browser automation** | ❌ 3rd-party ext | ❌ 3rd-party MCP | 🟡 LangChain Playwright toolkit / MCP | ❌ ¹ |
| **Image input** | ✅ docs | ✅ code | ✅ docs (`read_file`) | ✅ code (`view_image`) |
| **Image generation** | ✅ (`images.ts`) | 🟡 provider passthrough | ❌ | 🟡 code (`ext/image-generation`) ¹ |
| **Video** | ❌ | ❌ | ✅ **docs**: `read_file` covers PDF/audio/**video** | ❌ |
| **Computer use / GUI** | ❌ | ❌ (open FR) | 🟡 via ecosystem (Anthropic CU) / MCP | ❌ in OSS ¹ |
| **Sandboxing / isolation** | 🟡 docs: Docker / µVM / OpenShell (no built-in) | ❌ bash on host (no sandbox docs) | ✅ **docs**: LangSmith, Daytona, E2B, Modal, Runloop, Vercel, AWS AgentCore, OpenShell, QuickJS | ✅ **best-in-class**: Seatbelt / bwrap+seccomp / Landlock / Windows ACL+WFP, 3 sandbox modes |
| **MCP client** | ❌ (deliberate; 3rd-party ext only) | ✅ docs (`local`/`remote`) | ✅ docs (servers pass into `tools=`) | ✅ docs (`[mcp_servers]`) |
| **MCP server (expose self)** | ❌ | ❌ | ❌ | ✅ docs (`codex mcp-server`) |

**¹ Codex product-only (NOT in the OSS repo):** OpenAI's docs describe a built-in **browser** + `browser-use`, **image generation via gpt-image-1.5**, and full **computer use** ("uses all the apps on your computer by seeing, clicking, and typing with its own cursor," macOS/Windows). These are proprietary features of the Codex desktop/cloud product bundled into ChatGPT plans — not reusable primitives in the Apache-2.0 `codex-rs` you would fork. Source: [developers.openai.com/codex/app/computer-use](https://developers.openai.com/codex/app/computer-use).

### Provider support
| | Pi | OpenCode | Deep Agents | Codex |
|---|:--:|:--:|:--:|:--:|
| Anthropic / Claude | ✅ (35+ providers, OAuth) | ✅ | ✅ | ❌ native (Responses-API only; needs proxy) |
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Local (Ollama/LM Studio/vLLM) | ✅ (OpenAI-compat) | ✅ (OpenAI-compat) | ✅ (via LangChain) | ✅ (native `ollama`/`lmstudio`, `[model_providers]`) |

---

## 3. How you build on / extend each (per docs)

- **Deep Agents** — `create_deep_agent(model, tools, middleware, subagents, backend, ...)`. Three clean seams: **middleware** (behavior), **backends** (`BackendProtocol`/`SandboxBackendProtocol` = filesystem + `execute()`), **subagents** (any LangGraph graph). Tools are plain callables **or MCP servers passed directly into `tools=`**. Rides LangChain's ~100+ integration catalog. Docs: [overview](https://docs.langchain.com/oss/python/deepagents/overview), [sandboxes](https://docs.langchain.com/oss/python/deepagents/sandboxes).
- **Pi** — `createAgentSession()` + `defineTool()`; RPC and JSON print modes for language-agnostic embedding. Extensions register tools/commands/providers and hook events (`docs/extensions.md`, `docs/custom-provider.md`, `docs/skills.md`). Rich but **no MCP** — every external integration is hand-wired.
- **OpenCode** — Control via the **HTTP server + OpenAPI SDK** (`@opencode-ai/sdk`) or, in V2 beta, the in-process **`sdk-next`** host. Plugins hook events + a `tool()` helper (Zod); custom agents via `opencode.json`/Markdown. MCP client is config-driven. Docs: [sdk](https://opencode.ai/docs/sdk/), [plugins](https://opencode.ai/docs/plugins/), [mcp-servers](https://opencode.ai/docs/mcp-servers/).
- **Codex** — Extend without touching Rust via **`config.toml`, Markdown skills, plugins (marketplace + `codex://` deep links), lifecycle hooks, and MCP**. New *native* tools require Rust. Programmatic control via the TS SDK (`@openai/codex-sdk`), Python SDK → app-server (JSON-RPC, sandbox presets `read_only`/`workspace_write`/`full_access`), `codex exec`, or `codex mcp-server`. Docs: [customization](https://developers.openai.com/codex/concepts/customization), [sdk](https://developers.openai.com/codex/sdk).

---

## 4. Hosted offerings & pricing (from docs)

| | Hosted product | Pricing model |
|---|---|---|
| **Pi** | None — local CLI/npm only | Free (OSS); pay your own model providers |
| **OpenCode** | "OpenCode Zen" model gateway; enterprise self-host/SSO | Pay-as-you-go per-1M tokens (e.g. Claude Opus 4.8 $5/$25); free if you bring your own gateway |
| **Deep Agents** | Managed Deep Agents on LangSmith (private beta, US) | LangGraph Platform: ~$0.005/run + uptime (LangSmith Plus) |
| **Codex** | Codex cloud (OpenAI-managed containers) + ChatGPT integration | Bundled in ChatGPT: Plus $20, Pro $100–200, Business $30/seat; "Fast mode" 1.5–2.5× credits |

---

## 5. Verdict

**Scores for "ease of building an extensible product with browser/image/video/computer-use/sandbox integrations":**

| Harness | Score | One-liner |
|---|:--:|---|
| **Deep Agents** | **7.5 / 10** | Broadest *documented* integration reach + cleanest pluggability; only harness with official video + a full sandbox-vendor catalog + MCP into `tools=`. |
| Codex CLI (OSS) | 6.5 / 10 | World-class sandbox + MCP both ways; but browser/computer-use/image-gen are *product-only*, plus Rust barrier and OpenAI-Responses lock-in. |
| Pi | 6 / 10 | Elegant SDK, native image + image-gen, huge provider breadth — but MCP/browser/video/computer-use are all deliberately or effectively absent. |
| OpenCode | 6 / 10 | Solid client/server + MCP client + plugins + a real hosted gateway, but core mid-rewrite and zero official isolation (bash on host). |

### Recommendation: build on **Deep Agents (LangChain)** — with a sandbox caveat

The online docs *strengthen* the earlier code-only conclusion. For a product needing **browser + image + video + computer use + sandbox**, Deep Agents wins on the two things that matter most here:

1. **Documented coverage breadth.** It is the **only** harness whose docs officially cover **multimodal ingestion of video** (plus PDF/audio/image via one `read_file`), ships a **first-party catalog of sandbox backends** (LangSmith, Daytona, E2B, Modal, Runloop, Vercel, AWS AgentCore, NVIDIA OpenShell, in-process QuickJS), takes **MCP servers directly into `tools=`**, and inherits **browser (Playwright toolkit / Bedrock AgentCore Browser) and computer-use (Anthropic Computer Use) tools from the LangChain ecosystem** — so all five axes are reachable *without building each from scratch*.
2. **Extensibility model.** The `middleware` / `backend` / `subagent` seams are the cleanest "swap any piece without forking" design of the four, Python keeps the barrier low, it's provider-agnostic (incl. Claude), and you inherit LangGraph streaming, checkpointing, and human-in-the-loop for free — with an optional hosted runtime (Managed Deep Agents) when you want to stop operating infra.

**The caveat — sandbox depth.** If **hardened, OS-native execution isolation is your single most important axis** (multi-tenant untrusted code, per-syscall confinement across Linux/macOS/Windows), **Codex's sandbox is the strongest by a wide margin** — Seatbelt profiles, bubblewrap+seccomp with Landlock fallback, Windows ACL/WFP, three sandbox modes, network allowlists, and an optional risk-scoring approvals reviewer, all documented. Deep Agents' sandboxing is real but delegates to *remote vendor* sandboxes rather than local kernel-level confinement.

**Pragmatic architecture:** use **Deep Agents as the orchestration harness** (agent loop, multimodal I/O incl. video, tool/middleware/subagent extensibility, any model incl. Claude). For execution isolation, either (a) point its `SandboxBackendProtocol` at Daytona/E2B/Modal/etc., or (b) if you need local kernel isolation, wrap **Codex's sandbox** (or Anthropic's `sandbox-runtime`, which Pi's docs also recommend) behind an MCP server. Bring **browser** and **computer-use** in as LangChain/MCP tools (Playwright/Browserbase servers, Anthropic/OpenAI computer-use wrappers).

**When to pick differently:**
- Deeply committed to the **OpenAI/ChatGPT ecosystem** and want *turnkey* computer-use + browser + best sandbox out of the box (and can accept it being product, not OSS) → **Codex**.
- **All-TypeScript**, minimal footprint, want the cleanest embeddable SDK, fine without MCP/video → **Pi**.
- Want a ready **client/server product** with desktop/web/IDE surfaces, native MCP client, and a hosted model gateway → **OpenCode**.

---

*Methodology: each repo was cloned and analyzed by an independent Sonnet subagent against a fixed rubric (architecture, extensibility, provider support, five integration axes, MCP, verdict), then a second Sonnet subagent per project researched the official online docs to verify/correct and add roadmap, hosted-offering, and pricing detail. Findings synthesized above with inline source links.*
