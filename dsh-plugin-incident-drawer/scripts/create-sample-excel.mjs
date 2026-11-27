import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { createSampleWorkbook } = require(resolve(root, 'lib/excel-store.cjs'))

const targetPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(root, 'sample/incidents.xlsx')

const out = await createSampleWorkbook(targetPath)
console.log(`Created sample Excel workbook: ${out}`)
