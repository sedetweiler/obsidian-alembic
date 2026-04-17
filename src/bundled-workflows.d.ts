/**
 * Virtual module resolved at build time by the esbuild workflowBundlerPlugin.
 * Keys are filenames (e.g. "01 Lint.md"), values are raw file contents.
 * Populated from the workflows/ directory in the repo root.
 */
declare module 'alembic:default-workflows' {
  const workflows: Record<string, string>;
  export default workflows;
}
