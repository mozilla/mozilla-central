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
 # the Initial Developetr. All Rights Reserved.
 #
 # Contributor(s):
 #   Chris Cooper <ccooper@deadsquid.com>
 #   Zach Lipton <zach@zachlipton.com>
 #
 # ***** END LICENSE BLOCK *****

=cut

package Litmus::DB::TestRun;

use strict;
use base 'Litmus::DBI';

use Litmus::DB::Testgroup;

Litmus::DB::TestRun->table('test_runs');

Litmus::DB::TestRun->columns(Primary => qw/test_run_id/);
Litmus::DB::TestRun->columns(All => qw/test_run_id name description start_timestamp finish_timestamp enabled recommended product_id branch_id creation_date last_updated author_id version/);
Litmus::DB::TestRun->columns(Essential => qw/test_run_id name description start_timestamp finish_timestamp enabled recommended product_id branch_id creation_date last_updated author_id version/);
Litmus::DB::TestRun->columns(TEMP => qw/testgroups/);
Litmus::DB::TestRun->columns(TEMP => qw/criteria/);

Litmus::DB::TestRun->column_alias("product_id", "product");
Litmus::DB::TestRun->column_alias("branch_id", "branch");
Litmus::DB::TestRun->column_alias("author_id", "author");

Litmus::DB::TestRun->has_a(product => "Litmus::DB::Product");
Litmus::DB::TestRun->has_a(branch => "Litmus::DB::Branch");
Litmus::DB::TestRun->has_a(author => "Litmus::DB::User");

#########################################################################
sub getCriteria() {
  my $self = shift;

  my $dbh = __PACKAGE__->db_Main();
  my $sql = "SELECT trc.build_id, trc.platform_id, trc.opsys_id,
                    pl.name AS platform_name, o.name AS opsys_name
             FROM test_run_criteria trc
                  LEFT JOIN platforms pl ON trc.platform_id=pl.platform_id
                  LEFT JOIN opsyses o ON trc.opsys_id=o.opsys_id
             WHERE trc.test_run_id=?";
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->test_run_id);
  my @criteria;
  while (my $data = $sth->fetchrow_hashref) {
    push @criteria, $data;
  }
  $sth->finish();

  return \@criteria;
}

#########################################################################
sub getCriteriaSql() {
  my $self = shift;
  
  # Iterate over criteria
  if (!$self->criteria) {
    $self->criteria($self->getCriteria());
  }
  if ($self->criteria and scalar @{$self->criteria} > 0) {
    my $criteria_sql .= " AND (";
    foreach my $criterion (@{$self->criteria}) {
      my $criterion_sql;
      if ($criteria_sql ne " AND (") {
        $criterion_sql = " OR (";
      } else {
        $criterion_sql = "(";
      }
      if ($criterion->{'build_id'}) {
        $criterion_sql .= "tr.build_id=" . $criterion->{'build_id'};
      }
      # We can ignore platform if opsys is provided.
      if ($criterion->{'opsys_id'}) {
        $criterion_sql .= " AND " if ($criterion_sql ne '(');
        $criterion_sql .= "tr.opsys_id=" . $criterion->{'opsys_id'};        
      } elsif ($criterion->{'platform_id'}) {
        $criterion_sql .= " AND " if ($criterion_sql ne '(');
        $criterion_sql .= "pl.platform_id=" . $criterion->{'platform_id'};
      }
      $criterion_sql .= ')';
      $criteria_sql .= $criterion_sql;
    }
    $criteria_sql .= ')';
#    print STDERR $criteria_sql;
    return $criteria_sql;
  }
  
  return "";
}
 
#########################################################################
sub clone() {
  my $self = shift;

  my $new_test_run = $self->copy;
  if (!$new_test_run) {
    return undef;
  }

  my $dbh = __PACKAGE__->db_Main();

  # Propagate testgroup membership;
  my $sql = "INSERT INTO test_run_testgroups (test_run_id,testgroup_id,sort_order) SELECT ?,testgroup_id,sort_order FROM test_run_testgroups WHERE test_run_id=?";

  my $rows = $dbh->do($sql,
                   undef,
                   $new_test_run->test_run_id,
                   $self->test_run_id
                  );
  if (! $rows) {
    print STDERR "Unable to clone test run membership for test run ID# " . $self->test_run_id . ' -> ' . $new_test_run->test_run_id . "\n";
  }

  # Propagate criteria.
  $sql = "INSERT INTO test_run_criteria (test_run_id,build_id,platform_id,opsys_id) SELECT ?,build_id,platform_id,opsys_id FROM test_run_criteria WHERE test_run_id=?";

  $rows = $dbh->do($sql,
                   undef,
                   $new_test_run->test_run_id,
                   $self->test_run_id
                  );
  if (! $rows) {
    print STDERR "Unable to clone test run criteria for test run ID# " . $self->test_run_id . ' -> ' . $new_test_run->test_run_id . "\n";
  }

  return $new_test_run;
}

#########################################################################
sub delete_testgroups() {
  my $self = shift;

  my $dbh = __PACKAGE__->db_Main();
  my $sql = "DELETE from test_run_testgroups WHERE test_run_id=?";
  my $rows = $dbh->do($sql,
                      undef,
                      $self->test_run_id
                     );
}

#########################################################################
sub delete_criteria() {
  my $self = shift;

  my $dbh = __PACKAGE__->db_Main();
  my $sql = "DELETE from test_run_criteria WHERE test_run_id=?";
  my $rows = $dbh->do($sql,
                      undef,
                      $self->test_run_id
                     );
}
 
#########################################################################
sub delete_with_refs() {
  my $self = shift;
  $self->delete_testgroups();
  $self->delete_criteria();
  return $self->delete;
}

#########################################################################
sub update_testgroups() {
  my $self = shift;
  my $new_testgroup_ids = shift;

  # We always want to delete the existing testgroups.
  # Failing to delete testgroups is _not_ fatal when adding a new test run.
  my $rv = $self->delete_testgroups();
  if (scalar @$new_testgroup_ids) {
    my $dbh = __PACKAGE__->db_Main();
    my $sql = "INSERT INTO test_run_testgroups (testgroup_id,test_run_id,sort_order) VALUES (?,?,?)";
    my $sort_order = 1;
    foreach my $new_testgroup_id (@$new_testgroup_ids) {
      next if (!$new_testgroup_id);
      # Log any failures/duplicate keys to STDERtr.
      eval {
        my $rows = $dbh->do($sql,
                            undef,
                            $new_testgroup_id,
                            $self->test_run_id,
                            $sort_order
                           );
      };
      if ($@) {
        print STDERR $@;
      }
      $sort_order++;
    }
  }
  
}

#########################################################################
sub update_criteria() {
  my $self = shift;
  my $new_criteria = shift;

  # We always want to delete the existing criteria.
  # Failing to delete criteria is _not_ fatal when adding a new test run.
  my $rv = $self->delete_criteria();

  if (scalar @$new_criteria) {
    my $dbh = __PACKAGE__->db_Main();
    my $sql = "INSERT INTO test_run_criteria (test_run_id,build_id,platform_id,opsys_id) VALUES (?,?,?,?)";
    foreach my $criterion (@$new_criteria) {
      next if (!$criterion);
      # Log any failures/duplicate keys to STDERtr.
      eval {
        my $rows = $dbh->do($sql,
                            undef,
                            $self->test_run_id,
                            $criterion->{'build_id'},
                            $criterion->{'platform_id'},
                            $criterion->{'opsys_id'}
                           );
      };
      if ($@) {
        print STDERR $@;
      }
    }
  }
  
}


#########################################################################
sub getTestRuns() {
  my ($self, $in_progress, $recommended, $limit) = @_;

  my $select = "SELECT test_run_id FROM test_runs";
  my $where = "";
  my $order_by = "";
  if ($in_progress) {
    $where = " WHERE start_timestamp<=NOW() AND finish_timestamp>NOW()";
  }
  if ($recommended and $recommended ne 'all') {
    if ($where eq "") {
      $where = ' WHERE';
    } else {
      $where .= ' AND';
    }
    if ($recommended eq 'true') {
      $where .= ' recommended=1';
    } else {
      $where .= ' recommended=0';
    }      
    $order_by = ' ORDER BY finish_timestamp ASC';
  } else {
    $order_by = ' ORDER BY recommended DESC, finish_timestamp ASC';
  }

  my $sql = $select . $where . $order_by;

  if ($limit) {
    $sql .= " LIMIT $limit";
  }

  my $dbh = __PACKAGE__->db_Main();
  my $sth = $dbh->prepare($sql);
  $sth->execute();
  my @test_run_ids;
  while (my ($test_run_id) = $sth->fetchrow_array) {
    push @test_run_ids, $test_run_id;
  }
  $sth->finish();

  my @test_runs;
  foreach my $test_run_id (@test_run_ids) {
    my $test_run = Litmus::DB::TestRun->getTestRunWithRefs($test_run_id);
    push @test_runs, $test_run;
  }
  return @test_runs;
}

#########################################################################
sub coverage {
  my $self = shift;
  my $community_only = shift;
  my $user = shift;
  my $trusted = shift;

  my @testcase_ids;
  # Community members can only be expected to submit results for testcases
  # than they have access to.  
  if ($community_only) {
    @testcase_ids = Litmus::DB::Testcase->search_CommunityEnabledByTestRun($self->test_run_id);
  } else {
    @testcase_ids = Litmus::DB::Testcase->search_EnabledByTestRun($self->test_run_id);
  }

  my $sql = "
SELECT COUNT(DISTINCT(tr.testcase_id))
FROM test_runs trun, test_run_testgroups truntg, testgroups tg, subgroup_testgroups sgtg, subgroups sg, testcase_subgroups tcsg, testcases tc, test_results tr, opsyses o, platforms pl, users u
WHERE
  trun.test_run_id=? AND
  trun.test_run_id=truntg.test_run_id AND
  truntg.testgroup_id=sgtg.testgroup_id AND
  truntg.testgroup_id=tg.testgroup_id AND
  sgtg.subgroup_id=tcsg.subgroup_id AND
  sgtg.subgroup_id=sg.subgroup_id AND
  tcsg.testcase_id=tc.testcase_id AND
  tc.testcase_id=tr.testcase_id AND
  tr.opsys_id=o.opsys_id AND
  o.platform_id=pl.platform_id AND
  tg.enabled=1 AND
  sg.enabled=1 AND
  tc.enabled=1 AND
  tr.submission_time>=trun.start_timestamp AND
  tr.submission_time<=trun.finish_timestamp AND
  tr.branch_id=trun.branch_id AND
  tr.user_id=u.user_id
";

  if ($community_only) {
    $sql .= " AND tc.community_enabled=1";
  }

  if ($user) {
    $sql .= " AND tr.user_id=$user";
  }

  if ($trusted) {
    $sql .= " AND u.is_admin=1";
  }

  $sql .= $self->getCriteriaSql();

  my $dbh = __PACKAGE__->db_Main();
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->test_run_id);
  my ($num_testcases_with_results) = $sth->fetchrow_array;
  $sth->finish();

  if (scalar @testcase_ids <= 0) {
    return undef;
  }

  my $coverage = sprintf("%d",100*$num_testcases_with_results/(scalar @testcase_ids));

  return $coverage;
}

#########################################################################
sub getNumResultsByStatus {
  my $self = shift;
  my $status_id = shift;
  my $community_only = shift;
  my $user = shift;
  my $trusted = shift;

  my $sql = "
SELECT COUNT(DISTINCT(tr.testresult_id))
FROM test_runs trun, test_run_testgroups truntg, testgroups tg, subgroup_testgroups sgtg, subgroups sg, testcase_subgroups tcsg, testcases tc, test_results tr, opsyses o, platforms pl, users u
WHERE
  trun.test_run_id=? AND
  trun.test_run_id=truntg.test_run_id AND
  truntg.testgroup_id=sgtg.testgroup_id AND
  truntg.testgroup_id=tg.testgroup_id AND
  sgtg.subgroup_id=tcsg.subgroup_id AND
  sgtg.subgroup_id=sg.subgroup_id AND
  tcsg.testcase_id=tc.testcase_id AND
  tc.testcase_id=tr.testcase_id AND
  tr.opsys_id=o.opsys_id AND
  o.platform_id=pl.platform_id AND
  tg.enabled=1 AND
  sg.enabled=1 AND
  tc.enabled=1 AND
  tr.submission_time>=trun.start_timestamp AND
  tr.submission_time<=trun.finish_timestamp AND
  tr.branch_id=trun.branch_id AND
  tr.user_id=u.user_id AND
  tr.result_status_id=?
";

  if ($community_only) {
    $sql .= " AND tc.community_enabled=1";
  }

  if ($user) {
    $sql .= " AND tr.user_id=$user";
  }

  if ($trusted) {
    $sql .= " AND u.is_admin=1";
  }

  $sql .= $self->getCriteriaSql();

  my $dbh = __PACKAGE__->db_Main();
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->test_run_id,$status_id);
  my ($num_results) = $sth->fetchrow_array;
  $sth->finish();

  return $num_results;
}

#########################################################################
sub getNumResultsWithComments {
  my $self = shift;
  my $community_only = shift;
  my $user = shift;
  my $trusted = shift;

  my $sql = "
SELECT COUNT(DISTINCT(tr.testresult_id))
FROM test_runs trun, test_run_testgroups trtg, testgroups tg, subgroup_testgroups sgtg, subgroups sg, testcase_subgroups tcsg, testcases tc, test_results tr INNER JOIN test_result_comments trc ON tr.testresult_id=trc.test_result_id, opsyses o, platforms pl, users u
WHERE
  trun.test_run_id=? AND
  trun.test_run_id=trtg.test_run_id AND
  trtg.testgroup_id=sgtg.testgroup_id AND
  trtg.testgroup_id=tg.testgroup_id AND
  sgtg.subgroup_id=tcsg.subgroup_id AND
  sgtg.subgroup_id=sg.subgroup_id AND
  tcsg.testcase_id=tc.testcase_id AND
  tc.testcase_id=tr.testcase_id AND
  tr.opsys_id=o.opsys_id AND
  o.platform_id=pl.platform_id AND
  tg.enabled=1 AND
  sg.enabled=1 AND
  tc.enabled=1 AND
  tr.submission_time>=trun.start_timestamp AND
  tr.submission_time<=trun.finish_timestamp AND
  tr.branch_id=trun.branch_id AND
  tr.user_id=u.user_id
";

  if ($community_only) {
    $sql .= " AND tc.community_enabled=1";
  }

  if ($user) {
    $sql .= " AND tr.user_id=$user";
  }

  if ($trusted) {
    $sql .= " AND u.is_admin=1";
  }

  $sql .= $self->getCriteriaSql();

  my $dbh = __PACKAGE__->db_Main();
  my $sth = $dbh->prepare($sql);
  $sth->execute($self->test_run_id);
  my ($num_results) = $sth->fetchrow_array;
  $sth->finish();

  return $num_results;
}

#########################################################################
sub getTestRunWithRefs {
  my $self = shift;
  my $test_run_id = shift;
  
  my $test_run = Litmus::DB::TestRun->retrieve($test_run_id);
  if ($test_run) {
    my @testgroups = Litmus::DB::Testgroup->search_ByTestRun($test_run->{'test_run_id'});
    $test_run->{'testgroups'} = \@testgroups;
    my $criteria = $test_run->getCriteria();
    $test_run->{'criteria'} = $criteria;
  }
  
  return $test_run;
}

#########################################################################
sub flagCriteriaInUse() {
  my $self = shift;
  my $sysconfig = shift;

  my $opsys = Litmus::DB::Opsys->retrieve($sysconfig->{'opsys_id'});

  if ($self->criteria and scalar(@{$self->criteria}) > 0) {
    foreach my $criterion (@{$self->criteria}) {
      # Build ID alone is the smallest possible criteria set.
      if ($criterion->{'build_id'} == $sysconfig->{'build_id'}) {
        if ($criterion->{'platform_id'}) {
          if ($criterion->{'platform_id'} == $sysconfig->{'platform_id'}) {
            if ($criterion->{'opsys_id'}) {
              if ($criterion->{'opsys_id'} == $sysconfig->{'opsys_id'}) {
                # Matches build ID, platform ID, and opsys ID
                $criterion->{'in_use'} = 1;
                last;
              }
              next;
            }
            # Matches build ID and platform ID
            $criterion->{'in_use'} = 1;
            $criterion->{'opsys_id'} = $sysconfig->{'opsys_id'};
            $criterion->{'opsys_name'} = $opsys->name;
            $criterion->{'opsys_id_from_user'} = 1;
            last;
          }
          next;
        }
        # Matches build ID.
        $criterion->{'in_use'} = 1;
        $criterion->{'platform_id'} = $sysconfig->{'platform_id'};
        $criterion->{'platform_name'} = $opsys->platform->name;
        $criterion->{'platform_id_from_user'} = 1;
        $criterion->{'opsys_id'} = $sysconfig->{'opsys_id'};
        $criterion->{'opsys_name'} = $opsys->name;
        $criterion->{'opsys_id_from_user'} = 1;
        last;
      }
    }
  } else {
    # No criteria associated with this test run, so any complete set of
    # criteria will do.
    my $criterion;
    $criterion->{'in_use'} = 1;
    $criterion->{'build_id'} = $sysconfig->{'build_id'};
    $criterion->{'build_id_from_user'} = 1;
    $criterion->{'platform_id'} = $sysconfig->{'platform_id'};
    $criterion->{'platform_name'} = $opsys->platform->name;
    $criterion->{'platform_id_from_user'} = 1;
    $criterion->{'opsys_id'} = $sysconfig->{'opsys_id'};
    $criterion->{'opsys_name'} = $opsys->name;
    $criterion->{'opsys_id_from_user'} = 1;
    push @{$self->{'criteria'}}, $criterion;
  }

}

1;
