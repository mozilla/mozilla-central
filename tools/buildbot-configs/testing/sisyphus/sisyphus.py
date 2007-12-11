from buildbot.process.step import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION
import re

MozillaEnvironments = {}

MozillaEnvironments['linux'] = {
    "DISPLAY": ':0',
    "MOZ_NO_REMOTE": '1',
    "CVSROOT": r':pserver:anonymous@cvs.mozilla.org:/cvsroot'
}

MozillaEnvironments['macosxppc'] = {
    "MOZ_NO_REMOTE": '1',
    "CVSROOT": r':pserver:anonymous@cvs.mozilla.org:/cvsroot'
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
        self.setCommand(["./tests/mozilla.org/js/runtests.sh",
               "-p", self.product, "-b", self.branch, "-T", self.buildType,
               "-B", "checkout build", "-S"])
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
    
