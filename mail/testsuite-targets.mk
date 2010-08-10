# Additional mailnews targets to call automated test suites
include $(topsrcdir)/mailnews/testsuite-targets.mk

# Instructions below this line are for mail/ specific tests.

MOZMILLDIR=$(DEPTH)/mozilla/_tests/mozmill

ifeq (cocoa,$(MOZ_WIDGET_TOOLKIT))
# Mac options
APP_NAME = $(MOZ_APP_DISPLAYNAME)
ifdef MOZ_DEBUG
APP_NAME := $(APP_NAME)Debug
endif
PROGRAM = ../../../$(DIST)/$(APP_NAME).app/
else
# Non-mac options
PROGRAM = ../../../$(DIST)/bin/thunderbird$(BIN_SUFFIX)
endif

mozmill::
	cd $(MOZMILLDIR) && MACOSX_DEPLOYMENT_TARGET= $(PYTHON) \
	runtestlist.py --list=mozmilltests.list --binary=$(PROGRAM) \
	--dir=$(call core_abspath,$(topsrcdir))/mail/test/mozmill \
	--symbols-path=$(call core_abspath,$(DIST)/crashreporter-symbols) \
	$(MOZMILL_EXTRA)

mozmill-one::
	cd $(MOZMILLDIR) && MACOSX_DEPLOYMENT_TARGET= $(PYTHON) runtest.py \
	--test=$(call core_abspath,$(topsrcdir))/mail/test/mozmill/$(SOLO_TEST) \
	--binary=$(PROGRAM) \
	--symbols-path=$(call core_abspath,$(DIST)/crashreporter-symbols) \
	$(MOZMILL_EXTRA)

# XXX Really we should be re-using the mozilla-central
# testing/testsuite-targets.mk. However, to get mozmill tests packaged and
# running, we've just implemented what we need here for now.
ifndef UNIVERSAL_BINARY
PKG_STAGE = $(DIST)/test-package-stage
package-tests:: stage-mozmill
else
# This staging area has been built for us by universal/flight.mk
PKG_STAGE = $(DIST)/universal/test-package-stage
endif

package-tests::
	$(NSINSTALL) -D $(DIST)/$(PKG_PATH)
	@rm -f "$(DIST)/$(PKG_PATH)$(TEST_PACKAGE)"
	cd $(PKG_STAGE) && \
	  zip -r9D "$(call core_abspath,$(DIST)/$(PKG_PATH)$(TEST_PACKAGE))" *

make-stage-dir:
	rm -rf $(PKG_STAGE) && $(NSINSTALL) -D $(PKG_STAGE) && $(NSINSTALL) -D $(PKG_STAGE)/bin && $(NSINSTALL) -D $(PKG_STAGE)/bin/components && $(NSINSTALL) -D $(PKG_STAGE)/certs

stage-mozmill: make-stage-dir
	$(MAKE) -C $(DEPTH)/mail/test/mozmill stage-package

.PHONY: \
  package-tests make-stage-dir stage-mozmill
