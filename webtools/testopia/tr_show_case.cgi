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
use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::Constants;

my $vars = {};
my $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;
my $case_id = trim(Bugzilla->cgi->param('case_id')) || '';

unless ($case_id){
    print $cgi->header();
    $template->process("testopia/case/choose.html.tmpl", $vars) 
        || ThrowTemplateError($template->error());
  exit;
}

my $case = Bugzilla::Testopia::TestCase->new($case_id);
ThrowUserError("invalid-test-id-non-existent", {'type' => 'case', id => $case_id}) unless $case;
ThrowUserError("testopia-permission-denied", {'object' => $case}) unless $case->canview;

my $format = $template->get_format("testopia/case/show", scalar $cgi->param('format'), scalar $cgi->param('ctype'));
my $disp = "inline";
# We set CSV files to be downloaded, as they are designed for importing
# into other programs.
if ( $format->{'extension'} eq "csv" || $format->{'extension'} eq "xml" ){
    $disp = "attachment";
    $vars->{'displaycolumns'} = \@Bugzilla::Testopia::Constants::TESTCASE_EXPORT;
}

$vars->{'table'} = Bugzilla::Testopia::Table->new('case', 'tr_list_cases.cgi', $cgi);

# Suggest a name for the file if the user wants to save it as a file.
my @time = localtime(time());
my $date = sprintf "%04d-%02d-%02d", 1900+$time[5],$time[4]+1,$time[3];
my $filename = "testcase-$case_id-$date.$format->{extension}";
print $cgi->header(-type => $format->{'ctype'},
                   -content_disposition => "$disp; filename=$filename");

$vars->{'case'} = $case;
$template->process($format->{'template'}, $vars) ||
    ThrowTemplateError($template->error());

