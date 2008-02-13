#!perl
#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
# The Original Code is Sun Microsystems code.
#
# The Initial Developer of the Original Code is
# Sun Microsystems, Inc.
# Portions created by the Initial Developer are Copyright (C) 2008
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   ause <ause@sun.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

usage() if $#ARGV != 1;

# files to check but ignore...
my @exceptions = ( "components/autocomplete.xpt" );

my $filelist = $ARGV[0];
open FILELIST,"$filelist" or die "can not open $filelist\n";
my @rmfiles = <FILELIST>;
close FILELIST or die "can not close $filelist\n";
chomp @rmfilelist;

my $startdir = $ARGV[1];

die "no such directory: $startdir\n" if ! -d $startdir;

my $probsfound = 0;
my @foundlist = ();

foreach my $onefile ( @rmfiles ) {
    my $ignore = 0;
	chomp $onefile;
    foreach my $ignoreme ( @exceptions ) {
        $ignore = 1 if "$onefile" eq "$ignoreme";
    }
    next if $ignore;
	if ( -f "$startdir/$onefile" ) {
#		print "found $startdir/$onefile\n";
		push @foundlist, "$startdir/$onefile\n";
		$probsfound = 1;
	}
}

if ( $probsfound ) {
	print STDERR "ERROR: files found that are listed in \"$filelist\" but exist in \"$startdir\":\n";
	print STDERR "@foundlist\n";
	exit 2;
}

sub usage
{
	print STDERR "\nusage: $0 <remove-files list> <lookup dir>\n\n";
	exit 1;
}
