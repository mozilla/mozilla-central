#!/usr/bin/perl5
#############################################################################
# $Id: entry.pl,v 1.4 2007-06-19 11:27:06 gerv%gerv.net Exp $
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
#    Test most (all?) of the LDAP::Mozilla::Conn methods.

use Getopt::Std;			# To parse command line arguments.
use Mozilla::LDAP::Conn;		# Main "OO" layer for LDAP
use Mozilla::LDAP::Utils;		# LULU, utilities.
use Mozilla::LDAP::API;

use strict;
no strict "vars";


#################################################################################
# Configurations, modify these as needed.
#
$BIND	= "uid=ldapadmin";
$BASE	= "o=Netscape Communications Corp.,c=US";
$PEOPLE	= "ou=people";
$GROUPS	= "ou=groups";
$UID	= "leif-test";
$CN	= "test-group-1";


#################################################################################
# Constants, shouldn't have to edit these...
#
$APPNAM	= "entry.pl";
$USAGE	= "$APPNAM -b base -h host -D bind -w pswd -P cert";


#################################################################################
# Check arguments, and configure some parameters accordingly..
#
if (!getopts('b:h:D:p:s:w:P:'))
{
   print "usage: $APPNAM $USAGE\n";
   exit;
}
%ld = Mozilla::LDAP::Utils::ldapArgs($BIND, $BASE);


#################################################################################
# Get an LDAP connection
#
sub getConn
{
  my $conn;

  if ($main::reuseConn)
    {
      if (!defined($main::mainConn))
	{
	  $main::mainConn = new Mozilla::LDAP::Conn(\%main::ld);
	  die "Could't connect to LDAP server $main::ld{host}"
	    unless $main::mainConn;
	}
      return $main::mainConn;
    }
  else
    {
      $conn = new Mozilla::LDAP::Conn(\%main::ld);
      die "Could't connect to LDAP server $main::ld{host}" unless $conn;
    }

  return $conn;
}


#################################################################################
# Some small help functions...
#
sub dotPrint
{
  my $str = shift;

  print $str . '.' x (20 - length($str));
}

sub attributeEQ
{
  my @a, @b;
  my $i;

  @a = @{$_[0]};
  @b = @{$_[1]};
  return 1 if (($#a < 0) && ($#b < 0));
  return 0 unless ($#a == $#b);

  @a = sort(@a);
  @b = sort(@b);
  for ($i = 0; $i <= $#a; $i++)
    {
      return 0 unless ($a[$i] eq $b[$i]);;
    }

  return 1;             # We passed all the tests, we're ok.
}


#################################################################################
# Setup the test entries.
#
$filter = "(uid=$UID)";
$conn = getConn();
$nentry = $conn->newEntry();

$nentry->setDN("uid=$UID, $PEOPLE, $BASE");
$nentry->{objectclass} = [ "top", "person", "inetOrgPerson", "mailRecipient" ];
$nentry->addValue("uid", $UID);
$nentry->addValue("sn", "Hedstrom");
$nentry->addValue("givenName", "Leif");
$nentry->addValue("cn", "Leif Hedstrom");
$nentry->addValue("cn", "Leif P. Hedstrom");
$nentry->addValue("cn", "The Swede");
$nentry->addValue("description", "Test1");
$nentry->addValue("description", "Test2");
$nentry->addValue("description", "Test3");
$nentry->addValue("description", "Test4");
$nentry->addValue("description", "Test5");
$nentry->addValue("mail", "leif\@ogre.com");

$ent = $conn->search($ld{root}, $ld{scope}, $filter);
$conn->delete($ent->getDN()) if $ent;
$conn->add($nentry);

$conn->close();
