import time
from calendar import timegm
from urllib import urlopen
from xml.dom import minidom, Node

from twisted.python import log, failure
from twisted.internet import defer, reactor
from twisted.internet.task import LoopingCall

from buildbot.changes import base, changes


# From pyiso8601 module,
#  http://code.google.com/p/pyiso8601/source/browse/trunk/iso8601/iso8601.py
#   Revision 22

# Required license header:

# Copyright (c) 2007 Michael Twomey
# 
# Permission is hereby granted, free of charge, to any person obtaining a
# copy of this software and associated documentation files (the
# "Software"), to deal in the Software without restriction, including
# without limitation the rights to use, copy, modify, merge, publish,
# distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so, subject to
# the following conditions:
# 
# The above copyright notice and this permission notice shall be included
# in all copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
# IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
# CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
# TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

"""ISO 8601 date time string parsing

Basic usage:
>>> import iso8601
>>> iso8601.parse_date("2007-01-25T12:00:00Z")
datetime.datetime(2007, 1, 25, 12, 0, tzinfo=<iso8601.iso8601.Utc ...>)
>>>

"""

from datetime import datetime, timedelta, tzinfo
import re

__all__ = ["parse_date", "ParseError"]

# Adapted from http://delete.me.uk/2005/03/iso8601.html
ISO8601_REGEX = re.compile(r"(?P<year>[0-9]{4})(-(?P<month>[0-9]{1,2})(-(?P<day>[0-9]{1,2})"
    r"((?P<separator>.)(?P<hour>[0-9]{2}):(?P<minute>[0-9]{2})(:(?P<second>[0-9]{2})(\.(?P<fraction>[0-9]+))?)?"
    r"(?P<timezone>Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?"
)
TIMEZONE_REGEX = re.compile("(?P<prefix>[+-])(?P<hours>[0-9]{2}).(?P<minutes>[0-9]{2})")

class ParseError(Exception):
    """Raised when there is a problem parsing a date string"""

# Yoinked from python docs
ZERO = timedelta(0)
class Utc(tzinfo):
    """UTC
    
    """
    def utcoffset(self, dt):
        return ZERO

    def tzname(self, dt):
        return "UTC"

    def dst(self, dt):
        return ZERO
UTC = Utc()

class FixedOffset(tzinfo):
    """Fixed offset in hours and minutes from UTC
    
    """
    def __init__(self, offset_hours, offset_minutes, name):
        self.__offset = timedelta(hours=offset_hours, minutes=offset_minutes)
        self.__name = name

    def utcoffset(self, dt):
        return self.__offset

    def tzname(self, dt):
        return self.__name

    def dst(self, dt):
        return ZERO
    
    def __repr__(self):
        return "<FixedOffset %r>" % self.__name

def parse_timezone(tzstring, default_timezone=UTC):
    """Parses ISO 8601 time zone specs into tzinfo offsets
    
    """
    if tzstring == "Z":
        return default_timezone
    # This isn't strictly correct, but it's common to encounter dates without
    # timezones so I'll assume the default (which defaults to UTC).
    # Addresses issue 4.
    if tzstring is None:
        return default_timezone
    m = TIMEZONE_REGEX.match(tzstring)
    prefix, hours, minutes = m.groups()
    hours, minutes = int(hours), int(minutes)
    if prefix == "-":
        hours = -hours
        minutes = -minutes
    return FixedOffset(hours, minutes, tzstring)

def parse_date(datestring, default_timezone=UTC):
    """Parses ISO 8601 dates into datetime objects
    
    The timezone is parsed from the date string. However it is quite common to
    have dates without a timezone (not strictly correct). In this case the
    default timezone specified in default_timezone is used. This is UTC by
    default.
    """
    if not isinstance(datestring, basestring):
        raise ParseError("Expecting a string %r" % datestring)
    m = ISO8601_REGEX.match(datestring)
    if not m:
        raise ParseError("Unable to parse date string %r" % datestring)
    groups = m.groupdict()
    tz = parse_timezone(groups["timezone"], default_timezone=default_timezone)
    if groups["fraction"] is None:
        groups["fraction"] = 0
    else:
        groups["fraction"] = int(float("0.%s" % groups["fraction"]) * 1e6)
    return datetime(int(groups["year"]), int(groups["month"]), int(groups["day"]),
        int(groups["hour"]), int(groups["minute"]), int(groups["second"]),
        int(groups["fraction"]), tz)

# End of iso8601.py


class HgPoller(base.ChangeSource):
    """This source will poll a Mercurial server over HTTP using
    the built-in RSS feed for changes and submit them to the
    change master."""

    compare_attrs = ['hgURL', 'branch', 'pollInterval']
    parent = None
    loop = None
    volatile = ['loop']
    working = False
    
    def __init__(self, hgURL, branch, pushlogUrlOverride=None, pollInterval=30):
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
        self.pushlogUrlOverride = pushlogUrlOverride
        self.pollInterval = pollInterval
        self.lastChange = time.time()

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
        if self.pushlogUrlOverride:
            return self.pushlogUrlOverride
        else:
            return "%s%s/pushlog" % (self.hgURL, self.branch)
    
    def _get_changes(self):
        url = self._make_url()
        log.msg("Polling Hg server at %s" % url)
        
        return defer.maybeDeferred(urlopen, url)

    def _parse_date_string(self, dateString):
        return timegm(parse_date(dateString).utctimetuple())

    def _parse_changes(self, query):
        dom = minidom.parseString(query.read())

        items = dom.getElementsByTagName("entry")
        changes = []
        for i in items:
            d = {}
            for k in ["title", "updated"]:
                d[k] = i.getElementsByTagName(k)[0].firstChild.wholeText
            d["updated"] = self._parse_date_string(d["updated"])
            d["changeset"] = d["title"].split(" ")[1]
            nameNode = i.getElementsByTagName("author")[0].childNodes[1]
            d["author"] = nameNode.firstChild.wholeText
            d["link"] = i.getElementsByTagName("link")[0].getAttribute("href")
            changes.append(d)
        changes = [c for c in changes if c["updated"] > self.lastChange]
        changes.reverse() # want them in chronological order
        return changes
    
    def _process_changes(self, query):
        change_list = self._parse_changes(query)
        for change in change_list:
            adjustedChangeTime = change["updated"]
            c = changes.Change(who = change["author"],
                               files = [], # sucks
                               revision = change["changeset"],
                               comments = change["link"],
                               when = adjustedChangeTime,
                               branch = self.branch)
            self.parent.addChange(c)
        if len(change_list) > 0:
            self.lastChange = max(self.lastChange, *[c["updated"] for c in
                                                       change_list])

