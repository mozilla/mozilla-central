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

package API_TestPlan;

use strict;

use base qw(Test::Unit::TestCase);

use lib ".";
use lib "../..";

use Bugzilla;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;

use Testopia::Test::Constants;
use Testopia::Test::API::Util;
use Testopia::Test::Util;

use Test::More;
use Test::Deep;

# The the XMLRPC::Lite proxy handle
our $proxy = proxy( LOGIN_CREDENTIALS->{'admin'} );

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

sub test_create_by_id {
    my $self = shift;

    my $product  = Bugzilla::Testopia::Product->new( get_rep('products')->{'id'} );
    my @versions = @{ $product->versions };
    my $version  = $versions[ int( rand( scalar @versions ) ) ];

    my $response = $proxy->call(
        "TestPlan.create",
        {
            product                 => $product->{'id'},
            name                    => 'API TEST PLAN ' . time(),
            type                    => get_rep('test_plan_types')->{'type_id'},
            default_product_version => $version->{'name'},
            isactive                => 1,
        }
    );

    check_fault( $response, $self );

    my $obj = Bugzilla::Testopia::TestPlan->new( $response->result->{'plan_id'} );
    $obj->version;

    convert_undef($obj);

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestPlan - test_create_by_id" );
}

sub test_create_by_string {
    my $self = shift;

    my $product  = Bugzilla::Testopia::Product->new( get_rep('products')->{'id'} );
    my @versions = @{ $product->versions };
    my $version  = $versions[ int( rand( scalar @versions ) ) ];

    my $response = $proxy->call(
        "TestPlan.create",
        {
            product                 => $product->{'name'},
            name                    => 'API TEST PLAN ' . time(),
            type                    => get_rep('test_plan_types')->{'name'},
            default_product_version => $version->{'name'},
        }
    );

    check_fault( $response, $self );

    my $obj = Bugzilla::Testopia::TestPlan->new( $response->result->{'plan_id'} );
    $obj->version;

    convert_undef($obj);

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestPlan - test_create_by_string" );
}

sub test_get {
    my $self = shift;

    my $rep = get_rep('test_plans');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );
    $obj->product;

    my $response = $proxy->call( "TestPlan.get", $rep->{'plan_id'} );

    check_fault( $response, $self );
    $obj->test_case_count;
    $obj->test_run_count;

    delete $obj->{'product'};

    convert_undef($obj);

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestPlan - test_get" );

}

sub test_update {
    my $self = shift;

    my $rep = get_rep('test_plans');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );

    my @versions = @{ $obj->product->versions };
    my $version  = $versions[ int( rand( scalar @versions ) ) ];

    my $response = $proxy->call(
        "TestPlan.update",
        $rep->{'plan_id'},
        {
            name                    => 'API TEST PLAN ' . time(),
            type                    => get_rep('test_plan_types')->{'name'},
            default_product_version => $version->{'name'},
            isactive                => 0,
        }
    );

    # Get the newly updated object to compare with
    $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );
    $obj->product;

    check_fault( $response, $self );

    convert_undef($obj);

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestPlan - test_update" );

}

sub test_get_test_cases {
    my $self = shift;

    my $rep = get_rep('test_case_plans');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );
    $obj->product;

    my $response = $proxy->call( "TestPlan.get_test_cases", $rep->{'plan_id'} );

    check_fault( $response, $self );

    my $list = $obj->test_cases;
    convert_undef($list);

    #    dump_all($obj->test_cases, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestPlan - test_get_test_cases" );

}

sub test_get_test_runs {
    my $self = shift;

    my $rep = get_rep('test_runs');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );
    $obj->product;

    my $response = $proxy->call( "TestPlan.get_test_runs", $rep->{'plan_id'} );

    check_fault( $response, $self );

    my $list = $obj->test_runs;
    convert_undef($list);

    #    dump_all($obj->test_runs, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestPlan - test_get_test_runs" );
}

sub test_list {
    my $self = shift;

    my $cgi = Bugzilla->cgi;

    $cgi->param( 'current_tab',       'plan' );
    $cgi->param( 'pagesize',          25 );
    $cgi->param( 'distinct',          1 );
    $cgi->param( "Bugzilla_login",    LOGIN_CREDENTIALS->{'admin'}->{'login_name'} );
    $cgi->param( "Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'} );

    Bugzilla->login();

    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new( 'plan', 'tr_xmlrpc.cgi', $cgi, undef, $search->query() );

    my $response = $proxy->call( "TestPlan.list", { pagesize => 25, } );

    check_fault( $response, $self );

    convert_undef( $table->list );

    #    dump_all($table->list, $response->result);
    cmp_deeply( $response->result, noclass( $table->list ), "TestPlan - test_list" );

}

sub test_add_tag {
    my $self = shift;

    my $rep       = get_rep('test_plans');
    my $obj       = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );
    my $orig_size = scalar @{ $obj->tags };
    delete $obj->{'tags'};

    my $tag = get_rep('test_tags');

    my $response = $proxy->call( "TestPlan.add_tag", $rep->{'plan_id'}, $tag->{'tag_name'} );

    check_fault( $response, $self );

    #    dump_all($tag, $obj->tags);
    ok( scalar @{ $obj->tags } == ( $orig_size + 1 ), "TestPlan - test_add_tag" );

}

sub test_get_change_history {
    my $self = shift;

    my $rep = get_rep('test_plan_activity');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );

    my $response = $proxy->call( "TestPlan.get_change_history", $rep->{'plan_id'} );

    check_fault( $response, $self );

    my $list = $obj->history;
    convert_undef($list);

    #    dump_all($obj->history, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestPlan - test_get_change_history" );

}

sub test_get_product {
    my $self = shift;

    my $rep = get_rep('test_plans');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );

    my $response = $proxy->call( "TestPlan.get_product", $rep->{'plan_id'} );

    check_fault( $response, $self );

    my $item = $obj->product;
    convert_undef($item);

    #    dump_all($response->result,$obj->product);
    cmp_deeply( $response->result, noclass($item), "TestPlan - test_get_product" );

}

sub test_get_tags {
    my $self = shift;

    my $rep = get_rep('test_plan_tags');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );

    my $response = $proxy->call( "TestPlan.get_tags", $rep->{'plan_id'} );

    check_fault( $response, $self );

    my @results;
    foreach my $tag ( @{ $obj->tags } ) {
        push @results, $tag->name;
    }

    #    dump_all($obj->get_tags, $response->result);
    cmp_deeply( $response->result, \@results, "TestPlan - test_get_tags" );

}

sub test_get_text {
    my $self = shift;

    my $rep = get_rep('test_plan_texts');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );

    my $response = $proxy->call( "TestPlan.get_text", $rep->{'plan_id'} );

    check_fault( $response, $self );

    my $item = $obj->text;
    convert_undef($item);

    #    dump_all($response->result,$obj->text);
    cmp_deeply( $response->result, $item, "TestPlan - test_get_text" );
}

sub test_lookup_type_id_by_name {
    my $self = shift;

    my $rep = get_rep('test_plan_types');

    my $response = $proxy->call( "TestPlan.lookup_type_id_by_name", $rep->{'name'} );

    check_fault( $response, $self );

    #    dump_all(lookup_type_by_name($rep->{'name'}), $response->result);
    cmp_deeply( $response->result, lookup_type_by_name( $rep->{'name'} ), "TestPlan - lookup_type_id_by_name" );

}

sub test_lookup_type_name_by_id {
    my $self = shift;

    my $rep = get_rep('test_plan_types');

    my $response = $proxy->call( "TestPlan.lookup_type_name_by_id", $rep->{'type_id'} );

    check_fault( $response, $self );

    #    dump_all($rep, $response->result);
    cmp_deeply( $response->result, lookup_type( $rep->{'type_id'} ), "TestPlan - lookup_type_name_by_id" );

}

sub test_remove_tag {
    my $self = shift;

    my $rep = get_rep('test_plans');

    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );
    $obj->add_tag('API TAG');
    delete $obj->{'tags'};
    my $orig_size = scalar @{ $obj->tags };
    delete $obj->{'tags'};

    my $response = $proxy->call( "TestPlan.remove_tag", $rep->{'plan_id'}, 'API TAG' );

    check_fault( $response, $self );

    #    dump_all($rep, $obj->tags);
    ok( scalar @{ $obj->tags } == ( $orig_size - 1 ), "TestPlan - test_remove_tag" );
}

sub test_store_text {
    my $self = shift;

    my $rep = get_rep('test_plans');
    my $obj = Bugzilla::Testopia::TestPlan->new( $rep->{'plan_id'} );

    my $response = $proxy->call( "TestPlan.store_text", $rep->{'plan_id'}, "API DOCUMENT UPDATE TEST" );

    check_fault( $response, $self );

    #    dump_all($obj->version, $response->result);
    cmp_deeply( $response->result, $obj->version, "TestPlan - test_store_text" );

}

1;

__END__
