"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AlembicPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/types.ts
var TOKEN_SELECTION = "{=SELECTION=}";
var TOKEN_CONTEXT = "{=CONTEXT=}";
function isFullNoteWorkflow(workflow) {
  return workflow.replaceSelection && workflow.prompt.includes(TOKEN_CONTEXT) && !workflow.prompt.includes(TOKEN_SELECTION);
}
var CLAUDE_CLI_PROVIDER_ID = "default-claude-cli";
var DEFAULT_PROVIDERS = [
  {
    id: CLAUDE_CLI_PROVIDER_ID,
    name: "Claude CLI",
    type: "claude-cli"
  }
];
var DEFAULT_WORKFLOWS_FOLDER = "_alembic";
var FREEFORM_WORKFLOW_ID = "__freeform__";
var HUMANIZE_WORKFLOW_ID = "__humanize__";
var WORKFLOWS_REPO_API_URL = "https://api.github.com/repos/sedetweiler/obsidian-alembic/contents/workflows";
var DEFAULT_SETTINGS = {
  providers: DEFAULT_PROVIDERS,
  workflowsFolder: DEFAULT_WORKFLOWS_FOLDER
};

// src/modal.ts
var import_obsidian = require("obsidian");
function getHotkeyStr(app, commandId) {
  var _a2, _b, _c;
  const manager = app.hotkeyManager;
  if (!manager)
    return "";
  const hotkeys = (_b = (_a2 = manager.getHotkeys(commandId)) != null ? _a2 : manager.getDefaultHotkeys(commandId)) != null ? _b : [];
  if (!hotkeys.length)
    return "";
  const hk = hotkeys[0];
  const isMac = import_obsidian.Platform.isMacOS;
  const mods = ((_c = hk.modifiers) != null ? _c : []).map((m) => {
    switch (m) {
      case "Mod":
        return isMac ? "\u2318" : "Ctrl+";
      case "Shift":
        return isMac ? "\u21E7" : "Shift+";
      case "Alt":
        return isMac ? "\u2325" : "Alt+";
      default:
        return m;
    }
  }).join("");
  return mods + hk.key.toUpperCase();
}
var WorkflowSelectorModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, workflows, onSelect) {
    super(app);
    this.workflows = workflows;
    this.onSelect = onSelect;
    this.setPlaceholder("Run a workflow\u2026");
  }
  getItems() {
    return [
      ...this.workflows.filter((w) => w.id === FREEFORM_WORKFLOW_ID),
      ...this.workflows.filter((w) => w.id !== FREEFORM_WORKFLOW_ID)
    ];
  }
  getItemText(item) {
    return item.name;
  }
  renderSuggestion(match, el) {
    el.addClass("alembic-suggestion");
    if (match.item.id === FREEFORM_WORKFLOW_ID)
      el.addClass("alembic-suggestion-freeform");
    const nameEl = el.createSpan({ cls: "alembic-suggestion-name" });
    (0, import_obsidian.renderMatches)(nameEl, match.item.name, match.match.matches);
    const cmdId = `obsidian-alembic:run-workflow-${match.item.id.replace(/[^a-z0-9]/gi, "-")}`;
    const hotkey = getHotkeyStr(this.app, cmdId);
    if (hotkey) {
      el.createSpan({ text: hotkey, cls: "alembic-suggestion-hotkey" });
    }
  }
  onChooseItem(item) {
    if (item.id === FREEFORM_WORKFLOW_ID) {
      new FreeformModal(this.app, item, (prompt, humanize) => {
        this.onSelect({ ...item, prompt: `${TOKEN_CONTEXT}

---

${prompt}`, humanize });
      }).open();
    } else {
      this.onSelect(item);
    }
  }
};
var FreeformModal = class extends import_obsidian.Modal {
  constructor(app, workflow, onSubmit) {
    super(app);
    this.workflow = workflow;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("alembic-modal", "alembic-freeform-modal");
    contentEl.createEl("p", { text: this.workflow.name.replace(/^[\p{Emoji}\s]+/u, "").trim() || this.workflow.name, cls: "alembic-freeform-title" });
    const textarea = contentEl.createEl("textarea", { cls: "alembic-freeform-input" });
    textarea.placeholder = "Reformat this page so that\u2026";
    textarea.rows = 4;
    const humanizeLabel = contentEl.createEl("label", { cls: "alembic-toggle-row alembic-freeform-humanize" });
    const humanizeCheckbox = humanizeLabel.createEl("input", { type: "checkbox" });
    humanizeCheckbox.checked = this.workflow.humanize;
    humanizeCheckbox.classList.add("alembic-checkbox");
    humanizeLabel.createSpan({ text: "Humanize output" });
    textarea.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" && (evt.ctrlKey || evt.metaKey)) {
        evt.preventDefault();
        this.submit(textarea.value, humanizeCheckbox.checked);
      }
    });
    const runBtn = contentEl.createEl("button", { text: "Run", cls: "alembic-run-btn" });
    runBtn.addEventListener("click", () => this.submit(textarea.value, humanizeCheckbox.checked));
    window.setTimeout(() => textarea.focus(), 50);
  }
  onClose() {
    this.contentEl.empty();
  }
  submit(value, humanize) {
    const prompt = value.trim();
    if (!prompt)
      return;
    this.close();
    this.onSubmit(prompt, humanize);
  }
};
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, message) {
    super(app);
    this.decided = false;
    this.message = message;
  }
  ask() {
    const promise = new Promise((res) => {
      this.resolve = res;
    });
    this.open();
    return promise;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("alembic-modal", "alembic-confirm-modal");
    for (const line of this.message.split("\n")) {
      contentEl.createEl("p", { text: line, cls: "alembic-confirm-line" });
    }
    const row = contentEl.createDiv("alembic-confirm-buttons");
    const cancelBtn = row.createEl("button", { text: "Cancel", cls: "alembic-confirm-cancel" });
    cancelBtn.addEventListener("click", () => this.decide(false));
    const okBtn = row.createEl("button", { text: "OK", cls: "alembic-confirm-ok" });
    okBtn.addEventListener("click", () => this.decide(true));
    window.setTimeout(() => okBtn.focus(), 50);
  }
  onClose() {
    this.contentEl.empty();
    this.decide(false);
  }
  decide(value) {
    if (this.decided)
      return;
    this.decided = true;
    this.resolve(value);
    this.close();
  }
};
function confirmModal(app, message) {
  return new ConfirmModal(app, message).ask();
}

// src/settings.ts
var import_obsidian4 = require("obsidian");

// src/notice.ts
var import_obsidian2 = require("obsidian");
var WAIT_MESSAGES = [
  "Distilling\u2026",
  "Heating the flask\u2026",
  "Separating signal from noise\u2026",
  "The reaction is underway\u2026",
  "Condensing\u2026",
  "Transmuting\u2026",
  "Still in the retort\u2026"
];
function attachHeader(el, title) {
  const hdr = el.createDiv("alembic-notice-header");
  hdr.createSpan({ text: "\u2697\uFE0F", cls: "alembic-notice-icon" });
  hdr.createSpan({ text: title, cls: "alembic-notice-title" });
}
function alembicFlash(message, timeout = 4e3, variant = "default") {
  const notice = new import_obsidian2.Notice("", timeout);
  const el = notice.messageEl;
  el.addClass("alembic-notice");
  if (variant !== "default")
    el.addClass(`alembic-notice--${variant}`);
  attachHeader(el, "Alembic");
  el.createDiv({ text: message, cls: "alembic-notice-body" });
}
function alembicRunNotice(workflowName) {
  const notice = new import_obsidian2.Notice("", 0);
  const el = notice.messageEl;
  el.addClass("alembic-notice");
  const displayName = workflowName.replace(/^\p{Emoji}\uFE0F?\s*/u, "");
  attachHeader(el, displayName);
  const statusEl = el.createDiv({ text: WAIT_MESSAGES[0], cls: "alembic-notice-status" });
  return {
    setStatus(msg) {
      statusEl.setText(msg);
    },
    addCancelButton(onClick) {
      const btn = el.createEl("button", { text: "Cancel", cls: "alembic-cancel-btn" });
      btn.addEventListener("click", onClick);
    },
    hide() {
      notice.hide();
    }
  };
}

// src/providers.ts
var PROVIDER_META = [
  {
    type: "anthropic",
    label: "Anthropic API",
    isCli: false,
    needsApiKey: true,
    modelHint: "e.g. claude-opus-4-5, claude-sonnet-4-5",
    knownModels: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"]
  },
  {
    type: "claude-cli",
    label: "Claude CLI",
    isCli: true,
    needsApiKey: false,
    modelHint: "",
    knownModels: []
  },
  {
    type: "codex-cli",
    label: "Codex CLI",
    isCli: true,
    needsApiKey: false,
    modelHint: "",
    knownModels: []
  },
  {
    type: "gemini",
    label: "Gemini API",
    isCli: false,
    needsApiKey: true,
    modelHint: "e.g. gemini-2.0-flash, gemini-1.5-pro",
    knownModels: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"]
  },
  {
    type: "gemini-cli",
    label: "Gemini CLI",
    isCli: true,
    needsApiKey: false,
    modelHint: "",
    knownModels: []
  },
  {
    type: "ollama",
    label: "Ollama",
    isCli: false,
    needsApiKey: false,
    defaultBaseUrl: "http://localhost:11434",
    modelHint: "e.g. llama3.2, llama3.3:70b",
    knownModels: []
  },
  {
    type: "openai",
    label: "OpenAI API",
    isCli: false,
    needsApiKey: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    modelHint: "e.g. gpt-4o, gpt-4o-mini, o3",
    knownModels: ["gpt-4o", "gpt-4o-mini", "o3", "o3-mini", "o1"]
  },
  {
    type: "openrouter",
    label: "OpenRouter",
    isCli: false,
    needsApiKey: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modelHint: "e.g. anthropic/claude-sonnet-4-5, openai/gpt-4o",
    knownModels: [
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "google/gemini-2.0-flash",
      "meta-llama/llama-3.3-70b-instruct"
    ]
  }
];
var PROVIDER_META_MAP = Object.fromEntries(PROVIDER_META.map((m) => [m.type, m]));

// src/runner.ts
var import_child_process = require("child_process");
var http = __toESM(require("http"));
var https = __toESM(require("https"));
var _a;
var AUGMENTED_PATH = [
  "/opt/homebrew/bin",
  // Homebrew (Apple Silicon)
  "/usr/local/bin",
  // Homebrew (Intel) / manual installs
  (_a = process.env.PATH) != null ? _a : ""
].filter(Boolean).join(":");
function substituteTokens(template, selection, context) {
  return template.split(TOKEN_SELECTION).join(selection).split(TOKEN_CONTEXT).join(context);
}
function assembleUserMessage(workflow, selection, context) {
  if (workflow.prompt.trim() !== "") {
    return substituteTokens(workflow.prompt, selection, context);
  }
  const parts = [];
  if (selection.trim())
    parts.push(selection);
  if (context.trim())
    parts.push(context);
  return parts.join("\n\n");
}
function classifyError(combined, rawMessage, code) {
  if (combined.includes("rate limit") || combined.includes("rate_limit") || combined.includes("too many requests") || combined.includes("429") || combined.includes("usage limit") || combined.includes("exceeded") && combined.includes("limit") || combined.includes("quota"))
    return "Rate limit reached \u2014 please wait a few minutes and try again.";
  if (combined.includes("unauthorized") || combined.includes("401") || combined.includes("api key") || combined.includes("not authenticated") || combined.includes("not logged in"))
    return "Authentication failed \u2014 check your API key or credentials.";
  if (combined.includes("overloaded") || combined.includes("503"))
    return "Service is overloaded right now \u2014 please try again shortly.";
  return rawMessage || `Exited with code ${code != null ? code : "unknown"}`;
}
var HTTP_TIMEOUT_MS = 12e4;
function nodeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    var _a2, _b;
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: (_a2 = options.method) != null ? _a2 : "GET",
        headers: { "content-type": "application/json", ...options.headers },
        timeout: (_b = options.timeoutMs) != null ? _b : HTTP_TIMEOUT_MS
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          var _a3;
          return resolve({ status: (_a3 = res.statusCode) != null ? _a3 : 0, body: data });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out \u2014 the provider did not respond within 2 minutes."));
    });
    req.on("error", reject);
    if (options.body)
      req.write(options.body);
    req.end();
  });
}
function httpRunHandle(run) {
  let cancelled = false;
  let externalResolve;
  const promise = new Promise((resolve) => {
    externalResolve = resolve;
    run().then((result) => {
      if (!cancelled)
        resolve(result);
    }).catch((err) => {
      if (!cancelled)
        resolve({ output: "", error: err.message });
    });
  });
  return {
    promise,
    cancel: () => {
      if (cancelled)
        return;
      cancelled = true;
      externalResolve({ output: "", cancelled: true });
    }
  };
}
var CLI_TIMEOUT_MS = 3e5;
function cliRunHandle(cmd, args, input, notFoundMessage, transformOutput) {
  let settled = false;
  let proc = null;
  let externalResolve;
  const promise = new Promise((resolve) => {
    var _a2;
    externalResolve = resolve;
    const settle = (r) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(r);
      }
    };
    try {
      proc = (0, import_child_process.spawn)(cmd, args, { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PATH: AUGMENTED_PATH } });
    } catch (err) {
      const e = err;
      settle({ output: "", error: e.code === "ENOENT" ? notFoundMessage : (_a2 = e.message) != null ? _a2 : String(err) });
      return;
    }
    const timer = window.setTimeout(() => {
      proc == null ? void 0 : proc.kill();
      settle({ output: "", error: `${cmd} did not respond within 5 minutes \u2014 the process was stopped.` });
    }, CLI_TIMEOUT_MS);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdin.write(input, "utf8");
    proc.stdin.on("error", () => {
    });
    proc.stdin.end();
    proc.on("error", (err) => {
      settle({ output: "", error: err.code === "ENOENT" ? notFoundMessage : err.message });
    });
    proc.on("close", (code) => {
      if (code === 0) {
        settle({ output: transformOutput ? transformOutput(stdout) : stdout.trim() });
      } else {
        const combined = (stderr + " " + stdout).toLowerCase();
        settle({ output: "", error: classifyError(combined, stderr.trim(), code) });
      }
    });
  });
  return {
    promise,
    cancel: () => {
      if (settled)
        return;
      settled = true;
      proc == null ? void 0 : proc.kill();
      externalResolve({ output: "", cancelled: true });
    }
  };
}
async function postAndParse(url, headers, body) {
  const res = await nodeRequest(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (res.status !== 200) {
    return { error: classifyError(res.body.toLowerCase(), res.body, res.status) };
  }
  return { parsed: JSON.parse(res.body) };
}
function runCliClaude(systemPrompt, userMessage) {
  const args = ["--print", "--output-format", "text"];
  if (systemPrompt.trim())
    args.push("--system-prompt", systemPrompt.trim());
  return cliRunHandle("claude", args, userMessage, "Claude CLI not found.");
}
function runGeminiCli(systemPrompt, userMessage) {
  const fullMessage = systemPrompt.trim() ? `${systemPrompt.trim()}

${userMessage}` : userMessage;
  return cliRunHandle("gemini", [], fullMessage, "Gemini CLI not found.");
}
function extractCodexMessage(stdout) {
  var _a2;
  let last = "";
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed)
      continue;
    try {
      const evt = JSON.parse(trimmed);
      if (evt.type === "item.completed" && ((_a2 = evt.item) == null ? void 0 : _a2.type) === "agent_message" && typeof evt.item.text === "string") {
        last = evt.item.text;
      }
    } catch (e) {
    }
  }
  return last.trim() || stdout.trim();
}
function runCodexCli(systemPrompt, userMessage) {
  const fullMessage = systemPrompt.trim() ? `${systemPrompt.trim()}

${userMessage}` : userMessage;
  const args = ["exec", "--skip-git-repo-check", "--json", "-"];
  return cliRunHandle("codex", args, fullMessage, "Codex CLI not found.", extractCodexMessage);
}
function runAnthropic(profile, systemPrompt, userMessage) {
  return httpRunHandle(async () => {
    var _a2, _b;
    const body = {
      model: (_a2 = profile.model) != null ? _a2 : "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: userMessage }]
    };
    if (systemPrompt.trim())
      body.system = systemPrompt.trim();
    const result = await postAndParse(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": (_b = profile.apiKey) != null ? _b : "", "anthropic-version": "2023-06-01" },
      body
    );
    if ("error" in result)
      return { output: "", error: result.error };
    return { output: result.parsed.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim() };
  });
}
function runGemini(profile, systemPrompt, userMessage) {
  return httpRunHandle(async () => {
    var _a2, _b, _c, _d, _e, _f;
    const model = (_a2 = profile.model) != null ? _a2 : "gemini-2.0-flash";
    const key = (_b = profile.apiKey) != null ? _b : "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const body = {
      contents: [{ role: "user", parts: [{ text: userMessage }] }]
    };
    if (systemPrompt.trim())
      body.system_instruction = { parts: [{ text: systemPrompt.trim() }] };
    const result = await postAndParse(
      url,
      {},
      body
    );
    if ("error" in result)
      return { output: "", error: result.error };
    return { output: (_f = (_e = (_d = (_c = result.parsed.candidates[0]) == null ? void 0 : _c.content) == null ? void 0 : _d.parts) == null ? void 0 : _e.map((p) => p.text).join("").trim()) != null ? _f : "" };
  });
}
function buildChatMessages(systemPrompt, userMessage) {
  const messages = [];
  if (systemPrompt.trim())
    messages.push({ role: "system", content: systemPrompt.trim() });
  messages.push({ role: "user", content: userMessage });
  return messages;
}
function runOllama(profile, systemPrompt, userMessage) {
  return httpRunHandle(async () => {
    var _a2, _b, _c, _d, _e, _f;
    const base = ((_a2 = profile.baseUrl) != null ? _a2 : "http://localhost:11434").replace(/\/$/, "");
    const body = {
      model: (_b = profile.model) != null ? _b : "llama3.2",
      messages: buildChatMessages(systemPrompt, userMessage),
      stream: false
    };
    const result = await postAndParse(
      `${base}/v1/chat/completions`,
      {},
      body
    );
    if ("error" in result)
      return { output: "", error: result.error };
    return { output: (_f = (_e = (_d = (_c = result.parsed.choices[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) == null ? void 0 : _e.trim()) != null ? _f : "" };
  });
}
function openAIBaseUrl(profile) {
  var _a2;
  const fallback = profile.type === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
  return ((_a2 = profile.baseUrl) != null ? _a2 : fallback).replace(/\/$/, "");
}
function runOpenAICompatible(profile, systemPrompt, userMessage) {
  return httpRunHandle(async () => {
    var _a2, _b, _c, _d, _e, _f;
    const headers = { "Authorization": `Bearer ${(_a2 = profile.apiKey) != null ? _a2 : ""}` };
    if (profile.type === "openrouter") {
      headers["HTTP-Referer"] = "obsidian://alembic";
      headers["X-Title"] = "Alembic";
    }
    const body = {
      model: (_b = profile.model) != null ? _b : "gpt-4o",
      messages: buildChatMessages(systemPrompt, userMessage),
      stream: false
    };
    const result = await postAndParse(
      `${openAIBaseUrl(profile)}/chat/completions`,
      headers,
      body
    );
    if ("error" in result)
      return { output: "", error: result.error };
    return { output: (_f = (_e = (_d = (_c = result.parsed.choices[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) == null ? void 0 : _e.trim()) != null ? _f : "" };
  });
}
function runWithProvider(profile, workflow, userMessage) {
  const sys = workflow.systemPrompt;
  switch (profile.type) {
    case "anthropic":
      return runAnthropic(profile, sys, userMessage);
    case "ollama":
      return runOllama(profile, sys, userMessage);
    case "gemini":
      return runGemini(profile, sys, userMessage);
    case "gemini-cli":
      return runGeminiCli(sys, userMessage);
    case "codex-cli":
      return runCodexCli(sys, userMessage);
    case "openai":
    case "openrouter":
      return runOpenAICompatible(profile, sys, userMessage);
    case "claude-cli":
    default:
      return runCliClaude(sys, userMessage);
  }
}
function cliOnPath(cmd) {
  return new Promise((resolve) => {
    const proc = (0, import_child_process.spawn)(cmd, ["--version"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PATH: AUGMENTED_PATH } });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}
async function fetchProviderModels(profile) {
  var _a2, _b, _c, _d, _e;
  try {
    switch (profile.type) {
      case "claude-cli": {
        return await cliOnPath("claude") ? { models: [] } : { models: [], error: "Claude CLI not found. Make sure it is installed and on your PATH." };
      }
      case "gemini-cli": {
        return await cliOnPath("gemini") ? { models: [] } : { models: [], error: "Gemini CLI not found \u2014 install it from https://github.com/google-gemini/gemini-cli" };
      }
      case "codex-cli": {
        return await cliOnPath("codex") ? { models: [] } : { models: [], error: "Codex CLI not found \u2014 install it from https://github.com/openai/codex" };
      }
      case "anthropic": {
        const res = await nodeRequest("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": (_a2 = profile.apiKey) != null ? _a2 : "", "anthropic-version": "2023-06-01" }
        });
        if (res.status !== 200)
          return { models: [], error: `API error ${res.status}` };
        const json = JSON.parse(res.body);
        return { models: json.data.map((m) => m.id) };
      }
      case "ollama": {
        const base = ((_b = profile.baseUrl) != null ? _b : "http://localhost:11434").replace(/\/$/, "");
        const res = await nodeRequest(`${base}/api/tags`);
        if (res.status !== 200)
          return { models: [], error: `Could not reach Ollama at ${base} (HTTP ${res.status})` };
        const json = JSON.parse(res.body);
        return { models: json.models.map((m) => m.name) };
      }
      case "gemini": {
        const res = await nodeRequest(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${(_c = profile.apiKey) != null ? _c : ""}`
        );
        if (res.status !== 200)
          return { models: [], error: `API error ${res.status}` };
        const json = JSON.parse(res.body);
        return { models: json.models.map((m) => m.name.replace(/^models\//, "")) };
      }
      case "openai":
      case "openrouter": {
        const res = await nodeRequest(`${openAIBaseUrl(profile)}/models`, {
          headers: { "Authorization": `Bearer ${(_d = profile.apiKey) != null ? _d : ""}` }
        });
        if (res.status !== 200)
          return { models: [], error: `API error ${res.status}` };
        const json = JSON.parse(res.body);
        return { models: json.data.map((m) => m.id).sort() };
      }
      default:
        return { models: [] };
    }
  } catch (err) {
    return { models: [], error: (_e = err.message) != null ? _e : String(err) };
  }
}

// src/workflow-loader.ts
var import_obsidian3 = require("obsidian");

// alembic-workflows:alembic:default-workflows
var alembic_default_workflows_default = {
  "Add Structure.md": '---\nname: "\u{1F3D7}\uFE0F Add Structure"\nid: "default-add-structure"\nprompt: "{=CONTEXT=}"\nreplaceSelection: true\nhumanize: false\nproviderId: "default-claude-cli"\n---\nYou are a technical editor who organizes raw notes into a clean, navigable document.\n\nYour job:\n1. Read the full text and identify the natural topics and logical flow\n2. Insert markdown headings (## for major sections, ### for subsections) that accurately label what follows\n3. Group related content that has drifted apart. Move sentences or paragraphs to their correct section if needed.\n4. Add a blank line before and after each heading for readability\n\nDo not:\n- Change any wording within the content itself\n- Add, remove, or invent content\n- Create a heading for every paragraph; headings should cover meaningful sections, not every thought\n- Add a title heading unless the document clearly needs one\n\nIf the text is already well-structured, say so with a single line: "No structural changes needed." and return the original unchanged.\n\nOutput only the restructured document.\n',
  "Ask Claude.md": `---
name: "\u270F\uFE0F Ask Claude\u2026"
id: "__freeform__"
prompt: ""
replaceSelection: false
humanize: false
providerId: "default-claude-cli"
---

You are an AI assistant embedded in Obsidian. The user's message contains two parts: the full text of their current note (above the separator line), then their instruction (below it).

Follow the instruction. Use the note content as your working material.

- If the instruction asks you to rewrite, edit, or transform the note: output the result only, no commentary.
- If the instruction asks a question about the note: answer it directly, no preamble.
- If the instruction asks you to add or generate something: output only the new content.

The note content is already in this message. Never ask the user to paste, share, or describe it.
`,
  "Brainstorm.md": `---
name: "\u{1F9E0} Brainstorm"
id: "default-brainstorm"
prompt: "{=SELECTION=}"
replaceSelection: false
humanize: false
providerId: "default-claude-cli"
---

You are a creative thinking partner. Your job is to generate a diverse spread of ideas, angles, and approaches \u2014 not to evaluate or filter them.

Here is the full note for context:
{=CONTEXT=}

Given the selected text as a seed topic or question:

1. Generate 8-12 distinct ideas, angles, or approaches. Push for variety \u2014 obvious ideas first, then increasingly unexpected or lateral ones.
2. For each idea, write one sentence on what it is and one sentence on why it's interesting or what it unlocks.
3. Group related ideas loosely, but don't force a taxonomy.
4. End with 2-3 "what if" questions that reframe the topic entirely \u2014 the kind that make someone stop and think.

Rules:
- Quantity over quality. Bad ideas often spark good ones.
- No preamble. Start with the first idea.
- No evaluation ("This might not work, but..."). Just state the idea.
- If the seed is vague, interpret it broadly rather than asking for clarification.

Format as a markdown list with bold idea titles.
`,
  "Contextual Prompt.md": `---
name: "\u27A1\uFE0F Context With Prompt"
id: "continue-prompted"
prompt: "Consider the following text\\n{=CONTEXT=}\\n---\\nNow follow this prompt while considering that context:\\n{=SELECTION=}"
replaceSelection: false
humanize: false
providerId: "default-claude-cli"
---

You are an AI assistant working with the user's note as your primary reference material. The user has highlighted an instruction inside their note \u2014 your job is to follow that instruction using the rest of the note as context.

How to respond:
- Treat the full note as your working material. Do not ask the user to provide, paste, or describe it.
- Follow the highlighted instruction precisely. If it asks for a rewrite, output only the rewrite. If it asks a question, answer it directly. If it asks you to generate something, output only the new content.
- Match the tone, vocabulary, and formality level of the existing note.
- Be concise. Do not add preamble, commentary, or meta-explanation unless the instruction asks for it.

If the instruction is ambiguous, make a reasonable interpretation and commit to it rather than hedging or listing alternatives.
`,
  "Continue Writing.md": `---
name: "\u27A1\uFE0F Continue Writing"
id: "default-continue"
prompt: "Consider the following text{=CONTEXT=}---Now continue writing."
replaceSelection: false
humanize: true
providerId: "default-claude-cli"
---

You are a ghostwriter continuing someone else's work. Your continuation must be seamless; the reader should not be able to find the join.

Before writing, silently analyse the existing text for:
- Sentence length and rhythm patterns
- Vocabulary level (formal/casual, simple/technical)
- How ideas are introduced and developed
- Punctuation habits and paragraph length
- Point of view and tense
- Whether the author uses first person, what their relationship to the reader is

Then continue, matching all of those patterns exactly. Do not:
- Introduce a change in tone or register
- Start with a transitional phrase that signals a new writer ("Furthermore...", "In addition...")
- Repeat or summarise what was just said
- Wrap up or conclude unless the text is clearly at a natural ending

Write as much as the existing text suggests is appropriate. If it's a quick note, write a paragraph; if it's an essay, write several.

Output only the continuation. No overlap with the existing text.
`,
  "Convert to Table.md": `---
name: "\u{1F4CA} Convert to Table"
id: "default-to-table"
prompt: "{=SELECTION=}"
replaceSelection: true
humanize: false
providerId: "default-claude-cli"
---

You are a data organiser converting unstructured content into a clean markdown table.

Process:
1. Identify the entities being described (each becomes a row)
2. Identify the attributes that apply consistently across entities (each becomes a column)
3. Place the most identifying attribute (name, ID, title) in the first column
4. Infer missing values as blank cells; never guess or fabricate data
5. If a cell would contain a very long string, truncate to the key phrase

Table rules:
- Use proper markdown table syntax with a header row and separator row
- Column names should be short, title case, no special characters
- Align numeric columns right, text columns left (use markdown alignment syntax)
- If the data doesn't map cleanly to a table (narrative prose, a single entity), say so in one sentence and return the original unchanged

Output only the markdown table, or the single-sentence explanation if a table isn't appropriate.
`,
  "Copywriting.md": `---
name: "\u{1F4DD} Copywriting"
id: "default-copywriting"
prompt: "{=CONTEXT=}"
replaceSelection: false
humanize: true
providerId: "default-claude-cli"
---

You are an expert conversion copywriter. Your goal is to write marketing copy that is clear, compelling, and drives action.

## Core Principles

1.  **Clarity Over Cleverness:** If you have to choose, choose clear.
2.  **Benefits Over Features:** Don't say "It has a 4000mAh battery." Say "It lasts all day on a single charge."
3.  **Specific Over Vague:** Don't say "Save time." Say "Cut reporting time from 4 hours to 15 minutes."
4.  **Customer Language:** Use the words *they* use, not corporate jargon.

## Instructions

When the user provides their product or service details:

1.  **Analyze the context:**
    *   **Goal:** What is the ONE action we want them to take?
    *   **Audience:** Who is this for? What is their pain?
    *   **Medium:** Is this a landing page, email, or ad?

2.  **Draft the copy:**
    *   **Headline:** Write 3 options using different formulas (e.g., "How to [Benefit] without [Pain]", "The [Adjective] way to [Outcome]").
    *   **Subheadline:** Clarify the offer in 1-2 sentences.
    *   **Body:** Focus on specific pain points and how this solution removes them.
    *   **CTA:** Write a strong, action-oriented button (e.g., "Start Free Trial" not "Submit").

3.  **Review:**
    *   Remove passive voice ("Reports are generated" -> "Generate reports").
    *   Remove weak words ("very," "actually," "cutting-edge").
    *   Check for "You" vs "We" ratio (focus on the customer).
`,
  "Devils Advocate.md": `---
name: "\u{1F608} Devil's Advocate"
id: "default-devils-advocate"
prompt: "{=SELECTION=}"
replaceSelection: false
humanize: false
providerId: "default-claude-cli"
---

You are a sharp, adversarial critic. Your job is to find what is wrong, weak, or missing. Not to be fair, but to stress-test the thinking.

Here is the full note for context:
{=CONTEXT=}

Focus your critique on the text the user has selected. If no selection is provided, critique the entire note.

Work through these lenses:
1. Assumptions: What does this take for granted that might not be true? What would break the argument if those assumptions are wrong?
2. Counterevidence: What facts, cases, or examples contradict the claims being made?
3. Missing stakes: Who is harmed, excluded, or disadvantaged by this position that the author hasn't considered?
4. Internal contradictions: Does the text argue against itself anywhere?
5. Strongest opposing case: What is the best version of the argument against this position?

Be specific: name the exact claim you're challenging, not vague gestures at "complexity." Be direct: say "this is wrong because..." not "one might argue...". Do not offer reassurance or balance your criticism with praise.

Format as numbered points, each starting with the claim being challenged in bold.
`,
  "Expand This.md": `---
name: "\u{1F52D} Expand This"
id: "default-expand"
prompt: "{=SELECTION=}"
replaceSelection: false
humanize: true
providerId: "default-claude-cli"
---

You are a writer developing an idea from a seed into a full, substantive piece.

Here is the full note for context reference:
{=CONTEXT=}

How to expand well:
- Start by restating the core idea more precisely (often the original phrasing is vague)
- Add the "why it matters" layer: what's the consequence, the implication, the stake?
- Ground it with at least one concrete example, analogy, or scenario
- Anticipate and address the obvious objection or question a reader would have
- End with something that opens up rather than closes down: a question, a tension, a next implication

What to avoid:
- Padding: longer sentences that add no new information
- Hedging: "it could be argued that", "some might say"; commit to a point of view
- Generic observations that would be true of almost any topic
- Academic throat-clearing at the start ("This is an important concept because...")

Match the register of the original: if it's casual notes, expand casually. If it's formal, stay formal.

Output only the expanded text.
`,
  "Extract Action Items.md": '---\nname: "\u2611\uFE0F Extract Action Items"\nid: "default-action-items"\nprompt: "{=CONTEXT=}"\nreplaceSelection: false\nhumanize: false\nproviderId: "default-claude-cli"\n---\nYou are a project coordinator extracting every commitment and task from a document.\n\nFind all of the following:\n- Explicit tasks ("we need to", "I will", "someone should")\n- Implicit commitments that clearly require follow-through\n- Decisions that trigger an action ("we agreed to X" means someone has to do X)\n- Deadlines or dates attached to any item\n\nFormat as a markdown checklist. For each item:\n- Start with the action verb ("Send...", "Review...", "Schedule...")\n- If an owner is named, add them in parentheses at the end: (Owner: Sarah)\n- If a deadline is mentioned, add it: (Due: Friday)\n- If neither is mentioned, omit those fields. Do not guess or add "TBD".\n\nGroup by owner if there are three or more distinct owners, otherwise list flat.\n\nOutput only the checklist. No preamble.\n',
  "Extract Key Terms.md": '---\nname: "\u{1F511} Extract Key Terms"\nid: "default-key-terms"\nprompt: "{=CONTEXT=}"\nreplaceSelection: false\nhumanize: false\nproviderId: "default-claude-cli"\n---\n\nYou are a knowledge base curator extracting terms worth defining and remembering.\n\nInclude:\n- Domain-specific jargon or technical terms\n- Proper nouns (people, organisations, products, places) that are central to the content\n- Concepts the text introduces or defines (even if using plain language)\n- Abbreviations and acronyms, expanded\n\nExclude:\n- Common words used in their ordinary sense\n- Terms mentioned only in passing with no substantive content attached\n- Generic concepts so broad they need a book to define ("technology", "society")\n\nFor each term, write a definition that:\n- Explains what it means in the specific context of this document, not just in general\n- Is one to two sentences: precise, not encyclopedic\n- Notes any important relationships to other terms in the list\n\nFormat as a markdown definition list using bold term followed by a colon, then the definition. Group by theme if there are more than eight terms.\n\nOutput only the term list.\n',
  "Fix My Writing.md": `---
name: "\u270F\uFE0F Fix My Writing"
id: "default-fix-writing"
prompt: "{=SELECTION=}"
replaceSelection: true
humanize: true
providerId: "default-claude-cli"
---

You are a professional editor. Your job is to improve the text while keeping it unmistakably the author's own.

Here is the full note for voice and context reference:
{=CONTEXT=}

What to fix:
- Grammar, spelling, and punctuation errors
- Sentences that are unclear, ambiguous, or awkward to read
- Faulty parallel structure and mismatched tenses
- Words used incorrectly or imprecisely

What to preserve:
- The author's vocabulary level, formality, and tone
- Intentional stylistic choices: short punchy sentences, fragments for effect, casual register, unconventional punctuation that clearly serves a purpose
- All content and meaning: do not add ideas, remove arguments, or change what is being said
- Markdown formatting, headings, and structure

Do not upgrade the author's voice into something more "professional" or "polished." If the text is casual, keep it casual. If it's blunt, keep it blunt.

Output only the revised text. No commentary, no list of changes, no before/after.
`,
  "Generate Questions.md": `---
name: "\u2753 Generate Questions"
id: "default-questions"
prompt: "{=CONTEXT=}"
replaceSelection: false
humanize: false
providerId: "default-claude-cli"
---

You are a tutor designing questions that test real understanding, not just recall.

Generate questions at three levels:

**Recall** (3-4 questions): Can the reader retrieve the key facts?
- Target specific names, numbers, definitions, and sequences from the text
- These should have clear, unambiguous answers

**Understanding** (3-4 questions): Can the reader explain the ideas?
- Ask "why" and "how" questions that require connecting concepts
- Ask the reader to explain something in their own words or to a specific audience
- Ask what would change if a key assumption were different

**Application** (2-3 questions): Can the reader use the knowledge?
- Present a new scenario and ask the reader to apply what they learned
- Ask the reader to predict outcomes, diagnose problems, or make decisions
- These should not be answerable by copying a sentence from the text

Rules:
- Draw questions only from what's actually in the text. Do not test on background knowledge.
- Make wrong answers plausible. Avoid questions where the answer is obvious from the phrasing.
- No "What do you think about..." or opinion questions \u2014 test comprehension, not feelings.

Format with markdown headings for each level and a numbered list of questions under each.
`,
  "Humanize.md": '---\nname: "\u{1F5E3}\uFE0F Humanize"\nid: "__humanize__"\nprompt: "{=CONTEXT=}"\nreplaceSelection: true\nhumanize: false\nproviderId: "default-claude-cli"\n---\nRewrite AI-generated text to sound human. \n# Humanizer\n\nTwo passes, in order. Pass 1 strips AI tells. Pass 2 adds light human fingerprints (style choices, not errors). Preserve all facts, names, numbers, quotations, and POV. Cut 15-25% of words. Vary sentence length.\n\n## Absolute rule: zero em dashes\n\nNo em dashes (\u2014) or en dashes (\u2013) in prose. Not one. Use a comma, colon, parentheses, period, or the words _is / and / but / which_ instead. Re-read the output and strip any that snuck in. Hyphens in compounds and number ranges (1990-1995) are fine.\n\n## Pass 1: strip the AI tells\n\nFind each pattern, cut or rewrite. Don\'t itemize fixes in the output.\n\n**1.1 Inflated significance.** _stands as / serves as a testament to, marks a pivotal moment, marks a key turning point, marking/shaping the, reflects a broader movement, underscores its importance, represents a shift toward, symbolizing its ongoing/enduring/lasting, contributing to the rich tapestry of, setting the stage for, an enduring legacy, deeply rooted, evolving landscape, focal point, indelible mark._ If a sentence\'s only job is to assert importance, delete it.\n\n**1.2 Canned notability.** _independent coverage, profiled in major outlets, has been featured in, written by a leading expert, maintains an active social media presence, widely-read publications, national/regional/local/music/business/tech media outlets_ (when no specific outlet is named). Name the actual outlet or drop the claim.\n\n**1.3 The "-ing tail" trap.** Sentences ending in a participle clause adding vague analysis. Triggers: _highlighting, underscoring, emphasizing, reflecting, symbolizing, contributing to, showcasing, ensuring, cultivating, fostering, encompassing, demonstrating, illustrating, marking._ Cut the tail or split into two sentences with a real second fact. If the tail attributes an opinion to a third party that probably didn\'t say it, definitely cut.\n\n**1.4 Travel-brochure tone.** Nuke unless it\'s actually marketing copy: _boasts, vibrant, rich, profound, enhancing, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking, renowned, featuring, diverse array, sprawling, bustling, picturesque, hidden gem, must-see._\n\n**1.5 AI vocabulary.** Replace or delete on sight; a cluster is the loudest tell. _additionally, align with, bolster, bolstered, boast, crucial, delve, dive deep/in, ecosystem (figurative), elevate, emphasize, enhance, enduring, foster, garner, highlight (verb), holistic, interplay, intricate, intricacies, journey (figurative), key (adjective), landscape (abstract), leverage, meticulous(ly), multifaceted, navigate (figurative), nuanced, pivotal, realm, resonate with, revolutionize, robust, seamless, showcase, tapestry, testament, underscore, unlock, valuable, valuable insights, vibrant, vital._ Delete sentence-starters _Additionally, Moreover, Furthermore, In conclusion, Ultimately, It is worth noting that, It\'s important to note that, In today\'s fast-paced world._ Also: AI defending itself loves _concrete evidence / concrete examples / in the absence of concrete..._; replace with "specific," "actual," or delete.\n\n**1.6 "is/are" avoidance.** AI swaps copulas for promotional verbs; reverse it. _serves as / stands as / represents_ \u2192 "is." _boasts / features / offers_ \u2192 "has." _refers to_ (in lead sentences) \u2192 "is."\n\n**1.7 Negative parallelisms.** _Not just X, it\'s Y. / Not X, but Y. / No X, no Y, just Z._ Pick one side. One per long document max.\n\n**1.8 Rule of three.** _Adjective, adjective, and adjective._ Use one, two, or four. Avoid clean triplets.\n\n**1.9 Weasel wording.** _experts argue, some critics have said, industry reports suggest, observers have noted, researchers widely agree, several sources, multiple publications, such as_ (before what looks like an exhaustive list). Name the source or drop the claim.\n\n**1.10 "Despite challenges, bright future" formula.** _Despite [puff], [subject] faces challenges including [list of three]. However, with [ongoing initiatives], [subject] continues to [vague positive verb]..._ Cut the whole structure. If a challenge is real, write one specific sentence.\n\n**1.11 Elegant variation.** AI hops synonyms (car \u2192 vehicle \u2192 automobile \u2192 ride) to avoid repetition. Pick one term and stick with it.\n\n**1.12 Formatting tells.** Title Case Headings \u2192 sentence case. `**Bold Label:**` opening every list item \u2192 unbold; prose where possible. Em dashes \u2192 see absolute rule. Curly quotes ("" \'\') \u2192 straight (`"` `\'`). Markdown thematic breaks (`---`) before every heading \u2192 remove. Skipped heading levels \u2192 fix.\n\n**1.13 Knowledge-cutoff disclaimers.** Cut: _as of my last knowledge update, up to my last training update, as of [date]_ (as a hedge), _based on available information, while specific details are limited/scarce, in the available sources, not widely documented, likely [speculation], maintains a low profile_ (when AI knows nothing). If the writer doesn\'t know, leave it out.\n\n**1.14 Chatbot leak.** Cut anything that sounds like the AI talking to its user: _I hope this helps, Of course!, Certainly!, You\'re absolutely right!, Great question!, Would you like me to..., Is there anything else..., Let me know if you\'d like a more detailed breakdown, Here is a..._ Strip any leading "Subject:" line.\n\n**1.15 Rigid intro/body/conclusion.** Dump explicit "Introduction" and "Conclusion" sections for short-to-medium pieces. Start with the point.\n\n**1.16 Canned good-faith and openness boilerplate.** Common in comments/emails. Cut: _I am committed to, I assure you that, my intention/goal is to, aligns with [X\'s] goals/mission, adheres to [the] standards/policies/guidelines, in a responsible and constructive manner, with the utmost care and respect for, ensuring [neutrality/accuracy/compliance], If you have any concerns or suggestions, I am open to/welcome any further input/guidance/feedback, If there are specific sections that, I am willing to address, I would greatly appreciate your guidance, Please do not hesitate to._ Keep any real promise inside ("I\'ll send the revised draft Friday"); cut the rest.\n\n**1.17 Placeholder text.** AI sometimes leaves Mad-Libs blanks visible: `[Your Name]`, `[link to source]`, `[Describe section]`, `2025-XX-XX`, `INSERT_SOURCE_URL`, `PASTE_URL_HERE`, all-caps bracket tokens. Fill in with real values or delete the sentence. Never hand back text with placeholders intact.\n\n## Pass 2: the human fingerprint\n\nAfter Pass 1, sprinkle in a few of these per page. Goal is texture, not error. Subtle only. Vary which ones you use. Match the register (casual gets more, formal gets fewer). Don\'t call attention to them. Still no em dashes.\n\nMenu:\n\n- **Start a sentence with a conjunction** (And, But, So, Or, Yet, Because).\n- **End a sentence with a preposition** when natural: _"the kind of thing he\'d been waiting for."_\n- **Split an infinitive**: _"to really think about this."_\n- **Sentence fragment for emphasis** (max one per page): _"Just like that."_\n- **Causal "since" / concessive "while"**: _"Since you brought it up..." / "While I agree on the goal..."_\n- **"Which" for a restrictive clause** (occasionally): _"The report which she sent..."_\n- **Singular they/them**: _"Whoever left this, they need to come get it."_\n- **Drop or add an Oxford comma** by the writer\'s rhythm.\n- **"Different than"** (casual): _"different than I expected."_\n- **"Try and"** for "try to": _"Let me try and figure it out."_\n- **"Hopefully"** as a sentence adverb: _"Hopefully we\'ll know by Friday."_\n- **Stylistic comma splice** with short related clauses (informal only): _"It wasn\'t a question, it was a dare."_\n- **"Like" for "such as"** in informal text.\n- **"Less"** with a countable noun (casual, sparingly).\n- **"A lot"** for "many" (conversational).\n- **"However"** sentence-initial without the standard comma.\n- **Trailing adverb or tag clause**: _"...and they left, quickly. / which was weird."_\n- **Mild redundancy** very sparingly: _"first started," "added bonus," "close proximity."_\n\n**Pass 2 blacklist.** Never: _could/would/should of_, "literally" used wrong, _irregardless_, double negatives, misspellings, misused apostrophes (`it\'s` for `its`), subject-verb disagreement. Those look like errors, not style. Line: stylebook bickering = fair game; signals the writer doesn\'t know the rule = not.\n\n## Workflow\n\n1. Read input. Note register (casual / business / academic).\n2. Pass 1 silently.\n3. Pass 2 silently, calibrated to register (3-6 quirks per page).\n4. Re-read; strip every em dash and en dash from prose.\n5. Return only the rewritten text.\n\nLeave a few fingerprints. Never an em dash.\n',
  "Lint.md": `---
name: "\u{1F50D} Lint"
id: "default-lint"
prompt: "{=CONTEXT=}"
replaceSelection: true
humanize: false
providerId: "default-claude-cli"
---

You are a copy editor performing a mechanical lint pass. Fix only clear, objective errors:
- Spelling mistakes
- Grammar errors
- Punctuation mistakes (missing periods, misused apostrophes, mismatched quotes)
- Broken or malformed markdown (unclosed bold/italic, malformed links, wrong heading syntax)
- Empty Carriage Returns

Do not rewrite, restructure, or improve anything that is not a clear error. Do not change the author's stylistic choices (Oxford commas, sentence fragments used deliberately, casual tone).

All of these are intentional until proven otherwise. Return only the corrected text. No commentary, no list of changes, no explanation.
`,
  "Make Outline.md": '---\nname: "\u{1F4D1} Make Outline"\nid: "default-outline"\nprompt: "{=CONTEXT=}"\nreplaceSelection: false\nhumanize: false\nproviderId: "default-claude-cli"\n---\n\nYou are a note-taking assistant that distills prose into a clean, hierarchical outline.\n\nConvert the note into a structured markdown outline that captures every key point.\n\nHow to outline:\n- Use `##` for major topics, `-` for points, and indented `-` for sub-points\n- Preserve the logical flow of the original. Do not rearrange unless the original is clearly disorganized.\n- Each bullet should be a concise phrase or single sentence \u2014 not a paragraph\n- Capture all substantive points. Do not drop information because it seems minor.\n- If the text has examples, keep them as indented sub-points under the claim they support\n\nDo not:\n- Add your own analysis, interpretation, or commentary\n- Create headings for trivial groupings (don\'t make a heading for two bullets)\n- Use numbered lists unless the original text describes an explicit sequence\n- Add a title heading unless the document clearly needs one\n\nOutput only the outline.\n',
  "Simplify.md": `---
name: "\u{1F4A1} Simplify"
id: "default-simplify"
prompt: "{=SELECTION=}"
replaceSelection: true
humanize: true
providerId: "default-claude-cli"
---

You are a technical communicator who makes complex ideas accessible without dumbing them down.

Here is the full note for context:
{=CONTEXT=}

Rewrite the selected text so that someone with no background in the subject can understand it on first read.

How to simplify:
- Replace jargon with plain language. If a technical term is essential, keep it but define it inline in a few words.
- Break long, nested sentences into shorter ones. One idea per sentence.
- Use concrete examples or analogies to anchor abstract concepts
- Preserve all the actual information. Simplify the language, not the content.
- Keep the same structure (paragraphs, lists, headings) unless restructuring genuinely helps clarity

Do not:
- Add disclaimers ("This is a simplified explanation...")
- Remove nuance that matters. If something is complicated because reality is complicated, say so plainly rather than pretending it's simple.
- Talk down to the reader

Output only the simplified text.
`,
  "Summarize.md": `---
name: "\u{1F4CB} Summarize"
id: "default-summarize"
prompt: "Summarize the following:\\n\\n{=CONTEXT=}"
replaceSelection: false
humanize: false
providerId: "default-claude-cli"
---
Read the text carefully. Then do the following: 
1. Extract the "so what." If a smart, busy person could only take away one actionable implication from this, what would it be and why? 
2. Identify the 3\u20135 non-obvious insights \u2014 things that aren't stated explicitly but can be inferred from the content. Skip anything the text already highlights as a key point. 
3. Find the tensions or contradictions. Where does the argument conflict with itself, or with conventional wisdom? What's left unresolved? 
4. Name what's missing. What question does this document raise but never answer? What would you want to know next?

Rules:
- Lead with the single most important point, not background context
- Use tight bullet points, one idea per bullet
- Include specific numbers, names, and dates when they appear in the source; vague generalizations are useless
- If the text contains a decision, conclusion, or recommendation, that goes first
- Do not include filler bullets that only say the document "covers" or "discusses" something

Do not write: "Here is a summary", "The text discusses", "Overall", or any other preamble or conclusion.
Start immediately with the first bullet.
`,
  "Tighten This Up.md": `---
name: "\u2702\uFE0F Tighten This Up"
id: "default-tighten"
prompt: "{=SELECTION=}"
replaceSelection: true
humanize: true
providerId: "default-claude-cli"
---

You are a ruthless copy editor. Your goal is maximum signal per word. Cut everything that doesn't earn its place.

Here is the full note for context reference:
{=CONTEXT=}

Cut without mercy:
- Throat-clearing openers ("In order to understand...", "It is important to note that...")
- Redundant pairs ("each and every", "first and foremost", "various different")
- Weak intensifiers ("very", "really", "quite", "rather", "somewhat")
- Passive voice where active is equally natural
- Nominalisations when verbs are sharper ("make a decision" \u2192 "decide", "provide assistance" \u2192 "help")
- Anything that restates what was just said

Do not cut:
- Any idea or piece of information: compression only, no content loss
- Deliberate repetition used for rhythm or emphasis
- Examples and specifics: these are signal, not noise

Target: 20\u201340% fewer words with identical meaning. If you can't hit that, cut what you can.

Output only the tightened text. No explanation.
`,
  "Translate to Spanish.md": `---
name: "\u{1F310} Translate to Spanish"
id: "default-translate-spanish"
prompt: "{=SELECTION=}"
replaceSelection: true
humanize: false
providerId: "default-claude-cli"
linkDepth: 0
---

You are a professional translator. Translate the selected text into Spanish while preserving its meaning, tone, and formatting.

Rules:
- Detect the source language automatically
- Preserve markdown formatting, links, headings, and structure exactly
- Keep proper nouns, brand names, and technical terms that don't have standard translations
- Match the formality level of the original: casual stays casual, formal stays formal
- If a phrase has no clean equivalent, choose clarity over literal accuracy

Output only the translated text. No commentary, no "Here is the translation:", no language labels.
`,
  "Translate.md": `---
name: "\u{1F310} Translate to English"
id: "default-translate"
prompt: "{=SELECTION=}"
replaceSelection: true
humanize: false
providerId: "default-claude-cli"
linkDepth: 0
---

You are a professional translator. Translate the selected text into English while preserving its meaning, tone, and formatting.

Rules:
- Detect the source language automatically
- Preserve markdown formatting, links, headings, and structure exactly
- Keep proper nouns, brand names, and technical terms that don't have standard translations
- Match the formality level of the original: casual stays casual, formal stays formal
- If a phrase has no clean equivalent, choose clarity over literal accuracy

Output only the translated text. No commentary, no "Here is the translation:", no language labels.
`
};

// src/workflow-loader.ts
var DEFAULT_FILENAMES = {
  "__freeform__": "Ask Claude.md",
  "default-lint": "Lint.md",
  "default-fix-writing": "Fix My Writing.md",
  "default-tighten": "Tighten This Up.md",
  "default-summarize": "Summarize.md",
  "default-action-items": "Extract Action Items.md",
  "default-add-structure": "Add Structure.md",
  "default-expand": "Expand This.md",
  "default-continue": "Continue Writing.md",
  "default-copywriting": "Copywriting.md",
  "continue-prompted": "Contextual Prompt.md",
  "default-devils-advocate": "Devils Advocate.md",
  "default-key-terms": "Extract Key Terms.md",
  "default-to-table": "Convert to Table.md",
  "default-translate": "Translate.md",
  "default-translate-spanish": "Translate to Spanish.md",
  "default-simplify": "Simplify.md",
  "default-brainstorm": "Brainstorm.md",
  "default-questions": "Generate Questions.md",
  "default-outline": "Make Outline.md",
  "__humanize__": "Humanize.md"
};
function workflowToMarkdown(workflow) {
  const lines = [
    "---",
    `name: ${JSON.stringify(workflow.name)}`,
    `id: ${JSON.stringify(workflow.id)}`,
    `prompt: ${JSON.stringify(workflow.prompt)}`,
    `replaceSelection: ${workflow.replaceSelection}`,
    `humanize: ${workflow.humanize}`,
    `providerId: ${JSON.stringify(workflow.providerId)}`,
    `linkDepth: ${workflow.linkDepth}`,
    "---",
    "",
    workflow.systemPrompt
  ];
  return lines.join("\n");
}
function fmString(value, fallback) {
  if (typeof value === "string")
    return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return fallback;
}
function markdownToWorkflow(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---")
    return null;
  const closeIdx = lines.findIndex((line, i) => i > 0 && line === "---");
  if (closeIdx === -1)
    return null;
  try {
    const fm = (0, import_obsidian3.parseYaml)(lines.slice(1, closeIdx).join("\n"));
    const id = fmString(fm.id, "");
    if (!id)
      return null;
    const body = lines.slice(closeIdx + 1).join("\n").replace(/^\n/, "");
    const rawDepth = fm.linkDepth != null ? Number(fm.linkDepth) : 1;
    return {
      id,
      name: fmString(fm.name, "Unnamed"),
      systemPrompt: body,
      prompt: fmString(fm.prompt, ""),
      replaceSelection: Boolean(fm.replaceSelection),
      humanize: Boolean(fm.humanize),
      providerId: fmString(fm.providerId, CLAUDE_CLI_PROVIDER_ID),
      linkDepth: Math.min(3, Math.max(0, isNaN(rawDepth) ? 0 : rawDepth))
    };
  } catch (e) {
    return null;
  }
}
async function loadWorkflowsFromVault(app, folder) {
  const folderNode = app.vault.getAbstractFileByPath(folder);
  if (!(folderNode instanceof import_obsidian3.TFolder)) {
    return { workflows: [], fileMap: /* @__PURE__ */ new Map(), skipped: [] };
  }
  const files = app.vault.getFiles().filter((f) => f.parent === folderNode && f.extension === "md").sort((a, b) => a.name.localeCompare(b.name));
  const workflows = [];
  const fileMap = /* @__PURE__ */ new Map();
  const seenIds = /* @__PURE__ */ new Set();
  const skipped = [];
  for (const file of files) {
    const content = await app.vault.read(file);
    const wf = markdownToWorkflow(content);
    if (wf && !seenIds.has(wf.id)) {
      seenIds.add(wf.id);
      workflows.push(wf);
      fileMap.set(wf.id, file);
    } else if (!wf) {
      skipped.push(file.name);
    }
  }
  return { workflows, fileMap, skipped };
}
async function writeWorkflowFile(app, folder, filename, workflow) {
  const path = `${folder}/${filename}`;
  const content = workflowToMarkdown(workflow);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof import_obsidian3.TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }
  return app.vault.create(path, content);
}
async function ensureWorkflowsFolder(app, folder) {
  var _a2;
  const existing = app.vault.getAbstractFileByPath(folder);
  if (existing instanceof import_obsidian3.TFolder)
    return false;
  try {
    await app.vault.createFolder(folder);
    return true;
  } catch (e) {
    if ((_a2 = e.message) == null ? void 0 : _a2.includes("already exists"))
      return false;
    throw e;
  }
}
async function writeDefaultWorkflows(app, folder) {
  var _a2;
  for (const [filename, content] of Object.entries(alembic_default_workflows_default)) {
    const path = `${folder}/${filename}`;
    if (!app.vault.getAbstractFileByPath(path)) {
      try {
        await app.vault.create(path, content);
      } catch (e) {
        if (!((_a2 = e.message) == null ? void 0 : _a2.includes("already exists")))
          throw e;
      }
    }
  }
}
function isDefaultWorkflow(workflowId) {
  return workflowId in DEFAULT_FILENAMES;
}
async function resetWorkflowToDefault(app, folder, workflowId) {
  const filename = DEFAULT_FILENAMES[workflowId];
  if (!filename)
    return false;
  const content = alembic_default_workflows_default[filename];
  if (!content)
    return false;
  const path = `${folder}/${filename}`;
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof import_obsidian3.TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(path, content);
  }
  return true;
}
async function pullNewWorkflowsFromRepo(app, folder, apiUrl) {
  var _a2, _b, _c;
  try {
    const listing = await (0, import_obsidian3.requestUrl)({
      url: apiUrl,
      headers: { "User-Agent": "obsidian-alembic" }
    });
    const body = listing.json;
    if (!Array.isArray(body)) {
      const msg = (_a2 = body == null ? void 0 : body.message) != null ? _a2 : `HTTP ${listing.status}`;
      return { added: [], error: msg };
    }
    const files = body;
    const mdFiles = files.filter((f) => f.type === "file" && f.name.endsWith(".md"));
    const added = [];
    for (const file of mdFiles) {
      const path = `${folder}/${file.name}`;
      if (!app.vault.getAbstractFileByPath(path)) {
        if (!((_b = file.download_url) == null ? void 0 : _b.startsWith("https://raw.githubusercontent.com/")))
          continue;
        const raw = await (0, import_obsidian3.requestUrl)({ url: file.download_url });
        await app.vault.create(path, raw.text);
        added.push(file.name.replace(/\.md$/, ""));
      }
    }
    return { added };
  } catch (err) {
    const status = err == null ? void 0 : err.status;
    if (status !== void 0) {
      return { added: [], error: `HTTP ${status}` };
    }
    return { added: [], error: (_c = err.message) != null ? _c : String(err) };
  }
}
function safeFilename(name) {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
}
function defaultFilenameFor(workflowId, workflowName) {
  var _a2;
  return (_a2 = DEFAULT_FILENAMES[workflowId]) != null ? _a2 : safeFilename(workflowName) + ".md";
}

// src/settings.ts
var AlembicSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.activeTab = "workflows";
    this.activeWorkflowId = null;
    this.activeProviderId = null;
    this.dirty = false;
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("alembic-settings");
    const tabBar = containerEl.createDiv("alembic-tab-bar");
    ["workflows", "providers"].forEach((tab) => {
      const btn = tabBar.createEl("button", {
        text: tab === "workflows" ? "Workflows" : "Providers",
        cls: "alembic-tab-btn" + (this.activeTab === tab ? " alembic-tab-active" : "")
      });
      btn.addEventListener("click", () => {
        void (async () => {
          if (!await this.confirmIfDirty())
            return;
          this.activeTab = tab;
          this.display();
        })();
      });
    });
    const discordLink = tabBar.createEl("a", { cls: "alembic-discord-link" });
    discordLink.href = "https://discord.gg/Y68Z7EJe9R";
    discordLink.target = "_blank";
    discordLink.rel = "noopener noreferrer";
    const svg = activeDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.classList.add("alembic-discord-icon");
    const path = activeDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.034.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z");
    svg.appendChild(path);
    discordLink.appendChild(svg);
    discordLink.appendText("Join our Discord!");
    if (this.activeTab === "workflows") {
      const folderBar = containerEl.createDiv("alembic-folder-bar");
      folderBar.createSpan({ text: "Workflows folder:", cls: "alembic-folder-bar-label" });
      const folderInput = folderBar.createEl("input", { type: "text", cls: "alembic-input alembic-folder-bar-input" });
      folderInput.value = this.plugin.settings.workflowsFolder;
      folderInput.placeholder = "_alembic";
      const changeBtn = folderBar.createEl("button", { text: "Change", cls: "alembic-connect-btn" });
      changeBtn.addEventListener("click", () => {
        void (async () => {
          const newFolder = folderInput.value.trim();
          if (!newFolder || newFolder === this.plugin.settings.workflowsFolder)
            return;
          await this.changeWorkflowsFolder(newFolder);
        })();
      });
      folderInput.addEventListener("keydown", (e) => {
        void (async () => {
          if (e.key === "Enter") {
            const newFolder = folderInput.value.trim();
            if (!newFolder || newFolder === this.plugin.settings.workflowsFolder)
              return;
            await this.changeWorkflowsFolder(newFolder);
          }
        })();
      });
    }
    const layout = containerEl.createDiv("alembic-layout");
    const sidebar = layout.createDiv("alembic-sidebar");
    const detail = layout.createDiv("alembic-detail");
    if (this.activeTab === "workflows") {
      this.renderWorkflowSidebar(sidebar);
      this.renderWorkflowDetail(detail);
    } else {
      this.renderProviderSidebar(sidebar);
      this.renderProviderDetail(detail);
    }
  }
  async changeWorkflowsFolder(newFolder) {
    const oldFolder = this.plugin.settings.workflowsFolder;
    const oldNode = this.app.vault.getAbstractFileByPath(oldFolder);
    if (oldNode instanceof import_obsidian4.TFolder) {
      try {
        await this.app.vault.rename(oldNode, newFolder);
      } catch (e) {
        await ensureWorkflowsFolder(this.app, newFolder);
        alembicFlash(
          `Could not rename automatically. Move your files from "${oldFolder}" to "${newFolder}" manually.`,
          1e4,
          "error"
        );
      }
    } else {
      await ensureWorkflowsFolder(this.app, newFolder);
    }
    this.plugin.settings.workflowsFolder = newFolder;
    await this.plugin.saveSettings();
    await this.plugin.reloadWorkflows();
    this.display();
  }
  /** Marks the detail panel as dirty when any input/change event fires. */
  trackDirty(container) {
    const mark = () => {
      this.dirty = true;
    };
    container.addEventListener("input", mark);
    container.addEventListener("change", mark);
  }
  /** Returns true if safe to proceed (not dirty, or user confirmed discard). */
  async confirmIfDirty() {
    if (!this.dirty)
      return true;
    if (await confirmModal(this.app, "You have unsaved changes. Discard them?")) {
      this.dirty = false;
      return true;
    }
    return false;
  }
  // ── Shared field helpers ──────────────────────────────────────────────────
  createField(parent, label, description) {
    const group = parent.createDiv("alembic-field");
    group.createEl("label", { text: label, cls: "alembic-field-label" });
    if (description)
      group.createEl("p", { text: description, cls: "alembic-field-desc" });
    return group;
  }
  createToggle(parent, label, description, value, onChange) {
    const field = this.createField(parent, label, description);
    const lbl = field.createEl("label", { cls: "alembic-toggle-row" });
    const cb = lbl.createEl("input", { type: "checkbox" });
    cb.checked = value;
    cb.classList.add("alembic-checkbox");
    const span = lbl.createSpan({ text: value ? "On" : "Off", cls: "alembic-toggle-text" });
    cb.addEventListener("change", () => {
      onChange(cb.checked);
      span.textContent = cb.checked ? "On" : "Off";
    });
  }
  addTokenButtons(parent, textarea, onUpdate) {
    const row = parent.createDiv("alembic-token-row");
    for (const token of [TOKEN_SELECTION, TOKEN_CONTEXT]) {
      const btn = row.createEl("button", { text: `+ ${token}`, cls: "alembic-token-btn" });
      btn.addEventListener("click", () => {
        const pos = textarea.selectionStart;
        textarea.value = textarea.value.slice(0, pos) + token + textarea.value.slice(pos);
        onUpdate(textarea.value);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = pos + token.length;
      });
    }
  }
  // ── Workflows tab ─────────────────────────────────────────────────────────
  renderWorkflowSidebar(sidebar) {
    const header = sidebar.createDiv("alembic-sidebar-header");
    header.createSpan({ text: "Workflows", cls: "alembic-sidebar-title" });
    const addBtn = header.createEl("button", { text: "+", cls: "alembic-add-btn" });
    addBtn.addEventListener("click", () => {
      void (async () => {
        const folder = this.plugin.settings.workflowsFolder;
        let filename = "New Workflow.md";
        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(`${folder}/${filename}`)) {
          filename = `New Workflow ${++counter}.md`;
        }
        const newWorkflow = {
          id: crypto.randomUUID(),
          name: "New Workflow",
          systemPrompt: "",
          prompt: "",
          replaceSelection: false,
          humanize: false,
          providerId: CLAUDE_CLI_PROVIDER_ID,
          linkDepth: 1
        };
        await writeWorkflowFile(this.app, folder, filename, newWorkflow);
        await this.plugin.reloadWorkflows();
        this.activeWorkflowId = newWorkflow.id;
        this.display();
      })();
    });
    if (!this.activeWorkflowId && this.plugin.workflows.length > 0) {
      this.activeWorkflowId = this.plugin.workflows[0].id;
    }
    const list = sidebar.createEl("ul", { cls: "alembic-sidebar-list" });
    this.plugin.workflows.forEach((w) => {
      const item = list.createEl("li", {
        text: w.name,
        cls: "alembic-sidebar-item" + (w.id === this.activeWorkflowId ? " alembic-active" : "")
      });
      item.addEventListener("click", () => {
        void (async () => {
          if (!await this.confirmIfDirty())
            return;
          this.activeWorkflowId = w.id;
          this.display();
        })();
      });
    });
    const restoreBtn = sidebar.createEl("button", { text: "Restore defaults", cls: "alembic-restore-btn" });
    restoreBtn.addEventListener("click", () => {
      void (async () => {
        var _a2, _b;
        if (restoreBtn.textContent === "Restore defaults") {
          restoreBtn.textContent = "Are you sure?";
          restoreBtn.addClass("alembic-restore-btn-confirm");
          window.setTimeout(() => {
            if (restoreBtn.isConnected) {
              restoreBtn.textContent = "Restore defaults";
              restoreBtn.removeClass("alembic-restore-btn-confirm");
            }
          }, 3e3);
          return;
        }
        await writeDefaultWorkflows(this.app, this.plugin.settings.workflowsFolder);
        await this.plugin.reloadWorkflows();
        this.activeWorkflowId = (_b = (_a2 = this.plugin.workflows[0]) == null ? void 0 : _a2.id) != null ? _b : null;
        this.display();
      })();
    });
    const pullBtn = sidebar.createEl("button", { text: "\u2193 pull new workflows", cls: "alembic-restore-btn" });
    pullBtn.addEventListener("click", () => {
      void (async () => {
        pullBtn.textContent = "Checking\u2026";
        pullBtn.disabled = true;
        const result = await pullNewWorkflowsFromRepo(
          this.app,
          this.plugin.settings.workflowsFolder,
          WORKFLOWS_REPO_API_URL
        );
        pullBtn.disabled = false;
        pullBtn.textContent = "\u2193 pull new workflows";
        if (result.error) {
          alembicFlash(`Could not reach the repository: ${result.error}`, 6e3, "error");
          return;
        }
        if (result.added.length === 0) {
          alembicFlash("Already up to date.", 3e3);
          return;
        }
        await this.plugin.reloadWorkflows();
        this.display();
        alembicFlash(
          `Added ${result.added.length} workflow${result.added.length !== 1 ? "s" : ""}: ${result.added.join(", ")}.`,
          5e3,
          "success"
        );
      })();
    });
  }
  renderWorkflowDetail(detail) {
    var _a2;
    const workflows = this.plugin.workflows;
    if (workflows.length === 0) {
      detail.createEl("p", { text: "No workflows yet. Click + to create one.", cls: "alembic-empty-detail" });
      return;
    }
    const workflow = (_a2 = workflows.find((w) => w.id === this.activeWorkflowId)) != null ? _a2 : workflows[0];
    const draft = { ...workflow };
    this.trackDirty(detail);
    const openRow = detail.createDiv("alembic-open-row");
    const tfile = this.plugin.workflowFileMap.get(workflow.id);
    if (tfile) {
      const openBtn = openRow.createEl("button", { text: "\u2197 Open in editor", cls: "alembic-connect-btn" });
      openBtn.addEventListener("click", () => {
        void this.app.workspace.getLeaf("tab").openFile(tfile);
      });
    }
    openRow.createSpan({ text: tfile ? tfile.path : "", cls: "alembic-file-path" });
    const nameField = this.createField(detail, "Workflow Name");
    const nameInput = nameField.createEl("input", { type: "text", cls: "alembic-input" });
    nameInput.value = draft.name;
    nameInput.addEventListener("input", () => {
      draft.name = nameInput.value;
    });
    const providers = this.plugin.settings.providers;
    if (providers.length > 0) {
      const provField = this.createField(detail, "Provider", "Which AI backend runs this workflow.");
      const provSelect = provField.createEl("select", { cls: "alembic-select" });
      providers.forEach((p) => {
        const opt = provSelect.createEl("option", { text: p.name, value: p.id });
        if (p.id === draft.providerId)
          opt.selected = true;
      });
      provSelect.addEventListener("change", () => {
        draft.providerId = provSelect.value;
      });
    }
    const sysField = this.createField(detail, "System Prompt", "Optional. Sets the AI's role and rules for this workflow. Also editable directly in the .md file.");
    const sysArea = sysField.createEl("textarea", { cls: "alembic-textarea" });
    sysArea.placeholder = "You are a helpful assistant.";
    sysArea.value = draft.systemPrompt;
    sysArea.addEventListener("input", () => {
      draft.systemPrompt = sysArea.value;
    });
    this.addTokenButtons(sysField, sysArea, (v) => {
      draft.systemPrompt = v;
    });
    if (workflow.id !== FREEFORM_WORKFLOW_ID) {
      const promptField = this.createField(detail, "Prompt", "Optional. Use {=SELECTION=} and {=CONTEXT=} as placeholders. If blank, sends available selection and note content automatically.");
      const promptArea = promptField.createEl("textarea", { cls: "alembic-textarea" });
      promptArea.value = draft.prompt;
      promptArea.addEventListener("input", () => {
        draft.prompt = promptArea.value;
      });
      this.addTokenButtons(promptField, promptArea, (v) => {
        draft.prompt = v;
      });
    } else {
      this.createField(detail, "Prompt", "The prompt is entered by the user at run time via the text input popup.");
    }
    this.createToggle(detail, "Replace selection", "Replaces highlighted text with the result. If no text is selected, replaces the entire note for context-only workflows (e.g. Lint, Add Structure). Off = insert at cursor.", draft.replaceSelection, (v) => {
      draft.replaceSelection = v;
    });
    if (workflow.id !== HUMANIZE_WORKFLOW_ID) {
      this.createToggle(detail, "Humanize output", "Run a second pass through the Humanize workflow to strip AI-sounding language.", draft.humanize, (v) => {
        draft.humanize = v;
      });
    }
    const linkDepthField = this.createField(detail, "Link depth", "How many levels of [[wikilinks]] to follow and include as context. 0 = none.");
    const linkDepthSelect = linkDepthField.createEl("select", { cls: "alembic-select" });
    [0, 1, 2, 3].forEach((n) => {
      var _a3;
      const opt = linkDepthSelect.createEl("option", { text: String(n), value: String(n) });
      if (n === ((_a3 = draft.linkDepth) != null ? _a3 : 0))
        opt.selected = true;
    });
    linkDepthSelect.addEventListener("change", () => {
      draft.linkDepth = Number(linkDepthSelect.value);
    });
    const buttonRow = detail.createDiv("alembic-button-row");
    const deleteBtn = buttonRow.createEl("button", { text: "Delete", cls: "alembic-delete-btn" });
    deleteBtn.addEventListener("click", () => {
      void (async () => {
        var _a3, _b;
        if (!await confirmModal(this.app, `Delete "${workflow.name}"? The file will be moved to trash.`))
          return;
        this.dirty = false;
        const file = this.plugin.workflowFileMap.get(workflow.id);
        if (file) {
          await this.app.fileManager.trashFile(file);
        }
        await this.plugin.reloadWorkflows();
        this.activeWorkflowId = (_b = (_a3 = this.plugin.workflows[0]) == null ? void 0 : _a3.id) != null ? _b : null;
        this.display();
      })();
    });
    if (isDefaultWorkflow(workflow.id)) {
      const resetBtn = buttonRow.createEl("button", { text: "Reset to default", cls: "alembic-reset-btn" });
      resetBtn.addEventListener("click", () => {
        void (async () => {
          if (!await confirmModal(this.app, `Reset "${workflow.name}" to its built-in default? Any edits will be overwritten.`))
            return;
          this.dirty = false;
          const ok = await resetWorkflowToDefault(this.app, this.plugin.settings.workflowsFolder, workflow.id);
          await this.plugin.reloadWorkflows();
          this.display();
          if (ok) {
            alembicFlash(`${workflow.name} reset to default.`, 3e3);
          } else {
            alembicFlash(`Could not reset "${workflow.name}" \u2014 no bundled default found.`, 5e3, "error");
          }
        })();
      });
    }
    const saveBtn = buttonRow.createEl("button", { text: "Save", cls: "alembic-save-btn" });
    saveBtn.addEventListener("click", () => {
      void (async () => {
        if (!draft.name.trim()) {
          alembicFlash("Workflow name cannot be empty.", 5e3, "error");
          return;
        }
        if (!this.plugin.settings.providers.some((p) => p.id === draft.providerId)) {
          alembicFlash("The selected provider no longer exists. Choose another.", 5e3, "error");
          return;
        }
        const existingFile = this.plugin.workflowFileMap.get(workflow.id);
        const filename = existingFile ? existingFile.name : safeFilename(draft.name) + ".md";
        await writeWorkflowFile(this.app, this.plugin.settings.workflowsFolder, filename, draft);
        this.dirty = false;
        await this.plugin.reloadWorkflows();
        this.activeWorkflowId = draft.id;
        this.display();
      })();
    });
  }
  // ── Providers tab ─────────────────────────────────────────────────────────
  renderProviderSidebar(sidebar) {
    const header = sidebar.createDiv("alembic-sidebar-header");
    header.createSpan({ text: "Providers", cls: "alembic-sidebar-title" });
    const addBtn = header.createEl("button", { text: "+", cls: "alembic-add-btn" });
    addBtn.addEventListener("click", () => {
      void (async () => {
        const newProvider = {
          id: crypto.randomUUID(),
          name: "New Provider",
          type: "ollama",
          baseUrl: "http://localhost:11434",
          model: "llama3.2"
        };
        this.plugin.settings.providers.push(newProvider);
        await this.plugin.saveSettings();
        this.activeProviderId = newProvider.id;
        this.display();
      })();
    });
    const list = sidebar.createEl("ul", { cls: "alembic-sidebar-list" });
    this.plugin.settings.providers.forEach((p) => {
      const item = list.createEl("li", {
        text: p.name,
        cls: "alembic-sidebar-item" + (p.id === this.activeProviderId ? " alembic-active" : "")
      });
      item.addEventListener("click", () => {
        void (async () => {
          if (!await this.confirmIfDirty())
            return;
          this.activeProviderId = p.id;
          this.display();
        })();
      });
    });
    if (!this.activeProviderId && this.plugin.settings.providers.length > 0) {
      this.activeProviderId = this.plugin.settings.providers[0].id;
    }
  }
  renderProviderDetail(detail) {
    var _a2;
    const providers = this.plugin.settings.providers;
    if (providers.length === 0) {
      detail.createEl("p", { text: "No providers yet. Click + to add one.", cls: "alembic-empty-detail" });
      return;
    }
    const provider = (_a2 = providers.find((p) => p.id === this.activeProviderId)) != null ? _a2 : providers[0];
    const draft = { ...provider };
    const isBuiltIn = provider.id === CLAUDE_CLI_PROVIDER_ID;
    this.trackDirty(detail);
    const nameField = this.createField(detail, "Profile Name");
    const nameInput = nameField.createEl("input", { type: "text", cls: "alembic-input" });
    nameInput.value = draft.name;
    nameInput.disabled = isBuiltIn;
    nameInput.addEventListener("input", () => {
      draft.name = nameInput.value;
    });
    const typeField = this.createField(detail, "Provider Type");
    const typeSelect = typeField.createEl("select", { cls: "alembic-select" });
    typeSelect.disabled = isBuiltIn;
    PROVIDER_META.forEach(({ type, label }) => {
      const opt = typeSelect.createEl("option", { text: label, value: type });
      if (type === draft.type)
        opt.selected = true;
    });
    const dynamicFields = detail.createDiv("alembic-dynamic-fields");
    let modelInput = null;
    const renderDynamic = (type) => {
      var _a3, _b, _c;
      dynamicFields.empty();
      modelInput = null;
      const meta = PROVIDER_META_MAP[type];
      if (meta.needsApiKey) {
        const keyField = this.createField(dynamicFields, "API Key");
        const keyInput = keyField.createEl("input", { type: "password", cls: "alembic-input" });
        keyInput.value = (_a3 = draft.apiKey) != null ? _a3 : "";
        keyInput.addEventListener("input", () => {
          draft.apiKey = keyInput.value;
        });
      }
      if (meta.defaultBaseUrl !== void 0) {
        const urlField = this.createField(dynamicFields, "Base URL");
        const urlInput = urlField.createEl("input", { type: "text", cls: "alembic-input" });
        urlInput.value = (_b = draft.baseUrl) != null ? _b : meta.defaultBaseUrl;
        urlInput.addEventListener("input", () => {
          draft.baseUrl = urlInput.value;
        });
      }
      let modelChips = null;
      if (meta.modelHint) {
        const modelField = this.createField(dynamicFields, "Model", meta.modelHint);
        modelInput = modelField.createEl("input", { type: "text", cls: "alembic-input" });
        modelInput.value = (_c = draft.model) != null ? _c : "";
        modelInput.addEventListener("input", () => {
          draft.model = modelInput.value;
        });
        modelChips = modelField.createDiv("alembic-model-chips");
        const fillChips = (models) => {
          modelChips.empty();
          models.forEach((m) => {
            const chip = modelChips.createEl("button", { text: m, cls: "alembic-model-chip" });
            chip.type = "button";
            chip.addEventListener("click", () => {
              modelInput.value = m;
              draft.model = m;
            });
          });
        };
        if (meta.knownModels.length > 0)
          fillChips(meta.knownModels);
      }
      const connectRow = dynamicFields.createDiv("alembic-connect-row");
      const connectBtn = connectRow.createEl("button", { text: "Test connection", cls: "alembic-connect-btn" });
      const statusEl = connectRow.createSpan({ cls: "alembic-connect-status" });
      connectBtn.addEventListener("click", () => {
        void (async () => {
          connectBtn.disabled = true;
          connectBtn.textContent = "Connecting\u2026";
          statusEl.textContent = "";
          statusEl.className = "alembic-connect-status";
          const result = await fetchProviderModels({ ...draft, type });
          connectBtn.disabled = false;
          connectBtn.textContent = "Test connection";
          if (result.error) {
            statusEl.textContent = "\u2717 " + result.error;
            statusEl.addClass("alembic-status-error");
          } else if (meta.isCli) {
            statusEl.textContent = `\u2713 ${meta.label} is reachable`;
            statusEl.addClass("alembic-status-ok");
          } else {
            statusEl.textContent = `\u2713 Connected \u2014 ${result.models.length} model${result.models.length !== 1 ? "s" : ""} found`;
            statusEl.addClass("alembic-status-ok");
            if (modelChips && result.models.length > 0) {
              const chips = modelChips;
              chips.empty();
              result.models.forEach((m) => {
                const chip = chips.createEl("button", { text: m, cls: "alembic-model-chip" });
                chip.type = "button";
                chip.addEventListener("click", () => {
                  modelInput.value = m;
                  draft.model = m;
                });
              });
            }
          }
        })();
      });
    };
    renderDynamic(draft.type);
    typeSelect.addEventListener("change", () => {
      draft.type = typeSelect.value;
      renderDynamic(draft.type);
    });
    const buttonRow = detail.createDiv("alembic-button-row");
    const deleteBtn = buttonRow.createEl("button", { text: "Delete", cls: "alembic-delete-btn" });
    deleteBtn.addEventListener("click", () => {
      void (async () => {
        var _a3, _b;
        const affected = this.plugin.workflows.filter((w) => w.providerId === provider.id);
        const fallback = this.plugin.settings.providers.find((p) => p.id !== provider.id);
        let msg = `Delete "${provider.name}"?`;
        if (affected.length > 0) {
          const names = affected.map((w) => w.name).join(", ");
          msg += fallback ? `

${affected.length} workflow(s) use this provider (${names}) and will be reassigned to "${fallback.name}".` : `

${affected.length} workflow(s) use this provider (${names}). No other provider exists \u2014 they will have no provider until you add one.`;
        }
        if (!await confirmModal(this.app, msg))
          return;
        if (affected.length > 0 && fallback) {
          await Promise.all(affected.map((wf) => {
            wf.providerId = fallback.id;
            const file = this.plugin.workflowFileMap.get(wf.id);
            return file ? writeWorkflowFile(this.app, this.plugin.settings.workflowsFolder, file.name, wf) : Promise.resolve();
          }));
        }
        this.plugin.settings.providers = this.plugin.settings.providers.filter((p) => p.id !== provider.id);
        this.activeProviderId = (_b = (_a3 = this.plugin.settings.providers[0]) == null ? void 0 : _a3.id) != null ? _b : null;
        await this.plugin.saveSettings();
        await this.plugin.reloadWorkflows();
        this.display();
      })();
    });
    const saveBtn = buttonRow.createEl("button", { text: "Save", cls: "alembic-save-btn" });
    saveBtn.addEventListener("click", () => {
      void (async () => {
        if (!draft.name.trim()) {
          alembicFlash("Provider name cannot be empty.", 5e3, "error");
          return;
        }
        const idx = this.plugin.settings.providers.findIndex((p) => p.id === provider.id);
        if (idx !== -1) {
          this.plugin.settings.providers[idx] = draft;
          this.dirty = false;
          await this.plugin.saveSettings();
          this.display();
        }
      })();
    });
  }
};

// src/main.ts
async function expandLinkedNotes(app, content, depth, visited = /* @__PURE__ */ new Set()) {
  if (depth === 0)
    return content;
  const wikiLinkRegex = /\[\[([^\]|#\n]+?)(?:[|#][^\]]*?)?\]\]/g;
  const appended = [];
  let match;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const linkTarget = match[1].trim();
    const file = app.metadataCache.getFirstLinkpathDest(linkTarget, "");
    if (!file || visited.has(file.path))
      continue;
    visited.add(file.path);
    const linked = await app.vault.read(file);
    const expanded = await expandLinkedNotes(app, linked, depth - 1, visited);
    appended.push(`

---
**Linked note: ${file.basename}**

${expanded}`);
  }
  return content + appended.join("");
}
var AlembicPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.workflows = [];
    this.workflowFileMap = /* @__PURE__ */ new Map();
    this.lastSkipped = "";
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AlembicSettingTab(this.app, this));
    this.registerEvent(this.app.vault.on("create", (f) => {
      if (this.isWorkflowFile(f.path))
        void this.reloadWorkflows();
    }));
    this.registerEvent(this.app.vault.on("modify", (f) => {
      if (this.isWorkflowFile(f.path))
        void this.reloadWorkflows();
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (this.isWorkflowFile(f.path))
        void this.reloadWorkflows();
    }));
    this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
      if (this.isWorkflowFile(f.path) || this.isWorkflowFile(oldPath))
        void this.reloadWorkflows();
    }));
    this.addCommand({
      id: "open-workflow-selector",
      name: "Run workflow",
      editorCallback: (editor) => {
        new WorkflowSelectorModal(
          this.app,
          this.workflows,
          (workflow) => {
            void this.executeWorkflow(editor, workflow);
          }
        ).open();
      }
    });
    this.app.workspace.onLayoutReady(() => {
      void this.initializeWorkflows();
    });
  }
  async initializeWorkflows() {
    await ensureWorkflowsFolder(this.app, this.settings.workflowsFolder);
    const legacy = this.settings;
    if (legacy.workflows && legacy.workflows.length > 0) {
      await this.migrateWorkflows(legacy.workflows);
      delete legacy.workflows;
      await this.saveSettings();
    } else {
      const initial = await loadWorkflowsFromVault(this.app, this.settings.workflowsFolder);
      if (initial.workflows.length === 0) {
        await writeDefaultWorkflows(this.app, this.settings.workflowsFolder);
      }
    }
    await this.reloadWorkflows();
    for (const workflow of this.workflows) {
      this.registerWorkflowCommand(workflow);
    }
  }
  isWorkflowFile(path) {
    return path.startsWith(this.settings.workflowsFolder + "/") && path.endsWith(".md");
  }
  async reloadWorkflows() {
    const { workflows, fileMap, skipped } = await loadWorkflowsFromVault(this.app, this.settings.workflowsFolder);
    this.workflows = workflows;
    this.workflowFileMap = fileMap;
    const skippedKey = skipped.join(",");
    if (skipped.length > 0 && skippedKey !== this.lastSkipped) {
      alembicFlash(`Skipped ${skipped.length} malformed workflow file(s): ${skipped.join(", ")}`, 8e3, "error");
    }
    this.lastSkipped = skippedKey;
  }
  async migrateWorkflows(legacyWorkflows) {
    for (const wf of legacyWorkflows) {
      const filename = defaultFilenameFor(wf.id, wf.name);
      const path = `${this.settings.workflowsFolder}/${filename}`;
      if (!this.app.vault.getAbstractFileByPath(path)) {
        await writeWorkflowFile(this.app, this.settings.workflowsFolder, filename, wf);
      }
    }
  }
  registerWorkflowCommand(workflow) {
    const cmdId = `run-workflow-${workflow.id.replace(/[^a-z0-9]/gi, "-")}`;
    this.addCommand({
      id: cmdId,
      name: workflow.name,
      editorCallback: (editor) => {
        const live = this.workflows.find((w) => w.id === workflow.id);
        if (!live) {
          alembicFlash("This workflow no longer exists. Reload the plugin to update the command palette.", 5e3, "error");
          return;
        }
        if (live.id === FREEFORM_WORKFLOW_ID) {
          new FreeformModal(this.app, live, (prompt, humanize) => {
            void this.executeWorkflow(editor, { ...live, prompt: `${TOKEN_CONTEXT}

---

${prompt}`, humanize });
          }).open();
        } else {
          void this.executeWorkflow(editor, live);
        }
      }
    });
  }
  async executeWorkflow(editor, workflow) {
    var _a2, _b;
    const selection = editor.getSelection();
    const rawContext = editor.getValue();
    const context = workflow.linkDepth > 0 ? await expandLinkedNotes(this.app, rawContext, workflow.linkDepth) : rawContext;
    const selFrom = editor.getCursor("from");
    const selTo = editor.getCursor("to");
    const hasSelection = selection.trim().length > 0;
    if (!hasSelection && workflow.prompt.includes(TOKEN_SELECTION)) {
      alembicFlash("Select some text first \u2014 this workflow operates on a selection.", 5e3);
      return;
    }
    const userMessage = assembleUserMessage(workflow, selection, context);
    if (!userMessage.trim()) {
      alembicFlash("Nothing to distill \u2014 add some text or select a passage.", 5e3);
      return;
    }
    const totalChars = userMessage.length + workflow.systemPrompt.length;
    if (totalChars > 1e5) {
      const approxKb = Math.round(totalChars / 1024);
      const proceed = await confirmModal(
        this.app,
        `The context being sent is ~${approxKb} KB (including linked notes). This may be slow or hit token limits. Continue?`
      );
      if (!proceed)
        return;
    }
    const profile = (_a2 = this.settings.providers.find((p) => p.id === workflow.providerId)) != null ? _a2 : this.settings.providers[0];
    if (!profile) {
      alembicFlash("No provider configured. Add one in Settings \u2192 Alembic \u2192 Providers.", 8e3, "error");
      return;
    }
    let msgIdx = 0;
    const run = alembicRunNotice(workflow.name);
    const ticker = window.setInterval(() => {
      msgIdx = (msgIdx + 1) % WAIT_MESSAGES.length;
      run.setStatus(WAIT_MESSAGES[msgIdx]);
    }, 7e3);
    let cancelCurrent = null;
    run.addCancelButton(() => cancelCurrent == null ? void 0 : cancelCurrent());
    const finish = () => {
      window.clearInterval(ticker);
      run.hide();
    };
    try {
      const resolvedWorkflow = { ...workflow, systemPrompt: substituteTokens(workflow.systemPrompt, selection, context) };
      const handle = runWithProvider(profile, resolvedWorkflow, userMessage);
      cancelCurrent = handle.cancel;
      let result = await handle.promise;
      if (result.cancelled) {
        finish();
        alembicFlash("Stopped.", 3e3);
        return;
      }
      if (result.error) {
        finish();
        alembicFlash(result.error, 8e3, "error");
        return;
      }
      if (!result.output.trim()) {
        finish();
        alembicFlash("The provider returned an empty response.", 5e3, "error");
        return;
      }
      if (workflow.humanize) {
        run.setStatus("Humanizing\u2026");
        const humanizeWorkflow = this.workflows.find((w) => w.id === HUMANIZE_WORKFLOW_ID);
        if (humanizeWorkflow) {
          const humanizeProfile = (_b = this.settings.providers.find((p) => p.id === humanizeWorkflow.providerId)) != null ? _b : profile;
          const hHandle = runWithProvider(humanizeProfile, humanizeWorkflow, assembleUserMessage(humanizeWorkflow, result.output, ""));
          cancelCurrent = hHandle.cancel;
          const hResult = await hHandle.promise;
          if (hResult.cancelled) {
            finish();
            alembicFlash("Stopped.", 3e3);
            return;
          }
          if (!hResult.error)
            result = hResult;
        }
      }
      finish();
      if (workflow.replaceSelection && (hasSelection || isFullNoteWorkflow(workflow))) {
        if (hasSelection) {
          editor.replaceRange(result.output, selFrom, selTo);
        } else {
          const lastLine = editor.lastLine();
          editor.replaceRange(
            result.output,
            { line: 0, ch: 0 },
            { line: lastLine, ch: editor.getLine(lastLine).length }
          );
        }
      } else {
        editor.replaceRange(result.output, selTo);
      }
      alembicFlash(`${workflow.name} \u2014 done.`, 2500, "success");
    } catch (err) {
      finish();
      alembicFlash(err instanceof Error ? err.message : String(err), 8e3, "error");
    }
  }
  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    if (!this.settings.providers || this.settings.providers.length === 0) {
      this.settings.providers = DEFAULT_PROVIDERS;
    }
    if (!this.settings.workflowsFolder) {
      this.settings.workflowsFolder = DEFAULT_WORKFLOWS_FOLDER;
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
