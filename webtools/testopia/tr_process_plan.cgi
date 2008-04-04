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
use Bugzilla::Testopia::Build;
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
    my $product = Bugzilla::Testopia::Product->new($product_id);
    $product ||= $plan->product;
    
    trick_taint($plan_name);
    trick_taint($version);
    detaint_natural($product_id);
    Bugzilla::Version::check_version($product,$version);
    if ($cgi->param('copy_runs')){
        ThrowUserError("invalid-test-id-non-existent", 
            {'id' => $cgi->param('new_run_build'), 'type' => 'Build'}) unless $cgi->param('new_run_build');
        ThrowUserError("invalid-test-id-non-existent", 
            {'id' => $cgi->param('new_run_env'), 'type' => 'Environment'}) unless $cgi->param('new_run_env');
    }    
    my $author = $cgi->param('keep_plan_author') ? $plan->author->id : Bugzilla->user->id;
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
        $newplan->add_tester($author, TR_READ | TR_WRITE | TR_DELETE | TR_ADMIN ) unless ($cgi->param('keep_plan_author'));
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
        my @cases = @{$plan->test_cases};
        my $total = scalar @cases;
        foreach my $case (@cases){
            # Copy test cases creating new ones
            if ($cgi->param('make_copy')){
                my $case_author = $cgi->param('keep_case_authors') ? $case->author->id : Bugzilla->user->id;
                my $case_tester = $cgi->param('keep_tester') ? $case->default_tester->id : Bugzilla->user->id;
                my $category;
                if ($cgi->param('copy_categories')){
                    my $category_id = check_case_category($case->category->name, $product);
                    if (! $category_id){
                        $category = Bugzilla::Testopia::Category->create({
                            product_id  => $product->id,
                            name        => $case->category->name,
                            description => $case->category->description,
                        });
                    }
                    else {
                       $category = Bugzilla::Testopia::Category->new($category_id); 
                    }
                    
                }
                else {
                    if ($product->id == $plan->product_id){
                        $category = $case->category;
                    }
                    else{
                        my @categories = @{$product->categories};
                        if (scalar @categories < 1){
                            $category = Bugzilla::Testopia::Category->create({
                                product_id  => $product->id,
                                name        => '--default--',
                                description => 'Default product category for test cases',
                            });
                             
                        }
                        else{
                            $category = $categories[0];
                        }
                    }
                }
                
                my $caseid = $case->copy($case_author, $case_tester, 1, $category->id);
                my $newcase = Bugzilla::Testopia::TestCase->new($caseid);
                
                $newcase->link_plan($newplan->id, $caseid);
                
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
            my $manager = $cgi->param('keep_run_managers') ? $run->manager->id : Bugzilla->user->id;
            
            my $build = Bugzilla::Testopia::Build->new($cgi->param('new_run_build'));
            my $env = Bugzilla::Testopia::Build->new($cgi->param('new_run_env'));
            
            my $run_id = $run->clone($run->summary, $manager, $newplan->id, $build->id, $env->id);
            
            my $newrun = Bugzilla::Testopia::TestRun->new($run_id);
            if($cgi->param('copy_run_tags')){
                foreach my $tag (@{$run->tags}){
                    $newrun->add_tag($tag->name);
                }
            }
            if($cgi->param('copy_run_cases')){
                foreach my $cr (@{$run->current_caseruns}){
                    $newrun->add_case_run($cr->case_id, $cr->sortkey);
                }
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