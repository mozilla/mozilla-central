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
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Constants;

###############################################################################
# tr_new_run.cgi
# Presents a webform to the user for the creation of a new test run. 
# 
# INTERFACE:
#    plan_id: The id of the plan this run will belong to.
#                 If no plan_id is found, the user will first 
#                 be presented with a form to select a plan.
#
#    action: undef - Present form for new run creation
#            "Add" - Form has been submitted with run data. Create the test
#                    run.
#
################################################################################ 

my $vars = {};
my $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);
my $cgi = Bugzilla->cgi;
print $cgi->header;

my $action = $cgi->param('action') || '';
my $plan_id = $cgi->param('plan_id');

unless ($plan_id){
  $vars->{'form_action'} = 'tr_new_run.cgi';
  $template->process("testopia/plan/choose.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());
  exit;
}

validate_test_id($plan_id, 'plan');
my $plan = Bugzilla::Testopia::TestPlan->new($plan_id);
# Users need write permission on the plan in order to create a test run for
# that plan. See tr_plan_access.cgi
ThrowUserError("testopia-create-denied", {'object' => 'Test Run', 'plan' => $plan}) unless ($plan->canedit);

if ($action eq 'add'){
    Bugzilla->error_mode(ERROR_MODE_AJAX);
    
    my $build    = trim($cgi->param('build'));
    my $env      = trim($cgi->param('environment'));
    
    if ($cgi->param('new_build')){
        my $b = Bugzilla::Testopia::Build->create({
                'name'        => $cgi->param('new_build'),
                'milestone'   => '---',
                'product_id'  => $plan->product_id,
                'description' => '',
                'isactive'    => 1, 
        });
        $build = $b->id;
    }

    if ($cgi->param('new_env')){
        my $e = Bugzilla::Testopia::Environment->create({
                'name'        => $cgi->param('new_env'),
                'product_id'  => $plan->product_id,
                'isactive'    => 1,
        });
        $env = $e->id;
    }
    
    my $run = Bugzilla::Testopia::TestRun->create({
            'plan_id'           => $plan->id,
            'environment_id'    => $env,
            'build_id'          => $build,
            'product_version'   => $cgi->param('prod_version'),
            'plan_text_version' => $plan->version,
            'manager_id'        => $cgi->param('manager'),
            'summary'           => $cgi->param('summary'),
            'notes'             => $cgi->param('notes') || '',
            'status'            => 1,
    });
    
    if ($cgi->param('getall')){
        $cgi->delete_all;
        $cgi->param('plan_id', $plan->id);
        $cgi->param('current_tab', 'case');
        $cgi->param('case_status', 'CONFIRMED');
        $cgi->param('viewall', 1);
        my $search = Bugzilla::Testopia::Search->new($cgi);
        my $ref = Bugzilla->dbh->selectcol_arrayref($search->query);
        foreach my $case_id (@$ref){
            $run->add_case_run($case_id);
        }
    }
    else {
        foreach my $case_id (split(',', $cgi->param('case_ids'))){
            $run->add_case_run($case_id);
        }
    }
    print "{success: true, run_id: " . $run->id ."}"; 
}

####################
### Display Form ###
####################
else {
    $vars->{'plan'} = $plan;
    $vars->{'case'} = Bugzilla::Testopia::TestCase->new({});
    $template->process("testopia/run/add.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
}
