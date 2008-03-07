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

package Bugzilla::WebService::Testopia::TestCase;

use strict;

use Bugzilla::User;
use Bugzilla::Constants;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::Category;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;

use base qw(Bugzilla::WebService);

sub get {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);

    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;
    
    $case->text();
    $case->author();
    
    #Result is a test case object hash
    return $case;
}

sub list {
    my $self = shift;
    my ($query) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $cgi = Bugzilla->cgi;
    
    $cgi->param("current_tab", "case");
    
    foreach (keys(%$query)){
        $cgi->param($_, $$query{$_});
    }
        
    my $search = Bugzilla::Testopia::Search->new($cgi);

    return Bugzilla::Testopia::Table->new('case','tr_xmlrpc.cgi',$cgi,undef,$search->query())->list();
}

sub create {
    my $self = shift;
    my ($new_values) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    my @plan_ids;
    if (ref $new_values->{'plans'} eq 'ARRAY'){
        push @plan_ids, @{$new_values->{'plans'}};
    }
    elsif ($new_values->{'plans'} =~ /,/){
        push @plan_ids, split(/[\s,]+/, $new_values->{'plans'});
    }
    
    if ($new_values->{'plan_id'}){
        push @plan_ids, $new_values->{'plan_id'}
    }

    my @plans;
    foreach my $id (@plan_ids){
        my $plan = Bugzilla::Testopia::TestPlan->new($id);
        ThrowUserError("invalid-test-id-non-existent", {'id' => $id, 'type' => 'Plan'}) unless $plan;
        ThrowUserError("testopia-create-denied", {'object' => 'Test Case', 'plan' => $plan}) unless $plan->canedit;
        push @plans, $plan;
    }
    
    # Remove plan id from new_values hash    
    delete $new_values->{plan_id};
    
    my @run_ids;
    if (ref $new_values->{'runs'} eq 'ARRAY'){
        push @run_ids, @{$new_values->{'runs'}};
    }
    my @bug_ids;
    if (ref $new_values->{'bugs'} eq 'ARRAY'){
        push @bug_ids, @{$new_values->{'bugs'}};
    }
    
    $new_values->{'plans'} = \@plans;
    $new_values->{'author'} = Bugzilla->user->id;
    $new_values->{'runs'} = join(',', @run_ids) if scalar @run_ids;
    $new_values->{'bugs'} = join(',', @bug_ids) if scalar @bug_ids;
    
    my $case = Bugzilla::Testopia::TestCase->create($new_values);
    
    return $case;
}

sub update {
    my $self = shift;
    my ($ids, $new_values) = @_;

    Bugzilla->login(LOGIN_REQUIRED);

    my @ids = Bugzilla::Testopia::Util::process_list($ids);

    my @cases;
    foreach my $id (@ids){
        my $case = new Bugzilla::Testopia::TestCase($id);
        unless ($case){
            ThrowUserError("invalid-test-id-non-existent", {'id' => $id, 'type' => 'Case'}) if scalar @ids == 1;
            push @cases, {FAILED => 1, message => "TestCase $id does not exist"};
            next;
        }
        unless ($case->canedit){
            ThrowUserError('testopia-read-only', {'object' => $case}) if scalar @ids == 1;
            push @cases, {FAILED => 1, message => "You do not have rights to edit this test case"};
            next;
        }
        eval {
            $case->set_case_status($new_values->{'case_status_id'}) if exists $new_values->{'case_status_id'};
            $case->set_category($new_values->{'category_id'}) if exists $new_values->{'category_id'};
            $case->set_priority($new_values->{'priority_id'}) if exists $new_values->{'priority_id'};
            $case->set_default_tester($new_values->{'default_tester_id'}) if exists $new_values->{'default_tester_id'};
            $case->set_sortkey($new_values->{'sortkey'}) if exists $new_values->{'sortkey'};
            $case->set_requirement($new_values->{'requirement'}) if exists $new_values->{'requirement'};
            $case->set_isautomated($new_values->{'isautomated'}) if exists $new_values->{'isautomated'};
            $case->set_script($new_values->{'script'}) if exists $new_values->{'script'};
            $case->set_arguments($new_values->{'arguments'}) if exists $new_values->{'arguments'};
            $case->set_summary($new_values->{'summary'}) if exists $new_values->{'summary'};
            $case->set_alias($new_values->{'alias'}) if exists $new_values->{'alias'};
            $case->set_estimated_time($new_values->{'estimated_time'}) if exists $new_values->{'estimated_time'};
            $case->set_dependson($new_values->{'dependson'}) if exists $new_values->{'dependson'};
            $case->set_blocks($new_values->{'blocks'}) if exists $new_values->{'blocks'};
        };
        
        if ($@){
            push @cases, {FAILED => 1, message => $@};
        }
        
        $case->update;
        
        return $case if scalar @ids == 1;
    }

    return @cases;
}

sub get_text {
    my $self = shift;
    my ($case_id, $version) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    #Result is the latest test case doc hash map
    return $case->text($version);
}

sub store_text {
    my $self = shift;
    my ($case_id, $author_id, $action, $effect, $setup, $breakdown) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;

    my $version = $case->store_text($case_id, $author_id, $action, $effect, $setup, $breakdown);
    
    # Result is new test case doc version on success, otherwise an exception will be thrown
    return $version;
}

sub get_plans {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;
    
    return $case->plans();
}

sub attach_bug {
    my $self = shift;
    my ($case_ids, $bug_ids) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($case_ids);
    my @results;
    foreach my $id (@ids){
        my $case = new Bugzilla::Testopia::TestCase($id);
        unless ($case){
            push @results, {FAILED => 1, message => "TestCase $id does not exist"};
            next;
        }
        unless ($case->canedit){
            push @results, {FAILED => 1, message => "You do not have rights to edit this test case"};
            next;
        }
        eval {
            $case->attach_bug($bug_ids);
        }
        if ($@){
            push @results, {FAILED => 1, message => $@};
        }
    }
    # @results will be empty if successful
    return @results;
}

sub detach_bug {
    my $self = shift;
    my ($case_id, $bugids) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;

    $case->detach_bugs($bugids);

    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub get_bugs {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;
    
    # Result is list of bugs for the given test case
    return $case->bugs;
}

sub add_component {
    my $self = shift;
    my ($case_ids, $component_ids) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($case_ids);
    my @results;
    foreach my $id (@ids){
        my $case = new Bugzilla::Testopia::TestCase($id);
        unless ($case){
            push @results, {FAILED => 1, message => "TestCase $id does not exist"};
            next;
        }
        unless ($case->canedit){
            push @results, {FAILED => 1, message => "You do not have rights to edit this test case"};
            next;
        }
        eval {
            $case->add_component($component_ids);
        }
        if ($@){
            push @results, {FAILED => 1, message => $@};
        }
    }
    # @results will be empty if successful
    return @results;
}

sub remove_component {
    my $self = shift;
    my ($case_id, $component_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;

    $case->remove_component($component_id);

    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub get_components {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    # Result list of components otherwise an exception will be thrown
    return $case->components();
}

sub add_tag {
    my $self = shift;
    my ($case_ids, $tags) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($case_ids);
    my @results;
    foreach my $id (@ids){
        my $case = new Bugzilla::Testopia::TestCase($id);
        unless ($case){
            push @results, {FAILED => 1, message => "TestCase $id does not exist"};
            next;
        }
        unless ($case->canedit){
            push @results, {FAILED => 1, message => "You do not have rights to edit this test case"};
            next;
        }
        eval {
            $case->add_tag($tags);
        }
        if ($@){
            push @results, {FAILED => 1, message => $@};
        }
    }
    # @results will be empty if successful
    return @results;
}

sub remove_tag {
    my $self = shift;
    my ($case_id, $tag_name) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;

    $case->remove_tag($tag_name);

    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub get_tags {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    # Result list of tags otherwise an exception will be thrown
    return $case->tags;
}

sub check_category {
    my ($name, $product) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    if (ref $product){
        $product = $product;
    }
    elsif ($product =~ /^\d+$/){
        $product = Bugzilla::Testopia::Product->new($product);
    }
    else {
        $product = Bugzilla::Product::check_product($product);
        $product = Bugzilla::Testopia::Product->new($product->id);
    }
    
    ThrowUserError('testopia-read-only', {'object' => $product}) unless $product->canedit;
    
    return Bugzilla::Testopia::Category->new(check_case_category($name, $product));
}

sub link_plan {
    my $self = shift;
    my ($case_ids, $test_plan_id) = @_;
    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($case_ids);
    my @results;
    foreach my $id (@ids){
        my $case = new Bugzilla::Testopia::TestCase($id);
        unless ($case){
            push @results, {FAILED => 1, message => "TestCase $id does not exist"};
            next;
        }
        unless ($case->canedit){
            push @results, {FAILED => 1, message => "You do not have rights to edit this test case"};
            next;
        }
        eval {
            $case->link_plan($test_plan_id);
        }
        if ($@){
            push @results, {FAILED => 1, message => $@};
        }
    }
    
    # Result is list of plans for test case on success, otherwise an exception will be thrown
    return @results;
}

sub unlink_plan {
    my $self = shift;
    my ($case_id, $test_plan_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError("testopia-read-only", {'object' => 'case'}) unless ($case->can_unlink_plan($plan_id));
    
    $case->unlink_plan($test_plan_id);
    
    # Result is list of plans for test case on success, otherwise an exception will be thrown
    return $case->plans;
}

sub add_to_run {
    my $self = shift;
    my ($case_ids, $run_ids) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($case_ids);
    my @results;
    foreach my $id (@ids){
        my $case = new Bugzilla::Testopia::TestCase($id);
        unless ($case){
            push @results, {FAILED => 1, message => "TestCase $id does not exist"};
            next;
        }
        unless ($case->canedit){
            push @results, {FAILED => 1, message => "You do not have rights to edit this test case"};
            next;
        }
        eval {
            $case->add_to_run($run_ids);
        }
        if ($@){
            push @results, {FAILED => 1, message => $@};
        }
    }
    # @results will be empty if successful
    return @results;
}

sub get_case_run_history {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    # Result list of caseruns otherwise an exception will be thrown
    return $case->caseruns;
}

sub get_change_history {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    # Result list of changes otherwise an exception will be thrown
    return $case->history;
}

sub calculate_average_time {
    my $self = shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    return $case->calculate_average_time;
}

sub lookup_category_id_by_name {
    return { FAILED => 1, message => 'This method is considered harmful and has been depricated. Please use TestCase::check_catagory instead'};
}

sub lookup_category_name_by_id {
    my $self = shift;
    my ($id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);

    my $result = lookup_category($id);

    if (!defined $result){
      $result = 0;
    };
    
    # Result is test case category name for the given test case category id
    return $result;
}

sub lookup_priority_id_by_name {
    my $self = shift;
    my ($name) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);

    # Result is test case priority id for the given test case priority name
    return lookup_priority_by_value($name);
}

sub lookup_priority_name_by_id {
    my $self = shift;
    my ($id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);

    my $result = lookup_priority($id);

    if (!defined $result) {
      $result = 0;
    };
    
    # Result is test case priority name for the given test case priority id
    return $result;
}

sub lookup_status_id_by_name {
    my $self = shift;
    my ($name) = @_;
    
    $self->login;

    # Result is test case status id for the given test case status name
    return lookup_status_by_name($name);
}

sub lookup_status_name_by_id {
    my $self = shift;
    my ($id) = @_;
    
    $self->login;

     
    my $result = lookup_status($id);

    if (!defined $result){
      $result = 0;
    };
    
    # Result is test case status name for the given test case status id
    return $result;
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Webservice::TestCase

=head1 EXTENDS

Bugzilla::Webservice

=head1 DESCRIPTION

Provides methods for automated scripts to manipulate Testopia TestCases

=head1 METHODS

=over

=item C<add_component($case_ids, $component_ids)>

 Description: Adds one or more components to the selected test cases.
 
 Params:      $case_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an arry of case_ids or aliases, or a string of comma separated case_ids.
              
              $component_ids - Integer/Array/String - The component ID, an array of Component IDs,
                  or a comma separated list of component IDs 
                       
 Returns:     undef/Array: undef on success or an array of hashes with failure 
              codes if a failure occured.
 
=item C<add_tag($case_ids, $tags)>

 Description: Add one or more tags to the selected test cases.
 
 Params:      $case_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an arry of case_ids or aliases, or a string of comma separated case_ids.
              
              $tags - String/Array - A single tag, an array of tags,
                  or a comma separated list of tags. 
                       
 Returns:     undef/Array: undef on success or an array of hashes with failure 
              codes if a failure occured.

=item C<add_to_run($case_ids, $run_ids)>

 Description: Add one or more cases to the selected test runs.
 
 Params:      $case_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an arry of case_ids or aliases, or a string of comma separated case_ids.
              
              $run_ids - Integer/Array/String: An integer representing the ID in the database
                  an array of IDs, or a comma separated list of IDs. 
                       
 Returns:     undef/Array: undef on success or an array of hashes with failure 
              codes if a failure occured.

=item C<attach_bug($case_ids, $bug_ids)>

 Description: Add one or more bugs to the selected test cases.
 
 Params:      $case_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an array of case_ids or aliases, or a string of comma separated case_ids.
              
              $bug_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an array of bug_ids or aliases, or a string of comma separated bug_ids. 
                       
 Returns:     undef/Array: undef on success or an array of hashes with failure 
              codes if a failure occured.

=item C<calculate_average_time($case_id)>

 Description: Returns an average time for completion accross all runs.
 
 Params:      $case_id - Integer/String: An integer or alias representing the ID in the database.
                                     
 Returns:     String: Time in "HH:MM:SS" format.

=item C<check_category($name, $product)>
 
 Description: Looks up and returns a category by name.
              
 Params:      $name - String: name of the category.
              $product - Integer/String/Object
                 Integer: product_id of the product in the Database
                 String: Product name
                 Object: Blessed Bugzilla::Product object
 
 Returns:     Hash: Matching Category object hash or error if not found.
 
=item C<create($values)>
 
 Description: Creates a new Test Case object and stores it in the database.
              
 Params:      $values - Hash: A reference to a hash with keys and values  
              matching the fields of the test case to be created. 
              
 
 Returns:     The newly created object hash.
 
=item C<detach_bug($case_id, $bug_id)>

 Description: Remove a bug from a test case.
 
 Params:      $case_id - Integer/String: An integer or alias representing the ID in the database.
              
              $bug_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an array of bug_ids or aliases, or a string of comma separated bug_ids. 
                       
 Returns:     0 on success.

=item C<get($case_id)>

 Description: Used to load an existing test case from the database.
 
 Params:      $id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
                       
 Returns:     A blessed Bugzilla::Testopia::TestCase object hash
 
=item C<get_bugs($case_id)>

 Description: Get the list of bugs that are associated with this test case.
 
 Params:      $case_id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
                       
 Returns:     Array: An array of bug object hashes.
 
=item C<get_case_run_history($case_id)>

 Description: Get the list of case-runs for all runs this case appears in.
              To limit this list by build or other attribute, see TestCaseRun::list.
 
 Params:      $case_id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
                       
 Returns:     Array: An array of case-run object hashes.
 
=item C<get_change_history($case_id)>

 Description: Get the list of changes to the fields of this case.
 
 Params:      $case_id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
                       
 Returns:     Array: An array of hashes with changed fields and their details.
 
=item C<get_components($case_id)>

 Description: Get the list of components attached to this case.
 
 Params:      $case_id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
                       
 Returns:     Array: An array of component object hashes.
 
=item C<get_plans($case_id)>

 Description: Get the list of plans that this case is linked to.
 
 Params:      $case_id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
                       
 Returns:     Array: An array of test plan object hashes.
 
=item C<get_tags($case_id)>

 Description: Get the list of tags attached to this case.
 
 Params:      $case_id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
                       
 Returns:     Array: An array of tag object hashes.
 
=item C<get_text($case_id, $version)>

 Description: The associated large text fields: Action, Expected Results, Setup, Breakdown
              for a given version.
 
 Params:      $case_id - Integer/String: An integer representing the ID in the database
                    or a string representing the unique alias for this case.
              
              $version - Integer: (OPTIONAL) The version of the text you want returned.
                    Defaults to the latest.
                       
 Returns:     Hash: Text fields and values.
 
=item C<link_plan($case_ids, $plan_id)>

 Description: Link test cases to the given plan.
 
 Params:      $case_ids - Integer/Array/String: An integer or alias representing the ID in the database,
                  an array of case_ids or aliases, or a string of comma separated case_ids.
              
              $plan_id - Integer: An integer or alias representing the ID in the database.
                       
 Returns:     undef/Hash: undef on success, hash of failures if not.
 
=item C<list($query)>
 
 Description: Performs a search and returns the resulting list of test cases.
              
 Params:      $query - Hash: keys must match valid search fields.

    +--------------------------------------------------------+
    |                 Case Search Parameters                 |
    +--------------------------------------------------------+
    |        Key          |          Valid Values            |
    | andor               | 1: Author AND tester, 0: OR      |
    | author              | A bugzilla login (email address) |
    | author_type         | (select from email_variants)     |
    | case_id             | comma separated integers         |
    | case_status         | String: Status                   |
    | case_status_id      | Integer: Status                  |
    | category            | String: Category Name            |
    | category_id         | Integer                          |
    | component           | String: Component Name           |
    | default_tester      | A bugzilla login (email address) |
    | default_tester_type | (select from email_variants)     |
    | isautomated         | 1: true 0: false                 |
    | plan_id             | comma separated integers         |
    | priority            | String: Priority                 |
    | priority_id         | Integer                          |
    | product             | String: Product Name             |
    | product_id          | Integer                          |
    | requirement         | String: Requirement              |
    | requirement_type    | (select from query_variants)     |
    | run_id              | comma separated integers         |
    | script              | String                           |
    | script_type         | (select from query_variants)     |
    | summary             | String                           |
    | summary_type        | (select from query_variants)     |
    | tags                | String                           |
    | tags_type           | (select from tag_variants)       |
    | tcaction            | String                           |
    | tcaction_type       | (select from query_variants)     |
    | tceffect            | String                           |
    | tceffect_type       | (select from query_variants)     |
    +--------------------------------------------------------+
    
    +---------------------------------------------------+
    |                Paging and Sorting                 |
    +---------------------------------------------------+
    |      Key       |            Description           |
    | dir            | "ASC" or "DESC"                  |
    | order          | field to sort by                 |
    +---------------------------------------------------+
    | page_size      | integer: how many per page       |
    | page           | integer: page number             |
    |            +++++++ OR +++++++                     |
    | start          | integer: Start with which record |
    | limit          | integer: limit to how many       |
    +---------------------------------------------------+
    | viewall        | 1: returns all records           |
    +---------------------------------------------------+
    
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
    
 Returns:     Array: Matching test cases are retuned in a list of hashes.
 
=item C<lookup_category_name_by_id> 

 Params:      $id - Integer: ID of the case status to return
 
 Returns:     String: the status name.
              
=item C<lookup_category_id_by_name> B<DEPRICATED - CONSIDERED HARMFUL> Use check_category instead
 
=item C<lookup_priority_name_by_id>

 Params:      $id - Integer: ID of the case status to return
 
 Returns:     String: the status name.
              
=item C<lookup_priority_id_by_name>

 Params:      $name - String: the status name. 
 
 Returns:     Integer: ID of the case status.
 
=item C<lookup_status_name_by_id>

 Params:      $id - Integer: ID of the case status to return
 
 Returns:     String: the status name.

=item C<lookup_status_id_by_name> 

 Params:      $name - String: the status name. 
 
 Returns:     Integer: ID of the case status.

=item C<remove_component($case_id, $component_id)>

 Description: Removes selected component from the selected test case.
 
 Params:      $case_id - Integer/String: An integer or alias representing the ID in the database.
              
              $component_id - Integer: - The component ID to be removed.
                       
 Returns:     0 on success.
 
=item C<remove_tag($case_id, $tag)>

 Description: Remove a tag from a case.
 
 Params:      $case_id - Integer/String: An integer or alias representing the ID in the database.
              
              $tag - String - A single tag to be removed. 
                       
 Returns:     0 on success.

=item C<unlink_plan($case_id, $plan_id)>

 Description: Unlink a test case from the given plan. If only one plan is linked, this will delete
              the test case.
 
 Params:      $case_ids - Integer/String: An integer or alias representing the ID in the database.
              
              $plan_id - Integer: An integer representing the ID in the database.
                       
 Returns:     undef/Array: Array of plans still linked if any, undef if not.
 
=item C<update($ids, $values)>
 
 Description: Updates the fields of the selected case or cases.
              
 Params:      $ids - Integer/String/Array
                     Integer: A single TestCase ID.
                     String:  A comma separates string of TestCase IDs for batch
                              processing.
                     Array:   An array of case IDs for batch mode processing
                     
              $values - Hash of keys matching TestCase fields and the new values 
              to set each field to.
 
 Returns:     Hash/Array: In the case of a single case it is returned. If a 
              list was passed, it returns an array of case hashes. If the
              update on any particular case failed, the has will contain a 
              FAILED key and the message as to why it failed.

=back

=head1 SEE ALSO

=over

L<Bugzilla::Testopia::TestCase>
L<Bugzilla::Webservice> 

=back

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>