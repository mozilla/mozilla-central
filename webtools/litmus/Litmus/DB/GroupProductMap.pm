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

package Litmus::DB::GroupProductMap;

use strict;
use Litmus::Config;
use base 'Litmus::DBI';

Litmus::DB::GroupProductMap->table('group_product_map');

Litmus::DB::GroupProductMap->columns(All => qw/group_id product_id/);
Litmus::DB::GroupProductMap->columns(TEMP => qw//);

Litmus::DB::GroupProductMap->column_alias("group_id", "group");
Litmus::DB::GroupProductMap->column_alias("product_id", "product");

Litmus::DB::GroupProductMap->has_a(group => "Litmus::DB::SecurityGroup");
Litmus::DB::GroupProductMap->has_a(product => "Litmus::DB::Product");

1;



