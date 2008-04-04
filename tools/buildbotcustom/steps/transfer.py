from os import path
from time import strftime, strptime

import buildbot
from buildbot.steps.shell import ShellCommand

class MozillaStageUpload(ShellCommand):
    def __init__(self, objdir, username, milestone, platform, remoteHost,
                 remoteBasePath, group=None, chmodMode=755, sshKey=None,
                 releaseToDated=True, releaseToLatest=True,
                 releaseToTinderboxBuilds=True, tinderboxBuildsDir=None, 
                 dependToDated=True, uploadCompleteMar=True, **kwargs):
        """
        @type  objdir: string
        @param objdir: The obj directory used for the build. This is needed to
                       find the packages in the source tree.

        @type  username: string
        @param username: The username used to login with on the remote host.
                         The buildslaves should have passwordless logins to
                         this account.

        @type  milestone: string
        @param milestone: The milestone of the build (eg, trunk)

        @type  platform: string
        @param platform: The platform we are uploading for. One of 'win32',
                         'linux', or 'macosx'.

        @type  remoteHost: string
        @param remoteHost: The server to upload the builds to.

        @type  remoteBasePath: string
        @param remoteBasePath: The directory on the server used as a base path
                               for these builds. eg:
                               /home/ftp/pub/firefox

        @type  group: string
        @param group: If group is set, any files uploaded will be chgrp'ed to
                      it. Default: None

        @type  chmodMode: int
        @param chmodMode: The mode used when fixing permissions on remoteHost.
                          Default: 755

        @type  sshKey: string
        @param sshKey: If defined, the filename of the ssh key to use. It
                       should be relative to ${HOME}/.ssh/. Default: None

        @type  releaseToDated: bool
        @param releaseToDated: If True, builds will be pushed to
                'remoteBasePath'/nightly/yyyy/mm/yyyy-mm-dd-hh-milestone. This
                directory will also be symlinked in 'remoteBasePath'/nightly/. 
                Generally, this should be True for nightlies. Default: True

        @type  releaseToLatest: bool
        @param releaseToLatest: If True, builds will be pushed to
                'remoteBasePath'/nightly/latest-milestone. If
                releaseToDated=True, builds will be copied from
                'remoteBasePath'/nightly/yyyy/mm/yyyy-mm-dd-hh-milestone.
                Otherwise, builds will be uploaded from the slave. Generally,
                this should be True for nightlies. Default: True

        @type  releaseToTinderboxBuilds: bool
        @param releaseToTinderboxBuilds: If True, builds will be pushed to
                'remoteBasePath'/tinderbox-builds/$hostname. This should
                generally be set to True for all builds. Default: True

        @type  tinderboxBuildsDir: This option only has effect when
                                   releaseToTinderboxBuilds is True. If this
                                   option is None (default), builds will be
                                   uploaded to:
                                   tinderbox-builds/builderName
                                   If otherwise set builds will be uploaded to
                                   tinderbox-builds/tinderboxBuildsDir.

        @type  dependToDated: This option only has effect when
                              releaseToTinderboxBuilds is True. When
                              dependToDated is True builds will be placed in
                              a subdirectory named for the build start time
                              (in unix time) when being pushed to the
                              tinderbox-builds dir. For example:
                              tinderbox-builds/builder/1203094573. The option
                              defaults to True.

        @type  uploadCompleteMar: bool
        @param uploadCompleteMar: When True, the MozillaStageUpload will upload
                                  the complete mar file found in dist/update to
                                  the datedDir. This option only applies when
                                  releaseToDated is True.
        """

        ShellCommand.__init__(self, **kwargs)
        major, minor, point = buildbot.version.split(".", 3)
        # Buildbot 0.7.5 and below do not require this
        if int(minor) >= 7 and int(point) >= 6:
            self.addFactoryArguments(objdir=objdir,
                                     username=username,
                                     milestone=milestone,
                                     platform=platform,
                                     remoteHost=remoteHost,
                                     remoteBasePath=remoteBasePath,
                                     group=group,
                                     chmodMode=chmodMode,
                                     sshKey=sshKey,
                                     releaseToDated=releaseToDated,
                                     releaseToLatest=releaseToLatest,
                                     releaseToTinderboxBuilds=releaseToTinderboxBuilds,
                                     tinderboxBuildsDir=tinderboxBuildsDir,
                                     dependToDated=dependToDated,
                                     uploadCompleteMar=uploadCompleteMar)

        assert platform in ('win32', 'linux', 'macosx')
        self.objdir = objdir
        self.username = username
        self.milestone = milestone
        self.platform = platform
        self.remoteHost = remoteHost
        self.remoteBasePath = remoteBasePath
        self.group = group
        self.chmodMode = chmodMode
        self.sshKey = sshKey
        self.releaseToDated = releaseToDated
        self.releaseToLatest = releaseToLatest
        self.releaseToTinderboxBuilds = releaseToTinderboxBuilds
        self.tinderboxBuildsDir = tinderboxBuildsDir
        self.dependToDated = dependToDated
        self.uploadCompleteMar = uploadCompleteMar

        self.description = ["uploading package(s) to", remoteHost]
        self.descriptionDone = ["upload package(s) to", remoteHost]

    def _getBaseCommand(self, ssh=False, scp=False):
        assert not (ssh and scp)
        assert (ssh or scp)

        command = ""
        # scp cannot use the '-l' format
        if ssh:
            command += 'ssh'
            command += ' -l ' + self.username
        else:
            command += 'scp'

        if self.sshKey:
            # surprisingly, this works on Windows (probably because Buildbot)
            # gets started from MSYS
            command += ' -i ' + '~/.ssh/%s' % self.sshKey
        return command

    def getBuildID(self):
        # the build id is extracted in a previous step and set as a build
        # property
        buildid = self.getProperty("buildid")
        return strftime("%Y-%m-%d-%H", strptime(buildid, "%Y%m%d%H"))

    def getBuildStartTime(self):
        return int(self.step_status.build.getTimes()[0])

    def getPackageDirectory(self):
        return '%s-%s' % (self.getBuildID(), self.milestone)

    def getPackageGlob(self):
        # i can't find a better way to do this.
        if self.platform == "win32":
            return '%s/dist/*.zip %s/dist/install/sea/*.exe' % (self.objdir,
                                                                self.objdir)
        if self.platform == "macosx":
            return '%s/dist/*.dmg' % self.objdir
        if self.platform == "linux":
            return '%s/dist/*.tar.bz2' % self.objdir

    def getLongDatedPath(self):
        buildid = self.getBuildID()
        fullRemotePath = path.join(self.remoteBasePath, 'nightly',
                                   buildid.split('-')[0], # the year
                                   buildid.split('-')[1],  # the month
                                   self.getPackageDirectory()
        )
        return fullRemotePath

    def getLatestPath(self):
        return path.join(self.remoteBasePath, 'nightly',
                         'latest-%s' % self.milestone)

    def getTinderboxBuildsPath(self):
        tboxBuildsPath = path.join(self.remoteBasePath, 'tinderbox-builds')
        if self.tinderboxBuildsDir:
            tboxBuildsPath = path.join(tboxBuildsPath, self.tinderboxBuildsDir)
        else:
            tboxBuildsPath = path.join(tboxBuildsPath,
                                       self.step_status.build.builder.getName())
        if self.dependToDated:
            tboxBuildsPath = path.join(tboxBuildsPath,
                                       str(self.getBuildStartTime()))
        return tboxBuildsPath

    def createDirCommand(self, dir):
        return self._getBaseCommand(ssh=True) + ' ' + self.remoteHost + \
               ' mkdir -p ' + dir

    def uploadCommand(self, dir):
        return self._getBaseCommand(scp=True) + ' ' + self.getPackageGlob() + \
                 ' ' + self.username + '@' + self.remoteHost + ':' + \
                 dir

    def chmodCommand(self, dir):
        return self._getBaseCommand(ssh=True) + ' ' + self.remoteHost + \
               ' chmod -R ' + str(self.chmodMode) + ' ' + dir

    def chgrpCommand(self, dir):
        return self._getBaseCommand(ssh=True) + ' ' + self.remoteHost + \
               ' chgrp -R ' + self.group + ' ' + dir

    def syncCommand(self, src, dst):
        # rsync needs trailing slashes
        src += '/'
        dst += '/'
        return self._getBaseCommand(ssh=True) + ' ' + self.remoteHost + \
               ' rsync -av ' + src + ' ' + dst 

    def symlinkDateDirCommand(self, datedDir):
        # Make a relative symlink, absolute symlinks break ftp
        # unless you are careful to get the right root
        # eg ln -fs 2008/03/2008-03-01-01-mozilla-central
        #                          /home/ftp/pub/firefox/nightly/
        targetDir = path.join(self.remoteBasePath, 'nightly','')
        shortDatedDir = datedDir.replace(targetDir, '')
        return self._getBaseCommand(ssh=True) + ' ' + self.remoteHost + \
               ' ln -fs ' + shortDatedDir + ' ' + targetDir

    def uploadCompleteMarCommand(self, dir)
        packageGlob = '%s/dist/update/*.complete.mar' % self.objdir
        return self._getBaseCommand(scp=True) + ' ' + packageGlob + \
                 ' ' + self.username + '@' + self.remoteHost + ':' + \
                 dir

    def start(self):
        datedDir = self.getLongDatedPath()
        latestDir = self.getLatestPath()
        tinderboxBuildsDir = self.getTinderboxBuildsPath()

        commands = []
        if self.releaseToDated:
            # 1) Create the directory on the staging server.
            # 2) Upload the package(s).
            # 3) Fix the permissions on the package(s).
            # 4) Maybe adjust the group on the package(s).
            # 5) Symlink the longer dated directory to the shorter one.
            cmd = ""
            cmd += self.createDirCommand(datedDir) + " && " + \
                   self.uploadCommand(datedDir) + " && " + \
                   self.chmodCommand(datedDir)
            if self.group:
                cmd += " && " + self.chgrpCommand(datedDir)
            cmd += " && " + self.symlinkDateDirCommand(datedDir)
            if self.uploadCompleteMar:
                cmd += " && " + self.uploadCompleteMarCommand(datedDir)
            commands.append(cmd)

        if self.releaseToLatest:
            # 1) Create the directory on the staging server.
            # 2) If there was a dated release, rsync those files to the
            #    latest-(milestone) directory.
            # 3) If not, upload the package(s).
            # 4) Fix the permissions on the package(s).
            # 5) Maybe adjust the group on the package(s).
            cmd = ""
            cmd += self.createDirCommand(latestDir) + " && "
            if self.releaseToDated:
                cmd += self.syncCommand(datedDir, latestDir) + " && "
            else:
                cmd += self.uploadCommand(latestDir) + " && "
            cmd += self.chmodCommand(latestDir)
            if self.group:
                cmd += " && " + self.chgrpCommand(latestDir)
            commands.append(cmd)

        if self.releaseToTinderboxBuilds:
            # 1) Create the directory on the staging server.
            # 2) Upload the package(s).
            # 3) Fix the permissions on the package(s).
            # 4) Maybe adjust the group on the package(s).
            cmd = ""
            cmd += self.createDirCommand(tinderboxBuildsDir) + " && " + \
                   self.uploadCommand(tinderboxBuildsDir) + " && " + \
                   self.chmodCommand(tinderboxBuildsDir)
            if self.group:
                cmd += " && " + self.chgrpCommand(tinderboxBuildsDir)
            commands.append(cmd)

        finalCommand = ' && '.join(commands)
        self.setCommand(finalCommand)
        ShellCommand.start(self)
