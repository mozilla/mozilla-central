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
# The Original Code is the Bugzilla Test Runner System.
#
# The Initial Developer of the Original Code is Maciej Maczynski.
# Portions created by Maciej Maczynski are Copyright (C) 2001
# Maciej Maczynski. All Rights Reserved.
#
# Portions taken from processbug.cgi and Bug.pm 
# which are copyrighted by
#                 Terry Weissman <terry@mozilla.org>
#                 Dan Mosedale <dmose@mozilla.org>
#                 Dave Miller <justdave@syndicomm.com>
#                 Christopher Aillon <christopher@aillon.com>
#                 Myk Melez <myk@mozilla.org>
#                 Jeff Hedlund <jeff.hedlund@matrixsi.com>
#                 Frederic Buclin <LpSolit@gmail.com>
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

package Bugzilla::Testopia::TestCase;

use strict;

use Bugzilla::Util;
use Bugzilla::Bug;
use Bugzilla::User;
use Bugzilla::Config;
use Bugzilla::Error;
use Bugzilla::Constants;
use Bugzilla::Testopia::Constants;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::TestPlan;
use Bugzilla::Testopia::TestRun;
use Bugzilla::Testopia::TestCaseRun;
use Bugzilla::Testopia::Category;

use Text::Diff;

use base qw(Exporter Bugzilla::Object);
@Bugzilla::Testopia::Util::EXPORT = qw(lookup_status lookup_status_by_name 
                                       lookup_category lookup_category_by_name
                                       lookup_priority lookup_priority_by_value
                                       lookup_default_tester);

###############################
####    Initialization     ####
###############################

use constant DB_TABLE   => "test_cases";
use constant NAME_FIELD => "summary";
use constant ID_FIELD   => "case_id";
use constant DB_COLUMNS => qw(
    case_id
    case_status_id
    category_id
    priority_id
    author_id
    default_tester_id  
    creation_date
    estimated_time
    isautomated
    sortkey
    script
    arguments
    summary
    requirement
    alias
);

use constant REQUIRED_CREATE_FIELDS => qw(case_status_id category_id priority_id author_id summary plans);
use constant UPDATE_COLUMNS         => qw(case_status_id category_id priority_id default_tester_id 
                                          isautomated sortkey script arguments summary requirement
                                          alias estimated_time dependson blocks runs tags components);

use constant VALIDATORS => {
    case_status_id    => \&_check_status,
    category_id       => \&_check_category,
    priority_id       => \&_check_priority,
    default_tester_id => \&_check_tester,
    isautomated       => \&_check_automated,
    sortkey           => \&_check_sortkey,
    script            => \&_check_script,
    arguments         => \&_check_arguments,
    summary           => \&_check_summary,
    requirement       => \&_check_requirements,
    alias             => \&_check_alias,
    estimated_time    => \&_check_time,
    dependson         => \&_check_dependency,
    blocks            => \&_check_dependency,
    plans             => \&_check_plans,
    runs              => \&_check_runs,
    tags              => \&_check_tags,
    components        => \&_check_components,
};

use constant ALIAS_MAX_LENGTH => 255;
use constant REQUIREMENT_MAX_LENGTH => 255;
use constant SUMMARY_MAX_LENGTH => 255;
use constant TAG_MAX_LENGTH => 255;

sub display_columns {
    my $self = shift;
    my @columns = 
       [{column => 'case_id',        desc => 'ID'          },
        {column => 'case_status_id', desc => 'Status'      },
        {column => 'category_id',    desc => 'Category'    },
        {column => 'priority_id',    desc => 'Priority'    },
        {column => 'summary',        desc => 'Summary'     },
        {column => 'requirement',    desc => 'Requirement' },
        {column => 'alias',          desc => 'Alias'       }];
    
    $self->{'display_columns'} = \@columns;
    return $self->{'display_columns'};
}

sub report_columns {
    my $self = shift;
    my %columns;
    # Changes here need to match Report.pm
    $columns{'Status'}          = "case_status";        
    $columns{'Priority'}        = "priority";
    $columns{'Product'}         = "product_id";
    $columns{'Component'}       = "component";
    $columns{'Category'}        = "category";
    $columns{'Automated'}       = "isautomated";
    $columns{'Tags'}            = "tags";
    $columns{'Requirement'}     = "requirement";
    $columns{'Author'}          = "author";
    $columns{'Default tester'}  = "default_tester";
    my @result;
    push @result, {'name' => $_, 'id' => $columns{$_}} foreach (sort(keys %columns));
    unshift @result, {'name' => '<none>', 'id'=> ''};
    return \@result;     
        
}

###############################
####       Validators      ####
###############################

sub _check_status{
    my ($invocant, $status) = @_;
    $status = trim($status);
    my $status_id;
    if ($status =~ /^\d+$/){
        $status_id = Bugzilla::Testopia::Util::validate_selection($status, 'case_status_id', 'test_case_status');
    }
    else {
        $status_id = lookup_status_by_name($status);
    }
    ThrowUserError('invalid_status') unless $status_id;
    return $status_id;
}

sub _check_category{
    my ($invocant, $category) = @_;
    $category = trim($category);
    my $category_id;
    if ($category =~ /^\d+$/){
        $category_id = Bugzilla::Testopia::Util::validate_selection($category, 'category_id', 'test_case_categories');
    }
    else {
        $category_id = lookup_category_by_name($category);
    }
    ThrowUserError('invalid_category') unless $category_id;
    return $category_id;
}

sub _check_priority{
    my ($invocant, $priority) = @_;
    $priority = trim($priority);
    my $priority_id;
    if ($priority =~ /^\d+$/){
        $priority_id = Bugzilla::Testopia::Util::validate_selection($priority, 'id', 'priority');
    }
    else {
        $priority_id = lookup_priority_by_value($priority);
    }
    ThrowUserError('invalid_priority') unless $priority_id; 
    return $priority_id;

}

sub _check_tester{
    my ($invocant, $tester) = @_;
    $tester = trim($tester);
    return unless $tester;
    if ($tester =~ /^\d+$/){
        $tester = Bugzilla::User->new($tester);
        return $tester->id;
    }
    else {
        my $id = login_to_id($tester, THROW_ERROR);
        return $id;
    }
}

sub _check_automated{
    my ($invocant, $isactive) = @_;
    $isactive = trim($isactive);
    ThrowCodeError('bad_arg', {argument => 'isactive', function => 'set_isactive'}) unless ($isactive =~ /(1|0)/);
    return $isactive;
}

sub _check_sortkey{
    my ($invocant, $sortkey) = @_;
    $sortkey = trim($sortkey);
    ThrowUserError('invalid_value', {argument => 'sortkey', value => $sortkey}) unless ($sortkey =~ /^\d+$/);
    return $sortkey;
}

sub _check_script{
    my ($invocant, $value) = @_;
    return $value;
}

sub _check_arguments{
    my ($invocant, $value) = @_;
    return $value;
}

sub _check_summary{
    my ($invocant, $summary) = @_;
    $summary = clean_text($summary) if $summary;

    if (!defined $summary || $summary eq '') {
        ThrowUserError('testopia-missing-required-field', {'field' => 'summary'});
    }
    return $summary;
}

sub _check_requirements{
    my ($invocant, $value) = @_;
    return $value;
}

sub _check_alias {
    my ($invocant, $alias) = @_;
    $alias = trim($alias);
    return unless $alias;
    trick_taint($alias);
    my $id;
    my $dbh = Bugzilla->dbh;
    
    my $query = "SELECT case_id 
                   FROM test_cases 
                  WHERE alias = ?";
    
    # If this is a new test case then we only need to check if another test case
    # has this alias already. If we are updating the test case though, we know 
    # there is already at least one that has this alias - this case.
    $query .= " AND case_id != ?" if ref $invocant;
     
    if (ref $invocant){ 
        ($id) = $dbh->selectrow_array($query, undef, ($alias, $invocant->id));
    }
    else {
        ($id) = $dbh->selectrow_array($query, undef, $alias);
    }
    ThrowUserError('testiopia-alias-exists', {'alias' => $alias}) if $id; 
    return $alias;
}

sub _check_time{
    my ($invocant, $time) = @_;
    $time = trim($time) || 0;    
    $time =~ m/(\d+)[:\s](\d+)[:\s](\d+)/;
    ThrowUserError('testopia-format-error', {'field' => 'Estimated Time' })
      unless ($1 < 24 && $2 < 60 && $3 < 60);
    $time = "$1:$2:$3";
    return $time;
}

sub _check_dependency{
    my ($invocant, $value) = @_;
    $value = trim($value);
    if ($value) {
        my @validvalues;
        foreach my $id (split(/[\s,]+/, $value)) {
            next unless $id;
            Bugzilla::Testopia::Util::validate_test_id($id, 'case');
            push(@validvalues, $id);
        }
        $value = join(",", @validvalues);
        return $value;
    }
    return;
}

sub _check_plans {
    my ($invocant, $plans) = @_;
    ThrowUserError('plan_needed') unless scalar @$plans > 0;
    return $plans;
}

sub _check_runs {
    my ($invocant, $runids) = @_;
    my @runs;
    foreach my $runid (split(/[\s,]+/, $runids)){
        Bugzilla::Testopia::Util::validate_test_id($runid, 'run');
        push @runs, Bugzilla::Testopia::TestRun->new($runid);
    }
    return \@runs;
}

sub _check_tags {
    my ($invocant, $tags) = @_;
    
    return $tags;
}

sub _check_components {
    my ($invocant, $components) = @_;
    my @components;
    my $dbh = Bugzilla->dbh;
  
    foreach my $id (@$components){
        Bugzilla::Testopia::Util::validate_selection($id, 'id', 'components');
        if (ref $invocant){
            my ($is) = $dbh->selectrow_array(
                "SELECT case_id FROM test_case_components
                 WHERE case_id = ? AND component_id = ?",
                 undef, ($invocant->id, $id));
            ThrowUserError('testopia_component_attached') if $is;
        }
        trick_taint($id);
        push @components, $id;
    }
    return \@components;
}

sub _check_bugs {
    my ($invocant, $bugids) = @_;
    my @bugids;
    my $dbh = Bugzilla->dbh;
    
    foreach my $bug (split(/[\s,]+/, $bugids)){
        trick_taint($bug);
        ValidateBugID($bug);
        if (ref $invocant){
            my ($exists) = $dbh->selectrow_array(
                    "SELECT bug_id 
                       FROM test_case_bugs 
                      WHERE case_id=?
                        AND bug_id=?", 
                     undef, ($invocant->id, $bug));
            next if ($exists);
        }
        push @bugids, $bug;
    }
    
    return \@bugids;
}

###############################
####       Mutators        ####
###############################
sub set_case_status        { $_[0]->set('case_status_id', $_[1]); }
sub set_category           { $_[0]->set('category_id', $_[1]); }
sub set_priority           { $_[0]->set('priority_id', $_[1]); }
sub set_default_tester     { $_[0]->set('default_tester_id', $_[1]); }
sub set_sortkey            { $_[0]->set('sortkey', $_[1]); }
sub set_requirement        { $_[0]->set('requirement', $_[1]); }
sub set_isautomated        { $_[0]->set('isautomated', $_[1]); }
sub set_script             { $_[0]->set('script', $_[1]); }
sub set_arguments          { $_[0]->set('arguments', $_[1]); }
sub set_summary            { $_[0]->set('summary', $_[1]); }
sub set_alias              { $_[0]->set('alias', $_[1]); }
sub set_estimated_time     { $_[0]->set('estimated_time', $_[1]); }
sub set_dependson          { $_[0]->set('dependson', $_[1]); }
sub set_blocks             { $_[0]->set('blocks', $_[1]); }

sub new {
    my $invocant = shift;
    my $class = ref($invocant) || $invocant;
    my $param = shift;
    
    # We want to be able to supply an empty object to the templates for numerous
    # lists etc. This is much cleaner than exporting a bunch of subroutines and
    # adding them to $vars one by one. Probably just Laziness shining through.
    if (ref $param eq 'HASH'){
        bless($param, $class);
        return $param;
    }
    
    unshift @_, $param;
    my $self = $class->SUPER::new(@_);
    
    return $self; 
}

sub create {
    my ($class, $params) = @_;

    $class->SUPER::check_required_create_fields($params);
    my $field_values = $class->run_create_validators($params);
    
    $field_values->{creation_date} = Bugzilla::Testopia::Util::get_time_stamp();
       
    # We have to handle these fields a bit differently since they have their own tables.
    my $action    = $field_values->{action};
    my $effect    = $field_values->{effect};
    my $setup     = $field_values->{setup};
    my $breakdown = $field_values->{breakdown};
    my $dependson = $field_values->{dependson};
    my $blocks    = $field_values->{blocks};
    my $plans     = $field_values->{plans};
    my $runs      = $field_values->{runs};
    my $component = $field_values->{components};
    my $tags      = $field_values->{tags};
    my $bugs      = $field_values->{bugs};
    
    # Since these are not part of a case strictly speaking, we remove them before 
    # calling insert_create_data.
    foreach my $field (qw(action effect setup breakdown dependson blocks plans runs components tags bugs)){
        delete $field_values->{$field};
    }
    
    my $self = $class->SUPER::insert_create_data($field_values);

    $self->store_text($self->id, $field_values->{'author_id'}, $action, $effect,  
                      $setup, $breakdown,0);
                      
    $self->update_deps($dependson, $blocks, $self->id);    
    
    foreach my $p (@$plans){
        $self->link_plan($p->id, $self->id);
    }
    
    foreach my $run (@$runs){
        $run->add_case_run($self->id);
    }
    
    $self->add_component($component, "VALIDATED");
    $self->add_tag($tags);
    $self->attach_bug($bugs);
    
    return $self;
}

sub update {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();
    
    # Update the dependencies and then set the object back to the way
    # it was so that Object::update doesn't try to add them to the table
    # where it doesn't exist.
    $self->update_deps($self->{'dependson'}, $self->{'blocks'});
    my $old_self = $self->new($self->id);
    $self->{'dependson'} = $old_self->{'dependson'};
    $self->{'blocks'} = $old_self->{'blocks'};
    
    $dbh->bz_lock_tables('test_cases WRITE', 'test_case_activity WRITE',
                         'test_fielddefs READ');
    
    my $changed = $self->SUPER::update();
    
    foreach my $field (keys %$changed){
        Bugzilla::Testopia::Util::log_activity('case', $self->id, $field, $timestamp, 
                                               $changed->{$field}->[0], $changed->{$field}->[1]);
    }

    $dbh->bz_unlock_tables();
}

###############################
####      Functions        ####
###############################

sub lookup_status {
    my ($id) = @_;
    my $dbh = Bugzilla->dbh;
    my ($value) = $dbh->selectrow_array(
            "SELECT name 
               FROM test_case_status
              WHERE case_status_id = ?",
              undef, $id);
    return $value;
}

sub lookup_status_by_name {
    my ($name) = @_;
    my $dbh = Bugzilla->dbh;
    my ($value) = $dbh->selectrow_array(
            "SELECT case_status_id 
               FROM test_case_status
              WHERE name = ?",
              undef, $name);
    return $value;
}

sub lookup_category {
    my ($id) = @_;
    my $dbh = Bugzilla->dbh;
    my ($value) = $dbh->selectrow_array(
            "SELECT name 
               FROM test_case_categories
              WHERE category_id = ?",
              undef, $id);
    return $value;
}

sub lookup_category_by_name {
    my ($name) = @_;
    my $dbh = Bugzilla->dbh;
    my ($value) = $dbh->selectrow_array(
            "SELECT category_id 
               FROM test_case_categories
              WHERE name = ?",
              undef, $name);
    return $value;
}

sub lookup_priority {
    my ($id) = @_;
    my $dbh = Bugzilla->dbh;
    my ($value) = $dbh->selectrow_array(
            "SELECT value 
               FROM priority
              WHERE id = ?",
              undef, $id);
    return $value;
}

sub lookup_priority_by_value {
    my ($value) = @_;
    my $dbh = Bugzilla->dbh;
    my ($id) = $dbh->selectrow_array(
            "SELECT id 
               FROM priority
              WHERE value = ?",
              undef, $value);
    return $id;
}

sub lookup_default_tester {
    my ($id) = @_;
    my $dbh = Bugzilla->dbh;
    my ($value) = $dbh->selectrow_array(
            "SELECT login_name 
               FROM profiles
              WHERE userid = ?",
              undef, $id);
    return $value;
}

###############################
####       Methods         ####
###############################


=head2 get_selectable_components

Returns a reference to a list of selectable components not already
associated with this case. 

=cut

sub get_selectable_components {
    my $self = shift;
    my ($byid) = @_;
    my $dbh = Bugzilla->dbh;
    my @exclusions;
    unless ($byid) {
        foreach my $e (@{$self->components}){
            push @exclusions, $e->{'id'};
        }
    }
    my $query = "SELECT id FROM components
                 WHERE product_id IN (" . join(",", @{$self->get_product_ids}) . ") ";
    if (@exclusions){
        $query .= "AND id NOT IN(". join(",", @exclusions) .") ";
    }
    $query .= "ORDER BY name";
    
    my $ref = $dbh->selectcol_arrayref($query);
    my @comps;
    push @comps, {'id' => '0', 'name' => '--Please Select--'} unless $byid;
    foreach my $id (@$ref){
        push @comps, Bugzilla::Component->new($id);
    }
    return \@comps;
}

=head2 get_category_list

Returns a list of categories associated with products in all
plans referenced by this case.

=cut

sub get_category_list{
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    
    my $ids = $dbh->selectcol_arrayref(
        "SELECT category_id 
           FROM test_case_categories 
          WHERE product_id IN (". join(",", @{$self->get_product_ids}) .")");
    my @categories;
    foreach my $c (@$ids){
        push @categories, Bugzilla::Testopia::Category->new($c);
    }
    return \@categories;    
}

=head2 get_product_ids

Returns the list of product ids that this case is associated with

=cut

sub get_product_ids {
    my $self = shift;
    
    if ($self->id == 0){
        my @ids;
        foreach my $plan (@{$self->plans}){
            push @ids, $plan->product_id if Bugzilla->user->can_see_product($plan->product->name);
        }
        return \@ids;
    }
    
    my $dbh = Bugzilla->dbh;
    
    my $ref = $dbh->selectcol_arrayref(
            "SELECT DISTINCT products.id FROM products
               JOIN test_plans AS plans ON plans.product_id = products.id
               JOIN test_case_plans ON plans.plan_id = test_case_plans.plan_id
               JOIN test_cases AS cases ON cases.case_id = test_case_plans.case_id  
              WHERE cases.case_id = ?
              ORDER BY products.id", undef, $self->{'case_id'});
    return $ref;
}

=head2 get_status_list

Returns the list of legal statuses for a test case

=cut

sub get_status_list {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectall_arrayref("
        SELECT case_status_id AS id, name 
        FROM test_case_status", {"Slice"=>{}});
    return $ref
}

=head2 get_priority_list

Returns a list of legal priorities

=cut

sub get_priority_list {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectall_arrayref("
        SELECT id, value AS name FROM priority
        ORDER BY sortkey", {"Slice"=>{}});
    return $ref
}

=head2 get_caserun_count

Takes a status and returns the count of that status

=cut

sub get_caserun_count {
    my $self = shift;
    my ($status) = @_;
    my $dbh = Bugzilla->dbh;
    
    my $query = "SELECT COUNT(*) 
                   FROM test_case_runs 
                  WHERE case_id = ? ";
       $query .= "AND case_run_status_id = ?" if $status;
       
    my $count;
    if ($status){
        ($count) = $dbh->selectrow_array($query,undef,($self->id,$status));
    }
    else {
        ($count) = $dbh->selectrow_array($query,undef,$self->id);
    }
    return $count;
}

=head2 add_tag

Associates a tag with this test case

=cut

sub add_tag {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my @tags;
    foreach my $t (@_){
         push @tags, split(',', $t);
    }

    foreach my $name (@tags){
        my $tag = Bugzilla::Testopia::TestTag->create({'tag_name' => $name});
        $tag->attach($self);
    }
}

=head2 remove_tag

Disassociates a tag from this test case

=cut

sub remove_tag {    
    my $self = shift;
    my ($tag_id) = @_;
    my $dbh = Bugzilla->dbh;
    $dbh->do("DELETE FROM test_case_tags 
              WHERE tag_id=? AND case_id=?",
              undef, $tag_id, $self->{'case_id'});
    return;
}

=head2 attach_bug

Attaches the specified bug to this test case

=cut

sub attach_bug {
    my $self = shift;
    my ($bugids, $case_id) = @_;
    my $dbh = Bugzilla->dbh;
    
    $case_id ||= $self->{'case_id'};
    $bugids = $self->_check_bugs($bugids);
    
    $dbh->bz_lock_tables('test_case_bugs WRITE');
    
    foreach my $bug (@$bugids){
        $dbh->do("INSERT INTO test_case_bugs (bug_id, case_run_id, case_id)
                  VALUES(?,?,?)", undef, ($bug, undef, $self->id));
    }

    $dbh->bz_unlock_tables();
}

=head2 detach_bug

Removes the association of the specified bug from this test case-run

=cut

sub detach_bug {
    my $self = shift;
    my ($bug) = @_;
    my $dbh = Bugzilla->dbh;

    $dbh->do("DELETE FROM test_case_bugs 
               WHERE bug_id = ? 
                 AND case_id = ?", 
             undef, ($bug, $self->{'case_id'}));
}

=head2 add_component

Associates a component with this test case

=cut

sub add_component {
    my $self = shift;
    my ($compids, $validated) = @_;
    my $dbh = Bugzilla->dbh;
    my $comps = $validated ? $compids : $self->_check_components($compids);   
    foreach my $id (@$comps){
        
        $dbh->do("INSERT INTO test_case_components (case_id, component_id)
                  VALUES (?,?)",undef,  $self->{'case_id'}, $id);
    }
    
    delete $self->{'components'};          
}

sub add_to_run {
    my $self = shift;
    my ($runids) = @_;
    my $runs = $self->_check_runs($runids);
     
    foreach my $run (@$runs){
        $run->add_case_run($self->id);
    }
}

=head2 remove_component

Disassociates a component with this test case

=cut

sub remove_component {
    my $self = shift;
    my ($comp_id) = @_;
    my $dbh = Bugzilla->dbh;
    $dbh->do("DELETE FROM test_case_components
              WHERE case_id = ? AND component_id = ?",
              undef,  $self->{'case_id'}, $comp_id);    
}

=head2 compare_doc_versions

Returns a unified diff of two versions of a case document (action 
and effect). It takes two arguments both integers representing
the first and second versions to compare.

=cut

sub compare_doc_versions {
    my $self = shift;
    my ($newversion, $oldversion) = @_;
    detaint_natural($newversion);
    detaint_natural($oldversion);
    my $dbh = Bugzilla->dbh;
    my %diff;
    my ($newaction, $neweffect, $newsetup, $newbreakdown) = $dbh->selectrow_array(
            "SELECT action, effect, setup, breakdown FROM test_case_texts
             WHERE case_id = ? AND case_text_version = ?",
             undef, $self->{'case_id'}, $newversion);
    
    my ($oldaction, $oldeffect, $oldsetup, $oldbreakdown) = $dbh->selectrow_array(
            "SELECT action, effect, setup, breakdown FROM test_case_texts
             WHERE case_id = ? AND case_text_version = ?",
             undef, $self->{'case_id'}, $oldversion);
    $diff{'action'} = diff(\$newaction, \$oldaction);
    $diff{'effect'} = diff(\$neweffect, \$oldeffect);
    $diff{'setup'} = diff(\$newsetup, \$oldsetup);
    $diff{'breakdown'} = diff(\$newbreakdown, \$oldbreakdown);
    return \%diff;
}

=head2 diff_case_doc

Returns the diff of the latest case document (action and effect) 
with some text passed as an argument. Used to determine if the 
text has changed and thus requiring a new version be created.

=cut

sub diff_case_doc {
    my $self = shift;
    my ($newaction, $neweffect, $newsetup, $newbreakdown) = @_;
    my $dbh = Bugzilla->dbh;
    my ($oldaction, $oldeffect, $oldsetup, $oldbreakdown) = $dbh->selectrow_array(
            "SELECT action, effect, setup, breakdown
               FROM test_case_texts
              WHERE case_id = ? AND case_text_version = ?",
             undef, ($self->{'case_id'}, $self->version));
    my $diff = diff(\$newaction, \$oldaction);
    $diff .= diff(\$neweffect, \$oldeffect);
    $diff .= diff(\$newsetup, \$oldsetup);
    $diff .= diff(\$newbreakdown, \$oldbreakdown);
    return $diff
}

=head2 get_fields

Returns a reference to a list of test case field descriptions from 
the test_fielddefs table. 

=cut

sub get_fields {
    my $self = shift;
    my $dbh = Bugzilla->dbh;    

    my $types = $dbh->selectall_arrayref(
            "SELECT fieldid AS id, description AS name 
             FROM test_fielddefs 
             WHERE table_name=?", 
             {"Slice"=>{}}, "test_cases");
    return $types;
}

=head2 store

Stores a test case object in the database. This method is used to store a 
newly created test case. It returns the new ID.

=cut

sub store {
    my $self = shift;
    my $dbh = Bugzilla->dbh;    
    # Exclude the auto-incremented field from the column list.
    my $columns = join(", ", grep {$_ ne 'case_id'} DB_COLUMNS);
    my ($timestamp) = Bugzilla::Testopia::Util::get_time_stamp();

    $dbh->do("INSERT INTO test_cases ($columns) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              undef,                      ## Database Column ##
              ($self->{'case_status_id'},    # case_status_id
               $self->{'category_id'},       # category_id
               $self->{'priority_id'},       # priority_id 
               $self->{'author_id'},         # author_id 
               $self->{'default_tester_id'}, # default_tester_id
               $timestamp,                   # creation_date 
               $self->{'estimated_time'},    # estimated_time 
               $self->{'isautomated'},       # isautomated 
               $self->sortkey,               # sortkey 
               $self->{'script'},            # script
               $self->{'arguments'},         # arguments 
               $self->{'summary'},           # summary 
               $self->{'requirement'},       # requirement
               $self->{'alias'},             # alias
              ));
    my $key = $dbh->bz_last_key( 'test_cases', 'case_id' );

    $self->store_text($key, $self->{'author_id'}, $self->{'action'}, $self->{'effect'},  
                      $self->{'setup'}, $self->{'breakdown'},0 ,$timestamp);
    $self->update_deps($self->{'dependson'}, $self->{'blocks'}, $key);    
    foreach my $p (@{$self->{'plans'}}){
        $self->link_plan($p->id, $key);
    }
    return $key;
}

=head2 store_text

Stores the test case document (action and effect) in the test_case_texts 
table. Used by both store and copy. Accepts the the test case id,
author id, action text, effect text, and an optional timestamp. 

=cut

sub store_text {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my ($key, $author, $action, $effect, $setup, $breakdown, $reset_version, $timestamp) = @_;
    if (!defined $timestamp){
        ($timestamp) = Bugzilla::Testopia::Util::get_time_stamp();
    }
    trick_taint($action);
    trick_taint($effect);
    trick_taint($breakdown);
    trick_taint($setup);
    
    my $version = $reset_version ? 0 : $self->version || 0;
    $dbh->do("INSERT INTO test_case_texts 
              (case_id, case_text_version, who, creation_ts, action, effect, setup, breakdown) 
              VALUES(?,?,?,?,?,?,?,?)",
              undef, $key, ++$version, $author, 
              $timestamp, $action, $effect, $setup, $breakdown);
    $self->{'version'} = $version;
    return $self->{'version'};

}

=head2 link_plan

Creates a link to the specified plan id. Optionally can create a link
for an arbitrary test case, not just this one.

=cut

sub link_plan {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my ($plan_id, $case_id) = @_;
    $case_id = $self->{'case_id'} unless defined $case_id;
    
    #Check that it isn't linked already

    $dbh->bz_lock_tables('test_case_plans WRITE');
    my ($is) = $dbh->selectrow_array(
            "SELECT 1 
               FROM test_case_plans
              WHERE case_id = ?
                AND plan_id = ?",
               undef, ($case_id, $plan_id));
    if ($is) {
        $dbh->bz_unlock_tables();
        return;
    }
    $dbh->do("INSERT INTO test_case_plans (plan_id, case_id) 
              VALUES (?,?)", undef, $plan_id, $case_id);
    $dbh->bz_unlock_tables();
    
    # Update the plans array to include new plan added.
        
       push @{$self->{'plans'}}, Bugzilla::Testopia::TestPlan->new($plan_id);

}


=head2 unlink_plan

Removes the link to the specified plan id. 

=cut

sub unlink_plan {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my ($plan_id) = @_;
    my $plan = Bugzilla::Testopia::TestPlan->new($plan_id);

    if (scalar @{$self->plans} == 1){
        $self->obliterate;
        return 1;
    }

    $dbh->bz_lock_tables('test_case_plans WRITE', 'test_case_runs WRITE', 
                         'test_runs READ', 'test_plans READ');
    
    foreach my $run (@{$plan->test_runs}){
        $dbh->do("DELETE FROM test_case_runs 
                   WHERE case_id = ? 
                     AND run_id = ?", undef, $self->id, $run->id);
    }
    
    $dbh->do("DELETE FROM test_case_plans 
               WHERE plan_id = ? 
                 AND case_id = ?", 
                 undef, $plan_id, $self->{'case_id'});
    
    $dbh->bz_unlock_tables();   

    # Update the plans array.
    delete $self->{'plans'}; 

      return 1;    
}

=head2 copy

Creates a copy of this test case. Accepts the plan id to link to and 
a boolean representing whether to copy the case document as well.

=cut

sub copy {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my ($planid, $author, $copydoc) = @_;
    # Exclude the auto-incremented field from the column list.
    my $columns = join(", ", grep {$_ ne 'case_id'} DB_COLUMNS);
    my ($timestamp) = Bugzilla::Testopia::Util::get_time_stamp();

    $dbh->do("INSERT INTO test_cases ($columns) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              undef, 
              ($self->{'case_status_id'},    # case_status_id
               $self->{'category_id'},       # category_id
               $self->{'priority_id'},       # priority_id 
               $author,                      # author_id 
               $self->{'default_tester_id'}, # default_tester_id
               $timestamp,                   # creation_date 
               $self->{'estimated_time'},    # estimated_time 
               $self->{'isautomated'},       # isautomated 
               $self->sortkey,               # sortkey 
               $self->{'script'},            # script
               $self->{'arguments'},         # arguments 
               $self->{'summary'},           # summary 
               $self->{'requirement'},       # requirement
               undef                         # alias
              ));

    my $key = $dbh->bz_last_key( 'test_cases', 'case_id' );
    
    if ($copydoc){
        $self->store_text($key, Bugzilla->user->id, $self->text->{'action'}, 
                          $self->text->{'effect'}, $self->text->{'setup'}, 
                          $self->text->{'breakdown'},'VRESET' , $timestamp);
    }
    
    return $key;
    
}

=head2 check_alias

Checks if the given alias exists already. Returns the case_id of
the matching case if it does.

=cut



=head2 class_check_alias

Checks if the given alias exists already. Returns the case_id of
the matching test case if it does.

=cut

sub class_check_alias {
    my ($alias) = @_;
    
    return unless $alias;
    
    my $dbh = Bugzilla->dbh;
    my ($id) = $dbh->selectrow_array(
            "SELECT case_id 
               FROM test_cases 
              WHERE alias = ?",
              undef, ($alias));

    return $id;
}

=head2 update

Updates this test case with new values supplied by the user.
Accepts a reference to a hash with keys identical to a test cases
fields and values representing the new values entered.
Validation tests should be performed on the values 
before calling this method. If a field is changed, a history 
of that change is logged in the test_case_activity table.

=cut


=head2 history

Returns a reference to a list of history entries from the 
test_case_activity table.

=cut

sub history {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectall_arrayref(
            "SELECT defs.description AS what, 
                    p.login_name AS who, a.changed, a.oldvalue, a.newvalue
               FROM test_case_activity AS a
               JOIN test_fielddefs AS defs ON a.fieldid = defs.fieldid
               JOIN profiles AS p ON a.who = p.userid
              WHERE a.case_id = ?",
              {'Slice'=>{}}, $self->{'case_id'});

    foreach my $row (@$ref){
        if ($row->{'what'} eq 'Case Status'){
            $row->{'oldvalue'} = $self->lookup_status($row->{'oldvalue'});
            $row->{'newvalue'} = $self->lookup_status($row->{'newvalue'});
        }
        elsif ($row->{'what'} eq 'Category'){
            $row->{'oldvalue'} = $self->lookup_category($row->{'oldvalue'});
            $row->{'newvalue'} = $self->lookup_category($row->{'newvalue'});
        }
        elsif ($row->{'what'} eq 'Priority'){
            $row->{'oldvalue'} = $self->lookup_priority($row->{'oldvalue'});
            $row->{'newvalue'} = $self->lookup_priority($row->{'newvalue'});
        }
        elsif ($row->{'what'} eq 'Default Tester'){
            $row->{'oldvalue'} = $self->lookup_default_tester($row->{'oldvalue'});
            $row->{'newvalue'} = $self->lookup_default_tester($row->{'newvalue'});
        }
    }        
    return $ref;
}

sub last_changed {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    
    my ($date) = $dbh->selectrow_array(
            "SELECT MAX(changed)
               FROM test_case_activity 
              WHERE case_id = ?",
              undef, $self->id);
    
    return $self->{'creation_date'} unless $date;
    return $date;
    
}


# From process bug
sub _snap_shot_deps {
    my ($i, $target, $me) = (@_);
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectcol_arrayref(
        "SELECT $target 
         FROM test_case_dependencies 
         WHERE $me = ? ORDER BY $target", undef, $i);
    
    return join(',', @{$ref});
}

# Taken from Bugzilla::Bug
sub _get_dep_lists {
    my ($myfield, $targetfield, $case_id) = (@_);
    my $dbh = Bugzilla->dbh;
    my $list_ref =
        $dbh->selectcol_arrayref(
          "SELECT test_case_dependencies.$targetfield
             FROM test_case_dependencies
             JOIN test_cases ON test_cases.case_id = test_case_dependencies.$targetfield
            WHERE test_case_dependencies.$myfield = ?
         ORDER BY test_case_dependencies.$targetfield",
         undef, ($case_id));
    return $list_ref;
}

sub update_deps {
    my $self = shift;
    my ($dependson, $blocks, $case_id) = @_;
    $case_id = $self->{'case_id'} unless $case_id;
    my $dbh = Bugzilla->dbh;
    my $fields = {};
    $fields->{'dependson'} = $dependson;
    $fields->{'blocked'} = $blocks;
# From process bug
    foreach my $field ("dependson", "blocked") {
        if ($fields->{$field}) {
            my @validvalues;
            foreach my $id (split(/[\s,]+/, $fields->{$field})) {
                next unless $id;
                Bugzilla::Testopia::Util::validate_test_id($id, 'case');
                push(@validvalues, $id);
            }
            $fields->{$field} = join(",", @validvalues);
        }
    }
#From Bug.pm sub ValidateDependencies($$$)
#    my $fields = {};
#    $fields->{'dependson'} = shift;
#    $fields->{'blocked'} = shift;
    my $id = $case_id || 0;

    unless (defined($fields->{'dependson'})
            || defined($fields->{'blocked'}))
    {
        return;
    }

    my %deps;
    my %deptree;
    foreach my $pair (["blocked", "dependson"], ["dependson", "blocked"]) {
        my ($me, $target) = @{$pair};
        $deptree{$target} = [];
        $deps{$target} = [];
        next unless $fields->{$target};

        my %seen;
        foreach my $i (split('[\s,]+', $fields->{$target})) {
            if ($id == $i) {
                ThrowUserError("dependency_loop_single");
            }
            if (!exists $seen{$i}) {
                push(@{$deptree{$target}}, $i);
                $seen{$i} = 1;
            }
        }
        # populate $deps{$target} as first-level deps only.
        # and find remainder of dependency tree in $deptree{$target}
        @{$deps{$target}} = @{$deptree{$target}};
        my @stack = @{$deps{$target}};
        while (@stack) {
            my $i = shift @stack;
            my $dep_list =
                $dbh->selectcol_arrayref("SELECT $target
                                          FROM test_case_dependencies
                                          WHERE $me = ?", undef, $i);
            foreach my $t (@$dep_list) {
                # ignore any _current_ dependencies involving this test_case,
                # as they will be overwritten with data from the form.
                if ($t != $id && !exists $seen{$t}) {
                    push(@{$deptree{$target}}, $t);
                    push @stack, $t;
                    $seen{$t} = 1;
                }
            }
        }
    }

    my @deps   = @{$deptree{'dependson'}};
    my @blocks = @{$deptree{'blocked'}};
    my @union = ();
    my @isect = ();
    my %union = ();
    my %isect = ();
    foreach my $b (@deps, @blocks) { $union{$b}++ && $isect{$b}++ }
    @union = keys %union;
    @isect = keys %isect;
    if (scalar(@isect) > 0) {
        my $both = "";
        foreach my $i (@isect) {
           $both .= "<a href=\"tr_show_case.cgi?case_id=$i\">$i</a> " ;
        }
        ThrowUserError("dependency_loop_multi", { both => $both });
    }

#from process_bug
    foreach my $pair ("blocked/dependson", "dependson/blocked") {
        my ($me, $target) = split("/", $pair);

        my @oldlist = @{$dbh->selectcol_arrayref("SELECT $target FROM test_case_dependencies
                                                  WHERE $me = ? ORDER BY $target",
                                                  undef, $id)};
#        @dependencychanged{@oldlist} = 1;

        if (defined $fields->{$target}) {
            my %snapshot;
            my @newlist = sort {$a <=> $b} @{$deps{$target}};
#            @dependencychanged{@newlist} = 1;

            while (0 < @oldlist || 0 < @newlist) {
                if (@oldlist == 0 || (@newlist > 0 &&
                                      $oldlist[0] > $newlist[0])) {
                    $snapshot{$newlist[0]} = _snap_shot_deps($newlist[0], $me,
                                                          $target);
                    shift @newlist;
                } elsif (@newlist == 0 || (@oldlist > 0 &&
                                           $newlist[0] > $oldlist[0])) {
                    $snapshot{$oldlist[0]} = _snap_shot_deps($oldlist[0], $me,
                                                          $target);
                    shift @oldlist;
                } else {
                    if ($oldlist[0] != $newlist[0]) {
                        die "Error in list comparing code";
                    }
                    shift @oldlist;
                    shift @newlist;
                }
            }
            my @keys = keys(%snapshot);
            if (@keys) {
                my $oldsnap = _snap_shot_deps($id, $target, $me);
                $dbh->do("DELETE FROM test_case_dependencies WHERE $me = ?", undef, $id);
                foreach my $i (@{$deps{$target}}) {
                    $dbh->do("INSERT INTO test_case_dependencies ($me, $target) VALUES (?,?)", undef, $id, $i);
                }
#                foreach my $k (@keys) {
#                    LogDependencyActivity($k, $snapshot{$k}, $me, $target, $timestamp);
#                }
#                LogDependencyActivity($id, $oldsnap, $target, $me, $timestamp);
#                $check_dep_bugs = 1;
            }
        }
    }  
}

=head2 get_dep_tree

Returns a list of test case dependencies 

=cut

sub get_dep_tree {
    my $self = shift;
    $self->{'dep_list'} = ();
    $self->_generate_dep_tree($self->{'case_id'});
    return $self->{'dep_list'};
}

=head2 _generate_dep_tree

Private method that recursivly gets a list of the test cases this blocks

=cut

sub _generate_dep_tree {
    my $self = shift;
    my ($case_id) = @_;
    my $deps = _get_dep_lists("dependson", "blocked", $case_id);
    return unless scalar @$deps;
    foreach my $id (@$deps){
        $self->_generate_dep_tree($id);
        push @{$self->{'dep_list'}}, $id
    }
}

=head2 obliterate

Removes this case and all things that reference it.

=cut

sub obliterate {
    my $self = shift;
    my $dbh = Bugzilla->dbh;

    foreach my $obj (@{$self->attachments}){
        $obj->obliterate;
    }
    foreach my $obj (@{$self->caseruns}){
        $obj->obliterate;
    }

    $dbh->do("DELETE FROM test_case_texts WHERE case_id = ?", undef, $self->id);
    $dbh->do("DELETE FROM test_case_plans WHERE case_id = ?", undef, $self->id);
    $dbh->do("DELETE FROM test_case_components WHERE case_id = ?", undef, $self->id);
    $dbh->do("DELETE FROM test_case_tags WHERE case_id = ?", undef, $self->id);
    $dbh->do("DELETE FROM test_case_bugs WHERE case_id = ?", undef, $self->id);
    $dbh->do("DELETE FROM test_case_activity WHERE case_id = ?", undef, $self->id);
    $dbh->do("DELETE FROM test_case_dependencies
               WHERE dependson = ? OR blocked = ?", undef, ($self->id, $self->id));
    $dbh->do("DELETE FROM test_cases WHERE case_id = ?", undef, $self->id);
    return 1;
}

=head2 canview

Returns true if the logged in user has rights to view this test case.

=cut

sub canview {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('Testers');
    return 1 if $self->get_user_rights(Bugzilla->user->id) & TR_READ;
    return 0;
}

=head2 canedit

Returns true if the logged in user has rights to edit this test case.

=cut

sub canedit {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('Testers');
    return 1 if $self->get_user_rights(Bugzilla->user->id) & TR_WRITE;
    return 0;
}

=head2 candelete

Returns true if the logged in user has rights to delete this test case.

=cut

sub candelete {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('admin');
    return 0 unless Bugzilla->params->{"allow-test-deletion"};
    return 1 if Bugzilla->user->in_group('Testers') && Bugzilla->params->{"testopia-allow-group-member-deletes"};
    # Otherwise, check for delete rights on all the plans this is linked to
    my $own_all = 1;
    foreach my $plan (@{$self->plans}){
        if (!($plan->get_user_rights(Bugzilla->user->id) & TR_DELETE)) {
            $own_all = 0;
            last;
        }
    }
    return 1 if $own_all;
    return 0;
}

=head2 can_unlink_plan

Returns true if this test case can be unlinked from the given plan

=cut

sub can_unlink_plan {
    my $self = shift;
    my ($plan_id) = @_;
    
    my $plan = Bugzilla::Testopia::TestPlan->new($plan_id);
    return 1 if Bugzilla->user->in_group('admin');
    return 1 if Bugzilla->user->in_group('Testers') && Bugzilla->params->{"testopia-allow-group-member-deletes"};
    return 1 if $plan->get_user_rights(Bugzilla->user->id) & TR_DELETE;
    return 0;
}

sub get_user_rights {
    my $self = shift;
    my ($userid) = @_;
    my $dbh = Bugzilla->dbh;
    
    my $plan_ids = $dbh->selectcol_arrayref(
        "SELECT plan_id FROM test_case_plans WHERE case_id = ?",
        undef, $self->id);
    
    return 0 unless $plan_ids;
    $plan_ids = join(',',@$plan_ids);
     
    my ($perms) = $dbh->selectrow_array(
        "SELECT MAX(permissions) FROM test_plan_permissions
           LEFT JOIN test_case_plans ON test_plan_permissions.plan_id = test_case_plans.plan_id
          INNER JOIN test_cases ON test_case_plans.case_id = test_cases.case_id 
          WHERE userid = ? AND test_plan_permissions.plan_id IN ($plan_ids)", 
          undef, $userid);

    return $perms;
}
###############################
####      Accessors        ####
###############################

=head1 ACCESSOR METHODS

=head2 id

Returns the ID of this object

=head2 author

Returns a Bugzilla::User object representing the Author of this case

=head2 default_tester

Returns a Bugzilla::User object representing the run's default tester

=head2 creation_date

Returns the creation time stamp of this object

=head2 isautomated

Returns true if this is an automatic test case

=head2 script

Returns the script of this object

=head2 status_id

Returns the status_id of this object

=head2 arguments

Returns the arguments for the script of this object

=head2 summary

Returns the summary of this object

=head2 requirements

Returns the requirements of this object

=head2 alias

Returns the alias of this object

=cut

sub id              { return $_[0]->{'case_id'};       }
sub author          { return Bugzilla::User->new($_[0]->{'author_id'});  }
sub default_tester  { return Bugzilla::User->new($_[0]->{'default_tester_id'});  }
sub creation_date   { return $_[0]->{'creation_date'}; }
sub estimated_time  { return $_[0]->{'estimated_time'}; }
sub isautomated     { return $_[0]->{'isautomated'};   }
sub script          { return $_[0]->{'script'};        }
sub status_id       { return $_[0]->{'case_status_id'};}
sub arguments       { return $_[0]->{'arguments'};     }
sub summary         { return $_[0]->{'summary'};       }
sub requirement     { return $_[0]->{'requirement'};   }
sub alias           { return $_[0]->{'alias'};         }

=head2 type

Returns 'case'

=cut

sub type {
    my $self = shift;
    $self->{'type'} = 'case';
    return $self->{'type'};
}

=head2 attachments

Returns a reference to a list of attachments associated with this
case.

=cut

sub attachments {
    my ($self) = @_;
    my $dbh = Bugzilla->dbh;
    return $self->{'attachments'} if exists $self->{'attachments'};

    my $attachments = $dbh->selectcol_arrayref(
        "SELECT attachment_id
           FROM test_case_attachments
          WHERE case_id = ?", 
         undef, $self->{'case_id'});
    
    my @attachments;
    foreach my $a (@{$attachments}){
        push @attachments, Bugzilla::Testopia::Attachment->new($a);
    }
    $self->{'attachments'} = \@attachments;
    return $self->{'attachments'};
    
}

=head2 version

Returns the case text version. This number is incremented any time
changes are made to the case docs (action and effect).

=cut

sub version { 
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'version'} if exists $self->{'version'};
    my ($ver) = $dbh->selectrow_array("SELECT MAX(case_text_version)
                                       FROM test_case_texts
                                       WHERE case_id = ?", 
                                       undef, $self->{'case_id'});
    $self->{'version'} = $ver;
    return $self->{'version'};
}

=head2 status

Looks up the case status based on the case_status_id of this case.

=cut

sub status { 
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'status'} if exists $self->{'status'};
    my ($res) = $dbh->selectrow_array("SELECT name
                                       FROM test_case_status
                                       WHERE case_status_id = ?", 
                                       undef, $self->{'case_status_id'});
    $self->{'status'} = $res;
    return $self->{'status'};
}

=head2 priority

Looks up the Bugzilla priority value based on the priority_id 
of this case.

=cut

sub priority { 
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'priority'} if exists $self->{'priority'};
    my ($res) = $dbh->selectrow_array("SELECT value
                                       FROM priority
                                       WHERE id = ?", 
                                       undef, $self->{'priority_id'});
    $self->{'priority'} = $res;
    return $self->{'priority'};
}

=head2 category

Returns the category name based on the category_id of this case

=cut

sub category {
    my $self = shift;
    return $self->{'category'} if exists $self->{'category'};
    $self->{'category'} = Bugzilla::Testopia::Category->new($self->{'category_id'});
    return $self->{'category'};
}

=head2 components

Returns a reference to a list of bugzilla components assoicated with 
this test case.

=cut

sub components {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'components'} if exists $self->{'components'};
    my $comps = $dbh->selectcol_arrayref(
        "SELECT comp.id 
           FROM components AS comp
           JOIN test_case_components AS tcc ON tcc.component_id = comp.id
           JOIN test_cases ON tcc.case_id = test_cases.case_id
          WHERE test_cases.case_id = ?", 
         {'Slice' => {}},  $self->{'case_id'}); 
    
    my @comps;
    foreach my $id (@$comps){
        my $comp = Bugzilla::Component->new($id);
        my $prod = Bugzilla::Product->new($comp->product_id);
        $comp->{'product_name'} = $prod->name;
        push @comps, $comp;
    }
    $self->{'components'} = \@comps;
    return $self->{'components'};
}

=head2 tags

Returns a reference to a list of Bugzilla::Testopia::TestTag objects 
associated with this case.

=cut

sub tags {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'tags'} if exists $self->{'tags'};
    my $tagids = $dbh->selectcol_arrayref("SELECT test_case_tags.tag_id 
                                          FROM test_case_tags
                                          INNER JOIN test_tags ON test_case_tags.tag_id = test_tags.tag_id
                                          WHERE case_id = ?
                                          ORDER BY test_tags.tag_name", 
                                          undef, $self->{'case_id'});
    my @tags;
    foreach my $id (@{$tagids}){
        push @tags, Bugzilla::Testopia::TestTag->new($id);
    }
    $self->{'tags'} = \@tags;
    return $self->{'tags'};
}

=head2 plans

Returns a reference to a list of Bugzilla::Testopia::TestPlan objects 
associated with this case.

=cut

sub plans {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'plans'} if exists $self->{'plans'};
    my $ref = $dbh->selectcol_arrayref("SELECT plan_id
                                       FROM test_case_plans
                                       WHERE case_id = ?", 
                                       undef, $self->{'case_id'});
    my @plans;
    foreach my $id (@{$ref}){
        push @plans, Bugzilla::Testopia::TestPlan->new($id);
    }
    $self->{'plans'} = \@plans;
    return $self->{'plans'};
}

=head2 bugs

Returns a reference to a list of Bugzilla::Bug objects 
associated with this case.

=cut

sub bugs {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'bugs'} if exists $self->{'bugs'};
    my $ref = $dbh->selectcol_arrayref(
        "SELECT DISTINCT bug_id
           FROM test_case_bugs 
          WHERE case_id = ?", 
         undef, $self->{'case_id'});
    my @bugs;
    foreach my $id (@{$ref}){
        push @bugs, Bugzilla::Bug->new($id, Bugzilla->user->id) if Bugzilla->user->can_see_bug($id);
    }
    $self->{'bugs'} = \@bugs;
    return $self->{'bugs'};
}

=head2 bug_list

Returns a comma separated list of bug ids associated with this case

=cut

sub bug_list {
    my $self = shift;
    return $self->{'bug_list'} if exists $self->{'bug_list'};
    my $dbh = Bugzilla->dbh;
    my @bugs;
    my $bugids = $dbh->selectcol_arrayref("SELECT bug_id 
                                     FROM test_case_bugs 
                                     WHERE case_id=?", 
                                     undef, $self->id);
    my @visible;
    foreach my $bugid (@{$bugids}){
        push @visible, $bugid if Bugzilla->user->can_see_bug($bugid);
    }
    $self->{'bug_list'} = join(",", @$bugids);
    
    return $self->{'bug_list'};
}

=head2 text

Returns a hash reference representing the action and effect of this
case.

=cut


sub text {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'text'} if exists $self->{'text'};
    my $text = $dbh->selectrow_hashref(
        "SELECT action, effect, setup, breakdown, who AS author_id, case_text_version AS version
           FROM test_case_texts
          WHERE case_id=? AND case_text_version=?",
        undef, $self->{'case_id'}, 
        $self->version);
    $self->{'text'} = $text;
    return $self->{'text'};
}

=head2 runs

Returns a reference to a list of Bugzilla::Testopia::TestRun objects 
associated with this case.

=cut

sub runs {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'runs'} if exists $self->{'runs'};
    my $ref = $dbh->selectcol_arrayref(
      "SELECT DISTINCT t.run_id
       FROM test_runs t
       INNER JOIN  test_case_runs r ON r.run_id = t.run_id
       WHERE case_id = ?", 
       undef, $self->{'case_id'});
    my @runs;
    foreach my $id (@{$ref}){
        push @runs, Bugzilla::Testopia::TestRun->new($id);
    }
    $self->{'runs'} = \@runs;
    return $self->{'runs'};
}

sub run_count {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my ($runcount) = $dbh->selectrow_array(
        "SELECT DISTINCT count(run_id)
           FROM test_case_runs
          WHERE case_id = ?",
          undef, $self->id);
    return $runcount;     
}

=head2 caseruns

Returns a reference to a list of Bugzilla::Testopia::TestCaseRun objects 
associated with this case.

=cut

sub caseruns {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    return $self->{'caseruns'} if exists $self->{'caseruns'};
    my $ref = $dbh->selectcol_arrayref("SELECT case_run_id
                                        FROM test_case_runs 
                                        WHERE case_id = ?", 
                                        undef, $self->{'case_id'});
    my @runs;
    foreach my $id (@{$ref}){
        push @runs, Bugzilla::Testopia::TestCaseRun->new($id);
    }
    $self->{'caseruns'} = \@runs;
    return $self->{'caseruns'};
}

sub sortkey {
    my $self = shift;
    return $self->{'sortkey'} if exists $self->{'sortkey'};
    my $dbh = Bugzilla->dbh;
    my ($sortkey) = $dbh->selectrow_array("SELECT MAX(sortkey) FROM test_cases");
    $self->{'sortkey'} = ++$sortkey;
    return $self->{'sortkey'};
}

=head2 blocked

Returns a reference to a list of Bugzilla::Testopia::TestCase objects 
which are blocked by this test case.

=cut

sub blocked {
    my ($self) = @_;
    return $self->{'blocked'} if exists $self->{'blocked'};
    my @deps;
    my $ref = _get_dep_lists("dependson", "blocked", $self->{'case_id'});
    foreach my $id (@{$ref}){
        push @deps, Bugzilla::Testopia::TestCase->new($id);
    }
    $self->{'blocked'} = \@deps;
    return $self->{'blocked'};
}

sub blocked_list {
    my ($self) = @_;
    return $self->{'blocked_list'} if exists $self->{'blocked_list'};
    my @deps;
    my $ref = _get_dep_lists("dependson", "blocked", $self->{'case_id'});
    $self->{'blocked_list'} = join(",", @$ref);
    return $self->{'blocked_list'};
}

=head2 blocked_list_uncached

Returns a space separated list of test cases that are blocked by this test case.
This method does not cache the blocked test cases so each call will result
in a database read.

=cut

sub blocked_list_uncached {
    my ($self) = @_;
    my $ref = _get_dep_lists("dependson", "blocked", $self->{'case_id'});
    return join(" ", @$ref)
}

=head2 dependson

Returns a reference to a list of Bugzilla::Testopia::TestCase objects 
which depend on this test case.

=cut

sub dependson {
    my ($self) = @_;
    return $self->{'dependson'} if exists $self->{'dependson'};
    my @deps;
    my $ref = _get_dep_lists("blocked", "dependson", $self->{'case_id'});
    foreach my $id (@{$ref}){
        push @deps, Bugzilla::Testopia::TestCase->new($id);
    }
    $self->{'dependson'} = \@deps;
    return $self->{'dependson'};
}    

sub dependson_list {
    my ($self) = @_;
    return $self->{'dependson_list'} if exists $self->{'dependson_list'};
    my @deps;
    my $ref = _get_dep_lists("blocked", "dependson", $self->{'case_id'});
    $self->{'dependson_list'} = join(",", @$ref);
    return $self->{'dependson_list'};
}    

=head2 dependson_list_uncached

Returns a space separated list of test cases that depend on this test case.
This method does not cache the dependent test cases so each call will result
in a database read.

=cut

sub dependson_list_uncached {
    my ($self) = @_;
    my $ref = _get_dep_lists("blocked", "dependson", $self->{'case_id'});
    return join(" ", @$ref)
}

sub calculate_average_time {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $totalseconds;
    my $min = 0;
    my $hours = 0;
    my $sec = 0;
    my $i = 0;
    foreach my $cr (@{$self->caseruns}){
        if ($cr->completion_time){
            $totalseconds += $cr->completion_time;
            $i++;
        }
    }
    
    my $average = $i ? int($totalseconds / $i) : 0;
    $min = int($average/60);
    $sec = $average % 60;
    if ($min > 60){
        $hours = int($min/60);
        $min = $min % 60;
    }
     
    return "$hours:$min:$sec";
}


=head1 TODO

=head1 SEE ALSO

TestPlan, TestRun, TestCaseRun

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>

=cut

1;

__END__

=head1 NAME

Bugzilla::Testopia::TestCase - Testopia Test Case object

=head1 DESCRIPTION

This module represents a test case in Testopia. Each test case must 
be linked to one or more test plans.

=head1 SYNOPSIS

use Bugzilla::Testopia::TestCase;

 $case = Bugzilla::Testopia::TestCase->new($case_id);
 $case = Bugzilla::Testopia::TestCase->new(\%case_hash);

=cut

=head1 FIELDS

    case_id
    case_status_id
    category_id
    priority_id
    author_id
    default_tester_id  
    creation_date
    estimated_time
    isautomated
    sortkey
    script
    arguments
    summary
    requirement
    alias

=cut

=head1 METHODS

=cut
=head2 lookup_status

Takes an ID of the status field and returns the value

=cut
=head2 lookup_status_by_name

Returns the id of the status name passed.

=cut

=head2 lookup_category

Takes an ID of the category field and returns the value

=cut

=head2 lookup_category_by_name

Returns the id of the category name passed.

=cut

=head2 lookup_priority

Takes an ID of the priority field and returns the value

=cut

=head2 lookup_priority_by_name

Returns the id of the priority name passed.

=cut

=head2 lookup_default_tester

Takes an ID of the default_tester field and returns the value

=cut

