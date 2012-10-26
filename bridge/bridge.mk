# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

APP_LIBXUL_DIRS += $(DEPTH)$(SUBDIR)/mozilla/xpfe/components/autocomplete

ifneq (,$(MOZ_LDAP_XPCOM)$(filter mozldap,$(MOZ_APP_COMPONENT_LIBS)))
APP_LIBXUL_STATICDIRS += $(DEPTH)$(SUBDIR)/ldap/sdks/c-sdk
APP_LIBXUL_DIRS += $(DEPTH)$(SUBDIR)/ldap/xpcom
endif

ifneq (,$(MOZ_MORK)$(filter mork,$(MOZ_APP_COMPONENT_LIBS)))
APP_LIBXUL_DIRS += $(DEPTH)$(SUBDIR)/db/mork
endif

APP_LIBXUL_DIRS += \
  $(DEPTH)$(SUBDIR)/mailnews/base \
  $(DEPTH)$(SUBDIR)/mailnews \
  $(NULL)
