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

package Litmus::DB::PasswordResets;

use strict;
use Litmus::Config;
use base 'Litmus::DBI';

Litmus::DB::PasswordResets->table('password_resets');

Litmus::DB::PasswordResets->columns(All => qw/user_id session_id/);
Litmus::DB::PasswordResets->columns(TEMP => qw//);

Litmus::DB::PasswordResets->column_alias("user_id", "user");
Litmus::DB::PasswordResets->column_alias("session_id", "session");

Litmus::DB::PasswordResets->has_a(user => "Litmus::DB::User");
Litmus::DB::PasswordResets->has_a(session => "Litmus::DB::Session");

1;
