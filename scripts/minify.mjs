import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
for (const name of readdirSync(dist)) {
  if (!name.endsWith(".js")) continue;
  const path = join(dist, name);
  const source = readFileSync(path, "utf8");
  const { code } = transformSync(source, {
    loader: "js",
    minify: true,
    target: "es2021",
    legalComments: "none",
  });
  writeFileSync(path, code);
}
