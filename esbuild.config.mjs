import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { readdirSync, readFileSync } from "fs";
import { resolve, join } from "path";

const prod = process.argv[2] === "production";

// ── Workflow bundler plugin ───────────────────────────────────────────────────
// Resolves the virtual import "alembic:default-workflows" to an object whose
// keys are filenames and values are the raw .md file contents. Contributors add
// new workflows to the workflows/ folder and open a PR — no TypeScript changes
// needed. The content is frozen into main.js at build time.

const workflowBundlerPlugin = {
  name: "alembic-workflows",
  setup(build) {
    build.onResolve({ filter: /^alembic:default-workflows$/ }, (args) => ({
      path: args.path,
      namespace: "alembic-workflows",
    }));

    build.onLoad({ filter: /.*/, namespace: "alembic-workflows" }, () => {
      const dir = resolve("./workflows");
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .sort();

      const entries = files.map((filename) => {
        const content = readFileSync(join(dir, filename), "utf8");
        return `  ${JSON.stringify(filename)}: ${JSON.stringify(content)}`;
      });

      return {
        contents: `export default {\n${entries.join(",\n")}\n};\n`,
        loader: "js",
      };
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  plugins: [workflowBundlerPlugin],
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
