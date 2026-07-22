# Agent Harness Comparison — Building On Top For Multimodal + Sandbox Integrations

A head-to-head evaluation of four open-source agent harnesses as a **foundation to build a product on top of**, with emphasis on extensibility across five integration axes: **browser automation, image, video, computer use, and sandboxing**.

| Harness | Repo | Lang / Runtime | License |
|---|---|---|---|
| **Pi** | `badlogic/pi-mono` (`@earendil-works/pi-*`) | TypeScript / Node ≥22 | MIT |
| **OpenCode** | `sst/opencode` | TypeScript / Bun | MIT |
| **Deep Agents** | `langchain-ai/deepagents` | Python ≥3.11 (LangGraph) | MIT |
| **Codex CLI** | `openai/codex` | Rust core + TS SDK | Apache-2.0 |

> Analyzed at HEAD as of 2026-07: pi-mono `9b3a205`, opencode `411eff7`, deepagents `465b9de`, codex `bd5b55e`. Clones were shallow (`--depth 1`).

---

## 1. What each one is

- **Pi** — A clean, layered coding-agent harness: `pi-ai` (multi-provider LLM client) → `pi-agent-core` (agent loop + session state) → `pi-coding-agent` (CLI/TUI + tools + extensions). Minimalist by design; you embed via `createAgentSession()`. Pre-1.0 (`0.81.1`), MIT.
- **OpenCode** — A client/server coding agent with a terminal UI, desktop app, and web app. Strict split: `protocol` → `core`/`server` → SDKs. Ships an embeddable in-process host (`sdk-next`). Actively maintained (`1.18.x`) but its session core is mid V1→V2 rewrite.
- **Deep Agents** — A "batteries-included" harness wrapping LangChain's `create_agent` on top of LangGraph. Single entry point `create_deep_agent()` returns a standard LangGraph runnable (streaming, checkpointing, human-in-the-loop for free). Beta (`0.6.x`), backed by LangChain.
- **Codex CLI** — OpenAI's native coding agent. A large Rust workspace (~170 crates) compiled to a binary, controlled via an app-server (JSON-RPC), an exec mode, or a thin process-spawning TypeScript SDK. Enterprise-grade engineering, Apache-2.0.

---

## 2. Integration axes — the deciding table

Legend: ✅ built-in · 🟡 partial / ecosystem / documented add-on · ❌ absent (must hand-build)

| Axis | Pi | OpenCode | Deep Agents | Codex |
|---|:--:|:--:|:--:|:--:|
| **Browser automation** | ❌ | ❌ | 🟡 LangChain tools / MCP | ❌ (web *search* only) |
| **Image input** | ✅ | ✅ (`read.ts`) | ✅ (`read_file`) | ✅ (`view_image`) |
| **Image generation** | ✅ (`images.ts`) | 🟡 provider passthrough | ❌ | ✅ (`ext/image-generation`) |
| **Video** | ❌ | ❌ | ✅ (`_video.py`, frame sampling) | ❌ |
| **Computer use / GUI** | ❌ | ❌ | 🟡 via ecosystem/MCP | 🟡 permission flag only, no driver |
| **Sandboxing / isolation** | 🟡 documented (Docker/µVM/OpenShell) | ❌ (bash runs on host) | ✅ partner backends (Daytona/Modal/Runloop/Vercel/quickjs) | ✅ **best-in-class** OS-native (Landlock+seccomp, Seatbelt, bwrap, Windows WFP/ACL) |
| **MCP client** | ❌ | ✅ | 🟡 (in `code` app, adapters for SDK) | ✅ (`rmcp-client`, OAuth) |
| **MCP server (expose self)** | ❌ | ❌ | ❌ | 🟡 prototype (`mcp-server`) |

### Provider support (secondary but important)
| | Pi | OpenCode | Deep Agents | Codex |
|---|:--:|:--:|:--:|:--:|
| Anthropic / Claude | ✅ (35+ providers, OAuth) | ✅ | ✅ | ❌ (Responses-API only; needs proxy) |
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Local (Ollama/LM Studio/vLLM) | ✅ (OpenAI-compat) | ✅ (OpenAI-compat) | ✅ (via LangChain) | ✅ (native `ollama`/`lmstudio`) |

---

## 3. Extensibility (add capability *without forking*)

- **Deep Agents** — Highest. Three clean protocol seams: `middleware` (behavior), `BackendProtocol`/`SandboxBackendProtocol` (filesystem + execute), and `SubAgent` (any LangGraph graph is a subagent). Tools are plain Python callables passed via `tools=`. Rides LangChain's ~100+ integration catalog.
- **Pi** — Rich TypeScript extension API (`pi.registerTool` / `registerCommand` / `registerProvider`, lifecycle hooks) with 60+ shipped examples, plus skills and prompt templates. Adding a tool is low-friction — but no MCP means every external integration is hand-wired.
- **OpenCode** — Strong plugin hooks (`tool`, `provider`, `permission.ask`, `tool.execute.before/after`, etc.), `tool()` helper with Zod args, config-driven custom agents, and a `WorkspaceAdapter` seam for remote/containerized workspaces. Native MCP client widens reach. Effect-TS/Bun idioms raise the contributor learning curve.
- **Codex** — Extensible via **config/TOML, Markdown skills, npm/remote plugins, hooks, and MCP** without touching Rust. But writing a genuinely new *native tool* requires Rust and navigating a codebase whose own docs warn `codex-core` is bloated.

---

## 4. Verdict

**Scores for "ease of building an extensible product with browser/image/video/computer-use/sandbox integrations":**

| Harness | Score | One-liner |
|---|:--:|---|
| **Deep Agents** | **7 / 10** | Broadest integration reach + cleanest pluggability; only harness with native video and ready-made sandbox partners. |
| Codex CLI | 6 / 10 | Best sandbox on the planet + real MCP both ways, but Rust barrier and OpenAI-Responses lock-in. |
| Pi | 6 / 10 | Elegant SDK, native image + image-gen, great provider breadth — but no MCP, no browser/video/computer-use, experimental server. |
| OpenCode | 6 / 10 | Solid client/server + MCP client + plugins, but core mid-rewrite and no real isolation (bash on host). |

### Recommendation: build on **Deep Agents (LangChain)** — with a caveat

For a product that needs **browser + image + video + computer use + sandbox**, Deep Agents wins on the two things that matter most for *this* requirement set:

1. **Coverage breadth.** It's the only harness with **built-in video** ingestion and **built-in image** ingestion, ships **first-party sandbox backends** (Daytona, Modal, Runloop, Vercel, in-process quickjs), and inherits **browser + computer-use tools from the LangChain ecosystem + MCP adapters** — so all five axes are reachable without you building each from scratch.
2. **Extensibility model.** The `middleware` / `backend` / `subagent` seams are the cleanest "swap any piece without forking" design of the four, and Python keeps the barrier low. You also get LangGraph streaming, checkpointing, and human-in-the-loop interrupts for free.

**The caveat — sandbox depth.** If **hardened, OS-native execution isolation is your single most important axis** (multi-tenant untrusted code, per-syscall confinement on Linux/macOS/Windows), **Codex has the strongest sandbox by a wide margin** (Landlock+seccomp, Seatbelt `.sbpl`, bubblewrap, Windows WFP/ACL). Deep Agents' sandboxing is real but delegates to *remote* sandbox vendors rather than local kernel-level confinement.

**Pragmatic architecture:** use **Deep Agents as the orchestration harness** (agent loop, multimodal I/O, tool/middleware/subagent extensibility, provider-agnostic incl. Claude), and for the execution layer either (a) point its `SandboxBackendProtocol` at a partner vendor, or (b) if you need local kernel isolation, wrap **Codex's sandbox** (or Anthropic's `sandbox-runtime`, which Pi also uses) as the backend behind an MCP server. Browser and computer-use come in as LangChain/MCP tools (e.g. Playwright/Browserbase servers, computer-use tool wrappers).

**When to pick differently:**
- All-TypeScript shop, minimal footprint, want the cleanest embeddable SDK, and can live without MCP/video → **Pi**.
- Want a ready client/server product with desktop/web UIs and native MCP already wired → **OpenCode**.
- Sandbox isolation is the whole point and you're comfortable with Rust/MCP boundaries → **Codex**.

---

*Methodology: each repo was cloned and analyzed by an independent Sonnet subagent against a fixed rubric (overview, architecture, extensibility, provider support, five integration axes, MCP, verdict), citing file paths. Findings synthesized above.*
