import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ts = createRequire(import.meta.url)('typescript')
const stubDir = dirname(fileURLToPath(import.meta.url))
const stubs = {
  'server-only': pathToFileURL(join(stubDir, 'stubs/server-only.mjs')).href,
  'next/headers': pathToFileURL(join(stubDir, 'stubs/next-headers.mjs')).href,
  'next/navigation': pathToFileURL(join(stubDir, 'stubs/next-navigation.mjs')).href
}

function transpile (source, filename) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowImportingTsExtensions: true
    },
    fileName: filename
  }).outputText
}

function localFile (parentURL, specifier) {
  return join(dirname(fileURLToPath(parentURL)), specifier)
}

export async function resolve (specifier, context, nextResolve) {
  if (stubs[specifier]) return { url: stubs[specifier], shortCircuit: true }
  if (context.parentURL && (specifier.startsWith('.') || specifier.startsWith('/'))) {
    const base = localFile(context.parentURL, specifier)
    const candidates = extname(base) ? [base] : ['.ts', '.tsx', '.js', '.mjs'].map((ext) => base + ext)
    for (const file of candidates) {
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true }
    }
  }
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export default {};', shortCircuit: true }
    }
    throw error
  }
}

export async function load (url, context, nextLoad) {
  if (url.startsWith('data:')) {
    return { format: 'module', source: 'export default {};', shortCircuit: true }
  }
  if (!url.startsWith('file:')) return nextLoad(url, context)
  const file = fileURLToPath(url)
  if (file.endsWith('.tsx')) {
    return {
      format: 'module',
      source: transpile(readFileSync(file, 'utf8'), file),
      shortCircuit: true
    }
  }
  return nextLoad(url, context)
}