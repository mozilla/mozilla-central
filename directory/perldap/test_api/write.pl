#!/usr/bin/perl -w
#############################################################################
# $Id: write.pl,v 1.6 2007-06-19 11:27:06 gerv%gerv.net Exp $
#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is PerlDAP. 
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 2001
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Clayton Donley
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

# DESCRIPTION
#   write.pl - Test of LDAP Modify Operations in Perl5
#   Author:  Clayton Donley <donley@wwa.com>
#
#   This utility is mostly to demonstrate all the write operations
#   that can be done with LDAP through this PERL5 module.

use strict;
use Mozilla::LDAP::API qw(:constant :api);


# This is the entry we will be adding.  Do not use a pre-existing entry.
my $ENTRYDN = "cn=Test Guy, o=Org, c=US";

# This is the DN and password for an Administrator
my $ROOTDN = "cn=DSManager,o=Org,c=US";
my $ROOTPW = "";

my $ldap_server = "";

if (!$ldap_server)
{
   print "Edit the top portion of this file before continuing.\n";
   exit -1;
}

my $ld = ldap_init($ldap_server,LDAP_PORT);

if ($ld == -1)
{
   die "Connection to LDAP Server Failed";
}

if (ldap_simple_bind_s($ld,$ROOTDN,$ROOTPW) != LDAP_SUCCESS)
{
   ldap_perror($ld,"bind_s");
   die;
}

my %testwrite = (
	"cn" => "Test User",
	"sn" => "User",
        "givenName" => "Test",
	"telephoneNumber" => "8475551212",
	"objectClass" => ["top","person","organizationalPerson",
           "inetOrgPerson"],
        "mail" => "tuser\@my.org",
);

if (ldap_add_s($ld,$ENTRYDN,\%testwrite) != LDAP_SUCCESS)
{
   ldap_perror($ld,"add_s");
   die;
}

print "Entry Added.\n";


%testwrite = (
	"telephoneNumber" => "7085551212",
        "mail" => {"a",["Test_User\@my.org"]},
);

if (ldap_modify_s($ld,$ENTRYDN,\%testwrite) != LDAP_SUCCESS)
{
   ldap_perror($ld,"modify_s");
   die;
}

print "Entry Modified.\n";

#
# Delete the entry for $ENTRYDN
#
if (ldap_delete_s($ld,$ENTRYDN) != LDAP_SUCCESS)
{
   ldap_perror($ld,"delete_s");
   die;
}

print "Entry Deleted.\n";

# Unbind to LDAP server
ldap_unbind($ld);

exit;
