# 🚀 Cogent: Hybrid-Agent VS Code Copilot Companion

> "Because rubber duck debugging is better with a duck that talks back!"

![Cogent Demo](assets/cogent.gif)

## 🧭 Architecture Overview

<div align="center">

[![Visual Studio Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/kturung.cogent?color=blue&label=VsCode%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=kturung.cogent)

<strong>Plan ➜ Act ➜ Observe ➜ Revise</strong><br />
<em>All without leaving your editor.</em>
</div>

## 🎯 Prerequisites

Before we embark on this magical journey, make sure you have:

- 💳 Active GitHub Copilot subscription
- 📦 VS Code 1.95.0 or higher
- 🤖 GitHub Copilot Chat extension

## ✨ Features

- 🤖 **Autonomous Agent** – Works independently with minimal supervision
- 📝 **Smart File Operations** – Create, read, update and diff-apply for precise updates to also handle large files with AI precision
- 🎮 **Command Execution** – Run terminal commands without leaving your chat
- 🧠 **Context-Aware** – Understands your entire project structure
- 🤝 **Pair Programming** – Like pair programming, but your partner never needs coffee breaks
- 🔒 **Safe Operations** – Asks for your approval before making changes or running commands
- 📚 **Workspace Awareness** – Can load your entire workspace for better context (configurable)
- 📜 **Custom Rules** – Teach your AI companion your project's special needs

## 🚀 Installation

### For Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Press F5 in VS Code to start debugging
   > This will open a new VS Code window with the extension loaded

### Distribution

Want to package the extension for distribution? Easy peasy:

1. Install vsce globally:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Package the extension:
   ```bash
   vsce package
   ```
   This creates a `.vsix` file you can distribute!

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

### Agent Controls & Preferences

Cogent now ships with a configurable hybrid runtime. Key settings live under the `cogent` namespace:

- `cogent.useFullWorkspace` – expand the summary that the planner sees beyond the default conservative slice
- `cogent.autoApprove` – allowlist internal tools that are safe to run without prompting
- `cogent.exec.*` – tune sandbox timeouts, memory caps, and accessible Node.js modules
- `cogent.tools.allowShell` / `cogent.tools.netAllowed` – enable higher-risk tool classes when you are ready for them
- Legacy `cogent.use_full_workspace` remains for backward compatibility but is marked as deprecated

## 🎮 Usage

1. Open GitHub Copilot Chat in VS Code
2. Type `@Cogent` followed by your request or run **Cogent: Run Agent Plan** from the Command Palette
3. Watch your agentic buddy spring into action!
4. Cogent pauses for approvals before it writes files or executes commands. Review the diff or command preview, approve, and it will continue automatically.
5. Check `.cogent/audit.log` for a full history of plans, tool calls, and sandbox runs.

Cogent works autonomously but always asks for your approval when:
- Creating or modifying files in your workspace
- Running terminal commands (unless explicitly allowlisted)
- Making significant project changes

## 🧩 Extending Cogent

## 🧭 Architecture Overview

Cogent blends a lightweight MCP-style tool path with a sandboxed code-execution layer so the agent can choose the cheapest, safest route for each step.

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

### Core Modules

- **Planner & Plans (`src/agent/planner.ts`, `src/agent/plans.ts`)** – the LLM emits structured steps (`useTool`, `execCode`, `askApproval`, `summarize`) that are validated before execution.
- **Execution Manager (`src/agent/execution/execManager.ts`)** – walks the plan, streams events to the UI, routes steps to tools or sandboxed scripts, and captures outputs for downstream steps.
- **MCP Registry (`src/mcp/registry.ts`)** – tracks risk metadata, approval requirements, and preferred execution modes for each tool.
- **Node Sandbox (`src/agent/execution/sandboxes/nodeSandbox.ts`)** – runs generated scripts with module allowlists, timeouts, memory caps, and output truncation so heavy logic stays outside the prompt window.
- **Context & Memory (`src/agent/context.ts`, `src/agent/memory.ts`)** – gather concise workspace signals (changed files, git state, project hints) and persist lightweight project memory under `.cogent/`.
- **UI & Telemetry (`src/ui/approvals.ts`, `src/ui/diffs.ts`, `src/telemetry/*`)** – surface approval modals, diff previews, and audit trails to keep humans in the loop.

### Daily Flow

1. The user provides a goal (chat message or command invocation).
2. `runAgent` builds a compact `ContextSummary` and invokes the planner.
3. The validated plan executes step-by-step, pausing for approvals on risky operations.
4. Tool and sandbox outputs stream back to the chat panel so you always know what happened.

## 💬 Example Conversations

1. Create a tool file under `src/mcp/tools/` that exports a `Tool` implementation.
2. Register it in `src/extension.ts` using `registerTool(...)`.
3. Optionally set `preferredMode` to hint when the planner should convert the call into a code-execution step.

### Enabling Code-Execution Workflows

- Use `execCode` steps in plans to offload longer pipelines to the sandbox (see `PlanStep` in `src/agent/plans.ts`).
- Update `chooseExecMode` in `src/agent/policies.ts` to auto-convert specific tools to code execution when they exceed token or hop thresholds.
- Sandbox runners live in `src/agent/execution/sandboxes/`; add shells or languages as needed while respecting resource limits.

Cogent is powered by the GitHub Copilot and mighty Claude-3.5-Sonnet model. It's like having a tiny developer living in your VSCode. Don't worry, we feed them virtual cookies! 🍪

- `buildContextSummary` collects project snapshots (changed files, git branch, signals) that are safe to inject into prompts.
- `MemoryStore` provides simple persistence for preferences or decisions under `.cogent/`.

## 🧑‍💻 Using Cogent in VS Code

1. Open Copilot Chat and address Cogent with `@Cogent`.
2. Describe your goal. The agent will draft a plan summarising intended tool invocations and scripts.
3. Review approvals for file edits or terminal commands. Cogent always waits for confirmation before risky actions.
4. Inspect telemetry logs under `.cogent/audit.log` when you need to trace behaviour.

### Enabling Code-Execution Workflows

We welcome improvements! Please open issues or pull requests if you have suggestions for planner prompts, new tools, sandbox improvements, or UI workflows.

1. Fork the repo and create a feature branch.
2. Implement your changes with tests where possible.
3. Run `npm run compile` and any relevant checks.
4. Submit a PR describing your changes and any follow-up work.

## 📜 License

MIT License – see [LICENSE](LICENSE).

---

Made with ❤️ and lots of ☕ by awesome developers like you!

*Remember: The best code is the one that works... but the second-best is not writing any code at all!* 😉
