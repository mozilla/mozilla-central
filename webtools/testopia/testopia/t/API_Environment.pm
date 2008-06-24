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

package API_Environment;

use strict;

use base qw(Test::Unit::TestCase);

use lib "..";
use lib "../..";

use Bugzilla;
use Bugzilla::Testopia::Environment;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;


use Testopia::Test::Constants;
use Testopia::Test::API::Util;
use Testopia::Test::Util;

use Test::More tests => 4;
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

sub test_check_environment_by_product_id {
    my $self = shift;

    my $rep = Testopia::Test::Util::get_rep('test_environments');
    my $obj = Bugzilla::Testopia::Environment->new($rep->{'environment_id'});
    
    my $response = $proxy->call( "Environment.check_environment", $rep->{'name'}, $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Environment - test_check_environment_by_product_id" ); 
}

sub test_check_environment_by_product_name {
    my $self = shift;

    my $rep = get_rep('test_environments');
    my $obj = Bugzilla::Testopia::Environment->new($rep->{'environment_id'});
    
    my $response = $proxy->call( "Environment.check_environment", $rep->{'name'}, $obj->product->name );
    
    # Calling $obj->product above places a product object into the hash
    # Remove product from the hash as it will cause it to fail.
    delete $obj->{'product'};
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Environment - test_check_environment_by_product_nameq" ); 
}

sub test_create_by_product_id {
    my $self = shift;
    
    my $product = get_rep('products');
    
    my $response = $proxy->call( "Environment.create", {
        product     => $product->{'id'},
        name        => 'API TEST BUILD ' . time(),
        isactive    => 1,
    });
    
    check_fault($response, $self);
    my $obj = Bugzilla::Testopia::Environment->new($response->result->{'environment_id'});
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Environment - test_create_by_product_id" );
}

sub test_create_by_product_name {
    my $self = shift;
    
    my $product = get_rep('products');
    my $response = $proxy->call( "Environment.create", {
        product     => $product->{'name'},
        name        => 'API TEST BUILD ' . time(),
    });
    
    check_fault($response, $self);
    my $obj = Bugzilla::Testopia::Environment->new($response->result->{'environment_id'});
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Environment - test_create_by_product_name" );
}

sub test_get {
    my $self = shift;
    
    my $rep = get_rep('test_environments');
    my $obj = Bugzilla::Testopia::Environment->new($rep->{'environment_id'});
    $obj->product;
    
    my $response = $proxy->call( "Environment.get", $rep->{'environment_id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Environment - test_get" );
    
}

sub test_update {
    my $self = shift;
    
    my $rep = get_rep('test_environments');
    my $obj = Bugzilla::Testopia::Environment->new($rep->{'environment_id'});
    
    my $newname      = 'API UPDATE TEST '. time();
    my $newisactive  = $obj->isactive ? 0 : 1;
    
    $rep->{'name'}        = $newname;
    $rep->{'isactive'}    = $newisactive;
    
    my $response = $proxy->call( "Environment.update", $rep->{'environment_id'}, {
        name        => $newname,
        isactive    => $newisactive,
    } );
    
    # Get the newly updated object to compare with
    $obj = Bugzilla::Testopia::Environment->new($rep->{'environment_id'});
    $obj->product;
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Environment - test_update" );
    
}

sub test_get_caseruns {
    my $self = shift;
    
    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::Environment->new($rep->{'environment_id'});
    $obj->product;
    
    my $response = $proxy->call( "Environment.get_caseruns", $rep->{'environment_id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->caseruns;
    convert_undef($list);
    
    cmp_deeply($response->result, noclass($list), "Environment - test_get_caseruns" );
}

sub test_get_runs {
    my $self = shift;
    
    my $rep = get_rep('test_runs');
    my $obj = Bugzilla::Testopia::Environment->new($rep->{'environment_id'});
    $obj->product;
    
    my $response = $proxy->call( "Environment.get_runs", $rep->{'environment_id'} );

    check_fault($response, $self);

    my $list = $obj->runs;
    convert_undef($list);

    cmp_deeply($response->result, noclass($list), "Environment - test_get_runs" );
}

sub test_list {
    my $self = shift;
    
    my $cgi = Bugzilla->cgi;
    $cgi->param("current_tab", "environment");
    $cgi->param("pagesize", 25);
    
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new('environment', 'tr_xmlrpc.cgi',$cgi,undef, $search->query());
    
    my $response = $proxy->call( "Environment.list", {
        pagesize    => 25,
    } );
    
    convert_undef($table->list);

    check_fault($response, $self);
    cmp_deeply( $response->result, noclass($table->list), "Environment - test_list" );
    
}

1;


__END__
