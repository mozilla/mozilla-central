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

package Litmus::DB::UserGroupMap;

use strict;
use Litmus::Config;
use base 'Litmus::DBI';

Litmus::DB::UserGroupMap->table('user_group_map');

Litmus::DB::UserGroupMap->columns(All => qw/user_id group_id/);
Litmus::DB::UserGroupMap->columns(TEMP => qw//);

Litmus::DB::UserGroupMap->column_alias("user_id", "user");
Litmus::DB::UserGroupMap->column_alias("group_id", "group");

Litmus::DB::UserGroupMap->has_a(user => "Litmus::DB::User");
Litmus::DB::UserGroupMap->has_a(group => "Litmus::DB::SecurityGroup");

__PACKAGE__->set_sql(remove_map => q{
	DELETE FROM __TABLE__ WHERE 
	  user_id = ? AND group_id = ?
});

sub remove {
	my $self = shift;
	my $user_id = shift;
	my $group_id = shift;
	my $sth = __PACKAGE__->sql_remove_map;
	$sth->execute($user_id, $group_id);
}

1;



