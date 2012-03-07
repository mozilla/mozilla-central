/* jconfig.h.  Generated from jconfig.h.in by configure.  */
/* Version ID for the JPEG library.
 * Might be useful for tests like "#if JPEG_LIB_VERSION >= 60".
 */
#ifndef JPEG_LIB_VERSION
#define JPEG_LIB_VERSION 62
#endif /* JPEG_LIB_VERSION */

/* Support arithmetic encoding */
/* #undef C_ARITH_CODING_SUPPORTED */

/* Support arithmetic decoding */
/* #undef D_ARITH_CODING_SUPPORTED */

/* Define if your compiler supports prototypes */
#ifndef HAVE_PROTOTYPES
#define HAVE_PROTOTYPES 1
#endif /* HAVE_PROTOTYPES */

/* Define to 1 if you have the <stddef.h> header file. */
#ifndef HAVE_STDDEF_H 
#define HAVE_STDDEF_H 1
#endif /* HAVE_STDDEF_H */

/* Define to 1 if you have the <stdlib.h> header file. */
#ifndef HAVE_STDLIB_H
#define HAVE_STDLIB_H 1
#endif /* HAVE_STDLIB_H */

/* Define to 1 if the system has the type `unsigned char'. */
#ifndef HAVE_UNSIGNED_CHAR
#define HAVE_UNSIGNED_CHAR 1
#endif /* HAVE_UNSIGNED_CHAR */

/* Define to 1 if the system has the type `unsigned short'. */
#ifndef HAVE_UNSIGNED_SHORT
#define HAVE_UNSIGNED_SHORT 1
#endif /* HAVE_UNSIGNED_SHORT */

/* Define if you want use complete types */
/* #undef INCOMPLETE_TYPES_BROKEN */

/* How to obtain function inlining. */
#ifndef INLINE
#if defined(__GNUC__)
#define INLINE __attribute__((always_inline))
#elif defined(_MSC_VER)
#define INLINE __forceinline
#else
#define INLINE
#endif
#endif

/* Define if you have BSD-like bzero and bcopy */
/* #undef NEED_BSD_STRINGS */

/* Define if you need short function names */
/* #undef NEED_SHORT_EXTERNAL_NAMES */

/* Define if you have sys/types.h */
/* #undef NEED_SYS_TYPES_H */

/* Define if shift is unsigned */
/* #undef RIGHT_SHIFT_IS_UNSIGNED */

/* Use accelerated SIMD routines. */
#define WITH_SIMD 1

/* Define to 1 if type `char' is unsigned and you are not using gcc.  */
#ifndef __CHAR_UNSIGNED__
/* # undef __CHAR_UNSIGNED__ */
#endif

/* Define to empty if `const' does not conform to ANSI C. */
/* #undef const */

/* Define to `__inline__' or `__inline' if that's what the C compiler
   calls it, or to nothing if 'inline' is not supported under any name.  */
#ifndef __cplusplus
/* #undef inline */
#endif

/* Define to `unsigned int' if <sys/types.h> does not define. */
/* #undef size_t */
