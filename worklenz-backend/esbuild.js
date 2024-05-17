/* eslint-disable @typescript-eslint/no-var-requires */

// still working on this...

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

function getTsFiles(directoryPath) {
  const files = fs.readdirSync(directoryPath);

  let tsFiles = [];

  files.forEach(file => {
    const filePath = path.join(directoryPath, file);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isFile() && path.extname(file) === ".ts") {
      tsFiles.push(filePath);
    } else if (fileStat.isDirectory()) {
      const subdirectoryTsFiles = getTsFiles(filePath);
      tsFiles = tsFiles.concat(subdirectoryTsFiles);
    }
  });

  return tsFiles;
}

esbuild.build({
  entryPoints: getTsFiles("src"),
  platform: "node",
  minify: false,
  target: "esnext",
  format: "cjs",
  tsconfig: "tsconfig.prod.json",
  outdir: "build",
  logLevel: "debug"
});
