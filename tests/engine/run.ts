import { dirname, resolve } from "node:path"
import { run } from "node:test"
import { spec } from "node:test/reporters"
import { fileURLToPath, pathToFileURL } from "node:url"

const testsDir = dirname(fileURLToPath(import.meta.url))
const hookUrl = pathToFileURL(resolve(testsDir, "register-ts.ts")).href
const testFile = resolve(testsDir, "engine.test.ts")

const stream = run({
  files: [testFile],
  execArgv: ["--import", hookUrl],
})

stream.on("test:fail", () => {
  process.exitCode = 1
})

stream.compose(spec).pipe(process.stdout)
