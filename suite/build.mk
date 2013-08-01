# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

ifdef COMM_BUILD # Mozilla Makefile
ifndef MOZ_INCOMPLETE_EXTERNAL_LINKAGE
# workaround Bug 599809 by making these makefiles be generated here
SUBMAKEFILES += $(addsuffix /Makefile, $(APP_LIBXUL_DIRS) $(APP_LIBXUL_STATICDIRS))
endif
endif

installer:
	@$(MAKE) -C suite/installer installer

package:
	@$(MAKE) -C suite/installer

package-compare:
	@$(MAKE) -C suite/installer package-compare

install::
	@$(MAKE) -C suite/installer install

source-package::
	@$(MAKE) -C suite/installer source-package

upload::
	@$(MAKE) -C suite/installer upload

ifndef COMM_BUILD # Mozilla Makefile

# mochitests need to be run from the Mozilla build system
ifdef ENABLE_TESTS
# Backend is implemented in mozilla/testing/testsuite-targets.mk.
# This part is copied from mozilla/browser/build.mk.

mochitest-browser-chrome:
	$(RUN_MOCHITEST) --browser-chrome
	$(CHECK_TEST_ERROR)

mochitest:: mochitest-browser-chrome

.PHONY: mochitest-browser-chrome
endif

endif # COMM_BUILD
