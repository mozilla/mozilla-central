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
use Litmus::Error;
use Litmus::FormWidget;
use Litmus::DB::Product;
use Litmus::UserAgentDetect;
use Litmus::SysConfig;
use Litmus::Auth;

use CGI;
use JSON;
use Time::Piece::MySQL;

Litmus->init();

our $title = "Run Tests";

our $c = Litmus->cgi(); 

if ($c->param) {
  if ($c->param("testgroup")) {
    &displayTestcases();
  } elsif ($c->param("criterion") or
           $c->param("continuetesting")) { 
    &displayGroupSelection();
  } elsif ($c->param("test_run_id")) {
    &displaySysConfig();
  } else { 
    &displayAllTestRuns();
  }
} else {
  &displayAllTestRuns();
}

if ($Litmus::Config::DEBUG) {
  my $elapsed = tv_interval ( $t0 );
  printf  "<div id='pageload'>Page took %f seconds to load.</div>", $elapsed;
}

exit 0;

# END

#########################################################################
sub displaySysConfig() {
  Litmus::Auth::requireLogin("run_tests.cgi");
  
  my $test_run_id = $c->param("test_run_id");

  if (!$test_run_id) {
    &displayAllTestRuns();
  }

  print $c->header();

  my $test_run = Litmus::DB::TestRun->getTestRunWithRefs($test_run_id);
  
  my $title = "Run Tests - Your Chosen Test Run";

  my $platforms = Litmus::FormWidget->getPlatforms();
  my $opsyses = Litmus::FormWidget->getOpsyses();
  my $locales = Litmus::FormWidget->getLocales();

  my $json = JSON->new(skipinvalid => 1, convblessed => 1);
  my $test_run_js = $json->objToJson($test_run);
  my $platforms_js = $json->objToJson($platforms);
  my $opsyses_js = $json->objToJson($opsyses);

  my $vars = {
              title        => $title,
              user         => Litmus::Auth::getCurrentUser(),
              test_run     => [$test_run],
              test_run_js  => $test_run_js,
              platforms_js => $platforms_js,
              opsyses_js   => $opsyses_js,
              locales      => $locales,
             };
  
  my $cookie =  Litmus::Auth::getCookie();
  $vars->{"defaultemail"} = $cookie;
  $vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);
  
  Litmus->template()->process("runtests/sysconfig.html.tmpl", $vars) || 
    internalError(Litmus->template()->error());
  
}

#########################################################################
sub displayGroupSelection() {
  Litmus::Auth::requireLogin("run_tests.cgi");
  
  my $test_run_id = $c->param("test_run_id");

  if (!$test_run_id) {
    &displayAllTestRuns();
    return;
  }

  my $test_run = Litmus::DB::TestRun->getTestRunWithRefs($test_run_id);
  my $sysconfig;
  if ($c->param("continuetesting")) {
    # Check that we have config info for this test run already.
    $sysconfig = Litmus::SysConfig->getCookieByTestRunId($test_run_id);
  } else {
    $sysconfig = &verifySysConfig($test_run);
  }
 
  if (!$sysconfig) {
    &displaySysConfig();
    return;
  };

  $c->storeCookie($sysconfig->setCookie());
  
  $test_run->flagCriteriaInUse($sysconfig);

  print $c->header();
  
  my $user =  Litmus::Auth::getCookie();
  my @testgroups;
  if (Litmus::Auth::istrusted($user)) {
    @testgroups = Litmus::DB::Testgroup->search_ByTestRun($test_run_id);
  } else {
    @testgroups = Litmus::DB::Testgroup->search_EnabledByTestRun($test_run_id);
  }
  
  # all possible subgroups per group:
  my %subgroups; 
  foreach my $testgroup (@testgroups) {
    my @component_subgroups;
    if (Litmus::Auth::istrusted($user)) {
      @component_subgroups = Litmus::DB::Subgroup->search_ByTestgroup($testgroup->testgroup_id());
    } else {
      @component_subgroups = Litmus::DB::Subgroup->search_EnabledByTestgroup($testgroup->testgroup_id());
    }
    $subgroups{$testgroup->testgroup_id()} = \@component_subgroups;
  }
  
  my $defaultgroup = "";
  if ($c->param("defaulttestgroup")) {
    $defaultgroup = Litmus::DB::Testgroup->
      retrieve($c->param("defaulttestgroup"));
  }

  my $vars = {
              title        => $title,
              user         => Litmus::Auth::getCurrentUser(),
              test_runs     => [$test_run],
              testgroups   => \@testgroups,
              subgroups    => \%subgroups,
              defaultgroup => $defaultgroup,
              defaultemail => $user,
              show_admin   => Litmus::Auth::istrusted($user),
              sysconfig    => $sysconfig,
             };

  Litmus->template()->process("runtests/selectgroupsubgroup.html.tmpl", 
                              $vars) or 
    internalError(Litmus->template()->error());
}

#########################################################################
sub displayTestcases() {
  Litmus::Auth::requireLogin("run_tests.cgi");
  
  my $test_run_id = $c->param("test_run_id");

  if (!$test_run_id) {
    &displayAllTestRuns();
  }

  my $test_run = Litmus::DB::TestRun->getTestRunWithRefs($test_run_id);
  my $sysconfig = Litmus::SysConfig->getCookieByTestRunId($test_run_id);
 
  if (!$sysconfig) {
    &displaySysConfig();
    return;
  };

  $c->storeCookie($sysconfig->setCookie());
  
  $test_run->flagCriteriaInUse($sysconfig);

  print $c->header();
#  use Data::Dumper;
#  print Dumper $sysconfig;
#  print Dumper $test_run->{'criteria'};

  # the form has a subgroup radio button set for each possible group, named
  # subgroup_n where n is the group id number. We get the correct
  # subgroup based on whatever group the user selected: 
  my $testgroup_id = $c->param("testgroup");
  my $subgroup_id = $c->param("subgroup_".$testgroup_id);

  my $cookie =  Litmus::Auth::getCookie();
  my $show_admin = Litmus::Auth::istrusted($cookie);
  
  # get the tests to display:
  my @tests;
  if ($show_admin) {
    @tests = Litmus::DB::Testcase->search_EnabledBySubgroup($subgroup_id,$testgroup_id);
  } else {
    @tests = Litmus::DB::Testcase->search_CommunityEnabledBySubgroup($subgroup_id,$testgroup_id);
  }
  
  my $vars = {
              title        => $title,
              test_runs    => [$test_run],
              testgroup    => Litmus::DB::Testgroup->retrieve($testgroup_id),
              subgroup     => Litmus::DB::Subgroup->retrieve($subgroup_id),
              tests        => \@tests,
              defaultemail => $cookie,
              show_admin   => $show_admin,
              istrusted    => $show_admin,
              sysconfig    => $sysconfig,
             };
  
  Litmus->template()->process("runtests/testdisplay.html.tmpl", $vars) ||
    internalError(Litmus->template()->error());
}

#########################################################################
sub displayAllTestRuns() {
  print $c->header();

  my @recommended_test_runs = Litmus::DB::TestRun->getTestRuns(1,'true',0);
  my @remaining_test_runs = Litmus::DB::TestRun->getTestRuns(1,'false',0);

  my $title = "Active Test Runs - All";

  my $vars = {
              title        => $title,
              user         => Litmus::Auth::getCurrentUser(),
              recommended_test_runs => \@recommended_test_runs,
              remaining_test_runs => \@remaining_test_runs,
             };
  
  my $cookie =  Litmus::Auth::getCookie();
  $vars->{"defaultemail"} = $cookie;
  $vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);
  
  Litmus->template()->process("runtests/all_test_runs.tmpl", 
                              $vars) || 
                                internalError(Litmus->template()->error());
}

#########################################################################
sub verifySysConfig() {
  my ($test_run) = @_;
  
  # Use the criterion value as the basis for our check, since disabled form
  # controls don't dubmit their values anyway.
  my ($row_num,$build_id,$platform_id,$opsys_id);
  if ($c->param("criterion")) {
    ($row_num,$build_id,$platform_id,$opsys_id) = split(/\|/,$c->param("criterion"),4);
    if (!$build_id) {
      $build_id = $c->param("build_id_${row_num}");
    }
    if (!$platform_id) {
      $platform_id = $c->param("platform_${row_num}");
    }
    if (!$opsys_id) {
      $opsys_id = $c->param("opsys_${row_num}");
    }
  }
  my $locale = $c->param("locale");

  # Make sure we have a complete set of criteria.
  if (!$build_id or
      !$platform_id or
      !$opsys_id or
      !$locale) {
    return undef;
  }
  
  # Compare the provided criteria with any required criteria.
  my $found_match = 0;
  if ($test_run->criteria and scalar(@{$test_run->criteria}) > 0) {
    foreach my $criterion (@{$test_run->criteria}) {
      # Build ID alone is the smallest possible criteria set.
      if ($criterion->{'build_id'} == $build_id) {
        if ($criterion->{'platform_id'}) {
          if ($criterion->{'platform_id'} == $platform_id) {
            if ($criterion->{'opsys_id'}) {
              if ($criterion->{'opsys_id'} == $opsys_id) {
                # Matches build ID, platform ID, and opsys ID
                $found_match = 1;
                last;
              }
              next;
            }
            # Matches build ID and platform ID
            $found_match = 1;
            last;
          }
          next;
        }
        # Matches build ID.
        $found_match = 1;
        last;
      }
      next;
    }    
  } else {
    # No criteria associated with this test run, so any complete set of
    # criteria will do.
    $found_match = 1;
  }

  if (!$found_match) {
    return undef;
  }

  my $sysconfig = Litmus::SysConfig::new(
                                         $test_run->{'test_run_id'},
                                         $build_id,
                                         $platform_id,
                                         $opsys_id,
                                         $locale
                                         );
  return $sysconfig;
}
