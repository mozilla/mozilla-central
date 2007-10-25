#!/usr/bin/perl
# -*- Mode: perl; indent-tabs-mode: nil -*-
# vim:sw=4:ts=8:et:ai:
#
# Requires: gettime.pl
# Requires: tinder-utils.pl
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

$::UtilsVersion = '$Revision: 1.2 $ ';

package TinderNssUtils;

require "gettime.pl";
require "tinder-utils.pl";

my $build_status = 'none';
my $test_status  = 'none';
my $rsync_cntr   = "1";
my $hostname = ::hostname();
my $build_bits;
my $test_options;
my $test_cycle = 0;
my $test_cycles_total = 1;

$::Version = '$Revision: 1.2 $ ';

sub Build {
    BuildAndRun();
}

sub BuildAndRun {
    mkdir $Settings::DirName, 0777;
    chdir $Settings::DirName or die "Couldn't enter $Settings::DirName";

    my $build_dir = TinderUtils::get_system_cwd();

    if ($Settings::OS =~ /^W/ && $build_dir !~ m/^.:\//) {
        chomp($build_dir = `cygpath -w $build_dir`);
        $build_dir =~ s/\\/\//g;
    }

    my $exit_early = 0;
    my $start_time = 0;

    my $build_failure_count = 0;  

    $build_bits = "$Settings::BuildBits";
    if ($build_bits eq "both") {
        $build_bits = "64";
    }

    my $nsstests = "$Settings::NSSTests";
    if ($nsstests eq "") {
        $nsstests = "standard";
    }

    if ($Settings::Branch eq 'securitytip') {
        $test_cycles_total = 4;
    }

    while (not $exit_early) {
        $Settings::BuildName = "$Settings::Branch $nsstests $Settings::OS $hostname";
        $Settings::BuildName = "$Settings::Branch $nsstests $Settings::OS/sparc $hostname" if $Settings::OS eq 'SunOS' and $Settings::CPU eq 'sun4u';
        $Settings::BuildName = "$Settings::Branch $nsstests $Settings::OS/x86 $hostname" if $Settings::OS eq 'SunOS' and $Settings::CPU eq 'i86pc';

        print "Starting dir is : $build_dir\n";

        my $sleep_time = ($Settings::BuildSleep * 60) - (time - $start_time);
        if (not $Settings::TestOnly and $sleep_time > 0) {
            print "\n\nSleeping $sleep_time seconds ...\n";
            sleep $sleep_time;
        }

        $start_time = time();
        $start_time = TinderUtils::adjust_start_time($start_time);

        my $logfile = "$Settings::DirName.log";

        TinderUtils::mail_build_started_message($start_time) if $Settings::ReportStatus;

        chdir $build_dir;
        TinderUtils::OpenLOG($logfile);

        TinderUtils::print_log("Current dir is -- " . $hostname . ":$build_dir\n");
        TinderUtils::print_log("Build Administrator is $Settings::BuildAdministrator\n");

        if ($Settings::UserComment) {
            TinderUtils::print_log("$Settings::UserComment\n");
        }

        TinderUtils::print_log("uname -a = " . `uname -a`);

        if (-e "/etc/redhat-release") {
            TinderUtils::print_log(`cat /etc/redhat-release`);
        }
        
        TinderUtils::print_log("TinderboxPrint:${build_bits} bit\n");

        $test_options = "";
        if ($test_cycle ne 0) {
            $test_options .= "NSS_TEST_DISABLE_STANDARD=1; export NSS_TEST_DISABLE_STANDARD; "
        }
        if ($test_cycle ne 1) {
            $test_options .= "NSS_TEST_DISABLE_PKIX=1; export NSS_TEST_DISABLE_PKIX; "
        }
        if ($test_cycle ne 2) {
            $test_options .= "NSS_TEST_DISABLE_UPGRADE_DB=1; export NSS_TEST_DISABLE_UPGRADE_DB; "
        }
        if ($test_cycle ne 3) {
            $test_options .= "NSS_TEST_DISABLE_SHARED_DB=1; export NSS_TEST_DISABLE_SHARED_DB; "
        }

        if ($test_cycle eq 0) {
            TinderUtils::print_log("TinderboxPrint:Standard");
        } elsif ($test_cycle eq 1) { 
            TinderUtils::print_log("TinderboxPrint:PKIX");
        } elsif ($test_cycle eq 2) {
            TinderUtils::print_log("TinderboxPrint:Upgrade DB");
        } elsif ($test_cycle eq 3) {
            TinderUtils::print_log("TinderboxPrint:Shared DB");
        }

        TinderUtils::PrintEnv();

        if ($build_failure_count > 0) {
            TinderUtils::print_log("Previous consecutive build failures: $build_failure_count\n");
        }

        unless ($Settings::TestOnly) {
            unless ($Settings::SkipCheckout or $build_status eq "busted") {
                system("cd $build_dir; rm -Rf mozilla");
                $build_status = cvs_checkout($start_time);
            }

            unless ($Settings::SkipBuild or $build_status eq "busted") {
                $build_status = build_all($build_dir);
            }
        }

        unless ($Settings::SkipTesting or $build_status eq "busted") {
            if ($Settings::OS =~ /^W/) {
                TinderUtils::run_shell_command("taskkill /f /t /im selfserv; taskkill /f /t /im strsclnt");
            } else {
                TinderUtils::run_shell_command("/usr/bin/pkill selfserv; /usr/bin/pkill strsclnt");
            }

            my $test_nss_status;
            my $test_jss_status;

            unless ($Settings::SkipNSS) {
                $test_nss_status = run_nss_tests($build_dir);
            } else {
                $test_nss_status = "success";
            }

            unless ($Settings::SkipJSS) {
                $test_jss_status = run_jss_tests($build_dir);
            } else {
                $test_jss_status = "success";
            }    

            if ($test_nss_status eq "testfailed" or $test_jss_status eq "testfailed") {
                $build_status = "testfailed";
            } else {
                $build_status = "success";
            } 
        } else {
            if ($build_status ne "busted") {
                TinderUtils::print_log("######## Skipping Mozilla tests. ########\n");
                $build_status = "success";
            } else {
                TinderUtils::print_log("######## Mozilla tests skipped and build is busted. #########\n");
                $build_status = "busted";
            }
        }

        if ($build_status eq "busted") {
            $build_failure_count++;
        } else {
            $build_failure_count = 0;
        }

        TinderUtils::CloseLOG();
        chdir $build_dir;

        my $binary_url = '';
        TinderUtils::mail_build_finished_message($start_time, $build_status, $binary_url, $logfile) if $Settings::ReportStatus;

        unless ($Settings::NoRotate) {
            if ($rsync_cntr gt $Settings::rsync_max) {
                $rsync_cntr = "1";
            }

            system("rm -Rf $Settings::TopsrcdirLast.$rsync_cntr");
            system("mv $Settings::TopsrcdirFull/ $Settings::TopsrcdirLast.$rsync_cntr");
            system("cd $build_dir; rm -Rf mozilla");
            $rsync_cntr++;
        }

        $exit_early++ if $Settings::TestOnly and ($build_status ne 'success');
        $exit_early++ if $Settings::BuildOnce;
        $build_status = "restart";

        $test_cycle++;
        if ($test_cycle ge $test_cycles_total) {
            $test_cycle = 0;
        }

        if (($Settings::BuildBits eq "both") && ($test_cycle eq 0)) {
            if ($build_bits eq "32") {
                $build_bits = "64";
            } else {
                $build_bits = "32";
            }
        }
    }
}

sub cvs_checkout {
    my ($start_time) = @_;

    my $cvsco;
    my @cvsfiles;
    my $cvsitem;

    my $build_status = 'none';

    if ($Settings::UseTimeStamp) {
        my $time_str = POSIX::strftime("%m/%d/%Y %H:%M +0000", gmtime($start_time));

        $ENV{MOZ_CO_DATE} = "$time_str";

        $cvsco = "co -D \"$time_str\"";
    } else {
        $cvsco = "co -A";
    }

    if ($Settings::Branch eq 'securityjes5') {
        @cvsfiles = @TreeSpecific::jes5_cvsfiles;
    } else {
        @cvsfiles = @TreeSpecific::tip_cvsfiles;
    }

    for $cvsitem (@cvsfiles) {
        print '##################################\n';
        my $status = TinderUtils::run_shell_command("$Settings::CVS $cvsco $cvsitem");
        if ($status ne 0) {
            $build_status = "busted";
            TinderUtils::print_log("Error: CVS checkout failed.\n");
            return $build_status;
        } else {
            $build_status = "success";
        }
    }

    return $build_status;
}

sub build_all {
    my ($build_dir) = @_;

    my $build_status;

    my $make_nss_dbg = "cd $build_dir/$Settings::Topsrcdir/security/nss; $Settings::Make $TreeSpecific::nss_build_target";
    my $make_nss_opt = "BUILD_OPT=1; export BUILD_OPT; cd $build_dir/$Settings::Topsrcdir/security/nss; $Settings::Make $TreeSpecific::nss_build_target";
    my $make_jss_dbg = "cd $build_dir/$Settings::Topsrcdir/security/jss;$Settings::Make $TreeSpecific::jss_build_target";
    my $make_jss_opt = "BUILD_OPT=1; export BUILD_OPT; cd $build_dir/$Settings::Topsrcdir/security/jss;$Settings::Make $TreeSpecific::jss_build_target";

    $make_nss_dbg = "$TreeSpecific::nss_extraflags $make_nss_dbg" if $TreeSpecific::nss_extraflags;
    $make_nss_opt = "$TreeSpecific::nss_extraflags $make_nss_opt" if $TreeSpecific::nss_extraflags;

    if ($build_bits eq "64") {
        $make_nss_dbg = "$Settings::env64 $make_nss_dbg";
        $make_nss_opt = "$Settings::env64 $make_nss_opt";
        $make_jss_dbg = "$Settings::env64 $make_jss_dbg";
        $make_jss_opt = "$Settings::env64 $make_jss_opt";
    } else {
        $make_nss_dbg = "$Settings::env32 $make_nss_dbg";
        $make_nss_opt = "$Settings::env32 $make_nss_opt";
        $make_jss_dbg = "$Settings::env32 $make_jss_dbg";
        $make_jss_opt = "$Settings::env32 $make_jss_opt";
    }

    mkdir -p $Settings::ObjDir, 0777 if ($Settings::ObjDir && ! -e $Settings::ObjDir);

    if ($Settings::OS =~ /^W/) {
        TinderUtils::run_shell_command("taskkill /f /t /im selfserv; taskkill /f /t /im strsclnt");
    } else {
        TinderUtils::run_shell_command("/usr/bin/pkill selfserv; /usr/bin/pkill strsclnt");
    }
 
    TinderUtils::print_log("######## Building $build_bits bit NSS in DBG mode ########\n");
    my $status = TinderUtils::run_shell_command("$make_nss_dbg");
    if ($status eq 0) {
        TinderUtils::print_log("######## Building $build_bits bit NSS in OPT mode ########\n");
        $status = TinderUtils::run_shell_command("$make_nss_opt");
        if (($status eq 0) and ($Settings::SkipJSS eq 0)) {
            TinderUtils::print_log("######## Building $build_bits bit JSS in DBG mode ########\n");
            $status = TinderUtils::run_shell_command("$make_jss_dbg");
            if ($status eq 0) {
                TinderUtils::print_log("######## Building $build_bits bit JSS in OPT mode ########\n");
                $status = TinderUtils::run_shell_command("$make_jss_opt");
            }
        }
    }    

    if ($status ne 0) {
        $build_status = "busted";
    } else {
        $build_status = "success";
    }

    return $build_status;
}

sub run_nss_tests {
    my ($build_dir) = @_;
    my $test_status;

    TinderUtils::print_log("\n######## Running NSS test ########\n");

    $test_status = run_nss_test_cycle($build_dir, "DBG");
    $test_status = run_nss_test_cycle($build_dir, "OPT") if ($test_status ne "testfailed");

    if ($test_status ne "testfailed") {
        TinderUtils::print_log("\n######## All 32 bit NSS tests PASSED ########\n");
        $test_status = "success";
    }

    return $test_status;
}

sub run_nss_test_cycle {
    my ($build_dir, $opt) = @_;

    my $flags = "$test_options";

    if ($build_bits eq "64") {
        $flags .= "USE_64=1; export USE_64; ";
    }

    if ($opt eq "OPT") {
        $flags .= "BUILD_OPT=1; export BUILD_OPT; ";
    }

    if ($Settings::NSSTests ne '') {
        $flags .= "TESTS=$Settings::NSSTests; export TESTS; ";
    }

    TinderUtils::print_log("\n######## Running $build_bits bit NSS test in $opt mode ########\n");

    my $shell_command = "cd $build_dir/$Settings::Topsrcdir/security/nss/tests; ./all.sh";
    $shell_command = "$flags $shell_command" if ($flags ne "");
    $shell_command = "$TreeSpecific::nss_extraflags $shell_command" if $TreeSpecific::nss_extraflags;
    my $test_status = TinderUtils::run_shell_command("$shell_command");

    my $TEST_RESULT = "";

    if ($test_status eq 0) {
        my $TEST_RESULT_CNTR = `cat $build_dir/$Settings::Topsrcdir/tests_results/security/$hostname`;
        $TEST_RESULT_CNTR = $TEST_RESULT_CNTR - 1;
        $TEST_RESULT = `cat $build_dir/$Settings::Topsrcdir/tests_results/security/$hostname.$TEST_RESULT_CNTR/results.html | grep "bgcolor=red"`;
        chomp($TEST_RESULT);

        if ($TEST_RESULT ne "") {
            $test_status = "testfailed";
        }
    } else {
        $TEST_RESULT = "Could not run all.sh in 32 bit DBG mode";
        $test_status = "testfailed";
    }

    if ($test_status ne 0) {
        TinderUtils::print_log("\n######## Debug 32 bit NSS test BUSTED ########\n$TEST_RESULT\n########\n");
    } 

    return $test_status;
}

sub run_jss_tests {
    my ($build_dir) = @_;
    my $test_status;

    TinderUtils::print_log("\n######## Running JSS tests ########\n");
    if ($build_bits eq "64") {
        TinderUtils::run_shell_command("$Settings::env64 cd $build_dir/$Settings::Topsrcdir/dist;cat $build_dir/../apps/keystore.pw | jarsigner -keystore $build_dir/../apps/keystore -internalsf xpclass_dbg.jar jssdsa;jarsigner -verify -certs xpclass_dbg.jar");
        TinderUtils::run_shell_command("$Settings::env64 cd $build_dir/$Settings::Topsrcdir/dist;cat $build_dir/../apps/keystore.pw | jarsigner -keystore $build_dir/../apps/keystore -internalsf xpclass.jar jssdsa;jarsigner -verify -certs xpclass.jar");
    } else {   
        TinderUtils::run_shell_command("$Settings::env32 cd $build_dir/$Settings::Topsrcdir/dist;cat $build_dir/../apps/keystore.pw | jarsigner -keystore $build_dir/../apps/keystore -internalsf xpclass_dbg.jar jssdsa;jarsigner -verify -certs xpclass_dbg.jar");
        TinderUtils::run_shell_command("$Settings::env32 cd $build_dir/$Settings::Topsrcdir/dist;cat $build_dir/../apps/keystore.pw | jarsigner -keystore $build_dir/../apps/keystore -internalsf xpclass.jar jssdsa;jarsigner -verify -certs xpclass.jar");
    }

    $test_status = run_jss_test_cycle($build_dir, "DBG");
    $test_status = run_jss_test_cycle($build_dir, "OPT") if ($test_status ne "testfailed");

    if ($test_status ne "testfailed") {
        TinderUtils::print_log("\n######## All JSS tests PASSED ########\n");
        $test_status = "success";
    }

    return $test_status;
}

sub run_jss_test_cycle {
    my ($build_dir, $opt) = @_;
     
    my $flags = "";
    my $dbgobjdir = "";
    my $optobjdir = "";
    my $objdir = "";

    if ($build_bits eq "64") {
        $flags .= "$Settings::env64";
        $dbgobjdir = "$Settings::DbgObjDir64";
        $optobjdir = "$Settings::OptObjDir64";
    } else {
        $flags .= "$Settings::env32";
        $dbgobjdir = "$Settings::DbgObjDir32";
        $optobjdir = "$Settings::OptObjDir32";
    }

    if ($opt eq "OPT") {
        $flags .= "BUILD_OPT=1; export BUILD_OPT; ";
        $objdir = "$optobjdir";
    } else {
        $objdir = "$dbgobjdir";
    }
         
    TinderUtils::print_log("\n######## Running $build_bits bit JSS test in $opt mode ########\n");

    my $shell_command = "cd $build_dir/$Settings::Topsrcdir/security/jss/org/mozilla/jss/tests/; perl all.pl dist $build_dir/$Settings::Topsrcdir/dist/$objdir";
    $shell_command = "$flags $shell_command" if ($flags ne "");
    my $test_status = TinderUtils::run_shell_command("$shell_command");

    my $logfile = "$Settings::DirName.log";
    my $TEST_RESULT = `cat $logfile | grep FAILURE`;
    chomp($TEST_RESULT);

    TinderUtils::print_log("$build_bits bit JSS $opt test result: $TEST_RESULT");

    if ($TEST_RESULT eq "Test Status: FAILURE") {
        TinderUtils::print_log("\n######## $build_bits bit JSS $opt test BUSTED ########\n");
        $test_status = "testfailed";
    }

    return $test_status;
}

1;
