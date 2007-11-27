#!/usr/bin/perl -w
# -*- Mode: cperl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Mozilla Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is Litmus.
#
# The Initial Developer of the Original Code is Netscape Communications
# Corporation. Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation. All
# Rights Reserved.
#
# Contributor(s): Zach Lipton <zach@zachlipton.com>
#                 Chris Cooper <ccooper@deadsquid.com>

use strict;

use Litmus;
use Litmus::Error;
use Litmus::FormWidget;
use Litmus::UserAgentDetect;
use Litmus::SysConfig;
use Litmus::Auth;
use Litmus::Utils;
use Litmus::TestEvent;

use CGI;
use Date::Manip;
use JSON;
use Time::Piece::MySQL;

Litmus->init();
my $c = Litmus->cgi(); 

print $c->header();

my $vars;
my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie); 

$vars->{'title'} = "Testday Report";

if ($c->param) {
  my $testday;
  if ($c->param("testday_id")) {    
    $testday = Litmus::TestEvent->new(testday_id => $c->param("testday_id"));
  } elsif ($c->param("start_timestamp") and 
           $c->param("finish_timestamp")) {
    my @subgroups;
    if ($c->param('subgroup')) {
      my @subgroup_ids = $c->param('subgroup');
      foreach my $subgroup_id (@subgroup_ids) {
        push @subgroups, Litmus::DB::Subgroup->retrieve($subgroup_id);
      }
    }
    $testday = Litmus::TestEvent->new(
                                      (start_timestamp => $c->param("start_timestamp"),
                                       finish_timestamp => $c->param("finish_timestamp"),
                                       product_id => $c->param("product"),
                                       branch_id => $c->param("branch"),
                                       testgroup_id => $c->param("testgroup"),
                                       subgroups => \@subgroups,
                                       build_id => $c->param("build_id"),
                                       locale => $c->param("locale"),
                                      )
                                     );    
  }

  my $include_admin = 0;
  if ($c->param("include_admin")) { 
    $include_admin = 1;
  }
   
  if ($testday) {
    $vars->{'title'} .= " - " . $testday->getDescription . ", " . $testday->getStartTimestamp(1) . " - " . $testday->getFinishTimestamp(1);

    $vars->{'display_results'} = 1;
    $vars->{'locale_results'} = $testday->getBreakdownByLocale($include_admin);
    $vars->{'platform_results'} = $testday->getBreakdownByPlatform($include_admin);
    $vars->{'status_results'} = $testday->getBreakdownByResultStatus($include_admin);
    $vars->{'subgroup_results'} = $testday->getBreakdownBySubgroup($include_admin);
    $vars->{'user_results'} = $testday->getBreakdownByUser($include_admin);
    $vars->{'user_status_results'} = $testday->getBreakdownByUserAndResultStatus($include_admin);

    $vars->{'test_event'} = $testday;
  }
}

my $products = Litmus::FormWidget->getProducts;
my $branches = Litmus::FormWidget->getBranches;
my $testgroups = Litmus::FormWidget->getTestgroups;
my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);
my $testgroups_js = $json->objToJson($testgroups);

$vars->{'products_js'} = $products_js;
$vars->{'branches_js'} = $branches_js;
$vars->{'testgroups_js'} = $testgroups_js;

my $locales = Litmus::FormWidget->getLocales;
my $testdays = Litmus::FormWidget->getTestdays;
$vars->{'locales'} = $locales;
$vars->{'testdays'} = $testdays;

Litmus->template()->process("reporting/testday_report.tmpl", $vars) || 
  internalError(Litmus->template()->error());
