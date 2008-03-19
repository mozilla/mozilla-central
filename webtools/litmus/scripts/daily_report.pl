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
GetOptions('help|?' => \$help,'html' => \$html_mail);

if ($help) {
  &usage;
  exit;
}

my ($sql,$sth);

$sql= qq{
SELECT tr.testresult_id, pr.name AS product, br.name AS branch, pl.name AS platform, o.name AS opsys, u.email, tc.summary
FROM test_results tr, platforms pl, opsyses o, products pr, branches br, users u, testcases tc
WHERE tr.result_status_id=2 AND
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
$sth->execute();
my @failed_results;
while (my $hashref = $sth->fetchrow_hashref) {
  $hashref->{'branch'} =~ s/ Branch//;
  push @failed_results, $hashref;
}
$sth->finish;

if (scalar @failed_results > 0) {
  if ($html_mail) {
    &send_html_mail(\@failed_results);
  } else {
    &send_plaintext_mail(\@failed_results);
  }
} else {
  # No Results today.
}

exit;

#########################################################################
sub usage {
  print "\nUsage: daily_report.pl [--html]\n\n";
}

#########################################################################
sub message_header {
  my $today = &UnixDate("today","%Y/%m/%d");
  my $subject = "[litmus] Daily Report - $today";
  my $header .= "Subject: $subject\n";
  $header .= "Content-Type: text/html\n";
  $header .= "To: " . join(',',@Litmus::Config::nightly_report_recipients) . "\n\n";

  return $header;
}

#########################################################################
sub send_plaintext_mail(\@) {
  my ($failed_results) = @_;

  my $message = &message_header();
  $message .= "Failed results submitted to Litmus in the past day:\n\n";
  
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
  
  $message .= "$header\n";
  
  foreach my $hashref (@$failed_results) {
    my $result_link = sprintf("<a href=\"http://litmus.mozilla.org/single_result.cgi?id=%d\">%-8d</a>",
			      $hashref->{'testresult_id'},
      			      $hashref->{'testresult_id'}
			     );
    $message .= $result_link;
    
    my $result = sprintf(
                         " %-8.8s %-6.6s %-8.8s %-8.8s %-15.15s %-20.20s",
			 $hashref->{'product'},
			 $hashref->{'branch'},
			 $hashref->{'platform'},
			 $hashref->{'opsys'},
			 $hashref->{'email'},
			 $hashref->{'summary'}			   
			);
    $message .= "$result\n";
  }

  $message .= "\n";
  $message .= "Visit Litmus: <a href=\"http:/litmus.mozilla.org/\">http:/litmus.mozilla.org/</a>\n\n";

  my $rv = sendMessage($message);
  if (!$rv) {
    warn('[litmus] FAIL - Unable to send daily report');
  }  
}

#########################################################################
sub send_html_mail(\@) {
  my ($failed_results) = @_;

  my $message = &message_header();

  $message .= '
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" />
<title>Failed results submitted to Litmus in the past day</title>
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

<h1>Failed results submitted to Litmus in the past day:</h1>

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
  foreach my $hashref (@$failed_results) {
    if ($class eq 'odd') {
      $class = 'even';
    } else {
      $class = 'odd';
    }
    $message .= '<tr class="' . $class . '">' . "\n";
    $message .= '<td align="center"><a href="http://litmus.mozilla.org/single_result.cgi?id=' .
                $hashref->{'testresult_id'} . '">' .
                $hashref->{'testresult_id'} . "</a></td>\n";
    
    $message .= '<td align="center">' . $hashref->{'product'} . "</td>\n";
    $message .= '<td align="center">' . $hashref->{'branch'} . "</td>\n";
    $message .= '<td align="center">' . $hashref->{'platform'} . "</td>\n";
    $message .= '<td align="center">' . $hashref->{'opsys'} . "</td>\n";
    $message .= '<td align="center">' . $hashref->{'email'} . "</td>\n";
    $message .= '<td>' . $hashref->{'summary'} . "</td>\n";	   

    $message .= "</tr>\n";
  }

  $message .= "</table>\n";
  $message .= "<p>Visit Litmus: <a href=\"http:/litmus.mozilla.org/\">http:/litmus.mozilla.org/</a></p>\n";

  $message .= "</body>\n</html>\n\n";

  my $rv = sendMessage($message);
  if (!$rv) {
    warn('[litmus] FAIL - Unable to send daily report');
  } 

}
