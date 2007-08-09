from twisted.python import log, failure
from twisted.internet import defer, reactor
from twisted.internet.task import LoopingCall
from twisted.web.client import getPage
from urllib2 import urlopen
from time import time

from buildbot.changes import base, changes

class InvalidResultError(Exception):
    def __init__(self, value="InvalidResultError"):
        self.value = value
    def __str__(self):
        return repr(self.value)

class EmptyResult(Exception):
    pass

class NoMoreBuildNodes(Exception):
    pass

class NoMoreFileNodes(Exception):
    pass

class ManifestParser:
    """I parse the manifest file and return a list of dictionaries with date,
    version, windows, mac, and linux elements, hopefully in increasing date 
    order"""
    
    def __init__(self, query):
        nodes = []
        s = query.read()
        lines = s.split('\n')
        for line in lines:
            if line == "": continue
            elements = line.split(',')
            items = {'date': elements[0],
                     'version': elements[1],
                     'windows': elements[2],
                     'mac': elements[3],
                     'linux': elements[4]}
            nodes.append(items)
        self.manifestResult = nodes
    
    def getData(self):
        return self.manifestResult
    

class ManifestDirectoryStream(base.ChangeSource):
    """This source will stream over a manifest, pulling changes from a 
    directory server and submit them to the change master."""
    
    compare_attrs = ["url", "manifestURL", "dateRange", "pollInterval"]
    
    parent = None # filled in when we're added
    loop = None
    volatile = ['loop']
    working = False
    
    def __init__(self, url, manifestURL, dateRange, branch, pollInterval=30, buildType = 'windows'):
        """
        @type   url:                string
        @param  url:                The base URL of the web server
                                    (eg. http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/)
        @type   manifestURL:        string
        @param  manifestURL:        The file on the web containing the list
                                    of directory names and version numbers
        @type   dateRange:          string
        @param  dateRange:          A start date and end date separated by a
                                    colon. Empty or none to do all. YYYYMMDD
        @type   pollInterval:       int
        @param  pollInterval:       The time (in seconds) between queries for 
                                    changes. Default is 30
        @type   buildType           string
        @param  buildType           windows|mac|linux
        """
        
        self.url = url
        self.manifestURL = manifestURL
        self.dateRange = dateRange
        self.branch = branch
        self.pollInterval = pollInterval
        self.previousChange = ''
        self.current = ''
        self.lastPoll = time()
        self.lastDate = ''
        self.buildType = buildType
        
        if self.dateRange:
            self.startDate, self.endDate = self.dateRange.split(':')
        self.manifestList = self._readManifest()
        self.manifestListIterator = self.manifestList.__iter__()
    
    def _isDateInRange(self, dateString):
        return dateString >= self.startDate and dateString <= self.endDate
    
    def _readManifest(self):
        parser = ManifestParser(urlopen(self.manifestURL))
        return parser.getData()
    
    def startService(self):
        log.msg("directory poller(%s) starting" % self.url)
        self.loop = LoopingCall(self.poll)
        base.ChangeSource.startService(self)
        reactor.callLater(0, self.loop.start, self.pollInterval)
    
    def stopService(self):
        log.msg("directory poller(%s) shutting down" % self.url)
        self.loop.stop()
        return base.ChangeSource.stopService(self)
    
    def describe(self):
        str = ""
        str += "Getting changes from the directory at %s " \
                % self.url
        str += "<br>Using manifest: %s" % self.manifestURL
        return str
    
    def poll(self):
        if self.working:
            log.msg("Not streaming directory because last poll is still working")
        else:
            self.working = True
            d = self._get_changes()
            d.addCallback(self._process_changes)
            d.addBoth(self._finished)
        return
    
    def _finished(self, res):
        assert self.working
        self.working = False
        
        # check for failure
        if isinstance(res, failure.Failure):
            log.msg("directory poll failed: %s" % res)
        return res
    
    def _getNextDateInRange(self):
        try:
            self.manifestLine = self.manifestListIterator.next()
        except StopIteration, e:
            log.msg("No more list items in collection")
            return None
        
        currDate = self.manifestLine['date']
        if currDate >= self.lastDate:
            if self._isDateInRange(currDate):
                log.msg("found date %s" % currDate)
                return currDate
        
        log.msg("date %s not in range %s" % (currDate, self.dateRange))
        return None
    
    def _get_changes(self):
        log.msg("Polling manifest file at %s" % self.manifestURL)
        
        self.lastPoll = time()        
        return defer.maybeDeferred(self._getNextDateInRange)
    
    def _process_changes(self, dateString):
        if dateString == None:
            return
        
        # see if there are any new changes
        if self.lastDate:
            if (dateString <= self.lastDate):
                return
        
        directory = self.manifestLine[self.buildType]
        directoryComponents = directory.split('-')
        buildTime = ''.join(directoryComponents[:-1])
        # if '3.0' in self.manifestLine['version']:
        changeBranch = 'HEAD'
        # else:
        #    changeBranch = 'BRANCH_1_8'
        if self.manifestLine[self.buildType] != '-':
            c = changes.Change(who = self.manifestURL,
                               files = [self.url + \
                                    self.manifestLine[self.buildType]],
                               branch = changeBranch,
                               comments = buildTime + ", " + self.manifestLine['version'],
                               when = time())
            self.parent.addChange(c)
            self.lastDate = dateString
    

if __name__ == '__main__':
    import sys
    log.startLogging(sys.stdout)

    mds = ManifestDirectoryStream("http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/",
                                  "http://tetsuo.zabbo.net/~alice/manifests/fx-trunk-builds",
                                  "20070501:20070705", "head", pollInterval=5)
    mds.debug = True

    from datetime import datetime
    def timestamp2iso(n):
        ts = datetime.fromtimestamp(n)
        return ts.isoformat(' ')

    class dummyParent:
        needsShutDown = True
        def addChange(self, change):
            log.msg("Found new build, : %s, %s, %s, %s" % (change.who,
                                                   timestamp2iso(change.when),
                                                   change.files,
                                                   change.comments))
            log.msg("SUCCESS")
            if self.needsShutDown:
                self.needsShutDown = False
                reactor.callLater(3, mds.stopService)
                reactor.callLater(6, reactor.stop)

    mds.parent = dummyParent()
    mds.startService()
    
    reactor.run()

