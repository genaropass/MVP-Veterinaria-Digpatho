param(
  [ValidateSet("prod", "preprod")]
  [string]$Target = "preprod"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$GitBash = "C:\Program Files\Git\bin\bash.exe"

if (-not (Test-Path $GitBash)) {
  throw "Git Bash no encontrado en '$GitBash'. Instala Git for Windows."
}

$env:DEPLOY_TARGET = $Target
$unixRoot = & $GitBash -lc "cd '$($Root -replace '\\','/')' && pwd"

Write-Host "==> Deploy $Target via SSH (Git Bash)" -ForegroundColor Cyan
& $GitBash -lc "cd '$unixRoot' && ./deploy.sh"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
