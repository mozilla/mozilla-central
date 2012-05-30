#!/usr/bin/python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Get the target platform from a set of install.rdf files, and
# return the first install.rdf with the platform replaced by the list of 
# platforms as parsed from all the files
# Allows to create a install.rdf for multiple platforms

import sys
from xml.dom.minidom import parse

elems = []
for arg in sys.argv[2:]:
	doc = parse(arg + "/install.rdf")
	elem = doc.getElementsByTagName("em:targetPlatform")[0]
	elems.append(elem.cloneNode(True))

doc = parse(sys.argv[1] + "/install.rdf")
elem = doc.getElementsByTagName("em:targetPlatform")[0]
for newelem in elems:
	elem.parentNode.insertBefore(newelem, elem)
print doc.toxml()
