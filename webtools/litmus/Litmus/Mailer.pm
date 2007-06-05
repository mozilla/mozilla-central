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

# Email management functions

package Litmus::Mailer;

use strict;

#use Litmus;
use Litmus::Error;
#use Litmus::Config;
use Email::MIME;
use Email::MIME::Modifier;
use Email::Send;

our @ISA = qw(Exporter);
@Litmus::Mailer::EXPORT = qw(
    sendMessage
);

# cribbed in part from Bugzilla's MessageToMTA
sub sendMessage {
	my $msg = shift;
	
	local $ENV{PATH} = $Litmus::Config::sendmail_path;

	open(MAIL, "| sendmail -t -oi") || Litmus::Error::basicError("Could not send email: $!");
	print MAIL $msg || Litmus::Error::basicError("Could not send email: $!");
	close(MAIL) || Litmus::Error::basicError("Could not send email: $!");
}



1;
