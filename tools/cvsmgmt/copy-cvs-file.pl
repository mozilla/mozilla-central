#!/usr/bin/perl
# vim:sw=4:ts=4:noet:ai:
#
# Copy an RCS file, but remove all the tags and reset the revision dates.
# copyright (c) L. David Baron, 2004-12-06
#
# Contributor(s):
#   Chase Phillips <chase@mozilla.org>
#
# Use at your own risk.
#
# Wishlist:
#
#   * Create a null-change revision in the ,v file that has a description of
#     the move, including date moved, the original location, and the real
#     dates of each of the file's revisions on the trunk. (chase)
#
#   * Place the CVS management utilities under CVS revision control. (chase)
#
# Useful References:
#
#   "Open Source Development With CVS - RCS Format"
#   http://computing.ee.ethz.ch/sepp/cvs-1.10-to/cvsbook/main_53.html
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

my $current_date; # Global, stores the current date set by calling a helper.

# if dry run, quit now after verifying move is possible
if ($opts =~ /n/) { exit }

my @stats = stat($srcfile);

copy_file( src => $srcfile, dest => $destfile );
remove_symbols( file => $destfile );
remove_branches( file => $destfile );
rewrite_dates( file => $destfile );
set_file_permissions( file => $destfile, stats => \@stats );

exit;

#-------------------------------------------------------------------------------

sub numdots {
  # count the number of dots in a branch/rev number
  return scalar(my @foo = $_[0] =~ m/\./g);
}

sub copy_file {
  my %args = @_;

  my $destfile = $args{'dest'};
  my $srcfile = $args{'src'};

  system("mkdir","-p","-m2775",dirname($destfile));
  system("cp",$srcfile,$destfile);
  chmod(0600,$destfile)
    || print STDERR "Warning: could not chmod $destfile\n";
}

sub set_file_permissions {
  my %args = @_;

  my $file = $args{'file'};
  my @stats = @{$args{'stats'}};

  my $mode = $stats[2];
  my $uid = $stats[4];
  my $gid = $stats[5];

  chmod($mode & 07777, $file)
    || print STDERR "Warning: could not chmod $file\n";
  chown($uid, $gid, $file)
    || print STDERR "Warning: could not chown $file\n";
}

sub remove_symbols {
  my %args = @_;

  my $file = $args{'file'};
  my $text;

  {
    local $/;

    open(INPUT, "<$file") || die "Could not open $file for reading";
    $text = <INPUT>;
    close(INPUT);
  }

  $text =~ s/symbols[^;]*;/symbols;/;

  open(OUTPUT, ">$file") || die "Could not open $file for writing";
  print OUTPUT $text;
  close(OUTPUT);
}

sub remove_branches {
  my %args = @_;

  my $destfile = $args{'file'};

  my $text = `rlog '$destfile' | egrep '^branches: .+;'`;
  $text =~ s/branches://gs;
  $text =~ s/\s+//gs;
  $text =~ s/;$//;
  print "branchlist = $text\n" if $debug;

  my @branches = split(';',$text);
  # sort by the number of dots in the branch ID...  deeper branches get nuked
  # first
  @branches = reverse sort { numdots($a) <=> numdots($b) } @branches;
  foreach my $branch (@branches) {
    print "Deleting branch $branch...\n" if $debug;
    do {
      $text = `rcs -o$branch $destfile 2>&1`;
      print $text if $debug;
    } while ($text =~ /deleting revision/);
  }
}

sub set_starting_date {
  $current_date = time();
}

sub get_next_cvs_formatted_date {
  # Decrement current date.
  $current_date--;

  my @time_result = gmtime($current_date);

  my $year = $time_result[5] + 1900;
  my $month = $time_result[4] + 1;
  my $day = $time_result[3];
  my $hour = $time_result[2];
  my $minute = $time_result[1];
  my $second = $time_result[0];

  sprintf("%04d.%02d.%02d.%02d.%02d.%02d",
          $year, $month, $day, $hour, $minute, $second);
}

sub rewrite_dates {
  my %args = @_;

  my $file = $args{'file'};
  my $tempfile = $file . $$;

  if ( ! -r $file ) {
    die "ERROR: Source file '$file' can not be read!";
  }

  my $mode = "before-rev-info";
  set_starting_date();

  open(INPUT, "<$file");
  open(OUTPUT, ">$tempfile");
  LOOP: while ( <INPUT> ) {
    if ( $_ =~ /^comment[\s\t]+@.*@;$/
         and $mode =~ /^before-rev-info$/ ) {
      $mode = "during-rev-info";
      print OUTPUT $_;
      next LOOP;
    }

    if ( $_ =~ /^desc$/ 
         and $mode =~ /^during-rev-info$/ ) {
      $mode = "after-rev-info";
      print OUTPUT $_;
      next LOOP;
    }

    # If we're in the revision metadata info section, maybe do a search and
    # replace on the current line.
    if ( $mode =~ /^during-rev-info$/ ) {
      $_ = process_rev_info(line => $_);
    }

    print OUTPUT $_;
  }
  close(OUTPUT);
  close(INPUT);

  # Move the temporary file into the main file.
  system("mv", "-f", $tempfile, $file);
}

sub process_rev_info {
  my %args = @_;
  my $line = $args{'line'};

  if ( $line =~ /^date[\s\t]+/ ) {
    my $date = get_next_cvs_formatted_date();
    $line =~ s/^(date[\s\t]+)\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{2}/$1$date/;
  }

  return $line;
}
