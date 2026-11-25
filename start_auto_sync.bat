@echo off
title Auto GitHub Sync (Bunker Game)
chcp 65001 >nul
cd /d "d:\game"
powershell -ExecutionPolicy Bypass -File "d:\game\auto_watch_github.ps1"
pause
