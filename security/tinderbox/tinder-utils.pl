#!/usr/bin/perl
# -*- Mode: perl; indent-tabs-mode: nil -*-
# vim:sw=4:ts=8:et:ai:
#
# Requires: tinder-defaults.pl
#
# Intent: This is becoming a general-purpose tinderbox
#         script, specific uses (mozilla, commercial, etc.) should
#         set variables and then call into this script.
#
# Status: In the process of re-arranging things so a commercial
#         version can re-use this script.
#

require 5.003;

use Sys::Hostname;
use strict;
use POSIX qw(sys_wait_h strftime);
use Cwd;
use Config;         # for $Config{sig_name} and $Config{sig_num}
use File::Copy;

$::UtilsVersion = '$Revision: 1.1 $ ';

package TinderUtils;

#
# Test for Time::HiRes, for ms resolution from gettimeofday().
#
require "gettime.pl";

#
# For performance tests, we need the following perl modules installed:
# (MacOSX, Linux, Win2k):
#
# Time::HiRes      for higher timer resolution
# Bundle::LWP      for http (to report data to graph)
#
# The "CPAN" way of installing this is to start here:
#   % sudo perl -MCPAN -e shell
#   <take defaults..>
#   cpan> install Time::HiRes
#   [...]
#   cpan> install Bundle::LWP
#

my $co_time_str = 0;  # Global, let tests send cvs co time to graph server.
my $co_default_timeout = 300;
my $graph_time;
my $LOGFILE;

sub Setup {
    InitVars();
    my $args = ParseArgs();
    LoadConfig();
    ApplyArgs($args); # Apply command-line arguments after the config file.
    GetSystemInfo();
    SetupEnv();
    ValidateSettings(); # Perform some basic validation on settings
}

sub OpenLOG {
    my ($logfile) = @_;
    print "Opening $logfile\n";
    open LOGFILE, ">$logfile"
        or die "Cannot open logfile, $logfile: $?\n";

    # Make the log file flush on every write.
    my $oldfh = select(LOGFILE);
    $| = 1;
    select($oldfh);
}

sub CloseLOG {
    close LOGFILE;
}

sub PrintUsage {
    die <<END_USAGE
    usage: $0 [options]
Options:
  --example-config       Print an example 'tinder-config.pl'.
  --once                 Do not loop.
  --noreport             Do not report status to tinderbox server.
  --nofinalreport        Do not report final status, only start status.
  --notest               Do not perform testing.
  --testonly             Do only testing (no checkout or build).
  --skip-checkout        Do not checkout CVS files.
  --skip-build           Do not build data.
  --skip-nss             Do not perform NSS tests.
  --skip-jss             Do not perform JSS tests.
  --notimestamp          Do not pull by date.
  --norotate             Do not rotate directories.
  --config-cvsup-dir DIR Provide a directory of configuration files 
                          (mozconfig, etc.) to run a "cvs update" in before 
                          a build begins.
  --version              Print the version number (same as cvs revision).
  --help
More details:
  To get started, run '$0 --example-config'.
END_USAGE
}

sub ParseArgs {
    #PrintUsage() if $#ARGV == -1;

    my $args = {};
    my $arg;
    while ($arg = shift @ARGV) {
        TinderUtils::PrintExampleConfig(), exit if $arg eq '--example-config';
        PrintUsage(), exit if $arg eq '--help' or $arg eq '-h';
        $args->{ReportStatus} = 0, next if $arg eq '--noreport';
        $args->{ReportFinalStatus} = 0, next if $arg eq '--nofinalreport';
        $args->{SkipTesting} = 1, next if $arg eq '--notest'; 
        $args->{TestOnly} = 1, next if $arg eq '--testonly';
        $args->{BuildOnce} = 1, next if $arg eq '--once';
        $args->{UseTimeStamp} = 0, next if $arg eq '--notimestamp';

        $args->{SkipCheckout} = 1, next if $arg eq '--skip-checkout'; 
        $args->{SkipBuild} = 1, next if $arg eq '--skip-build'; 
        $args->{SkipNSS} = 1, next if $arg eq '--skip-nss'; 
        $args->{SkipJSS} = 1, next if $arg eq '--skip-jss'; 
        $args->{NoRotate} = 1, next if $arg eq '--norotate'; 

        if ($arg eq '--version' or $arg eq '-v') {
            die "$0: version" . substr($::Version,9,6) . "\n";
        } else {
            warn "Error: Unknown option: $arg\n";
            PrintUsage();
        }
    }

    return $args;
}

sub ApplyArgs {
    my ($args) = @_;

    my ($variable_name, $value);
    while (($variable_name, $value) = each %{$args}) {
        eval "\$Settings::$variable_name = \"$value\";";
    }
}

sub ValidateSettings {
    # Lowercase the LogCompression and LogEncoding variables for convenience.
    $Settings::LogCompression = lc $Settings::LogCompression;
    $Settings::LogEncoding = lc $Settings::LogEncoding;

    # Make sure LogCompression and LogEncoding are set to valid values.
    if ($Settings::LogCompression !~ /^(bzip2|gzip)?$/) {
        warn "Invalid value for LogCompression: $Settings::LogCompression.\n";
        exit;
    }
    if ($Settings::LogEncoding !~ /^(base64|uuencode)?$/) {
        warn "Invalid value for LogEncoding: $Settings::LogEncoding.\n";
        exit;
    }

    # If LogEncoding is set to 'base64', ensure we have the MIME::Base64
    # module before we go through the entire build.
    if ($Settings::LogEncoding eq 'base64') {
        eval "use MIME::Base64 ();";
        if ($@) {
            warn "LogEncoding set to base64 but the MIME::Base64 module could not be loaded.\n";
            warn "The error message was:\n\n";
            warn $@;
            exit;
        }
    }

    # If LogCompression is set, make sure LogEncoding is set or else the log
    # will not be transferred properly.
    if ($Settings::LogCompression ne '' && $Settings::LogEncoding eq '') {
        warn "LogEncoding must be set if LogCompression is set.\n";
        exit;
    }
}

my $tinder_defaults = "tinder-defaults.pl";

sub InitVars {
    local $_;
    for (@ARGV) {
        # Save DATA section for printing the example.
        return if /^--example-config$/;
    }
    no strict 'vars';

    open DEFAULTS, $tinder_defaults or print "can't open $tinder_defaults, $?\n";

    while (<DEFAULTS>) {
        package Settings;
        #warn "config:$_";
        eval;
    }

    close DEFAULTS;
}

sub PrintExampleConfig {
    local $_;
    print "#- tinder-config.pl - Tinderbox configuration file.\n";
    print "#-    Uncomment the variables you need to set.\n";
    print "#-    The default values are the same as the commented variables.\n";
    print "\n";

    open DEFAULTS, $tinder_defaults or print "can't open $tinder_defaults, $!\n";
    while (<DEFAULTS>) {
        s/^\$/\#\$/;
        s/^\@/\#\@/;
        print;
    }
    close DEFAULTS;
}

sub GetSystemInfo {
    $Settings::OS = `uname -s`;
    my $os_ver = `uname -r`;
    $Settings::CPU = `uname -m`;
    #$Settings::ObjDir = '';
    my $host = ::hostname();
    $host = $1 if $host =~ /(.*?)\./;
    chomp($Settings::OS, $os_ver, $Settings::CPU, $host);

    # Redirecting stderr to stdout works on *nix, winnt, but not on win98.
    $Settings::TieStderr = '2>&1';

    if ($Settings::OS =~ /^CYGWIN_(.*?)-(.*)$/) {
        # the newer cygwin apparently has different output for 'uname'
        # e.g., CYGWIN_98-4.10 == win98SE, and CYGWIN_NT-5.0 == win2k
        $Settings::OS = 'WIN' . $1;
        $os_ver = $2;
        $host =~ tr/A-Z/a-z/;
    }
    if ($Settings::OS =~ /^W/) {
        $host =~ tr/A-Z/a-z/;
        $Settings::TieStderr = "" if $Settings::OS eq 'WIN98';
    }

    $Settings::DirName = "${Settings::OS}_${os_ver}";
    $Settings::BuildName = "$Settings::OS ${os_ver} $host";

    $Settings::DistBin = "dist/bin";

    # Make the build names reflect architecture/OS

    if ($Settings::OS eq 'Linux') {
        if (($Settings::CPU eq 'i686') or ($Settings::CPU eq 'i586')) {
            $Settings::BuildName = "$Settings::OS $host";
        } else {
            # $Settings::BuildName set above
        }
    }

    if ($Settings::OS eq 'SunOS') {
        $Settings::OSVerMajor = substr($os_ver, 0, 1);
        if ($Settings::CPU eq 'i86pc') {
            $Settings::BuildName = "$Settings::OS/i386 $os_ver $host";
        } else {
            if ($Settings::OSVerMajor ne '4') {
                $Settings::BuildName = "$Settings::OS/sparc $os_ver $host";
            }
        }
    }
    $Settings::BuildName .= " $Settings::BuildNameExtra";
}

sub LoadConfig {
    my $hostname = ::hostname();

    if (-r 'tinder-config.pl') {
        no strict 'vars';

        open CONFIG, 'tinder-config.pl' or
            print "can't open tinder-config.pl, $?\n";

        local $/ = undef;
        my $config = <CONFIG>;
        close CONFIG;

        package Settings;
        eval $config;
    } else {
        warn "Error: Need tinderbox config file, tinder-config.pl\n";
        warn "       To get started, run the following,\n";
        warn "          $0 --example-config > tinder-config.pl\n";
        exit;
    }
}

sub SetupEnv {
    umask 0;

    # Assume this file lives in the base dir, this will
    # avoid human error from setting this manually.
    $Settings::BaseDir = get_system_cwd();

    my $topsrcdir = "$Settings::BaseDir/$Settings::DirName/mozilla";
    my $objdir = "$topsrcdir/${Settings::ObjDir}";

    if (not -e $objdir) {
        # Not checking errors here, because it's too early to set $status and the 
        # build will fail anyway; failing loudly is better than failing silently.
        run_shell_command("mkdir -p $objdir");
    }

    $Settings::TopsrcdirFull = $topsrcdir;
    $Settings::TopsrcdirLast = $topsrcdir . ".last";

    $Settings::env64 = "USE_64=1; export USE_64; JAVA_HOME=\"$Settings::JavaHome64\"; export JAVA_HOME; PATH=\"$Settings::JavaHome64/bin:$ENV{PATH}\"; LD_LIBRARY_PATH=\"$Settings::JavaHome64/lib\"; export LD_LIBRARY_PATH; ";
    $Settings::env32 = "JAVA_HOME=\"$Settings::JavaHome32\"; export JAVA_HOME; PATH=\"$Settings::JavaHome32/bin:$ENV{PATH}\"; LD_LIBRARY_PATH=\"$Settings::JavaHome32/lib\"; export LD_LIBRARY_PATH; ";

    if ($Settings::Branch eq 'securityjes5') {
        $Settings::BuildTree = "$Settings::BuildTreeNSSStable\n";
    } else {
        $Settings::BuildTree = "$Settings::BuildTreeNSS\n";
    }
}

sub print_log {
    my ($text) = @_;
    print LOGFILE $text;
    print $text;
}

sub run_shell_command_with_timeout {
    my ($shell_command, $timeout_secs) = @_;
    my $now = localtime();
    local $_;

    chomp($shell_command);
    print_log "Begin: $now\n";
    print_log "$shell_command\n";

    my $pid = fork; # Fork off a child process.

    unless ($pid) { # child
        my $status = 0;
        open CMD, "$shell_command $Settings::TieStderr |" or die "open: $!";
        print_log $_ while <CMD>;
        close CMD or $status = 1;
        exit($status);
    }
    my $result = wait_for_pid($pid, $timeout_secs);

    $now = localtime();
    print_log "End:   $now\n";

    return $result;
}

sub run_shell_command {
    my ($shell_command) = @_;
    local $_;

    my $status = 0;
    chomp($shell_command);
    print_log "$shell_command\n";
    open CMD, "$shell_command $Settings::TieStderr |" or die "open: $!";
    print_log $_ while <CMD>;
    close CMD or $status = 1;
    return $status;
}

sub adjust_start_time {
    # Allows the start time to match up with the update times of a mirror.
    my ($start_time) = @_;

    # Since we are not pulling for cvs-mirror anymore, just round times
    # to 1 minute intervals to make them nice and even.
    my $cycle = 1 * 60;    # Updates every 1 minutes.
    my $begin = 0 * 60;    # Starts 0 minutes after the hour.
    my $lag   = 0 * 60;    # Takes 0 minute to update.
    return int(($start_time - $begin - $lag) / $cycle) * $cycle + $begin;
}

sub mail_build_started_message {
    my ($start_time) = @_;
    my $msg_log = "build_start_msg.tmp";
    OpenLOG($msg_log);

    my $platform = $Settings::OS =~ /^W/ ? 'windows' : 'unix';

    print_log "\n";

    print_log "tinderbox: tree: $Settings::BuildTree\n";
    print_log "tinderbox: builddate: $start_time\n";
    print_log "tinderbox: status: building\n";
    print_log "tinderbox: build: $Settings::BuildName\n";
    print_log "tinderbox: errorparser: $platform\n";
    print_log "tinderbox: buildfamily: $platform\n";
    print_log "tinderbox: version: $::Version\n";
    print_log "tinderbox: END\n";
    print_log "\n";

    CloseLOG();

    if ($Settings::blat ne "" && $Settings::use_blat) {
        system("$Settings::blat $msg_log -to $Settings::Tinderbox_server");
    } else {
        system "$Settings::mail $Settings::Tinderbox_server "
            ." < $msg_log";
    }
    unlink "$msg_log";
}

sub encode_log {
    my $input_file = shift;
    my $output_file = shift;
    my $buf;
    if($Settings::LogEncoding eq 'base64') {
        eval "use MIME::Base64 ();";
        while(read($input_file, $buf, 60*57)) {
            print $output_file &MIME::Base64::encode($buf);
        }
    }
    elsif($Settings::LogEncoding eq 'uuencode') {
        while(read($input_file, $buf, 45)) {
            print $output_file pack("u*", $buf);
        }
    }
    else {
        # Make sendmail happy.
        # Split lines longer than 1000 charaters into 1000 character lines.
        # If any line is a dot on a line by itself, replace it with a blank
        # line. This prevents cases where a <cr>.<cr> occurs in the log file.
        # Sendmail interprets that as the end of the mail, and truncates the
        # log before it gets to Tinderbox.  (terry weismann, chris yeh)
        
        while (<$input_file>) {
            my $length = length($_);
            my $offset;
            for ($offset = 0; $offset < $length ; $offset += 1000) {
                my $chars_left = $length - $offset;
                my $output_length = $chars_left < 1000 ? $chars_left : 1000;
                my $output = substr $_, $offset, $output_length;
                $output =~ s/^\.$//g;
                $output =~ s/\n//g;
                print $output_file "$output\n";
            }
        }
    }
}

sub mail_build_finished_message {
    my ($start_time, $build_status, $binary_url, $logfile) = @_;

    # Rewrite LOG to OUTLOG, shortening lines.
    open OUTLOG, ">$logfile.last" or die "Unable to open logfile, $logfile: $!";

    my $platform = $Settings::OS =~ /^W/ ? 'windows' : 'unix';

    # Put the status at the top of the log, so the server will not
    # have to search through the entire log to find it.
    print OUTLOG "\n";
    print OUTLOG "tinderbox: tree: $Settings::BuildTree\n";
    print OUTLOG "tinderbox: builddate: $start_time\n";
    print OUTLOG "tinderbox: status: $build_status\n";
    print OUTLOG "tinderbox: binaryurl: $binary_url\n" if ($binary_url ne "");
    print OUTLOG "tinderbox: build: $Settings::BuildName\n";
    print OUTLOG "tinderbox: errorparser: $platform\n";
    print OUTLOG "tinderbox: buildfamily: $platform\n";
    print OUTLOG "tinderbox: version: $::Version\n";
    print OUTLOG "tinderbox: utilsversion: $::UtilsVersion\n";
    print OUTLOG "tinderbox: logcompression: $Settings::LogCompression\n";
    print OUTLOG "tinderbox: logencoding: $Settings::LogEncoding\n";
    print OUTLOG "tinderbox: END\n";

    if ($Settings::LogCompression eq 'gzip') {
        open GZIPLOG, "gzip -c $logfile |" or die "Couldn't open gzip'd logfile: $!\n";
        encode_log(\*GZIPLOG, \*OUTLOG);
        close GZIPLOG;
    }
    elsif ($Settings::LogCompression eq 'bzip2') {
        open BZ2LOG, "bzip2 -c $logfile |" or die "Couldn't open bzip2'd logfile: $!\n";
        encode_log(\*BZ2LOG, \*OUTLOG);
        close BZ2LOG;
    }
    else {
        open LOG, "$logfile" or die "Couldn't open logfile, $logfile: $!";
        encode_log(\*LOG, \*OUTLOG);
        close LOG;
    }    
    close OUTLOG;
    unlink($logfile);

    # If on Windows, make sure the log mail has unix lineendings, or
    # we'll confuse the log scraper.
    if ($platform eq 'windows') {
        open(IN,"$logfile.last") || die ("$logfile.last: $!\n");
        open(OUT,">$logfile.new") || die ("$logfile.new: $!\n");
        while (<IN>) {
            s/\r\n$/\n/;
	    print OUT "$_";
        } 
        close(IN);
        close(OUT);
        File::Copy::move("$logfile.new", "$logfile.last") or die("move: $!\n");
    }

    if ($Settings::ReportStatus and $Settings::ReportFinalStatus) {
        if ($Settings::blat ne "" && $Settings::use_blat) {
            system("$Settings::blat $logfile.last -to $Settings::Tinderbox_server");
        } else {
            system "$Settings::mail $Settings::Tinderbox_server "
                ." < $logfile.last";
        }
    }
}

sub PrintEnv {
    local $_;

    # Print out environment settings.
    my $key;
    foreach $key (sort keys %ENV) {
        print_log "$key=$ENV{$key}\n";
    }
}

sub kill_process {
    my ($target_pid) = @_;
    my $start_time = time;

    # Try to kill and wait 10 seconds, then try a kill -9
    my $sig;
    for $sig ('TERM', 'KILL') {
        print "kill $sig $target_pid\n";
        kill $sig => $target_pid;
        my $interval_start = time;
        while (time - $interval_start < 10) {
            # the following will work with 'cygwin' perl on win32, but not 
            # with 'MSWin32' (ActiveState) perl
            my $pid = waitpid($target_pid, POSIX::WNOHANG());
            if (($pid == $target_pid and POSIX::WIFEXITED($?)) or $pid == -1) {
                my $secs = time - $start_time;
                $secs = $secs == 1 ? '1 second' : "$secs seconds";
                print_log "Process killed. Took $secs to die.\n";
                return;
            }
            sleep 1;
        }
    }
    die "Unable to kill process: $target_pid";
}

BEGIN {
    my %sig_num = ();
    my @sig_name = ();

    sub signal_name {
        # Find the name of a signal number
        my ($number) = @_;

        unless (@sig_name) {
            unless($Config::Config{sig_name} && $Config::Config{sig_num}) {
                die "No sigs?";
            } else {
                my @names = split ' ', $Config::Config{sig_name};
                @sig_num{@names} = split ' ', $Config::Config{sig_num};
                foreach (@names) {
                    $sig_name[$sig_num{$_}] ||= $_;
                }
            }
        }
        return $sig_name[$number];
    }
}

sub wait_for_pid {
    # Wait for a process to exit or kill it if it takes too long.
    my ($pid, $timeout_secs) = @_;
    my ($exit_value, $signal_num, $dumped_core, $timed_out) = (0,0,0,0);
    my $sig_name;
    my $loop_count;

    die ("Invalid timeout value passed to wait_for_pid()\n")
        if ($timeout_secs <= 0);

    eval {
        $loop_count = 0;
        while (++$loop_count < $timeout_secs) {
            my $wait_pid = waitpid($pid, POSIX::WNOHANG());
            # the following will work with 'cygwin' perl on win32, but not 
            # with 'MSWin32' (ActiveState) perl
            last if ($wait_pid == $pid and POSIX::WIFEXITED($?)) or $wait_pid == -1;
            sleep 1;
        }

        $exit_value = $? >> 8;
        $signal_num = $? >> 127;
        $dumped_core = $? & 128;
        if ($loop_count >= $timeout_secs) {
            die "timeout";
        }
        return "done";
    };

    if ($@) {
        if ($@ =~ /timeout/) {
            kill_process($pid);
            $timed_out = 1;
        } else { # Died for some other reason.
            die; # Propagate the error up.
        }
    }
    $sig_name = $signal_num ? signal_name($signal_num) : '';

    return { timed_out=>$timed_out,
             exit_value=>$exit_value,
             sig_name=>$sig_name,
             dumped_core=>$dumped_core };
}

sub get_system_cwd {
    my $a = Cwd::getcwd()||`pwd`;
    chomp($a);
    return $a;
}

# Need to end with a true value, (since we're using "require").
1;
