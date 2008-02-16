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

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Bug;
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Util;
use Bugzilla::User;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::TestCaseRun;

use JSON;

my $vars = {};
my $template = Bugzilla->template;

Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);
   
my $cgi = Bugzilla->cgi;

my $caserun;
my $action = $cgi->param('action') || '';

if ($cgi->param('caserun_id')){
    $caserun = Bugzilla::Testopia::TestCaseRun->new($cgi->param('caserun_id'));
}
elsif ($cgi->param('case_id')){
    $caserun = Bugzilla::Testopia::TestCaseRun->new($cgi->param('case_id'),
                                                       $cgi->param('run_id'),
                                                       $cgi->param('build_id'),
                                                       $cgi->param('env_id'));
}
else{
    print $cgi->header;
    ThrowUserError('testopia-missing-parameter', {'param' => 'caserun_id or case_id and run_id'});
}

if ($action eq 'update_build'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    my $build_id = $cgi->param('build_id');
    detaint_natural($build_id);
    validate_test_id($build_id, 'build');
    
    $caserun = $caserun->switch($build_id, $caserun->environment->id);
    
    print "{'success': true, caserun:" . $caserun->to_json ."}";
}

elsif ($action eq 'update_environment'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    my $environment_id = $cgi->param('caserun_env');
    detaint_natural($environment_id);
    validate_test_id($environment_id, 'environment');
    
    $caserun = $caserun->switch($caserun->build->id, $environment_id);
    
    print "{'success': true, caserun:" . $caserun->to_json ."}";
}

elsif ($action eq 'update_status'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    my $status_id = $cgi->param('status_id');

    detaint_natural($status_id);
    
    $caserun->set_status($status_id, $cgi->param('update_bug'));

    print "{'success': true}";
}

elsif ($action eq 'update_note'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    my $note = $cgi->param('note');

    trick_taint($note);
    $caserun->append_note($note);
    
    print "{'success': true}";
}

elsif ($action eq 'update_assignee'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    
    my $assignee_id = login_to_id(trim($cgi->param('assignee')),'THROW_ERROR');

    $caserun->set_assignee($assignee_id);
    
    print "{'success': true}";
}

elsif ($action eq 'update_sortkey'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    
    my $sortkey = $cgi->param('sortkey');
    ThrowUserError("number_not_numeric", {'num' => $sortkey, field => 'index', field_descs =>{'index' => 'index'}}) unless $caserun->canedit;
    
    $caserun->set_sortkey($sortkey);
    
    print "{'success': true}";
}

elsif ($action eq 'update_priority'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    
    $caserun->case->set_priority($cgi->param('priority'));
    $caserun->case->update();
    
    print "{'success': true, caserun:" . $caserun->to_json ."}";
    
}

elsif ($action eq 'update_category'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    
    $caserun->case->set_category($cgi->param('category'));
    $caserun->case->update();
    
    print "{'success': true, caserun:" . $caserun->to_json ."}";
    
}

elsif ($action eq 'getbugs'){
    print $cgi->header;
    ThrowUserError("testopia-read-only", {'object' => $caserun}) unless $caserun->canedit;
    my $bugs;
    foreach my $bug (@{$caserun->bugs}){
        $bugs->{'summary'} = $bug->short_desc;
        $bugs->{'bug_id'} = $bug->bug_id;
    }
    print '{"bugs":';
    print objToJson($bugs);
    print '}';
}

elsif ($action eq 'gettext'){
    unless ($caserun->canview){
        print $cgi->header;
        ThrowUserError("testopia-permission-denied", {'object' => $caserun});
    }
    
    
    
    my $text = $caserun->case->text;
    $text->{'notes'} = $caserun->notes;
    $text->{'case_id'} = $caserun->case->id;
    
    $vars->{'text'} = $text;
    
    print $cgi->header(-type => 'text/xml');
    Bugzilla->template->process("testopia/case/text.xml.tmpl", $vars) ||
        ThrowTemplateError(Bugzilla->template->error());
}

elsif ($action eq 'gethistory'){
    print $cgi->header;
    ThrowUserError("testopia-permission-denied", {'object' => $caserun}) unless $caserun->canview;
    
    print '{"records":';
    print objToJson($caserun->get_history);
    print '}';
    
}
else {
    print "Location: tr_show_run.cgi\n\n";
}
