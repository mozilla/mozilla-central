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
 #   Max Kanat-Alexander <mkanat@bugzilla.org>
 #   Frédéric Buclin <LpSolit@gmail.com>
 # ***** END LICENSE BLOCK *****

=cut

package Litmus::Config; 

use strict;
use File::Basename;
use Litmus::Memoize;

# based on bz_locations() from Bugzilla::Constants
our $datadir = "data/";
memoize('litmus_locations', persist=>1);
sub litmus_locations {
	# We know that Bugzilla/Constants.pm must be in %INC at this point.
    # So the only question is, what's the name of the directory
    # above it? This is the most reliable way to get our current working
    # directory under both mod_cgi and mod_perl. We call dirname twice
    # to get the name of the directory above the "Bugzilla/" directory.
    #
    # Calling dirname twice like that won't work on VMS or AmigaOS
    # but I doubt anybody runs Bugzilla on those.
    #
    # On mod_cgi this will be a relative path. On mod_perl it will be an
    # absolute path.
    my $libpath = dirname(dirname($INC{'Litmus/Config.pm'}));
    return {
    	libpath => $libpath,
    	datadir => "$libpath/$datadir",
    	localconfig => "$libpath/localconfig",
    	templates => "$libpath/templates"
    };
}

our $localconfig = litmus_locations()->{'localconfig'};
do $localconfig;

our $version = "0.9";

# if true, then Litmus will not accept any requests
our $disabled = 0;

# Set/unset this to display inline debugging value/code.
our $DEBUG = 0;

1;
