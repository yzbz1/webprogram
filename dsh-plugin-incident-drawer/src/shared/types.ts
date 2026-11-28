/** Shared RPC contracts for dsh-plugin-incident-drawer (browser-safe). */

export const API_ROUTE_PATH = '/api/incident-drawer' as const
export const API_CLIENT_ROUTE = 'api/incident-drawer' as const

export interface IncidentRow {
  /** 1-based Excel row number (data starts at row 2). */
  readonly rowNumber: number
  /** Column 1 display text (read-only). */
  readonly idText: string
  /** Extracted http(s) hyperlink from Column 1, or null if absent/invalid. */
  readonly hyperlink: string | null
  /** Editable values for Columns 2..N. */
  readonly cells: readonly string[]
}

export interface DrawerSnapshot {
  readonly excelPath: string
  readonly exists: boolean
  readonly sheets: readonly string[]
  readonly activeSheet: string | null
  readonly todaySheetName: string
  readonly matchedToday: boolean
  readonly headers: readonly string[]
  readonly rows: readonly IncidentRow[]
  readonly version: string | null
  readonly totalDataRows: number
  readonly categoryOptions?: Readonly<Record<string, readonly string[]>>
  readonly error?: string
}

export interface StatusCheckResult {
  readonly exists: boolean
  readonly stale: boolean
  readonly currentVersion: string | null
  readonly sheets?: readonly string[]
  readonly error?: string
}

export interface CellEdit {
  readonly rowNumber: number
  /** 1-based Excel column index (must be 2..6). */
  readonly colIndex: number
  readonly value: string
}

export interface SaveResult {
  readonly saved: boolean
  readonly version: string | null
  readonly conflict?: boolean
  readonly currentVersion?: string | null
  readonly locked?: boolean
  readonly error?: string
}

export interface LoadRequest {
  readonly sheetName?: string
}

export interface StatusCheckRequest {
  readonly knownVersion: string | null
}

export interface SaveCellRequest {
  readonly sheetName: string
  readonly rowNumber: number
  readonly colIndex: number
  readonly value: string
  readonly expectedVersion: string | null
  readonly forceOverwrite?: boolean
}

export interface SaveBatchRequest {
  readonly sheetName: string
  readonly edits: readonly CellEdit[]
  readonly expectedVersion: string | null
  readonly forceOverwrite?: boolean
}

export interface SetConfigRequest {
  readonly excelPath: string
  readonly preferredSheet?: string
}

export interface CreateSampleRequest {
  readonly excelPath?: string
}
