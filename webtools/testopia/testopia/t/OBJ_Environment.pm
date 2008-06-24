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

package OBJ_Environment;

use lib '../..';
use strict;

use base qw(Exporter Test::Unit::TestCase);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Testopia::Environment;
use Bugzilla::Testopia::Environment::Element;

use Test;
use Testopia::Test::Constants;

use Test::More tests => 100;
use Test::Exception;
use Test::Deep;
	
Bugzilla->error_mode(ERROR_MODE_DIE);

use constant DB_TABLE => 'test_environments';
use constant ID_FIELD => 'environment_id';

our $obj;

#Simply tests if the initialization of an object is
#just like what we have in the database 
sub test_init{
	$obj = Test::test_init(DB_TABLE, ID_FIELD, 'Bugzilla::Testopia::Environment');
}

sub test_set_isactive{
	$obj->set_isactive(0);
	ok($obj->{'isactive'} eq 0, 'Environment Is Not Active');
	$obj->set_isactive(1);
	ok($obj->{'isactive'} eq 1, 'Environment Is Active');
}

sub test_set_name{
	dies_ok(sub{$obj->set_name('')}, 'Must Declare Unempty String for New Name');
	dies_ok(sub{$obj->set_name},     'New Name Must Not Be undef');
	dies_ok(sub{$obj->set_name('PRIVATE INACTIVE ENVIRONMENT')},'New Name Must Unique Within Product');
	$obj->set_name('Unique Name');
	ok($obj->name eq 'Unique Name', 'New Name Set');
}

sub test_create{
	my $dbh = Bugzilla->dbh;
	my $created_obj;
	dies_ok(sub{Bugzilla::Testopia::Environment->create}, 'Missing Required Fields');
	dies_ok(sub{Bugzilla::Testopia::Environment->create({product_id => 999})}, 'Missing Required Field "name"');
	dies_ok(sub{Bugzilla::Testopia::Environment->create({name => 'NAME'})}, 'Missing Required "product_id"');
		
		# _check_product  validator
		# error if user can't edit
	my $creds =  Testopia::Test::Constants->LOGIN_CREDENTIALS;
	foreach (Testopia::Test::Constants->LOGIN_TYPES){
		my $login = $creds->{$_};
		Test::set_user($login->{'id'}, $login->{'login_name'}, $login->{'password'});
	
	# If the user does not have rights to create a Category, this should die
		unless(Bugzilla->user->in_group('Testers') ){
			dies_ok( sub {Bugzilla::Testopia::Environment->create({name => 'NAME', product_id => 999})}, "User " . Bugzilla->user->{'login_name'} ." does not have rights to create a Category");	
		}
		else{
			$created_obj = Bugzilla::Testopia::Environment->create({name => 'NAME', product_id => 999});
			my $obj_hash = ({product_id => '999', name => 'NAME', isactive =>1, environment_id => $created_obj->id});
			cmp_deeply($obj_hash, noclass($created_obj), "Created Object Match");
			# We must delete this here because we add it more than once and the 
			#  DB does not like that
			$dbh->do("DELETE FROM test_environments WHERE product_id = '999'");
		}
	}	
}

sub test_get_environment_elements{
	my @obj_hash = [ bless( {
                   'element_id' => '1',
                   'isprivate' => '0',
                   'name' => 'All',
                   'env_category_id' => '1',
                   'properties' => [],
                   'parent_id' => '0'
                 }, 'Bugzilla::Testopia::Environment::Element' )];    
    cmp_deeply($obj->get_environment_elements, @obj_hash, "Get Environment Elements");
}

sub test_element_count{
	ok($obj->element_count eq 1, 'Element Count');
}

sub test_elements_to_json{
	my $element = $obj->{'elements'}[0];
	my $leaf; 
		if($element->check_for_children || $element->check_for_properties){
			$leaf = 'true';
		}
		else{
			$leaf = 'false';
		}
	my $json ='[{"cls":"element",'
             .'"text":"' . $element->{'name'} . '",'
             .'"id":' . $element->{'element_id'} . ','
             .'"type":"element",'
             .'"leaf":' . $leaf . '}]';
	cmp_deeply($obj->elements_to_json, $json, 'JSON Match');
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
