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


package Bugzilla::Testopia::TestCaseRun;

use strict;

use Bugzilla::Util;
use Bugzilla::Error;
use Bugzilla::User;
use Bugzilla::Config;
use Bugzilla::Constants;
use Bugzilla::Testopia::Util;
use Bugzilla::Testopia::Constants;
use Bugzilla::Testopia::Attachment;
use Bugzilla::Bug;

use Date::Format;
use Date::Parse;

use base qw(Exporter Bugzilla::Object);

###############################
####    Initialization     ####
###############################

=head1 FIELDS

    case_run_id
    run_id
    case_id
    assignee
    testedby
    case_run_status_id
    case_text_version
    build_id
    environment_id
    notes
    running_date
    close_date
    iscurrent
    sortkey

=cut
use constant DB_TABLE   => "test_case_runs";
use constant ID_FIELD   => "case_run_id";
use constant NAME_FIELD   => "";
use constant DB_COLUMNS => qw(
    case_run_id
    run_id
    case_id
    assignee
    testedby
    case_run_status_id
    case_text_version
    build_id
    environment_id
    notes
    running_date
    close_date
    iscurrent
    sortkey
);

use constant REQUIRED_CREATE_FIELDS => qw(case_id run_id build_id environment_id case_run_status_id);
use constant UPDATE_COLUMNS         => qw(case_run_status_id case_text_version notes sortkey);

use constant VALIDATORS => {
    case_id            => \&_check_case_id,
    build_id           => \&_check_build_id,
    run_id             => \&_check_run_id,
    environment_id     => \&_check_env_id,
    case_text_version  => \&_check_case_text_version,
    case_run_status_id => \&_check_case_run_status_id,
};

sub report_columns {
    my $self = shift;
    my %columns;
    # Changes here need to match Report.pm
    $columns{'Build'}           = "build";
    $columns{'Status'}          = "status";        
    $columns{'Environment'}     = "environment";
    $columns{'Assignee'}        = "assignee";
    $columns{'Tested By'}       = "testedby";
    $columns{'Milestone'}       = "milestone";
    $columns{'Case Tags'}       = "case_tags";
    $columns{'Run Tags'}        = "run_tags";
    $columns{'Requirement'}     = "requirement";
    $columns{'Priority'}        = "priority";
    $columns{'Default tester'}  = "default_tester";
    $columns{'Category'}        = "category";
    $columns{'Component'}       = "component";
    my @result;
    push @result, {'name' => $_, 'id' => $columns{$_}} foreach (sort(keys %columns));
    unshift @result, {'name' => '<none>', 'id'=> ''};
    return \@result;     
        
}
###############################
####       Validators      ####
###############################
sub _check_case_id {
    my ($invocant, $id) = @_;
    return Bugzilla::Testopia::Util::validate_test_id($id, 'case');
}

sub _check_run_id {
    my ($invocant, $id) = @_;
    return Bugzilla::Testopia::Util::validate_test_id($id, 'run');
}

sub _check_build_id {
    my ($invocant, $id) = @_;
    return Bugzilla::Testopia::Util::validate_test_id($id, 'build');
}

sub _check_env_id {
    my ($invocant, $id) = @_;
    return Bugzilla::Testopia::Util::validate_test_id($id, 'environment');
}

sub _check_case_run_status_id {
    my ($invocant, $status) = @_;
    $status = trim($status);
    my $status_id;
    if ($status =~ /^\d+$/){
        $status_id = Bugzilla::Testopia::Util::validate_selection($status, 'case_run_status_id', 'test_case_run_status');
    }
    else {
        $status_id = lookup_status_by_name($status);
    }
    ThrowUserError('invalid_status') unless $status_id;
    return $status_id;
}

sub _check_case_text_version {
    my ($invocant, $version) = @_;
    return $version =~ /\d+/ ? $version : 1; 
}

###############################
####       Mutators        ####
###############################

sub new {
    my $invocant = shift;
    my $class = ref($invocant) || $invocant;
    my ($param, $case_id, $build_id, $env_id) = (@_);
    my $dbh = Bugzilla->dbh;
    
    # We want to be able to supply an empty object to the templates for numerous
    # lists etc. This is much cleaner than exporting a bunch of subroutines and
    # adding them to $vars one by one. Probably just Laziness shining through.
    if (ref $param eq 'HASH'){
        if (!keys %$param || $param->{PREVALIDATED}){
            bless($param, $class);
            return $param;
        }
    }
    elsif ($case_id && detaint_natural($case_id) 
             && $build_id && detaint_natural($build_id) 
             && $env_id && detaint_natural($env_id)){
                 
         my $run_id = $param;
         detaint_natural($case_id) || return undef;
         ($param) = $dbh->selectrow_array(
            "SELECT case_run_id FROM test_case_runs
             WHERE case_id = ?
               AND run_id = ?
               AND build_id = ?
               AND environment_id = ?", 
             undef, ($case_id, $run_id, $build_id, $env_id));
    }
    
    unshift @_, $param;
    my $self = $class->SUPER::new(@_);
    
    return $self; 
}

sub create {
    my ($class, $params) = @_;

    $class->SUPER::check_required_create_fields($params);
    my $field_values = $class->run_create_validators($params);
    
    $field_values->{iscurrent} = 1;
    
    my $self = $class->SUPER::insert_create_data($field_values);

    return $self;
}

###############################
####       Methods         ####
###############################

=head2 check_exists

Checks for an existing entry with the same build and environment for this 
case and run and switches self to that object.

=cut

sub switch {
   my $self = shift;
   my ($build_id, $env_id ,$run_id, $case_id) = @_;
   
   detaint_natural($build_id);
   detaint_natural($env_id);
   detaint_natural($run_id);
   detaint_natural($case_id);

   $run_id   ||= $self->{'run_id'};
   $case_id  ||= $self->{'case_id'};
   $build_id ||= $self->{'build_id'};
   $env_id   ||= $self->{'environment_id'};
   
   my $dbh = Bugzilla->dbh;     
   my ($is) = $dbh->selectrow_array(
        "SELECT case_run_id 
           FROM test_case_runs 
          WHERE run_id = ? 
            AND case_id = ? 
            AND build_id = ?
            AND environment_id = ?",
          undef, ($run_id, $case_id, $build_id, $env_id));

   if ($is){
       $self = Bugzilla::Testopia::TestCaseRun->new($is);
   }
   else {
       my $oldbuild = $self->{'build_id'};
       my $oldenv = $self->{'environment_id'};
       
       $self = $self->create({
                    'run_id'     => $self->{'run_id'},
                    'case_id'    => $self->{'case_id'},
                    'assignee'   => $self->{'assignee'},
                    'case_text_version'  => $self->{'case_text_version'},
                    'build_id'           => $build_id,
                    'environment_id'     => $env_id,
                    'case_run_status_id' => IDLE,
                });
       
       if ($oldbuild != $build_id){
           my $build = Bugzilla::Testopia::Build->new($oldbuild);
           my $note  = "Build Changed by ". Bugzilla->user->login; 
              $note .= ". Old build: '". $build->name;
              $note .= "' New build: '". $self->build->name;
              $note .= "'. Resetting to IDLE.";
           $self->append_note($note);
       }
       if ($oldenv != $env_id){
           my $environment = Bugzilla::Testopia::Environment->new($oldenv);
           my $note  = "Environment Changed by ". Bugzilla->user->login;
              $note .= ". Old environment: '". $environment->name;
              $note .= "' New environment: '". $self->environment->name;
              $note .= "'. Resetting to IDLE.";
           $self->append_note($note);
       }
       $self->set_as_current;
   }
    
   return $self;
}

sub to_json {
    my $self = shift;
    my $obj;
    my $json = new JSON;
    
    $json->autoconv(0);
    
    foreach my $field ($self->DB_COLUMNS){
        $obj->{$field} = $self->{$field};
    }
    
    $obj->{'assignee_name'}  = $self->assignee->login if $self->assignee;
    $obj->{'requirement'}  = $self->case->requirement if $self->case;
    $obj->{'testedby'}  = $self->testedby->login if $self->testedby;
    $obj->{'status'}    = $self->status;
    $obj->{'build_name'}    = $self->build->name if $self->build;
    $obj->{'env_name'}    = $self->environment->name if $self->environment;
    $obj->{'env_id'}    = $self->environment->id if $self->environment;
    $obj->{'category'}    = $self->case->category->name if $self->case && $self->case->category;
    $obj->{'priority'}    = $self->case->priority if $self->case;
    $obj->{'bug_count'}    = $self->bug_count;
    $obj->{'case_summary'}    = $self->case->summary if $self->case;
    $obj->{'component'}    = @{$self->case->components}[0]->name if ($self->case && scalar @{$self->case->components});
    $obj->{'type'}         = $self->type;
    $obj->{'id'}           = $self->id;
    $obj->{'sortkey'}      = $self->sortkey;
    
    return $json->objToJson($obj); 
}

=head2 _update_fields

Update this case-run in the database if a change is made to an 
updatable field.

=cut

sub _update_fields{
    my $self = shift;
    my ($newvalues) = @_;
    my $dbh = Bugzilla->dbh;

    if ($newvalues->{'case_run_status_id'} && $newvalues->{'case_run_status_id'} == FAILED){
        $self->_update_deps(BLOCKED);
    }
    elsif ($newvalues->{'case_run_status_id'} && $newvalues->{'case_run_status_id'} == PASSED){
        $self->_update_deps(IDLE);
    }

    $dbh->bz_lock_tables('test_case_runs WRITE');
    foreach my $field (keys %{$newvalues}){
        $dbh->do("UPDATE test_case_runs 
                  SET $field = ? WHERE case_run_id = ?",
                  undef, $newvalues->{$field}, $self->{'case_run_id'});
    }
    $dbh->bz_unlock_tables();

    return $self->{'case_run_id'};   
}

=head2 set_as_current

Sets this case-run as the current or active one in the history
list of case-runs of this build and case_id

=cut

sub set_as_current {
    my $self = shift;
    my ($caserun) = @_;
    $caserun = $self->{'case_run_id'} unless defined $caserun;
    my $dbh = Bugzilla->dbh;

    $dbh->bz_lock_tables('test_case_runs WRITE');
    $dbh->do("UPDATE test_case_runs
              SET iscurrent = 0
              WHERE case_id = ? AND run_id = ?",
              undef, ($self->case_id, $self->run_id));
              
    $dbh->do("UPDATE test_case_runs
              SET iscurrent = 1
              WHERE case_run_id = ?",
              undef, $caserun);
    $dbh->bz_unlock_tables;
}

=head2 set_status

Sets the status on a case-run and updates the close_date and testedby 
if the status is a closed status.

=cut

sub set_status {
    my $self = shift;
    my ($status_id, $update_bugs) = @_;
    return if $self->status_id == $status_id;
    my $oldstatus = $self->status;
    my $newstatus = $self->lookup_status($status_id);
    
    $self->_update_fields({'case_run_status_id' => $status_id});
    if ($status_id == IDLE){
        $self->_update_fields({'close_date' => undef});
        $self->_update_fields({'testedby' => undef});
        $self->{'close_date'} = undef;
        $self->{'testedby'} = undef;
    }
    elsif ($status_id == RUNNING || $status_id == PAUSED){
        my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();
        $self->_update_fields({'running_date' => $timestamp}) if $status_id == RUNNING; 
        $self->_update_fields({'close_date' => undef});
        $self->{'close_date'} = undef;
    }
    else {
        my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();
        $self->_update_fields({'close_date' => $timestamp});
        $self->_update_fields({'testedby' => Bugzilla->user->id});
        $self->{'close_date'} = $timestamp;
        $self->{'testedby'} = Bugzilla->user->id;
        $self->update_bugs('REOPENED') if ($status_id == FAILED && $update_bugs);
        $self->update_bugs('VERIFIED') if ($status_id == PASSED && $update_bugs);
    }
    $self->set_as_current;
    my $note = "Status changed from $oldstatus to $newstatus by ". Bugzilla->user->login;
    $note .= " for build '". $self->build->name ."' and environment '". $self->environment->name; 
    $self->append_note($note);
    $self->{'case_run_status_id'} = $status_id;
    $self->{'status'} = undef;
}

sub set_sortkey {
    my $self = shift;
    my ($sortkey) = @_;
    my $dbh = Bugzilla->dbh;
    detaint_natural($sortkey);
    $dbh->do("UPDATE test_case_runs SET sortkey = ?
              WHERE case_id = ? AND run_id = ?",
              undef, ($sortkey, $self->case_id, $self->run_id));
    
}

=head2 set_assignee

Sets the assigned tester for the case-run

=cut

sub set_assignee {
    my $self = shift;
    my ($user_id) = @_;
    
    my $oldassignee = $self->assignee->login;
    my $newassignee = Bugzilla::User->new($user_id);
    
    $self->_update_fields({'assignee' => $user_id});
    $self->{'assignee'} = $newassignee;
    
    my $note = "Assignee changed from $oldassignee to ". $newassignee->login;
    $note   .= " by ". Bugzilla->user->login;
    $note   .= " for build '". $self->build->name;
    $note   .= "' and environment '". $self->environment->name;
    $self->append_note($note);
}

=head2 lookup_status

Returns the status name of the given case_run_status_id

=cut

sub lookup_status {
    my $self = shift;
    my ($status_id) = @_;
    detaint_natural($status_id);
    my $dbh = Bugzilla->dbh;
    my ($status) = $dbh->selectrow_array(
            "SELECT name 
               FROM test_case_run_status 
              WHERE case_run_status_id = ?",
              undef, $status_id);
   return $status;
}

=head2 lookup_status_by_name

Returns the id of the status name passed.

=cut

sub lookup_status_by_name {
    my ($name) = @_;
    my $dbh = Bugzilla->dbh;
    
    my ($value) = $dbh->selectrow_array(
            "SELECT case_run_status_id
             FROM test_case_run_status
             WHERE name = ?",
             undef, $name);
    return $value;
}

=head2 append_note

Updates the notes field for the case-run

=cut

sub append_note {
    my $self = shift;
    my ($note) = @_;
    return unless $note;
    my $timestamp = time2str("%c", time());
    $note = "$timestamp: $note";
    if ($self->{'notes'}){
        $note = $self->{'notes'} . "\n" . $note;
    }
    $self->_update_fields({'notes' => $note});
    $self->{'notes'} = $note;
}

=head2 _update_deps

Private method for updating blocked test cases. If the pre-requisite 
case fails, the blocked test cases in a run get a status of BLOCKED
if it passes they are set back to IDLE. This only happens to the
current case run and only if it doesn't already have a closed status.
=cut
 
sub _update_deps {
    my $self = shift;
    my ($status) = @_;
    my $deplist = $self->case->get_dep_tree;
    return unless $deplist;
    
    my $dbh = Bugzilla->dbh;    
    $dbh->bz_lock_tables("test_case_runs WRITE");
    my $caseruns = $dbh->selectcol_arrayref(
       "SELECT case_run_id 
          FROM test_case_runs    
         WHERE iscurrent = 1 
           AND run_id = ? 
           AND case_run_status_id IN(". join(',', (IDLE,RUNNING,PAUSED,BLOCKED)) .") 
           AND case_id IN (". join(',', @$deplist) .")",
           undef, $self->{'run_id'});
    my $sth = $dbh->prepare_cached(
        "UPDATE test_case_runs 
         SET case_run_status_id = ?
       WHERE case_run_id = ?");
    
    foreach my $id (@$caseruns){
        $sth->execute($status, $id);
    }
    $dbh->bz_unlock_tables;
    
    $self->{'updated_deps'} = $caseruns;
}

=head2 get_case_run_list

Returns a reference to a list of case-runs for the given case and run

=cut

sub get_case_run_list {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectcol_arrayref(
            "SELECT case_run_id FROM test_case_runs
             WHERE case_id = ? AND run_id = ?", undef,
             ($self->{'case_id'}, $self->{'run_id'}));

    return $ref;    
}

sub get_history {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectall_arrayref(
            "SELECT tcr.case_run_id, tcr.close_date, tcr.iscurrent, tb.name AS build_name, 
                    te.name as env_name, p.login_name AS testedby, tcrs.name AS status_name   
               FROM test_case_runs tcr
         INNER JOIN test_builds tb ON tcr.build_id = tb.build_id
         INNER JOIN test_environments te ON tcr.environment_id = te.environment_id
         INNER JOIN test_case_run_status tcrs ON tcr.case_run_status_id = tcrs.case_run_status_id
         INNER JOIN profiles p ON tcr.testedby = p.userid 
              WHERE case_id = ? AND run_id = ?", {'Slice' =>{}},
             ($self->{'case_id'}, $self->{'run_id'}));

    return $ref;    
    
}

=head2 get_status_list

Returns a list reference of the legal statuses for a test case-run

=cut

sub get_status_list {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $ref = $dbh->selectall_arrayref(
            "SELECT case_run_status_id AS id, name 
             FROM test_case_run_status
             ORDER BY sortkey", {'Slice' =>{}});

    return $ref    
}

=head2 attach_bug

Attaches the specified bug to this test case-run

=cut

sub attach_bug {
    my $self = shift;
    my ($bugs, $caserun_id) = @_;
    my @bugs = Bugzilla::Testopia::TestCase::_check_bugs($bugs);
    $caserun_id ||= $self->{'case_run_id'};
    my $dbh = Bugzilla->dbh;
    
    $dbh->bz_lock_tables('test_case_bugs WRITE');
    foreach my $bug (@bugs){ 
        my ($exists) = $dbh->selectrow_array(
                "SELECT bug_id 
                   FROM test_case_bugs 
                  WHERE case_run_id=?
                    AND bug_id=?", 
                 undef, ($caserun_id, $bug));
        if ($exists) {
            $dbh->bz_unlock_tables();
            return;
        }
        my ($check) = $dbh->selectrow_array(
                "SELECT bug_id 
                   FROM test_case_bugs 
                  WHERE case_id=?
                    AND bug_id=?
                    AND case_run_id=?", 
                 undef, ($caserun_id, $bug, undef));
                 
        if ($check){
            $dbh->do("UPDATE test_case_bugs 
                         SET test_case_run_id = ?
                       WHERE case_id = ?
                         AND bug_id = ?", 
                     undef, ($bug, $self->{'case_run_id'}));
        }
        else{
            $dbh->do("INSERT INTO test_case_bugs (bug_id, case_run_id, case_id)
                      VALUES(?,?,?)", undef, ($bug, $self->{'case_run_id'}, $self->{'case_id'}));
        }
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
                 AND case_run_id = ?", 
             undef, ($bug, $self->{'case_run_id'}));

}

=head2 update_bugs

Updates bug status depending on whether the case passed or failed. If
the case failed it will reopen any attached bugs that are closed. If it
passed it will mark RESOLVED bugs VERIFIED.

=cut

sub update_bugs {
    my $self = shift;
    my ($status) = @_;
    my $resolution;
    my $dbh = Bugzilla->dbh;
    my $timestamp = Bugzilla::Testopia::Util::get_time_stamp();
    foreach my $bug (@{$self->bugs}){
        my $oldstatus = $bug->bug_status;
        my $oldresolution = $bug->resolution;
        
        next if ($status eq 'VERIFIED' && $oldstatus ne 'RESOLVED');
        next if ($status eq 'REOPENED' && $oldstatus !~ /(RESOLVED|VERIFIED|CLOSED)/);
        next if $oldresolution eq 'DUPLICATE';
        if ($status eq 'REOPENED'){
            $resolution = '';
        }
        else{
            $resolution = $oldresolution;
        }
        my $comment  = "Status updated by Testopia:  ". Bugzilla->params->{"urlbase"};
           $comment .= "tr_show_case.cgi?case_id=" . $self->case->id;
          
        $dbh->bz_lock_tables("bugs WRITE, fielddefs READ, longdescs WRITE, bugs_activity WRITE");
        $dbh->do("UPDATE bugs 
                     SET bug_status = ?,
                        resolution = ?,
                         delta_ts = ?
                     WHERE bug_id = ?", 
                     undef,($status, $resolution, $timestamp, $bug->bug_id));
        LogActivityEntry($bug->bug_id, 'bug_status', $oldstatus, 
                         $status, Bugzilla->user->id, $timestamp);
        LogActivityEntry($bug->bug_id, 'resolution', $bug->resolution, '', 
                         Bugzilla->user->id, $timestamp) if ($status eq 'REOPENED');
        AppendComment($bug->bug_id, Bugzilla->user->id, $comment, 
                      !Bugzilla->user->in_group(Bugzilla->params->{'insidergroup'}), $timestamp);
        
        $dbh->bz_unlock_tables();
    }
}

=head2 obliterate

Removes this caserun, its history, and all things that reference it.

=cut

sub obliterate {
    my $self = shift;
    my $single = shift;
    my $dbh = Bugzilla->dbh;
    my $sth = $dbh->prepare_cached("DELETE FROM test_case_bugs WHERE case_run_id = ?");
    foreach my $id (@{$self->get_case_run_list}){
        $sth->execute($id);
    }
    
    if ($single){
        $dbh->do("DELETE FROM test_case_runs WHERE case_run_id = ?", 
              undef, ($self->id));
    }
    else {
        $dbh->do("DELETE FROM test_case_runs WHERE case_id = ? AND run_id = ?", 
                  undef, ($self->case_id, $self->run_id));
    }
    return 1;
}
   
###############################
####      Accessors        ####
###############################

=head1 ACCESSOR METHODS

=head2 id

Returns the ID of the object

=head2 testedby

Returns a Bugzilla::User object representing the user that closed
this case-run.

=head2 assignee

Returns a Bugzilla::User object representing the user assigned to 
update this case-run.

=head2 case_text_version

Returns the version of the test case document that this case-run
was run against.

=head2 notes

Returns the notes of the object

=head2 close_date

Returns the time stamp of when this case-run was closed

=head2 iscurrent

Returns true if this is the current case-run in the history list

=head2 status_id

Returns the status id of the object

=head2 sortkey

Returns the sortkey of the object

=head2 isprivate

Returns the true if this case-run is private.

=cut

=head2 updated_deps

Returns a reference to a list of dependent caseruns that were updated 

=cut

sub id                { return $_[0]->{'case_run_id'};          }
sub case_id           { return $_[0]->{'case_id'};          }
sub run_id            { return $_[0]->{'run_id'};          }
sub testedby          { return Bugzilla::User->new($_[0]->{'testedby'});   }
sub assignee          { return Bugzilla::User->new($_[0]->{'assignee'});   }
sub case_text_version { return $_[0]->{'case_text_version'};   }
sub running_date      { return $_[0]->{'running_date'};   }
sub close_date        { return $_[0]->{'close_date'};   }
sub iscurrent         { return $_[0]->{'iscurrent'};   }
sub status_id         { return $_[0]->{'case_run_status_id'};   }
sub sortkey           { return $_[0]->{'sortkey'};   }
sub isprivate         { return $_[0]->{'isprivate'};   }
sub updated_deps      { return $_[0]->{'updated_deps'};   }

=head2 type

Returns 'case'

=cut

sub type {
    my $self = shift;
    $self->{'type'} = 'caserun';
    return $self->{'type'};
}

=head2 notes

Returns the cumulative notes of all caserun records of this case and run.

=cut

sub notes { 
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $notes = $dbh->selectcol_arrayref(
            "SELECT notes
               FROM test_case_runs
              WHERE case_id = ? AND run_id = ?
           ORDER BY case_run_id",
           undef,($self->case_id, $self->run_id));
    
    return join("\n", @$notes);
}

=head2 run

Returns the TestRun object that this case-run is associated with

=cut

# The potential exists for creating a circular reference here.
sub run {
    my $self = shift;
    return $self->{'run'} if exists $self->{'run'};
    $self->{'run'} = Bugzilla::Testopia::TestRun->new($self->{'run_id'});
    return $self->{'run'};
}

=head2 case

Returns the TestCase object that this case-run is associated with

=cut

# The potential exists for creating a circular reference here.
sub case {
    my $self = shift;
    return $self->{'case'} if exists $self->{'case'};
    $self->{'case'} = Bugzilla::Testopia::TestCase->new($self->{'case_id'});
    return $self->{'case'};
}

=head2 build

Returns the Build object that this case-run is associated with

=cut

sub build {
    my $self = shift;
    return $self->{'build'} if exists $self->{'build'};
    $self->{'build'} = Bugzilla::Testopia::Build->new($self->{'build_id'});
    return $self->{'build'};
}

=head2 environment

Returns the Build object that this case-run is associated with

=cut

sub environment {
    my $self = shift;
    return $self->{'environment'} if exists $self->{'environment'};
    $self->{'environment'} = Bugzilla::Testopia::Environment->new($self->{'environment_id'});
    return $self->{'environment'};
}

=head2 status

Looks up the status name of the associated status_id for this object

=cut

sub status {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    ($self->{'status'}) = $dbh->selectrow_array(
        "SELECT name FROM test_case_run_status
         WHERE case_run_status_id=?", undef,
         $self->{'case_run_status_id'});
    return $self->{'status'};
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
          WHERE case_run_id = ?", 
         undef, $self->id);
    
    my @attachments;
    foreach my $attach (@{$attachments}){
        push @attachments, Bugzilla::Testopia::Attachment->new($attach);
    }
    $self->{'attachments'} = \@attachments;
    return $self->{'attachments'};
    
}

=head2 bugs

Returns a list of Bugzilla::Bug objects associated with this case-run 

=cut

sub bugs {
    my $self = shift;
    #return $self->{'bug'} if exists $self->{'bug'};
    my $dbh = Bugzilla->dbh;
    my @bugs;
    my $bugids = $dbh->selectcol_arrayref("SELECT bug_id 
                                     FROM test_case_bugs 
                                     WHERE case_run_id=?", 
                                     undef, $self->{'case_run_id'});
    foreach my $bugid (@{$bugids}){
        push @bugs, Bugzilla::Bug->new($bugid, Bugzilla->user->id) if Bugzilla->user->can_see_bug($bugid);
    }
    $self->{'bugs'} = \@bugs; #join(",", @$bugids);
    
    return $self->{'bugs'};
}

=head2 bug_list

Returns a comma separated list of bug ids associated with this case-run

=cut

sub bug_list {
    my $self = shift;
    return $self->{'bug_list'} if exists $self->{'bug_list'};
    my $dbh = Bugzilla->dbh;
    my @bugs;
    my $bugids = $dbh->selectcol_arrayref("SELECT bug_id 
                                     FROM test_case_bugs 
                                     WHERE case_run_id=?", 
                                     undef, $self->id);
    my @visible;
    foreach my $bugid (@{$bugids}){
        push @visible, $bugid if Bugzilla->user->can_see_bug($bugid);
    }
    $self->{'bug_list'} = join(",", @$bugids);
    
    return $self->{'bug_list'};
}

=head2 bug_count

Retuns a count of the bugs associated with this case-run

=cut

sub bug_count{
    my $self = shift;
    return $self->{'bug_count'} if exists $self->{'bug_count'};
    my $dbh = Bugzilla->dbh;

    $self->{'bug_count'} = $dbh->selectrow_array("SELECT COUNT(bug_id) 
                                                 FROM test_case_bugs 
                                                 WHERE case_run_id=?",
                                                 undef, $self->{'case_run_id'});
    return $self->{'bug_count'};
}

=head2 get_buglist

Returns a comma separated string off bug ids associated with 
this case-run

=cut

sub get_buglist {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    my $bugids = $dbh->selectcol_arrayref("SELECT bug_id 
                                     FROM test_case_bugs 
                                     WHERE case_run_id=?", 
                                     undef, $self->{'case_run_id'});
    return join(',', @{$bugids});
}

=head2 is_open_status

Returns true if the status of this case-run is an open status

=cut

sub is_open_status {
    my $self = shift;
    my $status = shift;
    my @open_status_list = (IDLE, RUNNING, PAUSED);
    return 1 if lsearch(\@open_status_list, $status) > -1;
}

=head2 is_closed_status

Returns true if the status of this case-run is a closed status

=cut

sub is_closed_status {
    my $self = shift;
    my $status = shift;
    my @closed_status_list = (PASSED, FAILED, BLOCKED);
    return 1 if lsearch(\@closed_status_list, $status) > -1;
}

=head2 canview

Returns true if the logged in user has rights to view this case-run.

=cut

sub canview {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('Testers');
    return 1 if $self->run->plan->get_user_rights(Bugzilla->user->id) & TR_READ;
    return 0;
}

=head2 canedit

Returns true if the logged in user has rights to edit this case-run.

=cut

sub canedit {
    my $self = shift;
    return 0 if $self->run->stop_date;
    return 1 if Bugzilla->user->in_group('admin');
    return 1 if $self->run->plan->get_user_rights(Bugzilla->user->id) & TR_ADMIN;
    if ($self->status_id == RUNNING){
        return 0 unless $self->assignee->id && $self->assignee->id == Bugzilla->user->id;
    } 
    return 1 if Bugzilla->user->in_group('Testers');
    return 1 if $self->run->plan->get_user_rights(Bugzilla->user->id) & TR_WRITE;
     
    return 0;
}

=head2 candelete

Returns true if the logged in user has rights to delete this case-run.

=cut

sub candelete {
    my $self = shift;
    return 1 if Bugzilla->user->in_group('admin');
    return 0 unless Bugzilla->params->{"allow-test-deletion"};
    return 1 if Bugzilla->user->in_group('Testers') && Bugzilla->params->{"testopia-allow-group-member-deletes"};
    return 1 if $self->run->plan->get_user_rights(Bugzilla->user->id) & TR_DELETE;
    return 0;
}

sub completion_time {
    my $self = shift;
    my $dbh = Bugzilla->dbh;
    if ($self->running_date && $self->close_date){
        my $seconds = str2time($self->close_date) - str2time($self->running_date);
        return $seconds;
    } 
    return 0;
}

1;
__END__
=head1 NAME

Bugzilla::Testopia::TestCaseRun - Testopia Test Case Run object

=head1 DESCRIPTION

This module represents a test case run in Testopia. 
A test case run is a record in the test_case_runs table which joins
test cases to test runs. Basically, for each test run a selction of 
test cases is made to be included in that run. As a test run 
progresses, testers set statuses on each of the cases in the run.
If the build is changed on a case-run with a status, a clone of that
case-run is made in the table for historical purposes.

=head1 SYNOPSIS

use Bugzilla::Testopia::TestCaseRun;

 $caserun = Bugzilla::Testopia::TestCaseRun->new($caserun_id);
 $caserun = Bugzilla::Testopia::TestCaseRun->new(\%caserun_hash);

=cut

=head1 METHODS

=head2 new

Instantiate a new case run. This takes a single argument 
either a test case ID or a reference to a hash containing keys 
identical to a test case-run's fields and desired values.

=cut

=head2 _init

Private constructor for this object

=cut


=head1 SEE ALSO

TestCase TestRun

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com>

=cut


