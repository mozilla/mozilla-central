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
use Bugzilla::Testopia::Constants;
use Bugzilla::Error;
use Bugzilla::Testopia::Build;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::Util;

use JSON;
#TODO: Add a way to filter name 

Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;

my $action =  $cgi->param('action') || '';
my $product_id = $cgi->param('product_id');

print "Location: tr_show_product.cgi?tab=build\n\n" unless $action; 

print $cgi->header;

ThrowUserError("testopia-missing-parameter", {param => "product_id"}) unless $product_id;

my $product = Bugzilla::Testopia::Product->new($product_id);
ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canedit;

######################
### Create a Build ###
######################
if ($action eq 'add'){
    my $build = Bugzilla::Testopia::Build->create({
                  product_id  => $product->id,
                  name        => $cgi->param('name') || '',
                  description => $cgi->param('desc') || '',
                  milestone   => $cgi->param('milestone') || '---',
                  isactive    => $cgi->param('isactive') ? 1 : 0,
    });

   print "{success: true, build_id: ". $build->id . "}";
}

####################
### Edit a Build ###
####################
elsif ($action eq 'edit'){
    my $build = Bugzilla::Testopia::Build->new($cgi->param('build_id'));
    
    $build->set_name($cgi->param('name')) if $cgi->param('name');
    $build->set_description($cgi->param('description')) if $cgi->param('description');
    $build->set_milestone($cgi->param('milestone')) if $cgi->param('milestone');
    $build->set_isactive($cgi->param('isactive') =~ /(1|true)/ ? 1 : 0) if $cgi->param('isactive');
    
    $build->update();
    print "{success: true}";
}

elsif ($action eq 'list'){
    my $json = new JSON;
    my @builds;
    my $activeonly = $cgi->param('activeonly');
    my $current = Bugzilla::Testopia::Build->new($cgi->param('current_build') || {});
    my $out;
    
    trick_taint($activeonly) if $activeonly;
    
    foreach my $b (@{$product->builds($activeonly)}){
        push @builds, $b if $b->id != $current->id;
    }
    unshift @builds, $current if defined $current->id;
    
    $out .= $_->to_json . ',' foreach (@builds);
    chop ($out); # remove the trailing comma for IE
    
    print "{builds:[$out]}";
    
}

elsif ($action eq 'report'){
    my $vars = {};
    my $template = Bugzilla->template;
    
    print $cgi->header;
    
    my @build_ids  = $cgi->param('build_ids');
    my @builds;
    
    foreach my $g (@build_ids){
        foreach my $id (split(',', $g)){
            my $obj = Bugzilla::Testopia::Build->new($id);
            push @builds, $obj if $obj->product->canedit;
        }
    }
    
    my $total = $builds[0]->case_run_count(undef, \@builds);
    my $passed = $builds[0]->case_run_count(PASSED, \@builds);
    my $failed = $builds[0]->case_run_count(FAILED, \@builds);
    my $blocked = $builds[0]->case_run_count(BLOCKED, \@builds);

    my $completed = $passed + $failed + $blocked;
    
    my $unfinished = $total - $completed;
    my $unpassed = $completed - $passed;
    my $unfailed = $completed - $failed;
    my $unblocked = $completed - $blocked;

    $vars->{'total'} = $total;
    $vars->{'completed'} = $completed;
    $vars->{'passed'} = $passed;
    $vars->{'failed'} = $failed;
    $vars->{'blocked'} = $blocked;

    $vars->{'percent_completed'} = calculate_percent($total, $completed);
    $vars->{'percent_passed'} = calculate_percent($completed, $passed);
    $vars->{'percent_failed'} = calculate_percent($completed, $failed);
    $vars->{'percent_blocked'} = calculate_percent($completed, $blocked);
    
    $template->process("testopia/reports/completion.html.tmpl", $vars)
       || ThrowTemplateError($template->error());
    exit;
    
}