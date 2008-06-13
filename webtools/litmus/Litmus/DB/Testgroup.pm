# -*- mode: cperl; c-basic-offset: 8; indent-tabs-mode: nil; -*-

=head1 COPYRIGHT

 # ***** BEGIN LICENSE BLOCK *****
 # Version: MPL 1.1
 #
 # The contents of this file are subject to the Mozilla Public License
 # Version 1.1 (the "License"); you may not use this file except in
 # compliance with the License. You may obtain a copy of the License
 # at http://www.mozilla.org/MPL/
 #
 # Software distributed under the License is distributed on an "AS IS"
 # basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 # the License for the specific language governing rights and
 # limitations under the License.
 #
 # The Original Code is Litmus.
 #
 # The Initial Developer of the Original Code is
 # the Mozilla Corporation.
 # Portions created by the Initial Developer are Copyright (C) 2006
 # the Initial Developer. All Rights Reserved.
 #
 # Contributor(s):
 #   Chris Cooper <ccooper@deadsquid.com>
 #   Zach Lipton <zach@zachlipton.com>
 #
 # ***** END LICENSE BLOCK *****

=cut

package Litmus::DB::Testgroup;

use strict;
use base 'Litmus::DBI';

Litmus::DB::Testgroup->table('testgroups');

Litmus::DB::Testgroup->columns(All => qw/testgroup_id product_id name enabled branch_id last_updated creation_date creator_id/);
Litmus::DB::Testgroup->columns(Essential => qw/testgroup_id product_id name enabled branch_id last_updated creation_date creator_id/);
Litmus::DB::Testgroup->utf8_columns(qw/name/);
Litmus::DB::Testgroup->columns(TEMP => qw/creator/);

Litmus::DB::Testgroup->column_alias("product_id", "product");
Litmus::DB::Testgroup->column_alias("branch_id", "branch");
Litmus::DB::Testgroup->column_alias("creator_id", "creator");

Litmus::DB::Testgroup->has_a(product => "Litmus::DB::Product");
Litmus::DB::Testgroup->has_a(branch => "Litmus::DB::Branch");
Litmus::DB::Testgroup->has_a(creator => "Litmus::DB::User");

__PACKAGE__->set_sql(EnabledByBranch => qq{
SELECT tg.* 
FROM testgroups tg
WHERE tg.branch_id=? AND tg.enabled=1
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(ByBranch => qq{
SELECT tg.* 
FROM testgroups tg
WHERE tg.branch_id=?
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(EnabledBySubgroup => qq{
SELECT tg.* 
FROM testgroups tg, subgroup_testgroups sgtg
WHERE sgtg.subgroup_id=? AND sgtg.testgroup_id=tg.testgroup_id AND tg.enabled=1
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(BySubgroup => qq{
SELECT tg.* 
FROM testgroups tg, subgroup_testgroups sgtg
WHERE sgtg.subgroup_id=? AND sgtg.testgroup_id=tg.testgroup_id
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(EnabledByTestcase => qq{
SELECT tg.* 
FROM testgroups tg, subgroup_testgroups sgtg, testcase_subgroups tcsg
WHERE tcsg.testcase_id=? AND tcsg.subgroup_id=sgtg.subgroup_id AND sgtg.testgroup_id=tg.testgroup_id AND tg.enabled=1
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(UniqueEnabledByTestcase => qq{
SELECT DISTINCT(tg.testgroup_id),tg.* 
FROM testgroups tg, subgroup_testgroups sgtg, testcase_subgroups tcsg
WHERE tcsg.testcase_id=? AND tcsg.subgroup_id=sgtg.subgroup_id AND sgtg.testgroup_id=tg.testgroup_id AND tg.enabled=1
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(UniqueByTestcase => qq{
SELECT DISTINCT(tg.testgroup_id),tg.* 
FROM testgroups tg, subgroup_testgroups sgtg, testcase_subgroups tcsg
WHERE tcsg.testcase_id=? AND tcsg.subgroup_id=sgtg.subgroup_id AND sgtg.testgroup_id=tg.testgroup_id
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(ByTestcase => qq{
SELECT tg.* 
FROM testgroups tg, subgroup_testgroups sgtg, testcase_subgroups tcsg
WHERE tcsg.testcase_id=? AND tcsg.subgroup_id=sgtg.subgroup_id AND sgtg.testgroup_id=tg.testgroup_id
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(ByTestRun => qq{
SELECT tg.* 
FROM testgroups tg, test_run_testgroups trtg
WHERE trtg.test_run_id=? AND trtg.testgroup_id=tg.testgroup_id
ORDER by tg.name ASC
});

__PACKAGE__->set_sql(EnabledByTestRun => qq{
SELECT tg.* 
FROM testgroups tg, test_run_testgroups trtg
WHERE trtg.test_run_id=? AND
  trtg.testgroup_id=tg.testgroup_id AND
  tg.enabled=1
ORDER by tg.name ASC
});

#########################################################################
sub coverage {
  my $self = shift;
  my $build_id = shift;
  my $platform_id = shift;
  my $opsys_id = shift;
  my $locale = shift;
  my $community_only = shift;
  my $user = shift;
  my $trusted = shift;

  my $percent_completed = 0;

  my @subgroups = Litmus::DB::Subgroup->search_EnabledByTestgroup($self->testgroup_id);
  my $num_empty_subgroups = 0;
  foreach my $subgroup (@subgroups) {
    my $subgroup_percent = $subgroup->coverage(
                                               $build_id, 
                                               $platform_id, 
                                               $opsys_id,
                                               $locale,
                                               $community_only,
                                               $user,
                                               $trusted,
                                              );
    if ($subgroup_percent eq "N/A") {
      $num_empty_subgroups++;
    } else {
      $percent_completed += $subgroup_percent;
    }
  }
  
  if (scalar(@subgroups) - $num_empty_subgroups == 0) { 
    return "N/A"
  }
  my $total_percentage = $percent_completed / 
    (scalar @subgroups - $num_empty_subgroups);
  
  return sprintf("%d",$total_percentage);
}

#########################################################################
sub clone() {
  my $self = shift;
  my $new_name = shift;
  my $new_branch_id = shift;

  my $new_testgroup = $self->copy;
  if (!$new_testgroup) {
    return undef;
  }
  
  # Update dates to now.
  my $now = &Date::Manip::UnixDate("now","%q");
  $new_testgroup->creation_date($now);
  $new_testgroup->last_updated($now);
  if ($new_name and $new_name ne "") {
    $new_testgroup->name($new_name);
  }
  if ($new_branch_id and $new_branch_id > 0) {
    $new_testgroup->branch_id($new_branch_id);
  }
  $new_testgroup->update();
  
  return $new_testgroup;
}

#########################################################################
sub clone_preserve() {
  my $self = shift;

  my $new_testgroup = $self->clone(@_);
  if (!$new_testgroup) { 
    return undef;
  }

  # Propagate testgroup membership;
  my $sql = "INSERT INTO subgroup_testgroups (subgroup_id,testgroup_id,sort_order) SELECT subgroup_id,?,sort_order FROM subgroup_testgroups WHERE testgroup_id=?";

  my $dbh = __PACKAGE__->db_Main();
  my $rows = $dbh->do($sql,
                   undef,
                   $new_testgroup->testgroup_id,
                   $self->testgroup_id
                  );
  if (! $rows) {
    Litmus::Error::logError("Unable to clone testgroup membership for testgroup ID# " .
                            $self->testgroup_id . ' -> ' .
                            $new_testgroup->testgroup_id,
                            caller(0));
  }  

  return $new_testgroup;
}

#########################################################################
sub clone_recursive() {
  my $self = shift;
  my $new_name = shift;
  my $new_branch_id = shift;
  my $change_from = shift;
  my $change_to = shift;

  my $subgroup_mapping;
  my $testcase_mapping;
  
  my $new_testgroup = $self->clone($new_name,$new_branch_id);
  if (!$new_testgroup) { 
    return undef;
  }

  my $dbh = __PACKAGE__->db_Main();

  # ASSUMPTION: subgroups only appear once in any given testgroup.
  my $subgroup_select_sql = "SELECT subgroup_id, sort_order FROM subgroup_testgroups WHERE testgroup_id=?";
  my $subgroup_insert_sql = "INSERT INTO subgroup_testgroups (subgroup_id, testgroup_id, sort_order) VALUES (?,?,?)";
  my $testcase_select_sql = "SELECT testcase_id, sort_order FROM testcase_subgroups WHERE subgroup_id=?";

  # NOTE: We interleave our subgroup and testcase lookups here to avoid looping
  # over the same data more than once.
  my $testcase_sth = $dbh->prepare($testcase_select_sql);
  my $subgroup_sth = $dbh->prepare($subgroup_select_sql);
  $subgroup_sth->execute($self->{'testgroup_id'});

  while (my ($subgroup_id, $sort_order) = $subgroup_sth->fetchrow_array) {
    $subgroup_mapping->{$subgroup_id}->{'sort_order'} = $sort_order;

    my $subgroup = Litmus::DB::Subgroup->retrieve($subgroup_id);
    if ($subgroup) {
      my $new_subgroup_name = $subgroup->name;
      if ($change_from and $change_to) {
        $new_subgroup_name =~ s/${change_from}/${change_to}/g;
      }
      my $new_subgroup = $subgroup->clone($new_subgroup_name);
      if (!$new_subgroup) {
        Litmus::Error::logError("Unable to clone subgroup ID#: " .
                                $subgroup_id,
                                caller(0));
        next;
      }
      $subgroup_mapping->{$subgroup_id}->{'new_subgroup_id'} =
        $new_subgroup->subgroup_id;
      
      my $rows = $dbh->do($subgroup_insert_sql,
                          undef,
                          $new_subgroup->subgroup_id,
                          $new_testgroup->testgroup_id,
                          $subgroup_mapping->{$subgroup_id}->{'sort_order'});
      if (! $rows) {
        Litmus::Error::logError("Unable to preserve subgroup mapping for testgroup ID: " .
                                $new_testgroup->testgroup_id,
                                caller(0));
        next;
      }

      # Look up testcases for this subgroup.
      $testcase_sth->execute($subgroup_id);
      while (my ($testcase_id, $sort_order) = $testcase_sth->fetchrow_array) {
        $testcase_mapping->{$testcase_id}->{$subgroup_id}->{'sort_order'} = $sort_order;
      }
    }

  }
  $subgroup_sth->finish;
  $testcase_sth->finish;
    
  # Clone Testcases
  my $testcase_insert_sql = "INSERT INTO testcase_subgroups (testcase_id, subgroup_id, sort_order) VALUES (?,?,?)";

  foreach my $testcase_id (keys %$testcase_mapping) {
    my $testcase = Litmus::DB::Testcase->retrieve($testcase_id);
    if ($testcase) {
     my $new_testcase_summary = $testcase->summary;
      if ($change_from and $change_to) {
        $new_testcase_summary =~ s/${change_from}/${change_to}/g;
      }
      my $new_testcase = $testcase->clone($new_testcase_summary,
                                          $new_branch_id);
      if ($new_testcase) {
        # Testcases can belong to more than one subgroup, so preserve all those
        # linkages.
        foreach my $subgroup_id (keys %{$testcase_mapping->{$testcase_id}}) {
          my $rows = $dbh->do($testcase_insert_sql,
                              undef,
                              $new_testcase->{'testcase_id'},
                              $subgroup_mapping->{$subgroup_id}->{'new_subgroup_id'},
                              $testcase_mapping->{$testcase_id}->{$subgroup_id}->{'sort_order'}
                  );
          if (! $rows) {
            Litmus::Error::logError("Unable to preserve testcase mapping for subgroup ID: " .
                                    $subgroup_mapping->{$subgroup_id}->{'new_subgroup_id'},
                                    caller(0));
            next;
          }
        }
      } else {
        Litmus::Error::logError("Unable to clone testcase ID#: " .
                                testcase->testcase_id,
                                caller(0));
      }
    }
  }

  return $new_testgroup;
}

#########################################################################
sub delete_from_subgroups() {
  my $self = shift;

  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "DELETE from subgroup_testgroups WHERE testgroup_id=?";
  my $rows = $dbh->do($sql,
                      undef,
                      $self->testgroup_id
                     );
}

#########################################################################
sub delete_from_test_runs() {
  my $self = shift;

  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "DELETE from test_run_testgroups WHERE testgroup_id=?";
  my $rows = $dbh->do($sql,
                      undef,
                      $self->testgroup_id
                     );
  return;
}

#########################################################################
sub delete_with_refs() {
  my $self = shift;
  $self->delete_from_subgroups();
  $self->delete_from_test_runs();
  return $self->delete;
}

#########################################################################
sub update_subgroups() {
  my $self = shift;
  my $new_subgroup_ids = shift;
  
  # We always want to delete the existing subgroups. 
  # Failing to delete subgroups is _not_ fatal when adding a new testgroup.
  my $rv = $self->delete_from_subgroups();
  
  if (scalar @$new_subgroup_ids) {
    my $dbh = __PACKAGE__->db_Main();  
    my $sql = "INSERT INTO subgroup_testgroups (subgroup_id,testgroup_id,sort_order) VALUES (?,?,?)";
    my $sort_order = 1;
    foreach my $new_subgroup_id (@$new_subgroup_ids) {
      next if (!$new_subgroup_id);
      # Log any failures/duplicate keys.
      eval {
        my $rows = $dbh->do($sql, 
                            undef,
                            $new_subgroup_id,
                            $self->testgroup_id,
                            $sort_order
                           );
      };
      if ($@) {
        Litmus::Error::logError($@, caller(0));
      }
      $sort_order++;
    }
  }
}

1;








