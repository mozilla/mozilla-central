# -*- Python -*-

from buildbot.process import step
from buildbot.process.step import ShellCommand
from buildbot.status.builder import SUCCESS, WARNINGS, FAILURE, SKIPPED, EXCEPTION
import re, urllib, sys
from time import strptime, strftime, localtime, mktime
from datetime import datetime

MozillaEnvironments = { }

# define some globals for passing around to the different sections

latestURLForBranch = { }
latestFileForBranch = { }
latestConfigForBranch = { }
executablePath = "C:\\cygwin\\tmp\\test\\"
uninstallerSubPath = "firefox\\uninstall\\helper.exe"
defaultRuntestsPath = "C:\\mozilla\\testing\\performance\\talos\\"

# platform SDK location.  we can build both from one generic template.
# modified from vc8 environment
MozillaEnvironments['vc8perf'] = {
    "MOZ_NO_REMOTE": '1',
    "MOZ_CRASHREPORTER_NO_REPORT": '1',
    "NO_EM_RESTART": '1',
    "XPCOM_DEBUG_BREAK": 'warn',
    "CYGWINBASE": 'C:\\cygwin',
    "PATH": 'C:\\Python24;' + \
            'C:\\Python24\\Scripts;' + \
            'C:\\cygwin\\bin;' + \
            'C:\\WINDOWS\\System32;' + \
            'C:\\WINDOWS;'
}

class LatestFileURL:
    sortByDateString = "?C=M;O=A"
    url = ""
    filenameSearchString = ""
    dateFileDict = {}
    
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
        self._populateDict()
    

class MozillaWgetLatest(ShellCommand):
    """Download built Firefox client from nightly staging directory."""
    haltOnFailure = True
    url = "http://stage.mozilla.org/pub/mozilla.org/firefox/" + \
          "tinderbox-builds/fx-win32-tbox-trunk/"
    branch = ""
    fileURL = ""
    filename = ""
    filenameSearchString = "en-US.win32.zip"
    
    def __init__(self, **kwargs):
        if 'url' in kwargs:
            self.url = kwargs['url']
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'filenameSearchString' in kwargs:
            self.filenameSearchString = kwargs['filenameSearchString']
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
            latestURLForBranch[self.branch] = self.fileURL
            latestFileForBranch[self.branch] = self.filename
        self.setCommand(["wget -nv -N " + self.fileURL])
        ShellCommand.start(self)
    
    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if SUCCESS != superResult:
            return FAILURE
        if None != re.search('ERROR', cmd.logs['stdio'].getText()):
            return FAILURE
        return SUCCESS
    

class MozillaWgetFromChange(ShellCommand):
    """Download built Firefox client from current change's filenames."""
    haltOnFailure = True
    url = ""
    branch = ""
    fileURL = ""
    filename = ""
    filenameSearchString = "en-US.win32.zip"
    
    def __init__(self, **kwargs):
        if 'url' in kwargs:
            self.url = kwargs['url']
        else:
            self.url = kwargs['build'].source.changes[0].files[0]
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'filenameSearchString' in kwargs:
            self.filenameSearchString = kwargs['filenameSearchString']
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
            latestURLForBranch[self.branch] = self.fileURL
            latestFileForBranch[self.branch] = self.filename
        self.setCommand(["wget -nv -N " + self.fileURL])
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
    filename = ""
    branch = ""
    exePath = executablePath
    
    def __init__(self, **kwargs):
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'filename' in kwargs:
            self.filename = kwargs['filename']
        if 'executablePath' in kwargs:
            self.exePath = kwargs['executablePath']
        if not 'command' in kwargs:
            kwargs['command'] = ["unzip -o -d " + self.exePath]
        ShellCommand.__init__(self, **kwargs)
    
    def describe(self, done=False):
        return ["Install zip"]
    
    def start(self):
        if not self.filename:
            if self.branch:
                self.filename = latestFileForBranch[self.branch]
            else:
                return FAILURE
        if self.filename:
            self.setCommand(self.command[0] + " " + self.filename)
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
    

class MozillaUpdateConfigFromChange(ShellCommand):
    """Configure YAML file for run_tests.py"""
    
    title = "bm-winxp01"
    branch = ""
    currentDate = ""
    exePath = executablePath
    configPath = defaultRuntestsPath
    
    def __init__(self, **kwargs):
        if 'build' in kwargs:
            self.title = kwargs['build'].slavename
            self.changes = kwargs['build'].source.changes
            self.buildid = self.changes[0].comments.split(',')[0]
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'configPath' in kwargs:
            self.configPath = kwargs['configPath']
        if 'executablePath' in kwargs:
            self.exePath = kwargs['executablePath']
        if not 'command' in kwargs:
            kwargs['command'] = ["python PerfConfigurator.py -v -e " + \
                                    self.exePath + " -c " + self.configPath + \
                                    " -t " + self.title + " -b " + "'" +  \
                                    self.branch + "'" + " -d -i " + self.buildid]
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
            latestConfigForBranch[self.branch] = configFileMatch.group(1)
        return SUCCESS
    

class MozillaRunPerfTests(ShellCommand):
    """Run the performance tests. Run in C:\\mozilla\\testing\\performance\\talos"""
    
    def __init__(self, **kwargs):
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if not 'command' in kwargs:
            kwargs['command'] = ["python run_tests.py "]
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
        self.setCommand(self.command[0] + latestConfigForBranch[self.branch])
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
    

def main(argv=None):
    if argv is None:
        argv = sys.argv
    tester = LatestFileURL('http://stage.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/fx-win32-tbox-trunk/', "en-US.win32.zip")
    tester.testrun()
    return 0

if __name__ == '__main__':
    main()
