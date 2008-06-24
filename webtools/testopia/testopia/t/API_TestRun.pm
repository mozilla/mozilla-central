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

package API_TestRun;

use strict;

use base qw(Test::Unit::TestCase);

use lib ".";
use lib "../..";

use Bugzilla;
use Bugzilla::Testopia::TestRun;
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

    my $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    while (scalar @{ $plan->test_cases } == 0
        || scalar @{ $plan->product->environments } == 0
        || scalar @{ $plan->product->builds } == 0 )
    {
        $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    }

    my @cases  = @{ $plan->test_cases };
    my @builds = @{ $plan->product->builds };
    my @envs   = @{ $plan->product->environments };

    my $case  = $cases[ int( rand( scalar @cases ) ) ];
    my $build = $builds[ int( rand( scalar @builds ) ) ];
    my $env   = $envs[ int( rand( scalar @envs ) ) ];

    my $response = $proxy->call(
        "TestRun.create",
        {
            plan_id           => $plan->{'plan_id'},
            build             => $build->{'build_id'},
            environment       => $env->{'environment_id'},
            manager           => get_rep('profiles')->{'userid'},
            summary           => 'API TEST RUN CREATE ' . time(),
            product_version   => $plan->product_version,
            plan_text_version => $plan->version,
            notes             => 'API TEST RUN NOTES' . time(),
            status            => 1,
            cases             => [ get_rep('test_cases')->{'case_id'}, get_rep('test_cases')->{'case_id'} ],
        }
    );

    check_fault( $response, $self );

    my $obj = Bugzilla::Testopia::TestRun->new( $response->result->{'run_id'} );
    $obj->build;

    convert_undef($obj);

#        dump_all($response->result, $obj);
    cmp_deeply( $response->result, noclass($obj), "TestRun - test_create_by_id" );
}

sub test_create_by_string {
    my $self = shift;

    my $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    while (scalar @{ $plan->test_cases } == 0
        || scalar @{ $plan->product->environments } == 0
        || scalar @{ $plan->product->builds } == 0 )
    {
        $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    }

    my @cases  = @{ $plan->test_cases };
    my @builds = @{ $plan->product->builds };
    my @envs   = @{ $plan->product->environments };

    my $case  = $cases[ int( rand( scalar @cases ) ) ];
    my $build = $builds[ int( rand( scalar @builds ) ) ];
    my $env   = $envs[ int( rand( scalar @envs ) ) ];

    my $response = $proxy->call(
        "TestRun.create",
        {
            plan_id           => $plan->{'plan_id'},
            build             => $build->{'name'},
            environment       => $env->{'name'},
            manager           => get_rep('profiles')->{'login_name'},
            summary           => 'API TEST RUN CREATE ' . time(),
        }
    );

    check_fault( $response, $self );

    my $obj = Bugzilla::Testopia::TestRun->new( $response->result->{'run_id'} );

    convert_undef($obj);

#        dump_all($response->result, $obj);
    cmp_deeply( $response->result, noclass($obj), "TestRun - test_create_by_string" );
}

sub test_get {
    my $self = shift;

    my $rep = get_rep('test_runs');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );
    $obj->{'case_count'} = $obj->case_count();

    convert_undef($obj);

    my $response = $proxy->call( "TestRun.get", $rep->{'run_id'} );

    check_fault( $response, $self );

    #    dump_all($response->result, $obj);
    cmp_deeply( $response->result, noclass($obj), "TestRun - test_get" );

}

sub test_add_cases {
    my $self = shift;

    my $response = $proxy->call( "TestRun.add_cases", 
        [get_rep('test_cases')->{'case_id'}, get_rep('test_cases')->{'case_id'}],
        [get_rep('test_runs')->{'run_id'}] 
    );

    check_fault( $response, $self );

#        dump_all($response->result, $obj);
    ok( scalar @{$response->result} == 0, "TestRun - test_add_cases" );

}

sub test_update {
    my $self = shift;

    my $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    while (scalar @{ $plan->test_cases } == 0
        || scalar @{ $plan->product->environments } == 0
        || scalar @{ $plan->product->builds } == 0 )
    {
        $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    }

    my @cases    = @{ $plan->test_cases };
    my @builds   = @{ $plan->product->builds };
    my @envs     = @{ $plan->product->environments };
    my @versions = @{ $plan->product->versions };

    my $case    = $cases[ int( rand( scalar @cases ) ) ];
    my $build   = $builds[ int( rand( scalar @builds ) ) ];
    my $env     = $envs[ int( rand( scalar @envs ) ) ];
    my $version = $versions[ int( rand( scalar @versions ) ) ];

    my $rep = get_rep('test_runs');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    my $response = $proxy->call(
        "TestRun.update",
        $rep->{'run_id'},
        {
            plan_id           => $plan->{'plan_id'},
            build             => $build->{'build_id'},
            environment       => $env->{'environment_id'},
            manager           => get_rep('profiles')->{'userid'},
            summary           => 'API TEST RUN UPDATE ' . time(),
            product_version   => $version->{'value'},
            plan_text_version => $plan->version,
            notes             => 'API TEST RUN NOTES' . time(),
            status            => 1,
        }
    );

    # Get the newly updated object to compare with
    $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    convert_undef($obj);

    check_fault( $response, $self );
    cmp_deeply( $response->result, noclass($obj), "TestRun - test_update" );

}

sub test_list {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param( "current_tab",       "run" );
    $cgi->param( "pagesize",          25 );
    $cgi->param( 'distinct',          1 );
    $cgi->param( "Bugzilla_login",    LOGIN_CREDENTIALS->{'admin'}->{'login_name'} );
    $cgi->param( "Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'} );

    Bugzilla->login();

    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table =
      Bugzilla::Testopia::Table->new( 'run', 'tr_xmlrpc.cgi', $cgi, undef, $search->query() );

    convert_undef( $table->list );

    my $response = $proxy->call( "TestRun.list", { pagesize => 25, } );

    check_fault( $response, $self );
    cmp_deeply( $response->result, noclass( $table->list ), "TestRun - test_list" );

}

sub test_add_tag {
    my $self = shift;

    my $rep       = get_rep('test_runs');
    my $obj       = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );
    my $orig_size = scalar @{ $obj->tags };
    delete $obj->{'tags'};

    my $tag = get_rep('test_tags');

    my $response = $proxy->call( "TestRun.add_tag", $rep->{'run_id'}, $tag->{'tag_name'} );

    check_fault( $response, $self );

    #    dump_all($tag, $obj->tags);
    ok( scalar @{ $obj->tags } == ( $orig_size + 1 ), "TestRun - test_add_tag" );

}

sub test_get_bugs {
    my $self = shift;

    my $rep = get_rep('test_case_bugs');
    while ( !$rep->{'case_run_id'} ) {
        $rep = get_rep('test_case_bugs');
    }
    my $cr  = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );
    my $obj = Bugzilla::Testopia::TestRun->new( $cr->run_id );

    my $response = $proxy->call( "TestRun.get_bugs", $cr->run_id );

    check_fault( $response, $self );
    my $list = $obj->bugs;
    convert_undef($list);

    #    dump_all($obj->bugs, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestRun - test_get_bugs" );

}

sub test_get_change_history {
    my $self = shift;

    my $rep = get_rep('test_run_activity');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    my $response = $proxy->call( "TestRun.get_change_history", $rep->{'run_id'} );

    check_fault( $response, $self );
    my $list = $obj->history;
    convert_undef($list);

#   dump_all($list, $response->result);
    cmp_deeply( $response->result, $list, "TestRun - test_get_change_history" );

}

sub test_get_completion_report {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    my $response = $proxy->call( "TestRun.get_completion_report", $rep->{'run_id'} );

    check_fault( $response, $self );

    #    dump_all($obj, $response->result);
    isa_ok( $response->result, 'HASH', "TestRun - test_get_completion_report" );
}

sub test_get_tags {
    my $self = shift;

    my $rep = get_rep('test_run_tags');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    my $response = $proxy->call( "TestRun.get_tags", $rep->{'run_id'} );

    check_fault( $response, $self );

    my @results;
    foreach my $tag ( @{ $obj->tags } ) {
        push @results, $tag->name;
    }

    #    dump_all(\@results, $response->result);
    cmp_deeply( $response->result, \@results, "TestRun - test_get_tags" );

}

sub test_get_test_case_runs {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    my $response = $proxy->call( "TestRun.get_test_case_runs", $rep->{'run_id'} );

    check_fault( $response, $self );
    
    my $list = $obj->caseruns;
    convert_undef($list);

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestRun - test_get_test_case_runs" );

}

sub test_get_test_cases {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    my $response = $proxy->call( "TestRun.get_test_cases", $rep->{'run_id'} );

    check_fault( $response, $self );
    
    my $list = $obj->cases;
    convert_undef($list);
    
    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass( $list ), "TestRun - test_get_test_cases" );

}

sub test_get_test_plan {
    my $self = shift;

    my $rep = get_rep('test_runs');
    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );

    my $response = $proxy->call( "TestRun.get_test_plan", $rep->{'run_id'} );

    check_fault( $response, $self );

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass( $obj->plan ), "TestRun - test_get_test_plan" );

}

sub test_remove_tag {
    my $self = shift;

    my $rep = get_rep('test_runs');

    my $obj = Bugzilla::Testopia::TestRun->new( $rep->{'run_id'} );
    $obj->add_tag('API TAG');
    delete $obj->{'tags'};
    my $orig_size = scalar @{ $obj->tags };
    delete $obj->{'tags'};

    my $response = $proxy->call( "TestRun.remove_tag", $rep->{'run_id'}, 'API TAG' );

    check_fault( $response, $self );

    #    dump_all($rep, $obj->tags);
    ok( scalar @{ $obj->tags } == ( $orig_size - 1 ), "TestRun - test_remove_tag" );
}

1;

__END__
