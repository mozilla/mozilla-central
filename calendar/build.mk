# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

installer:
	@$(MAKE) -C calendar/installer installer

package:
	@$(MAKE) -C calendar/installer

package-compare:
	@$(MAKE) -C calendar/installer package-compare

source-package::
	@$(MAKE) -C calendar/installer source-package

upload::
	@$(MAKE) -C calendar/installer upload
