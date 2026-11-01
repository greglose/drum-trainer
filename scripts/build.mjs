// Inlines src/grader.cjs into src/app.html and writes dist/index.html.
// No dependencies: the page is one self-contained HTML file.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const grader = readFileSync(join(root, "src/grader.cjs"), "utf8").replace(/^module\.exports.*$/m, "");
const page = readFileSync(join(root, "src/app.html"), "utf8");
if (!page.includes("/*GRADER*/")) throw new Error("src/app.html has no /*GRADER*/ marker");
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/index.html"), page.replace("/*GRADER*/", grader));
console.log("wrote dist/index.html");
