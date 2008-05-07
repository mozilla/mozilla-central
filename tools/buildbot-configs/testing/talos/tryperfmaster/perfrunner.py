# -*- Python -*-

from buildbot.process.buildstep import BuildStep
from buildbot.buildset import BuildSet
from buildbot.sourcestamp import SourceStamp
from buildbot.steps.shell import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION

import re, urllib, sys, os
from time import mktime, strptime, strftime, localtime
from datetime import datetime
from os import path
import copy

MozillaEnvironments = { }

# platform SDK location.  we can build both from one generic template.
# modified from vc8 environment
MozillaEnvironments['vc8perf'] = {
    "MOZ_CRASHREPORTER_NO_REPORT": '1',
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "CYGWINBASE": 'C:\\cygwin',
    "PATH": 'C:\\Python24;' + \
            'C:\\Python24\\Scripts;' + \
            'C:\\cygwin\\bin;' + \
            'C:\\WINDOWS\\System32;' + \
            'C:\\program files\\gnuwin32\\bin;' + \
            'C:\\WINDOWS;'
}

MozillaEnvironments['linux'] = {
    "MOZ_CRASHREPORTER_NO_REPORT": '1',
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "DISPLAY": ":0",
}

MozillaEnvironments['mac'] = {
    "MOZ_NO_REMOTE": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "MOZ_CRASHREPORTER_NO_REPORT": '1',
    # for extracting dmg's
    "PAGER": '/bin/cat',
}

class ApacheDirectory:
    sortByDateString = "?C=M;O=A"
    lineParsingRegexp = r'<img.*?> <a.*?>(.*?)</a>[\s]+(\d\d-\w\w\w-\d\d\d\d \d\d:\d\d)\s+(.+?)\s'
    
    def __init__(self, url):
        self.page = []
        self.url = url
        self.lineParserRE = re.compile(self.lineParsingRegexp)
    
    def _retrievePageAt(self, urlString):
        content = []
        try:
            opener = urllib.URLopener()
            page = opener.open(urlString + self.sortByDateString)
            content = page.readlines()
            opener.close()
        except:
            print "unable to retrieve page at: " + self.url
        return content
    
    def _buildPage(self, lines):
        for line in lines:
            if line.startswith("<img src="):
                match = self.lineParserRE.match(line)
                self.page.append(match.groups())
    
    def _retrievePage(self):
        content = self._retrievePageAt(self.url)
        self._buildPage(content)
    
    def _timeForString(self, dateString):
        t = mktime(strptime(dateString, "%d-%b-%Y %H:%M"))
    
    def update(self):
        self._retrievePage()
    
    def testrun(self):
        self.update()
        for entry in self.page:
            print entry
    
    def getPage(self):
        return self.page
    
    def getLatestEntry(self):
        return self.page.last()
    
    def popLatestEntry(self):
        return self.page.pop()
    

class LatestFileURL(ApacheDirectory): 
    
    def getLatestFilename(self):
        '''returns tuple with full url to file[0] and just filename[1]'''
        self.update()
        while self.page:
            entry = self.popLatestEntry()
            subdir = ApacheDirectory(self.url + entry[0])
            subdir.update()
            subPageItems = subdir.getPage()
            for item in subPageItems:
                if item[0].endswith(self.filenameSearchString):
                    return (self.url + entry[0] + item[0], item[0])
        return ('', '')
    
    def testrun(self):
        (fullURL, name) = self.getLatestFilename()
        print fullURL
    
    def __init__(self, url, filenameSearchString):
        ApacheDirectory.__init__(self, url)
        self.filenameSearchString = filenameSearchString
    

class MozillaChangePusher(BuildStep):
    warnOnFailure = True
    name = "resubmit extra changes"

    def start(self):
        changes = self.step_status.build.getChanges()
        if len(changes) > 1:
            builderName = self.step_status.build.builder.name
            remainingChanges = changes[1:] # everything but the first
            # get rid of the rest of the changes in the Build and BuildStatus
            changes = changes[:1] # only the first one
            self.step_status.build.changes = changes
            bs = BuildSet([builderName], SourceStamp(changes=remainingChanges))
            # submit the buildset back to the BuildMaster
            self.build.builder.botmaster.parent.submitBuildSet(bs)
            self.finished(SUCCESS)
            return

        self.finished(SKIPPED)
        return SKIPPED


class MozillaWgetLatest(ShellCommand):
    """Download built Firefox client from nightly staging directory."""
    haltOnFailure = True
    
    def __init__(self, **kwargs):
        assert kwargs['url'] != ""
        assert kwargs['filenameSearchString'] != ""
        self.url = kwargs['url']
        self.filenameSearchString = kwargs['filenameSearchString']
        self.branch = "HEAD"
        self.fileURL = ""
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if not 'command' in kwargs:
            kwargs['command'] = ["wget"]
        ShellCommand.__init__(self, **kwargs)
    
    def getFilename(self):
        return self.filename
    
    def describe(self, done=False):
        return ["Wget Download"]
    
    def start(self):
        urlGetter = LatestFileURL(self.url, self.filenameSearchString)
        (self.fileURL, self.filename) = urlGetter.getLatestFilename()
        if self.branch:
            self.setProperty("fileURL", self.fileURL)
            self.setProperty("filename", self.filename)
        self.setCommand(["wget", "-nv", "-N", "--no-check-certificate", self.fileURL])
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        if None != re.search('ERROR', cmd.logs['stdio'].getText()):
            return FAILURE
        return SUCCESS


class MozillaTryServerWgetLatest(MozillaWgetLatest):
    def evaluateCommand(self, cmd):
        who, rest = self.getProperty("filename").split('-', 1)
        identifier = rest.split("-firefox-try")[0]
        msg =  'TinderboxPrint: %s\n' % who
        msg += 'TinderboxPrint: %s\n' % identifier
        self.addCompleteLog("header", msg)

        return MozillaWgetLatest.evaluateCommand(self, cmd)
    

class MozillaInstallZip(ShellCommand):
    """Install given file, unzipping to executablePath"""
    
    def __init__(self, **kwargs):
        self.filename = ""
        self.branch = ""
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'filename' in kwargs:
            self.filename = kwargs['filename']
        if not 'command' in kwargs:
            kwargs['command'] = ["unzip", "-o"]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Install zip"]
    
    def start(self):
        # removed the mkdir because this happens on the master, not the slave
        if not self.filename:
            if self.branch:
                self.filename = self.getProperty("filename")
            else:
                return FAILURE
        if self.filename:
            self.command.append(self.filename)
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        if None != re.search('ERROR', cmd.logs['stdio'].getText()):
            return FAILURE
        if None != re.search('Usage:', cmd.logs['stdio'].getText()):
            return FAILURE
        return SUCCESS
    

class MozillaUpdateConfig(ShellCommand):
    """Configure YAML file for run_tests.py"""
    
    def __init__(self, **kwargs):
        self.title = "default"
        self.branch = ""
        self.currentDate = ""
        if 'build' in kwargs:
            self.title = kwargs['build'].slavename
            self.changes = kwargs['build'].source.changes
            self.buildid = strftime("%Y%m%d%H%M", localtime(self.changes[0].when))
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        assert 'configPath' in kwargs
        assert 'executablePath' in kwargs
        self.configPath = kwargs['configPath']
        self.exePath = kwargs['executablePath']
        if not 'command' in kwargs:
            kwargs['command'] = ["python", "PerfConfigurator.py", "-v",
                                 "-e", self.exePath, "-c", self.configPath,
                                 "-t", self.title, "-b", self.branch,
                                 "-i", self.buildid]
        ShellCommand.__init__(self, **kwargs)

    def describe(self, done=False):
        return ["Update config"]
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        stdioText = cmd.logs['stdio'].getText()
        if None != re.search('ERROR', stdioText):
            return FAILURE
        if None != re.search('USAGE:', stdioText):
            return FAILURE
        configFileMatch = re.search('outputName\s*=\s*(\w*?.yml)', stdioText)
        if not configFileMatch:
            return FAILURE
        else:
            self.setProperty("configFile", configFileMatch.group(1))
        return SUCCESS
    

class MozillaRunPerfTests(ShellCommand):
    """Run the performance tests"""
    
    def __init__(self, **kwargs):
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if not 'command' in kwargs:
            kwargs['command'] = ["python", "run_tests.py"]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Run performance tests"]
    
    def createSummary(self, log):
        summary = []
        for line in log.readlines():
            if "RETURN:" in line:
                summary.append(line.replace("RETURN:", "TinderboxPrint:"))
            if "FAIL:" in line:
                summary.append(line.replace("FAIL:", "TinderboxPrint:FAIL:"))
        self.addCompleteLog('summary', "\n".join(summary))
    
    def start(self):
        """docstring for start"""
        self.command = copy.copy(self.command)
        self.command.append(self.getProperty("configFile"))
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        stdioText = cmd.logs['stdio'].getText()
        if SUCCESS != superResult:
            return FAILURE
        if None != re.search('ERROR', stdioText):
            return FAILURE
        if None != re.search('USAGE:', stdioText):
            return FAILURE
        if None != re.search('FAIL:', stdioText):
            return WARNINGS
        return SUCCESS

class MozillaInstallTarBz2(ShellCommand):
    """Install given file, unzipping to executablePath"""
    
    def __init__(self, **kwargs):
        self.filename = ""
        self.branch = ""
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'filename' in kwargs:
            self.filename = kwargs['filename']
        if not 'command' in kwargs:
            kwargs['command'] = ["tar", "-jvxf"]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Install tar.gz"]
    
    def start(self):
        if not self.filename:
            if self.branch:
                self.filename = self.getProperty("filename")
            else:
                return FAILURE
        if self.filename:
            self.command.append(self.filename)
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        return SUCCESS

class MozillaInstallTarGz(ShellCommand):
    """Install given file, unzipping to executablePath"""
    
    def __init__(self, **kwargs):
        self.filename = ""
        self.branch = ""
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'filename' in kwargs:
            self.filename = kwargs['filename']
        if not 'command' in kwargs:
            kwargs['command'] = ["tar", "-zvxf"]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Install tar.gz"]
    
    def start(self):
        if not self.filename:
            if self.branch:
                self.filename = self.getProperty("filename")
            else:
                return FAILURE
        if self.filename:
            self.command.append(self.filename)
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        return SUCCESS

class MozillaWgetFromChange(ShellCommand):
    """Download built Firefox client from current change's filenames."""
    haltOnFailure = True
    
    def __init__(self, **kwargs):
        self.branch = "HEAD"
        self.fileURL = ""
        self.filename = ""
        self.filenameSearchString = "en-US.win32.zip"
        if 'filenameSearchString' in kwargs:
            self.filenameSearchString = kwargs['filenameSearchString']
        if 'url' in kwargs:
            self.url = kwargs['url']
        else:
            self.url = kwargs['build'].source.changes[0].files[0]
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if not 'command' in kwargs:
            kwargs['command'] = ["wget"]
        ShellCommand.__init__(self, **kwargs)
    
    def getFilename(self):
        return self.filename
    
    def describe(self, done=False):
        return ["Wget Download"]
    
    def start(self):
        urlGetter = LatestFileURL(self.url, self.filenameSearchString)
        self.filename = urlGetter.getLatestFilename()
        self.fileURL = self.url + self.filename
        if self.branch:
            self.setProperty("fileURL", self.fileURL)
            self.setProperty("filename", self.filename)
        self.setCommand(["wget",  "-nv", "-N", self.fileURL])
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        if None != re.search('ERROR', cmd.logs['stdio'].getText()):
            return FAILURE
        return SUCCESS

class MozillaUpdateConfigFromChange(ShellCommand):
    """Configure YAML file for run_tests.py"""
    
    def __init__(self, **kwargs):
        self.title = "default"
        self.branch = ""
        self.currentDate = ""
        if 'build' in kwargs:
            self.title = kwargs['build'].slavename
            self.changes = kwargs['build'].source.changes
            self.buildid = self.changes[0].comments.split(',')[0]
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        assert 'configPath' in kwargs
        assert 'executablePath' in kwargs
        self.configPath = kwargs['configPath']
        self.exePath = kwargs['executablePath']
        if not 'command' in kwargs:
            kwargs['command'] = ["python", "PerfConfigurator.py", "-v", "-e",
                                 self.exePath, "-c", self.configPath,
                                 "-t", self.title, "-b", self.branch, "-d",
                                 "-i", self.buildid]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Update config"]
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        stdioText = cmd.logs['stdio'].getText()
        if None != re.search('ERROR', stdioText):
            return FAILURE
        if None != re.search('USAGE:', stdioText):
            return FAILURE
        configFileMatch = re.search('outputName\s*=\s*(\w*?.yml)', stdioText)
        if not configFileMatch:
            return FAILURE
        else:
            self.setProperty("configFile", configFileMatch.group(1))
        return SUCCESS

class MozillaInstallDmg(ShellCommand):
    """Install given file, copying to workdir"""
    
    def __init__(self, **kwargs):
        self.filename = ""
        self.branch = ""
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'filename' in kwargs:
            self.filename = kwargs['filename']
        if not 'command' in kwargs:
            kwargs['command'] = ["bash", "installdmg.sh", "$FILENAME"]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Install dmg"]
    
    def start(self):
        if not self.filename:
            if self.branch:
                self.filename = self.getProperty("filename")
            else:
                return FAILURE

        for i in range(len(self.command)):
            if self.command[i] == "$FILENAME":
                self.command[i] = self.filename
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        return SUCCESS


def main(argv=None):
    if argv is None:
        argv = sys.argv
    # tester = LatestFileURL('https://build.mozilla.org/tryserver-builds/', "en-US.win32.zip")
    tester = LatestFileURL('https://build.mozilla.org/tryserver-builds/', 'win32.zip')
    tester.testrun()
    return 0

if __name__ == '__main__':
    main()
