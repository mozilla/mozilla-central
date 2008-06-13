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
#                 Michael Hight <mjhight@gmail.com>
#                 Garrett Braden <gbraden@novell.com>
#                  Andrew Nelson  <anelson@novell.com>

=head1 NAME

Bugzilla::Testopia::Environment::Element - A test environment element

=head1 DESCRIPTION

Environment elements are a set of environment entities that dictate
the conditions a test was conducted in. Each environment must have an 
element. Elements can be very simple or very complex by adding properties.
Elements can have child elements. 

=head1 SYNOPSIS

 $elem = Bugzilla::Testopia::Environment::Element->new($elem_id);
 $elem = Bugzilla::Testopia::Environment::Element->new(\%elem_hash);

=cut

package Bugzilla::Testopia::Environment::Element;

use strict;

use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::User;
use Bugzilla::Testopia::Product;
use JSON;

###############################
####    Initialization     ####
###############################

=head1 FIELDS

    element_id
    env_category_id
    name
    parent_id
    isprivate

=cut

use constant DB_COLUMNS => qw(
  element_id
  env_category_id
  name
  parent_id
  isprivate
);

our constant $max_depth = 5;

###############################
####       Methods         ####
###############################

=head1 METHODS

=head2 new

Instantiates a new Element object

=cut

sub new {
    my $invocant = shift;
    my $class    = ref($invocant) || $invocant;
    my $self     = {};
    bless( $self, $class );
    return $self->_init(@_);
}

=head2 _init

Private constructor for the element class

=cut

sub _init {
    my $self    = shift;
    my ($param) = (@_);
    my $dbh     = Bugzilla->dbh;
    my $columns = join( ", ", DB_COLUMNS );

    my $id = $param unless ( ref $param eq 'HASH' );
    my $obj;

    if ( defined $id && detaint_natural($id) ) {

        $obj = $dbh->selectrow_hashref(
            "SELECT $columns
              FROM test_environment_element 
              WHERE element_id  = ?", undef, $id
        );
    }
    elsif ( ref $param eq 'HASH' ) {
        $obj = $param;
    }

    return undef unless ( defined $obj );

    foreach my $field ( keys %$obj ) {
        $self->{$field} = $obj->{$field};
    }

    $self->get_properties();

    return $self;
}

sub is_mapped {
    my $self = shift;
    my $dbh  = Bugzilla->dbh;

    my ($ref) = $dbh->selectrow_array(
            "SELECT element_id 
               FROM test_environment_map
              WHERE element_id = ?", undef, $self->id 
    );
    
    return $ref;
}

=head2 get_child_elements

Returns an array of the children objects for an element and recursively 
gets all of their children until exhausted. 

=cut

sub get_child_elements {
    my $dbh  = Bugzilla->dbh;
    my $self = shift;

    return $self->{'children'} if exists $self->{'children'};

    my %newvalues = (@_);
    my $depth     = $max_depth;

    if (%newvalues) {
        $depth = $newvalues{'depth'};
    }

    $depth--;

    if ( $depth == 0 ) { return; }

    my $id = $self->{'element_id'};

    my $ref = $dbh->selectcol_arrayref(
        qq{
            SELECT tee.element_id 
              FROM test_environment_element as tee
              WHERE tee.parent_id = ?}, undef, $id
    );

    my @children;

    foreach my $val (@$ref) {
        my $child = Bugzilla::Testopia::Environment::Element->new($val);
        $child->get_child_elements( 'depth' => $depth );
        push( @children, $child );
    }

    $self->{'children'} = \@children;

}

=head2 get_properties

Returns an array of the property objects for an element. 

=cut

sub get_properties {
    my $dbh  = Bugzilla->dbh;
    my $self = shift;

    my $ref = $dbh->selectcol_arrayref(
        qq{
            SELECT tep.property_id 
              FROM test_environment_property as tep
              WHERE tep.element_id = ?}, undef, ( $self->{'element_id'} )
    );

    my @properties;

    foreach my $val (@$ref) {
        my $property = Bugzilla::Testopia::Environment::Property->new($val);
        push( @properties, $property );
    }

    $self->{'properties'} = \@properties;
    return $self->{'properties'};

}

=head2 check_element

Returns element id if element exists

=cut

sub check_element {
    my $dbh  = Bugzilla->dbh;
    my $self = shift;
    my ( $name, $cat_id ) = @_;

# Since categories are uniquely identified by product_id we don't have to check by join on the product_id.
    my ($used) = $dbh->selectrow_array(
        "SELECT element_id
           FROM test_environment_element
          WHERE name = ? 
            AND env_category_id = ?",
        undef, ( $name, $cat_id )
    );

    return $used;
}

=head2 check_for_children

Returns 1 if element has children

=cut

sub check_for_children {
    my $dbh  = Bugzilla->dbh;
    my $self = shift;

    my ($has_element) = $dbh->selectrow_array(
        "SELECT 1 
           FROM test_environment_element 
          WHERE parent_id = ?",
        undef, $self->{'element_id'}
    );

    my ($has_property) = $dbh->selectrow_array(
        "SELECT 1 
           FROM test_environment_property 
          WHERE element_id = ?",
        undef, $self->{'element_id'}
    );

    return $has_element || $has_property;
}

sub children_to_json {
    my $self           = shift;
    my $json           = new JSON;

    my @values;
    foreach my $element ( @{ $self->get_child_elements } ) {
        push @values,
          {
            text => $element->{'name'},
            id   => $element->{'element_id'},
            leaf => $element->check_for_children ? JSON::false : JSON::true,
            type => 'element',
            cls  => 'element',
            draggable => JSON::true,
          };
    }

    foreach my $property (@{$self->get_properties}) {
        push @values,
          {
            text => $property->{'name'},
            id   => $property->id,
            leaf => $property->check_for_validexp ? JSON::false : JSON::true,
            type => 'property',
            cls  => 'property',
            draggable => JSON::false,
          };
    }

    return $json->encode( \@values );
}

=head2 new_element_count

Returns 1 if element has children

=cut

sub new_element_count {
    my $self = shift;
    my ($cat_id) = @_;
    $cat_id ||= $self->{'env_category_id'};
    my $dbh = Bugzilla->dbh;

    my ($used) = $dbh->selectrow_array(
        "SELECT COUNT(*) 
          FROM test_environment_element 
         WHERE name like 'New element%'
         AND env_category_id = ?",
        undef, $cat_id
    );

    return $used + 1;
}

sub this_to_json {
    my $self = shift;

    my $element = {
        text      => $self->{'name'},
        id        => $self->{'element_id'},
        type      => 'element',
        leaf      => JSON::true,
        cls       => 'element',
        allowDrop => JSON::false,
        disabled  => JSON::true
    };
    my $json = new JSON();
    print $json->encode($element);

}

=head2 check_for_properties

Returns 1 if element has properties

=cut

sub check_for_properties {
    my $dbh  = Bugzilla->dbh;
    my $self = shift;

    my ($used) = $dbh->selectrow_array(
        qq{
        SELECT 1 
          FROM test_environment_property 
         WHERE element_id = ? }, undef, $self->{'element_id'}
    );

    return $used;
}

=head2 store

Serializes the new element to the database and returns the primary key or 0

=cut

sub store {
    my $self = shift;

    # Exclude the auto-incremented field from the column list.
    my $columns = join( ", ", grep { $_ ne 'element_id' } DB_COLUMNS );
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();

    # Verify name is available
    return undef
      if $self->check_element( $self->{'name'}, $self->{'env_category_id'} );

    my $dbh = Bugzilla->dbh;
    $dbh->do(
        "INSERT INTO test_environment_element ($columns) VALUES (?,?,?,?)",
        undef,
        (
            $self->{'env_category_id'}, $self->{'name'},
            $self->{'parent_id'},       $self->{'isprivate'}
        )
    );
    my $key = $dbh->bz_last_key( 'test_environment_element', 'element_id' );
    return $key;
}

=head2 set_name

Updates the element in the database

=cut

sub set_name {
    my $self      = shift;
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();

    my ($name) = (@_);

    return 0 if check_element( $name, $self->{'env_category_id'} );

    my $dbh = Bugzilla->dbh;
    $dbh->do(
        "UPDATE test_environment_element 
              SET name = ? WHERE element_id = ?", undef,
        ( $name, $self->{'element_id'} )
    );
    return 1;
}

=head2 update_element_category

Updates the category of the element in the database 

=cut

sub update_element_category {
    my $self      = shift;
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();

    my ($catid) = (@_);

    my $dbh = Bugzilla->dbh;
    $dbh->do(
        "UPDATE test_environment_element 
              SET env_category_id = ? WHERE element_id = ?", undef,
        ( $catid, $self->{'element_id'} )
    );
    return 1;
}

=head2 update_element_parent

Updates the parent_id of the element in the database 

=cut

sub update_element_parent {
    my $self      = shift;
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();

    my ($parent_id) = (@_);

    my $dbh = Bugzilla->dbh;
    $dbh->do(
        "UPDATE test_environment_element 
              SET parent_id = ? WHERE element_id = ?", undef,
        ( $parent_id, $self->{'element_id'} )
    );
    return 1;
}

=head2 obliterate

Completely removes the element entry from the database.

=cut

sub obliterate {
    my $self = shift;
    my $dbh  = Bugzilla->dbh;

    foreach my $p ( @{ $self->get_properties } ) {
        $p->obliterate;
    }

    $dbh->do(
        "DELETE FROM test_environment_map
               WHERE element_id = ?", undef, $self->id
    );
    $dbh->do(
        "DELETE FROM test_environment_element 
              WHERE element_id = ?", undef, $self->{'element_id'}
    );

    return 1;
}

sub canview {
    my $self = shift;
    return 1 if $self->get_parent->canview;
    return 0;
}

sub canedit {
    my $self = shift;
    return 1 if $self->get_parent->canedit;
    return 0;
}

sub candelete {
    my $self = shift;
    return 0 unless $self->canedit;

}

###############################
####      Accessors        ####
###############################

=head2 id

Returns the ID of this object

=head2 name

Returns the name of this object

=head2 product_id

Returns the product_id of this object

=head2 env_category_id

Returns the category_id associated with this element

=head2 parent_id

Returns the element's parent_id associated with this element


=cut

sub id              { return $_[0]->{'element_id'}; }
sub name            { return $_[0]->{'name'}; }
sub product_id      { return $_[0]->{'product_id'}; }
sub env_category_id { return $_[0]->{'env_category_id'}; }
sub parent_id       { return $_[0]->{'parent_id'}; }
sub isprivate       { return $_[0]->{'isprivate'}; }

sub get_parent {
    my $self = shift;
    if ( $self->{'parent_id'} ) {
        return $self->new( $self->{'parent_id'} );
    }
    else {
        return Bugzilla::Testopia::Environment::Category->new(
            $self->{'env_category_id'} );
    }
}

sub is_parent_a_category {
    my $self = shift;
    if ( $self->{'parent_id'} ) {
        return 0;
    }
    return 1;
}

sub product {
    my $self = shift;
    return $self->{'product'} if exists $self->{'product'};
    $self->{'product'} = Bugzilla::Testopia::Product->new( $self->product_id );
    return $self->{'product'};
}

=head2 type

Returns 'element'

=cut

sub type {
    my $self = shift;
    $self->{'type'} = 'element';
    return $self->{'type'};
}
1;
