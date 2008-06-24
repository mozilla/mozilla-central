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



sub test_list_caseruns
{
	my $self = shift;
	
	$sel->open("tr_list_caseruns.cgi");
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("Case Run History"),
                  "'tr_list_caseruns' failed to display 'Case Run History'");
}

=item test_update

Test updating changes to caserun list

=cut

sub test_update
{
	my $self = shift;
	
    my $test = {
	    url => "tr_list_caseruns.cgi",
	    action => "update",
	    params => {
	    	ids => TEST_RUN_1
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\":true"),
                  "Did not display '{\"success\":true' in test_update");
}

=item test_update_status_id

Test updating status id of caserun

=cut

sub test_update_status_id
{
	my $self = shift;
	my $dbh = Testopia::Test::Selenium::Util->dbh;
	
	#get current status id
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_case_runs 
          WHERE case_run_id = ?',
            undef, (TEST_CASERUN_1));
	my $status_id1 = $ref->{case_run_status_id};
	
	#update status id
    my $test = {
	    url => "tr_list_caseruns.cgi",
	    action => "update",
	    params => {
	    	ids 		=> TEST_CASERUN_1,
	    	status_id	=> 2
	    }
	};
	
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\":true"),
                  "Did not display '{\"success\":true' in test_update_status_id");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_case_runs 
          WHERE case_run_id = ?',
            undef, (TEST_CASERUN_1));
    
    $self->assert($ref->{case_run_status_id} eq 2, 
    	"Case Run '" . TEST_CASERUN_1 . "' status did not update.");
    
    #Change value back to original value
    $test->{params}->{status_id} = $status_id1;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\":true"),
                  "Did not display '{\"success\":true' in test_update_status_id");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_case_runs 
          WHERE case_run_id = ?',
            undef, (TEST_CASERUN_1));
    
    $self->assert($ref->{case_run_status_id} eq $status_id1, 
    	"Case Run '" . TEST_CASERUN_1 . "' status did not update.");
}

=item test_update_assignee

Test updating assignee of caserun

=cut

sub test_update_assignee
{
	my $self = shift;
	my $dbh = Testopia::Test::Selenium::Util->dbh;
	
	#get current assignee id
	my $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_case_runs 
          WHERE case_run_id = ?',
            undef, (TEST_CASERUN_1));
	my $assignee_id = $ref->{assignee};
	
	#get current assignee login name
	$ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM  profiles
          WHERE userid = ?',
            undef, ($assignee_id));
	my $assignee = $ref->{login_name};
	
	#update assignee
    my $test = {
	    url => "tr_list_caseruns.cgi",
	    action => "update",
	    params => {
	    	ids 		=> TEST_CASERUN_1,
	    	assignee	=> PARTNER_USER_LOGIN
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\":true"),
                  "Did not display '{\"success\":true' in test_update_assignee " . 
                  "when updating assignee the first time");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_case_runs 
          WHERE case_run_id = ?',
            undef, (TEST_CASERUN_1));
    $self->assert($ref->{assignee} eq PARTNER_USER_ID, 
    	"Case Run '" . TEST_CASERUN_1 . "' assignee did not update.");
    
    #Change value back to original value
    $test->{params}->{assignee} = $assignee;
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{\"success\":true"),
                  "Did not display '{\"success\":true' in test_update_assignee " . 
                  "when the assignee back to original assignee");
    
    #check to see if value updated correctly
    $ref = $dbh->selectrow_hashref(
        'SELECT * 
           FROM test_case_runs 
          WHERE case_run_id = ?',
            undef, (TEST_CASERUN_1));
    
    $self->assert($ref->{assignee} eq $assignee_id, 
    	"Case Run '" . TEST_CASERUN_1 . "' assignee did not update.");
}

=item test_delete

Test the Delete Selected and do_delete actions

=cut

sub test_delete
{
	my $self    = shift;
	
	my $dbh     = Testopia::Test::Selenium::Util->dbh;
	my $del_cr; # Caserun we want to delete
	 
	$dbh->prepare("INSERT INTO test_case_runs (run_id, case_id, assignee,
								case_run_status_id, case_text_version,
								build_id, notes, iscurrent, environment_id) 
                           VALUES (5, " . TEST_CASE_1 . 
                           		", 5, 2, 1, 4, 'To be deleted', 1, 1)")->execute();
	        
    # Get the list of caseruns for the case and run and grab the most recent	              
	($del_cr) = $dbh->selectrow_array("SELECT    case_run_id 
                                       FROM      test_case_runs
                                       WHERE          run_id  = 5
                                                 AND  case_id = " . TEST_CASE_1 . "
                                       ORDER BY  case_run_id DESC");
    
    #Perform deletion
    my $test = {
	    url => "tr_list_caseruns.cgi",
	    action => "delete",
	    params => {
	    	ids 		=> $del_cr
	    }
	};
    $sel->open(Testopia::Test::Selenium::Util::format_url($test));
    $sel->wait_for_page_to_load(TIMEOUT);
    $self->assert($sel->is_text_present("{'success': true}"),
                  "Did not display '{\"success\":true' in test_update");
    
    #Check to see if deletion successful
    my $dbtest = $dbh->selectrow_array("SELECT    case_run_id 
                                       FROM      test_case_runs
                                       WHERE     case_run_id = " . $del_cr);
    if ($dbtest){
    	$self->assert(0, "'$del_cr' not deleted");
    }
}
