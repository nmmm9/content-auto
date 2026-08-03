@echo off
rem 매일 06:30에 수집 에이전트 실행 (PC가 켜져 있어야 함)
schtasks /Create /TN "LivingSequence Metrics Agent" /TR "\"%~dp0run.bat\"" /SC DAILY /ST 06:30 /F
echo.
echo 등록 완료. 확인: schtasks /Query /TN "LivingSequence Metrics Agent"
pause
