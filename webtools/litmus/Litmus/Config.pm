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

# Enabled (only) admin action tracking (auditing).
# NOTE: this can be overridden in localconfig
our $AUDIT_TRAIL = 1;

# This hash contains a list of database queries to ignore when auditing. By
# default, we don't care about the initial INSERT of test_results. We're more
# concerned about changes to testcases (and subgroups, etc.) than test_results.
# NOTE: this can be overridden/extended in localconfig
our %AUDIT_ACTIONS_TO_IGNORE = (
    'INSERT' => [		 
		 'test_result', # This happens to cover all the subsidiary
				# tables as well due to the nature of the
				# regexp.
		 'audit_trail',
		],
    'UPDATE' => [
		],
    'DELETE' => [
		],
    );

our $user_cookiename = "litmus_login";
our $sysconfig_cookiename = "litmustestingconfiguration";

our $sendmail_path = '/usr/sbin/sendmail';

our @nightly_report_recipients = ();

# We allow for a separate database that is optimized for read-only queries.
# These vars can be set in localconfig.
our ($db_host, $db_port, $db_name, $db_user, $db_pass);
our ($db_host_ro, $db_port_ro, $db_name_ro, $db_user_ro, $db_pass_ro);
our $bugzilla_auth_enabled = 0;
our ($bugzilla_host, $bugzilla_port, $bugzilla_name, $bugzilla_user, $bugzilla_pass);

our $localconfig = litmus_locations()->{'localconfig'};
do $localconfig;

our $version = "0.9";

# if true, then Litmus will not accept any requests
our $disabled = 0;

# Set/unset this to display inline debugging value/code.
our $DEBUG = 0;

1;
