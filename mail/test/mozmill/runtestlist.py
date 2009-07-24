#!/usr/bin/env python
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
# The Original Code is Mail Bloat Test.
#
# The Initial Developer of the Original Code is
# Mozilla Messaging.
# Portions created by the Initial Developer are Copyright (C) 2008
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Mark Banner <bugzilla@standard8.plus.com>
#   Andrew Sutherland <bugzilla@asutherland.org>
#   Ludovic Hirlimann <ludovic@hirlimann.net>
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

import optparse
import sys
import os
import shutil
import subprocess
import logging

SCRIPT_DIRECTORY = os.path.abspath(os.path.realpath(os.path.dirname(sys.argv[0])))

class RunTestListOptions(optparse.OptionParser):
    """Parsed run test list command line options."""
    def __init__(self, **kwargs):
        optparse.OptionParser.__init__(self, **kwargs)
        defaults = {}

        self.add_option("--binary",
                        action = "store", type = "string", dest = "binary",
                        help = "Binary to be run")
        defaults["binary"] = ""

        self.add_option("--list",
                        action = "store", type = "string", dest = "list",
                        help = "List of tests to be run")
        defaults["list"] = ""

        self.add_option("--dir",
                        action = "store", type = "string", dest = "dir",
                        help = "Directory of the tests, leave blank for current directory")
        defaults["dir"] = ""

        self.set_defaults(**defaults);

        usage = """\
Usage instructions for runtestlist.py
All arguments must be specified.
"""
        self.set_usage(usage)

log = logging.getLogger()
handler = logging.StreamHandler(sys.stdout)
log.setLevel(logging.INFO)
log.addHandler(handler)

parser = RunTestListOptions()
options, args = parser.parse_args()

if options.binary == "" or options.list == "":
    parser.print_help()
    sys.exit(1)

totalTestErrors = 0
totalTestPasses = 0
totalDirectories = 0

f = open(options.list, 'rt')
for directory in f:
    log.info("INFO | (runtestlist.py) | Running directory: %s",
             directory.rstrip())
    if options.dir != "":
        testDirectory = os.path.join(options.dir, directory.rstrip())
    else:
        testDirectory = directory.rstrip()
    args = ["python", "runtest.py", "-t", testDirectory, "--binary",
                   options.binary]
    print args
    outputPipe = subprocess.PIPE

    proc = subprocess.Popen(args, cwd=SCRIPT_DIRECTORY, stdout = subprocess.PIPE, stderr = subprocess.STDOUT)

    testErrors = 0
    testPasses = 0

    line = proc.stdout.readline()
    while line != "":
        log.info(line.rstrip())
        if line.find("TEST-UNEXPECTED-") != -1:
            testErrors += 1
        if line.find("TEST-PASS") != -1:
            testPasses += 1
        line = proc.stdout.readline()

    result = proc.wait()

    if result != 0:
        log.info("TEST-UNEXPECTED-FAIL | (runtestlist.py) | Exited with code %d during directory run", result)
        totalTestErrors += 1
    else:
        totalTestPasses += 1

    log.info("INFO | (runtestlist.py) | %s: %d passed, %d failed",
             directory.rstrip(), testPasses, testErrors)
    totalTestErrors += testErrors
    totalTestPasses += testPasses
    totalDirectories += 1


log.info("INFO | (runtestlist.py) | Directories Run: %d, Passed: %d, Failed: %d",
         totalDirectories, totalTestPasses, totalTestErrors)

if totalTestErrors:
    sys.exit(1)
