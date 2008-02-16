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
#                 Joel Smith <jsmith@novell.com>

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Testopia::Constants;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestRun;
use JSON;

Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;
print $cgi->header;

my $action = $cgi->param('action') || '';

my $run = Bugzilla::Testopia::TestRun->new($cgi->param('run_id'));
ThrowUserError('testopia-missing-object',{object => 'run'}) unless $run;

if ($action eq 'edit'){
    ThrowUserError("testopia-read-only", {'object' => $run}) unless $run->canedit;
    ThrowUserError("testopia-no-status") if $cgi->param('status') && !$run->canstatus;
    
    my $timestamp;
    $timestamp = $run->stop_date;
    $timestamp = undef if $cgi->param('status');
    $timestamp = get_time_stamp() if $cgi->param('status') == 0 && !$run->stop_date;
 
    $run->set_summary($cgi->param('summary')) if $cgi->param('summary');
    $run->set_product_version($cgi->param('run_product_version')) if $cgi->param('run_product_version');
    $run->set_plan_text_version($cgi->param('plan_version')) if $cgi->param('plan_version');
    $run->set_build($cgi->param('build')) if $cgi->param('build');
    $run->set_environment($cgi->param('environment')) if $cgi->param('environment');
    $run->set_manager($cgi->param('manager')) if $cgi->param('manager');
    $run->set_notes($cgi->param('run_notes')) if $cgi->param('run_notes');
    $run->set_stop_date($timestamp) if $cgi->param('status');
    
    $run->update();
    
    print "{success: true}";

}

elsif ($action eq 'clone'){
    ThrowUserError("testopia-read-only", {'object' => $run->plan}) unless $run->plan->canedit;
    my $dbh = Bugzilla->dbh;
    my $summary = $cgi->param('summary');
    my $build = $cgi->param('build');
    my $plan_id = $cgi->param('plan_id');
    my $manager = $cgi->param('keepauthor') ? $run->manager->id : Bugzilla->user->id;
    my $copysort = $cgi->param('copy_sortkey') ? 1 : 0;
    
    trick_taint($summary);
    detaint_natural($build);
    validate_test_id($plan_id, 'plan');

    my $newrun = Bugzilla::Testopia::TestRun->new($run->clone($summary, $manager, $plan_id, $build));

    if($cgi->param('copy_tags')){
        foreach my $tag (@{$run->tags}){
            $newrun->add_tag($tag->name);
        }
    }
    
    my @case_ids;
    if ($cgi->param('case_list')){
        foreach my $id (split(",", $cgi->param('case_list'))){
            my $case = Bugzilla::Testopia::TestCase->new($id);
            ThrowUserError('testopia-permission-denied', {'object' => $case}) unless ($case->canview);
            push @case_ids, $case->id
        }
    }
    elsif ($cgi->param('copy_test_cases')){
        if ($cgi->param('status') || $cgi->param('copy_sortkey')){
            my @status = $cgi->param('status');
            foreach my $s (@status){
                detaint_natural($s);
            }
            my $ref = $dbh->selectcol_arrayref(
                "SELECT case_id
                   FROM test_case_runs
                  WHERE run_id = ?
                    AND case_run_status_id IN (". join(",", @status) .")
                    AND iscurrent = 1", undef, $run->id);

            push @case_ids, @$ref;
        }
        else {
            push @case_ids, @{$run->case_ids};
        }
    }
    my @rows;
    if ($copysort){
        my $ref = $dbh->selectall_arrayref(
                "SELECT case_id, sortkey
                   FROM test_case_runs
                  WHERE run_id = ?
                    AND case_id IN (". join(",", @case_ids) .")
                    AND iscurrent = 1", {'Slice' => {}}, $run->id);
    
        @rows = @$ref;
    }
    else{
        @rows = @case_ids;
    }
    
    foreach my $row (@rows){
        if ($cgi->param('copy_sortkey')){
            $newrun->add_case_run($row->{'case_id'}, $row->{'sortkey'});
        }
        else {
            $newrun->add_case_run($row);
        }
    }

    print "{success: true, 'run_id': " . $newrun->id . "}";
}

elsif ($action eq 'delete'){
    ThrowUserError("testopia-no-delete", {'object' => $run}) unless ($run->candelete);
    $run->obliterate;
    print "{'success': true}";
}

elsif ($action eq 'save_filter'){
    my $dbh = Bugzilla->dbh;
    ThrowUserError('query_name_missing') unless $cgi->param('query_name');
    ThrowUserError("testopia-read-only", {'object' => $run}) unless $run->canedit;
    
    my $qname = '__run_id_' . $run->id . '_' . $cgi->param('query_name');
    my $query = $cgi->canonicalise_query('action');   

    trick_taint($query);
    trick_taint($qname);
    
    my ($name) = $dbh->selectrow_array(
        "SELECT name 
           FROM test_named_queries 
          WHERE name = ?",
            undef,($qname));
            
    if ($name){
        $dbh->do(
            "UPDATE test_named_queries 
                SET query = ?
              WHERE name = ?",
                undef,($query, $qname));
    }
    else{
        my $quoted_qname = url_quote($qname);
        $dbh->do("INSERT INTO test_named_queries 
                  VALUES(?,?,?,?,?)",
                  undef, (Bugzilla->user->id, $qname, 0, $query, SAVED_FILTER)); 
        
    }
    print "{'success':true}";
}

elsif ($action eq 'delete_filter'){
    my $dbh = Bugzilla->dbh;
    ThrowUserError('query_name_missing') unless $cgi->param('query_name');
    ThrowUserError("testopia-read-only", {'object' => $run}) unless $run->canedit;
    
    my $qname = '__run_id_' . $run->id . '_' . $cgi->param('query_name');
    
    $dbh->do(
        "DELETE FROM test_named_queries 
          WHERE name = ?",
            undef,($qname));
    
    print "{'success':true}";
}

elsif ($action eq 'getfilters'){
    my $dbh = Bugzilla->dbh;
    ThrowUserError("testopia-read-only", {'object' => $run}) unless $run->canedit;
    my $qnameregexp = '__run_id_' . $run->id . '_';
    
    my $filters = $dbh->selectall_arrayref(
        "SELECT name, query 
           FROM test_named_queries 
          WHERE name REGEXP(?)",
            {'Slice' => {}},($qnameregexp));
    foreach my $f (@$filters){
        $f->{'name'} =~ s/^__run_id_\d+_//;
    }
    print "{'filters':" . objToJson($filters) . "}";
}

elsif ($action eq 'getcloneform'){
    my $vars;
    $vars->{'caserun'} = Bugzilla::Testopia::TestCaseRun->new({});
    $vars->{'run'} = $run;
    $vars->{'case_list'} = $cgi->param('case_list');
    
    print $cgi->header;

    Bugzilla->template->process("testopia/run/clone.html.tmpl", $vars) ||
        ThrowTemplateError(Bugzilla->template->error());
}

else {
    print $cgi->header;
    ThrowUserError("testopia-no-action");
}
    