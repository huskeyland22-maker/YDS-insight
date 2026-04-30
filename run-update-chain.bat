@echo off
setlocal
cd /d "%~dp0"

node "scripts\run-update-chain.mjs"

endlocal
