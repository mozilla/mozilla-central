#!/usr/bin/perl -w
# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Mozilla Public
# License Version 1.1 (the "License"); you may not use this fileTestopia::Test::Util
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
#                 Al Rodriguez  <arodriquez@novell.com>

package OBJ_Attachment;

use lib '.';
use lib '../..';
use strict;


use base qw(Test::Unit::TestCase);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Testopia::Attachment;
use Bugzilla::Testopia::TestPlan;

use Test;
use Testopia::Test::Constants;
use Testopia::Test::Util;

use Test::More;
use Test::Exception;
use Test::Deep;

Bugzilla->error_mode(ERROR_MODE_DIE);

use constant DB_TABLE => 'test_attachments';
use constant ID_FIELD => 'attachment_id';

our $obj = Test::test_init_from_value(DB_TABLE, ID_FIELD, '3', 'Bugzilla::Testopia::Attachment');

our $dbh = Bugzilla->dbh;

sub test_create{
	my $obj_hash = {'submitter_id' => 1,
					'description' => "It's New",
					'filename' => 'MyFile.txt',
					'mime_type' => 'text/plain',
					'case_id' => 1,
					'contents' => 'Textual Contents'};

	_bad_creates($obj_hash);

	case_id_create($obj_hash);
	plan_id_create($obj_hash);
}

sub case_id_create{
	my $obj_hash = shift;
	my $created_obj = Bugzilla::Testopia::Attachment->create($obj_hash);
	#Compare data against 3 database tables
	delete $obj_hash->{'case_id'};
	delete $obj_hash->{'contents'};
	my $id = $created_obj->{'attachment_id'};
	my $ts = $created_obj->{'creation_ts'};
	delete $created_obj->{'attachment_id'};
	delete $created_obj->{'creation_ts'};
	cmp_deeply($obj_hash, noclass($created_obj), "DB and Created Object Fields Match");	
	$obj_hash->{'case_id'} = 1;
	$obj_hash->{'contents'} = 'Textual Contents';
	$created_obj->{'attachment_id'} = $id;
	$created_obj->{'creation_ts'} = $ts;
	
	
	my $db_obj = Testopia::Test::Util::get_rep_by_field('test_attachment_data',
										'attachment_id', $created_obj->{'attachment_id'} );
	
	$db_obj = Testopia::Test::Util::get_rep_by_field('test_case_attachments', 
											'attachment_id', $created_obj->{'attachment_id'});
	like($db_obj->{'case_id'}, '/1/', 'Case ID Match');
	ok(!defined($db_obj->{'case_run_id'}), 'Case Run ID Not Defind');

	#Remove test entries from the Database
	#In order to also test creating plans
	$dbh->do("DELETE FROM test_attachments WHERE attachment_id = ?", undef, $created_obj->{'attachment_id'});
	$dbh->do("DELETE FROM test_attachment_data WHERE attachment_id = ?", undef, $created_obj->{'attachment_id'});
	$dbh->do("DELETE FROM test_case_attachments WHERE attachment_id = ?", undef, $created_obj->{'attachment_id'});
}

sub plan_id_create{
	my $obj_hash = shift;

	$obj_hash->{'plan_id'} = 1;
	delete $obj_hash->{'case_id'};

	my $created_obj = Bugzilla::Testopia::Attachment->create($obj_hash);
	delete $obj_hash->{'plan_id'};
	delete $obj_hash->{'contents'};
	my $id = $created_obj->{'attachment_id'};
	my $ts = $created_obj->{'creation_ts'};
	delete $created_obj->{'attachment_id'};
	delete $created_obj->{'creation_ts'};
	cmp_deeply($obj_hash, noclass($created_obj), "DB and Created Object Fields Match");	
	$obj_hash->{'plan_id'} = 1;
	$obj_hash->{'contents'} = 'Textual Contents';
	$created_obj->{'attachment_id'} = $id;
	$created_obj->{'creation_ts'} = $ts;
	
	my $db_obj = Testopia::Test::Util::get_rep('test_attachment_data',
										'attachment_id', $created_obj->{'attachment_id'} );

	$db_obj = Test::get_rep('test_plan_attachments', 
											'attachment_id', $created_obj->{'attachment_id'});
	like($db_obj->{'plan_id'}, '/1/', 'Plan ID Match');

	#Remove test entries form the Database
	$dbh->do("DELETE FROM test_attachments WHERE attachment_id = ?", undef, $created_obj->{'attachment_id'});
	$dbh->do("DELETE FROM test_attachment_data WHERE attachment_id = ?", undef, $created_obj->{'attachment_id'});
	$dbh->do("DELETE FROM test_plan_attachments WHERE attachment_id = ?", undef, $created_obj->{'attachment_id'});
}

sub _bad_creates{
	my $obj_hash = shift;
		dies_ok(sub{Bugzilla::Testopia::Attachment->create}, 
				"Can't create Attachment with No Parameters");

	delete $obj_hash->{'submitter_id'};
	dies_ok(sub{Bugzilla::Testopia::Attachment->create($obj_hash)}, 
			"Can't create Attachment without submitter_id");
			
	$obj_hash->{'submitter_id'} = 1;
	delete $obj_hash->{'description'};
	dies_ok(sub{Bugzilla::Testopia::Attachment->create($obj_hash)},
				"Can't create Attachment without description");
				
	$obj_hash->{'description'} = "It's New";
	delete $obj_hash->{'filename'};
	dies_ok(sub{Bugzilla::Testopia::Attachment->create($obj_hash)},
				"Can't create Attachment without filename");
				
	$obj_hash->{'filename'} = 'MyFile.txt';
	delete $obj_hash->{'mime_type'};
	dies_ok(sub{Bugzilla::Testopia::Attachment->create($obj_hash)},
				"Can't create Attachment without mime_type");
				
	$obj_hash->{'mime_type'} = 'text/plan';
	delete $obj_hash->{'case_id'};
	dies_ok(sub{Bugzilla::Testopia::Attachment->create($obj_hash)},
			"Can't create Attachment without case_id or plan_id");
			
	$obj_hash->{'case_id'} = 1;
}

sub test_is_browser_safe{
	use Bugzilla::CGI;
	my $cgi = new Bugzilla::CGI();
	$obj->{'mime_type'} = 'text/html';
	ok($obj->is_browser_safe($cgi) eq 1, 'Accepts Text');
	$obj->{'mime_type'} = 'image/jpeg';
	ok($obj->is_browser_safe($cgi) eq 1, 'Accepts Images');
}

sub _link_plan{
	Test::set_user(1, 'admin@testopia.com', 'admin@testopia.com');
	my $id = $dbh->selectrow_array("SELECT MAX(id) FROM products WHERE id <> ?", undef, $obj->id);

	my $plan = new Bugzilla::Testopia::TestPlan($id);
	$obj->link_plan($plan->id);
	my $db_obj = $dbh->selectrow_hashref("SELECT * FROM test_plan_attachments WHERE attachment_id = ? AND plan_id = ?", undef, $obj->id, $plan->id);
	ok( ($db_obj->{'plan_id'} eq $plan->id) && ($db_obj->{'attachment_id'} eq $obj->id), 'Plan Linked to Attachment');
	_unlink_plan($plan);
}

sub _link_case{
	Test::set_user(1, 'admin@testopia.com', 'admin@testopia.com');
	my @plans;
	my $id = $dbh->selectrow_array("SELECT MAX(id) FROM products WHERE id <> ?", undef, $obj->id);

	for(my $i=0; $i < 2; $i++){
		my $plan = Bugzilla::Testopia::TestPlan->new($id);
		$id--;
		push @plans, $plan;
	}
	my $case = Bugzilla::Testopia::TestCase->create({'case_status_id' => 1,
													 'category_id'  => 1,
													 'priority_id'     => 1,
													 'author_id'     => $obj->id,
													 'plans'     => \@plans,
													 'summary'    => 'SUMMARY'});
	
	$obj->link_case($case->id);
	my $db_obj = $dbh->selectrow_hashref("SELECT * FROM test_case_attachments WHERE case_id = ?", undef, $case->id);
	delete $case->{'plans'};
	ok( ($db_obj->{'case_id'} eq $case->id) && ($db_obj->{'attachment_id'} eq $obj->id), 'Case Linked to Attachment');
	_unlink_case($case);
}

sub _unlink_plan{
	my $plan = shift;
	my $old = $dbh->selectrow_hashref("SELECT * FROM test_plan_attachments WHERE attachment_id = ? AND plan_id = ?", undef, $obj->id, $plan->id);;	
	$obj->unlink_plan($plan->id);
	my $new = $dbh->selectrow_hashref("SELECT * FROM test_plan_attachments WHERE attachment_id = ? AND plan_id = ?", undef, $obj->id, $plan->id);;
	ok(defined $old && !defined $new, 'Plan Unlinked')
}

sub _unlink_case{
	my $case = shift;
	my $old = $dbh->selectrow_hashref("SELECT * FROM test_case_attachments WHERE case_id = ?", undef, $case->id);
	$obj->unlink_case($case->id);
	my $new = $dbh->selectrow_hashref("SELECT * FROM test_case_attachments WHERE case_id = ?", undef, $case->id);
	ok(defined $old && !defined $new, 'Plan Unlinked')
}

sub test_can_view{
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
			ok($obj->canview,  $login->{'login_name'} . ' Can View Attachment');
	}
}

sub test_can_edit{
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
			ok($obj->canedit,  $login->{'login_name'} . ' Can Edit Attachment');
	}	
}

sub test_can_delete{
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
		if($login->{'id'} =~ m/1/ ){ #If user is Admin
			ok($obj->candelete,  $login->{'login_name'} . ' Can Delete Attachment');
		}
		else{
			ok(! $obj->candelete,  $login->{'login_name'} . ' Can Not Delete Attachment');
		}	
	}
}

sub test_datasize{
	$obj->{'datasize'} = 3110;
	ok($obj->datasize eq 3110, 'Datasize Match');
}

sub test_contents{
	$obj->{'contents'} = 'Some Text';	
	like($obj->contents, '/Some Text/', 'Contents Match');
	delete $obj->{'contents'};
# Only checks to match the first of 5 paragraphs
	like($obj->contents, '//', 'DB Contents Match');	
}

sub test_type{
	delete $obj->{'type'};
	like($obj->type, '/attachment/', 'Type is Attachment');
	like($obj->{'type'}, '/attachment/', 'Type is Attachment');
}

sub test_cases{
	Test::set_user(1, 'admin@testopia.com', 'admin@testopia.com');
	my $id = $dbh->selectrow_array("SELECT MAX(plan_id) FROM test_plans WHERE plan_id <> ?", undef, $obj->id);
	
	my @plans;
	for(my $i=0; $i < 2; $i++){
		my $plan = Bugzilla::Testopia::TestPlan->new($id);
		$id--;
		push @plans, $plan;
	}
	my $case = Bugzilla::Testopia::TestCase->create({'case_status_id' 	 => 1,
													 'category_id'  	 => 1,
													 'priority_id'     	 => 1,
													 'author_id'     	 => 1,
													 'plans'     		 => \@plans,
													 'summary'    		 => 'SUMMARY'});
	$obj->link_case($case->id);
	ok(defined $obj->cases, 'TestCase Created');
	_link_case;
}

sub test_plans{
	Test::set_user(1, 'admin@testopia.com', 'admin@testopia.com');
	my $id = $dbh->selectrow_array("SELECT MAX(id) FROM products WHERE id <> ?", undef, $obj->id);
	my $plan = Bugzilla::Testopia::TestPlan->new($id);
	$obj->link_plan($plan->id);
	delete $plan->{'version'};
	ok( defined $obj->plans, 'TestPlans Linked' );
	_link_plan;
}

sub test_obliterate{
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
		if($login->{'id'} =~ m/1/ ){ #If user is Admin
			$obj->obliterate;
			my $db_data = $dbh->selectrow_hashref("SELECT * FROM test_attachment_data where attachment_id = ?", undef, $obj->id);
			my $db_case = $dbh->selectrow_hashref("SELECT * FROM test_case_attachments where attachment_id = ?", undef, $obj->id);
			my $db_plan = $dbh->selectrow_hashref("SELECT * FROM test_plan_attachments where attachment_id = ?", undef, $obj->id);
			my $db_attach = $dbh->selectrow_hashref("SELECT * FROM test_attachments where attachment_id = ?", undef, $obj->id);
			ok( !defined $db_data && !defined $db_case && !defined $db_plan && !defined $db_attach, 'Objected Obliterated');
		}
		else{
			ok(! $obj->obliterate,  $obj->{'login_name'} . ' Can Not Obliterate Attachment');
		}	
	}
}

sub new {
    my $self = shift()->SUPER::new(@_);
    return $self;
}

sub set_up {
    my $self = shift;
}

sub tear_down {
    my $self = shift;
}

1;

