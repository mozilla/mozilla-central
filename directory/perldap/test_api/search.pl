#!/usr/bin/perl
#############################################################################
# $Id: search.pl,v 1.6 2007-06-19 11:27:06 gerv%gerv.net Exp $
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
#    Test the search capabilities of the API, similar to write.pl.

use Mozilla::LDAP::API qw(:api :constant);
use strict;


my $ldap_host = "";
my $BASEDN = "o=Org,c=US";
my $filter = $ARGV[0];

if (!$ldap_host)
{
   print "Edit the top portion of this file before continuing.\n";
   exit -1;
}

my $attrs = [];

my ($ld,$result,$count);

##
##  Initialize LDAP Connection
##

if (($ld = ldap_init($ldap_host,LDAP_PORT)) == -1)
{
   die "Can not open LDAP connection to $ldap_host";
}

##
##  Bind as DN, PASSWORD (NULL,NULL) on LDAP connection $ld
##

if (ldap_simple_bind_s($ld,"","") != LDAP_SUCCESS)
{
   ldap_perror($ld,"bind_s");
   die;
}

##
## ldap_search_s - Synchronous Search
##

if (ldap_search_s($ld,$BASEDN,LDAP_SCOPE_SUBTREE,$filter,$attrs,0,$result) != LDAP_SUCCESS)
{
   ldap_perror($ld,"search_s");
   die;
}

##
## ldap_count_entries - Count Matched Entries
##

if (($count = ldap_count_entries($ld,$result)) == -1)
{
   ldap_perror($ld,"count_entry");
   die;
}

##
## first_entry - Get First Matched Entry
## next_entry  - Get Next Matched Entry
##

for (my $ent = ldap_first_entry($ld,$result); $ent; $ent = ldap_next_entry($ld,$ent))
{
      
##
## ldap_get_dn  -  Get DN for Matched Entries
##

   my ($dn,$attr,@vals,$val,$ber);
   if (($dn = ldap_get_dn($ld,$ent)) ne "")
   {
      print "dn: $dn\n";
   } else {
      ldap_perror($ld,"get_dn");
      die;
   }

   for ($attr = ldap_first_attribute($ld,$ent,$ber); $attr; $attr = ldap_next_attribute($ld,$ent,$ber))
   {

##
## ldap_get_values
##

      @vals = ldap_get_values($ld,$ent,$attr);
      if ($#vals >= 0)
      {
         foreach $val (@vals)
         {
            print "$attr: $val\n";
         }
      }
   }
   ldap_ber_free($ber,0);
}
ldap_msgfree($result);

##
##  Unbind LDAP Connection
##

ldap_unbind($ld);

