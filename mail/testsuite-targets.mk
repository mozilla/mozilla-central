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

# XXX The mozilla/testing/testsuite-targets.mk doesn't really allow for hooks
# outside of itself. Therefore we replicate the functionality we need here,
# calling into the relevant mozilla dirs when necessary for the core tests.
ifndef UNIVERSAL_BINARY
PKG_STAGE = $(DIST)/test-package-stage
package-tests:: stage-mozilla-tests stage-mozmill
else
# This staging area has been built for us by universal/flight.mk
PKG_STAGE = $(DIST)/universal/test-package-stage
endif

package-tests::
	@rm -f "$(DIST)/$(PKG_PATH)$(TEST_PACKAGE)"
ifndef UNIVERSAL_BINARY
	$(NSINSTALL) -D $(DIST)/$(PKG_PATH)
else
	#building tests.jar (bug 543800) fails on unify, so we build tests.jar after unify is run
	$(MAKE) -C $(DEPTH)/mozilla/testing/mochitest stage-chromejar PKG_STAGE=$(DIST)/universal
endif
	cd $(PKG_STAGE) && \
	  zip -r9D "$(call core_abspath,$(DIST)/$(PKG_PATH)$(TEST_PACKAGE))" *

make-stage-dir:
	rm -rf $(PKG_STAGE) && $(NSINSTALL) -D $(PKG_STAGE) && $(NSINSTALL) -D $(PKG_STAGE)/bin && $(NSINSTALL) -D $(PKG_STAGE)/bin/components && $(NSINSTALL) -D $(PKG_STAGE)/certs

# Of the core tests, we only currently support xpcshell. Unfortunately
# some of the required xpcshell bits are packaged by mochitest, so we have to
# package those as well.
stage-mozilla-tests: make-stage-dir
	$(MAKE) -C $(DEPTH)/mozilla/testing/mochitest stage-package
	$(MAKE) -C $(DEPTH)/mozilla/testing/xpcshell stage-package

# Although we should probably depend on make-stage-dir here, we don't as the
# make-stage-dir actually removes the package directory for us. Given that we
# are running stage-mozilla-tests which calls testing/testsuite-targets.mk which
# does do this for some tests, then we're actually fine.
stage-mozmill: make-stage-dir
	$(MAKE) -C $(DEPTH)/mail/test/mozmill stage-package

.PHONY: \
  package-tests make-stage-dir stage-mozmill
