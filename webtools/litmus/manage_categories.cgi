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
Litmus::Auth::requireProductAdmin("edit_categories.cgi");

my $c = Litmus->cgi();
print $c->header();

my $message;
my $status;
my $rv;
my $defaults;

if ($c->param) {
  # auth:
  # must be a super user for all changes but branch changes:
  if ((!Litmus::Auth::getCurrentUser()->isSuperUser()) && 
  	($c->param("product_id") || $c->param("edit_product_form_mode") ||
  	$c->param("platform_id") || $c->param("edit_platform_form_mode") ||
  	$c->param("opsys_id") || $c->param("edit_opsys_form_mode") || 
  	$c->param("edit_opsys_form_opsys_id"))) {
  		Litmus::Auth::requireAdmin("manage_categories.cgi");
  	}
  	
  # Process product changes.
  if ($c->param("delete_product_button") and 
      $c->param("product_id")) {
    my $product_id = $c->param("product_id");
    my $product = Litmus::DB::Product->retrieve($product_id);
    if ($product) {
      $rv = $product->delete_with_refs();
      if ($rv) {
        $status = "success";
        $message = "Product ID# $product_id deleted successfully.";
      } else {
        $status = "failure";
        $message = "Failed to delete Product ID# $product_id.";
      }
    } else { 
      $status = "failure";
      $message = "Product ID# $product_id does not exist. (Already deleted?)";
    }
  } elsif ($c->param("edit_product_form_mode")) {
    my $enabled = $c->param('edit_product_form_enabled') ? 1 : 0;
    if ($c->param("edit_product_form_mode") eq "add") {
      my %hash = ( 
                  name => $c->param('edit_product_form_name'),
                  iconpath => $c->param('edit_product_form_iconpath'),
                  enabled => $enabled,
                 );
      my $new_product = 
        Litmus::DB::Product->create(\%hash);
      if ($new_product) {
        # add a new security group by default for admins of the new product
        my $secgroup = Litmus::DB::SecurityGroup->create({
        	name => $new_product->name()." Administrators",
        	description => "Administrators of the ".$new_product->name()." product",
        	grouptype => 3,
        	isactive => 1,
        });
        Litmus::DB::GroupProductMap->create({group=>$secgroup, product=>$new_product});
      
        $status = "success";
        $message = "Product added successfully. New product ID# is " . $new_product->product_id;
        $defaults->{'product_id'} = $new_product->product_id;
      } else {
        $status = "failure";
        $message = "Failed to add product.";        
      }
    } elsif ($c->param("edit_product_form_mode") eq "edit") {
      my $product_id = $c->param("edit_product_form_product_id");
      my $product = Litmus::DB::Product->retrieve($product_id);
      if ($product) {
        $product->name($c->param('edit_product_form_name'));
        $product->iconpath($c->param('edit_product_form_iconpath') ? $c->param('edit_product_form_iconpath') : '');
        $product->enabled($enabled);
        $rv = $product->update();
        if ($rv) {
          $status = "success";
          $message = "Product ID# $product_id updated successfully.";
          $defaults->{'product_id'} = $product_id;
        } else {
          $status = "failure";
          $message = "Failed to update product ID# $product_id.";        
        }
      } else {
        $status = "failure";
        $message = "Product ID# $product_id not found.";        
      }
    }
  }

  # Process platform changes.
  if ($c->param("delete_platform_button") and 
      $c->param("platform_id")) {
    my $platform_id = $c->param("platform_id");
    my $platform = Litmus::DB::Platform->retrieve($platform_id);
    if ($platform) {
      $rv = $platform->delete_with_refs();
      if ($rv) {
        $status = "success";
        $message = "Platform ID# $platform_id deleted successfully.";
      } else {
        $status = "failure";
        $message = "Failed to delete Platform ID# $platform_id.";
      }
    } else { 
      $status = "failure";
      $message = "Platform ID# $platform_id does not exist. (Already deleted?)";
    }
  } elsif ($c->param("edit_platform_form_mode")) {
    if ($c->param("edit_platform_form_mode") eq "add") {
      my %hash = ( 
                  name => $c->param('edit_platform_form_name'),
                  iconpath => $c->param('edit_platform_form_iconpath'),
                  detect_regexp => $c->param('edit_platform_form_detect_regexp'),
                 );
      my $new_platform = 
        Litmus::DB::Platform->create(\%hash);
      if ($new_platform) {
        my @selected_products = $c->param("edit_platform_form_platform_products");
        $new_platform->update_products(\@selected_products);        
        $status = "success";
        $message = "Platform added successfully. New platform ID# is " . $new_platform->platform_id;
        $defaults->{'platform_id'} = $new_platform->platform_id;
      } else {
        $status = "failure";
        $message = "Failed to add platform.";        
      }
    } elsif ($c->param("edit_platform_form_mode") eq "edit") {
      my $platform_id = $c->param("edit_platform_form_platform_id");
      my $platform = Litmus::DB::Platform->retrieve($platform_id);
      if ($platform) {
        $platform->name($c->param('edit_platform_form_name'));
        $platform->iconpath($c->param('edit_platform_form_iconpath') ? $c->param('edit_platform_form_iconpath') : '');
        $platform->detect_regexp($c->param('edit_platform_form_detect_regexp') ? $c->param('edit_platform_form_detect_regexp') : '');
        $rv = $platform->update();
        if ($rv) {
          my @selected_products = $c->param("edit_platform_form_platform_products");
          $platform->update_products(\@selected_products);        
          $status = "success";
          $message = "Platform ID# $platform_id updated successfully.";
          $defaults->{'platform_id'} = $platform_id;
        } else {
          $status = "failure";
          $message = "Failed to update platform ID# $platform_id.";        
        }
      } else {
        $status = "failure";
        $message = "Platform ID# $platform_id not found.";        
      }
    }
  }

  # Process opsys changes.
  if ($c->param("delete_opsys_button") and 
      $c->param("opsys_id")) {
    my $opsys_id = $c->param("opsys_id");
    my $opsys = Litmus::DB::Opsys->retrieve($opsys_id);
    if ($opsys) {
      $rv = $opsys->delete;
      if ($rv) {
        $status = "success";
        $message = "Operating system ID# $opsys_id deleted successfully.";
      } else {
        $status = "failure";
        $message = "Failed to delete Operating system ID# $opsys_id.";
      }
    } else { 
      $status = "failure";
      $message = "Operating system ID# $opsys_id does not exist. (Already deleted?)";
    }
  } elsif ($c->param("edit_opsys_form_mode")) {
    if ($c->param("edit_opsys_form_mode") eq "add") {
      my %hash = ( 
                  name => $c->param('edit_opsys_form_name'),
                  platform_id => $c->param('edit_opsys_form_platform_id'),
                  detect_regexp => $c->param('edit_opsys_form_detect_regexp'),
                 );
      my $new_opsys = 
        Litmus::DB::Opsys->create(\%hash);
      if ($new_opsys) {
        $status = "success";
        $message = "Operating system added successfully. New operating system ID# is " . $new_opsys->opsys_id;
        $defaults->{'opsys_id'} = $new_opsys->opsys_id;
      } else {
        $status = "failure";
        $message = "Failed to add operating system.";        
      }
    } elsif ($c->param("edit_opsys_form_mode") eq "edit") {
      my $opsys_id = $c->param("edit_opsys_form_opsys_id");
      my $opsys = Litmus::DB::Opsys->retrieve($opsys_id);
      if ($opsys) {
        $opsys->name($c->param('edit_opsys_form_name'));
        $opsys->platform_id($c->param('edit_opsys_form_platform_id'));
        $opsys->detect_regexp($c->param('edit_opsys_form_detect_regexp') ? $c->param('edit_opsys_form_detect_regexp') : '');
        $rv = $opsys->update();
        if ($rv) {
          $status = "success";
          $message = "Operating system ID# $opsys_id updated successfully.";
          $defaults->{'opsys_id'} = $opsys_id;
        } else {
          $status = "failure";
          $message = "Failed to update operating system ID# $opsys_id.";
        }
      } else {
        $status = "failure";
        $message = "Operating systen ID# $opsys_id not found.";        
      }
    }
  }

  # Process branch changes.
  if ($c->param("delete_branch_button") and 
      $c->param("branch_id")) {
    my $branch_id = $c->param("branch_id");
    my $branch = Litmus::DB::Branch->retrieve($branch_id);
    if ($branch) {
      # must be a product admin
      Litmus::Auth::requireProductAdmin("manage_categories.cgi", $branch->product());
      $rv = $branch->delete;
      if ($rv) {
        $status = "success";
        $message = "Branch ID# $branch_id deleted successfully.";
      } else {
        $status = "failure";
        $message = "Failed to delete branch ID# $branch_id.";
      }
    } else { 
      $status = "failure";
      $message = "Branch ID# $branch_id does not exist. (Already deleted?)";
    }
  } elsif ($c->param("edit_branch_form_mode")) {
  	# need to be a product admin for the branch's product and for any
  	# product the branch may be moved into:
  	Litmus::Auth::requireProductAdmin("manage_categories", 
  		$c->param('edit_branch_form_product_id'));
  
    my $enabled = $c->param('edit_branch_form_enabled') ? 1 : 0;
    if ($c->param("edit_branch_form_mode") eq "add") {
      my %hash = ( 
                  name => $c->param('edit_branch_form_name'),
                  product_id => $c->param('edit_branch_form_product_id'),
                  detect_regexp => $c->param('edit_branch_form_detect_regexp'),
                  enabled => $enabled,
                 );
      my $new_branch = 
        Litmus::DB::Branch->create(\%hash);
      if ($new_branch) {
        $status = "success";
        $message = "Branch added successfully. New branch ID# is " . $new_branch->branch_id;
        $defaults->{'branch_id'} = $new_branch->branch_id;
      } else {
        $status = "failure";
        $message = "Failed to add branch.";
      }
    } elsif ($c->param("edit_branch_form_mode") eq "edit") {
      my $branch_id = $c->param("edit_branch_form_branch_id");
      my $branch = Litmus::DB::Branch->retrieve($branch_id);
      if ($branch) {
      	# must be a product admin to edit the branch:
      	Litmus::Auth::requireProductAdmin('manage_categories.cgi', 
      		$branch->product());
      	
        $branch->name($c->param('edit_branch_form_name'));
        $branch->product_id($c->param('edit_branch_form_product_id'));
        $branch->detect_regexp($c->param('edit_branch_form_detect_regexp') ? $c->param('edit_branch_form_detect_regexp') : '');
        $branch->enabled($enabled);
        $rv = $branch->update();
        if ($rv) {
          $status = "success";
          $message = "Branch ID# $branch_id updated successfully.";
          $defaults->{'branch_id'} = $branch_id;
        } else {
          $status = "failure";
          $message = "Failed to update branch ID# $branch_id.";
        }
      } else {
        $status = "failure";
        $message = "Branch ID# $branch_id not found.";        
      }
    }
  }

}

my $products = Litmus::FormWidget->getProducts();
my $platforms = Litmus::FormWidget->getPlatforms();
my $branches = Litmus::FormWidget->getBranches();
my $testgroups = Litmus::FormWidget->getTestgroups();
my $opsyses = Litmus::FormWidget->getOpsyses();
my $locales = Litmus::FormWidget->getLocales;

# if the user is not a superuser, only allow them access to the 
# branches they are product admins for
my $authorized_branches;
if (Litmus::Auth::getCurrentUser()->isSuperUser()) {
	$authorized_branches = $branches;
} else {
	my @tmp;
	foreach my $b (@{$branches}) {
		my %cur = %{$b};
		if (Litmus::Auth::getCurrentUser()->isProductAdmin($cur{product_id})) {
			push(@tmp, $b);
		}
	}
	$authorized_branches = \@tmp;
}
$branches = $authorized_branches;

my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);
my $testgroups_js = $json->objToJson($testgroups);

my $vars = {
            title => 'Manage Categories',
            products => $products,
            platforms => $platforms,
            branches => $branches,
            opsyses => $opsyses,
            locales => $locales,
           };
  
$vars->{'products_js'} = $products_js;
$vars->{'branches_js'} = $branches_js;
$vars->{'testgroups_js'} = $testgroups_js;

if ($status and $message) {
  $vars->{'onload'} = "toggleMessage('$status','$message');";
}

my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);

Litmus->template()->process("admin/edit_categories.tmpl", $vars) ||
  internalError(Litmus->template()->error());

#my $elapsed = tv_interval ( $t0 );
#printf  "<div id='pageload'>Page took %f seconds to load.</div>", $elapsed;

exit 0;






