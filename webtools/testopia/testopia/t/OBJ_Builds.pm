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

package OBJ_Builds;

use lib '.';
use lib '../..';
use strict;

use base qw(Test::Unit::TestCase);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Testopia::Build;
 
use Test;
use Testopia::Test::Constants;
use Testopia::Test::Util;

use Test::More;
use Test::Exception;
use Test::Deep;
	
Bugzilla->error_mode(ERROR_MODE_DIE);

use constant DB_TABLE => 'test_builds';
use constant ID_FIELD => 'build_id';

our $obj = Test::test_init(DB_TABLE, ID_FIELD, 'Bugzilla::Testopia::Build');
our $dbh = Bugzilla->dbh;

sub test_check_product{
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
	
	# If the user does not have rights to check a product, this should die
		unless(Bugzilla->user->in_group('Testers') ){
			dies_ok( sub {$obj->_check_product($obj->product_id)}, "User " . Bugzilla->user->{'login_name'} ." does not have sufficient rights to check Product");	
		}
		else{
			my $db_obj = Testopia::Test::Util::get_rep_by_field('products', 'id', $obj->product_id);
			# Check product by ID
			my $id = $obj->_check_product($obj->product_id);
			# Check product by Name
			my $name = $obj->_check_product($obj->product->name);
			cmp_ok( $db_obj->{'id'}, '==', $id, "Product Found By ID");
			cmp_ok( $db_obj->{'id'}, '==', $name, "Product Found By Name");
		}
	}
}


sub test_set_description(){
	my $db_obj = Testopia::Test::Util::get_rep_by_field(DB_TABLE, ID_FIELD, $obj->id);
	$obj->set_description('Some Description');
	#Defauls set to '' 
	cmp_ok( $db_obj->{'description'}, '!~', $obj->description, 'Build Description Has Been Changed');
}

sub test_set_isactive(){
	my $db_obj = Testopia::Test::Util::get_rep_by_field(DB_TABLE, ID_FIELD, $obj->id);
	# Default set to 1 
	$obj->set_isactive(0);
	cmp_ok($db_obj->{'isactive'}, '!=', $obj->isactive, "Build IsActive has Changed");
}

sub test_set_milestone{
	dies_ok(sub{$obj->set_milestone(undef)}, 'No Milestone Set');
	dies_ok(sub{$obj->set_milestone('Some Milestone Name')}, 'Milestone Name Does Not Exist');	
}

sub test_set_name{
	dies_ok(sub{$obj->set_name()}, 'No Name Not Allwed For Build');
	dies_ok(sub{$obj->set_name('')}, 'Empty Name Not Allowed For Build');
	my $nonunique_name = $dbh->selectrow_array("SELECT name from test_builds WHERE build_id <> ? AND product_id = ?", undef, $obj->id, $obj->{'product_id'});
	dies_ok(sub{$obj->set_name($nonunique_name)}, 'Name For Build Already Exists');
	$obj->set_name('Some Unique Name');
	like($obj->name, '/Some Unique Name/', 'Build Name Changed' );
}

sub test_create{
	my $obj_hash = {'product_id' => 1, 
					'name' => 'Unique Name', 
					'milestone' => 'PUBLIC M1',
					'isactive' => '1'};
	_bad_creates($obj_hash);
	
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
	
		unless(Bugzilla->user->in_group('Testers') ){
			dies_ok( sub {Bugzilla::Testopia::Build->create}, "User " . Bugzilla->user->{'login_name'} ." does not have sufficient rights to create new builds");	
		}
		else{	

	my $created_obj = Bugzilla::Testopia::Build->create($obj_hash);
	# Must remove this entry now because we add it multiple times,
	#  and the DB does not like that
	$dbh->do("DELETE FROM test_builds WHERE build_id = ?", undef, $created_obj->id);
		}
	}	
}

sub _bad_creates{
	my $obj_hash = shift;
	
	delete $obj_hash->{'product_id'};
	dies_ok(sub{Bugzilla::Testopia::Build->create($obj_hash)}, 'Missing product_id');
	$obj_hash->{'product_id'} = 1;
	delete $obj_hash->{'name'};
	dies_ok(sub{Bugzilla::Testopia::Build->create($obj_hash)}, 'Missing name');
	$obj_hash->{'name'} = 'Unique Name';
	delete $obj_hash->{'mileston'};
	dies_ok(sub{Bugzilla::Testopia::Build->create($obj_hash)}, 'Missing milestone');
	$obj_hash->{'milestone'} = 'PUBLIC M1';
	delete $obj_hash->{'isactive'};
	dies_ok(sub{Bugzilla::Testopia::Build->create($obj_hash)}, 'Missing isactive');
	$obj_hash->{'isactive'} = 'INVALID';
	dies_ok(sub{Bugzilla::Testopia::Build->create($obj_hash)}, 'Invalid isactive Value');
	$obj_hash->{'isactive'} = 1;
	
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
