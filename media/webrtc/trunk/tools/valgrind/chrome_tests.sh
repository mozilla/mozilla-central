#!/bin/bash

# Copyright (c) 2011 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# Set up some paths and re-direct the arguments to chrome_tests.py

export THISDIR=`dirname $0`

TOOL_OPTION=0
# If --tool is omitted, default to --tool=memcheck
NEEDS_VALGRIND=1

# We need to set CHROME_VALGRIND iff using Memcheck or TSan-Valgrind:
#   tools/valgrind/chrome_tests.sh --tool memcheck
# or
#   tools/valgrind/chrome_tests.sh --tool=memcheck
# (same for "--tool=tsan")
for flag in $@
do
  if [ "$flag" == "--tool" ]
  then
    # Need to check that the next argument is either "memcheck" or "tsan".
    TOOL_OPTION=1
    NEEDS_VALGRIND=0
    continue
  elif [ "$flag" == "--tool=tsan" ]
  then
    NEEDS_VALGRIND=1
    break
  elif [ "$flag" == "--tool=memcheck" ]
  then
    NEEDS_VALGRIND=1
    break
  elif [ $(echo $flag | sed "s/=.*//") == "--tool" ]
  then
    # This is a non-Valgrind tool.
    NEEDS_VALGRIND=0
    break
  fi
  if [ "$TOOL_OPTION" == "1" ]
  then
    if [ "$flag" == "memcheck" ]
    then
      NEEDS_VALGRIND=1
      break
    elif [ "$flag" == "tsan" ]
    then
      NEEDS_VALGRIND=1
      break
    else
      TOOL_OPTION=0
    fi
  fi
done

if [ "$NEEDS_VALGRIND" == "1" ]
then
  CHROME_VALGRIND=`sh $THISDIR/locate_valgrind.sh`
  if [ "$CHROME_VALGRIND" = "" ]
  then
    # locate_valgrind.sh failed
    exit 1
  fi
  echo "Using valgrind binaries from ${CHROME_VALGRIND}"

  PATH="${CHROME_VALGRIND}/bin:$PATH"
  # We need to set these variables to override default lib paths hard-coded into
  # Valgrind binary.
  export VALGRIND_LIB="$CHROME_VALGRIND/lib/valgrind"
  export VALGRIND_LIB_INNER="$CHROME_VALGRIND/lib/valgrind"
fi

PYTHONPATH=$THISDIR/../python/google "$THISDIR/chrome_tests.py" "$@"
