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
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::Constants;

my $vars = {};
my $template = Bugzilla->template;
my $cgi = Bugzilla->cgi;

Bugzilla->login(LOGIN_REQUIRED);

print $cgi->header;

###############################################################################
# tr_show_product.cgi
# Displays product level information including builds, categories, environments
# and tags as well as provides product level reports.
# 
# INTERFACE:
#    product_id: product to display  
#    action: 
#
################################################################################ 
my $product;
my $pid = $cgi->param('product_id') || $cgi->cookie('TESTOPIA_PRODUCT_ID') || 0;
if ($pid){
    $product = Bugzilla::Testopia::Product->new($pid);
    ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canview;
    $vars->{'product'} = $product;
    $vars->{'cookiepath'} = Bugzilla->params->{'cookiepath'};
}

$cgi->param('current_tab', 'plan');
$cgi->param('pagesize', $cgi->param('limit'));
$cgi->param('page', $cgi->param('start') == 0 ? 0 : $cgi->param('start')/$cgi->param('limit'));
$cgi->param('name_type','allwordssubstr');

my $search = Bugzilla::Testopia::Search->new($cgi);
my $table = Bugzilla::Testopia::Table->new('plan', 'tr_list_plans.cgi', $cgi, undef, $search->query);
my $action = $cgi->param('action') || '';

$vars->{'table'} = $table;
$vars->{'search'} = $cgi->param('search');
$vars->{'case'} = Bugzilla::Testopia::TestCase->new({});
$template->process("testopia/product/show.html.tmpl", $vars)
    || ThrowTemplateError($template->error());
