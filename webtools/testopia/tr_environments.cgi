#!/usr/bin/perl -wT
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
#                 Brian Kramer <bkramer@novell.com>
#                 Michael Hight <mjhight@gmail.com>
#                 Garrett Braden <gbraden@novell.com>
#                 Andrew Nelson <anelson@novell.com>

use strict;
use lib ".";

use Bugzilla;
use Bugzilla::Util;
use Bugzilla::Config;
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::Classification;
use Bugzilla::Testopia::Environment;
use Bugzilla::Testopia::Environment::Element;
use Bugzilla::Testopia::Environment::Category;
use Bugzilla::Testopia::Environment::Property;
use Bugzilla::Testopia::Constants;
use Data::Dumper;
use JSON;

Bugzilla->error_mode(ERROR_MODE_AJAX);
Bugzilla->login(LOGIN_REQUIRED);

my $cgi = Bugzilla->cgi;

local our $vars     = {};
local our $template = Bugzilla->template;

print $cgi->header;

my $action = $cgi->param('action') || '';
local our $env_id = trim( Bugzilla->cgi->param('env_id') ) || '';

unless ( $env_id || $action ) {
    $template->process( "testopia/environment/choose.html.tmpl", $vars )
      || ThrowTemplateError( $template->error() );
    exit;
}

###########################
### Environment Actions ###
###########################
if ( $action eq 'add' ) {
    ThrowUserError( "testopia-create-denied",
        { 'object' => 'Test Environment' } )
      unless Bugzilla->user->in_group('Testers');
    my $name    = $cgi->param('name');
    my $product = $cgi->param('product_id');

    my $env = Bugzilla::Testopia::Environment->create(
        {
            name       => $name,
            product_id => $product,
        }
    );

    print "{'success': true, 'id': " . $env->id . "}";
}

elsif ( $action eq 'delete' ) {
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError( 'testopia-no-delete', { 'object' => $env } )
      unless $env->candelete;

    $env->obliterate;

    print "{'success' :true}";
}

elsif ( $action eq 'toggle' ) {
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError( 'testopia-read-only', { 'object' => $env } )
      unless $env->canedit;

    $env->toggle_archive;

    print "{'success': true}";
}

elsif ( $action eq 'rename' ) {
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError( "testopia-read-only", { 'object' => $env } )
      unless $env->canedit;

    $env->set_name( $cgi->param('name') );
    $env->update();

    print "{'success': true}";
}

elsif ( $action eq 'clone' ) {
    ThrowUserError( "testopia-create-denied",
        { 'object' => 'Test Environment' } )
      unless Bugzilla->user->in_group('Testers');

    my $env = Bugzilla::Testopia::Environment->new($env_id);
    my $id = $env->clone( $cgi->param('name'), $cgi->param('product') );

    print "{'success': true, 'id': " . $id . "}";
}

##################################
### Environment Editor Actions ###
##################################

elsif ( $action eq 'edit' ) {
    my $type = $cgi->param('type');
    my $id   = $cgi->param('id');

    for ($type) {
        /category/ && do { edit_category($id); };
        /element/  && do { edit_element($id); };
        /property/ && do { edit_property($id); };
        /validexp/ && do { edit_validexp($id); };
    }
}

elsif ( $action eq 'getChildren' ) {

    my $json = new JSON;

    my $id        = $cgi->param('node');
    my $type      = $cgi->param('type');
    my $tree_type = $cgi->param('tree_type');

    trick_taint($id);
    trick_taint($type);

    if ( $tree_type =~ /env/ ) {
        for ($type) {
            /environment/ && do { get_env_categories($id) };
            /category/    && do { get_mapped_category_elements( $env_id, $id ) };
            /element/     && do { get_element_children( $id, 'NODRAG' ) };
            /property/    && do { get_validexp_json( $id, $env_id ) };
        }
    }
    else {
        for ($type) {
            /root/     && do { get_root($id) };
            /product/  && do { get_categories($id); };
            /category/ && do { get_category_element_json($id) };
            /element/  && do { get_element_children($id) };
            /property/ && do { get_validexp_json($id) };
        }
    }
}

elsif ( $action eq 'remove_env_node' ) {
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError( "testopia-read-only", { 'object' => $env } ) unless $env->canedit;
    
    foreach my $element_id (split(',', $cgi->param('element_ids'))){
        detaint_natural($element_id);
        $env->delete_element($element_id);
    }

    print "{'success': true}";
}

elsif ( $action eq 'create_child' ) {
    my $parent_id   = $cgi->param('id');
    my $type = $cgi->param('type');

    detaint_natural($parent_id);
    $parent_id ||= 0;
    
    for ($type) {
        /category/ && do { add_category($parent_id); };
        /element/  && do { add_element($parent_id); };
        /child/    && do { add_element($parent_id, 'CHILD'); };
        /property/ && do { add_property($parent_id); };
        /value/    && do { add_validexp($parent_id); };
    }
}

elsif ( $action eq 'delete_element' ) {
    my $id      = $cgi->param('id');
    my $type = $cgi->param('type');

    trick_taint($id);

    for ($type) {
        /category/ && do { delete_category($id); };
        /element/  && do { delete_element($id); };
        /property/ && do { delete_property($id); };
        /validexp/ && do { delete_validexp($id); };
    }

}

elsif ( $action eq 'set_selected' ) {
    my $property_id   = $cgi->param('id');
    my $type = $cgi->param('type');

    if ( $type =~ /exp/ ) {
        my $value = $cgi->param('value');
        
        detaint_natural($property_id);
        trick_taint($value);

        my $env = Bugzilla::Testopia::Environment->new($env_id);
        ThrowUserError( "testopia-read-only", { 'object' => $env } ) unless $env->canedit;

        my $property = Bugzilla::Testopia::Environment::Property->new($property_id);
        my $elmnt_id = $property->element_id();
        my $old = $env->get_value_selected( $env->id, $elmnt_id, $property->id );
        $old = undef if $old eq $value;
        if ( $env->store_property_value( $property_id, $elmnt_id, $value ) == 0 ) {
            $env->update_property_value( $property_id, $elmnt_id, $value );
        }

        print "{'success': true}";
    }
}

elsif ( $action eq 'apply_element' ) {
    my $id     = $cgi->param('id');
    my $type   = $cgi->param('type');
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError( "testopia-read-only", { 'object' => $env } ) unless $env->canedit;
    
    detaint_natural($id);
    if ( $type eq "element" ) {
        my $element = Bugzilla::Testopia::Environment::Element->new($id);
        
        my $properties = $element->get_properties;
        if ( scalar @$properties == 0 ) {
            my $success = $env->store_property_value( 0, $id, "" );
        }
        foreach my $property (@$properties) {
            my $success = $env->store_property_value( $property->id || 0, $id, "" );
        }
    }
    #incoming type is a category
    else {
        my $category = Bugzilla::Testopia::Environment::Category->new($id);

        foreach my $element (@{$category->get_parent_elements}) {
            $env->store_property_value( 0, $element->id, "" );
        }
    }
    print "{'success': true}";
}

else {
    display();
}

sub display {
    detaint_natural($env_id);
    validate_test_id( $env_id, 'environment' );
    my $env = Bugzilla::Testopia::Environment->new($env_id);

    if ( !defined($env) ) {
        my $env =
          Bugzilla::Testopia::Environment->new( { 'environment_id' => 0 } );
        $vars->{'environment'} = $env;
        $vars->{'action'}      = 'do_add';
        $template->process( "testopia/environment/add.html.tmpl", $vars )
          || print $template->error();
        exit;
    }
    ThrowUserError( "testopia-read-only", { 'object' => $env } )
      unless $env->canview;
    my $category =
      Bugzilla::Testopia::Environment::Category->new( { 'id' => 0 } );
    if ( Bugzilla->params->{'useclassification'} ) {
        $vars->{'allhaschild'} = $category->get_all_child_count;
        $vars->{'toplevel'}    = Bugzilla->user->get_selectable_classifications;
        $vars->{'type'}        = 'classification';
    }
    else {
        $vars->{'toplevel'} = $category->get_env_product_list;
        $vars->{'type'}     = 'product';
    }
    $vars->{'user'}        = Bugzilla->user;
    $vars->{'action'}      = 'do_edit';
    $vars->{'environment'} = $env;
    $template->process( "testopia/environment/show.html.tmpl", $vars )
      || print $template->error();

}

###########################
### Tree Helper Methods ###
###########################

sub get_root {
    my ($product_id) = (@_);
    my @products;
    
    detaint_natural($product_id);
    if ($product_id){
        my $product = Bugzilla::Testopia::Product->new($product_id);
        return unless $product->canedit;
        push @products,
          {
            id   => $product->id,
            text => $product->name,
            type => 'product',
            cls  => 'classification',
            leaf => scalar @{$product->environment_categories} > 0 ? JSON::false : JSON::true, 
            draggable => JSON::false,
          };
    }
    else {
        push @products,
          {
            id   => 'GLOBAL',
            text => 'GLOBAL ATTRIBUTES',
            type => 'product',
            cls  => 'classification',
            draggable => JSON::false,
          };
    }
    my $json = new JSON;
    print $json->encode( \@products );

}

sub get_categories {
    my ($product_id) = (@_);
    # Handle the special GLOBAL ATTRIBUTES product
    $product_id = $product_id eq 'GLOBAL' ? 0 : $product_id; 
    if ($product_id) {
        my $product = Bugzilla::Testopia::Product->new($product_id);
        return unless Bugzilla->user->can_see_product( $product->name );
    }
    my $category = Bugzilla::Testopia::Environment::Category->new( {} );
    print $category->product_categories_to_json( $product_id );
}

sub get_category_element_json {
    my ($id) = (@_);
    my $category = Bugzilla::Testopia::Environment::Category->new($id);
    return unless $category->canview;
    my $fish = $category->elements_to_json("TRUE");
    print $fish;
}

sub get_element_children {
    my ( $id, $draggable ) = (@_);
    my $element = Bugzilla::Testopia::Environment::Element->new($id);
    print STDERR $element->canview;
    return unless $element->canview;
    print $element->children_to_json($draggable);
}

sub get_env_categories {
    my ($id) = (@_);
    my $env = Bugzilla::Testopia::Environment->new($id);
    return unless $env->canview;
    print $env->categories_to_json();
}

sub get_mapped_category_elements {
    my ( $id, $cat_id ) = (@_);
    my $env = Bugzilla::Testopia::Environment->new($id);
    return unless $env->canview;
    print $env->mapped_category_elements_to_json($cat_id);
}

sub get_validexp_json {
    my ( $id, $env_id ) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    return unless $property->canview;
    print $property->value_to_json($env_id);
}

sub return_numeric_value {
    my ($value) = (@_);
    $value =~ s/\D+//;
    return $value;
}

#####################
#Edit Helper Methods#
#####################

sub edit_category {
    my ($id)       = (@_);
    my $name       = $cgi->param('text');
    trick_taint($name);
    
    my $category = Bugzilla::Testopia::Environment::Category->new($id);
    ThrowUserError( "testopia-read-only", { 'object' => $category } ) unless $category->canedit;

    unless ( $category->set_name($name) ) {
        ThrowUserError('testopia-name-not-unique', {object => 'category'});
    }

    print "{'success':true}";

}

sub edit_element {
    my ($id) = (@_);
    my $name = $cgi->param('text');
    trick_taint($name);
    
    my $element = Bugzilla::Testopia::Environment::Element->new($id);
    ThrowUserError( "testopia-read-only", { 'object' => $element } ) unless $element->canedit;

    ThrowUserError('testopia-element-in-use') if ( $element->is_mapped() );

    unless ( $element->set_name($name) ) {
        ThrowUserError('testopia-name-not-unique', {object => 'element'});
    }

    print "{'success':true}";
}

sub edit_property {
    my ($id)       = (@_);
    my $name       = $cgi->param('text');
    trick_taint($name);
    
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    ThrowUserError( "testopia-read-only", { 'object' => $property } ) unless $property->canedit;
    
    ThrowUserError('testopia-element-in-use') if ( $property->is_mapped() );
    
    unless ( $property->set_name($name) ) {
        ThrowUserError('testopia-name-not-unique', {object => 'property'});
    }

    print "{'success':true}";
}

sub edit_validexp {
    my ($id) = (@_);

    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    
    ThrowUserError( "testopia-read-only", { 'object' => $property } ) unless $property->canedit;
    
    my $name  = $cgi->param('text');
    TrhowUserError('testopia-invalid-char') if $name =~ /\|/;
    
    trick_taint($name);

    my $expressions = $property->validexp();
    
    if ($expressions =~ qr($name)){
        ThrowUserError('testopia-name-not-unique', {object => 'property value'});
    }
    
    $property->update_property_validexp($expressions . '|' . $name);
    
    print "{'success':true}";
}

###################################
### Create Child Helper Methods ###
###################################
sub add_category {
    my ($id) = (@_);
    my $category = Bugzilla::Testopia::Environment::Category->new( {} );
    if ($id) {
        my $product = Bugzilla::Testopia::Product->new($id);
        ThrowUserError( "testopia-read-only", { 'object' => $product } ) unless $product->canedit;
    }
    $category->{'product_id'} = $id;
    $category->{'name'}       = 'New category ' . $category->new_category_count;

    my $new_cid = $category->store();

    my $category_json = {
        text => $category->{'name'},
        id   => $new_cid,
        type => 'category',
        leaf => JSON::false,
        cls  => 'category'
    };

    my $json = new JSON;
    print "{success: true, env_object: ";
    print $json->encode($category_json);
    print "}";

}

sub add_element {
    my ( $id, $ischild ) = (@_);
    my $element = Bugzilla::Testopia::Environment::Element->new( {} );

    # If we are adding this element as a child, $id is the parent element's id
    if ($ischild) {
        my $parent = Bugzilla::Testopia::Environment::Element->new($id);
        ThrowUserError( "testopia-read-only", { 'object' => $parent } ) unless $parent->canedit;
        $element->{'env_category_id'} = $parent->env_category_id;
    }

    # Otherwise $id is the catagory id
    else {
        my $parent = Bugzilla::Testopia::Environment::Category->new($id);
        ThrowUserError( "testopia-read-only", { 'object' => $parent } ) unless $parent->canedit;
        $element->{'env_category_id'} = $id;
    }
    $element->{'name'}      = "New element " . $element->new_element_count;
    $element->{'parent_id'} = $ischild ? $id : 0;
    $element->{'isprivate'} = 0;

    my $new_eid = $element->store();

    my $element_json = {
        text => $element->{'name'},
        id   => $new_eid,
        type => 'element',
        leaf => JSON::false,
        cls  => 'element'
    };

    my $json = new JSON;
    print "{success: true, env_object: ";
    print $json->encode($element_json);
    print "}";
}

sub add_property {
    my ($id) = (@_);

    #add new property to element with id=$id
    my $property = Bugzilla::Testopia::Environment::Property->new( {} );

    my $parent = Bugzilla::Testopia::Environment::Element->new($id);
    ThrowUserError( "testopia-read-only", { 'object' => $parent } ) unless $parent->canedit;

    $property->{'element_id'} = $id;
    $property->{'name'}       = "New property " . $property->new_property_count;
    $property->{'validexp'}   = "";

    my $new_pid = $property->store();

    my $property_json = {
        text => $property->{'name'},
        id   => $new_pid,
        type => 'property',
        leaf => JSON::false,
        cls  => 'property',
        draggable => JSON::false,
    };

    my $json = new JSON;
    print "{success: true, env_object: ";
    print $json->encode($property_json);
    print "}";
}

sub add_validexp {
    my ($id) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    ThrowUserError( "testopia-read-only", { 'object' => $property } ) unless $property->canedit;

    my $exp = $property->validexp;
    $exp
      ? $property->update_property_validexp( $exp . "|New value" )
      : $property->update_property_validexp("New value");

    my $value = {
        text => "New value",
        id   => $id,
        type => "value", 
        cls  => "validexp",
        draggable => JSON::false,
    };
    
    my $json = new JSON;
    print "{success: true, env_object: ";
    print $json->encode($value);
    print "}";
}

#############################
### Delete Helper Methods ###
#############################
sub delete_category {
    my ($id) = (@_);
    my $category = Bugzilla::Testopia::Environment::Category->new($id);

    ThrowUserError( "testopia-read-only", { 'object' => $category } ) unless $category->candelete;
    ThrowUserError('testopia-element-in-use') if ( $category->is_mapped() );
    
    $category->obliterate;
    
    print "{success: true}";
}

sub delete_element {
    my ($id) = (@_);
    my $element = Bugzilla::Testopia::Environment::Element->new($id);
    
    ThrowUserError( "testopia-read-only", { 'object' => $element } ) unless $element->candelete;
    ThrowUserError('testopia-element-in-use') if ( $element->is_mapped() );
    
    $element->obliterate;
    
    print "{success: true}";
}

sub delete_property {
    my ($id) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    
    ThrowUserError( "testopia-read-only", { 'object' => $property } ) unless $property->candelete;
    ThrowUserError('testopia-element-in-use') if ( $property->is_mapped() );
    
    $property->obliterate;
    
    print "{success: true}";
}

sub delete_validexp {
    my ($id) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    
    ThrowUserError( "testopia-read-only", { 'object' => $property } ) unless $property->candelete;
    
    my %values;
    foreach my $v ( split /\|/, $property->validexp ) {
        $values{$v} = 1;
    }
    
    delete $values{$cgi->param("value")};
    my $exp     = join( "|", keys %values );
    
    $property->update_property_validexp($exp);
    print "{success: true}";
}
