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

    rem Fix problem with VC++Express Edition
    if "%SDKVER%"=="6" (
        rem SDK Ver.6.0 (Windows Vista SDK) and 6.1 (Windows Server 2008 SDK)
        rem does not contain ATL header files too.
        rem It is needed to use Platform SDK's ATL header files.
        SET USEPSDKATL=1

        rem SDK ver.6.0 does not contain OleAcc.idl
        rem It is needed to use Platform SDK's OleAcc.idl
        if "%SDKMINORVER%"=="0" (
            SET USEPSDKIDL=1
        )
    )
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

    if "%USEPSDKATL%"=="1" (
        if "%USEPSDKIDL%"=="1" (
            set INCLUDE=%SDKDIR%\include;%PSDKDIR%\include\atl;%PSDKDIR%\include;%INCLUDE%
        ) else (
            set INCLUDE=%SDKDIR%\include;%PSDKDIR%\include\atl;%INCLUDE%
        )
    ) else (
        if "%USEPSDKIDL%"=="1" (
            set INCLUDE=%SDKDIR%\include;%SDKDIR%\include\atl;%PSDKDIR%\include;%INCLUDE%
        ) else (
            set INCLUDE=%SDKDIR%\include;%SDKDIR%\include\atl;%INCLUDE%
        )
    )
)

cd "%USERPROFILE%"
%MOZILLABUILD%\msys\bin\bash --login -i

