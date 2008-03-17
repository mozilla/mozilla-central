#!/usr/bin/perl -wT
# -*- Mode: perl; indent-tabs-mode: nil -*-
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
# The Original Code is the Bugzilla Test Runner System.
#
# The Initial Developer of the Original Code is Maciej Maczynski.
# Portions created by Maciej Maczynski are Copyright (C) 2001
# Maciej Maczynski. All Rights Reserved.
#
# Contributor(s): Maciej Maczynski <macmac@xdsnet.pl>
#                 Ed Fuentetaja <efuentetaja@acm.org>
#                 Greg Hendricks <ghendricks@novell.com>

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Testopia::Constants;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Classification;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::Environment::Category;
use Bugzilla::Testopia::Environment::Element;
use Bugzilla::Testopia::Environment::Property;
use JSON;

local our $vars = {};

my $dbh = Bugzilla->dbh;
local our $cgi = Bugzilla->cgi;
local our $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);
Bugzilla->error_mode(ERROR_MODE_AJAX);

sub get_searchable_objects{
    my $object = shift;
    my $dbh = Bugzilla->dbh;

    my $products = Bugzilla->user->get_selectable_products;
    my @ids;
    foreach my $p (@{$products}){
        push @ids, $p->id;
    }
    my $ref;
    SWITCH: for ($object) {
      /^components/ && do {
        $ref = $dbh->selectall_arrayref(
            "SELECT DISTINCT name AS id, name
             FROM components WHERE product_id IN (". join(",",@ids) .")
             ORDER BY name", {'Slice'=>{}});
        last SWITCH;
      };
      
      /^categories/ && do {
        $ref = $dbh->selectall_arrayref(
            "SELECT DISTINCT name AS id, name
             FROM test_case_categories WHERE product_id IN (". join(",",@ids) .")
             ORDER BY name", {'Slice'=>{}});
        last SWITCH;
      };
      
      /^builds/ && do {    
        $ref = $dbh->selectall_arrayref(
            "SELECT DISTINCT name AS id, name
             FROM test_builds WHERE product_id IN (". join(",",@ids) .")
             ORDER BY name", {'Slice'=>{}});
        last SWITCH;
      };
      
      /^versions/ && do {
        $ref = $dbh->selectall_arrayref(
            "SELECT DISTINCT value AS id, value AS name
             FROM versions WHERE product_id IN (". join(",",@ids) .")
             ORDER BY name", {'Slice'=>{}});
        last SWITCH;
      };
      
      /^milestones/ && do {
        $ref = $dbh->selectall_arrayref(
            "SELECT DISTINCT value AS id, value AS name
             FROM milestones WHERE product_id IN (". join(",",@ids) .")
             ORDER BY name", {'Slice'=>{}});
        last SWITCH;
      };
      
      /^environments/ && do {
        $ref = $dbh->selectall_arrayref(
            "SELECT DISTINCT name AS id, name
             FROM test_environments WHERE product_id IN (". join(",",@ids) .")
             ORDER BY name", {'Slice'=>{}});
        last SWITCH;
      };
    }
    return $ref;             
}

my $action = $cgi->param('action') || '';
    
if ($action eq 'getversions'){
    print $cgi->header;
    my @prod_ids = split(",", $cgi->param('prod_ids'));
    my $tab = $cgi->param('current_tab') || '';
    my $plan = Bugzilla::Testopia::TestPlan->new({});
    
    my $products;
    my @validated;
    foreach my $p (@prod_ids){
        detaint_natural($p);
        validate_selection($p,'id','products');
        my $prod = $plan->lookup_product($p);
        push @validated, $p if Bugzilla->user->can_see_product($prod);
    }
    unless (scalar @validated > 0){
        print "{}";
        exit; 
    }
    my $prod_ids = join(",", @validated);
    my $dbh = Bugzilla->dbh;
    $products->{'version'}     = $dbh->selectcol_arrayref("SELECT DISTINCT value FROM versions WHERE product_id IN ($prod_ids)");
    $products->{'milestone'}   = $dbh->selectcol_arrayref("SELECT DISTINCT value FROM milestones WHERE product_id IN ($prod_ids)");
    $products->{'component'}   = $dbh->selectcol_arrayref("SELECT DISTINCT name FROM components WHERE product_id IN ($prod_ids)");
    $products->{'build'}       = $dbh->selectcol_arrayref("SELECT DISTINCT name FROM test_builds WHERE product_id IN ($prod_ids)");
    $products->{'category'}    = $dbh->selectcol_arrayref("SELECT DISTINCT name FROM test_case_categories WHERE product_id IN ($prod_ids)");
    $products->{'environment'} = $dbh->selectcol_arrayref("SELECT DISTINCT name FROM test_environments WHERE product_id IN ($prod_ids)");
    
    # This list must match the name of the select fields and the names above
    $products->{'selectTypes'} = [qw{version milestone component build category environment}];

    my $json = new JSON;
    $json->autoconv(0);
    print "{'success': true, objects: " .  $json->objToJson($products) . "}";
}

elsif ($action eq 'get_products'){
    print $cgi->header;
    my @prod;
    if (Bugzilla->params->{'useclassification'}){
        my @classes = $cgi->param('class_ids');
        foreach my $id (@classes){
            my $class = Bugzilla::Testopia::Classification->new($id);
            push @prod, @{$class->user_visible_products};
        }
    }
    else {
        @prod = Bugzilla->user->get_selectable_products;
    }
    
    my $ret;
    foreach my $e (@prod){
        $ret .= $e->{'id'}.'||'.$e->{'name'}.'|||';
    }
    chop($ret);
    print $ret;
}

elsif ($action eq 'get_categories'){
    print $cgi->header;
    my @prod_ids = $cgi->param('prod_id');
    my $ret;
    
    foreach my $prod_id (@prod_ids){
        detaint_natural($prod_id);
        my $cat = Bugzilla::Testopia::Environment::Category->new({});
        my $cats_ref = $cat->get_element_categories_by_product($prod_id);
        
        foreach my $e (@{$cats_ref}){
             $ret .= $e->id.'||'.$e->name.'|||';
        }
    }
    chop($ret);
    print $ret;
}
elsif ($action eq 'get_elements'){
    print $cgi->header;
    my @cat_ids = $cgi->param('cat_id');
    my $ret;
    my @elmnts;
    
    foreach my $cat_id (@cat_ids){
        detaint_natural($cat_id);
        
        my $cat = Bugzilla::Testopia::Environment::Category->new($cat_id);
        my $elmnts_ref = $cat->get_elements_by_category($cat->{'name'});
        
        foreach my $e (@{$elmnts_ref}){
            push @elmnts, Bugzilla::Testopia::Environment::Element->new($e->{'element_id'});
        }
    }
    
    foreach my $e (@elmnts){
        $ret .= $e->id.'||'.$e->name.'|||';
    }
    chop($ret);
    print $ret;
}

elsif ($action eq 'get_properties'){
    print $cgi->header;
    my @elmnt_ids = $cgi->param('elmnt_id');
    my $ret;
    
    foreach my $elmnt_id (@elmnt_ids){
        detaint_natural($elmnt_id);
        
        my $elmnt = Bugzilla::Testopia::Environment::Element->new($elmnt_id);
        my $props = $elmnt->get_properties();
        
        foreach my $e (@{$props}){
            $ret .= $e->id.'||'.$e->name.'|||';
        }
    }
    chop($ret);
    print $ret;
}
elsif ($action eq 'get_valid_exp'){
    print $cgi->header;
    my @prop_ids = $cgi->param('prop_id');
    my $ret;
    
    foreach my $prop_id (@prop_ids){
        detaint_natural($prop_id);
        
        my $prop = Bugzilla::Testopia::Environment::Property->new($prop_id);
        my $exp = $prop->validexp;
    
        my @exps = split /\|/, $exp;
        foreach my $exp (@exps){
            $ret .=$exp.'|||';
        }
    }
    chop($ret);    
    print $ret;
}
elsif ($action eq 'save_query'){
    print $cgi->header;
    my $query = $cgi->param('query_part');
    my $qname = $cgi->param('query_name');
    my $type = $cgi->param('type');
    
    ThrowUserError('query_name_missing') unless $qname;
    
    trick_taint($query);
    trick_taint($qname);
    detaint_natural($type);
    $type ||= SAVED_SEARCH;
     
    my ($name) = $dbh->selectrow_array(
        "SELECT name 
           FROM test_named_queries 
          WHERE userid = ? 
            AND name = ?",
            undef,(Bugzilla->user->id, $qname));
            
    if ($name){
        $dbh->do(
            "UPDATE test_named_queries 
                SET query = ?
              WHERE userid = ? 
                AND name = ?",
                undef,($query, Bugzilla->user->id, $qname));
        $vars->{'tr_message'} = "Updated saved search '$qname'";
    }
    else{
        my $quoted_qname = url_quote($qname);
        $query .= "&qname=$quoted_qname";
        $dbh->do("INSERT INTO test_named_queries 
                  VALUES(?,?,?,?,?)",
                  undef, (Bugzilla->user->id, $qname, 1, $query, $type)); 
        
        $vars->{'tr_message'} = "Search saved as '$qname'";
    }
    
    print "{'success': true}";
}
elsif ($action eq 'delete_query'){
    print $cgi->header;
    my $qname = $cgi->param('query_name');
    
    trick_taint($qname);
    
    $dbh->do("DELETE FROM test_named_queries WHERE userid = ? AND name = ?",
    undef, (Bugzilla->user->id, $qname));
    $vars->{'tr_message'} = "Testopia Saved Search '$qname' Deleted";
    
    print "{'success': true}";
}

elsif ($action eq 'get_saved_searches'){
    print $cgi->header;
    my $type = $cgi->param('type');
    detaint_natural($type);
    $type ||= SAVED_SEARCH;
    
    my $ref = $dbh->selectall_arrayref(
        "SELECT tnq.name, query, profiles.realname AS author, type
           FROM test_named_queries AS tnq
           INNER JOIN profiles ON tnq.userid = profiles.userid
          WHERE tnq.userid = ? AND isvisible = 1 
            AND type = ?",
            {'Slice' =>{}} ,(Bugzilla->user->id, $type));
    
    print $cgi->header;
    print "{'searches':" . objToJson($ref) . "}";
}

else{
   
    #TODO: Support default query
    my $tab = $cgi->param('current_tab') || '';
    if ($tab eq 'plan'){
        $vars->{'plan'} = Bugzilla::Testopia::TestPlan->new({});
        $vars->{'title'} = "Search For Test Plans";
        $vars->{'versions'} = get_searchable_objects('versions');
    }
    elsif ($tab eq 'run'){
        $vars->{'title'}        = "Search For Test Runs";
        $vars->{'run'}          = Bugzilla::Testopia::TestRun->new({});;
        $vars->{'versions'}     = get_searchable_objects('versions');
        $vars->{'milestones'}   = get_searchable_objects('milestones');
        $vars->{'builds'}       = get_searchable_objects('builds');
        $vars->{'environments'} = get_searchable_objects('environments');
    }
    elsif ($tab eq 'environment'){
        $vars->{'title'} = "Search For Test Run Environments";
        $vars->{'classifications'} = Bugzilla->user->get_selectable_classifications;
        $vars->{'products'} = Bugzilla->user->get_selectable_products;
        $vars->{'env'} = Bugzilla::Testopia::Environment->new({});
    }
    elsif ($tab eq 'case_run'){
        $vars->{'title'} = "Search For Test Case-Runs";
        $vars->{'case'} = Bugzilla::Testopia::TestCase->new({});
        $vars->{'run'} = Bugzilla::Testopia::TestRun->new({});
        $vars->{'caserun'} = Bugzilla::Testopia::TestCaseRun->new({});

        $vars->{'versions'}     = get_searchable_objects('versions');
        $vars->{'milestones'}   = get_searchable_objects('milestones');
        $vars->{'builds'}       = get_searchable_objects('builds');
        $vars->{'environments'} = get_searchable_objects('environments');
        $vars->{'components'}   = get_searchable_objects('components');
        $vars->{'categories'}   = get_searchable_objects('categories');
    }
    elsif ($tab eq 'case') {
        $tab = 'case';
        my $case = Bugzilla::Testopia::TestCase->new({ 'case_id' => 0 });
        $vars->{'title'} = "Search For Test Cases";
        $vars->{'case'} = $case;
        $vars->{'components'} = get_searchable_objects('components');
        $vars->{'categories'} = get_searchable_objects('categories');
    }
    else{
        print "Location: tr_show_product.cgi?search=1 \n\n";
        exit;
    }
    print $cgi->header;
    $vars->{'report'} = $cgi->param('report');
    $vars->{'current_tab'} = $tab;
    $template->process("testopia/search/advanced.html.tmpl", $vars)
        || ThrowTemplateError($template->error()); 
}
