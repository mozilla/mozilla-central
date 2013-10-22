# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# BE CAREFUL!  This makefile handles a postflight_all rule for a
# multi-project build, so DON'T rely on anything that might differ between
# the two OBJDIRs.

ifndef OBJDIR
OBJDIR_ARCH_1 = $(MOZ_OBJDIR)/$(firstword $(MOZ_BUILD_PROJECTS))
OBJDIR_ARCH_2 = $(MOZ_OBJDIR)/$(word 2,$(MOZ_BUILD_PROJECTS))
DIST_ARCH_1 = $(OBJDIR_ARCH_1)/mozilla/dist
DIST_ARCH_2 = $(OBJDIR_ARCH_2)/mozilla/dist
DIST_UNI = $(DIST_ARCH_1)/universal
OBJDIR = $(OBJDIR_ARCH_1)
endif

topsrcdir = $(TOPSRCDIR)
include $(OBJDIR)/config/autoconf.mk

core_abspath = $(if $(filter /%,$(1)),$(1),$(CURDIR)/$(1))

DIST = $(OBJDIR)/mozilla/dist

postflight_all:
	mkdir -p $(DIST_UNI)/$(MOZ_PKG_APPNAME)
	rm -f $(DIST_ARCH_2)/universal
	ln -s $(abspath $(DIST_UNI)) $(DIST_ARCH_2)/universal
# Stage a package for buildsymbols to be happy. Doing so in OBJDIR_ARCH_1
# actually does a universal staging with both OBJDIR_ARCH_1 and OBJDIR_ARCH_2.
	$(MAKE) -C $(OBJDIR_ARCH_1)/$(MOZ_BUILD_APP)/installer \
	   PKG_SKIP_STRIP=1 stage-package
ifdef ENABLE_TESTS
# Now, repeat the process for the test package.
	$(MAKE) -C $(OBJDIR_ARCH_1) UNIVERSAL_BINARY= CHROME_JAR= package-tests
	$(MAKE) -C $(OBJDIR_ARCH_2) UNIVERSAL_BINARY= CHROME_JAR= package-tests
	rm -rf $(DIST_UNI)/test-package-stage
# automation.py differs because it hardcodes a path to
# dist/bin. It doesn't matter which one we use.
	if test -d $(DIST_ARCH_1)/test-package-stage -a                 \
                -d $(DIST_ARCH_2)/test-package-stage; then              \
           cp $(DIST_ARCH_1)/test-package-stage/mochitest/automation.py \
             $(DIST_ARCH_2)/test-package-stage/mochitest/;              \
           cp $(DIST_ARCH_1)/test-package-stage/xpcshell/automation.py   \
             $(DIST_ARCH_2)/test-package-stage/xpcshell/;                \
           cp $(DIST_ARCH_1)/test-package-stage/reftest/automation.py   \
             $(DIST_ARCH_2)/test-package-stage/reftest/;                \
           if test -e $(DIST_ARCH_1)/test-package-stage/mozmill/automation.py; then \
             cp $(DIST_ARCH_1)/test-package-stage/mozmill/automation.py \
               $(DIST_ARCH_2)/test-package-stage/mozmill/;              \
           fi; \
	  $(TOPSRCDIR)/mozilla/build/macosx/universal/unify \
	      --unify-with-sort "\.manifest$$" \
	      --unify-with-sort "all-test-dirs\.list$$" \
	      $(DIST_ARCH_1)/test-package-stage                         \
	      $(DIST_ARCH_2)/test-package-stage                         \
	      $(DIST_UNI)/test-package-stage; \
	fi
endif
