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

use Litmus;
use Litmus::Auth;
use Litmus::Error;
use Litmus::DB::TestRun;
use Text::Markdown;
use JSON;

use CGI;
use Date::Manip;

my $json = JSON->new(skipinvalid => 1, convblessed => 1);

Litmus->init();
my $c = Litmus->cgi(); 
print $c->header('text/plain');

my $js;

if ($c->param("testcase_id")) {
  my $testcase_id = $c->param("testcase_id");
  my $testcase = Litmus::DB::Testcase->retrieve($testcase_id);
  my @testgroups = Litmus::DB::Testgroup->search_ByTestcase($testcase_id);
  my @subgroups = Litmus::DB::Subgroup->search_ByTestcase($testcase_id);
  $testcase->{'testgroups'} = \@testgroups;
  $testcase->{'subgroups'} = \@subgroups;
  
  # apply markdown formatting to the steps and expected results:
  $testcase->{'steps_formatted'} = Text::Markdown::markdown($testcase->steps());
  $testcase->{'expected_results_formatted'} = Text::Markdown::markdown($testcase->expected_results());
  
  $js = $json->objToJson($testcase);
} elsif ($c->param("subgroup_id")) {
  my $subgroup_id = $c->param("subgroup_id");
  my $subgroup = Litmus::DB::Subgroup->retrieve($subgroup_id);
  my @testgroups = Litmus::DB::Testgroup->search_BySubgroup($subgroup_id);
  my @testcases = Litmus::DB::Testcase->search_BySubgroup($subgroup_id);
  $subgroup->{'testgroups'} = \@testgroups;
  $subgroup->{'testcases'} = \@testcases;
  $js = $json->objToJson($subgroup);
} elsif ($c->param("testgroup_id")) {
  my $testgroup_id = $c->param("testgroup_id");
  my $testgroup = Litmus::DB::Testgroup->retrieve($testgroup_id);
  my @subgroups = Litmus::DB::Subgroup->search_ByTestgroup($testgroup_id);
  $testgroup->{'subgroups'} = \@subgroups;
  my @branches = Litmus::DB::Branch->search_ByTestgroup($testgroup_id);
  $testgroup->{'branches'} = \@branches;
  $js = $json->objToJson($testgroup);
} elsif ($c->param("test_run_id")) {
  my $test_run_id = $c->param("test_run_id");
  my $test_run = Litmus::DB::TestRun->retrieve($test_run_id);
  if ($c->param("coverage")) {
    my $coverage = $test_run->coverage;
    print '{"test_run_id":' . $test_run_id . ',"coverage":' . $coverage . '}';
    exit 0;
  } else {
    my @testgroups = Litmus::DB::Testgroup->search_ByTestRun($test_run_id);
    $test_run->{'testgroups'} = \@testgroups;
    my $criteria = $test_run->getCriteria();
    $test_run->{'criteria'} = $criteria;  
    $js = $json->objToJson($test_run);
  }
} elsif ($c->param("validate_login")) {
  my $uname = $c->param("username");
  my $passwd = $c->param("password");
  my $login = Litmus::Auth::validate_login($uname, $passwd);
  if (!$login) { $login = 0 }
  else { $login = 1 } 
  print $login;
  exit 0;
} elsif ($c->param("product_id")) {
  my $product_id = $c->param("product_id");
  my $product = Litmus::DB::Product->retrieve($product_id);
  $js = $json->objToJson($product);
} elsif ($c->param("platform_id")) {
  my $platform_id = $c->param("platform_id");
  my $platform = Litmus::DB::Platform->retrieve($platform_id);
  my @products = Litmus::DB::Product->search_ByPlatform($platform_id);
  $platform->{'products'} = \@products;
  $js = $json->objToJson($platform);
} elsif ($c->param("opsys_id")) {
  my $opsys_id = $c->param("opsys_id");
  my $opsys = Litmus::DB::Opsys->retrieve($opsys_id);
  $js = $json->objToJson($opsys);
} elsif ($c->param("branch_id")) {
  my $branch_id = $c->param("branch_id");
  my $branch = Litmus::DB::Branch->retrieve($branch_id);
  $js = $json->objToJson($branch);
} elsif ($c->param("testday_id")) {
  use Litmus::DB::TestDay;
  my $testday_id = $c->param("testday_id");
  my $testday = Litmus::DB::TestDay->retrieve($testday_id);
  $js = $json->objToJson($testday);
} elsif ($c->param("products")) {
  my @products = Litmus::DB::Product->retrieve_all();
  $js = $json->objToJson(\@products);
} elsif ($c->param("platforms")) {
  my @platforms = Litmus::DB::Platform->retrieve_all();
  $js = $json->objToJson(\@platforms);
} elsif ($c->param("opsyses")) {
  my @opsyses = Litmus::DB::Opsys->retrieve_all();
  $js = $json->objToJson(\@opsyses);
} elsif ($c->param("branches")) {
  my @branches = Litmus::DB::Branch->retrieve_all();
  $js = $json->objToJson(\@branches);
} 

print $js;

exit 0;

