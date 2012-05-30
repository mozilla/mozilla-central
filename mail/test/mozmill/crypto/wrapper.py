# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# We install db files with the necessary preloaded certs to run tests that
# involve S/MIME.

import os, shutil

def on_profile_created(profile):
  """
  This installs the db files into the profile so that we can test out stuff
  such as S/MIME.
  """

  data_path = "../../../../mailnews/test/data/db-tinderbox-invalid"
  db_files = ["cert8.db", "key3.db", "secmod.db"]

  for f in db_files:
    shutil.copy(os.path.join(os.path.dirname(__file__), data_path, f), profile)
