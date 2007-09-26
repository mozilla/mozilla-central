# -*- Python -*-

from buildbot.process import step
from buildbot.process.buildstep import BuildStep
from buildbot.buildset import BuildSet
from buildbot.sourcestamp import SourceStamp
from buildbot.process.step import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION
import re, urllib, sys, os
from time import strptime, strftime, localtime
from datetime import datetime
from os import path

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

class LatestFileURL:
    sortByDateString = "?C=M;O=A"

    def _retrievePageAtURL(self):
        content = []
        try:
            opener = urllib.URLopener()
            page = opener.open(self.url + self.sortByDateString)
            content = page.readlines()
            opener.close()
        except:
            print "unable to retrieve page at: " + self.url
        return content
    
    def _populateDict(self):
        '''Extract the latest filename from the given URL
            * retrieve page at URL
            * for each line
                * grab filename URL
                * if filename matches filenameSearchString
                    * grab datetime
                    * store date and filename URL in dictionary
            * return latest filenameURL matching date'''
        
        reDatestamp = re.compile('\d\d-[a-zA-Z]{3,3}-\d\d\d\d \d\d:\d\d')
        reHREF = re.compile('href\="((?:\w|[.-])*)"')
        content = self._retrievePageAtURL()
        for line in content:
            matchHREF = re.search(reHREF, line)
            if matchHREF:
                if self.filenameSearchString in matchHREF.group(1):
                    datetimeMatch = re.search(reDatestamp, line)
                    if datetimeMatch:
                        dts = line[datetimeMatch.start():datetimeMatch.end()]
                        timestamp = datetime(*strptime(dts, '%d-%b-%Y %H:%M')[0:6])
                        self.dateFileDict[timestamp] = matchHREF.group(1)
        
    
    def _getDateKeys(self):
        dbKeys = self.dateFileDict.keys()
        if not dbKeys:
            return []
        return dbKeys
    
    def getLatestFilename(self):
        dateKeys = self._getDateKeys()
        if not dateKeys: return ""
        return self.dateFileDict[max(dateKeys)]
    
    def _printDictionary(self):
        keys = self._getDateKeys()
        for timestamp in keys:
            print "%s : %s" % (timestamp, self.dateFileDict[timestamp])
    
    def testrun(self):
        self._populateDict()
        self._printDictionary()
        name = self.getLatestFilename()
        print self.url + name
    
    def __init__(self, url, filenameSearchString):
        self.url = url
        self.filenameSearchString = filenameSearchString
        self.dateFileDict = {}
        self._populateDict()
    

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
        self.filename = urlGetter.getLatestFilename()
        self.fileURL = self.url + self.filename
        if self.branch:
            self.setProperty("fileURL", self.fileURL)
            self.setProperty("filename", self.filename)
        self.setCommand(["wget", "-nv", "-N", self.fileURL])
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        if None != re.search('ERROR', cmd.logs['stdio'].getText()):
            return FAILURE
        return SUCCESS
    

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
        self.addCompleteLog('summary', "\n".join(summary))
    
    def start(self):
        """docstring for start"""
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
            kwargs['command'] = "bash mountdmg.sh FILENAME ."
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Install dmg"]
    
    def start(self):
        if not self.filename:
            if self.branch:
                self.filename = self.getProperty("filename")
            else:
                return FAILURE

        self.command = self.command.replace("FILENAME", self.filename)
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        return SUCCESS

from buildbot.process.buildstep import BuildStep

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
 
def main(argv=None):
    if argv is None:
        argv = sys.argv
    tester = LatestFileURL('http://stage.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/fx-win32-tbox-trunk/', "en-US.win32.zip")
    tester.testrun()
    return 0

if __name__ == '__main__':
    main()
