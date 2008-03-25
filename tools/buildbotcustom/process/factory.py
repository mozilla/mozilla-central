from buildbot.process.factory import BuildFactory
from buildbot.steps.shell import ShellCommand
from buildbot.steps.transfer import FileDownload

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
