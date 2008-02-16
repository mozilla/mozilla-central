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
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Util;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::TestCaseRun;

my $vars = {};
my $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);
   
my $cgi = Bugzilla->cgi;
    print $cgi->header;
local our $run_id = trim($cgi->param('run_id') || '');

unless ($run_id){
  $template->process("testopia/run/choose.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());
  exit;
}
my $run = Bugzilla::Testopia::TestRun->new($run_id);
ThrowUserError("invalid-test-id-non-existent", {'type' => 'run', id => $run_id}) unless $run;
ThrowUserError("testopia-permission-denied", {'object' => $run}) unless $run->canview;

$vars->{'table'} = Bugzilla::Testopia::Table->new('run', 'tr_list_runs.cgi', $cgi);
$vars->{'caserun'} = Bugzilla::Testopia::TestCaseRun->new({});
$vars->{'case'} = Bugzilla::Testopia::TestCase->new({});
$vars->{'run'} = $run;

$template->process("testopia/run/show.html.tmpl", $vars) ||
    ThrowTemplateError($template->error());

