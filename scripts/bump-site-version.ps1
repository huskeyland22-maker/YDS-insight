$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root "site-version.js"

if (-not (Test-Path $target)) {
  throw "site-version.js not found: $target"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$raw = Get-Content -Path $target -Raw -Encoding UTF8

$updated = [regex]::Replace(
  $raw,
  'window\.SITE_VERSION\s*=\s*"[^"]*";',
  "window.SITE_VERSION = `"$stamp`";"
)

if ($updated -eq $raw) {
  throw "SITE_VERSION line was not found in site-version.js"
}

Set-Content -Path $target -Value $updated -Encoding UTF8
Write-Host "Updated SITE_VERSION to $stamp"
