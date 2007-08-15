#!/usr/bin/perl
# vim:sw=4:et:ts=4:ai:

use strict;
use Cwd;
use File::Copy;
use File::Spec::Functions;

# Globals that the signal handlers need access to...
my $CURRENT_BUILD_PID = 0;
my $HALT_AFTER_THIS_BUILD = 0;
my $RELOAD_CONFIG = 0;

my $TBOX_CLIENT_CVSUP_CMD = 'cvs update -Pd';
my $TBOX_CLIENT_CVS_TIMEOUT = 300;

# Globals that are here for no good reason...
my $MSYS_HAS_HARDLINKS = 0;
my $MSYS_RELEASE_MODE_ENABLED = 1;

sub PrintUsage() {
    die <<END_USAGE
    usage: $0 [options]
Options:
  --example-config       Instead of running, print an example
                           'multi-config.pl' to help get started.
  --enable-msys-hardlinks If running on MSYS, enable use of hardlinking for
                          tasks like Tinderbox auto-update (code and config)
  --msys-disable-release-mode   If running on MSYS, disable the deployment
                                of post-mozilla-rel.pl, so release mode
                                is not automatically enabled. 
END_USAGE
}

sub PrintExample() {
    print <<END_EXAMPLE
# multi-config.pl
\$BuildSleep = 10;                       # minutes
\$Tinderboxes = [
  { tree => "SeaMonkey", args => "--depend --mozconfig mozconfig" },
  { tree => "SeaMonkey-Branch", args => "--depend --mozconfig mozconfig" },
];
END_EXAMPLE
    ;
    exit;
}

sub HandleArgs() {
    # Bleh for manual argv handling... what year is this again?
    foreach my $arg (@ARGV) {
        # PrintExample() also die()s for us...
        PrintExample() if ($arg eq '--example-config');
        if ($arg eq '--enable-msys-hardlinks') {
            $MSYS_HAS_HARDLINKS = 1;
            next;
        } elsif ($arg eq '--msys-disable-release-mode') {
            $MSYS_RELEASE_MODE_ENABLED = 0;
            next;
        }

        # Unrecognized argument... PrintUsage() will call exit().
        PrintUsage();
    }
}

sub LoadConfig() {
    if (-r 'multi-config.pl') {
        no strict 'vars';

        open CONFIG, 'multi-config.pl' or
            print "can't open multi-config.pl, $?\n";

        local $/ = undef;
        my $config = <CONFIG>;
        close CONFIG;

        package Settings;
        eval $config or 
            die "Malformed multi-config.pl: $@\n";

    } else {
        warn "Error: Need tinderbox config file, multi-config.pl\n";
        exit;
    }
}

sub HandleSigTerm() {
    if ($CURRENT_BUILD_PID > 0) {
        kill(15, $CURRENT_BUILD_PID);
        exit 0;
    }
}

sub HandleSigHup() {
    $HALT_AFTER_THIS_BUILD = 1;
    $RELOAD_CONFIG = 1;
}

sub HandleSigInt() {
    $HALT_AFTER_THIS_BUILD = 1;
}

sub HandleSigAlrm() {
   die 'timeout';
}

sub UpdateTinderboxScripts() {
    if (exists($ENV{'TBOX_CLIENT_CVS_DIR'})) {
        for my $cvsUpDir (split(":", $ENV{'TBOX_CLIENT_CVS_DIR'})) {
            print STDERR "Updating tinderbox scripts in $cvsUpDir\n";
            my $cvsUpCmd = $TBOX_CLIENT_CVSUP_CMD;
            $cvsUpCmd .= exists($ENV{'TBOX_CLIENT_CVS_TAG'}) ? 
              " -r $ENV{'TBOX_CLIENT_CVS_TAG'}" : '';

            eval {
                local $SIG{'ALRM'} = \&HandleSigAlrm;
                alarm($TBOX_CLIENT_CVS_TIMEOUT);
                system("cd $cvsUpDir && $cvsUpCmd") == 0 
                  or print STDERR "$TBOX_CLIENT_CVSUP_CMD failed: $!\n";
                alarm(0);
            };

            if ($@) {
                print STDERR 'CVS update of client tinderbox scripts ' . 
                  ($@ eq 'timeout' ? "timed out" : "failed: $@") . "\n";
            }
        }
    }
}

sub Run() {
    OUTER: while (1) {
        my $start_time = time();
        UpdateTinderboxScripts();

        foreach my $treeentry (@{$Settings::Tinderboxes}) {
            if ($^O eq 'msys') {
                print STDERR 'MSYS detected; ';
                # Then tinderbox CVS auto update is on AND we're MSYS. Ouch.
                # Symlinks don't work at all; hardlinks only work on NTFS.
                #
                # We use FAT32 on most of the build machines for build perf
                # reasons, so do an extra copy!
                #
                # Incidentally, why do we have a specific environment variable
                # for the tinderbox location under MSYS (i.e. 
                # 'MSYS_TBOX_CLIENT_CVS_DIR), you ask? Well, 
                # TBOX_CLIENT_CVS_DIR can actually be a colon-separated list
                # of directories to auto-update (bug 350405), not just a 
                # single tinderbox directory, so we can't assume that 
                # a) there will be only a single directory in that variable,
                # or b) that the directories that are in the list really are
                # even where the tinderbox scripts really are...
                #
                # So, we need to have an environment variable that points us
                # to the specific directory...

                if (!$MSYS_HAS_HARDLINKS && 
                 exists($ENV{'MSYS_TBOX_CLIENT_CVS_DIR'})) {
                    my $tboxSourceDir = $ENV{'MSYS_TBOX_CLIENT_CVS_DIR'};
                    print STDERR "manually copying Tinderbox scripts into " .
                     "$treeentry->{tree}\n";

                    my $startingDir = getcwd();

                    chdir($treeentry->{tree}) or
                     die "Tree $treeentry->{tree} does not exist";

                    opendir(BUILDDIR, '.') or die "opendir() failed: $!";
                    my @buildDirFiles = grep { -f $_ } readdir(BUILDDIR);
                    closedir(BUILDDIR);

                    foreach my $file (@buildDirFiles) {
                        # Need to NOT clobber the config files; they get
                        # handled by build-seamonkey-util.pl...
                        next if ($file eq 'mozconfig');
                        next if ($file eq 'tinder-config.pl');
                        my $sourceFile = catfile($tboxSourceDir, $file);
                        if (-e $sourceFile) {
                            print STDERR "   Copying $sourceFile to " .
                             "$treeentry->{tree}\n";
                            copy($sourceFile, '.') or die 
                             "copy() of $sourceFile failed\n";
                        }
                    }
                    # Need to manually copy over post-mozilla-rel.pl to
                    # post-mozilla in the build directory, if we're told to
                    if ($MSYS_RELEASE_MODE_ENABLED) {
                        copy(catfile($tboxSourceDir, 'post-mozilla-rel.pl'),
                             catfile('.', 'post-mozilla.pl')) or die "copy() " .
                         "post-mozilla-rel.pl to post-mozilla.pl failed\n";
                    }
                    chdir($startingDir) or die "chdir($startingDir) failed; " .
                     "couldn't find our way back home: $!\n";
                } elsif (!$MSYS_HAS_HARDLINKS && 
                 !exists($ENV{'MSYS_TBOX_CLIENT_CVS_DIR'})) {
                    print STDERR "manual copy enabled, but tinderbox location "
                     . "not defined; define MSYS_TBOX_CLIENT_CVS_DIR\n";
                } else {
                    print STDERR "hardlink support enabled; skipping manual "
                     . "copy\n";
                }
            }

            if ($MSYS_HAS_HARDLINKS) {
               $treeentry->{args} .= ' --enable-msys-hardlinks';
            }

            my $buildPid = fork();

            if (0 == $buildPid) {
                chdir($treeentry->{tree}) or
                 die "Tree $treeentry->{tree} does not exist";
                exec("./build-seamonkey.pl --once $treeentry->{args}");
                die("exec() failed: $!");
            } elsif ($buildPid > 0) {
                $CURRENT_BUILD_PID = $buildPid;
                my $reapedPid = waitpid($buildPid, 0);
                $CURRENT_BUILD_PID = 0;
                if ($reapedPid != $buildPid) {
                    warn "waitpid() returned bogosity: $!";
                }
            } else {
                warn "fork() of build sub-process failed: $!";
            }

            # We sleep 15 seconds to open up a window for stopping a build.
            sleep 15;

            # Provide a fall-over technique that stops the multi-tinderbox
            # script once the current build cycle has completed.
            last OUTER if ( $HALT_AFTER_THIS_BUILD );
        }

        # $BuildSleep is the minimum amount of time a build is allowed to take.
        # It prevents sending too many messages to the tinderbox server when
        # something is broken.
        my $sleep_time = ($Settings::BuildSleep * 60) - (time() - $start_time);
        if ($sleep_time > 0) {
            print "\n\nSleeping $sleep_time seconds ...\n";
            sleep $sleep_time;
        }
    }
}

$SIG{'TERM'} = \&HandleSigTerm;
$SIG{'HUP'} = \&HandleSigHup;
$SIG{'INT'} = \&HandleSigInt;

HandleArgs();

while (not $HALT_AFTER_THIS_BUILD) {
    LoadConfig();
    Run();

    ## Run can exit for two reasons: SIGHUP or SIGTERM; if we got a TERM,
    ## we won't reload the config, and we'll exit; if we got a HUP, then
    ## let's reload the config, and retoggle the bit so we continue building 
    if ($RELOAD_CONFIG) {
        $HALT_AFTER_THIS_BUILD = 0;
        $RELOAD_CONFIG = 0;
    }
}
