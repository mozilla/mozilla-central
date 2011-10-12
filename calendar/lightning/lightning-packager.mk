# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Calendar code.
#
# The Initial Developer of the Original Code is
#   Philipp Kewisch <mozilla@kewis.ch>
# Portions created by the Initial Developer are Copyright (C) 2010
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

ifdef UNIVERSAL_BINARY
UNIVERSAL_PATH=universal/
else
UNIVERSAL_PATH=
endif

_ABS_DIST := $(call core_abspath,$(DIST))
ZIP_IN ?= $(_ABS_DIST)/$(UNIVERSAL_PATH)xpi-stage/$(XPI_NAME).xpi

# This variable is to allow the wget-en-US target to know which ftp server to download from
ifndef EN_US_BINARY_URL
EN_US_BINARY_URL = $(error You must set EN_US_BINARY_URL)
endif

# Target Directory used for the l10n files
L10N_TARGET = $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(XPI_NAME)-$(AB_CD)

$(DIST)/$(UNIVERSAL_PATH)xpi-stage:
	mkdir -p $@

wget-en-US: $(DIST)/$(UNIVERSAL_PATH)xpi-stage
ifndef WGET
	$(error wget not installed)
endif
	(cd $(DIST)/xpi-stage && $(WGET) -nv -N $(EN_US_BINARY_URL)/$(XPI_NAME).xpi)
	@echo "Downloaded $(EN_US_BINARY_URL)/$(PACKAGE) to	$(ZIP_IN)"

unpack: $(ZIP_IN)
# We're unpacking directly into FINAL_TARGET, this keeps code to do manual
# repacks cleaner.
	if test -d $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(FINAL_XPI_NAME); then \
	  $(RM) -r -v $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(FINAL_XPI_NAME); \
	fi
	$(NSINSTALL) -D $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(FINAL_XPI_NAME)
	cd $(DIST)/$(UNIVERSAL_PATH)/xpi-stage/$(FINAL_XPI_NAME) && $(UNZIP) $(ZIP_IN)
	@echo done unpacking

# Call this target to upload the localized lightning package.
l10n-upload-%: AB_CD=$*
l10n-upload-%:
	$(PYTHON) $(MOZILLA_SRCDIR)/build/upload.py --base-path $(DIST)/$(UNIVERSAL_PATH)xpi-stage/  "$(L10N_TARGET).xpi"

# Call this target to trigger repackaging lightning for a specific language
# Usage: make AB_CD=<language> repack-l10n
repack-l10n: L10N_XPI_NAME=$(subst -en-US,,$(XPI_NAME)-$(AB_CD))
repack-l10n: recreate-platformini repack-clobber libs-$(AB_CD) repack-process-extrafiles
	@echo "Finished repackaging $(XPI_NAME) locale for Language $(AB_CD)"

# This target should not be called directly
repack-clobber-all:
	@echo "Repackaging $(XPI_NAME) locale for Language $(AB_CD)"
	$(RM) -rf $(L10N_TARGET)
	cp -R $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(XPI_NAME) $(L10N_TARGET)

# This target should not be called directly
repack-clobber: repack-clobber-all
	grep -v 'locale \w\+ en-US' $(L10N_TARGET)/chrome.manifest > $(L10N_TARGET)/chrome.manifest~ && \
	  mv $(L10N_TARGET)/chrome.manifest~ $(L10N_TARGET)/chrome.manifest
ifeq ($(MOZ_CHROME_FILE_FORMAT),flat)
	$(RM) -rf $(L10N_TARGET)/chrome/lightning-en-US/
	$(RM) -rf $(L10N_TARGET)/chrome/calendar-en-US/
else ifeq ($(MOZ_CHROME_FILE_FORMAT),jar)
	$(RM) -rf $(L10N_TARGET)/chrome/lightning-en-US.jar
	$(RM) -rf $(L10N_TARGET)/chrome/calendar-en-US.jar
else
	@echo "ERROR: Unhandled chrome file format: $(MOZ_CHROME_FILE_FORMAT)"
	@exit 1
endif

ifeq (cocoa,$(MOZ_WIDGET_TOOLKIT))
SHORTOS = osx
else
# For now, osx is the only special case. Therefore, we can just fallback to
# detecting linux which should be the second argument.
SHORTOS = linux
endif

# Repack the existing lightning to contain all locales in lightning-all.xpi
repack-l10n-all: AB_CD=all
repack-l10n-all: L10N_XPI_NAME=lightning-all
repack-l10n-all: repack-clobber-all $(addprefix libs-,$(shell awk '{ if ($$2 == "" || $$2 == "$(SHORTOS)") { print $$1 } }' $(topsrcdir)/calendar/locales/shipped-locales))

.PHONY : repack-l10n-all

# Helper target to align names better to targets from other locale Makefiles
repack-l10n-%:
	$(MAKE) AB_CD=$* repack-l10n

# Actual locale packaging targets. If L10N_XPI_NAME is set, then use it.
# Otherwise keep the original XPI_NAME
# Overriding the final target is a bit of a hack for universal builds
# so that we can ensure we get the right xpi that gets repacked
libs-%: FINAL_XPI_NAME=$(if $(L10N_XPI_NAME),$(L10N_XPI_NAME),$(XPI_NAME))
libs-%:
	$(MAKE) -C locales libs AB_CD=$* FINAL_TARGET=$(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(FINAL_XPI_NAME) XPI_NAME=$(FINAL_XPI_NAME) XPI_PKGNAME=$(FINAL_XPI_NAME) USE_EXTENSION_MANIFEST=1
	$(MAKE) -C ../locales libs AB_CD=$* FINAL_TARGET=$(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(FINAL_XPI_NAME) XPI_NAME=$(FINAL_XPI_NAME) XPI_PKGNAME=$(FINAL_XPI_NAME) USE_EXTENSION_MANIFEST=1

# For localized xpis, the install.rdf and lightning-l10n.js need to be
# reprocessed with some defines from the locale.
repack-process-extrafiles: LOCALE_BASEDIR=$(call EXPAND_LOCALE_SRCDIR,calendar/locales)
repack-process-extrafiles:
	$(PYTHON) $(MOZILLA_SRCDIR)/config/Preprocessor.py $(XULAPP_DEFINES) $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) -I $(LOCALE_BASEDIR)/defines.inc $(srcdir)/install.rdf > $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(L10N_XPI_NAME)/install.rdf
	$(PYTHON) $(MOZILLA_SRCDIR)/config/Preprocessor.py $(PREF_PPFLAGS) $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) $(LOCALE_BASEDIR)/lightning-l10n.js  > $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(L10N_XPI_NAME)/$(PREF_DIR)/lightning-l10n.js

# When repackaging lightning from the builder, platform.ini is not yet created.i
# Recreate it from the application.ini bundled with the downloaded xpi.
$(LIBXUL_DIST)/bin/platform.ini:
	 echo "[Build]" >> $(LIBXUL_DIST)/bin/platform.ini
	 
	 echo -n "Milestone=" >> $(LIBXUL_DIST)/bin/platform.ini
	 $(PYTHON) $(MOZILLA_SRCDIR)/config/printconfigsetting.py $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(XPI_NAME)/application.ini Gecko MaxVersion >> $(LIBXUL_DIST)/bin/platform.ini
	 
	 echo -n "SourceStamp=" >> $(LIBXUL_DIST)/bin/platform.ini
	 $(PYTHON) $(MOZILLA_SRCDIR)/config/printconfigsetting.py $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(XPI_NAME)/application.ini Build SourceStamp >> $(LIBXUL_DIST)/bin/platform.ini
	 
	 echo -n "SourceRepository=" >> $(LIBXUL_DIST)/bin/platform.ini
	 $(PYTHON) $(MOZILLA_SRCDIR)/config/printconfigsetting.py $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(XPI_NAME)/application.ini Build SourceRepository >> $(LIBXUL_DIST)/bin/platform.ini
	 
	 echo -n "BuildID=" >> $(LIBXUL_DIST)/bin/platform.ini
	 $(PYTHON) $(MOZILLA_SRCDIR)/config/printconfigsetting.py $(DIST)/$(UNIVERSAL_PATH)xpi-stage/$(XPI_NAME)/application.ini App BuildID >> $(LIBXUL_DIST)/bin/platform.ini

recreate-platformini: $(LIBXUL_DIST)/bin/platform.ini

UPLOAD_FILES = \
  lightning.xpi \
  gdata-provider.xpi \
  $(NULL)

upload:
	$(NSINSTALL) -D $(DIST)/$(MOZ_PKG_PLATFORM)
	cp -RL $(DIST)/$(UNIVERSAL_PATH)xpi-stage/lightning-all.xpi $(DIST)/$(MOZ_PKG_PLATFORM)/lightning.xpi
	$(INSTALL) $(IFLAGS1) $(DIST)/xpi-stage/gdata-provider.xpi $(DIST)/$(MOZ_PKG_PLATFORM)
	$(PYTHON) $(MOZILLA_DIR)/build/upload.py --base-path $(DIST) \
	  $(addprefix $(DIST)/$(MOZ_PKG_PLATFORM)/,$(UPLOAD_FILES))
