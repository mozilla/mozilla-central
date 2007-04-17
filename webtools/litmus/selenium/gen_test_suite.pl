#!/usr/bin/perl -Tw
use strict;
$|++;

use Data::Dumper;

my $testcase_dir = "./testcases";
opendir(TESTCASEDIR, $testcase_dir) or die;
my @testcases = grep { !/^\./ && !/~$/ && -f "$testcase_dir/$_" } readdir(TESTCASEDIR);
closedir(TESTCASEDIR);

my $title = "Selenium test suite for Litmus";

print<<EOS;
<html>
<head>
<title>$title</title>
</head>

<body>
<table>
<tr>
<td>$title</td>
</tr>
EOS

for my $testcase (@testcases) {
  print "<tr>\n";
  print "<td><a target=\"testFrame\" href=\"testcases/$testcase\">";
  open(TESTCASE, "$testcase_dir/$testcase") or die;
  while (<TESTCASE>) {
    if (/^<tr><td rowspan=\"1\" colspan=\"3\">(.*)<\/td><\/tr>/) {
      print $1;
      last;
    }
  }
  close(TESTCASE);
  print "</a></td>\n";
  print "</tr>\n";
}

print<<EOS;
</table>

</body>
</html>
EOS
