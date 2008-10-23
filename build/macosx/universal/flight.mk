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
# The Original Code is the Mozilla Mac OS X Universal Binary Packaging System
#
# The Initial Developer of the Original Code is Google Inc.
# Portions created by the Initial Developer are Copyright (C) 2006
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Mark Mentovai <mark@moxienet.com> (Original Author)
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

# BE CAREFUL!  This makefile handles a postflight_all rule for a
# multi-project build, so DON'T rely on anything that might differ between
# the two OBJDIRs.

ifndef OBJDIR
OBJDIR_PPC = $(MOZ_OBJDIR)/ppc
OBJDIR_X86 = $(MOZ_OBJDIR)/i386
DIST_PPC = $(OBJDIR_PPC)/mozilla/dist
DIST_X86 = $(OBJDIR_X86)/mozilla/dist
DIST_UNI = $(DIST_PPC)/universal
OBJDIR = $(OBJDIR_PPC)
endif

include $(OBJDIR)/config/autoconf.mk

DIST = $(OBJDIR)/mozilla/dist

ifdef MOZ_DEBUG
DBGTAG = Debug
else
DBGTAG =
endif

ifdef LIBXUL_SDK # {
APP_CONTENTS = Contents/Frameworks/XUL.framework
else # } {
APP_CONTENTS = Contents/MacOS
endif # } LIBXUL_SDK

MOZ_PKG_APPNAME = $(MOZ_APP_NAME)
APPNAME = $(MOZ_APP_DISPLAYNAME)$(DBGTAG).app
INSTALLER_DIR = $(MOZ_BUILD_APP)/installer
BUILDCONFIG_JAR = $(APP_CONTENTS)/chrome/toolkit.jar

postflight_all:
# Build the universal package out of only the bits that would be released.
# Call the packager to set this up.  Set UNIVERSAL_BINARY= to avoid producing
# a universal binary too early, before the unified bits have been staged.
# Set SIGN_NSS= to skip shlibsign.
	$(MAKE) -C $(OBJDIR_PPC)/$(INSTALLER_DIR) \
          UNIVERSAL_BINARY= SIGN_NSS= PKG_SKIP_STRIP=1 stage-package
	$(MAKE) -C $(OBJDIR_X86)/$(INSTALLER_DIR) \
          UNIVERSAL_BINARY= SIGN_NSS= PKG_SKIP_STRIP=1 stage-package
# Remove .chk files that may have been copied from the NSS build.  These will
# cause unify to warn or fail if present.  New .chk files that are
# appropriate for the merged libraries will be generated when the universal
# dmg is built.
	rm -f $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/$(APP_CONTENTS)/*.chk \
	      $(DIST_X86)/$(MOZ_PKG_APPNAME)/$(APPNAME)/$(APP_CONTENTS)/*.chk
# The only difference betewen the two trees now should be the
# about:buildconfig page.  Fix it up.
	$(TOPSRCDIR)/mozilla/build/macosx/universal/fix-buildconfig \
	  $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/$(BUILDCONFIG_JAR) \
	  $(DIST_X86)/$(MOZ_PKG_APPNAME)/$(APPNAME)/$(BUILDCONFIG_JAR)
	mkdir -p $(DIST_UNI)/$(MOZ_PKG_APPNAME)
	rm -f $(DIST_X86)/universal
	ln -s $(DIST_UNI) $(DIST_X86)/universal
	rm -rf $(DIST_UNI)/$(MOZ_PKG_APPNAME)/$(APPNAME)
ifdef MOZ_CALENDAR
ifndef DISABLE_LIGHTNING_INSTALL
ifndef MOZ_SUNBIRD
# workaround for different platforms in lightning installrdf
	$(PYTHON) $(TOPSRCDIR)/build/merge-installrdf.py $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\} $(DIST_X86)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\} > $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\}/install.rdf_
	mv $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\}/install.rdf_ $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\}/install.rdf
	cp $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\}/install.rdf $(DIST_X86)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\}/install.rdf
endif
endif
endif
	$(TOPSRCDIR)/mozilla/build/macosx/universal/unify \
	  $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME) \
	  $(DIST_X86)/$(MOZ_PKG_APPNAME)/$(APPNAME) \
	  $(DIST_UNI)/$(MOZ_PKG_APPNAME)/$(APPNAME)
ifdef MOZ_CALENDAR
ifndef DISABLE_LIGHTNING_INSTALL
ifndef MOZ_SUNBIRD
	rm $(DIST_PPC)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\}/install.rdf \
      $(DIST_X86)/$(MOZ_PKG_APPNAME)/$(APPNAME)/Contents/MacOS/extensions/\{e2fda1a4-762b-4020-b5ad-a41df1933103\}/install.rdf
endif
endif
endif
# A universal .dmg can now be produced by making in either architecture's
# INSTALLER_DIR.
