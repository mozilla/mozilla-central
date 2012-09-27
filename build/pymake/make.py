#!/usr/bin/env python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
import subprocess

if __name__ == '__main__':
    print >> sys.stderr, ("Warning: This is a stub that runs GNU make. " +
        "If you're building locally you'll want to run mozilla-central's pymake.")
    # Work around bug 777798.
    if os.environ.has_key("PWD"):
        del os.environ["PWD"]

    subprocess.check_call(["make"] + sys.argv[1:])
