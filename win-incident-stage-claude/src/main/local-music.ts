import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { extname, join, parse, resolve } from 'node:path'
import type { LocalMusicLibrary, LocalTrackInfo } from '../shared/types.ts'

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.webm',
])

const COVER_CANDIDATES = [
  'cover.jpg',
  'cover.jpeg',
  'cover.png',
  'cover.webp',
  'folder.jpg',
  'folder.jpeg',
  'folder.png',
  'album.jpg',
  'album.png',
]

const MAX_FOLDER_COVER_BYTES = 1_500_000
const MAX_ID3_HEADER_READ = 524_288

function parseTrackDisplay(fileName: string): { title: string; artist: string } {
  const base = parse(fileName).name.trim()
  const dashIdx = base.indexOf(' - ')
  if (dashIdx > 0 && dashIdx < base.length - 3) {
    return {
      artist: base.slice(0, dashIdx).trim(),
      title: base.slice(dashIdx + 3).trim(),
    }
  }
  return { title: base || fileName, artist: '' }
}

function findFolderCoverDataUrl(folderPath: string, entriesLower: Map<string, string>): string | null {
  for (const candidate of COVER_CANDIDATES) {
    const actualName = entriesLower.get(candidate)
    if (!actualName) continue
    try {
      const fullPath = join(folderPath, actualName)
      const st = statSync(fullPath)
      if (!st.isFile() || st.size <= 0 || st.size > MAX_FOLDER_COVER_BYTES) continue
      const buf = readFileSync(fullPath)
      const ext = extname(actualName).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      // Ignore unreadable cover file
    }
  }
  return null
}

function readSynchsafeInt(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  )
}

function readUInt32BE(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] << 24) >>> 0) +
    (buf[offset + 1] << 16) +
    (buf[offset + 2] << 8) +
    buf[offset + 3]
  )
}

/** Lightweight zero-dependency ID3v2 APIC extractor (reads at most first 512KB of MP3). */
function extractMp3CoverDataUrl(filePath: string): string | null {
  let fd: number | null = null
  try {
    fd = openSync(filePath, 'r')
    const head = Buffer.alloc(10)
    if (readSync(fd, head, 0, 10, 0) < 10) return null
    if (head.toString('ascii', 0, 3) !== 'ID3') return null

    const version = head[3]
    if (version !== 3 && version !== 4) return null
    const tagSize = readSynchsafeInt(head, 6)
    const readLen = Math.min(tagSize, MAX_ID3_HEADER_READ)
    if (readLen <= 10) return null

    const tagBuf = Buffer.alloc(readLen)
    const actual = readSync(fd, tagBuf, 0, readLen, 10)
    let pos = 0

    // Skip extended header if present
    if ((head[5] & 0x40) !== 0 && actual >= 4) {
      const extSize = version === 4 ? readSynchsafeInt(tagBuf, 0) : readUInt32BE(tagBuf, 0)
      pos = Math.min(actual, extSize + (version === 4 ? 0 : 4))
    }

    while (pos + 10 <= actual) {
      const frameId = tagBuf.toString('ascii', pos, pos + 4)
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break
      const frameSize = version === 4 ? readSynchsafeInt(tagBuf, pos + 4) : readUInt32BE(tagBuf, pos + 4)
      const dataStart = pos + 10
      const dataEnd = dataStart + frameSize
      if (frameSize <= 0 || dataEnd > actual) break

      if (frameId === 'APIC') {
        const enc = tagBuf[dataStart]
        let cursor = dataStart + 1
        const mimeEnd = tagBuf.indexOf(0, cursor)
        if (mimeEnd === -1 || mimeEnd >= dataEnd) return null
        const mimeRaw = tagBuf.toString('ascii', cursor, mimeEnd).toLowerCase()
        const mime = mimeRaw.includes('png') ? 'image/png' : 'image/jpeg'
        cursor = mimeEnd + 2 // skip NUL + picture type byte

        // Skip description string (UTF-16 uses 2-byte NUL terminator)
        if (enc === 1 || enc === 2) {
          while (cursor + 1 < dataEnd) {
            if (tagBuf[cursor] === 0 && tagBuf[cursor + 1] === 0) {
              cursor += 2
              break
            }
            cursor += 2
          }
        } else {
          const descEnd = tagBuf.indexOf(0, cursor)
          if (descEnd === -1 || descEnd >= dataEnd) return null
          cursor = descEnd + 1
        }

        if (cursor < dataEnd) {
          const imgBytes = tagBuf.subarray(cursor, dataEnd)
          if (imgBytes.length > 32 && imgBytes.length <= MAX_FOLDER_COVER_BYTES) {
            return `data:${mime};base64,${imgBytes.toString('base64')}`
          }
        }
        return null
      }

      pos = dataEnd
    }
    return null
  } catch {
    return null
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        // Ignore close errors
      }
    }
  }
}

export class LocalMusicStore {
  private folderPath = ''
  private filePaths: string[] = []
  private library: LocalMusicLibrary = { folderPath: '', tracks: [] }
  private version = 1

  loadFolder(rawFolderPath: string): LocalMusicLibrary {
    const trimmed = typeof rawFolderPath === 'string' ? rawFolderPath.trim() : ''
    if (!trimmed) {
      this.folderPath = ''
      this.filePaths = []
      this.library = { folderPath: '', tracks: [] }
      return this.library
    }

    const absFolder = resolve(trimmed)
    this.folderPath = absFolder
    this.version += 1

    if (!existsSync(absFolder)) {
      this.filePaths = []
      this.library = { folderPath: absFolder, tracks: [] }
      return this.library
    }

    try {
      const dirents = readdirSync(absFolder, { withFileTypes: true })
      const entriesLower = new Map<string, string>()
      const audioNames: string[] = []

      for (const entry of dirents) {
        if (!entry.isFile()) continue
        entriesLower.set(entry.name.toLowerCase(), entry.name)
        if (AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          audioNames.push(entry.name)
        }
      }

      audioNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      const folderCover = findFolderCoverDataUrl(absFolder, entriesLower)
      const nextPaths: string[] = []
      const nextTracks: LocalTrackInfo[] = []

      for (let i = 0; i < audioNames.length; i += 1) {
        const fileName = audioNames[i]
        const fullPath = join(absFolder, fileName)
        nextPaths.push(fullPath)
        const { title, artist } = parseTrackDisplay(fileName)
        const coverDataUrl =
          extname(fileName).toLowerCase() === '.mp3'
            ? extractMp3CoverDataUrl(fullPath) ?? folderCover
            : folderCover

        nextTracks.push({
          index: i,
          fileName,
          title,
          artist,
          streamUrl: `stage-audio://track/${i}?v=${this.version}`,
          coverDataUrl,
        })
      }

      this.filePaths = nextPaths
      this.library = { folderPath: absFolder, tracks: nextTracks }
      return this.library
    } catch {
      this.filePaths = []
      this.library = { folderPath: absFolder, tracks: [] }
      return this.library
    }
  }

  getLibrary(): LocalMusicLibrary {
    return this.library
  }

  resolveTrackPath(index: number): string | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.filePaths.length) {
      return null
    }
    return this.filePaths[index]
  }
}
