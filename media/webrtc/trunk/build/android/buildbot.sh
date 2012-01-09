#!/bin/bash
# Copyright (c) 2011 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
#
# "compile and run tests" script for the android build of chromium.
# Intended for use by buildbot.
# At this time, we only have one bot which is both a builder and
# tester.  Script assumes it runs in the "build" directory.
#
# This script uses buildbot "Annotator" style for steps.
# This script does not sync the source tree.

set -e
set -x

# Options in this script.
BUILD_EXPERIMENTAL_TARGETS=1
RUN_TESTS=1
NEED_CLOBBER=0
JOBS=4   # make -j"${JOBS}"

# If we are a trybot, disable experimental targets and tests.  We
# eventually want tests on a trybot but emulator launch/restart is not
# reliable enough yet.
# TODO(jrg): when setting up a trybot, make sure to add TRYBOT=1 in
# the environment.
if [ "${TRYBOT:-0}" = 1 ] ; then
  echo "Disabling experimental builds and tests since we are a trybot."
  BUILD_EXPERIMENTAL_TARGETS=0
  RUN_TESTS=0
fi

echo "@@@BUILD_STEP cd into source root@@@"
SRC_ROOT=$(cd "$(dirname $0)/../.."; pwd)
cd $SRC_ROOT

echo "@@@BUILD_STEP Basic setup@@@"
export ANDROID_SDK_ROOT=/usr/local/google/android-sdk-linux_x86
export ANDROID_NDK_ROOT=/usr/local/google/android-ndk-r7
for mandatory_directory in "${ANDROID_SDK_ROOT}" "${ANDROID_NDK_ROOT}" ; do
  if [[ ! -d "${mandatory_directory}" ]]; then
    echo "Directory ${mandatory_directory} does not exist."
    echo "Build cannot continue."
    exit 1
  fi
done

if [ ! "$BUILDBOT_CLOBBER" = "" ]; then
  NEED_CLOBBER=1
fi

## Build and test steps

echo "@@@BUILD_STEP Configure with envsetup.sh@@@"
. build/android/envsetup.sh

if [ "$NEED_CLOBBER" -eq 1 ]; then
  echo "@@@BUILD_STEP Clobber@@@"
  rm -rf "${SRC_ROOT}"/out
fi

echo "@@@BUILD_STEP android_gyp@@@"
android_gyp

echo "@@@BUILD_STEP Compile@@@"
make -j${JOBS}

if [ "${BUILD_EXPERIMENTAL_TARGETS}" = 1 ] ; then
  # Linking DumpRenderTree appears to hang forever?
  # EXPERIMENTAL_TARGETS="DumpRenderTree webkit_unit_tests"
  EXPERIMENTAL_TARGETS="webkit_unit_tests"
  for target in ${EXPERIMENTAL_TARGETS} ; do
    echo "@@@BUILD_STEP Experimental Compile $target @@@"
    set +e
    make -j4 "${target}"
    if [ $? -ne 0 ] ; then
      echo "@@@STEP_WARNINGS@@@"
    fi
    set -e
  done
fi

if [ "${RUN_TESTS}" = 1 ] ; then
  echo "@@@BUILD_STEP Run Tests@@@"
  build/android/run_tests.py -e --xvfb --verbose
fi

exit 0
