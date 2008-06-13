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

package Litmus::DB::Subgroup;

use strict;
use base 'Litmus::DBI';

Litmus::DB::Subgroup->table('subgroups');

Litmus::DB::Subgroup->columns(All => qw/subgroup_id name enabled product_id branch_id creation_date last_updated creator_id/);
Litmus::DB::Subgroup->columns(Essential => qw/subgroup_id name enabled product_id branch_id creation_date last_updated creator_id/);
Litmus::DB::Subgroup->utf8_columns(qw/name/);
Litmus::DB::Subgroup->columns(TEMP => qw /num_testcases/);

Litmus::DB::Subgroup->column_alias("subgroup_id", "subgroupid");
Litmus::DB::Subgroup->column_alias("product_id", "product");
Litmus::DB::Subgroup->column_alias("branch_id", "branch");
Litmus::DB::Subgroup->column_alias("creator_id", "creator");

Litmus::DB::Subgroup->has_a(product => "Litmus::DB::Product");
Litmus::DB::Subgroup->has_a(branch => "Litmus::DB::Branch");
Litmus::DB::Subgroup->has_a(creator => "Litmus::DB::User");

__PACKAGE__->set_sql(EnabledByTestgroup => qq{
SELECT sg.* 
FROM subgroups sg, subgroup_testgroups sgtg 
WHERE 
  sgtg.testgroup_id=? AND 
  sgtg.subgroup_id=sg.subgroup_id AND 
  sg.enabled=1 
ORDER BY sgtg.sort_order ASC
});

__PACKAGE__->set_sql(ByTestgroup => qq{
SELECT sg.*
FROM subgroups sg, subgroup_testgroups sgtg 
WHERE 
  sgtg.testgroup_id=? AND 
  sgtg.subgroup_id=sg.subgroup_id
ORDER BY sgtg.sort_order ASC
});

__PACKAGE__->set_sql(NumCommunityEnabledTestcases => qq{
SELECT count(tc.testcase_id) AS num_testcases
FROM testcases tc, testcase_subgroups tcsg
WHERE 
  tcsg.subgroup_id=? AND 
  tcsg.testcase_id=tc.testcase_id AND 
  tc.enabled=1 AND 
  tc.community_enabled=1 
});

__PACKAGE__->set_sql(NumEnabledTestcases => qq{
SELECT count(tc.testcase_id) AS num_testcases
FROM testcases tc, testcase_subgroups tcsg
WHERE 
  tcsg.subgroup_id=? AND 
  tcsg.testcase_id=tc.testcase_id AND 
  tc.enabled=1 
});

__PACKAGE__->set_sql(EnabledByTestcase => qq{
SELECT sg.* 
FROM subgroups sg, testcase_subgroups tcsg
WHERE 
  tcsg.testcase_id=? AND 
  tcsg.subgroup_id=sg.subgroup_id AND 
  sg.enabled=1 
ORDER by sg.name ASC
});

__PACKAGE__->set_sql(UniqueEnabledByTestcase => qq{
SELECT DISTINCT(sg.subgroup_id),sg.* 
FROM subgroups sg, testcase_subgroups tcsg
WHERE 
  tcsg.testcase_id=? AND 
  tcsg.subgroup_id=sg.subgroup_id AND 
  sg.enabled=1 
ORDER by sg.name ASC
});

__PACKAGE__->set_sql(ByTestcase => qq{
SELECT sg.*, sgtg.testgroup_id
FROM subgroups sg, testcase_subgroups tcsg, subgroup_testgroups sgtg
WHERE 
  tcsg.testcase_id=? AND 
  tcsg.subgroup_id=sg.subgroup_id AND
  tcsg.subgroup_id=sgtg.subgroup_id
ORDER by sg.name ASC
});

__PACKAGE__->set_sql(ByTestDay => qq{
SELECT sg.*
FROM subgroups sg, testday_subgroups tdsg
WHERE 
  tdsg.testday_id=? AND 
  tdsg.subgroup_id=sg.subgroup_id 
ORDER by sg.name ASC
});

__PACKAGE__->set_sql(ByBranch => qq{
SELECT sg.*
FROM subgroups sg WHERE 
  branch_id=?
  ORDER by sg.subgroup_id ASC
});

#########################################################################
sub coverage() {
  my $self = shift;
  my $build_id = shift;
  my $platform_id = shift;
  my $opsys_id = shift;
  my $locale = shift;
  my $community_only = shift;
  my $user = shift;
  my $trusted = shift;

  my $sql = "SELECT COUNT(t.testcase_id) FROM testcase_subgroups tsg, testcases t WHERE tsg.subgroup_id=? AND tsg.testcase_id=t.testcase_id AND t.enabled=1";
  if ($community_only) {
    $sql .= " AND t.community_enabled=1";
  }
  my $dbh = $self->db_ReadOnly();
  my $sth = $dbh->prepare($sql);
  $sth->execute(
                $self->{'subgroup_id'},
               );
  my ($num_testcases) = $sth->fetchrow_array;

  $sth->finish;

  if (!$num_testcases or 
      $num_testcases == 0) { return "N/A" }

  
  $sql = "SELECT t.testcase_id, count(tr.testresult_id) AS num_results
          FROM testcase_subgroups tsg JOIN testcases t ON (tsg.testcase_id=t.testcase_id) LEFT JOIN test_results tr ON (tr.testcase_id=t.testcase_id) JOIN opsyses o ON (tr.opsys_id=o.opsys_id)";
  if ($trusted) {
    $sql .= ", users u, user_group_map ugm, security_groups sg";
  } 
  $sql .= " WHERE tsg.subgroup_id=? AND tr.build_id=? AND tr.locale_abbrev=? AND o.platform_id=? AND o.opsys_id=?";
  if ($community_only) {
    $sql .= " AND t.community_enabled=1";
  }
  if ($user) {
    $sql .= " AND tr.user_id=" . $user->{'user_id'};
  }
  if ($trusted) {
    
    $sql .= " AND tr.user_id=u.user_id AND u.user_id=ugm.user_id AND ugm.group_id=sg.group_id ";
    $sql .= " AND (sg.grouptype=1 OR sg.grouptype=3)";
  }
  
  $sql .= " GROUP BY tr.testcase_id";

  $sth = $dbh->prepare($sql);
  $sth->execute(
                $self->{'subgroup_id'},
                $build_id,
                $locale,
                $platform_id,
                $opsys_id
               );
  my @test_results = $self->sth_to_objects($sth);

  $sth->finish;

  if (@test_results == 0) { return "0" }

  my $num_completed = 0;
  foreach my $curtest (@test_results) {
    if ($curtest->{'num_results'} > 0) {
      $num_completed++;
    }
  }
  
  my $result = $num_completed/($num_testcases) * 100;
  unless ($result) {                   
    return "0";
  }

  return sprintf("%d",$result);  
}

#########################################################################
sub getNumEnabledTestcases {
  my $self = shift;
  
  my ($count) = $self->search_NumEnabledTestcases($self->subgroup_id);

  return $count->{'num_testcases'};
}

#########################################################################
sub getNumCommunityEnabledTestcases {
  my $self = shift;

  my ($count) = $self->search_NumCommunityEnabledTestcases($self->subgroup_id);

  return $count->{'num_testcases'};
}

#########################################################################
sub clone() {
  my $self = shift;
  my $new_name = shift;
  my $new_branch_id = shift;

  my $new_subgroup = $self->copy;
  if (!$new_subgroup) { 
    return undef;
  }

  # Update dates to now.
  my $now = &Date::Manip::UnixDate("now","%q");
  $new_subgroup->creation_date($now);
  $new_subgroup->last_updated($now);
  if ($new_name and $new_name ne "") {
    $new_subgroup->name($new_name);
  }
  if ($new_branch_id and $new_branch_id > 0) {
    $new_subgroup->branch_id($new_branch_id);
  }
  $new_subgroup->update();

  return $new_subgroup;
}

#########################################################################
sub clone_preserve() {
  my $self = shift;

  my $new_subgroup = $self->clone(@_);
  if (!$new_subgroup) { 
    return undef;
  }

  # Propagate testgroup membership.
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "INSERT INTO subgroup_testgroups (subgroup_id,testgroup_id,sort_order) SELECT ?,testgroup_id,sort_order FROM subgroup_testgroups WHERE subgroup_id=?";
  
  my $rows = $dbh->do($sql,
		      undef,
		      $new_subgroup->subgroup_id,
		      $self->subgroup_id
		     );
  if (! $rows) {
    Litmus::Error::logError("Unable to preserve testgroup mapping for subgroup ID: " .
                            $new_subgroup->subgroup_id,
                            caller(0));
  }  
  
  # Propagate testcase membership.
  $sql = "INSERT INTO testcase_subgroups (testcase_id,subgroup_id,sort_order) SELECT testcase_id,?,sort_order FROM testcase_subgroups WHERE subgroup_id=?";
  
  $rows = $dbh->do($sql,
                   undef,
                   $new_subgroup->subgroup_id,
                   $self->subgroup_id
                  );
  if (! $rows) {
    Litmus::Error::logError("Unable to preserve testcase mapping for subgroup ID: " .
                            $new_subgroup->subgroup_id,
                            caller(0));
  }  
  
  return $new_subgroup;
}

#########################################################################
sub clone_recursive() {
  my $self = shift;
  my $new_name = shift;
  my $new_branch_id = shift;
  my $change_from = shift;
  my $change_to = shift;

  my $new_subgroup = $self->clone($new_name,
                                  $new_branch_id);
  if (!$new_subgroup) { 
    return undef;
  }

  # ASSUMPTION: testcases only appear once in any given subgroup.
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "SELECT testcase_id, sort_order FROM testcase_subgroups WHERE subgroup_id=?";
  
  my $sth = $dbh->prepare($sql);
  $sth->execute(
                $self->{'subgroup_id'},
               );
  my $testcase_mappings;
  while (my ($testcase_id, $sort_order) = $sth->fetchrow_array) {
    $testcase_mappings->{$testcase_id}->{'sort_order'} = $sort_order;
  }
  $sth->finish;
  
  $sql = "INSERT INTO testcase_subgroups (testcase_id, subgroup_id, sort_order) VALUES (?,?,?)";
  
  foreach my $testcase_id (keys %$testcase_mappings) {
    my $testcase = Litmus::DB::Testcase->retrieve($testcase_id);
    if ($testcase) {
     my $new_testcase_summary = $testcase->summary;
      if ($change_from and $change_to) {
        $new_testcase_summary =~ s/${change_from}/${change_to}/g;
      }
      my $new_testcase = $testcase->clone($new_testcase_summary,
                                          $new_branch_id);
      if ($new_testcase) {
        $dbh->do($sql,
                 undef,
                 $new_testcase->{'testcase_id'},
                 $new_subgroup->{'subgroup_id'},
                 $testcase_mappings->{$testcase_id}->{'sort_order'}
                );
      } else {
        Litmus::Error::logError("Unable to clone testcase ID#: " .
                                testcase->testcase_id,
                                caller(0));
      }
    }
  }

  return $new_subgroup;
}

#########################################################################
sub delete_from_testgroups() {
  my $self = shift;
  
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "DELETE from subgroup_testgroups WHERE subgroup_id=?";
  return $dbh->do($sql,
                  undef,
                  $self->subgroup_id
                 );
}

#########################################################################
sub delete_from_testgroup() {
  my $self = shift;
  my $testgroup_id = shift;
  
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "DELETE from subgroup_testgroups WHERE subgroup_id=? AND testgroup_id=?";
  return $dbh->do($sql,
                  undef,
                  $self->subgroup_id,
                  $testgroup_id
                 );
}

#########################################################################
sub delete_from_testcases() {
  my $self = shift;
  
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "DELETE from testcase_subgroups WHERE subgroup_id=?";
  return $dbh->do($sql,
                  undef,
                  $self->subgroup_id
                 );
}

#########################################################################
sub delete_from_testdays() {
  my $self = shift;
  
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "DELETE from testday_subgroups WHERE subgroup_id=?";
  return $dbh->do($sql,
                  undef,
                  $self->subgroup_id
                 );
}

#########################################################################
sub delete_with_refs() {
  my $self = shift;
  $self->delete_from_testgroups();
  $self->delete_from_testcases();
  $self->delete_from_testdays();
  return $self->delete;
}

#########################################################################
sub update_testgroups() {
  my $self = shift;
  my $new_testgroup_ids = shift;
  
  # We always want to delete the existing testgroups. 
  # Failing to delete testgroups is _not_ fatal when adding a new subgroup.
  my $rv = $self->delete_from_testgroups();

  if (scalar @$new_testgroup_ids) {
    my $dbh = __PACKAGE__->db_Main();  
    my $sql = "INSERT INTO subgroup_testgroups (subgroup_id,testgroup_id,sort_order) VALUES (?,?,1)";
    foreach my $new_testgroup_id (@$new_testgroup_ids) {
      my $rows = $dbh->do($sql, 
			  undef,
			  $self->subgroup_id,
			  $new_testgroup_id
			 );
    }
  }
}

#########################################################################
sub update_testgroup() {
  my $self = shift;
  my $testgroup_id = shift;
  my $sort_order = shift;
  
  # Sort order defaults to 1.
  if (!$sort_order) {
    $sort_order = 1;
  }

  my $rv = $self->delete_from_testgroup($testgroup_id);
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "INSERT INTO subgroup_testgroups (subgroup_id,testgroup_id,sort_order) VALUES (?,?,?)";
  return $dbh->do($sql, 
                  undef,
                  $self->subgroup_id,
                  $testgroup_id,
                  $sort_order
                 );
}

#########################################################################
sub update_testcases() {
  my $self = shift;
  my $new_testcase_ids = shift;
  
  # We always want to delete the existing testcases. 
  # Failing to delete testcases is _not_ fatal when adding a new subgroup.
  my $rv = $self->delete_from_testcases();

  if (scalar @$new_testcase_ids) {
    my $dbh = __PACKAGE__->db_Main();  
    my $sql = "INSERT INTO testcase_subgroups (testcase_id,subgroup_id,sort_order) VALUES (?,?,?)";
    my $sort_order = 1;
    foreach my $new_testcase_id (@$new_testcase_ids) {
      next if (!$new_testcase_id);
      # Log any failures/duplicate keys.
      eval {
        my $rows = $dbh->do($sql, 
                            undef,
                            $new_testcase_id,
                            $self->subgroup_id,
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
