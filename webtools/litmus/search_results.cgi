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
use Litmus::DB::Testresult;
use Litmus::FormWidget;

use CGI;
use JSON;
use Time::Piece::MySQL;

Litmus->init();
my $c = Litmus->cgi(); 
print $c->header();

my $criteria = "Custom<br/>";
my ($results, $pager);
my @where;
my @order_by;
my $limit = $Litmus::DB::Testresult::_num_results_default;
my $where_criteria = "";
my $order_by_criteria = "";
my $limit_criteria = "";
my $page = 1;
if ($c->param) {    
    foreach my $param ($c->param) {
        if ($param eq 'page') {
            $page = $c->param($param);
            if ($page !~ /^\d+$/) {
                $page = 1;
            }
            next;
        }
        next if ($c->param($param) eq '');
        if ($param =~ /^order_by_(.*)$/) {
            my $order_by_proto = quotemeta($1);
            next if ($c->param($param) ne 'ASC' and
                     $c->param($param) ne 'DESC');
            my $order_by_direction = $c->param($param);
            push @order_by, {field => $order_by_proto,
                             direction => $order_by_direction};
            $order_by_criteria .= "Order by $order_by_proto $order_by_direction<br/>";
        } elsif ($param eq 'branch') {
            my $value = quotemeta($c->param($param));
           if ($value =~ /^\d+$/) {
                push @where, {field => $param,
                              value => $value};
                my $branch = Litmus::DB::Branch->retrieve($value);
                $where_criteria .= "Branch is \'".$branch->{'name'}."\'<br/>";
           } else {
                push @where, {field => 'branch_name',
                              value => $value};
                $where_criteria .= "Branch is \'".$c->param($param)."\'<br/>";
           }
        } elsif ($param eq 'locale') {
            my $value = quotemeta($c->param($param));
            push @where, {field => 'locale',
                          value => $value};
            $where_criteria .= "Locale is \'".$c->param($param)."\'<br/>";
        } elsif ($param eq 'product') {
            my $value = quotemeta($c->param($param));
            if ($value =~ /^\d+$/) {
                push @where, {field => $param,
                              value => $value};
                my $product = Litmus::DB::Product->retrieve($value);
                $where_criteria .= "Product is \'".$product->{'name'}."\'<br/>";
            } else {
                push @where, {field => 'product_name',
                              value => $value};
                $where_criteria .= "Product is \'".$c->param($param)."\'<br/>";                
            }
        } elsif ($param eq 'platform') {
            my $value = quotemeta($c->param($param));
            if ($value =~ /^\d+$/) {
                push @where, {field => $param,
                              value => $value};
                my $platform = Litmus::DB::Platform->retrieve($value);
                $where_criteria .= "Platform is \'".$platform->{'name'}."\'<br/>";
            } else {
                push @where, {field => 'platform_name',
                              value => $value};
                $where_criteria .= "Platform is \'".$c->param($param)."\'<br/>";
            }
        } elsif ($param =~ /^test_run/) {
            my $value = $c->param($param);
            push @where, {field => 'test_run',
                          value => $value};
            $where_criteria .= "Test Run ID# is \'".$c->param($param)."\'<br/>";
        } elsif ($param eq 'testgroup' or $param eq 'test_group') {
            my $value = $c->param($param);
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Testgroup is \'".$c->param($param)."\'<br/>";
        } elsif ($param eq 'subgroup') {
            my $value = $c->param($param);
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Subgroup is \'".$c->param($param)."\'<br/>";
        } elsif ($param eq 'testcase_id') {
            my $value = quotemeta($c->param($param));
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Testcase ID# is \'".$c->param($param)."\'<br/>";
        } elsif ($param eq 'summary') {
            my $value = quotemeta($c->param($param));
            my $display_value = $c->param($param);
            # Upgrade to utf8 prior to search. 
            utf8::upgrade($value);
            push @where, {field => $param,
                          value => $value};
            utf8::decode($display_value);
            $where_criteria .= "Summary like \'".$display_value."\'<br/>";
        } elsif ($param eq 'email') {            
            my $value = quotemeta($c->param($param));
            my $display_value = $c->param($param);
            # Upgrade to utf8 prior to search.
            utf8::upgrade($value);
            push @where, {field => $param,
                          value => $value};
            utf8::decode($display_value);
            $where_criteria .= "Submitted By like \'".$display_value."\'<br/>";
        } elsif ($param eq 'result_status') {
            my $value = quotemeta($c->param($param));
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Status is \'".$c->param($param)."\'<br/>";
        } elsif ($param eq 'timespan') {
            my $value = $c->param($param);
            if ($value ne 'all') {
                $value =~ s/[^\-0-9]//g;
                push @where, {field => $param,
                              value => $value};
                $value =~ s/\-//g;
                if ($value == 1) {
                    $where_criteria .= "Submitted in the last day<br/>";
                } else {
                    $where_criteria .= "Submitted in the last $value days<br/>";
                }
            } else {
                $where_criteria .= "All Results<br/>";
            }
        } elsif ($param eq "limit") {
            $limit = quotemeta($c->param($param));
            next if ($limit == $Litmus::DB::Testresult::_num_results_default);
            $limit_criteria .= "Limit to $limit results per page";
        } elsif ($param eq "has_comments") {
          my $value = quotemeta($c->param($param));
          push @where, {field => $param,
                        value => $value};
          $where_criteria .= "Has comments<br/>";          
        } else {
            # Skip unknown field
        }
    }
    if ($where_criteria eq '' and 
        $order_by_criteria eq '' and
        $limit_criteria eq '') {
        ($criteria,$results,$pager) = 
          Litmus::DB::Testresult->getDefaultTestResults($page);    
    } else {
        $criteria .= $where_criteria . $order_by_criteria . $limit_criteria;
        $criteria =~ s/_/ /g;
        ($results,$pager) = Litmus::DB::Testresult->getTestResults(\@where,
                                                                   \@order_by,
                                                                   $limit,
                                                                   $page);
    }
} else {
    ($criteria,$results,$pager) = 
      Litmus::DB::Testresult->getDefaultTestResults($page);    
}

# Populate each of our form widgets for select/input.
# Set a default value as appropriate.
my $products = Litmus::FormWidget->getProducts;
my $platforms = Litmus::FormWidget->getUniquePlatforms;
my $test_groups = Litmus::FormWidget->getTestgroups;
my $result_statuses = Litmus::FormWidget->getResultStatuses;
my $branches = Litmus::FormWidget->getBranches;
my $locales = Litmus::FormWidget->getLocales;

my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);

my $title = 'Search Test Results';

my $vars = {
    title => $title,
    criteria => $criteria,
    products => $products,
    branches => $branches,
    products_js => $products_js,
    branches_js => $branches_js,
    platforms => $platforms,
    test_groups => $test_groups,
    result_statuses => $result_statuses,
    branches => $branches,
    locales => $locales,
    limit => $limit,
};

# Only include results if we have them.
if ($results and scalar @$results > 0) {
    $vars->{results} = $results;
}

if ($pager) {
    $vars->{pager} = $pager;
}

my $cookie =  Litmus::Auth::getCookie();
$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = Litmus::Auth::istrusted($cookie);

Litmus->template()->process("reporting/search_results.tmpl", $vars) || 
    internalError(Litmus->template()->error());

exit 0;










