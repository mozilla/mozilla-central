# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# If we are in one of the calendar directories, then make sure that files end
# up in xpi-stage/lightning.
ifeq (calendar,$(firstword $(subst /, ,$(subst $(topsrcdir)/,,$(srcdir)))))
# Possibly XPI_NAME is already set, i.e in the timezones extension. Don't
# override this.
ifndef XPI_NAME
export XPI_NAME = lightning
export USE_EXTENSION_MANIFEST = 1
endif
endif
