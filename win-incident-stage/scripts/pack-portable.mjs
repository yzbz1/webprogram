import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const electronDist = resolve(root, 'node_modules/electron/dist')
const outDir = resolve(root, 'release/win-incident-stage-portable')

if (!existsSync(electronDist)) {
  throw new Error(`Cannot find electron/dist at ${electronDist}. Run npm install first.`)
}

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true })
}
mkdirSync(outDir, { recursive: true })

// Copy Electron runtime binary + resources
cpSync(electronDist, outDir, { recursive: true })

// Rename electron.exe -> IncidentStage.exe
const electronExe = join(outDir, 'electron.exe')
const targetExe = join(outDir, 'IncidentStage.exe')
if (existsSync(electronExe)) {
  renameSync(electronExe, targetExe)
}

// Remove default_app.asar so Electron boots resources/app directly
const defaultAsar = join(outDir, 'resources', 'default_app.asar')
if (existsSync(defaultAsar)) {
  rmSync(defaultAsar, { force: true })
}

// Copy minimal runtime app payload + Win32 koffi FFI runtime
const appDir = join(outDir, 'resources', 'app')
mkdirSync(appDir, { recursive: true })

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const minimalPkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  description: rootPkg.description,
  main: 'dist-app/main.cjs',
  ...(rootPkg.dependencies?.koffi ? { dependencies: { koffi: rootPkg.dependencies.koffi } } : {}),
}
writeFileSync(join(appDir, 'package.json'), JSON.stringify(minimalPkg, null, 2) + '\n', 'utf8')

cpSync(resolve(root, 'dist-app'), join(appDir, 'dist-app'), { recursive: true })
cpSync(resolve(root, 'assets'), join(appDir, 'assets'), { recursive: true })
cpSync(resolve(root, 'sample'), join(appDir, 'sample'), { recursive: true })
if (existsSync(resolve(root, 'README.md'))) {
  cpSync(resolve(root, 'README.md'), join(appDir, 'README.md'))
}

// Copy minimal koffi + Windows x64 prebuilt native binary (keeping package compact & 100% offline-portable)
const koffiSrc = resolve(root, 'node_modules/koffi')
const koffiDst = join(appDir, 'node_modules/koffi')
if (existsSync(koffiSrc)) {
  mkdirSync(koffiDst, { recursive: true })
  for (const rel of [
    'package.json',
    'index.cjs',
    'index.js',
    'indirect.cjs',
    'indirect.js',
    'src/koffi/index.cjs',
    'src/koffi/index.js',
    'src/koffi/indirect.cjs',
    'src/koffi/indirect.js',
    'src/koffi/src/static.cjs',
    'src/koffi/src/static.js',
    'src/koffi/src/trampolines.cjs',
  ]) {
    const srcFile = join(koffiSrc, rel)
    if (existsSync(srcFile)) {
      const dstFile = join(koffiDst, rel)
      mkdirSync(dirname(dstFile), { recursive: true })
      cpSync(srcFile, dstFile)
    }
  }
}

const koromixWin64Src = resolve(root, 'node_modules/@koromix/koffi-win32-x64')
const koromixWin64Dst = join(appDir, 'node_modules/@koromix/koffi-win32-x64')
if (existsSync(koromixWin64Src)) {
  cpSync(koromixWin64Src, koromixWin64Dst, { recursive: true })
}

console.log(`Packed standalone Windows portable app -> ${targetExe}`)
