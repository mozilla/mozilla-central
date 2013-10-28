# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

ifndef OBJDIR
OBJDIR_ARCH_1 = $(MOZ_OBJDIR)/$(firstword $(MOZ_BUILD_PROJECTS))
OBJDIR_ARCH_2 = $(MOZ_OBJDIR)/$(word 2,$(MOZ_BUILD_PROJECTS))
DIST_ARCH_1 = $(OBJDIR_ARCH_1)/mozilla/dist
DIST_ARCH_2 = $(OBJDIR_ARCH_2)/mozilla/dist
DIST_UNI = $(DIST_ARCH_1)/universal
OBJDIR = $(OBJDIR_ARCH_1)
endif

topsrcdir = $(TOPSRCDIR)
DEPTH = $(OBJDIR)

include $(DEPTH)/config/autoconf.mk
include $(topsrcdir)/mozilla/toolkit/mozapps/installer/package-name.mk

LIGHTNING_VERSION := $(shell cat $(topsrcdir)/calendar/sunbird/config/version.txt)
XPI_PKGNAME = lightning-$(LIGHTNING_VERSION).$(AB_CD).$(MOZ_PKG_PLATFORM)

STANDALONE_MAKEFILE := 1
include $(TOPSRCDIR)/config/config.mk

postflight_all:
	mkdir -p $(DIST_UNI)/xpi-stage
	rm -rf $(DIST_UNI)/xpi-stage/lightning*
	cp -R $(DIST_ARCH_1)/xpi-stage/lightning $(DIST_UNI)/xpi-stage
	grep -v binary-component $(DIST_ARCH_1)/xpi-stage/lightning/components/libical.manifest > \
	    $(DIST_UNI)/xpi-stage/lightning/components/libical.manifest
	platform=`$(PYTHON) $(TOPSRCDIR)/calendar/lightning/build/get-platform.py \
		$(DIST_ARCH_1)/xpi-stage/lightning`; \
	mkdir -p $(DIST_UNI)/xpi-stage/lightning/components/$$platform; \
	mv $(DIST_UNI)/xpi-stage/lightning/components/*.dylib \
		$(DIST_UNI)/xpi-stage/lightning/components/$$platform; \
	$(foreach dylib,$(wildcard $(DIST_ARCH_1)/xpi-stage/lightning/components/*.dylib),echo binary-component $$platform/$(notdir $(dylib)) ABI=$$platform >> $(DIST_UNI)/xpi-stage/lightning/components/libical.manifest)
	platform=`$(PYTHON) $(TOPSRCDIR)/calendar/lightning/build/get-platform.py \
		$(DIST_ARCH_2)/xpi-stage/lightning`; \
	mkdir -p $(DIST_UNI)/xpi-stage/lightning/components/$$platform; \
	cp $(DIST_ARCH_2)/xpi-stage/lightning/components/*.dylib \
		$(DIST_UNI)/xpi-stage/lightning/components/$$platform; \
	$(foreach dylib,$(wildcard $(DIST_ARCH_2)/xpi-stage/lightning/components/*.dylib),echo binary-component $$platform/$(notdir $(dylib)) ABI=$$platform >> $(DIST_UNI)/xpi-stage/lightning/components/libical.manifest)
	grep -v em:realTargetPlatform $(DIST_ARCH_1)/xpi-stage/lightning/install.rdf > $(DIST_UNI)/xpi-stage/lightning/install.rdf
	cd $(DIST_UNI)/xpi-stage/lightning && $(ZIP) -qr ../$(XPI_PKGNAME).xpi *
