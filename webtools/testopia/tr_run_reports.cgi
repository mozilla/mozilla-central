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
use Bugzilla::Testopia::Report;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::Search;

my $vars = {};
my $template = Bugzilla->template;
my $cgi = Bugzilla->cgi;

Bugzilla->login(LOGIN_REQUIRED);

my $type = $cgi->param('type') || '';

if ($type eq 'completion'){
    print $cgi->header;
    my $dbh = Bugzilla->dbh;
    my @run_ids  = $cgi->param('run_ids');
    my @plan_ids = $cgi->param('plan_ids');
    my @runs;

    foreach my $g (@plan_ids){
        foreach my $id (split(',', $g)){
            my $obj = Bugzilla::Testopia::TestPlan->new($id);
            push @runs, @{$obj->test_runs} if $obj && $obj->canview;
        }
    }
    foreach my $g (@run_ids){
        foreach my $id (split(',', $g)){
            my $obj = Bugzilla::Testopia::TestRun->new($id);
            push @runs, $obj if $obj && $obj->canview;
        }
    }
    
    unless (scalar @runs){
        print "<b>No runs found</b>";
        exit;
    }
    
    @run_ids = ();
    foreach my $r (@runs){
        push @run_ids, $r->id;
    }

    my $bugs = $dbh->selectcol_arrayref("
        SELECT DISTINCT tcb.bug_id 
          FROM test_case_bugs AS tcb
    INNER JOIN test_case_runs AS tcr ON tcr.case_run_id = tcb.case_run_id
    INNER JOIN bugs on tcb.bug_id = bugs.bug_id
    INNER JOIN test_case_run_status AS tcrs ON tcr.case_run_status_id = tcrs.case_run_status_id
         WHERE tcr.run_id in (" . join (',',@run_ids) . ") AND tcr.iscurrent = 1",
         {"Slice" =>{}});
    
    my $total = $runs[0]->case_run_count(undef, \@runs);
    my $passed = $runs[0]->case_run_count(PASSED, \@runs);
    my $failed = $runs[0]->case_run_count(FAILED, \@runs);
    my $blocked = $runs[0]->case_run_count(BLOCKED, \@runs);
    my $idle = $runs[0]->case_run_count(IDLE, \@runs);
    my $error = $runs[0]->case_run_count(ERROR, \@runs);

    my $completed = $passed + $failed + $blocked;
    
    my $unfinished = $total - $completed;
    my $unpassed = $completed - $passed;
    my $unfailed = $completed - $failed;
    my $unblocked = $completed - $blocked;

    $vars->{'total'} = $total;
    $vars->{'completed'} = $completed;
    $vars->{'passed'} = $passed;
    $vars->{'failed'} = $failed;
    $vars->{'blocked'} = $blocked;
    $vars->{'idle'} = $idle;
    $vars->{'error'} = $error;

    $vars->{'percent_completed'} = calculate_percent($total, $completed);
    $vars->{'percent_passed'} = calculate_percent($completed, $passed);
    $vars->{'percent_failed'} = calculate_percent($completed, $failed);
    $vars->{'percent_blocked'} = calculate_percent($completed, $blocked);
    $vars->{'percent_idle'} = calculate_percent($total, $idle);
    $vars->{'percent_error'} = calculate_percent($total, $error);
    
    $vars->{'runs'} = join(',',@run_ids);
    $vars->{'plans'} = join(',',@plan_ids);
    $vars->{'bugs'} = join(',',@$bugs);
    $vars->{'bug_count'} = scalar @$bugs;
    $vars->{'run_count'} = scalar @run_ids;
    
    $template->process("testopia/reports/completion.html.tmpl", $vars)
       || ThrowTemplateError($template->error());
    exit;
}
elsif ($type eq 'execution'){
    print $cgi->header;
    my $dbh = Bugzilla->dbh;
    my @run_ids  = $cgi->param('run_ids');
    my @plan_ids = $cgi->param('plan_ids');
    my @runs;

    foreach my $g (@plan_ids){
        foreach my $id (split(',', $g)){
            my $obj = Bugzilla::Testopia::TestPlan->new($id);
            push @runs, @{$obj->test_runs} if $obj && $obj->canview;
        }
    }
    foreach my $g (@run_ids){
        foreach my $id (split(',', $g)){
            my $obj = Bugzilla::Testopia::TestRun->new($id);
            push @runs, $obj if $obj && $obj->canview;
        }
    }
    
    unless (scalar @runs){
        print "<b>No runs found</b>";
        exit;
    }
    
    @run_ids = ();
    foreach my $r (@runs){
        push @run_ids, $r->id;
    }
    my $chfieldfrom = trim(lc($cgi->param('chfieldfrom'))) || '';
    my $chfieldto = trim(lc($cgi->param('chfieldto'))) || '';
    trick_taint($chfieldfrom);
    trick_taint($chfieldto);
    my $sql_chfrom = Bugzilla::Testopia::Search::SqlifyDate($chfieldfrom);
    my $sql_chto   = Bugzilla::Testopia::Search::SqlifyDate($chfieldto);
    
    my $total = $runs[0]->case_run_count_by_date($sql_chfrom, $sql_chto, undef, \@runs);
    my $passed = $runs[0]->case_run_count_by_date($sql_chfrom, $sql_chto, PASSED, \@runs);
    my $failed = $runs[0]->case_run_count_by_date($sql_chfrom, $sql_chto, FAILED, \@runs);
    my $blocked = $runs[0]->case_run_count_by_date($sql_chfrom, $sql_chto, BLOCKED, \@runs);
    
    $vars->{'total'} = $total;
    $vars->{'passed'} = $passed;
    $vars->{'failed'} = $failed;
    $vars->{'blocked'} = $blocked;
    $vars->{'closed_from'} = $chfieldfrom;
    $vars->{'closed_to'} = $chfieldto;
    $vars->{'closed_from_converted'} = $sql_chfrom;
    $vars->{'closed_to_converted'} = $sql_chto;
    $vars->{'runs'} = \@run_ids;
    $vars->{'plans'} = \@plan_ids;

    $template->process("testopia/reports/execution.html.tmpl", $vars)
       || ThrowTemplateError($template->error());

    exit;
   
}
elsif ($type eq 'bar'){
    
    $vars->{'total'} = $cgi->param('t');
#    $vars->{'data'} = [
#        ["Total", "Completed", "Passed", "Failed", "Blocked"],
#        [ $cgi->param('t'), $cgi->param('c'), $cgi->param('p'), $cgi->param('f'), $cgi->param('b') ],
#    ];
    
    $vars->{'colors'} = (['#B8A0D2', '#56e871', '#ed3f58','#e17a56']);
    $vars->{'legend'} = ["Complete", "PASSED", "FAILED", "BLOCKED"]; 
    $vars->{'data'} = [
        ["CASES"],
        [$cgi->param('c')], 
        [$cgi->param('p')], 
        [$cgi->param('f')], 
        [$cgi->param('b')],
    ];

    print $cgi->header;
    $template->process("testopia/reports/completion.png.tmpl", $vars)
       || ThrowTemplateError($template->error());
    exit;
    
}
elsif ($type eq 'bug'){
    print $cgi->header;
    my @run_ids  = $cgi->param('run_ids');
    my @plan_ids = $cgi->param('plan_ids');
    my @runs;
    my $dbh = Bugzilla->dbh;
     
    foreach my $g (@plan_ids){
        foreach my $id (split(',', $g)){
            my $obj = Bugzilla::Testopia::TestPlan->new($id);
            push @runs, @{$obj->test_runs} if $obj && $obj->canview;
        }
    }
    foreach my $g (@run_ids){
        foreach my $id (split(',', $g)){
            my $obj = Bugzilla::Testopia::TestRun->new($id);
            push @runs, $obj if $obj && $obj->canview;
        }
    }
    
    unless (scalar @runs){
        print "<b>No runs found</b>";
        exit;
    }
    my @ids;
    foreach my $r (@runs){
        push @ids, $r->id;
    }
    my $ref = $dbh->selectall_arrayref("
        SELECT DISTINCT tcb.bug_id, bugs.bug_status, bugs.bug_severity, tcr.run_id, tcr.case_id, tcrs.name AS case_status 
          FROM test_case_bugs AS tcb
    INNER JOIN test_case_runs AS tcr ON tcr.case_run_id = tcb.case_run_id
    INNER JOIN bugs on tcb.bug_id = bugs.bug_id
    INNER JOIN test_case_run_status AS tcrs ON tcr.case_run_status_id = tcrs.case_run_status_id
         WHERE tcr.run_id in (" . join (',',@ids) . ") AND tcr.iscurrent = 1",
         {"Slice" =>{}});
    
    my $json = new JSON;
    print "{Result:";
    print $json->encode($ref);
    print "}";
    exit;
}

$cgi->param('current_tab', 'run');
$cgi->param('viewall', 1);
my $report = Bugzilla::Testopia::Report->new('run', 'tr_list_runs.cgi', $cgi);
$vars->{'report'} = $report;
$vars->{'qname'} = $cgi->param('qname');

### From Bugzilla report.cgi by Gervase Markham
my $formatparam = $cgi->param('format');
my $report_action = $cgi->param('report_action');
if ($report_action eq "data") {
    # So which template are we using? If action is "wrap", we will be using
    # no format (it gets passed through to be the format of the actual data),
    # and either report.csv.tmpl (CSV), or report.html.tmpl (everything else).
    # report.html.tmpl produces an HTML framework for either tables of HTML
    # data, or images generated by calling report.cgi again with action as
    # "plot".
    $formatparam =~ s/[^a-zA-Z\-]//g;
    trick_taint($formatparam);
    $vars->{'format'} = $formatparam;
    $formatparam = '';
}
elsif ($report_action eq "plot") {
    # If action is "plot", we will be using a format as normal (pie, bar etc.)
    # and a ctype as normal (currently only png.)
    $vars->{'cumulate'} = $cgi->param('cumulate') ? 1 : 0;
    $vars->{'x_labels_vertical'} = $cgi->param('x_labels_vertical') ? 1 : 0;
    $vars->{'data'} = $report->{'image_data'};
}
else {
    ThrowCodeError("unknown_action", {action => $cgi->param('report_action')});
}
 
my $format = $template->get_format("testopia/reports/report", $formatparam,
                               scalar($cgi->param('ctype')));

my @time = localtime(time());
my $date = sprintf "%04d-%02d-%02d", 1900+$time[5],$time[4]+1,$time[3];
my $filename = "report-" . $date . ".$format->{extension}";

my $disp = "inline";
# We set CSV files to be downloaded, as they are designed for importing
# into other programs.
if ( $format->{'extension'} eq "csv" || $format->{'extension'} eq "xml" ){
    $disp = "attachment";
}

print $cgi->header(-type => $format->{'ctype'},
                   -content_disposition => "$disp; filename=$filename");

$vars->{'time'} = $date;
$template->process("$format->{'template'}", $vars)
    || ThrowTemplateError($template->error());

exit;

