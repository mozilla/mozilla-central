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
# The Original Code is Mozilla Corporation Code.
#
# The Initial Developer of the Original Code is
# Mikeal Rogers.
# Portions created by the Initial Developer are Copyright (C) 2008
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Mikeal Rogers <mikeal.rogers@gmail.com>
#  Henrik Skupin <hskupin@mozilla.com>
#  Clint Talbert <ctalbert@mozilla.com>
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

import copy
import httplib
import imp
import os
import socket
import sys
import traceback
import urllib
import urlparse

from datetime import datetime, timedelta
import manifestparser

try:
    import json
except:
    import simplejson as json

# setup logger
import logging
logger = logging.getLogger('mozmill')

import jsbridge
from jsbridge.network import JSBridgeDisconnectError
import mozrunner

from time import sleep

basedir = os.path.abspath(os.path.dirname(__file__))

extension_path = os.path.join(basedir, 'extension')

mozmillModuleJs = "Components.utils.import('resource://mozmill/modules/mozmill.js')"

try:
    import pkg_resources
    version = pkg_resources.get_distribution('mozmill').version
except:
    # pkg_resources not available
    version = None

class LoggerListener(object):
    cases = {
        'mozmill.pass':   lambda string: logger.info('Step Pass: ' + string),
        'mozmill.fail':   lambda string: logger.error('Test Failure: ' + string),
        'mozmill.skip':   lambda string: logger.info('Test Skipped: ' + string)
    }
    
    class default(object):
        def __init__(self, eName): self.eName = eName
        def __call__(self, string):
            if string:
                logger.debug(self.eName + ' | ' + string)
            else:
                logger.debug(self.eName)
    
    def __call__(self, eName, obj):
        if obj == {}:
            string = ''
        else:
            string = json.dumps(obj)

        if eName not in self.cases:
            self.cases[eName] = self.default(eName)
        self.cases[eName](string)


class TestsFailedException(Exception):
    """exception to be raised when the tests fail"""
    # XXX unused


class MozMill(object):
    """
    MozMill is a one-shot test runner  You should use MozMill as follows:

    m = MozMill(...)
    m.start(...)
    m.run_tests()
    m.stop()

    You should *NOT* vary from this order of execution.  If you have need to
    run different sets of tests, create a new instantiation of MozMill
    """

    report_type = 'mozmill-test'

    def __init__(self,
                 runner_class=mozrunner.FirefoxRunner, 
                 profile_class=mozrunner.FirefoxProfile,
                 jsbridge_port=24242,
                 jsbridge_timeout=60):
        """
        - runner_class : which mozrunner class to use
        - profile_class : which class to use to generate application profiles
        - jsbridge_port : port jsbridge uses to connect to to the application
        - jsbridge_timeout : how long to go without jsbridge communication
        """
        
        self.runner_class = runner_class
        self.profile_class = profile_class
        self.jsbridge_port = jsbridge_port
        self.jsbridge_timeout = jsbridge_timeout

        self.passes = [] ; self.fails = [] ; self.skipped = []
        self.alltests = []

        self.persisted = {}
        self.endRunnerCalled = False
        self.shutdownModes = enum('default', 'user_shutdown', 'user_restart')
        self.currentShutdownMode = self.shutdownModes.default
        self.userShutdownEnabled = False
        self.tests = []

        # test time
        self.starttime = self.endtime = None

        # setup event listeners
        self.global_listeners = []
        self.listeners = []
        self.add_listener(self.persist_listener, eventType="mozmill.persist")
        self.add_listener(self.endTest_listener, eventType='mozmill.endTest')
        self.add_listener(self.endRunner_listener, eventType='mozmill.endRunner')
        self.add_listener(self.startTest_listener, eventType='mozmill.setTest')
        self.add_listener(self.userShutdown_listener, eventType='mozmill.userShutdown')

        # disable the crashreporter
        os.environ['MOZ_CRASHREPORTER_NO_REPORT'] = '1'

    def add_listener(self, callback, **kwargs):
        self.listeners.append((callback, kwargs,))

    def add_global_listener(self, callback):
        self.global_listeners.append(callback)

    def persist_listener(self, obj):
        self.persisted = obj

    def fire_python_callback(self, method, arg, python_callbacks_module):
        meth = getattr(python_callbacks_module, method)
        try:
            meth(arg)
        except Exception, e:
            self.endTest_listener({"name":method, "failed":1, 
                                   "python_exception_type":e.__class__.__name__,
                                   "python_exception_string":str(e),
                                   "python_traceback":traceback.format_exc(),
                                   "filename":python_callbacks_module.__file__})
            return False
        self.endTest_listener({"name":method, "failed":0, 
                               "filename":python_callbacks_module.__file__})
        return True
    
    def firePythonCallback_listener(self, obj):
        callback_file = "%s_callbacks.py" % os.path.splitext(obj['filename'])[0]
        if os.path.isfile(callback_file):
            python_callbacks_module = imp.load_source('callbacks', callback_file)
        else:
            raise Exception("No valid callback file")
        self.fire_python_callback(obj['method'], obj['arg'], python_callbacks_module)

    def create_network(self):

        # get the bridge and the back-channel
        self.back_channel, self.bridge = jsbridge.wait_and_create_network("127.0.0.1",
                                                                          self.jsbridge_port)

        # set a timeout on jsbridge actions in order to ensure termination
        self.back_channel.timeout = self.bridge.timeout = self.jsbridge_timeout
        
        # Assign listeners to the back channel
        for listener in self.listeners:
            self.back_channel.add_listener(listener[0], **listener[1])
        for global_listener in self.global_listeners:
            self.back_channel.add_global_listener(global_listener)

    def start(self, profile=None, runner=None):

        if not profile:
            profile = self.profile_class(addons=[jsbridge.extension_path, extension_path])
        self.profile = profile
        
        if not runner:
            runner = self.runner_class(profile=self.profile, 
                                       cmdargs=["-jsbridge", str(self.jsbridge_port)])

        self.add_listener(self.firePythonCallback_listener, eventType='mozmill.firePythonCallback')
        self.runner = runner
        self.endRunnerCalled = False
        
        self.runner.start()
        self.create_network()
        self.appinfo = self.get_appinfo(self.bridge)

        # set the starttime for the tests
        # XXX assumes run_tests will be called soon after (currently true)
        self.starttime = datetime.utcnow()

    def find_tests(self, tests, files=None):
        if files is None:
            files = []
        for test in tests:

            # tests have to be absolute paths to be loaded from JS
            test = os.path.abspath(test)
            
            if os.path.isdir(test):
                directory = test
                for f in os.listdir(directory):
                    if not f.startswith('test'):
                        continue
                    path = os.path.join(directory, f)
                    if os.path.isdir(path):
                        self.find_tests([path], files)
                    else:
                        if f.endswith('.js') and path not in files:
                            files.append(path)
            else:
                files.append(test)
        return files


    def run_tests(self, tests, sleeptime=0):
        """
        run test files or directories
        - test : test files or directories to run
        - sleeptime : initial time to sleep [s] (not sure why the default is 4)
        """

        tests = self.find_tests(tests)
        self.tests.extend(tests)

        frame = jsbridge.JSObject(self.bridge,
                                  "Components.utils.import('resource://mozmill/modules/frame.js')")
        sleep(sleeptime)

        # transfer persisted data
        frame.persisted = self.persisted

        # run the test files
        for test in tests:
            frame.runTestFile(test)

        # Give a second for any callbacks to finish.
        sleep(1)

    def startTest_listener(self, test):
        self.current_test = test
        print "TEST-START | %s | %s" % (test['filename'], test['name'])

    def endTest_listener(self, test):
        fname = os.path.split(test['filename'])[1]
        if fname:
            test['name'] = "%s::%s" % (fname, test['name'])

        self.alltests.append(test)
        if test.get('skipped', False):
            print "WARNING | %s | (SKIP) %s" % (test['name'], test.get('skipped_reason', ''))
            self.skipped.append(test)
        elif test['failed'] > 0:
            print "TEST-UNEXPECTED-FAIL | %s | %s" % (test['filename'], test['name'])
            self.fails.append(test)
        else:
            print "TEST-PASS | %s | %s" % (test['filename'], test['name'])
            self.passes.append(test)

    def endRunner_listener(self, obj):
        self.endRunnerCalled = True
        
    def userShutdown_listener(self, obj):
        if obj in [self.shutdownModes.default, self.shutdownModes.user_restart, self.shutdownModes.user_shutdown]:
            self.currentShutdownMode = obj
        self.userShutdownEnabled = not self.userShutdownEnabled        

    ### methods for reporting

    def printStats(self):
        """print pass/failed/skipped statistics"""
        print "INFO Passed: %d" % len(self.passes)
        print "INFO Failed: %d" % len(self.fails)
        print "INFO Skipped: %d" % len(self.skipped)
        
    def report_disconnect(self):
        test = self.current_test
        test['passes'] = []
        test['fails'] = [{
          'exception' : {
            'message': 'Disconnect Error: Application unexpectedly closed'
          }
        }]
        test['passed'] = 0
        test['failed'] = 1
        self.alltests.append(test)
        self.fails.append(test)

    def get_appinfo(self, bridge):
        """ Collect application specific information """

        mozmill = jsbridge.JSObject(bridge, mozmillModuleJs)
        appInfo = mozmill.appInfo

        results = {'application_id': str(appInfo.ID),
                   'application_name': str(appInfo.name),
                   'application_version': str(appInfo.version),
                   'application_locale': str(mozmill.locale),
                   'platform_buildid': str(appInfo.platformBuildID),
                   'platform_version': str(appInfo.platformVersion),
                  }

        return results

    def get_platform_information(self):
        """ Retrieves platform information for test reports. Parts of that code
            come from the dirtyharry application:
            http://github.com/harthur/dirtyharry/blob/master/dirtyutils.py """

        import platform
        import re

        (system, node, release, version, machine, processor) = platform.uname()
        (bits, linkage) = platform.architecture()
        service_pack = ''

        if system in ["Microsoft", "Windows"]:
            # There is a Python bug on Windows to determine platform values
            # http://bugs.python.org/issue7860
            if "PROCESSOR_ARCHITEW6432" in os.environ:
              processor = os.environ.get("PROCESSOR_ARCHITEW6432", processor)
            else:
              processor = os.environ.get('PROCESSOR_ARCHITECTURE', processor)
            system = os.environ.get("OS", system).replace('_', ' ')
            service_pack = os.sys.getwindowsversion()[4]
        elif system == "Linux":
            (distro, version, codename) = platform.dist()
            version = distro + " " + version
            if not processor:
                processor = machine
        elif system == "Darwin":
            system = "Mac"
            (release, versioninfo, machine) = platform.mac_ver()
            version = "OS X " + release

        if processor in ["i386", "i686"]:
            if bits == "32bit":
                processor = "x86"
            elif bits == "64bit":
                processor = "x86_64"
        elif processor == "AMD64":
            bits = "64bit"
            processor = "x86_64"
        elif processor == "Power Macintosh":
            processor = "ppc"

        bits = re.search('(\d+)bit', bits).group(1)

        platform = {'hostname': node,
                    'system': system,
                    'version': version,
                    'service_pack': service_pack,
                    'processor': processor,
                    'bits': bits
                   }

        return platform

    def get_report(self):
        """get the report results"""
        format = "%Y-%m-%dT%H:%M:%SZ"

        assert self.tests, 'no tests have been run!'
        assert self.starttime, 'starttime not set; have you started the tests?'
        if not self.endtime:
            self.endtime = datetime.utcnow()

        report = {'report_type': self.report_type,
                  'mozmill_version': version,
                  'time_start': self.starttime.strftime(format),
                  'time_end': self.endtime.strftime(format),
                  'time_upload': 'n/a',
                  'tests_passed': len(self.passes),
                  'tests_failed': len(self.fails),
                  'tests_skipped': len(self.skipped),
                  'results': self.alltests
                 }

        report.update(self.appinfo)
        report.update(self.runner.get_repositoryInfo())
        report['system_info'] = self.get_platform_information()

        return report

    def send_report(self, results, report_url):
        """ Send a report of the results to a CouchdB instance or a file. """

        # report to file or stdout
        f = None
        if report_url == 'stdout': # stdout
            f = sys.stdout
        if report_url.startswith('file://'):
            filename = report_url.split('file://', 1)[1]
            try:
                f = file(filename, 'w')
            except Exception, e:
                print "Printing results to '%s' failed (%s)." % (filename, e)
                return
        if f:
            print >> f, json.dumps(results)
            return

        # report to CouchDB
        try:
            # Set the upload time of the report
            now = datetime.utcnow()
            results['time_upload'] = now.strftime("%Y-%m-%dT%H:%M:%SZ")

            # Parse URL fragments and send data
            url_fragments = urlparse.urlparse(report_url)
            connection = httplib.HTTPConnection(url_fragments.netloc)
            connection.request("POST", url_fragments.path, json.dumps(results),
                               {"Content-type": "application/json"})
        
            # Get response which contains the id of the new document
            response = connection.getresponse()
            data = json.loads(response.read())
            connection.close()

            # Check if the report has been created
            if not data['ok']:
                print "Creating report document failed (%s)" % data
                return data

            # Print document location to the console and return
            print "Report document created at '%s%s'" % (report_url, data['id'])
            return data
        except Exception, e:
            print "Sending results to '%s' failed (%s)." % (report_url, e)

    def report(self, report_url):
        """print statistics and send the JSON report"""
        self.printStats()

        if report_url:
            results = self.get_report()
            return self.send_report(results, report_url)

    ### methods for shutting down and cleanup

    def stop_runner(self, timeout=30, close_bridge=False, hard=False):
        sleep(1)
        try:
            mozmill = jsbridge.JSObject(self.bridge, mozmillModuleJs)
            mozmill.cleanQuit()
        except (socket.error, JSBridgeDisconnectError):
            pass
        except:
            self.runner.cleanup()
            raise
        
        if not close_bridge:
            starttime = datetime.utcnow()
            self.runner.wait(timeout=timeout)
            endtime = datetime.utcnow()
            if ( endtime - starttime ) > timedelta(seconds=timeout):
                try:
                    self.runner.stop()
                except:
                    pass
                self.runner.wait()
        else: # TODO: unify this logic with the above better
            if hard:
                self.runner.cleanup()
                return

            # XXX this call won't actually finish in the specified timeout time
            self.runner.wait(timeout=timeout)

            self.back_channel.close()
            self.bridge.close()
            x = 0
            while x < timeout:
                if self.endRunnerCalled:
                    break
                sleep(1)
                x += 1
            else:
                print "WARNING | endRunner was never called. There must have been a failure in the framework."
                self.runner.cleanup()
                sys.exit(1)

    def stop(self, fatal=False):
        """cleanup"""

        # stop the runner
        self.stop_runner(timeout=10, close_bridge=True, hard=fatal)

        # cleanup the profile if you need to
        if self.runner is not None:
            self.runner.cleanup()


class MozMillRestart(MozMill):

    report_type = 'mozmill-restart-test'

    def __init__(self, *args, **kwargs):
        MozMill.__init__(self, *args, **kwargs)
        self.python_callbacks = []

    def add_listener(self, callback, **kwargs):
        self.listeners.append((callback, kwargs,))

    def add_global_listener(self, callback):
        self.global_listeners.append(callback)
    
    def start(self, runner=None, profile=None):
        
        if not profile:
            profile = self.profile_class(addons=[jsbridge.extension_path, extension_path])
        self.profile = profile
        
        if not runner:
            runner = self.runner_class(profile=self.profile, 
                                       cmdargs=["-jsbridge", str(self.jsbridge_port)])
        self.runner = runner
        self.endRunnerCalled = False
        self.add_listener(self.firePythonCallback_listener, eventType='mozmill.firePythonCallback')

        # set the starttime for the tests
        # XXX assumes run_tests will be called soon after (currently true)
        self.starttime = datetime.utcnow()
     
    def firePythonCallback_listener(self, obj):
        if obj['fire_now']:
            self.fire_python_callback(obj['method'], obj['arg'], self.python_callbacks_module)
        else:
            self.python_callbacks.append(obj)
        
    def start_runner(self):

        # if user_restart we don't need to start the browser back up
        if self.currentShutdownMode != self.shutdownModes.user_restart:
            self.runner.start()

        self.create_network()
        self.appinfo = self.get_appinfo(self.bridge)
        frame = jsbridge.JSObject(self.bridge,
                                  "Components.utils.import('resource://mozmill/modules/frame.js')")
        return frame

    def run_dir(self, test_dir, sleeptime=0):
        """run a directory of restart tests resetting the profile per directory"""

        # TODO:  document this behaviour!
        if os.path.isfile(os.path.join(test_dir, 'testPre.js')):   
            pre_test = os.path.join(test_dir, 'testPre.js')
            post_test = os.path.join(test_dir, 'testPost.js') 
            if not os.path.exists(pre_test) or not os.path.exists(post_test):
                print "Skipping "+test_dir+" does not contain both pre and post test."
                return
            
            tests = [pre_test, post_test]
        else:
            if not os.path.isfile(os.path.join(test_dir, 'test1.js')):
                print "Skipping "+test_dir+" does not contain any known test file names"
                return
            tests = []
            counter = 1
            while os.path.isfile(os.path.join(test_dir, "test"+str(counter)+".js")):
                tests.append(os.path.join(test_dir, "test"+str(counter)+".js"))
                counter += 1

        self.add_listener(self.endRunner_listener, eventType='mozmill.endRunner')

        if os.path.isfile(os.path.join(test_dir, 'callbacks.py')):
            self.python_callbacks_module = imp.load_source('callbacks', os.path.join(test_dir, 'callbacks.py'))

        for test in tests:
            frame = self.start_runner()
            self.currentShutdownMode = self.shutdownModes.default
            self.endRunnerCalled = False
            sleep(sleeptime)

            frame.persisted = self.persisted
            try:
                frame.runTestFile(test)
                while not self.endRunnerCalled:
                    sleep(.25)
                self.currentShutdownMode = self.shutdownModes.default
                self.stop_runner()
                sleep(2) # Give mozrunner some time to shutdown the browser
            except JSBridgeDisconnectError:
                if not self.userShutdownEnabled:
                    raise JSBridgeDisconnectError()
            self.userShutdownEnabled = False

            for callback in self.python_callbacks:
                self.fire_python_callback(callback['method'], callback['arg'], self.python_callbacks_module)
            self.python_callbacks = []
        
        self.python_callbacks_module = None    
        
        # Reset the profile.
        profile = self.runner.profile
        profile.cleanup()
        if profile.create_new:
            profile.profile = profile.create_new_profile(self.runner.binary)                
        for addon in profile.addons:
            profile.install_addon(addon)
        if jsbridge.extension_path not in profile.addons:
            profile.install_addon(jsbridge.extension_path)
        if extension_path not in profile.addons:
            profile.install_addon(extension_path)
        profile.set_preferences(profile.preferences)

    def find_tests(self, tests):
        files = []

        # make sure these are all directories
        not_dir = [ i for i in tests
                    if not os.path.isdir(i) ]
        if not_dir:
            raise IOError('Restart tests must be directories (%s)' % ', '.join(not_dir))

        for test_dir in tests:

            # tests have to be absolute paths, for some reason
            test_dir = os.path.abspath(test_dir)

            # XXX this allows for only one sub-level of test directories
            # is this a spec or a side-effect?
            # If the former, it should be documented
            test_dirs = [os.path.join(test_dir, d)
                         for d in os.listdir(test_dir) 
                         if d.startswith('test') and os.path.isdir(os.path.join(test_dir, d))]

            if len(test_dirs):
                files.extend(test_dirs)
            else:
                files.append(test_dir)

        return files
    
    def run_tests(self, tests, sleeptime=0):

        test_dirs = self.find_tests(tests)
        self.tests.extend(test_dirs)

        for test_dir in test_dirs:
            self.run_dir(test_dir, sleeptime)

        # cleanup the profile
        self.runner.cleanup()

        # Give a second for any pending callbacks to finish
        sleep(1) 

    def stop(self, fatal=False):
        """MozmillRestart doesn't need to do cleanup as this is already done per directory"""

        # XXX this is a one-off to fix bug 581733
        # really, the entire shutdown sequence should be reconsidered and
        # made more robust. 
        # See https://bugzilla.mozilla.org/show_bug.cgi?id=581733#c20
        # This will *NOT* work with all edge cases and it shouldn't be
        # expected that adding on more kills() for each edge case will ever
        # be able to fix a systematic issue by patching holes
        if fatal:
            self.runner.cleanup()


class CLI(jsbridge.CLI):
    mozmill_class = MozMill
    module = "mozmill"

    parser_options = copy.copy(jsbridge.CLI.parser_options)
    parser_options[("-t", "--test",)] = dict(dest="test", action='append', default=[],
                                             help="Run test")
    parser_options[("-l", "--logfile",)] = dict(dest="logfile", default=None,
                                                help="Log all events to file.")
    parser_options[("--show-errors",)] = dict(dest="showerrors", default=False, 
                                              action="store_true",
                                              help="Print logger errors to the console.")
    parser_options[("--report",)] = dict(dest="report", default=False,
                                         help="Report the results. Requires url to results server. Use 'stdout' for stdout.")
    parser_options[("--show-all",)] = dict(dest="showall", default=False, action="store_true",
                                         help="Show all test output.")
    parser_options[("--timeout",)] = dict(dest="timeout", type="float",
                                          default=60., 
                                          help="seconds before harness timeout if no communication is taking place")
    parser_options[("-m", "--manifest")] = dict(dest='manifests', action='append',
                                                help='test manifest .ini file')
    parser_options[("--app-arg",)] = dict(dest='appArgs', action='append', default=[],
                                          help='provides an argument to the test application')

    def __init__(self, *args, **kwargs):
        jsbridge.CLI.__init__(self, *args, **kwargs)
        self.mozmill = self.mozmill_class(runner_class=mozrunner.FirefoxRunner,
                                          profile_class=mozrunner.FirefoxProfile,
                                          jsbridge_port=int(self.options.port),
                                          jsbridge_timeout=self.options.timeout,
                                          )

        self.tests = []

        # read tests from manifests
        if self.options.manifests:
            manifest_parser = manifestparser.TestManifest(manifests=self.options.manifests)

            self.tests.extend(manifest_parser.test_paths())

        # expand user directory for individual tests
        for test in self.options.test:
            test = os.path.expanduser(test)
            self.tests.append(test)
                
        # check existence for the tests
        missing = [ test for test in self.tests
                    if not os.path.exists(test) ]
        if missing:
            raise IOError("Not a valid test file/directory: %s" % ', '.join(["'%s'" % test for test in missing]))


        # setup log formatting
        self.mozmill.add_global_listener(LoggerListener())
        log_options = { 'format': "%(levelname)s | %(message)s",
                        'level': logging.CRITICAL }
        if self.options.showerrors:
            log_options['level'] = logging.ERROR
        if self.options.logfile:
            log_options['filename'] = self.options.logfile
            log_options['filemode'] = 'w'
            log_options['level'] = logging.DEBUG
        if self.options.test and self.options.showall:
            log_options['level'] = logging.DEBUG    
        logging.basicConfig(**log_options)

    def get_profile(self, *args, **kwargs):
        profile = jsbridge.CLI.get_profile(self, *args, **kwargs)
        profile.install_addon(extension_path)
        return profile

    def run(self):

        # create a Mozrunner
        runner = self.create_runner()

        runner.cmdargs.extend(self.options.appArgs)

        # make sure the application starts in the foreground
        if '-foreground' not in runner.cmdargs:
            runner.cmdargs.append('-foreground')

        try:
            self.mozmill.start(runner=runner, profile=runner.profile)
        except:
            runner.cleanup()
            raise

        if self.tests:

            # run the tests
            disconnected = False
            try:
                self.mozmill.run_tests(self.tests)
            except JSBridgeDisconnectError:
                disconnected = True
                if not self.mozmill.userShutdownEnabled:
                    self.mozmill.report_disconnect()               
                    print 'TEST-UNEXPECTED-FAIL | Disconnect Error: Application unexpectedly closed'
                runner.cleanup()
            except:
                runner.cleanup()
                raise

            # shutdown the test harness
            self.mozmill.stop(fatal=disconnected)

            # print statistics and send the JSON report
            self.mozmill.report(self.options.report)
            
            if self.mozmill.fails or disconnected:
                sys.exit(1)
        else:
            if self.options.shell:
                self.start_shell(runner)
            else:
                try:
                    if not hasattr(runner, 'process_handler'):
                        runner.start()
                    runner.wait()
                except KeyboardInterrupt:
                    runner.stop()

            if self.mozmill.runner is not None:
                self.mozmill.runner.cleanup()


class RestartCLI(CLI):
    mozmill_class = MozMillRestart


class ThunderbirdCLI(CLI):
    profile_class = mozrunner.ThunderbirdProfile
    runner_class = mozrunner.ThunderbirdRunner


def enum(*sequential, **named):
    enums = dict(zip(sequential, range(len(sequential))), **named)
    return type('Enum', (), enums)

def cli():
    CLI().run()

def tbird_cli():
    ThunderbirdCLI().run()

def restart_cli():
    RestartCLI().run()
