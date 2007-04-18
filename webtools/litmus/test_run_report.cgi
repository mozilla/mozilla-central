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

use Time::HiRes qw( gettimeofday tv_interval );
our $t0 = [gettimeofday];

use Litmus;
use Litmus::Auth;
use Litmus::FormWidget;
use Litmus::Error;
use Litmus::SysConfig;

Litmus->init();
my $c = Litmus->cgi();

print $c->header();

my $test_run_id = $c->param("test_run_id");

if (!$test_run_id) {
  invalidInputError("No Test Run selected!");
  exit 1;
}

my $test_run = Litmus::DB::TestRun->getTestRunWithRefs($test_run_id);
my @sysconfigs;
foreach my $criterion (@{$test_run->{'criteria'}}) {
  my $sysconfig = Litmus::SysConfig::new(
                                         $test_run_id,
                                         $criterion->{'build_id'} || undef,
                                         $criterion->{'platform_id'} || undef,
                                         $criterion->{'opsys_id'} || undef,
                                         undef
                                        );
  push @sysconfigs, $sysconfig;
}

my $user =  Litmus::Auth::getCookie();
my @testgroups;
if (Litmus::Auth::istrusted($user)) {
  @testgroups = Litmus::DB::Testgroup->search_ByTestRun($test_run_id);
} else {
  @testgroups = Litmus::DB::Testgroup->search_EnabledByTestRun($test_run_id);
}

# All possible subgroups per group:
my %subgroups; 
my %testcases;
my %testcase_coverage;
foreach my $testgroup (@testgroups) {
    my @component_subgroups;
    if (Litmus::Auth::istrusted($user)) {
        @component_subgroups = Litmus::DB::Subgroup->search_ByTestgroup($testgroup->testgroup_id());
    } else {
        @component_subgroups = Litmus::DB::Subgroup->search_EnabledByTestgroup($testgroup->testgroup_id());
    }
    $subgroups{$testgroup->testgroup_id()} = \@component_subgroups;
    foreach my $subgroup (@component_subgroups) {
    my @component_testcases;
    if (Litmus::Auth::istrusted($user)) {
        @component_testcases= Litmus::DB::Testcase->search_BySubgroup($subgroup->subgroup_id());
    } else {
        @component_testcases = Litmus::DB::Testcase->search_EnabledBySubgroup($subgroup->subgroup_id(),$testgroup->testgroup_id());
    }
    $testcases{$subgroup->subgroup_id()} = \@component_testcases;
    foreach my $testcase (@component_testcases) {
        if (scalar @sysconfigs > 0) {
            foreach my $sysconfig (@sysconfigs) {
                my $coverage = $testcase->coverage(
                                                   $test_run_id,
                                                   $sysconfig->{'build_id'} || 0,
                                                   $sysconfig->{'platform_id'} || 0,
                                                   $sysconfig->{'opsys_id'} || 0,
                                                   $sysconfig->{'locale'} || 0
                                                  );
                $testcase_coverage{$testcase->{'testcase_id'}}{$sysconfig->{'id'}} = $coverage || 0;
            }
        } else {
            my $coverage = $testcase->coverage(
                                               $test_run_id,
                                               0,
                                               0,
                                               0,
                                               0
                                              );
            $testcase_coverage{$testcase->{'testcase_id'}}{'catchall'} = $coverage || 0;          
        }
    }
  }
}

my $title = 'Test Run Report';

my $vars = {
    title => $title,
    test_runs => [$test_run],
    testcase_coverage => \%testcase_coverage,
    testgroups => \@testgroups,
    subgroups => \%subgroups,
    testcases => \%testcases,
    sysconfigs => \@sysconfigs,
};

my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);

Litmus->template()->process("reporting/test_run_report.tmpl", $vars) || 
    internalError(Litmus->template()->error());

if ($Litmus::Config::DEBUG) {
  my $elapsed = tv_interval ( $t0 );
  printf  "<div id='pageload'>Page took %f seconds to load.</div>", $elapsed;
}

exit 0;

