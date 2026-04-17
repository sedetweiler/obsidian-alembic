# Alembic

AI writing workflows for Obsidian, with prompts you actually own. Workflows live in your vault as Markdown files: edit them, share them, run them on any note.

---

## Quick start

1. Install the plugin (see [[#Installation]])
2. Open **Settings → Alembic → Providers** and configure at least one AI backend
3. Open any note, optionally select some text, and run **Alembic: Run workflow** from the command palette
4. Pick a workflow and see the result in your note

---

## Installation

Alembic is a desktop-only plugin (it shells out to CLI tools and makes direct HTTP calls to local AI servers).  No API keys needed for things like Claude, Gemini, etc. if you have the CLI tools installed (e.g. Claude Code).

**Manual install:**
1. Download `main.js`, `styles.css`, and `manifest.json` from the latest release
2. Copy them into `.obsidian/plugins/obsidian-alembic/` inside your vault
3. Enable the plugin in Settings → Community plugins

**Via BRAT:**
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add the Alembic repository URL
3. Enable the plugin

---

## Providers

Go to **Settings → Alembic → Providers** to add and configure backends. You can have as many as you like; each workflow can target a different one.

### Claude CLI (default, no API key needed)

Requires the [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) to be installed and authenticated. Runs `claude --print` under the hood. No API key required in the plugin; authentication is handled by the CLI itself.

```
npm install -g @anthropic-ai/claude-code
claude   # follow the login prompts
```

### Anthropic API

Enter your API key from [console.anthropic.com](https://console.anthropic.com). Hit **Test Connection** to fetch the live model list and pick one.

### Gemini API

Enter your API key from [aistudio.google.com](https://aistudio.google.com). Hit **Test Connection** to see available models.

### Gemini CLI

Requires the [Gemini CLI](https://github.com/google-gemini/gemini-cli) to be installed and authenticated.

### Ollama

Point the Base URL at your Ollama instance (default: `http://localhost:11434`). Hit **Test Connection** and your installed models will appear as chips below the model field. Click one to select it.

### OpenAI

Enter your API key from [platform.openai.com](https://platform.openai.com). The base URL defaults to `https://api.openai.com/v1` but can be changed for compatible local servers.

### OpenRouter

Enter your API key from [openrouter.ai](https://openrouter.ai). One key covers dozens of models from Anthropic, Google, Meta, Mistral, and others.

---

## Running workflows

### Command palette

Run **Alembic: Run workflow** to open the picker. The freeform entry is always pinned at the top; your saved workflows follow. Fuzzy search works across all names.

### Direct commands

Every workflow is also registered as its own command: **Alembic: [Workflow Name]**. Assign a hotkey to any workflow in Settings → Hotkeys for one-keystroke access.

### Freeform (Ask Claude)

Selecting **Ask Claude** from the picker opens a text box where you type a one-off instruction. The current note is always included as context. Use the **Humanize output** toggle to run the result through the Humanize workflow automatically.  Your prompt here needs to assume it can see the contents, otherwise it will get confused.  For example, asking it to check the current file will cause it to ask you about a file path.  It's just weird that way.

---

## Built-in workflows

| Workflow | What it does |
|---|---|
| **Ask Claude** | One-off prompt with full note context. Opens a text input at run time. |
| **Lint** | Fixes spelling, grammar, punctuation, broken Markdown, and empty carriage returns. No rewrites. |
| **Fix My Writing** | Corrects errors while preserving your voice, vocabulary, and tone. |
| **Tighten This Up** | Cuts 20-40% of words without losing meaning. Targets throat-clearing, redundancy, and weak intensifiers. |
| **Summarize** | Extracts the "so what", non-obvious insights, tensions, and what's missing. |
| **Extract Action Items** | Pulls every task, commitment, and deadline into a Markdown checklist. |
| **Add Structure** | Inserts headings and groups related content. Does not change any wording. |
| **Expand This** | Develops a seed idea into a full piece with examples, stakes, and an open ending. |
| **Continue Writing** | Continues your draft by matching your sentence rhythm, vocabulary, and tone exactly. |
| **Devil's Advocate** | Challenges assumptions, finds counterevidence, and names the strongest opposing case. |
| **Extract Key Terms** | Pulls domain-specific terms, proper nouns, and acronyms with context-specific definitions. |
| **Convert to Table** | Converts structured text or lists into a Markdown table. |
| **Humanize** | Strips AI writing patterns: removes cliches, overused vocabulary, em dashes, sycophantic openers, and soulless structure. Used automatically by workflows with "Humanize output" enabled. |

---

## Workflow files

Every workflow is stored as a plain Markdown file inside your **workflows folder** (default: `_alembic`). You can see and change the folder path at the top of the Workflows settings tab.

The built-in workflows (the ones Alembic installs on first run) come from a `workflows/` folder in the plugin repo. They are bundled into the plugin at build time and written to your vault verbatim. You can read them, copy them, and edit them just like any other workflow file.

A workflow file looks like this:

```markdown
---
name: "✂️ Tighten This Up"
id: "default-tighten"
prompt: "{=SELECTION=}"
replaceSelection: true
humanize: true
providerId: "default-claude-cli"
---

You are a ruthless copy editor. Your goal is maximum signal per word...
```

**Frontmatter fields:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name shown in the picker and command palette |
| `id` | string | Unique identifier. Must not change after creation. |
| `prompt` | string | The user message sent to the AI. Use tokens (see below). |
| `replaceSelection` | boolean | `true` replaces selected text; `false` inserts at cursor |
| `humanize` | boolean | Runs a second Humanize pass on the output if `true` |
| `providerId` | string | ID of the provider profile to use |

**The file body** is the system prompt. Leave it blank for a basic assistant with no special instructions.

---

## Token placeholders

Use these placeholders in the `prompt` field to inject live note content at run time:

| Token | Replaced with |
|---|---|
| `{=SELECTION=}` | The text currently selected in the editor |
| `{=CONTEXT=}` | The full content of the current note |

If you leave `prompt` blank, Alembic sends whatever is available: selected text first, then the full note.

---

## Creating a workflow

**From settings:** click **+** in the Workflows sidebar. A new file called `New Workflow.md` is created in your workflows folder. Edit the frontmatter and body, hit Save, and the workflow is immediately available.

**Directly in the vault:** create any `.md` file in your workflows folder with valid frontmatter (the `id` field is required and must be unique). Alembic picks it up automatically, no restart needed.

---

## Sharing workflows

Because workflows are just Markdown files, sharing is the same as sharing any note:

- Drop a `.md` file into someone else's `_alembic` folder and it shows up immediately
- Share them as Obsidian attachments, GitHub Gists, or Discord pastes
- Version-control your whole `_alembic` folder in git
- Submit a pull request to add it to the plugin defaults (see [[#Contributing workflows]])

The only thing that won't transfer is the `providerId`. The recipient will need to update that field to match one of their own provider profiles, or it falls back to the first available provider automatically.

---

## Contributing workflows

The built-in workflows ship from a `workflows/` folder at the root of the plugin repo. Each file is plain Markdown with YAML frontmatter. The build step reads them and bundles the content into the plugin.

To add a new workflow to the defaults:

1. Fork the repository
2. Create a file in `workflows/` named after the workflow, e.g. `My Workflow.md`
3. Add the frontmatter and write your system prompt as the file body
4. Open a pull request

The PR diff shows the prompt text directly. Reviewers can read it, suggest edits, and approve it the same way they would any other change. No compiled output to audit.

**What makes a PR worth merging:**

- **One job.** The best workflows have a clear input, a clear output, and no ambiguity about when to run them. If you can't describe it in one sentence, split it.
- **A stable `name`.** Use something specific like `contrib-workflow-name`. The `name` must not change after a workflow ships, so get it right before the PR merges.
- **`providerId: "default-claude-cli"`** for portability. Users can override it in their own copy. The default should work for anyone without extra setup.
- **No preambles in the output.** Write the system prompt so the AI's only job is producing the deliverable. "Here is the result" and similar openers are bugs, not features.

Not sure if something belongs in the defaults? Post it as a Gist or in [Discord](https://discord.com/invite/Y68Z7EJe9R) first. If people want it, then PR it.

---

## Tips

- **Hotkeys are the fastest way to work.** Assign your most-used workflows in Settings → Hotkeys. Selecting text and hitting a key to fix it, tighten it, or expand it is faster than reaching for a menu.

- **Lint before Humanize.** Run Lint first to fix mechanical errors, then Humanize to clean up the writing style. Both can be chained: enable "Humanize output" on any workflow to get both passes in one step.

- **The Humanize workflow is for output only.** It runs as a second pass on AI-generated text. Running it directly on your own writing may over-edit your voice.

- **Changing the workflows folder** renames the vault folder and moves all your files automatically. The new path takes effect immediately.

- **Reload the plugin** to pick up new direct commands after adding workflow files. The workflow picker and settings panel update in real time, but the command palette requires a plugin reload.
