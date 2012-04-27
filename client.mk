# -*- makefile -*-
# vim:set ts=8 sw=8 sts=8 noet:
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
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Stephen Lamm
#   Benjamin Smedberg <bsmedberg@covad.net>
#   Chase Phillips <chase@mozilla.org>
#   Mark Mentovai <mark@moxienet.com>
#   Joey Armstrong <joey@mozilla.com>
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

# Build a mozilla application.
#
# To build a tree,
#    1. hg clone ssh://hg.mozilla.org/mozilla-central mozilla
#    2. cd mozilla
#    3. create your .mozconfig file with
#       ac_add_options --enable-application=browser
#    4. gmake -f client.mk
#
# Other targets (gmake -f client.mk [targets...]),
#    build
#    clean (realclean is now the same as clean)
#    distclean
#
# See http://developer.mozilla.org/en/docs/Build_Documentation for 
# more information.
#
# Options:
#   MOZ_BUILD_PROJECTS   - Build multiple projects in subdirectories
#                          of MOZ_OBJDIR
#   MOZ_OBJDIR           - Destination object directory
#   MOZ_MAKE_FLAGS       - Flags to pass to $(MAKE)
#   MOZ_PREFLIGHT_ALL  } - Makefiles to run before any project in
#   MOZ_PREFLIGHT      }   MOZ_BUILD_PROJECTS, before each project, after
#   MOZ_POSTFLIGHT     }   each project, and after all projects; these
#   MOZ_POSTFLIGHT_ALL }   variables contain space-separated lists
#   MOZ_UNIFY_BDATE      - Set to use the same bdate for each project in
#                          MOZ_BUILD_PROJECTS
#
#######################################################################
# Defines

comma := ,

CWD := $(CURDIR)
ifneq (1,$(words $(CWD)))
$(error The mozilla directory cannot be located in a path with spaces.)
endif

ifeq "$(CWD)" "/"
CWD   := /.
endif

ifndef TOPSRCDIR
ifeq (,$(wildcard client.mk))
TOPSRCDIR := $(patsubst %/,%,$(dir $(MAKEFILE_LIST)))
MOZ_OBJDIR = .
else
TOPSRCDIR := $(CWD)
endif
endif

# try to find autoconf 2.13 - discard errors from 'which'
# MacOS X 10.4 sends "no autoconf*" errors to stdout, discard those via grep
AUTOCONF ?= $(shell which autoconf-2.13 autoconf2.13 autoconf213 2>/dev/null | grep -v '^no autoconf' | head -1)

ifeq (,$(strip $(AUTOCONF)))
AUTOCONF=$(error Could not find autoconf 2.13)
endif

MKDIR := mkdir
SH := /bin/sh
PERL ?= perl
PYTHON ?= python

CONFIG_GUESS_SCRIPT := $(wildcard $(TOPSRCDIR)/build/autoconf/config.guess)
ifdef CONFIG_GUESS_SCRIPT
  CONFIG_GUESS = $(shell $(CONFIG_GUESS_SCRIPT))
endif


####################################
# Sanity checks

ifneq (,$(findstring mingw,$(CONFIG_GUESS)))
# check for CRLF line endings
ifneq (0,$(shell $(PERL) -e 'binmode(STDIN); while (<STDIN>) { if (/\r/) { print "1"; exit } } print "0"' < $(TOPSRCDIR)/client.mk))
$(error This source tree appears to have Windows-style line endings. To \
convert it to Unix-style line endings, run \
"python mozilla/build/win32/mozilla-dos2unix.py")
endif
endif

####################################
# Load mozconfig Options

# See build pages, http://www.mozilla.org/build/ for how to set up mozconfig.

MOZCONFIG_LOADER := build/autoconf/mozconfig2client-mk
MOZCONFIG_FINDER := build/autoconf/mozconfig-find 
MOZCONFIG_MODULES := build/unix/uniq.pl

run_for_side_effects := \
  $(shell $(TOPSRCDIR)/$(MOZCONFIG_LOADER) $(TOPSRCDIR) $(TOPSRCDIR)/.mozconfig.mk > $(TOPSRCDIR)/.mozconfig.out)

include $(TOPSRCDIR)/.mozconfig.mk

ifndef MOZ_OBJDIR
  MOZ_OBJDIR = obj-$(CONFIG_GUESS)
else
# On Windows Pymake builds check MOZ_OBJDIR doesn't start with "/"
  ifneq (,$(findstring mingw,$(CONFIG_GUESS)))
  ifeq (1_a,$(.PYMAKE)_$(firstword a$(subst /, ,$(MOZ_OBJDIR))))
  $(error For Windows Pymake builds, MOZ_OBJDIR must be a Windows [and not MSYS] style path.)
  endif
  endif
endif

ifdef MOZ_BUILD_PROJECTS

ifdef MOZ_CURRENT_PROJECT
  OBJDIR = $(MOZ_OBJDIR)/$(MOZ_CURRENT_PROJECT)
  MOZ_MAKE = $(MAKE) $(MOZ_MAKE_FLAGS) -C $(OBJDIR)
  BUILD_PROJECT_ARG = MOZ_BUILD_APP=$(MOZ_CURRENT_PROJECT)
else
  OBJDIR = $(error Cannot find the OBJDIR when MOZ_CURRENT_PROJECT is not set.)
  MOZ_MAKE = $(error Cannot build in the OBJDIR when MOZ_CURRENT_PROJECT is not set.)
endif

else # MOZ_BUILD_PROJECTS

OBJDIR = $(MOZ_OBJDIR)
MOZ_MAKE = $(MAKE) $(MOZ_MAKE_FLAGS) -C $(OBJDIR)

endif # MOZ_BUILD_PROJECTS

# 'configure' scripts generated by autoconf.
CONFIGURES := $(TOPSRCDIR)/configure
CONFIGURES += $(TOPSRCDIR)/js/src/configure

# Make targets that are going to be passed to the real build system
OBJDIR_TARGETS = install export libs clean realclean distclean alldep maybe_clobber_profiledbuild upload sdk installer package package-compare stage-package source-package l10n-check

#######################################################################
# Rules

# The default rule is build
build::
	$(MAKE) -f $(TOPSRCDIR)/client.mk $(if $(MOZ_PGO),profiledbuild,realbuild)


# Print out any options loaded from mozconfig.
all realbuild clean depend distclean export libs install realclean::
	@if test -f .mozconfig.out; then \
	  cat .mozconfig.out; \
	  rm -f .mozconfig.out; \
	else true; \
	fi

# Windows equivalents
build_all: build
build_all_dep: alldep
build_all_depend: alldep
clobber clobber_all: clean

# Do everything from scratch
everything: clean build

####################################
# Profile-Guided Optimization
#  To use this, you should set the following variables in your mozconfig
#    mk_add_options PROFILE_GEN_SCRIPT=/path/to/profile-script
#
#  The profile script should exercise the functionality to be included
#  in the profile feedback.
#
#  This is up here, outside of the MOZ_CURRENT_PROJECT logic so that this
#  is usable in multi-pass builds, where you might not have a runnable
#  application until all the build passes and postflight scripts have run.
ifdef MOZ_OBJDIR
  PGO_OBJDIR = $(MOZ_OBJDIR)
else
  PGO_OBJDIR := $(TOPSRCDIR)
endif

profiledbuild::
	$(MAKE) -f $(TOPSRCDIR)/client.mk realbuild MOZ_PROFILE_GENERATE=1 MOZ_PGO_INSTRUMENTED=1
	$(MAKE) -C $(PGO_OBJDIR) stage-package MOZ_PGO_INSTRUMENTED=1
	MOZ_PGO_INSTRUMENTED=1 OBJDIR=${PGO_OBJDIR} JARLOG_DIR=${PGO_OBJDIR}/jarlog/en-US $(PROFILE_GEN_SCRIPT)
	$(MAKE) -f $(TOPSRCDIR)/client.mk maybe_clobber_profiledbuild
	$(MAKE) -f $(TOPSRCDIR)/client.mk realbuild MOZ_PROFILE_USE=1

#####################################################
# Build date unification

ifdef MOZ_UNIFY_BDATE
ifndef MOZ_BUILD_DATE
ifdef MOZ_BUILD_PROJECTS
MOZ_BUILD_DATE = $(shell $(PYTHON) $(TOPSRCDIR)/toolkit/xre/make-platformini.py --print-buildid)
export MOZ_BUILD_DATE
endif
endif
endif

#####################################################
# Preflight, before building any project

realbuild alldep preflight_all::
ifeq (,$(MOZ_CURRENT_PROJECT)$(if $(MOZ_PREFLIGHT_ALL),,1))
# Don't run preflight_all for individual projects in multi-project builds
# (when MOZ_CURRENT_PROJECT is set.)
ifndef MOZ_BUILD_PROJECTS
# Building a single project, OBJDIR is usable.
	set -e; \
	for mkfile in $(MOZ_PREFLIGHT_ALL); do \
	  $(MAKE) -f $(TOPSRCDIR)/$$mkfile preflight_all TOPSRCDIR=$(TOPSRCDIR) OBJDIR=$(OBJDIR) MOZ_OBJDIR=$(MOZ_OBJDIR); \
	done
else
# OBJDIR refers to the project-specific OBJDIR, which is not available at
# this point when building multiple projects.  Only MOZ_OBJDIR is available.
	set -e; \
	for mkfile in $(MOZ_PREFLIGHT_ALL); do \
	  $(MAKE) -f $(TOPSRCDIR)/$$mkfile preflight_all TOPSRCDIR=$(TOPSRCDIR) MOZ_OBJDIR=$(MOZ_OBJDIR) MOZ_BUILD_PROJECTS="$(MOZ_BUILD_PROJECTS)"; \
	done
endif
endif

# If we're building multiple projects, but haven't specified which project,
# loop through them.

ifeq (,$(MOZ_CURRENT_PROJECT)$(if $(MOZ_BUILD_PROJECTS),,1))
configure depend realbuild preflight postflight $(OBJDIR_TARGETS)::
	set -e; \
	for app in $(MOZ_BUILD_PROJECTS); do \
	  $(MAKE) -f $(TOPSRCDIR)/client.mk $@ MOZ_CURRENT_PROJECT=$$app; \
	done

else

# MOZ_CURRENT_PROJECT: either doing a single-project build, or building an
# individual project in a multi-project build.

####################################
# Configure

MAKEFILE      = $(wildcard $(OBJDIR)/Makefile)
CONFIG_STATUS = $(wildcard $(OBJDIR)/config.status)
CONFIG_CACHE  = $(wildcard $(OBJDIR)/config.cache)

EXTRA_CONFIG_DEPS := \
	$(TOPSRCDIR)/aclocal.m4 \
	$(wildcard $(TOPSRCDIR)/build/autoconf/*.m4) \
	$(TOPSRCDIR)/js/src/aclocal.m4 \
	$(wildcard $(TOPSRCDIR)/media/webrtc/build/autoconf/*.m4) \
	$(TOPSRCDIR)/media/webrtc/signaling/signaling.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/test/metrics.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/test/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/peerconnection.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/src/common_video/common_video.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/src/common_video/libyuv/libyuv.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/common_video/jpeg/jpeg.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/voice_engine/voice_engine.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/src/voice_engine/main/test/voice_engine_tests.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/voice_engine/main/source/voice_engine_core.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/video_engine/test/auto_test/vie_auto_test.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/video_engine/test/libvietest/libvietest.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/video_engine/video_engine_core.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/video_engine/video_engine.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/src/video_engine/main/test/WindowsTest/windowstest.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_device/main/source/audio_device.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/modules.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_processing/aec/aec.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_processing/apm_tests.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_processing/audio_processing.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_processing/aecm/aecm.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_processing/agc/agc.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_processing/utility/util.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_processing/ns/ns.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/udp_transport/source/udp_transport.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/cng/cng.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/g711/g711.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/pcm16b/pcm16b.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/ilbc/ilbc.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/iSAC/isac_test.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/iSAC/fix/source/isacfix.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/iSAC/isacfix_test.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/iSAC/main/source/isac.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/codecs/g722/g722.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/neteq/neteq.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_coding/main/source/audio_coding_module.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_render/main/source/video_render.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/media_file/source/media_file.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_processing/main/test/vpm_tests.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_processing/main/source/video_processing.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_coding/codecs/vp8/main/source/vp8.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_coding/codecs/test/video_codecs_test_framework.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_coding/codecs/tools/video_codecs_tools.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_coding/codecs/i420/main/source/i420.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_coding/codecs/test_framework/test_framework.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_coding/main/source/video_coding.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_coding/main/source/video_coding_test.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/video_capture/main/source/video_capture.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/audio_conference_mixer/source/audio_conference_mixer.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/rtp_rtcp/test/bwe_standalone.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/rtp_rtcp/test/testAPI/test_api.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/rtp_rtcp/test/testFec/test_fec.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/rtp_rtcp/test/test_bwe/test_bwe.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/rtp_rtcp/source/rtp_rtcp.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/rtp_rtcp/source/rtp_rtcp_tests.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/modules/utility/source/utility.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/build/merge_libs.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/src/build/protoc.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/build/common.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/common_audio/vad/vad.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/common_audio/signal_processing/signal_processing.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/common_audio/common_audio.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/src/common_audio/resampler/resampler.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/supplement.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/src/system_wrappers/source/system_wrappers.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/module/src/module.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/hello/hello.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/hello/hello2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/link-objects/link-objects.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/additional-targets/src/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/additional-targets/src/dir1/actions.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/intermediate_dir/src/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/intermediate_dir/src/test2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/make/dependencies.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/make/noload/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/make/noload/lib/shared.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/same-gyp-name/src/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/same-gyp-name/src/subdir1/executable.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/same-gyp-name/src/subdir2/executable.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/basics/configurations.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/inheritance/configurations.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/target_platform/configurations.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/dependencies.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/libraries.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/target_name.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/type.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/sources.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/all_dependent_settings.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/link_settings.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/direct_dependent_settings.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/configurations.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/invalid/actions.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/configurations/x64/configurations.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions-multiple/src/actions.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/restat/src/restat.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/multiple-targets/src/multiple.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules-variables/src/variables.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/subdirectory/src/prog1.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/subdirectory/src/subdir/prog2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/subdirectory/src/subdir/subdir2/prog3.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/subdirectory/src/symroot.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/copies/src/copies-slash.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/copies/src/copies.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/toplevel-dir/src/sub2/prog2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/toplevel-dir/src/sub1/main.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/dependencies/b/b.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/dependencies/none_traversal.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/dependencies/extra_targets.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/dependencies/lib_only.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/dependencies/c/c.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/assembly/src/assembly.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/subdir1/executable.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/subdir2/none.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/subdir2/never_used.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/subdir2/no_inputs.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/input-root.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/subdir3/executable2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/subdir4/build-asm.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/actions.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules/src/external/external.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/product/product.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/defines-escaping/defines-escaping.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/builddir/src/subdir2/prog2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/builddir/src/subdir2/subdir3/prog3.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/builddir/src/subdir2/subdir3/subdir4/subdir5/prog5.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/builddir/src/subdir2/subdir3/subdir4/prog4.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/builddir/src/prog1.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/builddir/src/builddir.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/src/subdir2/prog2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/src/subdir2/deeper/deeper.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/src/prog1.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/src/subdir3/prog3.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/src/symroot.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/copies/copies.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/copies/subdir/subdir.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/rules/subdir1/executable.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/rules/subdir2/none.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/rules/rules.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/actions/subdir1/executable.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/actions/subdir2/none.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/generator-output/actions/actions.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/sibling/src/prog1/prog1.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/sibling/src/build/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/sibling/src/prog2/prog2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/include_dirs/src/subdir/subdir_includes.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/include_dirs/src/includes.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/msvs/express/base/base.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/msvs/express/express.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/msvs/precompiled/hello.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/msvs/list_excluded/hello_exclude.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/msvs/uldi2010/hello.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/same-name/src/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/exclusion/exclusion.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/filelist/filelist.gyp.stdout \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/filelist/src/filelist.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/filelist/filelist.gypd.golden \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands.gyp.ignore-env.stdout \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands-repeated.gyp.stdout \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands-repeated.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands.gypd.golden \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands.gyp.stdout \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variables/commands/commands-repeated.gypd.golden \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/ninja/action_dependencies/src/action_dependencies.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/scons_tools/tools.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/no-output/src/nooutput.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/same-target-name/src/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/same-target-name/src/executable1.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/same-target-name/src/executable2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/cxxflags/cxxflags.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/variants/src/variants.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/hard_dependency/src/hard_dependency.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions-bare/src/bare.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions-subdir/src/none.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions-subdir/src/subdir/subdir.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/dependency-copy/src/copies.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/home_dot_gyp/src/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/home_dot_gyp/home2/.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/home_dot_gyp/home2/.gyp/include.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/home_dot_gyp/home/.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/home_dot_gyp/home/.gyp/include.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/loadable-module/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/strip/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/action-envvars/action/action.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/prefixheader/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/postbuilds/subdirectory/nested_target.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/postbuilds/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/postbuild-multiple-configurations/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/postbuild-static-library/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/xcode-env-order/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/infoplist-process/test1.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/infoplist-process/test3.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/infoplist-process/test2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/copy-dylib/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/libraries/subdir/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/depend-on-bundle/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/postbuild-copy-bundle/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/rebuild/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/app-bundle/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/type_envvars/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/postbuild-defaults/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/gyptest-postbuild-static-library.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/gyptest-sourceless-module.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/global-settings/src/dir1/dir1.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/global-settings/src/dir2/dir2.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/sourceless-module/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/postbuild-fail/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/framework/framework.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/debuginfo/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/mac/non-strs-flattened-to-env/test.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules-dirname/src/subdir/input-rule-dirname.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules-dirname/src/actions.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/rules-rebuild/src/same_target.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/library/src/shared_dependency.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/library/src/library.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions/src/subdir1/executable.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions/src/subdir2/none.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions/src/subdir3/null_input.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions/src/action_missing_name.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/actions/src/actions.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/toolsets/toolsets.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/compilable/src/headers.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/defines/defines-env.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/defines/defines.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/relative/foo/a/a.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/relative/foo/a/c/c.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/relative/foo/b/b.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/tools/gyp/test/cflags/cflags.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/all.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/grit_action.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/all_android.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/grit_target.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/use_skia_on_mac.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/util/build_util.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/filename_rules.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/linux/system.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/json_schema_compile.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/temp_gyp/googleurl.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/temp_gyp/pdfsqueeze.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/protoc.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/some.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/build/win_precompile.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/common.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/release.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/internal/release_impl_official.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/internal/release_defaults.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/internal/release_impl.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/nocompile.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/build/android/system.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/testing/gmock.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/testing/gtest.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libsrtp/libsrtp.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/expat/expat.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libjingle/libjingle.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/jsoncpp/jsoncpp.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/protobuf/protobuf.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libjpeg_turbo/libjpeg.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libjpeg/libjpeg.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/yasm/yasm.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/yasm/yasm_compile.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/google-gflags/google-gflags.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libvpx/libvpx.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libvpx/libvpx_srcs_x86_64.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libvpx/libvpx_srcs_arm_neon.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libvpx/libvpx_srcs_arm.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libvpx/libvpx_srcs_x86.gypi \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libyuv/libyuv.gyp \
	$(TOPSRCDIR)/media/webrtc/trunk/third_party/libyuv/libyuv_test.gyp \
	$(NULL)

$(CONFIGURES): %: %.in $(EXTRA_CONFIG_DEPS)
	@$(PYTHON) $(TOPSRCDIR)/js/src/config/check-sync-dirs.py $(TOPSRCDIR)/js/src/build $(TOPSRCDIR)/build
	@echo Generating $@ using autoconf
	cd $(@D); $(AUTOCONF)

CONFIG_STATUS_DEPS := \
	$(wildcard $(CONFIGURES)) \
	$(TOPSRCDIR)/allmakefiles.sh \
	$(wildcard $(TOPSRCDIR)/nsprpub/configure) \
	$(wildcard $(TOPSRCDIR)/config/milestone.txt) \
	$(wildcard $(TOPSRCDIR)/js/src/config/milestone.txt) \
	$(wildcard $(TOPSRCDIR)/browser/config/version.txt) \
	$(wildcard $(addsuffix confvars.sh,$(wildcard $(TOPSRCDIR)/*/))) \
	$(NULL)

CONFIGURE_ENV_ARGS += \
  MAKE="$(MAKE)" \
  $(NULL)

# configure uses the program name to determine @srcdir@. Calling it without
#   $(TOPSRCDIR) will set @srcdir@ to "."; otherwise, it is set to the full
#   path of $(TOPSRCDIR).
ifeq ($(TOPSRCDIR),$(OBJDIR))
  CONFIGURE = ./configure
else
  CONFIGURE = $(TOPSRCDIR)/configure
endif

configure-files: $(CONFIGURES)

configure:: configure-files
ifdef MOZ_BUILD_PROJECTS
	@if test ! -d $(MOZ_OBJDIR); then $(MKDIR) $(MOZ_OBJDIR); else true; fi
endif
	@if test ! -d $(OBJDIR); then $(MKDIR) $(OBJDIR); else true; fi
	@echo cd $(OBJDIR);
	@echo $(CONFIGURE) $(CONFIGURE_ARGS)
	@cd $(OBJDIR) && $(BUILD_PROJECT_ARG) $(CONFIGURE_ENV_ARGS) $(CONFIGURE) $(CONFIGURE_ARGS) \
	  || ( echo "*** Fix above errors and then restart with\
               \"$(MAKE) -f client.mk build\"" && exit 1 )
	@touch $(OBJDIR)/Makefile

ifneq (,$(MAKEFILE))
$(OBJDIR)/Makefile: $(OBJDIR)/config.status

$(OBJDIR)/config.status: $(CONFIG_STATUS_DEPS)
else
$(OBJDIR)/Makefile: $(CONFIG_STATUS_DEPS)
endif
	@$(MAKE) -f $(TOPSRCDIR)/client.mk configure

ifneq (,$(CONFIG_STATUS))
$(OBJDIR)/config/autoconf.mk: $(TOPSRCDIR)/config/autoconf.mk.in
	cd $(OBJDIR); \
	  CONFIG_FILES=config/autoconf.mk ./config.status
endif


####################################
# Depend

depend:: $(OBJDIR)/Makefile $(OBJDIR)/config.status
	$(MOZ_MAKE) export && $(MOZ_MAKE) depend

####################################
# Preflight

realbuild alldep preflight::
ifdef MOZ_PREFLIGHT
	set -e; \
	for mkfile in $(MOZ_PREFLIGHT); do \
	  $(MAKE) -f $(TOPSRCDIR)/$$mkfile preflight TOPSRCDIR=$(TOPSRCDIR) OBJDIR=$(OBJDIR) MOZ_OBJDIR=$(MOZ_OBJDIR); \
	done
endif

####################################
# Build it

realbuild::  $(OBJDIR)/Makefile $(OBJDIR)/config.status
	@$(PYTHON) $(TOPSRCDIR)/js/src/config/check-sync-dirs.py $(TOPSRCDIR)/js/src/config $(TOPSRCDIR)/config
	$(MOZ_MAKE)

####################################
# Other targets

# Pass these target onto the real build system
$(OBJDIR_TARGETS):: $(OBJDIR)/Makefile $(OBJDIR)/config.status
	$(MOZ_MAKE) $@

####################################
# Postflight

realbuild alldep postflight::
ifdef MOZ_POSTFLIGHT
	set -e; \
	for mkfile in $(MOZ_POSTFLIGHT); do \
	  $(MAKE) -f $(TOPSRCDIR)/$$mkfile postflight TOPSRCDIR=$(TOPSRCDIR) OBJDIR=$(OBJDIR) MOZ_OBJDIR=$(MOZ_OBJDIR); \
	done
endif

endif # MOZ_CURRENT_PROJECT

####################################
# Postflight, after building all projects

realbuild alldep postflight_all::
ifeq (,$(MOZ_CURRENT_PROJECT)$(if $(MOZ_POSTFLIGHT_ALL),,1))
# Don't run postflight_all for individual projects in multi-project builds
# (when MOZ_CURRENT_PROJECT is set.)
ifndef MOZ_BUILD_PROJECTS
# Building a single project, OBJDIR is usable.
	set -e; \
	for mkfile in $(MOZ_POSTFLIGHT_ALL); do \
	  $(MAKE) -f $(TOPSRCDIR)/$$mkfile postflight_all TOPSRCDIR=$(TOPSRCDIR) OBJDIR=$(OBJDIR) MOZ_OBJDIR=$(MOZ_OBJDIR); \
	done
else
# OBJDIR refers to the project-specific OBJDIR, which is not available at
# this point when building multiple projects.  Only MOZ_OBJDIR is available.
	set -e; \
	for mkfile in $(MOZ_POSTFLIGHT_ALL); do \
	  $(MAKE) -f $(TOPSRCDIR)/$$mkfile postflight_all TOPSRCDIR=$(TOPSRCDIR) MOZ_OBJDIR=$(MOZ_OBJDIR) MOZ_BUILD_PROJECTS="$(MOZ_BUILD_PROJECTS)"; \
	done
endif
endif

cleansrcdir:
	@cd $(TOPSRCDIR); \
	if [ -f Makefile ]; then \
	  $(MAKE) distclean ; \
	else \
	  echo "Removing object files from srcdir..."; \
	  rm -fr `find . -type d \( -name .deps -print -o -name CVS \
	          -o -exec test ! -d {}/CVS \; \) -prune \
	          -o \( -name '*.[ao]' -o -name '*.so' \) -type f -print`; \
	   build/autoconf/clean-config.sh; \
	fi;

echo-variable-%:
	@echo $($*)

# This makefile doesn't support parallel execution. It does pass
# MOZ_MAKE_FLAGS to sub-make processes, so they will correctly execute
# in parallel.
.NOTPARALLEL:

.PHONY: checkout real_checkout depend realbuild build profiledbuild cleansrcdir pull_all build_all clobber clobber_all pull_and_build_all everything configure preflight_all preflight postflight postflight_all $(OBJDIR_TARGETS)
