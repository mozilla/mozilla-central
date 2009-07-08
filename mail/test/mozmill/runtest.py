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

"""
Runs the Bloat test harness
"""

import sys
import os
import shutil
import mozrunner
import jsbridge
import mozmill
import socket
import copy
from time import sleep

class ThunderTestProfile(mozrunner.ThunderbirdProfile):
    preferences = {
        # say yes to debug output via dump
        'browser.dom.window.dump.enabled': True,
        # say no to slow script warnings
        'dom.max_chrome_script_run_time': 200,
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
        'mail.account.account1.server' :  "server1",
        'mail.account.account2.identities' :  "id1",
        'mail.account.account2.server' :  "server2",
        'mail.accountmanager.accounts' :  "account1,account2",
        'mail.accountmanager.defaultaccount' :  "account2",
        'mail.accountmanager.localfoldersserver' :  "server1",
        'mail.identity.id1.fullName' :  "Tinderbox",
        'mail.identity.id1.smtpServer' :  "smtp1",
        'mail.identity.id1.useremail' :  "tinderbox@invalid.com",
        'mail.identity.id1.valid' :  True,
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
        'mailnews.start_page_override.mstone' :  "ignore",
        }

    def __init__(self, default_profile=None, profile=None, create_new=True,
                 plugins=[], preferences={}):
        self.init_env()
        self.init_paths()
        mozrunner.Profile.__init__(self, default_profile, profile, create_new, plugins, preferences)


    def init_paths(self):
        global automation
        self.src_dir = self.find_src_dir()
        self.obj_dir = self.find_obj_dir()

        self.automation_dir = os.path.join(self.obj_dir, 'mozilla', 'build')
        sys.path.append(self.automation_dir)
        import automation

        self.profile_dir = os.path.join(self.obj_dir, 'mozilla',
                                        '_tests', 'leakprofile')
        # XXX tidy up
        if automation.IS_MAC:
            if automation.IS_DEBUG_BUILD:
              appName = 'ShredderDebug.app'
            else:
              appName = 'Shredder.app'
            self.bin_dir = os.path.join(self.obj_dir, 'mozilla', 'dist', appName, 'Contents', 'MacOS')
            appname = 'thunderbird-bin'
        else:
            self.bin_dir = os.path.join(self.obj_dir, 'mozilla', 'dist', 'bin')
            appname = 'thunderbird'
            if automation.IS_WIN32:
                appname += '.exe'

        self.app_path = os.path.join(self.bin_dir, appname)

        self.base_test_dir = os.getcwd()


    def find_src_dir(self):
        curdir = os.getcwd()
        while not os.path.isdir(os.path.join(curdir, '.hg')):
            curdir, olddir = os.path.split(curdir)
            if curdir == '':
                raise Exception("unable to figure out src_dir")
        return os.path.expanduser(os.path.expandvars(curdir))

    def find_obj_dir(self):
        if 'MOZCONFIG' in os.environ:
            mozconfig_path = os.environ['MOZCONFIG']
        else:
            mozconfig_path = os.path.join(self.src_dir, '.mozconfig.mk')

        guess_path = os.path.join(self.src_dir, 'mozilla/build/autoconf/config.guess')
        config_guess = os.popen("sh " + guess_path).read()
        config_guess = config_guess.strip()
        f = open(mozconfig_path, 'rt')
        for line in f:
            if 'MOZ_OBJDIR' in line:
                varpath = line.split('=')[1].strip()
                varpath = varpath.replace('@TOPSRCDIR@', self.src_dir)
                varpath = varpath.replace('$(TOPSRCDIR)', self.src_dir)
                varpath = varpath.replace('@CONFIG_GUESS@',config_guess)
                return os.path.expanduser(os.path.expandvars(varpath))
        f.close()

        raise Exception("unable to figure out obj_dir")

    def init_env(self):
        self.base_env = dict(os.environ)
        # note, we do NOT want to set NO_EM_RESTART or jsbridge wouldn't work
        # avoid dialogs on windows
        self.base_env['XPCOM_DEBUG_BREAK'] = 'stack'
        # do not reuse an existing instance
        self.base_env['MOZ_NO_REMOTE'] = '1'

    def _run(self, *args, **extraenv):
        env = self.base_env.copy()
        env.update(extraenv)
        allArgs = [self.app_path]
        allArgs.extend(args)
        proc = automation.Process(allArgs, env=env)
        status = proc.wait()

    def create_new_profile(self, default_profile):
        # create a clean directory
        if os.path.exists(self.profile_dir):
            shutil.rmtree(self.profile_dir)
        os.makedirs(self.profile_dir)

        # explicitly create a profile in that directory
        self._run('-CreateProfile', 'test ' + self.profile_dir)
        return self.profile_dir

    def cleanup(self):
        '''
        Do not cleanup at all.  The next iteration will cleanup for us, but
        until that time it's useful for debugging failures to leave everything
        around.
        '''
        pass

class ThunderTestRunner(mozrunner.ThunderbirdRunner):

    def __init__(self, *args, **kwargs):
        self.profile = args[1]
        kwargs['env'] = self.profile.base_env
        mozrunner.Runner.__init__(self, *args, **kwargs)

    def find_binary(self):
        return self.profile.app_path


class ThunderTestCLI(mozmill.CLI):

    profile_class = ThunderTestProfile
    runner_class = ThunderTestRunner
    parser_options = copy.copy(mozmill.CLI.parser_options)
    parser_options[('-m', '--bloat-tests')] = {"default":None, "dest":"created_profile", "help":"Log file name."}


    def parse_and_get_runner(self):
        """Parses the command line arguments and returns a runner instance."""
        (options, args) = self.parser.parse_args()
        self.options = options
        self.args = args
        if self.options.plugins is None:
            plugins = []
        else:
            plugins = self.options.plugins.split(',')
            
        if self.options.test is not None:
            curdir = os.getcwd()
            localprofile = os.path.join(curdir, self.options.test ,"profile")
            if os.path.isfile(localprofile):
                profilefile = open(localprofile,"r")
                nameinfile = profilefile.readline()
                profilename = os.path.join(curdir, "profiles", nameinfile)
                workingprofile = os.path.join(curdir, "work_profile", nameinfile)
                if os.path.exists(workingprofile):
                    shutil.rmtree(workingprofile)
                shutil.copytree(profilename, workingprofile, False)
                crea_new = False
                def_profile = False
            else:
                def_profile = options.default_profile
                workingprofile = options.profile
                crea_new = options.create_new

        profile = self.get_profile(def_profile, 
                                   workingprofile, crea_new,
                                   plugins=plugins)
        runner = self.get_runner(binary=self.options.binary, 
                                 profile=profile)
        
        return runner


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
        print 'TEST', result['name'], len(result['fails']) and "FAILED" or "PASSED"
        for failure in result['fails']:
            if 'exception' in failure:
                prettyPrintException(failure['exception'])

import atexit
atexit.register(prettyPrintResults)

if __name__ == '__main__':
    ThunderTestCLI().run()
