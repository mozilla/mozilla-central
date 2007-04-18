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
use Litmus::FormWidget;
use Litmus::Utils;
use Litmus::DB::TestRun;

use CGI;
use Date::Manip;
use JSON;

my $c = Litmus->cgi(); 

my $vars;

my $test_run_id;
my $message;
my $status;
my $rv;

if ($c->param("searchTestRunList")) {
  print $c->header('text/plain');
  my $product_id = $c->param("product");
  my $branch_id = $c->param("branch");

  my $test_runs;
  if ($branch_id) {
    $test_runs = Litmus::DB::TestRun->search(branch =>  $branch_id);
  } elsif ($product_id) {
    $test_runs = Litmus::DB::TestRun->search(product => $product_id);
  } else {
    $test_runs = Litmus::DB::TestRun->retrieve_all;
  }

  while (my $tg = $test_runs->next) {
    print $tg->test_run_id()."\n";
  }
  exit;
}


Litmus::Auth::requireAdmin('manage_test_runs.cgi');

if ($c->param("test_run_id")) {
  $test_run_id = $c->param("test_run_id");
}
my $defaults;
if ($c->param("delete_test_run_button")) {
  my $test_run = Litmus::DB::TestRun->retrieve($test_run_id);
  if ($test_run) {
    $rv = $test_run->delete_with_refs();
    if ($rv) {
      $status = "success";
      $message = "Test run ID# $test_run_id deleted successfully.";
    } else {
      $status = "failure";
      $message = "Failed to delete Test run ID# $test_run_id.";
    }
  } else { 
    $status = "failure";
    $message = "Test run ID# $test_run_id does not exist. (Already deleted?)";
  }
} elsif ($c->param("clone_test_run_button")) {
  my $test_run = Litmus::DB::TestRun->retrieve($test_run_id);
  my $new_test_run = $test_run->clone;
  if ($new_test_run) {
    $status = "success";
    $message = "Test run cloned successfully. New test_run ID# is " . $new_test_run->test_run_id;
    $defaults->{'test_run_id'} = $new_test_run->test_run_id;
  } else {
    $status = "failure";
    $message = "Failed to clone Test run ID# $test_run_id.";
  }
} elsif ($c->param("mode")) {
  requireField('name', $c->param('name'));
  requireField('product', $c->param('product'));
  requireField('branch', $c->param('branch'));
  requireField('start_timestamp', $c->param('start_timestamp'));
  requireField('finish_timestamp', $c->param('finish_timestamp'));
  my $enabled = $c->param('enabled') ? 1 : 0;
  my $recommended = $c->param('recommended') ? 1 : 0;
  my $now = &UnixDate("today", "%q");
  my @selected_testgroups = $c->param("test_run_testgroups");  
  my $criteria = &getCriteria($c);
  if ($c->param("mode") eq "add") {
    my %hash = (
                name => $c->param('name'),
                description => $c->param('description'),
                product_id => $c->param('product'),
                branch_id => $c->param('branch'),
                start_timestamp => $c->param('start_timestamp'),
                finish_timestamp => $c->param('finish_timestamp'),
                enabled => $enabled,
                recommended => $recommended,
                author_id => $c->param('author_id'),
                creation_date => $now,
                last_updated => $now,
               );
    my $test_run =
      Litmus::DB::TestRun->create(\%hash);

    if ($test_run) {
      $test_run->update_testgroups(\@selected_testgroups);
      if ($criteria and
          $#$criteria >= 0) {
        $test_run->update_criteria($criteria);
      }
      $status = "success";    
      $message = "Test run added successfully. New test run ID# is " . $test_run->test_run_id;
      $defaults->{'test_run_id'} = $test_run->test_run_id; 
    } else {
      $status = "failure";
      $message = "Failed to add test run.";
    }

  } elsif ($c->param("mode") eq "edit") {
    requireField('test_run_id', $c->param("editform_test_run_id"));
    $test_run_id = $c->param("editform_test_run_id");
    my $test_run = Litmus::DB::TestRun->retrieve($test_run_id);
    if ($test_run) {
      $test_run->name($c->param('name'));
      $test_run->description($c->param('description'));
      $test_run->product_id($c->param('product'));
      $test_run->branch_id($c->param('branch'));
      $test_run->start_timestamp($c->param('start_timestamp'));
      $test_run->finish_timestamp($c->param('finish_timestamp'));
      $test_run->enabled($enabled);
      $test_run->recommended($recommended);
      $test_run->author_id($c->param('author_id'));
      my $version = $test_run->version;
      $version++;
      $test_run->version($version);
      $test_run->last_updated($now);
      $rv = $test_run->update();
      if ($rv) {
        $test_run->update_testgroups(\@selected_testgroups);
        if ($criteria and
          $#$criteria >= 0) {
          $test_run->update_criteria($criteria);
        }
        $status = "success";
        $message = "Test run ID# $test_run_id updated successfully.";
        $defaults->{'test_run_id'} = $test_run->test_run_id;
      } else {
        $status = "failure";
        $message = "Failed to update test run.";
      }
      
    } else {
      $status = "failure";
       $message = "Test run ID# $test_run_id not found.";
    }
  }

} else {
  $defaults->{'test_run_id'} = $c->param("test_run_id");
}

if ($defaults) {
  $vars->{'defaults'} = $defaults;
}

if ($status and $message) {
  $vars->{'onload'} = "toggleMessage('$status','$message');";
}

my $test_runs = Litmus::FormWidget->getTestRuns;
my $products = Litmus::FormWidget->getProducts;
my $branches = Litmus::FormWidget->getBranches;
my $testgroups = Litmus::FormWidget->getTestgroups;
my $platforms = Litmus::FormWidget->getPlatforms();
my $opsyses = Litmus::FormWidget->getOpsyses();
my $authors = Litmus::FormWidget->getAuthors();

my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);
my $testgroups_js = $json->objToJson($testgroups);
my $platforms_js = $json->objToJson($platforms);
my $opsyses_js = $json->objToJson($opsyses);

$vars->{'title'} = "Manage Test Runs";
$vars->{'test_runs'} = $test_runs;
$vars->{'products'} = $products;
$vars->{'platforms'} = $platforms;
$vars->{'opsyses'} = $opsyses;
$vars->{'authors'} = $authors;
$vars->{'user'} = Litmus::Auth::getCurrentUser();
$vars->{'products_js'} = $products_js;
$vars->{'branches_js'} = $branches_js;
$vars->{'testgroups_js'} = $testgroups_js;
$vars->{'platforms_js'} = $platforms_js;
$vars->{'opsyses_js'} = $opsyses_js;

my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);

print $c->header();

Litmus->template()->process("admin/manage_test_runs.tmpl", $vars) ||
  internalError("Error loading template: $@\n");

#########################################################################
sub getCriteria {
  my ($c) = @_;

  my $matched_rows;
  my @criteria;
  for my $param ($c->param) {
    if ($param =~ /^build_id_new_(\d+)$/ or
        $param =~ /^platform_new_(\d+)$/ or
        $param =~ /^opsys_new_(\d+)$/) {
      my $row_id = $1;

      next if ($matched_rows->{$row_id});
      
      my $hash;
      $hash->{'build_id'} = $c->param("build_id_new_$row_id") ? $c->param("build_id_new_$row_id") : '';
      $hash->{'platform_id'} = $c->param("platform_new_$row_id") ? $c->param("platform_new_$row_id") : 0;
      $hash->{'opsys_id'} = $c->param($param) ? $c->param("opsys_new_$row_id") : 0;
      
      push @criteria, $hash;
      $matched_rows->{$row_id} = 1;      
    }
  }

  return \@criteria;
}
