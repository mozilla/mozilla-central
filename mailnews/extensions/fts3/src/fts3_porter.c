/*
** 2006 September 30
**
** The author disclaims copyright to this source code.  In place of
** a legal notice, here is a blessing:
**
**    May you do good and not evil.
**    May you find forgiveness for yourself and forgive others.
**    May you share freely, never taking more than you give.
**
*************************************************************************
** Implementation of the full-text-search tokenizer that implements
** a Porter stemmer.
**
*/

/*
 * This file is based on the SQLite FTS3 Porter Stemmer implementation.
 *
 * This is an attempt to provide some level of full-text search to users of
 *  Thunderbird who use languages that are not space/punctuation delimited.
 *  This is accomplished by performing bi-gram indexing of characters fall
 *  into the unicode space occupied by character sets used in such languages.
 *
 * Bi-gram indexing means that given the string "12345" we would index the
 *  pairs "12", "23", "34", and "45" (with position information).  We do this
 *  because we are not sure where the word/semantic boundaries are in that
 *  string.  Then, when a user searches for "234" the FTS3 engine tokenizes the
 *  search query into "23" and "34".  Using special phrase-logic FTS3 requires
 *  the matches to have the tokens "23" and "34" adjacent to each other and in
 *  that order.  In theory if the user searched for "2345" we we could just
 *  search for "23 NEAR/2 34".  Unfortunately, NEAR does not imply ordering,
 *  so even though that would be more efficient, we would lose correctness
 *  and cannot do it.
 *
 * The efficiency and usability of bi-gram search assumes that the character
 *  space is large enough and actually observed bi-grams sufficiently
 *  distributed throughout the potential space so that the search bi-grams
 *  generated when the user issues a query find a 'reasonable' number of
 *  documents for each bi-gram match.
 *
 * Mozilla contributors:
 *   Makoto Kato <m_kato@ga2.so-net.ne.jp>
 *   Andrew Sutherland <asutherland@asutherland.org>
 */

/*
** The code in this file is only compiled if:
**
**     * The FTS3 module is being built as an extension
**       (in which case SQLITE_CORE is not defined), or
**
**     * The FTS3 module is being built into the core of
**       SQLite (in which case SQLITE_ENABLE_FTS3 is defined).
*/
#if !defined(SQLITE_CORE) || defined(SQLITE_ENABLE_FTS3)


#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>

#include "fts3_tokenizer.h"

/* need some defined to compile without sqlite3 code */

#define sqlite3_malloc malloc
#define sqlite3_free free
#define sqlite3_realloc realloc

static const unsigned char sqlite3Utf8Trans1[] = {
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
  0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x00, 0x01, 0x02, 0x03, 0x00, 0x01, 0x00, 0x00,
};

/**
 * Helper from sqlite3.c to read a single UTF8 character.
 *
 * The clever bit with multi-byte reading is that you keep going until you find
 *  a byte whose top bits are not '10'.  A single-byte UTF8 character will have
 *  '00' or '01', and a multi-byte UTF8 character must start with '11'.
 *
 * In the event of illegal UTF-8 this macro may read an arbitrary number of
 *  characters but will never read past zTerm.  The resulting character value
 *  of illegal UTF-8 can be anything, although efforts are made to return the
 *  illegal character (0xfffd) for UTF-16 surrogates.
 *
 * @param zIn A pointer to the current position that is updated by the routine,
 *     pointing at the start of the next character when the routine returns.
 * @param zTerm A pointer one past the end of the buffer.
 * @param c The 'unsigned int' to hold the resulting character value.  Do not
 *      use a short or a char.
 */
#define READ_UTF8(zIn, zTerm, c)                           \
  c = *(zIn++);                                            \
  if( c>=0xc0 ){                                           \
    c = sqlite3Utf8Trans1[c-0xc0];                         \
    while( zIn!=zTerm && (*zIn & 0xc0)==0x80 ){            \
      c = (c<<6) + (0x3f & *(zIn++));                      \
    }                                                      \
    if( c<0x80                                             \
        || (c&0xFFFFF800)==0xD800                          \
        || (c&0xFFFFFFFE)==0xFFFE ){  c = 0xFFFD; }        \
  }

/* end of compatible block to complie codes */

/*
** Class derived from sqlite3_tokenizer
*/
typedef struct porter_tokenizer {
  sqlite3_tokenizer base;      /* Base class */
} porter_tokenizer;

/*
** Class derived from sqlit3_tokenizer_cursor
*/
typedef struct porter_tokenizer_cursor {
  sqlite3_tokenizer_cursor base;
  const char *zInput;          /* input we are tokenizing */
  int nInput;                  /* size of the input */
  int iOffset;                 /* current position in zInput */
  int iToken;                  /* index of next token to be returned */
  char *zToken;                /* storage for current token */
  int nAllocated;              /* space allocated to zToken buffer */
  /**
   * Store the offset of the second character in the bi-gram pair that we just
   *  emitted so that we can consider it being the first character in a bi-gram
   *  pair.
   * The value 0 indicates that there is no previous such character.  This is
   *  an acceptable sentinel value because the 0th offset can never be the
   *  offset of the second in a bi-gram pair.
   *
   * For example, let us say we are tokenizing a string of 4 CJK characters 
   *  represented by the byte-string "11223344" where each repeated digit
   *  indicates 2-bytes of storage used to encode the character in UTF-8.
   *  (It actually takes 3, btw.)  Then on the passes to emit each token,
   *  the iOffset and iPrevGigramOffset values at entry will be:
   *
   * 1122: iOffset = 0, iPrevBigramOffset = 0
   * 2233: iOffset = 4, iPrevBigramOffset = 2
   * 3344: iOffset = 6, iPrevBigramOffset = 4
   * (nothing will be emitted): iOffset = 8, iPrevBigramOffset = 6
   */
  int iPrevBigramOffset;       /* previous result was bi-gram */
} porter_tokenizer_cursor;


/* Forward declaration */
static const sqlite3_tokenizer_module porterTokenizerModule;


/*
** Create a new tokenizer instance.
*/
static int porterCreate(
  int argc, const char * const *argv,
  sqlite3_tokenizer **ppTokenizer
){
  porter_tokenizer *t;
  t = (porter_tokenizer *) sqlite3_malloc(sizeof(*t));
  if( t==NULL ) return SQLITE_NOMEM;
  memset(t, 0, sizeof(*t));
  *ppTokenizer = &t->base;
  return SQLITE_OK;
}

/*
** Destroy a tokenizer
*/
static int porterDestroy(sqlite3_tokenizer *pTokenizer){
  sqlite3_free(pTokenizer);
  return SQLITE_OK;
}

/*
** Prepare to begin tokenizing a particular string.  The input
** string to be tokenized is zInput[0..nInput-1].  A cursor
** used to incrementally tokenize this string is returned in 
** *ppCursor.
*/
static int porterOpen(
  sqlite3_tokenizer *pTokenizer,         /* The tokenizer */
  const char *zInput, int nInput,        /* String to be tokenized */
  sqlite3_tokenizer_cursor **ppCursor    /* OUT: Tokenization cursor */
){
  porter_tokenizer_cursor *c;

  c = (porter_tokenizer_cursor *) sqlite3_malloc(sizeof(*c));
  if( c==NULL ) return SQLITE_NOMEM;

  c->zInput = zInput;
  if( zInput==0 ){
    c->nInput = 0;
  }else if( nInput<0 ){
    c->nInput = (int)strlen(zInput);
  }else{
    c->nInput = nInput;
  }
  c->iOffset = 0;                 /* start tokenizing at the beginning */
  c->iToken = 0;
  c->zToken = NULL;               /* no space allocated, yet. */
  c->nAllocated = 0;
  c->iPrevBigramOffset = 0;

  *ppCursor = &c->base;
  return SQLITE_OK;
}

/*
** Close a tokenization cursor previously opened by a call to
** porterOpen() above.
*/
static int porterClose(sqlite3_tokenizer_cursor *pCursor){
  porter_tokenizer_cursor *c = (porter_tokenizer_cursor *) pCursor;
  sqlite3_free(c->zToken);
  sqlite3_free(c);
  return SQLITE_OK;
}
/*
** Vowel or consonant
*/
static const char cType[] = {
   0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0,
   1, 1, 1, 2, 1
};

/*
** isConsonant() and isVowel() determine if their first character in
** the string they point to is a consonant or a vowel, according
** to Porter ruls.  
**
** A consonate is any letter other than 'a', 'e', 'i', 'o', or 'u'.
** 'Y' is a consonant unless it follows another consonant,
** in which case it is a vowel.
**
** In these routine, the letters are in reverse order.  So the 'y' rule
** is that 'y' is a consonant unless it is followed by another
** consonent.
*/
static int isVowel(const char*);
static int isConsonant(const char *z){
  int j;
  char x = *z;
  if( x==0 ) return 0;
  assert( x>='a' && x<='z' );
  j = cType[x-'a'];
  if( j<2 ) return j;
  return z[1]==0 || isVowel(z + 1);
}
static int isVowel(const char *z){
  int j;
  char x = *z;
  if( x==0 ) return 0;
  assert( x>='a' && x<='z' );
  j = cType[x-'a'];
  if( j<2 ) return 1-j;
  return isConsonant(z + 1);
}

/*
** Let any sequence of one or more vowels be represented by V and let
** C be sequence of one or more consonants.  Then every word can be
** represented as:
**
**           [C] (VC){m} [V]
**
** In prose:  A word is an optional consonant followed by zero or
** vowel-consonant pairs followed by an optional vowel.  "m" is the
** number of vowel consonant pairs.  This routine computes the value
** of m for the first i bytes of a word.
**
** Return true if the m-value for z is 1 or more.  In other words,
** return true if z contains at least one vowel that is followed
** by a consonant.
**
** In this routine z[] is in reverse order.  So we are really looking
** for an instance of of a consonant followed by a vowel.
*/
static int m_gt_0(const char *z){
  while( isVowel(z) ){ z++; }
  if( *z==0 ) return 0;
  while( isConsonant(z) ){ z++; }
  return *z!=0;
}

/* Like mgt0 above except we are looking for a value of m which is
** exactly 1
*/
static int m_eq_1(const char *z){
  while( isVowel(z) ){ z++; }
  if( *z==0 ) return 0;
  while( isConsonant(z) ){ z++; }
  if( *z==0 ) return 0;
  while( isVowel(z) ){ z++; }
  if( *z==0 ) return 1;
  while( isConsonant(z) ){ z++; }
  return *z==0;
}

/* Like mgt0 above except we are looking for a value of m>1 instead
** or m>0
*/
static int m_gt_1(const char *z){
  while( isVowel(z) ){ z++; }
  if( *z==0 ) return 0;
  while( isConsonant(z) ){ z++; }
  if( *z==0 ) return 0;
  while( isVowel(z) ){ z++; }
  if( *z==0 ) return 0;
  while( isConsonant(z) ){ z++; }
  return *z!=0;
}

/*
** Return TRUE if there is a vowel anywhere within z[0..n-1]
*/
static int hasVowel(const char *z){
  while( isConsonant(z) ){ z++; }
  return *z!=0;
}

/*
** Return TRUE if the word ends in a double consonant.
**
** The text is reversed here. So we are really looking at
** the first two characters of z[].
*/
static int doubleConsonant(const char *z){
  return isConsonant(z) && z[0]==z[1] && isConsonant(z+1);
}

/*
** Return TRUE if the word ends with three letters which
** are consonant-vowel-consonent and where the final consonant
** is not 'w', 'x', or 'y'.
**
** The word is reversed here.  So we are really checking the
** first three letters and the first one cannot be in [wxy].
*/
static int star_oh(const char *z){
  return
    z[0]!=0 && isConsonant(z) &&
    z[0]!='w' && z[0]!='x' && z[0]!='y' &&
    z[1]!=0 && isVowel(z+1) &&
    z[2]!=0 && isConsonant(z+2);
}

/*
** If the word ends with zFrom and xCond() is true for the stem
** of the word that preceeds the zFrom ending, then change the 
** ending to zTo.
**
** The input word *pz and zFrom are both in reverse order.  zTo
** is in normal order. 
**
** Return TRUE if zFrom matches.  Return FALSE if zFrom does not
** match.  Not that TRUE is returned even if xCond() fails and
** no substitution occurs.
*/
static int stem(
  char **pz,             /* The word being stemmed (Reversed) */
  const char *zFrom,     /* If the ending matches this... (Reversed) */
  const char *zTo,       /* ... change the ending to this (not reversed) */
  int (*xCond)(const char*)   /* Condition that must be true */
){
  char *z = *pz;
  while( *zFrom && *zFrom==*z ){ z++; zFrom++; }
  if( *zFrom!=0 ) return 0;
  if( xCond && !xCond(z) ) return 1;
  while( *zTo ){
    *(--z) = *(zTo++);
  }
  *pz = z;
  return 1;
}

/*
** This is the fallback stemmer used when the porter stemmer is
** inappropriate.  The input word is copied into the output with
** US-ASCII case folding.  If the input word is too long (more
** than 20 bytes if it contains no digits or more than 6 bytes if
** it contains digits) then word is truncated to 20 or 6 bytes
** by taking 10 or 3 bytes from the beginning and end.
**
** Note:
** This is UTF-8 safe-ish.  If truncation occurs bytes can get mashed together
** in ways that produce illegal UTF-8.  The resulting mashed-up byte strings
** will not be directly exposed to the user and will not do anything dangerous,
** but could result in confusing behavior if queries using wildcard support
** ("*") are involved.  This is sufficiently harmless that we're not going to
** worry about it for now.
*/
static void copy_stemmer(const unsigned char *zIn, int nIn, char *zOut, int *pnOut){
  int i, mx, j;
  int hasDigit = 0;
  for(i=0; i<nIn; i++){
    int c = zIn[i];
    if( c>='A' && c<='Z' ){
      zOut[i] = c - 'A' + 'a';
    }else{
      if( c>='0' && c<='9' ) hasDigit = 1;
      zOut[i] = c;
    }
  }
  mx = hasDigit ? 3 : 10;
  if( nIn>mx*2 ){
    for(j=mx, i=nIn-mx; i<nIn; i++, j++){
      zOut[j] = zOut[i];
    }
    i = j;
  }
  zOut[i] = 0;
  *pnOut = i;
}


/*
** Stem the input word zIn[0..nIn-1].  Store the output in zOut.
** zOut is at least big enough to hold nIn bytes.  Write the actual
** size of the output word (exclusive of the '\0' terminator) into *pnOut.
**
** Any upper-case characters in the US-ASCII character set ([A-Z])
** are converted to lower case.  Upper-case UTF characters are
** unchanged.
**
** Words that are longer than about 20 bytes are stemmed by retaining
** a few bytes from the beginning and the end of the word.  If the
** word contains digits, 3 bytes are taken from the beginning and
** 3 bytes from the end.  For long words without digits, 10 bytes
** are taken from each end.  US-ASCII case folding still applies.
** 
** If the input word contains not digits but does characters not 
** in [a-zA-Z] then no stemming is attempted and this routine just 
** copies the input into the input into the output with US-ASCII
** case folding.
**
** Stemming never increases the length of the word.  So there is
** no chance of overflowing the zOut buffer.
*/
static void porter_stemmer(const unsigned char *zIn, unsigned int nIn, char *zOut, int *pnOut){
  unsigned int i, j, c;
  char zReverse[28];
  char *z, *z2;
  if( nIn<3 || nIn>=sizeof(zReverse)-7 ){
    /* The word is too big or too small for the porter stemmer.
    ** Fallback to the copy stemmer */
    copy_stemmer(zIn, nIn, zOut, pnOut);
    return;
  }
  for(i=0, j=sizeof(zReverse)-6; i<nIn; i++, j--){
    c = zIn[i];
    if( c>='A' && c<='Z' ){
      zReverse[j] = c + 'a' - 'A';
    }else if( c>='a' && c<='z' ){
      zReverse[j] = c;
    }else{
      /* The use of a character not in [a-zA-Z] means that we fallback
      ** to the copy stemmer */
      copy_stemmer(zIn, nIn, zOut, pnOut);
      return;
    }
  }
  memset(&zReverse[sizeof(zReverse)-5], 0, 5);
  z = &zReverse[j+1];


  /* Step 1a */
  if( z[0]=='s' ){
    if(
     !stem(&z, "sess", "ss", 0) &&
     !stem(&z, "sei", "i", 0)  &&
     !stem(&z, "ss", "ss", 0)
    ){
      z++;
    }
  }

  /* Step 1b */  
  z2 = z;
  if( stem(&z, "dee", "ee", m_gt_0) ){
    /* Do nothing.  The work was all in the test */
  }else if( 
     (stem(&z, "gni", "", hasVowel) || stem(&z, "de", "", hasVowel))
      && z!=z2
  ){
     if( stem(&z, "ta", "ate", 0) ||
         stem(&z, "lb", "ble", 0) ||
         stem(&z, "zi", "ize", 0) ){
       /* Do nothing.  The work was all in the test */
     }else if( doubleConsonant(z) && (*z!='l' && *z!='s' && *z!='z') ){
       z++;
     }else if( m_eq_1(z) && star_oh(z) ){
       *(--z) = 'e';
     }
  }

  /* Step 1c */
  if( z[0]=='y' && hasVowel(z+1) ){
    z[0] = 'i';
  }

  /* Step 2 */
  switch( z[1] ){
   case 'a':
     stem(&z, "lanoita", "ate", m_gt_0) ||
     stem(&z, "lanoit", "tion", m_gt_0);
     break;
   case 'c':
     stem(&z, "icne", "ence", m_gt_0) ||
     stem(&z, "icna", "ance", m_gt_0);
     break;
   case 'e':
     stem(&z, "rezi", "ize", m_gt_0);
     break;
   case 'g':
     stem(&z, "igol", "log", m_gt_0);
     break;
   case 'l':
     stem(&z, "ilb", "ble", m_gt_0) ||
     stem(&z, "illa", "al", m_gt_0) ||
     stem(&z, "iltne", "ent", m_gt_0) ||
     stem(&z, "ile", "e", m_gt_0) ||
     stem(&z, "ilsuo", "ous", m_gt_0);
     break;
   case 'o':
     stem(&z, "noitazi", "ize", m_gt_0) ||
     stem(&z, "noita", "ate", m_gt_0) ||
     stem(&z, "rota", "ate", m_gt_0);
     break;
   case 's':
     stem(&z, "msila", "al", m_gt_0) ||
     stem(&z, "ssenevi", "ive", m_gt_0) ||
     stem(&z, "ssenluf", "ful", m_gt_0) ||
     stem(&z, "ssensuo", "ous", m_gt_0);
     break;
   case 't':
     stem(&z, "itila", "al", m_gt_0) ||
     stem(&z, "itivi", "ive", m_gt_0) ||
     stem(&z, "itilib", "ble", m_gt_0);
     break;
  }

  /* Step 3 */
  switch( z[0] ){
   case 'e':
     stem(&z, "etaci", "ic", m_gt_0) ||
     stem(&z, "evita", "", m_gt_0)   ||
     stem(&z, "ezila", "al", m_gt_0);
     break;
   case 'i':
     stem(&z, "itici", "ic", m_gt_0);
     break;
   case 'l':
     stem(&z, "laci", "ic", m_gt_0) ||
     stem(&z, "luf", "", m_gt_0);
     break;
   case 's':
     stem(&z, "ssen", "", m_gt_0);
     break;
  }

  /* Step 4 */
  switch( z[1] ){
   case 'a':
     if( z[0]=='l' && m_gt_1(z+2) ){
       z += 2;
     }
     break;
   case 'c':
     if( z[0]=='e' && z[2]=='n' && (z[3]=='a' || z[3]=='e')  && m_gt_1(z+4)  ){
       z += 4;
     }
     break;
   case 'e':
     if( z[0]=='r' && m_gt_1(z+2) ){
       z += 2;
     }
     break;
   case 'i':
     if( z[0]=='c' && m_gt_1(z+2) ){
       z += 2;
     }
     break;
   case 'l':
     if( z[0]=='e' && z[2]=='b' && (z[3]=='a' || z[3]=='i') && m_gt_1(z+4) ){
       z += 4;
     }
     break;
   case 'n':
     if( z[0]=='t' ){
       if( z[2]=='a' ){
         if( m_gt_1(z+3) ){
           z += 3;
         }
       }else if( z[2]=='e' ){
         stem(&z, "tneme", "", m_gt_1) ||
         stem(&z, "tnem", "", m_gt_1) ||
         stem(&z, "tne", "", m_gt_1);
       }
     }
     break;
   case 'o':
     if( z[0]=='u' ){
       if( m_gt_1(z+2) ){
         z += 2;
       }
     }else if( z[3]=='s' || z[3]=='t' ){
       stem(&z, "noi", "", m_gt_1);
     }
     break;
   case 's':
     if( z[0]=='m' && z[2]=='i' && m_gt_1(z+3) ){
       z += 3;
     }
     break;
   case 't':
     stem(&z, "eta", "", m_gt_1) ||
     stem(&z, "iti", "", m_gt_1);
     break;
   case 'u':
     if( z[0]=='s' && z[2]=='o' && m_gt_1(z+3) ){
       z += 3;
     }
     break;
   case 'v':
   case 'z':
     if( z[0]=='e' && z[2]=='i' && m_gt_1(z+3) ){
       z += 3;
     }
     break;
  }

  /* Step 5a */
  if( z[0]=='e' ){
    if( m_gt_1(z+1) ){
      z++;
    }else if( m_eq_1(z+1) && !star_oh(z+1) ){
      z++;
    }
  }

  /* Step 5b */
  if( m_gt_1(z) && z[0]=='l' && z[1]=='l' ){
    z++;
  }

  /* z[] is now the stemmed word in reverse order.  Flip it back
  ** around into forward order and return.
  */
  *pnOut = i = strlen(z);
  zOut[i] = 0;
  while( *z ){
    zOut[--i] = *(z++);
  }
}

/**
 * Indicate whether characters in the 0x30 - 0x7f region can be part of a token.
 * Letters and numbers can; punctuation (and 'del') can't.
 */
static const char porterIdChar[] = {
/* x0 x1 x2 x3 x4 x5 x6 x7 x8 x9 xA xB xC xD xE xF */
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,  /* 3x */
    0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,  /* 4x */
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1,  /* 5x */
    0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,  /* 6x */
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0,  /* 7x */
};

/**
 * Test whether a character is a (non-ascii) space character or not.  isDelim
 *  uses the existing porter stemmer logic for anything in the ASCII (< 0x80)
 *  space which covers 0x20.
 *
 * 0x2000-0x206F is the general punctuation table.  0x2000 - 0x200b are spaces.
 *  The spaces 0x2000 - 0x200a are all defined as roughly equivalent to a
 *  standard 0x20 space.  0x200b is a "zero width space" (ZWSP) and not like an
 *  0x20 space.  0x202f is a narrow no-break space and roughly equivalent to an
 *  0x20 space.  0x205f is a "medium mathematical space" and defined as roughly
 *  equivalent to an 0x20 space.
 */
#define IS_UNI_SPACE(x) (((x)>=0x2000&&(x)<=0x200a) || (x)==0x202f || (x)==0x205f)
/**
 * What we are checking for:
 * - 0x3001: Ideographic comma (-> 0x2c ',')
 * - 0x3002: Ideographic full stop (-> 0x2e '.')
 * - 0xff0c: fullwidth comma (~ wide 0x2c ',')
 * - 0xff0e: fullwidth full stop (~ wide 0x2e '.')
 * - 0xff61: halfwidth ideographic full stop (~ narrow 0x3002)
 * - 0xff64: halfwidth ideographic comma (~ narrow 0x3001)
 *
 * It is possible we should be treating other things as delimiters!
 */
#define IS_JA_DELIM(x) (((x)==0x3001)||((x)==0xFF64)||((x)==0xFF0E)||((x)==0x3002)||((x)==0xFF61)||((x)==0xFF0C))

/**
 * The previous character was a delimeter (which includes the start of the
 *  string).
 */
#define BIGRAM_RESET   0
/**
 * The previous character was a CJK character and we have only seen one of them.
 *  If we had seen more than one in a row it would be the BIGRAM_USE state.
 */
#define BIGRAM_UNKNOWN 1
/**
 * We have seen two or more CJK characters in a row.
 */
#define BIGRAM_USE     2
/**
 * The previous character was ASCII or something in the unicode general scripts
 *  area that we do not believe is a delimeter.  We call it 'alpha' as in
 *  alphabetic/alphanumeric and something that should be tokenized based on
 *  delimiters rather than on a bi-gram basis.
 */
#define BIGRAM_ALPHA   3

static int isDelim(
  const unsigned char *zCur,    /* IN: current pointer of token */
  const unsigned char *zTerm,   /* IN: one character beyond end of token */
  int *len,                     /* OUT: analyzed bytes in this token */
  int *state                    /* IN/OUT: analyze state */
){
  const unsigned char *zIn;
  unsigned int c;
  int delim;

  /* ASCII character range has rule */
  if( !(*zCur & 0x80) ){
    *len = 1;
    // This is original porter stemmer isDelim logic.
    // 0x0 - 0x1f are all control characters, 0x20 is space, 0x21-0x2f are
    //  punctuation.
    delim = (*zCur < 0x30 || !porterIdChar[*zCur - 0x30]);
    // cases: "&a", "&."
    if (*state == BIGRAM_USE || *state == BIGRAM_UNKNOWN ){
      /* previous maybe CJK and current is ascii */
      *state = BIGRAM_ALPHA; /*ascii*/
      delim = 1; /* must break */
    } else if (delim == 1) {
      // cases: "a.", ".."
      /* this is delimiter character */
      *state = BIGRAM_RESET; /*reset*/
    } else {
      // cases: "aa", ".a"
      *state = BIGRAM_ALPHA; /*ascii*/
    }
    return delim;
  }

  // (at this point we must be a non-ASCII character)

  /* get the unicode character to analyze */
  zIn = zCur;
  READ_UTF8(zIn, zTerm, c);
  *len = zIn - zCur;

  /* this isn't CJK range, so return as no delim */
  // Anything less than 0x2000 is the general scripts area and should not be
  //  bi-gram indexed.
  // 0xa000 - 0a4cf is the Yi area.  It is apparently a phonetic language whose
  //  usage does not appear to have simple delimeter rules, so we're leaving it
  //  as bigram processed.  This is a guess, if you know better, let us know.
  //  (We previously bailed on this range too.)
  // cases: "aa", ".a", "&a"
  if (c < 0x2000) {
    *state = BIGRAM_ALPHA; /* not really ASCII but same idea; tokenize it */
    return 0;
  }

  // (at this point we must be a bi-grammable char or delimiter)

  /* this is space character or delim character */
  // cases: "a.", "..", "&."
  if( IS_UNI_SPACE(c) || IS_JA_DELIM(c) ){
    *state = BIGRAM_RESET; /* reset */
    return 1; /* it actually is a delimiter; report as such */
  }

  // (at this point we must be a bi-grammable char)

  // cases: "a&"
  if( *state==BIGRAM_ALPHA ){
    /* Previous is ascii and current maybe CJK */
    *state = BIGRAM_UNKNOWN; /* mark as unknown */
    return 1; /* break to emit the ASCII token*/
  }

  /* We have no rule for CJK!. use bi-gram */
  // cases: "&&"
  if( *state==BIGRAM_UNKNOWN || *state==BIGRAM_USE ){
    /* previous state is unknown.  mark as bi-gram */
    *state = BIGRAM_USE;
    return 1; /* break to emit the digram */
  }

  // cases: ".&" (*state == BIGRAM_RESET)
  *state = BIGRAM_UNKNOWN; /* mark as unknown */
  return 0; /* no need to break; nothing to emit */
}

/**
 * Generate a new token.  There are basically three types of token we can
 *  generate:
 * - A porter stemmed token.  This is a word entirely comprised of ASCII
 *    characters.  We run the porter stemmer algorithm against the word.
 *    Because we have no way to know what is and is not an English word
 *    (the only language for which the porter stemmer was designed), this
 *    could theoretically map multiple words that are not variations of the
 *    same word down to the same root, resulting in potentially unexpected
 *    result inclusions in the search results.  We accept this result because
 *    there's not a lot we can do about it and false positives are much
 *    better than false negatives.
 * - A copied token; ASCII case-folded but not stemmed.  We call the porter
 *    stemmer for all non-CJK cases and it diverts to the copy stemmer if it
 *    sees any non-ASCII characters or the string is too long.  The copy
 *    stemmer will truncate the string if it is deemed too long.
 * - A bi-gram token; two CJK-ish characters.  For query reasons we generate a
 *    series of overlapping bi-grams.  (We can't require the user to start their
 *    search based on the arbitrary context of the indexed documents.)
 *
 * It may be useful to think of this function as operating at the points between
 *  characters.  While we are considering the 'current' character (the one after
 *  the 'point'), we are also interested in the 'previous' character (the one
 *  preceding the point).
 * At any 'point', there are a number of possible situations which I will
 *  illustrate with pairs of characters. 'a' means alphanumeric ASCII or a
 *  non-ASCII character that is not bi-grammable or a delimeter, '.'
 *  means a delimiter (space or punctuation), '&' means a bi-grammable
 *  character.
 * - aa: We are in the midst of a token.  State remains BIGRAM_ALPHA.
 * - a.: We will generate a porter stemmed or copied token.  State was
 *        BIGRAM_ALPHA, gets set to BIGRAM_RESET.
 * - a&: We will generate a porter stemmed or copied token; we will set our
 *        state to BIGRAM_UNKNOWN to indicate we have seen one bigram character
 *        but that it is not yet time to emit a bigram.
 * - .a: We are starting a token.  State was BIGRAM_RESET, gets set to
 *        BIGRAM_ALPHA.
 * - ..: We skip/eat the delimeters.  State stays BIGRAM_RESET.
 * - .&: State set to BIGRAM_UNKNOWN to indicate we have seen one bigram char.
 * - &a: If the state was BIGRAM_USE, we generate a bi-gram token.  If the state
 *        was BIGRAM_UNKNOWN we had only seen one CJK character and so don't do
 *        anything.  State is set to BIGRAM_ALPHA.
 * - &.: Same as the "&a" case, but state is set to BIGRAM_RESET.
 * - &&: We will generate a bi-gram token.  State was either BIGRAM_UNKNOWN or
 *        BIGRAM_USE, gets set to BIGRAM_USE.
 */
static int porterNext(
  sqlite3_tokenizer_cursor *pCursor,  /* Cursor returned by porterOpen */
  const char **pzToken,               /* OUT: *pzToken is the token text */
  int *pnBytes,                       /* OUT: Number of bytes in token */
  int *piStartOffset,                 /* OUT: Starting offset of token */
  int *piEndOffset,                   /* OUT: Ending offset of token */
  int *piPosition                     /* OUT: Position integer of token */
){
  porter_tokenizer_cursor *c = (porter_tokenizer_cursor *) pCursor;
  const unsigned char *z = (unsigned char *) c->zInput;
  int len = 0;
  int state;

  while( c->iOffset < c->nInput ){
    int iStartOffset, numChars;

    /*
     * This loop basically has two modes of operation:
     * - general processing (iPrevBigramOffset == 0 here)
     * - CJK processing (iPrevBigramOffset != 0 here)
     *
     * In an general processing pass we skip over all the delimiters, leaving us
     *  at a character that promises to produce a token.  This could be a CJK
     *  token (state == BIGRAM_USE) or an ALPHA token (state == BIGRAM_ALPHA).
     * If it was a CJK token, we transition into CJK state for the next loop.
     * If it was an alpha token, our current offset is pointing at a delimiter
     *  (which could be a CJK character), so it is good that our next pass
     *  through the function and loop will skip over any delimiters.  If the
     *  delimiter we hit was a CJK character, the next time through we will
     *  not treat it as a delimiter though; the entry state for that scan is
     *  BIGRAM_RESET so the transition is not treated as a delimiter!
     * 
     * The CJK pass always starts with the second character in a bi-gram emitted
     *  as a token in the previous step.  No delimiter skipping is required
     *  because we know that first character might produce a token for us.  It
     *  only 'might' produce a token because the previous pass performed no
     *  lookahead and cannot be sure it is followed by another CJK character.
     *  This is why 
     */

    // If we have a previous bigram offset
    if (c->iPrevBigramOffset == 0) {
      /* Scan past delimiter characters */
      state = BIGRAM_RESET; /* reset */
      while (c->iOffset < c->nInput &&
             isDelim(z + c->iOffset, z + c->nInput, &len, &state)) {
        c->iOffset += len;
      }

    } else {
      /* for bigram indexing, use previous offset */
      c->iOffset = c->iPrevBigramOffset;
    }

    /* Count non-delimiter characters. */
    iStartOffset = c->iOffset;
    numChars = 0;

    // Start from a reset state.  This means the first character we see
    //  (which will not be a delimiter) determines which of ALPHA or CJK modes
    //  we are operating in.  (It won't be a delimiter because in a 'general'
    //  pass as defined above, we will have eaten all the delimiters, and in
    //  a CJK pass we are guaranteed that the first character is CJK.)
    state = BIGRAM_RESET; /* state is reset */
    // Advance until it is time to emit a token.
    // For ALPHA characters, this means advancing until we encounter a delimiter
    //  or a CJK character.  iOffset will be pointing at the delimiter or CJK
    //  character, aka one beyond the last ALPHA character.
    // For CJK characters this means advancing until we encounter an ALPHA
    //  character, a delimiter, or we have seen two consecutive CJK
    //  characters.  iOffset points at the ALPHA/delimiter in the first 2 cases
    //  and the second of two CJK characters in the last case.
    // Because of the way this loop is structured, iOffset is only updated
    //  when we don't terminate.  However, if we terminate, len still contains
    //  the number of bytes in the character found at iOffset.  (This is useful
    //  in the CJK case.)
    while (c->iOffset < c->nInput &&
           !isDelim(z + c->iOffset, z + c->nInput, &len, &state)) {
      c->iOffset += len;
      numChars++;
    }

    if (state == BIGRAM_USE) {
      /* Split word by bigram */
      // Right now iOffset is pointing at the second character in a pair.
      //  Save this offset so next-time through we start with that as the
      //  first character.
      c->iPrevBigramOffset = c->iOffset;
      // And now advance so that iOffset is pointing at the character after
      //  the second character in the bi-gram pair.  Also count the char.
      c->iOffset += len;
      numChars++;
    } else {
      /* Reset bigram offset */
      c->iPrevBigramOffset = 0;
    }

    /* Only emit tokens of 2 characters or more unless we think this is a
     *  query and wildcard magic is desired.  We think is a wildcard query
     *  when we have a single character, it starts at the start of the buffer,
     *  it's CJK, our current offset is one shy of nInput and the character at
     *  iOffset is '*'.  Because the state gets clobbered by the incidence of
     *  '*' our requirement for CJK is that the implied character length is at
     *  least 3 given that it takes at least 3 bytes to encode to 0x2000.
     */
    // It is possible we have no token to emit here if iPrevBigramOffset was not
    //  0 on entry and there was no second CJK character.  iPrevBigramOffset
    //  will now be 0 if that is the case (and c->iOffset == iStartOffset).
    if (numChars >= 2 ||
        // wildcard case:
        (numChars == 1 && iStartOffset == 0 &&
         (c->iOffset >= 3) &&
         (c->iOffset == c->nInput - 1) &&
         (z[c->iOffset] == '*'))) {
      /* figure out the number of bytes to copy/stem */
      int n = c->iOffset - iStartOffset;
      /* make sure there is enough buffer space */
      if (n > c->nAllocated) {
        c->nAllocated = n + 20;
        c->zToken = sqlite3_realloc(c->zToken, c->nAllocated);
        if (c->zToken == NULL)
          return SQLITE_NOMEM;
      }

      if (state == BIGRAM_USE) {
        /* This is by bigram. So it is unnecessary to convert word */
        copy_stemmer(&z[iStartOffset], n, c->zToken, pnBytes);
      } else {
        porter_stemmer(&z[iStartOffset], n, c->zToken, pnBytes);
      }
      *pzToken = c->zToken;
      *piStartOffset = iStartOffset;
      *piEndOffset = c->iOffset;
      *piPosition = c->iToken++;
      return SQLITE_OK;
    }
  }
  return SQLITE_DONE;
}

/*
** The set of routines that implement the porter-stemmer tokenizer
*/
static const sqlite3_tokenizer_module porterTokenizerModule = {
  0,
  porterCreate,
  porterDestroy,
  porterOpen,
  porterClose,
  porterNext,
};

/*
** Allocate a new porter tokenizer.  Return a pointer to the new
** tokenizer in *ppModule
*/
void sqlite3Fts3PorterTokenizerModule(
  sqlite3_tokenizer_module const**ppModule
){
  *ppModule = &porterTokenizerModule;
}

#endif /* !defined(SQLITE_CORE) || defined(SQLITE_ENABLE_FTS3) */
