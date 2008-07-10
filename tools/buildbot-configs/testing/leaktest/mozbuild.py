# -*- Python -*-

from buildbot.process import step
from buildbot.process.step import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION, HEADER
from buildbot.steps.transfer import FileDownload
import re
import os
from tinderbox import *

MozillaEnvironments = { }

MozillaEnvironments['linux'] = {
    "DISPLAY": ':2',
    "MOZ_NO_REMOTE": '1',
    "CVS_RSH": 'ssh'
}

MozillaEnvironments['centos'] = {
    "DISPLAY": ':0',
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
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\LIB',
    "CVS_RSH": 'ssh'
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
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\LIB',
    "CVS_RSH": 'ssh'
}

MozillaEnvironments['leaks'] = {
   "XPCOM_MEM_BLOAT_LOG": '1'
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
    platform='winxp'

    def __init__(self, **kwargs):
        if 'platform' in kwargs:
            self.platform = kwargs['platform']
        if 'dir' in kwargs:
            self.dir = kwargs['dir']
        if self.platform.startswith('win'):
            self.command = r'if not exist ' + self.dir + ' mkdir ' + self.dir
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
            if self.platform.startswith('win'):
                self.command = ''
            else:
                self.command = r'mkdir -p ' + self.clobberFilePath + r' && '
            self.command += r'cd ' + self.clobberFilePath + r' && cvs -d ' + self.cvsroot + r' checkout' + self.branchString + r' -d tinderbox-configs ' + self.tboxClobberModule + r'>' + self.logDir + tboxClobberCvsCoLog + r' && cvs -d ' + self.cvsroot + r' checkout -d buildbot-configs ' + self.buildbotClobberModule + r'>' + self.logDir + buildbotClobberCvsCoLog
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
    gatherLeakData = False
    
    def __init__(self, **kwargs):
        if kwargs['gatherLeakData']:
            env = {}
            if 'env' in kwargs:
                env = kwargs['env'].copy()
            env.update(MozillaEnvironments['leaks'])
            kwargs['env'] = env
            kwargs['timeout'] = 60*60
            self.gatherLeakData = True
            self.bloatLog = "../../../logs/reftest-bloat.log"    
            self.mallocLog = "../../../logs/reftest-malloc.log"
            self.shutdownLeakLog = "../../../logs/reftest-shutdownleaks.log"
            self.name = "reftest leak"
            self.description = ["reftest leak"]
            self.descriptionDone = ["reftest leak complete"]
            if not self.command:
                self.command = r'../../objdir/dist/bin/run-mozilla.sh ../../objdir/dist/bin/firefox -P default -reftest reftest.list --trace-malloc ' + self.mallocLog + r' --shutdown-leaks ' + self.shutdownLeakLog + r' | tee ' + self.bloatLog
        else:
            self.command = ["../../objdir/dist/bin/run-mozilla.sh",
                            "../../objdir/dist/bin/firefox",
                            "-P",
                            "default",
                            "-reftest",
                            "reftest.list"]
        ShellCommandReportTimeout.__init__(self, **kwargs)
   
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

class MozillaOSXReftest(MozillaReftest):
    command = ["../../objdir/dist/Minefield.app/Contents/MacOS/firefox",
               "-console",
               "-P",
               "default",
               "-reftest",
               "reftest.list"]

class MozillaOSXReftestLeak(MozillaReftest):
    command = r'../../objdir/dist/MinefieldDebug.app/Contents/MacOS/firefox -console -P default -reftest reftest.list --trace-malloc ../../../logs/reftest-malloc.log --shutdown-leaks ../../../logs/reftest-shutdownleaks.log | tee ../../../logs/reftest-bloat.log'

class MozillaWin32Reftest(MozillaReftest):
    command = r'..\\..\\objdir\\dist\\bin\\firefox.exe -P debug -reftest reftest.list'

class MozillaWin32ReftestLeak(MozillaReftest):
    command = r'..\..\objdir\dist\bin\firefox -P default -reftest reftest.list --trace-malloc ..\..\..\logs\reftest-malloc.log --shutdown-leaks ..\..\..\logs\reftest-shutdownleaks.log | tee ..\..\..\logs\reftest-bloat.log'

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

class MozillaMochitest(ShellCommandReportTimeout):
    name = "mochitest"
    warnOnFailure = True
    description = ["mochitest"]
    descriptionDone = ["mochitest complete"]
    gatherLeakData = False

    def __init__(self, **kwargs):
        if kwargs['gatherLeakData']:
            env = {}
            if 'env' in kwargs:
                env = kwargs['env'].copy()
            env.update(MozillaEnvironments['leaks'])
            kwargs['env'] = env
            kwargs['timeout'] = 60*60
            self.gatherLeakData = True
            self.bloatLog = "../../../../../logs/mochitest-bloat.log"    
            self.mallocLog = "../../../../../logs/mochitest-malloc.log"
            self.shutdownLeakLog = "../../../../../logs/mochitest-shutdownleaks.log"
            self.name = "mochitest leak"
            self.description = ["mochitest leak"]
            self.descriptionDone = ["mochitest leak complete"]
            if not self.command:
                self.command = r'perl runtests.pl --appname=../../../dist/bin/firefox --autorun --console-level=DEBUG --close-when-done --browser-arg=--trace-malloc=' + self.mallocLog + ' --browser-arg=--shutdown-leaks=' + self.shutdownLeakLog + ' | tee ' + self.bloatLog
        else:
            self.command = ["perl",
                            "runtests.pl",
                            "--appname=../../../dist/bin/firefox",
                            "--autorun",
                            "--console-level=INFO",
                            "--close-when-done"]
        ShellCommandReportTimeout.__init__(self, **kwargs)
     
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

class MozillaOSXMochitest(MozillaMochitest):
    command = ["perl",
               "runtests.pl",
               "--appname=../../../dist/Minefield.app/Contents/MacOS/firefox",
               "--autorun",
               "--console-level=INFO",
               "--close-when-done"]

class MozillaOSXMochitestLeak(MozillaMochitest):
    command = r'perl runtests.pl --appname=../../../dist/MinefieldDebug.app/Contents/MacOS/firefox --autorun --console-level=INFO --browser-arg=--trace-malloc=../../../../../logs/mochitest-malloc.log --browser-arg=--shutdown-leaks=../../../../../logs/mochitest-shutdownleaks.log --close-when-done | tee ../../../../../logs/mochitest-bloat.log'

class MozillaWin32Mochitest(MozillaMochitest):
    command = r'perl runtests.pl --appname=..\..\..\dist\bin\firefox.exe --autorun --console-level=INFO --close-when-done'

class MozillaWin32MochitestLeak(MozillaMochitest):
    command = r'perl runtests.pl --appname=..\..\..\dist\bin\firefox.exe --autorun --console-level=INFO --close-when-done --browser-arg=--trace-malloc=..\..\..\..\..\logs\mochitest-malloc.log --browser-arg=--shutdown-leaks=..\..\..\..\..\logs\mochitest-shutdownleaks.log | tee ..\..\..\..\..\logs\mochitest-bloat.log'

class MozillaMochichrome(ShellCommandReportTimeout):
    name = "mochichrome"
    warnOnFailure = True
    description = ["mochichrome"]
    descriptionDone = ["mochichrome complete"]
    gatherLeakData = False

    def __init__(self, **kwargs):
        if kwargs['gatherLeakData']:
            env = {}
            if 'env' in kwargs:
                env = kwargs['env'].copy()
            env.update(MozillaEnvironments['leaks'])
            kwargs['env'] = env
            kwargs['timeout'] = 60*60
            self.gatherLeakData = True
            self.bloatLog = "../../../../../logs/mochichrome-bloat.log"    
            self.mallocLog = "../../../../../logs/mochichrome-malloc.log"
            self.shutdownLeakLog = "../../../../../logs/mochichrome-shutdownleaks.log"
            self.name = "mochichrome leak"
            self.description = ["mochichrome leak"]
            self.descriptionDone = ["mochichrome leak complete"]
            if not self.command:
                self.command = r'perl runtests.pl --appname=../../../dist/bin/firefox --chrome --autorun --console-level=INFO --close-when-done --browser-arg=--trace-malloc=' + self.mallocLog + ' --browser-arg=--shutdown-leaks=' + self.shutdownLeakLog + ' | tee ' + self.bloatLog
        else:
            self.command = ["perl",
                            "runtests.pl",
                            "--appname=../../../dist/bin/firefox",
                            "--chrome",
                            "--autorun",
                            "--console-level=INFO",
                            "--close-when-done"]
        ShellCommandReportTimeout.__init__(self, **kwargs)     
    
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
    
class MozillaOSXMochichrome(MozillaMochichrome):
   command = ["perl",
              "runtests.pl",
              "--appname=../../../dist/Minefield.app/Contents/MacOS/firefox",
              "--chrome",
              "--autorun",
              "--console-level=INFO",
              "--close-when-done"]

class MozillaOSXMochichromeLeak(MozillaMochichrome):
    command = r'perl runtests.pl --appname=../../../dist/bin/firefox --chrome --autorun --console-level=INFO --close-when-done --browser-arg=--trace-malloc=../../../../../logs/mochichrome-malloc.log --browser-arg=--shutdown-leaks=../../../../../logs/mochichrome-shutdownleaks.log | tee ../../../../../logs/mochichrome-bloat.log'

class MozillaWin32Mochichrome(MozillaMochichrome):
   command = r'perl runtests.pl --appname=..\..\..\dist\bin\firefox.exe --chrome --autorun --console-level=INFO --close-when-done'

class MozillaWin32MochichromeLeak(MozillaMochichrome):
   command = r'perl runtests.pl --appname=..\..\..\dist\bin\firefox.exe --chrome --autorun --console-level=INFO --close-when-done --browser-arg=--trace-malloc=..\..\..\..\..\logs\mochichrome-malloc.log --browser-arg=--shutdown-leaks=..\..\..\..\..\logs\mochichrome-shutdownleaks.log | tee ..\..\..\..\..\logs\mochichrome-bloat.log'

class MozillaBrowserChromeTest(ShellCommandReportTimeout):
    name = "browser chrome test"
    warnOnFailure = True
    description = ["browser chrome test"]
    descriptionDone = ["browser chrome test complete"]
    gatherLeakData = False

    def __init__(self, **kwargs):
        if kwargs['gatherLeakData']:
            env = {}
            if 'env' in kwargs:
                env = kwargs['env'].copy()
            env.update(MozillaEnvironments['leaks'])
            kwargs['env'] = env
            kwargs['timeout'] = 60*60
            self.gatherLeakData = True
            self.bloatLog = "../../../../../logs/browser-chrome-bloat.log"
            self.mallocLog = "../../../../../logs/browser-chrome-malloc.log"
            self.shutdownLeakLog = "../../../../../logs/browser-chrome-shutdownleaks.log"
            self.name = "browser chrome leak"
            self.description = ["browser chrome leak"]
            self.descriptionDone = ["browser chrome leak complete"]
            if not self.command:
                self.command = r'perl runtests.pl --appname=../../../dist/bin/firefox --browser-chrome --autorun --console-level=INFO --close-when-done --browser-arg=--trace-malloc=' + self.mallocLog + ' --browser-arg=--shutdown-leaks=' + self.shutdownLeakLog + ' | tee ' + self.bloatLog
        else:
            self.command = ["perl",
                            "runtests.pl",
                            "--appname=../../../dist/bin/firefox",
                            "--autorun",
                            "--browser-chrome", 
                            "--close-when-done"]
        ShellCommandReportTimeout.__init__(self, **kwargs)     
    
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

class MozillaOSXBrowserChromeTest(MozillaBrowserChromeTest):
    command = ["perl",
               "runtests.pl",
               "--appname=../../../dist/Minefield.app/Contents/MacOS/firefox",
               "--autorun",
               "--browser-chrome",
               "--close-when-done"]

class MozillaOSXBrowserChromeTestLeak(MozillaBrowserChromeTest):
    command = r'perl runtests.pl --appname=../../../dist/MinefieldDebug.app/Contents/MacOS/firefox --autorun --browser-chrome --close-when-done --browser-arg=--trace-malloc=../../../../../logs/browser-chrome-malloc.log --browser-arg=--shutdown-leaks=../../../../../logs/browser-chrome-shutdownleaks.log | tee ../../../../../logs/browser-chrome-bloat.log'
    
class MozillaWin32BrowserChromeTest(MozillaBrowserChromeTest):
    command = r'perl runtests.pl --appname=..\..\..\dist\bin\firefox.exe --autorun --browser-chrome --close-when-done'

class MozillaWin32BrowserChromeTestLeak(MozillaBrowserChromeTest):
    command = r'perl runtests.pl --appname=..\..\..\dist\bin\firefox.exe --autorun --browser-chrome --close-when-done --browser-arg=--trace-malloc=..\..\..\..\..\logs\browser-chrome-malloc.log --browser-arg=--shutdown-leaks=..\..\..\..\..\logs\browser-chrome-shutdownleaks.log | tee ..\..\..\..\..\logs\browser-chrome-bloat.log'

class rotateLog(ShellCommandReportTimeout):
    warnOnFailure = True
    
    def __init__(self, **kwargs):
        if not 'log' in kwargs:
            return FAILURE
        if kwargs['testname']:
            testname = kwargs['testname'] + " "
        else:
            testname = ""            
        self.name = "rotate " + testname + "log"
        self.description = "rotate " + testname + "log"
        self.descriptionDone = "rotate " + testname + "log complete"
        kwargs['command'] = ["cp",
                             kwargs['log'],
                             kwargs['log'] + '.old'
                             ]
        ShellCommandReportTimeout.__init__(self, **kwargs)

class compareBloatLogs(ShellCommandReportTimeout):
    warnOnFailure = True
    bloatLog = "" 

    def __init__(self, **kwargs):
        if not 'bloatLog' in kwargs:
            return FAILURE
        if kwargs['testname']:
            testname = kwargs['testname'] + " "
        else:
            testname = ""
        self.name = "compare " + testname + "bloat logs"
        self.description = "compare " + testname + "bloat logs"
        self.descriptionDone = "compare " + testname + "bloat logs complete"
        self.bloatLog = kwargs['bloatLog']
        kwargs['command'] = ["perl",
                             "mozilla/tools/tinderbox/bloatdiff.pl",
                             kwargs['bloatLog'] + '.old',
                             kwargs['bloatLog']
                             ]
        ShellCommandReportTimeout.__init__(self, **kwargs)
            
    def createSummary(self, log):
        summary = "######################## BLOAT STATISTICS\n"
        totalLineList = []
        leaks = 0
        bloat = 0
        for line in log.readlines():
            summary += line
            if leaks == 0 and bloat == 0:
                if "TOTAL" in line:
                    m = re.search('TOTAL\s+(\d+)\s+[\-\d\.]+\%\s+(\d+)',
                                  line)
                    leaks = int(m.group(1))
                    bloat = int(m.group(2))
        summary += "######################## END BLOAT STATISTICS\n\n"

        # Scrape for leak/bloat totals from TOTAL line
        # TOTAL 23 0% 876224        
        summary += "leaks = %d\n" % leaks
        summary += "bloat = %d\n" % bloat

        leaksAbbr = "RLk";
        leaksTestname = "refcnt_leaks"
#        bloatTestname = "refcnt_bloat"
        leaksTestnameLabel = "refcnt Leaks"
#        bloatTestnameLabel = "refcnt Bloat"

        tinderLink = tinderboxPrint(leaksTestname,
                                    leaksTestnameLabel, 
                                    0,
                                    'bytes',
                                    leaksAbbr,
                                    formatBytes(leaks,3)
                                    )
        summary += tinderLink
        self.addCompleteLog(leaksAbbr + ":" + formatBytes(leaks,3),
                            summary)

class compareLeakLogs(ShellCommandReportTimeout):
    warnOnFailure = True
    mallocLog = "" 
    leakFailureThreshold = 7261838
    leakStats = {}
    leakStats['old'] = {}
    leakStats['new'] = {}
    leaksAllocsRe = re.compile('Leaks: (\d+) bytes, (\d+) allocations')
    heapRe = re.compile('Maximum Heap Size: (\d+) bytes')
    bytesAllocsRe = re.compile('(\d+) bytes were allocated in (\d+) allocations')

    def __init__(self, **kwargs):
        env = {}
        if 'env' in kwargs:
            env = kwargs['env'].copy()
            env['LIBPATH'] = '.'
            env['LIBRARY_PATH'] = '.'
            env['LD_LIBRARY_PATH'] = '.'
            kwargs['env'] = env
        if 'leakFailureThreshold' in kwargs:
            self.leakFailureThreshold = kwargs['leakFailureThreshold']
        if not 'mallocLog' in kwargs:
            return FAILURE
        self.mallocLog = kwargs['mallocLog']
        if kwargs['testname']:
            testname = kwargs['testname'] + " "
        else:
            testname = ""
        self.testname = testname
        self.name = "compare " + testname + "leak logs"
        self.description = "compare " + testname + "leak logs"
        self.descriptionDone = "compare " + testname + "leak logs complete"
        kwargs['command'] = r'echo CURRENT LEAK RESULTS;echo;./leakstats ' + kwargs['mallocLog'] + r';echo;echo PREVIOUS LEAK RESULTS;echo; ./leakstats ' + kwargs['mallocLog'] + '.old'
        ShellCommandReportTimeout.__init__(self, **kwargs)

    def evaluateCommand(self, cmd):
        superResult = ShellCommandReportTimeout.evaluateCommand(self, cmd)
        if self.leakStats['new']['leaks'] and int(self.leakStats['new']['leaks']) > int(self.leakFailureThreshold):
            return WARNINGS
        return superResult
            
    def createSummary(self, log):
        summary = self.testname + " trace-malloc bloat test: leakstats\n"

        resultSet = 'new'
        for line in log.readlines():
            summary += line
            if 'PREVIOUS LEAK RESULTS' in line:
                resultSet = 'old'
                continue
            m = self.leaksAllocsRe.search(line)
            if m:
                self.leakStats[resultSet]['leaks'] = m.group(1)
                self.leakStats[resultSet]['leakedAllocs'] = m.group(2)
                continue
            m = self.heapRe.search(line)
            if m:
                self.leakStats[resultSet]['mhs'] = m.group(1)
                continue
            m = self.bytesAllocsRe.search(line)
            if m:
                self.leakStats[resultSet]['bytes'] = m.group(1)
                self.leakStats[resultSet]['allocs'] = m.group(2)
                continue
            
        slug = 'Lk:' + formatBytes(self.leakStats['new']['leaks'],3)
        slug += ', MH:' + formatBytes(self.leakStats['new']['mhs'],3)
        slug += ', A:' + formatCount(self.leakStats['new']['allocs'],3)

        self.addCompleteLog(slug, str(self.leakStats))

class compareShutdownLeakLogs(ShellCommandReportTimeout):
    warnOnFailure = True
    shutdownLeakLog = "" 

    def __init__(self, **kwargs):
        if not 'shutdownLeakLog' in kwargs:
            return FAILURE
        self.shutdownLeakLog = kwargs['shutdownLeakLog']
        if kwargs['testname']:
            testname = kwargs['testname'] + " "
        else:
            testname = ""
        self.testname = testname
        self.name = "compare " + testname + "shutdown leak logs"
        self.description = "compare " + testname + "shutdown leak logs"
        self.descriptionDone = "compare " + testname + "shutdown leak logs complete"
        kwargs['command'] = ["perl",
                             "mozilla/tools/trace-malloc/diffbloatdump.pl",
                             "--depth=15",
                             kwargs['shutdownLeakLog']+'.old',
                             kwargs['shutdownLeakLog']
                             ]
        ShellCommandReportTimeout.__init__(self, **kwargs)

class createProfile(ShellCommandReportTimeout):
    name = "create profile"
    warnOnFailure = True
    description = ["create profile"]
    descriptionDone = ["create profile complete"]
    command = r'python mozilla/testing/tools/profiles/createTestingProfile.py --binary mozilla/objdir/dist/bin/firefox'

class createProfileWin(createProfile):
    command = r'python mozilla\testing\tools\profiles\createTestingProfile.py --binary mozilla\objdir\dist\bin\firefox.exe'
