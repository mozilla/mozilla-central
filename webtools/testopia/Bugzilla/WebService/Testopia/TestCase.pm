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
# The Original Code is the Bugzilla Bug Tracking System.
#
# Contributor(s): Marc Schumann <wurblzap@gmail.com>
#                 Dallas Harken <dharken@novell.com>

package Bugzilla::WebService::Testopia::TestCase;

use strict;

use Bugzilla::User;
use Bugzilla::Constants;
use Bugzilla::Testopia::TestCase;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;

use base qw(Bugzilla::WebService);

sub _validate {
    my ($case) = @_;
    Bugzilla->login(LOGIN_REQUIRED);

    $case = Bugzilla::Testopia::TestCase->new($case);
    
    ThrowUserError('invalid-test-id-non-existent', {type => 'Case', id => $id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canedit;

    return $case;
}

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
    my $self =shift;
    my ($new_values) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    my @plan_ids;
    if (ref $new_values->{'plans'} eq 'ARRAY'){
        push @plan_ids, @{$new_values->{'plans'}};
    }
    elsif ($new_values->{'plans'} =~ /^\d+$/){
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
    my $self =shift;
    my ($ids, $new_values) = @_;

    Bugzilla->login(LOGIN_REQUIRED);

    my @ids;
    if (ref $ids eq 'ARRAY'){
        @ids = @$ids;
    }
    elsif ($ids =~ /,/){
        @ids = split(/[\s,]+/, $ids);
    }
    else {
        push @ids, $ids;
    }

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
    my $self =shift;
    my ($case_id, $version) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    #Result is the latest test case doc hash map
    return $case->text($version);
}

sub store_text {
    my $self =shift;
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
    my $self =shift;
    my ($case_id, $bugids) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;
    
    $case->attach_bugs($bugids);

    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub detach_bug {
    my $self =shift;
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
    my $self =shift;
    my ($case_id, $component_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;

    $case->add_component($component_id);
    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub remove_component {
    my $self =shift;
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
    my $self =shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    # Result list of components otherwise an exception will be thrown
    return $case->components();
}

sub add_tag {
    my $self =shift;
    my ($case_id, $tag_name) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;
    
    $case->add_tag($tag_name);

    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub remove_tag {
    my $self =shift;
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
    my $self =shift;
    my ($case_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-permission-denied', {'object' => $case}) unless $case->canview;

    # Result list of tags otherwise an exception will be thrown
    return $case->tags;
}

sub lookup_status_id_by_name {
    my $self =shift;
    my ($name) = @_;
    
    $self->login;

    my $result = lookup_status_by_name($name);

    # Result is test case status id for the given test case status name
    return $result;
}

sub lookup_status_name_by_id {
    my $self =shift;
    my ($id) = @_;
    
    $self->login;

     
    my $result = lookup_status($id);

    if (!defined $result){
      $result = 0;
    };
    
    # Result is test case status name for the given test case status id
    return $result;
}

sub lookup_category_id_by_name {
    my $self =shift;
    my ($name) = @_;
    
    $self->login;

    my $result = lookup_category_by_name($name);

    # Result is test case category id for the given test case category name
    return $result;
}

sub lookup_category_name_by_id {
    my $self =shift;
    my ($id) = @_;
    
    $self->login;

    my $result = lookup_category($id);

    if (!defined $result){
      $result = 0;
    };
    
    # Result is test case category name for the given test case category id
    return $result;
}

sub lookup_priority_id_by_name {
    my $self =shift;
    my ($name) = @_;
    
    $self->login;

      my $result = lookup_priority_by_value($name);

    # Result is test case priority id for the given test case priority name
    return $result;
}

sub lookup_priority_name_by_id {
    my $self =shift;
    my ($id) = @_;
    
    $self->login;

    my $result = lookup_priority($id);

    if (!defined $result) {
      $result = 0;
    };
    
    # Result is test case priority name for the given test case priority id
    return $result;
}

sub link_plan {
    my $self =shift;
    my ($case_id, $test_plan_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;

    $case->link_plan($test_plan_id);
    
    # Result is list of plans for test case on success, otherwise an exception will be thrown
    return $case->plans;
}

sub unlink_plan {
    my $self =shift;
    my ($case_id, $test_plan_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $case = new Bugzilla::Testopia::TestCase($case_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Case', id => $case_id}) unless $case;
    ThrowUserError('testopia-read-only', {'object' => $case}) unless $case->canedit;
    ThrowUserError("testopia-read-only", {'object' => 'case'}) unless ($case->can_unlink_plan($plan_id));
    
    # Result is list of plans for test case on success, otherwise an exception will be thrown
    return $case->plans;
}

sub add_to_run {}
sub get_case_run_history {}
sub get_change_history {}
sub calculate_average_time {}

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

=item C<get($id)>

 Description: Used to load an existing build from the database.
 
 Params:      $id - An integer representing the ID in the database
                       
 Returns:     A blessed Bugzilla::Testopia::TestCase object hash
 
=item C<check_build($name, $product)>
 
 Description: Looks up and returns a build by name.
              
 Params:      $name - String: name of the build.
              $product - Integer/String/Object
                         Integer: product_id of the product in the Database
                         String: Product name
                         Object: Blessed Bugzilla::Product object
 
 Returns:     Hash: Matching TestCase object hash or error if not found.
 
=item C<update($ids, $values)>
 
 Description: Updates the fields of the selected build or builds.
              
 Params:      $ids - Integer/String/Array
                     Integer: A single build ID.
                     String:  A comma separates string of TestCase IDs for batch
                              processing.
                     Array:   An array of build IDs for batch mode processing
                     
              $values - Hash of keys matching TestCase fields and the new values 
              to set each field to.
 
 Returns:     Hash/Array: In the case of a single build it is returned. If a 
              list was passed, it returns an array of build hashes. If the
              update on any particular build failed, the has will contain a 
              FAILED key and the message as to why it failed.
 
=item C<create($values)>
 
 Description: Creates a new build object and stores it in the database
              
 Params:      $values - Hash: A reference to a hash with keys and values  
              matching the fields of the build to be created. 
              See Bugzilla::Testopia::TestCase for a list of required fields.
 
 Returns:     The newly created object hash.
 
=item C<lookup_name_by_id> B<DEPRICATED> Use TestCase::get instead
              
=item C<lookup_id_by_name> B<DEPRICATED - CONSIDERED HARMFUL> Use TestCase::check_build instead
 
=back

=head1 SEE ALSO

=over

L<Bugzilla::Testopia::TestCase>

L<Bugzilla::Webservice> 

=back

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>