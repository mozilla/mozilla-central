// Copyright (c) 2009 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file provides a <config.h> include for compiling libjingle.
// This file was generated using libjingle's autoconf utility.
// It fixes compilation in linux.

/* Chat archiving */
//#define FEATURE_ENABLE_CHAT_ARCHIVING 1

/* Enable SSL */
//#define FEATURE_ENABLE_SSL 1

/* voice mail */
//#define FEATURE_ENABLE_VOICEMAIL 1

/* Define to 1 if you have the <alsa/asoundlib.h> header file. */
/* #undef HAVE_ALSA_ASOUNDLIB_H */

/* Define to 1 if you have the <dlfcn.h> header file. */
#define HAVE_DLFCN_H 1

/* Have GIPS Voice Engine */
#define HAVE_GIPS 1

/* Glib is required for oRTP code */
/* #undef HAVE_GLIB */

/* Defined when we have ilbc codec lib */
/* #undef HAVE_ILBC */

/* Define to 1 if you have the <iLBC_decode.h> header file. */
/* #undef HAVE_ILBC_DECODE_H */

/* Define to 1 if you have the <inttypes.h> header file. */
#define HAVE_INTTYPES_H 1

/* Define to 1 if you have the <memory.h> header file. */
#define HAVE_MEMORY_H 1

/* Define if you have the <openssl/ssl.h> header file. */
#define HAVE_OPENSSL_SSL_H 1

/* Define if you have semtimedop() for SysV semaphares. */
#define HAVE_SEMTIMEDOP 1

/* has speex */
/* #undef HAVE_SPEEX */

/* Define to 1 if you have the <speex.h> header file. */
/* #undef HAVE_SPEEX_H */

/* Define to 1 if you have the <speex/speex.h> header file. */
/* #undef HAVE_SPEEX_SPEEX_H */

/* Define to 1 if you have the <stdint.h> header file. */
#define HAVE_STDINT_H 1

/* Define to 1 if you have the <stdlib.h> header file. */
#define HAVE_STDLIB_H 1

/* Define to 1 if you have the <strings.h> header file. */
#define HAVE_STRINGS_H 1

/* Define to 1 if you have the <string.h> header file. */
#define HAVE_STRING_H 1

/* Define to 1 if you have the <sys/stat.h> header file. */
#define HAVE_SYS_STAT_H 1

/* Define to 1 if you have the <sys/types.h> header file. */
#define HAVE_SYS_TYPES_H 1

/* Define to 1 if you have the <unistd.h> header file. */
#define HAVE_UNISTD_H 1

/* Building on Linux */
#define LINUX 1

/* Logging */
#define LOGGING 1

/* Building on OSX */
/* #undef OSX */

/* Name of package */
// #define PACKAGE "dist-zip"

/* Define to the address where bug reports for this package should be sent. */
// #define PACKAGE_BUGREPORT "google-talk-open@googlegroups.com"

/* Define to the full name of this package. */
// #define PACKAGE_NAME "libjingle"

/* Define to the full name and version of this package. */
// #define PACKAGE_STRING "libjingle 0.3.0"

/* Define to the one symbol short name of this package. */
// #define PACKAGE_TARNAME "libjingle"

/* Define to the version of this package. */
// #define PACKAGE_VERSION "0.3.0"

/* If we're using configure, we're on POSIX */
// #define POSIX 1

/* Build as a production build */
//#define PRODUCTION 1

/* Build as a production build */
//#define PRODUCTION_BUILD 1

/* Define to 1 if you have the ANSI C header files. */
#define STDC_HEADERS 1

/* Version number of package */
// #define VERSION ""

/* Defined when alsa support is enabled */
/* #undef __ALSA_ENABLED__ */
