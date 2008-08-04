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
use Bugzilla::Testopia::Constants;
use Bugzilla::Error;
use Bugzilla::Util;
use Bugzilla::User;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::TestPlan;

use vars qw($vars);

local our $template = Bugzilla->template;
local our $cgi = Bugzilla->cgi;

Bugzilla->login(LOGIN_REQUIRED);
Bugzilla->error_mode(ERROR_MODE_AJAX);

print $cgi->header;

my $plan_id = trim($cgi->param('plan_id') || '');
my $action = $cgi->param('action') || '';

unless (detaint_natural($plan_id)){
  $vars->{'form_action'} = 'tr_show_plan.cgi';
  $template->process("testopia/plan/choose.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());
  exit;
}

validate_test_id($plan_id, 'plan');
local our $plan = Bugzilla::Testopia::TestPlan->new($plan_id);

if ($action eq 'edit'){
    ThrowUserError('testopia-plan-acl-denied', {plan_id => $plan->id}) unless ($plan->canadmin);
    do_update();
    print "{success: true}";
}
elsif ($action eq 'add_user'){
    ThrowUserError('testopia-plan-acl-denied', {plan_id => $plan->id}) unless ($plan->canadmin);
    do_update();
    my $userid = login_to_id(trim($cgi->param('adduser')));
    ThrowUserError("invalid_username", { name => $cgi->param('adduser')}) unless $userid;
    ThrowUserError('testopia-tester-already-on-list', {'login' => $cgi->param('adduser')}) 
        if ($plan->check_tester($userid));
        
    my $perms = 0;
    
    $perms |= TR_READ   if $cgi->param("nr");
    $perms |= TR_READ | TR_WRITE  if $cgi->param("nw");
    $perms |= TR_READ | TR_WRITE | TR_DELETE if $cgi->param("nd");
    $perms |= TR_READ | TR_WRITE | TR_DELETE | TR_ADMIN  if $cgi->param("na");
    
    detaint_natural($perms);
    trick_taint($userid);
    $plan->add_tester($userid, $perms); 

    print "{success: true}";
}
elsif ($action eq 'delete'){
    ThrowUserError('testopia-plan-acl-denied', {plan_id => $plan->id}) unless ($plan->canadmin);
    my $userid = $cgi->param('user');
    detaint_natural($userid);
    my $user = Bugzilla::User->new($userid);
    ThrowUserError('baduser') unless $user;
    ThrowUserError('testopia-no-admins') unless $plan->has_admin($user->id) > 0;
    $plan->remove_tester($user->id);
    print "{success: true, action: 'Removed User', value: '" . $user->login ."'}";
    exit;
}
    
else{
    $vars->{'plan'} = $plan;
    $vars->{'user'} = Bugzilla->user;
    $template->process("testopia/plan/access-list.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());

}

sub do_update {
    # We need at least one admin    
    my $params = join(" ", $cgi->param());
    if (scalar @{$plan->access_list} > 0){
        ThrowUserError('testopia-no-admins') unless $params =~ /(^|\s)a\d+($|\s)/;
    }
    
    my $tester_regexp = $cgi->param('userregexp');
    trick_taint($tester_regexp);
       
    my $regexp_perms = 0;

    # Each permission implies the prior ones.
    $regexp_perms |= TR_READ   if $cgi->param('pr');
    $regexp_perms |= TR_READ | TR_WRITE  if $cgi->param('pw');
    $regexp_perms |= TR_READ | TR_WRITE | TR_DELETE if $cgi->param('pd');
    $regexp_perms |= TR_READ | TR_WRITE | TR_DELETE | TR_ADMIN  if $cgi->param('pa');
    
    detaint_natural($regexp_perms);
    $plan->set_tester_regexp($tester_regexp, $regexp_perms);
    
    foreach my $row (@{$plan->access_list}){
        my $perms = 0;

        $perms |= TR_READ   if $cgi->param('r'.$row->{'user'}->id);
        $perms |= TR_READ | TR_WRITE  if $cgi->param('w'.$row->{'user'}->id);
        $perms |= TR_READ | TR_WRITE | TR_DELETE if $cgi->param('d'.$row->{'user'}->id);
        $perms |= TR_READ | TR_WRITE | TR_DELETE | TR_ADMIN  if $cgi->param('a'.$row->{'user'}->id);
        
        detaint_natural($perms);
        $plan->update_tester($row->{'user'}->id, $perms);
    }
    $vars->{'tr_message'} = " Access updated";
}
