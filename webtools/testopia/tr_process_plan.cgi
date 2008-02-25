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
use Bugzilla::Error;
use Bugzilla::Util;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Constants;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestTag;
use Bugzilla::Testopia::Category;
use Bugzilla::Testopia::Attachment;
use JSON;

Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;
my $action = $cgi->param('action') || '';

my $plan = Bugzilla::Testopia::TestPlan->new($cgi->param('plan_id'));
ThrowUserError('testopia-missing-object',{object => 'plan'}) unless $plan;

### Archive or Unarchive ###

if ($action eq 'archive' || $action eq 'unarchive'){
    print $cgi->header;
    
    ThrowUserError("testopia-read-only", {'object' => $plan}) unless $plan->canedit;

    $plan->toggle_archive(Bugzilla->user->id);
    
    print '{"success" : true}';
    exit;
    
}

elsif ($action eq 'clone'){
    print $cgi->header;
    ThrowUserError("testopia-create-denied", {object => 'plan'}) unless (Bugzilla->user->in_group('Testers'));
    
    my $plan_name = $cgi->param('plan_name');
    my $product_id = $cgi->param('product_id');
    my $version = $cgi->param('prod_version');

    trick_taint($plan_name);
    trick_taint($version);
    detaint_natural($product_id);
    validate_selection($product_id,'id','products');
    Bugzilla::Version::check_version(Bugzilla::Product->new($product_id),$version);
    
    my $author = $cgi->param('keepauthor') ? $plan->author->id : Bugzilla->user->id;
    my $newplanid = $plan->clone($plan_name, $author, $product_id, $version, $cgi->param('copy_doc'));
    my $newplan = Bugzilla::Testopia::TestPlan->new($newplanid);

    if ($cgi->param('copy_tags')){
        foreach my $tag (@{$plan->tags}){
            $newplan->add_tag($tag->name);
        }
    }
    if ($cgi->param('copy_attachments')){
        foreach my $att (@{$plan->attachments}){
            $att->link_plan($newplanid);
        }
    }
    if ($cgi->param('copy_perms')){
        $plan->copy_permissions($newplanid);
        $newplan->add_tester($author, TR_READ | TR_WRITE | TR_DELETE | TR_ADMIN ) unless $cgi->param('keepauthor');
        $newplan->derive_regexp_testers($plan->tester_regexp);
    }
    else {
        # Give the author admin rights
        $newplan->add_tester($author, TR_READ | TR_WRITE | TR_DELETE | TR_ADMIN );
        $newplan->set_tester_regexp( Bugzilla->params->{"testopia-default-plan-testers-regexp"}, 3)
            if Bugzilla->params->{"testopia-default-plan-testers-regexp"};
        $newplan->derive_regexp_testers(Bugzilla->params->{'testopia-default-plan-testers-regexp'})
    } 
    if ($cgi->param('copy_cases')){
        my @case_ids;

        foreach my $id ($cgi->param('clone_categories')){
            detaint_natural($id);
            validate_selection($id,'category_id','test_case_categories');
            my $category = Bugzilla::Testopia::Category->new($id);
            push @case_ids, @{$category->plan_case_ids($plan->id)};
        }
        
        my $total = scalar @case_ids;
        foreach my $id (@case_ids){
            my $case = Bugzilla::Testopia::TestCase->new($id);
            # Copy test cases creating new ones
            if ($cgi->param('copy_cases') == 2 ){
                my $caseid = $case->copy($newplan->id, $author, 1);
                my $newcase = Bugzilla::Testopia::TestCase->new($caseid);
                $case->link_plan($newplan->id, $caseid);

                foreach my $tag (@{$case->tags}){
                    $newcase->add_tag($tag->name);
                }

                foreach my $comp (@{$case->components}){
                    $newcase->add_component($comp->{'id'});
                }
            }
            # Just create a link
            else {
                $case->link_plan($newplan->id);
            }
        }
    }
    if ($cgi->param('copy_runs')){
        foreach my $run (@{$plan->test_runs}){
            my $newrun = Bugzilla::Testopia::TestRun->new($run->clone($run->summary, $run->manager->id, $newplan->id, $run->build->id));
            foreach my $id (@{$run->case_ids}){
                $newrun->add_case_run($id);
            }
        }
    }
    print '{"success" : true, "plan_id" : ' . $newplan->id . "}";
    exit;
}

elsif ($action eq 'delete'){
    print $cgi->header;
    ThrowUserError("testopia-no-delete", {'object' => $plan}) unless ($plan->candelete);

    $plan->obliterate;

    print '{"success" : true}';
    exit; 
}

elsif ($action eq 'edit'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $plan}) unless $plan->canedit;
    
    $plan->set_default_product_version($cgi->param('prod_version')) if $cgi->param('prod_version');
    $plan->set_type($cgi->param('type')) if $cgi->param('type');
    $plan->set_name($cgi->param('name')) if $cgi->param('name');
    
    if(exists $cgi->{"plandoc"}){
        my $newdoc = $cgi->param("plandoc");    
        if($plan->diff_plan_doc($newdoc) ne ''){
            $plan->store_text($plan->id, Bugzilla->user->id, $newdoc);
        }
    }
    
    $plan->update();
    
    print '{"success" : true}';
    exit;
}

elsif ($action eq 'getfilter'){
    my $vars;
    $vars->{'case'} = Bugzilla::Testopia::TestCase->new({});
    $vars->{'plan'} = $plan;

    print $cgi->header;

    Bugzilla->template->process("testopia/case/filter.html.tmpl", $vars) ||
        ThrowTemplateError(Bugzilla->template->error());
}

else {
    print $cgi->header;
    ThrowUserError("testopia-no-action");
}