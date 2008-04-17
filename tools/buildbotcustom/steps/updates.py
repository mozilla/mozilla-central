from StringIO import StringIO
from os import path

import buildbot
from buildbot.interfaces import BuildSlaveTooOldError
from buildbot.process.buildstep import BuildStep
from buildbot.status.builder import SUCCESS, FAILURE
from buildbot.steps.shell import WithProperties
from buildbot.steps.transfer import _FileReader, StatusRemoteCommand


class CreateCompleteUpdateSnippet(BuildStep):
    def __init__(self, objdir, milestone, baseurl, appendDatedDir=True):
        BuildStep.__init__(self)

        major, minor, point = buildbot.version.split(".", 3)
        # Buildbot 0.7.5 and below do not require this
        if int(minor) >= 7 and int(point) >= 6:
            self.addFactoryArguments(
              objdir=objdir,
              milestone=milestone,
              baseurl=baseurl,
              appendDatedDir=appendDatedDir
            )

        # This seems like a reasonable place to store snippets
        self.updateDir = path.join(objdir, 'dist', 'update')
        self.milestone = milestone
        self.baseurl = baseurl
        self.appendDatedDir = appendDatedDir
        self.maxsize = 16384
        self.mode = None
        self.blocksize = 4096

    def _getDatedDirPath(self):
        buildid = self.getProperty('buildid')
        year  = buildid[0:4]
        month = buildid[4:6]
        day   = buildid[6:8]
        hour  = buildid[8:10]
        datedDir = "%s-%s-%s-%s-%s" % (year,
                                       month,
                                       day,
                                       hour,
                                       self.milestone)
        return "%s/%s/%s" % (year, month, datedDir)

    def generateSnippet(self):
        # interpolate the baseurl, if necessary
        if isinstance(self.baseurl, WithProperties):
            self.baseurl = self.baseurl.render(self.build)
        # now build the URL
        downloadURL = self.baseurl + '/'
        if self.appendDatedDir:
            downloadURL += self._getDatedDirPath() + '/'
        downloadURL += self.getProperty('completeMarFilename')

        # type of update (partial vs complete)
        snippet = "complete\n"
        # download URL
        snippet += "%s\n" % (downloadURL)
        # hash type
        snippet += "sha1\n"
        # hash of mar
        snippet += "%s\n" % self.getProperty('completeMarHash')
        # size (bytes) of mar
        snippet += "%s\n" % self.getProperty('completeMarSize')
        # buildid
        snippet += "%s\n" % self.getProperty('buildid') # double check case
        # app version
        snippet += "%s\n" % self.getProperty('appVersion')
        # extension version (same as app version)
        snippet += "%s\n" % self.getProperty('appVersion')
        return StringIO(snippet)

    def start(self):
        version = self.slaveVersion("downloadFile")
        if not version:
            m = "slave is too old, does not know about downloadFile"
            raise BuildSlaveTooOldError(m)

        self.step_status.setColor('yellow')
        self.step_status.setText(['creating', 'snippets'])

        self.stdio_log = self.addLog("stdio")
        self.stdio_log.addStdout("Starting snippet generation\n")

        d = self.makeComplete()
        d.addCallback(self.finished).addErrback(self.failed)

    def makeComplete(self):
        fp = self.generateSnippet()
        fileReader = _FileReader(fp)

        self.completeSnippetFilename = 'complete.update.snippet'

        args = {
            'slavedest': self.completeSnippetFilename,
            'maxsize': self.maxsize,
            'reader': fileReader,
            'blocksize': self.blocksize,
            'workdir': self.updateDir,
            'mode': self.mode
        }

        msg = "Generating complete update in: %s/%s\n" % (self.updateDir,
          self.completeSnippetFilename)
        self.stdio_log.addStdout(msg)

        self.cmd = StatusRemoteCommand('downloadFile', args)
        d = self.runCommand(self.cmd)
        return d.addErrback(self.failed)

    def finished(self, result):
        self.step_status.setText(['create', 'snippet'])
        if self.cmd.stderr != '':
            self.addCompleteLog('stderr', self.cmd.stderr)

        self.stdio_log.addStdout("Snippet generation complete\n\n")

        if self.cmd.rc is None or self.cmd.rc == 0:
            # Other BuildSteps will probably want this data.
            self.setProperty('completeSnippetFilename',
              path.join(self.updateDir, self.completeSnippetFilename))

            self.step_status.setColor('green')
            return BuildStep.finished(self, SUCCESS)
        self.step_status.setColor('red')
        return BuildStep.finished(self, FAILURE)
