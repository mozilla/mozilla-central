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
# the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2008
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Mark Banner <bugzilla@standard8.plus.com>
#   Andrew Sutherland <bugzilla@asutherland.org>
#   Ludovic Hirlimann <ludovic@hirlimann.net>
#   Michael Foord <fuzzyman@voidspace.org.uk>
#   Siddharth Agarwal <sid.bugzilla@gmail.com>
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
import os, os.path, platform, subprocess, signal
import shutil
import mozrunner
import jsbridge
import mozmill
import socket
import copy
SCRIPT_DIRECTORY = os.path.abspath(os.path.realpath(os.path.dirname(sys.argv[0])))
sys.path.append(SCRIPT_DIRECTORY)

from automation import Automation
automation = Automation()

from automationutils import checkForCrashes
from time import sleep
import imp

PROFILE_DIR = os.path.join(SCRIPT_DIRECTORY, 'mozmillprofile')
SYMBOLS_PATH = None
# XXX This breaks any semblance of test runner modularity, and only works
# because we know that we run MozMill only once per process. This needs to be
# fixed if that ever changes.
TEST_NAME = None

# The name of the (optional) module that tests can define as a wrapper (e.g. to
# run before Thunderbird is started)
WRAPPER_MODULE_NAME = "wrapper"

# The wrapper module (if any) for the test. Just like TEST_NAME, this breaks any
# semblance of modularity.
wrapper = None

# We need this because rmtree-ing read-only files fails on Windows
def rmtree_onerror(func, path, exc_info):
    """
    Error handler for ``shutil.rmtree``.

    If the error is due to an access error (read only file)
    it attempts to add write permission and then retries.

    If the error is for another reason it re-raises the error.
    
    Usage : ``shutil.rmtree(path, onerror=rmtree_onerror)``
    """
    import stat
    if not os.access(path, os.W_OK):
        # Is the error an access error ?
        os.chmod(path, stat.S_IWUSR)
        func(path)
    else:
        raise

class ThunderTestProfile(mozrunner.ThunderbirdProfile):
    preferences = {
        # say yes to debug output via dump
        'browser.dom.window.dump.enabled': True,
        # say no to slow script warnings
        'dom.max_chrome_script_run_time': 0,
        'dom.max_script_run_time': 0,
        # disable extension stuffs
        'extensions.update.enabled'    : False,
        'extensions.update.notifyUser' : False,
        # do not ask about being the default mail client
        'mail.shell.checkDefaultClient': False,
        # disable non-gloda indexing daemons
        'mail.winsearch.enable': False,
        'mail.winsearch.firstRunDone': True,
        'mail.spotlight.enable': False,
        'mail.spotlight.firstRunDone': True,
        # disable address books for undisclosed reasons
        'ldap_2.servers.osx.position': 0,
        'ldap_2.servers.oe.position': 0,
        # disable the first use junk dialog
        'mailnews.ui.junk.firstuse': False,
        # other unknown voodoo
        # -- dummied up local accounts to stop the account wizard
        'mail.account.account1.identities' :  "id1",
        'mail.account.account1.server' :  "server1",
        'mail.account.account2.identities' :  "id1,id2",
        'mail.account.account2.server' :  "server2",
        'mail.accountmanager.accounts' :  "account1,account2",
        'mail.accountmanager.defaultaccount' :  "account2",
        'mail.accountmanager.localfoldersserver' :  "server1",
        'mail.identity.id1.fullName' :  "Tinderbox",
        'mail.identity.id1.htmlSigFormat' : False,
        'mail.identity.id1.htmlSigText' : "Tinderbox is soo 90ies",
        'mail.identity.id1.smtpServer' :  "smtp1",
        'mail.identity.id1.useremail' :  "tinderbox@invalid.com",
        'mail.identity.id1.valid' :  True,
        'mail.identity.id2.fullName' : "Tinderboxpushlog",
        'mail.identity.id2.htmlSigFormat' : True,
        'mail.identity.id2.htmlSigText' : "Tinderboxpushlog is the new <b>hotness!</b>",
        'mail.identity.id2.smtpServer' : "smtp1",
        'mail.identity.id2.useremail' : "tinderboxpushlog@invalid.com",
        'mail.identity.id2.valid' : True,
        'mail.root.none-rel' :  "[ProfD]Mail",
        'mail.root.pop3-rel' :  "[ProfD]Mail",
        'mail.server.server1.directory-rel' :  "[ProfD]Mail/Local Folders",
        'mail.server.server1.hostname' :  "Local Folders",
        'mail.server.server1.name' :  "Local Folders",
        'mail.server.server1.type' :  "none",
        'mail.server.server1.userName' :  "nobody",
        'mail.server.server2.check_new_mail' :  False,
        'mail.server.server2.directory-rel' :  "[ProfD]Mail/tinderbox",
        'mail.server.server2.download_on_biff' :  True,
        'mail.server.server2.hostname' :  "tinderbox",
        'mail.server.server2.login_at_startup' :  False,
        'mail.server.server2.name' :  "tinderbox@invalid.com",
        'mail.server.server2.type' :  "pop3",
        'mail.server.server2.userName' :  "tinderbox",
        'mail.smtp.defaultserver' :  "smtp1",
        'mail.smtpserver.smtp1.hostname' :  "tinderbox",
        'mail.smtpserver.smtp1.username' :  "tinderbox",
        'mail.smtpservers' :  "smtp1",
        'mail.startup.enabledMailCheckOnce' :  True,
        'extensions.checkCompatibility.3.3a': False,
        # In case a developer is working on a laptop without a network
        # connection, don't detect offline mode; hence we'll still startup
        # online which is what mozmill currently requires. It'll also protect us
        # from any random network failures.
        'offline.autoDetect': False,
        # Don't load what's new or the remote start page - keep everything local
        # under our control.
        'mailnews.start_page_override.mstone' :  "ignore",
        'mailnews.start_page.url': "about:blank",
        # Do not enable gloda
        'mailnews.database.global.indexer.enabled': False,
        # Do not allow fonts to be upgraded
        'mail.font.windows.version': 1
        }

    def create_new_profile(self, binary):
        '''
        We always put our profile in the same location.  We only clear it out
        when we are creating a new profile so that we can go in after the run
        and examine things for debugging or general interest.
        '''
        # create a clean directory
        if os.path.exists(PROFILE_DIR):
            shutil.rmtree(PROFILE_DIR, onerror=rmtree_onerror)
        os.makedirs(PROFILE_DIR)

        # If there's a wrapper, call it
        if wrapper is not None and hasattr(wrapper, "on_profile_created"):
            # It's a little dangerous to allow on_profile_created access to the
            # profile object, because it isn't fully initalized yet
            wrapper.on_profile_created(PROFILE_DIR)

        return PROFILE_DIR

    def cleanup(self):
        '''
        Do not cleanup at all.  The next iteration will cleanup for us, but
        until that time it's useful for debugging failures to leave everything
        around.
        '''
        pass

class ThunderTestRunner(mozrunner.ThunderbirdRunner):
    VNC_SERVER_PATH = '/usr/bin/vncserver'
    VNC_PASSWD_PATH = '~/.vnc/passwd'

    def __init__(self, *args, **kwargs):
        kwargs['env'] = env = dict(os.environ)
        # note, we do NOT want to set NO_EM_RESTART or jsbridge wouldn't work
        # avoid dialogs on windows
        if 'NO_EM_RESTART' in env:
            del env['NO_EM_RESTART']
        if 'XPCOM_DEBUG_BREAK' not in env:
            env['XPCOM_DEBUG_BREAK'] = 'stack'
        # do not reuse an existing instance
        env['MOZ_NO_REMOTE'] = '1'

        # Only use the VNC server if the capability is available and a password
        # is already defined so this can run without prompting the user.
        self.use_vnc_server = (
            platform.system() == 'Linux' and
            os.path.isfile(self.VNC_SERVER_PATH) and
            os.path.isfile(os.path.expanduser(self.VNC_PASSWD_PATH)) and
            env.get('MOZMILL_NO_VNC') != '1')

        mozrunner.Runner.__init__(self, *args, **kwargs)

    def find_binary(self):
        return self.profile.app_path

    def start(self):
        if self.use_vnc_server:
            try:
                subprocess.check_call([self.VNC_SERVER_PATH, ':99'])
            except subprocess.CalledProcessError, ex:
                # Okay, so that display probably already exists.  We can either
                # use it as-is or kill it.  I'm deciding we want to kill it
                # since there might be other processes alive in there that
                # want to make trouble for us.
                subprocess.check_call([self.VNC_SERVER_PATH, '-kill', ':99'])
                # Now let's try again.  if this didn't work, let's just let
                # the exception kill us.
                subprocess.check_call([self.VNC_SERVER_PATH, ':99'])
            self.vnc_alive = True
            self.env['DISPLAY'] = ':99'

        if wrapper is not None and hasattr(wrapper, "on_before_start"):
            wrapper.on_before_start(self.profile)

        return mozrunner.ThunderbirdRunner.start(self)

    def wait(self, timeout=None):
        '''
        Wrap the call to wait in logic that kills the VNC server when we are
        done waiting.  During normal operation, wait is the last thing.  In
        the keyboard interrupt case wait will die due to the interrupt and
        stop/kill will be killed.  Since we are wrapping wait, we don't need
        to specialize for stop/kill though.
        '''
        try:
            return mozrunner.ThunderbirdRunner.wait(self, timeout)
        finally:
            try:
                if self.use_vnc_server and self.vnc_alive:
                    subprocess.check_call([self.VNC_SERVER_PATH,
                                           '-kill', ':99'])
            except Exception, ex:
                print '!!! Exception during killing VNC server:', ex


class ThunderTestCLI(mozmill.CLI):

    profile_class = ThunderTestProfile
    runner_class = ThunderTestRunner
    parser_options = copy.copy(mozmill.CLI.parser_options)
    parser_options[('-m', '--bloat-tests')] = {"default":None, "dest":"created_profile", "help":"Log file name."}
    parser_options[('--symbols-path',)] = {"default": None, "dest": "symbols",
                                           "help": "The path to the symbol files from build_symbols"}

    def __init__(self, *args, **kwargs):
        global SYMBOLS_PATH, TEST_NAME
        # invoke jsbridge.CLI's constructor directly since we are explicitly
        #  trying to replace mozmill's CLI constructor here (which hardcodes
        #  the firefox runner and profile in 1.3 for no clear reason).
        jsbridge.CLI.__init__(self, *args, **kwargs)
        SYMBOLS_PATH = self.options.symbols
        TEST_NAME = os.path.basename(self.options.test)

        self._load_wrapper()

        self.mozmill = self.mozmill_class(runner_class=self.runner_class,
                                          profile_class=self.profile_class,
                                          jsbridge_port=int(self.options.port))

        self.mozmill.add_global_listener(mozmill.LoggerListener())

    def _load_wrapper(self):
        global wrapper
        """
        Load the wrapper module if it is present in the test directory.
        """
        if os.path.isdir(self.options.test):
            testdir = self.options.test
        else:
            testdir = os.path.dirname(self.options.test)

        try:
            (fd, path, desc) = imp.find_module(WRAPPER_MODULE_NAME, [testdir])
        except ImportError:
            # No wrapper module, which is fine.
            pass
        else:
            try:
                wrapper = imp.load_module(WRAPPER_MODULE_NAME, fd, path, desc)
            finally:
                if fd is not None:
                    fd.close()

TEST_RESULTS = []
# override mozmill's default logging case, which I hate.
def logFailure(obj):
    FAILURE_LIST.append(obj)
def logEndTest(obj):
    TEST_RESULTS.append(obj)
#mozmill.LoggerListener.cases['mozmill.fail'] = logFailure
mozmill.LoggerListener.cases['mozmill.endTest'] = logEndTest

def prettifyFilename(path):
    lslash = path.rfind('/')
    if lslash != -1:
        return path[lslash+1:]
    else:
        return path

def prettyPrintException(e):
    print '  EXCEPTION:', e.get('message', 'no message!')
    print '    at:', prettifyFilename(e.get('fileName', 'nonesuch')), 'line', e.get('lineNumber', 0)
    if 'stack' in e:
        for line in e['stack'].splitlines():
            if not line:
                continue
            if line[0] == "(":
                funcname = None
            elif line[0] == "@":
                # this is probably the root, don't care
                continue
            else:
                funcname = line[:line.find('@')]
            pathAndLine = line[line.rfind('@')+1:]
            rcolon = pathAndLine.rfind(':')
            if rcolon != -1:
                path = pathAndLine[:rcolon]
                line = pathAndLine[rcolon+1:]
            else:
                path = pathAndLine
                line = 0
            if funcname:
                print '      ', funcname, prettifyFilename(path), line
            else:
                print '           ', prettifyFilename(path), line


import pprint
def prettyPrintResults():
    for result in TEST_RESULTS:
        #pprint.pprint(result)
        if len(result['fails']) == 0:
            print 'TEST-PASS | ', result['name']
        else:
            print 'TEST-UNEXPECTED-FAIL | %s | %s' % (prettifyFilename(result['filename']), result['name'])
        for failure in result['fails']:
            if 'exception' in failure:
                prettyPrintException(failure['exception'])

import atexit
atexit.register(prettyPrintResults)

def checkCrashesAtExit():
    if checkForCrashes(os.path.join(PROFILE_DIR, 'minidumps'), SYMBOLS_PATH,
                       TEST_NAME):
        print >> sys.stderr, 'TinderboxPrint: ' + TEST_NAME + '<br/><em class="testfail">CRASH</em>'
        sys.exit(1)

if __name__ == '__main__':
    # Too bad atexit doesn't return a non-zero exit code when it encounters an
    # exception in a handler.
    try:
        ThunderTestCLI().run()
    finally:
        checkCrashesAtExit()
