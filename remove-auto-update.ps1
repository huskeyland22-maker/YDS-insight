$ErrorActionPreference = "Stop"

$taskName = "YDS Investment Insights Auto Update"

Write-Host "Removing scheduled task: $taskName"
schtasks /Delete /TN $taskName /F | Out-Host
Write-Host "Done."
