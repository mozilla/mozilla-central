# -*- Python -*-

from buildbot.process import step
from buildbot.process.step import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION, HEADER
import re
import os

MozillaEnvironments = { }

MozillaEnvironments['linux'] = {
    "DISPLAY": ':2',
    "MOZ_NO_REMOTE": '1'
}

MozillaEnvironments['centos'] = {
    "MOZ_NO_REMOTE": '1',
    "CVS_RSH": 'ssh'
}

MozillaEnvironments['osx'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "CVS_RSH": 'ssh'
}

# standard vc8 express build env; vc8 normal will be very similar, 
# just different platform SDK location.  we can build both from one 
# generic template.
MozillaEnvironments['vc8'] = {
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

MozillaEnvironments['mozbuild_pgo'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "MOZ_AIRBAG": '1',
    "MOZ_CRASHREPORTER_NO_REPORT": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "VCVARS": 'D:\\msvs8\\VC\\bin\\vcvars32.bat',
    "MOZ_MSVCVERSION": '8',
    "MOZILLABUILD": 'D:\\mozilla-build',
    "MOZILLABUILDDRIVE": 'D:',
    "MOZILLABUILDPATH": '\\mozilla-build\\',
    "MOZ_TOOLS": 'D:\\mozilla-build\\moztools',
    "CVS_RSH": 'ssh',
    "VSINSTALLDIR": 'D:\\msvs8',
    "VCINSTALLDIR": 'D:\\msvs8\\VC',
    "FrameworkDir": 'C:\\WINDOWS\\Microsoft.NET\\Framework',
    "FrameworkVersion": 'v2.0.50727',
    "FrameworkSDKDir": 'D:\\msvs8\\SDK\\v2.0',
    "MSVCDir": 'D:\\msvs8\\VC',
    "DevEnvDir": "D:\\msvs8\\Common7\\IDE",
    "PATH": 'D:\\mozilla-build\\msys\\local\\bin;' + 
            'D:\\mozilla-build\\wget;' + 
            'D:\\mozilla-build\\7zip;' + 
            'D:\\mozilla-build\\blat261\\full;' + 
            'D:\\mozilla-build\\svn-win32-1.4.2\\bin;' + 
            'D:\\mozilla-build\\upx203w;' + 
            'D:\\mozilla-build\\xemacs\\XEmacs-21.4.19\\i586-pc-win32;' + 
            'D:\\mozilla-build\\info-zip;' + 
            'D:\\mozilla-build\\nsis-2.22;' + 
            '.;' + 
            'D:\\mozilla-build\\msys\\bin;' + 
            'D:\\buildbot\\python24;' + 
            'D:\\buildbot\\python24\\scripts;' + 
            'D:\\sdks\\v6.0\\Bin;' + 
            'D:\\msvs8\\Common7\\IDE;' + 
            'D:\\msvs8\\VC\\BIN;' + 
            'D:\\msvs8\\Common7\\Tools;' + 
            'D:\\msvs8\\Common7\\Tools\\bin;' + 
            'D:\\msvs8\\VC\\PlatformSDK\\bin;' + 
            'D:\\msvs8\\SDK\\v2.0\\Bin;' + 
            'C:\\WINDOWS\\Microsoft.NET\\Framework\\v2.0.50727;' + 
            'D:\\msvs8\\VC\\VCPackages;' + 
            'C:\\WINDOWS\\System32;' + 
            'C:\\WINDOWS;' + 
            'C:\\WINDOWS\\System32\\Wbem;' + 
            'D:\\mozilla-build\\moztools\\bin;',
    "INCLUDE": 'D:\\sdks\\v6.0\\Include;' + 
               'D:\\sdks\\v6.0\\Include\gl;' + 
               'D:\\msvs8\\VC\\ATLMFC\\INCLUDE;' + 
               'D:\\msvs8\\VC\\INCLUDE;' + 
               'D:\\msvs8\\VC\\PlatformSDK\\include;' + 
               'D:\\msvs8\\SDK\\v2.0\\include;' + 
               '%INCLUDE%',
    "LIB": 'D:\\sdks\\v6.0\\lib;' + 
           'D:\\msvs8\\VC\\ATLMFC\\LIB;' + 
           'D:\\msvs8\\VC\\LIB;' + 
           'D:\\msvs8\\VC\\PlatformSDK\\lib;' + 
           'D:\\msvs8\\SDK\\v2.0\\lib;',
    "LIBPATH": 'C:\\WINDOWS\\Microsoft.NET\\Framework\\v2.0.50727;' + 
               'D:\\msvs8\\VC\\ATLMFC\\LIB'
}


cvsCoLog = "cvsco.log"
tboxClobberCvsCoLog = "tbox-CLOBBER-cvsco.log"
buildbotClobberCvsCoLog = "buildbot-CLOBBER-cvsco.log"

class ShellCommandReportTimeout(ShellCommand):
    """We subclass ShellCommand so that we can bubble up the timeout errors
    to tinderbox that normally only get appended to the buildbot slave logs.
    """

    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        for line in cmd.logs['stdio'].readlines(channel=HEADER):
            if "command timed out" in line:
                self.addCompleteLog('timeout',
                                    'buildbot.slave.commands.TimeoutError: ' +
                                    line +
                                    "TinderboxPrint: " +
                                    self.name + " timeout<br/>")
                return WARNINGS
        return superResult

class CreateDir(ShellCommandReportTimeout):
    name = "create dir"
    haltOnFailure = False
    warnOnFailure = True

    def __init__(self, **kwargs):
        if not 'platform' in kwargs:
            return FAILURE
        self.platform = kwargs['platform']
        if 'dir' in kwargs:
            self.dir = kwargs['dir']
        if self.platform.startswith('win'):
            self.command = r'if not exist ' + self.dir + r' mkdir ' + self.dir
        else:
            self.command = ['mkdir', '-p', self.dir]
        ShellCommandReportTimeout.__init__(self, **kwargs)

class TinderboxShellCommand(ShellCommand):
    haltOnFailure = False
    
    def evaluateCommand(self, cmd):
       return SUCCESS

class MozillaCheckoutClientMk(ShellCommandReportTimeout):
    haltOnFailure = True
    cvsroot = ":pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot"
    
    def __init__(self, **kwargs):
        if 'cvsroot' in kwargs:
            self.cvsroot = kwargs['cvsroot']
        if not 'command' in kwargs:
            kwargs['command'] = ["cvs", "-d", self.cvsroot, "co", "mozilla/client.mk"]
        ShellCommandReportTimeout.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["client.mk update"]
    
 
class MozillaClientMkPull(ShellCommandReportTimeout):
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
        ShellCommandReportTimeout.__init__(self, **kwargs)
    
    def describe(self, done=False):
        if not done:
            return ["pulling (" + self.project + ")"]
        return ["pull (" + self.project + ")"]
    

class MozillaPackage(ShellCommandReportTimeout):
    name = "package"
    warnOnFailure = True
    description = ["packaging"]
    descriptionDone = ["package"]
    command = ["make"]

class UpdateClobberFiles(ShellCommandReportTimeout):
    name = "update clobber files"
    warnOnFailure = True
    description = "updating clobber files"
    descriptionDone = "clobber files updated"
    clobberFilePath = "clobber_files/"
    logDir = '../logs/'

    def __init__(self, **kwargs):
        if not 'platform' in kwargs:
            return FAILURE
        self.platform = kwargs['platform']
        if 'clobberFilePath' in kwargs:
            self.clobberFilePath = kwargs['clobberFilePath']
        if 'logDir' in kwargs:
            self.logDir = kwargs['logDir']
        if self.platform.startswith('win'):
            self.tboxClobberModule = 'mozilla/tools/tinderbox-configs/firefox/win32'
        else:
            self.tboxClobberModule = 'mozilla/tools/tinderbox-configs/firefox/' + self.platform
        if 'cvsroot' in kwargs:
            self.cvsroot = kwargs['cvsroot']
        if 'branch' in kwargs:
            self.branchString = ' -r ' + kwargs['branch']
            self.buildbotClobberModule = 'mozilla/tools/buildbot-configs/testing/unittest/CLOBBER/firefox/' + kwargs['branch'] + '/' + self.platform
        else:
            self.branchString = ''
            self.buildbotClobberModule = 'mozilla/tools/buildbot-configs/testing/unittest/CLOBBER/firefox/TRUNK/' + self.platform 
            
        if not 'command' in kwargs:
            self.command = r'cd ' + self.clobberFilePath + r' && cvs -d ' + self.cvsroot + r' checkout' + self.branchString + r' -d tinderbox-configs ' + self.tboxClobberModule + r'>' + self.logDir + tboxClobberCvsCoLog + r' && cvs -d ' + self.cvsroot + r' checkout -d buildbot-configs ' + self.buildbotClobberModule + r'>' + self.logDir + buildbotClobberCvsCoLog
        ShellCommandReportTimeout.__init__(self, **kwargs)

class MozillaClobber(ShellCommandReportTimeout):
    name = "clobber"
    description = "checking clobber file"
    descriptionDone = "clobber checked"
    clobberFilePath = "clobber_files/"
    logDir = 'logs/'
    
    def __init__(self, **kwargs):
        if 'platform' in kwargs:
            self.platform = kwargs['platform']
        if 'logDir' in kwargs:
            self.logDir = kwargs['logDir']
        if 'clobberFilePath' in kwargs:
            self.clobberFilePath = kwargs['clobberFilePath']
        if not 'command' in kwargs:
            tboxGrepCommand = r"grep -q '^U tinderbox-configs.CLOBBER' " + self.logDir + tboxClobberCvsCoLog
            tboxPrintHeader = "echo Tinderbox clobber file updated"
            tboxCatCommand = "cat %s/tinderbox-configs/CLOBBER" % self.clobberFilePath
            buildbotGrepCommand = r"grep -q '^U buildbot-configs.CLOBBER' " + self.logDir + buildbotClobberCvsCoLog
            buildbotPrintHeader = "echo Buildbot clobber file updated"
            buildbotCatCommand = "cat %s/buildbot-configs/CLOBBER" % self.clobberFilePath
            rmCommand = "rm -rf mozilla"
            printExitStatus = "echo No clobber required"
            self.command = tboxGrepCommand + r' && ' + tboxPrintHeader + r' && ' + tboxCatCommand + r' && ' + rmCommand + r'; if [ $? -gt 0 ]; then ' + buildbotGrepCommand + r' && ' + buildbotPrintHeader + r' && ' + buildbotCatCommand + r' && ' + rmCommand + r'; fi; if [ $? -gt 0 ]; then ' + printExitStatus + r'; fi'
        ShellCommandReportTimeout.__init__(self, **kwargs)

class MozillaClobberWin(ShellCommandReportTimeout):
    name = "clobber win"
    description = "checking clobber file"
    descriptionDone = "clobber finished"
    
    def __init__(self, **kwargs):
        platformFlag = ""
        slaveNameFlag = ""
        branchFlag = ""
        if 'platform' in kwargs:
            platformFlag = " --platform=" + kwargs['platform']
        if 'slaveName' in kwargs:
            slaveNameFlag = " --slaveName=" + kwargs['slaveName']
        if 'branch' in kwargs:
            branchFlag = " --branch=" + kwargs['branch']
        if not 'command' in kwargs:
            self.command = 'python C:\\Utilities\\killAndClobberWin.py' + platformFlag + slaveNameFlag + branchFlag
        ShellCommandReportTimeout.__init__(self, **kwargs)

class MozillaCheck(ShellCommandReportTimeout):
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
        superResult = ShellCommandReportTimeout.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if None != re.search('FAIL', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS
    
class MozillaReftest(ShellCommandReportTimeout):
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
        superResult = ShellCommandReportTimeout.evaluateCommand(self, cmd)
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
    command = [r'..\..\objdir\dist\bin\firefox.exe -P default -reftest reftest.list']

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
    command = [r'..\..\objdir\dist\bin\firefox.exe -P default -reftest crashtests.list']

class MozillaMochitest(ShellCommandReportTimeout):
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
        superResult = ShellCommandReportTimeout.evaluateCommand(self, cmd)
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

class MozillaMochichrome(ShellCommandReportTimeout):
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
        superResult = ShellCommandReportTimeout.evaluateCommand(self, cmd)
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

class MozillaBrowserChromeTest(ShellCommandReportTimeout):
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
        superResult = ShellCommandReportTimeout.evaluateCommand(self, cmd)
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

class CreateProfile(ShellCommandReportTimeout):
    name = "create profile"
    warnOnFailure = True
    description = ["create profile"]
    descriptionDone = ["create profile complete"]
    command = r'python mozilla/testing/tools/profiles/createTestingProfile.py --clobber --binary mozilla/objdir/dist/bin/firefox'

class CreateProfileWin(CreateProfile):
    command = r'python mozilla\testing\tools\profiles\createTestingProfile.py --clobber --binary mozilla\objdir\dist\bin\firefox.exe'
