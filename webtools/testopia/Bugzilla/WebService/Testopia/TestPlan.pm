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

package Bugzilla::WebService::Testopia::TestPlan;

use strict;

use base qw(Bugzilla::WebService);

use Bugzilla::Constants;
use Bugzilla::User;
use Bugzilla::Util;
use Bugzilla::Error;

use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::Search;
use Bugzilla::Testopia::Table;

sub get {
    my $self = shift;
    my ($plan_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a plan object hash
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-permission-denied', {'object' => $plan}) unless $plan->canview;
        
    $plan->test_run_count();
    $plan->test_case_count();

    return $plan;
}

sub list {
    my $self = shift;
    my ($query) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $cgi = Bugzilla->cgi;
    
    $cgi->param("current_tab", "plan");
    
    foreach (keys(%$query)){
        $cgi->param($_, $$query{$_});
    }
    $cgi->param('distinct', 1);
    
    my $search = Bugzilla::Testopia::Search->new($cgi);

    return Bugzilla::Testopia::Table->new('plan','tr_xmlrpc.cgi',$cgi,undef,$search->query())->list();
}

sub create {
    my $self =shift;
    my ($new_values) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    $new_values->{'product_id'} ||= $new_values->{'product'};
    $new_values->{'type_id'} ||= $new_values->{'type'};
    delete $new_values->{'product'};
    delete $new_values->{'type'};
    
    $new_values->{'author_id'} ||= Bugzilla->user->id;
    
    # Canedit check is performed in TestPlan::_check_product    
    my $plan = Bugzilla::Testopia::TestPlan->create($new_values);
    
    return $plan;
}

sub update {
    my $self =shift;
    my ($plan_id, $new_values) = @_;

    Bugzilla->login(LOGIN_REQUIRED);

    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);
    
    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Plan', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-read-only', {'object' => $plan}) unless $plan->canedit;

    $new_values->{'type_id'} ||= $new_values->{'type'};
    
    $plan->set_name(trim($new_values->{'name'}));
    $plan->set_default_product_version($new_values->{'default_product_version'});
    $plan->set_type($new_values->{'type_id'});
    $plan->set_isactive($new_values->{'isactive'});
    
    $plan->update();
    
    # Result is modified test plan, otherwise an exception will be thrown
    return $plan;
}

sub get_text {
    my $self = shift;
    my ($plan_id, $version) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Plan', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-permission-denied', {'object' => $plan}) unless $plan->canview;

    #Result is the latest test plan doc hash map
    return $plan->text($version);
}

sub store_text {
    my $self = shift;
    my ($plan_id, $text, $author_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);
    
    $author_id ||= Bugzilla->user->id;
    if ($author_id !~ /^\d+$/){
        $author_id = Bugzilla::User::login_to_id($author_id, "THROWERROR");
    }

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Plan', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-read-only', {'object' => $plan}) unless $plan->canedit;

    my $version = $plan->store_text($plan_id, $author_id, $text);
    
    # Result is new test plan doc version on success, otherwise an exception will be thrown
    return $version;
}

sub get_test_cases {
    my $self = shift;
    my ($plan_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a plan object hash
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Build', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-permission-denied', {'object' => $plan}) unless $plan->canview;
        
    # Result is list of test cases for the given test plan
    return $plan->test_cases;
}

sub get_test_runs {
    my $self = shift;
    my ($plan_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a plan object hash
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Plan', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-permission-denied', {'object' => $plan}) unless $plan->canview;
    
    # Result is list of test runs for the given test plan
    return $plan->test_runs;
}

sub get_change_history {
    my $self = shift;
    my ($plan_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Plan', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-permission-denied', {'object' => $plan}) unless $plan->canview;

    # Result list of changes otherwise an exception will be thrown
    return $plan->history;
}

sub get_product {
    my $self = shift;
    my ($plan_id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);
    
    # Result is a plan object hash
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Product', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-permission-denied', {'object' => $plan}) unless $plan->canview;
        
    # Result is list of test cases for the given test plan
    return $plan->product;
}

sub lookup_type_name_by_id {
    my $self =shift;
    my ($id) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);

    # Result is test plan type name for the given test plan type id
    return lookup_type($id);
}

sub lookup_type_id_by_name {
    my $self =shift;
    my ($name) = @_;
    
    Bugzilla->login(LOGIN_REQUIRED);

    # Result is test plan type id for the given test plan type name
    return Bugzilla::Testopia::TestPlan::lookup_type_by_name($name);
}

sub add_tag {
    my $self = shift;
    my ($plan_ids, $tags) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my @ids = Bugzilla::Testopia::Util::process_list($plan_ids);
    my @results;
    foreach my $id (@ids){
        my $plan = new Bugzilla::Testopia::TestPlan($id);
        unless ($plan){
            push @results, {ERROR => "TestPlan $id does not exist"};
            next;
        }
        unless ($plan->canedit){
            push @results, {ERROR => "You do not have rights to edit this test plan"};
            next;
        }
        eval {
            $plan->add_tag($tags);
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
    my ($plan_id, $tag_name) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Plan', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-read-only', {'object' => $plan}) unless $plan->canedit;

    $plan->remove_tag($tag_name);

    # Result 0 on success, otherwise an exception will be thrown
    return 0;
}

sub get_tags {
    my $self = shift;
    my ($plan_id) = @_;

    Bugzilla->login(LOGIN_REQUIRED);
    
    my $plan = new Bugzilla::Testopia::TestPlan($plan_id);

    ThrowUserError('invalid-test-id-non-existent', {type => 'Test Plan', id => $plan_id}) unless $plan;
    ThrowUserError('testopia-permission-denied', {'object' => $plan}) unless $plan->canview;

    my @results;
    foreach my $tag (@{$plan->tags}){
        push @results, $tag->name;
    }
    # Result list of tags otherwise an exception will be thrown
    return \@results;
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Webservice::TestPlan

=head1 EXTENDS

Bugzilla::Webservice

=head1 DESCRIPTION

Provides methods for automated scripts to manipulate Testopia TestPlans

=head1 METHODS

=over

=item C<add_tag($plan_ids, $tags)>

 Description: Add one or more tags to the selected test plans.

 Params:      $plan_ids - Integer/Array/String: An integer representing the ID of the plan in the database,
                  an arry of plan_ids, or a string of comma separated plan_ids.

              $tags - String/Array - A single tag, an array of tags,
                  or a comma separated list of tags. 

 Returns:     Array: empty on success or an array of hashes with failure 
              codes if a failure occured.

=item C<create($values)>

 Description: Creates a new Test Plan object and stores it in the database.

 Params:      $values - Hash: A reference to a hash with keys and values  
              matching the fields of the test plan to be created. 
  +-------------------------+----------------+-----------+------------------------------------+
  | Field                   | Type           | Null      | Description                        |
  +-------------------------+----------------+-----------+------------------------------------+
  | product                 | Integer/String | Required  | ID or Name of product              |
  | name                    | String         | Required  |                                    |
  | type                    | Integer/String | Required  | ID or name of plan type            |
  | default_product_version | String         | Required  |                                    |
  | isactive                | Boolean        | Optional  | 0: Archived 1: Active (Default 1)  |
  +-------------------------+----------------+-----------+------------------------------------+

 Returns:     The newly created object hash.

=item C<get($plan_id)>

 Description: Used to load an existing test plan from the database.

 Params:      $id - Integer/String: An integer representing the ID of this plan in the database

 Returns:     Hash: A blessed Bugzilla::Testopia::TestPlan object hash

=item C<get_change_history($plan_id)>

 Description: Get the list of changes to the fields of this plan.

 Params:      $plan_id - Integer: An integer representing the ID of this plan in the database

 Returns:     Array: An array of hashes with changed fields and their details.

=item C<get_product($plan_id)>

 Description: Get the Product the plan is assiciated with.

 Params:      $plan_id - Integer: An integer representing the ID of the plan in the database.

 Returns:     Hash: A blessed Bugzilla::Testopia::Product hash.

=item C<get_tags($plan_id)>

 Description: Get the list of tags attached to this plan.

 Params:      $plan_id - Integer An integer representing the ID of this plan in the database

 Returns:     Array: An array of tag object hashes.

=item C<get_test_cases($plan_id)>

 Description: Get the list of cases that this plan is linked to.

 Params:      $plan_id - Integer: An integer representing the ID of the plan in the database

 Returns:     Array: An array of test case object hashes.

=item C<get_test_runs($plan_id)>

 Description: Get the list of runs in this plan.

 Params:      $plan_id - Integer: An integer representing the ID of this plan in the database

 Returns:     Array: An array of test run object hashes.

=item C<get_text($plan_id, $version)>

 Description: The plan document for a given test plan.

 Params:      $plan_id - Integer: An integer representing the ID of this plan in the database

              $version - Integer: (OPTIONAL) The version of the text you want returned.
                    Defaults to the latest.

 Returns:     Hash: Text and author information.

=item C<list($query)>

 Description: Performs a search and returns the resulting list of test plans.

 Params:      $query - Hash: keys must match valid search fields.

    +--------------------------------------------------------+
    |                 Plan Search Parameters                 |
    +--------------------------------------------------------+
    |        Key          |          Valid Values            |
    | author              | A bugzilla login (email address) |
    | author_type         | (select from email_variants)     |
    | plan_id             | comma separated integers         |
    | plan_text           | String                           |
    | plan_text_type      | (select from query_variants)     |
    | plan_type           | String: Product Name             |
    | product             | String: Product Name             |
    | product_id          | Integer                          |
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

 Returns:     Array: Matching test plans are retuned in a list of plan object hashes.

=item C<lookup_type_id_by_name>

 Params:      $name - String: the plan type. 

 Returns:     Integer: ID of the plan type.

=item C<lookup_type_name_by_id>

 Params:      $id - Integer: ID of the plan type to return

 Returns:     String: the type name.

=item C<remove_tag($plan_id, $tag)>

 Description: Remove a tag from a plan.

 Params:      $plan_id - Integer: An integer or alias representing the ID of this plan in the database.

              $tag - String - A single tag to be removed. 

 Returns:     0 on success.

=item C<store_text($plan_id, $text, [$author_id])>

 Description: Update the document field of a plan.

 Params:      $plan_id - Integer: An integer representing the ID of this plan in the database.
              $text - String: Text for the document. Can contain HTML.
              [$author_id] = Integer/String: (OPTIONAL) The numeric ID or the login of the author. 
                  Defaults to logged in user.

 Returns:     Integer: The new text version

=item C<update($ids, $values)>

 Description: Updates the fields of the selected test plan.

 Params:      $ids - Integer: A single TestPlan ID.

              $values - Hash of keys matching TestPlan fields and the new values 
              to set each field to.
                      +-------------------------+----------------+
                      | Field                   | Type           |
                      +-------------------------+----------------+
                      | name                    | String         |
                      | type                    | Integer/String |
                      | default_product_version | String         |
                      | isactive                | Boolean        |
                      +-------------------------+----------------+

 Returns:     Hash: The updated test plan object.

=back

=head1 SEE ALSO

L<Bugzilla::Testopia::TestPlan>
L<Bugzilla::Webservice> 

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>