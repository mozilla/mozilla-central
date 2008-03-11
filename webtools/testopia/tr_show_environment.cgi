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
#                  Andrew Nelson <anelson@novell.com>

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

local our $vars = {};
local our $template = Bugzilla->template;

print $cgi->header;

my $action = $cgi->param('action') || '';
local our $env_id = trim(Bugzilla->cgi->param('env_id')) || '';

unless ($env_id || $action){
  $template->process("testopia/environment/choose.html.tmpl", $vars) 
      || ThrowTemplateError($template->error());
  exit;
}

###########################
### Environment Actions ###
###########################
if ($action eq 'add'){
    ThrowUserError("testopia-create-denied", {'object' => 'Test Environment'}) unless Bugzilla->user->in_group('Testers');
    my $name = $cgi->param('name');
    my $product = $cgi->param('product');
    
    my $env = Bugzilla::Testopia::Environment->create({
        name => $name,
        product_id => $product,
    });
    
    print "{'success': true, 'id': " . $env->id . "}";
}

elsif ($action eq 'delete'){
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError('testopia-no-delete', {'object' => $env}) unless $env->candelete;

    $env->obliterate;
    
    print "{'success':true}";
}

elsif ($action eq 'toggle'){
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError('testopia-read-only', {'object' => $env}) unless $env->canedit;
    
    $env->toggle_archive;
    
    print "{'success':true}";
}

elsif ($action eq 'rename'){
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    ThrowUserError("testopia-read-only", {'object' => $env}) unless $env->canedit;
    
    $env->set_name($cgi->param('name'));
    $env->update();
    
    print "{'success':true}";
}

elsif ($action eq 'clone'){
    ThrowUserError("testopia-create-denied", {'object' => 'Test Environment'}) unless Bugzilla->user->in_group('Testers');
    
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    my $id = $env->clone($cgi->param('name'), $cgi->param('product'));
    
    print "{'success': true, 'id': " . $id . "}";
}

########################
### Variable Actions ###
########################

elsif($action eq 'edit'){
    my $type = $cgi->param('type');
    my $id = $cgi->param('id');
    
    for ($type){
        /category/      && do { edit_category($id); };
        /element/       && do { edit_element($id);  };
        /property/      && do { edit_property($id); };
        /validexp/      && do { edit_validexp($id); };
    }
}

elsif ($action eq 'getChildren'){
    
    my $json = new JSON;   
    
    
    #my $data = $json->jsonToObj($cgi->param('data'));
    
    #my $node = $data->{'node'};
    #my $tree = $data->{'tree'};
    
    #my $id = $node->{'objectId'};
    #my $type = $node->{'widgetId'};
    #my $tree_id = $tree->{'objectId'};
    
   
    my $id = $cgi->param('id');
    my $type = $cgi->param('type');
    my $tree_id = $cgi->param('environmentId');
    my $environmentSide = $cgi->param('environmentSide');
    my $environmentId = $cgi->param('environmentId');
    
    trick_taint($id);
    trick_taint($type);
    
    #strip away any letters in the id, to get the numeric id
    $id =~ s/\D+//;  
  
    
    if($environmentId != undef && $type =~ /category/)
    {
        get_environmentPanel_elements($environmentId, $id);
        exit;
    }
               
    
    print STDERR $type;
    for ($type){
        /classification/ && do { get_products($id);               };
        /product/        && do { get_categories($id);             };
        /category/       && do { get_category_element_json($id)   };
        /element/        && do { get_element_children($id)        };
        /property/       && do { get_validexp_json($id,$tree_id)  };
        /environment/    && do { get_env_elements($id)            };
        /root/           && do { get_root_categories($id)         };
    }
}

elsif($action eq 'removeNode'){
    my $json = new JSON;
    my $env_id = $cgi->param('environmentId');  
     
    my $id = $cgi->param('id');
    $id = return_numeric_value($id);
    my $type = $cgi->param('type');
    
    detaint_natural($env_id) unless $type =~ /validexp/;
    detaint_natural($id);
    trick_taint($type);
    
        
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    unless ($env->canedit){
        print 'false';
        exit;
    }
    
    if(!$env->element_is_mapped($id))
    {
        print 'the element is not mapped on this environment';
    }
        
    $env->delete_element($id);
    
    print "action successful";
    exit;
    
}

elsif($action eq 'createChild'){
    my $id = $cgi->param('id');    
    my $element = $cgi->param('type');   
    
    $id = return_numeric_value($id);           
    trick_taint($element);
    trick_taint($id);
    
 for ($element){
        /product/       && do { add_category($id);   };
        /category/      && do { add_element($id);    };
        /child/   && do { add_element($id,1);  };
        /element/       && do { add_property($id);   };
        /property/      && do { add_validexp($id);   };
    }
    
}

elsif($action eq 'deleteElement'){
    my $id = $cgi->param('id');    
    my $element = $cgi->param('type');   
    
    $id = return_numeric_value($id);           
    trick_taint($element);
    trick_taint($id);
    
    for ($element){
        /category/      && do { delete_category($id);    };
        /element/       && do { delete_element($id);   };
        /property/      && do { delete_property($id);   };
        /validexp/      && do { delete_validexp($id);   };
    }
    
}

elsif($action eq 'set_selected'){
    my $id = $cgi->param('id');
    my $type = $cgi->param('type');

    if ($type =~ /exp/)
    {
        my $env_id = $cgi->param('environmentId');
        my $prop_id = $id; 
        $prop_id =~ /(\d+)/;
        $prop_id  = $1;
        my $value = $cgi->param('value'); 

        detaint_natural($env_id);
        detaint_natural($prop_id);
        trick_taint($value);
        
        my $env = Bugzilla::Testopia::Environment->new($env_id);
        exit unless $env->canedit;
        
        my $property = Bugzilla::Testopia::Environment::Property->new($prop_id);
        my $elmnt_id = $property->element_id();
        my $old = $env->get_value_selected($env->id,$elmnt_id,$property->id);
        $old = undef if $old eq $value;
        if ($env->store_property_value($prop_id,$elmnt_id,$value) == 0){
            $env->update_property_value($prop_id,$elmnt_id,$value);
        }
        
        print "action successful";
    }
}

elsif($action eq 'move'){
#    my $json = new JSON;
#    my $data = $json->jsonToObj($cgi->param('data'));
#    
#    my $element = $data->{'child'};
#    my $env_tree = $data->{'newParentTree'};
#    
#    my $element_id = $element->{'objectId'};
#    my $environment_id = $env_tree->{'objectId'};

    my $element_id = $cgi->param('element_id');
    my $environment_id = $cgi->param('environment_id');
    my $type = $cgi->param('type');
    trick_taint($element_id);
    trick_taint($environment_id);
    
    #strip away any letters in the id, to get the numeric id
    $element_id =~ s/\D+//; 
            
    if($type eq "element")
    {
            my $env = Bugzilla::Testopia::Environment->new($environment_id);
        unless ($env->canedit){
               print "false";
            exit;
        }
        my $element = Bugzilla::Testopia::Environment::Element->new($element_id);
        my $properties = $element->get_properties;
        if (scalar @$properties == 0){
            my $success = $env->store_property_value(0, $element_id, "");
        }
        foreach my $property (@$properties){
            my $success = $env->store_property_value($property->{'property_id'}, $element_id, "");
            if ($success == 0){print "{error:\"error\"";exit;}
        }
    }
    
    #incoming type is a category
    else
    {
        my $env = Bugzilla::Testopia::Environment->new($environment_id);
        unless ($env->canedit){
               print "false";
            exit;
        }
        
        my $category = Bugzilla::Testopia::Environment::Category->new($element_id);
        my $elements = $category->get_elements_by_category();
        
        foreach my $element (@$elements)
        {
            print $element->id;
            #bless $element, Bugzilla::Testopia::Environment::Element; 
            $env->store_property_value(0, $element->id, "");
        }
        
        
    }
    print "true";
    exit;
    
}

else { 
    display();
}


sub display {
    detaint_natural($env_id);
    validate_test_id($env_id, 'environment');
    my $env = Bugzilla::Testopia::Environment->new($env_id);
    
    if(!defined($env)){
        my $env = Bugzilla::Testopia::Environment->new({'environment_id' => 0});
        $vars->{'environment'} = $env;
        $vars->{'action'} = 'do_add';
        $template->process("testopia/environment/add.html.tmpl", $vars)
            || print $template->error();
            exit;
    }
    ThrowUserError("testopia-read-only", {'object' => $env}) unless $env->canview;
    my $category = Bugzilla::Testopia::Environment::Category->new({'id' => 0});
    if (Bugzilla->params->{'useclassification'}){
        $vars->{'allhaschild'} = $category->get_all_child_count;
        $vars->{'toplevel'} = Bugzilla->user->get_selectable_classifications;
        $vars->{'type'} = 'classification';
    }
    else {
        $vars->{'toplevel'} = $category->get_env_product_list;
        $vars->{'type'} = 'product';
    }
    $vars->{'user'} = Bugzilla->user;
    $vars->{'action'} = 'do_edit';
    $vars->{'environment'} = $env;
    $template->process("testopia/environment/show.html.tmpl", $vars)
        || print $template->error();
        
}

###########################
### Tree Helper Methods ###
###########################

sub get_environmentPanel_elements{
    my ($environmentId, $categoryId) = (@_);
    my $category = Bugzilla::Testopia::Environment::Category->new($categoryId);
    my $category_elements = $category->get_elements_by_category();
    my $environment = Bugzilla::Testopia::Environment->new($environmentId);
    my $environment_elements = $environment->get_elements_for_environment();
    
    my @elements_to_be_printed;
    
     my $json = new JSON;
    for my $element (@$category_elements)
    {
        for my $mapped_element (@$environment_elements)
        {
            if($element->id == $mapped_element->id)
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
        
                push @elements_to_be_printed, {
                    text => $element->{'name'}, 
                    id   => $element->{'element_id'}, 
                    type => 'element', 
                    leaf => $leaf, 
                    cls  =>'element',
                };
            }
        }
    }
    
    print $json->objToJson(\@elements_to_be_printed);
    
}
sub get_root_categories{
      my $category = Bugzilla::Testopia::Environment::Category->new({'id' => 0});
         my $toplevel;
         my $anyProduct = 'false';  
         if (Bugzilla->params->{'useclassification'}){
            $vars->{'allhaschild'} = $category->get_all_child_count;
            $toplevel = Bugzilla->user->get_selectable_classifications;
            $vars->{'type'} = 'classification';
            $anyProduct = 'true';
      }
         else {
            $vars->{'toplevel'} = $category->get_env_product_list;
            $vars->{'type'} = 'product';
      }
            
        my @products;
        
        if ($anyProduct == 'true')
         {
              push @products, {id => '0 product', text => '-ANY PRODUCT-', type=> 'product', cls => 'classification'};
          }
        foreach my $p (@$toplevel){
            push @products, {id => $p->id, text => $p->name, type=> $vars->{'type'}, cls=> 'classification'};
        }
        my $json = new JSON;
        print $json->objToJson(\@products);
    
    
}

sub get_products{
    my ($class_id) = (@_);
    my $class = Bugzilla::Testopia::Classification->new($class_id);
    return unless scalar(grep {$class->id eq $class_id} @{Bugzilla->user->get_selectable_classifications});
    print $class->products_to_json(1);
}

sub get_categories{
    my ($product_id) = (@_);
    if ($product_id){
        my $product = Bugzilla::Testopia::Product->new($product_id);
        return unless Bugzilla->user->can_see_product($product->name);
    }
    my $category = Bugzilla::Testopia::Environment::Category->new({});
    print $category->product_categories_to_json($product_id,1);
}

sub get_category_element_json {
    my ($id) = (@_);
    my $category = Bugzilla::Testopia::Environment::Category->new($id);
    return unless $category->canview;
    my $fish = $category->elements_to_json("TRUE");
    print $fish;
} 

sub get_element_children {
    my ($id) = (@_);
    my $element = Bugzilla::Testopia::Environment::Element->new($id);
    print STDERR $element->canview;
    return unless $element->canview;
    print $element->children_to_json(1);
}

sub get_env_elements {
    my ($id) = (@_);
    my $env = Bugzilla::Testopia::Environment->new($id);
    return unless $env->canview;
    print $env->categories_to_json(1);
}

sub get_validexp_json {
    my ($id,$env_id) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    return unless $property->canview;
    $env_id = return_numeric_value($env_id);
    print $property->valid_exp_to_json(1,$env_id);
}

sub return_numeric_value{
    my ($value) = (@_);
    $value =~ s/\D+//;
    return $value;
}

#####################
#Edit Helper Methods#
#####################

sub edit_category{
    my $name = $cgi->param('text');
    my $product_id = $cgi->param('productId');
    my ($id) = (@_);
    $id =~ s/\D+//;
    my $category = Bugzilla::Testopia::Environment::Category->new($id);
    if($product_id)
    {
        $product_id = $category->produict_id();
    }
    return unless $category->canedit;
    
    trick_taint($name);
    detaint_natural($product_id);
    my $error_mode_cache = Bugzilla->error_mode;
    Bugzilla->error_mode(ERROR_MODE_DIE);
    eval{
        validate_selection($product_id, 'id', 'products');
    };
    Bugzilla->error_mode($error_mode_cache);
    if ($@ && $product_id != 0){
        print 'error:Invalid product';
        exit;
    }
    $category->set_product($product_id);
    
    if($category->check_for_elements()){
        print "error: Category has children, it CANNOT be renamed";
        exit;
    }        
    unless ($category->set_name($name)) {
        print 'error:Name already used. Please choose another';
        exit;
    } 
     
    print "action successful";
    
}

sub edit_element{
    my ($id) = (@_);

    #
    # CGI params
    #   productCombo    -> id of product (does not matter what this is, only used to find categories)
    #   categoryCombo   -> id of category (if zero, leave the same)
    #   elementCombo    -> id of parent element (id of 0 means no parent)
    #   name            -> name of the element
    #
    
    $id = return_numeric_value($id);
    my $element = Bugzilla::Testopia::Environment::Element->new($id);
    return unless $element->canedit;
    
    #my $cat_id = $cgi->param('parentCategoryID');
    #my $parent_id = $cgi->param('parentElementID');
    my $name = $cgi->param('text');
    my $parent;
    
    #detaint_natural($cat_id);
    #detaint_natural($parent_id);
    trick_taint($name);
    
#    if ($cat_id){
#        $element->update_element_category($cat_id);
#        $parent = 'category' . $cat_id;
#    }
#    else {
#        print '{error: "Category does not exist"}';
#        exit;
#    }
#    if ($parent_id){
#        $element->update_element_parent($parent_id);
#        $parent = 'element' . $parent_id;
#    }
#    elsif (!$cat_id) {
#        print '{error: "Parent element does not exist"}';
#        exit;
#    }

    if($element->isMapped())
    {
        print "The element is mapped you CANNOT edit it";
        exit;
    }
    
    unless ($element->update_element_name($name)){
        print 'error: Name already taken. Please choose another.';
        exit;
    }
    
    print "action successful";
}

sub edit_property{
    my ($id) = (@_);
    my $name = $cgi->param('text');
    my $element_id = $cgi->param('element_id');
    $id = return_numeric_value($id);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    return unless $property->canedit;
    
    trick_taint($name);
    
    if($element_id)
    {
        detaint_natural($element_id);
        my $error_mode_cache = Bugzilla->error_mode;
        Bugzilla->error_mode(ERROR_MODE_DIE);
        eval{
            validate_selection($element_id, 'element_id', 'test_environment_element');
        };
        Bugzilla->error_mode($error_mode_cache);
        if ($@){
            print 'Invalid element';
            exit;
        }
        $property->set_element($element_id);
        }
        unless ($property->set_name($name)) {
            print 'Name already used. Please choose another';
            exit;
    } 
     
    print "action successful"; 
}

sub edit_validexp{
    my ($id) = (@_);
    
    $id =~ /(\d+)/;
    $id = $1;
    trick_taint($id);
    my $property =  Bugzilla::Testopia::Environment::Property->new($id);
    return unless $property->canedit;
    my $value = $cgi->param('value');
    my $name = $cgi->param('text');
    trick_taint($name);
    my $expressions = $property->validexp();
    
    my @newValues;
    my $matched = 1; 
    foreach my $v(split /\|/, $expressions)
    { 
        if($v eq $value and $matched)
        {
            $matched = 0;
            $v = $name;
        }
        push @newValues, $v;
    }
    
    my $newExpression = join("|", @newValues);    
    $property->update_property_validexp($newExpression);
    print "action successful";
}

###################################
### Create Child Helper Methods ###
###################################
sub add_category{
    my ($id) = (@_);
    my $category = Bugzilla::Testopia::Environment::Category->new({});
    if ($id){
        my $product = Bugzilla::Testopia::Product->new($id);
        return unless $product->canedit;
    }
    $category->{'product_id'} = $id;
    $category->{'name'} = 'New category ' . $category->new_category_count;
    
    my $new_cid = $category->store();
    
    my $category_json = {text=> $category->{'name'}, id=> $new_cid . ' category', type=> 'category', leaf => 'false', cls=> 'category'};
        
    my $json = new JSON;
     
    print $json->objToJson($category_json);
        
    
}

sub add_element{
    my ($id, $ischild) = (@_);
    my $element = Bugzilla::Testopia::Environment::Element->new({});
    # If we are adding this element as a child, $id is the parent element's id
    if ($ischild) {
        my $parent = Bugzilla::Testopia::Environment::Element->new($id);
        return unless $parent->canedit;
        $element->{'env_category_id'} = $parent->env_category_id;
    }
    # Otherwise $id is the catagory id
    else {
        my $parent = Bugzilla::Testopia::Environment::Category->new($id);
        return unless $parent->canedit;
        $element->{'env_category_id'} = $id;
    }
    $element->{'name'} = "New element " . $element->new_element_count;
    $element->{'parent_id'} = $ischild ? $id : 0;
    $element->{'isprivate'} = 0; 
    
    my $new_eid = $element->store();
    
    my $element_json = {text=> $element->{'name'}, id=> $new_eid . ' element', type=> 'element', leaf => 'false', cls=> 'element'};
        
    my $json = new JSON;
     
    print $json->objToJson($element_json);
}

sub add_property{
    my ($id) = (@_);
    #add new property to element with id=$id
    my $property = Bugzilla::Testopia::Environment::Property->new({});

    my $parent = Bugzilla::Testopia::Environment::Element->new($id);
    return unless $parent->canedit;

    $property->{'element_id'} = $id;
    $property->{'name'} = "New property " . $property->new_property_count;
    $property->{'validexp'} = "";
    
    my $new_pid = $property->store();
    
    my $property_json = {text=> $property->{'name'}, id=> $new_pid . ' property', type=> 'property', leaf => 'false', cls=> 'property'};
        
    my $json = new JSON;
     
    print $json->objToJson($property_json); 
}

sub add_validexp{
    my ($id) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    return unless $property->canedit;
    
    my $exp = $property->validexp;
    $exp ? $property->update_property_validexp($exp . "|New value") : $property->update_property_validexp("New value");
    
    my $json .= '{text: "New value",';
    $json    .=  'id: "' . $id . ' validexp",';
    $json    .=  'type: "validexp", cls: "validexp"}';

    print $json;
}

#############################
### Delete Helper Methods ###
#############################
sub delete_category{
    my ($id) = (@_);
    my $category = Bugzilla::Testopia::Environment::Category->new($id);
    if($category->check_for_elements())
    {
        print "You CANNOT delete a category that has children";
        return;
    }
    return unless $category->candelete;
    my $success = $category->obliterate;
    print $success == 1 ? "action successful" : "error deleting category";
}

sub delete_element{
    my ($id) = (@_);
    my $element = Bugzilla::Testopia::Environment::Element->new($id);
    if($element->isMapped())
    {
        print "You CANNOT delete an element that is mapped";
    }
    return unless $element->candelete;
    my $success = $element->obliterate;
    print $success == 1 ? "action successful" : "error deleting element";
}

sub delete_property{
    my ($id) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    return unless $property->candelete;
    my $success = $property->obliterate;
    print $success == 1 ? "action successful" : "error deleting property";
}

sub delete_validexp{
    # $id, $type
    my ($id) = (@_);
    my $property = Bugzilla::Testopia::Environment::Property->new($id);
    if(!$property->candelete)
    {
        print "you CANNOT delete a property that is mapped";
        return;    
    }
    my %values;
    foreach my $v (split /\|/, $property->validexp){
        $values{$v} = 1;
    }
    my $value = $cgi->param("value");
    my $deleted = delete $values{$value};
    my $exp = join("|", keys %values);
    $property->update_property_validexp($exp);
    print $deleted ? "action successful" : "error deleting validexp";
}