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


sub test_list_plans
{
	my $self = shift;
	
    $sel->open("tr_list_runs.cgi");
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Test Runs"), 
           "Failed to find 'Test Runs' on 'tr_list_runs.cgi'");
}

=item test_update_without_ids

Tests the update action without ids

=cut

sub test_list_update_without_ids
{
	my $self = shift;
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "update",
	    params => {
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\":false"), 
           "Failed to find '{\"success\":false' on tr_list_runs.cgi when updating without ids");;
}

=item test_update_with_ids

Tests the update action with ids

=cut

sub test_list_update_with_ids
{
	my $self = shift;
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_RUN_1
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"), 
           "Failed to find '{'success': true}' on tr_list_runs.cgi when updating with ids");;
}

=item test_list_update_manager

Tests the update action with ids and updating manager

=cut

sub test_list_update_manager
{
	my $self = shift;
	my $dbh = Bugzilla->dbh; 
    
    #get current value
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE run_id = ?',
            undef, (TEST_RUN_1));
	my $currentManagerId = $ref->{manager_id};
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_RUN_1,
	    	manager => PARTNER_USER_ID
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"), 
           "Failed to find '{'success': true}' on tr_list_runs.cgi when updating manager");;
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
           WHERE run_id = ?',
            undef, (TEST_RUN_1));
    $self->assert($ref->{manager_id} eq PARTNER_USER_ID, 
    	"Run '" . TEST_RUN_1 . "' name did not update with new manager.");
	
	#Change value back to original value
    $test->{params}->{manager} = $currentManagerId;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"),
                  "Did not display '{'success': true}' in test_list_update_manager");
    
    #check to see if value updated correctly
   $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE run_id = ?',
            undef, (TEST_RUN_1));
    
    $self->assert($ref->{manager_id} eq $currentManagerId, 
    	"Run '" . TEST_RUN_1 . "' name did not update with previous manager.");
}

=item test_list_update_build

Tests the update action with ids and updating build

=cut

sub test_list_update_build
{
	my $self = shift;
	my $dbh = Bugzilla->dbh; 
    
    #get current value
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE run_id = ?',
            undef, (TEST_RUN_1));
	my $currentBuildId = $ref->{build_id};
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_RUN_1,
	    	build => TEST_BUILD_3
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"), 
           "Failed to find '{'success': true}' on tr_list_runs.cgi when updating build");;
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
           WHERE run_id = ?',
            undef, (TEST_RUN_1));
    $self->assert($ref->{build_id} eq TEST_BUILD_3,
    	"Run '" . TEST_RUN_1 . "' name did not update with new build.");
	
	#Change value back to original value
    $test->{params}->{build} = $currentBuildId;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"),
                  "Did not display '{'success': true}' in test_list_update_build");
    
    #check to see if value updated correctly
   $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE run_id = ?',
            undef, (TEST_RUN_1));
    
    $self->assert($ref->{build_id} eq $currentBuildId, 
    	"Run '" . TEST_RUN_1 . "' name did not update with previous build.");
}

=item test_list_update_environment

Tests the update action with ids and updating environment and tests delete

=cut

sub test_list_update_environment
{
	my $self = shift;
	my $dbh = Bugzilla->dbh; 
    
    #get current value
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE run_id = ?',
            undef, (TEST_RUN_1));
	my $currentEnvironmentId = $ref->{environment_id};
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_RUN_1,
	    	environment => TEST_ENV_3
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"), 
           "Failed to find '{'success': true}' on tr_list_runs.cgi when updating environment");;
	
	#check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
           WHERE run_id = ?',
            undef, (TEST_RUN_1));
    $self->assert($ref->{environment_id} eq TEST_ENV_3,
    	"Run '" . TEST_RUN_1 . "' name did not update with new environment.");
	
	#Change value back to original value
    $test->{params}->{environment} = $currentEnvironmentId;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"),
                  "Did not display '{'success': true}' in test_list_update_environment");
    
    #check to see if value updated correctly
   $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE run_id = ?',
            undef, (TEST_RUN_1));
    
    $self->assert($ref->{environment_id} eq $currentEnvironmentId, 
    	"Run '" . TEST_RUN_1 . "' name did not update with previous environment.");
}

=item test_list_clone_using_current_user_as_manager_and_tests_deleting

Tests the clone action using current user as manager

=cut

sub test_list_clone_using_current_user_as_manager_and_tests_deleting
{
	my $self = shift;
	my $dbh = Bugzilla->dbh; 
    
    my $summary = "Selenium Summary - " . localtime();
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "clone",
	    params => {
	    	ids => TEST_RUN_1 . "," . TEST_RUN_3,
	    	plan_ids => TEST_PLAN_1 . "," . TEST_PLAN_2,
	    	new_run_environment => TEST_ENV_3,
	    	new_run_summary => $summary,
	    	new_run_build => TEST_BUILD_3,
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true"), 
           "Failed to find '{'success': true' on tr_list_runs.cgi when cloning runs.");;
	
	#test the first clone
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE summary = ? 
          	AND plan_id = ?
          	AND product_version = ?',
            undef, ($summary, TEST_PLAN_1, TEST_PRODUCT_VERSION_2));
	$self->assert($ref->{plan_id} eq TEST_PLAN_1, 
    	"Did not clone with plan id of '" . TEST_PLAN_1 . "'.");
	$self->assert($ref->{environment_id} eq TEST_ENV_3, 
    	"Did not clone with environment id of '" . TEST_ENV_3 . "'.");
	$self->assert($ref->{build_id} eq TEST_BUILD_3, 
    	"Did not clone with build id of '" . TEST_BUILD_3 . "'.");
	$self->assert($ref->{summary} eq $summary, 
    	"Did not clone with summary of '" . $summary . "'.");
	$self->assert($ref->{product_version} eq TEST_PRODUCT_VERSION_2, 
    	"Did not clone with product version of '" . TEST_PRODUCT_VERSION_2 . "'.");
	$self->assert($ref->{manager_id} eq TESTER_USER_ID, 
    	"Did not clone with manager id of '" . TESTER_USER_ID . "'.");
	my $clone_id1 = $ref->{run_id};
	
	#test the second clone
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE summary = ? 
          	AND plan_id = ?
          	AND product_version = ?',
            undef, ($summary, TEST_PLAN_2, TEST_PRODUCT_VERSION_2));
	$self->assert($ref->{plan_id} eq TEST_PLAN_2, 
    	"Did not clone with plan id of '" . TEST_PLAN_1 . "'.");
	$self->assert($ref->{environment_id} eq TEST_ENV_3, 
    	"Did not clone with environment id of '" . TEST_ENV_3 . "'.");
	$self->assert($ref->{build_id} eq TEST_BUILD_3, 
    	"Did not clone with build id of '" . TEST_BUILD_3 . "'.");
	$self->assert($ref->{summary} eq $summary, 
    	"Did not clone with summary of '" . $summary . "'.");
	$self->assert($ref->{product_version} eq TEST_PRODUCT_VERSION_2, 
    	"Did not clone with product version of '" . TEST_PRODUCT_VERSION_2 . "'.");
	$self->assert($ref->{manager_id} eq TESTER_USER_ID, 
    	"Did not clone with manager id of '" . TESTER_USER_ID . "'.");
	my $clone_id2 = $ref->{run_id};
	
	#test the third clone
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE summary = ? 
          	AND plan_id = ?
          	AND product_version = ?',
            undef, ($summary, TEST_PLAN_1, TEST_PRODUCT_VERSION));
	$self->assert($ref->{plan_id} eq TEST_PLAN_1, 
    	"Did not clone with plan id of '" . TEST_PLAN_1 . "'.");
	$self->assert($ref->{environment_id} eq TEST_ENV_3, 
    	"Did not clone with environment id of '" . TEST_ENV_3 . "'.");
	$self->assert($ref->{build_id} eq TEST_BUILD_3, 
    	"Did not clone with build id of '" . TEST_BUILD_3 . "'.");
	$self->assert($ref->{summary} eq $summary, 
    	"Did not clone with summary of '" . $summary . "'.");
	$self->assert($ref->{product_version} eq TEST_PRODUCT_VERSION, 
    	"Did not clone with product version of '" . TEST_PRODUCT_VERSION . "'.");
	$self->assert($ref->{manager_id} eq TESTER_USER_ID, 
    	"Did not clone with manager id of '" . TESTER_USER_ID . "'.");
	my $clone_id3 = $ref->{run_id};
	
	#test the fourth clone
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE summary = ? 
          	AND plan_id = ?
          	AND product_version = ?',
            undef, ($summary, TEST_PLAN_2, TEST_PRODUCT_VERSION));
	$self->assert($ref->{plan_id} eq TEST_PLAN_2, 
    	"Did not clone with plan id of '" . TEST_PLAN_1 . "'.");
	$self->assert($ref->{environment_id} eq TEST_ENV_3, 
    	"Did not clone with environment id of '" . TEST_ENV_3 . "'.");
	$self->assert($ref->{build_id} eq TEST_BUILD_3, 
    	"Did not clone with build id of '" . TEST_BUILD_3 . "'.");
	$self->assert($ref->{summary} eq $summary, 
    	"Did not clone with summary of '" . $summary . "'.");
    $self->assert($ref->{product_version} eq TEST_PRODUCT_VERSION, 
    	"Did not clone with product version of '" . TEST_PRODUCT_VERSION . "'.");
	$self->assert($ref->{manager_id} eq TESTER_USER_ID, 
    	"Did not clone with manager id of '" . TESTER_USER_ID . "'.");
	my $clone_id4 = $ref->{run_id};
	
	#delete all created runs
	my $test2 = {
	    url => "tr_list_runs.cgi",
	    action => "delete",
	    params => {
	    	run_ids => $clone_id1 . "," . $clone_id2 .
	    	"," . $clone_id3 . "," . $clone_id4
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test2));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true"), 
           "Failed to find '{'success': true' on tr_list_runs.cgi when cloning runs.");;
	
	#Make sure it is deleted
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM  test_runs
           WHERE run_id = ?
           	OR run_id = ?
           	OR run_id = ?
           	OR run_id = ?',
            undef, ($clone_id1,$clone_id2,$clone_id3,$clone_id4));
	$self->assert(!exists($ref->{run_id}),
		"Did not delete runs.");
}

=item test_list_clone_using_existing_user_as_manager_and_tests_deleting

Tests the clone action using existing user as manager

=cut

sub test_list_clone_using_existing_user_as_manager_and_tests_deleting
{
	my $self = shift;
	my $dbh = Bugzilla->dbh; 
    
    my $summary = "Selenium Summary - " . localtime();
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "clone",
	    params => {
	    	ids => TEST_RUN_1,
	    	plan_ids => TEST_PLAN_1,
	    	new_run_environment => TEST_ENV_3,
	    	new_run_summary => $summary,
	    	new_run_build => TEST_BUILD_3,
	    	keep_run_manager => "true",
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true"), 
           "Failed to find '{'success': true' on tr_list_runs.cgi when cloning runs.");;
	
	#test the first clone
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE summary = ? 
          	AND plan_id = ?
          	AND product_version = ?',
            undef, ($summary, TEST_PLAN_1, TEST_PRODUCT_VERSION_2));
	$self->assert($ref->{plan_id} eq TEST_PLAN_1, 
    	"Did not clone with plan id of '" . TEST_PLAN_1 . "'.");
	$self->assert($ref->{environment_id} eq TEST_ENV_3, 
    	"Did not clone with environment id of '" . TEST_ENV_3 . "'.");
	$self->assert($ref->{build_id} eq TEST_BUILD_3, 
    	"Did not clone with build id of '" . TEST_BUILD_3 . "'.");
	$self->assert($ref->{summary} eq $summary, 
    	"Did not clone with summary of '" . $summary . "'.");
	$self->assert($ref->{product_version} eq TEST_PRODUCT_VERSION_2, 
    	"Did not clone with product version of '" . TEST_PRODUCT_VERSION_2 . "'.");
	$self->assert($ref->{manager_id} eq QA_SELENIUM_USER_ID, 
    	"Did not clone with manager id of '" . QA_SELENIUM_USER_ID . "'.");
	my $clone_id1 = $ref->{run_id};
	
	#delete all created runs
	my $test2 = {
	    url => "tr_list_runs.cgi",
	    action => "delete",
	    params => {
	    	run_ids => $clone_id1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test2));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true"), 
           "Failed to find '{'success': true' on tr_list_runs.cgi when cloning runs.");;
	
	#Make sure it is deleted
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM  test_runs
           WHERE run_id = ?',
            undef, ($clone_id1));
	$self->assert(!exists($ref->{run_id}),
		"Did not delete runs.");
}

=item test_list_clone_testing_copy_cases_without_case_list

Tests the clone action testing copying cases without case list

=cut

sub test_list_clone_testing_copy_cases_without_case_list
{
	my $self = shift;
	my $dbh = Bugzilla->dbh; 
    
    my $summary = "Selenium Summary - " . localtime();
    
    my $test = {
	    url => "tr_list_runs.cgi",
	    action => "clone",
	    params => {
	    	ids => TEST_RUN_1,
	    	plan_ids => TEST_PLAN_1,
	    	new_run_environment => TEST_ENV_3,
	    	new_run_summary => $summary,
	    	new_run_build => TEST_BUILD_3,
	    	keep_run_manager => "true",
	    	copy_cases => "true",
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true"), 
           "Failed to find '{'success': true' on tr_list_runs.cgi when cloning runs.");;
	
	#test the first clone
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_runs
          WHERE summary = ? 
          	AND plan_id = ?
          	AND product_version = ?',
            undef, ($summary, TEST_PLAN_1, TEST_PRODUCT_VERSION_2));
	$self->assert($ref->{plan_id} eq TEST_PLAN_1, 
    	"Did not clone with plan id of '" . TEST_PLAN_1 . "'.");
	$self->assert($ref->{environment_id} eq TEST_ENV_3, 
    	"Did not clone with environment id of '" . TEST_ENV_3 . "'.");
	$self->assert($ref->{build_id} eq TEST_BUILD_3, 
    	"Did not clone with build id of '" . TEST_BUILD_3 . "'.");
	$self->assert($ref->{summary} eq $summary, 
    	"Did not clone with summary of '" . $summary . "'.");
	$self->assert($ref->{product_version} eq TEST_PRODUCT_VERSION_2, 
    	"Did not clone with product version of '" . TEST_PRODUCT_VERSION_2 . "'.");
	$self->assert($ref->{manager_id} eq QA_SELENIUM_USER_ID, 
    	"Did not clone with manager id of '" . QA_SELENIUM_USER_ID . "'.");
	my $clone_id1 = $ref->{run_id};
	
	#Get all test runs created
	my $ref2 = $dbh->selectall_hashref(
        'SELECT * 
           FROM  test_case_runs
           WHERE run_id = ?',
            1, undef, ($clone_id1));
	
	#Check to seee if values are valid
	for my $entry (values %$ref2){
		$self->assert($entry->{run_id} eq $clone_id1, 
    	"Did not clone with run id of '" . $clone_id1 . "'.");
	}
	
	#delete all created runs
	my $test2 = {
	    url => "tr_list_runs.cgi",
	    action => "delete",
	    params => {
	    	run_ids => $clone_id1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test2));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true"), 
           "Failed to find '{'success': true' on tr_list_runs.cgi when cloning runs.");;
}


sub test_search_runs
{
	my $self = shift;
	
	#Show search plan
    $sel->open("tr_show_run.cgi");
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Search by Test Run Number"),
                  "Did not display 'Search by Test Run Number' in test_search_runs.");
	
}

=item test_show_runs

Test showing runs

=cut

sub test_show_runs
{
	my $self = shift;
	
	#Show case
    $sel->open("tr_show_run.cgi?run_id=" . TEST_RUN_1);
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Run List"),
                  "Did not display 'Run List' in test_show_runs.");
}

