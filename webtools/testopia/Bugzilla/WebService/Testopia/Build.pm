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

package Bugzilla::WebService::Testopia::Build;

use strict;

use base qw(Bugzilla::WebService);

use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Testopia::Build;
use Bugzilla::Testopia::Product;

sub get {
    my $self = shift;
    my ($build_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a build object hash
    my $build = new Bugzilla::Testopia::Build($build_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $build_id}) unless $build;
    ThrowUserError('testopia-read-only', {'object' => $build->product}) unless $build->product->canedit;
        
    $build->run_count();

    return $build;
}

sub check_build {
    my $self = shift;
    my ($name, $product) = @_;
    
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
    
    ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canedit;
    
    return Bugzilla::Testopia::Build::check_build($name, $product, "THROWERROR");
}

sub create{
    my $self = shift;
    my ($new_values) = @_;  # Required: name, product_id

    Bugzilla->login(LOGIN_REQUIRED);
    
    $new_values->{'product_id'} ||= $new_values->{'product'};
    delete $new_values->{'product'};
    
    my $product = Bugzilla::Testopia::Product->new($new_values->{'product_id'});
    ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canedit;
  
    $new_values->{'milestone'} ||= $product->default_milestone;
    if (! defined $new_values->{'isactive'}){
         $new_values->{'isactive'} = 1;
    }
    
    my $build = Bugzilla::Testopia::Build->create($new_values);
    
    # Result is new build
    return $build;
}

sub update{
    my $self = shift;
    my ($id, $new_values) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    my $build = new Bugzilla::Testopia::Build($id);
    ThrowUserError("invalid-test-id-non-existent", {'id' => $id, 'type' => 'Build'}) unless $build;
    ThrowUserError('testopia-read-only', {'object' => $build->product}) unless $build->product->canedit;

    $build->set_name($new_values->{'name'}) if $new_values->{'name'};
    $build->set_description($new_values->{'description'}) if defined $new_values->{'description'};
    $build->set_milestone($new_values->{'milestone'}) if $new_values->{'milestone'};
    $build->set_isactive($new_values->{'isactive'} =~ /(true|1|yes)/i ? 1 : 0) if defined $new_values->{'isactive'};
    
    $build->update;

    return $build;
}

# DEPRECATED use Build::get instead
sub lookup_name_by_id {
  my $self = shift;
  my ($build_id) = @_;
  
  Bugzilla->login(LOGIN_REQUIRED);
  
  die "Invalid Build ID" 
      unless defined $build_id && length($build_id) > 0 && $build_id > 0;
      
  my $build = new Bugzilla::Testopia::Build($build_id);
  ThrowUserError('testopia-read-only', {'object' => $build->product}) unless $build->product->canedit;
  
  my $result = defined $build ? $build->name : '';
  
  # Result is build name string or empty string if ERROR
  return $result;
}

# DEPRECATED use Build::check_build($name, $product) instead
sub lookup_id_by_name {
  return { ERROR => 'This method is considered harmful and has been deprecated. Please use Build::check_build instead'};
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Webservice::Build

=head1 EXTENDS

Bugzilla::Webservice

=head1 DESCRIPTION

Provides methods for automated scripts to manipulate Testopia Builds

=head1 METHODS

=over

=item C<check_build($name, $product)>

 Description: Looks up and returns a build by name.

 Params:      $name - String: name of the build.
              $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object

 Returns:     Hash: Matching Build object hash or error if not found.

=item C<create($values)>

 Description: Creates a new build object and stores it in the database

 Params:      $values - Hash: A reference to a hash with keys and values  
              matching the fields of the build to be created. 
  +-------------+----------------+-----------+------------------------------------+
  | Field       | Type           | Null      | Description                        |
  +-------------+----------------+-----------+------------------------------------+
  | product     | Integer/String | Required  | ID or Name of product              |
  | name        | String         | Required  |                                    |
  | milestone   | String         | Optional  | Defaults to product's default MS   |
  | description | String         | Optional  |                                    |
  | isactive    | Boolean        | Optional  | Defaults to True (1)               |
  +-------------+----------------+-----------+------------------------------------+

 Returns:     The newly created object hash.

=item C<get($id)>

 Description: Used to load an existing build from the database.

 Params:      $id - An integer representing the ID in the database

 Returns:     A blessed Bugzilla::Testopia::Build object hash

=item C<lookup_id_by_name> B<DEPRECATED - CONSIDERED HARMFUL> Use Build::check_build instead

=item C<lookup_name_by_id> B<DEPRECATED> Use Build::get instead

=item C<update($id, $values)>

 Description: Updates the fields of the selected build or builds.

 Params:      $id - Integer: A single build ID.

              $values - Hash of keys matching Build fields and the new values 
              to set each field to.
                        +-------------+----------------+
                        | Field       | Type           |
                        +-------------+----------------+
                        | name        | String         |
                        | milestone   | String         |
                        | description | String         |
                        | isactive    | Boolean        |
                        +-------------+----------------+

 Returns:     Hash: The updated Build object hash.

=back

=head1 SEE ALSO

L<Bugzilla::Testopia::Build>
L<Bugzilla::Webservice> 

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>