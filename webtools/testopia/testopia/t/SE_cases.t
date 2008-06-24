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

sub test_plan_prompt
{
	my $self = shift;
	
	#Test without action
	$sel->open("tr_new_case.cgi");
    $self->assert($sel->wait_for_page_to_load(TIMEOUT),
            "");
    $self->assert($sel->is_text_present("Choose a Test Plan"),
                  "SE_tr_new_case.cgi failed to display 'Choose a Test Plan'");
}

=item test_display_page

Tests displaying the tr_new_case.cgi page

=cut

sub test_display_page
{
	my $self = shift;
	my $test = {
	    url => "tr_new_case.cgi",
	    action => "display",
	    params => {
    	    plan_id => TEST_PLAN_1
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Create a New Test Case"),
                  "'SE_tr_new_case.cgi" . 
                  "?plan_id=" . TEST_PLAN_1 . 
                  "' failed to display 'Create a New Test Case'");
}

=item test_add

Tests the Add action for creating a test plan

=cut

sub test_add
{
	my $self = shift;
	my $dbh = Bugzilla->dbh;
	
	my $summary = "Selenium_Test_Case " . localtime();
	my $test = {
	    url => "tr_new_case.cgi",
	    action => "add",
	    params => {
    	    plan_id => TEST_PLAN_1,
    	    category => TEST_CAT,
    	    status => "2",
    	    priority => "1",
    	    isautomated => "0",
    	    summary => $summary
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present('{success: true'),
                  "'SE_tr_new_case.cgi' failed to display 'regexp:Case \\d+ Created'" 
                  . " after creating a new test case");
	
}

sub test_search_cases
{
	my $self = shift;
	
	#Show search case
    $sel->open("tr_show_case.cgi");
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Search by Test Case Number"),
                  "Did not display 'Search by Test Case Number' in test_search_cases.");
	
}

=item test_show_cases

Test showing cases

=cut

sub test_show_cases
{
	my $self = shift;
	
	#Show case
    $sel->open("tr_show_case.cgi?case_id=" . TEST_CASE_1);
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Case List"),
                  "Did not display 'Case List' in test_show_cases.");
}

sub test_load
{
	my $self = shift;
	
	$sel->open("tr_list_cases.cgi");
    $sel->wait_for_page_to_load(TIMEOUT);
    $sel->pause(5000); # used to let the whole page load 
    $self->assert($sel->is_text_present("Test Cases"),
    "'tr_list_cases.cgi' failed to display 'Test Cases'");
}

=item test_update

Tests the update action for tr_list_cases.cgi

=cut

sub test_update
{
	my $self = shift;
	
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_PLAN_1 . "," . TEST_PLAN_2
	    }
	};
	                  
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
}

=item test_update_addruns

Tests the update action for tr_list_cases.cgi with adding runs

=cut

sub test_update_addruns
{
	my $self = shift;
	
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_PLAN_1 . "," . TEST_PLAN_2,
	    	addsruns => TEST_RUN_1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
}

=item test_update_requirement

Tests the update action for tr_list_cases.cgi with updating requirement

=cut

sub test_update_requirement
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current requirement so can change back to old requirement
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $req1 = $ref->{requirement};
	
	#Get current requirement so can change back to old requirement
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $req2 = $ref->{requirement};
	
	#Change requirement
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	requirement => TEST_CASE_REQUIREMENT_1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert(TEST_CASE_REQUIREMENT_1 eq $ref->{requirement},
		"Test case '" .TEST_CASE_1 . "' did not update with requirement '" 
		. TEST_CASE_REQUIREMENT_1 . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert(TEST_CASE_REQUIREMENT_1 eq $ref->{requirement},
		"Test case '" .TEST_CASE_2 . "' did not update with requirement '" 
		. TEST_CASE_REQUIREMENT_1 . "'" );
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{requirement} = $req1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{requirement} = $req2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}

=item test_update_case_status

Tests the update action for tr_list_cases.cgi with updating case status

=cut

sub test_update_case_status
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current case status so can change back to old requirement
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $cStatus1 = $ref->{case_status_id};
	
	#Get current case status so can change back to old requirement
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $cStatus2 = $ref->{case_status_id};
	
	#Change case status
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	case_status => TEST_CASE_STATUS_1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert(TEST_CASE_STATUS_1 eq $ref->{case_status_id},
		"Test case '" .TEST_CASE_1 . "' did not update with case status '" 
		. TEST_CASE_STATUS_1 . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert(TEST_CASE_STATUS_1 eq $ref->{case_status_id},
		"Test case '" .TEST_CASE_2 . "' did not update with case status '" 
		. TEST_CASE_STATUS_1 . "'" );
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{case_status_id} = $cStatus1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{case_status_id} = $cStatus2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}

=item test_update_priority

Tests the update action for tr_list_cases.cgi with updating priority

=cut

sub test_update_priority
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current priority so can change back to old requirement
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $priority1 = $ref->{priority_id};
	
	#Get current priority so can change back to old priority
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $priority2 = $ref->{priority_id};
	
	#Change priority
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	priority => TEST_CASE_PRIORITY_1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert(TEST_CASE_PRIORITY_1 eq $ref->{priority_id},
		"Test case '" .TEST_CASE_1 . "' did not update with priority '" 
		. TEST_CASE_PRIORITY_1 . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert(TEST_CASE_PRIORITY_1 eq $ref->{priority_id},
		"Test case '" .TEST_CASE_2 . "' did not update with priority '" 
		. TEST_CASE_PRIORITY_1 . "'" );
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{priority} = $priority1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{priority} = $priority2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}

=item test_update_isautomated

Tests the update action for tr_list_cases.cgi with updating isautomated

=cut

sub test_update_isautomated
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current isautomated so can change back to old isautomated
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $isautomated1 = $ref->{isautomated};
	
	#Get current isautomated so can change back to old isautomated
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $isautomated2 = $ref->{isautomated};
	
	#convert isautomated so it will be in the right format
	my $isautomated = TEST_CASE_ISAUTOMATED_1;
	if($isautomated){
		$isautomated = "on";
	} else{
		$isautomated = "off";
	}
	
	#Change is automated
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	isautomated => $isautomated
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert(TEST_CASE_ISAUTOMATED_1 eq $ref->{isautomated},
		"Test case '" .TEST_CASE_1 . "' did not update with isautomated '" 
		. TEST_CASE_ISAUTOMATED_1 . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert(TEST_CASE_ISAUTOMATED_1 eq $ref->{isautomated},
		"Test case '" .TEST_CASE_2 . "' did not update with isautomated '" 
		. TEST_CASE_ISAUTOMATED_1 . "'" );
	
	#convert isautomated1 so it will be in the right format
	if($isautomated1){
		$isautomated1 = "on";
	} else{
		$isautomated1 = "off";
	}
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{isautomated} = $isautomated1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#convert isautomated2 so it will be in the right format
	if($isautomated2){
		$isautomated2 = "on";
	} else{
		$isautomated2 = "off";
	}
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{isautomated} = $isautomated2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}

=item test_update_script

Tests the update action for tr_list_cases.cgi with updating script

=cut

sub test_update_script
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current script so can change back to old script
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $script1 = $ref->{script};
	
	#Get current script so can change back to old script
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $script2 = $ref->{script};
	
	my $script = "Script " . $sel->get_eval("'Selenium-' + (new Date()).getTime()");
	
	#Change script
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	script => $script
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert($script eq $ref->{script},
		"Test case '" .TEST_CASE_1 . "' did not update with script '" 
		. $script . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert($script eq $ref->{script},
		"Test case '" .TEST_CASE_2 . "' did not update with script '" 
		. $script . "'" );
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{script} = $script1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{script} = $script2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}

=item test_update_arguments

Tests the update action for tr_list_cases.cgi with updating arguments

=cut

sub test_update_arguments
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current arguments so can change back to old argument
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $arguments1 = $ref->{arguments};
	
	#Get current arguments so can change back to old argument
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $arguments2 = $ref->{arguments};
	
	my $arguments = "Arguments " . $sel->get_eval("'Selenium-' + (new Date()).getTime()");
	
	#Change arguments
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	arguments => $arguments
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert($arguments eq $ref->{arguments},
		"Test case '" .TEST_CASE_1 . "' did not update with arguments '" 
		. $arguments . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert($arguments eq $ref->{arguments},
		"Test case '" .TEST_CASE_2 . "' did not update with arguments '" 
		. $arguments . "'" );
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{arguments} = $arguments1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{arguments} = $arguments2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}

=item test_update_category

Tests the update action for tr_list_cases.cgi with updating category

=cut

sub test_update_category
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current category so can change back to old category
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $category1 = $ref->{category_id};
	
	#Get current category so can change back to old category
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $category2 = $ref->{category_id};
	
	#Change category
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	category => TEST_CASE_1_CAT
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert(TEST_CASE_1_CAT eq $ref->{category_id},
		"Test case '" .TEST_CASE_1 . "' did not update with category '" 
		. TEST_CASE_1_CAT . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert(TEST_CASE_1_CAT eq $ref->{category_id},
		"Test case '" .TEST_CASE_2 . "' did not update with priority '" 
		. TEST_CASE_1_CAT . "'" );
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{category} = $category1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{category} = $category2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}

=item test_update_default_tester

Tests the update action for tr_list_cases.cgi with updating defalut tester

=cut

sub test_update_default_tester
{
	my $dbh = Bugzilla->dbh;
	
	my $self = shift;
	
	#Get current default tester so can change back to old default tester
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	my $default_tester1 = $ref->{default_tester_id};
	
	#Get current default tester so can change back to old default tester
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	my $default_tester2 = $ref->{default_tester_id};
	
	#Change default tester
    my $test = {
	    url => "tr_list_cases.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_CASE_1 . "," . TEST_CASE_2,
	    	tester => TEST_TESTER_1
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display '{'success': true}'");
	
	#Check to make sure it actually completed the update properly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_1));
	$self->assert(TEST_TESTER_1 eq $ref->{default_tester_id},
		"Test case '" .TEST_CASE_1 . "' did not update with default tester '" 
		. TEST_TESTER_1 . "'" );
	
	#Check to make sure it actually completed the update properly
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE case_id = ?',
            undef, (TEST_CASE_2));
	$self->assert(TEST_TESTER_1 eq $ref->{default_tester_id},
		"Test case '" .TEST_CASE_2 . "' did not update with default tester '" 
		. TEST_TESTER_1 . "'" );
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_1;
	$test->{params}->{tester} = $default_tester1;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	
	#Changes it back to it's original value
	$test->{params}->{ids} = TEST_CASE_2;
	$test->{params}->{tester} = $default_tester2;
	$sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
}
=item test_delete

Tests the delete and do_delete action for tr_list_cases.cgi

=cut

sub test_delete
{
	my $self = shift;
	
	# Create a test case to delete
	my $summary = $sel->get_eval("'DELETE ME -' + (new Date()).getTime()");
	my $test = {
	    url => "tr_new_case.cgi",
	    action => "add",
	    params => {
	    	plan_id 	=> TEST_PLAN_2,
	    	category 	=> TEST_CASE_1_CAT,
	    	status 		=> "3",
	    	priority 	=> "2",
	    	isautomated => "0",
	    	summary 	=> $summary
	    }
	};
	                  
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
	$sel->wait_for_page_to_load(TIMEOUT);
	$self->assert($sel->is_text_present('{success: true'),
                  "Unable to create a test case to delete");
	
	
	# Get case_id to use later
	my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_cases 
          WHERE summary = ?',
            undef, ($summary));
	my $del_case = $ref->{case_id};

    # Test the actual deletion
    $test = {
	    url => "tr_list_cases.cgi",
	    action => "delete",
	    params => {
	    	case_ids => $del_case
	    }
	};
	                  
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"),
                  "'tr_list_cases.cgi' failed to display" . 
                  " '{'success': true}'");


}

=item test_page_select

Tests the select which page from the list to display for tr_list_cases.cgi

=cut

sub test_list_tab
{
	my $self = shift;
	
    $sel->open("tr_list_cases.cgi" . 
               "?current_tab=case" . 
               "&page=1");
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Test Cases"), 
                  "'tr_list_cases.cgi' failed to display 'Test Cases'");
	
}
