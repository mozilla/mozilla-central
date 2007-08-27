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
use Bugzilla::Util;
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Config;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::Build;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::Util;

Bugzilla->login(LOGIN_REQUIRED);

local our $vars = {};
local our $template = Bugzilla->template;
my $cgi = Bugzilla->cgi;

print $cgi->header;

my $action =  $cgi->param('action') || '';
my $product_id = $cgi->param('product_id');

ThrowUserError("testopia-missing-parameter", {param => "product_id"}) unless $product_id;
my $product = Bugzilla::Testopia::Product->new($product_id);
ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canedit;

$vars->{'plan_id'} = $cgi->param('plan_id');
$vars->{'product'} = $product;   

######################
### Create a Build ###
######################
if ($action eq 'add'){
    $vars->{'action'} = 'do_add';
    $template->process("testopia/build/form.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());
}

elsif ($action eq 'do_add'){
    my $build = Bugzilla::Testopia::Build->create({
                  product_id  => $product->id,
                  name        => $cgi->param('name'),
                  description => $cgi->param('desc'),
                  milestone   => $cgi->param('milestone'),
                  isactive    => $cgi->param('isactive') ? 1 : 0,
    });

    $vars->{'tr_message'} = "Build successfully added";
    display();
   
}

####################
### Edit a Build ###
####################
elsif ($action eq 'edit'){
    my $build = Bugzilla::Testopia::Build->new($cgi->param('build_id'));
    $vars->{'build'} = $build;
    $vars->{'action'} = 'do_edit';
    $template->process("testopia/build/form.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());

}
elsif ($action eq 'do_edit'){
    my $build = Bugzilla::Testopia::Build->new($cgi->param('build_id'));
    
    $build->set_name($cgi->param('name'));
    $build->set_description($cgi->param('desc'));
    $build->set_milestone($cgi->param('milestone'));
    $build->set_isactive($cgi->param('isactive') ? 1 : 0);
    
    $build->update();
    
    $vars->{'tr_message'} = "Build successfully updated";
    display();
}

elsif ($action eq 'hide' || $action eq 'unhide'){
    my $bid   = $cgi->param('build_id');
    my $build = Bugzilla::Testopia::Build->new($bid);
    $build->toggle_hidden;
    display();
}

########################
### View plan Builds ###
########################
else {
    display();
}

###################
### Helper Subs ###
###################

sub display{
    $template->process("testopia/build/list.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());    
}
