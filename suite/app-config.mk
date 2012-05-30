# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

MOZ_SUITE = 1
DEFINES += -DMOZ_SUITE=1

# Make the whole tree rebuild if app-config.mk changes
# Use MOZ_BUILD_APP to make life easy
ifeq (,$(wildcard $(topsrcdir)/$(MOZ_BUILD_APP)/app-config.mk))
#Fail if normal means of finding app-config.mk does not work
$(error Somehow we got included but we can't find ourselves...)
else
GLOBAL_DEPS += $(topsrcdir)/$(MOZ_BUILD_APP)/app-config.mk
endif

