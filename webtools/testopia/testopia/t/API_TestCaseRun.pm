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

package API_TestCaseRun;

use strict;

use base qw(Test::Unit::TestCase);

use lib ".";
use lib "../..";

use Bugzilla;
use Bugzilla::Testopia::TestCaseRun;
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

sub test_create_by_integer {
    my $self = shift;

    my $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    while (scalar @{ $plan->test_runs } == 0
        || scalar @{ $plan->test_cases } == 0
        || scalar @{ $plan->product->environments } == 0
        || scalar @{ $plan->product->builds } == 0 )
    {
        $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    }

    my @runs   = @{ $plan->test_runs };
    my @cases  = @{ $plan->test_cases };
    my @builds = @{ $plan->product->builds };
    my @envs   = @{ $plan->product->environments };

    my $run   = $runs[ int( rand( scalar @runs ) ) ];
    my $case  = $cases[ int( rand( scalar @cases ) ) ];
    my $build = $builds[ int( rand( scalar @builds ) ) ];
    my $env   = $envs[ int( rand( scalar @envs ) ) ];

    my $response = $proxy->call(
        "TestCaseRun.create",
        {
            run_id            => $run->id,
            case_id           => $case->id,
            build             => $build->id,
            environment       => $env->id,
            assignee          => get_rep('profiles')->{'userid'},
            status            => get_rep('test_case_run_status')->{'name'},
            case_text_version => 1,
            notes             => 'API NOTES',
            sortkey           => 200,
        }
    );

    check_fault( $response, $self );

    my $obj = Bugzilla::Testopia::TestCaseRun->new( $response->result->{'case_run_id'} );

    convert_undef($obj);

    cmp_deeply( $response->result, noclass($obj), "TestCaseRun - test_create_by_integer" );
}

sub test_create_by_string {
    my $self = shift;

    my $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    while (scalar @{ $plan->test_runs } == 0
        || scalar @{ $plan->test_cases } == 0
        || scalar @{ $plan->product->environments } == 0
        || scalar @{ $plan->product->builds } == 0 )
    {
        $plan = Bugzilla::Testopia::TestPlan->new( get_rep('test_plans')->{'plan_id'} );
    }
    my @runs   = @{ $plan->test_runs };
    my @cases  = @{ $plan->test_cases };
    my @builds = @{ $plan->product->builds };
    my @envs   = @{ $plan->product->environments };

    my $run   = $runs[ int( rand( scalar @runs ) ) ];
    my $case  = $cases[ int( rand( scalar @cases ) ) ];
    my $build = $builds[ int( rand( scalar @builds ) ) ];
    my $env   = $envs[ int( rand( scalar @envs ) ) ];

    my $response = $proxy->call(
        "TestCaseRun.create",
        {
            run_id      => $run->id,
            case_id     => $case->id,
            build       => $build->name,
            environment => $env->name,
            assignee    => get_rep('profiles')->{'login_name'},
        }
    );

    check_fault( $response, $self );

    my $obj = Bugzilla::Testopia::TestCaseRun->new( $response->result->{'case_run_id'} );

    convert_undef($obj);

    cmp_deeply( $response->result, noclass($obj), "TestCaseRun - test_create_by_string" );
}

sub test_get_by_id {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );

    convert_undef($obj);

    my $response = $proxy->call( "TestCaseRun.get", $rep->{'case_run_id'} );

    check_fault( $response, $self );

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestCaseRun - test_get_by_id" );

}

sub test_get_by_values {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );

    my $response =
      $proxy->call( "TestCaseRun.get", $rep->{'run_id'}, $rep->{'case_id'}, $rep->{'build_id'},
        $rep->{'environment_id'} );

    check_fault( $response, $self );

    convert_undef($obj);

    #    dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestCaseRun - test_get_by_values" );

}

sub test_update {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );

    my @builds = @{ $obj->run->plan->product->builds };
    my @envs   = @{ $obj->run->plan->product->environments };
    my $build  = $builds[ int( rand( scalar @builds ) ) ];
    my $env    = $envs[ int( rand( scalar @envs ) ) ];

    my $response = $proxy->call(
        "TestCaseRun.update",
        $rep->{'case_run_id'},
        {
            build       => $build->id,
            environment => $env->id,
            assignee    => get_rep('profiles')->{'login_name'},
            status      => get_rep('test_case_run_status')->{'name'},
            sortkey     => 200,
            notes       => 'API NOTES UPDATE',
        }
    );

    check_fault( $response, $self );

    # Get the newly updated object to compare with
    $obj = Bugzilla::Testopia::TestCaseRun->new( $response->result->{'case_run_id'} );
    $obj->build;
    $obj->environment;

    delete $obj->{'case'};
    delete $response->result->{'case'};

    convert_undef($obj);

#        dump_all($obj, $response->result);
    cmp_deeply( $response->result, noclass($obj), "TestCaseRun - test_update" );

}

sub test_list {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param( "current_tab", "case_run" );
    $cgi->param( "pagesize",    25 );

    my $search = Bugzilla::Testopia::Search->new($cgi);
    my $table = Bugzilla::Testopia::Table->new( 'case_run', 'tr_xmlrpc.cgi', $cgi, undef, $search->query() );

    my $response = $proxy->call( "TestCaseRun.list", { pagesize => 25, } );

    convert_undef( $table->list );

    check_fault( $response, $self );
    cmp_deeply( $response->result, noclass( $table->list ), "TestCaseRun - test_list" );

}

sub test_attach_bug {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param( "Bugzilla_login",    LOGIN_CREDENTIALS->{'admin'}->{'login_name'} );
    $cgi->param( "Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'} );

    Bugzilla->login();

    my $rep       = get_rep('test_case_runs');
    my $obj       = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );
    my $orig_size = scalar @{ $obj->bugs };

    my $bug = get_rep('bugs');

    my $response = $proxy->call( "TestCaseRun.attach_bug", $rep->{'case_run_id'}, $bug->{'bug_id'} );

    check_fault( $response, $self );

    #    dump_all($bug, $obj->bugs);
    ok( scalar @{ $obj->bugs } == ( $orig_size + 1 ), "TestCaseRun - test_attach_bug" );

}

sub test_detach_bug {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param( "Bugzilla_login",    LOGIN_CREDENTIALS->{'admin'}->{'login_name'} );
    $cgi->param( "Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'} );

    Bugzilla->login();

    my $rep = get_rep('test_case_runs');
    my $bug = get_rep('bugs');

    my $obj = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );
    $obj->attach_bug( $bug->{'bug_id'} );
    delete $obj->{'bugs'};
    my $orig_size = scalar @{ $obj->bugs };
    delete $obj->{'bugs'};

    my $response = $proxy->call( "TestCaseRun.detach_bug", $rep->{'case_run_id'}, $bug->{'bug_id'} );

    check_fault( $response, $self );

    #    dump_all($bug, $obj->bugs);
    ok( scalar @{ $obj->bugs } == ( $orig_size - 1 ), "TestCaseRun - test_detach_bug" );

}

sub test_get_bugs {
    my $self = shift;

    my $cgi = Bugzilla->cgi;
    $cgi->param( "Bugzilla_login",    LOGIN_CREDENTIALS->{'admin'}->{'login_name'} );
    $cgi->param( "Bugzilla_password", LOGIN_CREDENTIALS->{'admin'}->{'password'} );

    Bugzilla->login();

    my $dbh = Bugzilla->dbh;
    my ($offset) = $dbh->selectrow_array(
        "SELECT FLOOR(RAND() * COUNT(*)) AS offset FROM test_case_bugs WHERE case_run_id IS NOT NULL");
    my $rep = $dbh->selectrow_hashref(
        "SELECT bug_id, case_run_id FROM test_case_bugs WHERE case_run_id IS NOT NULL LIMIT 1 OFFSET $offset");

    my $obj = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );

    my $response = $proxy->call( "TestCaseRun.get_bugs", $rep->{'case_run_id'} );

    check_fault( $response, $self );

    my $list = $obj->bugs;
    convert_undef($list);

    #    dump_all($obj->bugs, $response->result);
    cmp_deeply( $response->result, noclass($list), "TestCaseRun - test_get_bugs" );

}

sub test_get_completion_time {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );

    my $response = $proxy->call( "TestCaseRun.get_completion_time", $rep->{'case_run_id'} );

    check_fault( $response, $self );
    cmp_deeply( $response->result, noclass( $obj->completion_time ), "TestCaseRun - test_get_completion_time" );

}

sub test_get_history {
    my $self = shift;

    my $rep = get_rep('test_case_runs');
    my $obj = Bugzilla::Testopia::TestCaseRun->new( $rep->{'case_run_id'} );

    my $response = $proxy->call( "TestCaseRun.get_history", $rep->{'case_run_id'} );

    check_fault( $response, $self );

    my $list = $obj->get_case_run_list;
    convert_undef($list);

    cmp_deeply( $response->result, noclass($list), "TestCaseRun - test_get_history" );

}

sub test_lookup_status_id_by_name {
    my $self = shift;

    my $rep = get_rep('test_case_run_status');

    my $response = $proxy->call( "TestCaseRun.lookup_status_id_by_name", $rep->{'name'} );

    check_fault( $response, $self );

    #    dump_all(lookup_status_by_name($rep->{'name'}), $response->result);
    cmp_deeply( $response->result, Bugzilla::Testopia::TestCaseRun::lookup_status_by_name( $rep->{'name'} ),
        "TestCaseRun - lookup_status_id_by_name" );

}

sub test_lookup_status_name_by_id {
    my $self = shift;

    my $rep = get_rep('test_case_run_status');

    my $response = $proxy->call( "TestCaseRun.lookup_status_name_by_id", $rep->{'case_run_status_id'} );

    check_fault( $response, $self );

    #    dump_all($rep, $response->result);
    cmp_deeply( $response->result, Bugzilla::Testopia::TestCaseRun::lookup_status( $rep->{'case_run_status_id'} ),
        "TestCaseRun - lookup_status_name_by_id" );
}

1;

__END__
