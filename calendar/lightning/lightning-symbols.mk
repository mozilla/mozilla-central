# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

###################################
# Warning this code is copied
# from mozilla-central/Makefile.in
# and needs to be kept in sync.
###################################
SYMBOL_INDEX_NAME = \
   $(MOZ_APP_NAME)-$(MOZ_APP_VERSION)-$(OS_TARGET)-$(BUILDID)$(EXTRA_BUILDID)-symbols.txt

ifeq ($(OS_ARCH),WINNT)
# we want to copy PDB files on Windows
MAKE_SYM_STORE_ARGS := -c --vcs-info
ifdef PDBSTR_PATH
MAKE_SYM_STORE_ARGS += -i
endif
DUMP_SYMS_BIN ?= $(MOZILLA_SRCDIR)/toolkit/crashreporter/tools/win32/dump_syms_vc$(_MSC_VER).exe
# PDB files don't get moved to dist, so we need to scan the whole objdir
MAKE_SYM_STORE_PATH := $(DEPTH)
endif
ifeq ($(OS_ARCH),Darwin)
# need to pass arch flags for universal builds
ifdef UNIVERSAL_BINARY
MAKE_SYM_STORE_ARGS := -c -a "i386 x86_64" --vcs-info
MAKE_SYM_STORE_PATH := $(DIST)/universal/xpi-stage/lightning
else
MAKE_SYM_STORE_ARGS := -c -a $(OS_TEST) --vcs-info
MAKE_SYM_STORE_PATH := $(DIST)/xpi-stage/lightning
endif
DUMP_SYMS_BIN ?= $(DIST)/host/bin/dump_syms
endif
ifeq (,$(filter-out Linux SunOS,$(OS_ARCH)))
MAKE_SYM_STORE_ARGS := -c --vcs-info
DUMP_SYMS_BIN ?= $(DIST)/host/bin/dump_syms
MAKE_SYM_STORE_PATH := $(DIST)/xpi-stage/lightning
endif

SYM_STORE_SOURCE_DIRS := $(topsrcdir)

buildsymbols:
ifdef MOZ_CRASHREPORTER
ifdef USE_ELF_HACK
	$(MAKE) -C $(MOZ_BUILD_APP)/installer elfhack
endif
	echo building symbol store
	$(RM) -r $(DIST)/crashreporter-symbols
	$(RM) "$(DIST)/$(SYMBOL_ARCHIVE_BASENAME).zip"
	$(NSINSTALL) -D $(DIST)/crashreporter-symbols
	$(PYTHON) $(MOZILLA_SRCDIR)/toolkit/crashreporter/tools/symbolstore.py \
	  $(MAKE_SYM_STORE_ARGS)                                          \
	  $(foreach dir,$(SYM_STORE_SOURCE_DIRS),-s $(dir))               \
	  $(DUMP_SYMS_BIN)                                                \
	  $(DIST)/crashreporter-symbols                                   \
	  $(MAKE_SYM_STORE_PATH) >                                        \
	  $(DIST)/crashreporter-symbols/$(SYMBOL_INDEX_NAME)
	echo packing symbols
	$(NSINSTALL) -D $(DIST)/$(PKG_PATH)
	cd $(DIST)/crashreporter-symbols && \
	  zip -r9D "../$(PKG_PATH)$(SYMBOL_FULL_ARCHIVE_BASENAME).zip" .
	cd $(DIST)/crashreporter-symbols && \
	  grep "sym" $(SYMBOL_INDEX_NAME) > $(SYMBOL_INDEX_NAME).tmp && \
	  mv $(SYMBOL_INDEX_NAME).tmp $(SYMBOL_INDEX_NAME)
	cd $(DIST)/crashreporter-symbols && \
          zip -r9D "../$(PKG_PATH)$(SYMBOL_ARCHIVE_BASENAME).zip" . -i "*.sym" -i "*.txt"
endif # MOZ_CRASHREPORTER

uploadsymbols:
ifdef MOZ_CRASHREPORTER
	$(SHELL) $(MOZILLA_SRCDIR)/toolkit/crashreporter/tools/upload_symbols.sh $(SYMBOL_INDEX_NAME) "$(DIST)/$(PKG_PATH)$(SYMBOL_FULL_ARCHIVE_BASENAME).zip"
endif

###################################
# END Warning
###################################
