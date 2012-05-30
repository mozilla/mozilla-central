/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKCONFIG_
#define _MORKCONFIG_ 1

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

// { %%%%% begin debug mode options in Mork %%%%%
#define MORK_DEBUG 1
// } %%%%% end debug mode options in Mork %%%%%

#ifdef MORK_DEBUG
#define MORK_MAX_CODE_COMPILE 1
#endif

// { %%%%% begin platform defs peculiar to Mork %%%%%

#ifdef XP_MACOSX
#define MORK_MAC 1
#endif

#ifdef XP_OS2
#define MORK_OS2 1
#endif

#ifdef XP_WIN
#define MORK_WIN 1
#endif

#ifdef XP_UNIX
#define MORK_UNIX 1
#endif

// } %%%%% end platform defs peculiar to Mork %%%%%

#if defined(MORK_WIN) || defined(MORK_UNIX) || defined(MORK_MAC) || defined(MORK_OS2)
#include <stdio.h> 
#include <ctype.h> 
#include <errno.h> 
#include <string.h> 
#ifdef HAVE_MEMORY_H
#include <memory.h> 
#endif
#ifdef HAVE_UNISTD_H
#include <unistd.h>  /* for SEEK_SET, SEEK_END */
#endif

#include "nsDebug.h" 

#define MORK_ISPRINT(c) isprint(c) 

#define MORK_FILETELL(file) ftell(file) 
#define MORK_FILESEEK(file, where, how) fseek(file, where, how) 
#define MORK_FILEREAD(outbuf, insize, file) fread(outbuf, 1, insize, file) 
#if defined(MORK_WIN)
void mork_fileflush(FILE * file);
#define MORK_FILEFLUSH(file) mork_fileflush(file) 
#else
#define MORK_FILEFLUSH(file) fflush(file) 
#endif /*MORK_WIN*/

#if defined(MORK_OS2)
FILE* mork_fileopen(const char* name, const char* mode);
#define MORK_FILEOPEN(file, how) mork_fileopen(file, how) 
#else
#define MORK_FILEOPEN(file, how) fopen(file, how) 
#endif
#define MORK_FILECLOSE(file) fclose(file) 
#endif /*MORK_WIN*/

/* ===== separating switchable features ===== */

#define MORK_ENABLE_ZONE_ARENAS 1 /* using morkZone for pooling */

//#define MORK_ENABLE_PROBE_MAPS 1 /* use smaller hash tables */

#define MORK_BEAD_OVER_NODE_MAPS 1 /* use bead not node maps */

/* ===== pooling ===== */

#if defined(HAVE_64BIT_OS)
#define MORK_CONFIG_ALIGN_8 1 /* must have 8 byte alignment */
#else
#define MORK_CONFIG_PTR_SIZE_4 1 /* sizeof(void*) == 4 */
#endif

// #define MORK_DEBUG_HEAP_STATS 1 /* analyze per-block heap usage */

/* ===== ===== ===== ===== line characters ===== ===== ===== ===== */
#define mork_kCR 0x0D
#define mork_kLF 0x0A
#define mork_kVTAB '\013'
#define mork_kFF '\014'
#define mork_kTAB '\011'
#define mork_kCRLF "\015\012"     /* A CR LF equivalent string */

#if defined(MORK_MAC)
#  define mork_kNewline             "\015"
#  define mork_kNewlineSize 1
#else
#  if defined(MORK_WIN) || defined(MORK_OS2)
#    define mork_kNewline           "\015\012"
#    define mork_kNewlineSize       2
#  else
#    if defined(MORK_UNIX)
#      define mork_kNewline         "\012"
#      define mork_kNewlineSize     1
#    endif /* MORK_UNIX */
#  endif /* MORK_WIN */
#endif /* MORK_MAC */

// { %%%%% begin assertion macro %%%%%
extern void mork_assertion_signal(const char* inMessage);
#define MORK_ASSERTION_SIGNAL(Y) mork_assertion_signal(Y)
#define MORK_ASSERT(X) if (!(X)) MORK_ASSERTION_SIGNAL(#X)
// } %%%%% end assertion macro %%%%%

#define MORK_LIB(return) return /*API return declaration*/
#define MORK_LIB_IMPL(return) return /*implementation return declaration*/

// { %%%%% begin standard c utility methods %%%%%

#if defined(MORK_WIN) || defined(MORK_UNIX) || defined(MORK_MAC) || defined(MORK_OS2)
#define MORK_USE_C_STDLIB 1
#endif /*MORK_WIN*/

#ifdef MORK_USE_C_STDLIB
#define MORK_MEMCMP(src1,src2,size)  memcmp(src1,src2,size)
#define MORK_MEMCPY(dest,src,size)   memcpy(dest,src,size)
#define MORK_MEMMOVE(dest,src,size)  memmove(dest,src,size)
#define MORK_MEMSET(dest,byte,size)  memset(dest,byte,size)
#define MORK_STRCPY(dest,src)        strcpy(dest,src)
#define MORK_STRCMP(one,two)         strcmp(one,two)
#define MORK_STRNCMP(one,two,length) strncmp(one,two,length)
#define MORK_STRLEN(string)          strlen(string)
#endif /*MORK_USE_C_STDLIB*/

#ifdef MORK_PROVIDE_STDLIB
MORK_LIB(mork_i4) mork_memcmp(const void* a, const void* b, mork_size inSize);
MORK_LIB(void) mork_memcpy(void* dst, const void* src, mork_size inSize);
MORK_LIB(void) mork_memmove(void* dst, const void* src, mork_size inSize);
MORK_LIB(void) mork_memset(void* dst, int inByte, mork_size inSize);
MORK_LIB(void) mork_strcpy(void* dst, const void* src);
MORK_LIB(mork_i4) mork_strcmp(const void* a, const void* b);
MORK_LIB(mork_i4) mork_strncmp(const void* a, const void* b, mork_size inSize);
MORK_LIB(mork_size) mork_strlen(const void* inString);

#define MORK_MEMCMP(src1,src2,size)  mork_memcmp(src1,src2,size)
#define MORK_MEMCPY(dest,src,size)   mork_memcpy(dest,src,size)
#define MORK_MEMMOVE(dest,src,size)  mork_memmove(dest,src,size)
#define MORK_MEMSET(dest,byte,size)  mork_memset(dest,byte,size)
#define MORK_STRCPY(dest,src)        mork_strcpy(dest,src)
#define MORK_STRCMP(one,two)         mork_strcmp(one,two)
#define MORK_STRNCMP(one,two,length) mork_strncmp(one,two,length)
#define MORK_STRLEN(string)          mork_strlen(string)
#endif /*MORK_PROVIDE_STDLIB*/

// } %%%%% end standard c utility methods %%%%%

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKCONFIG_ */

