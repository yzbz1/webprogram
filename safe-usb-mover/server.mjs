import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  abortActiveMtpTransfer,
  browseFolder,
  createDirectory,
  getMtpStorageInfo,
  listMtpDevices,
  parseMtpPath,
  runPowerShellUtf8,
  transferFileToMtp,
} from './mtpHelper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3005);
const DATA_DIR = process.env.SAFEMOVER_DATA_DIR || __dirname;
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const AUDIT_LOG_PATH = path.join(DATA_DIR, 'transfer.log.jsonl');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PART_SUFFIX = '.safemove.part';

const IGNORE_SUFFIXES = [
  '.part',
  '.safemove.part',
  '.tmp',
  '.temp',
  '.crdownload',
  '.downloading',
  '.aria2',
  '.!qb',
];

/** Default anti-disconnect configuration tailored for aging USB / external drives */
const DEFAULT_CONFIG = {
  sourceDir: '',
  targetDir: '',
  targetVolumeLabel: '',
  // Preset: 'safe' | 'balanced' | 'fast' | 'custom'
  preset: 'safe',
  // Speed limit in MB/s (0 = unlimited). 10 MB/s greatly prevents USB power drop & controller overheating
  speedLimitMBs: 10,
  // Chunk size in KB (512 KB smooths burst I/O)
  chunkSizeKB: 512,
  // Cooldown pause after each file (ms)
  cooldownPerFileMs: 1500,
  // Deep thermal rest every N MB written
  batchCooldownMB: 300,
  batchCooldownSec: 5,
  // Always leave at least N MB free on target drive to avoid FAT32/exFAT corruption
  reserveSpaceMB: 1024,
  // Poll interval when waiting for space or reconnect (seconds)
  pollIntervalSec: 4,
  // Read-back SHA-256 verification before deleting source (drive targets)
  verifySha256: true,
  // Optional read-back SHA-256 verification for MTP phone targets (doubles USB traffic when true)
  mtpReadbackVerify: false,
  // File selection strategy: 'oldest' | 'smallest' | 'largest' | 'name'
  sortOrder: 'oldest',
  // Smart fit: if next file is larger than free space, try smaller files that fit!
  smartFit: true,
  // What to do with source after 100% verified copy: 'delete' | 'recycle' | 'keep'
  deleteMode: 'delete',
  // Clean up emptied subdirectories inside sourceDir (never deletes sourceDir itself)
  cleanEmptyDirs: true,
  // Preserve relative folder tree inside targetDir
  preserveTree: true,
  // Skip files modified within last N seconds (avoid moving files currently being written)
  minFileAgeSec: 4,
};

let config = { ...DEFAULT_CONFIG };

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('[Config] Failed to read config.json:', err.message);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Config] Failed to save config.json:', err.message);
  }
}

function appendAuditLog(entry) {
  try {
    fs.appendFileSync(
      AUDIT_LOG_PATH,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n',
      'utf8'
    );
  } catch {
    // Ignore log error
  }
}

/**
 * Runtime State broadcasted via SSE to Web UI
 */
const state = {
  // 'idle' | 'scanning' | 'waiting_space' | 'copying' | 'syncing' | 'verifying' | 'cooldown' | 'disconnected' | 'paused'
  phase: 'idle',
  running: false,
  stopPending: false,
  paused: false,
  statusText: '已就绪，请配置源文件夹与移动设备目录后启动',
  currentFile: null, // { relPath, size, copiedBytes, verifiedBytes, speedMBs, percent, phase }
  cooldownRemainingSec: 0,
  sourceStats: {
    pendingCount: 0,
    pendingBytes: 0,
    smallestBytes: 0,
  },
  targetDrive: null, // { letter, label, driveType, totalBytes, freeBytes, online }
  sessionStats: {
    movedFiles: 0,
    movedBytes: 0,
    verifyFailures: 0,
    disconnectRecoveries: 0,
    skippedFiles: 0,
    startedAt: null,
  },
  logs: [],
};

// Track already-copied files in 'keep' (dry-run) mode so we don't re-copy endlessly
const keepModeDoneSet = new Set();
// SSE subscribers
const sseClients = new Set();

function pushLog(level, msg) {
  const entry = {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    level, // 'info' | 'ok' | 'warn' | 'err'
    msg,
  };
  state.logs.unshift(entry);
  if (state.logs.length > 200) state.logs.length = 200;
  broadcastState();
}

let lastBroadcast = 0;
let broadcastTimer = null;

function broadcastState(force = false) {
  const now = Date.now();
  if (!force && now - lastBroadcast < 120) {
    if (!broadcastTimer) {
      broadcastTimer = setTimeout(() => {
        broadcastTimer = null;
        broadcastState(true);
      }, 130);
    }
    return;
  }
  lastBroadcast = now;
  const payload = `data: ${JSON.stringify({ state, config })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Query Windows Logical Disks via PowerShell CIM (DriveType 2 = Removable, 3 = Local/USB HDD)
 */
async function queryLogicalDisks() {
  const psCmd =
    'Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,3 } | Select-Object DeviceID, VolumeName, DriveType, Size, FreeSpace, FileSystem | ConvertTo-Json -Compress';
  try {
    const stdout = await runPowerShellUtf8(psCmd, { timeout: 6000 });
    if (!stdout.trim()) return [];
    const parsed = JSON.parse(stdout.trim());
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr
      .filter((d) => d && d.DeviceID)
      .map((d) => ({
        isMtp: false,
        letter: String(d.DeviceID).toUpperCase(),
        label: String(d.VolumeName || '').trim(),
        driveType: Number(d.DriveType),
        typeName: Number(d.DriveType) === 2 ? '可移动存储 (U盘/SD卡)' : '本地/外置硬盘',
        fileSystem: String(d.FileSystem || ''),
        totalBytes: Number(d.Size || 0),
        freeBytes: Number(d.FreeSpace || 0),
        online: true,
      }))
      .sort((a, b) => {
        if (a.driveType !== b.driveType) return a.driveType === 2 ? -1 : 1;
        return a.letter.localeCompare(b.letter);
      });
  } catch {
    return [];
  }
}

/**
 * Query both Windows MTP portable devices (phones) and logical disks.
 */
async function queryWindowsDrives() {
  const [mtpListRaw, diskList] = await Promise.all([listMtpDevices(), queryLogicalDisks()]);
  const mtpList = mtpListRaw.map((d) => ({ ...d }));
  const activeTd = state.targetDrive;
  if (activeTd?.isMtp && activeTd.online) {
    const match = mtpList.find(
      (m) => m.deviceName === activeTd.deviceName && (!activeTd.storageName || m.storageName === activeTd.storageName)
    );
    if (match) {
      if (Number.isFinite(activeTd.freeBytes)) match.freeBytes = activeTd.freeBytes;
      if (Number.isFinite(activeTd.totalBytes) && activeTd.totalBytes > 0) match.totalBytes = activeTd.totalBytes;
      if (state.running) match.busy = true;
    } else if (state.running) {
      const stName = activeTd.storageName || '内部共享存储空间';
      mtpList.unshift({
        id: `mtp:${activeTd.deviceName}:${stName}`,
        isMtp: true,
        busy: true,
        letter: 'MTP',
        deviceName: activeTd.deviceName,
        storageName: stName,
        label: activeTd.label || `${activeTd.deviceName} · ${stName}`,
        displayPath: `此电脑\\${activeTd.deviceName}\\${stName}`,
        defaultTargetPath: config.targetDir || `此电脑\\${activeTd.deviceName}\\${stName}`,
        driveType: 10,
        typeName: 'MTP 便携设备',
        fileSystem: 'MTP',
        totalBytes: Number(activeTd.totalBytes || 0),
        freeBytes: Number(activeTd.freeBytes || 0),
        online: true,
      });
    }
  }
  return [...mtpList, ...diskList];
}

let pickInFlight = false;

/** Native Windows Folder Browser Dialog via PowerShell (with concurrency lock & foreground focus) */
async function pickWindowsFolder(initialDir = '') {
  if (pickInFlight) return null;
  pickInFlight = true;
  const safeInit = String(initialDir || '').replace(/'/g, "''");
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = '选择文件夹'
$dlg.ShowNewFolderButton = $true
if ('${safeInit}' -and (Test-Path -LiteralPath '${safeInit}')) { $dlg.SelectedPath = '${safeInit}' }
$owner = New-Object System.Windows.Forms.Form
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.Show()
$owner.Activate()
$owner.Hide()
$res = $dlg.ShowDialog($owner)
$owner.Dispose()
if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.SelectedPath }
`;
  try {
    const stdout = await runPowerShellUtf8(script, { sta: true, timeout: 120000 });
    return stdout.trim() || null;
  } catch {
    return null;
  } finally {
    pickInFlight = false;
  }
}

/** Send file to Windows Recycle Bin safely */
async function sendToRecycleBin(filePath) {
  const escaped = filePath.replace(/'/g, "''");
  const script = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;
  await runPowerShellUtf8(script, { timeout: 15000 });
}

function getDriveLetterFromPath(p) {
  const m = String(p || '').trim().match(/^([A-Za-z]:)/);
  return m ? m[1].toUpperCase() : '';
}

let cachedDrives = [];
let cachedDrivesAt = 0;

async function getCachedDrives(force = false) {
  if (!force && Date.now() - cachedDrivesAt < 5000 && cachedDrives.length > 0) {
    return cachedDrives;
  }
  const list = await queryLogicalDisks();
  if (list.length > 0) {
    cachedDrives = list;
    cachedDrivesAt = Date.now();
  }
  return cachedDrives;
}

async function getTargetDriveInfo() {
  const targetDir = config.targetDir.trim();
  if (!targetDir) return null;

  // MTP device target (e.g. 此电脑\Pixel\内部共享存储空间\DCIM\Camera)
  const mtpTarget = parseMtpPath(targetDir);
  if (mtpTarget) {
    return await getMtpStorageInfo(mtpTarget);
  }

  const letter = getDriveLetterFromPath(targetDir);
  if (!letter) return null;

  const probePaths = [targetDir, letter + '\\'];
  let statfs = null;
  for (const p of probePaths) {
    try {
      statfs = await fsp.statfs(p);
      break;
    } catch {
      // Try next probe path
    }
  }

  // Enrich with WMI label/type (non-blocking if unavailable)
  const drives = await getCachedDrives(!statfs);
  let meta = drives.find((d) => d.letter === letter);

  // If direct probe failed (drive disconnected or letter shifted), try matching by Volume Label!
  if (!statfs && config.targetVolumeLabel) {
    const byLabel = drives.find(
      (d) => d.label && d.label.toLowerCase() === config.targetVolumeLabel.toLowerCase()
    );
    if (byLabel) {
      const oldLetter = letter;
      config.targetDir = byLabel.letter + targetDir.slice(2);
      saveConfig();
      pushLog('warn', `检测到卷标「${byLabel.label}」重新挂载为 ${byLabel.letter}（原 ${oldLetter}），已自动切换目标路径！`);
      meta = byLabel;
      try {
        statfs = await fsp.statfs(byLabel.letter + '\\');
      } catch {
        statfs = null;
      }
    }
  }

  if (!statfs) {
    return {
      letter: meta?.letter || letter,
      label: meta?.label || config.targetVolumeLabel || '',
      online: false,
      totalBytes: 0,
      freeBytes: 0,
    };
  }

  const liveFree = Number(statfs.bavail) * Number(statfs.bsize);
  const liveTotal = Number(statfs.blocks) * Number(statfs.bsize);
  return {
    letter: meta?.letter || letter,
    label: meta?.label || config.targetVolumeLabel || '',
    driveType: meta?.driveType || 2,
    typeName: meta?.typeName || '移动存储',
    fileSystem: meta?.fileSystem || '',
    freeBytes: Number.isFinite(liveFree) && liveFree >= 0 ? liveFree : meta?.freeBytes || 0,
    totalBytes: Number.isFinite(liveTotal) && liveTotal > 0 ? liveTotal : meta?.totalBytes || 0,
    online: true,
  };
}

/** Recursively list eligible files inside sourceDir */
async function scanSourceFiles(sourceDir) {
  const results = [];
  const nowMs = Date.now();
  const minAgeMs = Math.max(0, Number(config.minFileAgeSec || 0)) * 1000;

  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Never walk into targetDir if user mistakenly nested target inside source!
        if (
          config.targetDir &&
          path.resolve(full).toLowerCase() === path.resolve(config.targetDir).toLowerCase()
        ) {
          continue;
        }
        await walk(full);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (IGNORE_SUFFIXES.some((s) => lower.endsWith(s))) continue;
        if (config.deleteMode === 'keep' && keepModeDoneSet.has(full)) continue;
        try {
          const st = await fsp.stat(full);
          if (nowMs - st.mtimeMs < minAgeMs) continue; // Still being written
          results.push({
            fullPath: full,
            relPath: path.relative(sourceDir, full),
            size: st.size,
            mtimeMs: st.mtimeMs,
          });
        } catch {
          // File disappeared mid-scan
        }
      }
    }
  }

  await walk(sourceDir);

  if (config.sortOrder === 'smallest') {
    results.sort((a, b) => a.size - b.size || a.mtimeMs - b.mtimeMs);
  } else if (config.sortOrder === 'largest') {
    results.sort((a, b) => b.size - a.size || a.mtimeMs - b.mtimeMs);
  } else if (config.sortOrder === 'name') {
    results.sort((a, b) => a.relPath.localeCompare(b.relPath));
  } else {
    // 'oldest' first (FIFO queue)
    results.sort((a, b) => a.mtimeMs - b.mtimeMs);
  }

  return results;
}

/** Clean up stale .safemove.part files on target after a disconnect */
async function cleanupStalePartFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return 0;
  let cleaned = 0;
  async function walk(d) {
    let entries;
    try {
      entries = await fsp.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.endsWith(PART_SUFFIX)) {
        try {
          await fsp.unlink(full);
          cleaned++;
        } catch {
          // Ignore
        }
      }
    }
  }
  await walk(dir);
  return cleaned;
}

/** Clean up emptied parent directories inside sourceDir without touching sourceDir itself */
async function cleanEmptyParentDirs(fileFullPath, sourceRoot) {
  const rootNorm = path.resolve(sourceRoot).toLowerCase();
  let dir = path.dirname(path.resolve(fileFullPath));
  while (dir.toLowerCase() !== rootNorm && dir.toLowerCase().startsWith(rootNorm + path.sep)) {
    try {
      const entries = await fsp.readdir(dir);
      if (entries.length === 0) {
        await fsp.rmdir(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

/** Compute SHA-256 by streaming back from disk (used for read-back integrity verification!) */
async function computeFileSha256(filePath, totalSize, onProgress) {
  const hash = crypto.createHash('sha256');
  const chunkBytes = 1024 * 1024;
  const buf = Buffer.allocUnsafe(chunkBytes);
  let fd;
  let readTotal = 0;
  try {
    fd = await fsp.open(filePath, 'r');
    while (true) {
      if (stopRequested) throw new Error('ABORTED');
      const { bytesRead } = await fd.read(buf, 0, chunkBytes, null);
      if (bytesRead === 0) break;
      hash.update(bytesRead === chunkBytes ? buf : buf.subarray(0, bytesRead));
      readTotal += bytesRead;
      onProgress?.(readTotal, totalSize);
    }
    return hash.digest('hex');
  } finally {
    if (fd) await fd.close().catch(() => {});
  }
}

function isLikelyDisconnectError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  if (
    msg.includes('MTP_DISCONNECTED') ||
    msg.includes('MTP_VERIFY_TIMEOUT') ||
    msg.includes('MTP_READBACK_TIMEOUT')
  ) {
    return true;
  }
  return ['EIO', 'ENODEV', 'ENOENT', 'EBUSY', 'EPERM', 'UNKNOWN', 'EINVAL', 'ENXIO'].includes(code);
}

/** Resolve non-colliding final destination path */
async function resolveFinalTargetPath(desiredPath, srcSize, srcHash) {
  if (!fs.existsSync(desiredPath)) return { path: desiredPath, alreadyIdentical: false };
  try {
    const st = await fsp.stat(desiredPath);
    if (st.size === srcSize && config.verifySha256) {
      const existingHash = await computeFileSha256(desiredPath, st.size);
      if (existingHash === srcHash) {
        return { path: desiredPath, alreadyIdentical: true };
      }
    }
  } catch {
    // Fall through to unique suffix
  }
  const dir = path.dirname(desiredPath);
  const ext = path.extname(desiredPath);
  const base = path.basename(desiredPath, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = path.join(dir, `${base}_${i}${ext}`);
    if (!fs.existsSync(candidate)) return { path: candidate, alreadyIdentical: false };
  }
  return { path: path.join(dir, `${base}_${Date.now()}${ext}`), alreadyIdentical: false };
}

/**
 * Atomic 5-Step Anti-Disconnect Transfer for ONE single file:
 * 1. Throttled chunked copy to .safemove.part while hashing source
 * 2. fsync() flush to physical media
 * 3. Read-back SHA-256 verification from removable drive
 * 4. Atomic rename .part -> final filename + post-rename stat check
 * 5. Delete / Recycle / Keep source ONLY AFTER 100% verification
 */
async function safeTransferOneFile(fileItem) {
  const mtpTarget = parseMtpPath(config.targetDir);
  if (mtpTarget) {
    state.phase = 'copying';
    state.statusText = `正在通过 MTP 安全写入手机：${mtpTarget.deviceName}`;
    state.currentFile = {
      relPath: fileItem.relPath,
      size: fileItem.size,
      copiedBytes: 0,
      verifiedBytes: 0,
      speedMBs: 0,
      percent: 0,
      elapsedSec: 0,
      transport: 'mtp',
      phase: 'copying',
    };
    broadcastState(true);

    const srcHash = config.mtpReadbackVerify
      ? await computeFileSha256(fileItem.fullPath, fileItem.size)
      : '';
    const relSubDirs = config.preserveTree
      ? path.dirname(fileItem.relPath).split(/[\\/]+/).filter((s) => s && s !== '.')
      : [];

    const mtpRes = await transferFileToMtp({
      srcFullPath: fileItem.fullPath,
      fileName: path.basename(fileItem.fullPath),
      fileSize: fileItem.size,
      mtpTarget,
      relSubDirs,
      verifyReadback: Boolean(config.mtpReadbackVerify),
      srcSha256: srcHash,
      onHeartbeat: (elapsedSec) => {
        if (!state.currentFile) return;
        state.currentFile.elapsedSec = elapsedSec;
        broadcastState();
      },
      onProgress: (bytes) => {
        if (!state.currentFile) return;
        state.currentFile.copiedBytes = bytes;
        state.currentFile.percent =
          fileItem.size > 0 ? Math.min(100, Math.round((bytes / fileItem.size) * 100)) : 100;
        broadcastState();
      },
      onPhaseChange: (p) => {
        if (!state.currentFile) return;
        state.phase = p;
        state.currentFile.phase = p;
        state.statusText =
          p === 'verifying'
            ? '正在从手机回拷校验 SHA-256...'
            : '正在通过 MTP 安全写入手机并核对 64 位字节长度...';
        broadcastState(true);
      },
    });

    if (config.deleteMode === 'delete') {
      await fsp.unlink(fileItem.fullPath);
      if (config.cleanEmptyDirs) {
        await cleanEmptyParentDirs(fileItem.fullPath, config.sourceDir);
      }
    } else if (config.deleteMode === 'recycle') {
      await sendToRecycleBin(fileItem.fullPath);
      if (config.cleanEmptyDirs) {
        await cleanEmptyParentDirs(fileItem.fullPath, config.sourceDir);
      }
    } else {
      keepModeDoneSet.add(fileItem.fullPath);
    }

    state.sessionStats.movedFiles++;
    state.sessionStats.movedBytes += fileItem.size;
    appendAuditLog({
      file: fileItem.relPath,
      size: fileItem.size,
      sha256: srcHash || 'mtp-size-verified',
      dest: mtpRes.destDisplayPath,
      deleteMode: config.deleteMode,
      transport: 'mtp',
    });

    const actionTag =
      config.deleteMode === 'delete'
        ? 'MTP 校验并删源'
        : config.deleteMode === 'recycle'
          ? 'MTP 校验并移回收站'
          : 'MTP 演练保留源';
    pushLog('ok', `完成：${fileItem.relPath} (${formatBytes(fileItem.size)}) · ${actionTag}`);
    return;
  }

  const targetBase = config.targetDir;
  const desiredDest = config.preserveTree
    ? path.join(targetBase, fileItem.relPath)
    : path.join(targetBase, path.basename(fileItem.fullPath));
  const destDir = path.dirname(desiredDest);
  const partPath = `${desiredDest}${PART_SUFFIX}`;

  await fsp.mkdir(destDir, { recursive: true });

  const chunkSize = Math.max(64, Math.min(4096, Number(config.chunkSizeKB || 512))) * 1024;
  const speedLimitBytesPerSec =
    Number(config.speedLimitMBs || 0) > 0 ? Number(config.speedLimitMBs) * 1024 * 1024 : 0;

  const srcHashObj = crypto.createHash('sha256');
  const buf = Buffer.allocUnsafe(chunkSize);
  let srcFd = null;
  let dstFd = null;
  let copied = 0;

  state.phase = 'copying';
  state.statusText = `正在平稳写入（限速 ${
    config.speedLimitMBs > 0 ? `${config.speedLimitMBs} MB/s` : '不限速'
  }）`;
  state.currentFile = {
    relPath: fileItem.relPath,
    size: fileItem.size,
    copiedBytes: 0,
    verifiedBytes: 0,
    speedMBs: 0,
    percent: 0,
    phase: 'copying',
  };
  broadcastState(true);

  const startTime = performance.now();
  let speedWindowStart = startTime;
  let speedWindowBytes = 0;

  try {
    srcFd = await fsp.open(fileItem.fullPath, 'r');
    dstFd = await fsp.open(partPath, 'w');

    while (true) {
      if (stopRequested) throw new Error('ABORTED');
      const { bytesRead } = await srcFd.read(buf, 0, chunkSize, null);
      if (bytesRead === 0) break;

      const slice = bytesRead === chunkSize ? buf : buf.subarray(0, bytesRead);
      srcHashObj.update(slice);

      let written = 0;
      while (written < bytesRead) {
        const res = await dstFd.write(slice, written, bytesRead - written);
        written += res.bytesWritten;
      }

      copied += bytesRead;
      speedWindowBytes += bytesRead;

      // Smooth token-bucket rate limiter to prevent USB current spike / thermal throttling
      if (speedLimitBytesPerSec > 0) {
        const expectedElapsedMs = (copied / speedLimitBytesPerSec) * 1000;
        const actualElapsedMs = performance.now() - startTime;
        if (expectedElapsedMs > actualElapsedMs + 8) {
          await sleep(Math.min(800, expectedElapsedMs - actualElapsedMs));
        }
      }

      const now = performance.now();
      if (now - speedWindowStart >= 250 || copied === fileItem.size) {
        const dtSec = Math.max(0.05, (now - speedWindowStart) / 1000);
        const speedMBs = Number((speedWindowBytes / 1024 / 1024 / dtSec).toFixed(2));
        state.currentFile.copiedBytes = copied;
        state.currentFile.speedMBs = speedMBs;
        state.currentFile.percent =
          fileItem.size > 0 ? Math.min(100, Math.round((copied / fileItem.size) * 100)) : 100;
        broadcastState();
        speedWindowStart = now;
        speedWindowBytes = 0;
      }
    }

    // Step 2: Explicit fsync to flush OS write cache onto physical flash/disk!
    state.phase = 'syncing';
    state.currentFile.phase = 'syncing';
    state.statusText = '正在 fsync 强制落盘，确保写入物理介质...';
    broadcastState(true);
    await dstFd.sync();
  } catch (err) {
    if (dstFd) await dstFd.close().catch(() => {});
    if (srcFd) await srcFd.close().catch(() => {});
    await fsp.unlink(partPath).catch(() => {});
    throw err;
  }

  await dstFd.close();
  await srcFd.close();

  const srcHash = srcHashObj.digest('hex');

  // Step 3: Verify size & read-back SHA-256 directly from the removable drive
  const partStat = await fsp.stat(partPath);
  if (partStat.size !== fileItem.size) {
    await fsp.unlink(partPath).catch(() => {});
    state.sessionStats.verifyFailures++;
    throw new Error(`VERIFY_MISMATCH: 文件大小不一致 (源 ${fileItem.size} vs 目标 ${partStat.size})`);
  }

  if (config.verifySha256) {
    state.phase = 'verifying';
    state.currentFile.phase = 'verifying';
    state.statusText = '正在从移动设备回读校验 SHA-256（确保无坏块假写入）...';
    broadcastState(true);

    const dstHash = await computeFileSha256(partPath, fileItem.size, (vBytes, total) => {
      if (state.currentFile) {
        state.currentFile.verifiedBytes = vBytes;
        state.currentFile.percent = total > 0 ? Math.round((vBytes / total) * 100) : 100;
        broadcastState();
      }
    });

    if (dstHash !== srcHash) {
      await fsp.unlink(partPath).catch(() => {});
      state.sessionStats.verifyFailures++;
      throw new Error(`VERIFY_MISMATCH: SHA-256 校验失败，已保留 PC 源文件！`);
    }
  }

  // Step 4: Atomic rename .safemove.part -> final destination
  const resolved = await resolveFinalTargetPath(desiredDest, fileItem.size, srcHash);
  let finalDest = resolved.path;

  if (resolved.alreadyIdentical) {
    await fsp.unlink(partPath).catch(() => {});
  } else {
    await fsp.rename(partPath, finalDest);
  }

  // Final paranoia check: confirm renamed target exists with exact byte length
  const finalStat = await fsp.stat(finalDest);
  if (finalStat.size !== fileItem.size) {
    throw new Error('POST_RENAME_STAT_FAILED');
  }

  // Step 5: ONLY NOW delete / recycle / keep PC source file
  if (config.deleteMode === 'delete') {
    await fsp.unlink(fileItem.fullPath);
    if (config.cleanEmptyDirs) {
      await cleanEmptyParentDirs(fileItem.fullPath, config.sourceDir);
    }
  } else if (config.deleteMode === 'recycle') {
    await sendToRecycleBin(fileItem.fullPath);
    if (config.cleanEmptyDirs) {
      await cleanEmptyParentDirs(fileItem.fullPath, config.sourceDir);
    }
  } else {
    keepModeDoneSet.add(fileItem.fullPath);
  }

  state.sessionStats.movedFiles++;
  state.sessionStats.movedBytes += fileItem.size;
  appendAuditLog({
    file: fileItem.relPath,
    size: fileItem.size,
    sha256: srcHash,
    dest: finalDest,
    deleteMode: config.deleteMode,
  });

  const actionTag =
    config.deleteMode === 'delete'
      ? '已校验并删源'
      : config.deleteMode === 'recycle'
        ? '已校验并移入回收站'
        : '已校验(演练保留源)';
  pushLog('ok', `完成：${fileItem.relPath} (${formatBytes(fileItem.size)}) · ${actionTag}`);
}

/**
 * Main Resilient Background Worker Loop
 */
let workerPromise = null;
let stopRequested = false;

async function interruptibleSleep(ms, labelPrefix = null) {
  const step = 250;
  let remaining = ms;
  while (remaining > 0 && !stopRequested) {
    if (labelPrefix) {
      state.cooldownRemainingSec = Math.ceil(remaining / 1000);
      state.statusText = `${labelPrefix}（${state.cooldownRemainingSec}s）`;
      broadcastState();
    }
    await sleep(Math.min(step, remaining));
    remaining -= step;
  }
  state.cooldownRemainingSec = 0;
}

async function runWorkerLoop() {
  let bytesSinceBatchRest = 0;
  let wasDisconnected = false;

  pushLog('info', `搬运引擎已启动：${config.sourceDir} → ${config.targetDir}`);

  while (!stopRequested) {
    try {
      // 1. Validate source dir
      if (!config.sourceDir || !fs.existsSync(config.sourceDir)) {
        state.phase = 'paused';
        state.statusText = '源文件夹不存在或不可访问，已暂停';
        pushLog('err', `源文件夹不可访问：${config.sourceDir}`);
        break;
      }

      // 2. Check target removable drive online & free space
      const drive = await getTargetDriveInfo();
      state.targetDrive = drive;

      if (!drive || !drive.online) {
        if (!wasDisconnected) {
          wasDisconnected = true;
          pushLog('warn', '⚠️ 检测到移动设备离线/掉盘！已暂停搬运并保护 PC 源文件，等待设备重连...');
        }
        state.phase = 'disconnected';
        state.currentFile = null;
        state.statusText = `设备 ${drive?.letter || ''} 离线，每 ${config.pollIntervalSec} 秒检测自动恢复...`;
        broadcastState(true);
        await interruptibleSleep(Math.max(2, Number(config.pollIntervalSec || 4)) * 1000);
        continue;
      }

      // If just recovered from a disconnect, wait 5s for drive stabilization & clean stale .part files
      if (wasDisconnected) {
        wasDisconnected = false;
        state.sessionStats.disconnectRecoveries++;
        state.phase = 'cooldown';
        pushLog('info', `移动设备 ${drive.label || drive.letter} 已重新上线！等待 5 秒稳定...`);
        await interruptibleSleep(5000, '设备重连稳定中');
        if (stopRequested) break;
        if (!drive.isMtp) {
          const cleaned = await cleanupStalePartFiles(config.targetDir);
          if (cleaned > 0) {
            pushLog('info', `已自动清理 ${cleaned} 个上次掉盘遗留的 .part 残缺文件`);
          }
        }
        bytesSinceBatchRest = 0;
      }

      // 3. Scan source folder
      state.phase = 'scanning';
      state.currentFile = null;
      const files = await scanSourceFiles(config.sourceDir);
      const totalPendingBytes = files.reduce((s, f) => s + f.size, 0);
      const smallestBytes = files.reduce((m, f) => Math.min(m, f.size), files[0]?.size ?? 0);
      state.sourceStats = {
        pendingCount: files.length,
        pendingBytes: totalPendingBytes,
        smallestBytes,
      };

      if (files.length === 0) {
        state.phase = 'waiting_space';
        state.statusText = `PC 源文件夹暂无待搬运文件，每 ${config.pollIntervalSec} 秒静默监测新文件...`;
        broadcastState(true);
        await interruptibleSleep(Math.max(2, Number(config.pollIntervalSec || 4)) * 1000);
        continue;
      }

      // 4. Compute usable space on removable drive (freeSpace - reserveSpaceMB)
      const reserveBytes = Math.max(0, Number(config.reserveSpaceMB || 0)) * 1024 * 1024;
      const usableBytes = Math.max(0, drive.freeBytes - reserveBytes);

      let chosen = null;
      if (config.smartFit) {
        // Smart fit: pick first file in chosen order that fits in usableBytes
        chosen = files.find((f) => f.size <= usableBytes) || null;
      } else {
        chosen = files[0].size <= usableBytes ? files[0] : null;
      }

      if (!chosen) {
        state.phase = 'waiting_space';
        const needText = config.smartFit
          ? `最小待搬文件需 ${formatBytes(smallestBytes)}`
          : `下个文件需 ${formatBytes(files[0].size)}`;
        state.statusText = `等待移动设备腾出空间（可用余量 ${formatBytes(usableBytes)}，${needText}，已预留 ${config.reserveSpaceMB}MB 安全缓冲）`;
        broadcastState(true);
        await interruptibleSleep(Math.max(2, Number(config.pollIntervalSec || 4)) * 1000);
        continue;
      }

      // 5. Execute Atomic 5-Step Safe Transfer!
      await safeTransferOneFile(chosen);
      bytesSinceBatchRest += chosen.size;
      state.currentFile = null;

      // Refresh drive space immediately after move
      state.targetDrive = await getTargetDriveInfo();
      broadcastState(true);

      if (stopRequested) break;

      // 6. Anti-Disconnect Thermal Cooldown!
      const batchBytesThreshold = Number(config.batchCooldownMB || 0) * 1024 * 1024;
      if (batchBytesThreshold > 0 && bytesSinceBatchRest >= batchBytesThreshold) {
        bytesSinceBatchRest = 0;
        const baseRestSec = Math.max(1, Number(config.batchCooldownSec || 5));
        const restSec = drive.isMtp ? Math.max(8, baseRestSec) : baseRestSec;
        state.phase = 'cooldown';
        pushLog('info', `已连续写入 ${config.batchCooldownMB}MB，执行深度降温歇息 ${restSec} 秒保护老旧主控...`);
        await interruptibleSleep(restSec * 1000, '主控深度散热歇息中');
      } else if (Number(config.cooldownPerFileMs || 0) > 0) {
        state.phase = 'cooldown';
        await interruptibleSleep(Number(config.cooldownPerFileMs), '单文件写入后歇息冷却中');
      }
    } catch (err) {
      if (err?.message === 'ABORTED') {
        break;
      }
      if (String(err?.message || '').startsWith('VERIFY_MISMATCH')) {
        pushLog('err', `❌ ${err.message}`);
        state.phase = 'cooldown';
        await interruptibleSleep(4000, '校验异常保护暂停中');
        continue;
      }
      if (isLikelyDisconnectError(err)) {
        wasDisconnected = true;
        pushLog('warn', `⚠️ 写入中断（${err.code || err.message}），疑似老旧设备掉盘！PC 源文件完好未删，等待重连...`);
        state.phase = 'disconnected';
        state.currentFile = null;
        broadcastState(true);
        await interruptibleSleep(3000);
        continue;
      }
      pushLog('err', `搬运遇到错误：${err?.message || err}`);
      await interruptibleSleep(3000);
    }
  }

  state.running = false;
  state.stopPending = false;
  state.currentFile = null;
  state.phase = 'idle';
  state.statusText = '搬运任务已停止';
  pushLog('info', '搬运引擎已安全停止');
  broadcastState(true);
}

function startWorker() {
  if (state.running) return { ok: false, error: '任务已在运行中' };
  if (!config.sourceDir || !config.targetDir) {
    return { ok: false, error: '请先设置 PC 源文件夹和移动设备目标文件夹' };
  }
  const targetIsMtp = Boolean(parseMtpPath(config.targetDir));
  if (
    !targetIsMtp &&
    path.resolve(config.sourceDir).toLowerCase() === path.resolve(config.targetDir).toLowerCase()
  ) {
    return { ok: false, error: '源文件夹和目标文件夹不能相同！' };
  }
  stopRequested = false;
  state.stopPending = false;
  state.running = true;
  state.sessionStats.startedAt = new Date().toISOString();
  keepModeDoneSet.clear();
  workerPromise = runWorkerLoop().finally(() => {
    workerPromise = null;
  });
  broadcastState(true);
  return { ok: true };
}

async function stopWorker(force = false) {
  if (!state.running) return { ok: true, stopping: false };
  stopRequested = true;
  state.stopPending = true;

  if (force) {
    abortActiveMtpTransfer();
    state.statusText = '已强制中断当前传输（PC 源文件完好保留）';
    pushLog('warn', '⏹ 用户已触发强制中断，当前未完成的传输已取消，PC 源文件完好未删');
    broadcastState(true);
  } else {
    state.statusText = '正在等待当前文件安全落盘后停止（如 MTP 卡住可点「强制中断」）';
    broadcastState(true);
  }

  if (workerPromise) {
    await Promise.race([workerPromise, sleep(1200)]);
  }
  return { ok: true, stopping: state.running };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 512 * 1024) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  try {
    // Live SSE Stream
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      sseClients.add(res);
      res.write(`data: ${JSON.stringify({ state, config })}\n\n`);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // List all connected Windows drives & MTP devices
    if (pathname === '/api/drives' && req.method === 'GET') {
      const drives = await queryWindowsDrives();
      sendJson(res, 200, { drives });
      return;
    }

    // Fast in-app folder browser (supports 此电脑, local drives, and MTP phones!)
    if (pathname === '/api/browse' && req.method === 'GET') {
      const targetPath = url.searchParams.get('path') || '';
      const logical = !targetPath || targetPath === '此电脑' ? await queryLogicalDisks() : [];
      const listing = await browseFolder(targetPath, logical);
      sendJson(res, 200, { ok: true, ...listing });
      return;
    }

    // Create subfolder inside local drive or MTP phone
    if (pathname === '/api/mkdir' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const created = await createDirectory(body.parentPath || '', body.name || '');
      sendJson(res, 200, { ok: true, path: created });
      return;
    }

    // Native Windows folder picker (fallback with concurrency lock)
    if (pathname === '/api/pick-folder' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const selected = await pickWindowsFolder(body.initialDir || '');
      sendJson(res, 200, { path: selected });
      return;
    }

    // Read current state & config
    if (pathname === '/api/state' && req.method === 'GET') {
      if (!state.running && config.targetDir) {
        state.targetDrive = await getTargetDriveInfo();
      }
      if (!state.running && config.sourceDir && fs.existsSync(config.sourceDir)) {
        const files = await scanSourceFiles(config.sourceDir);
        state.sourceStats = {
          pendingCount: files.length,
          pendingBytes: files.reduce((s, f) => s + f.size, 0),
          smallestBytes: files.reduce((m, f) => Math.min(m, f.size), files[0]?.size ?? 0),
        };
      }
      sendJson(res, 200, { state, config });
      return;
    }

    // Update config
    if (pathname === '/api/config' && req.method === 'POST') {
      const patch = await readJsonBody(req);
      config = { ...config, ...patch };
      saveConfig();
      if (config.targetDir) {
        state.targetDrive = await getTargetDriveInfo();
      }
      if (config.sourceDir && fs.existsSync(config.sourceDir)) {
        const files = await scanSourceFiles(config.sourceDir);
        state.sourceStats = {
          pendingCount: files.length,
          pendingBytes: files.reduce((s, f) => s + f.size, 0),
          smallestBytes: files.reduce((m, f) => Math.min(m, f.size), files[0]?.size ?? 0),
        };
      }
      broadcastState(true);
      sendJson(res, 200, { ok: true, config, state });
      return;
    }

    // Start worker
    if (pathname === '/api/start' && req.method === 'POST') {
      const resStart = startWorker();
      sendJson(res, resStart.ok ? 200 : 400, resStart);
      return;
    }

    // Stop worker (supports { force: true } to abort a hung MTP subprocess immediately)
    if (pathname === '/api/stop' && req.method === 'POST') {
      const body = await readJsonBody(req).catch(() => ({}));
      const resStop = await stopWorker(Boolean(body?.force));
      sendJson(res, 200, resStop);
      return;
    }

    // Reset session stats
    if (pathname === '/api/reset-stats' && req.method === 'POST') {
      state.sessionStats = {
        movedFiles: 0,
        movedBytes: 0,
        verifyFailures: 0,
        disconnectRecoveries: 0,
        skippedFiles: 0,
        startedAt: state.running ? new Date().toISOString() : null,
      };
      state.logs = [];
      broadcastState(true);
      sendJson(res, 200, { ok: true });
      return;
    }

    // Serve static frontend UI
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      const filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const html = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('[SafeMover Error]', err);
    sendJson(res, 500, { error: err.message });
  }
});

loadConfig();

// Periodic background drive & source refresh even while idle (every 5s)
setInterval(async () => {
  if (state.running || sseClients.size === 0) return;
  try {
    if (config.targetDir) state.targetDrive = await getTargetDriveInfo();
    if (config.sourceDir && fs.existsSync(config.sourceDir)) {
      const files = await scanSourceFiles(config.sourceDir);
      state.sourceStats = {
        pendingCount: files.length,
        pendingBytes: files.reduce((s, f) => s + f.size, 0),
        smallestBytes: files.reduce((m, f) => Math.min(m, f.size), files[0]?.size ?? 0),
      };
    }
    broadcastState(true);
  } catch {
    // Ignore idle refresh error
  }
}, 5000);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SafeMover] 护盘安全搬运助手已启动: http://127.0.0.1:${PORT}`);
});
