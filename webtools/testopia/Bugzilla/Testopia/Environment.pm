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
#                    Andrew Nelson <anelson@novell.com>

=head1 NAME

Bugzilla::Testopia::Environment - A test environment

=head1 DESCRIPTION

Environments are a set of parameters dictating what conditions 
a test was conducted in. Each test run must have an environment. 
Environments can be very simple or very complex. 

Environments are comprised of Elemements, Properties, and Values.
Elements can be nested within other elements. Each element can have 
zero or more properties. Each property can only have one value selected
of the possible values.

=head1 SYNOPSIS

 $env = Bugzilla::Testopia::Environment->new($env_id);
 $env = Bugzilla::Testopia::Environment->new(\%env_hash);

=cut

package Bugzilla::Testopia::Environment;

use strict;

use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::User;
use Bugzilla::Config;

use JSON;

use base qw(Exporter Bugzilla::Object);
@Bugzilla::Bug::EXPORT = qw(check_environment);

###############################
####    Initialization     ####
###############################

=head1 FIELDS
    environment_id
    product_id
    name
    isactive

=cut
use constant DB_TABLE   => "test_environments";
use constant NAME_FIELD => "name";
use constant ID_FIELD   => "environment_id";
use constant DB_COLUMNS => qw(
    environment_id
    product_id
    name
    isactive
);

use constant REQUIRED_CREATE_FIELDS => qw(name product_id);
use constant UPDATE_COLUMNS         => qw(name isactive);

use constant VALIDATORS => {
    product_id => \&_check_product,
    isactive   => \&_check_isactive,
};

our constant $max_depth = 7;

###############################
####       Validators      ####
###############################
sub _check_product {
    my ($invocant, $product_id) = @_;

    $product_id = trim($product_id);
    
    require Bugzilla::Testopia::Product;
    
    my $product;
    if (trim($product_id) !~ /^\d+$/ ){
        $product = Bugzilla::Product::check_product($product_id);
        $product = Bugzilla::Testopia::Product->new($product_id);
    }
    else {
        $product = Bugzilla::Testopia::Product->new($product_id);
    }

    ThrowUserError("testopia-create-denied", {'object' => 'environment'}) unless $product->canedit;
    
    if (ref $invocant){
        $invocant->{'product'} = $product; 
        return $product->id;
    } 

    return $product;
}
sub _check_isactive {
    my ($invocant, $isactive) = @_;
    ThrowCodeError('bad_arg', {argument => 'isactive', function => 'set_isactive'}) unless ($isactive =~ /(1|0)/);
    return $isactive;
}
sub _check_name {
    my ($invocant, $name, $product_id) = @_;
    
    $name = clean_text($name) if $name;
    trick_taint($name);
    if (!defined $name || $name eq '') {
        ThrowUserError('testopia-missing-required-field', {'field' => 'name'});
    }

    # Check that we don't already have a environment with that name in this product.    
    my $orig_id = check_environment($name, $product_id);
    my $notunique;

    if (ref $invocant){
        # If updating, we have matched ourself at least
        $notunique = 1 if (($orig_id && $orig_id != $invocant->id))
    }
    else {
        # In new environment any match is one too many
        $notunique = 1 if $orig_id;
    }

    ThrowUserError('testopia-name-not-unique', 
                  {'object' => 'Environment', 
                   'name' => $name}) if $notunique;
               
    return $name;
}

###############################
####       Mutators        ####
###############################
sub set_isactive    { $_[0]->set('isactive', $_[1]); }
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
    
    $params->{name} = $class->_check_name($params->{name}, ref $product ? $product->id : $product);
    
    return $params;
}

sub create {
    my ($class, $params) = @_;

    $class->SUPER::check_required_create_fields($params);
    my $field_values = $class->run_create_validators($params);
    
    $field_values->{isactive}  = 1;
    $field_values->{product_id} = ref $field_values->{product_id} ? $field_values->{product_id}->id : $field_values->{product_id};
    my $self = $class->SUPER::insert_create_data($field_values);
    
    return $self;
}

###############################
####       Methods         ####
###############################

=head1 METHODS

=head2 get element list for environment

Returns an array of element objects for an environment

=cut

sub get_environment_elements{
    my $dbh = Bugzilla->dbh;
    my $self = shift;
    
    return $self->{'elements'} if exists $self->{'elements'};
    
    my $id = $self->{'environment_id'};
    
    my $ref = $dbh->selectcol_arrayref(qq{
            SELECT DISTINCT tee.element_id 
              FROM test_environment_map as tem
              JOIN test_environment_element as tee
              ON tem.element_id = tee.element_id
              WHERE tem.environment_id = ?},undef,$id);
    
    my @elements;

    foreach my $val  (@$ref){
        push @elements, Bugzilla::Testopia::Environment::Element->new($val);
    }   
    $self->{'elements'} = \@elements;
     
   return \@elements;             
}

sub element_count {
    my $self = shift;
    
    return scalar(@{$self->get_environment_elements});   
}

sub elements_to_json {
    my $self = shift;

    my $elements = $self->get_environment_elements;
            
    my @environments; 
        
    foreach my $element (@$elements)
    {
        my $leaf;
        if($element->check_for_children || $element->check_for_properties)
        {
            $leaf = 'false';
        }
            
        else
        {
            $leaf = 'true';
        }
        
        push @environments, {text=> $element->{'name'}, id=> $element->{'element_id'}, type=> 'element', leaf => $leaf, cls => 'element'};
    }
    
    my $json = new JSON; 
    return trim($json->objToJson(\@environments));
    
    
#    my $json = '[';
#    
#    foreach my $element (@$elements)
#    {
#        $json .= '{title:"'. $element->{'name'} .'",';
#        $json .=  'objectId:"'. $element->{'element_id'}. '",';
#        $json .=  'widgetId:"element'. $element->{'element_id'} .'",';
#        $json .=  'actionsDisabled:["addCategory","addValue","addChild"';
#        $json .=  ',"remove"' unless $self->canedit;
#        $json .=  '],';
#        $json .=  'isFolder:true,' if($element->check_for_children || $element->check_for_properties);
#        $json .=  'childIconSrc:"testopia/img/circle.gif"},'; 
#    }
#    chop $json;
#    $json .= ']';
#
#    return $json;   
}

sub categories_to_json {
    my $self = shift;

    my $elements = $self->get_environment_elements;
            
    my @environments; 
    my %categoryHash;
    
    foreach my $element (@$elements){
        if ($element->is_parent_a_category()){
            my $parent = $element->get_parent();
            my $hash_key = $parent->id;
             
            #the category already exists in the hash
            if(exists $categoryHash{$hash_key}){
                #do nothing right now
            }
             
            #otherwise make a new hash category
            else{
                my @elementsArray;
                push @elementsArray, {text=> $parent->{'name'}, id=> $parent->id . ' category', type=> 'category', leaf=> 'false', cls => 'category'};
                
                my $leaf;
                if($element->check_for_children || $element->check_for_properties){
                    $leaf = 'false';
                }
                else{
                    $leaf = 'true';
                }
                 
                push @elementsArray, {
                    text => $element->{'name'}, 
                    id   => $element->{'id'} . ' element', 
                    type => 'element', 
                    leaf => $leaf,
                    allowDrop => 'false',
                    cls  => 'element'
                }; 
                 
            $categoryHash{$hash_key} = \@elementsArray;                
            }                     
         }
         
         #push the element onto the hash without a category
         else{
             my @elementsArray;
             my $leaf;
             if ($element->check_for_children || $element->check_for_properties){
                $leaf = 'false';
             }
             else{
                $leaf = 'true';
             }
                 
             push @elementsArray, {
                 text => $element->{'name'}, 
                 id   => $element->{'element_id'} . ' element', 
                 type => 'element', 
                 allowDrop => 'false',
                 leaf => $leaf, 
                 cls  => 'element'
             };
                
             $categoryHash{$element->{'element_id'} . "e"} = \@elementsArray;        
         }
    }
    
    my $json = new JSON; 

    #use Data::Dumper;
    #print Dumper(\%categoryHash);


    my $firstloop = 1;
    print "[";
    
    for my $key (keys %categoryHash){    
        if($firstloop == 0){
            print ",";
        }

        my @elementsArray = @{$categoryHash{$key}};
        print $json->objToJson($elementsArray[0]);
             
        $firstloop = 0;
    }
    print "]";
    return;
}

=head2 get_value_selected

Returns a selected value for the specified environment element property instance. 

=cut

sub get_value_selected{
    my $dbh = Bugzilla->dbh;
    my $self = shift;
    
    my ($environment,$element,$property) = (@_);
    
    my ($var) = $dbh->selectrow_array(
            "SELECT value_selected 
              FROM test_environment_map
             WHERE environment_id = ?
               AND element_id = ?
               AND property_id = ?",
               undef,($environment,$element,$property));
    
    return $var;
}

=head2 get environment names

Returns the list of environment names and ids

=cut

sub get_environments{
    my $dbh = Bugzilla->dbh;
    my $self = shift;
   
    my $ref = $dbh->selectall_arrayref(
            "SELECT environment_id, name 
               FROM test_environments");
             
   return $ref;             
}

sub get_all_env_categories {
    my $self = shift;
    my ($byid) = @_;
    my $dbh = Bugzilla->dbh;
    my $idstr = $byid ? 'env_category_id' : 'DISTINCT name';
    my $ref = $dbh->selectall_arrayref(
            "SELECT $idstr AS id, name
               FROM test_environment_category",
               {'Slice' => {}});
    
    return $ref;
}

sub get_all_visible_elements {
    my $self = shift;
    my ($byid) = @_;
    my $dbh = Bugzilla->dbh;
    my $idstr = $byid ? 'element_id' : 'DISTINCT name';
    my $ref = $dbh->selectall_arrayref(
            "SELECT $idstr AS id, name
               FROM test_environment_element",
               {'Slice' => {}});
    
    return $ref;
}

sub get_all_element_properties {
    my $self = shift;
    my ($byid) = @_;
    my $dbh = Bugzilla->dbh;
    my $idstr = $byid ? 'property_id' : 'DISTINCT name';
    my $ref = $dbh->selectall_arrayref(
            "SELECT $idstr AS id, name, validexp
               FROM test_environment_property",
               {'Slice' => {}});
    
    return $ref;
}

sub get_distinct_property_values {
    my $self = shift;
    my @exps;
    foreach my $prop (@{$self->get_all_element_properties}){
        push @exps, split(/\|/, $prop->{'validexp'})
    }
    my %seen;
    foreach my $v (@exps){
        $seen{$v} = $v;
    }
    my @values;
    foreach my $v (keys %seen){
        my %p;
        $p{'id'} = $v;
        $p{'name'} = $v;
        push @values, \%p;
    }
    return \@values;
}

=head2 get all elements

Returns the list of element names, ids and category names

=cut

sub get_all_elements{
    
    my $dbh = Bugzilla->dbh;
    my $self = shift;
    
    my $ref = $dbh->selectcol_arrayref(
            "SELECT tee.element_id 
               FROM test_environment_map as tem
               JOIN test_environment_element as tee
                 ON tem.element_id = tee.element_id",
                 undef);
    
    my @elements;

    foreach my $val  (@$ref){
        push @elements, Bugzilla::Testopia::Environment::Element->new($val);
    }   
             
       return \@elements;             
}

sub get_elements_for_environment(){
    my $dbh = Bugzilla->dbh;
    my $self = shift;
    
    my $ref = $dbh->selectcol_arrayref(
            "SELECT tee.element_id 
               FROM test_environment_map as tem
               JOIN test_environment_element as tee
                 ON tem.element_id = tee.element_id
                 where environment_id = ?",
                 undef, ($self->id));
    
    my @elements;

    foreach my $val  (@$ref){
        push @elements, Bugzilla::Testopia::Environment::Element->new($val);
    }   
             
       return \@elements;    
}

=head2 check environment name

Returns environment id if environment exists

=cut

sub check_environment{
    my ($name, $product, $throw) = (@_);
    my $pid = ref $product ? $product->id : $product;
    my $dbh = Bugzilla->dbh;

    my ($used) = $dbh->selectrow_array(
        "SELECT environment_id 
           FROM test_environments
          WHERE name = ? AND product_id = ?",
          undef, ($name, $pid));
    if ($throw){
        ThrowUserError('invalid-test-id-non-existent', {type => 'Environment', id => $name}) unless $used;
        return Bugzilla::Testopia::Environment->new($used);
    }
    
    return $used;             
}


=head2 Check Environment Element Property Value Selected

Returns environment id if Environment Element Property Value Selected exists

=cut

sub check_value_selected {
    my $self = shift;
    my ($prop_id, $elem_id) = @_;
    my $dbh = Bugzilla->dbh;
          
    my ($used) = $dbh->selectrow_array(
        "SELECT environment_id
           FROM test_environment_map
          WHERE environment_id = ? 
            AND property_id = ? 
            AND element_id = ?", 
            undef, ($self->{'environment_id'}, $prop_id, $elem_id));
        
    return $used;
}

=head2 store

Serializes this environment to the database

=cut

sub store {
    my $self = shift;
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();
    # Exclude the auto-incremented field from the column list.
    my $columns = join(", ", grep {$_ ne 'environment_id'} DB_COLUMNS);

    #Verify Environment isn't already in use.
    return undef if check_environment($self->{'name'}, $self->product);
    
    my $dbh = Bugzilla->dbh;
    $dbh->do("INSERT INTO test_environments ($columns) VALUES (?,?,?)",
              undef, ($self->{'product_id'}, $self->{'name'}, $self->{'isactive'}));
    my $key = $dbh->bz_last_key( 'test_environments', 'environment_id' );
    
    my $elements = $self->{'elements'};
    
    foreach my $element (@$elements)
    {
        $self->persist_environment_element_and_children(1, $element, "store");            
    }    
    
    return $key;
}


=head2 store property values

Serializes the property values to the database

=cut

sub store_property_value {
    my $self = shift;
 
    my ($prop_id,$elem_id,$value_selected) = @_;
    
    return 0 if ($self->check_value_selected($prop_id, $elem_id, $value_selected));
        
    my $dbh = Bugzilla->dbh;
    $dbh->do("INSERT INTO test_environment_map (environment_id,property_id,element_id,value_selected)
             VALUES (?,?,?,?)",undef, ($self->{'environment_id'}, $prop_id, $elem_id,$value_selected));          
    return 1;
}

sub to_json {
    my $self = shift;
    my $obj;
    my $json = new JSON;
    
    $json->autoconv(0);
    
    foreach my $field ($self->DB_COLUMNS){
        $obj->{$field} = $self->{$field};
    }
    
    $obj->{'product_name'}   = $self->product->name if $self->product;
    $obj->{'case_run_count'}   = $self->case_run_count;
    $obj->{'run_count'}  = $self->get_run_count;
    
    return $json->objToJson($obj); 
}
=head2 update

Updates this environment object in the database.
Takes a reference to a hash whose keys match the fields of 
an environment.

=cut

sub update {
    my $self = shift;
    my $dbh = Bugzilla->dbh;

    $dbh->bz_lock_tables('test_environments WRITE');
    
    $self->SUPER::update();
    
    $dbh->bz_unlock_tables;

    my $elements = $self->{'elements'};
    
    foreach my $element (@$elements)
    {
        $self->persist_environment_element_and_children(1, $element, "update");
    }
    
    return 1;
}


=head2 persist_environment_element_and_children 

Persists Environment Element and Children Recursively.

=cut

sub persist_environment_element_and_children {
    my $self = shift;
    my ($depth, $element, $method) = @_;
    if ($depth > $max_depth) {
        return;
    }
    $depth++;
    my $elem_id = $element->{'element_id'};
    my $properties = $element->{'properties'};
    foreach my $property (@$properties)
    {
        my $prop_id = $property->{'property_id'};
        my $value_selected = $property->{'value_selected'};
        my ($value_stored) = $self->get_value_selected($self->{'environment_id'},$prop_id,$elem_id);
        if ($method eq "store" || $value_stored eq undef) {
            $self->store_property_value($prop_id,$elem_id,$value_selected);
        }
        else {
            $self->update_property_value($prop_id,$elem_id,$value_selected);
        }
    }
    my $children = $element->{'children'};
    foreach my $child_element (@$children) {
        $self->persist_environment_element_and_children($depth, $child_element, $method);
    }
}


=head2 update property value

Updates the property of the element in the database

=cut

sub update_property_value {
    
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();
    my $self = shift;
    my ($propID, $elemID, $valueSelected) = (@_);
    
    my $dbh = Bugzilla->dbh;
    $dbh->do("UPDATE test_environment_map 
              SET value_selected = ? WHERE environment_id = ? AND property_id = ? AND element_id = ?"
              ,undef, ($valueSelected,$self->{'environment_id'},$propID,$elemID));          
    return 1;
}

=head2 toggle_hidden

Toggles the archive bit on the build.

=cut

sub toggle_archive {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    $dbh->do("UPDATE test_environments SET isactive = ? 
               WHERE environment_id = ?", undef, $self->isactive ? 0 : 1, $self->id);
    
}

sub delete_element {
    my $self = shift;
    my ($element_id) = @_;
    my $dbh = Bugzilla->dbh;
    
    $dbh->do("DELETE FROM test_environment_map
              WHERE environment_id = ? AND element_id = ?",
              undef,($self->id, $element_id));
              
}

sub element_is_mapped{
    my $self = shift;
    my ($element_id) = @_;
    my $dbh = Bugzilla->dbh;
    
    $dbh->selectcol_arrayref("SELECT * FROM test_environment_map
              WHERE environment_id = ? AND element_id = ?",
              undef,($self->id, $element_id));
              
     if($dbh)
     {
         return 1;
     }
     
     return 0;
   
}

=head2 obliterate

Completely removes this environment from the database.

=cut

sub obliterate {
    my $self = shift;
    return 0 unless $self->candelete;
    my $dbh = Bugzilla->dbh;

    foreach my $obj (@{$self->runs}){
        $obj->obliterate;
    }
    foreach my $obj (@{$self->caseruns}){
        $obj->obliterate;
    }

    $dbh->do("DELETE FROM test_environment_map WHERE environment_id = ?", undef, $self->id);
    $dbh->do("DELETE FROM test_environments WHERE environment_id = ?", undef, $self->id);
    return 1;
}

sub clone {
    my $self = shift;
    my ($name, $product) = @_;
    my $dbh = Bugzilla->dbh;
    
    my $new = $self->create({
        name => $name,
        product_id => $product
    });  
    
    my $ref = $dbh->selectall_arrayref(
        "SELECT * FROM test_environment_map
          WHERE environment_id = ?",{'Slice' => {}}, $self->id);
    
    my $sth = $dbh->prepare_cached(
        "INSERT INTO test_environment_map 
         (environment_id, property_id, element_id, value_selected)
         VALUES (?,?,?,?)");
    
    foreach my $row (@$ref){
        $sth->execute($new->id, $row->{'property_id'}, $row->{'element_id'}, $row->{'value_selected'})
    }
    
    return $new->id;
}

=head2 get_run_list

Returns a list of run ids associated with this environment.

=cut

sub get_run_list {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectcol_arrayref("SELECT run_id FROM test_runs 
                                         WHERE environment_id = ?",
                                        undef, $self->{'environment_id'});
    return join(",", @{$ref});
}

=head2 get_run_count

Returns a count of the runs associated with this environment

=cut

sub get_run_count {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my ($count) = $dbh->selectrow_array("SELECT COUNT(run_id) FROM test_runs 
                                          WHERE environment_id = ?",
                                        undef, $self->{'environment_id'});
    return $count;
}

=head2 canedit

Returns true if the logged in user has rights to edit this environment.

=cut

sub canedit {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('Testers') && Bugzilla->user->can_see_product($self->product->name);
    return 0;
}

=head2 canview

Returns true if the logged in user has rights to view this environment.

=cut

sub canview {
    my $self = shift;
    return 1 if Bugzilla->user->can_see_product($self->product->name);
    return 0;
}

=head2 candelete

Returns true if the logged in user has rights to delete this environment.

=cut

sub candelete {
    my $self = shift;
    return 1 if Bugzilla->user->in_group("admin");
    return 0 unless Bugzilla->params->{"allow-test-deletion"};
    return 0 unless Bugzilla->user->can_see_product($self->product->name);
    return 1 if Bugzilla->user->in_group("Testers") && Bugzilla->params->{"testopia-allow-group-member-deletes"}; 
    return 0;
}

###############################
####      Accessors        ####
###############################
=head2 id

Returns the ID of this object

=head2 name

Returns the name of this object

=cut

sub id              { return $_[0]->{'environment_id'};  }
sub product_id      { return $_[0]->{'product_id'};  }
sub isactive        { return $_[0]->{'isactive'};  }
sub name            { return $_[0]->{'name'};            }

=head2 product

Returns the bugzilla product 

=cut

sub product {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'product'} if exists $self->{'product'};
    require Bugzilla::Testopia::Product;
    $self->{'product'} = Bugzilla::Product->new($self->{'product_id'});
    return $self->{'product'};
}

=head2 runs

Returns a reference to a list of test runs useing this environment

=cut

sub runs {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'runs'} if exists $self->{'runs'};
    
    require Bugzilla::Testopia::TestRun;
    
    my $runids = $dbh->selectcol_arrayref("SELECT run_id FROM test_runs
                                          WHERE environment_id = ?", 
                                          undef, $self->id);
    my @runs;
    foreach my $id (@{$runids}){
        push @runs, Bugzilla::Testopia::TestRun->new($id);
    }
    
    $self->{'runs'} = \@runs;
    return $self->{'runs'};
}

=head2 caseruns

Returns a reference to a list of test caseruns useing this environment

=cut

sub caseruns {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'caseruns'} if exists $self->{'caseruns'};
    
    require Bugzilla::Testopia::TestCaseRun;

    my $ids = $dbh->selectcol_arrayref("SELECT case_run_id FROM test_case_runs
                                          WHERE environment_id = ?", 
                                          undef, $self->id);
    my @caseruns;
    foreach my $id (@{$ids}){
        push @caseruns, Bugzilla::Testopia::TestCaseRun->new($id);
    }
    
    $self->{'caseruns'} = \@caseruns;
    return $self->{'caseruns'};
}

sub case_run_count {
    my ($self,$status_id) = @_;
    my $dbh = Bugzilla->dbh;
    
    my $query = "SELECT COUNT(case_run_id) FROM test_case_runs 
           WHERE environment_id = ?";
    $query .= " AND case_run_status_id = ?" if $status_id;
    
    my $count;
    if ($status_id){
        $count = $dbh->selectrow_array($query, undef, ($self->id,$status_id));
    }
    else {
        $count = $dbh->selectrow_array($query, undef, $self->id);
    }
          
    return $count;
}

sub type {
    my $self = shift;
    $self->{'type'} = 'environment';
    return $self->{'type'};
}

=head1 TODO


=head1 SEE ALSO

TestRun

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>

=cut

1;
