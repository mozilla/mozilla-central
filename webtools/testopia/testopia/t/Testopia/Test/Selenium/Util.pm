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
#                 Jeff Dayley    <jedayley@novell.com>
#                 Ben Warby      <bwarby@novell.com>

package Testopia::Test::Selenium::Util;

use base qw(Exporter);

@Testopia::Test::Selenium::Util::EXPORT = qw(
  remove_whitespace
  format_url
  $se
);

use strict;

use lib "../../../../..";
use lib "../../..";
use lib "../..";
use lib "..";
use Bugzilla;

use Testopia::Test::Selenium::Constants;

use Bugzilla::Util;
use WWW::Selenium;
use constant UTIL_TIMEOUT => 35000;

our $se = get_selenium();

=head1 METHODS

=over

=cut

=item remove_whitespace

Removes any whitespace more than an single whitespace and any trailing 
whitespace.  This is so items from the database will match how they appear in 
html.  Text in html only has single whitespaces and no trailing whitespace 

=cut

sub remove_whitespace {
    my $string = shift;

    $string =~ s/\s/ /g;
    $string =~ s/\s{2,}/ /g;
    $string =~ s/\s+$//g;

    return $string;
}

=item sel

Determines if an existing selenium handles exists.  If it does it returns the 
existing handle, if not it creates a new one and returns it.

=cut

sub get_selenium {
    unless ( defined $se ) {
        $se = WWW::Selenium->new(
            host        => SEL_HOST,
            port        => SEL_PORT,
            browser     => SEL_BROWSER,
            browser_url => SEL_BROWSER_URL
        );
    }

    return $se;
}

=item format_url($loc)

Takes a url and a hashref of params and creates a urlto match the 
format page.cgi?param1=val1&parma2=val2...


=cut

sub format_url {
    my $loc = shift;

    #print STDERR join ',',@INC;
    my $url = $loc->{url} . '?action=' . $loc->{action} . '&';

    #print STDERR Data::Dumper::Dumper($loc);
    while ( my ( $param, $val ) = each( %{ $loc->{params} } ) ) {    #print STDERR "value: " .$val . " :";
        $url .= "$param=" . Bugzilla::Util::url_quote($val) . "&";
    }

    # Remove the last &
    chop $url if $url =~ /.*\&$/;

    return $url;
}

=item Selenium::Util->login($user_login, $user_passwd)

Determines whether to do a Novell (IChain) login or a Bugzilla login.  Once that 
is decided it will log the user in using the appropriate method.

=cut

sub login {
    my $class       = shift;
    my $user_login  = shift;
    my $user_passwd = shift;

    # Make sure we are logged out
    $class->logout();

    $se->open("index.cgi?GoAheadAndLogIn=1");
    $se->wait_for_page_to_load(UTIL_TIMEOUT);

    if ( $se->is_text_present("Log in to Bugzilla") ) {
        $se->open("index.cgi?GoAheadAndLogIn=1");
        $se->wait_for_page_to_load(UTIL_TIMEOUT);
        $se->type( "Bugzilla_login",    $user_login );
        $se->type( "Bugzilla_password", $user_passwd );
        $se->click("log_in");
        $se->wait_for_page_to_load(UTIL_TIMEOUT);
    
        # Verify login
        my $rtn_val = $se->is_text_present("Product Dashboard");
    
        return $rtn_val;
    }
}

sub logout {
    my $class = shift;
    $se->open('index.cgi');
    my $html = $se->get_html_source();

    if ( $html =~ "href=\"relogin.cgi\"" ) {
        $se->open("relogin.cgi");
        $se->wait_for_page_to_load(UTIL_TIMEOUT);
    
        # Verify logout
        my $rtn_val = $se->is_text_present("Logged Out");
    
        return $rtn_val;
    }
}


1;

=back

=head1 AUTHOR

Jeff Dayley <jedayley@novell.com>, 25 June 2007

=cut

__END__

