# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Mozilla Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Bugzilla Testopia System.
#
# The Initial Developer of the Original Code is Greg Hendricks.
# Portions created by Greg Hendricks are Copyright (C) 2006
# Novell. All Rights Reserved.
#
# Contributor(s): Dallas Harken <dharken@novell.com>
#                 Greg Hendricks <ghendricks@novell.com>

package Bugzilla::WebService::Testopia::Testopia;

use strict;

use base qw(Bugzilla::WebService);

use Bugzilla::Error;
use Bugzilla::Constants;

sub api_version {
    my $self = shift;
    return "2.0";
}

sub testopia_version {
    my $self = shift;
    return "2.0-RC2";
}

1;

__END__

=head1 NAME

Bugzilla::Testopia::Webservice::Testopia

=head1 EXTENDS

Bugzilla::Webservice

=head1 DESCRIPTION

Provides information about this installation.

=head1 METHODS

=over

=item C<api_version()>

 Description: Returns the API version.

=item C<testopia_version()>

 Description: Returns the version of Testopia on this server.

=back

=head1 SEE ALSO

L<Bugzilla::Webservice> 

=head1 AUTHOR

Greg Hendricks <ghendricks@novell.com> 
 
