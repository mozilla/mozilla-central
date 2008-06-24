#!/usr/bin/perl -w
# -*- Mode: perl; indent-tabs-mode: nil -*-
#
# The contents of this file are subject to the Mozilla Public
# License Version 1.1 (the "License"); you may not use this file
# except in compliance with the License. You may obtain a copy of
# the License at http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS
# IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
# implied. See the License for the specific language governing
# rights and limitations under the License.
#
# The Original Code is the Bugzilla Testopia System.
#
# The Initial Developer of the Original Code is Greg Hendricks.
# Portions created by Greg Hendricks are Copyright (C) 2006
# Novell. All Rights Reserved.
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>
#                 Jeff Dayley    <jedayley@novell.com>
use strict;

use lib 't';
use lib '.';
use lib '../..';

use Test::Unit::Debug qw(debug_pkgs);
use Test::Unit::TestRunner;

use TAP::Harness;

use Testopia::Test::Constants;

my @api_tests = qw(
  API_Build.pm
  API_Environment.pm
  API_Product.pm
  API_TestCase.pm
  API_TestCaseRun.pm
  API_TestPlan.pm
  API_TestRun.pm
);

if ( $ARGV[0] && $ARGV[0] =~ /^API/ ) {
    my $testrunner;
    use Test::More;

    # Uncomment and edit to debug individual packages.
    #debug_pkgs(qw/Test::Unit::TestCase/);
    foreach my $test (@api_tests) {
        $testrunner = Test::Unit::TestRunner->new();
        $testrunner->start($test);
    }
}
else {
    my %args;
    my $harness;
    my $login_types = LOGIN_CREDENTIALS;

    my @tests = qw(
      t/SE_environments.t
    );

    my $type = 'anonymous';

    #foreach my $type (keys %$login_types){
    %args = (
        verbosity => 1,
        lib       => [ '.', '..', 't' ],
        test_args =>
          [ $login_types->{$type}, $login_types->{$type}->{'login_name'}, $login_types->{$type}->{'password'} ],
    );

    $harness = TAP::Harness->new( \%args );
    $harness->runtests(@tests);

    #}
}
