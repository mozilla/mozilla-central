#!/usr/bin/perl5
#############################################################################
# $Id: rename.pl,v 1.6 2007-06-19 11:27:05 gerv%gerv.net Exp $
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
# The Original Code is PerLDAP.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corp. 
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
#    Rename an LDAP entry, changing it's DN. Note that currently this only
#    works with RDNs.

use Getopt::Std;			# To parse command line arguments.
use Mozilla::LDAP::Conn;		# Main "OO" layer for LDAP
use Mozilla::LDAP::Utils;		# LULU, utilities.


#############################################################################
# Constants, shouldn't have to edit these...
#
$APPNAM	= "rename";
$USAGE	= "$APPNAM [-nvI] -b base -h host -D bind -w pswd -P cert filter new_rdn";


#############################################################################
# Check arguments, and configure some parameters accordingly..
#
if (!getopts('nvIb:h:D:w:P:'))
{
  print "usage: $APPNAM $USAGE\n";
  exit;
}
%ld = Mozilla::LDAP::Utils::ldapArgs();
Mozilla::LDAP::Utils::userCredentials(\%ld) unless $opt_n;

($search, $rdn) = @ARGV;
if (($search eq "") || ($rdn eq ""))
{
  print "usage: $APPNAM $USAGE\n";
  exit;
}


#############################################################################
# Instantiate an LDAP object, which also binds to the LDAP server.
#
$conn = new Mozilla::LDAP::Conn(\%ld);
die "Could't connect to LDAP server $ld{host}" unless $conn;

$key = "Y" if $opt_I;
$entry = $conn->search($ld{root}, $ld{scope}, $search, 0, @ATTRIBUTES);
$conn->printError() if $conn->getErrorCode();

if (! $entry || $conn->nextEntry())
{
  print "Error: The search did not return exactly one match, abort!\n";
  exit;
}

if (! $opt_I)
{
  print "Rename ", $entry->getDN(), " with $rdn [N]? ";
  $key = Mozilla::LDAP::Utils::answer("N") unless $opt_I;
}

if ($key eq "Y")
{
  # Note: I have to explicitly specify the original DN below, since the call
  # to nextEntry() above blows the DN away from the ::Conn object.
  if (! $opt_n)
    {
      $conn->modifyRDN($rdn, $entry->getDN());
      $conn->printError() if $conn->getErrorCode();
    }
  print "Renamed $entry->{dn}\n" if $opt_v;
}


#################################################################################
# Close the connection.
#
$conn->close if $conn;
