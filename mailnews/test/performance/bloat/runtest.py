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
#
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

"""
Runs the Bloat test harness
"""

import sys
import os
import shutil

if len(sys.argv) < 2:
  print "Usage: $0 objdir"
  sys.exit(1)

OBJDIR = os.path.abspath(os.path.realpath(sys.argv[1]))
AUTOMATION_DIR = os.path.join(OBJDIR, 'mozilla', 'build')
sys.path.append(AUTOMATION_DIR)
import automation

CWD = os.getcwd()
SCRIPTDIR = os.path.abspath(os.path.realpath(os.path.dirname(sys.argv[0])))

if automation.IS_MAC:
  BINDIR = os.path.join(OBJDIR, 'mozilla', 'dist', 'ShredderDebug.app', 'Contents', 'MacOS')
else:
  BINDIR = os.path.join(OBJDIR, 'mozilla', 'dist', 'bin')

if automation.IS_MAC:
  EXECUTABLE = 'thunderbird-bin'
else:
  EXECUTABLE = 'thunderbird'
BIN = os.path.join(BINDIR, EXECUTABLE)
PROFILE = os.path.join(OBJDIR, 'mozilla', '_leaktest', 'leakprofile')

# Wipe the profile
if os.path.exists(PROFILE):
  shutil.rmtree(PROFILE)
os.mkdir(PROFILE)

defaultEnv = dict(os.environ)
defaultEnv['NO_EM_RESTART'] = '1'
defaultEnv['XPCOM_DEBUG_BREAK'] = 'warn'

defaultArgs = ['-no-remote']
if automation.IS_MAC:
  defaultArgs.append('-foreground')

COMMANDS = [
  {
    'name': 'register',
    'args': ['-register'],
  },
  {
    'name': 'createProfile',
    'args': ['-CreateProfile', 'bloat ' + PROFILE],
  },
  {
   'name': 'setupTests',
   'bin':  sys.executable,
   'args': ['setUpBloatTest.py',
            '--profile-dir=' + PROFILE,
            '--binary-dir=' + BINDIR,
           ],
    'cwd': SCRIPTDIR,
  },
  {
   'name': 'bloatTests',
   'args': ['-profile', PROFILE],
   'env': {'XPCOM_MEM_BLOAT_LOG': 'bloat.log'},
  },
  {
   'name': 'leakTests',
   'args': ['-profile',         PROFILE,
            '--trace-malloc',   'malloc.log',
            '--shutdown-leaks', 'sdleak.log',
           ],
   'env': {'XPCOM_MEM_BLOAT_LOG': 'trace-bloat.log'},
  }
]


for cmd in COMMANDS:
  # Some scripts rely on the cwd
  cwd = CWD
  if 'cwd' in cmd:
    cwd = cmd['cwd']
  os.chdir(cwd)

  # Set up the environment
  mailnewsEnv = defaultEnv
  if 'env' in cmd:
    mailnewsEnv.update(cmd['env'])

  # Build the command
  binary = BIN
  # Copy default args, using the : option.
  args = defaultArgs[:]
  args.extend(cmd['args'])

  # Different binary implies no default args
  if 'bin' in cmd:
    binary = cmd['bin']
    args = cmd['args']

  print >> sys.stderr, 'Running ' + cmd['name'] + ' in ' + CWD + ' : '
  print >> sys.stderr, binary, args
  envkeys = mailnewsEnv.keys()
  envkeys.sort()
  for envkey in envkeys:
    print >> sys.stderr, "%s=%s"%(envkey, mailnewsEnv[envkey])

  proc = automation.Process(binary, args, env = mailnewsEnv)
  status = proc.wait()
  if status != 0:
    print >> sys.stderr, "ERROR FAIL Exited with code %d during test run"%(status)
    sys.exit(status)
