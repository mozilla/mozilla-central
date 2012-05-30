# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import shutil

def on_profile_created(profiledir):
    """
    On profile creation, this copies localstore.rdf from the current folder to
    the profile_dir.
    """
    # The localstore.rdf file is in the same directory this script is in
    localstore = os.path.join(os.path.dirname(__file__),
                              "localstore.rdf")
    shutil.copy(localstore, profiledir)
