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
#   Chris Cooper <ccooper@mozilla.com>
# ***** END LICENSE BLOCK *****

import buildbot
from buildbot.process.buildstep import LoggedRemoteCommand, LoggingBuildStep
from buildbot.steps.shell import ShellCommand
from buildbot.status.builder import FAILURE, SUCCESS

class CreateDir(ShellCommand):
    name = "create dir"
    haltOnFailure = False
    warnOnFailure = True

    def __init__(self, **kwargs):
        if not 'platform' in kwargs:
            return FAILURE
        self.platform = kwargs['platform']
        if 'dir' in kwargs:
            self.dir = kwargs['dir']
        if self.platform.startswith('win'):
            self.command = r'if not exist ' + self.dir + r' mkdir ' + self.dir
        else:
            self.command = ['mkdir', '-p', self.dir]
        ShellCommand.__init__(self, **kwargs)

class TinderboxShellCommand(ShellCommand):
    haltOnFailure = False
    
    """This step is really just a 'do not care' buildstep for executing a
       slave command and ignoring the results.
       Always returns SUCCESS
    """
    
    def evaluateCommand(self, cmd):
       return SUCCESS

class GetHgRevision(ShellCommand):
    """Retrieves the revision from a Mercurial repository. Builds based on
    comm-central use this to query the revision from mozilla-central which is
    pulled in via client.py, so the revision of the platform can be displayed
    in addition to the comm-central revision we get through got_revision.
    """
    name = "get hg revision"
    command = ["hg", "identify", "-i"]

    def commandComplete(self, cmd):
        rev = ""
        try:
            rev = cmd.logs['stdio'].getText().strip().rstrip()
            self.setProperty('hg_revision', rev)
        except:
            log.msg("Could not find hg revision")
            log.msg("Output: %s" % rev)
            return FAILURE
        return SUCCESS

class GetBuildID(ShellCommand):
    """Retrieves the BuildID from a Mozilla tree (using platform.ini) and sets
    it as a build property ('buildid'). If defined, uses objdir as it's base.
    """
    description=['getting buildid']
    descriptionDone=['get buildid']
    haltOnFailure=True

    def __init__(self, objdir="", **kwargs):
        ShellCommand.__init__(self, **kwargs)
        major, minor, point = buildbot.version.split(".", 3)
        # Buildbot 0.7.5 and below do not require this
        if int(minor) >= 7 and int(point) >= 6:
            self.addFactoryArguments(objdir=objdir)

        self.objdir = objdir
        self.command = ['python', 'config/printconfigsetting.py',
                        '%s/dist/bin/application.ini' % self.objdir,
                        'App', 'BuildID']

    def commandComplete(self, cmd):
        buildid = ""
        try:
            buildid = cmd.logs['stdio'].getText().strip().rstrip()
            self.setProperty('buildid', buildid)
        except:
            log.msg("Could not find BuildID or BuildID invalid")
            log.msg("Found: %s" % buildid)
            return FAILURE
        return SUCCESS


class SetMozillaBuildProperties(LoggingBuildStep):
    """Gathers and sets build properties for the following data:
      buildid - BuildID of the build (from application.ini, falling back on
       platform.ini)
      appVersion - The version of the application (from application.ini, falling
       back on platform.ini)
      packageFilename - The filename of the application package
      packageSize - The size (in bytes) of the application package
      packageHash - The sha1 hash of the application package
      installerFilename - The filename of the installer (win32 only)
      installerSize - The size (in bytes) of the installer (win32 only)
      installerHash - The sha1 hash of the installer (win32 only)
      completeMarFilename - The filename of the complete update
      completeMarSize - The size (in bytes) of the complete update
      completeMarHash - The sha1 hash of the complete update

      All of these will be set as build properties -- even if no data is found
      for them. When no data is found, the value of the property will be None.

      This function requires an argument of 'objdir', which is the path to the
      objdir relative to the builddir. ie, 'mozilla/fx-objdir'.
    """

    def __init__(self, objdir="", **kwargs):
        LoggingBuildStep.__init__(self, **kwargs)
        self.addFactoryArguments(objdir=objdir)
        self.objdir = objdir

    def describe(self, done=False):
        if done:
            return ["gather", "build", "properties"]
        else:
            return ["gathering", "build", "properties"]

    def start(self):
        args = {'objdir': self.objdir, 'timeout': 60}
        cmd = LoggedRemoteCommand("setMozillaBuildProperties", args)
        self.startCommand(cmd)

    def evaluateCommand(self, cmd):
        # set all of the data as build properties
        # some of this may come in with the value 'UNKNOWN' - these will still
        # be set as build properties but 'UNKNOWN' will be substituted with None
        try:
            log = cmd.logs['stdio'].getText()
            for property in log.split("\n"):
                name, value = property.split(": ")
                if value == "UNKNOWN":
                    value = None
                self.setProperty(name, value)
        except:
            return FAILURE
        return SUCCESS


class MozillaClobber(ShellCommand):
    """Clobbers on demand, reading requested clobbers from 'clobberURL'"""

    flunkOnFailure=False
    warnOnFailure=False
    haltOnFailure=False
    workdir="."
    description=["clobbering", "if necessary"]
    
    def __init__(self, clobberURL, **kwargs):
        self.clobberURL = clobberURL
        if 'command' not in kwargs:
            kwargs['command'] = ["python", "-c", """
import sys, shutil, urllib2, urllib, os
from datetime import datetime, timedelta
PERIODIC_CLOBBER_TIME = timedelta(days=7)

def str_to_datetime(str):
  return datetime.strptime(str, "%Y-%m-%d %H:%M:%S")

def datetime_to_str(dt):
  return dt.strftime("%Y-%m-%d %H:%M:%S")

def write_file(dt, file):
  if isinstance(dt, datetime):
    dt = datetime_to_str(dt)
  f = open(file, 'w')
  f.write(dt)
  f.close()

def do_clobber():
  try:
    if os.path.exists('build'):
      print "Clobbering build directory"
      shutil.rmtree("build")
  except:
    print "Couldn't clobber properly, bailing out."
    sys.exit(1)

url, = sys.argv[1:]
url = urllib.quote(url, ':=?/~')

try:
  print "Checking clobber URL: %s" % url
  cur_force_date = urllib2.urlopen(url).read()
  print "Current forced clobber date: %s" % cur_force_date
  if not os.path.exists('force-clobber'):
    write_file(cur_force_date, 'force-clobber')
  else:
    old_force_date = open('force-clobber').read()
    print "Last forced clobber: %s" % old_force_date
    if old_force_date != cur_force_date:
      print "Clobber forced, clobbering build directory"
      do_clobber()
      write_file(cur_force_date, 'force-clobber')
      write_file(cur_force_date, 'last-clobber')
      sys.exit(0)
except:
  print "Couldn't poll %s, skipping forced clobber" % url
  
if not os.path.exists('last-clobber'):
  write_file(datetime.utcnow(), 'last-clobber')
else:
  last_clobber = str_to_datetime(open('last-clobber').read())
  cur_date = datetime.utcnow()
  print "Last clobber: %s" % datetime_to_str(last_clobber)
  print "Current time: %s" % datetime_to_str(cur_date)
  if (last_clobber + PERIODIC_CLOBBER_TIME < cur_date):
    print "More than %s have passed since the last clobber, clobbering " \
          "build directory" % PERIODIC_CLOBBER_TIME
    do_clobber()
    # if do_clobber fails the script will exit and this will not be executed
    write_file(cur_date, 'last-clobber')
""",
            self.clobberURL]
        if 'workdir' not in kwargs:
            kwargs['workdir'] = self.workdir

        ShellCommand.__init__(self, **kwargs)
        self.addFactoryArguments(clobberURL=clobberURL)
