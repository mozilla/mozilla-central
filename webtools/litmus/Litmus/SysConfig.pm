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

package Litmus::SysConfig;

use strict;

require Exporter;
use Litmus;
use Litmus::Error;
use Litmus::Utils;
use CGI;

our @ISA = qw(Exporter);
our @EXPORT = qw();

my $cookie_prefix = $Litmus::Config::sysconfig_cookiename . '_sysconfig_test_run_id_';

sub new {
    my ($test_run_id, $build_id, $platform_id, $opsys_id, $locale) = @_;

    my $self = {};
    bless($self);

    $self->{"test_run_id"} = $test_run_id;
    $self->{"build_id"} = $build_id;
    $self->{"platform_id"} = $platform_id;
    $self->{"opsys_id"} = $opsys_id;
    $self->{"locale"} = $locale;
    $self->{"id"} = join('|',
                        $test_run_id,
                        $build_id || '',
                        $platform_id || '',
                        $opsys_id || '',
                        $locale || ''
                        );
    
    return $self;
}

sub setCookie {
    my $self = shift;
    
    my $c = Litmus->cgi();
    my $cookie = $c->cookie( 
        -name   => $cookie_prefix . $self->{"test_run_id"},
        -value  => join('|',
                        $self->{"test_run_id"},
                        $self->{"build_id"},
                        $self->{"platform_id"},
                        $self->{"opsys_id"},
                        $self->{"locale"}
                       ),
        -domain => $main::ENV{"HTTP_HOST"},
    );

    return $cookie;
}

sub getCookie {
    my $self = shift;
    my $cookie_name = shift;

    my $c = Litmus->cgi();

    my $cookie = $c->cookie($cookie_name);
    if (! $cookie) {
        return;
    }
    
    my @sysconfig = split(/\|/, $cookie);
    
    return new($sysconfig[0],
               $sysconfig[1],
               $sysconfig[2],
               $sysconfig[3],
               $sysconfig[4]
            );        
}

sub getCookieByTestRunId {
    my $self = shift;
    my $test_run_id = shift;

    my $c = Litmus->cgi();
    my $cookie = $c->cookie($cookie_prefix . $test_run_id);
    if (! $cookie) {
        return;
    }

    my @sysconfig = split(/\|/, $cookie);
    
    return new($sysconfig[0],
               $sysconfig[1],
               $sysconfig[2],
               $sysconfig[3],
               $sysconfig[4]
            );        
}

# returns sysconfig objects corresponding to all sysconfig cookies the user 
# has set
sub getAllCookies {
    my $self = shift;
    my $c = Litmus->cgi();
	
    my @cookies = ();
    my @names = $c->cookie();
    foreach my $cur (@names) {
        if ($cur =~ /^${cookie_prefix}/) {
            push(@cookies, Litmus::SysConfig->getCookie($cur));
        }
    }
    if (@cookies == 0) {
        push(@cookies, undef)
    }
    return @cookies;
}

1;



