# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

APP_NAME := $(MOZ_APP_DISPLAYNAME)

ifdef MOZ_DEBUG
APP_NAME := $(APP_NAME)Debug
endif

SYMBOLS_PATH := --symbols-path=$(DIST)/crashreporter-symbols

# BLOAT_EXTRA_ARG lets an application add an extra startup argument.
ifdef BLOAT_EXTRA_ARG
BLOAT_EXTRA_STARTUP_ARG := --extra-startup-arg=$(BLOAT_EXTRA_ARG)
endif

mailbloat:
	$(PYTHON) -u $(topsrcdir)/mozilla/config/pythonpath.py \
	  -I$(DIST)/../build -I$(MOZILLA_DIR)/build \
	  $(topsrcdir)/mailnews/test/performance/bloat/runtest.py \
	    --distdir=$(DIST) --bin=$(MOZ_APP_NAME) --brand=$(APP_NAME) \
	    $(SYMBOLS_PATH) $(BLOAT_EXTRA_STARTUP_ARG)
