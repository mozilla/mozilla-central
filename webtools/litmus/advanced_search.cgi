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

my $t0;
if ($Litmus::Config::DEBUG) {
  use Time::HiRes qw( gettimeofday tv_interval );
  $t0 = [gettimeofday];
}

use JSON;
use Litmus;
use Litmus::Auth;
use Litmus::Cache;
use Litmus::Error;
use Litmus::DB::Testresult;
use Litmus::FormWidget;

use CGI;
use Time::Piece::MySQL;

Litmus->init();
my $c = Litmus->cgi();
print $c->header();

# Hash refs for maintaining state in the search form.
my $defaults = undef;
my $order_bys = undef;

my $MAX_SORT_FIELDS = 10;
my $MAX_SEARCH_FIELDS = 10;

my $criteria = "Custom<br/>";
my ($results, $pager);
my @where;
my @order_by;
my $limit;
my $where_criteria = "";
my $order_by_criteria = "";
my $limit_criteria = "";
my $page = 1;

my $cookie =  Litmus::Auth::getCookie();
my $is_admin = Litmus::Auth::istrusted($cookie);

if ($c->param) {    

    foreach my $param ($c->param) {
        next if ($c->param($param) eq '');
        if ($param eq 'page') {
            $page = $c->param($param);
            if ($page !~ /^\d+$/) {
                $page = 1;
            }
            next;
        }
        
        if ($param =~ /sort_field(\d+)/) {
            # We slot sort fields into the @order_by array based on their
            # field_num. Empty array slots will be ignored when the SQL 
            # is built. We set an upper limit on the number of sort fields 
            # we can handle to prevent abuse.
            my $field_num = $1;
            next if ($field_num > $MAX_SORT_FIELDS);
            my $sort_field = $c->param($param);
            my $sort_order = 'ASC';
            if ($c->param("sort_order$field_num")) {
                $sort_order = $c->param("sort_order$field_num");
            }
            $order_by[$field_num] = { field => $sort_field,
                                      direction => $sort_order};

        } elsif ($param =~ /search_field(\d+)/) {
            # We set an upper limit on the number of search fields 
            # we can handle to prevent abuse.
            my $field_num = $1;
            next if ($field_num > $MAX_SEARCH_FIELDS);
            my $search_field = $c->param($param);
            my $match_criteria = $c->param("match_criteria$field_num");
            my $value = $c->param("search_value$field_num");
            my $display_value = $value;
            # Upgrade to utf8 prior to search. 
            utf8::upgrade($value);
            push @where, { 'field' => 'search_field',
                           'search_field' => $search_field,
                           'match_criteria' => $match_criteria,
                           'value' => $value};
            utf8::decode($display_value);
            $where_criteria .= ucfirst $search_field . " $match_criteria '$display_value'<br/>";

        } elsif ($param eq 'start_date') {
            my $start_date = $c->param($param);
            $start_date =~ s/[^0-9A-Za-z ]/ /g;
            my $end_date;
            # Use 'now' as the default end date.
            if ($c->param('end_date') and $c->param('end_date') ne '') {
                $end_date = $c->param('end_date');
                $end_date =~ s/[^0-9A-Za-z ]/ /g;
            } else {
                $end_date = 'Now';
            }
            push @where, { field => 'start_date',
                           value => $start_date};
            push @where, { field => 'end_date',
                           value => $end_date};
            $where_criteria .= "Date between '$start_date' and '$end_date'<br/>";
        } elsif ($param eq 'trusted_only') {
            my $value = $c->param($param);
            if ($value ne 'all') {
              if ($value eq '1' or $value eq 'on') {
                push @where, {field => 'trusted_only',
                            value => 1};            
                $limit_criteria .= "Display trusted results only<br/>";
              } else {
                push @where, {field => 'trusted_only',
                            value => '0E0'};            
                $limit_criteria .= "Display untrusted results only<br/>";
              }
            }
        } elsif ($param eq 'valid_only') {
            my $value = $c->param($param);
            if ($value ne 'all') {
              if ($value eq '1') {
                push @where, {field => 'valid_only',
                              value => 1};
               $limit_criteria .= "Display valid results only<br/>";
              } else {
                push @where, {field => 'valid_only',
                              value => '0E0'};
               $limit_criteria .= "Display invalid results only<br/>";
              }
            }
        } elsif ($param eq 'vetted_only') {
            my $value = $c->param($param);
            if ($value ne 'all') {
              if ($value eq '1') {
                push @where, {field => 'vetted_only',
                              value => 1};            
                $limit_criteria .= "Display vetted results only<br/>";
              } else {
                push @where, {field => 'vetted_only',
                              value => '0E0'};            
                $limit_criteria .= "Display unvetted results only<br/>";
              }
            }
        } elsif ($param eq 'automated') {
            my $value = $c->param($param);
            if ($value ne 'all') {
              if ($value eq '1') {
                push @where, {field => 'automated',
                              value => 1};            
                $limit_criteria .= "Display automated results only<br/>";
              } else {
                push @where, {field => 'automated',
                              value => '0E0'};            
                $limit_criteria .= "Display manual results only<br/>";
              }
            }
        } elsif ($param eq 'withbugs') {
            my $value = $c->param($param);
            if ($value ne 'all') {
              if ($value eq '1') {
                push @where, {field => 'withbugs',
                              value => 1};            
                $limit_criteria .= "Results with associated bugs<br/>";
              } else {
                push @where, {field => 'withbugs',
                              value => '0E0'};            
                $limit_criteria .= "Results without associated bugs<br/>";
              }
            }
        } elsif ($param eq 'my_results_only') {
            push @where, {field => 'user_id',
                          value => $cookie->{'user_id'}};
            $limit_criteria .= "Display <em>my</em> results only<br/>";
        } elsif ($param eq "limit") {
            $limit = $c->param($param);
            next if ($limit == $Litmus::DB::Testresult::_num_results_default);
            $limit_criteria .= "Limit to $limit results per page<br/>";
        } elsif ($param eq 'locale') {
            my $value = $c->param($param);
            push @where, {field => 'locale',
                          value => $value};
            $where_criteria .= "Locale is \'".$c->param($param)."\'<br/>";
            $defaults->{locale} =  $c->param($param);
        } elsif ($param eq 'email') {
            my $value = $c->param($param);
            push @where, {field => 'email',
                          value => $value};
            $where_criteria .= "Submitted By is \'".$c->param($param)."\'<br/>";
            $defaults->{locale} =  $c->param($param);
        } elsif ($param eq 'product') {
            my $value = $c->param($param);
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
            $defaults->{product} = $c->param($param);
        } elsif ($param eq 'branch') {
            my $value = $c->param($param);
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
            $defaults->{branch} =  $c->param($param);
        } elsif ($param eq 'test_run') {
            my $value = $c->param($param);
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Test Run ID# is \'".$c->param($param)."\'<br/>";
            $defaults->{testgroup} = $c->param($param);
        } elsif ($param eq 'testgroup' or $param eq 'test_group') {
            my $value = $c->param($param);
            if ($value =~ /^\d+$/) {
              push @where, {field => $param,
                            value => $value};
              my $testgroup = Litmus::DB::Testgroup->retrieve($value);
              $where_criteria .= "Testgroup is \'".$testgroup->{'name'}."\'<br/>";
            } else {
              push @where, {field => 'testgroup_name',
                            value => $value};
              $where_criteria .= "Testgroup is \'".$c->param($param)."\'<br/>";
            }
            $defaults->{testgroup} = $c->param($param);
        } elsif ($param eq 'subgroup') {
            my $value = $c->param($param);
            if ($value =~ /^\d+$/) {
              push @where, {field => $param,
                            value => $value};
              my $subgroup = Litmus::DB::Subgroup->retrieve($value);
              $where_criteria .= "Subgroup is \'".$subgroup->{'name'}."\'<br/>";
            } else {
              push @where, {field => 'subgroup_name',
                            value => $value};
              $where_criteria .= "Subgroup is \'".$c->param($param)."\'<br/>";
            }
            $defaults->{subgroup} = $c->param($param);
        } elsif ($param eq 'testcase' or $param eq 'test_id') {
            my $value = $c->param($param);
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Testcase ID# is \'".$c->param($param)."\'<br/>";
            $defaults->{testcase_id} = $c->param($param);
        } elsif ($param eq 'platform') {
            my $value = $c->param($param);
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
            $defaults->{platform} = $c->param($param);
        } elsif ($param eq 'opsys') {
            my $value = $c->param($param);
            if ($value =~ /^\d+$/) {
              push @where, {field => $param,
                            value => $value};
              my $opsys = Litmus::DB::Opsys->retrieve($value);
              $where_criteria .= "Operating System is \'".$opsys->{'name'}."\'<br/>";
            } else {
              push @where, {field => 'opsys_name',
                            value => $value};
              $where_criteria .= "Operating System is \'".$c->param($param)."\'<br/>";
            }
            $defaults->{platform} = $c->param($param);
        } elsif ($param eq 'summary') {
            my $value = $c->param($param);
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Summary like \'".$c->param($param)."\'<br/>";
            $defaults->{summary} = $c->param($param);
        } elsif ($param eq 'locale') {
            my $value = $c->param($param);
            push @where, {field => 'locale',
                          value => $value};
            $where_criteria .= "Locale is \'".$c->param($param)."\'<br/>";
            $defaults->{locale} =  $c->param($param);
        } elsif ($param eq 'result_status') {
            my $value = $c->param($param);
            push @where, {field => $param,
                          value => $value};
            $where_criteria .= "Status is \'".$c->param($param)."\'<br/>";
            $defaults->{result_status} = $c->param($param);
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
        scalar(@order_by) == 0 and
        $limit_criteria eq '') {
        ($criteria,$results) = 
          Litmus::DB::Testresult->getDefaultTestResults;    
    } else {
        foreach my $order_by_field (@order_by) {
            next if (!$order_by_field);
            $order_by_criteria .= "Order by $order_by_field->{field} $order_by_field->{direction}<br/>";
        }

        $criteria .= $where_criteria . $order_by_criteria . $limit_criteria;
        $criteria =~ s/_/ /g;
        ($results,$pager) = Litmus::DB::Testresult->getTestResults(\@where,
                                                                   \@order_by,
                                                                   $limit,
                                                                   $page);
    }
}


# Only show enabled results/
my $enabled=1;
my $community_enabled=1;
if ($is_admin) {
  $enabled=0;
  $community_enabled=0;
}

# Populate each of our form widgets for select/input.
# Set a default value as appropriate.
my $products = Litmus::FormWidget->getProducts($enabled);
my $branches = Litmus::FormWidget->getBranches($enabled);
my $test_runs = Litmus::FormWidget->getTestRuns($enabled);
my $testgroups = Litmus::FormWidget->getTestgroups($enabled);
my $platforms = Litmus::FormWidget->getPlatforms;
my $opsyses = Litmus::FormWidget->getOpsyses;
my $locales = Litmus::FormWidget->getLocales;
my $result_statuses = Litmus::FormWidget->getResultStatuses;

my $users;
if ($is_admin) {
  $users = Litmus::FormWidget->getUsers;
}

my $json = JSON->new(skipinvalid => 1, convblessed => 1);
my $products_js = $json->objToJson($products);
my $branches_js = $json->objToJson($branches);
my $testgroups_js = $json->objToJson($testgroups);
my $opsyses_js = $json->objToJson($opsyses);

my $fields = Litmus::FormWidget->getFields;
my $match_criteria = Litmus::FormWidget->getMatchCriteria;
my $sort_fields = Litmus::FormWidget->getSortFields;

my $title = 'Advanced Search';

my $vars = {
    title => $title,
    criteria => $criteria,
    products_js => $products_js,
    branches_js => $branches_js,
    test_runs => $test_runs,
    testgroups_js => $testgroups_js,
    platforms => $platforms,
    opsyses_js => $opsyses_js,
    locales => $locales,
    result_statuses => $result_statuses,
    users => $users,
    fields => $fields,
    match_criteria => $match_criteria,
    sort_fields => $sort_fields,
};

# Only include results if we have them.
if ($results and scalar @$results > 0) {
  $vars->{results} = $results;  
}  elsif (!$c->param) {    
  $vars->{no_search} = 1;
}

if ($pager) {
    $vars->{pager} = $pager;
}

$vars->{"defaultemail"} = $cookie;
$vars->{"show_admin"} = $is_admin;

Litmus->template()->process("reporting/advanced_search.tmpl", $vars) || 
    internalError(Litmus->template()->error());

if ($Litmus::Config::DEBUG) {
  my $elapsed = tv_interval ( $t0 );
  printf  "<div id='pageload'>Page took %f seconds to load.</div>", $elapsed;
}

exit 0;
