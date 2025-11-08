# 🚀 Cogent: Hybrid-Agent VS Code Copilot Companion

Cogent is a GitHub Copilot chat extension that turns your editor into an **agentic co-developer**. The project now ships with a hybrid architecture that blends MCP-style tools for predictable workspace operations with a sandboxed code-execution layer for heavier analysis and automation. This README explains how the pieces fit together and how to get started hacking on the extension.

![Cogent Demo](assets/cogent.gif)

## 🧭 Architecture Overview

```
LLM  ↔  Agent Orchestrator
           ↓
      Planner / Spec Interpreter
           ↓
   ┌────────┴─────────┐
   │                  │
MCP Tool Layer   Code-Execution Layer
   │                  │
Workspace APIs   Sandboxed Node/Shell tasks
```

- **Planner & Plans (`src/agent/planner.ts`, `src/agent/plans.ts`)** – the LLM produces structured plans that describe tool calls, code execution steps, and approval checkpoints.
- **Execution Manager (`src/agent/execution/execManager.ts`)** – walks the plan, routing steps to registered MCP tools or to sandboxed scripts.
- **MCP Registry (`src/mcp/registry.ts`)** – lightweight tool registration API with metadata like preferred execution mode.
- **Node Sandbox (`src/agent/execution/sandboxes/nodeSandbox.ts`)** – runs generated scripts with resource guardrails so complex analysis happens off-model.
- **Context & Memory (`src/agent/context.ts`, `src/agent/memory.ts`)** – collect workspace signals for prompts and persist decisions between runs.
- **UI & Telemetry (`src/ui/approvals.ts`, `src/ui/diffs.ts`, `src/telemetry/*`)** – provide approval hooks, diff previews, and audit trails to keep operators in control.

This layout makes it easy to add new MCP tools for standard actions while delegating bespoke logic to the execution layer without bloating LLM prompts.

## ✨ Key Capabilities

- 🤖 **Autonomous Planning** – the agent drafts multi-step plans, switching between tools and code execution as needed.
- 🛠️ **Tool Registry** – register workspace-aware tools (file I/O, git, tests) once and reuse them across plans.
- 🧪 **Sandboxed Code Exec** – run Node snippets for heavy lifting (dependency graphs, refactors, metrics) without crowding the context window.
- 🧠 **Project Context Summaries** – gather lightweight workspace metadata for better prompts without leaking entire files.
- 🔒 **Human-in-the-Loop Controls** – approval checkpoints and diff previews ensure every write operation is reviewed.
- 📝 **Telemetry & Audit Trail** – capture tool usage and script runs for debugging and observability.

## ⚙️ Developing the Extension

### Prerequisites

- VS Code 1.95.0 or newer
- GitHub Copilot Chat extension and an active Copilot subscription
- Node 18+

### Local Setup

```bash
git clone https://github.com/<you>/cogent.git
cd cogent
npm install
npm run compile
```

Launch the extension with `F5` (or `Run → Start Debugging`) inside VS Code. A new Extension Development Host window opens with Cogent loaded.

### Packaging for Distribution

```bash
npm install -g @vscode/vsce
vsce package
```

The command emits a `.vsix` bundle you can share or publish.

## 🧩 Extending Cogent

### Adding a Tool

1. Create a tool file under `src/mcp/tools/` that exports a `Tool` implementation.
2. Register it in `src/extension.ts` using `registerTool(...)`.
3. Optionally set `preferredMode` to hint when the planner should convert the call into a code-execution step.

### Enabling Code-Execution Workflows

- Use `execCode` steps in plans to offload longer pipelines to the sandbox (see `PlanStep` in `src/agent/plans.ts`).
- Update `chooseExecMode` in `src/agent/policies.ts` to auto-convert specific tools to code execution when they exceed token or hop thresholds.
- Sandbox runners live in `src/agent/execution/sandboxes/`; add shells or languages as needed while respecting resource limits.

### Memory and Context

- `buildContextSummary` collects project snapshots (changed files, git branch, signals) that are safe to inject into prompts.
- `MemoryStore` provides simple persistence for preferences or decisions under `.cogent/`.

## 🧑‍💻 Using Cogent in VS Code

1. Open Copilot Chat and address Cogent with `@Cogent`.
2. Describe your goal. The agent will draft a plan summarising intended tool invocations and scripts.
3. Review approvals for file edits or terminal commands. Cogent always waits for confirmation before risky actions.
4. Inspect telemetry logs under `.cogent/audit.log` when you need to trace behaviour.

## 🤝 Contributing

We welcome improvements! Please open issues or pull requests if you have suggestions for planner prompts, new tools, sandbox improvements, or UI workflows.

1. Fork the repo and create a feature branch.
2. Implement your changes with tests where possible.
3. Run `npm run compile` and any relevant checks.
4. Submit a PR describing your changes and any follow-up work.

## 📜 License

MIT License – see [LICENSE](LICENSE).

---

Made with ❤️ by developers building trustworthy agentic tooling.
