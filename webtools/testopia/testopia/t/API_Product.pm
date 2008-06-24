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
#                 Jeff Dayley    <jedayley@novell.com>

package API_Product;

use strict;

use base qw(Test::Unit::TestCase);

use lib ".";
use lib "../..";

use Bugzilla;
use Bugzilla::Testopia::Product;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;


use Testopia::Test::Constants;
use Testopia::Test::API::Util;
use Testopia::Test::Util;

use Test::More;
use Test::Deep;

# The the XMLRPC::Lite proxy handle
our $proxy = proxy(LOGIN_CREDENTIALS->{'admin'});

sub new {
    my $self = shift()->SUPER::new(@_);

    return $self;
}

sub set_up {
    my $self = shift;
}

sub tear_down {
    my $self = shift;
}

sub test_check_category {
    my $self = shift;

    my $rep = get_rep('test_case_categories');
    my $obj = Bugzilla::Testopia::Category->new($rep->{'category_id'});
    
    my $response = $proxy->call( "Product.check_category", $rep->{'name'}, $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Product - test_check_category" ); 
}

sub test_check_component {
    my $self = shift;

    my $rep = get_rep('components');
    my $obj = Bugzilla::Component->new($rep->{'id'});
    $obj->product;
    
    my $response = $proxy->call( "Product.check_component", $rep->{'name'}, $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Product - test_check_component" ); 
}

sub test_check_product {
    my $self = shift;

    my $rep = get_rep('products');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'id'});
    
    my $response = $proxy->call( "Product.check_product", $rep->{'name'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Product - test_check_product" );     
}

sub test_get {
    my $self = shift;
    
    my $rep = get_rep('products');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'id'});
    
    my $response = $proxy->call( "Product.get", $rep->{'id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "Product - test_get" );
}

sub test_get_builds {
    my $self = shift;
    
    my $rep = get_rep('test_builds');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'product_id'});
    
    my $response = $proxy->call( "Product.get_builds", $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->builds;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_builds" );
}

sub test_get_cases {
    my $self = shift;
    
    my $rep = get_rep('test_case_plans');
    my $plan = Bugzilla::Testopia::TestPlan->new($rep->{'plan_id'});
    my $obj = $plan->product;
    
    my $response = $proxy->call( "Product.get_cases", $obj->id );
    
    check_fault($response, $self);
    
#    dump_all($obj->cases, $response->result);
    ok( scalar @{$response->result} == scalar @{$obj->cases}, "Product - test_get_cases" );
}

sub test_get_categories {
    my $self = shift;
    
    my $rep = get_rep('test_case_categories');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'product_id'});
    
    my $response = $proxy->call( "Product.get_categories", $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->categories;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_categories" );

}

sub test_get_category {
    my $self = shift;
    
    my $rep = get_rep('test_case_categories');
    my $obj = Bugzilla::Testopia::Category->new($rep->{'category_id'});
    
    my $response = $proxy->call( "Product.get_category", $rep->{'category_id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "Product - test_get_category" );
}

sub test_get_component {
    my $self = shift;
    
    my $rep = get_rep('components');
    my $obj = Bugzilla::Component->new($rep->{'id'});
    
    my $response = $proxy->call( "Product.get_component", $rep->{'id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "Product - test_get_component" );    
}

sub test_get_components {
    my $self = shift;
    
    my $rep = get_rep('products');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'id'});
    
    my $response = $proxy->call( "Product.get_components", $rep->{'id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->components;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_components" );

}

sub test_get_enviroments {
    my $self = shift;
    
    my $rep = get_rep('test_environments');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'product_id'});
    
    my $response = $proxy->call( "Product.get_environments", $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->environments;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_enviroments" );
    
}

sub test_get_milestones {
    my $self = shift;
    
    my $rep = get_rep('products');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'id'});
    
    my $response = $proxy->call( "Product.get_milestones", $rep->{'id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->milestones;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_milestones" );
    
}

sub test_get_plans {
    my $self = shift;
    
    my $rep = get_rep('test_plans');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'product_id'});
    
    my $response = $proxy->call( "Product.get_plans", $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->plans;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_plans" );
    
}

sub test_get_runs {
    my $self = shift;
    
    my $rep = get_rep('test_runs');
    my $run = Bugzilla::Testopia::TestRun->new($rep->{'run_id'});
    my $obj = $run->plan->product;
    
    my $response = $proxy->call( "Product.get_runs", $obj->id );
    
    check_fault($response, $self);
    
    my $list = $obj->runs;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_runs" );

}
	
sub test_get_tags {
    my $self = shift;
    
    my $rep = get_rep('test_run_tags');
    my $run = Bugzilla::Testopia::TestRun->new($rep->{'run_id'});
    my $obj = $run->plan->product;
    
    my $response = $proxy->call( "Product.get_tags", $obj->id );
    
    check_fault($response, $self);
    
#    dump_all($obj->tags, $response->result);
    cmp_deeply( $response->result, noclass($obj->tags), "Product - test_get_tags" );
    
}

sub test_get_versions {
    my $self = shift;
    
    my $rep = get_rep('products');
    my $obj = Bugzilla::Testopia::Product->new($rep->{'id'});
    
    my $response = $proxy->call( "Product.get_versions", $rep->{'id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->versions;
    convert_undef($list);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "Product - test_get_versions" );
    
}

1;


__END__
