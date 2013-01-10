# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

ifndef COMM_BUILD # Mozilla Makefile

ifdef MOZ_APP_COMPONENT_LIBS
SUBDIR=/..
include $(topsrcdir)/../bridge/bridge.mk
endif

ifndef LIBXUL_SDK
include $(topsrcdir)/toolkit/toolkit-tiers.mk
endif

TIERS += app

ifdef MOZ_EXTENSIONS
tier_app_dirs += extensions
endif

else # toplevel Makefile

TIERS += app

include $(topsrcdir)/bridge/bridge.mk
ifdef MOZ_INCOMPLETE_EXTERNAL_LINKAGE
tier_app_staticdirs += $(APP_LIBXUL_STATICDIRS:./%=%)
tier_app_dirs += $(APP_LIBXUL_DIRS:./%=%)
else
# workaround Bug 599809 by making these makefiles be generated here
SUBMAKEFILES += $(addsuffix /Makefile, $(APP_LIBXUL_DIRS) $(APP_LIBXUL_STATICDIRS))
endif

ifdef MOZ_COMPOSER
tier_app_dirs += editor/ui
endif

tier_app_dirs += $(MOZ_BRANDING_DIRECTORY)

ifdef MOZ_CALENDAR
tier_app_dirs += calendar/lightning
endif

tier_app_dirs += \
	suite \
	$(NULL)

endif # COMM_BUILD

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

else # toplevel Makefile

ifdef ENABLE_TESTS
# This part is copied from mail/testsuite-targets.mk,
# SeaMonkey does not need to create a suite/testsuite-targets.mk yet.

# "-mail : Open the mail folder view" (instead of "a browser window").
BLOAT_EXTRA_ARG := -mail

# Additional mailnews targets to call automated test suites.
include $(topsrcdir)/mailnews/testsuite-targets.mk
endif

endif # COMM_BUILD
