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
#                 Jeff Dayley <jedayley@novell.com>

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Util;
use Bugzilla::User;
use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::TestCaseRun;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestTag;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::Constants;

my $vars = {};

my $cgi = Bugzilla->cgi;
my $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);

# Determine the format in which the user would like to receive the output.
# Uses the default format if the user did not specify an output format;
# otherwise validates the user's choice against the list of available formats.
my $format = $template->get_format("testopia/case/list", scalar $cgi->param('format'), scalar $cgi->param('ctype'));
my $action = $cgi->param('action') || '';

# prevent DOS attacks from multiple refreshes of large data
$::SIG{TERM} = 'DEFAULT';
$::SIG{PIPE} = 'DEFAULT';

###############
### Actions ###
###############
if ($action eq 'update'){
    Bugzilla->error_mode(ERROR_MODE_AJAX);
    print $cgi->header;
    
    my @case_ids = split(',', $cgi->param('ids'));
    ThrowUserError('testopia-none-selected', {'object' => 'case'}) unless (scalar @case_ids);

    my @uneditable;
    my @runs;
    my %planseen;
    my @components;
    
    foreach my $planid (split(",", $cgi->param('linkplans'))){
        validate_test_id($planid, 'plan');
        my $plan = Bugzilla::Testopia::TestPlan->new($planid);
        next unless $plan->canedit;
        $planseen{$planid} = 1;
    }

    foreach my $runid (split(/[\s,]+/, $cgi->param('addruns'))){
        validate_test_id($runid, 'run');
        push @runs, Bugzilla::Testopia::TestRun->new($runid);
    }
    
    my @comps = $cgi->param("components");
    my (@addcomponents,@remcomponents);
    foreach my $id (@comps){
        detaint_natural($id);
        validate_selection($id, 'id', 'components');
        if ($cgi->param('comp_action') eq 'add'){
            push @addcomponents, $id;
        }
        else {
            push @remcomponents, $id;
        }
    }

    foreach my $p (@case_ids){
        my $case = Bugzilla::Testopia::TestCase->new($p);
        next unless $case;
        
        unless ($case->canedit){
            push @uneditable, $case;
            next;
        }

        $case->set_requirement($cgi->param('requirement')) if $cgi->param('requirement');
        $case->set_case_status($cgi->param('status')) if $cgi->param('status');
        $case->set_priority($cgi->param('priority')) if $cgi->param('priority');
        $case->set_isautomated($cgi->param('isautomated') eq 'on' ? 1 : 0) if $cgi->param('isautomated');
        $case->set_script($cgi->param('script')) if $cgi->param('script');
        $case->set_arguments($cgi->param('arguments')) if $cgi->param('arguments');    
        $case->set_default_tester($cgi->param('tester')) if $cgi->param('tester');
        
        $case->update();

        $case->add_component($_) foreach (@addcomponents);
        $case->remove_component($_) foreach (@remcomponents);

        # Add to runs
        foreach my $run (@runs){
            $run->add_case_run($case->id) if $run->canedit;
        }
        # Clone
        if ($cgi->param('copymethod') eq 'copy'){
            foreach my $planid (keys %planseen){
                my $author = $cgi->param('newauthor') ? Bugzilla->user->id : $case->author->id;
                my $newcaseid = $case->copy($planid, $author, 1);
                $case->link_plan($planid, $newcaseid);
                my $newcase = Bugzilla::Testopia::TestCase->new($newcaseid);
                foreach my $tag (@{$case->tags}){
                    $newcase->add_tag($tag);
                }
                foreach my $comp (@{$case->components}){
                    $newcase->add_component($comp->{'id'});
                }
            }
        }
        elsif ($cgi->param('copymethod') eq 'link'){
            foreach my $planid (keys %planseen){
                $case->link_plan($planid);
            }
        }
    }
    ThrowUserError('testopia-update-failed', {'object' => 'plan', 'list' => join(',',@uneditable)}) if (scalar @uneditable);
    print "{'success': true}";    

}

elsif ($action eq 'delete'){
    Bugzilla->error_mode(ERROR_MODE_AJAX);
    print $cgi->header;
    
    my @case_ids = split(",", $cgi->param('case_ids'));
    my @uneditable;
    foreach my $id (@case_ids){
        my $case = Bugzilla::Testopia::TestCase->new($id);
        unless ($case->candelete){
            push @uneditable, $case;
            next;
        }
        
        $case->obliterate;
    }

    ThrowUserError('testopia-update-failed', {'object' => 'case', 'list' => join(',',@uneditable)}) if (scalar @uneditable);
    print "{'success': true}";
}

else{
    $vars->{'qname'} = $cgi->param('qname') if $cgi->param('qname');
    
    $cgi->param('current_tab', 'case');
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new('case', 'tr_list_cases.cgi', $cgi, undef, $search->query);
    
    if ($cgi->param('ctype') eq 'json'){
        Bugzilla->error_mode(ERROR_MODE_AJAX);
        print $cgi->header;
        $vars->{'json'} = $table->to_ext_json;
        $template->process($format->{'template'}, $vars)
            || ThrowTemplateError($template->error());
        exit;
    }
    
    my @time = localtime(time());
    my $date = sprintf "%04d-%02d-%02d", 1900+$time[5],$time[4]+1,$time[3];
    my $filename = "testcases-$date.$format->{extension}";
    
    my $disp = "inline";
    # We set CSV files to be downloaded, as they are designed for importing
    # into other programs.
    if ( $format->{'extension'} eq "csv" || $format->{'extension'} eq "xml" ){
        $disp = "attachment";
        $vars->{'displaycolumns'} = \@Bugzilla::Testopia::Constants::TESTCASE_EXPORT;
    }

    # Suggest a name for the bug list if the user wants to save it as a file.
    print $cgi->header(-type => $format->{'ctype'},
                       -content_disposition => "$disp; filename=$filename");
                                           
    $template->process($format->{'template'}, $vars)
        || ThrowTemplateError($template->error());
        
}