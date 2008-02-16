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
use Bugzilla::Config;
use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Util;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::TestRun;

my $vars = {};

my $cgi = Bugzilla->cgi;
my $template = Bugzilla->template;

Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);

# Determine the format in which the user would like to receive the output.
# Uses the default format if the user did not specify an output format;
# otherwise validates the user's choice against the list of available formats.
my $format = $template->get_format("testopia/run/list", scalar $cgi->param('format'), scalar $cgi->param('ctype'));

# prevent DOS attacks from multiple refreshes of large data
$::SIG{TERM} = 'DEFAULT';
$::SIG{PIPE} = 'DEFAULT';

my $action = $cgi->param('action') || '';
if ($action eq 'update'){
    print $cgi->header;
    
    my @run_ids = split(',', $cgi->param('ids'));
    ThrowUserError('testopia-none-selected', {'object' => 'run'}) unless (scalar @run_ids);

    my @uneditable;
    foreach my $p (@run_ids){
        my $run = Bugzilla::Testopia::TestRun->new($p);
        next unless $run;
        
        unless ($run->canedit){
            push @uneditable, $run;
            next;
        }
        
        $run->set_manager($cgi->param('manager')) if $cgi->param('manager');
        $run->set_build($cgi->param('build')) if $cgi->param('build');
        $run->set_environment($cgi->param('environment')) if $cgi->param('environment');
        
        $run->update();
    }
            
    ThrowUserError('testopia-update-failed', {'object' => 'run', 'list' => join(',',@uneditable)}) if (scalar @uneditable);
    print "{'success': true}";    
    
}

elsif ($action eq 'delete'){
    print $cgi->header;
    Bugzilla->error_mode(ERROR_MODE_AJAX);
    my @run_ids = split(",", $cgi->param('run_ids'));
    my @uneditable;
    foreach my $id (@run_ids){
        my $run = Bugzilla::Testopia::TestRun->new($id);
        unless ($run->candelete){
            push @uneditable, $run;
            next;
        }
        
        $run->obliterate;
    }

    ThrowUserError('testopia-update-failed', {'object' => 'run', 'list' => join(',',@uneditable)}) if (scalar @uneditable);
    print "{'success': true}";
}

else {
    print $cgi->header;
    $vars->{'qname'} = $cgi->param('qname') if $cgi->param('qname');
    $cgi->param('current_tab', 'run');
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new('run', 'tr_list_runs.cgi', $cgi, undef, $search->query);

    $vars->{'json'} = $table->to_ext_json;
    $template->process($format->{'template'}, $vars)
        || ThrowTemplateError($template->error());
}
