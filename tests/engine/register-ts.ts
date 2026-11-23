import { existsSync } from "node:fs"
import { registerHooks } from "node:module"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      extname(specifier) === "" &&
      context.parentURL !== undefined &&
      context.parentURL.startsWith("file:")
    ) {
      const baseDir = dirname(fileURLToPath(context.parentURL))
      const candidate = resolve(baseDir, `${specifier}.ts`)
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context)
      }
    }
    return nextResolve(specifier, context)
  },
})
