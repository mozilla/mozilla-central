// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file overrides the inclusion of talk/base/basictypes.h to remove
// collisions with Chromium's base/basictypes.h.   We then add back a few
// items that Chromium's version doesn't provide, but libjingle expects.

#ifndef OVERRIDES_TALK_BASE_BASICTYPES_H__
#define OVERRIDES_TALK_BASE_BASICTYPES_H__

#include "base/basictypes.h"
#include "build/build_config.h"

#ifndef INT_TYPES_DEFINED
#define INT_TYPES_DEFINED
#ifdef COMPILER_MSVC
typedef __int64 int64;
#endif /* COMPILER_MSVC */

#ifdef COMPILER_MSVC
typedef unsigned __int64 uint64;
typedef __int64 int64;
#define INT64_C(x) x ## I64
#define UINT64_C(x) x ## UI64
#define INT64_F "I64"
#else
#ifndef INT64_C
#define INT64_C(x) x ## LL
#endif
#ifndef UINT64_C
#define UINT64_C(x) x ## ULL
#endif
#ifndef INT64_F
#define INT64_F "ll"
#endif
#endif /* COMPILER_MSVC */
#endif  // INT_TYPES_DEFINED

#ifdef WIN32
typedef int socklen_t;
#endif

namespace talk_base {
template<class T> inline T _min(T a, T b) { return (a > b) ? b : a; }
template<class T> inline T _max(T a, T b) { return (a < b) ? b : a; }

// For wait functions that take a number of milliseconds, kForever indicates
// unlimited time.
const int kForever = -1;
}

#ifdef WIN32
#define alignof(t) __alignof(t)
#else  // !WIN32
#define alignof(t) __alignof__(t)
#endif  // !WIN32
#define IS_ALIGNED(p, a) (0==(reinterpret_cast<uintptr_t>(p) & ((a)-1)))
#define ALIGNP(p, t) \
  (reinterpret_cast<uint8*>(((reinterpret_cast<uintptr_t>(p) + \
  ((t)-1)) & ~((t)-1))))

#endif // OVERRIDES_TALK_BASE_BASICTYPES_H__
