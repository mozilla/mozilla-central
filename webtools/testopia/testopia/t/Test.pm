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

package Test;

use lib '../..';
use strict;

use Test::More;
use Test::Deep;

use Bugzilla::Constants;
use Bugzilla::User;

use Testopia::Test::Util;

use base qw(Testopia::Test::Util Exporter);
@testopia::t::Test::EXPORT = qw(test_init set_user);

sub test_init{
	my ($table, $id, $type) = @_;
	my $db_obj = get_rep($table);
	my $obj = $type->new( $db_obj->{$id} );
	ok( defined $obj, "Testing $type Instantiation" );
    isa_ok( $obj, $type, "Object isa $type");
	cmp_deeply($db_obj, noclass($obj), "DB and Object Fields Match");
	bless ($obj, $type);
	return $obj;
}
sub test_init_from_value{
	my ($table, $id, $value, $type) = @_;
	my $db_obj = get_rep_by_field($table, $id, $value);
	my $obj = $type->new( $db_obj->{$id} );
	bless ($obj, $type);
	ok( defined $obj, "Testing $type Instantiation" );
    isa_ok( $obj, $type, "Object isa $type");
	cmp_deeply($db_obj, noclass($obj), "DB and Object Fields Match");
	return $obj;
}

sub set_user {
	my ($id, $name, $email) = @_;
	my $user = new Bugzilla::User($id, $name, $email, 1);
	Bugzilla->set_user($user);
}
	

sub new {
    my $invocant = shift;
    my $class    = ref($invocant) || $invocant;
    my $object   = $class->_init(@_);
    bless($object, $class) if $object;
    return $object;	my ($table, $id, $type) = @_;
	my $db_obj = get_rep($table);
	my $obj = $type->new( $db_obj->{$id} );
	ok( defined $obj, "Testing $type Instantiation" );
    isa_ok( $obj, $type, "Object isa $type");
	cmp_deeply($db_obj, noclass($obj), "DB and Object Fields Match");
	bless ($obj, $type);
	return $obj;

}

sub _init{
	my $class = shift;
	my $table = $class->DB_TABLE;
	my $dbh = Bugzilla->dbh;
	my $id_field = $class->ID_FIELD;
	my $id_val = shift;
	my $condition = $id_field . " = " . $id_val;
	
	return $dbh->selectrow_hashref(
            "SELECT * FROM $table WHERE $condition ", undef);
    
}
1;
