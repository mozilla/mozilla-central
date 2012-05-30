#!perl
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

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
