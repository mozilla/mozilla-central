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
 #
 # ***** END LICENSE BLOCK *****

=cut

package Litmus::Memoize; 

use strict;
use Exporter;
our @EXPORT = qw(memoize);
use Memoize ();
use base 'Memoize';

use constant MP2 => ( exists $ENV{MOD_PERL_API_VERSION} and 
                        $ENV{MOD_PERL_API_VERSION} >= 2 ); 
use constant MP1 => ( exists $ENV{MOD_PERL} and 
                        ! exists $ENV{MOD_PERL_API_VERSION});   

# Subclass of Memoize.pm that gives us control over when our data is 
# flushed and ensures that cached data does not persist across mod_perl 
# requests unless we really want it to

sub memoize {
	my $fn = shift;
	my %options = @_;
	
	if (MP2 && ! Apache2::RequestUtil->request()) {
		return;	
	} if (MP1 && ! Apache->request()) {
		return;
	}
	
	my $uppack = caller;
	
	$options{INSTALL} = $uppack . '::' . $fn;
	
	$fn = Memoize::_make_cref($fn, $uppack);
	
	# if the persist flag is given, we store the memoized data normally
	# and it will persist across mod_perl requests
	if ($options{persist}) {
		Memoize::memoize($fn, %options);
		return;
	}
	
	# otherwise, we keep the cache in request_cache where it will get
	# flushed when the request ends
	my $cache = {};
	my $request;
	if (MP1) {
		 $request = Apache->request();
	} elsif (MP2) {
		$request = Apache2::RequestUtil->request();
	}
	
	if ($ENV{MOD_PERL}) {
		$cache = $request->pnotes();
		if (!$cache->{cleanup_registered}) {
             $request->push_handlers(PerlCleanupHandler => sub {
                 my $r = shift;
                 foreach my $key (keys %{$r->pnotes}) {
                     delete $r->pnotes->{$key};
                 }
             });
             $cache->{cleanup_registered} = 1;
        }
	}
	
	$cache->{'S'.$fn} = {};
	$cache->{'L'.$fn} = {};
	my $s_cache = $cache->{'S'.$fn};
	my $l_cache = $cache->{'L'.$fn};
	$options{SCALAR_CACHE} = [HASH => $s_cache];
	$options{LIST_CACHE} = [HASH => $l_cache];
	Memoize::memoize($fn, %options);
	return;
}

1;
