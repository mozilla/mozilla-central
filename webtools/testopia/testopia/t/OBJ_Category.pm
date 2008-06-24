#!/usr/bin/perl -w
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
#                 Al Rodriguez  <arodriquez@novell.com>

package OBJ_Category;

use lib'.';
use lib '../..';
use strict;

use base qw(Test::Unit::TestCase);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Testopia::Category;
use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::TestPlan;

use Test;
use Testopia::Test::Constants;
use Testopia::Test::Util;

use Test::More;
use Test::Exception;
use Test::Deep;
	
Bugzilla->error_mode(ERROR_MODE_DIE);

use constant DB_TABLE => 'test_case_categories';
use constant ID_FIELD => 'category_id';

our $obj = Test::test_init(DB_TABLE, ID_FIELD, 'Bugzilla::Testopia::Category');
our $dbh = Bugzilla->dbh;

sub test_set_description{
	$obj->set_description('Something Else');	
	ok($obj->{'description'} eq 'Something Else', 'Description Changed');
}

sub test_set_name{
	dies_ok(sub{$obj->set_name}, "Can't change to empty name");
	dies_ok(sub{$obj->set_name('')}, "Can't change to empty name");
	my $nonunique_name = $dbh->selectrow_array("SELECT name from test_case_categories WHERE category_id <> ? AND product_id = ?", undef, $obj->id, $obj->{'product_id'});
	dies_ok(sub{$obj->set_name($nonunique_name)}, 'New Name Not Unique');
	my $product = new Bugzilla::Testopia::Product(1);
	ok($obj->set_name('New Name', $product) eq 'New Name', 'Name Set');
}

sub test_create{
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	my $hash_obj = {product_id => 1, name => 'Unique Name'};
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
	
		unless(Bugzilla->user->in_group('Testers') ){
			dies_ok( sub {Bugzilla::Testopia::Category->create($hash_obj)}, "User " . Bugzilla->user->{'login_name'} ." does not have rights to create new builds");	
		}
		else{	
			my $created_obj = Bugzilla::Testopia::Category->create($hash_obj);
			ok($created_obj->{'product_id'} eq $hash_obj->{'product_id'}, "Object Created with ProductId");
			ok($created_obj->{'name'} eq $hash_obj->{'name'}, "Object Created with a Name");
			Bugzilla->dbh->do('DELETE FROM test_case_categories WHERE category_id = ?', undef, $created_obj->id);
		}
	}	

}

sub test_remove{
#	$dbh->do("INSERT INTO test_case_categories (category_id, product_id, name) VALUES ('998', '998', 'NAME');");
	my $id = $obj->id;
	my $query = "SELECT * FROM test_case_categories WHERE category_id = ?";
	my $row = $dbh->selectrow_array($query, undef, $id);
	$obj->remove;
	$row = $dbh->selectrow_array($query, undef, $id);
	ok( !defined($row), 'Category Removed');
}

sub test_candelete{
	my $id = $obj->id + 1;
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
				my $plan = new Bugzilla::Testopia::TestPlan(1);
			my $case_hash = {
					'case_status_id' 	=> 1,
					'priority_id' 		=> 1,
					'default_tester_id'	=> 1,
					'isautomated'		=> 1,
					'sortkey'			=> 1,
					'script'			=> 'SCRIPT',
					'arguments'			=> 'ARGS',
					'summary'			=> 'SUMMARY',
					'requirement'		=> '',
					'alias'				=> '',
					'estimated_time'	=> '1:23:4',
					'dependson'			=> '',
					'blocks'			=> '',
					'plans'				=> [$plan],
					'runs'				=> '1',
					'tags'				=> '',
					'components'		=> '1',
					'bugs'				=> '1',
					'category_id'		=> $id,
					'author_id'			=> 1};
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
	
	# If the user does not have rights to delete, they go here
		unless(Bugzilla->user->in_group('Testers') ){
			ok( ! $obj->candelete, "User " . Bugzilla->user->{'login_name'} ." cannot delete Category");
		}
		else{
			delete $obj->{'case_count'};
			Bugzilla::Testopia::TestCase->create($case_hash);			
			ok($obj->candelete eq 0, "Category Can be Deleted");
			delete $obj->{'case_count'};
			$dbh->do("DELETE FROM test_cases WHERE category_id = ?", undef, $id);
			ok( $obj->candelete eq 0, 'Cannot Delete Category. Category still in a case');
		}
	}	
}


sub test_plan_case_ids{
	delete $obj->{'case_ids'} if exists $obj->{'case_ids'};
	my $plan_id = 1;
	my $db_ids = $dbh->selectcol_arrayref(
          "SELECT DISTINCT test_cases.case_id 
             FROM test_cases
       INNER JOIN test_case_plans ON test_case_plans.case_id = test_cases.case_id 
            WHERE category_id = ? AND test_case_plans.plan_id = ?", 
           undef, ($obj->{'category_id'}, $plan_id));

	cmp_deeply($obj->plan_case_ids($plan_id), $db_ids, "Plan Case Id's Match");
	cmp_deeply($obj->{'case_ids'}, $db_ids, "Plan Case Id's Match Property");	
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
