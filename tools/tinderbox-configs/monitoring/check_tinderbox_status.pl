#! /usr/bin/perl -w

use strict;
use LWP::UserAgent;
use Getopt::Std;

my (@tbox_status, $state, @crit_tboxes, $tbox, $purpose, $parent, 
    $tbox_time, $parent_tbox_time, @status_lines);
my (%options, $content, $response, $tree_name, $url, $ua, $current_time, 
    $grace);

my %ERRORS = ('UNKNOWN' , '-1',
              'OK' , '0',
              'WARNING', '1',
              'CRITICAL', '2');

$state = 'UNKNOWN';
@crit_tboxes = ();

sub get_unix_time ($);

$ua = LWP::UserAgent->new;
$ua->timeout(10);

getopts ("dt:", \%options);

$grace = 14400; #4 hours
$current_time = time ();

die "Pass in the file name as argument to -t\n" 
    unless defined ($options{'t'});

#extract the tree name from the -t option
$tree_name = $options{'t'};
$tree_name =~ s/[^_]*_(.*)\..*/$1/;
$url = 'http://tinderbox.mozilla.org/' . $tree_name . '/quickparse.txt';
$response = $ua->get ($url);

if ($response->is_success ()) {
    $content = $response->content ();
    # Filter out the lines with open or closed at the end, they indicate 
    # tree status
    $content =~ s/.*(open|closed)$//mg;
    @tbox_status = split "\n", $content;
} else {
    die "Could not fetch $url\n";
}

if (defined $options{'d'}) {
    foreach (@tbox_status) {
        print "QUICKPARSE: $_\n";
    }
}

open (TBOX_LIST, "< $options{'t'}") or
  die "Could not open $options{'t'}: $!\n";

  while (<TBOX_LIST>) {
      #
      # the file should contain text like this
      #
      #  argo-vm|Depend
      #  bl-bldlnx01|test perf|argo-vm
      #  bl-bldxp01|perf test|fx-linux-tbox
      #  bm-xserve08|Depend
      #  fxdbug-linux-tbox|Depend
      #  fx-win32-tbox|Depend
      #
      # the first part is the name of the tinderbox
      # the second part is the purpose of that tinderbox
      # either build or test
      #
      chomp;
      if (/^([^|#]+?)\|([^|]+)\|?([^|]*?)$/) {
          $tbox = $1;
          $purpose = $2;
          $parent = $3;
          print "$tbox -- $purpose -- $parent\n" if defined $options{'d'};
      } else {
          next;
      }


      # Find line in Quickparse.txt corresponding to this tinderbox
      print "Looking for tinderbox $tbox - " if defined $options{'d'};
      @status_lines = grep (/$tbox.+$purpose/, @tbox_status);

      # Get the tinderbox timestamp if possible
      if ((scalar (@status_lines)) == 1) {
          $tbox_time = get_unix_time($status_lines[0]);
          if (defined ($tbox_time)) {
              print " $tbox_time\n"  if defined $options{'d'};
          } else {
              print " could not parse $status_lines[0]\n" 
              if defined $options{'d'};
              push @crit_tboxes, "$tbox -> $purpose";
              next;
          }
      } else {
          print " missing. @status_lines\n" if defined $options{'d'};
          push @crit_tboxes, "$tbox -> $purpose";
          next;
      }


      # If a test box, check timestamp against parent, otherwise check
      # against current time
      if ($purpose =~ /(.*?)test/) {
          # Figure out the timestamp of the parent
          @status_lines = grep (/$parent/ && !/test/, @tbox_status);
          $parent_tbox_time = get_unix_time ($status_lines[0]);
          if (defined ($parent_tbox_time)) {
              print "    Parent Timestamp: $parent_tbox_time\n" 
                if defined $options {'d'};
          } else {
              print " could not parse $status_lines[0]\n" 
                if defined $options{'d'};
              push @crit_tboxes, "$tbox -> $purpose";
              next;
          }

          if (($tbox_time - $parent_tbox_time) < $grace ) {
              # Everything is ok if the test is less than 4
              # hours older than its parent
              next;
          } else {
              push @crit_tboxes, "$tbox -> $purpose";
              next;
          }
      } else {
          if ($current_time - $tbox_time < $grace ) {
              next;
          } else {
              push @crit_tboxes, "$tbox -> $purpose";
              next;
          }
      }
  }

if (@crit_tboxes) {
    $state = 'CRITICAL';
    print "$state: missing " . join (', ', @crit_tboxes) . "\n";
} else {
    $state = 'OK';
    print "$state: All tboxes okay\n";
}

exit $ERRORS{$state};

sub get_unix_time ($) {
    my $line = shift;
    if ($line =~ m/.*\|(\d+)\|/) {
        return "$1";
    } else {
        return undef;
    }
}
