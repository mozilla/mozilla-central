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
 # Portions created by the Initial Developer are Copyright (C) 2007
 # the Initial Developer. All Rights Reserved.
 #
 # Contributor(s):
 #   Zach Lipton <zach@zachlipton.com>
 #
 # ***** END LICENSE BLOCK *****

=cut

package Litmus::DB::SecurityGroup;

use strict;
use Litmus::Config;
use Litmus::Memoize;
use base 'Litmus::DBI';

Litmus::DB::SecurityGroup->table('security_groups');

Litmus::DB::SecurityGroup->columns(All => qw/group_id name description grouptype isactive/);
Litmus::DB::SecurityGroup->utf8_columns(qw/name description/);
Litmus::DB::SecurityGroup->columns(TEMP => qw//);

Litmus::DB::SecurityGroup->has_many(users => ["Litmus::DB::UserGroupMap" => 'user_id']);
Litmus::DB::SecurityGroup->has_many(products => ["Litmus::DB::GroupProductMap" => 'product_id']);

# group types: 
# 1 - superuser
# 2 - test run and test day administrator
# 3 - product admin
# 4 - testcase security group

# create an initial set of groups for an upgraded installation
sub upgradeGroups {
	# check to see if groups need to be created:
	my @rows = Litmus::DB::SecurityGroup->search({grouptype => 1});
	if ($rows[0]) {
		return;
	}
	print "creating intial groups...";
	# first, create a superuser group:
	my $admingroup = Litmus::DB::SecurityGroup->create({
		name => "Litmus Super Administrators",
		description => "Global administrators of this Litmus installation",
		grouptype => 1,
		isactive => 1,
	});
	# add current gloabl admins to the superuser group
	my @admins = Litmus::DB::User->search({is_admin_old => 1});
	foreach my $cur (@admins) {
		Litmus::DB::UserGroupMap->create({group => $admingroup, user=>$cur});
	}
	
	# create a test run/testday admin group
	my $rundaygroup = Litmus::DB::SecurityGroup->create({
		name => "Litmus Test Run/Test Day Administrators",
		description => "Administrators of Litmus Test Runs and Test Days",
		grouptype => 2,
		isactive => 1,
	});
	
	# create product admin groups for all products
	my @products = Litmus::DB::Product->retrieve_all();
	foreach my $cur2 (@products) {
		my $productgroup = Litmus::DB::SecurityGroup->create({
			name => $cur2->name()." Administrators",
			description => "Administrators of the ".$cur2->name()." product",
			grouptype => 3,
			isactive => 1,
		});
		Litmus::DB::GroupProductMap->create({group=>$productgroup, product=>$cur2});
	}
}

# hack!
sub selected {
	my $self = shift;
	if ($self->{'selected'}) {
		return 1;
	}
	return 0;
}

# this can persist across mod_perl requests:
memoize('getSuperUserGroup', persist=>1);
sub getSuperUserGroup {
	my $self = shift;
	my @rows = __PACKAGE__->search(name => "Litmus Super Administrators");
	return $rows[0];
}
memoize('getRunDayGroup', persist=>1);
sub getRunDayGroup {
	my $self = shift;
	my @rows = __PACKAGE__->search(name => "Litmus Test Run/Test Day Administrators");
	return $rows[0];
}
1;



