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
use Bugzilla::Config;
use Bugzilla::Error;
use Bugzilla::Util;
use JSON;

use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::Product;

###############################################################################
# tr_new_plan.cgi
# Presents a webform to the user for the creation of a new test plan. 
# 
# INTERFACE:
#    action: undef - Present form for new plan creation
#            "Add" - Form has been submitted with plan data. Create the test
#                    plan.
#
################################################################################ 

my $vars = {};
my $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;
print $cgi->header;

my $action = $cgi->param('action') || '';

if ($action eq 'Add'){
    
    ThrowUserError("testopia-create-denied", {'object' => 'Test Plan'}) unless Bugzilla->user->in_group('Testers');
    
    my $plan = Bugzilla::Testopia::TestPlan->create({
            'product_id' => $cgi->param('product_id'),
            'author_id'  => Bugzilla->user->id,
            'type_id'    => $cgi->param('type'),
            'default_product_version' => $cgi->param('prod_version'),
            'name'       => $cgi->param('plan_name'),
            'text'       => $cgi->param("plandoc"),
    });
    
    $vars->{'dojo_search'} = objToJson(["plandoc","newtag","tagTable"]);
    $vars->{'action'} = "Commit";
    $vars->{'form_action'} = "tr_show_plan.cgi";
    $vars->{'plan'} = $plan;
    $vars->{'tr_message'} = "Test Plan: \"". $plan->name ."\" created successfully.";
    $vars->{'backlink'} = $plan;
    $template->process("testopia/plan/show.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
    
}

####################
### Display Form ###
####################
else {
    ThrowUserError("testopia-create-denied", {'object' => 'Test Plan'}) unless Bugzilla->user->in_group('Testers');
    $vars->{'action'} = "Add";
    $vars->{'form_action'} = "tr_new_plan.cgi";
    $vars->{'plan'} = Bugzilla::Testopia::TestPlan->new({});
    $template->process("testopia/plan/add.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
}
