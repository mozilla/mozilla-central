from buildbot.process.factory import BuildFactory
from buildbot.steps.shell import Compile, ShellCommand, WithProperties
from buildbot.steps.source import Mercurial
from buildbot.steps.transfer import FileDownload

import buildbotcustom.steps.misc
import buildbotcustom.steps.test
import buildbotcustom.steps.transfer
import buildbotcustom.steps.updates
reload(buildbotcustom.steps.misc)
reload(buildbotcustom.steps.test)
reload(buildbotcustom.steps.transfer)
reload(buildbotcustom.steps.updates)

from buildbotcustom.steps.misc import SetMozillaBuildProperties
from buildbotcustom.steps.test import AliveTest, CompareBloatLogs, \
  CompareLeakLogs, Codesighs
from buildbotcustom.steps.transfer import MozillaStageUpload
from buildbotcustom.steps.updates import CreateCompleteUpdateSnippet


class BootstrapFactory(BuildFactory):
    def __init__(self, automation_tag, logdir, bootstrap_config, 
                 cvsroot="pserver:anonymous@cvs-mirror.mozilla.org", 
                 cvsmodule="mozilla"):
        """
    @type  cvsroot: string
    @param cvsroot: The CVSROOT to use for checking out Bootstrap.

    @type  cvsmodule: string
    @param cvsmodule: The CVS module to use for checking out Bootstrap.

    @type  automation_tag: string
    @param automation_tag: The CVS Tag to use for checking out Bootstrap.

    @type  logdir: string
    @param logdir: The log directory for Bootstrap to use. 
                   Note - will be created if it does not already exist.

    @type  bootstrap_config: string
    @param bootstrap_config: The location of the bootstrap.cfg file on the 
                             slave. This will be copied to "bootstrap.cfg"
                             in the builddir on the slave.
        """
        BuildFactory.__init__(self)
        self.addStep(ShellCommand, 
         description='clean checkout',
         workdir='.', 
         command=['rm', '-rfv', 'build'],
         haltOnFailure=1)
        self.addStep(ShellCommand, 
         description='checkout', 
         workdir='.',
         command=['cvs', '-d', cvsroot, 'co', '-r', automation_tag,
                  '-d', 'build', cvsmodule],
         haltOnFailure=1,
        )
        self.addStep(ShellCommand, 
         description='copy bootstrap.cfg',
         command=['cp', bootstrap_config, 'bootstrap.cfg'],
         haltOnFailure=1,
        )
        self.addStep(ShellCommand, 
         description='echo bootstrap.cfg',
         command=['cat', 'bootstrap.cfg'],
         haltOnFailure=1,
        )
        self.addStep(ShellCommand, 
         description='(re)create logs area',
         command=['bash', '-c', 'mkdir -p ' + logdir], 
         haltOnFailure=1,
        )

        self.addStep(ShellCommand, 
         description='clean logs area',
         command=['bash', '-c', 'rm -rf ' + logdir + '/*.log'], 
         haltOnFailure=1,
        )
        self.addStep(ShellCommand, 
         description='unit tests',
         command=['make', 'test'], 
         haltOnFailure=1,
        )



class MercurialBuildFactory(BuildFactory):
    def __init__(self, env, objdir, platform, branch, sourceRepo, configRepo,
                 configSubDir, profiledBuild, stageServer=None,
                 stageUsername=None, stageGroup=None, stageSshKey=None,
                 stageBasePath=None, ausBaseUploadDir=None,
                 updatePlatform=None, downloadBaseURL=None, ausUser=None,
                 ausHost=None, nightly=False, leakTest=False, codesighs=True,
                 uploadPackages=True, dependToDated=True, **kwargs):
        BuildFactory.__init__(self, **kwargs)
        self.env = env
        self.objdir = objdir
        self.platform = platform
        self.branch = branch
        self.sourceRepo = sourceRepo
        self.configRepo = configRepo
        self.configSubDir = configSubDir
        self.profiledBuild = profiledBuild
        self.stageServer = stageServer
        self.stageUsername = stageUsername
        self.stageGroup = stageGroup
        self.stageSshKey = stageSshKey
        self.stageBasePath = stageBasePath
        self.ausBaseUploadDir = ausBaseUploadDir
        self.updatePlatform = updatePlatform
        self.downloadBaseURL = downloadBaseURL
        self.ausUser = ausUser
        self.ausHost = ausHost
        self.nightly = nightly
        self.leakTest = leakTest
        self.codesighs = codesighs
        self.uploadPackages = uploadPackages
        self.dependToDated = dependToDated

        if self.uploadPackages:
            assert stageServer and stageUsername and stageSshKey
            assert stageBasePath
        if self.nightly:
            assert ausBaseUploadDir and updatePlatform and downloadBaseURL
            assert ausUser and ausHost

        # platform actually contains more than just the platform...
        # we need that to figure out which mozconfig to use
        # but for other purposes we only need to know linux/win32/macosx
        # platform can be things like: linux, win32-debug, macosx-release, etc.
        self.mozconfig = 'configs/%s/%s/mozconfig' % (self.configSubDir,
                                                      self.platform)
        # we don't need the extra cruft in 'platform' anymore
        self.platform = platform.split('-')[0].replace('64', '')
        assert self.platform in ('linux', 'win32', 'macosx')

        self.logUploadDir = 'tinderbox-builds/%s-%s/' % (self.branch,
                                                         self.platform)
        # this is a tad ugly because we need to python interpolation
        # as well as WithProperties
        # here's an example of what it translates to:
        # /opt/aus2/build/0/Firefox/mozilla2/WINNT_x86-msvc/2008010103/en-US
        self.ausFullUploadDir = '%s/%s/%%(buildid)s/en-US' % \
          (self.ausBaseUploadDir, self.updatePlatform)

        # now, generate the steps
        #  regular dep builds (no clobber, no leaktest):
        #   addBuildSteps()
        #   addUploadSteps()
        #   addCodesighsSteps()
        #  leak test builds (no clobber, leaktest):
        #   addBuildSteps()
        #   addLeakTestSteps()
        #  nightly builds (clobber)
        #   addBuildSteps()
        #   addUploadSteps()
        #   addUpdateSteps()
        #   addSymbolSteps()
        #  for everything:
        #   addCleanupSteps()
        self.addBuildSteps()
        if self.leakTest:
            self.addLeakTestSteps()
        if self.uploadPackages:
            self.addUploadSteps()
        if self.codesighs:
            self.addCodesighsSteps()
        if self.nightly:
            self.addUpdateSteps()
            self.addSymbolsSteps()
        self.addCleanupSteps()

    def addBuildSteps(self):
        if self.nightly:
            self.addStep(ShellCommand,
             command=['rm', '-rfv', 'build'],
             env=self.env,
             workdir='.'
            )
        self.addStep(ShellCommand,
         command=['echo', WithProperties('Building on: %(slavename)s')],
         env=self.env
        )
        self.addStep(ShellCommand,
         command="rm -rfv %s/dist/firefox-* %s/dist/install/sea/*.exe " %
                  (self.objdir, self.objdir),
         env=self.env,
         description=['deleting', 'old', 'package'],
         descriptionDone=['delete', 'old', 'package']
        )
        if self.nightly:
            self.addStep(ShellCommand,
             command="find 20* -maxdepth 2 -mtime +7 -exec rm -rfv {} \;",
             env=self.env,
             workdir='.',
             description=['cleanup', 'old', 'symbols'],
             flunkOnFailure=False
            )
        self.addStep(Mercurial,
         mode='update',
         baseURL=self.sourceRepo,
         defaultBranch=self.branch
        )
        changesetLink = '<a href=%s/%s/index.cgi/rev' % (self.sourceRepo,
                                                         self.branch)
        changesetLink += '/%(got_revision)s title="Built from revision %(got_revision)s">rev:%(got_revision)s</a>'
        self.addStep(ShellCommand,
         command=['echo', 'TinderboxPrint:', WithProperties(changesetLink)]
        )
        self.addStep(ShellCommand,
         command=['rm', '-rfv', 'configs'],
         description=['removing', 'configs'],
         descriptionDone=['remove', 'configs'],
         haltOnFailure=True
        )
        self.addStep(ShellCommand,
         command=['hg', 'clone', self.configRepo, 'configs'],
         description=['checking', 'out', 'configs'],
         descriptionDone=['checkout', 'configs'],
         haltOnFailure=True
        )
        self.addStep(ShellCommand,
         # cp configs/mozilla2/$platform/mozconfig .mozconfig
         command=['cp', 'configs/%s/%s/mozconfig' % (self.configSubDir,
                                                     self.platform),
                  '.mozconfig'],
         description=['copying', 'mozconfig'],
         descriptionDone=['copy', 'mozconfig'],
         haltOnFailure=True
        )
        self.addStep(ShellCommand,
         command=['cat', '.mozconfig'],
        )

        buildcmd = 'build'
        if self.profiledBuild:
            buildcmd = 'profiledbuild'
        self.addStep(Compile,
         command=['make', '-f', 'client.mk', buildcmd],
         env=self.env,
         haltOnFailure=True,
         timeout=3600 # 1 hour, because windows PGO builds take a long time
        )

    def addLeakTestSteps(self):
        # we want the same thing run a few times here, with different
        # extraArgs
        for args in [['-register'], ['-CreateProfile', 'default'],
                     ['-P', 'default']]:
            self.addStep(AliveTest,
                env=self.env,
                workdir='build/%s/_leaktest' % self.objdir,
                extraArgs=args
            )
        # we only want this variable for this test - this sucks
        bloatEnv = self.env.copy()
        bloatEnv['XPCOM_MEM_BLOAT_LOG'] = '1' 
        self.addStep(AliveTest,
         env=bloatEnv,
         workdir='build/%s/_leaktest' % self.objdir,
         logfile='bloat.log',
        )
        self.addStep(ShellCommand,
         env=self.env,
         workdir='.',
         command=['wget', '-O', 'bloat.log.old',
                  'http://%s/pub/mozilla.org/firefox/%s/bloat.log' % \
                    (self.stageServer, self.logUploadDir)]
        )
        self.addStep(ShellCommand,
         env=self.env,
         command=['mv', '%s/_leaktest/bloat.log' % self.objdir,
                  '../bloat.log'],
        )
        self.addStep(ShellCommand,
         env=self.env,
         command=['scp', '-o', 'User=%s' % self.stageUsername,
                  '-o', 'IdentityFile=~/.ssh/%s' % self.stageSshKey,
                  '../bloat.log',
                  '%s:%s/%s' % (self.stageServer, self.stageBasePath,
                                self.logUploadDir)]
        )
        self.addStep(CompareBloatLogs,
         bloatLog='../bloat.log',
         env=self.env,
        )
        self.addStep(AliveTest,
         env=self.env,
         workdir='build/%s/_leaktest' % self.objdir,
         extraArgs=['--trace-malloc', 'malloc.log',
                    '--shutdown-leaks=sdleak.log'],
         timeout=3600 # 1 hour, because this takes a long time on win32
        )
        self.addStep(ShellCommand,
         env=self.env,
         workdir='.',
         command=['wget', '-O', 'malloc.log.old',
                  'http://%s/pub/mozilla.org/firefox/%s/malloc.log' % \
                    (self.stageServer, self.logUploadDir)]
        )
        self.addStep(ShellCommand,
         env=self.env,
         workdir='.',
         command=['wget', '-O', 'sdleak.tree.old',
                  'http://%s/pub/mozilla.org/firefox/%s/sdleak.tree' % \
                    (self.stageServer, self.logUploadDir)]
        )
        self.addStep(ShellCommand,
         env=self.env,
         command=['mv',
                  '%s/_leaktest/malloc.log' % self.objdir,
                  '../malloc.log'],
        )
        self.addStep(ShellCommand,
         env=self.env,
         command=['mv',
                  '%s/_leaktest/sdleak.log' % self.objdir,
                  '../sdleak.log'],
        )
        self.addStep(CompareLeakLogs,
         mallocLog='../malloc.log',
         platform=self.platform,
         env=self.env,
         testname='current'
        )
        self.addStep(CompareLeakLogs,
         mallocLog='../malloc.log.old',
         platform=self.platform,
         env=self.env,
         testname='previous'
        )
        self.addStep(ShellCommand,
         env=self.env,
         workdir='.',
         command=['bash', '-c',
                  'perl build/tools/trace-malloc/diffbloatdump.pl '
                  '--depth=15 --use-address /dev/null sdleak.log '
                  '> sdleak.tree']
        )
        if self.platform not in ('macosx', 'linux'):
            self.addStep(ShellCommand,
             env=self.env,
             workdir='.',
             command=['mv', 'sdleak.tree', 'sdleak.tree.raw']
            )
            self.addStep(ShellCommand,
             env=self.env,
             workdir='.',
             command=['/bin/bash', '-c', 
                      'perl '
                      'build/tools/rb/fix-%s-stack.pl '
                      'sdleak.tree.raw '
                      '> sdleak.tree' % self.platform]
            )
        self.addStep(ShellCommand,
         env=self.env,
         command=['scp', '-o', 'User=%s' % self.stageUsername,
                  '-o', 'IdentityFile=~/.ssh/%s' % self.stageSshKey,
                  '../malloc.log', '../sdleak.tree',
                  '%s:%s/%s' % (self.stageServer, self.stageBasePath,
                                self.logUploadDir)]
        )
        self.addStep(ShellCommand,
         env=self.env,
         command=['perl', 'tools/trace-malloc/diffbloatdump.pl',
                  '--depth=15', '../sdleak.tree.old', '../sdleak.tree']
        )

    def addUploadSteps(self):
        self.addStep(ShellCommand,
         command=['make', 'package'],
         workdir='build/%s' % self.objdir,
         haltOnFailure=True
        )
        if self.platform.startswith("win32"):
         self.addStep(ShellCommand,
             command=['make', 'installer'],
             workdir='build/%s' % self.objdir,
             haltOnFailure=True
         )
        if self.nightly:
         self.addStep(ShellCommand,
             command=['make', '-C',
                      '%s/tools/update-packaging' % self.objdir],
             haltOnFailure=True
         )
        self.addStep(SetMozillaBuildProperties,
         objdir='build/%s' % self.objdir
        )
        releaseToLatest = False
        releaseToDated = False
        if self.nightly:
            releaseToLatest=True
            releaseToDated=True

        self.addStep(MozillaStageUpload,
         objdir=self.objdir,
         username=self.stageUsername,
         milestone=self.branch,
         remoteHost=self.stageServer,
         remoteBasePath=self.stageBasePath,
         platform=self.platform,
         group=self.stageGroup,
         sshKey=self.stageSshKey,
         releaseToLatest=releaseToLatest,
         releaseToDated=releaseToDated,
         releaseToTinderboxBuilds=True,
         tinderboxBuildsDir='%s-%s' % (self.branch, self.platform),
         dependToDated=self.dependToDated
        )
        
    def addCodesighsSteps(self):
        self.addStep(ShellCommand,
         command=['make'],
         workdir='build/%s/tools/codesighs' % self.objdir
        )
        self.addStep(ShellCommand,
         command=['wget', '-O', 'codesize-auto-old.log',
          'http://%s/pub/mozilla.org/firefox/%s/codesize-auto.log' % \
           (self.stageServer, self.logUploadDir)],
         workdir='.',
         env=self.env
        )
        self.addStep(Codesighs,
         objdir=self.objdir,
         platform=self.platform,
         env=self.env
        )
        self.addStep(ShellCommand,
         command=['cat', '../codesize-auto-diff.log']
        )
        self.addStep(ShellCommand,
         command=['scp', '-o', 'User=%s' % self.stageUsername,
          '-o', 'IdentityFile=~/.ssh/%s' % self.stageSshKey,
          '../codesize-auto.log',
          '%s:%s/%s' % (self.stageServer, self.stageBasePath,
                        self.logUploadDir)]
        )
        self.addStep(ShellCommand,
         command=['wget', '-O', 'codesize-base-old.log',
          'http://%s/pub/mozilla.org/firefox/%s/codesize-base.log' %\
           (self.stageServer, self.logUploadDir)],
         workdir='.',
         env=self.env
        )
        self.addStep(Codesighs,
         objdir=self.objdir,
         platform=self.platform,
         type='base',
         env=self.env
        )
        self.addStep(ShellCommand,
         command=['cat', '../codesize-base-diff.log']
        )
        self.addStep(ShellCommand,
         command=['scp', '-o', 'User=%s' % self.stageUsername,
          '-o', 'IdentityFile=~/.ssh/%s' % self.stageSshKey,
          '../codesize-base.log',
          '%s:%s/%s' % (self.stageServer, self.stageBasePath,
                        self.logUploadDir)]
        )

    def addUpdateSteps(self):
        self.addStep(CreateCompleteUpdateSnippet,
         objdir='build/%s' % self.objdir,
         milestone=self.branch,
         baseurl='%s/nightly' % self.downloadBaseURL
        )
        self.addStep(ShellCommand,
         command=['ssh', '-l', self.ausUser, self.ausHost,
                  WithProperties('mkdir -p %s' % self.ausFullUploadDir)],
         description=['create', 'aus', 'upload', 'dir'],
         haltOnFailure=True
        )
        self.addStep(ShellCommand,
         command=['scp', '-o', 'User=%s' % self.ausUser,
                  'dist/update/complete.update.snippet',
                  WithProperties('%s:%s/complete.txt' % \
                    (self.ausHost, self.ausFullUploadDir))],
         workdir='build/%s' % self.objdir,
         description=['upload', 'complete', 'snippet'],
         haltOnFailure=True
        )

    def addSymbolsSteps(self):
        self.addStep(ShellCommand,
         command=['make', 'buildsymbols'],
         env=self.env,
         workdir='build/%s' % self.objdir,
         haltOnFailure=True
        )
        self.addStep(ShellCommand,
         command=['make', 'uploadsymbols'],
         env=self.env,
         workdir='build/%s' % self.objdir,
         haltOnFailure=True
        )

    def addCleanupSteps(self):
        if self.nightly:
            self.addStep(ShellCommand,
             command=['rm', '-rfv', 'build'],
             env=self.env,
             workdir='.'
            )
            # no need to clean-up temp files if we clobber the whole directory
            return

        # OS X builds eat up a ton of space with -save-temps enabled
        # until we have dwarf support we need to clean this up so we don't
        # fill up the disk
        if self.platform.startswith("macosx"):
            self.addStep(ShellCommand,
             command=['find', '-E', '.', '-iregex',
                      '.*\.(i|s|mii|ii)$', '-exec', 'rm', '{}', ';'],
             workdir='build/%s' % self.objdir
            )
