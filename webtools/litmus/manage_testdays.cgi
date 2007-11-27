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

#use Time::HiRes qw( gettimeofday tv_interval );
#my $t0 = [gettimeofday];

use Litmus;
use Litmus::Auth;
use Litmus::Cache;
use Litmus::Error;
use Litmus::FormWidget;

use CGI;
use JSON;
use Time::Piece::MySQL;

Litmus->init();
Litmus::Auth::requireRunDayAdmin("manage_testdays.cgi");
Litmus::Auth::requireProductAdmin("manage_testdays.cgi");

my $c = Litmus->cgi();
print $c->header();

my $message;
my $status;
my $rv;
my $defaults;
my $warning;

if ($c->param) {
  # Process testday changes.
  if ($c->param("delete_testday_button") and 
      $c->param("testday_id")) {
    my $testday_id = $c->param("testday_id");
    my $testday = Litmus::DB::TestDay->retrieve($testday_id);
    if ($testday) {
      Litmus::Auth::requireProductAdmin("manage_testdays.cgi", $testday->product());
      $rv = $testday->delete_with_refs;
      if ($rv) {
        $status = "success";
        $message = "Testday ID# $testday_id deleted successfully.";
      } else {
        $status = "failure";
        $message = "Failed to delete testday ID# $testday_id.";
      }
    } else { 
      $status = "failure";
      $message = "Testday ID# $testday_id does not exist. (Already deleted?)";
    }
  } elsif ($c->param("edit_testday_form_mode")) {
    if ($c->param("edit_testday_form_mode") eq "add") {
      my %hash = ( 
                  description => $c->param('edit_testday_form_desc'),
                  start_timestamp => $c->param('edit_testday_form_start_timestamp'),
                  finish_timestamp => $c->param('edit_testday_form_finish_timestamp'),
                 );
      my @subgroups;
      
      if ($c->param('product')) {
        Litmus::Auth::requireProductAdmin("manage_testdays.cgi", $c->param('product'));
        $hash{product_id} = $c->param('product');
      }
      if ($c->param('branch')) {
        $hash{branch_id} = $c->param('branch');
      }
      if ($c->param('testgroup')) {
        $hash{testgroup_id} = $c->param('testgroup');
      }
      if ($c->param('subgroup')) {
        @subgroups = $c->param('subgroup');
      }
      if ($c->param('build_id')) {
        $hash{build_id} = $c->param('build_id');
      }
      if ($c->param('locale') and 
          $c->param('locale') ne "") {
        $hash{locale_abbrev} = $c->param('locale');
      }
      
      # Search for other testdays that overlap this one and let the user
      # know about them:
      my @overlap = Litmus::DB::TestDay->search_daterange(
                                                          $hash{finish_timestamp},
                                                          $hash{start_timestamp}
                                                         );
      
      my $new_testday = 
        Litmus::DB::TestDay->create(\%hash);
      if ($new_testday) {
        if (scalar @subgroups) {
          $new_testday->update_subgroups(\@subgroups);
        }
        $status = "success";
        $message = "Testday added successfully. New testday ID# is " . $new_testday->testday_id;
        if (@overlap) {
          $warning = 1;
        }
                
        $defaults->{'testday_id'} = $new_testday->testday_id;
      } else {
        $status = "failure";
        $message = "Failed to add testday.";
      }
    } elsif ($c->param("edit_testday_form_mode") eq "edit") {
      my $testday_id = $c->param("edit_testday_form_testday_id");
      my $testday = Litmus::DB::TestDay->retrieve($testday_id);
      if ($testday) {
        my @subgroups;
        Litmus::Auth::requireProductAdmin("manage_testdays.cgi", $testday->product());
        $testday->description($c->param('edit_testday_form_desc'));
        $testday->start_timestamp($c->param('edit_testday_form_start_timestamp'));
        $testday->finish_timestamp($c->param('edit_testday_form_finish_timestamp'));
        if ($c->param('product')) {
          Litmus::Auth::requireProductAdmin("manage_testdays.cgi", $c->param('product'));
          $testday->product_id($c->param('product'));
        }
        if ($c->param('branch')) {
          $testday->branch_id($c->param('branch'));
        }
        if ($c->param('testgroup')) {
          $testday->testgroup_id($c->param('testgroup'));
        }
        if ($c->param('subgroup')) {
          @subgroups = $c->param('subgroup');
        }
        if ($c->param('build_id')) {
          $testday->build_id($c->param('build_id'));
        }
        if ($c->param('locale') and
            $c->param('locale') ne "") {        
          $testday->locale_abbrev($c->param('locale'));
        }

        $rv = $testday->update();
        if ($rv) {
          $testday->update_subgroups(\@subgroups);
          $status = "success";
          $message = "Testday ID# $testday_id updated successfully.";
          $defaults->{'testday_id'} = $testday_id;
        } else {
          $status = "failure";
          $message = "Failed to update testday ID# $testday_id.";
        }
      } else {
        $status = "failure";
        $message = "Testday ID# $testday_id not found.";        
      }
    }
  }

}

my $products = Litmus::FormWidget->getProducts();
my $branches = Litmus::FormWidget->getBranches();
my $testgroups = Litmus::FormWidget->getTestgroups();
my $subgroups = Litmus::FormWidget->getSubgroups();
my $testdays = Litmus::FormWidget->getTestdays();
my $locales = Litmus::FormWidget->getLocales;

my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);
my $testgroups_js = $json->objToJson($testgroups);
my $subgroups_js = $json->objToJson($subgroups);

my $vars = {
            title => 'Manage Testdays',
            products => $products,
            branches => $branches,
            testdays => $testdays,
            locales  => $locales,
            warning  => $warning,
           };
  
$vars->{'products_js'} = $products_js;
$vars->{'branches_js'} = $branches_js;
$vars->{'testgroups_js'} = $testgroups_js;
$vars->{'subgroups_js'} = $subgroups_js;

if ($status and $message) {
  $vars->{'onload'} = "toggleMessage('$status','$message');";
}

my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);

Litmus->template()->process("admin/manage_testdays.tmpl", $vars) ||
  internalError(Litmus->template()->error());

#my $elapsed = tv_interval ( $t0 );
#printf  "<div id='pageload'>Page took %f seconds to load.</div>", $elapsed;

exit 0;






