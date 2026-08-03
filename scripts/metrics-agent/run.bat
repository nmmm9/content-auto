@echo off
cd /d "%~dp0"
node scrape.mjs >> agent.log 2>&1
