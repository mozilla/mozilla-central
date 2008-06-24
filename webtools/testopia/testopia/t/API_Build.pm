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

package API_Build;

use strict;

use base qw(Test::Unit::TestCase);

use lib "..";
use lib "../..";

use Bugzilla::Testopia::Build;

use Testopia::Test::Constants;
use Testopia::Test::API::Util;
use Testopia::Test::Util;

use Test::More tests => 8;
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

sub test_check_build_by_product_id {
    my $self = shift;

    my $rep = Testopia::Test::Util::get_rep('test_builds');
    my $obj = Bugzilla::Testopia::Build->new($rep->{'build_id'});
    
    my $response = $proxy->call( "Build.check_build", $rep->{'name'}, $rep->{'product_id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Build - test_check_build_by_product_id" ); 
}

sub test_check_build_by_product_name {
    my $self = shift;

    my $rep = get_rep('test_builds');
    my $obj = Bugzilla::Testopia::Build->new($rep->{'build_id'});
    
    my $response = $proxy->call( "Build.check_build", $rep->{'name'}, $obj->product->name );
    
    # Calling $obj->product above places a product object into the hash
    # Remove product from the hash as it will cause it to fail.
    delete $obj->{'product'};
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Build - test_check_build_by_product_name" ); 
}

sub test_create_by_product_id {
    my $self = shift;
    
    my $product = get_rep('products');
    
    my $response = $proxy->call( "Build.create", {
        product     => $product->{'id'},
        name        => 'API TEST BUILD ' . time(),
        milestone   => $product->{'defaultmilestone'},
        description => 'API TEST',
        isactive    => 1,
    });
    
    check_fault($response, $self);
    my $obj = Bugzilla::Testopia::Build->new($response->result->{'build_id'});
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Build - test_create_by_product_id" );
}

sub test_create_by_product_name {
    my $self = shift;
    
    my $product = get_rep('products');
    my $response = $proxy->call( "Build.create", {
        product     => $product->{'name'},
        name        => 'API TEST BUILD ' . time(),
        milestone   => $product->{'defaultmilestone'},
        description => 'API TEST',
        isactive    => 1,
    });
    
    check_fault($response, $self);
    my $obj = Bugzilla::Testopia::Build->new($response->result->{'build_id'});
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Build - test_create_by_product_name" );
}

sub test_get {
    my $self = shift;
    
    my $rep = get_rep('test_builds');
    my $obj = Bugzilla::Testopia::Build->new($rep->{'build_id'});
    $obj->product;
    $obj->run_count;
    
    my $response = $proxy->call( "Build.get", $rep->{'build_id'} );
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Build - test_get" );
    
}

sub test_get_caseruns {
    my $self = shift;
    
    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::Build->new($rep->{'build_id'});
    $obj->product;
    
    my $response = $proxy->call( "Build.get_caseruns", $rep->{'build_id'} );
    
    check_fault($response, $self);
    
    my $list = $obj->caseruns;
    convert_undef($list);
    
    cmp_deeply($response->result, noclass($list), "Build - test_get_caseruns" );
}

sub test_get_runs {
    my $self = shift;
    
    my $rep = get_rep('test_runs');
    my $obj = Bugzilla::Testopia::Build->new($rep->{'build_id'});
    $obj->product;
    
    my $response = $proxy->call( "Build.get_runs", $rep->{'build_id'} );

    check_fault($response, $self);
    
    my $list = $obj->runs;
    convert_undef($list);

    cmp_deeply($response->result, noclass($list), "Build - test_get_runs" );
}

sub test_update {
    my $self = shift;
    
    my $rep = get_rep('test_builds');
    my $obj = Bugzilla::Testopia::Build->new($rep->{'build_id'});
    
    my $newname      = 'API UPDATE TEST '. time();
    my $newmilestone = $obj->product->milestones->[1]->{'name'};
    my $newdesc      = 'DESCRIPTION '. $newname;
    my $newisactive  = $obj->isactive ? 0 : 1;
    
    $rep->{'name'}        = $newname;
    $rep->{'milestone'}   = $newmilestone;
    $rep->{'description'} = $newdesc;
    $rep->{'isactive'}    = $newisactive;
    
    my $response = $proxy->call( "Build.update", $rep->{'build_id'}, {
        name        => $newname,
        milestone   => $newmilestone,
        description => $newdesc,
        isactive    => $newisactive,
    } );
    
    # Get the newly updated object to compare with
    $obj = Bugzilla::Testopia::Build->new($rep->{'build_id'});
    $obj->product;
    
    check_fault($response, $self);
    
    convert_undef($obj);
    
    cmp_deeply( $response->result, noclass($obj), "Build - test_update" );
    
}

1;


__END__
