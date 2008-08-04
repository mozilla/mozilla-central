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
use Bugzilla::Testopia::Report;
use Bugzilla::Testopia::Constants;

my $vars = {};
my $template = Bugzilla->template;
my $cgi = Bugzilla->cgi;

Bugzilla->login(LOGIN_REQUIRED);
   
my $type = $cgi->param('type') || '';

if ($type eq 'build_coverage'){
    my $plan_id = trim(Bugzilla->cgi->param('plan_id') || '');
    
    unless ($plan_id){
      $vars->{'form_action'} = 'tr_plan_reports.cgi';
      $vars->{'type'} = 'build_coverage';
      print $cgi->header;
      $template->process("testopia/plan/choose.html.tmpl", $vars) 
          || ThrowTemplateError($template->error());
      exit;
    }
    validate_test_id($plan_id, 'plan');
    my $action = $cgi->param('action') || '';
    my $plan = Bugzilla::Testopia::TestPlan->new($plan_id);
    ThrowUserError("testopia-permission-denied", {'object' => $plan}) unless $plan->canview;
    my $report = {};
    my %buildseen;
    foreach my $case (@{$plan->test_cases}){
        foreach my $cr (@{$case->caseruns}){
            $buildseen{$cr->build->id} = $cr->build->name;
            $report->{$case->id}->{$cr->build->id} = $cr;
        }
        $report->{$case->id}->{'name'} = $case->summary;
    }
    my $run_reports = {};
    foreach my $run (@{$plan->test_runs}){
        foreach my $cr (@{$run->caseruns}){
            $run_reports->{$run->id}->{$cr->case->id}->{$cr->build->id} = $cr;
            $run_reports->{$run->id}->{$cr->case->id}->{'name'} = $cr->case->summary; 
        }
        
        $run_reports->{$run->id}->{'name'} = $run->summary;
    }
    my @ids = keys %buildseen;
    $report->{'build_ids'} = \@ids;
    $report->{'builds'} = \%buildseen;
    $vars->{'run_reports'} = $run_reports;
    $vars->{'report'} = $report;
    $vars->{'plan'} = $plan;

    print $cgi->header();
    if ($cgi->param('debug')){
        use Data::Dumper;        
        print Dumper($report);
        print Dumper($run_reports);
    }
    $template->process("testopia/reports/build-coverage.html.tmpl", $vars)
       || ThrowTemplateError($template->error());
    
}
elsif ($type eq 'bugcounts'){
    my $plan_id = trim(Bugzilla->cgi->param('plan_id') || '');
    
    unless ($plan_id){
      $vars->{'form_action'} = 'tr_plan_reports.cgi';
      $vars->{'type'} = 'bugcounts';
      print $cgi->header;
      $template->process("testopia/plan/choose.html.tmpl", $vars) 
          || ThrowTemplateError($template->error());
      exit;
    }
    validate_test_id($plan_id, 'plan');
    my $plan = Bugzilla::Testopia::TestPlan->new($plan_id);
    ThrowUserError("testopia-permission-denied", {'object' => $plan}) unless $plan->canview;
    
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectall_arrayref(
        "SELECT COUNT(bug_id) AS casecount, bug_id  FROM test_case_bugs
          INNER JOIN test_cases ON test_cases.case_id = test_case_bugs.case_id
          INNER JOIN test_case_plans ON test_case_plans.case_id = test_cases.case_id
          INNER JOIN test_plans ON test_case_plans.plan_id = test_plans.plan_id
          WHERE test_plans.plan_id = ? " .
          $dbh->sql_group_by("test_cases.case_id", "test_case_bugs.bug_id"),
          {'Slice'=>{}}, $plan->id);

    $vars->{'bug_table'} = $ref;
    $vars->{'plan'} = $plan;

    print $cgi->header;
    $template->process("testopia/reports/bug-count.html.tmpl", $vars)
       || ThrowTemplateError($template->error());
}
elsif ($type eq 'untested'){
    my $plan_id = trim(Bugzilla->cgi->param('plan_id') || '');
    unless ($plan_id){
      $vars->{'form_action'} = 'tr_plan_reports.cgi';
      $vars->{'type'} = 'bugcounts';
      print $cgi->header;
      $template->process("testopia/plan/choose.html.tmpl", $vars) 
          || ThrowTemplateError($template->error());
      exit;
    }
    validate_test_id($plan_id, 'plan');
    my $plan = Bugzilla::Testopia::TestPlan->new($plan_id);
    ThrowUserError("testopia-permission-denied", {'object' => $plan}) unless $plan->canview;
    
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectcol_arrayref(
            "SELECT test_cases.case_id 
               FROM test_cases 
         INNER JOIN test_case_plans ON test_cases.case_id = test_case_plans.case_id 
              WHERE test_cases.case_id NOT IN (
                    SELECT DISTINCT test_case_runs.case_id 
                      FROM test_case_runs 
                INNER JOIN test_runs ON test_case_runs.run_id = test_runs.run_id 
                     WHERE test_runs.plan_id = ?) 
                AND test_case_plans.plan_id = ?", undef, ($plan_id, $plan_id));
    
    $vars->{'case_ids'} = join(",", @$ref);
    $vars->{'case_count'} = scalar @$ref;
    $vars->{'plan_id'} = $plan_id;
    
    print $cgi->header;
    $template->process("testopia/reports/untested.html.tmpl", $vars)
       || ThrowTemplateError($template->error());
}
else{
    $cgi->param('current_tab', 'plan');
    $cgi->param('viewall', 1);
    my $report = Bugzilla::Testopia::Report->new('plan', 'tr_list_plans.cgi', $cgi);
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
}
