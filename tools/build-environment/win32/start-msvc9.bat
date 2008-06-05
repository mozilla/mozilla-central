@echo off

SET MOZ_MSVCVERSION=9
SET MOZBUILDDIR=%~dp0
SET MOZILLABUILD=%MOZBUILDDIR%

echo "Mozilla tools directory: %MOZBUILDDIR%"

REM Get MSVC paths
call "%MOZBUILDDIR%guess-msvc.bat"

REM Use the "new" moztools-static
set MOZ_TOOLS=%MOZBUILDDIR%moztools

rem append moztools to PATH
SET PATH=%PATH%;%MOZ_TOOLS%\bin

if "%VC9DIR%"=="" (
    if "%VC9EXPRESSDIR%"=="" (
        ECHO "Microsoft Visual C++ version 9 (2008) was not found. Exiting."
        pause
        EXIT /B 1
    )

    if "%SDKDIR%"=="" (
        ECHO "Microsoft Platform SDK was not found. Exiting."
        pause
        EXIT /B 1
    )

    rem Prepend MSVC paths
    call "%VC9EXPRESSDIR%\Bin\vcvars32.bat"

    rem Don't set SDK paths in this block, because blocks are early-evaluated.
) else (
    rem Prepend MSVC paths
    call "%VC9DIR%\Bin\vcvars32.bat"
)

if "%VC9DIR%"=="" (
    rem Prepend SDK paths - Don't use the SDK SetEnv.cmd because it pulls in
    rem random VC paths which we don't want.
    rem Add the atlthunk compat library to the end of our LIB
    set PATH=%SDKDIR%\bin;%PATH%
    set LIB=%SDKDIR%\lib;%LIB%;%MOZBUILDDIR%atlthunk_compat
    set INCLUDE=%SDKDIR%\include;%SDKDIR%\include\atl;%INCLUDE%
)

cd "%USERPROFILE%"
start "MSYS Shell - MSVC9 Environment" "%MOZBUILDDIR%msys\bin\rxvt" -backspacekey  -sl 2500 -fg %FGCOLOR% -bg %BGCOLOR% -sr -fn "Courier New" -tn msys -geometry 80x25 -e /bin/bash --login -i
