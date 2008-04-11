import time

from twisted.python import log, failure
from twisted.internet import defer, reactor
from twisted.internet.task import LoopingCall
from twisted.web.client import getPage

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

class TinderboxResult:
    """I hold a list of dictionaries representing build nodes
        items = hostname, status and date of change"""
    
    nodes = []
    
    def __init__(self, nodes):
        self.nodes = nodes
    
    def __eq__(self, other):
        if len(self.nodes) != len(other.nodes):
            return False
        for i in range(len(self.nodes)):
            if self.nodes[i] != other.nodes[i]:
                return False
        
        return True
    
    def nodeForHostname(self, nameString):
        """returnt the node for a nameString"""
        for node in self.nodes:
            if nameString in node['hostname']:
                return node
        
        return None
    

class TinderboxParser:
    """I parse the pipe-delimited result from a Tinderbox quickparse query."""
    
    def __init__(self, s):
        nodes = []
        lines = s.split('\n')
        for line in lines:
            if line == "": continue
            elements = line.split('|')
            if elements[0] == 'State': continue
            items = {'hostname': elements[2], 'status': elements[3], 'date': elements[4]}
            nodes.append(items)
        self.tinderboxResult = TinderboxResult(nodes)
    
    def getData(self):
        return self.tinderboxResult
    

class TinderboxPoller(base.ChangeSource):
    """This source will poll a tinderbox server for changes and submit
    them to the change master."""
    
    compare_attrs = ["tinderboxURL", "pollInterval", "tree", "branch"]
    
    parent = None # filled in when we're added
    loop = None
    volatile = ['loop']
    working = False
    debug = False
    
    def __init__(self, tinderboxURL, branch, tree="Firefox", machine="", pollInterval=30):
        """
        @type   tinderboxURL:       string
        @param  tinderboxURL:       The base URL of the Tinderbox server
                                    (ie. http://tinderbox.mozilla.org)
        @type   tree:               string
        @param  tree:               The tree to look for changes in. 
                                    For example, Firefox trunk is 'Firefox'
        @type   branch:             string
        @param  branch:             The branch to look for changes in. This must
                                    match the 'branch' option for the Scheduler.
        @type   machine:            string
        @param  machine:            A machine name to search for. Changes will
                                    only register for machines that match the
                                    substring "machine"
        @type   pollInterval:       int
        @param  pollInterval:       The time (in seconds) between queries for 
                                    changes
        """
        
        self.tinderboxURL = tinderboxURL
        self.tree = tree
        self.branch = branch
        self.machine = machine
        self.pollInterval = pollInterval
        self.previousChange = ''
        self.lastPoll = time.time()
        self.lastChange = time.time()
    
    def startService(self):
        self.loop = LoopingCall(self.poll)
        base.ChangeSource.startService(self)
        
        reactor.callLater(0, self.loop.start, self.pollInterval)
    
    def stopService(self):
        self.loop.stop()
        return base.ChangeSource.stopService(self)
    
    def describe(self):
        str = ""
        str += "Getting changes from the Tinderbox service running at %s " \
                % self.tinderboxURL
        str += "<br>Using tree: %s, branch %s, hostname %s" % (self.tree, self.branch, self.machine)
        return str
    
    def poll(self):
        if self.working:
            log.msg("Not polling Tinderbox because last poll is still working")
        else:
            self.working = True
            d = self._get_changes()
            d.addCallbacks(self._gotPage, self._gotError)
        return
    
    def _gotPage(self, content):
        if self.debug:
            log.msg("_gotPage: %s" % content.split('\n',1)[0])
        self._process_changes(content)
        self._finished()
        pass
    
    def _gotError(self, error):
        log.msg("quickparse.txt failed to load: %s" % error)
        self._finished()
    
    def _finished(self):
        assert self.working
        self.working = False
    
    def _make_url(self):
        # build the tinderbox URL
        url = self.tinderboxURL
        url += "/" + self.tree
        url += "/" + "quickparse.txt"
        
        return url
    
    def _get_changes(self):
        url = self._make_url()
        log.msg("Polling Tinderbox tree at %s" % url)
        
        self.lastPoll = time.time()
        # send of the page load request
        return getPage(url, timeout=self.pollInterval)
    
    def _process_changes(self, content):
        try:
            tp = TinderboxParser(content)
            result = tp.getData()
        except InvalidResultError, e:
            log.msg("Could not process Tinderbox query: " + e.value)
            return
        except EmptyResult:
            return
        
        # check machine substring in result set
        if self.machine:
            node = result.nodeForHostname(self.machine)
            if node:
                result = TinderboxResult([node])
            else:
                return
        
        # see if there are any new changes
        if self.previousChange:
            if (self.previousChange == result.nodes):
                return
            oldResults = result.nodes
            result.nodes = []
            for node in oldResults:
                if node not in self.previousChange:
                    result.nodes.append(node)
            self.previousChange = oldResults
        else:
            self.previousChange = result.nodes
            return
        
        allBuildDates = []
        for buildNode in result.nodes:
            buildDate = int(buildNode['date'])
            if self.lastChange > buildDate:
                # change too old
                log.msg("dropping old build from %s" % buildNode['hostname'])
                continue
            allBuildDates.append(buildDate)
            c = changes.Change(who = buildNode['hostname'],
                               files = ['TODO: filename goes here'],
                               comments = buildNode['status'],
                               branch = self.branch,
                               when = buildDate)
            self.parent.addChange(c)
        
        # do not allow repeats - count the last change as the largest
        # build start time that has been seen
        if allBuildDates:
            self.lastChange = max(allBuildDates)

if __name__ == '__main__':
    import sys
    log.startLogging(sys.stdout)

    tb = TinderboxPoller("http://tinderbox.mozilla.org", "HEAD")
    tb.debug = True

    from datetime import datetime
    def timestamp2iso(n):
        ts = datetime.fromtimestamp(n)
        return ts.isoformat(' ')

    class dummyParent:
        needsShutDown = True
        def addChange(self, change):
            log.msg("Found new build, : %s, %s" % (change.who,
                                                   timestamp2iso(change.when)))
            log.msg("SUCCESS")
            if self.needsShutDown:
                self.needsShutDown = False
                reactor.callLater(3, tb.stopService)
                reactor.callLater(6, reactor.stop)

    tb.parent = dummyParent()
    tb.startService()
    
    reactor.run()
