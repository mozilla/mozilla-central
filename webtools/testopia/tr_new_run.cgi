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
use Bugzilla::Testopia::Table;

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
my $query_limit = 10000;

Bugzilla->login(LOGIN_REQUIRED);
my $cgi = Bugzilla->cgi;

my $action = $cgi->param('action') || '';
my $plan_id = $cgi->param('plan_id');

unless ($plan_id){
  $vars->{'form_action'} = 'tr_new_run.cgi';
  print $cgi->header;
  $template->process("testopia/plan/choose.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());
  exit;
}

detaint_natural($plan_id);
validate_test_id($plan_id, 'plan');

my $plan = Bugzilla::Testopia::TestPlan->new($plan_id);
# Users need write permission on the plan in order to create a test run for
# that plan. See tr_plan_access.cgi
unless ($plan->canedit){
    print $cgi->header;
    ThrowUserError("testopia-create-denied", {'object' => 'Test Run', 'plan' => $plan});
}
# We need at least one build on the product in order to create a run.
unless (scalar @{$plan->product->builds(1)} > 0){
    print $cgi->header;
    ThrowUserError('testopia-create-build', {'plan' => $plan});
}

if ($action eq 'Add'){
    # There might be a lot of cases to add which could cause a timeout from 
    # a web proxy. Show a progress bar to keep the client happy.
    my $serverpush = support_server_push($cgi);
    if ($serverpush) {
        print $cgi->multipart_init;
        print $cgi->multipart_start;

        # Under mod_perl, flush stdout so that the page actually shows up.
        if ($ENV{MOD_PERL}) {
            require Apache2::RequestUtil;
            Apache2::RequestUtil->request->rflush();
        }
    
        $template->process("list/server-push.html.tmpl", $vars)
          || ThrowTemplateError($template->error());
    }

    my $build    = $cgi->param('build');
    my $env      = $cgi->param('environment');
     
    detaint_natural($build);
    detaint_natural($env);
        
    if ($cgi->param('new_build')){
        my $new_build   = $cgi->param('new_build');
        trick_taint($new_build);
        my $bid = check_build($new_build);
        if($bid){
            $build = $bid;
        }
        else{
            my $b = Bugzilla::Testopia::Build->create({
                    'name'        => $cgi->param('new_build'),
                    'milestone'   => '---',
                    'product_id'  => $plan->product_id,
                    'description' => '',
                    'isactive'    => 1, 
            });
            $build = $b->id;
        } 
    }

    if ($cgi->param('new_env')){
        my $new_env   = $cgi->param('new_env');
        trick_taint($new_env);
        my $e = Bugzilla::Testopia::Environment->new({
                'name'        => $new_env,
                'product_id'  => $plan->product_id,
                'isactive'    => 1,
        });
        my $eid = $e->check_environment($new_env, $plan->product_id);
        if($eid){
            $env = $eid;
        }
        else {
            $env = $e->store;
        } 
    }
    
    # Get the list of cases that we will be including in this run.
    my $reg = qr/c_([\d]+)/;
    my @c;
    foreach my $p ($cgi->param()){
        push @c, $1 if $p =~ $reg;
    }
    
    my $run = Bugzilla::Testopia::TestRun->create({
            'plan_id'           => $plan->id,
            'environment_id'    => $env,
            'build_id'          => $build,
            'product_version'   => $cgi->param('product_version'),
            'plan_text_version' => $cgi->param('plan_version'),
            'manager_id'        => $cgi->param('manager'),
            'summary'           => $cgi->param('summary'),
            'notes'             => $cgi->param('notes'),
            'status'            => $cgi->param('status'),
    });

    my $progress_interval = 250;
    my $i = 0;
    my $total = scalar @c;
    foreach my $case_id (@c){
        $i++;
        if ($i % $progress_interval == 0 && $serverpush){
            print $cgi->multipart_end;
            print $cgi->multipart_start;
            $vars->{'complete'} = $i;
            $vars->{'total'} = $total;
            $template->process("testopia/progress.html.tmpl", $vars)
              || ThrowTemplateError($template->error());
        }  
        $run->add_case_run($case_id);
    }
    # clear the params so we don't confuse search.
    $cgi->delete_all;
    if ($serverpush) {
        print $cgi->multipart_end;
        print $cgi->multipart_start;
    } else {
        print $cgi->header;
    }
    $cgi->param('current_tab', 'case_run');
    $cgi->param('run_id', $run->id);
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new('case_run', 'tr_show_run.cgi', $cgi, undef, $search->query);
    if ($table->view_count > $query_limit){
        print $cgi->multipart_end if $serverpush;
        ThrowUserError('testopia-query-too-large', {'limit' => $query_limit});
    }
    
    $vars->{'run'} = $run;
    $vars->{'table'} = $table;
    $vars->{'action'} = 'Commit';
    $vars->{'form_action'} = 'tr_show_run.cgi';
    $vars->{'tr_message'} = "Test Run: \"". $run->summary ."\" created successfully.";
    $vars->{'backlink'} = $run;
    $template->process("testopia/run/show.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
    print $cgi->multipart_final if $serverpush;
    
}

####################
### Display Form ###
####################
else {
    $cgi->param('current_tab', 'case');
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new('case', 'tr_new_run.cgi', $cgi, undef, $search->query);
    $vars->{'case'} = Bugzilla::Testopia::TestCase->new({});
    $vars->{'table'} = $table;    
    $vars->{'dotweak'} = 1;
    $vars->{'plan'} = $plan;
    $vars->{'action'} = 'Add';
    my $run = Bugzilla::Testopia::TestRun->new(
                        {'run_id' => 0,
                         'plan'   => $plan,
                         'build'  => {},
                         'plan_text_version' => $plan->version } );
    print $cgi->header;
    ThrowUserError('testopia-create-environment') unless (scalar @{$run->environments} > 0);
    $vars->{'run'} = $run;
    $template->process("testopia/run/add.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
}
