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

package Litmus::DB::User;

use strict;
use Litmus::Config;
use Litmus::Memoize;
use base 'Litmus::DBI';

Litmus::DB::User->table('users');

Litmus::DB::User->columns(All => qw/user_id bugzilla_uid email password realname irc_nickname enabled authtoken/);
Litmus::DB::User->utf8_columns(qw/email realname irc_nickname authtoken/);
Litmus::DB::User->columns(TEMP => qw/is_admin_old num_results/);

Litmus::DB::User->column_alias("isSuperUser", "istrusted");
Litmus::DB::User->column_alias("isSuperUser", "is_trusted");
Litmus::DB::User->column_alias("isSuperUser", "is_admin");

Litmus::DB::User->column_alias("email", "username");

Litmus::DB::User->has_many(test_results => "Litmus::DB::Testresult");
Litmus::DB::User->has_many(sessions => "Litmus::DB::Session");
Litmus::DB::User->has_many(groups => ["Litmus::DB::UserGroupMap" => 'group']);

# ZLL: only load BugzillaUser if Bugzilla Auth is actually enabled
if ($Litmus::Config::bugzilla_auth_enabled) {
	Litmus::DB::User->has_a(bugzilla_uid => "Litmus::DB::BugzillaUser");
}

__PACKAGE__->set_sql(RetrieveAll => qq{
                                       SELECT __ESSENTIAL__
                                       FROM   __TABLE__
                                       ORDER BY email ASC
});

__PACKAGE__->set_sql(TopTesters => qq{
                                      SELECT users.user_id, users.email, count(*) AS num_results
                                      FROM users, test_results
                                      WHERE users.user_id=test_results.user_id
                                      GROUP BY user_id
                                      ORDER BY num_results DESC
                                      LIMIT 15
});



#########################################################################
# search for users by email, irc nick, realname, or group
sub search_full_text {
	my $self = shift;
	my $email = shift;
	my $nick = shift;
	my $realname = shift;
	my @groups = shift; 
	
	my $dbh = Litmus::DBI->db_ReadOnly();
	my @args;
	
	my $sql = q{
	SELECT DISTINCT users.user_id, users.email, users.irc_nickname
	FROM users, user_group_map
	WHERE 
	 (
	};
	
	if ($email) {
	  $sql .= "users.email COLLATE latin1_general_ci like concat('%%',?,'%%') OR ";
	  push(@args, $email);
	}
	if ($nick) {
	  $sql .= "users.irc_nickname COLLATE latin1_general_ci  like concat('%%',?,'%%') OR ";
	  push(@args, $nick);
	}
	if ($realname) {
	  $sql .= "users.realname COLLATE latin1_general_ci like concat('%%',?,'%%')";
	  push(@args, $realname);
	}
	# catch all case for no email, nick, or realname
	if (! ($realname || $nick || $email)) {
		$sql .= "1=1";
	}


	$sql .= ")";
	
	if ($groups[0]) {
		$sql .= " AND ((user_group_map.user_id = users.user_id) ";
		foreach my $cur (@groups) {
			$sql .= "AND user_group_map.group_id = ".$cur->group_id();
		}
		$sql .= ") ";
	}
	
	$sql .= "GROUP BY users.user_id ";
	$sql .= "ORDER BY users.email ASC";
	
	my $sth = $dbh->prepare($sql);
	$sth->execute(@args);
	return $self->sth_to_objects($sth);
}

# the COLLATE latin1_general_ci sillyness forces a case-insensitive match
# removed a LIMIT 300 to work around a mysql bug in the ancient version
# on rodan
__PACKAGE__->set_sql(FullTextMatches => q{
	SELECT *
	FROM __TABLE__ 
	WHERE 
	  email COLLATE latin1_general_ci like concat('%%',?,'%%') OR 
	  irc_nickname COLLATE latin1_general_ci  like concat('%%',?,'%%') OR 
	  realname COLLATE latin1_general_ci like concat('%%',?,'%%') 
	ORDER BY email ASC
});



#########################################################################
# returns the crypt'd password from a linked Bugzilla account if it 
# exists or the Litmus user account
sub getRealPasswd {
  my $self = shift;
  if ($self->bugzilla_uid()) {
    return $self->bugzilla_uid()->cryptpassword();
  } else {
    return $self->password();
  }
}

#########################################################################
memoize('getDisplayName');
sub getDisplayName() {
  my $self = shift;
  
  return $self->irc_nickname if ($self->irc_nickname and
                                 $self->irc_nickname ne '');
  return $self->realname if ($self->realname and
                             $self->realname ne '');
  
  if ($self->email and
      $self->email ne '') {
    my $display_name = $self->email;
    $display_name =~ s/\@.*$//g;
    return $display_name
  }

  return undef;
}

#########################################################################
# Group functions
#########################################################################
__PACKAGE__->set_sql(userInGroup => q{
	SELECT DISTINCT users.user_id FROM __TABLE__, security_groups, user_group_map 
	  WHERE
	   user_group_map.group_id = ? AND users.user_id = user_group_map.user_id
	   AND users.user_id= ?
});

__PACKAGE__->set_sql(userInAnyAdminGroup => q{
	SELECT DISTINCT users.user_id FROM __TABLE__, security_groups, user_group_map 
	  WHERE
	   (security_groups.grouptype=1 OR security_groups.grouptype=2 
	   OR security_groups.grouptype=3) AND 
	   users.user_id = user_group_map.user_id
	   AND users.user_id= ?
});

__PACKAGE__->set_sql(userInProductAdminGroup => q{
	SELECT DISTINCT users.user_id FROM __TABLE__, security_groups, 
	  user_group_map, group_product_map
	  WHERE security_groups.grouptype=3 AND 
	   users.user_id = user_group_map.user_id AND
	   user_group_map.group_id=security_groups.group_id AND
	   users.user_id= ? AND
	   security_groups.group_id=group_product_map.group_id AND
	   group_product_map.product_id = ?
});

# returns true if the user is a member of $group, otherwise false
memoize('inGroup');
sub inGroup {
	my $self = shift;
	my $group = shift;
	
	my @users = __PACKAGE__->search_userInGroup($group, $self);
	
	if (@users) { return 1 }
	return 0;
}

memoize('isSuperUser');
sub isSuperUser {
	my $self = shift;
	if ($self->inGroup(Litmus::DB::SecurityGroup->getSuperUserGroup)) {
		return 1;
	}
	else {
		return 0;
	}
}

memoize('isRunDayAdmin');
sub isRunDayAdmin {
	my $self = shift;
	if ($self->inGroup(Litmus::DB::SecurityGroup->getRunDayGroup()) ||
	    $self->isSuperUser()) {
		return 1;
	}
	else {
		return 0;
	}
}

# returns true if the user is a superuser or a member of any product admin group
# (to determine whether to show any admin controls)
memoize('isInAdminGroup');
sub isInAdminGroup {
	my $self = shift;
	my @rows = $self->search_userInAnyAdminGroup($self);
	if (@rows) {
		return 1;
	}
	return 0;
}

# returns true if the user is an admin of $product or is a superuser
memoize('isProductAdmin');
sub isProductAdmin {
	my $self = shift;
	my $product = shift;
	
	if ($self->isSuperUser()) {
		return 1;
	}
	
	my @users = $self->search_userInProductAdminGroup($self, $product);
	if (@users) {
		return 1;
	} else {
		return 0;
	}
}

1;



