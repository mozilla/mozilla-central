#!/usr/bin/perl
# vim:sw=4:ts=4:noet:ai:
#
# Copy an RCS file, but remove all the tags.
# copyright (c) L. David Baron, 2004-12-06
#
# Use at your own risk.
#

use strict;
use File::Basename;

my $debug = 0;

$#ARGV == 1 || $#ARGV == 2 || die "Two arguments expected.";
my $opts = '';
if ($ARGV[0] =~ /^-/) {
    $opts = shift @ARGV;
}

$debug = ($opts =~ /d/);

my $srcfile = $ARGV[0];
my $destfile = $ARGV[1];
my $atticfile = dirname($destfile) . "/Attic/" . basename($destfile);

-f $srcfile || die "$srcfile does not exist or is not a file\n";
-e $destfile && die "$destfile already exists\n";
-e $atticfile && die "$atticfile already exists\n";
-d dirname($destfile) || warn "destination directory " . dirname($destfile) . " does not exist, will be created\n";

# if dry run, quit now after verifying move is possible
if ($opts =~ /n/) { exit }

my ($dev,$ino,$mode,$nlink,$uid,$gid,$rdev,$size,
    $atime,$mtime,$ctime,$blksize,$blocks) = stat("$srcfile");

my $text;

{
	open(INPUT, "<$srcfile") || die "Could not open $srcfile";
	local $/;
	$text = <INPUT>;
	close(INPUT);
}

$text =~ s/symbols[^;]*;/symbols;/;

system("mkdir","-p","-m2775",dirname($destfile));

open(OUTPUT, ">$destfile") || die "Could not open $destfile";
print OUTPUT $text;
close(OUTPUT);

chmod($mode & 07777, $destfile)
	|| print STDERR "Warning: could not chmod $destfile\n";
chown($uid, $gid, $destfile)
	|| print STDERR "Warning: could not chown $destfile\n";

$text = `rlog '$destfile' | egrep '^branches: .+;'`;
$text =~ s/branches://gs;
$text =~ s/\s+//gs;
$text =~ s/;$//;
print "branchlist = $text\n" if $debug;

sub numdots {
    # count the number of dots in a branch/rev number
	return scalar(my @foo = $_[0] =~ m/\./g);
}

my @branches = split(';',$text);
# sort by the number of dots in the branch ID...  deeper branches get nuked first
@branches = reverse sort { numdots($a) <=> numdots($b) } @branches;
foreach my $branch (@branches) {
    print "Deleting branch $branch...\n" if $debug;
    do {
	    $text = `rcs -o$branch $destfile 2>&1`;
		print $text if $debug;
	} while ($text =~ /deleting revision/);
}

