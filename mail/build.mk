# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

ifndef COMM_BUILD # Mozilla Makefile

ifdef MOZ_APP_COMPONENT_LIBS
SUBDIR=/..
include $(topsrcdir)/../bridge/bridge.mk
# For libxul builds this gets linked into libxul. For non-libxul
# builds, the build of components is controlled in mail/Makefile.in
APP_LIBXUL_DIRS += $(DEPTH)/../mail/components
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
	chat \
	mail \
	$(NULL)
#	purple instantbird

installer:
	@$(MAKE) -C mail/installer installer

package:
	@$(MAKE) -C mail/installer

package-compare:
	@$(MAKE) -C mail/installer package-compare

stage-package:
	@$(MAKE) -C mail/installer stage-package

install::
	@$(MAKE) -C mail/installer install

source-package::
	@$(MAKE) -C mail/installer source-package

upload::
	@$(MAKE) -C mail/installer upload
ifdef MOZ_CALENDAR
	@$(MAKE) -C calendar/lightning upload
endif

source-upload::
	@$(MAKE) -C mail/installer source-upload

hg-bundle::
	@$(MAKE) -C mail/installer hg-bundle

l10n-check::
	@$(MAKE) -C mail/locales l10n-check

ifdef ENABLE_TESTS
include $(srcdir)/mail/testsuite-targets.mk
endif

endif # COMM_BUILD
