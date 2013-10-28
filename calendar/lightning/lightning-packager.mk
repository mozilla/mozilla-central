# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# NOTE: The packager is not only used in calendar/lightning but should be
# general enough to be able to repackage other sub-extensions like
# calendar/providers/gdata. This means no lightning-specific files, no version
# numbers directly from lightning and be careful with relative paths.

# This packager can be used to repackage extensions. To use it, set the
# following variables in your Makefile, then include this file.
#   XPI_NAME = lightning # The extension path name
#   XPI_PKGNAME = lightning-2.2.en-US.mac # The extension package name
#   XPI_VERSION = 2.2 # The extension version
#
# The following variables are optional:
#   XPI_NO_UNIVERSAL = 1  # If set, no universal path is used on mac

include $(MOZILLA_SRCDIR)/toolkit/mozapps/installer/package-name.mk

# Set the univeral path only if we are building a univeral binary and it was
# not restricted by the calling makefile
ifeq ($(UNIVERSAL_BINARY)|$(XPI_NO_UNIVERSAL),1|)
UNIVERSAL_PATH=universal/
else
UNIVERSAL_PATH=
endif

_ABS_DIST := $(abspath $(DIST))

# This variable is to allow the wget-en-US target to know which ftp server to download from
ifndef EN_US_BINARY_URL
EN_US_BINARY_URL = $(error You must set EN_US_BINARY_URL)
endif

XPI_STAGE_PATH = $(DIST)/$(UNIVERSAL_PATH)xpi-stage
_ABS_XPI_STAGE_PATH = $(_ABS_DIST)/$(UNIVERSAL_PATH)xpi-stage
$(XPI_STAGE_PATH):
	mkdir -p $@

# Target Directory used for the l10n files
L10N_TARGET = $(XPI_STAGE_PATH)/$(XPI_NAME)-$(AB_CD)

# Short name of the OS used in shipped-locales file. For now osx is the only
# special case, so assume linux for everything else.
ifeq (cocoa,$(MOZ_WIDGET_TOOLKIT))
SHORTOS = osx
else
SHORTOS = linux
endif

# function oslocales(filename)
oslocales = $(shell $(AWK) '{ if ($$2 == "" || $$2 == "$(SHORTOS)") { print $$1 } }' $(1))

# function apposlocales(app)
apposlocales = $(call oslocales,$(topsrcdir)/$1/locales/$(if $(filter $(MOZ_UPDATE_CHANNEL),beta release),shipped-locales,all-locales))

# function print_ltnconfig(section,configname)
print_ltnconfig = $(shell $(PYTHON) $(MOZILLA_SRCDIR)/config/printconfigsetting.py $(XPI_STAGE_PATH)/$(XPI_NAME)/application.ini $1 $2)

# Lightning uses Thunderbird's build machinery, so we need to hack the binary
# url to use Lightning's directories.
wget-en-US: FINAL_BINARY_URL = $(subst thunderbird,calendar/lightning,$(EN_US_BINARY_URL))
wget-en-US: $(XPI_STAGE_PATH)
wget-en-US: ZIP_IN ?= $(_ABS_XPI_STAGE_PATH)/$(XPI_PKGNAME).xpi
wget-en-US:
	(cd $(XPI_STAGE_PATH) && $(WGET) -nv -N $(FINAL_BINARY_URL)/$(XPI_PKGNAME).xpi)
	@echo "Downloaded $(FINAL_BINARY_URL)/$(XPI_PKGNAME) to	$(ZIP_IN)"

# If this file is missing, its probably the release run where we can't
# influence the download location. Fake it from the env vars we have
ensure-stage-dir: $(if $(wildcard $(XPI_STAGE_PATH)/$(XPI_NAME)/),,wget-from-env)
wget-from-env: BUILD_NR=$(shell echo $(POST_UPLOAD_CMD) | sed -n -e 's/.*-n \([0-9]*\).*/\1/p')
wget-from-env: CANDIDATE_NR=$(XPI_VERSION)
wget-from-env: EN_US_BINARY_URL=http://$(UPLOAD_HOST)/pub/mozilla.org/calendar/lightning/nightly/$(CANDIDATE_NR)-candidates/build$(BUILD_NR)/$(MOZ_PKG_PLATFORM)
wget-from-env: XPI_PKGNAME:=$(subst .$(AB_CD).,.en-US.,$(XPI_PKGNAME))
wget-from-env: ZIP_IN=$(_ABS_XPI_STAGE_PATH)/$(XPI_PKGNAME).xpi
wget-from-env: wget-en-US unpack

# We're unpacking directly into FINAL_TARGET, this keeps code to do manual
# repacks cleaner.
unpack: ZIP_IN ?= $(_ABS_XPI_STAGE_PATH)/$(XPI_PKGNAME).xpi
unpack: $(ZIP_IN)
	if test -d $(XPI_STAGE_PATH)/$(XPI_NAME); then \
	  $(RM) -r -v $(XPI_STAGE_PATH)/$(XPI_NAME); \
	fi
	$(NSINSTALL) -D $(XPI_STAGE_PATH)/$(XPI_NAME)
	cd $(XPI_STAGE_PATH)/$(XPI_NAME) && $(UNZIP) $(ZIP_IN)
	@echo done unpacking

# Nothing to package for en-US, its just the usual english xpi
langpack-en-US:
	@echo "Skipping $@ as en-US is the default"

# Skip those locales in Thunderbird but not in Lightning. Use either
# all-locales or shipped-locales, depending on if we are doing a
# regular repack or a release repack
CAL_LOCALES := $(call apposlocales,calendar)
TB_LOCALES := $(call apposlocales,mail)
TB_SKIP_LOCALES := $(filter-out $(CAL_LOCALES) en-US,$(TB_LOCALES))
$(addprefix langpack-,$(TB_SKIP_LOCALES)) $(addprefix upload-,$(TB_SKIP_LOCALES)):
	@echo "Skipping $@ as it is not in Lightning's locales: $(CAL_LOCALES)"

# Calling these targets with prerequisites causes the libs and subsequent
# targets to be switched in order due to some make voodoo. Therefore we call
# the targets explicitly, which seems to work better.
langpack-%: L10N_XPI_NAME=$(XPI_NAME)-$*
langpack-%: L10N_XPI_PKGNAME=$(subst $(AB_CD),$*,$(XPI_PKGNAME))
langpack-%: AB_CD=$*
langpack-%: ensure-stage-dir
	$(MAKE) L10N_XPI_NAME=$(L10N_XPI_NAME) L10N_XPI_PKGNAME=$(L10N_XPI_PKGNAME) AB_CD=$(AB_CD) \
	  recreate-platformini repack-stage repack-process-extrafiles libs-$(AB_CD)
	@echo "Done packaging $(L10N_XPI_PKGNAME).xpi"

clobber-%: AB_CD=$*
clobber-%:
	$(RM) -r $(L10N_TARGET)

repackage-zip-%:
	@echo "Already repackaged zip for $* in langpack step"

repack-stage: repack-stage-all
	grep -v 'locale \w\+ en-US' $(L10N_TARGET)/chrome.manifest > $(L10N_TARGET)/chrome.manifest~ && \
	  mv $(L10N_TARGET)/chrome.manifest~ $(L10N_TARGET)/chrome.manifest
	find $(abspath $(L10N_TARGET)) -name '*en-US*' -print0 | xargs -0 rm -rf

repack-stage-all: $(XPI_STAGE_PATH)/$(XPI_NAME)
	@echo "Repackaging $(XPI_PKGNAME) locale for Language $(AB_CD)"
	$(RM) -rf $(L10N_TARGET)
	cp -R $(XPI_STAGE_PATH)/$(XPI_NAME) $(L10N_TARGET)

# Repack the existing lightning to contain all locales in lightning-all.xpi
langpack-all: AB_CD=all
langpack-all: L10N_XPI_NAME=$(XPI_NAME)-all
langpack-all: L10N_XPI_PKGNAME=$(subst .$(AB_CD),,$(XPI_PKGNAME))
langpack-all: recreate-platformini repack-stage-all $(addprefix libs-,$(call apposlocales,calendar))
	@echo "Done packaging"

# Actual locale packaging targets. If L10N_XPI_NAME is set, then use it.
# Otherwise keep the original XPI_NAME
# Overriding the final target is a bit of a hack for universal builds
# so that we can ensure we get the right xpi that gets repacked.
libs-%: FINAL_XPI_NAME=$(if $(L10N_XPI_NAME),$(L10N_XPI_NAME),$(XPI_NAME))
libs-%: FINAL_XPI_PKGNAME=$(if $(L10N_XPI_PKGNAME),$(L10N_XPI_PKGNAME),$(XPI_PKGNAME))
libs-%:
	$(MAKE) -C locales libs AB_CD=$* FINAL_TARGET=$(_ABS_DIST)/$(UNIVERSAL_PATH)xpi-stage/$(FINAL_XPI_NAME) \
	  XPI_NAME=$(FINAL_XPI_NAME) XPI_PKGNAME=$(FINAL_XPI_PKGNAME) USE_EXTENSION_MANIFEST=1
	$(MAKE) -C locales tools AB_CD=$* FINAL_TARGET=$(_ABS_DIST)/$(UNIVERSAL_PATH)xpi-stage/$(FINAL_XPI_NAME) \
	  XPI_NAME=$(FINAL_XPI_NAME) XPI_PKGNAME=$(FINAL_XPI_PKGNAME) USE_EXTENSION_MANIFEST=1

# For localized xpis, the install.rdf need to be reprocessed with some defines
# from the locale.
repack-process-extrafiles: LOCALE_BASEDIR=$(call EXPAND_LOCALE_SRCDIR,calendar/locales)
repack-process-extrafiles:
	$(PYTHON) $(MOZILLA_SRCDIR)/config/Preprocessor.py \
	  $(XULAPP_DEFINES) $(DEFINES) $(ACDEFINES) $(XULPPFLAGS) \
	  -I $(LOCALE_BASEDIR)/defines.inc \
	  $(srcdir)/install.rdf > $(XPI_STAGE_PATH)/$(L10N_XPI_NAME)/install.rdf

# When repackaging Lightning from the builder, platform.ini is not yet created.
# Recreate it from the application.ini bundled with the downloaded xpi.
$(LIBXUL_DIST)/bin/platform.ini:
	mkdir -p $(@D)
	echo "[Build]" >> $(LIBXUL_DIST)/bin/platform.ini
	echo "Milestone=$(call print_ltnconfig,Gecko,MaxVersion)" >> $(LIBXUL_DIST)/bin/platform.ini
	echo "SourceStamp=$(call print_ltnconfig,Build,SourceStamp)" >> $(LIBXUL_DIST)/bin/platform.ini
	echo "SourceRepository=$(call print_ltnconfig,Build,SourceRepository)" >> $(LIBXUL_DIST)/bin/platform.ini
	echo "BuildID=$(call print_ltnconfig,App,BuildID)" >> $(LIBXUL_DIST)/bin/platform.ini

recreate-platformini: $(LIBXUL_DIST)/bin/platform.ini


# Lightning uses Thunderbird's build machinery, so we need to hack the post
# upload command to use Lightning's directories and version.
upload: upload-$(AB_CD)
upload-%: LTN_UPLOAD_CMD := $(patsubst $(THUNDERBIRD_VERSION)%,$(XPI_VERSION),$(subst thunderbird,calendar/lightning,$(POST_UPLOAD_CMD)))
upload-%: stage_upload
	POST_UPLOAD_CMD="$(LTN_UPLOAD_CMD)" \
	  $(PYTHON) $(MOZILLA_DIR)/build/upload.py --base-path $(DIST) \
	  "$(DIST)/$(MOZ_PKG_PLATFORM)/$(XPI_PKGNAME).xpi"

stage_upload:
	$(NSINSTALL) -D $(DIST)/$(MOZ_PKG_PLATFORM)
	$(call install_cmd,$(IFLAGS1) $(XPI_STAGE_PATH)/$(XPI_PKGNAME).xpi $(DIST)/$(MOZ_PKG_PLATFORM))
