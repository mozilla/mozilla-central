# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

ifndef COMM_BUILD # Mozila Makefile

ifndef LIBXUL_SDK
include $(topsrcdir)/toolkit/toolkit-tiers.mk
endif

TIERS += app

ifdef MOZ_EXTENSIONS
tier_app_dirs += extensions
endif

else # toplevel Makefile

TIERS += app

tier_app_dirs += $(MOZ_BRANDING_DIRECTORY)

tier_app_dirs += \
	calendar \
	calendar/sunbird \
	$(NULL)

ifdef MOZ_CALENDAR
tier_app_dirs += calendar/lightning
endif

endif # COMM_BUILD

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
