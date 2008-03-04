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
use Bugzilla::Bug;
use Bugzilla::Util;
use Bugzilla::User;
use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::TestCaseRun;
use Bugzilla::Testopia::TestTag;
use Bugzilla::Testopia::Attachment;
use Bugzilla::Testopia::Constants;
use JSON;

Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;

my $action = $cgi->param('action') || '';

my $case = Bugzilla::Testopia::TestCase->new($cgi->param('case_id'));
ThrowUserError('testopia-missing-object',{object => 'case'}) unless $case;

if ($action eq 'edit'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;

    $case->set_alias($cgi->param('alias')) if $cgi->param('alias');
    $case->set_category($cgi->param('category')) if $cgi->param('category');
    $case->set_case_status($cgi->param('status')) if $cgi->param('status');
    $case->set_priority($cgi->param('priority')) if $cgi->param('priority');
    $case->set_isautomated($cgi->param('isautomated') eq 'on' ? 1 : 0) if $cgi->param('isautomated');
    $case->set_script($cgi->param('script')) if exists $cgi->{'script'};
    $case->set_arguments($cgi->param('arguments')) if exists $cgi->{'arguments'};    
    $case->set_summary($cgi->param('summary')) if $cgi->param('summary');
    $case->set_requirement($cgi->param('requirement')) if exists $cgi->{'requirement'};
    $case->set_dependson($cgi->param('tcdependson')) if exists $cgi->{'tcdependson'};
    $case->set_blocks($cgi->param('tcblocks')) if exists $cgi->{'tcblocks'};
    $case->set_default_tester($cgi->param('tester')) if exists $cgi->{'tester'};
    $case->set_estimated_time($cgi->param('estimated_time')) if exists $cgi->{'estimated_time'};
    
    $case->add_to_run($cgi->param('addruns'));
    $case->add_tag($cgi->param('newtag'));
    $case->attach_bug($cgi->param('bugs'));
    
    $case->update();

    print "{'success': true}";
}

elsif ($action eq 'update_doc'){

    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;

    my $newtcaction = $cgi->param('tcaction') || '' if $cgi->param('tcaction');
    my $newtceffect = $cgi->param('tceffect') || '' if $cgi->param('tceffect');
    my $newtcsetup  = $cgi->param('tcsetup') || '' if $cgi->param('tcsetup');
    my $newtcbreakdown = $cgi->param('tcbreakdown') || '' if $cgi->param('tcbreakdown');

    if($case->diff_case_doc($newtcaction, $newtceffect, $newtcsetup, $newtcbreakdown) ne ''){
        $case->store_text($case->id, Bugzilla->user->id, $newtcaction, $newtceffect, $newtcsetup, $newtcbreakdown);
    }
}

elsif ($action eq 'clone'){
    print $cgi->header;
    my @plans;
    foreach my $id (split(',', $cgi->param('plan_ids'))){
        my $plan = Bugzilla::Testopia::TestPlan->new($id);
        ThrowUserError("testopia-read-only", {'object' => $plan}) unless $plan->canedit;
        push @plans, $plan;
    }
    ThrowUserError('missing-plans-list') unless scalar @plans;
    
    my @newcases;
    my $author = $cgi->param('keepauthor') ? $case->author->id : Bugzilla->user->id;
    foreach my $p (@plans){
        my $newcaseid = $case->copy($p->id, $author, $cgi->param('copy_doc') eq 'on' ? 1 : 0);
        $case->link_plan($p->id, $newcaseid);
        my $newcase = Bugzilla::Testopia::TestCase->new($newcaseid);
        push @newcases,  $newcase->id;
        
        if ($cgi->param('copy_attachments')){
            foreach my $att (@{$case->attachments}){
                $att->link_case($newcaseid);
            }
        }
        if ($cgi->param('copy_tags')){
            foreach my $tag (@{$case->tags}){
                $newcase->add_tag($tag->name);
            }
        }
        if ($cgi->param('copy_comps')){
            foreach my $comp (@{$case->components}){
                $newcase->add_component($comp->{'id'});
            }
        }
    }
    print "{'success': true, 'tclist': '". join(", ", @newcases) ."'}";
}

elsif ($action eq 'link') {
    print $cgi->header;
    my @plans;
    foreach my $id (split(',', $cgi->param('plan_ids'))){
        my $plan = Bugzilla::Testopia::TestPlan->new($id);
        ThrowUserError("testopia-read-only", {'object' => $plan}) unless $plan->canedit;
        push @plans, $plan;
    }
    
    foreach my $plan (@plans){
        $case->link_plan($plan->id);
    }
    
    delete $case->{'plans'};
    
    print "{'success': true}";
}

elsif ($action eq 'unlink'){
    print $cgi->header;
    my $plan_id = $cgi->param('plan_id');
    validate_test_id($plan_id, 'plan');
    ThrowUserError("testopia-read-only", {'object' => 'case'}) unless ($case->can_unlink_plan($plan_id));
    ThrowUserError('testopia-case-unlink-failure') unless $case->unlink_plan($plan_id);
    
    print "{'success': true}";
}

elsif ($action eq 'detachbug'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;
    my @buglist;
    foreach my $bug (split(/[\s,]+/, $cgi->param('bug_id'))){
        ValidateBugID($bug);
        push @buglist, $bug;
    }
    foreach my $bug (@buglist){
        $case->detach_bug($bug);
    }
    print "{'success': true}";
}

elsif ($action eq 'delete'){
    print $cgi->header;
    ThrowUserError("testopia-no-delete", {'object' => $case}) unless $case->candelete;

    $case->obliterate;
    print "{'success': true}";
}

elsif ($action eq 'addcomponent' || $action eq 'removecomponent'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;
    my $comp = $cgi->param('component_id');
    
    if ($action eq 'addcomponent'){
        foreach my $c (@{$case->components}){
            if ($c->id == $comp){
                exit;
            }   
        }
        $case->add_component($comp);
    }
    else {
        $case->remove_component($comp);
    }
    print "{'success': true}";
}

elsif ($action eq 'getbugs'){
    print $cgi->header;
    ThrowUserError("testopia-permission-denied", {'object' => $case}) unless $case->canview;
    my @bugs;
    foreach my $bug (@{$case->bugs}){
        push @bugs, { bug_id => $bug->bug_id, summary => $bug->short_desc };
    }
    my $json = new JSON;
    print "{'bugs':" .  $json->objToJson(\@bugs) . "}";
}

elsif ($action eq 'getplans'){
    print $cgi->header;
    ThrowUserError("testopia-permission-denied", {'object' => $case}) unless $case->canview;
    my @plans;
    foreach my $p (@{$case->plans}){
        push @plans, { plan_id => $p->id, plan_name => $p->name };
    }
    my $json = new JSON;
    print "{'plans':" .  $json->objToJson(\@plans) . "}";
}

elsif($action eq 'getcomponents'){
    print $cgi->header;
    ThrowUserError("testopia-permission-denied", {'object' => $case}) unless $case->canview;
    my @comps;
    foreach my $c (@{$case->components}){
        push @comps, {'id' => $c->id, 'name' => $c->name};
    }
    my $json = new JSON;
    print "{'comps':" . $json->objToJson(\@comps) . "}";   
    
}

elsif ($action eq 'case_to_bug'){
    
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;
    
    my $vars;
    $vars->{'caserun'} = Bugzilla::Testopia::TestCaseRun->new($cgi->param('caserun_id')) if $cgi->param('caserun_id');
    $vars->{'case'} = $case;

    print $cgi->header(-type => 'text/xml');
    Bugzilla->template->process("testopia/case/new-bug.xml.tmpl", $vars) ||
        ThrowTemplateError(Bugzilla->template->error());
}

else {
    print $cgi->header;
    ThrowUserError("testopia-no-action");
}
