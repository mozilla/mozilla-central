@echo off

SET MOZ_MSVCVERSION=6
SET MOZBUILDDIR=%~dp0
SET MOZILLABUILD=%MOZBUILDDIR%

echo "Mozilla tools directory: %MOZBUILDDIR%"

REM Get MSVC paths
call "%MOZBUILDDIR%guess-msvc.bat"

if "%VC6DIR%"=="" (
    ECHO "Microsoft Visual C++ version 6 was not found. Exiting."
    pause
    EXIT /B 1
)

REM For MSVC6, we use the "old" non-static moztools
set MOZ_TOOLS=%MOZBUILDDIR%moztools-180compat

rem append moztools to PATH
SET PATH=%PATH%;%MOZ_TOOLS%\bin

rem Prepend MSVC paths
call "%VC6DIR%\Bin\vcvars32.bat"

cd "%USERPROFILE%"
start "MSYS Shell - MSVC6 Environment" "%MOZBUILDDIR%msys\bin\rxvt" -backspacekey  -sl 2500 -fg %FGCOLOR% -bg %BGCOLOR% -sr -fn "Courier New" -tn msys -geometry 80x25 -e /bin/bash --login -i
