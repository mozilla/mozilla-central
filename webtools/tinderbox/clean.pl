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

use lib "@TINDERBOX_DIR@";
use strict;
use Getopt::Std;

my $verbose = 0;
my $tinderboxdir = "@TINDERBOX_DIR@";
chdir $tinderboxdir or die "Couldn't chdir to $tinderboxdir"; 

# tbglobals.pl must be included after chdir
# so that $::tree_dir is set correctly
require 'tbglobals.pl'; # for $gzip

our ($opt_h, $opt_v);
getopts('hv');
usage() if (defined($opt_h));
$verbose++ if (defined($opt_v));

my $days = shift;
my @trees = @ARGV;
usage() if !defined($days) || !defined(@trees);

for my $tree (@trees) {
    tb_trim_logs($tree, $days, $verbose, 0);
}

exit(0);
# end of main
######################################################################

sub usage() {
    print "Usage: $0 [-hv] days tree [tree1 .. treeN]\n";
    print "   days = number of days of builds to keep\n";
    print "   tree = name of tree to clean\n";
    exit(1);
}

