# webular installer for Windows: picks the release asset for this CPU, checks it
# against the release's SHA256SUMS, and installs it as
# $env:WEBULAR_INSTALL\bin\webular.exe (default $HOME\.webular\bin\webular.exe).
#   irm https://github.com/srinitude/webular/releases/latest/download/install.ps1 | iex
# WEBULAR_VERSION=<x.y.z> pins a release. WEBULAR_BASE_URL replaces the download
# folder (an http(s) URL, a file:// URL, or a local folder path).
# WEBULAR_VERIFY_ATTESTATION=1 also runs `gh attestation verify` and fails on a
# bad or missing attestation. WEBULAR_OS and WEBULAR_ARCH override detection,
# so the tests can run this script on any OS with pwsh.
$ErrorActionPreference = 'Stop'
& {
  $repo = 'srinitude/webular'
  function Fail($message) { throw "webular install: $message" }

  $os = $env:WEBULAR_OS
  if (-not $os) { $os = if ($PSVersionTable.PSEdition -eq 'Desktop' -or $IsWindows) { 'windows' } else { 'other' } }
  if ($os -ne 'windows') { Fail 'install.ps1 is for Windows; on macOS and Linux use install.sh' }
  # OSArchitecture reports the native CPU, so an x64 shell on ARM64 still gets arm64.
  $cpu = $env:WEBULAR_ARCH
  if (-not $cpu) { $cpu = [string][Runtime.InteropServices.RuntimeInformation]::OSArchitecture }
  $arch = switch -Regex ($cpu) {
    '^(x64|amd64|x86_64)$' { 'x64' }
    '^(arm64|aarch64)$' { 'arm64' }
    default { Fail "unsupported CPU $cpu" }
  }
  $asset = "webular-windows-$arch.exe"

  $base = $env:WEBULAR_BASE_URL
  if (-not $base) {
    $base = if ($env:WEBULAR_VERSION) { "https://github.com/$repo/releases/download/v$($env:WEBULAR_VERSION)" }
    else { "https://github.com/$repo/releases/latest/download" }
  }
  $tmp = Join-Path ([IO.Path]::GetTempPath()) "webular-$([guid]::NewGuid())"
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    function Fetch($name) {
      $out = Join-Path $tmp $name
      try {
        if ($base -match '^https?://') { Invoke-WebRequest -UseBasicParsing -Uri "$base/$name" -OutFile $out }
        else {
          $folder = if ($base -match '^file://') { ([uri]$base).LocalPath } else { $base }
          Copy-Item -LiteralPath (Join-Path $folder $name) -Destination $out
        }
      } catch { Fail "download failed: $base/$name" }
      $out
    }
    $file = Fetch $asset
    $sums = Fetch 'SHA256SUMS'

    $want = Get-Content -LiteralPath $sums | ForEach-Object {
      $field = -split $_
      if ($field.Count -ge 2 -and ($field[1] -eq $asset -or $field[1] -eq "*$asset")) { $field[0] }
    } | Select-Object -First 1
    if (-not $want) { Fail "no checksum for $asset in SHA256SUMS" }
    $got = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant()
    if ($got -ne $want) { Fail "checksum mismatch for $asset (want $want, got $got)" }

    if ($env:WEBULAR_VERIFY_ATTESTATION -eq '1') {
      if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail 'WEBULAR_VERIFY_ATTESTATION=1 needs gh' }
      gh attestation verify $file --repo $repo | Out-Host
      if ($LASTEXITCODE -ne 0) { Fail 'attestation check failed' }
    }

    $root = if ($env:WEBULAR_INSTALL) { $env:WEBULAR_INSTALL } else { Join-Path $HOME '.webular' }
    $dir = Join-Path $root 'bin'
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $exe = Join-Path $dir 'webular.exe'
    Move-Item -Force -LiteralPath $file -Destination $exe
    Write-Host "webular installed to $exe"
    if (($env:PATH -split [IO.Path]::PathSeparator) -notcontains $dir) {
      Write-Host "add $dir to your PATH, for example:"
      Write-Host "  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';$dir', 'User')"
    }
  } finally {
    Remove-Item -Recurse -Force -LiteralPath $tmp -ErrorAction SilentlyContinue
  }
}
