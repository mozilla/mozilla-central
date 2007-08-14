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
use JSON;

Litmus->init();
my $c = Litmus->cgi(); 

my $vars;

my $subgroup_id;
my $message;
my $status;
my $rv;


if ($c->param("searchSubgroupList")) {
  print $c->header('text/plain');
  my $product_id = $c->param("product");
  my $branch_id = $c->param("branch");
  my $testgroup_id = $c->param("testgroup");

  my $subgroups;

  if ($testgroup_id) {
    $subgroups = Litmus::DB::Subgroup->search_ByTestgroup($testgroup_id);
  } elsif ($branch_id) {
    $subgroups = Litmus::DB::Subgroup->search(branch => $branch_id);
  } elsif ($product_id) {
    $subgroups = Litmus::DB::Subgroup->search(product => $product_id);
  } else {
    $subgroups = Litmus::DB::Subgroup->retrieve_all;
  }

  while (my $sg = $subgroups->next) {
    print $sg->subgroup_id()."\n";
  }
  exit;
}

# anyone can use this script for its searching capabilities, but if we 
# get here, then you need to be an admin:
Litmus::Auth::requireProductAdmin('manage_subgroups.cgi');

my $product_persist = $c->param('product_persist') ? $c->param('product_persist') : 0;
my $branch_persist = $c->param('branch_persist') ? $c->param('branch_persist') : 0;
my $testgroup_persist = $c->param('testgroup_persist') ? $c->param('testgroup_persist') : 0;
$vars->{'product_persist'} = $product_persist;
$vars->{'branch_persist'} = $branch_persist;
$vars->{'testgroup_persist'} = $testgroup_persist;

if ($c->param("subgroup_id")) {
  $subgroup_id = $c->param("subgroup_id");
}

my $defaults;
if ($c->param("delete_subgroup_button")) {
  my $subgroup = Litmus::DB::Subgroup->retrieve($subgroup_id);
  if ($subgroup) {
    Litmus::Auth::requireProductAdmin("manage_subgroups.cgi", $subgroup->product());
    $rv = $subgroup->delete_with_refs();
    if ($rv) {
      $status = "success";
      $message = "Subgroup ID# $subgroup_id deleted successfully.";
    } else {
      $status = "failure";
      $message = "Failed to delete Subgroup ID# $subgroup_id.";
    }
  } else { 
    $status = "failure";
    $message = "Subgroup ID# $subgroup_id does not exist. (Already deleted?)";
  }
} elsif ($c->param("clone_subgroup_button")) {
  my $subgroup = Litmus::DB::Subgroup->retrieve($subgroup_id);
  Litmus::Auth::requireProductAdmin("manage_subgroups.cgi", $subgroup->product());
  my $new_subgroup = $subgroup->clone;
  if ($new_subgroup) {
    $status = "success";
    $message = "Subgroup cloned successfully. New subgroup ID# is " . $new_subgroup->subgroup_id;
    $defaults->{'subgroup_id'} = $new_subgroup->subgroup_id;
  } else {
    $status = "failure";
    $message = "Failed to clone Subgroup ID# $subgroup_id.";
  }
} elsif ($c->param("mode")) {
  requireField('product', $c->param('product'));
  requireField('branch', $c->param('branch'));
  my $enabled = $c->param('enabled') ? 1 : 0;

  if ($c->param("mode") eq "add") {
    Litmus::Auth::requireProductAdmin("manage_subgroups.cgi", $c->param('product'));
    my %hash = (
                name => $c->param('name'),
                product_id => $c->param('product'),
                branch_id => $c->param('branch'),
                enabled => $enabled,
               );
    my $new_subgroup = 
      Litmus::DB::Subgroup->create(\%hash);

    if ($new_subgroup) {      
      my @selected_testcases = $c->param("subgroup_testcases");
      $new_subgroup->update_testcases(\@selected_testcases);
      $status = "success";
      $message = "Subgroup added successfully. New subgroup ID# is " . $new_subgroup->subgroup_id;
      $defaults->{'subgroup_id'} = $new_subgroup->subgroup_id;
    } else {
      $status = "failure";
      $message = "Failed to add subgroup.";        
    }
    
  } elsif ($c->param("mode") eq "edit") {
    requireField('subgroup_id', $c->param("editform_subgroup_id"));
    $subgroup_id = $c->param("editform_subgroup_id");
    my $subgroup = Litmus::DB::Subgroup->retrieve($subgroup_id);
    if ($subgroup) {
      Litmus::Auth::requireProductAdmin("manage_subgroups.cgi", $subgroup->product());
      $subgroup->product_id($c->param('product'));
      $subgroup->branch_id($c->param('branch'));
      $subgroup->enabled($enabled);
      $subgroup->name($c->param('name'));
      $rv = $subgroup->update();
      if ($rv) {
        my @selected_testcases = $c->param("subgroup_testcases");
        $subgroup->update_testcases(\@selected_testcases);
        $status = "success";
	$message = "Subgroup ID# $subgroup_id updated successfully.";
        $defaults->{'subgroup_id'} = $subgroup_id;
      } else {
	$status = "failure";
	$message = "Failed to update subgroup ID# $subgroup_id.";        
      }
    } else {
      $status = "failure";
      $message = "Subgroup ID# $subgroup_id not found.";        
    }
  } 
} else {
  $defaults->{'subgroup_id'} = $c->param("subgroup_id");
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

# and testgroups
my @tmp_testgroups;
foreach my $b (@{$testgroups}) {
	my %cur = %{$b};
	if ($authorized_products{$cur{product_id}}) {
		push(@tmp_testgroups, $b);
	}
}
$testgroups = \@tmp_testgroups;

# and of course, subgroups
my @tmp_subgroups;
foreach my $b (@{$subgroups}) {
	my %cur = %{$b};
	if ($authorized_products{$cur{product_id}}) {
		push(@tmp_subgroups, $b);
	}
}
$subgroups = \@tmp_subgroups;


my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);
my $testgroups_js = $json->objToJson($testgroups);
my $subgroups_js = $json->objToJson($subgroups);
my $testcases_js = $json->objToJson($testcases);

$vars->{'title'} = "Manage Subgroups";
$vars->{'products'} = $products;
$vars->{'subgroups'} = $subgroups;
$vars->{'products_js'} = $products_js;
$vars->{'branches_js'} = $branches_js;
$vars->{'testgroups_js'} = $testgroups_js;
$vars->{'subgroups_js'} = $subgroups_js;
$vars->{'testcases_js'} = $testcases_js;

$vars->{'user'} = Litmus::Auth::getCurrentUser();

my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);

print $c->header();

Litmus->template()->process("admin/manage_subgroups.tmpl", $vars) || 
  internalError("Error loading template.");
