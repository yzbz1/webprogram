$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and
  $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRT($winRtTask, $resultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
  $netTask = $asTask.Invoke($null, @($winRtTask))
  if (-not $netTask.Wait(2200)) {
    return $null
  }
  return $netTask.Result
}

function Emit-Json($obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 4
  [Console]::Out.WriteLine($json)
  [Console]::Out.Flush()
}

try {
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
  [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
  $mgr = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch {
  $mgr = $null
}

if ($null -eq $mgr) {
  Emit-Json @{
    type = 'state'
    available = $false
    hasSession = $false
    title = ''
    artist = ''
    status = 'idle'
    thumbnailDataUrl = $null
  }
  exit 0
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)

function Convert-ThumbnailToDataUrl($thumbRef) {
  if ($null -eq $thumbRef) { return $null }
  try {
    $stream = Await-WinRT ($thumbRef.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    if ($null -eq $stream -or $stream.Size -le 0) { return $null }
    $size = [uint32][Math]::Min([uint64]2097152, $stream.Size)
    $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
    $loaded = Await-WinRT ($reader.LoadAsync($size)) ([uint32])
    if ($null -eq $loaded -or $loaded -le 0) {
      $reader.Dispose()
      $stream.Dispose()
      return $null
    }
    $bytes = New-Object byte[] $loaded
    $reader.ReadBytes($bytes)
    $reader.Dispose()
    $stream.Dispose()

    $inMs = New-Object System.IO.MemoryStream(, $bytes)
    $srcImg = [System.Drawing.Image]::FromStream($inMs)
    $dstBmp = New-Object System.Drawing.Bitmap(128, 128)
    $gfx = [System.Drawing.Graphics]::FromImage($dstBmp)
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gfx.DrawImage($srcImg, 0, 0, 128, 128)

    $outMs = New-Object System.IO.MemoryStream
    if ($null -ne $jpegCodec) {
      $dstBmp.Save($outMs, $jpegCodec, $encParams)
    } else {
      $dstBmp.Save($outMs, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    }
    $b64 = [Convert]::ToBase64String($outMs.ToArray())

    $outMs.Dispose()
    $gfx.Dispose()
    $dstBmp.Dispose()
    $srcImg.Dispose()
    $inMs.Dispose()
    return ('data:image/jpeg;base64,' + $b64)
  } catch {
    return $null
  }
}

$lastEmitKey = ''
$lastTrackKey = ''
$lastThumbDataUrl = $null

function Read-And-Emit($force) {
  $hasSession = $false
  $title = ''
  $artist = ''
  $status = 'idle'
  $thumbUrl = $null

  try {
    $session = $mgr.GetCurrentSession()
    if ($null -ne $session) {
      $hasSession = $true
      $pb = $session.GetPlaybackInfo()
      if ($null -ne $pb) {
        $pbStr = $pb.PlaybackStatus.ToString()
        if ($pbStr -eq 'Playing') { $status = 'playing' }
        elseif ($pbStr -eq 'Paused') { $status = 'paused' }
      }
      $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      if ($null -ne $props) {
        if ($props.Title) { $title = [string]$props.Title }
        if ($props.Artist) { $artist = [string]$props.Artist }
        $trackKey = ($title + '|' + $artist)
        if ($trackKey -ne $script:lastTrackKey) {
          $script:lastTrackKey = $trackKey
          $script:lastThumbDataUrl = Convert-ThumbnailToDataUrl $props.Thumbnail
        }
        $thumbUrl = $script:lastThumbDataUrl
      }
    } else {
      $script:lastTrackKey = ''
      $script:lastThumbDataUrl = $null
    }
  } catch {
    # Ignore transient WinRT read error
  }

  $emitKey = ($hasSession.ToString() + '|' + $status + '|' + $title + '|' + $artist + '|' + ([bool]$thumbUrl).ToString())
  if ($force -or $emitKey -ne $script:lastEmitKey) {
    $script:lastEmitKey = $emitKey
    Emit-Json @{
      type = 'state'
      available = $true
      hasSession = $hasSession
      title = $title
      artist = $artist
      status = $status
      thumbnailDataUrl = $thumbUrl
    }
  }
}

Read-And-Emit $true
$readTask = [Console]::In.ReadLineAsync()

while ($true) {
  if ($readTask.Wait(2500)) {
    $cmd = $readTask.Result
    if ($null -eq $cmd) {
      break
    }
    $trimmed = $cmd.Trim().ToLowerInvariant()
    $ok = $false
    if ($trimmed -eq 'prev' -or $trimmed -eq 'next' -or $trimmed -eq 'toggle') {
      try {
        $session = $mgr.GetCurrentSession()
        if ($null -ne $session) {
          if ($trimmed -eq 'prev') {
            $ok = [bool](Await-WinRT ($session.TrySkipPreviousAsync()) ([bool]))
          } elseif ($trimmed -eq 'next') {
            $ok = [bool](Await-WinRT ($session.TrySkipNextAsync()) ([bool]))
          } else {
            $ok = [bool](Await-WinRT ($session.TryTogglePlayPauseAsync()) ([bool]))
          }
        }
      } catch {
        $ok = $false
      }
      Emit-Json @{
        type = 'ack'
        action = $trimmed
        ok = $ok
      }
      Start-Sleep -Milliseconds 320
      Read-And-Emit $true
    }
    $readTask = [Console]::In.ReadLineAsync()
  } else {
    Read-And-Emit $false
  }
}
