rem This script is specific to the paths on the mozillabuild-builder vm.
rem Alter to suit your environment.

set VC8DIR=D:\msvs8
set SDKDIR=C:\Program Files\Microsoft Platform SDK
set PYTHONDIR=C:\python25
set SRCDIR=%~dp0%

call "%VC8DIR%\VC\bin\vcvars32.bat"
set INCLUDE=%SDKDIR%\Include\atl;%INCLUDE%

rmdir /S %SRCDIR%\_obj
mkdir %SRCDIR%\_obj

cd %SRCDIR%\_obj
%PYTHONDIR%\python.exe ..\packageit.py --msys c:\msys --output c:\stage

pause
