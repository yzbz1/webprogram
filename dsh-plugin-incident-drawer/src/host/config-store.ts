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
  private memoryConfig: IncidentDrawerConfig | null = null

  constructor(
    private readonly initialExcelPath?: string,
    private readonly configFilePath: string = resolveConfigFilePath(),
  ) {}

  read(): IncidentDrawerConfig {
    if (this.memoryConfig !== null) {
      return { ...this.memoryConfig }
    }
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
          this.memoryConfig = loaded
          return { ...loaded }
        }
      }
    } catch {
      // Fall back to default config if file is unreadable or malformed.
    }
    const fallback: IncidentDrawerConfig = {
      excelPath: this.initialExcelPath?.trim() || resolveDefaultSamplePath(),
    }
    this.memoryConfig = fallback
    return { ...fallback }
  }

  write(next: IncidentDrawerConfig): { persisted: boolean; config: IncidentDrawerConfig } {
    const clean: IncidentDrawerConfig = {
      excelPath: resolve(next.excelPath.trim()),
      ...(next.preferredSheet && next.preferredSheet.trim() !== ''
        ? { preferredSheet: next.preferredSheet.trim() }
        : {}),
    }
    this.memoryConfig = clean
    try {
      mkdirSync(dirname(this.configFilePath), { recursive: true })
      writeFileSync(this.configFilePath, JSON.stringify(clean, null, 2) + '\n', 'utf8')
      return { persisted: true, config: { ...clean } }
    } catch {
      return { persisted: false, config: { ...clean } }
    }
  }
}
