# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

# This file is included from mozilla/xpcom/stub/Makefile.in
# Presume all mozilla/autoconf.mk is included and that it does not have
# Direct access to c-c specific vars not present there.

# We don't have access to MOZ_LDAP_XPCOM here, so cheat.
ifneq (,$(findstring ldap,$(MOZ_APP_COMPONENT_LIBS)))
DEPENDENT_LIBS_LIST += \
    $(DLL_PREFIX)ldap60$(DLL_SUFFIX) \
    $(DLL_PREFIX)nspr4$(DLL_SUFFIX) \
    $(DLL_PREFIX)plc4$(DLL_SUFFIX) \
    $(DLL_PREFIX)plds4$(DLL_SUFFIX) \
    $(DLL_PREFIX)prldap60$(DLL_SUFFIX) \
    $(DLL_PREFIX)ldif60$(DLL_SUFFIX) \
    $(NULL)
endif
