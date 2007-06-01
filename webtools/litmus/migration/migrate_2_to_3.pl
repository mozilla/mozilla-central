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
#   Zach Lipton <zach@zachlipton.com>
#
# ***** END LICENSE BLOCK *****

use strict;
$|++;

use lib qw(..);

use Getopt::Long;
use Litmus::Config;
use DBI ();

use Data::Dumper;

use vars qw(
	    $litmus_dbh
            $sql
            $sth
            $rv
	    );

END {
  if ($litmus_dbh) { 
    $litmus_dbh->disconnect; 
  }
}

$litmus_dbh = &connect_litmus() or die;

# Get 2.0 Testgroups
$sql="SELECT * from testgroups WHERE branch_id=11";
$sth = $litmus_dbh->prepare($sql);
$sth->execute();
my @testgroups2;
while (my $hashref = $sth->fetchrow_hashref) {
  push @testgroups2, $hashref;
}
$sth->finish;

# Create 3.0 testgroups, and create a mapping hash to the 2.0 testgroups. 
my $testgroup_mapping;
foreach my $testgroup (@testgroups2) {
  $rv = $litmus_dbh->do("INSERT INTO testgroups (product_id,name,enabled,branch_id) VALUES (1,?,?,15)",
                        undef,
                        $testgroup->{'name'},
                        $testgroup->{'enabled'},
                       );
  $sql="SELECT MAX(testgroup_id) FROM testgroups";
  $sth = $litmus_dbh->prepare($sql);
  $sth->execute();
  my ($new_testgroup_id) = $sth->fetchrow_array;
  $sth->finish;  
  $testgroup_mapping->{$testgroup->{'testgroup_id'}} = $new_testgroup_id;
}

# Get 2.0 subgroups.
$sql="SELECT * from subgroups WHERE branch_id=11";
$sth = $litmus_dbh->prepare($sql);
$sth->execute();
my @subgroups2;
while (my $hashref = $sth->fetchrow_hashref) {
  push @subgroups2, $hashref;
}
$sth->finish;

# Create 3.0 subgroups, and create a mapping hash to the 2.0 subgroups. 
my $subgroup_mapping;
foreach my $subgroup (@subgroups2) {
  $rv = $litmus_dbh->do("INSERT INTO subgroups (product_id,name,enabled,branch_id) VALUES (1,?,?,15)",
                        undef,
                        $subgroup->{'name'},
                        $subgroup->{'enabled'},
                       );
  $sql="SELECT MAX(subgroup_id) FROM subgroups";
  $sth = $litmus_dbh->prepare($sql);
  $sth->execute();
  my ($new_subgroup_id) = $sth->fetchrow_array;
  $sth->finish;  
  $subgroup_mapping->{$subgroup->{'subgroup_id'}} = $new_subgroup_id;
}

# Get all 2.0 testcases.
$sql="SELECT t.testcase_id,t.summary,t.details,t.community_enabled,t.format_id,t.regression_bug_id,t.steps,t.expected_results,t.author_id,t.enabled FROM testcases t WHERE t.branch_id=11";
$sth = $litmus_dbh->prepare($sql);
$sth->execute();
my @testcases2;
while (my $hashref = $sth->fetchrow_hashref) {
  push @testcases2, $hashref;
}
$sth->finish;

# Create 3.0 testcases, and create a mapping hash to the 2.0 testcases. 
my $testcase_mapping;
foreach my $testcase (@testcases2) {
  $rv = $litmus_dbh->do("INSERT INTO testcases (summary,details,community_enabled,format_id,regression_bug_id,steps,expected_results,author_id,creation_date,last_updated,version,enabled,product_id,branch_id) VALUES (?,?,?,?,?,?,?,?,NOW(),NOW(),1,?,1,15)",
                        undef,
                        $testcase->{'summary'},
                        $testcase->{'details'},
                        $testcase->{'community_enabled'},
                        $testcase->{'format_id'},
                        $testcase->{'regression_bug_id'},
                        $testcase->{'steps'},
                        $testcase->{'expected_results'},
                        $testcase->{'author_id'},
                        $testcase->{'enabled'},
                       );
  
  $sql="SELECT MAX(testcase_id) FROM testcases";
  $sth = $litmus_dbh->prepare($sql);
  $sth->execute();
  my ($new_testcase_id) = $sth->fetchrow_array;
  $sth->finish;
  $testcase_mapping->{$testcase->{'testcase_id'}} = $new_testcase_id;
}

# Propagate subgroup->testgroup relationships from 2.0 to 3.0
foreach my $subgroup2_id (keys %$subgroup_mapping) {
  $sql="SELECT testgroup_id,sort_order FROM subgroup_testgroups WHERE subgroup_id=?";
  $sth = $litmus_dbh->prepare($sql);
  $sth->execute($subgroup2_id);
  my @subgroup_testgroups;
  while (my $hashref = $sth->fetchrow_hashref) {
    push @subgroup_testgroups, $hashref;
  }
  $sth->finish;
  foreach my $hashref (@subgroup_testgroups) {
    $rv = $litmus_dbh->do("INSERT INTO subgroup_testgroups (subgroup_id,testgroup_id,sort_order) VALUES (?,?,?)",
                          undef,
                          $subgroup_mapping->{$subgroup2_id},
                          $testgroup_mapping->{$hashref->{'testgroup_id'}},
                          $hashref->{'sort_order'},
                         );
  }
}

# Propagate testcase->subgroup relationships from 2.0 to 3.0
foreach my $testcase2_id (keys %$testcase_mapping) {
  $rv = $litmus_dbh->do("INSERT INTO related_testcases (testcase_id,related_testcase_id) VALUES (?,?)",
                        undef,
                        $testcase2_id,
                        $testcase_mapping->{$testcase2_id},
                       );

  $sql="SELECT subgroup_id,sort_order FROM testcase_subgroups WHERE testcase_id=?";
  $sth = $litmus_dbh->prepare($sql);
  $sth->execute($testcase2_id);
  my @testcase_subgroups;
  while (my $hashref = $sth->fetchrow_hashref) {
    push @testcase_subgroups, $hashref;
  }
  $sth->finish;
  foreach my $hashref (@testcase_subgroups) {
#    print $testcase_mapping->{$testcase2_id} . " " . $hashref->{'subgroup_id'} . " " . $subgroup_mapping->{$hashref->{'subgroup_id'}} . "\n";
    $rv = $litmus_dbh->do("INSERT INTO testcase_subgroups (testcase_id,subgroup_id,sort_order) VALUES (?,?,?)",
                          undef,
                          $testcase_mapping->{$testcase2_id},
                          $subgroup_mapping->{$hashref->{'subgroup_id'}},
                          $hashref->{'sort_order'},
                         );
  }
}

exit 0;

#########################################################################
sub connect_litmus() {
  my $dsn = "dbi:mysql:" . $Litmus::Config::db_name . 
    ":" . $Litmus::Config::db_host;
    my $dbh = DBI->connect($dsn,
                           $Litmus::Config::db_user,
                           $Litmus::Config::db_pass)
      || die "Could not connect to mysql database $Litmus::Config::db_name";
    
    return $dbh;
}
