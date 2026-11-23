@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "book_node=%~dp0runtime\node.exe"
if not defined EARTH_FIELDBOOK_NODE for /f "tokens=2,*" %%A in ('reg query HKCU\Environment /v EARTH_FIELDBOOK_NODE 2^>nul') do if "%%A"=="REG_SZ" set "EARTH_FIELDBOOK_NODE=%%B"
if defined EARTH_FIELDBOOK_NODE if exist "%EARTH_FIELDBOOK_NODE%" set "book_node=%EARTH_FIELDBOOK_NODE%"
"%book_node%" "%~dp0server.mjs" %*
if errorlevel 1 pause
