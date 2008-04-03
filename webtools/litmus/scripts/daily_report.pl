#!/usr/bin/perl -w
# -*- mode: cperl; c-basic-offset: 8; indent-tabs-mode: nil; -*-

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
# The Original Code is Litmus.
#
# The Initial Developer of the Original Code is
# the Mozilla Corporation.
# Portions created by the Initial Developer are Copyright (C) 2006
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Chris Cooper <ccooper@deadsquid.com>
#
# ***** END LICENSE BLOCK *****

use strict;
$|++;

use lib qw(..);

use Date::Manip;
use Getopt::Long;
use Litmus::DBI;
use Litmus::Config;
use Litmus::Mailer qw( sendMessage );
use Litmus::DB::Testcase;

use vars qw(
	    $litmus_dbh
	    );

END {
  if ($litmus_dbh) { 
    $litmus_dbh->disconnect; 
  }
}

$litmus_dbh = Litmus::DBI->db_ReadOnly() or die;

my $help;
my $html_mail;
my $batch;
GetOptions('help|?' => \$help,'html' => \$html_mail,'batch' => \$batch);

if ($help) {
  &usage;
  exit;
}

my ($sql,$sth);

$sql= qq{
SELECT tr.testresult_id, pr.name AS product, br.name AS branch, pl.name AS platform, o.name AS opsys, u.email, tc.summary
FROM test_results tr, platforms pl, opsyses o, products pr, branches br, users u, testcases tc
WHERE tr.result_status_id=? AND
tr.valid=1 AND
tr.submission_time>=DATE_SUB(NOW(), INTERVAL 1 DAY) AND
tr.testcase_id=tc.testcase_id AND
tr.branch_id=br.branch_id AND
tr.opsys_id=o.opsys_id AND
pl.platform_id=o.platform_id AND
tc.product_id=pr.product_id AND
tr.user_id=u.user_id AND
(pr.product_id = 1 OR pr.product_id=3)
ORDER BY pr.name ASC, br.name ASC, pl.name ASC, o.name ASC;
};

$sth = $litmus_dbh->prepare($sql);
$sth->execute(2);
my @failed_results;
while (my $hashref = $sth->fetchrow_hashref) {
  $hashref->{'branch'} =~ s/ Branch//;
  push @failed_results, $hashref;
}

my $combined_message_body = "";

my $failed_results_message_body = "";
if (scalar @failed_results > 0) {
  $failed_results_message_body  = &format_results(\@failed_results, 'Failed', $html_mail);
} else {
  # No Failed Results today.
}

if ($failed_results_message_body ne "") {
  if (!$batch) {
    my $title = 'Failed results submitted to Litmus in the past day';
    my $rv = &create_and_send_message($title,
				      $failed_results_message_body,
				      $html_mail);
  } else {
    $combined_message_body .= $failed_results_message_body;
  }
}

$sth->execute(3);
my @unclear_results;
while (my $hashref = $sth->fetchrow_hashref) {
  $hashref->{'branch'} =~ s/ Branch//;
  push @unclear_results, $hashref;
}
$sth->finish;

my $unclear_results_message_body = "";
if (scalar @unclear_results > 0) {
  $unclear_results_message_body  = &format_results(\@unclear_results, 'Unclear', $html_mail);
} else {
  # No Unclear Results today.
}

if ($unclear_results_message_body ne "") {
  if (!$batch) {
    my $title = 'Unclear results submitted to Litmus in the past day';
    my $rv = &create_and_send_message($title,
	  			      $unclear_results_message_body,
	 			      $html_mail);
  } else {
    $combined_message_body .= $unclear_results_message_body;
  }
}

my $match_limit = 100;

my @added_testcases = Litmus::DB::Testcase->getNewTestcases(
                                                             1,
                                                             $match_limit
                                                            );

my $added_testcases_message_body = "";
if (scalar @added_testcases > 0) {
  $added_testcases_message_body  = &format_testcases(\@added_testcases, 'Added to', $html_mail);
} else {
  # No testcases added today.
}

if ($added_testcases_message_body ne "") {
  if (!$batch) {
    my $title = 'Testcases added to Litmus in the past day';
    my $rv = &create_and_send_message($title,
	  			      $added_testcases_message_body,
	 			      $html_mail);
  } else {
    $combined_message_body .= $added_testcases_message_body;
  }
}

my @changed_testcases = Litmus::DB::Testcase->getRecentlyUpdated(
                                                                 1,
                                                                 $match_limit
                                                                );

my $changed_testcases_message_body = "";
if (scalar @changed_testcases > 0) {
  $changed_testcases_message_body  = &format_testcases(\@changed_testcases, 'Changed in', $html_mail);
} else {
  # No testcases added today.
}

if ($changed_testcases_message_body ne "") {
  if (!$batch) {
    my $title = 'Testcases changed in Litmus in the past day';
    my $rv = &create_and_send_message($title,
	  			      $changed_testcases_message_body,
	 			      $html_mail);
  } else {
    $combined_message_body .= $changed_testcases_message_body;
  }
}

if ($batch and $combined_message_body ne "") {
  my $title = '';
  my $rv = &create_and_send_message($title,
                                    $combined_message_body,
                                    $html_mail);
}

exit;

#########################################################################
sub usage {
  print "\nUsage: daily_report.pl [--html]\n\n";
}

#########################################################################
sub message_header($$) {
  my ($title,$html_mail) = @_;
  my $today = &UnixDate("today","%Y/%m/%d");
  my $subject = "[litmus] Daily Report";
  if ($title) {
    $subject .= " - $title";
  }
  $subject .= " - $today";
  my $header .= "Subject: $subject\n";
  $header .= "Content-Type: text/html\n";
  $header .= "To: " . join(',',@Litmus::Config::nightly_report_recipients) . "\n\n";

  if ($html_mail) {
    $header .= '
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" />
<title>';
    $header .= $subject;
    $header .= '</title>
</head>
<style type="text/css">
body {
    margin: 0 30px 2em 30px;
    color: #333333;
    font-size: 65%;
}

body, td, th, h3, input, pre { /* redundant rules for bad browsers  */
    font-family: verdana, sans-serif;
    voice-family: "\"}\"";
    voice-family: inherit;
}

h1 {
    text-align: left;
    padding-top: 5px;
    border-bottom: none;
    MARGIN-Top: 0;
    font-size: 1.4em;
    line-height: 1.0em;
    text-transform: lowercase; 
}

th {
    vertical-align: middle;
    background: #dddddd;
    border: solid #bbbbbb 1px;
    font-weight: bold;
    text-transform: lowercase; 
    text-align: center;
    color: #666666;
    padding: 0px 5px 0px 5px;
    font-size: .75em;
}

td {
    font-size: .75em;
    border:1px solid #BBBBBB;
    margin: 0px;
    padding: 3px 5px;
    vertical-align: top;
}

.odd {
    background-color: #eeeeee;
}
.even {
    background-color: #ffffff;
}

</style>

<body>
';
  }
  return $header;
}

#########################################################################
sub message_footer($) {
  my ($html_mail) = @_;
  
  my $footer = "";
  if ($html_mail) { 
    $footer  = "<p>Visit Litmus: <a href=\"http:/litmus.mozilla.org/\">http:/litmus.mozilla.org/</a></p>\n";
    $footer .= "</body>\n</html>\n\n";
  } else {
    $footer = "Visit Litmus: <a href=\"http:/litmus.mozilla.org/\">http:/litmus.mozilla.org/</a>\n\n";
  }

  return $footer;
}

#########################################################################
sub format_results(\@$$) {
  my ($results, $result_type, $html_mail) = @_;

  my $formatted_results = "";
  if ($html_mail) {
    $formatted_results = "<h1>${result_type} results submitted to Litmus in the past day:</h1>";
    $formatted_results .= '
<table cellpadding="0" cellspacing="0" width="620" class="body">
<tr>
<th>ID</th>
<th>Product</th>
<th>Branch</th>
<th>Platform</th>
<th>Opsys</th>
<th>Tester</th>
<th>Testcase Summary</th>
</tr>
';

    my $class='odd';
    foreach my $hashref (@$results) {
      if ($class eq 'odd') {
        $class = 'even';
      } else {
        $class = 'odd';
      }
      $formatted_results .= '<tr class="' . $class . '">' . "\n";
      $formatted_results .= '<td align="center"><a href="http://litmus.mozilla.org/single_result.cgi?id=' .
                  $hashref->{'testresult_id'} . '">' .
                  $hashref->{'testresult_id'} . "</a></td>\n";
    
      $formatted_results .= '<td align="center">' . $hashref->{'product'} . "</td>\n";
      $formatted_results .= '<td align="center">' . $hashref->{'branch'} . "</td>\n";
      $formatted_results .= '<td align="center">' . $hashref->{'platform'} . "</td>\n";
      $formatted_results .= '<td align="center">' . $hashref->{'opsys'} . "</td>\n";
      $formatted_results .= '<td align="center">' . $hashref->{'email'} . "</td>\n";
      $formatted_results .= '<td>' . $hashref->{'summary'} . "</td>\n";	   

      $formatted_results .= "</tr>\n";
    }
    $formatted_results .= "</table>\n<br/>\n";

  } else {
    $formatted_results .= "${result_type} results submitted to Litmus in the past day:\n\n";
  
    my $header = sprintf(
                         "%-8s %-8s %-6s %-8s %-8s %-15s %-20s",
                         "ID",
			 "Product",
			 "Branch",
			 "Platform",
			 "Opsys",
			 "Tester",
			 "Testcase Summary"
		        );
  
    $formatted_results .= "$header\n";
  
    foreach my $hashref (@$results) {
      my $result_link = sprintf("<a href=\"http://litmus.mozilla.org/single_result.cgi?id=%d\">%-8d</a>",
	  		        $hashref->{'testresult_id'},
      			        $hashref->{'testresult_id'}
			       );
      $formatted_results .= $result_link;
    
      my $result = sprintf(
                           " %-8.8s %-6.6s %-8.8s %-8.8s %-15.15s %-20.20s",
			   $hashref->{'product'},
			   $hashref->{'branch'},
			   $hashref->{'platform'},
			   $hashref->{'opsys'},
			   $hashref->{'email'},
			   $hashref->{'summary'}			   
			 );
      $formatted_results .= "$result\n";
    }
    $formatted_results .= "\n\n";
  }
  return $formatted_results;
}

########################################################################
sub format_testcases(\@$$) {
  my ($testcases, $testcase_type, $html_mail) = @_;

  my $formatted_testcases = "";

  if ($html_mail) {
    $formatted_testcases = "<h1>Testcases $testcase_type Litmus in the past day:</h1>";
    $formatted_testcases .= '
<table cellpadding="0" cellspacing="0" width="620" class="body">
<tr>
<th>ID</th>
<th>Summary</th>
</tr>
';
    my $class='odd';
    foreach my $hashref (@$testcases) {
      if ($class eq 'odd') {
        $class = 'even';
      } else {
        $class = 'odd';
      }
      $formatted_testcases .= '<tr class="' . $class . '">' . "\n";
      $formatted_testcases .= '<td align="center"><a href="https://litmus.mozilla.org/show_test.cgi?id=' .
                  $hashref->{'testcase_id'} . '">' .
                  $hashref->{'testcase_id'} . "</a></td>\n";
    
      $formatted_testcases .= '<td align="center">' . $hashref->{'summary'} . "</td>\n";
      $formatted_testcases .= "</tr>\n";
    }
    $formatted_testcases .= "</table>\n<br/>\n";

  } else {
    $formatted_testcases .= "${testcase_type} Litmus in the past day:\n\n";
  
    my $header = sprintf(
                         "%-8s %-20s",
                         "ID",
			 "Summary"
		        );
  
    $formatted_testcases .= "$header\n";
  
    foreach my $hashref (@$testcases) {
      my $result_link = sprintf("<a href=\"http://litmus.mozilla.org/show_test.cgi?id=%d\">%-8d</a>",
	  		        $hashref->{'testcase_id'},
      			        $hashref->{'testcase_id'}
			       );
      $formatted_testcases .= $result_link;
    
      my $testcase = sprintf(
                             " %-20.20s",
                             $hashref->{'summary'}			   
			    );
      $formatted_testcases .= "$testcase\n";
    }
    $formatted_testcases .= "\n\n";
  }

  return $formatted_testcases;
}

#########################################################################
sub create_and_send_message($$$) {
  my($title,$message_body,$html_mail) = @_;
  my $message_header = &message_header($title, $html_mail);
  my $message_footer = &message_footer($html_mail);
 
  my $message = $message_header . $message_body . $message_footer;

  my $rv = sendMessage($message);
  if (!$rv) {
    warn('[litmus] FAIL - Unable to send daily report - ' . $title);
  }  

  return $rv;
}
