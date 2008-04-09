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
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestCaseRun;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::Constants;
use JSON;

my $vars = {};

my $cgi = Bugzilla->cgi;
my $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);

my $format = $template->get_format("testopia/caserun/list", scalar $cgi->param('format'), scalar $cgi->param('ctype'));

print $cgi->header;

# prevent DOS attacks from multiple refreshes of large data
$::SIG{TERM} = 'DEFAULT';
$::SIG{PIPE} = 'DEFAULT';

my $action = $cgi->param('action') || '';

if ($action eq 'update'){
    Bugzilla->error_mode(ERROR_MODE_AJAX);
    my @caseruns;
    my @uneditable;
    my $assignee_id; 
    my $status_id;
    
    if ($cgi->param('applyall') eq 'true'){
        my $run = Bugzilla::Testopia::TestRun->new($cgi->param('run_id'));
        exit if $run->stop_date;
        @caseruns = @{$run->current_caseruns()} if $run->canedit;
    }
    else{    
        foreach my $id (split(',', $cgi->param('ids'))){
            my $caserun = Bugzilla::Testopia::TestCaseRun->new($id);
            if ($caserun->canedit){
                push @caseruns, $caserun;
            }
            else {
                push @uneditable, $caserun->case_id;
            } 
        }
    }
        
    $status_id = $cgi->param('status_id') if $cgi->param('status_id');
    $assignee_id = login_to_id(trim($cgi->param('assignee')),'THROW_ERROR') if $cgi->param('assignee');
    detaint_natural($status_id);

    foreach my $cr (@caseruns){
        next if $cr->run->stop_date;
        $cr = $cr->switch($cgi->param('build_id')) if $cgi->param('build_id');
        $cr = $cr->switch($cr->build->id, $cgi->param('env_id')) if $cgi->param('env_id');
        $cr->set_status($status_id, $cgi->param('update_bug') eq 'true' ? 1 : 0) if $status_id;
        $cr->set_assignee($assignee_id) if $assignee_id;
    }

    ThrowUserError('testopia-update-failed', {'object' => 'case-run', 'list' => join(',',@uneditable)}) if (scalar @uneditable);
    exit unless scalar @caseruns; 
    
    my $run = $caseruns[0]->run;
    $vars->{'passed'} = $run->case_run_count(PASSED) / $run->case_run_count; 
    $vars->{'failed'} = $run->case_run_count(FAILED) / $run->case_run_count;
    $vars->{'blocked'} = $run->case_run_count(BLOCKED) / $run->case_run_count;
    $vars->{'complete'} = $run->percent_complete() . '%';
    $vars->{'success'} = 'true' ;
    
    print objToJson($vars);
}

elsif ($action eq 'delete'){
    Bugzilla->error_mode(ERROR_MODE_AJAX);
    my @case_ids;
    if ($cgi->param('ids')){
        @case_ids = $cgi->param('ids');
    }
    else {
        @case_ids = split(",", $cgi->param('caserun_ids'));
    }
    my @uneditable;
    foreach my $id (@case_ids){
        my $case = Bugzilla::Testopia::TestCaseRun->new($id);
        unless ($case->candelete){
            push @uneditable, $case;
            next;
        }
        
        $case->obliterate($cgi->param('single'));
    }

    ThrowUserError('testopia-update-failed', {'object' => 'case-run', 'list' => join(',',@uneditable)}) if (scalar @uneditable);
    print "{'success': true}";
}

else {
    $vars->{'qname'} = $cgi->param('qname') if $cgi->param('qname');
    
    # Take the search from the URL params and convert it to SQL
    $cgi->param('current_tab', 'case_run');
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new('case_run', 'tr_list_caseruns.cgi', $cgi, undef, $search->query);
    
    print $cgi->header;
    $vars->{'json'} = $table->to_ext_json;
    $template->process($format->{'template'}, $vars)
        || ThrowTemplateError($template->error());
}
