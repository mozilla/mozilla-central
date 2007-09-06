# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Netscape Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/NPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Tinderbox build tool.
#
# The Initial Developer of the Original Code is Netscape Communications
# Corporation. Portions created by Netscape are
# Copyright (C) 1998 Netscape Communications Corporation. All
# Rights Reserved.
#
# Contributor(s): 
# Ted Mielczarek <ted.mielczarek@gmail.com>

1;
# 
# Scan a line and see if it has an error
#
BEGIN {
  sub has_error {
    local $_ = $_[0];

    /fatal error/ # . . . . . . . . . . . . . . . . . . Link
      or /^g?make(?:\[\d\d?\])?: \*\*\*/ #. . . . . . . gmake
      or /^C /  # . . . . . . . . . . . . . . . . . . . cvs merge conflict
      or /\WError: /i # . . . . . . . . . . . . . . . . C
      or / error\([0-9]*\)\:/ # . . . . . . . . . . . . C
      or /\[checkout aborted\]/   # . . . . . . . . . . cvs
      or /\: cannot find module/  # . . . . . . . . . . cvs
      or /REFTEST UNEXPECTED/ # . . . . . . . . . . . . reftest
      or /^\*\*\* \d+ ERROR (?:FAIL|TODO WORKED)/ # . . mochitest
      or /^\s+FAIL -/ # . . . . . . . . . . . . . . . . browser chrome test
      or /buildbot\.slave\.commands\.TimeoutError:/ # . buildbot error
      ;
  }
}

sub has_warning {                                    
  local $_ = $_[0];
  /^[A-Za-z0-9_]+\.[A-Za-z0-9]+\:[0-9]+\:/ 
    or /^\"[A-Za-z0-9_]+\.[A-Za-z0-9]+\"\, line [0-9]+\:/ 
    ;
}

sub has_errorline {
  local $_ = $_[0];
  my $out  = $_[1];

  # for reftests, give a link to the test filename
  if (m|^REFTEST .+ file://.+(mozilla/.+)|) {
    $out->{error_file}     = $1;
    $out->{error_file_ref} = $1;
    $out->{error_line}     = 1; # don't actually have a line number
    $out->{error_guess}    = 0;
    return 1;
  }
  # same for mochitests, mochichrome tests and browser chrome tests
  if (/^\*\*\* \d+ ERROR (?:FAIL|TODO WORKED).*\| \/tests(.+)$/
      or m/^\*\*\* \d+ ERROR (?:FAIL|TODO WORKED).*\| chrome:\/\/mochikit\/content\/chrome(.+)$/
      or m|^\s+FAIL -.*- chrome://mochikit/content/browser(.+)$|) {
    $out->{error_file}     = $1;
    $out->{error_file_ref} = "mozilla$1";
    $out->{error_line}     = 1; # don't actually have a line number
    $out->{error_guess}    = 0;
    return 1;
  }
  # compile/link errors
  if (/^(([A-Za-z0-9_]+\.[A-Za-z0-9]+):([0-9]+):)/) {
    $out->{error_file}     = $1;
    $out->{error_file_ref} = $2;
    $out->{error_line}     = $3;
    $out->{error_guess}    = 1;
    return 1;
  }
  if (/^("([A-Za-z0-9_]+\.[A-Za-z0-9]+)", line ([0-9]+):)/) {
    $out->{error_file}     = $1;
    $out->{error_file_ref} = $2;
    $out->{error_line}     = $3;
    $out->{error_guess}    = 1;
    return 1;
  }
  return 0;
}
