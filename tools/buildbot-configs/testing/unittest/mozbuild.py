# -*- Python -*-

from buildbot.process import step
from buildbot.process.step import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION
import re

MozillaEnvironments = { }

MozillaEnvironments['linux'] = {
    "DISPLAY": ':2',
    "MOZ_NO_REMOTE": '1'
}

MozillaEnvironments['centos'] = {
    "MOZ_NO_REMOTE": '1'
}

MozillaEnvironments['osx'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn'
}

# standard vc8 express build env; vc8 normal will be very similar, just different
# platform SDK location.  we can build both from one generic template.
MozillaEnvironments['vc8'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "VCVARS": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\bin\\vcvars32.bat',
    "MOZ_TOOLS": 'C:\\moztools',
    "CYGWINBASE": 'C:\\cygwin',
    "VSINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8',
    "VCINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "FrameworkDir": 'C:\\WINDOWS\\Microsoft.NET\\Framework',
    "FrameworkVersion": 'v2.0.50727',
    "FrameworkSDKDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0',
    "MSVCDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "DevEnvDir": "C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\IDE",
    "PATH": 'C:\\Python24;' + \
            'C:\\Python24\\Scripts;' + \
            'C:\\cygwin\\bin;' + \
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

MozillaEnvironments['mozbuild'] = {
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

class TinderboxShellCommand(ShellCommand):
    haltOnFailure = False
    
    def evaluateCommand(self, cmd):
       return SUCCESS
    

class MozillaCheckoutClientMk(ShellCommand):
    haltOnFailure = True
    cvsroot = ":pserver:anonymous@cvs.mozilla.org:/cvsroot"
    
    def __init__(self, **kwargs):
        if 'cvsroot' in kwargs:
            self.cvsroot = kwargs['cvsroot']
        if not 'command' in kwargs:
            kwargs['command'] = ["cvs", "-d", self.cvsroot, "co", "mozilla/client.mk"]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["client.mk update"]
    
 
class MozillaClientMkPull(ShellCommand):
    haltOnFailure = True
    def __init__(self, **kwargs):
        if not 'project' in kwargs or kwargs['project'] is None:
            self.project = "browser"
        else:
            self.project = kwargs['project']
            del kwargs['project']
        if not 'workdir' in kwargs:
            kwargs['workdir'] = "mozilla"
        if not 'command' in kwargs:
            kwargs['command'] = ["make", "-f", "client.mk", "pull_all"]
        env = {}
        if 'env' in kwargs:
            env = kwargs['env'].copy()
        env['MOZ_CO_PROJECT'] = self.project
        kwargs['env'] = env
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        if not done:
            return ["pulling (" + self.project + ")"]
        return ["pull (" + self.project + ")"]
    

class MozillaPackage(ShellCommand):
    name = "package"
    warnOnFailure = True
    description = ["packaging"]
    descriptionDone = ["package"]
    command = ["make"]

class MozillaClobber(ShellCommand):
    name = "clobber"
    description = "checking clobber file"
    descriptionDone = "clobber checked"
    filePath = "mozilla/tools/tinderbox-configs/firefox/"
    
    def __init__(self, **kwargs):
        if 'platform' in kwargs:
            self.platform = kwargs['platform']
        if not 'command' in kwargs:
            self.command = ["awk"]
            catCommand = "cat %s%s/CLOBBER" % (self.filePath, self.platform)
            rmCommand = "rm -rf mozilla/objdir"
            awkString = "/U "+ self.filePath.replace('/', '.') + \
                self.platform + '.CLOBBER/ { system("' + catCommand + \
                '"); system("' + rmCommand + '") }'
            self.command.append(awkString)
            self.command.append('cvsco.log')
            if self.platform == 'win32':
                self.command = "sh -c 'awk \'" + awkString + "\' cvsco.log'"
        ShellCommand.__init__(self, **kwargs)
    

class MozillaClobberWin(ShellCommand):
    name = "clobber win"
    description = "checking clobber file"
    descriptionDone = "clobber finished"
    
    def __init__(self, **kwargs):
        if not 'command' in kwargs:
            self.command = 'python C:\\Utilities\\killAndClobberWin.py'
        ShellCommand.__init__(self, **kwargs)
    

class MozillaCheck(ShellCommand):
    name = "check"
    warnOnFailure = True
    description = ["checking"]
    descriptionDone = ["check complete"]
    command = ["make", "-k", "check"]
   
    def createSummary(self, log):
        passCount = 0
        failCount = 0
        for line in log.readlines():
            if "PASS" in line:
                passCount = passCount + 1
            if "FAIL" in line:
                failCount = failCount + 1
        summary = "TinderboxPrint: TUnit<br/>" + str(passCount) + "/" + str(failCount) + "\n"
        self.addCompleteLog('summary', summary)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if None != re.search('FAIL', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS
    
class MozillaReftest(ShellCommand):
    warnOnFailure = True
    name = "reftest"
    description = ["reftest"]
    descriptionDone = ["reftest complete"]
   
    def createSummary(self, log):
        testCount = 0
        passCount = 0
        failCount = 0
        knownFailCount = 0
        for line in log.readlines():
            if "REFTEST" not in line:
                continue
            if "IMAGE" in line:
                continue
            if "RESULT EXPECTED TO BE RANDOM" in line:
                continue
            testCount += 1
            if "UNEXPECTED" in line:
                failCount += 1
                continue
            if "KNOWN FAIL" in line:
                knownFailCount += 1
            else:
                passCount += 1
        summary = "TinderboxPrint: " + self.name + "<br/>" + str(passCount) + \
            "/" + str(failCount) + "/" + str(knownFailCount) + "\n"
        self.addCompleteLog('summary', summary)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if re.search('UNEXPECTED', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS
    
class MozillaUnixReftest(MozillaReftest):
    command = ["../../objdir/dist/bin/run-mozilla.sh",
               "../../objdir/dist/bin/firefox",
               "-P",
               "default",
               "-reftest",
               "reftest.list"]

class MozillaOSXReftest(MozillaReftest):
    command = ["../../objdir/dist/Minefield.app/Contents/MacOS/firefox",
               "-console",
               "-P",
               "default",
               "-reftest",
               "reftest.list"]

class MozillaWin32Reftest(MozillaReftest):
    command = [r'..\..\objdir\dist\bin\firefox.exe -P debug -reftest reftest.list']

class MozillaCrashtest(MozillaReftest):
    name = "crashtest"
    description = ["crashtest"]
    descriptionDone = ["crashtest complete"]

class MozillaUnixCrashtest(MozillaCrashtest):
    command = ["../../objdir/dist/bin/run-mozilla.sh",
               "../../objdir/dist/bin/firefox",
               "-P",
               "default",
               "-reftest",
               "crashtests.list"]

class MozillaOSXCrashtest(MozillaCrashtest):
    command = ["../../objdir/dist/Minefield.app/Contents/MacOS/firefox",
               "-console",
               "-P",
               "default",
               "-reftest",
               "crashtests.list"]

class MozillaWin32Crashtest(MozillaCrashtest):
    command = [r'..\..\objdir\dist\bin\firefox.exe -P debug -reftest crashtests.list']

class MozillaMochitest(ShellCommand):
    name = "mochitest"
    warnOnFailure = True
    description = ["mochitest"]
    descriptionDone = ["mochitest complete"]
    command = ["perl",
               "runtests.pl",
               "--appname=../../../dist/bin/firefox",
               "--autorun",
               "--console-level=INFO",
               "--close-when-done"]
     
    def createSummary(self, log):
        passCount = 0
        failCount = 0
        todoCount = 0
        for line in log.readlines():
            if "INFO Passed:" in line:
                passCount = int(line.split()[-1])
            if "INFO Failed:" in line:
                failCount = int(line.split()[-1])
            if "INFO Todo:" in line:
                todoCount = int(line.split()[-1])
        summary = "TinderboxPrint: mochitest<br/>"
        if not (passCount + failCount + todoCount):
            summary += "FAIL\n"
        else:
            summary +=  str(passCount) + "/" + str(failCount) + "/" + str(todoCount) + "\n"
        self.addCompleteLog('summary', summary)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if re.search('ERROR FAIL', cmd.logs['stdio'].getText()):
            return WARNINGS
        if re.search('ERROR TODO WORKED', cmd.logs['stdio'].getText()):
            return WARNINGS
        if re.search('FAIL Exited', cmd.logs['stdio'].getText()):
            return WARNINGS
        if not re.search('INFO PASS', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS

class MozillaWin32Mochitest(MozillaMochitest):
    command = ['perl runtests.pl --appname=..\\..\\..\\dist\\bin\\firefox.exe --autorun --console-level=INFO --close-when-done']

class MozillaOSXMochitest(MozillaMochitest):
    command = ["perl",
               "runtests.pl",
               "--appname=../../../dist/Minefield.app/Contents/MacOS/firefox",
               "--autorun",
               "--console-level=INFO",
               "--close-when-done"]

class MozillaMochichrome(ShellCommand):
    name = "mochichrome"
    warnOnFailure = True
    description = ["mochichrome"]
    descriptionDone = ["mochichrome complete"]
    command = ["perl",
              "runtests.pl",
              "--appname=../../../dist/bin/firefox",
              "--chrome",
              "--autorun",
              "--console-level=INFO",
              "--close-when-done"]
    
    def createSummary(self, log):
        passCount = 0
        failCount = 0
        todoCount = 0
        for line in log.readlines():
            if "INFO Passed:" in line:
                passCount = int(line.split()[-1])
            if "INFO Failed:" in line:
                failCount = int(line.split()[-1])
            if "INFO Todo:" in line:
                todoCount = int(line.split()[-1])
        summary = "TinderboxPrint: chrome<br/>"
        if not (passCount + failCount + todoCount):
            summary += "FAIL\n"
        else:
            summary +=  str(passCount) + "/" + str(failCount) + "/" + str(todoCount) + "\n"
        self.addCompleteLog('summary', summary)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if re.search('ERROR FAIL', cmd.logs['stdio'].getText()):
            return WARNINGS
        if re.search('FAIL Exited', cmd.logs['stdio'].getText()):
            return WARNINGS
        if not re.search('INFO PASS', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS
    

class MozillaWin32Mochichrome(MozillaMochichrome):
   command = ['perl runtests.pl --appname=..\\..\\..\\dist\\bin\\firefox.exe --chrome --autorun --console-level=INFO --close-when-done']

class MozillaOSXMochichrome(MozillaMochichrome):
   command = ["perl",
              "runtests.pl",
              "--appname=../../../dist/Minefield.app/Contents/MacOS/firefox",
              "--chrome",
              "--autorun",
              "--console-level=INFO",
              "--close-when-done"]

class MozillaBrowserChromeTest(ShellCommand):
    name = "browser chrome test"
    warnOnFailure = True
    description = ["browser chrome test"]
    descriptionDone = ["browser chrome test complete"]
    command = ["perl",
               "runtests.pl",
               "--appname=../../../dist/bin/firefox",
               "--autorun",
               "--browser-chrome", 
               "--close-when-done"]
    
    def createSummary(self, log):
        passCount = 0
        failCount = 0
        todoCount = 0
        for line in log.readlines():
            if "Pass:" in line:
                passCount = int(line.split()[-1])
            if "Fail:" in line:
                failCount = int(line.split()[-1])
            if "Todo:" in line:
                todoCount = int(line.split()[-1])
        summary = "TinderboxPrint: browser<br/>"
        if not (passCount + failCount + todoCount):
            summary += "FAIL\n"
        else:
            summary +=  str(passCount) + "/" + str(failCount) + "/" + str(todoCount) + "\n"
        self.addCompleteLog('summary', summary)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if re.search('FAIL -', cmd.logs['stdio'].getText()):
            return WARNINGS
        if re.search('FAIL Exited', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS
    
class MozillaWin32BrowserChromeTest(MozillaBrowserChromeTest):
    command = ['perl runtests.pl --appname=../../../dist/bin/firefox.exe --autorun --browser-chrome --close-when-done']

class MozillaOSXBrowserChromeTest(MozillaBrowserChromeTest):
    command = ["perl",
               "runtests.pl",
               "--appname=../../../dist/Minefield.app/Contents/MacOS/firefox",
               "--autorun",
               "--browser-chrome",
               "--close-when-done"]
