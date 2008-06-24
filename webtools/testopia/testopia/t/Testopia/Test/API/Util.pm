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
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

package Testopia::Test::API::Util;

use strict;

use base qw(Exporter);

@Testopia::Test::API::Util::EXPORT = qw(proxy check_fault);

use XMLRPC::Lite;             # From the SOAP::Lite Module
use File::Basename qw(dirname);
use HTTP::Cookies;

use lib "../../../..";
use lib "../../..";
use lib "../..";

use Bugzilla;
use Bugzilla::Constants;

Bugzilla->error_mode(ERROR_MODE_DIE);

# Used by the XMLRPC::Lite client to connect to the TEST installation
use constant API_URL => 'http://localhost/workspace/bnc-3.0/tr_xmlrpc.cgi';

our $proxy;

sub proxy {
    my ($user) = @_;
    unless ( defined $proxy ) {
        my $cookie_jar = new HTTP::Cookies(
            'file'     => File::Spec->catdir( dirname($0), 'cookies.txt' ),
            'autosave' => 1
        );

        $proxy = XMLRPC::Lite->proxy( API_URL, 'cookie_jar' => $cookie_jar );

        # Log in.
        my $soapresult = $proxy->call(
            'User.login',
            {
                login    => $user->{'login_name'},
                password => $user->{'password'}
            }
        );
    }
    return $proxy;
}

sub check_fault {
    my ($response, $unit) = @_;
    my $fault = $response->faultstring;
    if ($response->fault){
        print "ERROR: " . $unit->{'Test::Unit::TestCase_name'};
        print " - " . $response->faultstring . "\n";
        $unit->fail();
    }
}

1;

__END__

=head1 NAME 

PerlUnit::Testopia::API::Util

=head1 SYNOPSIS

# Get the XMLRPC::Lite proxy handle
my $xmlrpc_lite_proxy = perlUnit::TestopiaAPI->proxy;

# Update a testopia case run
my $result = perlUnit::TestopiaAPI->update_caserun($case_id, $run_id, $result);

=head1 DESCRIPTION

Provides methods that allow the results from a perlUnit test run to entered 
into a test caserun in testopia via the Testopia RPC API.  


=head1 REQUIRES

SOAP::Transport::HTTP, XMLRPC::Lite

=cut
=item proxy

b<Returns> the XMLRPC::Lite->proxy handle for the testing server.

=back

=cut


