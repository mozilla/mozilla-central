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
# Portions created by Maciej Maczynski are Copyright (C) 2006
# Novell. All Rights Reserved.
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

package Bugzilla::Testopia::Category;

use strict;

use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::Product;

use base qw(Exporter Bugzilla::Object);
@Bugzilla::Bug::EXPORT = qw(check_case_category);

###############################
####    Initialization     ####
###############################
use constant DB_TABLE   => "test_case_categories";
use constant NAME_FIELD => "name";
use constant ID_FIELD   => "category_id";
use constant DB_COLUMNS => qw(
    category_id
    product_id
    name
    description
);

use constant REQUIRED_CREATE_FIELDS => qw(product_id name);
use constant UPDATE_COLUMNS         => qw(name description);

use constant VALIDATORS => {
    product_id  => \&_check_product,
};

###############################
####       Validators      ####
###############################
sub _check_product {
    my ($invocant, $product_id) = @_;
    $product_id = trim($product_id);
    
    ThrowUserError("testopia-create-denied", {'object' => 'build'}) unless Bugzilla->user->in_group('Testers');
    
    my $product = Bugzilla::Testopia::Product->new($product_id);
    
    if (ref $invocant){
        $invocant->{'product'} = $product; 
        return $product->id;
    } 
    return $product;
}

sub _check_name {
    my ($invocant, $name, $product_id) = @_;
    $name = clean_text($name) if $name;
    trick_taint($name);
    if (!defined $name || $name eq '') {
        ThrowUserError('testopia-missing-required-field', {'field' => 'name'});
    }

    # Check that we don't already have a build with that name in this product.    
    my $orig_id = check_case_category($name, $product_id);
    my $notunique;

    if (ref $invocant){
        # If updating, we have matched ourself at least
        $notunique = 1 if (($orig_id && $orig_id != $invocant->id))
    }
    else {
        # In new build any match is one too many
        $notunique = 1 if $orig_id;
    }

    ThrowUserError('testopia-name-not-unique', 
                  {'object' => 'Case Category', 
                   'name' => $name}) if $notunique;
               
    return $name;
}
##############################
####       Mutators        ####
###############################
sub set_description { $_[0]->set('description', $_[1]); }
sub set_name { 
    my ($self, $value) = @_;
    $value = $self->_check_name($value, $self->product_id);
    $self->set('name', $value); 
}

sub new {
    my $invocant = shift;
    my $class = ref($invocant) || $invocant;
    my $param = shift;
    
    # We want to be able to supply an empty object to the templates for numerous
    # lists etc. This is much cleaner than exporting a bunch of subroutines and
    # adding them to $vars one by one. Probably just Laziness shining through.
    if (ref $param eq 'HASH'){
        if (!keys %$param || $param->{PREVALIDATED}){
            bless($param, $class);
            return $param;
        }
    }
    
    unshift @_, $param;
    my $self = $class->SUPER::new(@_);
    
    return $self; 
}

sub run_create_validators {
    my $class  = shift;
    my $params = $class->SUPER::run_create_validators(@_);
    my $product = $params->{product_id};
    
    $params->{name} = $class->_check_name($params->{name}, $product);
    
    return $params;
}

sub create {
    my ($class, $params) = @_;

    $class->SUPER::check_required_create_fields($params);
    my $field_values = $class->run_create_validators($params);
    
    $field_values->{product_id} = $field_values->{product_id}->id;
    my $self = $class->SUPER::insert_create_data($field_values);
    
    return $self;
}

###############################
####      Functions        ####
###############################
sub check_case_category {
    my ($name, $product_id) = @_;
    my $dbh = Bugzilla->dbh;
    my $is = $dbh->selectrow_array(
        "SELECT category_id FROM test_case_categories 
         WHERE name = ? AND product_id = ?",
         undef, $name, $product_id);
 
    return $is;
}

###############################
####       Methods         ####
###############################
sub store {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    # Exclude the auto-incremented field from the column list.
    my $columns = join(", ", grep {$_ ne 'category_id'} DB_COLUMNS);

    $dbh->do("INSERT INTO test_case_categories ($columns) VALUES (?,?,?)",
              undef, ($self->{'product_id'}, $self->{'name'}, $self->{'description'}));
    my $key = $dbh->bz_last_key( 'test_case_categories', 'category_id' );
    return $key;
}

sub remove {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    $dbh->do("DELETE FROM test_case_categories
              WHERE category_id = ?", undef,
              $self->{'category_id'});
}

sub candelete {
  my $self = shift;
  return 0 unless Bugzilla->user->in_group('Testers');
  return 0 if ($self->case_count);
  return 1;   
}
    
###############################
####      Accessors        ####
###############################
sub id              { return $_[0]->{'category_id'};  }
sub product_id      { return $_[0]->{'product_id'};   }
sub name            { return $_[0]->{'name'};         }
sub description     { return $_[0]->{'description'};  }

sub case_count {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'case_count'} if exists $self->{'case_count'};

    my ($count) = $dbh->selectrow_array(
          "SELECT COUNT(case_id) 
             FROM test_cases 
            WHERE category_id = ?", 
           undef, $self->{'category_id'});
    $self->{'case_count'} = $count;
    return $self->{'case_count'};
}

sub plan_case_ids {
    my ($self, $plan_id) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'case_ids'} if exists $self->{'case_ids'};

    $self->{'case_ids'} = $dbh->selectcol_arrayref(
          "SELECT DISTINCT test_cases.case_id 
             FROM test_cases
       INNER JOIN test_case_plans ON test_case_plans.case_id = test_cases.case_id 
            WHERE category_id = ? AND test_case_plans.plan_id = ?", 
           undef, ($self->{'category_id'}, $plan_id));
          
    return $self->{'case_ids'};
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Category - An object representing a test case category

=head1 EXTENDS

Bugzilla::Object

=head1 DESCRIPTION

Categories are used to classify test cases. Each test case must
belong to one category. Categories are product level attributes.
Every plan in a product will have access to that product's categories.

=head1 SYNOPSIS

=head2 Creating
 
 $category = Bugzilla::Testopia::Category->new($category_id);
 $category = Bugzilla::Testopia::Category->new({name => $name});
  
 $new_category = Bugzilla::Testopia::Category->create({name => $name, 
                                                       description => $desc});

=head2 Updating
 
 $category->set_name($name);
 $category->set_description($name);
 
 $category->update();
 
=head2 Accessors

 my $id            = $category->id;
 my $name          = $category->name;
 my $desc          = $category->description;
 my $c_cont        = $category->case_count;
 my $pid           = $category->product_id;
 my $case_ids      = $category->plan_case_ids;

=head1 FIELDS

=over

=item C<category_id> 

The unique id in the database. 

=item C<product_id>

The product id of the Bugzilla product this category belongs to.

=item C<name>

A unique name for this category

=item C<description>

A detailed description for this category.

=back

=head1 FUNCTIONS

=over

=item C<check_case_category($param)>

 Description: Checks if a category of a given name exists for a given product.
 
 Params:      name - string representing the name to check for.
              product_id - the product to lookup the category in.
                       
 Returns:     The id of the category if one matches.
              undef if it does not match any category.
 
=back

=head1 METHODS

=over

=item C<new($param)>

 Description: Used to load an existing Category from the database.
 
 Params:      $param - An integer representing the Category ID in the database
                       or a hash with the "name" key representing the named
                       category in the database.
                       
 Returns:     A blessed Bugzilla::Testopia::Category object
 
=back

=over

=item C<candelete()>
 
 Description: Tests to see if the current category can be safely deleted from 
              the database. To be a candidate for removal, there can be no 
              assigned test cases with this category. Also, the user must be in 
              the Testers group.
              
 Params:      none.
 
 Returns:     1 if this category can be safely removed.
              0 if this category cannot be removed safely or if the logged in user
                does not have sufficient rights to perform the operation.

=back

=over

=item C<create()>
 
 Description: Creates a new category object and stores it in the database
              
 Params:      A hash with keys and values matching the fields of the category to 
              be created.
 
 Returns:     The newly created object
 
=back

=over

=item C<plan_case_ids()>
 
 Description: Looks up the case ids assigned to this category in a given plan.
              
 Params:      The plan id to look up.
 
 Returns:     Integer representing the count of cases found with this category.
 
=back

=over

=item C<remove()>
 
 Description: Completely removes this category from the database. This should not 
              be called unless candelete has returned true. 
              
 Params:      none.
 
 Returns:     nothing.
 
=back

=over

=item C<set_description()>
 
 Description: Replaces the current category's description. Must call update to 
              store the change in the database.
              
 Params:      text - the new description.
 
 Returns:     nothing.
 
=back

=over

=item C<set_name()>
 
 Description: Renames the current category. If the new name is already in use
              by another category in this product, an error will be thrown.
              The update method must be called to make the change in the database.
              
 Params:      string - the new name
 
 Returns:     nothing.
 
=back

=over

=back

=head1 ACCESSORS

=over

=item C<case_count()>
  
 Returns an integer representing the number of cases found in this category.  
 
=back

=over

=item C<description()>
  
 Returns the description of the category.
 
=back

=over

=item C<id()>
  
 Returns the category id 
 
=back

=over

=item C<name()>
  
 Returns the name of the category.
 
=back

=over

=item C<product_id()>
  
 Returns the id of the product this category belongs to
 
=back

=head1 SEE ALSO

L<Bugzilla::Testopia::TestCase> 

L<Bugzilla::Testopia::Product>

L<Bugzilla::Object> 

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>
