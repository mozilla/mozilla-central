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

use CGI;
use Date::Manip;
use Encode qw( decode encode );
use JSON;

Litmus->init();
my $c = Litmus->cgi(); 

my $vars;

my $testcase_id;
my $edit;
my $message;
my $status;
my $rv;

if ($c->param("searchTestcaseList")) {
  print $c->header('text/plain');
  my $product_id = $c->param("product");
  my $branch_id = $c->param("branch");
  my $testgroup_id = $c->param("testgroup");
  my $subgroup_id = $c->param("subgroup");
  
  my $tests;
  
  if ($subgroup_id) {
    $tests = Litmus::DB::Testcase->search_BySubgroup($subgroup_id);
  } elsif ($testgroup_id) {
    $tests = Litmus::DB::Testcase->search_ByTestgroup($testgroup_id);
  } elsif ($branch_id) {
    $tests = Litmus::DB::Testcase->search(branch => $branch_id);
  } elsif ($product_id) {
    $tests = Litmus::DB::Testcase->search(product => $product_id);
  } else {
    $tests = Litmus::DB::Testcase->retrieve_all;
  }
  while (my $t = $tests->next) {
    print $t->testcase_id()."\n";
  }
  exit;
}

# anyone can use this script for its searching capabilities, but if we 
# get here, then you need to be an admin:
Litmus::Auth::requireProductAdmin('manage_testcases.cgi');

my $product_persist = $c->param('product_persist') ? $c->param('product_persist') : 0;
my $branch_persist = $c->param('branch_persist') ? $c->param('branch_persist') : 0;
my $testgroup_persist = $c->param('testgroup_persist') ? $c->param('testgroup_persist') : 0;
my $subgroup_persist = $c->param('subgroup_persist') ? $c->param('subgroup_persist') : 0;
$vars->{'product_persist'} = $product_persist;
$vars->{'branch_persist'} = $branch_persist;
$vars->{'testgroup_persist'} = $testgroup_persist;
$vars->{'subgroup_persist'} = $subgroup_persist;

if ($c->param("testcase_id")) {
  $testcase_id = $c->param("testcase_id");
  if ($c->param("edit")) {
  	  $edit = $testcase_id;
  	  # show an error if they are not a product admin for that product
  	  my $testcase = Litmus::DB::Testcase->retrieve($testcase_id);
  	  if ($testcase) {
  	  	Litmus::Auth::requireProductAdmin("manage_testcases.cgi", $testcase->product());
  	  }
  }
}

my $defaults;
if ($c->param("delete_testcase_button")) {
  my $testcase;
  if ($testcase_id) {
    $testcase = Litmus::DB::Testcase->retrieve($testcase_id);
    if ($testcase) {
      Litmus::Auth::requireProductAdmin("manage_testcases.cgi", $testcase->product());
      $rv = $testcase->delete_with_refs();
      if ($rv) {
        $status = "success";
        $message = "Testcase ID# $testcase_id deleted successfully.";
      } else {
        $status = "failure";
        $message = "Failed to delete Testcase ID# $testcase_id.";
      }
    } else { 
      $status = "failure";
      $message = "Testcase ID# $testcase_id does not exist. (Already deleted?)";
    }
  } else {
      $status = "failure";
      $message = "No testcase ID provided.";
  }   
} elsif ($c->param("clone_testcase_button")) {
  my $testcase = Litmus::DB::Testcase->retrieve($testcase_id);
  Litmus::Auth::requireProductAdmin("manage_testcases.cgi", $testcase->product());
  my $new_testcase = $testcase->clone;
  if ($new_testcase) {
    $status = "success";
    $message = "Testcase cloned successfully. New testcase ID# is " . $new_testcase->testcase_id;
    $defaults->{'testcase_id'} = $new_testcase->testcase_id;
  } else {
    $status = "failure";
    $message = "Failed to clone Testcase ID# $testcase_id.";
  }
} elsif ($c->param("mode")) {
  requireField('summary', $c->param('summary'));
  requireField('product', $c->param('product'));
  requireField('branch', $c->param('branch'));
  requireField('author', $c->param('author_id'));
  my $enabled = $c->param('enabled') ? 1 : 0;
  my $community_enabled = $c->param('communityenabled') ? 1 : 0;
  my $now = &UnixDate("today","%q");

  if ($c->param("mode") eq "add") {
    Litmus::Auth::requireProductAdmin("manage_testcases.cgi", $c->param('product'));
    my %hash = (
                summary => $c->param('summary'),
                steps => $c->param('steps') ? $c->param('steps') : '',
                expected_results => $c->param('results') ? $c->param('results') : '',
                product_id => $c->param('product'),
                branch_id => $c->param('branch'),
                enabled => $enabled,
                community_enabled => $community_enabled,
                regression_bug_id => $c->param('regression_bug_id') ? $c->param('regression_bug_id') : '',
                author_id => $c->param('author_id'),
                creation_date => $now,
                last_updated => $now,
               );
    my $new_testcase = 
      Litmus::DB::Testcase->create(\%hash);

    if ($new_testcase) {      
      $status = "success";
      $message = "Testcase added successfully. New testcase ID# is " . $new_testcase->testcase_id;
      $defaults->{'testcase_id'} = $new_testcase->testcase_id;
    } else {
      $status = "failure";
      $message = "Failed to add testcase.";        
    }
    
  } elsif ($c->param("mode") eq "edit") {
    requireField('testcase_id', $c->param("editform_testcase_id"));
    $testcase_id = $c->param("editform_testcase_id");
    my $testcase = Litmus::DB::Testcase->retrieve($testcase_id);
    if ($testcase) {
      Litmus::Auth::requireProductAdmin("manage_testcases.cgi", $testcase->product());
      $testcase->summary($c->param('summary'));
      $testcase->steps($c->param('steps') ? $c->param('steps') : '');
      $testcase->expected_results($c->param('results') ? $c->param('results') : '');
      $testcase->product_id($c->param('product'));
      $testcase->branch_id($c->param('branch'));
      $testcase->enabled($enabled);
      $testcase->community_enabled($community_enabled);
      $testcase->regression_bug_id($c->param('regression_bug_id') ? $c->param('regression_bug_id') : '');
      $testcase->author_id($c->param('author_id'));
      $testcase->last_updated($now);
      $testcase->version($testcase->version + 1);
      $rv = $testcase->update();
      if ($rv) {
        $status = "success";
	$message = "Testcase ID# $testcase_id updated successfully.";
        $defaults->{'testcase_id'} = $testcase_id;
      } else {
	$status = "failure";
	$message = "Failed to update testcase ID# $testcase_id.";        
      }
    } else {
      $status = "failure";
      $message = "Testcase ID# $testcase_id not found.";        
    }
  } 
} else {
  $defaults->{'testcase_id'} = $c->param("testcase_id");
}

if ($defaults) {
  $vars->{'defaults'} = $defaults;
}

if ($status and $message) {
  $vars->{'onload'} = "toggleMessage('$status','$message');";
}

my $products = Litmus::FormWidget->getProducts();
my $branches = Litmus::FormWidget->getBranches();
my $testgroups = Litmus::FormWidget->getTestgroups(0);
my $subgroups = Litmus::FormWidget->getSubgroups(0,'name');
my $testcases = Litmus::FormWidget->getTestcases(0,'name');

my $authors = Litmus::FormWidget->getAuthors();

# only allow the user access to the products they are product admins for
my %authorized_products;
my @tmp_products;
foreach my $b (@{$products}) {
	my %cur = %{$b};
	if (Litmus::Auth::getCurrentUser()->isProductAdmin($cur{product_id})) {
		push(@tmp_products, $b);
		$authorized_products{$cur{product_id}} = 1;
	}
}
$products = \@tmp_products;

# likewise for branches:
my %authorized_branches;
my @tmp_branches;
foreach my $b (@{$branches}) {
	my %cur = %{$b};
	if ($authorized_products{$cur{product_id}}) {
		push(@tmp_branches, $b);
		$authorized_branches{$cur{branch_id}} = 1;
	}
}
$branches = \@tmp_branches;

# testgroups
my @tmp_testgroups;
foreach my $b (@{$testgroups}) {
	my %cur = %{$b};
	if ($authorized_products{$cur{product_id}}) {
		push(@tmp_testgroups, $b);
	}
}
$testgroups = \@tmp_testgroups;

# subgroups
my @tmp_subgroups;
foreach my $b (@{$subgroups}) {
	my %cur = %{$b};
	if ($authorized_products{$cur{product_id}}) {
		push(@tmp_subgroups, $b);
	}
}
$subgroups = \@tmp_subgroups;

# and, of course, testcases
my @tmp_testcases;
foreach my $b (@{$testcases}) {
	my %cur = %{$b};
	if ($authorized_products{$cur{product_id}}) {
		push(@tmp_testcases, $b);
	}
}
$testcases = \@tmp_testcases;

my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);
my $testgroups_js = $json->objToJson($testgroups);
my $subgroups_js = $json->objToJson($subgroups);

$vars->{'title'} = "Manage Testcases";
$vars->{'testcases'} = $testcases;
$vars->{'products_js'} = $products_js;
$vars->{'branches_js'} = $branches_js;
$vars->{'testgroups_js'} = $testgroups_js;
$vars->{'subgroups_js'} = $subgroups_js;
$vars->{'authors'} = $authors;
$vars->{'user'} = Litmus::Auth::getCurrentUser();
$vars->{'edit'} = $edit;

my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);

print $c->header();

Litmus->template()->process("admin/manage_testcases.tmpl", $vars) || 
  internalError("Error loading template: ".Litmus->template()->error());

