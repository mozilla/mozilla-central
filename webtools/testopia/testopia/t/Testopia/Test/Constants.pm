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

package Testopia::Test::Constants;

use base qw(Exporter);

@Testopia::Test::Constants::EXPORT = qw(
	LOGIN_TYPES
	LOGIN_CREDENTIALS
);

use constant LOGIN_TYPES => qw(
	admin
	testers
	partners
	private
	public
);

# The default login accounts used by the dummy_load test database.
use constant LOGIN_CREDENTIALS => {
	'admin'    => {'id' => '1', 'login_name' => 'admin@testopia.com',   'password' => 'admin'},
	'testers'  => {'id' => '3', 'login_name' => 'tester@testopia.com',  'password' => 'tester'},
	'partners' => {'id' => '2', 'login_name' => 'partner@testopia.com', 'password' => 'partner'},
	'private'  => {'id' => '7', 'login_name' => 'private@testopia.com', 'password' => 'private'},
	'public'   => {'id' => '4', 'login_name' => 'public@testopia.com',  'password' => 'public'},
	'anonymous'=> {'id' => '0', 'login_name' => '',                     'password' => ''},
};

1;