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
# The Original Code is Thunderbird Mail Client.
#
# The Initial Developer of the Original Code is
# the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2011
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Mike Conley <mconley@mozilla.com>
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

# For test-instrumentation.js, we need to disable the account provisioner, or
# else it will spawn immediately and block before we have a chance to run
# any Mozmill tests.

import os
import shutil
import sys

# We don't want any accounts for these tests.
NO_ACCOUNTS = True

def on_profile_created(profiledir):
    """
    On profile creation, this copies prefs.js from the current folder to
    profile_dir/preferences. This is a somewhat undocumented feature -- anything
    in profile_dir/preferences gets treated as a default pref, which is what we
    want here.
    """
    prefdir = os.path.join(profiledir, "preferences")
    # This needs to be a directory, so if it's a file, raise an exception
    if os.path.isfile(prefdir):
        raise Exception("%s needs to be a directory, but is a file" % prefdir)
    if not os.path.exists(prefdir):
        os.mkdir(prefdir)
    # The pref file is in the same directory this script is in
    # Fallback to Linux prefs for anything not in the dictionary -- we're
    # assuming that they're other unixes
    preffile = os.path.join(os.path.dirname(__file__), "prefs.js")
    shutil.copy(preffile, prefdir)
