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
# The Original Code is the Bugzilla Testopia System.
#
# The Initial Developer of the Original Code is Greg Hendricks.
# Portions created by Greg Hendricks are Copyright (C) 2006
# Novell. All Rights Reserved.
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Config;
use Bugzilla::Error;
use Bugzilla::Util;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::Classification;
use Bugzilla::Testopia::Constants;

use JSON;

use vars qw($vars);

Bugzilla->login(LOGIN_REQUIRED);

my $template = Bugzilla->template;
my $cgi = Bugzilla->cgi;

my $action = $cgi->param('action') || '';
my $term = trim($cgi->param('query')) || '';

push @{$::vars->{'style_urls'}}, 'testopia/css/default.css';

# Quicksearch allows a user to look up any of the major objects in Testopia 
# using a simple prefix. For instance, e:linux will search for all environments
# with linux in the name or tr 33 will bring up Test Run 33.
# If only one is returned, we jump to the appropriate page, otherwise 
# we display the list.

# If we have a term we are using this quicksearch 
if ($term){
    SWITCH: for ($term){
        /^(tag)?[\s:-]+(.*)$/i && do{
            my $text = trim($2);
            print "Location: " . Bugzilla->params->{'urlbase'} . "tr_tags.cgi?tag=" . $text . "\n\n";
            last SWITCH;
        };
        /^(plan|TP|p)?[\s:-]+(.*)$/i && do{
            my $text = trim($2);
            if ($text =~ /^\d+$/){
                print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_plan.cgi?plan_id=" . $text . "\n\n";
            }
            else{
                $cgi->param('current_tab', 'plan');
                $cgi->param('name_type', 'anywordssubstr');
                $cgi->param('name', $text);
                
                my $search = Bugzilla::Testopia::Search->new($cgi);
                my $table = Bugzilla::Testopia::Table->new('plan', 'tr_list_plans.cgi', $cgi, undef, $search->query);
                if ($table->list_count == 1){
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_plan.cgi?plan_id=" . ${$table->list}[0]->id . "\n\n";
                }
                else{
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_list_plans.cgi?" . $table->get_query_part . "\n\n";
                }
                
            }
            last SWITCH;
        };
        /^(run|TR|r)?[\s:-]+(.*)$/i && do{
            my $text = trim($2);
            if ($text =~ /^\d+$/){
                print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_run.cgi?run_id=" . $text . "\n\n";
            }
            else{
                $cgi->param('current_tab', 'run');
                $cgi->param('summary_type', 'anywordssubstr');
                $cgi->param('summary', $text);
                
                my $search = Bugzilla::Testopia::Search->new($cgi);
                my $table = Bugzilla::Testopia::Table->new('run', 'tr_list_runs.cgi', $cgi, undef, $search->query);
                if ($table->list_count == 1){
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_run.cgi?run_id=" . ${$table->list}[0]->id . "\n\n";
                }
                else{
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_list_runs.cgi?" . $table->get_query_part . "\n\n";
                }
                
            }
            last SWITCH;
        };
        /^(environment|TE|e|env)?[\s:-]+(.*)$/i && do{
            my $text = trim($2);
            if ($text =~ /^\d+$/){
                print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_environment.cgi?env_id=" . $text . "\n\n";
            }
            else{
                $cgi->param('current_tab', 'environment');
                $cgi->param('name_type', 'anywordssubstr');
                $cgi->param('name', $text);
                
                my $search = Bugzilla::Testopia::Search->new($cgi);
                my $table = Bugzilla::Testopia::Table->new('environment', 'tr_list_runs.cgi', $cgi, undef, $search->query);
                if ($table->list_count == 1){
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_environment.cgi?env_id=" . ${$table->list}[0]->id . "\n\n";
                }
                else{
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_list_environments.cgi?" . $table->get_query_part . "\n\n";
                }
                
            }
            last SWITCH;
        };
        do{
            $term =~ s/^(case|TC|c)?[\s:-]+(.*)$/$2/gi;
            if ($term =~ /^\d+$/){
                print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_case.cgi?case_id=" . $term . "\n\n";
            }
            else{
                $cgi->param('current_tab', 'case');
                $cgi->param('summary_type', 'anywordssubstr');
                $cgi->param('summary', $term);
                
                my $search = Bugzilla::Testopia::Search->new($cgi);
                my $table = Bugzilla::Testopia::Table->new('case', 'tr_list_cases.cgi', $cgi, undef, $search->query);
                if ($table->list_count == 1){
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_show_case.cgi?case_id=" . ${$table->list}[0]->id . "\n\n";
                }
                else{
                    print "Location: " . Bugzilla->params->{'urlbase'} . "tr_list_cases.cgi?" . $table->get_query_part . "\n\n";
                }
                
            }
        };
    }
    
}
############
### Ajax ###
############

# This is where we lookup items typed into Dojo combo boxes
else{
    print $cgi->header;

# Environment Lookup
    if ($action eq 'getenvironments'){
        my $search = $cgi->param('search');
        my $prod_ids = $cgi->param('prod_id');
        trick_taint($search);
        my @ids;
        foreach my $id (split(',', $prod_ids)){
            push @ids, $id if detaint_natural($id);
        }
        unless (scalar @ids > 0){
            print "{}";
            exit;
        }
        $prod_ids = join(',', @ids);   
        
        $search = "%$search%";
        my $dbh = Bugzilla->dbh;
        
        # The order of name and environment are important in the select statment.
        # JSON will convert this to an array of arrays which Dojo will interpret
        # as a select list in the ComboBox widget.
        my $ref;
            
        if ($prod_ids){
            $ref = $dbh->selectall_arrayref(
                "SELECT test_environments.name AS name, test_environments.environment_id 
                   FROM test_environments 
                  WHERE name like ? AND product_id IN($prod_ids) AND isactive = 1
                  ORDER BY name",
                  undef, ($search));
        }
        else{
            $ref = $dbh->selectall_arrayref(
                "SELECT name, environment_id 
                   FROM test_environments 
                  WHERE name like ? AND isactive = 1
                  ORDER BY name
                  LIMIT 20",
                  undef, ($search));
        }
        print"{environments:";
        print objToJson($ref);
        print "}";  
    }
# user lookup
    elsif ($action eq 'getuser'){
        my $search = $cgi->param('search');
        my $start = $cgi->param('start');
        my $limit = 20;
        detaint_natural($start) || exit;
        exit if ($search eq '');
        $search = "%$search%";
        trick_taint($search);
        my $dbh = Bugzilla->dbh;

        my $countquery = "SELECT COUNT(DISTINCT login_name) ";        
        my $query  = "SELECT login_name, realname,";
        my $qbody = '';

        if (Bugzilla->params->{'usevisibilitygroups'}) {
            $query .= " COUNT(group_id) ";
        } else {
            $query .= " 1 ";
        }
        $qbody     .= "FROM profiles ";
        if (Bugzilla->params->{'usevisibilitygroups'}) {
            $qbody .= "LEFT JOIN user_group_map " .
                      "ON user_group_map.user_id = userid AND isbless = 0 " .
                      "AND group_id IN(" .
                      join(', ', (-1, @{Bugzilla->user->visible_groups_inherited})) . ")";
        }
        $qbody    .= " WHERE disabledtext = '' AND (login_name LIKE ? OR realname LIKE ?) ";
        
        
        $countquery .= $qbody;
        
        $query    .= $qbody;
        $query    .= $dbh->sql_group_by('userid', 'login_name, realname');
        $query    .= " ORDER BY login_name LIMIT $limit OFFSET $start";

        my ($total) = $dbh->selectrow_array($countquery,undef,($search,$search));
        
        my $sth = $dbh->prepare($query);
        $sth->execute($search,$search);

        my @userlist;
        while (my($login, $name, $visible) = $sth->fetchrow_array) {
            if ($visible){
                push @userlist, {
                    'id' => $login, 'name' => $name
                };
            }
        }
        print "{'total':$total,'users':";
        print objToJson(\@userlist);
        print "}"
    }
# Tag lookup
    elsif ($action eq 'gettag'){
        my $search = $cgi->param('search');
        my @product_ids;
        foreach my $id (split(",", $cgi->param('product_id'))){
            push @product_ids, $id if detaint_natural($id);
        }
        my $product_ids = join(",". @product_ids);
        
        trick_taint($search);
        $search = "%$search%";
        my $dbh = Bugzilla->dbh;
        my $ref;
        my $run_id = $cgi->param('run_id');
        if ($product_ids){
            $ref = $dbh->selectall_arrayref(
                "SELECT tag_name, test_tags.tag_id 
                     FROM test_tags
                    INNER JOIN test_case_tags ON test_tags.tag_id = test_case_tags.tag_id
                    INNER JOIN test_cases on test_cases.case_id = test_case_tags.case_id
                    INNER JOIN test_case_plans on test_case_plans.case_id = test_cases.case_id
                    INNER JOIN test_plans ON test_plans.plan_id = test_case_plans.plan_id
                    WHERE tag_name like ? AND test_plans.product_id IN ($product_ids)  
                 UNION SELECT tag_name, test_tags.tag_id
                     FROM test_tags
                    INNER JOIN test_plan_tags ON test_plan_tags.tag_id = test_tags.tag_id
                    INNER JOIN test_plans ON test_plan_tags.plan_id = test_plans.plan_id
                    WHERE tag_name like ? AND test_plans.product_id IN ($product_ids)
                 UNION SELECT tag_name, test_tags.tag_id
                     FROM test_tags
                    INNER JOIN test_run_tags ON test_run_tags.tag_id = test_tags.tag_id
                    INNER JOIN test_runs ON test_runs.run_id = test_run_tags.run_id
                    INNER JOIN test_plans ON test_plans.plan_id = test_runs.plan_id
                    WHERE tag_name like ? AND test_plans.product_id IN ($product_ids)
                 ORDER BY tag_name",
                  {'Slice' =>{}}, ($search,$search,$search));
        }
        else {
            $ref = $dbh->selectall_arrayref(
                "SELECT tag_name, tag_id 
                   FROM test_tags 
                  WHERE tag_name like ?
                  ORDER BY tag_name
                  LIMIT 20",
                  {'Slice' =>{}}, $search);
        }
        print "{'tags':" . objToJson($ref) . "}";  
    }
    elsif ($action eq 'getversions'){
        my $plan = Bugzilla::Testopia::TestPlan->new({});
        my $prod_id = $cgi->param("product_id");
        my @versions;
        if ($prod_id == -1){
            # For update multiple from tr_list_plans
            push @versions, {'id' => "--Do Not Change--", 'name' => "--Do Not Change--"};
        }
        else{
            detaint_natural($prod_id);
            my $prod = $plan->lookup_product($prod_id);
            unless (Bugzilla->user->can_see_product($prod)){
                print '{ERROR:"You do not have permission to view this product"}';
                exit;
            }
            my $product = Bugzilla::Testopia::Product->new($prod_id);
            @versions = @{$product->versions};
        }
        my $json = new JSON;
        $json->autoconv(0);
        
        print "{versions:";
        print $json->objToJson(\@versions);
        print "}";
    }
    elsif ($action eq 'getmilestones'){
        my $product = Bugzilla::Testopia::Product->new($cgi->param("product_id"));
        exit unless $product->canedit;
        my $json = new JSON;
        $json->autoconv(0);
        print "{milestones:";
        print $json->objToJson($product->milestones);
        print "}";
    }
    elsif ($action eq 'getplantypes'){
        my $plan = Bugzilla::Testopia::TestPlan->new({});
        my $json = new JSON;
        print "{types:";
        print $json->objToJson($plan->get_plan_types());
        print "}";
    }
    elsif ($action eq 'getpriorities'){
        my $plan = Bugzilla::Testopia::TestCase->new({});
        my $json = new JSON;
        print "{priorities:";
        print $json->objToJson($plan->get_priority_list());
        print "}";
    }
    elsif ($action eq 'getcasestatus'){
        my $plan = Bugzilla::Testopia::TestCase->new({});
        my $json = new JSON;
        print "{statuses:";
        print $json->objToJson($plan->get_status_list());
        print "}";
    }
    elsif ($action eq 'getcaserunstatus'){
        my $plan = Bugzilla::Testopia::TestCaseRun->new({});
        my $json = new JSON;
        print "{statuses:";
        print $json->objToJson($plan->get_status_list());
        print "}";
    }
    
    elsif ($action eq 'getproducts'){
        my $products;
        my $json = new JSON;
        
        if ($cgi->param('class_id')){
            my $class = Bugzilla::Testopia::Classification->new($cgi->param('class_id'));
            $products = $class->user_visible_products;
        }
        else{
            $products = Bugzilla->user->get_selectable_products;
        }
        my @prods;
        foreach my $p (@$products){
            push @prods, {name => $p->name, id => $p->id};
        }
        print "{products:" . $json->objToJson(\@prods) . "}";
    }
    
    elsif ($action eq 'getclassificationstree'){
        my $node = $cgi->param('node');
        if ($node && $node ne 'classes'){
            $node =~ s/\D*//;
            my @products;
            my $classification = Bugzilla::Testopia::Classification->new($node);
            foreach my $p (@{$classification->user_visible_products}){
                push @products, {
                    id => $p->id, 
                    text => $p->name, 
                    leaf => 'true', 
                    attributes =>{ 
                        defaultmilestone => $p->default_milestone, 
                        canedit => $p->canedit ? 'true':'false'
                    }};
            }
            my $json = new JSON;
            print $json->objToJson(\@products);
            exit;
        }        
        my @classifications;
        foreach my $c (@{Bugzilla->user->get_selectable_classifications}){
            push @classifications, {id => "c" . $c->id, text => $c->name, leaf => scalar @{$c->products} > 0 ? 'false' : 'true'};
        }
        my $json = new JSON;
        print $json->objToJson(\@classifications);
    }
    # For use in new_case and show_case since new_plan does not require an id
    elsif ($action eq 'getcomponents'){
        my $plan = Bugzilla::Testopia::TestPlan->new({});
        my $product_id = $cgi->param('product_id');
    
        detaint_natural($product_id);
        my $prod = $plan->lookup_product($product_id);
        unless (Bugzilla->user->can_see_product($prod)){
            print '{ERROR:"You do not have permission to view this product"}';
            exit;
        }
        my $product = Bugzilla::Testopia::Product->new($product_id);
        
        my @comps;
        foreach my $c (@{$product->components}){
            push @comps, {'id' => $c->id, 'name' => $c->name, 'qa_contact' => $c->default_qa_contact->login};
        }
        my $json = new JSON;
        print "{'components':". $json->objToJson(\@comps) ."}";
        exit;
    }
    elsif ($action eq 'get_action'){
        print Bugzilla->params->{'new-case-action-template'};
    }
    elsif ($action eq 'get_effect'){
        print Bugzilla->params->{'new-case-results-template'};
        
    }

# If neither is true above, display the quicksearch form and explanation.
    else{
        $template->process("testopia/quicksearch.html.tmpl", $vars) ||
            ThrowTemplateError($template->error());
    }
}
