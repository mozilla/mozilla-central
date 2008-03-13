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

package Bugzilla::Testopia::Product;

use strict;

# Extends Bugzilla::Product;
use base "Bugzilla::Product";

use Bugzilla;

sub environments {
    my $self = shift;
    my($active, $current) = @_;
    my $dbh = Bugzilla->dbh;
    
    return $self->{'environments'} if defined $self->{'environments'};
    
    my $query = "SELECT environment_id"; 
       $query .= " FROM test_environments";
       $query .= " WHERE product_id = ?";
       $query .= " AND isactive = 1 OR environment_id = ?" if $active;          

    my $ref;
    if ($active && $current){
        $ref = $dbh->selectcol_arrayref($query, undef, ($self->{'id'}, $current));
    }
    else{
        $ref = $dbh->selectcol_arrayref($query, undef, $self->{'id'});
    }

    my @objs;
    require Bugzilla::Testopia::Environment;
    foreach my $id (@{$ref}){
        push @objs, Bugzilla::Testopia::Environment->new($id);
    }
    $self->{'environments'} = \@objs;
    return $self->{'environments'};
}

sub builds {
    my $self = shift;
    my($active, $current) = @_;
    my $dbh = Bugzilla->dbh;
    
    my $query = "SELECT build_id FROM test_builds WHERE product_id = ?";
    if ($active && $current){
        $query .= " AND isactive = 1 OR build_id = ?";
    }
    elsif  ($active){
        $query .= " AND isactive = 1";
    } 
    $query .= " ORDER BY name";
    
    my $ref;
    if ($active && $current){
        $ref = $dbh->selectcol_arrayref($query, undef, ($self->{'id'}, $current));
    }
    elsif ($active){
        $ref = $dbh->selectcol_arrayref($query, undef, $self->{'id'});
    }
    else{
        $ref = $dbh->selectcol_arrayref($query, undef, $self->{'id'});
    }

    my @objs;
    require Bugzilla::Testopia::Build;
    foreach my $id (@{$ref}){
        push @objs, Bugzilla::Testopia::Build->new($id);
    }
    $self->{'builds'} = \@objs;
    return $self->{'builds'};
}

sub categories {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    
    my $ref = $dbh->selectcol_arrayref(
                   "SELECT category_id 
                    FROM test_case_categories 
                    WHERE product_id = ?
                 ORDER BY name",
                    undef, $self->{'id'});
    my @objs;
    require Bugzilla::Testopia::Category;
    foreach my $id (@{$ref}){
        push @objs, Bugzilla::Testopia::Category->new($id);
    }
    $self->{'categories'} = \@objs;
    return $self->{'categories'};
}

sub plans {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    
    my $ref = $dbh->selectcol_arrayref(
                   "SELECT plan_id 
                    FROM test_plans 
                    WHERE product_id = ?
                 ORDER BY name",
                    undef, $self->{'id'});
    my @objs;
    require Bugzilla::Testopia::TestPlan;
    foreach my $id (@{$ref}){
        push @objs, Bugzilla::Testopia::TestPlan->new($id);
    }
    $self->{'plans'} = \@objs;
    return $self->{'plans'};
}

sub cases {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'cases'} if exists $self->{'cases'};
    my $caseids = $dbh->selectcol_arrayref(
        "SELECT case_id FROM test_case_plans
          INNER JOIN test_plans on test_case_plans.plan_id = test_plans.plan_id
          WHERE test_plans.product_id = ?", 
         undef, $self->id);
    my @cases;
    require Bugzilla::Testopia::TestCase;
    foreach my $id (@{$caseids}){
        push @cases, Bugzilla::Testopia::TestCase->new($id);
    }

    $self->{'cases'} = \@cases;
    return $self->{'cases'};
}

sub runs {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'runs'} if exists $self->{'runs'};

    my $runids = $dbh->selectcol_arrayref(
        "SELECT run_id FROM test_runs
          INNER JOIN test_plans ON test_runs.plan_id = test_plans.plan_id
          WHERE test_plans.product_id = ?", 
         undef, $self->id);
    my @runs;
    require Bugzilla::Testopia::TestRun;
    foreach my $id (@{$runids}){
        push @runs, Bugzilla::Testopia::TestRun->new($id);
    }
    
    $self->{'runs'} = \@runs;
    return $self->{'runs'};
}

sub environment_categories {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    
    my $ref = $dbh->selectcol_arrayref(
                   "SELECT env_category_id 
                    FROM test_environment_category 
                    WHERE product_id = ?",
                    undef, $self->id);
    my @objs;
    require Bugzilla::Testopia::Environment::Category;
    foreach my $id (@{$ref}){
        push @objs, Bugzilla::Testopia::Environment::Category->new($id);
    }
    $self->{'environment_categories'} = \@objs;
    return $self->{'environment_categories'};
}

sub check_product_by_name {
    my $self = shift;
    my ($name) = @_;
    my $dbh = Bugzilla->dbh;
    my ($used) = $dbh->selectrow_array(qq{
        SELECT id 
          FROM products
          WHERE name = ?},undef,$name);
    return $used;  
}

sub versions {
    my $self = shift;
    my $dbh = Bugzilla->dbh;

    my $values = $dbh->selectall_arrayref(
        "SELECT value AS id, value AS name
           FROM versions
          WHERE product_id = ?
          ORDER BY value", {'Slice' =>{}}, $self->id);

    $self->{'versions'} = $values;
    return $self->{'versions'};
}

sub milestones {
    my $self = shift;
    my $dbh = Bugzilla->dbh;

    my $values = $dbh->selectall_arrayref(
        "SELECT value AS id, value AS name
           FROM milestones
          WHERE product_id = ?
          ORDER BY value", {'Slice' =>{}}, $self->id);

    $self->{'milestones'} = $values;
    return $self->{'milestones'};
}

sub tags {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectcol_arrayref(
    "(SELECT test_tags.tag_id, test_tags.tag_name AS name 
         FROM test_tags
        INNER JOIN test_case_tags ON test_tags.tag_id = test_case_tags.tag_id
        INNER JOIN test_cases on test_cases.case_id = test_case_tags.case_id
        INNER JOIN test_case_plans on test_case_plans.case_id = test_cases.case_id
        INNER JOIN test_plans ON test_plans.plan_id = test_case_plans.plan_id
        WHERE test_plans.product_id = ?)  
     UNION 
      (SELECT test_tags.tag_id, test_tags.tag_name AS name
         FROM test_tags
        INNER JOIN test_plan_tags ON test_plan_tags.tag_id = test_tags.tag_id
        INNER JOIN test_plans ON test_plan_tags.plan_id = test_plans.plan_id
        WHERE test_plans.product_id = ?)
     UNION 
      (SELECT test_tags.tag_id, test_tags.tag_name AS name
         FROM test_tags
        INNER JOIN test_run_tags ON test_run_tags.tag_id = test_tags.tag_id
        INNER JOIN test_runs ON test_runs.run_id = test_run_tags.run_id
        INNER JOIN test_plans ON test_plans.plan_id = test_runs.plan_id
        WHERE test_plans.product_id = ?)
     ORDER BY name", undef, ($self->id,$self->id,$self->id));
    
    my @product_tags;
    require Bugzilla::Testopia::TestTag;
    foreach my $id (@$ref){
        push @product_tags, Bugzilla::Testopia::TestTag->new($id);
    }

    $self->{'tags'} = \@product_tags;
    return $self->{'tags'};
}

=head2 type

Returns 'product'

=cut

sub type {
    my $self = shift;
    $self->{'type'} = 'product';
    return $self->{'type'};
}

=head2 type

Returns true if logged in user has rights to edit Testopia objects
associated with this product.

=cut

sub canedit {
    my $self = shift;
    my ($user) = @_;
    $user ||= Bugzilla->user;
    return 1 if $user->in_group('Testers') && $user->can_see_product($self->name);
    return 0;
}

sub to_json {
    my $self = shift;
    my $obj;
    my $json = new JSON;
    
    $json->autoconv(0);
    
    foreach my $field ($self->DB_COLUMNS){
        $field =~ s/product\.//;
        $obj->{$field} = $self->{$field};
    }
    
    # Add the calculated fields
    $obj->{'type'}         = $self->type;
    $obj->{'id'}           = $self->id;
    $obj->{'canedit'}      = $self->canedit;
    
    return $json->objToJson($obj); 
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Product

=head1 EXTENDS

Bugzilla::Product

=head1 DESCRIPTION

Provides additional methods and functionality to Bugzilla products 
for Testopia specific usage. Methods are read only. For updating and
creating new products, see Bugzilla::Product.

=head1 SYNOPSIS

=head2 Creating
 
 $build = Bugzilla::Testopia::Product->new($product_id);
 $build = Bugzilla::Testopia::Product->new({name => $name});

=head1 METHODS

=over

=item C<builds($active, $current)>
 
 Description: Get the list of builds associated with this product.
              
 Params:      $active  - Boolean (optional): True to only include builds with isactive set.
                         Defaults to False.
              $current - Integer (optional): Must be used in conjuntion with $active.
                         If $active is true then $current should be the current build
                         selected to prevent it from being excluded if isactive is false.  
                     
 Returns:     Array: Returns an array of Build objects.
 
=item C<get_cases($product)>
 
 Description: Get the list of cases associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of TestCase objects.
 
=item C<get_categories($product)>
 
 Description: Get the list of categories associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Case Category objects.
 
=item C<get_components($product)>
 
 Description: Get the list of components associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Component objects.
 
=item C<get_environments($product)>
 
 Description: Get the list of environments associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Environment objects.
 
=item C<get_milestones($product)>
 
 Description: Get the list of milestones associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Milestone objects.
 
=item C<get_plans($product)>
 
 Description: Get the list of plans associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Test Plan objects.
 
=item C<get_runs($product)>
 
 Description: Get the list of runs associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Test Run objects.
 
=item C<get_tags($product)>
 
 Description: Get the list of tags associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Tags objects.
 
=item C<get_versions($product)>
 
 Description: Get the list of versions associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
                     
 Returns:     Array: Returns an array of Version objects.
 
=item C<lookup_name_by_id> B<DEPRICATED> Use Product::get instead
              
=item C<lookup_id_by_name> B<DEPRICATED - CONSIDERED HARMFUL> Use Product::check_product instead
 
=back

=head1 SEE ALSO

=over

L<Bugzilla::Testopia::Product>

L<Bugzilla::Webservice> 

=back

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>