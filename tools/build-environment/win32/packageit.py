# Creates a mozilla-build installer.
#
# This script will taint your registry, cause hives, and otherwise screw up
# the system it's run on. Please do *not* run it on any machine you care about
# (a temporary VM would be perfect!)
#
# When clicking through installer dialogs, don't run any post-install steps.
# You won't need to change any paths.
#
# This script is python instead of shell because running the MSYS installer
# requires that no MSYS shells be currently running.
#
# = How to Build MozillaBuild =
# References:
# http://www.mingw.org/MinGWiki/index.php/MSYSBuildEnvironment
# http://www.mingw.org/MinGWiki/index.php/Build%20MSYS?PHPSESSID=ec53e47bb122b5dbc18063cb441983be
# http://mxr.mozilla.org/mozilla/source/tools/build-environment/win32/packageit.py
# == Visual Studio/Platform SDK ==
# === Installation ===
# (note: my install was done with Visual Studio Express 2005)
# * Install Visual Studio/Visual Studio Express
# * Install the Platform SDK
# ** Microsoft Windows Core SDK
# ** Microsoft Web Workshop (IE) SDk
# ** Microsoft IIS SDK
# === Path Setup ===
# * INCLUDE should be as follows: 'c:\program files\microsoft platform sdk\include;c:\program files\microsoft platform sdk\include\atl'.
# * Open up vsvars32.bat (for Express this is in c:\program files\microsoft visual studio 8\common7\tools).
# * Change the "@set INCLUDE=..." to start with "@set INCLUDE=%INCLUDE%", with the MSVS8 include path after it.
# == MSYS Packages ==
# === Installation ===
# Install these two packages to the same location:
# * [http://downloads.sourceforge.net/mingw/MSYS-1.0.10.exe?modtime=1079444447&big_mirror=1 MSYS Base System 1.0.10]
# * [http://downloads.sourceforge.net/mingw/msysDTK-1.0.1.exe?modtime=1041430674&big_mirror=1 MSYS Developer Toolkit 1.0.1]
# 
# Open up an MSYS shell and do the following:
#  mkdir /msys
#  cd /msys
#  tar -zvxf msysDVLPR-1.0.0-alpha-1.tar.gz
#  cd /msys/lib/gcc-lib/i686-pc-msys/2.95.3-1
#  mv specs specs.orig
#  sed 's|/usr|/msys|g' < specs.orig > specs
# 
# Download and unzip the [http://downloads.sourceforge.net/mingw/w32api-3.10.tar.gz?modtime=1186139469&big_mirror=1 w32api] package to somewhere outside of your MSYS install. Open up an MSYS shell and copy include/wincon.h to /msys/include.
# 
# * Open an MSYS shell and do the following
#  cd /msys/lib/gcc-lib/i686-pc-msys/2.95.3-1/include/msys
# Open the file up in vim and go to line 48. It should read:
#  #define CTRL(c'h')          ((ch)&0x1F)
# Change it to read:
#  #define CTRL(ch)          ((ch)&0x1F)
# 
# === Path Setup ===
# Open up an MSYS shell, edit ~/.profile and add the following line:
#  export PATH=".:/msys/bin:/usr/local/bin:/bin:$PATH"
# 
# == Other Applications ==
# * [http://www.bastet.com/uddu.zip unix2dos]
# ** Put the exe files in c:\windows
# * [http://www.python.org/ftp/python/2.5.1/python-2.5.1.msi Python 2.5]
# * [http://superb-west.dl.sourceforge.net/sourceforge/nsis/nsis-2.33-setup.exe NSIS]
# * [http://mxr.mozilla.org/mozilla/source/tools/build-environment/win32/unz552xN.exe?raw=1&ctype=application/octet-stream unzip]
# ** Extract to c:\program files\unzip
# * Append ';c:\python25;c:\program files\nsis;c:\program files\unzip' to path.
# 
from subprocess import check_call
from os import getcwd, remove, environ, chdir
from os.path import dirname, join, split, abspath, exists
import optparse
from shutil import rmtree

sourcedir = join(split(abspath(__file__))[0])
stagedir = getcwd()
msysdir = "c:\\msys\\1.0"

oparser = optparse.OptionParser()
oparser.add_option("-s", "--source", dest="sourcedir")
oparser.add_option("-o", "--output", dest="stagedir")
oparser.add_option("-m", "--msys", dest="msysdir")
(options, args) = oparser.parse_args()

if len(args) != 0:
    raise Exception("Unexpected arguments passed to command line.")

if options.sourcedir:
    sourcedir = options.sourcedir
if options.stagedir:
    stagedir = options.stagedir
if options.msysdir:
    msysdir = options.msysdir

environ["MOZ_STAGEDIR"] = stagedir
environ["MOZ_SRCDIR"] = sourcedir

print("Source file location: " + sourcedir)
print("Output location: " + stagedir)

if exists(join(stagedir, "mozilla-build")):
    rmtree(join(stagedir, "mozilla-build"))

check_call([join(sourcedir, "7z442.exe"),
            "/D=" + join(stagedir, "mozilla-build", "7zip")])
check_call(["msiexec.exe", "/a",
            join(sourcedir, "python-2.5.msi"),
            "TARGETDIR=" + join(stagedir, "mozilla-build", "python25")])
check_call([join(sourcedir, "MSYS-1.0.10.exe"),
            "/DIR=" + join(stagedir, "mozilla-build", "msys"),
            # "/VERYSILENT", "/SUPRESSMSGBOXES",
            "/SP-", "/NOICONS"])
check_call([join(sourcedir, "msysDTK-1.0.1.exe"),
            "/DIR=" + join(stagedir, "mozilla-build", "msys"),
            # "/VERYSILENT", "/SUPRESSMSGBOXES",
            "/SP-", "/NOICONS"])
check_call([join(sourcedir, "XEmacs Setup 21.4.19.exe"),
            "/DIR=" + join(stagedir, "mozilla-build", "xemacs"),
            "/SP-", "/NOICONS"])
# Run an MSYS shell to perform the following tasks:
# * install make-3.81
# * install UPX
# * install blat
# * install SVN
# * build and install libiconv

check_call([join(msysdir, "bin", "sh.exe"), "--login",
            join(sourcedir, "packageit.sh")])

environ["MSYSTEM"] = "MSYS"
check_call([join(msysdir, "bin", "sh.exe"), "--login",
            join(sourcedir, "packageit-msys.sh")])

del environ["MSYSTEM"]

# Make an installer
chdir(stagedir)
check_call(["makensis", "/NOCD", "installit.nsi"])
