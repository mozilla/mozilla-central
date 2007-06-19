#!/usr/bin/perl5
#################################################################################
# $Id: rand_mods.pl,v 1.4 2007-06-19 11:27:05 gerv%gerv.net Exp $
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
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
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

# SYNOPSIS:
#    Modify an attribute for one or more entries, or possibly delete it.
#
# USAGE:
#    rand_mods [-adnvW] -b base -h host -D bind DN -w pwd -P cert filter loops
#		attribute ...

#################################################################################
# Modules we need. Note that we depend heavily on the Ldapp module, 
# which needs to be built from the C code. It also requires an LDAP SDK.
#
use Getopt::Std;			# To parse command line arguments.
use Mozilla::LDAP::Conn;		# Main "OO" layer for LDAP
use Mozilla::LDAP::Utils;		# LULU, utilities.
use Carp;

use strict;
no strict "vars";


#################################################################################
# Constants, shouldn't have to edit these...
#
$APPNAM	= "rand_mods";
$USAGE	= "$APPNAM [-dnvW] -b base -h host -D bind -w pswd filter loops attr ...";
$AUTHOR	= "Leif Hedstrom <leif\@netscape.com>";


#################################################################################
# Check arguments, and configure some parameters accordingly..
#
if (!getopts('adnvWb:h:D:p:s:w:P:'))
{
  print "usage: $APPNAM $USAGE\n";
  exit;
}
%ld = Mozilla::LDAP::Utils::ldapArgs();


#################################################################################
# Instantiate an LDAP object, which also binds to the LDAP server.
#
if (!getopts('b:h:D:p:s:w:P:'))
{
   print "usage: $APPNAM $USAGE\n";
   exit;
}
%ld = Mozilla::LDAP::Utils::ldapArgs();
$conn = new Mozilla::LDAP::Conn(\%ld);
croak "Could't connect to LDAP server $ld{host}" unless $conn;


#################################################################################
# Parse some extra argumens
#
my $srch, $loop;
my (@attrs) = ("givenName", "sn");

if (! ($srch = shift(@ARGV)))
{
  print "Usage: $APPNAME $USAGE\n";
  exit;
}
$srch = "(&(!(objectclass=nscpHideThis))(uid=*))" if ($srch eq "");

if (! ($loops = shift(@ARGV)))
{
  print "Usage: $APPNAME $USAGE\n";
  exit;
}

@attrs = @ARGV if ($#ARGV > $[);
$num_attrs = $#attrs;


#################################################################################
# Find all the argument
#
my $num = 0;
$entry = $conn->search($ld{root}, $ld{scope}, $srch, 0, ("0.0"));
while ($entry)
{
  push(@users, $entry->getDN());
  $num++;
  $entry = $conn->nextEntry();
}

print "Found $num users, randomizing changes now...\n";

srand(time ^ $$);

my $tmp, $tmp2, $dn, $loop2;
while ($loops--)
{
  $dn = $users[rand($num)];

  print "$loops loops left...\n" if (($loops % 100) == 0);
  $entry = $conn->browse($dn, @attrs);

  if ($entry)
    {
      $loop2 = $num_attrs + 1;
      while ($loop2--)
	{
	  $tmp = $entry->{$attrs[$loop2]}[0];
	  $tmp2 = rand($num_attrs);

	  $entry->{$attrs[$loop2]} = [ $entry->{$attrs[$tmp2]}[0] ];
	  $entry->{$attrs[$tmp2]} = [ $tmp] ;

	  $entry->printLDIF();
	}

      $conn->update($entry);
    }
}
