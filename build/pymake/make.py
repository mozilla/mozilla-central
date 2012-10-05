# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is a wrapper around mozilla-central's pymake. If that isn't found then
# this uses client.py to pull it in.

import os
import sys
import subprocess
import shlex

def getpath(relpath):
    thisdir = os.path.dirname(__file__)
    return os.path.abspath(os.path.join(thisdir, *relpath))

PYMAKE = getpath(["..", "..", "mozilla", "build", "pymake", "make.py"])
CLIENT_PY = getpath(["..", "..", "client.py"])
CLIENT_PY_ARGS = getpath(["..", "client.py-args"])

def main(args):
    if not os.path.exists(PYMAKE):
        clientpyargs = open(CLIENT_PY_ARGS, "r").read().strip()
        clientpyargs = shlex.split(clientpyargs)
        subprocess.check_call([sys.executable, CLIENT_PY, "checkout"] +
                              clientpyargs)

        if not os.path.exists(PYMAKE):
            raise Exception("Pymake not found even after client.py was run")

    subprocess.check_call([sys.executable, PYMAKE] + args)

if __name__ == "__main__":
    main(sys.argv[1:])
