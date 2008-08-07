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

package Bugzilla::WebService::Testopia::TestRun;

use strict;

use base qw(Bugzilla::WebService);

use Bugzilla::Constants;
use Bugzilla::Product;
use Bugzilla::User;
use Bugzilla::Util;
use Bugzilla::Error;

use Bugzilla::Testopia::Constants;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;

# Utility method called by the list method
sub get {
    my $self = shift;
    my ($run_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a run object hash
    my $run = new Bugzilla::Testopia::TestRun($run_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $run_id}) unless $run;
    ThrowUserError('testopia-permission-denied', {'object' => $run}) unless $run->canview;
        
    $run->{'case_count'} = $run->case_count();

    return $run;
}

sub list {
    my $self = shift;
    my ($query) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $cgi = Bugzilla->cgi;
    
    $cgi->param("current_tab", "run");
    
    foreach (keys(%$query)){
        $cgi->param($_, $$query{$_});
    }
    $cgi->param('distinct', 1);
    
    my $search = Bugzilla::Testopia::Search->new($cgi);

    return Bugzilla::Testopia::Table->new('run','tr_xmlrpc.cgi',$cgi,undef,$search->query())->list();
}

sub create {
    my $self =shift;
    my ($new_values) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $plan = Bugzilla::Testopia::TestPlan->new($new_values->{'plan_id'});
    ThrowUserError("testopia-create-denied", {'object' => 'Test Run', 'plan' => $plan}) unless ($plan->canedit);
    
    my @cases = Bugzilla::Testopia::Util::process_list($new_values->{'cases'});
    print STDERR Data::Dumper::Dumper(\@cases);
    delete $new_values->{'cases'};
    
    $new_values->{'manager_id'} ||= $new_values->{'manager'};
    $new_values->{'build_id'} ||= $new_values->{'build'};
    $new_values->{'environment_id'} ||= $new_values->{'environment'};
    
    delete $new_values->{'manager'};
    delete $new_values->{'build'};
    delete $new_values->{'environment'};        
    
    $new_values->{'plan_text_version'} ||= $plan->version;
    $new_values->{'product_version'} ||= $plan->product_version;
    $new_values->{'status'} = 1 unless defined $new_values->{'status'} && $new_values->{'status'} == 0;
    
    if (trim($new_values->{'build_id'}) !~ /^\d+$/ ){
        my $build = Bugzilla::Testopia::Build::check_build($new_values->{'build_id'}, $plan->product, "THROWERROR");
        $new_values->{'build_id'} = $build->id;
    }
    if (trim($new_values->{'environment_id'}) !~ /^\d+$/ ){
        my $environment = Bugzilla::Testopia::Environment::check_environment($new_values->{'environment_id'}, $plan->product, "THROWERROR");
        $new_values->{'environment_id'} = $environment->id;
    }

    my $run = Bugzilla::Testopia::TestRun->create($new_values);
    
    foreach my $c (@cases){
        my $case = Bugzilla::Testopia::TestCase->new($c);
        $run->add_case_run($case->id, $case->sortkey) if $case;
    }
    
    return $run;
}

sub add_cases {
    my $self = shift;
    my ($case_ids, $run_ids) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($case_ids);
    my @results;
    foreach my $id (@ids){
        my $case = new Bugzilla::Testopia::TestCase($id);
        unless ($case){
            push @results, {ERROR => "TestCase $id does not exist"};
            next;
        }
        unless ($case->canedit){
            push @results, {ERROR => "You do not have rights to edit this test case"};
            next;
        }
        eval {
            $case->add_to_run($run_ids);
        };
        if ($@){
            push @results, {ERROR => $@};
        }
    }
    # @results will be empty if successful
    return \@results;
}

sub update {
    my $self =shift;
    my ($run_id, $new_values) = @_;

    Bugzilla->login(LOGIN_REQUIRED);

    my $run = new Bugzilla::Testopia::TestRun($run_id);
    
    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Run', id => $run_id}) unless $run;
    ThrowUserError('testopia-read-only', {'object' => $run}) unless $run->canedit;

    $new_values->{'manager_id'} ||= $new_values->{'manager'};
    $new_values->{'build_id'} ||= $new_values->{'build'};
    $new_values->{'environment_id'} ||= $new_values->{'environment'};

    if ($new_values->{'build_id'} && trim($new_values->{'build_id'}) !~ /^\d+$/ ){
        my $build = Bugzilla::Testopia::Build::check_build($new_values->{'build_id'}, $run->plan->product, "THROWERROR");
        $new_values->{'build_id'} = $build->id;
    }
    if ($new_values->{'environment_id'} && trim($new_values->{'environment_id'}) !~ /^\d+$/ ){
        my $environment = Bugzilla::Testopia::Environment::check_environment($new_values->{'environment_id'}, $run->plan->product, "THROWERROR");
        $new_values->{'environment_id'} = $environment->id;
    }
       
    my $timestamp;
    $timestamp = $run->stop_date;
    $timestamp = undef if $new_values->{'status'};
    $timestamp = Bugzilla::Testopia::Util::get_time_stamp() if $new_values->{'status'} == 0 && !$run->stop_date;
 
    $run->set_summary(trim($new_values->{'summary'})) if defined $new_values->{'summary'};
    $run->set_product_version($new_values->{'product_version'}) if $new_values->{'product_version'};
    $run->set_plan_text_version($new_values->{'plan_text_version'}) if $new_values->{'plan_text_version'};
    $run->set_build($new_values->{'build_id'}) if $new_values->{'build_id'};
    $run->set_environment($new_values->{'environment_id'}) if $new_values->{'environment_id'};
    $run->set_manager($new_values->{'manager_id'}) if $new_values->{'manager_id'};
    $run->set_notes($new_values->{'notes'}) if defined $new_values->{'notes'};
    $run->set_stop_date($timestamp) if $new_values->{'status'};
    
    $run->update();
    
    # Result is modified test run, otherwise an exception will be thrown
    return $run;
}

sub get_change_history {
    my $self = shift;
    my ($run_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $run = new Bugzilla::Testopia::TestRun($run_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Run', id => $run_id}) unless $run;
    ThrowUserError('testopia-permission-denied', {'object' => $run}) unless $run->canview;

    # Result list of changes otherwise an exception will be thrown
    return $run->history;
}

sub get_test_cases {
    my $self = shift;
    my ($run_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a run object hash
    my $run = new Bugzilla::Testopia::TestRun($run_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $run_id}) unless $run;
    ThrowUserError('testopia-permission-denied', {'object' => $run}) unless $run->canview;
        
    # Result is list of test cases for the given test run
    return $run->cases;
}

sub get_test_case_runs {
    my $self = shift;
    my ($run_id, $current) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a run object hash
    my $run = new Bugzilla::Testopia::TestRun($run_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $run_id}) unless $run;
    ThrowUserError('testopia-permission-denied', {'object' => $run}) unless $run->canview;
        
    # Result is list of test cases for the given test run
    return $run->current_caseruns if $current;
    return $run->caseruns;
}

sub get_test_plan {
    my $self = shift;
    my ($run_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a run object hash
    my $run = new Bugzilla::Testopia::TestRun($run_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $run_id}) unless $run;
    ThrowUserError('testopia-permission-denied', {'object' => $run}) unless $run->canview;
        
    # Result is list of test cases for the given test run
    return $run->plan;
}

sub lookup_environment_id_by_name {
    return { ERROR => 'This method is considered harmful and has been deprecated. Please use Environment::check_environment instead'};
}

sub lookup_environment_name_by_id {
    return { ERROR => 'This method has been deprecated. Please use Environment::get instead'};
}

sub add_tag {
    my $self = shift;
    my ($run_ids, $tags) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($run_ids);
    my @results;
    foreach my $id (@ids){
        my $run = new Bugzilla::Testopia::TestRun($id);
        unless ($run){
            push @results, {ERROR => "TestRun $id does not exist"};
            next;
        }
        unless ($run->canedit){
            push @results, {ERROR => "You do not have rights to edit this test run"};
            next;
        }
        eval {
            $run->add_tag($tags);
        };
        if ($@){
            push @results, {ERROR => $@};
        }
    }
    # @results will be empty if successful
    return \@results;
}

sub remove_tag {
    my $self = shift;
    my ($run_id, $tag_name) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $run = new Bugzilla::Testopia::TestRun($run_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Run', id => $run_id}) unless $run;
    ThrowUserError('testopia-read-only', {'object' => $run}) unless $run->canedit;

    $run->remove_tag($tag_name);

    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub get_tags {
    my $self = shift;
    my ($run_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $run = new Bugzilla::Testopia::TestRun($run_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Run', id => $run_id}) unless $run;
    ThrowUserError('testopia-permission-denied', {'object' => $run}) unless $run->canview;

    my @results;
    foreach my $tag (@{$run->tags}){
        push @results, $tag->name;
    }
    # Result list of tags otherwise an exception will be thrown
    return \@results;
}

sub get_completion_report {
    my $self = shift;
    my ($runs) = @_;
    my $vars;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    my @run_ids;
    if (ref $runs eq 'ARRAY'){
        push @run_ids, @$runs
    }
    elsif ($runs =~ /,/){
        push @run_ids, split(/[\s,]+/, $runs);
    }
    else{
        push @run_ids, $runs;
    }
    
    my @runs;
    foreach my $g (@run_ids){
        my $obj = Bugzilla::Testopia::TestRun->new($g);
        push @runs, $obj if $obj && $obj->canview;
    }

    unless (scalar @runs){
        die "No runs found";
    }
    
    my $total = $runs[0]->case_run_count(undef, \@runs);
    my $passed = $runs[0]->case_run_count(PASSED, \@runs);
    my $failed = $runs[0]->case_run_count(FAILED, \@runs);
    my $blocked = $runs[0]->case_run_count(BLOCKED, \@runs);

    my $completed = $passed + $failed + $blocked;
    
    my $unfinished = $total - $completed;
    my $unpassed = $completed - $passed;
    my $unfailed = $completed - $failed;
    my $unblocked = $completed - $blocked;

    $vars->{'total'} = $total;
    $vars->{'completed'} = $completed;
    $vars->{'passed'} = $passed;
    $vars->{'failed'} = $failed;
    $vars->{'blocked'} = $blocked;
    $vars->{'idle'} = $runs[0]->case_run_count(IDLE, \@runs);
    $vars->{'running'} = $runs[0]->case_run_count(RUNNING, \@runs);
    $vars->{'paused'} = $runs[0]->case_run_count(PAUSED, \@runs);

    $vars->{'percent_completed'} = calculate_percent($total, $completed);
    $vars->{'percent_passed'} = calculate_percent($completed, $passed);
    $vars->{'percent_failed'} = calculate_percent($completed, $failed);
    $vars->{'percent_blocked'} = calculate_percent($completed, $blocked);
    
    return $vars;    
}

sub get_bugs {
    my $self = shift;
    my ($runs) = @_;
    my $dbh = Bugzilla->dbh;
    
    my @run_ids = Bugzilla::Testopia::Util::process_list($runs);

    my $bugs = $dbh->selectcol_arrayref("
        SELECT DISTINCT tcb.bug_id 
          FROM test_case_bugs AS tcb
    INNER JOIN test_case_runs AS tcr ON tcr.case_run_id = tcb.case_run_id
    INNER JOIN bugs on tcb.bug_id = bugs.bug_id
    INNER JOIN test_case_run_status AS tcrs ON tcr.case_run_status_id = tcrs.case_run_status_id
         WHERE tcr.run_id in (" . join (',',@run_ids) . ") AND tcr.iscurrent = 1 ORDER BY tcb.bug_id");
    
    my @bugs;
    foreach my $id (@{$bugs}){
        push @bugs, Bugzilla::Bug->new($id, Bugzilla->user->id);
    }
    
    return \@bugs;   
}
1;

__END__

=head1 NAME

Bugzilla::Testopia::Webservice::TestRun

=head1 EXTENDS

Bugzilla::Webservice

=head1 DESCRIPTION

Provides methods for automated scripts to manipulate Testopia TestRuns

=head1 METHODS

=over

=item C<add_cases($case_ids, $run_ids)>

 Description: Add one or more cases to the selected test runs.

 Params:      $case_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an arry of case_ids or aliases, or a string of comma separated case_ids.

              $run_ids - Integer/Array/String: An integer representing the ID in the database
                  an array of IDs, or a comma separated list of IDs. 

 Returns:     Array: empty on success or an array of hashes with failure 
              codes if a failure occured.

=item C<add_tag($run_ids, $tags)>

 Description: Add one or more tags to the selected test runs.

 Params:      $run_ids - Integer/Array/String: An integer representing the ID in the database,
                  an arry of run_ids, or a string of comma separated run_ids.

              $tags - String/Array - A single tag, an array of tags,
                  or a comma separated list of tags. 

 Returns:     Array: empty on success or an array of hashes with failure 
              codes if a failure occured.

=item C<create($values)>

 Description: Creates a new Test Run object and stores it in the database.

 Params:      $values - Hash: A reference to a hash with keys and values  
              matching the fields of the test run to be created. 
  +-------------------+----------------+-----------+------------------------------------+
  | Field             | Type           | Null      | Description                        |
  +-------------------+----------------+-----------+------------------------------------+
  | plan_id           | Integer        | Required  | ID of test plan                    |
  | environment       | Integer/String | Required  | ID or Name of Environment          |
  | build             | Integer/String | Required  | ID or Name of Build                |
  | manager           | Integer/String | Required  | ID or Login of run manager         |
  | summary           | String         | Required  |                                    |
  | product_version   | String         | Optional  | Defaults to plan's version         |
  | plan_text_version | Integer        | Optional  |                                    |
  | notes             | String         | Optional  |                                    |
  | status            | Integer        | Optional  | 0:STOPPED 1: RUNNING (default 1)   |
  | cases             | Array/String   | Optional  | list of case ids to add to the run |
  +-------------------+----------------+-----------+------------------------------------+

 Returns:     The newly created object hash.

=item C<get($run_id)>

 Description: Used to load an existing test run from the database.

 Params:      $id - Integer: An integer representing the ID of the run in the database

 Returns:     Hash: A blessed Bugzilla::Testopia::TestRun object hash

=item C<get_bugs($runs)>

 Description: Get the list of bugs attached to this run.

 Params:      $runs - Integer/Array/String: An integer representing the ID in the database
                    an array of integers or a comma separated list of integers.

 Returns:     Array: An array of bug object hashes.

=item C<get_change_history($run_id)>

 Description: Get the list of changes to the fields of this run.

 Params:      $run_id - Integer: An integer representing the ID of the run in the database

 Returns:     Array: An array of hashes with changed fields and their details.

=item C<get_completion_report($runs)>

 Description: Get a report of the current status of the selected runs combined.

 Params:      $runs - Integer/Array/String: An integer representing the ID in the database
                    an array of integers or a comma separated list of integers.

 Returns:     Hash: A hash containing counts and percentages of the combined totals of 
                    case-runs in the run. Counts only the most recently statused case-run 
                    for a given build and environment. 

=item C<get_tags($run_id)>

 Description: Get the list of tags attached to this run.

 Params:      $run_id - Integer: An integer representing the ID of the run in the database

 Returns:     Array: An array of tags .

=item C<get_test_case_runs($run_id, $current)>

 Description: Get the list of cases that this run is linked to.

 Params:      $run_id - Integer: An integer representing the ID in the database
                    for this run.

              $current - Boolean: 1 to only include the current set (what is displayed
                    in the web page) 0: to return all, current and historical.

 Returns:     Array: An array of test case-run object hashes.

=item C<get_test_cases($run_id)>

 Description: Get the list of cases that this run is linked to.

 Params:      $run_id - Integer: An integer representing the ID in the database
                    for this run.

 Returns:     Array: An array of test case object hashes.

=item C<get_test_plan($run_id)>

 Description: Get the plan that this run is associated with.

 Params:      $run_id - Integer: An integer representing the ID in the database
                    for this run.

 Returns:     Hash: A plan object hash.

=item C<list($query)>

 Description: Performs a search and returns the resulting list of test runs.

 Params:      $query - Hash: keys must match valid search fields.

    +--------------------------------------------------------+
    |                 Run Search Parameters                  |
    +--------------------------------------------------------+
    |        Key          |          Valid Values            |
    | build               | String: Product Name             |
    | build_id            | Integer                          |
    | environment         | String: Product Name             |
    | environment_id      | Integer                          |
    | manager             | A bugzilla login (email address) |
    | manager_type        | (select from email_variants)     |
    | milestone           | String                           |
    | notes               | String                           |
    | notes_type          | (select from query_variants)     |
    | plan_id             | comma separated integers         |
    | product             | String: Product Name             |
    | product_id          | Integer                          |
    | run_id              | comma separated integers         |
    | run_status          | 1: RUNNING 0: STOPPED            |
    | summary             | String                           |
    | summary_type        | (select from query_variants)     |    
    | tags                | String                           |
    | tags_type           | (select from tag_variants)       |
    | type_id             | Integer                          |
    | version             | String: Product version          |
    +--------------------------------------------------------+

    +--------------------------------------------------------+
    |                Paging and Sorting                      |
    +--------------------------------------------------------+
    |      Key       |            Description                |
    | dir            | "ASC" or "DESC"                       |
    | order          | field to sort by                      |
    +--------------------------------------------------------+
    | page_size      | integer: how many per page            |
    | page           | integer: page number                  |
    |            +++++++ OR +++++++                          |
    | start          | integer: Start with which record      |
    | limit          | integer: limit to how many            |
    +--------------------------------------------------------+
    | viewall        | 1: returns all records 0: first 25    |
    +--------------------------------------------------------+
      * The default is to only return 25 records at a time

    +----------------------------------------------------+
    |                 query_variants                     |
    +----------------+-----------------------------------+
    |      Key       |            Description            |
    | allwordssubstr | contains all of the words/strings |
    | anywordssubstr | contains any of the words/strings |
    | substring      | contains the string               |
    | casesubstring  | contains the string (exact case)  |
    | allwords       | contains all of the words         |
    | anywords       | contains any of the words         |
    | regexp         | matches the regexp                |
    | notregexp      | doesn't match the regexp          |
    +----------------+-----------------------------------+

            +-------------------------------------+
            |            email_variants           |
            +--------------+----------------------+
            |      Key     |      Description     |
            | substring    | contains             |
            | exact        | is                   |
            | regexp       | matches regexp       |
            | notregexp    | doesn't match regexp |
            +--------------+----------------------+

    +----------------------------------------------------+
    |                    tag_variants                    |
    +----------------+-----------------------------------+
    |      Key       |            Description            |
    | anyexact       | is tagged with                    |
    | allwordssubstr | contains all of the words/strings |
    | anywordssubstr | contains any of the words/strings |
    | substring      | contains the string               |
    | casesubstring  | contains the string (exact case)  |
    | regexp         | matches the regexp                |
    | notregexp      | doesn't match the regexp          |
    | allwords       | contains all of the words         |
    | anywords       | contains any of the words         |
    | nowords        | contains none of the words        | 
    +----------------------------------------------------+

 Returns:     Array: Matching test runs are retuned in a list of run object hashes.

=item C<remove_tag($run_id, $tag)>

 Description: Remove a tag from a run.

 Params:      $run_id - Integer: An integer representing the ID in the database.

              $tag - String - A single tag to be removed. 

 Returns:     0 on success.

=item C<update($ids, $values)>

 Description: Updates the fields of the selected test run.

 Params:      $ids - Integer: A single TestRun ID.

              $values - Hash of keys matching TestRun fields and the new values 
              to set each field to. See L<create> for description
                      +-------------------+----------------+
                      | Field             | Type           |
                      +-------------------+----------------+
                      | plan_id           | Integer        |
                      | environment       | Integer/String |
                      | build             | Integer/String |
                      | manager           | Integer/String |
                      | summary           | String         |
                      | product_version   | String         |
                      | plan_text_version | Integer        |
                      | notes             | String         |
                      | status            | Integer        |
                      +-------------------+----------------+

 Returns:     Hash: The updated test run object.

=back

=head1 SEE ALSO

L<Bugzilla::Testopia::TestRun>
L<Bugzilla::Webservice> 

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>