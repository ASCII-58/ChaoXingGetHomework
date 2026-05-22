$ErrorActionPreference = "Stop"
$path = "E:\Github\xxt\src-tauri\icons\icon.ico"
$dir = Split-Path $path -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory $dir -Force | Out-Null }

$w = 16; $h = 16; $bpp = 32
$xm = $w * $h * ($bpp / 8)              # XOR mask: 1024
$mr = (([math]::Ceiling($w / 8) + 3) -shr 2) -shl 2  # mask row, padded to 4: 4
$am = $mr * $h                           # AND mask: 64
$bs = 40 + $xm + $am                     # BMP data size: 1128
$imgs = $bs                               # entry size

$ico = [byte[]]::new(6 + 16 + $bs)
$pos = 0

# ICO header
[BitConverter]::GetBytes([uint16]0).CopyTo($ico, $pos); $pos += 2
[BitConverter]::GetBytes([uint16]1).CopyTo($ico, $pos); $pos += 2
[BitConverter]::GetBytes([uint16]1).CopyTo($ico, $pos); $pos += 2
# ICO entry
$ico[$pos++] = $w; $ico[$pos++] = $h; $ico[$pos++] = 0; $ico[$pos++] = 0
[BitConverter]::GetBytes([uint16]1).CopyTo($ico, $pos); $pos += 2
[BitConverter]::GetBytes([uint16]$bpp).CopyTo($ico, $pos); $pos += 2
[BitConverter]::GetBytes([uint32]$imgs).CopyTo($ico, $pos); $pos += 4
[BitConverter]::GetBytes([uint32]22).CopyTo($ico, $pos); $pos += 4
# BMP info header
[BitConverter]::GetBytes([uint32]40).CopyTo($ico, $pos); $pos += 4
[BitConverter]::GetBytes([int32]$w).CopyTo($ico, $pos); $pos += 4
[BitConverter]::GetBytes([int32]($h * 2)).CopyTo($ico, $pos); $pos += 4
[BitConverter]::GetBytes([uint16]1).CopyTo($ico, $pos); $pos += 2
[BitConverter]::GetBytes([uint16]$bpp).CopyTo($ico, $pos); $pos += 2
# rest of BMP header is already zero

[IO.File]::WriteAllBytes($path, $ico)
Write-Host "OK $path ($($ico.Length) bytes)"
