# 🚀 Cogent: Your Agentic AI-Powered Coding Companion

> "Because rubber duck debugging is better with a duck that talks back!"

![Cogent Demo](assets/cogent.gif)

Cogent is an agentic GitHub Copilot VS Code chat extension that transforms your coding environment into an autonomous development powerhouse. Think of it as having a brilliant (and slightly nerdy) AI agent who understands your code *and* can take actions while keeping you in control. It's your witty companion that makes coding feel like pair programming with a super-smart friend who never needs coffee breaks!

<div align="center">
  <strong>Plan ➜ Act ➜ Observe ➜ Revise</strong><br />
  <em>All without leaving your editor.</em>
</div>

---

## 🧭 Architecture Overview

Cogent now ships with a hybrid runtime that blends a lightweight MCP-style tool registry with a sandboxed code-execution layer. The planner chooses whichever path keeps token usage low while still letting the agent perform complex analysis.

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

- **Planner & Plans (`src/agent/planner.ts`, `src/agent/plans.ts`)** – the LLM emits structured steps (`useTool`, `execCode`, `askApproval`, `summarize`) that are validated before execution.
- **Execution Manager (`src/agent/execution/execManager.ts`)** – walks the plan, routes steps to tools or sandboxed scripts, records telemetry, and collects results for later steps.
- **MCP Registry (`src/mcp/registry.ts`)** – a thin registry that tracks risk metadata, approval policies, and preferred execution modes for each tool.
- **Node Sandbox (`src/agent/execution/sandboxes/nodeSandbox.ts`)** – runs generated scripts with module allowlists, timeouts, memory caps, and output truncation so heavy logic stays outside the prompt.
- **Context & Memory (`src/agent/context.ts`, `src/agent/memory.ts`)** – gather concise workspace signals (changed files, git state, project hints) and persist lightweight project memory under `.cogent/`.
- **UI & Telemetry (`src/ui/approvals.ts`, `src/ui/diffs.ts`, `src/telemetry/*`)** – surface approval modals, diff previews, and audit trails to keep humans in control.

This layout keeps routine operations fast through MCP tools while reserving code execution for complex, multi-file reasoning without bloating the context window.

## ✨ What Cogent Can Do

- 🤖 **Autonomous Planning** – draft multi-step plans that mix tools and sandboxed scripts.
- 🛠️ **Tool Registry** – register workspace-aware tools (file I/O, git, tests) once and reuse them across plans or direct chat interactions.
- 🧪 **Sandboxed Code Exec** – run Node snippets for dependency graphs, refactors, or metrics while keeping prompts lean.
- 🧠 **Project Context Summaries** – capture filenames, hashes, git status, and key project signals without dumping entire files into prompts.
- 🔒 **Human-in-the-Loop Controls** – enforce approvals for risky steps and show diffs before writes land on disk.
- 📝 **Telemetry & Audit Trail** – log every plan, tool call, and script run for later review.

## ⚙️ Development Setup

### Prerequisites

- VS Code 1.95.0 or newer
- GitHub Copilot Chat extension + an active Copilot subscription
- Node.js 18+

### Install & Build

```bash
git clone https://github.com/<you>/cogent.git
cd cogent
npm install
npm run compile
```

Launch the extension with `F5` (or **Run → Start Debugging**) inside VS Code. A new Extension Development Host window will open with Cogent loaded.

### Packaging for Distribution

```bash
npm install -g @vscode/vsce
vsce package
```

This emits a `.vsix` bundle you can share or publish.

## 🧑‍💻 Using Cogent in VS Code

1. Open Copilot Chat and address Cogent with `@Cogent` as usual.
2. Or trigger the **Cogent: Run Agent Plan** command (Command Palette) to provide a free-form goal.
3. Cogent builds a plan, streams each step to the "Cogent Agent" output channel, and pauses for approvals before running risky actions.
4. Review diffs or command previews in the approval modal, approve or reject, and watch execution continue.
5. Inspect `.cogent/audit.log` if you need a historical trace of what happened.

## 🧩 Extending Cogent

### Adding a Tool

1. Create a tool implementation under `src/mcp/tools/` exporting the `Tool` interface.
2. Register it inside `src/extension.ts` with `registerTool(...)`.
3. Supply `risk`, `preferredMode`, and optional `getApprovalPreview` metadata so the planner and approval flow behave correctly.

### Customising Planner Policies

- Modify `chooseExecMode` (`src/agent/policies.ts`) to auto-switch certain tools to sandboxed execution when steps would be too costly in tokens.
- Update the planner prompt in `src/agent/planner.ts` with new guardrails or constraints.
- Introduce new `PlanStep` variants in `src/agent/plans.ts` when you need richer orchestration (remember to extend the validator and execution manager).

### Enhancing Context & Memory

- Tune `ContextSummaryOptions` passed from `runAgent` to control how many files or hashes are collected.
- Store project preferences or decisions in `MemoryStore` so Cogent adapts across sessions.

## ⚙️ Configuration Options

All settings live under the `cogent` namespace (see `package.json`). Highlights:

- `cogent.useFullWorkspace` – widen the default context summary limits.
- `cogent.autoApprove` – allowlist tool names that may bypass approval prompts.
- `cogent.exec.*` – adjust sandbox timeouts, memory caps, and allowed Node modules.
- `cogent.tools.allowShell` / `cogent.tools.netAllowed` – enable execution or network-risky operations.

Legacy `cogent.use_full_workspace` remains for backward compatibility but is marked as deprecated.

## 🤝 Contributing

We love contributions! To get started:

1. Fork the repo and create a feature branch.
2. Implement your changes with tests or demos where possible.
3. Run `npm run compile` (and `npm run lint` if you have ESLint configured).
4. Open a PR summarising the change and any follow-up ideas.

## 📜 License

MIT License – see [LICENSE](LICENSE).

---

Made with ❤️ by developers building trustworthy agentic tooling.
