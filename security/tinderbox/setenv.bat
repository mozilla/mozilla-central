@echo off

rem --- Basic config, with VC7 libIDL files
SET MOZ_TOOLS=C:\moztools
SET GLIB_PREFIX=C:\apps\vc71
SET LIBIDL_PREFIX=C:\apps\vc71
SET MKSBASE=C:\apps\MKS6.2a
SET CVSROOT=:pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot
SET JAVA_HOME=C:/Progra~1/Java/jdk1.6.0_01
SET SHELL=%MKSBASE%\mksnt\sh.exe
SET CONFIG_SHELL=%MKSBASE%\mksnt\sh.exe
SET ROOTDIR=C:\apps\MKS6.2a

rem --- Clean slate start
SET INCLUDE=
SET LIB=
SET PATH=C:\;C:\windows\system32;C:\windows;C:\windows\system32\wbem

rem --- Set VC7 compiler environment vars
CALL "C:\Program Files\Microsoft Visual Studio .NET 2003\Vc7\bin\vcvars32.bat"

rem --- Add moztools to build environment
SET PATH=C:\Progra~1\Java\jdk1.6.0_01\bin;%MKSBASE%\mksnt;%PATH%;%MOZ_TOOLS%\bin;%MKSBASE%\mksnt;%MKSBASE%\bin;C:\Program Files\TortoiseCVS;C:\apps\Blat250\full
SET PATH=%GLIB_PREFIX%;%GLIB_PREFIX%\bin;%PATH%
SET INCLUDE=%GLIB_PREFIX%\include;%INCLUDE%;%MINGWBASE%\include
SET LIB=%GLIB_PREFIX%\lib;%LIB%
SET DOMSUF=red.iplanet.com
SET NSS_ENABLE_ECC=1
SET NSS_ECC_MORE_THAN_SUITE_B=1
