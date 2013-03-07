# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import unicode_literals

import os, sys

def bootstrap(topsrcdir, mozilla_dir=None):
    if mozilla_dir is None:
        mozilla_dir = os.path.join(topsrcdir, 'mozilla')
    sys.path[0:0] = [mozilla_dir]
    import build.mach_bootstrap
    return build.mach_bootstrap.bootstrap(topsrcdir, mozilla_dir)
