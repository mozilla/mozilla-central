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
# ***** END LICENSE BLOCK *****

import os
from os import path, chmod
from time import localtime, strftime
import re

from twisted.python import log

from buildbot.steps.shell import ShellCommand
from buildbot.steps.source import Mercurial
from buildbot.steps.transfer import FileDownload
from buildbot.process.buildstep import BuildStep
from buildbot.sourcestamp import SourceStamp
from buildbot.buildset import BuildSet
from buildbot.status.builder import SUCCESS, SKIPPED, WARNINGS


def parseSendchangeArguments(args):
    """This function parses the arguments that the Buildbot patch uploader
       sends to Buildbot via the "changed files". It takes an argument of a
       list of files and returns a dictionary with key/value pairs
    """
    parsedArgs = {}
    for arg in args:
        try:
            (key, value) = arg.split(":", 1)
            value = value.lstrip().rstrip()
            parsedArgs[key] = value
        except:
            pass

    return parsedArgs


class MozillaTryProcessing(BuildStep):
    warnOnFailure = True
    name = "try server pre-processing"

    """This step does some preprocessing that the try server needs.
       1) Resubmits any extra changes attached to this Build.
       2) Sets all of the sendchange arguments as build properties
       3) Provides a short header to tho build to help easily identify it
    """

    def start(self):
        changes = self.step_status.build.getChanges()
        # 1) Resubmit extra changes
        if len(changes) > 1:
            builderName = self.step_status.build.builder.name
            remainingChanges = changes[1:] # everything but the first
            # get rid of the rest of the changes in the Build and BuildStatus
            changes = changes[:1] # only the first one
            self.step_status.build.changes = changes
            bs = BuildSet([builderName], SourceStamp(changes=remainingChanges))
            # submit the buildset back to the BuildMaster
            self.build.builder.botmaster.parent.submitBuildSet(bs)

        # 2) Set sendchange arguments to build properties
        args = parseSendchangeArguments(changes[0].files)
        for arg in args:
            self.setProperty(arg, args[arg])

        # 3) Add a header
        buildNum = self.step_status.build.getNumber()
        who = changes[0].who
        comments = changes[0].comments
        msg = "TinderboxPrint: %s\n" % who
        if 'identifier' in args:
            msg += "TinderboxPrint: %s\n" % args['identifier']
        msg += "Comments: %s\n\n" % comments
        self.addCompleteLog("header", msg)

        self.finished(SUCCESS)
        return SUCCESS


class MozillaDownloadMozconfig(FileDownload):
    haltOnFailure = False
    flunkOnFailure = False
    warnOnFailure = False

    def __init__(self, mastersrc=None, patchDir=".", **kwargs):
        """arguments:
        @type  patchDir:   string
        @param patchDir:   The directory on the master that holds the mozconfig
                            This directory is relative to the base buildmaster
                            directory.
                            ie. /home/buildmaster/project
                            Defaults to '.'
        """
        self.workdir = "mozilla/"
        kwargs['workdir'] = "mozilla/"
        self.patchDir = patchDir
        # masterscr and slavedest get overridden in start()
        FileDownload.__init__(self, mastersrc=mastersrc, slavedest=".mozconfig",
                              **kwargs)

    def start(self):
        changes = self.step_status.build.getChanges()
        args = parseSendchangeArguments(changes[0].files)

        # if we were passed in a mozconfig and also have an uploaded one
        # they need to be combined, with the uploaded one overwriting any
        # settings set by the passed in one
        try:
            uploadedFile = path.join(self.patchDir, args['mozconfig'])
            os.stat(uploadedFile)
            oldMasterSrc = self.mastersrc
            self.mastersrc = uploadedFile
            try:
                os.stat(oldMasterSrc)
                # we have both a passed in and uploaded mozconfig
                self.mastersrc = "%s-%s" % (uploadedFile,
                                            self.getProperty("slavename"))

                # read in both configs
                initialConfig = open(oldMasterSrc)
                newConfig = initialConfig.read()
                initialConfig.close()
                uploadedConfig = open(uploadedFile)
                newConfig += "\n"
                newConfig += uploadedConfig.read()
                uploadedConfig.close()

                # now write out the whole new thing
                mozconfig = open(self.mastersrc, "w")
                mozconfig.write(newConfig)
                mozconfig.close()
            except (OSError, TypeError, KeyError):
                # no passed in mozconfig, mastersrc set above
                try:
                    os.stat(self.mastersrc)
                except (OSError, TypeError, KeyError):
                    return SKIPPED
        except (OSError, TypeError, KeyError):
            # no uploaded mozconfig
            try:
                os.stat(self.mastersrc)
                # if this succeeds, the passed in mastersrc is valid
            except (OSError, TypeError, KeyError):
                # nothing to transfer, skip
                return SKIPPED

        # everything is set up, download the file
        FileDownload.start(self)


class MozillaPatchDownload(FileDownload):
    """This step reads a Change for a filename and downloads it to the slave.
    It is typically used in conjunction with the MozillaCustomPatch step.
    """

    haltOnFailure = True

    def __init__(self, patchDir=".", **kwargs):
        """arguments:
        @type  patchDir:    string
        @param patchDir:    The directory on the master that holds the patches
                            This directory is relative to the base buildmaster
                            directory.
                            ie. /home/buildmaster/project
                            Defaults to '.'
        'workdir' is assumed to be 'build' and should be passed if it is
        anything else.
        """

        self.patchDir = patchDir
        # mastersrc and slavedest get overridden in start()
        if not 'workdir' in kwargs:
            kwargs['workdir'] = "build"
        FileDownload.__init__(self, mastersrc=".", slavedest=".", **kwargs)

    def start(self):
        changes = self.step_status.build.getChanges()

        if len(changes) < 1:
            return

        args = parseSendchangeArguments(changes[0].files)

        self.mastersrc = "%s/%s" % (self.patchDir, args['patchFile'])
        self.slavedest = "%s" % (args['patchFile'])

        # now that everything is set-up, download the file
        FileDownload.start(self)


class MozillaUploadTryBuild(ShellCommand):
    warnOnFailure = True

    def __init__(self, slavedir, baseFilename, scpString, **kwargs):
        """
        @type  slavedir:   string
        @param slavedir:   The directory that contains the file that will be
                           transferred (on the BuildSlave)
        @type  baseFilename: string
        @param baseFilename: The filename (without the identifier) of the file
                             that will be transferred
        @type  scpString:  string
        @param scpString:  The scp user@host:/dir string to upload the file to.
                           For example,
                             foo@some.server.com:/var/www.
                           This user should have passwordless access to the
                           host.
        """
        self.slavedir = slavedir
        self.baseFilename = baseFilename
        self.scpString = scpString

        ShellCommand.__init__(self, **kwargs)

    def start(self):
        # we need to append some additional information to the package name
        # to make sure we don't overwrite any existing packages
        changes = self.step_status.build.getChanges()
        args = parseSendchangeArguments(changes[0].files)
        # the REMOTE_USER from the submission form
        changer = changes[0].who
        # the time the change was processed, this should be the same for every
        # build in a set
        when = strftime("%Y-%m-%d_%H:%M", localtime(changes[0].when))
        dir = "%s-%s-%s" % (when, changer, args['identifier'])
        # this is the filename of the package built on the slave
        filename = "%s-%s" % (args['identifier'], self.baseFilename)
        # the path to the package + the filename
        slavesrc = path.join(self.slavedir, filename)
        # the full path + full filename to the package
        # the filename is prepended with the submission time and submitter so
        # it can be sorted by the server on the other end
        self.scpString = path.join(self.scpString, dir, "%s-%s"
                                   % (changer, filename))

        self.setCommand(["scp", slavesrc, self.scpString])
        ShellCommand.start(self)


class MozillaTryServerHgClone(Mercurial):
    haltOnFailure = True
    flunkOnFailure = True
    
    def __init__(self, repourl="http://hg.mozilla.org/mozilla-central",
                 **kwargs):
        timeout = 3600
        if 'timeout' in kwargs:
            timeout = kwargs['timeout']
        # repourl overridden in startVC
        Mercurial.__init__(self, repourl=repourl, timeout=timeout, **kwargs)

    def startVC(self, branch, revision, patch):
        changes = self.step_status.build.getChanges()
        args = parseSendchangeArguments(changes[0].files)
        self.repourl = args['mozillaRepoPath']

        Mercurial.startVC(self, None, revision, patch)


class MozillaClientMk(ShellCommand):
    haltOnFailure = True
    flunkOnFailure = True
    name = "checkout client.mk"
    description = ["fetching client.mk"]
    descriptionDone = ["client.mk"]

    def __init__(self, cvsroot, **kwargs):
        self.cvsroot = cvsroot
        self.workdir = "."
        kwargs['workdir'] = "."
        # command may be overridden in start()
        kwargs['command'] = ["cvs", "-d", cvsroot, "co", "mozilla/client.mk"]
        ShellCommand.__init__(self, **kwargs)

    def start(self):
        changes = self.step_status.build.getChanges()

        args = parseSendchangeArguments(changes[0].files)
        self.command = ["cvs", "-d", self.cvsroot, "co"]
        if 'branch' in args:
            self.command.extend(["-r", args['branch']])
        self.command.append("mozilla/client.mk")

        ShellCommand.start(self)


class MozillaCustomPatch(ShellCommand):
    """This step looks at a Change to find the name of a diff.
    The diff is applied to the current tree.
    This step is typically used in conjunction with the MozillaPatchDownload
    step.
    """

    haltOnFailure = True

    def __init__(self, **kwargs):
        """
        'workdir' is assumed to be 'build' and should be passed if it is
        anything else.
        """

        if not 'workdir' in kwargs:
            kwargs['workdir'] = "build"
        ShellCommand.__init__(self, **kwargs)

    def start(self):
        changes = self.step_status.build.getChanges()
        if len(changes) < 1:
            log.msg("No changes, not doing anything")
            self.step_status.setColor("yellow")
            self.step_status.setText(["Skipped patch step:", "no patch"])
            self.finished(WARNINGS)
            return

        if len(changes) > 1:
            log.msg("Ignoring all but the first change...")

        args = parseSendchangeArguments(changes[0].files)

        self.setCommand(["patch", "-f", "-p%d" % int(args['patchLevel']), "-i",
                         args['patchFile']])
        ShellCommand.start(self)


class MozillaCreateUploadDirectory(ShellCommand):
    def __init__(self, scpString, **kwargs):
        (self.sshHost, self.sshDir) = scpString.split(":")

        ShellCommand.__init__(self, **kwargs)

    def start(self):
        changes = self.step_status.build.getChanges()
        when = strftime("%Y-%m-%d_%H:%M", localtime(changes[0].when))
        changer = changes[0].who
        args = parseSendchangeArguments(changes[0].files)
        dir = "%s-%s-%s" % (when, changer, args['identifier'])
        fullDir = path.join(self.sshDir, dir)
        self.setCommand(['ssh', self.sshHost, 'mkdir', fullDir])

        ShellCommand.start(self)

    def evaluateCommand(self, cmd):
        result = ShellCommand.evaluateCommand(self, cmd)
        if None != re.search('File exists', cmd.logs['stdio'].getText()):
            result = SUCCESS
        return result
