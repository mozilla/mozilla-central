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
%MOZILLABUILD%\msys\bin\bash --login -i
