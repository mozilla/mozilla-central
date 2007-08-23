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
#                 Tyler Peterson <typeterson@novell.com>

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
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use JSON;

local our $vars = {};
local our $template = Bugzilla->template;
local our $query_limit = 15000;


Bugzilla->login(LOGIN_REQUIRED);

local our $cgi = Bugzilla->cgi;

my $case_id = trim(Bugzilla->cgi->param('case_id')) || '';

unless ($case_id){
    print $cgi->header();
    $template->process("testopia/case/choose.html.tmpl", $vars) 
        || ThrowTemplateError($template->error());
  exit;
}
validate_test_id($case_id, 'case');
my $action = $cgi->param('action') || '';

$cgi->param('ctype' , 'print') if ($action eq 'Print');
local our $format = $template->get_format("testopia/case/show", scalar $cgi->param('format'), scalar $cgi->param('ctype'));
my $disp = "inline";
# We set CSV files to be downloaded, as they are designed for importing
# into other programs.
if ( $format->{'extension'} eq "csv" || $format->{'extension'} eq "xml" ){
    $disp = "attachment";
    $vars->{'displaycolumns'} = \@Bugzilla::Testopia::Constants::TESTCASE_EXPORT;
}

# Suggest a name for the file if the user wants to save it as a file.
my @time = localtime(time());
my $date = sprintf "%04d-%02d-%02d", 1900+$time[5],$time[4]+1,$time[3];
my $filename = "testcase-$case_id-$date.$format->{extension}";
print $cgi->header(-type => $format->{'ctype'},
                   -content_disposition => "$disp; filename=$filename");

$vars->{'action'} = "Commit";
$vars->{'form_action'} = "tr_show_case.cgi";

if ($action eq 'Clone'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-create-denied", {'object' => 'Test Case'}) unless $case->canview;
    do_update($case);
    $vars->{'case'} = $case;
    $template->process("testopia/case/clone.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());

}

elsif ($action eq 'do_clone'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    my $count = 0;
    my $method;
    if ($cgi->param('copymethod') eq 'copy'){
        ThrowUserError('missing-plans-list') if (!$cgi->param('existing') && !$cgi->param('newplans'));
        my @planids;
        my %planseen;
        foreach my $p (split('[\s,]+', $cgi->param('newplans'))){
            validate_test_id($p, 'plan');
            $planseen{$p} = 1;
        }
        if ($cgi->param('existing')){
            foreach my $p (@{$case->plans}){
                $planseen{$p->id} = 1;
            }
        }
        my $author = $cgi->param('keepauthor') ? $case->author->id : Bugzilla->user->id;
        push @planids, keys %planseen;
        my $newcase;
        foreach my $pid (@planids){
            $count++;
            my $plan = Bugzilla::Testopia::TestPlan->new($pid);
            unless ($plan->canedit){
                $count--;
                $vars->{'tr_error'} = "Could not link to at least one plan";
                next;
            }
            my $newcaseid = $case->copy($pid, $author, $cgi->param('copy_doc'));
            $case->link_plan($pid, $newcaseid);
            $newcase = Bugzilla::Testopia::TestCase->new($newcaseid);

            if($cgi->param('copy_attachments')){
                foreach my $att (@{$case->attachments}){
                    $att->link_case($newcaseid);
                }
            }
            if ($cgi->param('copy_tags')){
                foreach my $tag (@{$case->tags}){
                    # Doing it this way avoids collisions
                    my $newtag = Bugzilla::Testopia::TestTag->new({
                                   tag_name  => $tag->name
                                 });
                    my $newtagid = $newtag->store;
                    $newcase->add_tag($newtagid);
                }
            }
            if ($cgi->param('copy_comps')){
                foreach my $comp (@{$case->components}){
                    $newcase->add_component($comp->{'id'});
                }
            }
        }
        $method = "copied";
        $vars->{'copied'} = $case;
        $vars->{'backlink'} = $case;
        $case = $newcase;
    }
    elsif ($cgi->param('copymethod') eq 'link'){
        # This should be a code error
        ThrowUserError('testopia-missing-plans-list') if (!$cgi->param('linkplans'));
        my %seen;
        foreach my $p (split('[\s,]+', $cgi->param('linkplans'))){
            validate_test_id($p, 'plan');
            $seen{$p} = 1;
        }
        foreach my $p (keys %seen){
            $count++;
            my $plan = Bugzilla::Testopia::TestPlan->new($p);
            unless ($plan->canedit){
                $vars->{'tr_error'} = "Could not link to at least one plan";
                $count--;
                next;
            }
            $case->link_plan($p);
        }
        delete $case->{'plans'};
        $method = "linked";
        $vars->{'backlink'} = $case;
    }
    else {
        ThrowUserError('testopia-missing-parameter', {'param' => 'copymethod'});
    }
            
    $vars->{'tr_message'} = "Case $method to $count plans." if $count;
    display($case);
}

elsif ($action eq 'Attach'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;

    defined $cgi->upload('data')
        || ThrowUserError("file_not_specified");
    my $filename = $cgi->upload('data');       
    $cgi->param('description')
        || ThrowUserError("missing_attachment_description");
    my $description = $cgi->param('description');
    my $contenttype = $cgi->uploadInfo($cgi->param('data'))->{'Content-Type'};
    trick_taint($description);
    my $fh = $cgi->upload('data');
    my $data;
    # enable 'slurp' mode
    local $/;
    $data = <$fh>;       
    $data || ThrowUserError("zero_length_file");
    
    my $attachment = Bugzilla::Testopia::Attachment->new({
                        case_id      => $case_id,
                        submitter_id => Bugzilla->user->id,
                        description  => $description,
                        filename     => $filename,
                        mime_type    => $contenttype,
                        contents     => $data
    });

    $attachment->store;
    do_update($case);
    $vars->{'tr_message'} = "File attached.";
    $vars->{'backlink'} = $case;
    display($case);
}

elsif ($action eq 'Commit'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;
    do_update($case);
    $vars->{'tr_message'} = "Test case updated";
    $vars->{'backlink'} = $case;
    display($case);
}

elsif ($action eq 'History'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-permission-denied", {'object' => $case}) unless $case->canview;
    $vars->{'case'} = $case; 
    $vars->{'diff'} = $case->compare_doc_versions($cgi->param('new'),$cgi->param('old'));
    $vars->{'new'} = $cgi->param('new');
    $vars->{'old'} = $cgi->param('old');
    $template->process("testopia/case/history.html.tmpl", $vars)
      || ThrowTemplateError($template->error());
       
}

elsif ($action eq 'unlink'){
    my $plan_id = $cgi->param('plan_id');
    validate_test_id($plan_id, 'plan');
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-read-only", {'object' => $case}) 
        unless ($case->can_unlink_plan($plan_id));
    
    if (scalar @{$case->plans} == 1){
        $vars->{'case'} = $case;
        $vars->{'runcount'} = scalar @{$case->runs};
        $vars->{'plancount'} = scalar @{$case->plans};
        $vars->{'bugcount'} = scalar @{$case->bugs};
        $template->process("testopia/case/delete.html.tmpl", $vars) ||
            ThrowTemplateError($template->error());
    }
    else {
        $vars->{'plan'} = Bugzilla::Testopia::TestPlan->new($plan_id);
        $vars->{'case'} = $case;
        $template->process("testopia/case/unlink.html.tmpl", $vars) ||
            ThrowTemplateError($template->error());
    }
}

elsif ($action eq 'do_unlink'){
    my $plan_id = $cgi->param('plan_id');
    validate_test_id($plan_id, 'plan');
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-read-only", {'object' => 'case'}) 
        unless ($case->can_unlink_plan($plan_id));

    if ($case->unlink_plan($plan_id)){
        $vars->{'tr_message'} = "Test plan successfully unlinked";
    }
    
    $vars->{'backlink'} = $case;
    display($case);
}

elsif ($action eq 'detach_bug'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;
    my @buglist;
    foreach my $bug (split(/[\s,]+/, $cgi->param('bug_id'))){
        ValidateBugID($bug);
        push @buglist, $bug;
    }
    foreach my $bug (@buglist){
        $case->detach_bug($bug);
    }
    display(Bugzilla::Testopia::TestCase->new($case_id));
}
elsif ($action eq 'Delete'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-no-delete", {'object' => $case}) unless $case->candelete;
    $vars->{'case'} = $case;
    $vars->{'runcount'} = scalar @{$case->runs};
    $vars->{'plancount'} = scalar @{$case->plans};
    $vars->{'bugcount'} = scalar @{$case->bugs};
    $template->process("testopia/case/delete.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
    
}
elsif ($action eq 'do_delete'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-no-delete", {'object' => $case}) unless $case->candelete;
    $case->obliterate;
    $vars->{'deleted'} = 1;
    $template->process("testopia/case/delete.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
}
####################
### Ajax Actions ###
####################
elsif ($action eq 'addcomponent' || $action eq 'removecomponent'){
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-read-only", {'object' => $case}) unless $case->canedit;
    my $comp = $cgi->param('component_id');
    detaint_natural($comp);
    validate_selection($comp, 'id', 'components');
    
    if ($action eq 'addcomponent'){
        foreach my $c (@{$case->components}){
            if ($c->id == $comp){
                print "{ignore:1}";
                exit;
            }   
        }
        $case->add_component($comp);
    }
    else {
        $case->remove_component($comp);
    }
    my @comps;
    foreach my $c (@{$case->components}){
        push @comps, {'id' => $c->id, 'name' => $c->name};
    }
    my $json = new JSON;
    print $json->objToJson(\@comps);   
}

#TODO: Clean up styles and put them in skins
else{
    my $case = Bugzilla::Testopia::TestCase->new($case_id);
    ThrowUserError("testopia-permission-denied", {'object' => $case}) unless $case->canview;
    display($case);
}

#######################
### Helper Routines ###
#######################

sub do_update{
    my ($case) = @_;
    my $newtcaction = $cgi->param("tcaction");
    my $newtceffect = $cgi->param("tceffect");
    my $newtcsetup  = $cgi->param("tcsetup") || '';
    my $newtcbreakdown = $cgi->param("tcbreakdown") || '';
    
    $case->set_alias($cgi->param('alias'));
    $case->set_category($cgi->param('category'));
    $case->set_case_status($cgi->param('status'));
    $case->set_priority($cgi->param('priority'));
    $case->set_isautomated($cgi->param("isautomated"));
    $case->set_script($cgi->param("script"));
    $case->set_arguments($cgi->param("arguments"));    
    $case->set_summary($cgi->param("summary"));
    $case->set_requirement($cgi->param("requirement"));
    $case->set_dependson($cgi->param("tcdependson"));
    $case->set_blocks($cgi->param("tcblocks"));
    $case->set_default_tester($cgi->param("tester"));
    $case->set_estimated_time($cgi->param("estimated_time"));
    
    $case->add_to_run($cgi->param('addruns'));
    $case->add_tag($cgi->param('newtag'));
    $case->attach_bug($cgi->param('bugs'));
    
    if($case->diff_case_doc($newtcaction, $newtceffect, $newtcsetup, $newtcbreakdown) ne ''){
        $case->store_text($case->id, Bugzilla->user->id, $newtcaction, $newtceffect, $newtcsetup, $newtcbreakdown);
    }

    $case->update();

    $cgi->delete_all;
    $cgi->param('case_id', $case->id);
}

sub display {
    my $case = shift;    
    $cgi->param('case_id', $case->id);
    $cgi->param('isactive', 1);
    $cgi->param('current_tab', 'case_run');
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new('case_run', 'tr_show_case.cgi', $cgi, undef, $search->query);
    ThrowUserError('testopia-query-too-large', {'limit' => $query_limit}) if $table->view_count > $query_limit;
    $vars->{'case'} = $case;
    $vars->{'table'} = $table;
    $vars->{'user'} = Bugzilla->user;
    $template->process($format->{'template'}, $vars) ||
        ThrowTemplateError($template->error());
}
