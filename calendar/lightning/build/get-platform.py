#!/usr/bin/python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Get the target platform from a set an install.rdf file

import sys
from xml.dom.minidom import parse

doc = parse(sys.argv[1] + "/install.rdf")
elem = doc.getElementsByTagName("em:targetPlatform")[0]
print elem.firstChild.nodeValue
