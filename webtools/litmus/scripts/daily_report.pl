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

$litmus_dbh = Litmus::DBI->db_Main() or die;

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
  my $today = &UnixDate("today","%Y/%m/%d");
  my $subject = "[litmus] Daily Report - $today";
  my @recipients = ('ccooper@deadsquid.com');
  my $message = "Content-type: text/html\n";
  $message .= "Subject: $subject\n";
  $message .= "To: " . join(',',@Litmus::Config::nightly_report_recipients) . "\n\n";
  $message .= "<html>\n<head>\n<title>$subject</title>\n</head>\n<body>\n<pre>\n";

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
  
  foreach my $hashref (@failed_results) {
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

  $message .= "</body>\n</html>\n";

  my $rv = sendMessage($message);
  if (!$rv) {
    warn('[litmus] FAIL - Unable to send daily report');
  }
} else {
  # No Results today.
}

exit;
