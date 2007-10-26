#!/usr/bin/perl

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
# The Original Code is Try server patch downloader script.
#
# The Initial Developer of the Original Code is
# Mozilla Corporation.
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Ben Hearsum <bhearsum@mozilla.com>
# ***** END LICENSE BLOCK *****

# Description:
#   TODO
#

use strict;
use warnings;
use File::Spec::Functions;

use MozBuild::Util qw(RunShellCommand MkdirWithPath);

# for readability
my $ST_INODE = 1;

# where to retrieve files from -- make sure this has a trailing slash
my $PATCHURL = "http://localhost/patches/";
# where the patches go
my $PATCHDIR = ".";
# where to log errors
my $LOGFILE = "downloader.log";

my $PYTHON_PATH = "/usr/bin/python";
my $BUILDBOT_PATH = "/usr/bin/buildbot";
my $MASTER_HOST = "localhost:9989";
my $PATCH_BRANCH = "PATCH_TRY";
my $HG_BRANCH = "HG_TRY";
# if multiple patches are being this controls the delay between them
# this value should be more than the treeStableTimer on the Scheduler
my $DELAY = 5;


# set up the patch directory
if (-e $PATCHDIR) {
    if (! -d $PATCHDIR) {
        print STDERR "Patch directory is a file\n";
        exit 1;
    }
}
else {
    if (! MkdirWithPath(dir => $PATCHDIR)) {
        print STDERR "Could not create patch directory\n";
        exit 1;
    }
}

RunShellCommand(command         => "wget",
                args            => ['--no-check-certificate', '-q', '-r', '-l1',
                                    '-np', '-nd', '-Rindex.html*,.1',
                                    '-P', $PATCHDIR, $PATCHURL],
                logfile         => $LOGFILE,
                appendLogfile   => 1,
                redirectStderr  => 1);
                
# set-up the logfile
open(LOGFILE, ">>$LOGFILE") ||
  die("Could not open logfile\nFailure message: $!\n");

opendir(DIR, $PATCHDIR) ||
  die("Could not read patch directory\nFailure message: $!\n");
my @files = grep { /^[\w.-]+\.info$/ } readdir(DIR);
closedir(DIR) || die("Could not close directory\nFailure message: $!\n");

if (0 == scalar(@files)) {
    print LOGFILE scalar(localtime()) . " - No Patches, exiting...\n";
    exit 0;
}

# any changes left still need a sendchange generated
foreach my $file (@files) {
    my (%info, $key, $value, $rv);
    my $infoFilename = catfile($PATCHDIR, $file);

    open(INFOFILE, $infoFilename) ||
      die("Could not open info file: $file\nFailure message: $!\n");
    while (<INFOFILE>) {
        if ($_ !~ /^\s*$/) {
            ($key, $value) = split(/: ?/, $_, 2);
            chomp($value);
            $info{$key} = $value;
        }
    }
    close(INFOFILE) ||
      die("Could not close info file: $file\nFailure message: $!\n");

    if (! exists $info{'processed'} || ! scalar($info{'processed'})) {
        if ($info{'type'} eq "patch") {
            $rv = RunShellCommand(
                command => $PYTHON_PATH,
                args    => [$BUILDBOT_PATH, "sendchange",
                            "--username", $info{'submitter'},
                            "--master", $MASTER_HOST,
                            "--branch", $PATCH_BRANCH,
                            "--comments", "$info{'description'}",
                            "mozconfig: $info{'mozconfig'}",
                            "identifier: $info{'identifier'}",
                            "branch: $info{'branch'}",
                            "patchLevel: $info{'patchLevel'}",
                            "patchFile: $info{'patchFile'}"]
            );
        }
        elsif ($info{'type'} eq "hg") {
            $rv = RunShellCommand(
                command => $PYTHON_PATH,
                args    => [$BUILDBOT_PATH, "sendchange",
                            "--username", $info{'submitter'},
                            "--master", $MASTER_HOST,
                            "--branch", $HG_BRANCH,
                            "--comments", "$info{'description'}",
                            "mozconfig: $info{'mozconfig'}",
                            "identifier: $info{'identifier'}",
                            "mozillaRepoPath: $info{'mozillaRepoPath'}",
                            "tamarinRepoPath: $info{'tamarinRepoPath'}"]
            );
        }
        else {
            print LOGFILE "Bad info file\n";
        }
       
        if (0 == $rv->{'exitValue'} && -1 == index($rv->{'output'}, "NOT")) {
            # sendchange succeeded
            open(INFO, ">>$infoFilename") ||
              die("Could not open info file: $file\nFailure message: $!\n");
            print INFO "\nprocessed: 1\n";
            close(INFO) ||
              die("Coould not close info file: $file\nFailure message: $!\n");
            sleep($DELAY);
        }
        else {
            # sendchange failed
            print LOGFILE "Could not send change: $file\n";
        }
    }
}

close(LOGFILE) || die("Could not close logfile\nFailure message: $!\n");
