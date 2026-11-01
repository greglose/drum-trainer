// ESLint flat config. The page modules are concatenated into one script, so each module's
// name is a global to the others; list them here rather than disabling no-undef.
import js from "@eslint/js";

const browser = {
  window: "readonly", document: "readonly", navigator: "readonly", localStorage: "readonly", performance: "readonly",
  requestAnimationFrame: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  getComputedStyle: "readonly", Blob: "readonly", URL: "readonly", Event: "readonly", AudioContext: "readonly", console: "readonly", globalThis: "readonly",
  structuredClone: "readonly",
};
const modules = {
  Grader: "readonly", Patterns: "readonly", LIBRARY: "readonly", Skins: "readonly", Storage: "readonly", Store: "readonly", StaffModel: "readonly",
  Scheduler: "readonly", Run: "readonly", Audio: "readonly", Sinks: "readonly", Midi: "readonly", StaffView: "readonly", ReportView: "readonly",
  EditorModel: "readonly", EditorView: "readonly",
};
const node = { module: "writable", require: "readonly", process: "readonly", console: "readonly", globalThis: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly", URL: "readonly" };

export default [
  js.configs.recommended,
  { ignores: ["dist/**", "node_modules/**", "docs/**"] },
  { files: ["src/**/*.js", "src/**/*.cjs"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...browser, ...modules, module: "readonly", require: "readonly" } },
    // Each module declares the const the others see as a global, so redeclaring a listed global is the design, and a
    // module's own name is "unused" inside its file.
    rules: { "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^[A-Z]" }], "no-redeclare": ["error", { builtinGlobals: false }], "no-empty": ["error", { allowEmptyCatch: true }] } },
  { files: ["scripts/**/*.mjs", "test/**/*.js", "test/**/*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...node, ...browser } },
    rules: { "no-unused-vars": ["error", { args: "none" }], "no-empty": ["error", { allowEmptyCatch: true }] } },
];
