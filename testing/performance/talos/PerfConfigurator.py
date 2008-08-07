#!/usr/bin/env python
# encoding: utf-8
"""
PerfConfigurator.py

Created by Rob Campbell on 2007-03-02.
Modified by Rob Campbell on 2007-05-30
Modified by Rob Campbell on 2007-06-26 - added -i buildid option
Modified by Rob Campbell on 2007-07-06 - added -d testDate option
Modified by Ben Hearsum on 2007-08-22 - bugfixes, cleanup, support for multiple platforms. Only works on Talos2
Modified by Alice Nodelman on 2008-04-30 - switch to using application.ini, handle different time stamp formats/options
Modified by Alice Nodelman on 2008-07-10 - added options for test selection, graph server configuration, nochrome
"""

import sys
import getopt
import re
import time
from datetime import datetime
from os import path

# TODO: maybe this should be searched for?
# For Windows
#masterIniSubpath = path.join("firefox", "extensions", "talkback@mozilla.org",
#                             "components", "master.ini")
# For Linux
masterIniSubpath = path.join("firefox", "components", "talkback", "master.ini")
masterIniSubpath = "application.ini"
# For OS X
# masterIniSubpath = path.join("*.app", "Contents", "MacOS", "extensions",
#                              "talkback@mozilla.org", "components",
#                              "talkback", "master.ini"
defaultTitle = "qm-pxp01"

help_message = '''
This is the buildbot performance runner's YAML configurator.bean

USAGE: python PerfConfigurator.py --title title --executablePath path --configFilePath cpath --buildid id --branch branch --testDate date --resultsServer server --resultsLink link --activeTests testlist

example testlist: tp:tsspider:tdhtml:twinopen
'''

class PerfConfigurator:
    exePath = ""
    configPath = "."
    outputName = ""
    title = ""
    branch = ""
    buildid = ""
    currentDate = ""
    verbose = False
    testDate = ""
    useId = False
    resultsServer = ''
    resultsLink = ''
    activeTests = ''
    noChrome = False
    
    def _dumpConfiguration(self):
        """dump class configuration for convenient pickup or perusal"""
        print "Writing configuration:"
        print " - title = " + self.title
        print " - executablePath = " + self.exePath
        print " - configPath = " + self.configPath
        print " - outputName = " + self.outputName
        print " - branch = " + self.branch
        print " - buildid = " + self.buildid
        print " - currentDate = " + self.currentDate
        print " - testDate = " + self.testDate
        print " - resultsServer = " + self.resultsServer
        print " - resultsLink = " + self.resultsLink
        print " - activeTests = " + self.activeTests
    
    def _getCurrentDateString(self):
        """collect a date string to be used in naming the created config file"""
        currentDateTime = datetime.now()
        return currentDateTime.strftime("%Y%m%d_%H%M")
    
    def _getCurrentBuildId(self):
        master = open(path.join(path.dirname(self.exePath), masterIniSubpath))
        if not master:
            raise Configuration("Unable to open " 
              + path.join(path.dirname(self.exePath), masterIniSubpath))
        masterContents = master.readlines()
        master.close()
        reBuildid = re.compile('BuildID\s*=\s*(\d{10}|\d{12})')
        for line in masterContents:
            match = re.match(reBuildid, line)
            if match:
                return match.group(1)
        raise Configuration("BuildID not found in " 
          + path.join(path.dirname(self.exePath), masterIniSubpath))
    
    def _getTimeFromTimeStamp(self):
        if len(self.testDate) == 14: 
          buildIdTime = time.strptime(self.testDate, "%Y%m%d%H%M%S")
        elif len(self.testDate) == 12: 
          buildIdTime = time.strptime(self.testDate, "%Y%m%d%H%M")
        else:
          buildIdTime = time.strptime(self.testDate, "%Y%m%d%H")
        return time.strftime("%a, %d %b %Y %H:%M:%S GMT", buildIdTime)

    def _getTimeFromBuildId(self):
        if len(self.buildid) == 14: 
          buildIdTime = time.strptime(self.buildid, "%Y%m%d%H%M%S")
        elif len(self.buildid) == 12: 
          buildIdTime = time.strptime(self.buildid, "%Y%m%d%H%M")
        else:
          buildIdTime = time.strptime(self.buildid, "%Y%m%d%H")
        return time.strftime("%a, %d %b %Y %H:%M:%S GMT", buildIdTime)
    
    def writeConfigFile(self):
        configFile = open(path.join(self.configPath, "sample.config"))
        destination = open(self.outputName, "w")
        config = configFile.readlines()
        configFile.close()
        buildidString = "'" + str(self.buildid) + "'"
        activeList = self.activeTests.split(':')
        def addSpace(x): return '  ' + x
        activeList = map(addSpace, activeList)
        printMe = True
        testMode = False
        for line in config:
            newline = line
            if 'firefox:' in line:
                newline = 'firefox: ' + self.exePath
            if 'title:' in line:
                newline = 'title: ' + self.title
                if self.testDate:
                    newline += '\n'
                    newline += 'testdate: "%s"\n' % self._getTimeFromTimeStamp()
                elif self.useId:
                    newline += '\n'
                    newline += 'testdate: "%s"\n' % self._getTimeFromBuildId()
            if 'buildid:' in line:
                newline = 'buildid: ' + buildidString
            if 'testbranch' in line:
                newline = 'branch: ' + self.branch
            #only change the results_server if the user has provided one
            if self.resultsServer and ('results_server' in line):
                newline = 'results_server: ' + self.resultsServer + '\n'
            #only change the results_link if the user has provided one
            if self.resultsLink and ('results_link' in line):
                newline = 'results_link: ' + self.resultsLink + '\n'
            if testMode:
                #only do this if the user has provided a list of tests to turn on/off
                # otherwise, all tests are considered to be active
                if self.activeTests:
                    if line.startswith('  t'): 
                        #found the start of an individual test description
                        printMe = False
                    for test in activeList: 
                        #determine if this is a test we are going to run
                        if line.startswith(test + ':') or line.startswith(test + ' :'):
                            printMe = True
                if self.noChrome: 
                    #if noChrome is True remove --tpchrome option 
                    newline = line.replace('-tpchrome ','')
            if printMe:
                destination.write(newline)
            if line.startswith('tests :'): 
                #enter into test writing mode
                testMode = True
                if self.activeTests:
                    printMe = False
        destination.close()
        if self.verbose:
            self._dumpConfiguration()
    
    def __init__(self, **kwargs):
        if 'title' in kwargs:
            self.title = kwargs['title']
        if 'branch' in kwargs:
            self.branch = kwargs['branch']
        if 'executablePath' in kwargs:
            self.exePath = kwargs['executablePath']
        if 'configFilePath' in kwargs:
            self.configPath = kwargs['configFilePath']
        if 'outputName' in kwargs:
            self.outputName = kwargs['outputName']
        if 'buildid' in kwargs:
            self.buildid = kwargs['buildid']
        if 'verbose' in kwargs:
            self.verbose = kwargs['verbose']
        if 'testDate' in kwargs:
            self.testDate = kwargs['testDate']
        if 'resultsServer' in kwargs:
            self.resultsServer = kwargs['resultsServer']
        if 'resultsLink' in kwargs:
            self.resultsLink = kwargs['resultsLink']
        if 'activeTests' in kwargs:
            self.activeTests = kwargs['activeTests']
        if 'noChrome' in kwargs:
            self.noChrome = kwargs['noChrome']
        self.currentDate = self._getCurrentDateString()
        if not self.buildid:
            self.buildid = self._getCurrentBuildId()
        if not self.outputName:
            self.outputName = self.currentDate + "_config.yml"


class Configuration(Exception):
    def __init__(self, msg):
        self.msg = "ERROR: " + msg

class Usage(Exception):
    def __init__(self, msg):
        self.msg = msg

def main(argv=None):
    exePath = ""
    configPath = ""
    output = ""
    title = defaultTitle
    branch = ""
    testDate = ""
    verbose = False
    buildid = ""
    useId = False
    resultsServer = ''
    resultsLink = ''
    activeTests = ''
    noChrome = False
    
    if argv is None:
        argv = sys.argv
    try:
        try:
            opts, args = getopt.getopt(argv[1:], "hvue:c:t:b:o:i:d:s:l:a:n", 
                ["help", "verbose", "useId", "executablePath=", "configFilePath=", "title=", 
                "branch=", "output=", "id=", "testDate=", "resultsServer=", "resultsLink=", "activeTests=", "noChrome"])
        except getopt.error, msg:
            raise Usage(msg)
        
        # option processing
        for option, value in opts:
            if option in ("-v", "--verbose"):
                verbose = True
            if option in ("-h", "--help"):
                raise Usage(help_message)
            if option in ("-e", "--executablePath"):
                exePath = value
            if option in ("-c", "--configFilePath"):
                configPath = value
            if option in ("-t", "--title"):
                title = value
            if option in ("-b", "--branch"):
                branch = value
            if option in ("-o", "--output"):
                output = value
            if option in ("-i", "--id"):
                buildid = value
            if option in ("-d", "--testDate"):
                testDate = value
            if option in ("-u", "--useId"):
                useId = True
            if option in ("-s", "--resultsServer"):
                resultsServer = value
            if option in ("-l", "--resultsLink"):
                resultsLink = value
            if option in ("-a", "--activeTests"):
                activeTests = value
            if option in ("-n", "--noChrome"):
                noChrome = True
        
    except Usage, err:
        print >> sys.stderr, sys.argv[0].split("/")[-1] + ": " + str(err.msg)
        print >> sys.stderr, "\t for help use --help"
        return 2
    
    configurator = PerfConfigurator(title=title,
                                    executablePath=exePath,
                                    configFilePath=configPath,
                                    buildid=buildid,
                                    branch=branch,
                                    verbose=verbose,
                                    testDate=testDate,
                                    outputName=output,
                                    useId=useId,
                                    resultsServer=resultsServer,
                                    resultsLink=resultsLink,
                                    activeTests=activeTests,
                                    noChrome=noChrome)
    try:
        configurator.writeConfigFile()
    except Configuration, err:
        print >> sys.stderr, sys.argv[0].split("/")[-1] + ": " + str(err.msg)
        return 5
    return 0


if __name__ == "__main__":
    sys.exit(main())

