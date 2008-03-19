#!/usr/bin/env python

""" 
 BotRunner - start buildbot, keep it up to date, keep it running.

 Assuming all dependencies are installed (e.g. Twisted, Python), this 
 script will:
  * check out/update buildbot from CVS
  * install buildbot 
  * initialize the basedir (as master or slave), if needed

 It then goes into an infinite loop and tries to:
  * check out/update buildbot from CVS
  * stop/install/start buildbot (if there were any CVS updates)
  * check out/update buildbot-configs from CVS
  * copy in configs/reconfig buildbot (if there were any CVS updates)
"""

import sys, getopt
from subprocess import PIPE, Popen
from time import sleep
from shutil import copyfile, copytree, copy2
from traceback import print_exc
from os.path import isdir, exists
from os import mkdir, waitpid, path, listdir
import os
if os.name == "posix":
    from os import kill
elif os.name == "nt":
    import win32api
from optparse import OptionParser
from MozBuild.Util import check_call

if os.name == "posix":
    TOPDIR = "/"
elif os.name == "nt":
    TOPDIR = "C:\\"
# Buildbot install directory
PREFIX = path.join(TOPDIR, 'tools', 'buildbot')
# CVSROOT for buildbot sources and configs
CVSROOT = ':pserver:anonymous@cvs-mirror.mozilla.org:/cvsroot'
# base directory for CVS checkouts
CHECKOUTBASE = path.join(TOPDIR, 'checkouts')
# CVS module for buildbot configs
BUILDBOT_CONFIGS = 'mozilla/tools/buildbot'
# CVS module for buildbot sources
BUILDBOT_SOURCE = 'mozilla/tools/buildbot'
# The tag or branch to pull Buildbot from
BUILDBOT_TAG = 'BUILDBOT_0_7_6_BRANCH'
# path to buildbot run script, relative to PREFIX
BUILDBOT_RUN_SCRIPT = path.join('scripts', 'buildbot.bat')
# Buildbot basedir for master 
BUILDBOT_MASTER_BASEDIR = path.join(TOPDIR, 'builds', 'buildbot', 'master')
# Buildbot basedir for slave
BUILDBOT_SLAVE_BASEDIR = path.join(TOPDIR, 'builds', 'buildbot', 'slave')
# Number of seconds to sleep before looking for updates
SLEEP = 5

def getPidsOfProcess(strings):
    """Returns the pids of all running processes matching all of the strings
       in 'strings'. This is done by greping each line of output from
       'wmic process'. Returns an empty list if no processes match.
       This function is NT specific
    """
    pids = []
    command = ['wmic', 'process', 'get', 'name,commandline,processid',
               '/format:csv']
    p = Popen(command, stdout=PIPE)
    for line in p.stdout.read().splitlines():
        if line is not "":
            values = line.split(',')
            commandLine = values[1]
            name = values[2]
            pid = values[3]
            for string in strings:
                # if any string isn't in the line, skip the rest of them
                if commandLine.find(string) is -1 and name.find(string) is -1:
                    break
                else:
                    # if this string is the last one in the list...
                    if string == strings[-1]:
                        # append the pid to the list
                        # the column at index 28 contains the PID
                        pids.append(int(pid))
                        break
    return pids

# taken from mozilla/testing/performance/talos/ffprocess_win32.py
def TerminateProcess(pid):
    """Helper function to terminate a process, given the pid

    Args:
        pid: integer process id of the process to terminate
    """

    PROCESS_TERMINATE = 1
    handle = win32api.OpenProcess(PROCESS_TERMINATE, False, pid)
    win32api.TerminateProcess(handle, -1)
    win32api.CloseHandle(handle)

class BotRunner:
    """
    BotRunner knows how to start/stop, install, and update configs for buildbot
    from CVS.
    """

    def __init__(self, isMaster=False, prefix=PREFIX, cvsroot=CVSROOT, 
                 checkoutbase=CHECKOUTBASE, basedir=None):
        """
        @type isMaster: boolean
        @param isMaster: is this a buildbot master
      
        @type prefix: str
        @param prefix: buildbot install directory
      
        @type cvsroot: str
        @param cvsroot: CVSROOT for buildbot sources and configs
  
        @type checkoutbase: str
        @param checkoutbase: CVS checkout directory for buildbot sources and configs
  
        @type basedir: str
        @param basedir: Basedir for buildbot install
        """
        self.isMaster = isMaster
        self.prefix = prefix
        self.cvsroot = cvsroot
        self.checkoutbase = checkoutbase
        self.buildbot = path.join(prefix, BUILDBOT_RUN_SCRIPT)
        if basedir:
            self.basedir = basedir
        elif isMaster:
            self.basedir = BUILDBOT_BASEDIR_MASTER
        else:
            self.basedir = BUILDBOT_BASEDIR_SLAVE
     
    def updateBuildbot(self):
        """ Update buildbot install from CVS """
        isUpdate = self.checkForUpdates(checkoutdir = 'buildbot', 
                                        module = BUILDBOT_SOURCE,
                                        tag = BUILDBOT_TAG)
        if isUpdate:
            bbotCheckout = path.join(self.checkoutbase, 'buildbot')
            if self.isRunning():
                self.stopBuildbot()
            self.installBuildbot()
            self.startBuildbot()

    def updateConfig(self):
        """ Copy buildbot master configs to buildbot dir and reconfig """
        isUpdate = self.checkForUpdates(checkoutdir = 'buildbot-configs', 
                                        module = BUILDBOT_CONFIGS)
        configDir = path.join(self.checkoutbase, 'buildbot-configs')
        if (isUpdate):
            check_call(['python', 'buildbot/contrib/checkconfig.py',
                       path.join('buildbot-configs', 'master.cfg')],
                       cwd=self.checkoutbase)
            for entry in listdir(configDir):
                if path.isdir(path.join(configDir, entry)):
                    copytree(path.join(configDir, entry),
                             path.join(self.basedir, entry))
                else:
                    copy2(path.join(configDir, entry), self.basedir)
            check_call([self.buildbot, 'reconfig', '.'], cwd=basedir)

    def checkForUpdates(self, checkoutdir, module, tag=''):
        """ CVS update method, return True if it looks like CVS updated
        @type checkoutdir: str
        @param checkoutdir: CVS checkout directory name to use

        @type module: str
        @param module: CVS module to check out 
        """
        cvsCommand = ['cvs', '-q', '-d', self.cvsroot,
                      'co', '-d', checkoutdir]
        if tag != '':
            cvsCommand.append('-r')
            cvsCommand.append(tag)
        cvsCommand.append(module)
        p = Popen(cvsCommand, cwd=self.checkoutbase, stdout=PIPE)

        retcode = p.wait()

        if retcode != 0:
            raise Exception('Command ' + str(cvsCommand) +
                            'returned non-zero exit status ' + str(retcode))
  
        
        for line in p.stdout.readlines():
            firstChar = line.split(' ')[0]
            if (firstChar == 'U') or (firstChar == 'P'):
                return True
        return False

    def isRunning(self):
        """ Use the twistd lockfile to determine if buildbot is actually 
            running 
        """
        # linux/mac
        if os.name == "posix":
            pidfile = path.join(self.basedir, 'twistd.pid')
            if not exists(pidfile):
                return False
            f = open(pidfile)
            pid = f.readline()
            f.close()
            # this checks to see if the process is running, note the "signal 0"
            return (kill(int(pid), 0) == None)
        # windows
        elif os.name == "nt":
            if len(getPidsOfProcess(['python', 'buildbot'])) > 0:
                return 1

            return 0

    def startBuildbot(self):
        """ Try to start buildbot, removing twistd.pid if exists """
        if os.name == "posix":
            pidfile = path.join(self.basedir, 'twistd.pid')
            if exists(pidfile):
                os.remove(pidfile)
            print self.buildbot 
            print self.basedir
            check_call([self.buildbot, 'start', '.'], cwd=self.basedir)
        elif os.name == "nt":
            check_call(['cmd.exe', '/C', 'start',
                        self.buildbot, 'start', self.basedir])

    def stopBuildbot(self):
        """ Try to stop buildbot """
        print "attempting to terminate buildbot"
        if os.name == "posix":
            check_call([self.buildbot, 'stop', '.'], cwd=self.basedir)
        elif os.name == "nt":
            for pid in getPidsOfProcess(['python', 'buildbot']):
                TerminateProcess(pid)

    def installBuildbot(self):
        """ Install buildbot using setup.py """
        bbotCheckout = path.join(self.checkoutbase, 'buildbot')
        # TODO run unit tests
        check_call(['python', 'setup.py', 'install', '--prefix', self.prefix], 
                   cwd=bbotCheckout)

def usage():
    print """
Usage:     botrunner <command> [command options]

Options:
    -h, --help            show this help message and exit
    -v, --version         show version number and exit
Commands:
    master        Manage a buildmaster
    slave         Manage a buildslave 
"""
    sys.exit(0)

if __name__ == '__main__':

    if len(sys.argv) < 2:
        usage()

    if sys.argv[1] == '--help' or sys.argv[1] == '-h':
        usage()

    if sys.argv[1] == '--version' or sys.argv[1] == '-v':
        print "Botrunner v0.3"
        sys.exit(0)

    p = OptionParser()
    p.add_option('-i', '--install-dir', dest='prefix', default=PREFIX,
                 help='Location of buildbot install')
    p.add_option('-c', '--checkoutbase', dest='checkoutbase', 
                 default=CHECKOUTBASE, help='Location of CVS checkout basedir')
    p.add_option('-r', '--cvsroot', dest='cvsroot', default=CVSROOT,
                 help='CVSROOT for buildbot sources and configs')
    if sys.argv[1] == 'master':
        isMaster = True
        p.add_option('-b', '--basedir', dest='basedir', 
                     default=BUILDBOT_MASTER_BASEDIR, 
                     help='Location of buildbot basedir')
        p.usage = "Usage: %prog master [options]"
        (options, args) = p.parse_args(args=sys.argv[2:])
    elif sys.argv[1] == 'slave':
        isMaster = False
        p.add_option('-b', '--basedir', dest='basedir', 
                     default=BUILDBOT_SLAVE_BASEDIR, 
                     help='Location of buildbot basedir')
        p.usage = "Usage: %prog slave [options] master:port username password"
        (options, args) = p.parse_args(args=sys.argv[2:])
        if len(args) != 3:
            p.print_help()
            sys.exit(0)
        master = args[0]
        username = args[1]
        password = args[2]
    else:
        usage()

    b = BotRunner(isMaster = isMaster, prefix = options.prefix, 
                  cvsroot = options.cvsroot, 
                  checkoutbase = options.checkoutbase, 
                  basedir = options.basedir)

    buildbot = path.join(b.prefix, BUILDBOT_RUN_SCRIPT)

    # If buildbot is not installed or configured, try to do it.
    # Note - no error handling here, the script will exit if something goes wrong.
    #if not exists(b.prefix):
    #    b.checkForUpdates('buildbot', BUILDBOT_SOURCE)
    #    b.installBuildbot()
    if not exists(b.basedir):
        print "basedir does not exist, creating"
        mkdir(b.basedir)
    if not exists(path.join(b.basedir, 'buildbot.tac')):
        if isMaster:
            check_call([buildbot, 'create-master', '.'], cwd=b.basedir)
        else:
            check_call([buildbot, 'create-slave', '.', master, username, 
                       password], cwd=b.basedir)
    
    # Loop infinitely and watch for CVS updates. Catch errors and retry,
    # unless it looks like the user wants to quit (KeyboardInterrupt)
    while True:
        try: 
            #b.updateBuildbot()
            if isMaster:
                b.updateConfig()
            if not b.isRunning():
                b.startBuildbot()
        except KeyboardInterrupt:
            print "someone wants us dead, quitting"
            sys.exit(0)
        except:
            print_exc()
            print "botrunner caught exception, continuing"
        sleep(SLEEP)

