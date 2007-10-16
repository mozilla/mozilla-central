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
# The Original Code is Try server submission form.
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
#   This cgi script displays a simple form that allows a user to submit a diff
#   that will eventually be uploaded to a Buildbot master. It can also be used
#   to point a Buildbot master at a set of Mercurial repositories.
#   It generates a .info file that contains all necessary information for
#   Buildbot to produce a build with the requested patch or repositories.
#   processchanges.pl should be used to download these patches and send them
#   to Buildbot.


use strict;
use warnings;
use CGI qw/:standard/;
use LWP::Simple qw/!head/;
use File::Spec::Functions;

require 'sendchange-ui.pm';
use vars qw($SIZE_LIMIT);

# where patches and info files will go after being submitted
my $PATCH_DIR = '/buildbot/patches';
# regexes for validation
my $ALLOWED_TEXT_REGEX = '^[\w\s,.]+$';
my $ALLOWED_FILENAME_REGEX = '^([\w-]|\.[\w-])+$';
my $ALLOWED_BRANCH_REGEX = '^[\w_]+$';

$CGI::POST_MAX = $SIZE_LIMIT; # comes from sendchange-ui

sub Process
{
    # used for ensuring non-conflicting filenames
    my $time = time();
    my $key = int(rand(1000));
    # get the parameters
    my $name                = $ENV{'REMOTE_USER'};
    my $type                = param('type');
    my $patchFile           = param('patchFile');
    my $patchLevel          = param('patchLevel');
    my $branch              = param('branch');
    my $mozillaRepoPath     = param('mozilla-repo');
    my $tamarinRepoPath     = param('tamarin-repo');
    my $identifier          = param('identifier');
    my $description         = param('description');
    my $mozconfig           = param('mozconfig');
    my (@err, $infoFile);

    if (! $name) {
        push(@err, 'You must be logged in to use this service');
    }

    if ($description =~ /^\s*$/) {
        $description = 'No description given';
    }

    if ($identifier eq '') {
        $identifier = $time;
    }

    # only allow alphanumeric, '_', and whitespace
    if ($description !~ /$ALLOWED_TEXT_REGEX/) {
        push(@err, 'Description must only contain alphanumeric characters,'
                 . " '_' and whitespace");
    }
    $description =~ s/\n//g;

    if ($identifier !~ /$ALLOWED_FILENAME_REGEX/) {
        push(@err, "Identifier can only contain alphanumeric characters, "
                 . " '_', and '-'");
    }

    if ($mozconfig && $mozconfig !~ /$ALLOWED_FILENAME_REGEX/) {
        push(@err, 'Bad mozconfig filename. Use only alphanumeric, '
                 . '-, _, and single dots');
    }

    # Using a patchFile
    if ($type eq "patch") {
        if ($branch eq "" || $branch eq "trunk") {
            $branch = "HEAD";
        }
        # only allow alphanumeric plus '_'
        if ($branch !~ /$ALLOWED_BRANCH_REGEX/) {
            push(@err, 'Branch/Tag must only contain alphanumeric '
                     . "characters or '_'");
        }

        # only allow alphanumeric, hyphens, and single dots
        if ($patchFile !~ /$ALLOWED_FILENAME_REGEX/) {
            push(@err, 'Bad patch filename. Please use only alphanumeric, '
                     . '-, _, and single dots');
        }

        # pull all of the contents of the file
        my $patchHandle = upload('patchFile');

        # strip off everything except the filename itself
        $patchFile =~ s/.*[\/\\](.*)/$1/;

        # generate the filenames
        $patchFile = "$time-$key-$patchFile";
        $infoFile = "$patchFile.info";

        # make sure the file has a non-zero length
        # this also handles a case where the file specified doesn't exist
        if (-z $patchHandle) {
            push(@err, 'Patch file has a length of zero');
        }

        # write the patch
        my $filename = catfile($PATCH_DIR, $patchFile);
        if (! open(PATCH, ">$filename")) {
            push(@err, 'Server error - Could not open file for writing');
        }
        if (scalar(@err) > 0) {
            WritePage(patchLevel        => $patchLevel,
                      branch            => $branch,
                      identifier        => $identifier,
                      description       => $description,
                      type              => $type,
                      mozillaRepoPath   => $mozillaRepoPath,
                      tamarinRepoPath   => $tamarinRepoPath,
                      err               => \@err);
            return;
        }
        binmode(PATCH);
    
        while (<$patchHandle>) {
            print PATCH;
        }
        if (! close(PATCH)) {
            push(@err, "Server error - Could not close patchfile.");
        }
    } elsif ($type eq "hg") {
        # TODO: is this a valid way to test if there's a repo there?
        if (!get($mozillaRepoPath)) {
            push(@err, 'Mozilla repository path is not valid');
        }

        if (!get($tamarinRepoPath)) {
            push(@err, 'Tamarin repository path is not valid');
        }

        if (scalar(@err) > 0) {
            WritePage(patchLevel        => $patchLevel,
                      branch            => $branch,
                      identifier        => $identifier,
                      description       => $description,
                      type              => $type,
                      mozillaRepoPath   => $mozillaRepoPath,
                      tamarinRepoPath   => $tamarinRepoPath,
                      err               => \@err);
            return;
        }

        # generate the infofile name
        $infoFile = "$time-$key-hg.info";
    } else {
        push(@err, 'Please test a patch or a Mercurial repository.');
        WritePage(patchLevel        => $patchLevel,
                  branch            => $branch,
                  identifier        => $identifier,
                  description       => $description,
                  type              => $type,
                  mozillaRepoPath   => $mozillaRepoPath,
                  tamarinRepoPath   => $tamarinRepoPath,
                  err               => \@err);
        return;
    }
    

    my $mozconfigHandle = upload('mozconfig');
    if (! -z $mozconfigHandle) {
        $mozconfig = "$time-$key-$mozconfig";
        my $filename = catfile($PATCH_DIR, $mozconfig);
        if (! open(MOZCONFIG, ">$filename")) {
            push(@err, 'Server error - Could not open file for writing');
            WritePage(patchLevel        => $patchLevel,
                      branch            => $branch,
                      identifier        => $identifier,
                      description       => $description,
                      type              => $type,
                      mozillaRepoPath   => $mozillaRepoPath,
                      tamarinRepoPath   => $tamarinRepoPath,
                      err               => \@err);
            return;
        }
        while (<$mozconfigHandle>) {
            print MOZCONFIG;
        }
        if (! close(MOZCONFIG)) {
            push(@err, "Server error - Could not close mozconfig file");
            WritePage(patchLevel        => $patchLevel,
                      branch            => $branch,
                      identifier        => $identifier,
                      description       => $description,
                      type              => $type,
                      mozillaRepoPath   => $mozillaRepoPath,
                      tamarinRepoPath   => $tamarinRepoPath,
                      err               => \@err);
            return;
        }
    }

    # now write the infofile
    my $filename = catfile($PATCH_DIR, $infoFile);

    if (! open(INFO, ">$filename")) {
        push(@err, 'Server error - Could not open file for writing');
        WritePage(patchLevel        => $patchLevel,
                  branch            => $branch,
                  identifier        => $identifier,
                  description       => $description,
                  type              => $type,
                  mozillaRepoPath   => $mozillaRepoPath,
                  tamarinRepoPath   => $tamarinRepoPath,
                  err               => \@err);
        return;
    }

    print INFO "submitter: $name\n";
    print INFO "type: $type\n";
    if ($type eq "patch") {
        print INFO "patchFile: $patchFile\n";
        print INFO "patchLevel: $patchLevel\n";
        print INFO "branch: $branch\n";
    } elsif ($type eq "hg") {
        print INFO "mozillaRepoPath: $mozillaRepoPath\n";
        print INFO "tamarinRepoPath: $tamarinRepoPath\n";
    } else {
        push(@err, 'Please test a patch or a Mercurial repository.');
        WritePage(patchLevel        => $patchLevel,
                  branch            => $branch,
                  identifier        => $identifier,
                  description       => $description,
                  type              => $type,
                  mozillaRepoPath   => $mozillaRepoPath,
                  tamarinRepoPath   => $tamarinRepoPath,
                  err               => \@err);
        return;
    }
    print INFO "identifier: $identifier\n";
    print INFO "mozconfig: $mozconfig\n";
    print INFO "description: $description\n";

    if (! close(INFO)) {
        push(@err, "Could not close info file.");
        WritePage(patchLevel        => $patchLevel,
                  branch            => $branch,
                  identifier        => $identifier,
                  description       => $description,
                  type              => $type,
                  mozillaRepoPath   => $mozillaRepoPath,
                  tamarinRepoPath   => $tamarinRepoPath,
                  err               => \@err);
        return;
    }

    WriteSuccessPage();
}

if (param()) {
    Process();
} else {
    WritePage();
}
