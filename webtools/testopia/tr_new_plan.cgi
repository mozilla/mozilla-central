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
use Bugzilla::Config;
use Bugzilla::Error;
use Bugzilla::Util;
use JSON;

use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::Constants;

###############################################################################
# tr_new_plan.cgi
# Presents a webform to the user for the creation of a new test plan. 
# Creates a new testplan via Ajax 
#
# INTERFACE:
#    action: 
#      undef - Present form for new plan creation
#      "add" - Form has been submitted with plan data. Create the test
#              plan.
#
#    product_id: integer - (REQUIRED) ID of the Product the new plan should be created in
#          type: integer - (REQUIRED) ID of the Plan type
#  prod_version: string  - (REQUIRED) Version of the product to associate
#     plan_name: string  - (REQUIRED) Limited to 255 chars. Name for the plan
#       plandoc: string  - (OPTIONAL) HTML document describing the test plan
#       file1-5: fileloc - (OPTIONAL) Path to a file to upload
#  file_desc1-5: string  - (OPTIONAL) Description of file to attach
#
#
################################################################################ 

my $vars = {};
my $template = Bugzilla->template;

Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;
print $cgi->header;

my $action = $cgi->param('action') || '';

if ($action eq 'add'){
    Bugzilla->error_mode(ERROR_MODE_AJAX);
    ThrowUserError("testopia-create-denied", {'object' => 'Test Plan'}) unless Bugzilla->user->in_group('Testers');
    
    my $plan = Bugzilla::Testopia::TestPlan->create({
            'product_id' => $cgi->param('product_id'),
            'author_id'  => Bugzilla->user->id,
            'type_id'    => $cgi->param('type'),
            'default_product_version' => $cgi->param('prod_version'),
            'name'       => $cgi->param('plan_name'),
            'text'       => $cgi->param("plandoc") || '',
    });
    
    my $err = 'false';
    for (my $i=1; $i<5; $i++){
        next unless defined $cgi->upload("file$i");
            
        my $fh = $cgi->upload("file$i");
        my $data;
        # enable 'slurp' mode
        local $/;
        $data = <$fh>;
        $data || ThrowUserError("zero_length_file");

        Bugzilla->error_mode(ERROR_MODE_DIE);
        eval {
            my $attachment = Bugzilla::Testopia::Attachment->create({
                                plan_id      => $plan->id,
                                submitter_id => Bugzilla->user->id,
                                description  => $cgi->param("file_desc$1") || 'Attachment',
                                filename     => $cgi->upload("file$i"),
                                mime_type    => $cgi->uploadInfo($cgi->param("file$i"))->{'Content-Type'},
                                contents     => $data
            });
        };
        if ($@){
            $err = 'true';
        }
    }
    
    print "{success: true, plan: '". $plan->id ."', err: $err}";

}

####################
### Display Form ###
####################
else {
    my $product;
    if ($cgi->param('product_id')){
        $product = Bugzilla::Testopia::Product->new($cgi->param('product_id'));
        ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canedit;
        $vars->{'product'} = $product;
    }
    
    ThrowUserError("testopia-create-denied", {'object' => 'Test Plan'}) unless Bugzilla->user->in_group('Testers');
    $vars->{'plan'} = Bugzilla::Testopia::TestPlan->new({});
    $template->process("testopia/plan/add.html.tmpl", $vars) ||
        ThrowTemplateError($template->error());
}
