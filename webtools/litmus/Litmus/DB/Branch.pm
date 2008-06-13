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

package Litmus::DB::Branch;

use strict;
use base 'Litmus::DBI';

Litmus::DB::Branch->table('branches');

Litmus::DB::Branch->columns(All => qw/branch_id product_id name detect_regexp enabled creation_date last_updated creator_id/);
Litmus::DB::Branch->columns(Essential => qw/branch_id product_id name detect_regexp enabled creation_date last_updated creator_id/);
Litmus::DB::Branch->utf8_columns(qw/name detect_regexp/);
Litmus::DB::Branch->columns(TEMP => qw//);

Litmus::DB::Branch->column_alias("creator_id", "creator");
Litmus::DB::Branch->column_alias("product_id", "product");

Litmus::DB::Branch->has_many(test_results => 'Litmus::DB::Testresult');
Litmus::DB::Branch->has_a(product_id=>'Litmus::DB::Product');
Litmus::DB::Branch->has_a(creator_id=>'Litmus::DB::User');

__PACKAGE__->set_sql(ByTestgroup => qq{
                                       SELECT b.* 
                                       FROM branches b, testgroups tg 
                                       WHERE tg.testgroup_id=? AND tg.branch_id=b.branch_id
                                       ORDER BY b.name ASC
});

#########################################################################
sub clone() {
  my $self = shift;
  my $new_name = shift;
  my $new_regexp = shift;

  my $new_branch = $self->copy;
  if (!$new_branch) { 
    return undef;
  }

  my $now = &Date::Manip::UnixDate("now","%q");
  $new_branch->creation_date($now);
  $new_branch->last_updated($now);
  if ($new_name and $new_name ne "") {
    $new_branch->name($new_name);
  }
  if ($new_regexp and $new_regexp ne "") {
    $new_branch->detect_regexp($new_regexp);
  }
  $new_branch->update();

  return $new_branch;
}

#########################################################################
sub clone_recursive() {
  my $self = shift;
  my $new_name = shift;
  my $new_regexp = shift;
  my $change_from = shift;
  my $change_to = shift;

  my $new_branch = $self->clone($new_name,$new_regexp);
  if (!$new_branch) { 
    return undef;
  }

  my $testgroups = Litmus::DB::Testgroup->search(branch_id => $self->branch_id);

  my $testgroup_mapping;
  my $subgroup_mapping;
  my $testcase_mapping;

  # Clone testgroups
  while (my $testgroup = $testgroups->next) {
    my $new_testgroup_name = $testgroup->name;
    if ($change_from and $change_to) {
      $new_testgroup_name =~ s/${change_from}/${change_to}/g;
    }
    my $new_testgroup = $testgroup->clone($new_testgroup_name,
                                          $new_branch->branch_id);
    if (!$new_testgroup) {
        Litmus::Error::logError("Unable to clone testgroup ID#: " .
                                $testgroup->testgroup_id,
                                caller(0));
    } else {
      $testgroup_mapping->{$testgroup->testgroup_id} = $new_testgroup->testgroup_id;
    }
  }

  # Clone Subgroups
  # 
  # Subgroups can belong to more than one testgroup, so we don't recurse
  # directly through testgroups because that might lead to duplicate subgroups.
  my $subgroups = Litmus::DB::Subgroup->search_ByBranch($self->branch_id);
  while (my $subgroup = $subgroups->next) {
    my $new_subgroup_name = $subgroup->name;
    if ($change_from and $change_to) {
      $new_subgroup_name =~ s/${change_from}/${change_to}/g;
    }
    my $new_subgroup = $subgroup->clone($new_subgroup_name,
                                        $new_branch->branch_id);
    if (!$new_subgroup) {
        Litmus::Error::logError("Unable to clone subgroup ID#: " .
                                $subgroup->subgroup_id,
                                caller(0));
    } else {
      $subgroup_mapping->{$subgroup->subgroup_id} = $new_subgroup->subgroup_id;
    }
  }

  # Clone Testcases
  # 
  # Testcases can belong to more than one subgroup, so we don't recurse
  # directly through subgroups because that might lead to duplicate testcases.
  my $testcases = Litmus::DB::Testcase->search_ByBranch($self->branch_id);
  while (my $testcase = $testcases->next) {
    my $new_testcase_summary = $testcase->summary;
    if ($change_from and $change_to) {
      $new_testcase_summary =~ s/${change_from}/${change_to}/g;
    }
    my $new_testcase = $testcase->clone($new_testcase_summary,
                                        $new_branch->branch_id);
    if (!$new_testcase) {
      Litmus::Error::logError("Unable to clone testcase ID#: " .
                              $testcase->testcase_id,
                              caller(0));
    } else {
      $testcase_mapping->{$testcase->testcase_id} = $new_testcase->testcase_id;
    }
  }
  
  my ($dbh,$sql,$insert_sql,$sth);
  $dbh = __PACKAGE__->db_Main();

  # Preserve subgroup-to-testgroup mappings for the newly cloned testgroups
  $sql = qq{
  SELECT subgroup_id, sort_order
  FROM subgroup_testgroups
  WHERE testgroup_id=?
  };
  $insert_sql = qq{
  INSERT INTO subgroup_testgroups (subgroup_id, testgroup_id, sort_order)
  VALUES (?,?,?)  
  };
  $sth = $dbh->prepare($sql);
  foreach my $testgroup_id (keys %$testgroup_mapping) {
    $sth->execute($testgroup_id);
    my $subgroup_testgroups;
    while (my ($subgroup_id, $sort_order) = $sth->fetchrow_array) {
      if ($subgroup_mapping->{$subgroup_id}) {
        my $rows = $dbh->do($insert_sql,
                            undef,
                            $subgroup_mapping->{$subgroup_id},
                            $testgroup_mapping->{$testgroup_id},
                            $sort_order);
        if (! $rows) {
          Litmus::Error::logError("Unable to preserve subgroup mapping for testgroup ID: " .
            $testgroup_mapping->{$testgroup_id},
            caller(0));
        }
      }
    }
  }
  $sth->finish;

  # Preserve testcase-to-subgroup mappings for the newly cloned subgroups
  $sql = qq{
  SELECT testcase_id, sort_order
  FROM testcase_subgroups
  WHERE subgroup_id=?
  };
  $insert_sql = qq{
  INSERT INTO testcase_subgroups (testcase_id, subgroup_id, sort_order)
  VALUES (?,?,?)  
  };
  $sth = $dbh->prepare($sql);
  foreach my $subgroup_id (keys %$subgroup_mapping) {
    $sth->execute($subgroup_id);
    while (my ($testcase_id, $sort_order) = $sth->fetchrow_array) {
      if ($testcase_mapping->{$testcase_id}) {
        my $rows = $dbh->do($insert_sql,
                            undef,
                            $testcase_mapping->{$testcase_id},
                            $subgroup_mapping->{$subgroup_id},
                            $sort_order);
        if (! $rows) {
          Litmus::Error::logError("Unable to preserve testcase mapping for subgroup ID: " .
            $subgroup_mapping->{$subgroup_id},
            caller(0));
        }
      }
    }
  }
  $sth->finish;

  return $new_branch;
}

1;
