# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla-specific Buildbot steps.
#
# The Initial Developer of the Original Code is
# Mozilla Corporation.
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Ben Hearsum <bhearsum@mozilla.com>
#   Rob Campbell <rcampbell@mozilla.com>
#   Chris Cooper <coop@mozilla.com>
# ***** END LICENSE BLOCK *****

from buildbot.steps.shell import ShellCommand
from buildbot.status.builder import FAILURE

import re
import os
import signal
from os import path

class AliveTest(ShellCommand):
    name = "alive test"
    description = ["alive test"]
    haltOnFailure = True

    def __init__(self, extraArgs=None, logfile=None, **kwargs):
        ShellCommand.__init__(self, **kwargs)

        self.addFactoryArguments(extraArgs=extraArgs,
                                 logfile=logfile)
        self.extraArgs = extraArgs
        self.logfile = logfile

        # build the command
        self.command = ['python', 'leaktest.py']
        if logfile:
            self.command.extend(['-l', logfile])
        if extraArgs:
            self.command.append('--')
            self.command.extend(extraArgs)


def formatBytes(bytes, sigDigits=3):
    # Force a float calculation
    bytes=float(str(bytes) + '.0')

    if bytes > 1024**3:
        formattedBytes = setSigDigits(bytes / 1024**3, sigDigits) + 'G'
    elif bytes > 1024**2:
        formattedBytes = setSigDigits(bytes / 1024**2, sigDigits) + 'M'
    elif bytes > 1024**1:
        formattedBytes = setSigDigits(bytes / 1024, sigDigits) + 'K'
    else:
        formattedBytes = setSigDigits(bytes, sigDigits)
    return str(formattedBytes) + 'B'

def formatCount(number, sigDigits=3):
    number=float(str(number) + '.0')
    return str(setSigDigits(number, sigDigits))
    
def setSigDigits(num, sigDigits=3):
    if num == 0:
        return '0'
    elif num < 10**(sigDigits-5):
        return '%.5f' % num
    elif num < 10**(sigDigits-4):
        return '%.4f' % num
    elif num < 10**(sigDigits-3):
        return '%.3f' % num
    elif num < 10**(sigDigits-2):
        return '%.2f' % num
    elif num < 10**(sigDigits-1):
        return '%.1f' % num
    return '%(num)d' % {'num': num}

def tinderboxPrint(testName,
                   testTitle,
                   numResult,
                   units,
                   printName,
                   printResult,
                   unitsSuffix=""):
    output = "TinderboxPrint:"
    output += "<abbr title=\"" + testTitle + "\">"
    output += printName + "</abbr>:"
    output += "%s\n" % str(printResult)
    output += unitsSuffix
    return output

class CompareBloatLogs(ShellCommand):
    warnOnFailure = True
    bloatLog = "" 

    def __init__(self, **kwargs):
        if not 'bloatLog' in kwargs:
            return FAILURE
        testname = ""
        if 'testname' in kwargs:
            testname = kwargs['testname'] + " "
        bloatDiffPath = 'tools/rb/bloatdiff.pl'
        if 'bloatDiffPath' in kwargs:
            bloatDiffPath = kwargs['bloatDiffPath']
        self.name = "compare " + testname + "bloat logs"
        self.description = "compare " + testname + "bloat logs"
        self.descriptionDone = "compare " + testname + "bloat logs complete"
        self.bloatLog = kwargs['bloatLog']
        kwargs['command'] = ["perl",
                             bloatDiffPath,
                             kwargs['bloatLog'] + '.old',
                             kwargs['bloatLog']
                             ]
        ShellCommand.__init__(self, **kwargs)
            
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
        leaksTestnameLabel = "refcnt Leaks"

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

class CompareLeakLogs(ShellCommand):
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
        assert 'platform' in kwargs
        platform = kwargs['platform']
        assert platform.startswith('win32') or platform.startswith('macosx') \
          or platform.startswith('linux')
        if 'leakFailureThreshold' in kwargs:
            self.leakFailureThreshold = kwargs['leakFailureThreshold']
        if not 'mallocLog' in kwargs:
            return FAILURE
        self.mallocLog = kwargs['mallocLog']
        if 'testname' in kwargs:
            testname = kwargs['testname'] + " "
        else:
            testname = ""
        self.testname = testname
        self.name = "compare " + testname + "leak logs"
        self.description = "compare " + testname + "leak logs"
        self.descriptionDone = "compare " + testname + "leak logs complete"
        if platform.startswith("win32"):
            kwargs['command'] = ['obj-firefox\\dist\\bin\\leakstats.exe',
                                 kwargs['mallocLog']]
        else:
            kwargs['command'] = ['obj-firefox/dist/bin/leakstats',
                                 kwargs['mallocLog']]
        ShellCommand.__init__(self, **kwargs)

    def evaluateCommand(self, cmd):
        superResult = ShellCommand.evaluateCommand(self, cmd)
        if self.leakStats['new']['leaks'] and int(self.leakStats['new']['leaks']) > int(self.leakFailureThreshold):
            return WARNINGS
        return superResult
            
    def createSummary(self, log):
        summary = self.testname + " trace-malloc bloat test: leakstats\n"

        resultSet = 'new'
        for line in log.readlines():
            summary += line
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
            
        lk =  formatBytes(self.leakStats['new']['leaks'],3)
        mh = formatBytes(self.leakStats['new']['mhs'],3)
        a =  formatCount(self.leakStats['new']['allocs'],3)

        slug = "Lk: %s, MH: %s, A: %s" % (lk, mh, a)
        logText = ""
        if self.testname.startswith("current"):
            logText += "TinderboxPrint: Lk:%s\n" % lk
            logText += "TinderboxPrint: MH:%s\n" % mh
            logText += "TinderboxPrint: A:%s\n" % a
        else:
            logText += "Lk: %s\nMH: %s\nA: %s\n" % (lk, mh, a)

        self.addCompleteLog(slug, logText)


class Codesighs(ShellCommand):
    def __init__(self, objdir, platform, type='auto', **kwargs):
        ShellCommand.__init__(self, **kwargs)

        assert platform in ('win32', 'macosx', 'linux')
        assert type in ('auto', 'base')

        self.addFactoryArguments(objdir=objdir,
                                 platform=platform,
                                 type=type)

        self.objdir = objdir
        self.platform = platform
        if self.platform in ('macosx', 'linux'):
            self.platform = 'unix'
        self.type = type

        runScript = 'tools/codesighs/' + \
                    type + 'summary.' + self.platform + '.bash'

        self.command = [runScript, '-o', objdir, '-s', '.',
                        '../codesize-' + type + '.log',
                        '../codesize-' + type + '-old.log',
                        '../codesize-' + type + '-diff.log']

    def createSummary(self, log):
        bytes = ""
        diff = ""
        for line in log.readlines():
            if '__codesize:' in line:
                bytes = formatBytes(line.split(':')[1].rstrip())
            elif '__codesizeDiff:' in line:
                diffData = line.split(':')[1].rstrip()
                # if we anything but '+0' here, we print additional data
                if diffData[0:2] != '+0':
                    diff = diffData

        z = 'Z'
        if self.type == 'base':
            z = 'mZ'

        slug = '%s:%s' % (z, bytes)
        summary = 'TinderboxPrint:%s\n' % slug
        self.addCompleteLog(slug, summary)
        if diff:
            # buildbot chokes if we put all the data in the short log
            slug = '%sdiff' % z
            summary = 'TinderboxPrint:%s:%s\n' % (slug, diff)
            self.addCompleteLog(slug, summary)
