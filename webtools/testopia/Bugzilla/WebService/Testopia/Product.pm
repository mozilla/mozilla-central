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
# Contributor(s): Dallas Harken <dharken@novell.com>
#                 Greg Hendricks <ghendricks@novell.com>

package Bugzilla::WebService::Testopia::Product;

use strict;

use base qw(Bugzilla::WebService);

use Bugzilla::Constants;
use Bugzilla::Testopia::Product;

sub _validate {
    my ($product) = @_;
    Bugzilla->login(LOGIN_REQUIRED);
    
    if (ref $product){
        $product = $product;
    }
    elsif ($product =~ /^\d+$/){
        $product = Bugzilla::Testopia::Product->new($product);
    }
    else {
        $product = Bugzilla::Product::check_product($product);
        $product = Bugzilla::Testopia::Product->new($product->id);
    }
    
    ThrowUserError('invalid-test-id-non-existent', {type => 'Product', id => $id}) unless $product;
    ThrowUserError('testopia-permission-denied', {'object' => $product}) if $product && !$product->canedit;

    return $product;
}

sub get {
    my $self = shift;
    my ($id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a product object hash
    my $product = new Bugzilla::Testopia::Product($id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Product', id => $id}) unless $product;
    ThrowUserError('testopia-permission-denied', {'object' => $product}) unless $product->canedit;

    return $product;
}

sub check_product {
    my $self = shift;
    my ($name) = @_;
 
    my $product = _validate($name);
    
    return $product;
}

sub get_builds {
    my $self = shift;
    my ($product, $active) = @_;
    
    $product = _validate($product);
    
    return $product->builds($active);
    
}

sub get_cases {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->cases;
}

sub get_categories {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->categories;
}

sub get_components {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->components;
}

sub get_environments {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->environments;
}

sub get_milestones {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->milestones;
}

sub get_plans {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->plans;
}

sub get_runs {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->runs;
}

sub get_tags {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->tags;
}

sub get_versions {
    my $self = shift;
    my ($product) = @_;
    
    $product = _validate($product);
    
    return $product->versions;

}

sub lookup_name_by_id {
    return {FAILED => 1, message=> 'This method id depricated. Use Product::get instead.'};
}
sub lookup_id_by_name {
    return {FAILED => 1, message=> 'This method id depricated. Use Product::check_product instead.'};
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Webservice::Product

=head1 EXTENDS

Bugzilla::Webservice

=head1 DESCRIPTION

Provides methods for automated scripts to expose Testopia Product data.

=head1 METHODS

=over

=item C<get($id)>

 Description: Used to load an existing product from the database.
 
 Params:      $id - An integer representing the ID in the database
                       
 Returns:     A blessed Bugzilla::Testopia::Product object hash
 
=item C<check_product($name, $product)>
 
 Description: Looks up and returns a validated product.
              
 Params:      $name - String: name of the product.
              $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
 
 Returns:     Hash: Matching Product object hash or error if not found.
 
=item C<get_builds($product, $active)>
 
 Description: Get the list of builds associated with this product.
              
 Params:      $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
              $active  - Boolean: True to only include builds where isactive is true. 
              
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