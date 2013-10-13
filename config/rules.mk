# vim:set ts=8 sw=8 sts=8 noet:
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
#

ifndef topsrcdir
$(error topsrcdir was not set))
endif

# Define an include-at-most-once flag
ifdef INCLUDED_RULES_MK
$(error Do not include rules.mk twice!)
endif
INCLUDED_RULES_MK = 1

# Integrate with mozbuild-generated make files. We first verify that no
# variables provided by the automatically generated .mk files are
# present. If they are, this is a violation of the separation of
# responsibility between Makefile.in and mozbuild files.
_MOZBUILD_EXTERNAL_VARIABLES := \
  DIRS \
  PARALLEL_DIRS \
  TEST_DIRS \
  TIERS \
  TOOL_DIRS \
  XPIDL_MODULE \
  $(NULL)

_DEPRECATED_VARIABLES := \
  XPIDL_FLAGS \
  $(NULL)

ifndef EXTERNALLY_MANAGED_MAKE_FILE
# Using $(firstword) may not be perfect. But it should be good enough for most
# scenarios.
_current_makefile = $(CURDIR)/$(firstword $(MAKEFILE_LIST))

$(foreach var,$(_MOZBUILD_EXTERNAL_VARIABLES),$(if $($(var)),\
    $(error Variable $(var) is defined in $(_current_makefile). It should only be defined in moz.build files),\
    ))

$(foreach var,$(_DEPRECATED_VARIABLES),$(if $($(var)),\
    $(error Variable $(var) is defined in $(_current_makefile). This variable has been deprecated. It does nothing. It must be removed in order to build)\
    ))

ifneq (,$(XPIDLSRCS)$(SDK_XPIDLSRCS))
    $(error XPIDLSRCS and SDK_XPIDLSRCS have been merged and moved to moz.build files as the XPIDL_SOURCES variable. You must move these variables out of $(_current_makefile))
endif

# Import the automatically generated backend file. If this file doesn't exist,
# the backend hasn't been properly configured. We want this to be a fatal
# error, hence not using "-include".
ifndef STANDALONE_MAKEFILE
GLOBAL_DEPS += backend.mk
include backend.mk
endif
endif

ifdef TIERS
DIRS += $(foreach tier,$(TIERS),$(tier_$(tier)_dirs))
STATIC_DIRS += $(foreach tier,$(TIERS),$(tier_$(tier)_staticdirs))
endif

ifndef MOZILLA_DIR
MOZILLA_DIR = $(MOZILLA_SRCDIR)
endif

ifndef INCLUDED_CONFIG_MK
include $(topsrcdir)/config/config.mk
endif

ifndef INCLUDED_VERSION_MK
include $(topsrcdir)/config/version.mk
endif

USE_AUTOTARGETS_MK = 1
include $(topsrcdir)/config/makefiles/makeutils.mk

ifdef SDK_HEADERS
EXPORTS += $(SDK_HEADERS)
endif

REPORT_BUILD = $(info $(notdir $<))

ifeq ($(OS_ARCH),OS2)
EXEC			=
else
EXEC			= exec
endif

# Don't copy xulrunner files at install time, when using system xulrunner
ifdef SYSTEM_LIBXUL
  SKIP_COPY_XULRUNNER=1
endif

# ELOG prints out failed command when building silently (gmake -s). Pymake
# prints out failed commands anyway, so ELOG just makes things worse by
# forcing shell invocations.
ifndef .PYMAKE
ifneq (,$(findstring s, $(filter-out --%, $(MAKEFLAGS))))
  ELOG := $(EXEC) sh $(BUILD_TOOLS)/print-failed-commands.sh
else
  ELOG :=
endif # -s
else
  ELOG :=
endif # ifndef .PYMAKE

_VPATH_SRCS = $(abspath $<)

# Add $(DIST)/lib to VPATH so that -lfoo dependencies are followed
VPATH += $(DIST)/lib
ifdef LIBXUL_SDK
VPATH += $(LIBXUL_SDK)/lib
endif

################################################################################
# Testing frameworks support
################################################################################

ifdef ENABLE_TESTS

DIRS += $(TEST_DIRS)

ifdef CPP_UNIT_TESTS

# Compile the tests to $(DIST)/bin.  Make lots of niceties available by default
# through TestHarness.h, by modifying the list of includes and the libs against
# which stuff links.
CPPSRCS += $(CPP_UNIT_TESTS)
SIMPLE_PROGRAMS += $(CPP_UNIT_TESTS:.cpp=$(BIN_SUFFIX))
INCLUDES += -I$(DIST)/include/testing
LIBS += $(XPCOM_GLUE_LDOPTS) $(NSPR_LIBS)

# ...and run them the usual way
check::
	@$(EXIT_ON_ERROR) \
	  for f in $(subst .cpp,$(BIN_SUFFIX),$(CPP_UNIT_TESTS)); do \
	    XPCOM_DEBUG_BREAK=stack-and-abort $(RUN_TEST_PROGRAM) $(DIST)/bin/$$f; \
	  done

endif # CPP_UNIT_TESTS

.PHONY: check xpcshell-tests check-interactive check-one

endif # ENABLE_TESTS


#
# Library rules
#
# If FORCE_STATIC_LIB is set, build a static library.
# Otherwise, build a shared library.
#

ifndef LIBRARY
ifdef STATIC_LIBRARY_NAME
REAL_LIBRARY		:= $(LIB_PREFIX)$(STATIC_LIBRARY_NAME).$(LIB_SUFFIX)
# Only build actual library if it is installed in DIST/lib or SDK
ifeq (,$(SDK_LIBRARY)$(DIST_INSTALL)$(NO_EXPAND_LIBS))
LIBRARY			:= $(REAL_LIBRARY).$(LIBS_DESC_SUFFIX)
else
LIBRARY			:= $(REAL_LIBRARY) $(REAL_LIBRARY).$(LIBS_DESC_SUFFIX)
endif
endif # STATIC_LIBRARY_NAME
endif # LIBRARY

ifndef HOST_LIBRARY
ifdef HOST_LIBRARY_NAME
HOST_LIBRARY		:= $(LIB_PREFIX)$(HOST_LIBRARY_NAME).$(LIB_SUFFIX)
endif
endif

ifdef LIBRARY
ifdef FORCE_SHARED_LIB
ifdef MKSHLIB

ifdef LIB_IS_C_ONLY
MKSHLIB			= $(MKCSHLIB)
endif

ifneq (,$(filter OS2 WINNT,$(OS_ARCH)))
IMPORT_LIBRARY		:= $(LIB_PREFIX)$(SHARED_LIBRARY_NAME).$(IMPORT_LIB_SUFFIX)
endif

ifeq (OS2,$(OS_ARCH))
ifdef SHORT_LIBNAME
SHARED_LIBRARY_NAME	:= $(SHORT_LIBNAME)
endif
endif

ifdef MAKE_FRAMEWORK
SHARED_LIBRARY		:= $(SHARED_LIBRARY_NAME)
else
SHARED_LIBRARY		:= $(DLL_PREFIX)$(SHARED_LIBRARY_NAME)$(DLL_SUFFIX)
endif

ifeq ($(OS_ARCH),OS2)
DEF_FILE		:= $(SHARED_LIBRARY:.dll=.def)
endif

EMBED_MANIFEST_AT=2

endif # MKSHLIB
endif # FORCE_SHARED_LIB
endif # LIBRARY

ifdef FORCE_STATIC_LIB
ifndef FORCE_SHARED_LIB
SHARED_LIBRARY		:= $(NULL)
DEF_FILE		:= $(NULL)
IMPORT_LIBRARY		:= $(NULL)
endif
endif

ifdef FORCE_SHARED_LIB
ifndef FORCE_STATIC_LIB
LIBRARY := $(NULL)
endif
endif

ifeq ($(OS_ARCH),WINNT)
ifndef GNU_CC

#
# Unless we're building SIMPLE_PROGRAMS, all C++ files share a PDB file per
# directory. For parallel builds, this PDB file is shared and locked by
# MSPDBSRV.EXE, starting with MSVC8 SP1. If you're using MSVC 7.1 or MSVC8
# without SP1, don't do parallel builds.
#
# The final PDB for libraries and programs is created by the linker and uses
# a different name from the single PDB file created by the compiler. See
# bug 462740.
#

ifdef SIMPLE_PROGRAMS
COMPILE_PDBFILE = $(basename $(@F)).pdb
else
COMPILE_PDBFILE = generated.pdb
endif

LINK_PDBFILE = $(basename $(@F)).pdb
ifdef MOZ_DEBUG
CODFILE=$(basename $(@F)).cod
endif

ifdef MOZ_MAPINFO
ifdef SHARED_LIBRARY_NAME
MAPFILE=$(SHARED_LIBRARY_NAME).map
else
MAPFILE=$(basename $(@F)).map
endif # SHARED_LIBRARY_NAME
endif # MOZ_MAPINFO

ifdef DEFFILE
OS_LDFLAGS += -DEF:$(call normalizepath,$(DEFFILE))
EXTRA_DEPS += $(DEFFILE)
endif

ifdef MAPFILE
OS_LDFLAGS += -MAP:$(MAPFILE)
endif

endif # !GNU_CC

endif # WINNT

ifeq ($(SOLARIS_SUNPRO_CXX),1)
ifeq (86,$(findstring 86,$(OS_TEST)))
OS_LDFLAGS += -M $(MOZILLA_DIR)/config/solaris_ia32.map
endif # x86
endif # Solaris Sun Studio C++

ifeq ($(HOST_OS_ARCH),WINNT)
HOST_PDBFILE=$(basename $(@F)).pdb
endif

ifndef TARGETS
TARGETS			= $(LIBRARY) $(SHARED_LIBRARY) $(PROGRAM) $(SIMPLE_PROGRAMS) $(HOST_LIBRARY) $(HOST_PROGRAM) $(HOST_SIMPLE_PROGRAMS)
endif

ifndef OBJS
_OBJS			= \
	$(JRI_STUB_CFILES) \
	$(addsuffix .$(OBJ_SUFFIX), $(JMC_GEN)) \
	$(CSRCS:.c=.$(OBJ_SUFFIX)) \
	$(SSRCS:.S=.$(OBJ_SUFFIX)) \
	$(patsubst %.cc,%.$(OBJ_SUFFIX),$(CPPSRCS:.cpp=.$(OBJ_SUFFIX))) \
	$(CMSRCS:.m=.$(OBJ_SUFFIX)) \
	$(CMMSRCS:.mm=.$(OBJ_SUFFIX)) \
	$(ASFILES:.$(ASM_SUFFIX)=.$(OBJ_SUFFIX))
OBJS	= $(strip $(_OBJS))
endif

ifndef HOST_OBJS
_HOST_OBJS		= \
        $(addprefix host_,$(HOST_CSRCS:.c=.$(OBJ_SUFFIX))) \
	$(addprefix host_,$(patsubst %.cc,%.$(OBJ_SUFFIX),$(HOST_CPPSRCS:.cpp=.$(OBJ_SUFFIX)))) \
	$(addprefix host_,$(HOST_CMSRCS:.m=.$(OBJ_SUFFIX))) \
	$(addprefix host_,$(HOST_CMMSRCS:.mm=.$(OBJ_SUFFIX)))
HOST_OBJS = $(strip $(_HOST_OBJS))
endif

LIBOBJS			:= $(addprefix \", $(OBJS))
LIBOBJS			:= $(addsuffix \", $(LIBOBJS))

ALL_TRASH = \
	$(GARBAGE) $(TARGETS) $(OBJS) $(PROGOBJS) LOGS TAGS a.out \
	$(filter-out $(ASFILES),$(OBJS:.$(OBJ_SUFFIX)=.s)) $(OBJS:.$(OBJ_SUFFIX)=.ii) \
	$(OBJS:.$(OBJ_SUFFIX)=.i) \
	$(HOST_PROGOBJS) $(HOST_OBJS) $(IMPORT_LIBRARY) $(DEF_FILE)\
	$(EXE_DEF_FILE) so_locations _gen _stubs $(wildcard *.res) $(wildcard *.RES) \
	$(wildcard *.pdb) $(CODFILE) $(MAPFILE) $(IMPORT_LIBRARY) \
	$(SHARED_LIBRARY:$(DLL_SUFFIX)=.exp) $(wildcard *.ilk) \
	$(PROGRAM:$(BIN_SUFFIX)=.exp) $(SIMPLE_PROGRAMS:$(BIN_SUFFIX)=.exp) \
	$(PROGRAM:$(BIN_SUFFIX)=.lib) $(SIMPLE_PROGRAMS:$(BIN_SUFFIX)=.lib) \
	$(SIMPLE_PROGRAMS:$(BIN_SUFFIX)=.$(OBJ_SUFFIX)) \
	$(wildcard gts_tmp_*) $(LIBRARY:%.a=.%.timestamp)
ALL_TRASH_DIRS = \
	$(GARBAGE_DIRS) /no-such-file

ifdef SIMPLE_PROGRAMS
GARBAGE			+= $(SIMPLE_PROGRAMS:%=%.$(OBJ_SUFFIX))
endif

ifdef HOST_SIMPLE_PROGRAMS
GARBAGE			+= $(HOST_SIMPLE_PROGRAMS:%=%.$(OBJ_SUFFIX))
endif

#
# the Solaris WorkShop template repository cache.  it occasionally can get
# out of sync, so targets like clobber should kill it.
#
ifeq ($(SOLARIS_SUNPRO_CXX),1)
GARBAGE_DIRS += SunWS_cache
endif

ifdef MOZ_UPDATE_XTERM
# Its good not to have a newline at the end of the titlebar string because it
# makes the make -s output easier to read.  Echo -n does not work on all
# platforms, but we can trick printf into doing it.
UPDATE_TITLE = printf "\033]0;%s in %s\007" $(1) $(shell $(BUILD_TOOLS)/print-depth-path.sh)/$(2) ;
endif

define SUBMAKE # $(call SUBMAKE,target,directory)
+@$(UPDATE_TITLE)
+@$(MAKE) $(if $(2),-C $(2)) $(1)

endef # The extra line is important here! don't delete it

ifneq (,$(strip $(DIRS)))
LOOP_OVER_DIRS = \
  $(foreach dir,$(DIRS),$(call SUBMAKE,$@,$(dir)))
endif

# we only use this for the makefiles target and other stuff that doesn't matter
ifneq (,$(strip $(PARALLEL_DIRS)))
LOOP_OVER_PARALLEL_DIRS = \
  $(foreach dir,$(PARALLEL_DIRS),$(call SUBMAKE,$@,$(dir)))
endif

ifneq (,$(strip $(STATIC_DIRS)))
LOOP_OVER_STATIC_DIRS = \
  $(foreach dir,$(STATIC_DIRS),$(call SUBMAKE,$@,$(dir)))
endif

ifneq (,$(strip $(TOOL_DIRS)))
LOOP_OVER_TOOL_DIRS = \
  $(foreach dir,$(TOOL_DIRS),$(call SUBMAKE,$@,$(dir)))
endif

ifdef PARALLEL_DIRS
# create a bunch of fake targets for order-only processing
PARALLEL_DIRS_export = $(addsuffix _export,$(PARALLEL_DIRS))
PARALLEL_DIRS_libs = $(addsuffix _libs,$(PARALLEL_DIRS))
PARALLEL_DIRS_tools = $(addsuffix _tools,$(PARALLEL_DIRS))

.PHONY: $(PARALLEL_DIRS_export) $(PARALLEL_DIRS_libs) $(PARALLEL_DIRS_tools)
endif

#
# Now we can differentiate between objects used to build a library, and
# objects used to build an executable in the same directory.
#
ifndef PROGOBJS
PROGOBJS		= $(OBJS)
endif

ifndef HOST_PROGOBJS
HOST_PROGOBJS		= $(HOST_OBJS)
endif

# MAKE_DIRS: List of directories to build while looping over directories.
# A Makefile that needs $(MDDEPDIR) created but doesn't set any of these
# variables we know to check can just set NEED_MDDEPDIR explicitly.
ifneq (,$(OBJS)$(SIMPLE_PROGRAMS)$(NEED_MDDEPDIR))
MAKE_DIRS	+= $(CURDIR)/$(MDDEPDIR)
GARBAGE_DIRS	+= $(CURDIR)/$(MDDEPDIR)
endif

#
# Tags: emacs (etags), vi (ctags)
# TAG_PROGRAM := ctags -L -
#
TAG_PROGRAM		= xargs etags -a

#
# Turn on C++ linking if we have any .cpp or .mm files
# (moved this from config.mk so that config.mk can be included
#  before the CPPSRCS are defined)
#
ifneq ($(HOST_CPPSRCS)$(HOST_CMMSRCS),)
HOST_CPP_PROG_LINK	= 1
endif

#
# This will strip out symbols that the component should not be
# exporting from the .dynsym section.
#
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += $(MOZ_COMPONENTS_VERSION_SCRIPT_LDFLAGS)
endif # IS_COMPONENT

#
# Enforce the requirement that MODULE_NAME must be set
# for components in static builds
#
ifdef IS_COMPONENT
ifdef EXPORT_LIBRARY
ifndef FORCE_SHARED_LIB
ifndef MODULE_NAME
$(error MODULE_NAME is required for components which may be used in static builds)
endif
endif
endif
endif

#
# MacOS X specific stuff
#

ifeq ($(OS_ARCH),Darwin)
ifdef SHARED_LIBRARY
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS	+= -bundle
else
EXTRA_DSO_LDOPTS	+= -dynamiclib -install_name @executable_path/$(SHARED_LIBRARY) -compatibility_version 1 -current_version 1 -single_module
endif
endif
endif

#
# On NetBSD a.out systems, use -Bsymbolic.  This fixes what would otherwise be
# fatal symbol name clashes between components.
#
ifeq ($(OS_ARCH),NetBSD)
ifeq ($(DLL_SUFFIX),.so.1.0)
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
endif
endif
endif

ifeq ($(OS_ARCH),FreeBSD)
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
endif
endif

ifeq ($(OS_ARCH),NetBSD)
ifneq (,$(filter arc cobalt hpcmips mipsco newsmips pmax sgimips,$(OS_TEST)))
ifeq ($(MODULE),layout)
OS_CFLAGS += -Wa,-xgot
OS_CXXFLAGS += -Wa,-xgot
endif
endif
endif

#
# HP-UXBeOS specific section: for COMPONENTS only, add -Bsymbolic flag
# which uses internal symbols first
#
ifeq ($(OS_ARCH),HP-UX)
ifdef IS_COMPONENT
ifeq ($(GNU_CC)$(GNU_CXX),)
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
ifneq ($(HAS_EXTRAEXPORTS),1)
MKSHLIB  += -Wl,+eNSGetModule -Wl,+eerrno
MKCSHLIB += +eNSGetModule +eerrno
ifneq ($(OS_TEST),ia64)
MKSHLIB  += -Wl,+e_shlInit
MKCSHLIB += +e_shlInit
endif # !ia64
endif # !HAS_EXTRAEXPORTS
endif # non-gnu compilers
endif # IS_COMPONENT
endif # HP-UX

ifeq ($(OS_ARCH),AIX)
ifdef IS_COMPONENT
ifneq ($(HAS_EXTRAEXPORTS),1)
MKSHLIB += -bE:$(MOZILLA_DIR)/build/unix/aix.exp -bnoexpall
MKCSHLIB += -bE:$(MOZILLA_DIR)/build/unix/aix.exp -bnoexpall
endif # HAS_EXTRAEXPORTS
endif # IS_COMPONENT
endif # AIX

#
# Linux: add -Bsymbolic flag for components
#
ifeq ($(OS_ARCH),Linux)
ifdef IS_COMPONENT
EXTRA_DSO_LDOPTS += -Wl,-Bsymbolic
endif
endif

#
# GNU doesn't have path length limitation
#

ifeq ($(OS_ARCH),GNU)
OS_CPPFLAGS += -DPATH_MAX=1024 -DMAXPATHLEN=1024
endif

#
# MINGW32
#
ifeq ($(OS_ARCH),WINNT)
ifdef GNU_CC
ifndef IS_COMPONENT
DSO_LDOPTS += -Wl,--out-implib -Wl,$(IMPORT_LIBRARY)
endif
endif
endif

ifeq ($(USE_TVFS),1)
IFLAGS1 = -rb
IFLAGS2 = -rb
else
IFLAGS1 = -m 644
IFLAGS2 = -m 755
endif

ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
OUTOPTION = -Fo# eol
else
OUTOPTION = -o # eol
endif # WINNT && !GNU_CC

ifeq (,$(CROSS_COMPILE))
HOST_OUTOPTION = $(OUTOPTION)
else
HOST_OUTOPTION = -o # eol
endif
################################################################################

# SUBMAKEFILES: List of Makefiles for next level down.
#   This is used to update or create the Makefiles before invoking them.
SUBMAKEFILES += $(addsuffix /Makefile, $(DIRS) $(TOOL_DIRS) $(PARALLEL_DIRS))

# The root makefile doesn't want to do a plain export/libs, because
# of the tiers and because of libxul. Suppress the default rules in favor
# of something else. Makefiles which use this var *must* provide a sensible
# default rule before including rules.mk
ifndef SUPPRESS_DEFAULT_RULES
default all::
	$(MAKE) export
	$(MAKE) compile
	$(MAKE) libs
	$(MAKE) tools

# Do depend as well
alldep::
	$(MAKE) export
	$(MAKE) depend
	$(MAKE) libs
	$(MAKE) tools

endif # SUPPRESS_DEFAULT_RULES

ifeq ($(filter s,$(MAKEFLAGS)),)
ECHO := echo
QUIET :=
else
ECHO := true
QUIET := -q
endif

MAKE_TIER_SUBMAKEFILES = +$(if $(tier_$*_dirs),$(MAKE) $(addsuffix /Makefile,$(tier_$*_dirs)))

export_tier_%:
	@$(ECHO) "$@"
	@$(MAKE_TIER_SUBMAKEFILES)
	$(foreach dir,$(tier_$*_dirs),$(call SUBMAKE,export,$(dir)))

libs_tier_%:
	@$(ECHO) "$@"
	@$(MAKE_TIER_SUBMAKEFILES)
	$(foreach dir,$(tier_$*_dirs),$(call SUBMAKE,libs,$(dir)))

tools_tier_%:
	@$(ECHO) "$@"
	@$(MAKE_TIER_SUBMAKEFILES)
	$(foreach dir,$(tier_$*_dirs),$(call SUBMAKE,tools,$(dir)))

$(foreach tier,$(TIERS),tier_$(tier))::
	@$(ECHO) "$@: $($@_staticdirs) $($@_dirs)"
	$(foreach dir,$($@_staticdirs),$(call SUBMAKE,,$(dir)))
	$(MAKE) export_$@
	$(MAKE) libs_$@
	$(MAKE) tools_$@

# Do everything from scratch
everything::
	$(MAKE) clean
	$(MAKE) alldep

# Add dummy depend target for tinderboxes
depend::

# Target to only regenerate makefiles
makefiles: $(SUBMAKEFILES)
ifneq (,$(DIRS)$(TOOL_DIRS)$(PARALLEL_DIRS))
	$(LOOP_OVER_PARALLEL_DIRS)
	$(LOOP_OVER_DIRS)
	$(LOOP_OVER_TOOL_DIRS)
endif

#
# Rule to create list of libraries for final link
#
export::
ifdef LIBRARY_NAME
ifdef EXPORT_LIBRARY
ifndef IS_COMPONENT
	$(call py_action,buildlist,$(FINAL_LINK_LIBS) $(STATIC_LIBRARY_NAME))
endif # !IS_COMPONENT
endif # EXPORT_LIBRARY
endif # LIBRARY_NAME

ifneq (,$(filter-out %.$(LIB_SUFFIX),$(SHARED_LIBRARY_LIBS)))
$(error SHARED_LIBRARY_LIBS must contain .$(LIB_SUFFIX) files only)
endif

HOST_LIBS_DEPS = $(filter %.$(LIB_SUFFIX),$(HOST_LIBS))

# Dependencies which, if modified, should cause everything to rebuild
GLOBAL_DEPS += Makefile $(DEPTH)/config/autoconf.mk $(topsrcdir)/config/config.mk
ifndef NO_MAKEFILE_RULE
GLOBAL_DEPS += Makefile.in
endif

##############################################
compile:: $(MAKE_DIRS) $(OBJS) $(HOST_OBJS)

ifdef EXPORT_LIBRARY
ifeq ($(EXPORT_LIBRARY),1)
ifdef IS_COMPONENT
EXPORT_LIBRARY = $(MOZDEPTH)/staticlib/components
else
EXPORT_LIBRARY = $(MOZDEPTH)/staticlib
endif
else
# If EXPORT_LIBRARY has a value, we'll be installing there. We also need to cleanup there
GARBAGE += $(foreach lib,$(LIBRARY),$(EXPORT_LIBRARY)/$(lib))
endif
endif # EXPORT_LIBRARY

libs:: $(SUBMAKEFILES) $(MAKE_DIRS) $(HOST_LIBRARY) $(LIBRARY) $(SHARED_LIBRARY) $(IMPORT_LIBRARY) $(HOST_PROGRAM) $(PROGRAM) $(HOST_SIMPLE_PROGRAMS) $(SIMPLE_PROGRAMS)
ifndef NO_DIST_INSTALL
ifdef LIBRARY
ifdef EXPORT_LIBRARY # Stage libs that will be linked into a static build
	$(call install_cmd,$(IFLAGS1) $(LIBRARY) $(EXPORT_LIBRARY))
endif # EXPORT_LIBRARY
ifdef DIST_INSTALL
ifdef IS_COMPONENT
	$(error Shipping static component libs makes no sense.)
else
	$(call install_cmd,$(IFLAGS1) $(LIBRARY) $(DIST)/lib)
endif
endif # DIST_INSTALL
endif # LIBRARY
ifdef SHARED_LIBRARY
ifdef IS_COMPONENT
	$(call install_cmd,$(IFLAGS2) $(SHARED_LIBRARY) $(FINAL_TARGET)/components)
	$(ELF_DYNSTR_GC) $(FINAL_TARGET)/components/$(SHARED_LIBRARY)
ifndef NO_COMPONENTS_MANIFEST
	$(call py_action,buildlist,$(FINAL_TARGET)/chrome.manifest "manifest components/components.manifest")
	$(call py_action,buildlist,$(FINAL_TARGET)/components/components.manifest "binary-component $(SHARED_LIBRARY)")
endif
else # ! IS_COMPONENT
ifneq (,$(filter OS2 WINNT,$(OS_ARCH)))
ifndef NO_INSTALL_IMPORT_LIBRARY
	$(call install_cmd,$(IFLAGS2) $(IMPORT_LIBRARY) $(DIST)/lib)
endif
else
	$(call install_cmd,$(IFLAGS2) $(SHARED_LIBRARY) $(DIST)/lib)
endif
	$(call install_cmd,$(IFLAGS2) $(SHARED_LIBRARY) $(FINAL_TARGET))
endif # IS_COMPONENT
endif # SHARED_LIBRARY
ifdef PROGRAM
	$(call install_cmd,$(IFLAGS2) $(PROGRAM) $(FINAL_TARGET))
endif
ifdef SIMPLE_PROGRAMS
	$(call install_cmd,$(IFLAGS2) $(SIMPLE_PROGRAMS) $(FINAL_TARGET))
endif
ifdef HOST_PROGRAM
	$(call install_cmd,$(IFLAGS2) $(HOST_PROGRAM) $(DIST)/host/bin)
endif
ifdef HOST_SIMPLE_PROGRAMS
	$(call install_cmd,$(IFLAGS2) $(HOST_SIMPLE_PROGRAMS) $(DIST)/host/bin)
endif
ifdef HOST_LIBRARY
	$(call install_cmd,$(IFLAGS1) $(HOST_LIBRARY) $(DIST)/host/lib)
endif
endif # !NO_DIST_INSTALL

##############################################

ifndef NO_PROFILE_GUIDED_OPTIMIZE
ifdef MOZ_PROFILE_USE
ifeq ($(OS_ARCH)_$(GNU_CC), WINNT_)
# When building with PGO, we have to make sure to re-link
# in the MOZ_PROFILE_USE phase if we linked in the
# MOZ_PROFILE_GENERATE phase. We'll touch this pgo.relink
# file in the link rule in the GENERATE phase to indicate
# that we need a relink.
ifdef SHARED_LIBRARY
$(SHARED_LIBRARY): pgo.relink
endif
ifdef PROGRAM
$(PROGRAM): pgo.relink
endif

# In the second pass, we need to merge the pgc files into the pgd file.
# The compiler would do this for us automatically if they were in the right
# place, but they're in dist/bin.
ifneq (,$(SHARED_LIBRARY)$(PROGRAM))
export::
ifdef PROGRAM
	$(PYTHON) $(MOZILLA_SRCDIR)/build/win32/pgomerge.py \
	  $(PROGRAM:$(BIN_SUFFIX)=) $(DIST)/bin
endif
ifdef SHARED_LIBRARY
	$(PYTHON) $(MOZILLA_SRCDIR)/build/win32/pgomerge.py \
	  $(SHARED_LIBRARY_NAME) $(DIST)/bin
endif
endif # SHARED_LIBRARY || PROGRAM
endif # WINNT_
endif # MOZ_PROFILE_GENERATE || MOZ_PROFILE_USE
endif # NO_PROFILE_GUIDED_OPTIMIZE

##############################################

checkout:
	$(PYTHON) $(topsrcdir)/client.py checkout

clean clobber realclean clobber_all:: $(SUBMAKEFILES)
	-$(RM) $(ALL_TRASH)
	-$(RM) -r $(ALL_TRASH_DIRS)
	$(foreach dir,$(PARALLEL_DIRS) $(DIRS) $(STATIC_DIRS) $(TOOL_DIRS),-$(call SUBMAKE,$@,$(dir)))

distclean:: $(SUBMAKEFILES)
	$(foreach dir,$(PARALLEL_DIRS) $(DIRS) $(STATIC_DIRS) $(TOOL_DIRS),-$(call SUBMAKE,$@,$(dir)))
	-$(RM) -r $(ALL_TRASH_DIRS)
	-$(RM) $(ALL_TRASH)  \
	Makefile .HSancillary \
	$(wildcard *.$(OBJ_SUFFIX)) $(wildcard *.ho) $(wildcard host_*.o*) \
	$(wildcard *.$(LIB_SUFFIX)) $(wildcard *$(DLL_SUFFIX)) \
	$(wildcard *.$(IMPORT_LIB_SUFFIX))
ifeq ($(OS_ARCH),OS2)
	-$(RM) $(PROGRAM:.exe=.map)
endif

alltags:
	$(RM) TAGS
	find $(topsrcdir) -name dist -prune -o \( -name '*.[hc]' -o -name '*.cp' -o -name '*.cpp' -o -name '*.idl' \) -print | $(TAG_PROGRAM)

#
# PROGRAM = Foo
# creates OBJS, links with LIBS to create Foo
#
$(PROGRAM): $(PROGOBJS) $(EXTRA_DEPS) $(EXE_DEF_FILE) $(RESFILE) $(GLOBAL_DEPS)
	@$(RM) $@.manifest
ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
	$(EXPAND_LD) -NOLOGO -OUT:$@ -PDB:$(LINK_PDBFILE) $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(MOZ_GLUE_PROGRAM_LDFLAGS) $(PROGOBJS) $(RESFILE) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS)
ifdef MSMANIFEST_TOOL
	@if test -f $@.manifest; then \
		if test -f "$(srcdir)/$@.manifest"; then \
			echo "Embedding manifest from $(srcdir)/$@.manifest and $@.manifest"; \
			mt.exe -NOLOGO -MANIFEST "$(win_srcdir)/$@.manifest" $@.manifest -OUTPUTRESOURCE:$@\;1; \
		else \
			echo "Embedding manifest from $@.manifest"; \
			mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;1; \
		fi; \
	elif test -f "$(srcdir)/$@.manifest"; then \
		echo "Embedding manifest from $(srcdir)/$@.manifest"; \
		mt.exe -NOLOGO -MANIFEST "$(win_srcdir)/$@.manifest" -OUTPUTRESOURCE:$@\;1; \
	fi
endif	# MSVC with manifest tool
ifdef MOZ_PROFILE_GENERATE
# touch it a few seconds into the future to work around FAT's
# 2-second granularity
	touch -t `date +%Y%m%d%H%M.%S -d "now+5seconds"` pgo.relink
endif
else # !WINNT || GNU_CC
	$(EXPAND_CCC) -o $@ $(CXXFLAGS) $(PROGOBJS) $(RESFILE) $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(WRAP_LDFLAGS) $(MOZ_GLUE_PROGRAM_LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS) $(BIN_FLAGS) $(EXE_DEF_FILE)
endif # WINNT && !GNU_CC

ifdef ENABLE_STRIP
	$(STRIP) $@
endif
ifdef MOZ_POST_PROGRAM_COMMAND
	$(MOZ_POST_PROGRAM_COMMAND) $@
endif

$(HOST_PROGRAM): $(HOST_PROGOBJS) $(HOST_LIBS_DEPS) $(HOST_EXTRA_DEPS) $(GLOBAL_DEPS)
ifeq (_WINNT,$(GNU_CC)_$(HOST_OS_ARCH))
	$(HOST_LD) -NOLOGO -OUT:$@ -PDB:$(HOST_PDBFILE) $(HOST_OBJS) $(WIN32_EXE_LDFLAGS) $(HOST_LDFLAGS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
ifdef MSMANIFEST_TOOL
	@if test -f $@.manifest; then \
		if test -f "$(srcdir)/$@.manifest"; then \
			echo "Embedding manifest from $(srcdir)/$@.manifest and $@.manifest"; \
			mt.exe -NOLOGO -MANIFEST "$(win_srcdir)/$@.manifest" $@.manifest -OUTPUTRESOURCE:$@\;1; \
		else \
			echo "Embedding manifest from $@.manifest"; \
			mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;1; \
		fi; \
	elif test -f "$(srcdir)/$@.manifest"; then \
		echo "Embedding manifest from $(srcdir)/$@.manifest"; \
		mt.exe -NOLOGO -MANIFEST "$(win_srcdir)/$@.manifest" -OUTPUTRESOURCE:$@\;1; \
	fi
endif	# MSVC with manifest tool
else
ifeq ($(HOST_CPP_PROG_LINK),1)
	$(HOST_CXX) -o $@ $(HOST_CXXFLAGS) $(HOST_LDFLAGS) $(HOST_PROGOBJS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
	$(HOST_CC) -o $@ $(HOST_CFLAGS) $(HOST_LDFLAGS) $(HOST_PROGOBJS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
endif # HOST_CPP_PROG_LINK
endif

#
# This is an attempt to support generation of multiple binaries
# in one directory, it assumes everything to compile Foo is in
# Foo.o (from either Foo.c or Foo.cpp).
#
# SIMPLE_PROGRAMS = Foo Bar
# creates Foo.o Bar.o, links with LIBS to create Foo, Bar.
#
$(SIMPLE_PROGRAMS): %$(BIN_SUFFIX): %.$(OBJ_SUFFIX) $(EXTRA_DEPS) $(GLOBAL_DEPS)
ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
	$(EXPAND_LD) -nologo -out:$@ -pdb:$(LINK_PDBFILE) $< $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(MOZ_GLUE_PROGRAM_LDFLAGS) $(LIBS) $(EXTRA_LIBS) $(OS_LIBS)
ifdef MSMANIFEST_TOOL
	@if test -f $@.manifest; then \
		mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;1; \
		rm -f $@.manifest; \
	fi
endif	# MSVC with manifest tool
else
	$(EXPAND_CCC) $(CXXFLAGS) -o $@ $< $(WIN32_EXE_LDFLAGS) $(LDFLAGS) $(MOZ_GLUE_PROGRAM_LDFLAGS) $(WRAP_LDFLAGS) $(LIBS_DIR) $(LIBS) $(OS_LIBS) $(EXTRA_LIBS) $(BIN_FLAGS)
endif # WINNT && !GNU_CC

ifdef ENABLE_STRIP
	$(STRIP) $@
endif
ifdef MOZ_POST_PROGRAM_COMMAND
	$(MOZ_POST_PROGRAM_COMMAND) $@
endif

$(HOST_SIMPLE_PROGRAMS): host_%$(HOST_BIN_SUFFIX): host_%.$(OBJ_SUFFIX) $(HOST_LIBS_DEPS) $(HOST_EXTRA_DEPS) $(GLOBAL_DEPS)
ifeq (WINNT_,$(HOST_OS_ARCH)_$(GNU_CC))
	$(HOST_LD) -NOLOGO -OUT:$@ -PDB:$(HOST_PDBFILE) $< $(WIN32_EXE_LDFLAGS) $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
ifneq (,$(HOST_CPPSRCS)$(USE_HOST_CXX))
	$(HOST_CXX) $(HOST_OUTOPTION)$@ $(HOST_CXXFLAGS) $(INCLUDES) $< $(HOST_LIBS) $(HOST_EXTRA_LIBS)
else
	$(HOST_CC) $(HOST_OUTOPTION)$@ $(HOST_CFLAGS) $(INCLUDES) $< $(HOST_LIBS) $(HOST_EXTRA_LIBS)
endif
endif

ifdef DTRACE_PROBE_OBJ
EXTRA_DEPS += $(DTRACE_PROBE_OBJ)
endif

$(filter %.$(LIB_SUFFIX),$(LIBRARY)): $(OBJS) $(LOBJS) $(EXTRA_DEPS) $(GLOBAL_DEPS)
	$(RM) $(LIBRARY)
	$(EXPAND_AR) $(AR_FLAGS) $(OBJS) $(LOBJS) $(SHARED_LIBRARY_LIBS)
	$(RANLIB) $@

$(filter-out %.$(LIB_SUFFIX),$(LIBRARY)): $(filter %.$(LIB_SUFFIX),$(LIBRARY)) $(OBJS) $(LOBJS) $(EXTRA_DEPS) $(GLOBAL_DEPS)
# When we only build a library descriptor, blow out any existing library
	$(if $(filter %.$(LIB_SUFFIX),$(LIBRARY)),,$(RM) $(REAL_LIBRARY) $(EXPORT_LIBRARY:%=%/$(REAL_LIBRARY)))
	$(EXPAND_LIBS_GEN) -o $@ $(OBJS) $(LOBJS) $(SHARED_LIBRARY_LIBS)

ifeq ($(OS_ARCH),WINNT)
$(IMPORT_LIBRARY): $(SHARED_LIBRARY)
endif

ifeq ($(OS_ARCH),OS2)
$(DEF_FILE): $(OBJS) $(SHARED_LIBRARY_LIBS)
	$(RM) $@
	echo LIBRARY $(SHARED_LIBRARY_NAME) INITINSTANCE TERMINSTANCE > $@
	echo PROTMODE >> $@
	echo CODE    LOADONCALL MOVEABLE DISCARDABLE >> $@
	echo DATA    PRELOAD MOVEABLE MULTIPLE NONSHARED >> $@
	echo EXPORTS >> $@

	$(ADD_TO_DEF_FILE)

ifdef MOZ_OS2_USE_DECLSPEC
$(IMPORT_LIBRARY): $(SHARED_LIBRARY)
else
$(IMPORT_LIBRARY): $(DEF_FILE)
endif
	$(RM) $@
	$(IMPLIB) $@ $^
	$(RANLIB) $@
endif # OS/2

$(HOST_LIBRARY): $(HOST_OBJS) Makefile
	$(RM) $@
	$(HOST_AR) $(HOST_AR_FLAGS) $(HOST_OBJS)
	$(HOST_RANLIB) $@

ifdef HAVE_DTRACE
ifndef XP_MACOSX
ifdef DTRACE_PROBE_OBJ
ifndef DTRACE_LIB_DEPENDENT
$(DTRACE_PROBE_OBJ): $(OBJS)
	dtrace -G -C -s $(MOZILLA_DTRACE_SRC) -o $(DTRACE_PROBE_OBJ) $(OBJS)
endif
endif
endif
endif

# On Darwin (Mac OS X), dwarf2 debugging uses debug info left in .o files,
# so instead of deleting .o files after repacking them into a dylib, we make
# symlinks back to the originals. The symlinks are a no-op for stabs debugging,
# so no need to conditionalize on OS version or debugging format.

$(SHARED_LIBRARY): $(OBJS) $(LOBJS) $(DEF_FILE) $(RESFILE) $(LIBRARY) $(EXTRA_DEPS) $(DSO_LDOPTS_DEPS) $(GLOBAL_DEPS)
ifndef INCREMENTAL_LINKER
	rm -f $@
endif
ifdef DTRACE_LIB_DEPENDENT
ifndef XP_MACOSX
	dtrace -G -C -s $(MOZILLA_DTRACE_SRC) -o  $(DTRACE_PROBE_OBJ) $(shell $(EXPAND_LIBS) $(MOZILLA_PROBE_LIBS))
endif
	$(EXPAND_MKSHLIB) $(SHLIB_LDSTARTFILE) $(OBJS) $(LOBJS) $(SUB_SHLOBJS) $(DTRACE_PROBE_OBJ) $(MOZILLA_PROBE_LIBS) $(RESFILE) $(LDFLAGS) $(MOZ_GLUE_LDFLAGS) $(WRAP_LDFLAGS) $(SHARED_LIBRARY_LIBS) $(EXTRA_DSO_LDOPTS) $(OS_LIBS) $(EXTRA_LIBS) $(DEF_FILE) $(SHLIB_LDENDFILE)
else # ! DTRACE_LIB_DEPENDENT
	$(EXPAND_MKSHLIB) $(SHLIB_LDSTARTFILE) $(OBJS) $(DTRACE_PROBE_OBJ) $(LOBJS) $(SUB_SHLOBJS) $(RESFILE) $(LDFLAGS) $(MOZ_GLUE_LDFLAGS) $(WRAP_LDFLAGS) $(SHARED_LIBRARY_LIBS) $(EXTRA_DSO_LDOPTS) $(OS_LIBS) $(EXTRA_LIBS) $(DEF_FILE) $(SHLIB_LDENDFILE)
endif # DTRACE_LIB_DEPENDENT

ifeq (_WINNT,$(GNU_CC)_$(OS_ARCH))
ifdef MSMANIFEST_TOOL
ifdef EMBED_MANIFEST_AT
	@if test -f $@.manifest; then \
		mt.exe -NOLOGO -MANIFEST $@.manifest -OUTPUTRESOURCE:$@\;$(EMBED_MANIFEST_AT); \
		rm -f $@.manifest; \
	fi
endif   # EMBED_MANIFEST_AT
endif	# MSVC with manifest tool
ifdef MOZ_PROFILE_GENERATE
	touch -t `date +%Y%m%d%H%M.%S -d "now+5seconds"` pgo.relink
endif
endif	# WINNT && !GCC
	@$(RM) foodummyfilefoo $(DELETE_AFTER_LINK)
	chmod +x $@
ifdef ENABLE_STRIP
	$(STRIP) $@
endif
ifdef MOZ_POST_DSO_LIB_COMMAND
	$(MOZ_POST_DSO_LIB_COMMAND) $@
endif

ifeq ($(SOLARIS_SUNPRO_CC),1)
_MDDEPFILE = $(MDDEPDIR)/$(@F).pp

define MAKE_DEPS_AUTO_CC
if test -d $(@D); then \
	echo "Building deps for $< using Sun Studio cc"; \
	$(CC) $(COMPILE_CFLAGS) -xM  $< >$(_MDDEPFILE) ; \
	$(PYTHON) $(MOZILLA_DIR)/build/unix/add_phony_targets.py $(_MDDEPFILE) ; \
fi
endef
define MAKE_DEPS_AUTO_CXX
if test -d $(@D); then \
	echo "Building deps for $< using Sun Studio CC"; \
	$(CXX) $(COMPILE_CXXFLAGS) -xM $< >$(_MDDEPFILE) ; \
	$(PYTHON) $(MOZILLA_DIR)/build/unix/add_phony_targets.py $(_MDDEPFILE) ; \
fi
endef
endif # Sun Studio on Solaris

# Rules for building native targets must come first because of the host_ prefix
host_%.$(OBJ_SUFFIX): %.c $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CC) $(HOST_OUTOPTION)$@ -c $(HOST_CFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.cpp $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CXX) $(HOST_OUTOPTION)$@ -c $(HOST_CXXFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.cc $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CXX) $(HOST_OUTOPTION)$@ -c $(HOST_CXXFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.m $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CC) $(HOST_OUTOPTION)$@ -c $(HOST_CFLAGS) $(HOST_CMFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

host_%.$(OBJ_SUFFIX): %.mm $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	$(ELOG) $(HOST_CXX) $(HOST_OUTOPTION)$@ -c $(HOST_CXXFLAGS) $(HOST_CMMFLAGS) $(INCLUDES) $(NSPR_CFLAGS) $(_VPATH_SRCS)

%:: %.c $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CC)
	$(ELOG) $(CC) $(CFLAGS) $(LDFLAGS) $(OUTOPTION)$@ $(_VPATH_SRCS)

%.$(OBJ_SUFFIX): %.c $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CC)
	$(ELOG) $(CC) $(OUTOPTION)$@ -c $(COMPILE_CFLAGS) $(_VPATH_SRCS)

ifdef ASFILES
# The AS_DASH_C_FLAG is needed cause not all assemblers (Solaris) accept
# a '-c' flag.
%.$(OBJ_SUFFIX): %.$(ASM_SUFFIX) $(GLOBAL_DEPS)
	$(AS) -o $@ $(ASFLAGS) $(AS_DASH_C_FLAG) $(_VPATH_SRCS)
endif

%.$(OBJ_SUFFIX): %.S $(GLOBAL_DEPS)
	$(AS) -o $@ $(ASFLAGS) -c $<

%:: %.cpp $(GLOBAL_DEPS)
	@$(MAKE_DEPS_AUTO_CXX)
	$(CCC) $(OUTOPTION)$@ $(CXXFLAGS) $(_VPATH_SRCS) $(LDFLAGS)

#
# Please keep the next two rules in sync.
#
%.$(OBJ_SUFFIX): %.cc $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CXX)
	$(ELOG) $(CCC) $(OUTOPTION)$@ -c $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)

%.$(OBJ_SUFFIX): %.cpp $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CXX)
ifdef STRICT_CPLUSPLUS_SUFFIX
	echo "#line 1 \"$*.cpp\"" | cat - $*.cpp > t_$*.cc
	$(ELOG) $(CCC) -o $@ -c $(COMPILE_CXXFLAGS) t_$*.cc
	$(RM) t_$*.cc
else
	$(ELOG) $(CCC) $(OUTOPTION)$@ -c $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)
endif #STRICT_CPLUSPLUS_SUFFIX

$(OBJ_PREFIX)%.$(OBJ_SUFFIX): %.mm $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CXX)
	$(ELOG) $(CCC) -o $@ -c $(COMPILE_CXXFLAGS) $(COMPILE_CMMFLAGS) $(_VPATH_SRCS)

$(OBJ_PREFIX)%.$(OBJ_SUFFIX): %.m $(GLOBAL_DEPS)
	$(REPORT_BUILD)
	@$(MAKE_DEPS_AUTO_CC)
	$(ELOG) $(CC) -o $@ -c $(COMPILE_CFLAGS) $(COMPILE_CMFLAGS) $(_VPATH_SRCS)

%.s: %.cpp
	$(CCC) -S $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)

%.s: %.cc
	$(CCC) -S $(COMPILE_CXXFLAGS) $(_VPATH_SRCS)

%.s: %.c
	$(CC) -S $(COMPILE_CFLAGS) $(_VPATH_SRCS)

%.i: %.cpp
	$(CCC) -C -E $(COMPILE_CXXFLAGS) $(_VPATH_SRCS) > $*.i

%.i: %.cc
	$(CCC) -C -E $(COMPILE_CXXFLAGS) $(_VPATH_SRCS) > $*.i

%.i: %.c
	$(CC) -C -E $(COMPILE_CFLAGS) $(_VPATH_SRCS) > $*.i

%.i: %.mm
	$(CCC) -C -E $(COMPILE_CXXFLAGS) $(COMPILE_CMMFLAGS) $(_VPATH_SRCS) > $*.i

%.res: %.rc
	@echo Creating Resource file: $@
ifeq ($(OS_ARCH),OS2)
	$(RC) $(RCFLAGS:-D%=-d %) -i $(subst /,\,$(srcdir)) -r $< $@
else
ifdef GNU_CC
	$(RC) $(RCFLAGS) $(filter-out -U%,$(DEFINES)) $(INCLUDES:-I%=--include-dir %) $(OUTOPTION)$@ $(_VPATH_SRCS)
else
	$(RC) $(RCFLAGS) -r $(DEFINES) $(INCLUDES) $(OUTOPTION)$@ $(_VPATH_SRCS)
endif
endif

# need 3 separate lines for OS/2
%:: %.pl
	$(RM) $@
	cp $< $@
	chmod +x $@

%:: %.sh
	$(RM) $@
	cp $< $@
	chmod +x $@

# Cancel these implicit rules
#
%: %,v

%: RCS/%,v

%: s.%

%: SCCS/s.%

# MSYS has its own special path form, but javac expects the source and class
# paths to be in the DOS form (i.e. e:/builds/...).  This function does the
# appropriate conversion on Windows, but is a noop on other systems.
ifeq ($(HOST_OS_ARCH),WINNT)
# assume MSYS
#  We use 'pwd -W' to get DOS form of the path.  However, since the given path
#  could be a file or a non-existent path, we cannot call 'pwd -W' directly
#  on the path.  Instead, we extract the root path (i.e. "c:/"), call 'pwd -W'
#  on it, then merge with the rest of the path.
root-path = $(shell echo $(1) | sed -e "s|\(/[^/]*\)/\?\(.*\)|\1|")
non-root-path = $(shell echo $(1) | sed -e "s|\(/[^/]*\)/\?\(.*\)|\2|")
normalizepath = $(foreach p,$(1),$(if $(filter /%,$(1)),$(patsubst %/,%,$(shell cd $(call root-path,$(1)) && pwd -W))/$(call non-root-path,$(1)),$(1)))
else
normalizepath = $(1)
endif

###############################################################################
# Update Files Managed by Build Backend
###############################################################################

ifdef MOZBUILD_DERIVED

# If this Makefile is derived from moz.build files, substitution for all .in
# files is handled by SUBSTITUTE_FILES. This includes Makefile.in.
ifneq ($(SUBSTITUTE_FILES),,)
$(SUBSTITUTE_FILES): % : $(srcdir)/%.in $(DEPTH)/config/autoconf.mk
	@$(PYTHON) $(MOZDEPTH)/config.status -n --file=$@
	@$(TOUCH) $@
endif

# Detect when the backend.mk needs rebuilt. This will cause a full scan and
# rebuild. While relatively expensive, it should only occur once per recursion.
ifneq ($(BACKEND_INPUT_FILES),,)
backend.mk: $(BACKEND_INPUT_FILES)
	@$(PYTHON) $(MOZDEPTH)/config.status -n
	@$(TOUCH) $@
endif

endif # MOZBUILD_DERIVED

ifndef NO_MAKEFILE_RULE
Makefile: Makefile.in
	@$(PYTHON) $(MOZDEPTH)/config.status -n --file=Makefile
	@$(TOUCH) $@
endif

ifndef NO_SUBMAKEFILES_RULE
ifdef SUBMAKEFILES
# VPATH does not work on some machines in this case, so add $(srcdir)
$(SUBMAKEFILES): % : $(srcdir)/%.in
	$(PYTHON) $(MOZDEPTH)/config.status -n --file="$@"
	@$(TOUCH) $@
endif
endif

ifdef AUTOUPDATE_CONFIGURE
$(topsrcdir)/configure: $(topsrcdir)/configure.in
	(cd $(topsrcdir) && $(AUTOCONF)) && $(PYTHON) $(MOZDEPTH)/config.status -n --recheck
endif

###############################################################################
# Bunch of things that extend the 'export' rule (in order):
###############################################################################

################################################################################
# Copy each element of EXPORTS to $(DIST)/include

ifneq ($(XPI_NAME),)
$(FINAL_TARGET):
	$(NSINSTALL) -D $@

export:: $(FINAL_TARGET)
endif

ifndef NO_DIST_INSTALL
ifneq (,$(EXPORTS))
export:: $(EXPORTS)
	$(call install_cmd,$(IFLAGS1) $^ $(DIST)/include)
endif
endif # NO_DIST_INSTALL

define EXPORT_NAMESPACE_RULE
ifndef NO_DIST_INSTALL
export:: $(EXPORTS_$(namespace))
	$(call install_cmd,$(IFLAGS1) $$^ $(DIST)/include/$(namespace))
endif # NO_DIST_INSTALL
endef

$(foreach namespace,$(EXPORTS_NAMESPACES),$(eval $(EXPORT_NAMESPACE_RULE)))

################################################################################
# Copy each element of PREF_JS_EXPORTS

# The default location for PREF_JS_EXPORTS is the gre prefs directory.
PREF_DIR = defaults/pref

# If DIST_SUBDIR is defined it indicates that app and gre dirs are
# different and that we are building app related resources. Hence,
# PREF_DIR should point to the app prefs location.
ifneq (,$(DIST_SUBDIR)$(XPI_NAME)$(LIBXUL_SDK))
PREF_DIR = defaults/preferences
endif

ifneq ($(PREF_JS_EXPORTS),)
# on win32, pref files need CRLF line endings... see bug 206029
ifeq (WINNT,$(OS_ARCH))
PREF_PPFLAGS = --line-endings=crlf
endif

ifndef NO_DIST_INSTALL
PREF_JS_EXPORTS_PATH := $(FINAL_TARGET)/$(PREF_DIR)
PREF_JS_EXPORTS_FLAGS := $(PREF_PPFLAGS)
PP_TARGETS += PREF_JS_EXPORTS
endif
endif

################################################################################
# Copy testing-only JS modules to appropriate destination.
#
# For each file defined in TESTING_JS_MODULES, copy it to
# objdir/_tests/modules/. If TESTING_JS_MODULE_DIR is defined, that path
# wlll be appended to the output directory.

ifdef ENABLE_TESTS
ifdef TESTING_JS_MODULES
testmodulesdir = $(MOZDEPTH)/_tests/modules/$(TESTING_JS_MODULE_DIR)

libs::
	$(NSINSTALL) -D $(testmodulesdir)

libs:: $(TESTING_JS_MODULES)
ifndef NO_DIST_INSTALL
	$(INSTALL) $(IFLAGS) $^ $(testmodulesdir)
endif

endif
endif

################################################################################
# Copy each element of AUTOCFG_JS_EXPORTS to $(FINAL_TARGET)/defaults/autoconfig

ifneq ($(AUTOCFG_JS_EXPORTS),)
$(FINAL_TARGET)/defaults/autoconfig::
	$(NSINSTALL) -D $@

ifndef NO_DIST_INSTALL
export:: $(AUTOCFG_JS_EXPORTS) $(FINAL_TARGET)/defaults/autoconfig
	$(call install_cmd,$(IFLAGS1) $^)
endif

endif

################################################################################
# Install a linked .xpt into the appropriate place.
# This should ideally be performed by the non-recursive idl make file. Some day.
ifdef XPT_NAME #{

ifndef NO_DIST_INSTALL
_XPT_NAME_FILES := $(MOZDEPTH)/config/makefiles/xpidl/xpt/$(XPT_NAME)
_XPT_NAME_DEST := $(FINAL_TARGET)/components
INSTALL_TARGETS += _XPT_NAME

ifndef NO_INTERFACES_MANIFEST
libs:: $(call mkdir_deps,$(FINAL_TARGET)/components)
	$(call py_action,buildlist,$(FINAL_TARGET)/components/interfaces.manifest "interfaces $(XPT_NAME)")
	$(call py_action,buildlist,$(FINAL_TARGET)/chrome.manifest "manifest components/interfaces.manifest")
endif
endif

endif #} XPT_NAME

################################################################################
# Copy each element of EXTRA_COMPONENTS to $(FINAL_TARGET)/components
ifneq (,$(filter %.js,$(EXTRA_COMPONENTS) $(EXTRA_PP_COMPONENTS)))
ifeq (,$(filter %.manifest,$(EXTRA_COMPONENTS) $(EXTRA_PP_COMPONENTS)))
ifndef NO_JS_MANIFEST
$(error .js component without matching .manifest. See https://developer.mozilla.org/en/XPCOM/XPCOM_changes_in_Gecko_2.0)
endif
endif
endif

ifdef EXTRA_COMPONENTS
libs:: $(EXTRA_COMPONENTS)
ifndef NO_DIST_INSTALL
	$(call install_cmd,$(IFLAGS1) $^ $(FINAL_TARGET)/components)
endif

endif

ifdef EXTRA_PP_COMPONENTS
ifndef NO_DIST_INSTALL
EXTRA_PP_COMPONENTS_PATH := $(FINAL_TARGET)/components
PP_TARGETS += EXTRA_PP_COMPONENTS
endif
endif

EXTRA_MANIFESTS = $(filter %.manifest,$(EXTRA_COMPONENTS) $(EXTRA_PP_COMPONENTS))
ifneq (,$(EXTRA_MANIFESTS))
libs:: $(call mkdir_deps,$(FINAL_TARGET))
	$(call py_action,buildlist,$(FINAL_TARGET)/chrome.manifest $(patsubst %,"manifest components/%",$(notdir $(EXTRA_MANIFESTS))))
endif

################################################################################
# Copy each element of EXTRA_JS_MODULES to
# $(FINAL_TARGET)/$(JS_MODULES_PATH). JS_MODULES_PATH defaults to "modules"
# if it is undefined.
JS_MODULES_PATH ?= modules
FINAL_JS_MODULES_PATH := $(FINAL_TARGET)/$(JS_MODULES_PATH)

ifdef EXTRA_JS_MODULES
libs:: $(EXTRA_JS_MODULES)
ifndef NO_DIST_INSTALL
	$(call install_cmd,$(IFLAGS1) $^ $(FINAL_JS_MODULES_PATH))
endif

endif

ifdef EXTRA_PP_JS_MODULES
ifndef NO_DIST_INSTALL
EXTRA_PP_JS_MODULES_PATH := $(FINAL_JS_MODULES_PATH)
PP_TARGETS += EXTRA_PP_JS_MODULES
endif
endif

################################################################################
# SDK

ifneq (,$(SDK_LIBRARY))
$(SDK_LIB_DIR)::
	$(NSINSTALL) -D $@

ifndef NO_DIST_INSTALL
libs:: $(SDK_LIBRARY) $(SDK_LIB_DIR)
	$(call install_cmd,$(IFLAGS2) $^)
endif

endif # SDK_LIBRARY

ifneq (,$(SDK_BINARY))
$(SDK_BIN_DIR)::
	$(NSINSTALL) -D $@

ifndef NO_DIST_INSTALL
libs:: $(SDK_BINARY) $(SDK_BIN_DIR)
	$(call install_cmd,$(IFLAGS2) $^)
endif

endif # SDK_BINARY

################################################################################
# CHROME PACKAGING

JAR_MANIFEST := $(srcdir)/jar.mn

chrome::
	$(MAKE) realchrome
	$(LOOP_OVER_PARALLEL_DIRS)
	$(LOOP_OVER_DIRS)
	$(LOOP_OVER_TOOL_DIRS)

$(FINAL_TARGET)/chrome:
	$(NSINSTALL) -D $@

libs realchrome:: $(CHROME_DEPS) $(FINAL_TARGET)/chrome
ifneq (,$(wildcard $(JAR_MANIFEST)))
ifndef NO_DIST_INSTALL
	$(call py_action,jar_maker,\
	  $(QUIET) -j $(FINAL_TARGET)/chrome \
	  $(MAKE_JARS_FLAGS) $(XULPPFLAGS) $(DEFINES) $(ACDEFINES) \
	  $(JAR_MANIFEST))
endif
endif

ifneq ($(DIST_FILES),)
DIST_FILES_PATH := $(FINAL_TARGET)
DIST_FILES_FLAGS := $(XULAPP_DEFINES)
PP_TARGETS += DIST_FILES
endif

ifneq ($(DIST_CHROME_FILES),)
DIST_CHROME_FILES_PATH := $(FINAL_TARGET)/chrome
DIST_CHROME_FILES_FLAGS := $(XULAPP_DEFINES)
PP_TARGETS += DIST_CHROME_FILES
endif

ifneq ($(XPI_PKGNAME),)
tools realchrome::
ifdef STRIP_XPI
ifndef MOZ_DEBUG
	@echo "Stripping $(XPI_PKGNAME) package directory..."
	@echo $(FINAL_TARGET)
	@cd $(FINAL_TARGET) && find . ! -type d \
			! -name "*.js" \
			! -name "*.xpt" \
			! -name "*.gif" \
			! -name "*.jpg" \
			! -name "*.png" \
			! -name "*.xpm" \
			! -name "*.txt" \
			! -name "*.rdf" \
			! -name "*.sh" \
			! -name "*.properties" \
			! -name "*.dtd" \
			! -name "*.html" \
			! -name "*.xul" \
			! -name "*.css" \
			! -name "*.xml" \
			! -name "*.jar" \
			! -name "*.dat" \
			! -name "*.tbl" \
			! -name "*.src" \
			! -name "*.reg" \
			$(PLATFORM_EXCLUDE_LIST) \
			-exec $(STRIP) $(STRIP_FLAGS) {} >/dev/null 2>&1 \;
endif
endif
	@echo "Packaging $(XPI_PKGNAME).xpi..."
	cd $(FINAL_TARGET) && $(ZIP) -qr ../$(XPI_PKGNAME).xpi *
endif

ifdef INSTALL_EXTENSION_ID
ifndef XPI_NAME
$(error XPI_NAME must be set for INSTALL_EXTENSION_ID)
endif

tools::
	$(RM) -r "$(DIST)/bin/extensions/$(INSTALL_EXTENSION_ID)"
	$(NSINSTALL) -D "$(DIST)/bin/extensions/$(INSTALL_EXTENSION_ID)"
	cd $(FINAL_TARGET) && tar $(TAR_CREATE_FLAGS) - . | (cd "../../bin/extensions/$(INSTALL_EXTENSION_ID)" && tar -xf -)

endif

ifneq (,$(filter flat symlink,$(MOZ_CHROME_FILE_FORMAT)))
_JAR_REGCHROME_DISABLE_JAR=1
else
_JAR_REGCHROME_DISABLE_JAR=0
endif

REGCHROME = $(PERL) -I$(MOZILLA_DIR)/config $(MOZILLA_DIR)/config/add-chrome.pl \
	$(if $(filter gtk2,$(MOZ_WIDGET_TOOLKIT)),-x) \
	$(if $(CROSS_COMPILE),-o $(OS_ARCH)) $(FINAL_TARGET)/chrome/installed-chrome.txt \
	$(_JAR_REGCHROME_DISABLE_JAR)

REGCHROME_INSTALL = $(PERL) -I$(MOZILLA_DIR)/config $(MOZILLA_DIR)/config/add-chrome.pl \
	$(if $(filter gtk2,$(MOZ_WIDGET_TOOLKIT)),-x) \
	$(if $(CROSS_COMPILE),-o $(OS_ARCH)) $(DESTDIR)$(mozappdir)/chrome/installed-chrome.txt \
	$(_JAR_REGCHROME_DISABLE_JAR)


#############################################################################
# MDDEPDIR is the subdirectory where all the dependency files are placed.
#   This uses a make rule (instead of a macro) to support parallel
#   builds (-jN). If this were done in the LOOP_OVER_DIRS macro, two
#   processes could simultaneously try to create the same directory.
#
#   We use $(CURDIR) in the rule's target to ensure that we don't find
#   a dependency directory in the source tree via VPATH (perhaps from
#   a previous build in the source tree) and thus neglect to create a
#   dependency directory in the object directory, where we really need
#   it.

$(CURDIR)/$(MDDEPDIR):
	$(MKDIR) -p $@

ifneq (,$(filter-out all chrome default export realchrome tools clean clobber clobber_all distclean realclean,$(MAKECMDGOALS)))
ifneq (,$(OBJS)$(SIMPLE_PROGRAMS))
MDDEPEND_FILES		:= $(strip $(wildcard $(MDDEPDIR)/*.pp))

ifneq (,$(MDDEPEND_FILES))
ifdef .PYMAKE
includedeps $(MDDEPEND_FILES)
else
include $(MDDEPEND_FILES)
endif
endif

endif
endif
#############################################################################

-include $(topsrcdir)/$(MOZ_BUILD_APP)/app-rules.mk
-include $(MY_RULES)

#
# Generate Emacs tags in a file named TAGS if ETAGS was set in $(MY_CONFIG)
# or in $(MY_RULES)
#
ifdef ETAGS
ifneq ($(CSRCS)$(CPPSRCS)$(HEADERS),)
all:: TAGS
TAGS:: $(CSRCS) $(CPPSRCS) $(HEADERS)
	$(ETAGS) $(CSRCS) $(CPPSRCS) $(HEADERS)
endif
endif

################################################################################
# Install/copy rules
#
# The INSTALL_TARGETS variable contains a list of all install target
# categories. Each category defines a list of files and executables, and an
# install destination,
#
# FOO_FILES := foo bar
# FOO_EXECUTABLES := baz
# FOO_DEST := target_path
# INSTALL_TARGETS += FOO
#
# Additionally, a FOO_TARGET variable may be added to indicate the target for
# which the files and executables are installed. Default is "libs".

# If we're using binary nsinstall and it's not built yet, fallback to python nsinstall.
ifneq (,$(filter $(CONFIG_TOOLS)/nsinstall$(HOST_BIN_SUFFIX),$(install_cmd)))
ifeq (,$(wildcard $(CONFIG_TOOLS)/nsinstall$(HOST_BIN_SUFFIX)))
nsinstall_is_usable = $(if $(wildcard $(CONFIG_TOOLS)/nsinstall$(HOST_BIN_SUFFIX)),yes)

define install_cmd_override
$(1): install_cmd = $$(if $$(nsinstall_is_usable),$$(INSTALL),$$(NSINSTALL_PY)) $$(1)
endef
endif
endif

define install_file_template
$(or $(3),libs):: $(2)/$(notdir $(1))
$(call install_cmd_override,$(2)/$(notdir $(1)))
$(2)/$(notdir $(1)): $(1)
	$$(call install_cmd,$(4) "$$<" "$${@D}")
endef
$(foreach category,$(INSTALL_TARGETS),\
  $(if $($(category)_DEST),,$(error Missing $(category)_DEST))\
  $(foreach file,$($(category)_FILES),\
    $(eval $(call install_file_template,$(file),$($(category)_DEST),$($(category)_TARGET),$(IFLAGS1)))\
  )\
  $(foreach file,$($(category)_EXECUTABLES),\
    $(eval $(call install_file_template,$(file),$($(category)_DEST),$($(category)_TARGET),$(IFLAGS2)))\
  )\
)

################################################################################
# Preprocessing rules
#
# The PP_TARGETS variable contains a list of all preprocessing target
# categories. Each category has associated variables listing input files, the
# output directory, extra preprocessor flags, and so on. For example:
#
#   FOO := input-file
#   FOO_PATH := target-directory
#   FOO_FLAGS := -Dsome_flag
#   PP_TARGETS += FOO
#
# If PP_TARGETS lists a category name <C> (like FOO, above), then we consult the
# following make variables to see what to do:
#
# - <C> lists input files to be preprocessed with config/Preprocessor.py. We
#   search VPATH for the names given here. If an input file name ends in '.in',
#   that suffix is omitted from the output file name.
#
# - <C>_PATH names the directory in which to place the preprocessed output
#   files. We create this directory if it does not already exist. Setting
#   this variable is optional; if unset, we install the files in $(CURDIR).
#
# - <C>_FLAGS lists flags to pass to Preprocessor.py, in addition to the usual
#   bunch. Setting this variable is optional.
#
# - <C>_TARGET names the 'make' target that should depend on creating the output
#   files. Setting this variable is optional; if unset, we preprocess the
#   files for the 'libs' target.

# preprocess_file_template defines preprocessing rules.
# $(call preprocess_file_template, source_file, output_file,
#                                  makefile_target, extra_flags)
define preprocess_file_template
$(2): $(1) $$(GLOBAL_DEPS)
	$$(RM) "$$@"
	$$(PYTHON) $$(MOZILLA_DIR)/config/Preprocessor.py $(4) $$(DEFINES) $$(ACDEFINES) $$(XULPPFLAGS) "$$<" -o "$$@"
$(3):: $(2)
endef

$(foreach category,$(PP_TARGETS),						\
  $(foreach file,$($(category)),						\
    $(eval $(call preprocess_file_template,					\
                  $(file),							\
                  $(or $($(category)_PATH),$(CURDIR))/$(notdir $(file:.in=)),	\
                  $(or $($(category)_TARGET),libs),				\
                  $($(category)_FLAGS)))					\
   )										\
 )

################################################################################
# Special gmake rules.
################################################################################


#
# Disallow parallel builds with MSVC < 8
#
ifneq (,$(filter 1200 1300 1310,$(_MSC_VER)))
.NOTPARALLEL:
endif

#
# Re-define the list of default suffixes, so gmake won't have to churn through
# hundreds of built-in suffix rules for stuff we don't need.
#
.SUFFIXES:

#
# Fake targets.  Always run these rules, even if a file/directory with that
# name already exists.
#
.PHONY: all alltags boot checkout chrome realchrome clean clobber clobber_all export install libs makefiles realclean run_apprunner tools $(DIRS) $(TOOL_DIRS) FORCE

# Used as a dependency to force targets to rebuild
FORCE:

# Delete target if error occurs when building target
.DELETE_ON_ERROR:

# Properly set LIBPATTERNS for the platform
.LIBPATTERNS = $(if $(IMPORT_LIB_SUFFIX),$(LIB_PREFIX)%.$(IMPORT_LIB_SUFFIX)) $(LIB_PREFIX)%.$(LIB_SUFFIX) $(DLL_PREFIX)%$(DLL_SUFFIX)

tags: TAGS

TAGS: $(SUBMAKEFILES) $(CSRCS) $(CPPSRCS) $(wildcard *.h)
	-etags $(CSRCS) $(CPPSRCS) $(wildcard *.h)
	$(LOOP_OVER_PARALLEL_DIRS)
	$(LOOP_OVER_DIRS)

echo-variable-%:
	@echo "$($*)"

echo-tiers:
	@echo $(TIERS)

echo-tier-dirs:
	@$(foreach tier,$(TIERS),echo '$(tier):'; echo '  dirs: $(tier_$(tier)_dirs)'; echo '  staticdirs: $(tier_$(tier)_staticdirs)'; )

echo-dirs:
	@echo $(DIRS)

echo-module:
	@echo $(MODULE)

echo-depth-path:
	@$(MOZILLA_SRCDIR)/build/unix/print-depth-path.sh

echo-module-name:
	@$(MOZILLA_SRCDIR)/build/package/rpm/print-module-name.sh

echo-module-filelist:
	@$(MOZILLA_SRCDIR)/build/package/rpm/print-module-filelist.sh

showtargs:
ifneq (,$(filter $(PROGRAM) $(HOST_PROGRAM) $(SIMPLE_PROGRAMS) $(HOST_LIBRARY) $(LIBRARY) $(SHARED_LIBRARY),$(TARGETS)))
	@echo --------------------------------------------------------------------------------
	@echo "PROGRAM             = $(PROGRAM)"
	@echo "SIMPLE_PROGRAMS     = $(SIMPLE_PROGRAMS)"
	@echo "LIBRARY             = $(LIBRARY)"
	@echo "SHARED_LIBRARY      = $(SHARED_LIBRARY)"
	@echo "SHARED_LIBRARY_LIBS = $(SHARED_LIBRARY_LIBS)"
	@echo "LIBS                = $(LIBS)"
	@echo "DEF_FILE            = $(DEF_FILE)"
	@echo "IMPORT_LIBRARY      = $(IMPORT_LIBRARY)"
	@echo "STATIC_LIBS         = $(STATIC_LIBS)"
	@echo "SHARED_LIBS         = $(SHARED_LIBS)"
	@echo "EXTRA_DSO_LDOPTS    = $(EXTRA_DSO_LDOPTS)"
	@echo "DEPENDENT_LIBS      = $(DEPENDENT_LIBS)"
	@echo --------------------------------------------------------------------------------
endif
	$(LOOP_OVER_PARALLEL_DIRS)
	$(LOOP_OVER_DIRS)

showbuild:
	@echo "MOZ_BUILD_ROOT     = $(MOZ_BUILD_ROOT)"
	@echo "MOZ_WIDGET_TOOLKIT = $(MOZ_WIDGET_TOOLKIT)"
	@echo "CC                 = $(CC)"
	@echo "CXX                = $(CXX)"
	@echo "CCC                = $(CCC)"
	@echo "CPP                = $(CPP)"
	@echo "LD                 = $(LD)"
	@echo "AR                 = $(AR)"
	@echo "IMPLIB             = $(IMPLIB)"
	@echo "FILTER             = $(FILTER)"
	@echo "MKSHLIB            = $(MKSHLIB)"
	@echo "MKCSHLIB           = $(MKCSHLIB)"
	@echo "RC                 = $(RC)"
	@echo "CFLAGS             = $(CFLAGS)"
	@echo "OS_CFLAGS          = $(OS_CFLAGS)"
	@echo "COMPILE_CFLAGS     = $(COMPILE_CFLAGS)"
	@echo "CXXFLAGS           = $(CXXFLAGS)"
	@echo "OS_CXXFLAGS        = $(OS_CXXFLAGS)"
	@echo "COMPILE_CXXFLAGS   = $(COMPILE_CXXFLAGS)"
	@echo "COMPILE_CMFLAGS    = $(COMPILE_CMFLAGS)"
	@echo "COMPILE_CMMFLAGS   = $(COMPILE_CMMFLAGS)"
	@echo "LDFLAGS            = $(LDFLAGS)"
	@echo "OS_LDFLAGS         = $(OS_LDFLAGS)"
	@echo "DSO_LDOPTS         = $(DSO_LDOPTS)"
	@echo "OS_INCLUDES        = $(OS_INCLUDES)"
	@echo "OS_LIBS            = $(OS_LIBS)"
	@echo "EXTRA_LIBS         = $(EXTRA_LIBS)"
	@echo "BIN_FLAGS          = $(BIN_FLAGS)"
	@echo "INCLUDES           = $(INCLUDES)"
	@echo "DEFINES            = $(DEFINES)"
	@echo "ACDEFINES          = $(ACDEFINES)"
	@echo "BIN_SUFFIX         = $(BIN_SUFFIX)"
	@echo "LIB_SUFFIX         = $(LIB_SUFFIX)"
	@echo "DLL_SUFFIX         = $(DLL_SUFFIX)"
	@echo "IMPORT_LIB_SUFFIX  = $(IMPORT_LIB_SUFFIX)"
	@echo "INSTALL            = $(INSTALL)"

showhost:
	@echo "HOST_CC            = $(HOST_CC)"
	@echo "HOST_CXX           = $(HOST_CXX)"
	@echo "HOST_CFLAGS        = $(HOST_CFLAGS)"
	@echo "HOST_LDFLAGS       = $(HOST_LDFLAGS)"
	@echo "HOST_LIBS          = $(HOST_LIBS)"
	@echo "HOST_EXTRA_LIBS    = $(HOST_EXTRA_LIBS)"
	@echo "HOST_EXTRA_DEPS    = $(HOST_EXTRA_DEPS)"
	@echo "HOST_PROGRAM       = $(HOST_PROGRAM)"
	@echo "HOST_OBJS          = $(HOST_OBJS)"
	@echo "HOST_PROGOBJS      = $(HOST_PROGOBJS)"
	@echo "HOST_LIBRARY       = $(HOST_LIBRARY)"

showbuildmods::
	@echo "Build Modules	= $(BUILD_MODULES)"
	@echo "Module dirs	= $(BUILD_MODULE_DIRS)"

documentation:
	@cd $(DEPTH)
	$(DOXYGEN) $(DEPTH)/config/doxygen.cfg

ifdef ENABLE_TESTS
check:: $(SUBMAKEFILES) $(MAKE_DIRS)
	$(LOOP_OVER_PARALLEL_DIRS)
	$(LOOP_OVER_DIRS)
	$(LOOP_OVER_TOOL_DIRS)
endif


FREEZE_VARIABLES = \
  CSRCS \
  CPPSRCS \
  EXPORTS \
  DIRS \
  LIBRARY \
  MODULE \
  SHORT_LIBNAME \
  TIERS \
  EXTRA_COMPONENTS \
  EXTRA_PP_COMPONENTS \
  $(NULL)

$(foreach var,$(FREEZE_VARIABLES),$(eval $(var)_FROZEN := '$($(var))'))

CHECK_FROZEN_VARIABLES = $(foreach var,$(FREEZE_VARIABLES), \
  $(if $(subst $($(var)_FROZEN),,'$($(var))'),$(error Makefile variable '$(var)' changed value after including rules.mk. Was $($(var)_FROZEN), now $($(var)).)))

libs export::
	$(CHECK_FROZEN_VARIABLES)

default all::
	if test -d $(DIST)/bin ; then touch $(DIST)/bin/.purgecaches ; fi
