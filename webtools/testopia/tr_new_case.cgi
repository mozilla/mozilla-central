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
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Util;
use Bugzilla::User;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestCase;
use JSON;

###############################################################################
# tr_new_case.cgi
# Presents a webform to the user for the creation of a new test case. 
# 
# INTERFACE:
#    plan_id: list - list of plans that the newly created test case will
#                 be attached to. If no plan_id is found, the user will first 
#                 be presented with a form to select a plan.
#
#    action: undef - Present form for new case creation
#            "Add" - Form has been submitted with case data. Create the test
#                    case.
#
################################################################################ 

my $vars = {};

Bugzilla->login(LOGIN_REQUIRED);
   
my $cgi = Bugzilla->cgi;
my $template = Bugzilla->template;

print $cgi->header;

my $action = $cgi->param('action') || '';
my @plan_id = $cgi->param('plan_id');

unless ($plan_id[0]){
  $vars->{'product'} = Bugzilla::Testopia::Product->new({'name' => $cgi->param('product')}) if ($cgi->param('product'));
  $vars->{'bug_id'} = $cgi->param('bug');
  $vars->{'form_action'} = 'tr_new_case.cgi';
  $template->process("testopia/plan/choose.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());
  exit;
}
my %seen;
my @plans;
my @plan_ids;
my @categories;

# Weed out duplicates.
foreach my $entry (@plan_id){
    foreach my $id (split(/[\s,]+/, $entry)){
        detaint_natural($id);
        validate_test_id($id, 'plan');
        $seen{$id} = 1;
    }
}

# Users need write permission on the plan in order to create a test case against
# that plan. See tr_plan_access.cgi
foreach my $id (keys %seen){
    my $plan = Bugzilla::Testopia::TestPlan->new($id);
    ThrowUserError("testopia-create-denied", {'object' => 'Test Case', 'plan' => $plan}) unless $plan->canedit;
    push @plan_ids, $id;
    push @plans, $plan;
    push @categories, @{$plan->product->categories};
}

# We need at least one category in the list.
ThrowUserError('testopia-create-category', {'plan' => $plans[0] }) if scalar @categories < 1;

if ($action eq 'Add'){
    my @comps = $cgi->param("components");
    my $case = Bugzilla::Testopia::TestCase->create({
            'alias'          => $cgi->param('alias'),
            'case_status_id' => $cgi->param('status'),
            'category_id'    => $cgi->param('category'),
            'priority_id'    => $cgi->param('priority'),
            'isautomated'    => $cgi->param("isautomated"),
            'estimated_time' => $cgi->param("estimated_time"),
            'script'         => $cgi->param("script"),
            'arguments'      => $cgi->param("arguments"),
            'summary'        => $cgi->param("summary"),
            'requirement'    => $cgi->param("requirement"),
            'default_tester_id' => $cgi->param("tester"),
            'author_id'      => Bugzilla->user->id,
            'action'         => $cgi->param("tcaction"),
            'effect'         => $cgi->param("tceffect"),
            'setup'          => $cgi->param("tcsetup"),
            'breakdown'      => $cgi->param("tcbreakdown"),
            'dependson'      => $cgi->param("tcdependson"),
            'blocks'         => $cgi->param("tcblocks"),
            'tags'           => $cgi->param('addtags'),
            'runs'           => $cgi->param('addruns'),
            'bugs'           => $cgi->param('bugs'),
            'plans'          => \@plans,
            'components'     => \@comps,
            
    });

    $vars->{'action'} = "Commit";
    $vars->{'form_action'} = "tr_show_case.cgi";
    $vars->{'case'} = $case;
    $vars->{'tr_message'} = "Case ". $case->id ." Created. 
        <a href=\"tr_new_case.cgi?plan_id=" . join(",", @plan_ids) . "\">Add another</a>";
    $vars->{'backlink'} = $case;
    $template->process("testopia/case/show.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
    
}

####################
### Display Form ###
####################
else {
    
    my $summary;
    my $text;
    if( $cgi->param('bug')){
        my $bug;
        $bug = Bugzilla::Bug->new($cgi->param('bug'),Bugzilla->user->id);
        
        my $bug_id = $bug->bug_id;
        my $description = ${$bug->GetComments}[0];
        my $short_desc = $bug->short_desc; 
        
        $summary   = Bugzilla->params->{"bug-to-test-case-summary"};
        my $action = Bugzilla->params->{"bug-to-test-case-action"};
        my $effect = Bugzilla->params->{"bug-to-test-case-results"};
        
        $summary =~ s/%id%/$bug_id/g;
        $summary =~ s/%summary%/$short_desc/g;
        
        $action  =~ s/%id%/<a href="show_bug.cgi?id=$bug_id">$bug_id<\/a>/g;
        $action  =~ s/%description%/$description/g;
        
        $effect  =~ s/%id%/<a href="show_bug.cgi?id=$bug_id">$bug_id<\/a>/g;
        
        $text = {'action' => $action, 'effect' => $effect};
        
        $vars->{'bugs'} = $bug->bug_id;
    }
    else {
        $text = {'action' => Bugzilla->params->{"new-case-action-template"}, 
                 'effect' => Bugzilla->params->{"new-case-results-template"}};
    }
        
    my $case = Bugzilla::Testopia::TestCase->new(
                        {'plans' => \@plans,
                         'category' => {name => '--default--'}, 
                         'summary' =>  $summary,
                         'text' => $text,
    });
    my @comps;
    foreach my $comp (@{$case->get_selectable_components(1)}){
        push @comps, $comp->default_qa_contact->login;
    }
    
    $vars->{'case'} = $case;
    
    $vars->{'components'} = objToJson(\@comps);
    $vars->{'action'} = "Add";
    $vars->{'form_action'} = "tr_new_case.cgi";
    $template->process("testopia/case/add.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
}
