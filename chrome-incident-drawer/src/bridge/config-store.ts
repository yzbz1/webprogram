import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface IncidentDrawerConfig {
  excelPath: string
  preferredSheet?: string
}

export function resolveDefaultSamplePath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const dshSiblingSample = resolve(here, '../../dsh-plugin-incident-drawer/sample/incidents.xlsx')
  if (existsSync(dshSiblingSample)) {
    return dshSiblingSample
  }
  return resolve(here, '../sample/incidents.xlsx')
}

export function resolveConfigFilePath(): string {
  if (process.env.DSH_INCIDENT_DRAWER_CONFIG) {
    return resolve(process.env.DSH_INCIDENT_DRAWER_CONFIG)
  }
  const dshHome = process.env.DSH_HOME || join(os.homedir(), '.dsh')
  return join(dshHome, 'incident-drawer-config.json')
}

export class ConfigStore {
  private memoryFallback: IncidentDrawerConfig | null = null

  constructor(
    private readonly initialExcelPath?: string,
    private readonly configFilePath: string = resolveConfigFilePath(),
  ) {}

  /** Always read fresh from disk so DSH and Chrome stay synchronized on the same config file. */
  read(): IncidentDrawerConfig {
    try {
      if (existsSync(this.configFilePath)) {
        const raw = JSON.parse(readFileSync(this.configFilePath, 'utf8')) as Partial<IncidentDrawerConfig>
        if (typeof raw.excelPath === 'string' && raw.excelPath.trim() !== '') {
          const loaded: IncidentDrawerConfig = {
            excelPath: raw.excelPath.trim(),
            ...(typeof raw.preferredSheet === 'string' && raw.preferredSheet.trim() !== ''
              ? { preferredSheet: raw.preferredSheet.trim() }
              : {}),
          }
          this.memoryFallback = loaded
          return loaded
        }
      }
    } catch {
      // Fall back to memory/default if unreadable.
    }
    if (this.memoryFallback !== null) {
      return { ...this.memoryFallback }
    }
    const fallback: IncidentDrawerConfig = {
      excelPath: this.initialExcelPath?.trim() || resolveDefaultSamplePath(),
    }
    this.memoryFallback = fallback
    return { ...fallback }
  }

  write(next: IncidentDrawerConfig): { persisted: boolean; config: IncidentDrawerConfig } {
    const clean: IncidentDrawerConfig = {
      excelPath: resolve(next.excelPath.trim()),
      ...(next.preferredSheet && next.preferredSheet.trim() !== ''
        ? { preferredSheet: next.preferredSheet.trim() }
        : {}),
    }
    this.memoryFallback = clean
    try {
      mkdirSync(dirname(this.configFilePath), { recursive: true })
      writeFileSync(this.configFilePath, JSON.stringify(clean, null, 2) + '\n', 'utf8')
      return { persisted: true, config: { ...clean } }
    } catch {
      return { persisted: false, config: { ...clean } }
    }
  }
}
