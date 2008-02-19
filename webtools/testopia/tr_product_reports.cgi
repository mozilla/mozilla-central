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

print $cgi->header;
use Data::Dumper;

#print STDERR Dumper($cgi);
Bugzilla->login(LOGIN_REQUIRED);

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

if ($cgi->param('product_id')){
    $product = Bugzilla::Testopia::Product->new($cgi->param('product_id'));
    ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canedit;
    $vars->{'product'} = $product;
}

my $type = $cgi->param('type') || '';
my $action = $cgi->param('action') || '';
if ($action eq 'draw'){
        exit unless $product;
        
        my @data;
        my $caserun = Bugzilla::Testopia::TestCaseRun->new({});
        my $run = Bugzilla::Testopia::TestRun->new({});
        
        my @names;
        my @values;

    if ($type eq 'completion'){
        my $open = 0;
        my $closed = 0;
        foreach my $status (@{$caserun->get_status_list}){
            if ($caserun->is_open_status($status->{'id'})){
                $open += $run->case_run_count($status->{'id'}, undef, undef, [$product]);
            }
            else {
                $closed += $run->case_run_count($status->{'id'}, undef, undef, [$product]);
            }
        }
        push @names, 'Completed', 'Not Completed';
        push @values, $closed, $open;
        $vars->{'chart_title'} = 'Completion Percentage';
        $vars->{'colors'} = (['#56e871', '#FFFFFF']);
        
    }
    elsif ($type eq 'passrate'){
        foreach my $status (@{$caserun->get_status_list}){
            if ($caserun->is_closed_status($status->{'id'})){
                push @names, $status->{'name'};
                push @values, $run->case_run_count($status->{'id'}, undef, undef, [$product]);
            }
        }
        
        $vars->{'chart_title'} = 'Pass/Fail Rate';
        $vars->{'colors'} = (['#56e871', '#ed3f58','#e17a56']);
        
    }
    
    elsif ($type eq 'breakdown'){
        foreach my $status (@{$caserun->get_status_list}){
             push @names, $status->{'name'};
             push @values, $run->case_run_count($status->{'id'}, undef, undef, [$product]);
        }
        $vars->{'chart_title'} = 'Status Breakdown';
        $vars->{'colors'} = (['#858aef', '#56e871', '#ed3f58', '#b8eae1', '#f1d9ab', '#e17a56']);
        
    }
    
    push @data, \@names;
    push @data, \@values;

    $vars->{'width'} = 200;
    $vars->{'height'} = 150;
    $vars->{'data'} = \@data;

        
    print $cgi->header;
    $template->process("testopia/reports/report-pie.png.tmpl", $vars)
       || ThrowTemplateError($template->error());
}