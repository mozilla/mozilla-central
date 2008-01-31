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
 #   Zach Lipton <zach@zachlipton.com>
 #   Chris Cooper <ccooper@deadsquid.com>
 #
 # ***** END LICENSE BLOCK *****

=cut

package Litmus::DB::Tag; 
$VERSION = 1.00;
use strict;
use base 'Litmus::DBI';

Litmus::DB::Tag->table('Tags');

Litmus::DB::Tag->columns(All => qw/tag_id tag_name user_id creation_date/);
Litmus::DB::Tag->columns(Essential => qw/tag_id tag_name user_id creation_date/);
Litmus::DB::Tag->utf8_columns(qw/tag_name/);
Litmus::DB::Tag->columns(TEMP => qw //);

Litmus::DB::Tag->column_alias("user_id", "user");

Litmus::DB::Tag->has_a(user => "Litmus::DB::User");

#########################################################################
sub find_or_create {
  my $self = shift;
  my %args = shift;
  
  my ($tag) = Litmus::DB::Tag->search(tag_name => $args{'tag_name'});
  if (!$tag) {
    $tag = Litmus::DB::Tag->create(%args);
  }
  return $tag;
}

#########################################################################
sub delete_from_testcases() {
  my $self = shift;
  
  my $dbh = __PACKAGE__->db_Main();  
  my $sql = "DELETE from testcase_tags WHERE tag_id=?";
  return $dbh->do($sql,
                  undef,
                  $self->tag_id
                 );
}

1;
