import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const entryPoint = path.join(projectRoot, "monitoring-sdk/cdn-entry.js");
const committedBundlePath = path.join(
  projectRoot,
  "public/monitoring/v1/monitoring.min.js",
);

const [buildResult, committedBundle] = await Promise.all([
  build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    format: "iife",
    write: false,
  }),
  readFile(committedBundlePath),
]);

if (
  buildResult.outputFiles.length !== 1 ||
  !Buffer.from(buildResult.outputFiles[0].contents).equals(committedBundle)
) {
  throw new Error(
    "The committed v1 monitoring bundle is stale. Run npm run build:monitoring.",
  );
}

console.log("The committed v1 monitoring bundle matches its source.");
