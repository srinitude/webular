# webular installer for Windows: picks the release asset for this CPU, checks it
# against SHA256SUMS, and installs it as $env:WEBULAR_INSTALL\bin\webular.exe
# (default $HOME\.webular\bin\webular.exe), then adds that folder to the user PATH.
#   irm https://github.com/srinitude/webular/releases/latest/download/install.ps1 | iex
# WEBULAR_VERSION=<x.y.z> pins a release (a baked copy pins its own release and
# checks the sums baked into it). WEBULAR_BASE_URL replaces the download folder
# (an https:// URL, a file:// URL, or a local folder; http:// is refused).
# WEBULAR_PRINT_ASSET=1 prints the asset name and stops.
# WEBULAR_BASELINE=1 picks the -baseline x64 asset (chosen on its own without AVX2).
# WEBULAR_NO_MODIFY_PATH=1 leaves PATH alone. WEBULAR_UNINSTALL=1 removes the
# program and its PATH entry. WEBULAR_VERIFY_ATTESTATION=1 also runs
# `gh attestation verify`. HTTPS_PROXY sets a proxy. WEBULAR_OS and WEBULAR_ARCH
# override detection, so the tests can run this script on any OS with pwsh.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  if ($PSVersionTable.PSEdition -eq 'Desktop') {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  }
  $repo = 'srinitude/webular'
  # The release job fills these two; an unfilled copy resolves the release live.
  $DefaultVersion = '__WEBULAR_VERSION__'
  $BakedSums = @'
__WEBULAR_SUMS__
'@
  $baked = $DefaultVersion -ne ('__WEBULAR_' + 'VERSION__')
  function Fail($message) { throw $message }

  function Fetch($name) {
    $out = Join-Path $tmp $name
    try {
      if ($base -match '^https://') {
        $proxy = @{}
        if ($env:HTTPS_PROXY) { $proxy.Proxy = $env:HTTPS_PROXY }
        Invoke-WebRequest -UseBasicParsing @proxy -Uri "$base/$name" -OutFile $out
      } else {
        $folder = if ($base -match '^file://') { ([uri]$base).LocalPath } else { $base }
        Copy-Item -LiteralPath (Join-Path $folder $name) -Destination $out
      }
    } catch {
      $status = try { [int]$_.Exception.Response.StatusCode } catch { 0 }
      if ($status -eq 404 -and $ver) { Fail "release v$ver not found; see https://github.com/$repo/releases" }
      Fail "download failed: $base/$name; check your network, then run the installer again"
    }
    $out
  }

  function Get-Sha256Entry($text, $asset) {
    foreach ($line in ($text -split "`r?`n")) {
      $field = -split $line
      if ($field.Count -ge 2 -and ($field[1] -eq $asset -or $field[1] -eq "*$asset")) {
        if ($field[0] -notmatch '^[0-9a-fA-F]{64}$') { Fail "bad checksum line for $asset" }
        return $field[0].ToLowerInvariant()
      }
    }
    Fail "no checksum for $asset; download the release again or report it at https://github.com/$repo/issues"
  }

  # Adds or removes $dir in the user PATH, keeping the REG_EXPAND_SZ type.
  function Update-UserPath($dir, $add) {
    $key = Get-Item -LiteralPath 'HKCU:\Environment'
    $raw = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $keep = @($raw -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ine $dir.TrimEnd('\') })
    if ($add) { $keep += $dir }
    Set-ItemProperty -LiteralPath 'HKCU:\Environment' -Name Path -Value ($keep -join ';') -Type ExpandString
    Add-Type -Namespace Webular -Name Native -MemberDefinition '[DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, string l, uint f, uint t, out UIntPtr r);'
    $result = [UIntPtr]::Zero
    [void][Webular.Native]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)
    $session = @($env:Path -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ine $dir.TrimEnd('\') })
    if ($add) { $session += $dir }
    $env:Path = $session -join ';'
    if ($add -and $env:GITHUB_PATH) { Add-Content -LiteralPath $env:GITHUB_PATH -Value $dir }
  }

  function Get-Arch {
    $cpu = $env:WEBULAR_ARCH
    if (-not $cpu) {
      $cpu = try { (Get-ItemPropertyValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' PROCESSOR_ARCHITECTURE) } catch { '' }
    }
    if (-not $cpu) { $cpu = [string][Runtime.InteropServices.RuntimeInformation]::OSArchitecture }
    switch -Regex ($cpu) {
      '^(x64|amd64|x86_64)$' { 'x64' }
      '^(arm64|aarch64)$' { 'arm64' }
      default { Fail "unsupported CPU $cpu" }
    }
  }

  # The AVX2 probe describes this host, so an arch override skips it.
  function Use-Baseline {
    if ($env:WEBULAR_BASELINE -eq '1') { return $true }
    if ($env:WEBULAR_ARCH) { return $false }
    -not $(try { [System.Runtime.Intrinsics.X86.Avx2]::IsSupported } catch { $true })
  }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) "webular-$([guid]::NewGuid())"
  try {
    $os = $env:WEBULAR_OS
    if (-not $os) { $os = if ($PSVersionTable.PSEdition -eq 'Desktop' -or $IsWindows) { 'windows' } else { 'other' } }
    if ($os -ne 'windows') { Fail 'install.ps1 is for Windows; on macOS and Linux use install.sh' }
    $root = if ($env:WEBULAR_INSTALL) { $env:WEBULAR_INSTALL } else { Join-Path $HOME '.webular' }
    $dir = Join-Path $root 'bin'
    $exe = Join-Path $dir 'webular.exe'
    $touchPath = $env:WEBULAR_NO_MODIFY_PATH -ne '1'

    if ($env:WEBULAR_UNINSTALL -eq '1') {
      Remove-Item -Force -LiteralPath $exe, "$exe.old" -ErrorAction SilentlyContinue
      if ($touchPath) { Update-UserPath $dir $false }
      Write-Host "webular removed from $dir"
      return
    }

    $arch = Get-Arch
    $asset = "webular-windows-$arch.exe"
    if ($arch -eq 'x64' -and (Use-Baseline)) { $asset = 'webular-windows-x64-baseline.exe' }
    if ($env:WEBULAR_PRINT_ASSET -eq '1') { Write-Output $asset; return }

    $ver = if ($env:WEBULAR_VERSION) { $env:WEBULAR_VERSION } elseif ($baked) { $DefaultVersion }
    if ($ver) {
      $ver = $ver -replace '^v', ''
      if ($ver -notmatch '^\d+\.\d+\.\d+$') { Fail "bad version '$ver'; use <x.y.z>, for example from https://github.com/$repo/releases" }
    }
    $base = $env:WEBULAR_BASE_URL
    if (-not $base) {
      $base = if ($ver) { "https://github.com/$repo/releases/download/v$ver" }
      else { "https://github.com/$repo/releases/latest/download" }
    }
    if ($base -match '^http://') { Fail 'refusing http:// base URL; use https://, file://, or a folder' }
    if ($base -match '^[A-Za-z][A-Za-z0-9+.-]+://' -and $base -notmatch '^(https|file)://') { Fail "unsupported base URL $base" }

    New-Item -ItemType Directory -Path $tmp | Out-Null
    $file = Fetch $asset
    $useBaked = $baked -and $ver -eq $DefaultVersion -and -not $env:WEBULAR_BASE_URL
    $sums = if ($useBaked) { $BakedSums } else { Get-Content -Raw -LiteralPath (Fetch 'SHA256SUMS') }
    $want = Get-Sha256Entry $sums $asset
    $got = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant()
    if ($got -ne $want) { Fail "checksum mismatch for $asset (want $want, got $got); do not run it, and report it at https://github.com/$repo/blob/main/SECURITY.md" }

    if ($env:WEBULAR_VERIFY_ATTESTATION -eq '1') {
      if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail 'WEBULAR_VERIFY_ATTESTATION=1 needs gh; install it from https://cli.github.com, run `gh auth login`, then try again' }
      gh attestation verify $file --repo $repo --signer-workflow "$repo/.github/workflows/release.yml" | Out-Host
      if ($LASTEXITCODE -ne 0) { Fail "attestation check failed; do not run it. See https://github.com/$repo/blob/main/SECURITY.md" }
    }

    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    # A running exe cannot be overwritten but can be renamed.
    if (Test-Path -LiteralPath $exe) {
      Remove-Item -Force -LiteralPath "$exe.old" -ErrorAction SilentlyContinue
      Move-Item -Force -LiteralPath $exe -Destination "$exe.old"
    }
    Move-Item -Force -LiteralPath $file -Destination $exe
    Remove-Item -Force -LiteralPath "$exe.old" -ErrorAction SilentlyContinue
    # An overridden OS means a test fixture, which is not a runnable program.
    if (-not $env:WEBULAR_OS) {
      & $exe --version | Out-Null
      if ($LASTEXITCODE -ne 0) { Fail "$exe --version failed (exit $LASTEXITCODE)" }
    }
    Write-Host "webular installed to $exe"
    if ($touchPath) { Update-UserPath $dir $true }
  } catch {
    Write-Host "webular install: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  } finally {
    Remove-Item -Recurse -Force -LiteralPath $tmp -ErrorAction SilentlyContinue
  }
}
