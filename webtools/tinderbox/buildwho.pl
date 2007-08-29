#!/usr/bin/perl --
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
# The Original Code is the Tinderbox build tool.
#
# The Initial Developer of the Original Code is Netscape Communications
# Corporation. Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation. All
# Rights Reserved.
#
# Contributor(s): 

use strict;
use File::Copy 'move';

use lib "@TINDERBOX_DIR@";
require 'tbglobals.pl';
my $F_DEBUG=0;

$ENV{'PATH'} = "@SETUID_PATH@";

# Process args:
#   $days: How many days of data to process.
#   $tree: Which tree to use.
my $days = undef;
my $tree = undef;

if ($ARGV[0] eq '-days') {
    shift;
    $days = &trick_taint(shift);
}
$tree = &trick_taint(shift);

&usage() if (!defined($tree));

# Grab treedata
#   $who_days:    Number of days of commit info to make available
#   $cvs_module:  The checkout module
#   $cvs_branch:  The current branch
#   $cvs_root:    The path to the cvs root
#   $viewvc_repository: Repository path used by viewvc for this tree
&tb_load_treedata($tree);
my $use_bonsai = $::global_treedata->{$tree}->{use_bonsai};
my $use_viewvc = $::global_treedata->{$tree}->{use_viewvc};
my $cvs_module = $::global_treedata->{$tree}->{cvs_module};
my $cvs_branch = $::global_treedata->{$tree}->{cvs_branch};
my $cvs_root = $::global_treedata->{$tree}->{cvs_root};
my $viewvc_repository = $::global_treedata->{$tree}->{viewvc_repository};

$days = $::global_treedata->{$tree}->{who_days} if (!defined($days));

# Exit early if no query system is enabled
exit 0 if (!$use_bonsai && !$use_viewvc);

# Only allow one process at a time to re-write "who.dat".
#
my $lockfile = "$tree/buildwho.sem";
my $lock = lock_datafile($lockfile);

if ($use_bonsai) {
    $::CVS_ROOT = $cvs_root;
}

require 'cvsquery.pl';

build_who($tree);

unlock_datafile($lock);
unlink($lockfile);
# End of main
##################################################################
sub usage() {
    print "Usage: $0 [-days days_of_commitinfo] treename\n";
    exit 1;
}

sub build_who {
    my ($tree) = @_;
    my $result = undef;
    $::query_date_min = time - (60 * 60 * 24 * $days);

    print "Minimum date: $::query_date_min\n" if $F_DEBUG;

    if ($use_viewvc) {
        $::query_module=$viewvc_repository;
        $result = query_checkins_viewvc($tree);
    } elsif ($use_bonsai) {
        $::query_module=$cvs_module;
        $::query_branch=$cvs_branch;
        $::query_branchtype='regexp' if $::query_branch =~ /\*|\?|\+/;
        $::query_branch_head=1 if $::query_branch eq 'HEAD';
        $result = query_checkins_bonsai($tree);
    } else {
        # Should never reach this
        return;
    }

    my $last_who='';
    my $last_date=0;
    my $who_file = "$tree/who.dat";
    my $temp_who_file = "$who_file.$$";
    open(WHOLOG, ">", "$temp_who_file");
    for my $ci (@$result) {
        if ($ci->[$::CI_DATE] != $last_date or $ci->[$::CI_WHO] ne $last_who) {
            print WHOLOG "$ci->[$::CI_DATE]|$ci->[$::CI_WHO]\n";
        }
        $last_who=$ci->[$::CI_WHO];
        $last_date=$ci->[$::CI_DATE];
    }
    close (WHOLOG);
    move($temp_who_file, $who_file);
}
