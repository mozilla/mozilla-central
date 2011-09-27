/* Modified for use with yasm by Peter Johnson.
 * $Id: phash.h 2101 2008-05-23 06:46:51Z peter $
 */
/*
------------------------------------------------------------------------------
By Bob Jenkins, September 1996.
lookupa.h, a hash function for table lookup, same function as lookup.c.
Use this code in any way you wish.  Public Domain.  It has no warranty.
Source is http://burtleburtle.net/bob/c/lookupa.h
------------------------------------------------------------------------------
*/

#ifndef YASM_LIB_DECL
#define YASM_LIB_DECL
#endif

YASM_LIB_DECL
unsigned long phash_lookup(const char *k, size_t length,
                           unsigned long level);
YASM_LIB_DECL
void phash_checksum(const char *k, size_t length, unsigned long *state);
