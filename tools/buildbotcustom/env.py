# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla-specific Buildbot steps.
#
# The Initial Developer of the Original Code is
# Mozilla Corporation.
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Ben Hearsum <bhearsum@mozilla.com>
#   Rob Campbell <rcampbell@mozilla.com>
#   Chris Cooper <ccooper@mozilla.com>
# ***** END LICENSE BLOCK *****

MozillaEnvironments = {}

MozillaEnvironments['win32-ref-platform'] = {
    "MOZ_TOOLS": 'd:\\mozilla-build\\moztools',
    "VSINSTALLDIR": 'D:\\msvs8',
    "VS80COMMTOOLS": 'D:\\msvs8\\Common7\\Tools\\',
    "VCINSTALLDIR": 'D:\\msvs8\\VC',
    "FrameworkDir": 'C:\\WINDOWS\\Microsoft.NET\\Framework',
    "FrameworkSDKDir": 'D:\\msvs8\\SDK\\v2.0',
    "DevEnvDir": "D:\\msvs8\\VC\\Common7\\IDE",
    "MSVCDir": 'D:\\msvs8\\VC',
    "PATH": 'd:\\sdks\\v6.0\\bin' + \
            'D:\\msvs8\\Common7\\IDE;' + \
            'D:\\msvs8\\VC\\bin;' + \
            'C:\\msvs8\\SDK\\bin;' + \
            'D:\\msvs8\\VC;' + \
            'D:\\msvs8\\Common7\\Tools;' + \
            'D:\\msvs8\\Common7\\Tools\\bin;' + \
            'd:\\mercurial;' + \
            'd:\\mozilla-build\\moztools\\bin;' + \
            'd:\\mozilla-build\\msys\\bin;' + \
            'd:\\mozilla-build\\msys\\local\\bin;' + \
            'd:\\mozilla-build\\7zip;' + \
            'd:\\mozilla-build\\upx203w;' + \
            'd:\\mozilla-build\\python25;' + \
            'd:\\mozilla-build\\blat261\\full;' + \
            'd:\\mozilla-build\\info-zip;' + \
            'd:\\mozilla-build\\wget;' + \
            'd:\\mozilla-build\\nsis-2.22;',
            'd:\\sdks\\v6.0\\bin'
    "INCLUDE": 'D:\\sdks\\v6.0\\include;' + \
               'D:\\sdks\\v6.0\\include\\atl;' + \
               'D:\\msvs8\\VC\\ATLMFC\\INCLUDE;' + \
               'D:\\msvs8\\VC\\INCLUDE;' + \
               'D:\\msvs8\\VC\\PlatformSDK\\include',
    "LIB": 'D:\\sdks\\v6.0\\lib;' + \
           'D:\\msvs8\\VC\\ATLMFC\\LIB;' + \
           'D:\\msvs8\\VC\\LIB;' + \
           'D:\\msvs8\\VC\\PlatformSDK\\lib',
    "SDKDIR": 'D:\\sdks\\v6.0'
}

### unittest-1.9 environments

MozillaEnvironments['linux-fc6-unittest'] = {
    "DISPLAY": ':2',
    "MOZ_NO_REMOTE": '1'
}

MozillaEnvironments['linux-centos-unittest'] = {
    "MOZ_NO_REMOTE": '1',
    "CVS_RSH": 'ssh'
}

MozillaEnvironments['mac-osx-tiger-unittest'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "CVS_RSH": 'ssh'
}

MozillaEnvironments['win32-vc8-cygwin-unittest'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "VCVARS": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\bin\\vcvars32.bat',
    "MOZ_TOOLS": 'C:\\moztools',
    "CYGWINBASE": 'C:\\cygwin',
    "CVS_RSH": 'ssh',
    "VSINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8',
    "VCINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "FrameworkDir": 'C:\\WINDOWS\\Microsoft.NET\\Framework',
    "FrameworkVersion": 'v2.0.50727',
    "FrameworkSDKDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0',
    "MSVCDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "DevEnvDir": "C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\IDE",
    "PATH": 'C:\\Python24;' + \
            'C:\\Python24\\Scripts;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\IDE;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\BIN;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\Tools;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\Tools\\bin;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\PlatformSDK\\bin;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0\\bin;' + \
            'C:\\WINDOWS\\Microsoft.NET\\Framework\\v2.0.50727;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\VCPackages;' + \
            'C:\\cygwin\\bin;' + \
            'C:\\WINDOWS\\System32;' + \
            'C:\\WINDOWS;' + \
            'C:\\WINDOWS\System32\Wbem;' + \
            'C:\\moztools\\bin;' + \
            'C:\\Utilities;',
    "INCLUDE": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\INCLUDE;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\INCLUDE;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\PlatformSDK\\include;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0\\include;' + \
               '%INCLUDE%',
    "LIB": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\LIB;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\LIB;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\PlatformSDK\\lib;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0\\lib;',
    "LIBPATH": 'C:\\WINDOWS\\Microsoft.NET\\Framework\\v2.0.50727;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\LIB'
}

MozillaEnvironments['win32-vc8-mozbuild-unittest'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "MOZ_AIRBAG": '1',
    "MOZ_CRASHREPORTER_NO_REPORT": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "VCVARS": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\bin\\vcvars32.bat',
    "MOZ_MSVCVERSION": '8',
    "MOZILLABUILD": 'C:\\mozilla-build',
    "MOZILLABUILDDRIVE": 'C:',
    "MOZILLABUILDPATH": '\\mozilla-build\\',
    "MOZ_TOOLS": 'C:\\mozilla-build\\moztools',
    "CVS_RSH": 'ssh',
    "VSINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8',
    "VCINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "FrameworkDir": 'C:\\WINDOWS\\Microsoft.NET\\Framework',
    "FrameworkVersion": 'v2.0.50727',
    "FrameworkSDKDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0',
    "MSVCDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "DevEnvDir": "C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\IDE",
    "PATH": 'C:\\mozilla-build\\msys\\local\\bin;' + \
            'C:\\mozilla-build\\wget;' + \
            'C:\\mozilla-build\\7zip;' + \
            'C:\\mozilla-build\\blat261\\full;' + \
            'C:\\mozilla-build\\svn-win32-1.4.2\\bin;' + \
            'C:\\mozilla-build\\upx203w;' + \
            'C:\\mozilla-build\\xemacs\\XEmacs-21.4.19\\i586-pc-win32;' + \
            'C:\\mozilla-build\\info-zip;' + \
            'C:\\mozilla-build\\nsis-2.22;' + \
            '.;' + \
            'C:\\mozilla-build\\msys\\bin;' + \
            'C:\\Python24;' + \
            'C:\\Python24\\Scripts;' + \
            'C:\\Program Files\\Microsoft SDKs\\Windows\\v6.0\\bin;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\IDE;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\BIN;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\Tools;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\Tools\\bin;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\PlatformSDK\\bin;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0\\bin;' + \
            'C:\\WINDOWS\\Microsoft.NET\\Framework\\v2.0.50727;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\VCPackages;' + \
            'C:\\WINDOWS\\System32;' + \
            'C:\\WINDOWS;' + \
            'C:\\WINDOWS\\System32\\Wbem;' + \
            'C:\\mozilla-build\\moztools\\bin;',
    "INCLUDE": 'C:\\Program Files\\Microsoft SDKs\\Windows\\v6.0\\include;' + \
               'C:\\Program Files\\Microsoft SDKs\\Windows\\v6.0\\include\\atl;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\INCLUDE;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\INCLUDE;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\PlatformSDK\\include;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0\\include;' + \
               '%INCLUDE%',
    "LIB": 'C:\\Program Files\\Microsoft SDKs\\Windows\\v6.0\\lib;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\LIB;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\LIB;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\PlatformSDK\\lib;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0\\lib;',
    "LIBPATH": 'C:\\WINDOWS\\Microsoft.NET\\Framework\\v2.0.50727;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\LIB'
}
