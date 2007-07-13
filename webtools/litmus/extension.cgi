#!/usr/bin/perl -w
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
# The Original Code is Litmus.
#
# The Initial Developer of the Original Code is Netscape Communications
# Corporation. Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation. All
# Rights Reserved.
#
# Contributor(s): Zach Lipton <zach@zachlipton.com>

# Hooks to interface with the Firefox QA Extension

use strict;

use Litmus;
use Litmus::Error;
use Litmus::DB::Product;
use Litmus::DB::TestcaseSubgroup;
use Litmus::Auth;
use Litmus::Utils;

use CGI;
use Time::Piece::MySQL;
use Date::Manip;

my $c = Litmus->cgi(); 

if ($c->param("login_type")) {
	Litmus::Auth::processLoginForm("extension/accountcreated.html.tmpl");
}

if ($c->param('createAccount')) {
	print $c->header();
	my $vars = {
              title => "Create Account",
              return_to => 'extension.cgi',
              adminrequired => 0
             };
	Litmus->template()->process("extension/createaccount.html.tmpl", $vars) ||
    	internalError(Litmus->template()->error());
}