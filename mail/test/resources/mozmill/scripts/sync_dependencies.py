# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import subprocess
import urllib

abs_path = os.path.dirname(os.path.abspath(__file__))
root_path = os.path.dirname(abs_path)

# We need the latest version of Event Utils
externalModules = [
    {   # EventUtils.js
        "url": "http://hg.mozilla.org/mozilla-central/raw-file/default/testing/mochitest/tests/SimpleTest/EventUtils.js",
        "path": "mozmill/extension/resource/stdlib/EventUtils.js",
        "patch": "patches/eventUtils.patch"
    },
    {   # httpd.js
        "url": "http://hg.mozilla.org/mozilla-central/raw-file/default/netwerk/test/httpserver/httpd.js",
        "path": "mozmill/extension/resource/stdlib/httpd.js",
        "patch": "patches/httpd.patch"
    }
]


# Change into the root folder to update and patch external modules correctly
os.chdir(root_path)

for module in externalModules:
    # Retrieve latest EventUtils module and apply our patch
    print "Downloading %s..." % (module["url"])
    urllib.urlretrieve (module["url"], os.path.join(root_path, module["path"]))

    print "Patching %s..." % (module["patch"])
    subprocess.call(["git", "apply", module["patch"]])
