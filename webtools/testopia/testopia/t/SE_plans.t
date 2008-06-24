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
#                 Jeff Dayley    <jedayley@novell.com>
#                 Ben Warby      <bwarby@novell.com>

use strict;

use lib "..";
use lib "../..";

use Test::More tests => 4;
use Test::Deep;

use Bugzilla;
use Bugzilla::Util;
use Bugzilla::Constants;

use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::Environment;

use Testopia::Test::Util;
use Testopia::Test::Constants;
use Testopia::Test::Selenium::Util;
use Testopia::Test::Selenium::Constants;

my ($user_type, $login, $passwd) = @ARGV;

use constant DEBUG => 1;

Bugzilla->error_mode(ERROR_MODE_DIE);

my $isanon = 0;
# $se object from Test::Selenium::Util
$se->start();

if ($login && $passwd){
    unless ( Testopia::Test::Selenium::Util->login( $login, $passwd) ) {
        $se->stop();
        fail('login');
        exit;
    }
}
else {
    $se->open( 'tr_environments.cgi' );
    $se->wait_for_page_to_load(TIMEOUT);
    $se->pause(3000) if DEBUG;
    
    ok( $se->is_text_present("I need a legitimate login and password to continue"), "anonymous user check" );
    $isanon = 1;

}
SKIP: {
    skip "Anonymous Login", 2 if $isanon;
    test_add();
    test_edit();
}

sub test_new_plan
{
	my $self = shift;
	
	
	
    $sel->open("tr_new_plan.cgi");
    $self->assert($sel->is_text_present("Create a New Test Plan"),
                  "Did not find 'Create a New Test Plan' on 'tr_new_plan.cgi'");
    
    my $test = {
	    url => "tr_new_plan.cgi",
	    action => "add",
	    params => {
    	    product_id => TEST_PRODUCT,
    	    plan_name => "Selenium Test - " . localtime(),
    	    prod_version => TEST_PRODUCT_VERSION,
    	    plan_doc => "Selenium Test - " . localtime(),
    	    type => TEST_PLAN_TYPE
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $self->assert($sel->is_text_present("success: true"),
                  "Test plan was not successfully created");
	
	#check add succeded
	
	my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE name = ?
            LIMIT 1',
            undef, 
            ($test->{params}->{plan_name}));
    
    #test each variable - 
    #I test for each variable because there is information auto generated
    #in the database so I cant test it all at once.
    cmp_deeply($test->{params}->{plan_name}, $ref->{name}, "Plan names match");
    cmp_deeply($test->{params}->{prod_version}, $ref->{default_product_version}, "Plan versions match");
    cmp_deeply($test->{params}->{product_id}, $ref->{product_id}, "Product id match");
    cmp_deeply($test->{params}->{type}, $ref->{type_id}, "Type id match");
    
}

=item test_new_plan_fail_product

Tests creating a new test plan when it should fail on a invalid product

=cut

sub test_new_plan_fail_product
{
	my $self = shift;
    
    my $test = {
	    url => "tr_new_plan.cgi",
	    action => "add",
	    params => {
    	    product_id => 999999,
    	    plan_name => "Selenium Test - " . localtime(),
    	    prod_version => TEST_PRODUCT_VERSION,
    	    plan_doc => "Selenium Test - " . localtime(),
    	    type => TEST_PLAN_TYPE
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $self->assert($sel->is_text_present('"success":false'),
                  "Did not recieve the \"success: false\" Json object as expected");
}


=item test_new_plan_fail_product_nonnumeric

Tests creating a new test plan when it should fail on a invalid product that contains
nonnumeric characters

=cut

sub test_new_plan_fail_product_nonnumeric
{
	my $self = shift;
    
    my $test = {
	    url => "tr_new_plan.cgi",
	    action => "add",
	    params => {
    	    product_id => 'e',
    	    plan_name => "Selenium Test - " . localtime(),
    	    prod_version => TEST_PRODUCT_VERSION,
    	    plan_doc => "Selenium Test - " . localtime(),
    	    type => TEST_PLAN_TYPE
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $self->assert($sel->is_text_present('"success":false'),
                  "Did not recieve the \"success: false\" Json object as expected");
}


=item test_new_plan_fail_product_version

Tests creating a new test plan when it should fail on a invalid product

=cut

sub test_new_plan_fail_product_version
{
	my $self = shift;
    
    my $test = {
	    url => "tr_new_plan.cgi",
	    action => "add",
	    params => {
    	    product_id => TEST_PRODUCT,
    	    plan_name => "Selenium Test - " . localtime(),
    	    prod_version => 'INVALID VERSION',
    	    plan_doc => "Selenium Test - " . localtime(),
    	    type => TEST_PLAN_TYPE
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $self->assert($sel->is_text_present('"success":false'),
                  "Did not recieve the \"success: false\" Json object as expected");
}

=item test_new_plan_fail_type

Tests creating a new test plan and failing on plan type

=cut

sub test_new_plan_fail_type
{
	my $self = shift;
    
     my $test = {
	    url => "tr_new_plan.cgi",
	    action => "add",
	    params => {
    	    product_id => TEST_PRODUCT,
    	    plan_name => "Selenium Test - " . localtime(),
    	    prod_version => TEST_PRODUCT_VERSION,
    	    plan_doc => "Selenium Test - " . localtime(),
    	    type => 999999999
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $self->assert($sel->is_text_present('"success":false'),
                  "Did not recieve the \"success: false\" Json object as expected");
}

=item test_new_plan_fail_type

Tests creating a new test plan and failing on plan type

=cut

sub test_new_plan_fail_type_nonnumeric
{
	my $self = shift;
    
    my $test = {
	    url => "tr_new_plan.cgi",
	    action => "add",
	    params => {
    	    product_id => TEST_PRODUCT,
    	    plan_name => "Selenium Test - " . localtime(),
    	    prod_version => TEST_PRODUCT_VERSION,
    	    plan_doc => "Selenium Test - " . localtime(),
    	    type => 'e'
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $self->assert($sel->is_text_present('"success":false'),
                  "Did not recieve the \"success: false\" Json object as expected");
}


sub test_list_plans
{
	my $self = shift;

    $sel->open("tr_list_plans.cgi");
    $sel->wait_for_page_to_load(TIMEOUT);
    $sel->pause(10000);
    $self->assert($sel->is_text_present("Test Plans"), 
                  "tr_list_plans.cgi didn't display 'Test Plans'");
	$self->assert($sel->is_text_present("Displaying test plans"), 
                  "tr_list_plans.cgi didn't display 'Displaying test plans'");
}

=item test_update

Tests the update action to see if it can update

=cut

sub test_update
{
	my $self = shift;
	
	my $test = {
	    url => "tr_list_plans.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_PLAN_1 . "," . TEST_PLAN_2
	    }
	};
	
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"), 
		"tr_list_plans.cgi didn't display '{'success': true}'");
}

=item test_update_plan_type

Tests the update action to see if it updates the plan type

=cut

sub test_update_plan_type
{
	my $self = shift;
	
	my $test = {
	    url => "tr_list_plans.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_PLAN_1 . "," . TEST_PLAN_2,
	    	plan_type => "1"
	    }
	};
	
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"), 
		"tr_list_plans.cgi didn't display '{'success': true}'");
	
	my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?
            LIMIT 1',
            undef, 
            (TEST_PLAN_2));
	cmp_deeply($ref->{type_id}, $test->{params}->{plan_type}, 
		"Plan updated correctly");
}

=item test_update_invalid_plan_type

Tests the update action to verify it doesn't update the plan type 
to an invalid plan type

=cut

sub test_update_invalid_plan_type
{
	my $self = shift;
	
	my $test = {
	    url => "tr_list_plans.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_PLAN_1 . "," . TEST_PLAN_2,
	    	plan_type => "-1"
	    }
	};
	
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("invalid-test-id-non-existent"), 
		"tr_list_plans.cgi didn't display 'invalid-test-id-non-existent'");
}

sub test_archive
{
	my $self = shift;
	my $dbh = Bugzilla->dbh;
	
	#get current archive status
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
	my $isactive = $ref->{isactive};
	
	# Test setting archieve status
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => $isactive ? "archive" : "unarchive",
	    params => {
    	    plan_id => TEST_PLAN_1
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert($sel->is_text_present('{"success" : true}'),
	              "Archival of Test plan '". TEST_PLAN_1 . "' failed");
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{isactive} != $isactive, 
    	"Test plan '" . TEST_PLAN_1 . "' isactive did not update.");
    
    #Change value back to original value
    $test->{action} = $isactive ? "unarchive" : "archive",
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\" : true"),
                  "Did not display '{\"success\" : true' in test_archive");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{isactive} eq $isactive, 
    	"Test plan '" . TEST_PLAN_1 . "' isactive did not update.");
    
    
}

=item test_clone_and_delete

Clones a test plan then deletes it

=cut

sub test_clone_and_delete
{
	my $self = shift;
	my $page;
	my $obj;
	my $del_plan;
	
	# Test Cloning with keeping permissions
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => "clone",
	    params => {
    	    plan_id 			=> TEST_PLAN_1,
    	    plan_name 			=> "Selenium Plan Clone Test - " . localtime(),
    	    product_id 			=> TEST_PRODUCT,
    	    prod_version	 	=>TEST_PRODUCT_VERSION,
    	    copy_tags	 		=> "1",
    	    copy_attachments	=> "1",
    	    copy_cases			=> "1"
	    }
	};
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	$self->assert($sel->is_text_present('{"success" : true, "plan_id" : '),
	              "Cloning of Test plan '". TEST_PLAN_1 . "' failed");

    # Get the new plan id	              
    $page     = $sel->get_body_text();
    $obj      = jsonToObj($page);
    $del_plan = $obj->{'plan_id'}; 
	              
    # Delete the the plan 
    $test = {
	    url => "tr_process_plan.cgi",
	    action => "delete",
	    params => {
    	    plan_id => $del_plan
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert('{"success" : true}',
	              "Failed to delete test plan '$del_plan'");
}

=item test_clone_with_permissions_and_delete

Clones a test plan then deletes it

=cut

sub test_clone_with_permissions_and_delete
{
	my $self = shift;
	my $page;
	my $obj;
	my $del_plan;
	
	# Test Cloning with keeping permissions
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => "clone",
	    params => {
    	    plan_id => TEST_PLAN_1,
    	    plan_name => "Selenium Plan Clone Test - " . localtime(),
			product_id => TEST_PRODUCT,
	        prod_version => TEST_PRODUCT_VERSION, 
	        copy_tags => "1",
	        copy_attachments => "1",
	        copy_perms => "1",
	        copy_cases => "1"
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert($sel->is_text_present('{"success" : true, "plan_id" : '),
	              "Cloning with permissions of Test plan '". TEST_PLAN_1 . "' failed");

    # Get the new plan id	              
    $page     = $sel->get_body_text();
    $obj      = jsonToObj($page);
    $del_plan = $obj->{'plan_id'}; 
	              
    # Delete the the plan 
    $test = {
	    url => "tr_process_plan.cgi",
	    action => "delete",
	    params => {
    	    plan_id => $del_plan
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert('{"success" : true}',
	              "Failed to delete test plan '$del_plan'");
}


=item test_edit_version

Test the edit action with editing version

=cut

sub test_edit_version
{
	my $self = shift;
	my $dbh = Bugzilla->dbh;
	
	#get current product version
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
	my $plan_version = $ref->{default_product_version};
	
	# Test Editing a document
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => "edit",
	    params => {
    	    plan_id => TEST_PLAN_1,
    	    prod_version => TEST_PRODUCT_VERSION_2
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert($sel->is_text_present('{"success" : true}'),
	              "Unable to edit test plan '" . TEST_PLAN_1 . "'.");
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{default_product_version} eq TEST_PRODUCT_VERSION_2, 
    	"Plan '" . TEST_PLAN_1 . "' version did not update.");
	
	#Change value back to original value
    $test->{params}->{default_product_version} = $plan_version;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\" : true"),
                  "Did not display '{\"success\" : true' in test_edit_version");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{default_product_version} eq $plan_version, 
    	"Plan '" . TEST_PLAN_1 . "' version did not update.");
	
}

=item test_edit_type

Test the edit action with editing type

=cut

sub test_edit_type
{
	my $self = shift;
	my $dbh = Bugzilla->dbh;
	
	#get current product type
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
	my $type_id = $ref->{type_id};
	
	# Test Editing a document
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => "edit",
	    params => {
    	    plan_id => TEST_PLAN_1,
    	    type => TEST_PLAN_TYPE
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert($sel->is_text_present('{"success" : true}'),
	              "Unable to edit test plan '" . TEST_PLAN_1 . "'.");
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{type_id} eq TEST_PLAN_TYPE, 
    	"Plan '" . TEST_PLAN_1 . "' type did not update.");
	
	#Change value back to original value
    $test->{params}->{type} = $type_id;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\" : true"),
                  "Did not display '{\"success\" : true' in test_edit_type");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{type_id} eq $type_id, 
    	"Plan '" . TEST_PLAN_1 . "' type did not update.");
	
}

=item test_edit_name

Test the edit action with editing name

=cut

sub test_edit_name
{
	my $self = shift;
	my $dbh = Bugzilla->dbh;
	
	#get current product type
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
	my $name = $ref->{name};
	
	my $new_name = "Selenium Update - " . localtime();
	
	# Test Editing a document
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => "edit",
	    params => {
    	    plan_id => TEST_PLAN_1,
    	    name => $new_name
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert($sel->is_text_present('{"success" : true}'),
	              "Unable to edit test plan '" . TEST_PLAN_1 . "'.");
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{name} eq $new_name, 
    	"Plan '" . TEST_PLAN_1 . "' name did not update.");
	
	#Change value back to original value
    $test->{params}->{name} = $name;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\" : true"),
                  "Did not display '{\"success\" : true' in test_edit_name");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plans 
          WHERE plan_id = ?',
            undef, (TEST_PLAN_1));
    
    $self->assert($ref->{name} eq $name, 
    	"Plan '" . TEST_PLAN_1 . "' type did not update.");
	
}

=item test_edit_name

Test the edit action with editing name

=cut

sub test_edit_plandoc
{
	my $self = shift;
	my $dbh = Bugzilla->dbh;
	
	#get current product type
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plan_texts
          WHERE plan_id = ? AND plan_text_version =
          	 	(SELECT MAX(plan_text_version)
          	 		FROM test_plan_texts
          	 		WHERE plan_id = ?)',
            undef, (TEST_PLAN_1, TEST_PLAN_1));
	my $plandoc = $ref->{plan_text};
	
	my $new_plan_text = "&nbsp;This is a updated test plan - " . 
		localtime() . "<br>";
	
	# Test Editing a document
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => "edit",
	    params => {
    	    plan_id => TEST_PLAN_1,
    	    plandoc => $new_plan_text
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert($sel->is_text_present('{"success" : true}'),
	              "Unable to edit test plan '" . TEST_PLAN_1 . "'.");
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plan_texts
          WHERE plan_id = ? AND plan_text_version =
          	 	(SELECT MAX(plan_text_version)
          	 		FROM test_plan_texts
          	 		WHERE plan_id = ?)',
            undef, (TEST_PLAN_1, TEST_PLAN_1));
    
    $self->assert($ref->{plan_text} eq $new_plan_text, 
    	"Plan '" . TEST_PLAN_1 . "' name did not update.");
	
	#Change value back to original value
    $test->{params}->{plandoc} = $plandoc;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\" : true"),
                  "Did not display '{\"success\" : true' in test_edit_plandoc");
    
    #check to see if value updated correctly
   $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_plan_texts
          WHERE plan_id = ? AND plan_text_version =
          	 	(SELECT MAX(plan_text_version)
          	 		FROM test_plan_texts
          	 		WHERE plan_id = ?)',
            undef, (TEST_PLAN_1, TEST_PLAN_1));
    
    $self->assert($ref->{plan_text} eq $plandoc, 
    	"Plan '" . TEST_PLAN_1 . "' type did not update.");
	
}

=item test_noaction

Test when there is no action or an invalid action specified

=cut

sub test_noaction
{
    my $self = shift;
	              
	# Test Editing a document
	my $test = {
	    url => "tr_process_plan.cgi",
	    action => "badaction",
	    params => {
    	    plan_id => TEST_PLAN_1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$self->assert($sel->is_text_present('Either there was no action specified, or I didn\'t recognize it.'),
		"Action was recognized when no action provided.")            
	    
}


sub test_search_plans
{
	my $self = shift;
	
	#Show search plan
    $sel->open("tr_show_plan.cgi");
    $sel->wait_for_page_to_load(TIMEOUT);
    #$sel->pause(30000);
    $self->assert($sel->is_text_present("Choose a Test Plan"),
                  "Did not display 'Choose a Test Plan' in test_search_plans.");
	
}

=item test_show_plans

Test showing plans

=cut

sub test_show_plans
{
	my $self = shift;
	
	#Show case
    $sel->open("tr_show_plan.cgi?plan_id=" . TEST_PLAN_1);
    $sel->wait_for_page_to_load(TIMEOUT);
    #$sel->pause(30000);
    $self->assert($sel->is_text_present("Plan List"),
                  "Did not display 'Plan List' in test_show_plans.");
}
