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

package API_TestCase;

use strict;

use base qw(Test::Unit::TestCase);

use lib ".";
use lib "../..";

use Bugzilla;
use Bugzilla::Testopia::TestCase;
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

sub test_create_by_arrays {
    my $self = shift;

    my $plan  = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    my $plan2 = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    while ( $plan2->id == $plan->id ) {
        $plan2 = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    }
    my @time = localtime();

    my $response = $proxy->call(
        "TestCase.create",
        {
            status         => get_rep('test_case_status')->{'case_status_id'},
            category       => get_rep('test_case_categories')->{'category_id'},
            priority       => get_rep('priority')->{'id'},
            summary        => 'API TEST CREATE ' . time(),
            plans          => [ $plan->id, $plan2->id ],
            default_tester => get_rep('profiles')->{'userid'},
            estimated_time => "$time[2]:$time[1]:$time[0]",
            isautomated    => 1,
            sortkey        => 200,
            script         => 'API FOO SCRIPT',
            arguments      => '-A -P -I',
            requirement    => 'API REQUIREMENT',
            alias          => 'API ALIAS ' . rand(),
            action         => 'API ACTON CREATE',
            effect         => 'API RESULT CREATE',
            setup          => 'API SETUP CREATE',
            breakdown      => 'API BREAKDOWN CREATE',
            dependson      => [
                get_rep('test_cases')->{'case_id'},
                get_rep('test_cases')->{'case_id'}
            ],
            blocks => [
                get_rep('test_cases')->{'case_id'},
                get_rep('test_cases')->{'case_id'}
            ],
            tags => [ 'one', 'two', 'three' ],
            bugs =>
              [ get_rep('bugs')->{'bug_id'}, get_rep('bugs')->{'bug_id'} ],
            components =>
              [ get_rep('components')->{'id'}, get_rep('components')->{'id'} ],
        }
    );

    check_fault( $response, $self );
    my $obj = Bugzilla::Testopia::TestCase->new( $response->result->{'case_id'} );
    $obj->type;
    $obj->version;
    
    convert_undef($obj);

    cmp_deeply( $response->result, noclass($obj), "TestCase - test_create_by_arrays" );
}

sub test_create_by_strings {
    my $self = shift;

    my $plan  = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    my $plan2 = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    while ( $plan2->id == $plan->id ) {
        $plan2 = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    }
    my @time = localtime();
    my $category = get_rep('test_case_categories');
    my $component = get_rep('components');
    
    my $response = $proxy->call(
        "TestCase.create",
        {
            status         => get_rep('test_case_status')->{'name'},
            category       => {category => $category->{'name'}, 
                               product => Bugzilla::Testopia::Product->new($category->{'product_id'})->name},
            priority       => get_rep('priority')->{'value'},
            summary        => 'API TEST CREATE ' . time(),
            plans          => "" . $plan->id .",". $plan2->id ,
            default_tester => get_rep('profiles')->{'login_name'},
            estimated_time => "$time[2]:$time[1]:$time[0]",
            isautomated    => 1,
            sortkey        => 200,
            script         => 'API FOO SCRIPT',
            arguments      => '-A -P -I',
            requirement    => 'API REQUIREMENT',
            alias          => 'API ALIAS ' . rand(),
            action         => 'API ACTON CREATE',
            effect         => 'API RESULT CREATE',
            setup          => 'API SETUP CREATE',
            breakdown      => 'API BREAKDOWN CREATE',
            dependson      => [
                get_rep('test_cases')->{'case_id'},
                get_rep('test_cases')->{'case_id'}
            ],
            blocks => [
                get_rep('test_cases')->{'case_id'},
                get_rep('test_cases')->{'case_id'}
            ],
            tags =>  'one, two, three' ,
            bugs =>
              [ get_rep('bugs')->{'bug_id'}, get_rep('bugs')->{'bug_id'} ],
            components =>
              [ {component => $component->{'name'}, 
                  product => Bugzilla::Testopia::Product->new($component->{'product_id'})->name}, 
              ],
        }
    );
    check_fault( $response, $self );
    my $obj = Bugzilla::Testopia::TestCase->new( $response->result->{'case_id'} );
    $obj->type;
    $obj->version;
    
    convert_undef($obj);
#    dump_all($response->result, $obj);
    cmp_deeply( $response->result, noclass($obj), "TestCase - test_create_by_strings" );
}

sub test_get {
    my $self = shift;

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    $obj->text;
    $obj->version;

    my $response = $proxy->call( "TestCase.get", $rep->{'case_id'} );
    
    check_fault( $response, $self );
    
    convert_undef($obj);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestCase - test_get" );

}

sub test_update {
    my $self = shift;

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $category = get_rep('test_case_categories');
    
    my $response = $proxy->call(
        "TestCase.update",
        $rep->{'case_id'},
        {
            status         => get_rep('test_case_status')->{'name'},
            category       => {category => $category->{'name'}, 
                               product => Bugzilla::Testopia::Product->new($category->{'product_id'})->name},
            priority       => get_rep('priority')->{'value'},
            summary        => 'API TEST UPDATE ' . time(),
            default_tester => get_rep('profiles')->{'login_name'},
            estimated_time => "02:02:02",
            isautomated    => 1,
            sortkey        => 200,
            script         => 'API FOO SCRIPT',
            arguments      => '-A -P -I',
            requirement    => 'API REQUIREMENT',
            alias          => 'API ALIAS ' . rand(),
            dependson      => [
                get_rep('test_cases')->{'case_id'},
                get_rep('test_cases')->{'case_id'}
            ],
            blocks => [
                get_rep('test_cases')->{'case_id'},
                get_rep('test_cases')->{'case_id'}
            ],
        }
    );

    # Get the newly updated object to compare with
    $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    $obj->dependson_list;
    $obj->blocked_list;
    
    check_fault( $response, $self );
    
    convert_undef($obj);
    
#    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestCase - test_update" );

}

sub test_list {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    
    $cgi->param( 'current_tab', 'case' );
    $cgi->param( 'pagesize',    25 );
    $cgi->param( 'distinct', 1);
    $cgi->param("Bugzilla_login", LOGIN_CREDENTIALS->{'admin'}->{'login_name'});
    $cgi->param("Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'});

    Bugzilla->login();
    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table =
      Bugzilla::Testopia::Table->new( 'case', 'tr_xmlrpc.cgi', $cgi, undef,
        $search->query() );

    my $response = $proxy->call( "TestCase.list", { pagesize => 25, } );
    check_fault( $response, $self );
    
    convert_undef($table->list);
    
#    dump_all($table->list, $response->result);
    cmp_deeply( $response->result, noclass( $table->list ), "TestCase - test_list" );

}

sub test_add_component {
    my $self = shift;

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    my $orig_size = scalar @{$obj->components};
    delete $obj->{'components'};
    
    my $component = get_rep('components');

    my $response = $proxy->call( "TestCase.add_component", $rep->{'case_id'}, 
        {component => $component->{'name'}, 
           product => Bugzilla::Testopia::Product->new($component->{'product_id'})->name} );

    check_fault( $response, $self );
    
#    dump_all($component, $obj->components);
    ok( scalar @{$obj->components} == ($orig_size + 1), "TestCase - test_add_component" );
}

sub test_add_tag {
    my $self = shift;

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    my $orig_size = scalar @{$obj->tags};
    delete $obj->{'tags'};
    
    my $tag = get_rep('test_tags');

    my $response = $proxy->call( "TestCase.add_tag", $rep->{'case_id'}, $tag->{'tag_name'} );

    check_fault( $response, $self );

#    dump_all($tag, $obj->tags);
    ok( scalar @{$obj->tags} == ($orig_size + 1), "TestCase - test_add_tag" );
    
}

sub test_add_to_run {
    my $self = shift;

    my $rep = get_rep('test_cases');
    while ( $rep->{'case_status_id'} != 2 ){
        $rep = get_rep('test_cases');
    }
    my $run = get_rep('test_runs');
    while ( $run->{'stop_date'} ){
        $run = get_rep('test_runs');
    }
    
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    my $orig_size = $obj->run_count;
    
    my $tag = get_rep('test_tags');

    my $response = $proxy->call( "TestCase.add_to_run", $rep->{'case_id'}, $run->{'run_id'} );

    check_fault( $response, $self );

#    dump_all($tag, $obj->tags);
    ok( $obj->run_count == ($orig_size + 1), "TestCase - test_add_to_run" );

}

sub test_attach_bug {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param("Bugzilla_login", LOGIN_CREDENTIALS->{'admin'}->{'login_name'});
    $cgi->param("Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'});

    Bugzilla->login();

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    my $orig_size = scalar @{$obj->bugs};
    delete $obj->{'bugs'};
    
    my $bug = get_rep('bugs');

    my $response = $proxy->call( "TestCase.attach_bug", $rep->{'case_id'}, $bug->{'bug_id'} );

    check_fault( $response, $self );

#    dump_all($bug, $obj->bugs);
    ok( scalar @{$obj->bugs} == ($orig_size + 1), "TestCase - test_attach_bug" );

}

sub test_calculate_average_time {
    my $self = shift;

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.calculate_average_time", $rep->{'case_id'} );

    check_fault( $response, $self );
    
#    dump_all($obj->calculate_average_time, $response->result);
    cmp_deeply( $response->result, noclass($obj->calculate_average_time), "TestCase - test_calculate_average_time" );

}

sub test_detach_bug {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param("Bugzilla_login", LOGIN_CREDENTIALS->{'admin'}->{'login_name'});
    $cgi->param("Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'});

    Bugzilla->login();
    
    my $rep = get_rep('test_cases');
    my $bug = get_rep('bugs');
    
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    $obj->attach_bug($bug->{'bug_id'});
    delete $obj->{'bugs'};
    my $orig_size = scalar @{$obj->bugs};
    delete $obj->{'bugs'};
    
    my $response = $proxy->call( "TestCase.detach_bug", $rep->{'case_id'}, $bug->{'bug_id'} );

    check_fault( $response, $self );

#    dump_all($bug, $obj->bugs);
    ok( scalar @{$obj->bugs} == ($orig_size - 1), "TestCase - test_detach_bug" );

}

sub test_get_bugs {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param("Bugzilla_login", LOGIN_CREDENTIALS->{'admin'}->{'login_name'});
    $cgi->param("Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'});

    Bugzilla->login();

    my $rep = get_rep('test_case_bugs');

    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.get_bugs", $rep->{'case_id'} );

    check_fault( $response, $self );
    
    my $list = $obj->bugs;
    convert_undef($list);
    
#    dump_all($obj->bugs, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestCase - test_get_bugs" );
    
}

sub test_get_case_run_history {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.get_case_run_history", $rep->{'case_id'} );

    check_fault( $response, $self );

    my $list = $obj->caseruns;
    convert_undef($list);

#    dump_all($obj->get_case_run_history, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestCase - test_get_case_run_history" );

}

sub test_get_change_history {
    my $self = shift;

    my $rep = get_rep('test_case_activity');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.get_change_history", $rep->{'case_id'} );

    check_fault( $response, $self );

    my $list = $obj->history;
    convert_undef($list);

#    dump_all($obj->history, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestCase - test_get_change_history" );

}

sub test_get_components {
    my $self = shift;

    my $rep = get_rep('test_case_components');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.get_components", $rep->{'case_id'} );

    check_fault( $response, $self );

    my $list = $obj->components;
    convert_undef($list);

#    dump_all($obj->get_components, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestCase - test_get_components" );
    
}

sub test_get_plans {
    my $self = shift;

    my $rep = get_rep('test_case_plans');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.get_plans", $rep->{'case_id'} );

    check_fault( $response, $self );
    
    my $list = $obj->plans;
    convert_undef($list);

#    dump_all($obj->plans, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestCase - test_get_plans" );

}

sub test_get_tags {
    my $self = shift;

    my $rep = get_rep('test_case_tags');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.get_tags", $rep->{'case_id'} );

    check_fault( $response, $self );
    
    my @results;
    foreach my $tag (@{$obj->tags}){
        push @results, $tag->name;
    }
#    dump_all($obj->get_tags, $response->result);
    cmp_deeply( $response->result, \@results, "TestCase - test_get_tags" );

}

sub test_get_text {
    my $self = shift;

    my $rep = get_rep('test_case_texts');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.get_text", $rep->{'case_id'} );

    check_fault( $response, $self );

    my $list = $obj->text;
    convert_undef($list);

#    dump_all($obj->get_text, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestCase - test_get_text" );
}

sub test_link_plan {
    my $self = shift;

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    my $orig_size = scalar @{$obj->plans};
    delete $obj->{'plans'};
    
    my $plan = get_rep('test_plans');

    my $response = $proxy->call( "TestCase.link_plan", $rep->{'case_id'}, $plan->{'plan_id'} );

    check_fault( $response, $self );

#    dump_all($tag, $obj->tags);
    ok( scalar @{$obj->plans} == ($orig_size + 1), "TestCase - test_link_plan" );

}

sub test_lookup_priority_id_by_name {
    my $self = shift;

    my $rep = get_rep('priority');

    my $response = $proxy->call( "TestCase.lookup_priority_id_by_name", $rep->{'value'} );

    check_fault( $response, $self );
    
#    dump_all($rep, $response->result);
    cmp_deeply( $response->result, lookup_priority_by_value($rep->{'value'}), "TestCase - lookup_priority_id_by_name" );

}

sub test_lookup_priority_name_by_id {
    my $self = shift;

    my $rep = get_rep('priority');

    my $response = $proxy->call( "TestCase.lookup_priority_name_by_id", $rep->{'id'} );

    check_fault( $response, $self );
    
#    dump_all($rep, $response->result);
    cmp_deeply( $response->result, lookup_priority($rep->{'id'}), "TestCase - lookup_priority_name_by_id" );

}

sub test_lookup_status_id_by_name {
    my $self = shift;

    my $rep = get_rep('test_case_status');

    my $response = $proxy->call( "TestCase.lookup_status_id_by_name", $rep->{'name'} );

    check_fault( $response, $self );
    
#    dump_all(lookup_status_by_name($rep->{'name'}), $response->result);
    cmp_deeply( $response->result, lookup_status_by_name($rep->{'name'}), "TestCase - lookup_status_id_by_name" );

}

sub test_lookup_status_name_by_id {
    my $self = shift;

    my $rep = get_rep('test_case_status');

    my $response = $proxy->call( "TestCase.lookup_status_name_by_id", $rep->{'case_status_id'} );

    check_fault( $response, $self );
    
#    dump_all($rep, $response->result);
    cmp_deeply( $response->result, lookup_status($rep->{'case_status_id'}), "TestCase - lookup_status_name_by_id" );

}

sub test_remove_component {
    my $self = shift;
    
    my $rep = get_rep('test_case_components');
    
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    my $orig_size = scalar @{$obj->components};
    delete $obj->{'components'};
    
    my $response = $proxy->call( "TestCase.remove_component", $rep->{'case_id'}, $rep->{'component_id'} );

    check_fault( $response, $self );

#    dump_all($rep, $obj->components);
    ok( scalar @{$obj->components} == ($orig_size - 1), "TestCase - test_remove_component" );
}

sub test_remove_tag {
    my $self = shift;
    
    my $rep = get_rep('test_case_tags');
    
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    my $tag = Bugzilla::Testopia::TestTag->new( $rep->{'tag_id'} );
    
    my $orig_size = scalar @{$obj->tags};
    delete $obj->{'tags'};
    
    my $response = $proxy->call( "TestCase.remove_tag", $rep->{'case_id'}, $tag->name );

    check_fault( $response, $self );

#    dump_all($rep, $obj->tags);
    ok( scalar @{$obj->tags} == ($orig_size - 1), "TestCase - test_remove_tag" );
}

sub test_store_text {
    my $self = shift;

    my $rep = get_rep('test_cases');
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );

    my $response = $proxy->call( "TestCase.store_text", $rep->{'case_id'},
        "API ACTION UPDATE TEST",
        "API RESULTS UPDATE TEST",
        "API SETUP UPDATE TEST",
        "API BREAKDOWN UPDATE TEST" );

    check_fault( $response, $self );
    
#    dump_all($obj->version, $response->result);
    cmp_deeply( $response->result, noclass($obj->version), "TestCase - test_store_text" );

}

sub test_unlink_plan {
    my $self = shift;
    
    my $plan = get_rep('test_plans');
    my $rep = get_rep('test_cases');
    
    my $obj = Bugzilla::Testopia::TestCase->new( $rep->{'case_id'} );
    $obj->link_plan($plan->{'plan_id'});
    delete $obj->{'plans'};
    my $orig_size = scalar @{$obj->plans};
    delete $obj->{'plans'};
    
    my $response = $proxy->call( "TestCase.unlink_plan", $rep->{'case_id'}, $plan->{'plan_id'} );

    check_fault( $response, $self );

#    dump_all($rep, $obj->plans);
    ok( scalar @{$obj->plans} == ($orig_size - 1), "TestCase - test_unlink_plan" );

}

1;

__END__
