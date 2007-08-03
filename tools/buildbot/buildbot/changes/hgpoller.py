import time
import rfc822
from urllib import urlopen
from xml.dom import minidom, Node

from twisted.python import log, failure
from twisted.internet import defer, reactor
from twisted.internet.task import LoopingCall

from buildbot.changes import base, changes

class HgPoller(base.ChangeSource):
    """This source will poll a Mercurial server over HTTP using
    the built-in RSS feed for changes and submit them to the
    change master."""

    compare_attrs = ['hgURL', 'branch', 'pollInterval']
    parent = None
    loop = None
    volatile = ['loop']
    working = False
    
    def __init__(self, hgURL, branch, pollInterval=30):
        """
        @type   hgURL:          string
        @param  hgURL:          The base URL of the Hg repo
                                (e.g. http://hg.mozilla.org/)
        @type   branch:         string
        @param  branch:         The branch to check (e.g. mozilla-central)
        @type   pollInterval:   int
        @param  pollInterval:   The time (in seconds) between queries for
                                changes
        """
        
        self.hgURL = hgURL
        self.branch = branch
        self.pollInterval = pollInterval
        self.lastChange = time.time()
        self.lastPoll = time.time()

    def startService(self):
        self.loop = LoopingCall(self.poll)
        base.ChangeSource.startService(self)
        reactor.callLater(0, self.loop.start, self.pollInterval)

    def stopService(self):
        self.loop.stop()
        return base.ChangeSource.stopService(self)
    
    def describe(self):
        return "Getting changes from the Mercurial repo at %s%s" % \
               (self.hgURL, self.branch)
    
    def poll(self):
        if self.working:
            log.msg("Not polling because last poll is still working")
        else:
            self.working = True
            d = self._get_changes()
            d.addCallback(self._process_changes)
            d.addCallbacks(self._finished_ok, self._finished_failure)

    def _finished_ok(self, res):
        assert self.working
        self.working = False

        return res

    def _finished_failure(self, res):
        log.msg("Hg poll failed: %s" % res)
        assert self.working
        self.working = False
        return None

    def _make_url(self):
        return "%s%s/?rss-log" % (self.hgURL, self.branch)
    
    def _get_changes(self):
        url = self._make_url()
        log.msg("Polling Hg server at %s" % url)
        
        self.lastPoll = time.time()
        return defer.maybeDeferred(urlopen, url)

    def _parse_changes(self, query):
        dom = minidom.parseString(query.read())
        items = dom.getElementsByTagName("item")
        changes = []
        for i in items:
            d = dict()
            for k in ["description", "link", "author", "pubDate"]:
                d[k] = i.getElementsByTagName(k)[0].firstChild.wholeText
            # strip out HTML newlines
            d["description"] = d["description"].replace("<br/>","")
            # need to parse date with timezone, and turn into a UTC timestamp
            d["pubDate"] = rfc822.mktime_tz(rfc822.parsedate_tz(d["pubDate"]) )
            changes.append(d)
        changes = [c for c in changes if c["pubDate"] > self.lastChange]
        changes.reverse() # want t hem in reverse chronological order
        return changes
    
    def _process_changes(self, query):
        change_list = self._parse_changes(query)
        for change in change_list:
            c = changes.Change(who = change["author"],
                               files = [], # sucks
                               comments = change["description"],
                               when = change["pubDate"],
                               branch = self.branch)
            self.parent.addChange(c)
        self.lastChange = max(self.lastPoll, *[c["pubDate"] for c in
                                                   change_list])

