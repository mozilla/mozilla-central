from buildbot.steps.transfer import FileDownload

MozillaEnvironments = {}

MozillaEnvironments['win32-buildbotref-v4'] = {
   "'MOZ_TOOLS": 'd:\\moztools',
    "VSINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8',
    "VS80COMMTOOLS": 'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\Tools\\',
    "VCINSTALLDIR": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "FrameworkDir": 'C:\\WINDOWS\\Microsoft.NET\\Framework',
    "FrameworkSDKDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\SDK\\v2.0',
    "DevEnvDir": "C:\\Program Files\\Microsoft Visual Studio 8\\VC\\Common7\\IDE",
    "MSVCDir": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC',
    "PATH": 'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\IDE;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\bin;' + \
            'C:\\Program Files\\Microsoft Platform SDK\\bin;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\VC;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\Tools;' + \
            'C:\\Program Files\\Microsoft Visual Studio 8\\Common7\\Tools\\bin;' + \
            'd:\\moztools\\bin;' + \
            'd:\\cygwin\\bin;' + \
            'd:\\buildtools\\7zip;' + \
            'd:\\buildtools\\upx;' + \
            'd:\\buildtools\\python24;' + \
            'd:\\buildtools\\nsis;',
    "INCLUDE": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\INCLUDE;' + \
               'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\INCLUDE;' + \
               'C:\\Program Files\\Microsoft Platform SDK\\include',
    "LIB": 'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\ATLMFC\\LIB;' + \
           'C:\\Program Files\\Microsoft Visual Studio 8\\VC\\LIB;' + \
           'C:\\Program Files\\Microsoft Platform SDK\\lib'
}

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
        'workdir' is assumed to be 'build' and should be passed if it is anything
        else.
        """

        self.patchDir = patchDir
        # mastersrc and slavedest get overriden in start()
        if not 'workdir' in kwargs:
            kwargs['workdir'] = "build"
        FileDownload.__init__(self, mastersrc=".", slavedest=".", **kwargs)

    def start(self):
        changes = self.step_status.build.getChanges()

        if len(changes) < 1:
            return

        file = changes[0].getFileContents().split(": ")[1].rstrip()
        # strip the path from the filename
        file = file.split("/")[-1]

        self.mastersrc = "%s/%s" % (self.patchDir, file)
        self.slavedest = "%s" % (file)

        # now that everything is set-up, download the file
        FileDownload.start(self)


from twisted.python import log

from buildbot.steps.shell import ShellCommand
from buildbot.status.builder import WARNINGS


class MozillaCustomPatch(ShellCommand):
    """This step looks at a Change to find the name of a diff.
    The diff is applied to the current tree.
    This step is typically used in conjunction with the MozillaPatchDownload
    step.
    """

    haltOnFailure = True

    def __init__(self, stripDirs=0, **kwargs):
        """
        @type  stripDirs:   int
        @param stripDirs:   The '-p' option to pass to patch. Defaults to 0

        'workdir' is assumed to be 'build' and should be passed if it is
        anything else.
        """

        self.stripDirs = stripDirs

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

        file = changes[0].getFileContents().split(": ")[1].rstrip()

        self.setCommand(["patch", "-f", "-p%d" % self.stripDirs, "-i", file])
        ShellCommand.start(self)
