@echo off

SET MOZILLABUILDDRIVE=%~d0%
SET MOZILLABUILDPATH=%~p0%
SET MOZILLABUILD=%MOZILLABUILDDRIVE%%MOZILLABUILDPATH%

echo "Mozilla tools directory: %MOZILLABUILD%"

REM Use the "new" moztools-static
set MOZ_TOOLS=%MOZILLABUILD%\moztools

rem append moztools to PATH
SET PATH=%PATH%;%MOZ_TOOLS%\bin

cd "%USERPROFILE%"
start "MSYS Shell - L10n Environment" "%MOZILLABUILD%\msys\bin\rxvt" -backspacekey  -sl 2500 -fg %FGCOLOR% -bg %BGCOLOR% -sr -fn "Lucida Console" -tn msys -geometry 80x25 -e /bin/bash --login -i
