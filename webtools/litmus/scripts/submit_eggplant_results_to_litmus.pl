#!/usr/bin/perl -w
# -*- mode: cperl; c-basic-offset: 8; indent-tabs-mode: nil; -*-

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
# The Original Code is Litmus.
#
# The Initial Developer of the Original Code is
# the Mozilla Corporation.
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Chris Cooper <ccooper@deadsquid.com>
#
# ***** END LICENSE BLOCK *****

use strict;
$|++;

use Data::Dumper;
use Date::Manip;
use Getopt::Long;
use Sys::Hostname;
use Test::Litmus;

my $help = 0;
my $results_file;
my $username;
my $authtoken;
my $product;
my $branch;
my $platform;
my $opsys;
my $build_id;
my $locale;
my $server;
my $machinename;
my $build_type;
my $validate_only;

GetOptions(
           "help|?" => \$help,
           "results_file=s" => \$results_file,
           "username=s" => \$username,
           "authtoken=s" => \$authtoken,
           "product=s" => \$product,
           "branch=s" => \$branch,
           "platform=s" => \$platform,
           "opsys=s" => \$opsys,
           "build_id=s" => \$build_id,
           "locale=s" => \$locale,
           "server=s" => \$server,
           "machinename=s" => \$machinename,
           "build_type=s" => \$build_type,
           "validate_only" => \$validate_only,
           );

if ($help) {
  &usage();
  exit 0;
}

# Check first for mandatory command-line opts.
if (!$results_file or $results_file eq '') {
    print STDERR "You must specify a results file.\n";
    &usage();
    exit 1;
}

if (! -e $results_file or ! -r $results_file) {
    print STDERR "Results file: $results_file does not exist, or is not readable.\n";
    exit 1;
}

if (!$username or $username eq '') {
    print STDERR "You must specify a username.\n";
    &usage();
    exit 1;
}

if (!$authtoken or $authtoken eq '') {
    print STDERR "You must specify an authtoken.\n";
    &usage();
    exit 1;
}

if (!$build_type or $build_type eq '') {
    $build_type = 'Nightly';
}

# Parse the results file to check that:
# 1) We have results to submit; and,
# 2) Any params not set on the command-line are defined in the log.

my @results = &parseResultsFile($results_file);

if (scalar @results <= 0) {
    print STDERR "No results found. Exiting.\n";
    exit 1;
}

# Check for params that must be set *either* on the command line or in the
# results file
if (!$product or $product eq '') {
    print STDERR "You must specify a product.\n";
    &usage();
    exit 1;
}

if (!$branch or $branch eq '') {
    print STDERR "You must specify a branch.\n";
    &usage();
    exit 1;
}

if (!$platform or $platform eq '') {
    print STDERR "You must specify a platform.\n";
    &usage();
    exit 1;
}

if (!$opsys or $opsys eq '') {
    print STDERR "You must specify an operating sytem (opsys).\n";
    &usage();
    exit 1;
}

if (!$build_id or $build_id eq '') {
    $build_id = &createFakeBuildID();
} elsif ($build_id !~ /^\d{10,10}$/) {
    print STDERR "A build ID is a date-based 10-digit number.\n";
    &usage();
    exit 0;
}

if (!$locale or $locale eq '') {
    $locale='en-US';
}

if (!$server or $server eq '') {
    $server='https://litmus.mozilla.org/process_test.cgi';
}

if (!$machinename or $machinename eq '') {
    $machinename = hostname;
}

# Create a new test container object.
my $t = Test::Litmus->new(-server => $server,
                          -username => $username,
                          -authtoken => $authtoken,
                          -machinename => $machinename,
                         );

$t->sysconfig(-product => $product,
              -platform => $platform, 
              -opsys => $opsys, 
              -branch => $branch, 
              -buildid => $build_id,
              -buildtype => $build_type,
              -locale => $locale);

foreach my $result (@results) {
   $t->addResult($result);
}

# add log information that should be linked with 
# all results (i.e. env variables, config info)
my $log_text = &toString($results_file);
if ($log_text and $log_text ne '') {
    $t->addLog(Test::Litmus::Log->new(
                    -type => 'STDOUT',
                    -data => $log_text)
              );
}
if ($validate_only) {
    print Dumper $t;
    exit 0;
}

my $res = $t->submit();
  
# $res is 0 for non-fatal errors (some results were submitted), and 
# undef for fatal errors (no results were submitted successfully)
  
if (!$res or $res != 1) {
    if ($t->errstr()) {
        die $t->errstr();
    }
}

exit 0;

#########################################################################
sub usage() {
  print<<EOUSAGE;
  
./submit_eggplant_results_to_litmus.pl --results_file=/path/to/result_file
    --username=<your\@litmus.account>
    --authtoken=yourlitmusauthtoken
    --product=<product_name>
    --branch=<testing_branch>
    --platform=<testing_platform>
    --opsys=<platform_opsys>
    [--build_id=##########]
    [--locale=<locale>]
    [--server=http://your.litmus.server/process_test.cgi/]
    [--machinename=HOSTNAME]
    [--build_type=<build_type>]
    [--help|-?]
    [--validate_only]

results_file:  the full path to the eggplant result file you are submitting
username:      the email address with an associated authtoken for submitting
               automated results.
authtoken:     the authtoken for the Litmus account
product:       the product you are testing
branch:        the branch you are testing
platform:      the testing platform: Windows|Mac (Intel)|Mac (PPC)|Linux|Solaris
opsys:         depends on your chosen platform, e.g. Windows Vista

build_id:      the 10-digit build ID of the build you are testing. If not
               provided, a "fake" nightly build ID will be created based on the
               current date in the format YYYYMMDD99
locale:        the locale of the build you are testing, defaults to en-US
server:        the hostname of your Litmus server, suffixed with
               process_test.cgi. Defaults to:
               https://litmus.mozilla.org/process_test.cgi
machinename:   the hostname of the machine you are testing on
build_type:    Nightly|Release|CVS Debug|CVS Optimized|Other
               (defaults to Nightly)

help:          displays this message and then exits
validate_only: confirms that you have all the necessary parameters set and that
               the results file is parsable, but doesn't submit any results

NOTE: product, branch, platform, opsys, locale, build_id, and machinename can
      also be defined within the results file. Only product, branch, platform,
      and opsys are mandatory, i.e. must be supplied either on the command
      line or in the results file.

EOUSAGE
}

#########################################################################
sub createFakeBuildID() {
    return &UnixDate("now","%Y%m%d99");
}

#########################################################################
sub parseResultsFile {
    my ($results_file) = @_;
            
    my ($short_name, $result_status, $testcase_id, $duration);
    my @results;
    open(RESULTSFILE, $results_file) or die "Can't open $results_file: $!";
    my $in_header = 1;
    while (<RESULTSFILE>) {
        if ($in_header) {
          if (/^product : (.*)$/) {
              $product = $1;
              next;
          }
          if (/^branch : (.*)$/) {
              $branch = $1;
              next;
          }
          if (/^platform : (.*)$/) {
              $platform = $1;
              next;
          }
          if (/^opsys : (.*)$/) {
              $opsys = $1;
              next;
          }
          if (/^locale : (.*)$/) {
              $locale = $1;
              next;
          }
          if (/^build_id : (\d+)$/) {
              $build_id = $1;
              next;
          }
          if (/^machinename : (.*)$/) {
              $machinename = $1;
              next;
          }
        }
        
        if (/^Test Case : (.*)$/) {
            $in_header = 0;
            if ($result_status and
                $testcase_id) {
                my %hash = (
                            result_status => $result_status,
                            testcase_id => $testcase_id,
                            duration => $duration || 0,
                           );
                push @results, \%hash;
                undef $short_name;
                undef $result_status;
                undef $testcase_id;
                undef $duration;
            }
            $short_name = $1;
            next;
        }
        if ($short_name) {
            if (/^Status : ([a-zA-Z]*)$/) {
                my $status = $1;
                if ($status =~ /PASS/i) {
                    $result_status = 'pass';
                } elsif ($status =~ /FAIL/i) {
                    $result_status = 'fail';
                } else {
                    print STDERR "Unknown result status: $status. Skipping...\n";
                    undef $short_name;
                    undef $result_status;
                    undef $testcase_id;
                    undef $duration;
                }
                next;
            }
            if (/^Litmus ID :\s+(\d+)$/) {
                $testcase_id = $1;
                next;
            }
            if (/^Duration : (\d+) seconds/) {
                $duration = $1;
                next;
            }
        }
    }
    close(RESULTSFILE);

    # Add last result if necessary
    if ($result_status and
        $testcase_id) {
        my %hash = (
                    result_status => $result_status,
                    testcase_id => $testcase_id,
                    duration => $duration || 0,
                   );
        push @results, \%hash;
        undef $short_name;
        undef $result_status;
        undef $testcase_id;
        undef $duration;
    }
    
    my @result_objs;
    my $now = &UnixDate("now","%q");
    foreach my $current_result (@results) {
        my $result_obj = Test::Litmus::Result->new(
                -isAutomatedResult => 1, # optional
                -testid => $current_result->{'testcase_id'},
                -resultstatus => $current_result->{'result_status'},
                -exitstatus => 'Exited Normally',
                -duration => $current_result->{'duration'} || 0,
                -timestamp => $now,
                );
        push @result_objs, $result_obj;
    }

    return @result_objs;
}

#########################################################################
sub toString {
    my ($file) = @_;
    
    my $file_as_string = "";
    my $in_header = 1;
    open(FILE, $file) or die "Can't open $file: $!";
    while (<FILE>) {
        # Check for the testcase boundary line as our clue that we're out of
        # the mail header. 
        if ($in_header and
            /^======================================$/) {
            $in_header = 0;
        }
        next if ($in_header);
        $file_as_string .= $_;
        last if (/^test run duration:/);
    }
    close(FILE);

    return $file_as_string;
}
