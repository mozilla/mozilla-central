# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# We install db files with the necessary preloaded certs to run tests that
# involve S/MIME.

import os, shutil, sys

def on_profile_created(profile):
  """
  This installs the db files into the profile so that we can test out stuff
  such as S/MIME.
  """

  data_path = os.path.join(os.path.dirname(__file__),
                           "../../../../mailnews/test/data/db-tinderbox-invalid")
  if not os.path.exists(data_path):
    data_path = os.path.join(os.path.dirname(__file__),
                             "../../xpcshell/tests/mailnews/data/db-tinderbox-invalid")
    if not os.path.exists(data_path):
      sys.exit("TEST-UNEXPECTED-FAIL | crypto | Failed to find the appropraite data_path")

  db_files = ["cert8.db", "key3.db", "secmod.db"]

  for f in db_files:
    shutil.copy(os.path.join(data_path, f), profile)
