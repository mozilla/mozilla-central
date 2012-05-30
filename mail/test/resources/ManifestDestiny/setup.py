#!/usr/bin/env python

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# The real details are in manifestparser.py; this is just a front-end


import sys
from manifestparser import SetupCLI
SetupCLI(None)(None, sys.argv[1:])


                 
