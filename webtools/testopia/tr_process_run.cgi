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
use Bugzilla::Testopia::TestCaseRun;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;

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
    $run->set_notes($cgi->param('run_notes')) if exists $cgi->{'run_notes'};
    $run->set_stop_date($timestamp) if $cgi->param('status');
    
    $run->update();
    
    print "{success: true}";

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
    my $qname = $cgi->param('query_name');
    trick_taint($qname);
    $qname = '__run_id_' . $run->id . '_' . $qname;
    
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

else {
    print $cgi->header;
    ThrowUserError("testopia-no-action");
}
    