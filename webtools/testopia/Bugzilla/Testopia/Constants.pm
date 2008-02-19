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
# The Original Code is the Bugzilla Test Runner System.
#
# The Initial Developer of the Original Code is Maciej Maczynski.
# Portions created by Maciej Maczynski are Copyright (C) 2001
# Maciej Maczynski. All Rights Reserved.
#
# Contributor(s): Greg Hendricks <ghendricks@novell.com>

package Bugzilla::Testopia::Constants;
use strict;
use base qw(Exporter);

@Bugzilla::Testopia::Constants::EXPORT = qw(
PROPOSED
CONFIRMED
DISABLED

IDLE
PASSED
FAILED
RUNNING
PAUSED
BLOCKED

TR_READ
TR_WRITE
TR_DELETE
TR_ADMIN

REL_AUTHOR
REL_EDITOR
REL_TESTER
REL_TEST_CC

TR_RELATIONSHIPS

CASE_RUN_STATUSES

SAVED_SEARCH
SAVED_REPORT
SAVED_FILTER

);

#
# Fields to include when exporting a Test Case.
#
# All _id fields but case_id are converted to a string representation.
#
@Bugzilla::Testopia::Constants::TESTCASE_EXPORT = qw(
case_id
summary
set_up
break_down
action
expected_results
alias
arguments
author_id
blocks
case_status_id
category_id
components
creation_date
default_tester_id
depends_on
isautomated
plans
priority_id
requirement
script
tags
version
);

@Bugzilla::Constants::EXPORT_OK = qw(contenttypes);

# Test Case Status
use constant PROPOSED  => 1;
use constant CONFIRMED => 2;
use constant DISABLED  => 3;

# Test case Run Status
use constant IDLE    => 1;
use constant PASSED  => 2;
use constant FAILED  => 3;
use constant RUNNING => 4;
use constant PAUSED  => 5;
use constant BLOCKED => 6;

use constant CASE_RUN_STATUSES => IDLE, PASSED, FAILED, RUNNING, PAUSED, BLOCKED;
 
# Test Plan Permissions (bit flags)
use constant TR_READ    => 1;
use constant TR_WRITE   => 2;
use constant TR_DELETE  => 4;
use constant TR_ADMIN   => 8;

# Save search types
use constant SAVED_SEARCH => 0;
use constant SAVED_REPORT => 1;
use constant SAVED_FILTER => 2;

# Testopia Relationships
use constant REL_AUTHOR             => 100;
use constant REL_EDITOR             => 101;
use constant REL_TESTER             => 102;
use constant REL_TEST_CC            => 103;

use constant RELATIONSHIPS => REL_AUTHOR, REL_EDITOR, REL_TESTER, REL_TEST_CC;

1;
