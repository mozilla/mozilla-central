from buildbot.process.step import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION
import re

MozillaEnvironments = {}

MozillaEnvironments['linux'] = {
    "TEST_DIR": '/work/mozilla/mozilla.com/test.mozilla.com/www',
    "DISPLAY": ':0',
    "MOZ_NO_REMOTE": '1',
    "CVSROOT": r':ext:unittest@cvs.mozilla.org:/cvsroot',
    "CVS_RSH": 'ssh'
}

MozillaEnvironments['macosxppc'] = {
    "TEST_DIR": '/work/mozilla/mozilla.com/test.mozilla.com/www',
    "MOZ_NO_REMOTE": '1',
    "CVSROOT": r':ext:unittest@cvs.mozilla.org:/cvsroot',
    "CVS_RSH": 'ssh'
}

MozillaEnvironments['windows'] = {
    "TEST_DIR": '/work/mozilla/mozilla.com/test.mozilla.com/www',
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "MOZ_TOOLS": 'C:\\moztools',
    "CYGWINBASE": 'C:\\work\\cygwin',
    "CVS_RSH": 'ssh',
    "PATH": 'C:\\Python24;' + \
            'C:\\Python24\\Scripts;' + \
            'C:\\work\\cygwin\\bin;' + \
            'C:\\WINDOWS\\System32;' + \
            'C:\\WINDOWS;' + \
            'C:\\WINDOWS\\System32\\Wbem;'
}

class SisyphusJSTest(ShellCommand):
    name = "jstest"
    description = ["jstest"]
    descriptionDone = ["jstest complete"]
    product = "js"
    
    def __init__(self, **kwargs):
        self.flunkOnFailure = True
        self.warnOnWarnings = True
        self.warnOnFailure = True
        
        if 'buildType' in kwargs:
            self.buildType = kwargs['buildType']
        else:
            self.buildType = "opt"
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        else:
            self.branch = "1.9.0"
        ShellCommand.__init__(self, **kwargs)
    
    def start(self):
        self.setCommand(["tests/mozilla.org/js/runtests.sh",
               "-p", self.product, "-b", self.branch, "-T", self.buildType,
               "-B", "checkout build", "-c", "-S"])
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if re.search('TEST_RESULT=FAILED', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS
    

class SisyphusBrowserTest(SisyphusJSTest):
    name = "browsertest"
    description = ["browsertest"]
    descriptionDone = ["browsertest complete"]
    product = "firefox"
    
    def start(self):
        self.setCommand(["tests/mozilla.org/js/runtests.sh",
               "-p", self.product, "-b", self.branch, "-T", self.buildType,
               "-B", "checkout build", "-c", "-R", "-S"])
        ShellCommand.start(self)

class CygwinBashShellCommand(ShellCommand):
    def start(self):
        commandString = ' '.join(self.command)
        self.setCommand("bash -c " + "'" + commandString + "'")
        ShellCommand.start(self)

class SisyphusJSTestWin(CygwinBashShellCommand):
    name = "jstest"
    description = ["jstest"]
    descriptionDone = ["jstest complete"]
    product = "js"
    
    def __init__(self, **kwargs):
        self.flunkOnFailure = True
        self.warnOnWarnings = True
        self.warnOnFailure = True
        
        if 'buildType' in kwargs:
            self.buildType = kwargs['buildType']
        else:
            self.buildType = "opt"
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        else:
            self.branch = "1.9.0"
        ShellCommand.__init__(self, **kwargs)
    
    def start(self):
        self.command = ["tests/mozilla.org/js/runtests.sh",
                   "-p", self.product, "-b", self.branch,
                   "-T", self.buildType, "-B", "checkout-build", "-c", "-S"]
        CygwinBashShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return WARNINGS
        if re.search('TEST_RESULT=FAILED', cmd.logs['stdio'].getText()):
            return WARNINGS
        return SUCCESS
    

class SisyphusBrowserTestWin(SisyphusJSTestWin):
    name = "browsertest"
    description = ["browsertest"]
    descriptionDone = ["browsertest complete"]
    product = "firefox"

    def start(self):
        self.command = ["tests/mozilla.org/js/runtests.sh",
                   "-p", self.product, "-b", self.branch,
                   "-T", self.buildType, "-B", "checkout-build", "-c", "-R", "-S"]
        CygwinBashShellCommand.start(self)
    
