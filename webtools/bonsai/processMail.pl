#!/usr/bin/perl -w
# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Netscape Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/NPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Bonsai CVS tool.
#
# The Initial Developer of the Original Code is Netscape Communications
# Corporation. Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation. All
# Rights Reserved.
#
# Contributor(s): 

require 'globals.pl';

use strict;
use FileHandle;
use Fcntl qw(:DEFAULT :flock);

my $bonsaidir;
my $datadir;
my $lockfile;
my $debug = 0;
my $err = 0;


# borrowed from Tinderbox to use in processMail.pl
sub lock_datafile {
    my ($file) = @_;

    my $lock_fh = new FileHandle ">>$file"
      or die "Couldn't open semaphore file, $file: $!";

    # Get an exclusive lock with a non-blocking request
    unless (flock($lock_fh, LOCK_EX|LOCK_NB)) {
        die "Lock unavailable: $!";
    }
    return $lock_fh;
}

sub unlock_datafile {
    my ($lock_fh) = @_;

    flock $lock_fh, LOCK_UN;  # Free the lock
    close $lock_fh;
}

if (($#ARGV >= 0) && (-d $ARGV[0])) {
     $bonsaidir = $ARGV[0];
} else {
    $bonsaidir = $0;
    $bonsaidir =~ s:/[^/]*$::;      # Remove last word, and slash before it.
    if (($bonsaidir eq "") || ($bonsaidir eq $0)) {
        $bonsaidir = ".";
    }
}

$datadir = $bonsaidir . "/data";
$lockfile = "$datadir/processMail.sem";

print "bonsaidir: $bonsaidir\n" if ($debug);
print "datadir:   $datadir\n" if ($debug);
print "lockfile: $lockfile\n" if ($debug);

# Acquire a lock first so that we don't step on ourselves
my $lock = lock_datafile($lockfile);

opendir(DIR, shell_escape($datadir)) or $err++;
if ($err) {
    unlock_datafile($lock);
    unlink($lockfile);
    die("Can't opendir($datadir): $!");
}

my @datafiles = sort(grep { /^bonsai\.\d+\.\d+$/ && -f "$datadir/$_" } readdir(DIR));
closedir(DIR);

print "Files: @datafiles\n" if ($debug);

for my $file (@datafiles) {
    print "processing $file\n" if ($debug);
    system("/usr/bin/perl", "-w", "addcheckin.pl",  "$datadir/$file");
    unlink("$datadir/$file");
}

unlock_datafile($lock);
unlink($lockfile);

