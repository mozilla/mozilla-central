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

package Bugzilla::Testopia::Build;

use strict;

use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::Testopia::Product;
use JSON;

use base qw(Exporter Bugzilla::Object);
@Bugzilla::Testopia::Build::EXPORT = qw(check_build);

###############################
####    Initialization     ####
###############################
use constant DB_TABLE   => "test_builds";
use constant NAME_FIELD => "name";
use constant ID_FIELD   => "build_id";
use constant DB_COLUMNS => qw(
    build_id
    product_id
    name
    description
    milestone
    isactive
);

use constant REQUIRED_CREATE_FIELDS => qw(product_id name milestone isactive);
use constant UPDATE_COLUMNS         => qw(name description milestone isactive);

use constant VALIDATORS => {
    product_id  => \&_check_product,
    isactive    => \&_check_isactive,
};

###############################
####       Validators      ####
###############################
sub _check_product {
    my ($invocant, $product_id) = @_;
    $product_id = trim($product_id);
    
    ThrowUserError("testopia-create-denied", {'object' => 'build'}) unless Bugzilla->user->in_group('Testers');
    
    my $product;
    if (trim($product_id) !~ /^\d+$/ ){
        $product = Bugzilla::Product::check_product($product_id);
    }
    else {
        $product = Bugzilla::Testopia::Product->new($product_id);
    }
    
    if (ref $invocant){
        $invocant->{'product'} = $product; 
        return $product->id;
    } 
    return $product;
}

sub _check_name {
    my ($invocant, $name, $product_id) = @_;
    $name = clean_text($name) if $name;

    if (!defined $name || $name eq '') {
        ThrowUserError('testopia-missing-required-field', {'field' => 'name'});
    }
    
    trick_taint($name);
    
    # Check that we don't already have a build with that name in this product.    
    my $orig_id = check_build($name, $product_id);
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
                  {'object' => 'Build', 
                   'name' => $name}) if $notunique;
               
    return $name;
}

sub _check_milestone {
    my ($invocant, $milestone, $product) = @_;
    if (ref $invocant){
        $product = $invocant->product;
    }
    $milestone = trim($milestone);
    $milestone = Bugzilla::Milestone::check_milestone($product, $milestone);
    return $milestone->name;
}

sub _check_isactive {
    my ($invocant, $isactive) = @_;
    ThrowCodeError('bad_arg', {argument => 'isactive', function => 'set_isactive'}) unless ($isactive =~ /(1|0)/);
    return $isactive;
}

###############################
####       Mutators        ####
###############################
sub set_description { $_[0]->set('description', $_[1]); }
sub set_isactive    { $_[0]->set('isactive', $_[1]); }
sub set_milestone { 
    my ($self, $value) = @_;
    $value = $self->_check_milestone($value);
    $self->set('milestone', $value); 
}
sub set_name { 
    my ($self, $value) = @_;
    
    $value = $self->_check_name($value, $self->product);
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
    my $product = $params->{product_id}; # Returns actual product object
    
    $params->{milestone} = $class->_check_milestone($params->{milestone}, $product);
    $params->{name}      = $class->_check_name($params->{name}, $product);
    
    return $params;
}

sub create {
    my ($class, $params) = @_;

    $class->SUPER::check_required_create_fields($params);
    my $field_values = $class->run_create_validators($params);
    
    $field_values->{isactive}  = 1;
    $field_values->{product_id} = $field_values->{product_id}->id;
    my $self = $class->SUPER::insert_create_data($field_values);
    
    return $self;
}
###############################
####      Functions        ####
###############################
sub check_build {
    my ($name, $product, $throw) = @_;
    my $dbh = Bugzilla->dbh;
    my $is = $dbh->selectrow_array(
        "SELECT build_id FROM test_builds 
         WHERE name = ? AND product_id = ?",
         undef, $name, $product->id);
    if ($throw){
        ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $name}) unless $is;
        return Bugzilla::Testopia::Build->new($is);
    }
    return $is;
}

###############################
####       Methods         ####
###############################
sub store {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    # Exclude the auto-incremented field from the column list.
    my $columns = join(", ", grep {$_ ne 'build_id'} DB_COLUMNS);

    $dbh->do("INSERT INTO test_builds ($columns) VALUES (?,?,?,?,?)",
              undef, ($self->{'product_id'}, $self->{'name'},
              $self->{'description'}, $self->{'milestone'}, $self->{'isactive'}));
    my $key = $dbh->bz_last_key( 'test_builds', 'build_id' );
    return $key;
}

sub to_json {
    my $self = shift;
    my $obj;
    my $json = new JSON;
    
    $json->autoconv(0);
    
    foreach my $field ($self->DB_COLUMNS){
        $obj->{$field} = $self->{$field};
    }
        
    return $json->objToJson($obj); 
}

###############################
####      Accessors        ####
###############################
sub id              { return $_[0]->{'build_id'};   }
sub product_id      { return $_[0]->{'product_id'}; }
sub name            { return $_[0]->{'name'};       }
sub description     { return $_[0]->{'description'};}
sub milestone       { return $_[0]->{'milestone'};}
sub isactive        { return $_[0]->{'isactive'};}

sub product {
    my ($self) = @_;
    
    return $self->{'product'} if exists $self->{'product'};

    $self->{'product'} = Bugzilla::Testopia::Product->new($self->product_id);
    return $self->{'product'};
}

sub run_count {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'run_count'} if exists $self->{'run_count'};

    $self->{'run_count'} = $dbh->selectrow_array(
          "SELECT COUNT(run_id) FROM test_runs 
           WHERE build_id = ?", undef, $self->{'build_id'});
          
    return $self->{'run_count'};
}

sub case_run_count {
    my $self = shift;
    my ($status_id, $builds) = @_;
    my $dbh = Bugzilla->dbh;
    
    my @build_ids;
    if ($builds){
        push @build_ids, $_->id foreach (@$builds);
    }
    push @build_ids, $self->id if $self->id;
    
    my $ids = join (',', @build_ids);
    
    my $query = "SELECT COUNT(case_run_id) FROM test_case_runs 
           WHERE build_id IN (". $ids . ")";
    $query .= " AND case_run_status_id = ?" if $status_id;
    
    my $count;
    if ($status_id){
        $count = $dbh->selectrow_array($query, undef, ($status_id));
    }
    else {
        $count = $dbh->selectrow_array($query);
    }
          
    return $count;
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Build

=head1 EXTENDS

Bugzilla::Object

=head1 DESCRIPTION

Builds are used to classify test runs. They correspond to the results of 
a period of work in software development. Builds are product level attributes
and are associated with a milestone if targetmilestones are used in Bugzilla.

=head1 SYNOPSIS

=head2 Creating
 
 $build = Bugzilla::Testopia::Build->new($build_id);
 $build = Bugzilla::Testopia::Build->new({name => $name});
  
 $new_build = Bugzilla::Testopia::Build->create({name => $name, 
                                                 description => $desc
                                                 ... });

=head2 Updating
 
 $build->set_name($name);
 $build->set_description($name);
 $build->set_milestone($milestone);
 $build->set_isactive($isactive);
 
 $build->update();
 
=head2 Accessors

 my $id            = $build->id;
 my $name          = $build->name;
 my $desc          = $build->description;
 my $pid           = $build->product_id;
 my $milestone     = $build->milestone;
 my $crc           = $build->case_run_count;
 my $active        = $build->isactive;

=head1 FIELDS

    +-------------+------------------+------+-----+---------+----------------+
    | Field       | Type             | Null | Key | Default | Extra          |
    +-------------+------------------+------+-----+---------+----------------+
    | build_id    | int(10) unsigned | NO   | PRI | NULL    | auto_increment |
    | product_id  | smallint(6)      | NO   | MUL | 0       |                |
    | milestone   | varchar(20)      | YES  | MUL | NULL    |                |
    | name        | varchar(255)     | YES  | MUL | NULL    |                |
    | description | text             | YES  |     | NULL    |                |
    | isactive    | tinyint(4)       | NO   |     | 1       |                |
    +-------------+------------------+------+-----+---------+----------------+

=over

=item C<build_id> 

The unique id of this build in the database. 

=item C<name> B<REQUIRED>

A unique name for this build.

=item C<product_id> B<REQUIRED> B<CREATE ONLY>

The id of the Bugzilla product this build is attached to.

=item C<milestone> I<OPTIONAL>

The value from the Bugzilla product milestone table this build is associated with.

=item C<description> I<OPTIONAL>

A description of this build.

=item C<isactive> I<OPTIONAL>

Boolean - Determines whether to show this build in lists for selection. 
          Defaults to true.  

=back

=head1 FUNCTIONS

=over

=item C<check_build($name, $product_id)>

 Description: Checks if a build of a given name exists for a given product.
 
 Params:      name - string representing the name to check for.
              product_id - the product to lookup the build in.
                       
 Returns:     The id of the build if one matches.
              undef if it does not match any build.
 
=back

=head1 METHODS

=over

=item C<new($param)>

 Description: Used to load an existing build from the database.
 
 Params:      $param - An integer representing the ID in the database
                       or a hash with the "name" key representing the named
                       build in the database.
                       
 Returns:     A blessed Bugzilla::Testopia::Build object
 
=item C<create()>
 
 Description: Creates a new build object and stores it in the database
              
 Params:      A hash with keys and values matching the fields of the build to 
              be created.
 
 Returns:     The newly created object.
 
=item C<set_description()>
 
 Description: Replaces the current build's description. Must call update to 
              store the change in the database.
              
 Params:      text - the new description.
 
 Returns:     nothing.
 
=item C<set_isactive()>
 
 Description: Sets the isactive field. 
              
 Params:      boolean - 1 for active 0 for inactive.
 
 Returns:     nothing.
 
=item C<set_milestone()>
 
 Description: Assigns this build to a different milestone
              
 Params:      string - the new milestone value
 
 Returns:     nothing.
 
=item C<set_name()>
 
 Description: Renames the current build. If the new name is already in use
              by another build in this product, an error will be thrown.
              The update method must be called to make the change in the database.
              
 Params:      string - the new name
 
 Returns:     nothing.
 
=item C<to_json()>

 Description: Outputs a JSON representation of the object.
 
 Params:      none
          
 Returns:     A JSON string.
 
=back

=head1 ACCESSORS

=over

=item C<case_run_count()>
  
 Params:      case_run_status_id - optional; 
 
 Returns:     The number of case-runs in this build. Optionally for a given status.
 
=item C<description()>
  
 Returns the description of this build.
 
=item C<id()>
  
 Returns the id of the build
 
=item C<isactive()>
  
 Returns 1 if this build is visible in pick lists for runs and caserund and 0 if not.
 
=item C<milestone()>
  
 Returns the milestone value that this build is associated with.
 
=item C<name()>
  
 Returns the name of this build
 
=item C<product()>
  
 Returns a Bugzilla::Testopia::Product object of the product this build is of.
 
=item C<product_id()>
  
 Returns the product id of the build.
 
=item C<run_count()>
  
 Returns an integer representing the number of runs this build is associated to.
 
=back

=head1 SEE ALSO

=over

L<Bugzilla::Testopia::Product>

L<Bugzilla::Testopia::TestRun> 

L<Bugzilla::Object> 

=back

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>