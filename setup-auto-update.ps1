$ErrorActionPreference = "Stop"

$taskName = "YDS Investment Insights Auto Update"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $repoRoot "run-update-chain.bat"

if (-not (Test-Path $runner)) {
  throw "Runner not found: $runner"
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$runner`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650)

Write-Host "Registering scheduled task: $taskName"
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description "Auto updates market data every 30 minutes." -Force | Out-Null

Write-Host "Triggering first run now..."
Start-ScheduledTask -TaskName $taskName

Write-Host "Done. Task is active and runs every 30 minutes."
