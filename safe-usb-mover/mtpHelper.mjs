import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';

let activeMtpChild = null;
let activeMtpAborted = false;
let cachedMtpDevices = [];
let mtpListInFlight = null;

/**
 * Whether an MTP file transfer PowerShell session currently holds the USB/MTP bus.
 */
export function isMtpBusy() {
  return Boolean(activeMtpChild);
}

/**
 * Update cached free/total space for a known MTP device after a live check.
 */
export function updateCachedMtpSpace(deviceName, storageName, freeBytes, totalBytes) {
  if (!deviceName || !Array.isArray(cachedMtpDevices) || cachedMtpDevices.length === 0) return;
  for (const d of cachedMtpDevices) {
    if (d.deviceName === deviceName && (!storageName || d.storageName === storageName)) {
      if (Number.isFinite(freeBytes) && freeBytes >= 0) d.freeBytes = Number(freeBytes);
      if (Number.isFinite(totalBytes) && totalBytes > 0) d.totalBytes = Number(totalBytes);
      d.online = true;
    }
  }
}

/**
 * Strip PowerShell #< CLIXML progress/error XML noise into a concise human-readable error message.
 */
export function cleanPowerShellError(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'PowerShell 未知错误';

  const decodeXml = (s) =>
    s
      .replace(/_x000D__x000A_|_x000A_|_x000D_/g, '\n')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

  const isNoiseLine = (line) =>
    !line ||
    /^#< CLIXML/i.test(line) ||
    /^所在位置\s+行:|^At line:\d+/i.test(line) ||
    /^\+\s*(throw |~+)/i.test(line) ||
    /^\+\s*CategoryInfo\b/i.test(line) ||
    /^\+\s*FullyQualifiedErrorId\b/i.test(line);

  if (text.includes('#< CLIXML') || text.includes('<Objs ')) {
    const errorNodes = [];
    const re = /<S S="Error">([\s\S]*?)<\/S>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const decoded = decodeXml(m[1]);
      for (const line of decoded.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!isNoiseLine(trimmed)) errorNodes.push(trimmed);
      }
    }
    if (errorNodes.length > 0) {
      return errorNodes[0];
    }
    const stripped = decodeXml(text.replace(/<[^>]+>/g, ' '))
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => !isNoiseLine(l));
    if (stripped) return stripped;
  }

  const firstUseful = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => !isNoiseLine(l));
  return firstUseful || text.slice(0, 240);
}

/**
 * Force-terminate an active/hung MTP PowerShell transfer subprocess immediately.
 * Safe: PC source files are never deleted until transferFileToMtp resolves cleanly.
 */
export function abortActiveMtpTransfer() {
  activeMtpAborted = true;
  const child = activeMtpChild;
  if (!child) return false;
  try {
    if (process.platform === 'win32' && child.pid) {
      execFile('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true }, () => {});
    }
    child.kill('SIGKILL');
  } catch {
    // Ignore kill error
  }
  return true;
}

/**
 * Execute PowerShell with guaranteed UTF-8 stdout and UTF-16LE EncodedCommand
 * (prevents GBK/CP936 mojibake on Chinese Windows drive labels and folder paths).
 */
export function runPowerShellUtf8(script, { sta = false, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const wrapped = `$ProgressPreference = 'SilentlyContinue'\r\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\r\n$OutputEncoding = [System.Text.Encoding]::UTF8\r\n${script}`;
    const encoded = Buffer.from(wrapped, 'utf16le').toString('base64');
    const args = ['-NoProfile', '-NonInteractive'];
    if (sta) args.push('-STA');
    args.push('-EncodedCommand', encoded);
    execFile(
      'powershell.exe',
      args,
      { timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = cleanPowerShellError(stderr || err.message || 'PowerShell error');
          reject(new Error(msg));
        } else {
          resolve(String(stdout || ''));
        }
      }
    );
  });
}

function escapePsSingle(s) {
  return String(s ?? '').replace(/'/g, "''");
}

function toJsonBase64(val) {
  return Buffer.from(JSON.stringify(val), 'utf8').toString('base64');
}

/**
 * Parse MTP path formats such as:
 * - "此电脑\Pixel\内部共享存储空间\DCIM\Camera"
 * - "Computer\Pixel\内部共享存储空间\DCIM\Camera"
 * - "mtp://Pixel/内部共享存储空间/DCIM/Camera"
 * Returns null for regular drive-letter paths (e.g. "E:\Backup").
 */
export function parseMtpPath(rawPath) {
  const s = String(rawPath || '').trim();
  if (!s) return null;

  let parts = [];
  if (/^mtp:\/\//i.test(s)) {
    parts = s.replace(/^mtp:\/\//i, '').split(/[\\/]+/).filter(Boolean);
  } else {
    const cleaned = s.replace(/\//g, '\\').replace(/^\\+|\\+$/g, '');
    const segs = cleaned.split('\\').filter(Boolean);
    if (segs.length === 0) return null;
    if (segs[0] === '此电脑' || segs[0].toLowerCase() === 'computer' || segs[0].toLowerCase() === 'this pc') {
      if (segs.length < 2) return null;
      // Normal drive root under 此电脑 e.g. "此电脑\C:" should not be treated as MTP
      if (/^[A-Za-z]:$/.test(segs[1])) return null;
      parts = segs.slice(1);
    } else {
      return null;
    }
  }

  if (parts.length === 0) return null;
  const deviceName = parts[0];
  const storageName = parts[1] || '';
  const subSegments = parts.slice(2);
  const displayParts = ['此电脑', deviceName, ...(storageName ? [storageName] : []), ...subSegments];

  return {
    deviceName,
    storageName,
    subSegments,
    displayPath: displayParts.join('\\'),
  };
}

/**
 * Enumerate all connected MTP / Portable Devices under Windows "此电脑" (NameSpace(17)).
 * Returns cached snapshot with busy=true while an MTP transfer is actively using the USB bus
 * so UI polling never contends with CopyHere or drops the phone card on a COM timeout.
 */
export async function listMtpDevices({ force = false } = {}) {
  if (isMtpBusy() && !force) {
    return cachedMtpDevices.map((d) => ({ ...d, busy: true }));
  }
  if (mtpListInFlight) {
    return mtpListInFlight;
  }

  const script = `
$sh = New-Object -ComObject Shell.Application
$pc = $sh.NameSpace(17)
$out = @()
foreach ($dev in $pc.Items()) {
  if (-not $dev.IsFolder) { continue }
  $p = [string]$dev.Path
  if ($p -match '^[A-Za-z]:\\\\?$') { continue }
  if ($p -and ($p -notlike '::*')) { continue }
  $devFolder = $dev.GetFolder
  if ($null -eq $devFolder) { continue }
  foreach ($st in $devFolder.Items()) {
    $free = $st.ExtendedProperty('System.FreeSpace')
    $cap = $st.ExtendedProperty('System.Capacity')
    $defaultPath = "此电脑\\$($dev.Name)\\$($st.Name)"
    try {
      $stFolder = $st.GetFolder
      if ($null -ne $stFolder) {
        $dcim = $stFolder.Items() | Where-Object { $_.Name -eq 'DCIM' -and $_.IsFolder } | Select-Object -First 1
        if ($dcim) {
          $cam = $dcim.GetFolder.Items() | Where-Object { $_.Name -eq 'Camera' -and $_.IsFolder } | Select-Object -First 1
          if ($cam) { $defaultPath = "此电脑\\$($dev.Name)\\$($st.Name)\\DCIM\\Camera" }
          else { $defaultPath = "此电脑\\$($dev.Name)\\$($st.Name)\\DCIM" }
        }
      }
    } catch {}
    $out += [PSCustomObject]@{
      deviceName = [string]$dev.Name
      storageName = [string]$st.Name
      freeBytes = if ($null -ne $free) { [double]$free } else { 0 }
      totalBytes = if ($null -ne $cap) { [double]$cap } else { 0 }
      defaultTargetPath = $defaultPath
    }
  }
}
if ($out.Count -eq 0) { '[]' } else { ConvertTo-Json -InputObject @($out) -Compress }
`;
  mtpListInFlight = (async () => {
    try {
      const stdout = await runPowerShellUtf8(script, { sta: true, timeout: 9000 });
      const trimmed = stdout.trim();
      if (!trimmed) {
        cachedMtpDevices = [];
        return [];
      }
      const arr = JSON.parse(trimmed);
      const mapped = (Array.isArray(arr) ? arr : [arr]).map((d) => ({
        id: `mtp:${d.deviceName}:${d.storageName}`,
        isMtp: true,
        letter: 'MTP',
        deviceName: d.deviceName,
        storageName: d.storageName,
        label: `${d.deviceName} · ${d.storageName}`,
        displayPath: `此电脑\\${d.deviceName}\\${d.storageName}`,
        defaultTargetPath: d.defaultTargetPath || `此电脑\\${d.deviceName}\\${d.storageName}`,
        driveType: 10,
        typeName: 'MTP 便携设备',
        fileSystem: 'MTP',
        totalBytes: Number(d.totalBytes || 0),
        freeBytes: Number(d.freeBytes || 0),
        online: true,
        busy: false,
      }));
      cachedMtpDevices = mapped;
      return mapped;
    } catch {
      return cachedMtpDevices.map((d) => ({ ...d, busy: isMtpBusy() }));
    } finally {
      mtpListInFlight = null;
    }
  })();

  return mtpListInFlight;
}

/**
 * Query live free/total space for a specific MTP target path.
 */
export async function getMtpStorageInfo(mtpTarget) {
  if (isMtpBusy()) {
    const cached = cachedMtpDevices.find(
      (d) =>
        d.deviceName === mtpTarget.deviceName &&
        (!mtpTarget.storageName || d.storageName === mtpTarget.storageName)
    );
    if (cached) {
      return {
        online: true,
        isMtp: true,
        busy: true,
        letter: 'MTP',
        deviceName: cached.deviceName,
        storageName: cached.storageName,
        label: cached.label,
        driveType: 10,
        typeName: 'MTP 便携设备',
        fileSystem: 'MTP',
        totalBytes: cached.totalBytes,
        freeBytes: cached.freeBytes,
      };
    }
  }

  const devB64 = toJsonBase64(mtpTarget.deviceName);
  const stB64 = toJsonBase64(mtpTarget.storageName || '');
  const script = `
$devTarget = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${devB64}')) | ConvertFrom-Json
$stTarget = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${stB64}')) | ConvertFrom-Json
$sh = New-Object -ComObject Shell.Application
$pc = $sh.NameSpace(17)
$dev = $pc.Items() | Where-Object { $_.Name -eq $devTarget -and $_.IsFolder } | Select-Object -First 1
if ($null -eq $dev) { '{"online":false}'; exit 0 }
$stList = @($dev.GetFolder.Items())
$st = if ($stTarget) { $stList | Where-Object { $_.Name -eq $stTarget } | Select-Object -First 1 } else { $stList | Select-Object -First 1 }
if ($null -eq $st) { '{"online":false}'; exit 0 }
$free = $st.ExtendedProperty('System.FreeSpace')
$cap = $st.ExtendedProperty('System.Capacity')
[PSCustomObject]@{
  online = $true
  deviceName = [string]$dev.Name
  storageName = [string]$st.Name
  freeBytes = if ($null -ne $free) { [double]$free } else { 0 }
  totalBytes = if ($null -ne $cap) { [double]$cap } else { 0 }
} | ConvertTo-Json -Compress
`;
  try {
    const stdout = await runPowerShellUtf8(script, { sta: true, timeout: 7000 });
    const parsed = JSON.parse(stdout.trim() || '{"online":false}');
    if (!parsed.online) {
      return {
        online: false,
        isMtp: true,
        letter: 'MTP',
        deviceName: mtpTarget.deviceName,
        storageName: mtpTarget.storageName,
        label: `${mtpTarget.deviceName} · ${mtpTarget.storageName || '存储'}`,
        driveType: 10,
        typeName: 'MTP 便携设备',
        totalBytes: 0,
        freeBytes: 0,
      };
    }
    const freeBytes = Number(parsed.freeBytes || 0);
    const totalBytes = Number(parsed.totalBytes || 0);
    updateCachedMtpSpace(parsed.deviceName, parsed.storageName, freeBytes, totalBytes);
    return {
      online: true,
      isMtp: true,
      letter: 'MTP',
      deviceName: parsed.deviceName,
      storageName: parsed.storageName,
      label: `${parsed.deviceName} · ${parsed.storageName}`,
      driveType: 10,
      typeName: 'MTP 便携设备',
      fileSystem: 'MTP',
      totalBytes,
      freeBytes,
    };
  } catch {
    return {
      online: false,
      isMtp: true,
      letter: 'MTP',
      deviceName: mtpTarget.deviceName,
      storageName: mtpTarget.storageName,
      label: `${mtpTarget.deviceName} · ${mtpTarget.storageName || '存储'}`,
      driveType: 10,
      typeName: 'MTP 便携设备',
      totalBytes: 0,
      freeBytes: 0,
    };
  }
}

/**
 * Browse either "此电脑" root, a local filesystem folder, or an MTP phone folder.
 */
export async function browseFolder(rawPath, logicalDrives = []) {
  const trimmed = String(rawPath || '').trim();

  // Root view: "此电脑" -> list all drive letters + all MTP devices
  if (!trimmed || trimmed === '此电脑' || trimmed.toLowerCase() === 'computer') {
    const mtpDevices = await listMtpDevices();
    const entries = [
      ...mtpDevices.map((m) => ({
        name: `${m.deviceName} (${m.storageName})`,
        path: m.displayPath,
        kind: 'mtp_root',
        freeBytes: m.freeBytes,
        totalBytes: m.totalBytes,
        typeName: 'MTP 便携设备',
      })),
      ...logicalDrives.map((d) => ({
        name: `${d.letter} ${d.label || (d.driveType === 2 ? '可移动磁盘' : '本地磁盘')}`,
        path: `${d.letter}\\`,
        kind: 'drive',
        freeBytes: d.freeBytes,
        totalBytes: d.totalBytes,
        typeName: d.typeName,
      })),
    ];
    return {
      currentPath: '此电脑',
      parentPath: null,
      isMtp: false,
      selectable: false,
      fileCount: 0,
      entries,
    };
  }

  // MTP path browsing
  const mtp = parseMtpPath(trimmed);
  if (mtp) {
    const reqB64 = toJsonBase64({
      deviceName: mtp.deviceName,
      storageName: mtp.storageName,
      subSegments: mtp.subSegments,
    });

    const script = `
$req = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${reqB64}')) | ConvertFrom-Json
$sh = New-Object -ComObject Shell.Application
$pc = $sh.NameSpace(17)
$dev = $pc.Items() | Where-Object { $_.Name -eq $req.deviceName -and $_.IsFolder } | Select-Object -First 1
if ($null -eq $dev) { '{"error":"未找到移动设备，请确认手机已解锁并选择文件传输(MTP)"}'; exit 0 }
$curFolder = $dev.GetFolder
if ($req.storageName) {
  $st = $curFolder.Items() | Where-Object { $_.Name -eq $req.storageName } | Select-Object -First 1
  if ($null -eq $st) { '{"error":"未找到设备存储空间"}'; exit 0 }
  $curFolder = $st.GetFolder
}
foreach ($seg in @($req.subSegments)) {
  if (-not $seg) { continue }
  $child = $curFolder.Items() | Where-Object { $_.Name -eq $seg -and $_.IsFolder } | Select-Object -First 1
  if ($null -eq $child) { '{"error":"目标子目录不存在"}'; exit 0 }
  $curFolder = $child.GetFolder
}
$dirs = @()
$fileCnt = 0
foreach ($item in $curFolder.Items()) {
  if ($item.IsFolder) {
    $dirs += [string]$item.Name
  } else {
    $fileCnt++
  }
}
[PSCustomObject]@{
  dirs = @($dirs | Sort-Object)
  fileCount = $fileCnt
} | ConvertTo-Json -Compress
`;
    const stdout = await runPowerShellUtf8(script, { sta: true, timeout: 12000 });
    const res = JSON.parse(stdout.trim() || '{}');
    if (res.error) throw new Error(res.error);

    const parts = mtp.displayPath.split('\\');
    const parentPath = parts.length <= 2 ? '此电脑' : parts.slice(0, -1).join('\\');
    const entries = (Array.isArray(res.dirs) ? res.dirs : []).map((name) => ({
      name,
      path: `${mtp.displayPath}\\${name}`,
      kind: 'mtp_folder',
    }));

    return {
      currentPath: mtp.displayPath,
      parentPath,
      isMtp: true,
      selectable: Boolean(mtp.storageName),
      fileCount: Number(res.fileCount || 0),
      entries,
    };
  }

  // Standard local / USB drive filesystem browsing
  let normalized = trimmed.replace(/\//g, '\\');
  if (/^[A-Za-z]:$/.test(normalized)) normalized += '\\';
  const resolved = path.resolve(normalized);

  const items = await fsp.readdir(resolved, { withFileTypes: true });
  const dirs = [];
  let fileCount = 0;
  for (const it of items) {
    if (it.isDirectory()) {
      // Skip protected Windows system folders at drive root
      if (/^(\$Recycle\.Bin|System Volume Information|Recovery|Config\.Msi)$/i.test(it.name)) {
        continue;
      }
      dirs.push(it.name);
    } else if (it.isFile()) {
      fileCount++;
    }
  }
  dirs.sort((a, b) => a.localeCompare(b, 'zh-CN'));

  const parsedRoot = path.parse(resolved);
  const isDriveRoot = resolved.replace(/\\+$/, '').toLowerCase() === parsedRoot.root.replace(/\\+$/, '').toLowerCase();
  const parentPath = isDriveRoot ? '此电脑' : path.dirname(resolved);

  return {
    currentPath: resolved,
    parentPath,
    isMtp: false,
    selectable: true,
    fileCount,
    entries: dirs.map((name) => ({
      name,
      path: path.join(resolved, name),
      kind: 'dir',
    })),
  };
}

/**
 * Create a folder inside either a local path or an MTP folder.
 */
export async function createDirectory(parentPath, folderName) {
  const safeName = String(folderName || '').trim().replace(/[<>:"/\\|?*]/g, '_');
  if (!safeName) throw new Error('文件夹名称无效');

  const mtp = parseMtpPath(parentPath);
  if (!mtp) {
    const target = path.join(path.resolve(parentPath), safeName);
    await fsp.mkdir(target, { recursive: true });
    return target;
  }

  if (!mtp.storageName) throw new Error('不能在设备根目录直接新建文件夹，请先进入内部存储');
  const reqB64 = toJsonBase64({
    deviceName: mtp.deviceName,
    storageName: mtp.storageName,
    subSegments: mtp.subSegments,
    newName: safeName,
  });
  const script = `
$req = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${reqB64}')) | ConvertFrom-Json
$sh = New-Object -ComObject Shell.Application
$pc = $sh.NameSpace(17)
$dev = $pc.Items() | Where-Object { $_.Name -eq $req.deviceName -and $_.IsFolder } | Select-Object -First 1
if ($null -eq $dev) { throw 'MTP_DISCONNECTED' }
$st = $dev.GetFolder.Items() | Where-Object { $_.Name -eq $req.storageName } | Select-Object -First 1
if ($null -eq $st) { throw 'MTP_DISCONNECTED' }
$cur = $st.GetFolder
foreach ($seg in @($req.subSegments)) {
  if (-not $seg) { continue }
  $child = $cur.Items() | Where-Object { $_.Name -eq $seg -and $_.IsFolder } | Select-Object -First 1
  if ($null -eq $child) { throw 'SUBFOLDER_MISSING' }
  $cur = $child.GetFolder
}
$existing = $cur.Items() | Where-Object { $_.Name -eq $req.newName -and $_.IsFolder } | Select-Object -First 1
if ($null -eq $existing) { $cur.NewFolder($req.newName) }
'OK'
`;
  await runPowerShellUtf8(script, { sta: true, timeout: 12000 });
  return `${mtp.displayPath}\\${safeName}`;
}

async function computeLocalSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const chunk = 1024 * 1024;
  const buf = Buffer.allocUnsafe(chunk);
  const fd = await fsp.open(filePath, 'r');
  try {
    while (true) {
      const { bytesRead } = await fd.read(buf, 0, chunk, null);
      if (bytesRead === 0) break;
      hash.update(bytesRead === chunk ? buf : buf.subarray(0, bytesRead));
    }
    return hash.digest('hex');
  } finally {
    await fd.close().catch(() => {});
  }
}

/**
 * Safe single-file transfer to an MTP portable device (e.g. Pixel phone):
 * 1. Navigates/creates destination subfolders via Shell COM
 * 2. Checks if file already exists with exact 64-bit byte size (idempotent)
 * 3. Copies single file via CopyHere(src, 1044)
 * 4. Polls ExtendedProperty("System.Size") until exact size matches on 2 consecutive checks
 * 5. Optional read-back SHA-256 verification (copies back to temp dir and compares hash)
 */
export async function transferFileToMtp({
  srcFullPath,
  fileName,
  fileSize,
  mtpTarget,
  relSubDirs = [],
  verifyReadback = false,
  srcSha256 = '',
  onPhaseChange,
  onProgress,
  onHeartbeat,
}) {
  const allSubs = [...(mtpTarget.subSegments || []), ...relSubDirs.filter(Boolean)];
  const tempVerifyDir = verifyReadback
    ? path.join(os.tmpdir(), `safemover-mtp-verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    : '';
  if (tempVerifyDir) await fsp.mkdir(tempVerifyDir, { recursive: true });

  // Dynamic completion cap (~1.2 MB/s worst-case throughput + 120s buffer, minimum 3 min)
  const transferTimeoutSec = Math.max(180, Math.ceil(fileSize / (1.2 * 1024 * 1024)) + 120);
  const reqB64 = toJsonBase64({
    deviceName: mtpTarget.deviceName,
    storageName: mtpTarget.storageName,
    subSegments: allSubs,
    srcFullPath: path.resolve(srcFullPath),
    fileName,
    fileSize,
    verifyReadback: Boolean(verifyReadback),
    tempVerifyDir,
  });

  onPhaseChange?.('copying');
  activeMtpAborted = false;

  const script = `
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$req = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${reqB64}')) | ConvertFrom-Json
$sh = New-Object -ComObject Shell.Application
$pc = $sh.NameSpace(17)
$dev = $pc.Items() | Where-Object { $_.Name -eq $req.deviceName -and $_.IsFolder } | Select-Object -First 1
if ($null -eq $dev) { throw 'MTP_DISCONNECTED: 未检测到设备' }
$stList = @($dev.GetFolder.Items())
$st = if ($req.storageName) { $stList | Where-Object { $_.Name -eq $req.storageName } | Select-Object -First 1 } else { $stList | Select-Object -First 1 }
if ($null -eq $st) { throw 'MTP_DISCONNECTED: 未检测到设备存储' }

$curFolder = $st.GetFolder
foreach ($seg in @($req.subSegments)) {
  if (-not $seg) { continue }
  $child = $curFolder.Items() | Where-Object { $_.Name -eq $seg -and $_.IsFolder } | Select-Object -First 1
  if ($null -eq $child) {
    $curFolder.NewFolder($seg)
    $deadlineFolder = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadlineFolder -and $null -eq $child) {
      Start-Sleep -Milliseconds 300
      $child = $curFolder.Items() | Where-Object { $_.Name -eq $seg -and $_.IsFolder } | Select-Object -First 1
    }
  }
  if ($null -eq $child) { throw "MTP_MKDIR_FAILED: $seg" }
  $curFolder = $child.GetFolder
}

function Find-MtpItem($folder, $name, [bool]$allowFullScan) {
  $p = $folder.ParseName($name)
  if ($null -ne $p) { return $p }
  if (-not $allowFullScan) { return $null }
  return ($folder.Items() | Where-Object { -not $_.IsFolder -and $_.Name -eq $name } | Select-Object -First 1)
}

function Get-MtpSize($item) {
  if ($null -eq $item) { return -1 }
  $s = $item.ExtendedProperty('System.Size')
  if ($null -ne $s -and "$s" -ne '') { return [double]$s }
  return [double]$item.Size
}

$needCopy = $true
$existing = Find-MtpItem $curFolder $req.fileName $true
if ($null -ne $existing) {
  $exSize = Get-MtpSize $existing
  if ($exSize -eq [double]$req.fileSize) {
    $needCopy = $false
    if (-not $req.verifyReadback) {
      Write-Output ('RESULT:' + ([PSCustomObject]@{ ok = $true; alreadyIdentical = $true; verifiedSize = $exSize; readbackPath = '' } | ConvertTo-Json -Compress))
      exit 0
    }
  } else {
    Write-Output 'WARN:TRUNCATED_OVERWRITE'
  }
}

if ($needCopy) {
  # 4 = no progress dialog, 16 = yes to all (overwrite truncated), 1024 = no error UI
  $curFolder.CopyHere($req.srcFullPath, 1044)
  Start-Sleep -Milliseconds 1500
}

Write-Output 'PHASE:POLLING'

# Watchdog verification loop:
# - polls every 2000ms to minimize COM contention during CopyHere
# - full folder scan & device alive check only every ~10s
# - emits HEARTBEAT:<elapsedSec> so UI shows active write progress even before MTP commits final size
# - requires exact byte match on 2 consecutive checks
$transferStartedAt = Get-Date
$deadline = $transferStartedAt.AddSeconds(${transferTimeoutSec})
$lastProgressAt = $transferStartedAt
$lastReportedSize = -1
$consecutiveOk = 0
$finalItem = $null
$finalSize = -1
$pollIdx = 0

while ((Get-Date) -lt $deadline) {
  $pollIdx++
  $now = Get-Date
  $elapsedSec = [int]($now - $transferStartedAt).TotalSeconds
  Write-Output ("HEARTBEAT:" + $elapsedSec)

  $allowFullScan = ($pollIdx -eq 1) -or (($pollIdx % 5) -eq 0)
  if (($pollIdx % 5) -eq 0) {
    $devAlive = $pc.Items() | Where-Object { $_.Name -eq $req.deviceName -and $_.IsFolder } | Select-Object -First 1
    if ($null -eq $devAlive) {
      throw 'MTP_DISCONNECTED: 传输期间检测到设备断开'
    }
  }

  $found = Find-MtpItem $curFolder $req.fileName $allowFullScan
  if ($null -ne $found) {
    $sz = Get-MtpSize $found
    if ($sz -gt $lastReportedSize) {
      $lastReportedSize = $sz
      $lastProgressAt = $now
      Write-Output ("PROGRESS:" + [int64]$sz)
    }
    if ($sz -eq [double]$req.fileSize) {
      $consecutiveOk++
      if ($consecutiveOk -ge 2) {
        $finalItem = $found
        $finalSize = $sz
        break
      }
    } else {
      $consecutiveOk = 0
    }
  }

  if ($lastReportedSize -gt 0 -and (($now - $lastProgressAt).TotalSeconds -ge 120)) {
    throw 'MTP_VERIFY_TIMEOUT: 手机 MTP 长时间无写入进展（已自动保护 PC 源文件）'
  }

  Start-Sleep -Milliseconds 2000
}

if ($null -eq $finalItem) {
  throw 'MTP_VERIFY_TIMEOUT: 手机 MTP 传输超时（超过 ${transferTimeoutSec} 秒仍未完成，已自动保护 PC 源文件）'
}

$readbackPath = ''
if ($req.verifyReadback) {
  $tmpFolder = $sh.NameSpace($req.tempVerifyDir)
  $tmpFolder.CopyHere($finalItem, 1044)
  $rbTarget = Join-Path $req.tempVerifyDir $req.fileName
  $rbDeadline = (Get-Date).AddSeconds(${transferTimeoutSec})
  while ((Get-Date) -lt $rbDeadline) {
    if (Test-Path -LiteralPath $rbTarget) {
      $fi = Get-Item -LiteralPath $rbTarget
      if ($fi.Length -eq [int64]$req.fileSize) {
        $readbackPath = $rbTarget
        break
      }
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $readbackPath) {
    throw 'MTP_READBACK_TIMEOUT: 无法从手机回读文件进行校验'
  }
}

Write-Output ('RESULT:' + ([PSCustomObject]@{
  ok = $true
  alreadyIdentical = $false
  verifiedSize = $finalSize
  readbackPath = $readbackPath
} | ConvertTo-Json -Compress))
`;

  try {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const res = await new Promise((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded],
        { windowsHide: true }
      );
      activeMtpChild = child;

      let bufOut = '';
      let errText = '';
      let parsedResult = null;
      let settled = false;

      const finish = (err, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimer);
        if (activeMtpChild === child) activeMtpChild = null;
        if (err) reject(err);
        else resolve(val);
      };

      const hardTimer = setTimeout(() => {
        try {
          if (process.platform === 'win32' && child.pid) {
            execFile('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true }, () => {});
          }
          child.kill('SIGKILL');
        } catch {}
        finish(new Error('MTP_VERIFY_TIMEOUT: 传输超时，已自动中断并保护 PC 源文件'));
      }, (transferTimeoutSec + 45) * 1000);

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        bufOut += chunk;
        const lines = bufOut.split(/\r?\n/);
        bufOut = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          if (line.startsWith('PROGRESS:')) {
            const bytes = Number(line.slice(9));
            if (Number.isFinite(bytes)) onProgress?.(bytes);
          } else if (line.startsWith('HEARTBEAT:')) {
            const sec = Number(line.slice(10));
            if (Number.isFinite(sec)) onHeartbeat?.(sec);
          } else if (line.startsWith('RESULT:')) {
            try {
              parsedResult = JSON.parse(line.slice(7));
            } catch {}
          }
        }
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => {
        errText += d;
      });

      child.on('error', (err) => finish(err));
      child.on('close', (code) => {
        if (bufOut.trim().startsWith('RESULT:')) {
          try {
            parsedResult = JSON.parse(bufOut.trim().slice(7));
          } catch {}
        }
        if (activeMtpAborted) {
          finish(new Error('ABORTED'));
          return;
        }
        if (code !== 0 || !parsedResult?.ok) {
          finish(new Error(cleanPowerShellError(errText || `MTP_TRANSFER_FAILED (code ${code})`)));
          return;
        }
        finish(null, parsedResult);
      });
    });

    if (verifyReadback && res.readbackPath) {
      onPhaseChange?.('verifying');
      const expectedHash = srcSha256 || (await computeLocalSha256(srcFullPath));
      const actualHash = await computeLocalSha256(res.readbackPath);
      if (actualHash !== expectedHash) {
        throw new Error('VERIFY_MISMATCH: MTP 回拷文件 SHA-256 校验不一致，已保留 PC 源文件！');
      }
    }

    return {
      ok: true,
      alreadyIdentical: Boolean(res.alreadyIdentical),
      verifiedSize: Number(res.verifiedSize || fileSize),
      destDisplayPath: `${mtpTarget.displayPath}${relSubDirs.length ? '\\' + relSubDirs.join('\\') : ''}\\${fileName}`,
    };
  } finally {
    if (tempVerifyDir) {
      await fsp.rm(tempVerifyDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
