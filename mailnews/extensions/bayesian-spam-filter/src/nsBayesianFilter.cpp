/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Patrick C. Beard <beard@netscape.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Kent James <kent@caspia.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header

// Logging levels are implemented as follows:
//   1 (PR_LOG_ALWAYS) just show one line per message with junk score
//   2 (PR_LOG_ERROR) add any error messages
//   3 (PR_LOG_WARNING) add per message tokens used
//   4 (PR_LOG_DEBUG) add additional tokenization results plus other details
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "nsBayesianFilter.h"
#include "nsIInputStream.h"
#include "nsIStreamListener.h"
#include "nsNetUtil.h"
#include "nsQuickSort.h"
#include "nsIMsgMessageService.h"
#include "nsMsgUtils.h" // for GetMessageServiceFromURI
#include "prnetdb.h"
#include "nsIMsgWindow.h"
#include "prlog.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsUnicharUtils.h"
#include "nsDirectoryServiceUtils.h"
#include "nsIMIMEHeaderParam.h"
#include "nsNetCID.h"
#include "nsIMimeHeaders.h"
#include "nsMsgMimeCID.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMimeMiscStatus.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIStringEnumerator.h"

// needed to mark attachment flag on the db hdr
#include "nsIMsgHdr.h"

// needed to strip html out of the body
#include "nsParserCIID.h"
#include "nsIParser.h"
#include "nsIHTMLContentSink.h"
#include "nsIContentSerializer.h"
#include "nsLayoutCID.h"
#include "nsIHTMLToTextSink.h"
#include "nsIDocumentEncoder.h"

#include "nsIncompleteGamma.h"
#include <math.h>
#include <prmem.h>

static PRLogModuleInfo *BayesianFilterLogModule = nsnull;

static NS_DEFINE_CID(kParserCID, NS_PARSER_CID);

#define kDefaultJunkThreshold .99 // we override this value via a pref
static const char* kBayesianFilterTokenDelimiters = " \t\n\r\f.";
static int kMinLengthForToken = 3; // lower bound on the number of characters in a word before we treat it as a token
static int kMaxLengthForToken = 12; // upper bound on the number of characters in a word to be declared as a token

#define FORGED_RECEIVED_HEADER_HINT NS_LITERAL_CSTRING("may be forged")

#ifndef M_LN2
#define M_LN2 0.69314718055994530942
#endif

#ifndef M_E
#define M_E   2.7182818284590452354
#endif

// provide base implementation of hash lookup of a string
struct BaseToken : public PLDHashEntryHdr
{
    const char* mWord;
};

// token for a particular message
// mCount, mAnalysisLink are initialized to zero by the hash code
struct Token : public BaseToken {
    PRUint32 mCount;
    PRUint32 mAnalysisLink; // index in mAnalysisStore of the AnalysisPerToken
                            // object for the first trait for this token
};

// token stored in a training file for a group of messages
// mTraitLink is initialized to 0 by the hash code
struct CorpusToken : public BaseToken
{
    PRUint32 mTraitLink;    // index in mTraitStore of the TraitPerToken
                            // object for the first trait for this token
};

// set the value of a TraitPerToken object
TraitPerToken::TraitPerToken(PRUint32 aTraitId, PRUint32 aCount)
  :  mId(aTraitId), mCount(aCount), mNextLink(0)
{
}

// shorthand representations of trait ids for junk and good
static const PRUint32 kJunkTrait = nsIJunkMailPlugin::JUNK_TRAIT;
static const PRUint32 kGoodTrait = nsIJunkMailPlugin::GOOD_TRAIT;

// set the value of an AnalysisPerToken object
AnalysisPerToken::AnalysisPerToken(
  PRUint32 aTraitIndex, double aDistance, double aProbability) :
    mTraitIndex(aTraitIndex),
    mDistance(aDistance),
    mProbability(aProbability),
    mNextLink(0)
{
}

// the initial size of the AnalysisPerToken linked list storage
const PRUint32 kAnalysisStoreCapacity = 2048;

// the initial size of the TraitPerToken linked list storage
const PRUint32 kTraitStoreCapacity = 16384;

// Size of Auto arrays representing per trait information
const PRUint32 kTraitAutoCapacity = 10;

TokenEnumeration::TokenEnumeration(PLDHashTable* table)
    :   mEntrySize(table->entrySize),
        mEntryCount(table->entryCount),
        mEntryOffset(0),
        mEntryAddr(table->entryStore)
{
    PRUint32 capacity = PL_DHASH_TABLE_SIZE(table);
    mEntryLimit = mEntryAddr + capacity * mEntrySize;
}

inline PRBool TokenEnumeration::hasMoreTokens()
{
    return (mEntryOffset < mEntryCount);
}

inline BaseToken* TokenEnumeration::nextToken()
{
    BaseToken* token = nsnull;
    PRUint32 entrySize = mEntrySize;
    char *entryAddr = mEntryAddr, *entryLimit = mEntryLimit;
    while (entryAddr < entryLimit) {
        PLDHashEntryHdr* entry = (PLDHashEntryHdr*) entryAddr;
        entryAddr += entrySize;
        if (PL_DHASH_ENTRY_IS_LIVE(entry)) {
            token = static_cast<BaseToken*>(entry);
            ++mEntryOffset;
            break;
        }
    }
    mEntryAddr = entryAddr;
    return token;
}

struct VisitClosure {
    PRBool (*f) (BaseToken*, void*);
    void* data;
};

static PLDHashOperator VisitEntry(PLDHashTable* table, PLDHashEntryHdr* entry,
                                  PRUint32 number, void* arg)
{
    VisitClosure* closure = reinterpret_cast<VisitClosure*>(arg);
    BaseToken* token = static_cast<BaseToken*>(entry);
    return (closure->f(token, closure->data) ? PL_DHASH_NEXT : PL_DHASH_STOP);
}

// member variables
static const PLDHashTableOps gTokenTableOps = {
    PL_DHashAllocTable,
    PL_DHashFreeTable,
    PL_DHashStringKey,
    PL_DHashMatchStringKey,
    PL_DHashMoveEntryStub,
    PL_DHashClearEntryStub,
    PL_DHashFinalizeStub
};

TokenHash::TokenHash(PRUint32 aEntrySize)
{
    mEntrySize = aEntrySize;
    PL_INIT_ARENA_POOL(&mWordPool, "Words Arena", 16384);
    PRBool ok = PL_DHashTableInit(&mTokenTable, &gTokenTableOps, nsnull,
                                  aEntrySize, 256);
    NS_ASSERTION(ok, "mTokenTable failed to initialize");
    if (!ok)
      PR_LOG(BayesianFilterLogModule, PR_LOG_ERROR, ("mTokenTable failed to initialize"));
}

TokenHash::~TokenHash()
{
    if (mTokenTable.entryStore)
        PL_DHashTableFinish(&mTokenTable);
    PL_FinishArenaPool(&mWordPool);
}

nsresult TokenHash::clearTokens()
{
    // we re-use the tokenizer when classifying multiple messages,
    // so this gets called after every message classification.
    PRBool ok = PR_TRUE;
    if (mTokenTable.entryStore)
    {
        PL_DHashTableFinish(&mTokenTable);
        PL_FreeArenaPool(&mWordPool);
        ok = PL_DHashTableInit(&mTokenTable, &gTokenTableOps, nsnull,
                               mEntrySize, 256);
        NS_ASSERTION(ok, "mTokenTable failed to initialize");
        if (!ok)
          PR_LOG(BayesianFilterLogModule, PR_LOG_ERROR, ("mTokenTable failed to initialize in clearTokens()"));
    }
    return (ok) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

char* TokenHash::copyWord(const char* word, PRUint32 len)
{
    void* result;
    PRUint32 size = 1 + len;
    PL_ARENA_ALLOCATE(result, &mWordPool, size);
    if (result)
        memcpy(result, word, size);
    return reinterpret_cast<char*>(result);
}

inline BaseToken* TokenHash::get(const char* word)
{
    PLDHashEntryHdr* entry = PL_DHashTableOperate(&mTokenTable, word, PL_DHASH_LOOKUP);
    if (PL_DHASH_ENTRY_IS_BUSY(entry))
        return static_cast<BaseToken*>(entry);
    return NULL;
}

BaseToken* TokenHash::add(const char* word)
{
    if (!word || !*word)
    {
      NS_ERROR("Trying to add a null word");
      return nsnull;
    }

    PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("add word: %s", word));

    PLDHashEntryHdr* entry = PL_DHashTableOperate(&mTokenTable, word, PL_DHASH_ADD);
    BaseToken* token = static_cast<BaseToken*>(entry);
    if (token) {
        if (token->mWord == NULL) {
            PRUint32 len = strlen(word);
            NS_ASSERTION(len != 0, "adding zero length word to tokenizer");
            if (!len)
              PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("adding zero length word to tokenizer"));
            token->mWord = copyWord(word, len);
            NS_ASSERTION(token->mWord, "copyWord failed");
            if (!token->mWord) {
                PR_LOG(BayesianFilterLogModule, PR_LOG_ERROR, ("copyWord failed: %s (%d)", word, len));
                PL_DHashTableRawRemove(&mTokenTable, entry);
                return NULL;
            }
        }
    }
    return token;
}

void TokenHash::visit(PRBool (*f) (BaseToken*, void*), void* data)
{
    VisitClosure closure = { f, data };
    PRUint32 visitCount = PL_DHashTableEnumerate(&mTokenTable, VisitEntry, &closure);
    NS_ASSERTION(visitCount == mTokenTable.entryCount, "visitCount != entryCount!");
    if (visitCount != mTokenTable.entryCount) {
      PR_LOG(BayesianFilterLogModule, PR_LOG_ERROR, ("visitCount != entryCount!: %d vs %d", visitCount, mTokenTable.entryCount));
    }
}

inline PRUint32 TokenHash::countTokens()
{
  return mTokenTable.entryCount;
}

inline TokenEnumeration TokenHash::getTokens()
{
  return TokenEnumeration(&mTokenTable);
}

Tokenizer::Tokenizer() :
  TokenHash(sizeof(Token))
{
}

Tokenizer::~Tokenizer()
{
}

inline Token* Tokenizer::get(const char* word)
{
  return static_cast<Token*>(TokenHash::get(word));
}

Token* Tokenizer::add(const char* word, PRUint32 count)
{
  PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("add word: %s (count=%d)",
         word, count));

  Token* token = static_cast<Token*>(TokenHash::add(word));
  if (token)
  {
    token->mCount += count; // hash code initializes this to zero
    PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG,
           ("adding word to tokenizer: %s (count=%d) (mCount=%d)",
           word, count, token->mCount));
  }
  return token;
}

static PRBool isDecimalNumber(const char* word)
{
    const char* p = word;
    if (*p == '-') ++p;
    char c;
    while ((c = *p++)) {
        if (!isdigit((unsigned char) c))
            return PR_FALSE;
    }
    return PR_TRUE;
}

static PRBool isASCII(const char* word)
{
    const unsigned char* p = (const unsigned char*)word;
    unsigned char c;
    while ((c = *p++)) {
        if (c > 127)
            return PR_FALSE;
    }
    return PR_TRUE;
}

inline PRBool isUpperCase(char c) { return ('A' <= c) && (c <= 'Z'); }

static char* toLowerCase(char* str)
{
    char c, *p = str;
    while ((c = *p++)) {
        if (isUpperCase(c))
            p[-1] = c + ('a' - 'A');
    }
    return str;
}

void Tokenizer::addTokenForHeader(const char * aTokenPrefix, nsACString& aValue, PRBool aTokenizeValue)
{
  if (aValue.Length())
  {
    ToLowerCase(aValue);
    if (!aTokenizeValue)
    {
      nsCString tmpStr;
      tmpStr.Assign(aTokenPrefix);
      tmpStr.Append(':');
      tmpStr.Append(aValue);

      add(tmpStr.get());
    }
    else
    {
      char* word;
      nsCString str(aValue);
      char *next = str.BeginWriting();
      while ((word = NS_strtok(kBayesianFilterTokenDelimiters, &next)) != NULL)
      {
        if (word[0] == '\0') continue;
        if (isDecimalNumber(word)) continue;
        if (isASCII(word))
        {
          nsCString tmpStr;
          tmpStr.Assign(aTokenPrefix);
          tmpStr.Append(':');
          tmpStr.Append(word);
          add(tmpStr.get());
        }
      }
    }
  }
}

void Tokenizer::tokenizeAttachment(const char * aContentType, const char * aFileName)
{
  nsCAutoString contentType;
  nsCAutoString fileName;
  fileName.Assign(aFileName);
  contentType.Assign(aContentType);

  // normalize the content type and the file name
  ToLowerCase(fileName);
  ToLowerCase(contentType);
  addTokenForHeader("attachment/filename", fileName);

  addTokenForHeader("attachment/content-type", contentType);
}

void Tokenizer::tokenizeHeaders(nsIUTF8StringEnumerator * aHeaderNames, nsIUTF8StringEnumerator * aHeaderValues)
{
  nsCString headerValue;
  nsCAutoString headerName; // we'll be normalizing all header names to lower case
  PRBool hasMore = PR_TRUE;

  while (hasMore)
  {
    aHeaderNames->GetNext(headerName);
    ToLowerCase(headerName);
    aHeaderValues->GetNext(headerValue);

    switch (headerName.First())
    {
    case 'c':
        if (headerName.Equals("content-type"))
        {
          nsresult rv;
          nsCOMPtr<nsIMIMEHeaderParam> mimehdrpar = do_GetService(NS_MIMEHEADERPARAM_CONTRACTID, &rv);
          if (NS_FAILED(rv))
            break;

          // extract the charset parameter
          nsCString parameterValue;
          mimehdrpar->GetParameterInternal(headerValue.get(), "charset", nsnull, nsnull, getter_Copies(parameterValue));
          addTokenForHeader("charset", parameterValue);

          // create a token containing just the content type
          mimehdrpar->GetParameterInternal(headerValue.get(), "type", nsnull, nsnull, getter_Copies(parameterValue));
          if (!parameterValue.Length())
            mimehdrpar->GetParameterInternal(headerValue.get(), nsnull /* use first unnamed param */, nsnull, nsnull, getter_Copies(parameterValue));
          addTokenForHeader("content-type/type", parameterValue);

          // XXX: should we add a token for the entire content-type header as well or just these parts we have extracted?
        }
        break;
    case 'r':
      if (headerName.Equals("received"))
      {
        // look for the string "may be forged" in the received headers. sendmail sometimes adds this hint
        // This does not compile on linux yet. Need to figure out why. Commenting out for now
        // if (FindInReadable(FORGED_RECEIVED_HEADER_HINT, headerValue))
        //   addTokenForHeader(headerName.get(), FORGED_RECEIVED_HEADER_HINT);
      }

      // leave out reply-to
      break;
    case 's':
        if (headerName.Equals("subject"))
        {
          // we want to tokenize the subject
          addTokenForHeader(headerName.get(), headerValue, PR_TRUE);
        }

        // important: leave out sender field. Too strong of an indicator
        break;
    case 'x': // (2) X-Mailer / user-agent works best if it is untokenized, just fold the case and any leading/trailing white space
        // all headers beginning with x-mozilla are being changed by us, so ignore
        if (Substring(headerName, 0, 9).Equals("x-mozilla"))
          break;
        // fall through
    case 'u':
        addTokenForHeader(headerName.get(), headerValue);
        break;
    default:
        addTokenForHeader(headerName.get(), headerValue);
        break;
    } // end switch

    aHeaderNames->HasMore(&hasMore);
  }
}

void Tokenizer::tokenize_ascii_word(char * aWord)
{
  // always deal with normalized lower case strings
  toLowerCase(aWord);
  PRInt32 wordLength = strlen(aWord);

  // if the wordLength is within our accepted token limit, then add it
  if (wordLength >= kMinLengthForToken && wordLength <= kMaxLengthForToken)
    add(aWord);
  else if (wordLength > kMaxLengthForToken)
  {
    // don't skip over the word if it looks like an email address,
    // there is value in adding tokens for addresses
    nsDependentCString word (aWord, wordLength); // CHEAP, no allocation occurs here...

    // XXX: i think the 40 byte check is just for perf reasons...if the email address is longer than that then forget about it.
    if (wordLength < 40 && strchr(aWord, '.') && word.CountChar('@') == 1)
    {
      PRInt32 numBytesToSep = word.FindChar('@');
      if (numBytesToSep < wordLength - 1) // if the @ sign is the last character, it must not be an email address
      {
        // split the john@foo.com into john and foo.com, treat them as separate tokens
        nsCString emailNameToken;
        emailNameToken.AssignLiteral("email name:");
        emailNameToken.Append(Substring(word, 0, numBytesToSep++));
        add(emailNameToken.get());
        nsCString emailAddrToken;
        emailAddrToken.AssignLiteral("email addr:");
        emailAddrToken.Append(Substring(word, numBytesToSep, wordLength - numBytesToSep));
        add(emailAddrToken.get());
        return;
      }
    }

    // there is value in generating a token indicating the number
    // of characters we are skipping. We'll round to the nearest 10
    nsCString skipToken;
    skipToken.AssignLiteral("skip:");
    skipToken.Append(word[0]);
    skipToken.Append(' ');
    skipToken.AppendInt((wordLength/10) * 10);
    add(skipToken.get());
  }
}

// one substract and one conditional jump should be faster than two conditional jump on most recent system.
#define IN_RANGE(x, low, high)  ((PRUint16)((x)-(low)) <= (high)-(low))

#define IS_JA_HIRAGANA(x)   IN_RANGE(x, 0x3040, 0x309F)
// swapping the range using xor operation to reduce conditional jump.
#define IS_JA_KATAKANA(x)	(IN_RANGE(x^0x0004, 0x30A0, 0x30FE)||(IN_RANGE(x, 0xFF66, 0xFF9F)))
#define IS_JA_KANJI(x)      (IN_RANGE(x, 0x2E80, 0x2FDF)||IN_RANGE(x, 0x4E00, 0x9FAF))
#define IS_JA_KUTEN(x)      (((x)==0x3001)||((x)==0xFF64)||((x)==0xFF0E))
#define IS_JA_TOUTEN(x)     (((x)==0x3002)||((x)==0xFF61)||((x)==0xFF0C))
#define IS_JA_SPACE(x)      ((x)==0x3000)
#define IS_JA_FWLATAIN(x)   IN_RANGE(x, 0xFF01, 0xFF5E)
#define IS_JA_FWNUMERAL(x)  IN_RANGE(x, 0xFF10, 0xFF19)

#define IS_JAPANESE_SPECIFIC(x) (IN_RANGE(x, 0x3040, 0x30FF)||IN_RANGE(x, 0xFF01, 0xFF9F))

enum char_class{
    others = 0,
    space,
    hiragana,
    katakana,
    kanji,
    kuten,
    touten,
    kigou,
    fwlatain,
    ascii
};

static char_class getCharClass(PRUnichar c)
{
  char_class charClass = others;

  if(IS_JA_HIRAGANA(c))
    charClass = hiragana;
  else if(IS_JA_KATAKANA(c))
    charClass = katakana;
  else if(IS_JA_KANJI(c))
    charClass = kanji;
  else if(IS_JA_KUTEN(c))
    charClass = kuten;
  else if(IS_JA_TOUTEN(c))
    charClass = touten;
  else if(IS_JA_FWLATAIN(c))
    charClass = fwlatain;

  return charClass;
}

static PRBool isJapanese(const char* word)
{
  nsString text = NS_ConvertUTF8toUTF16(word);
  PRUnichar* p = (PRUnichar*)text.get();
  PRUnichar c;

  // it is japanese chunk if it contains any hiragana or katakana.
  while((c = *p++))
    if( IS_JAPANESE_SPECIFIC(c))
      return PR_TRUE;

  return PR_FALSE;
}

static PRBool isFWNumeral(const PRUnichar* p1, const PRUnichar* p2)
{
  for(;p1<p2;p1++)
    if(!IS_JA_FWNUMERAL(*p1))
      return PR_FALSE;

  return PR_TRUE;
}

// The japanese tokenizer was added as part of Bug #277354
void Tokenizer::tokenize_japanese_word(char* chunk)
{
  PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("entering tokenize_japanese_word(%s)", chunk));

  nsString srcStr = NS_ConvertUTF8toUTF16(chunk);
  const PRUnichar* p1 = srcStr.get();
  const PRUnichar* p2 = p1;
  if(!*p2) return;

  char_class cc = getCharClass(*p2);
  while(*(++p2))
  {
    if(cc == getCharClass(*p2))
      continue;

    nsCString token = NS_ConvertUTF16toUTF8(p1, p2-p1);
    if( (!isDecimalNumber(token.get())) && (!isFWNumeral(p1, p2)))
    {
      nsCString tmpStr;
      tmpStr.AppendLiteral("JA:");
      tmpStr.Append(token);
      add(tmpStr.get());
    }

    cc = getCharClass(*p2);
    p1 = p2;
  }
}

nsresult Tokenizer::stripHTML(const nsAString& inString, nsAString& outString)
{
  nsresult rv = NS_OK;
  // Create a parser
  nsCOMPtr<nsIParser> parser = do_CreateInstance(kParserCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Create the appropriate output sink
  nsCOMPtr<nsIContentSink> sink = do_CreateInstance(NS_PLAINTEXTSINK_CONTRACTID,&rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIHTMLToTextSink> textSink(do_QueryInterface(sink));
  NS_ENSURE_TRUE(textSink, NS_ERROR_FAILURE);
  PRUint32 flags = nsIDocumentEncoder::OutputLFLineBreak
                 | nsIDocumentEncoder::OutputNoScriptContent
                 | nsIDocumentEncoder::OutputNoFramesContent
                 | nsIDocumentEncoder::OutputBodyOnly;

  textSink->Initialize(&outString, flags, 80);

  parser->SetContentSink(sink);

  return parser->Parse(inString, 0, NS_LITERAL_CSTRING("text/html"), PR_TRUE);
}

void Tokenizer::tokenize(const char* aText)
{
  PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("tokenize: %s", aText));

  // strip out HTML tags before we begin processing
  // uggh but first we have to blow up our string into UCS2
  // since that's what the document encoder wants. UTF8/UCS2, I wish we all
  // spoke the same language here..
  nsString text = NS_ConvertUTF8toUTF16(aText);
  nsString strippedUCS2;
  stripHTML(text, strippedUCS2);

  // convert 0x3000(full width space) into 0x0020
  PRUnichar * substr_start = strippedUCS2.BeginWriting();
  PRUnichar * substr_end = strippedUCS2.EndWriting();
  while (substr_start != substr_end) {
    if (*substr_start == 0x3000)
        *substr_start = 0x0020;
    ++substr_start;
  }

  nsCString strippedStr = NS_ConvertUTF16toUTF8(strippedUCS2);
  char * strippedText = strippedStr.BeginWriting();
  PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("tokenize stripped html: %s", strippedText));

  char* word;
  char* next = strippedText;
  while ((word = NS_strtok(kBayesianFilterTokenDelimiters, &next)) != NULL) {
    if (!*word) continue;
    if (isDecimalNumber(word)) continue;
    if (isASCII(word))
        tokenize_ascii_word(word);
    else if (isJapanese(word))
        tokenize_japanese_word(word);
    else {
        nsresult rv;
        // use I18N  scanner to break this word into meaningful semantic units.
        if (!mScanner) {
            mScanner = do_CreateInstance(NS_SEMANTICUNITSCANNER_CONTRACTID, &rv);
            NS_ASSERTION(NS_SUCCEEDED(rv), "couldn't create semantic unit scanner!");
            if (NS_FAILED(rv)) {
                return;
            }
        }
        if (mScanner) {
            mScanner->Start("UTF-8");
            // convert this word from UTF-8 into UCS2.
            NS_ConvertUTF8toUTF16 uword(word);
            ToLowerCase(uword);
            const PRUnichar* utext = uword.get();
            PRInt32 len = uword.Length(), pos = 0, begin, end;
            PRBool gotUnit;
            while (pos < len) {
                rv = mScanner->Next(utext, len, pos, PR_TRUE, &begin, &end, &gotUnit);
                if (NS_SUCCEEDED(rv) && gotUnit) {
                    NS_ConvertUTF16toUTF8 utfUnit(utext + begin, end - begin);
                    add(utfUnit.get());
                    // advance to end of current unit.
                    pos = end;
                } else {
                    break;
                }
            }
        }
    }
  }
}

Token* Tokenizer::copyTokens()
{
    PRUint32 count = countTokens();
    if (count > 0) {
        Token* tokens = new Token[count];
        if (tokens) {
            Token* tp = tokens;
            TokenEnumeration e(&mTokenTable);
            while (e.hasMoreTokens())
                *tp++ = *(static_cast<Token*>(e.nextToken()));
        }
        return tokens;
    }
    return NULL;
}

class TokenAnalyzer {
public:
    virtual ~TokenAnalyzer() {}

    virtual void analyzeTokens(Tokenizer& tokenizer) = 0;
    void setTokenListener(nsIStreamListener *aTokenListener)
    {
      mTokenListener = aTokenListener;
    }

    void setSource(const char *sourceURI) {mTokenSource = sourceURI;}

    nsCOMPtr<nsIStreamListener> mTokenListener;
    nsCString mTokenSource;

};

/**
 * This class downloads the raw content of an email message, buffering until
 * complete segments are seen, that is until a linefeed is seen, although
 * any of the valid token separators would do. This could be a further
 * refinement.
 */
class TokenStreamListener : public nsIStreamListener, nsIMsgHeaderSink {
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIREQUESTOBSERVER
    NS_DECL_NSISTREAMLISTENER
    NS_DECL_NSIMSGHEADERSINK

    TokenStreamListener(TokenAnalyzer* analyzer);
    virtual ~TokenStreamListener();
protected:
    TokenAnalyzer* mAnalyzer;
    char* mBuffer;
    PRUint32 mBufferSize;
    PRUint32 mLeftOverCount;
    Tokenizer mTokenizer;
    PRBool mSetAttachmentFlag;
};

const PRUint32 kBufferSize = 16384;

TokenStreamListener::TokenStreamListener(TokenAnalyzer* analyzer)
    :   mAnalyzer(analyzer),
        mBuffer(NULL), mBufferSize(kBufferSize), mLeftOverCount(0),
        mSetAttachmentFlag(PR_FALSE)
{
}

TokenStreamListener::~TokenStreamListener()
{
    delete[] mBuffer;
    delete mAnalyzer;
}

NS_IMPL_ISUPPORTS3(TokenStreamListener, nsIRequestObserver, nsIStreamListener, nsIMsgHeaderSink)

NS_IMETHODIMP TokenStreamListener::ProcessHeaders(nsIUTF8StringEnumerator *aHeaderNames, nsIUTF8StringEnumerator *aHeaderValues, PRBool dontCollectAddress)
{
    mTokenizer.tokenizeHeaders(aHeaderNames, aHeaderValues);
    return NS_OK;
}

NS_IMETHODIMP TokenStreamListener::HandleAttachment(const char *contentType, const char *url, const PRUnichar *displayName, const char *uri, PRBool aIsExternalAttachment)
{
    mTokenizer.tokenizeAttachment(contentType, NS_ConvertUTF16toUTF8(displayName).get());
    return NS_OK;
}

NS_IMETHODIMP TokenStreamListener::OnEndAllAttachments()
{
    return NS_OK;
}

NS_IMETHODIMP TokenStreamListener::OnEndMsgDownload(nsIMsgMailNewsUrl *url)
{
    return NS_OK;
}


NS_IMETHODIMP TokenStreamListener::OnMsgHasRemoteContent(nsIMsgDBHdr * aMsgHdr)
{
    return NS_OK;
}

NS_IMETHODIMP TokenStreamListener::OnEndMsgHeaders(nsIMsgMailNewsUrl *url)
{
    return NS_OK;
}


NS_IMETHODIMP TokenStreamListener::GetSecurityInfo(nsISupports * *aSecurityInfo)
{
    return NS_OK;
}
NS_IMETHODIMP TokenStreamListener::SetSecurityInfo(nsISupports * aSecurityInfo)
{
    return NS_OK;
}

NS_IMETHODIMP TokenStreamListener::GetDummyMsgHeader(nsIMsgDBHdr **aMsgDBHdr)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP TokenStreamListener::GetProperties(nsIWritablePropertyBag2 * *aProperties)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void onStartRequest (in nsIRequest aRequest, in nsISupports aContext); */
NS_IMETHODIMP TokenStreamListener::OnStartRequest(nsIRequest *aRequest, nsISupports *aContext)
{
    mLeftOverCount = 0;
    if (!mTokenizer)
        return NS_ERROR_OUT_OF_MEMORY;
    if (!mBuffer)
    {
        mBuffer = new char[mBufferSize];
        if (!mBuffer)
            return NS_ERROR_OUT_OF_MEMORY;
    }

    // get the url for the channel and set our nsIMsgHeaderSink on it so we get notified
    // about the headers and attachments

    nsCOMPtr<nsIChannel> channel (do_QueryInterface(aRequest));
    if (channel)
    {
        nsCOMPtr<nsIURI> uri;
        channel->GetURI(getter_AddRefs(uri));
        nsCOMPtr<nsIMsgMailNewsUrl> mailUrl = do_QueryInterface(uri);
        if (mailUrl)
            mailUrl->SetMsgHeaderSink(static_cast<nsIMsgHeaderSink*>(this));
    }

    return NS_OK;
}

/* void onDataAvailable (in nsIRequest aRequest, in nsISupports aContext, in nsIInputStream aInputStream, in unsigned long aOffset, in unsigned long aCount); */
NS_IMETHODIMP TokenStreamListener::OnDataAvailable(nsIRequest *aRequest, nsISupports *aContext, nsIInputStream *aInputStream, PRUint32 aOffset, PRUint32 aCount)
{
    nsresult rv = NS_OK;

    while (aCount > 0) {
        PRUint32 readCount, totalCount = (aCount + mLeftOverCount);
        if (totalCount >= mBufferSize) {
            readCount = mBufferSize - mLeftOverCount - 1;
        } else {
            readCount = aCount;
        }

        char* buffer = mBuffer;
        rv = aInputStream->Read(buffer + mLeftOverCount, readCount, &readCount);
        if (NS_FAILED(rv))
            break;

        if (readCount == 0) {
            rv = NS_ERROR_UNEXPECTED;
            NS_WARNING("failed to tokenize");
            break;
        }

        aCount -= readCount;

        /* consume the tokens up to the last legal token delimiter in the buffer. */
        totalCount = (readCount + mLeftOverCount);
        buffer[totalCount] = '\0';
        char* lastDelimiter = NULL;
        char* scan = buffer + totalCount;
        while (scan > buffer) {
            if (strchr(kBayesianFilterTokenDelimiters, *--scan)) {
                lastDelimiter = scan;
                break;
            }
        }

        if (lastDelimiter) {
            *lastDelimiter = '\0';
            mTokenizer.tokenize(buffer);

            PRUint32 consumedCount = 1 + (lastDelimiter - buffer);
            mLeftOverCount = totalCount - consumedCount;
            if (mLeftOverCount)
                memmove(buffer, buffer + consumedCount, mLeftOverCount);
        } else {
            /* didn't find a delimiter, keep the whole buffer around. */
            mLeftOverCount = totalCount;
            if (totalCount >= (mBufferSize / 2)) {
                PRUint32 newBufferSize = mBufferSize * 2;
                char* newBuffer = new char[newBufferSize];
                if (!newBuffer) return NS_ERROR_OUT_OF_MEMORY;
                memcpy(newBuffer, mBuffer, mLeftOverCount);
                delete[] mBuffer;
                mBuffer = newBuffer;
                mBufferSize = newBufferSize;
            }
        }
    }

    return rv;
}

/* void onStopRequest (in nsIRequest aRequest, in nsISupports aContext, in nsresult aStatusCode); */
NS_IMETHODIMP TokenStreamListener::OnStopRequest(nsIRequest *aRequest, nsISupports *aContext, nsresult aStatusCode)
{
    if (mLeftOverCount) {
        /* assume final buffer is complete. */
        mBuffer[mLeftOverCount] = '\0';
        mTokenizer.tokenize(mBuffer);
    }

    /* finally, analyze the tokenized message. */
    PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("analyze the tokenized message"));
    if (mAnalyzer)
        mAnalyzer->analyzeTokens(mTokenizer);

    return NS_OK;
}

/* Implementation file */

NS_IMPL_ISUPPORTS2(nsBayesianFilter, nsIMsgFilterPlugin, nsIJunkMailPlugin)

nsBayesianFilter::nsBayesianFilter()
    :   mTrainingDataDirty(PR_FALSE)
{
    if (!BayesianFilterLogModule)
      BayesianFilterLogModule = PR_NewLogModule("BayesianFilter");

    PRInt32 junkThreshold = 0;
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    if (pPrefBranch)
      pPrefBranch->GetIntPref("mail.adaptivefilters.junk_threshold", &junkThreshold);

    mJunkProbabilityThreshold = (static_cast<double>(junkThreshold)) / 100.0;
    if (mJunkProbabilityThreshold == 0 || mJunkProbabilityThreshold >= 1)
      mJunkProbabilityThreshold = kDefaultJunkThreshold;

    PR_LOG(BayesianFilterLogModule, PR_LOG_WARNING, ("junk probability threshold: %f", mJunkProbabilityThreshold));

    mCorpus.readTrainingData();

    // get parameters for training data flushing, from the prefs

    nsCOMPtr<nsIPrefBranch> prefBranch;

    nsCOMPtr<nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed accessing preferences service");
    rv = prefs->GetBranch(nsnull, getter_AddRefs(prefBranch));
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed getting preferences branch");

    rv = prefBranch->GetIntPref("mailnews.bayesian_spam_filter.flush.minimum_interval",&mMinFlushInterval);
    // it is not a good idea to allow a minimum interval of under 1 second
    if (NS_FAILED(rv) || (mMinFlushInterval <= 1000) )
        mMinFlushInterval = DEFAULT_MIN_INTERVAL_BETWEEN_WRITES;

    rv = prefBranch->GetIntPref("mailnews.bayesian_spam_filter.junk_maxtokens", &mMaximumTokenCount);
    if (NS_FAILED(rv))
      mMaximumTokenCount = 0; // which means do not limit token counts
    PR_LOG(BayesianFilterLogModule, PR_LOG_WARNING, ("maximum junk tokens: %d", mMaximumTokenCount));

    mTimer = do_CreateInstance(NS_TIMER_CONTRACTID, &rv);
    NS_ASSERTION(NS_SUCCEEDED(rv), "unable to create a timer; training data will only be written on exit");

    // the timer is not used on object construction, since for
    // the time being there are no dirying messages

    // give a default capacity to the memory structure used to store
    // per-message/per-trait token data
    mAnalysisStore.SetCapacity(kAnalysisStoreCapacity);

    // dummy 0th element. Index 0 means "end of list" so we need to
    // start from 1
    AnalysisPerToken analysisPT(0, 0.0, 0.0);
    mAnalysisStore.AppendElement(analysisPT);
    mNextAnalysisIndex = 1;
}

void
nsBayesianFilter::TimerCallback(nsITimer* aTimer, void* aClosure)
{
    // we will flush the training data to disk after enough time has passed
    // since the first time a message has been classified after the last flush

    nsBayesianFilter *filter = static_cast<nsBayesianFilter *>(aClosure);
    filter->mCorpus.writeTrainingData(filter->mMaximumTokenCount);
    filter->mTrainingDataDirty = PR_FALSE;
}

nsBayesianFilter::~nsBayesianFilter()
{
    if (mTimer)
    {
        mTimer->Cancel();
        mTimer = nsnull;
    }
    // call shutdown when we are going away in case we need
    // to flush the training set to disk
    Shutdown();
}

// this object is used for one call to classifyMessage or classifyMessages().
// So if we're classifying multiple messages, this object will be used for each message.
// It's going to hold a reference to itself, basically, to stay in memory.
class MessageClassifier : public TokenAnalyzer {
public:
    // full classifier with arbitrary traits
    MessageClassifier(nsBayesianFilter* aFilter,
                      nsIJunkMailClassificationListener* aJunkListener,
                      nsIMsgTraitClassificationListener* aTraitListener,
                      nsIMsgTraitDetailListener* aDetailListener,
                      nsTArray<PRUint32>& aProTraits,
                      nsTArray<PRUint32>& aAntiTraits,
                      nsIMsgWindow *aMsgWindow,
                      PRUint32 aNumMessagesToClassify,
                      const char **aMessageURIs)
    :   mFilter(aFilter),
        mSupports(aFilter),
        mJunkListener(aJunkListener),
        mTraitListener(aTraitListener),
        mDetailListener(aDetailListener),
        mProTraits(aProTraits),
        mAntiTraits(aAntiTraits),
        mMsgWindow(aMsgWindow)
    {
      mCurMessageToClassify = 0;
      mNumMessagesToClassify = aNumMessagesToClassify;
      mMessageURIs = (char **) nsMemory::Alloc(sizeof(char *) * aNumMessagesToClassify);
      for (PRUint32 i = 0; i < aNumMessagesToClassify; i++)
        mMessageURIs[i] = PL_strdup(aMessageURIs[i]);

    }

    // junk-only classifier
    MessageClassifier(nsBayesianFilter* aFilter,
                      nsIJunkMailClassificationListener* aJunkListener,
                      nsIMsgWindow *aMsgWindow,
                      PRUint32 aNumMessagesToClassify,
                      const char **aMessageURIs)
    :   mFilter(aFilter),
        mSupports(aFilter),
        mJunkListener(aJunkListener),
        mTraitListener(nsnull),
        mDetailListener(nsnull),
        mMsgWindow(aMsgWindow)
    {
      mCurMessageToClassify = 0;
      mNumMessagesToClassify = aNumMessagesToClassify;
      mMessageURIs = (char **) nsMemory::Alloc(sizeof(char *) * aNumMessagesToClassify);
      for (PRUint32 i = 0; i < aNumMessagesToClassify; i++)
        mMessageURIs[i] = PL_strdup(aMessageURIs[i]);
      mProTraits.AppendElement(kJunkTrait);
      mAntiTraits.AppendElement(kGoodTrait);

    }

    virtual ~MessageClassifier()
    {
       if (mMessageURIs)
       {
         NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(mNumMessagesToClassify, mMessageURIs);
       }
    }
    virtual void analyzeTokens(Tokenizer& tokenizer)
    {
        mFilter->classifyMessage(tokenizer,
                                 mTokenSource.get(),
                                 mProTraits,
                                 mAntiTraits,
                                 mJunkListener,
                                 mTraitListener,
                                 mDetailListener);
        tokenizer.clearTokens();
        classifyNextMessage();
    }

    virtual void classifyNextMessage()
    {

      if (++mCurMessageToClassify < mNumMessagesToClassify && mMessageURIs[mCurMessageToClassify]) {
        PR_LOG(BayesianFilterLogModule, PR_LOG_WARNING, ("classifyNextMessage(%s)", mMessageURIs[mCurMessageToClassify]));
        mFilter->tokenizeMessage(mMessageURIs[mCurMessageToClassify], mMsgWindow, this);
      }
      else
      {
        // call all listeners with null parameters to signify end of batch
        if (mJunkListener)
          mJunkListener->OnMessageClassified(nsnull, nsnull, nsnull);
        if (mTraitListener)
          mTraitListener->OnMessageTraitsClassified(nsnull, nsnull, nsnull, nsnull);
        mTokenListener = nsnull; // this breaks the circular ref that keeps this object alive
                                 // so we will be destroyed as a result.
      }
    }

private:
    nsBayesianFilter* mFilter;
    nsCOMPtr<nsISupports> mSupports;
    nsCOMPtr<nsIJunkMailClassificationListener> mJunkListener;
    nsCOMPtr<nsIMsgTraitClassificationListener> mTraitListener;
    nsCOMPtr<nsIMsgTraitDetailListener> mDetailListener;
    nsTArray<PRUint32> mProTraits;
    nsTArray<PRUint32> mAntiTraits;
    nsCOMPtr<nsIMsgWindow> mMsgWindow;
    PRInt32 mNumMessagesToClassify;
    PRInt32 mCurMessageToClassify; // 0-based index
    char **mMessageURIs;
};

nsresult nsBayesianFilter::tokenizeMessage(const char* aMessageURI, nsIMsgWindow *aMsgWindow, TokenAnalyzer* aAnalyzer)
{

    nsCOMPtr <nsIMsgMessageService> msgService;
    nsresult rv = GetMessageServiceFromURI(nsDependentCString(aMessageURI), getter_AddRefs(msgService));
    NS_ENSURE_SUCCESS(rv, rv);

    aAnalyzer->setSource(aMessageURI);
    return msgService->StreamMessage(aMessageURI, aAnalyzer->mTokenListener,
                                     aMsgWindow, nsnull, PR_TRUE /* convert data */,
                                     NS_LITERAL_CSTRING("filter"), PR_FALSE, nsnull);
}

// a TraitAnalysis is the per-token representation of the statistical
// calculations, basically created to group information that is then
// sorted by mDistance
struct TraitAnalysis
{
  PRUint32 mTokenIndex;
  double mDistance;
  double mProbability;
};

// comparator required to sort an nsTArray
class compareTraitAnalysis
{
public:
  PRBool Equals(const TraitAnalysis& a, const TraitAnalysis& b) const
  {
    return a.mDistance == b.mDistance;
  }
  PRBool LessThan(const TraitAnalysis& a, const TraitAnalysis& b) const
  {
    return a.mDistance < b.mDistance;
  }
};

inline double dmax(double x, double y) { return (x > y ? x : y); }
inline double dmin(double x, double y) { return (x < y ? x : y); }

// Chi square functions are implemented by an incomplete gamma function.
// Note that chi2P's callers multiply the arguments by 2 but chi2P
// divides them by 2 again. Inlining chi2P gives the compiler a
// chance to notice this.

// Both chi2P and nsIncompleteGammaP set *error negative on domain
// errors and nsIncompleteGammaP sets it posivive on internal errors.
// This may be useful but the chi2P callers treat any error as fatal.

// Note that converting unsigned ints to floating point can be slow on
// some platforms (like Intel) so use signed quantities for the numeric
// routines.
static inline double chi2P (double chi2, double nu, PRInt32 *error)
{
    // domain checks; set error and return a dummy value
    if (chi2 < 0.0 || nu <= 0.0)
    {
        *error = -1;
        return 0.0;
    }
    // reversing the arguments is intentional
    return nsIncompleteGammaP (nu/2.0, chi2/2.0, error);
}

void nsBayesianFilter::classifyMessage(
  Tokenizer& tokenizer,
  const char* messageURI,
  nsTArray<PRUint32>& aProTraits,
  nsTArray<PRUint32>& aAntiTraits,
  nsIJunkMailClassificationListener* listener,
  nsIMsgTraitClassificationListener* aTraitListener,
  nsIMsgTraitDetailListener* aDetailListener)
{
    Token* tokens = tokenizer.copyTokens();
    PRUint32 tokenCount;
    if (!tokens)
    {
      // This can happen with problems with UTF conversion
      NS_ERROR("Trying to classify a null or invalid message");
      tokenCount = 0;
      // don't return so that we still call the listeners
    }
    else
    {
      tokenCount = tokenizer.countTokens();
    }

    if (aProTraits.Length() != aAntiTraits.Length())
    {
      NS_ERROR("Each Pro trait needs a matching Anti trait");
      return;
    }

    /* this part is similar to the Graham algorithm with some adjustments. */
    PRUint32 traitCount = aProTraits.Length();

    // pro message counts per trait index
    nsAutoTArray<PRUint32, kTraitAutoCapacity> numProMessages;
    // anti message counts per trait index
    nsAutoTArray<PRUint32, kTraitAutoCapacity> numAntiMessages;
    // construct the outgoing listener arrays
    nsAutoTArray<PRUint32, kTraitAutoCapacity> traits;
    nsAutoTArray<PRUint32, kTraitAutoCapacity> percents;
    if (traitCount > kTraitAutoCapacity)
    {
      traits.SetCapacity(traitCount);
      percents.SetCapacity(traitCount);
      numProMessages.SetCapacity(traitCount);
      numAntiMessages.SetCapacity(traitCount);
    }

    for (PRUint32 traitIndex = 0; traitIndex < traitCount; traitIndex++)
    {
      numProMessages.AppendElement(
        mCorpus.getMessageCount(aProTraits[traitIndex]));
      numAntiMessages.AppendElement(
        mCorpus.getMessageCount(aAntiTraits[traitIndex]));
    }

    for (PRUint32 i = 0; i < tokenCount; ++i)
    {
      Token& token = tokens[i];
      CorpusToken* t = mCorpus.get(token.mWord);
      if (!t)
        continue;
      for (PRUint32 traitIndex = 0; traitIndex < traitCount; traitIndex++)
      {
        double proCount =
          static_cast<double>(mCorpus.getTraitCount(t, aProTraits[traitIndex]));
        double antiCount =
          static_cast<double>(mCorpus.getTraitCount(t, aAntiTraits[traitIndex]));

        double prob, denom;
        // Prevent a divide by zero error by setting defaults for prob

        // If there are no matching tokens at all, ignore.
        if (antiCount == 0.0 && proCount == 0.0)
          continue;
        // if only anti match, set probability to 0%
        if (proCount == 0.0)
          prob = 0.0;
        // if only pro match, set probability to 100%
        else if (antiCount == 0.0)
          prob = 1.0;
        // not really needed, but just to be sure check the denom as well
        else if ((denom = proCount * numAntiMessages[traitIndex] +
                          antiCount * numProMessages[traitIndex]) == 0.0)
          continue;
        else
          prob = (proCount * numAntiMessages[traitIndex]) / denom;

        double n = proCount + antiCount;
        prob =  (0.225 + n * prob) / (.45 + n);
        double distance = PR_ABS(prob - 0.5);
        if (distance >= .1)
        {
          nsresult rv = setAnalysis(token, traitIndex, distance, prob);
          NS_ASSERTION(NS_SUCCEEDED(rv), "Problem in setAnalysis");
        }
      }
    }

    for (PRUint32 traitIndex = 0; traitIndex < traitCount; traitIndex++)
    {
      nsAutoTArray<TraitAnalysis, 1024> traitAnalyses;
      // copy valid tokens into an array to sort
      for (PRUint32 tokenIndex = 0; tokenIndex < tokenCount; tokenIndex++)
      {
        PRUint32 storeIndex = getAnalysisIndex(tokens[tokenIndex], traitIndex);
        if (storeIndex)
        {
          TraitAnalysis ta =
            {tokenIndex,
             mAnalysisStore[storeIndex].mDistance,
             mAnalysisStore[storeIndex].mProbability};
          traitAnalyses.AppendElement(ta);
        }
      }

      // sort the array by the distances
      traitAnalyses.Sort(compareTraitAnalysis());
      PRUint32 count = traitAnalyses.Length();
      PRUint32 first, last = count;
      const PRUint32 kMaxTokens = 150;
      first = ( count > kMaxTokens) ? count - kMaxTokens : 0;

      // Setup the arrays to save details if needed
      nsTArray<double> sArray;
      nsTArray<double> hArray;
      PRUint32 usedTokenCount = ( count > kMaxTokens) ? kMaxTokens : count;
      if (aDetailListener)
      {
        sArray.SetCapacity(usedTokenCount);
        hArray.SetCapacity(usedTokenCount);
      }

      double H = 1.0, S = 1.0;
      PRInt32 Hexp = 0, Sexp = 0;
      PRUint32 goodclues=0;
      int e;

      // index from end to analyze most significant first
      for (PRUint32 ip1 = last; ip1 != first; --ip1)
      {
        TraitAnalysis& ta = traitAnalyses[ip1 - 1];
        if (ta.mDistance > 0.0)
        {
          goodclues++;
          double value = ta.mProbability;
          S *= (1.0 - value);
          H *= value;
          if ( S < 1e-200 )
          {
            S = frexp(S, &e);
            Sexp += e;
          }
          if ( H < 1e-200 )
          {
            H = frexp(H, &e);
            Hexp += e;
          }
          PR_LOG(BayesianFilterLogModule, PR_LOG_WARNING,
                 ("token probability (%s) is %f",
                  tokens[ta.mTokenIndex].mWord, ta.mProbability));
        }
        if (aDetailListener)
        {
          sArray.AppendElement(log(S) + Sexp * M_LN2);
          hArray.AppendElement(log(H) + Hexp * M_LN2);
        }
      }

      S = log(S) + Sexp * M_LN2;
      H = log(H) + Hexp * M_LN2;

      double prob;
      if (goodclues > 0)
      {
          PRInt32 chi_error;
          S = chi2P(-2.0 * S, 2.0 * goodclues, &chi_error);
          if (!chi_error)
              H = chi2P(-2.0 * H, 2.0 * goodclues, &chi_error);
          // if any error toss the entire calculation
          if (!chi_error)
              prob = (S-H +1.0) / 2.0;
          else
              prob = 0.5;
      }
      else
          prob = 0.5;

      if (aDetailListener)
      {
        // Prepare output arrays
        nsTArray<PRUint32> tokenPercents(usedTokenCount);
        nsTArray<PRUint32> runningPercents(usedTokenCount);
        nsTArray<PRUnichar*> tokenStrings(usedTokenCount);

        double clueCount = 1.0;
        for (PRUint32 tokenIndex = 0; tokenIndex < usedTokenCount; tokenIndex++)
        {
          TraitAnalysis& ta = traitAnalyses[last - 1 - tokenIndex];
          double S, H;
          PRInt32 chi_error;
          S = chi2P(-2.0 * sArray[tokenIndex], 2.0 * clueCount, &chi_error);
          if (!chi_error)
            H = chi2P(-2.0 * hArray[tokenIndex], 2.0 * clueCount, &chi_error);
          clueCount += 1.0;
          double runningProb;
          if (!chi_error)
            runningProb = (S - H + 1.0) / 2.0;
          else
            runningProb = 0.5;
          runningPercents.AppendElement(static_cast<PRUint32>(runningProb *
              100. + .5));
          tokenPercents.AppendElement(static_cast<PRUint32>(ta.mProbability *
              100. + .5));
          tokenStrings.AppendElement(UTF8ToNewUnicode(nsDependentCString(
              tokens[ta.mTokenIndex].mWord)));
        }

        aDetailListener->OnMessageTraitDetails(messageURI, aProTraits[traitIndex],
            usedTokenCount, (const PRUnichar**)tokenStrings.Elements(),
            tokenPercents.Elements(), runningPercents.Elements());
        for (PRUint32 tokenIndex = 0; tokenIndex < usedTokenCount; tokenIndex++)
          NS_Free(tokenStrings[tokenIndex]);
      }

      PRUint32 proPercent = static_cast<PRUint32>(prob*100. + .5);

      // directly classify junk to maintain backwards compatibility
      if (aProTraits[traitIndex] == kJunkTrait)
      {
        PRBool isJunk = (prob >= mJunkProbabilityThreshold);
        PR_LOG(BayesianFilterLogModule, PR_LOG_ALWAYS,
               ("%s is junk probability = (%f)  HAM SCORE:%f SPAM SCORE:%f",
                messageURI, prob,H,S));

        // the algorithm in "A Plan For Spam" assumes that you have a large good
        // corpus and a large junk corpus.
        // that won't be the case with users who first use the junk mail trait
        // so, we do certain things to encourage them to train.
        //
        // if there are no good tokens, assume the message is junk
        // this will "encourage" the user to train
        // and if there are no bad tokens, assume the message is not junk
        // this will also "encourage" the user to train
        // see bug #194238

        if (listener && !mCorpus.getMessageCount(kGoodTrait))
          isJunk = PR_TRUE;
        else if (listener && !mCorpus.getMessageCount(kJunkTrait))
          isJunk = PR_FALSE;

        if (listener)
          listener->OnMessageClassified(messageURI, isJunk ?
            nsMsgJunkStatus(nsIJunkMailPlugin::JUNK) :
            nsMsgJunkStatus(nsIJunkMailPlugin::GOOD), proPercent);
      }

      if (aTraitListener)
      {
        traits.AppendElement(aProTraits[traitIndex]);
        percents.AppendElement(proPercent);
      }
    }

    if (aTraitListener)
      aTraitListener->OnMessageTraitsClassified(messageURI,
          traits.Length(), traits.Elements(), percents.Elements());

    delete[] tokens;
    // reuse mAnalysisStore without clearing memory
    mNextAnalysisIndex = 1;
    // but shrink it back to the default size
    if (mAnalysisStore.Length() > kAnalysisStoreCapacity)
      mAnalysisStore.RemoveElementsAt(kAnalysisStoreCapacity,
          mAnalysisStore.Length() - kAnalysisStoreCapacity);
    mAnalysisStore.Compact();
}

void nsBayesianFilter::classifyMessage(
  Tokenizer& tokens,
  const char* messageURI,
  nsIJunkMailClassificationListener* aJunkListener)
{
  nsAutoTArray<PRUint32, 1> proTraits;
  nsAutoTArray<PRUint32, 1> antiTraits;
  proTraits.AppendElement(kJunkTrait);
  antiTraits.AppendElement(kGoodTrait);
  classifyMessage(tokens, messageURI, proTraits, antiTraits,
    aJunkListener, nsnull, nsnull);
}

/* void shutdown (); */
NS_IMETHODIMP nsBayesianFilter::Shutdown()
{
  if (mTrainingDataDirty)
    mCorpus.writeTrainingData(mMaximumTokenCount);
  mTrainingDataDirty = PR_FALSE;

  return NS_OK;
}

/* readonly attribute boolean shouldDownloadAllHeaders; */
NS_IMETHODIMP nsBayesianFilter::GetShouldDownloadAllHeaders(PRBool *aShouldDownloadAllHeaders)
{
    // bayesian filters work on the whole msg body currently.
    *aShouldDownloadAllHeaders = PR_FALSE;
    return NS_OK;
}

/* void classifyMessage (in string aMsgURL, in nsIJunkMailClassificationListener aListener); */
NS_IMETHODIMP nsBayesianFilter::ClassifyMessage(const char *aMessageURL, nsIMsgWindow *aMsgWindow, nsIJunkMailClassificationListener *aListener)
{
    MessageClassifier* analyzer = new MessageClassifier(this, aListener, aMsgWindow, 1, &aMessageURL);
    if (!analyzer)
      return NS_ERROR_OUT_OF_MEMORY;
    TokenStreamListener *tokenListener = new TokenStreamListener(analyzer);
    if (!tokenListener)
      return NS_ERROR_OUT_OF_MEMORY;
    analyzer->setTokenListener(tokenListener);
    return tokenizeMessage(aMessageURL, aMsgWindow, analyzer);
}

/* void classifyMessages (in unsigned long aCount, [array, size_is (aCount)] in string aMsgURLs, in nsIJunkMailClassificationListener aListener); */
NS_IMETHODIMP nsBayesianFilter::ClassifyMessages(PRUint32 aCount, const char **aMsgURLs, nsIMsgWindow *aMsgWindow, nsIJunkMailClassificationListener *aListener)
{
    TokenAnalyzer* analyzer = new MessageClassifier(this, aListener, aMsgWindow, aCount, aMsgURLs);
    if (!analyzer)
      return NS_ERROR_OUT_OF_MEMORY;
    TokenStreamListener *tokenListener = new TokenStreamListener(analyzer);
    if (!tokenListener)
      return NS_ERROR_OUT_OF_MEMORY;
    analyzer->setTokenListener(tokenListener);
    return tokenizeMessage(aMsgURLs[0], aMsgWindow, analyzer);
}

nsresult nsBayesianFilter::setAnalysis(Token& token, PRUint32 aTraitIndex,
  double aDistance, double aProbability)
{
  PRUint32 nextLink = token.mAnalysisLink;
  PRUint32 lastLink = 0;
  PRUint32 linkCount = 0, maxLinks = 100;

  // try to find an existing element. Limit the search to maxLinks
  // as a precaution
  for (linkCount = 0; nextLink && linkCount < maxLinks; linkCount++)
  {
    AnalysisPerToken &rAnalysis = mAnalysisStore[nextLink];
    if (rAnalysis.mTraitIndex == aTraitIndex)
    {
      rAnalysis.mDistance = aDistance;
      rAnalysis.mProbability = aProbability;
      return NS_OK;
    }
    lastLink = nextLink;
    nextLink = rAnalysis.mNextLink;
  }
  if (linkCount >= maxLinks)
    return NS_ERROR_FAILURE;

  // trait does not exist, so add it

  AnalysisPerToken analysis(aTraitIndex, aDistance, aProbability);
  if (mAnalysisStore.Length() == mNextAnalysisIndex)
    mAnalysisStore.InsertElementAt(mNextAnalysisIndex, analysis);
  else if (mAnalysisStore.Length() > mNextAnalysisIndex)
    mAnalysisStore.ReplaceElementsAt(mNextAnalysisIndex, 1, analysis);
  else // we can only insert at the end of the array
    return NS_ERROR_FAILURE;

  if (lastLink)
    // the token had at least one link, so update the last link to point to
    // the new item
    mAnalysisStore[lastLink].mNextLink = mNextAnalysisIndex;
  else
    // need to update the token's first link
    token.mAnalysisLink = mNextAnalysisIndex;
  mNextAnalysisIndex++;
  return NS_OK;
}

PRUint32 nsBayesianFilter::getAnalysisIndex(Token& token, PRUint32 aTraitIndex)
{
  PRUint32 nextLink;
  PRUint32 linkCount = 0, maxLinks = 100;
  for (nextLink = token.mAnalysisLink; nextLink && linkCount < maxLinks; linkCount++)
  {
    AnalysisPerToken &rAnalysis = mAnalysisStore[nextLink];
    if (rAnalysis.mTraitIndex == aTraitIndex)
      return nextLink;
    nextLink = rAnalysis.mNextLink;
  }
  NS_ASSERTION(linkCount < maxLinks, "corrupt analysis store");

  // Trait not found, indicate by zero
  return 0;
}

NS_IMETHODIMP nsBayesianFilter::ClassifyTraitsInMessage(
  const char *aMsgURI,
  PRUint32 aTraitCount,
  PRUint32 *aProTraits,
  PRUint32 *aAntiTraits,
  nsIMsgTraitClassificationListener *aTraitListener,
  nsIMsgWindow *aMsgWindow,
  nsIJunkMailClassificationListener *aJunkListener)
{
  return ClassifyTraitsInMessages(1, &aMsgURI, aTraitCount, aProTraits,
    aAntiTraits, aTraitListener, aMsgWindow, aJunkListener);
}

NS_IMETHODIMP nsBayesianFilter::ClassifyTraitsInMessages(
  PRUint32 aCount,
  const char **aMsgURIs,
  PRUint32 aTraitCount,
  PRUint32 *aProTraits,
  PRUint32 *aAntiTraits,
  nsIMsgTraitClassificationListener *aTraitListener,
  nsIMsgWindow *aMsgWindow,
  nsIJunkMailClassificationListener *aJunkListener)
{
  nsAutoTArray<PRUint32, kTraitAutoCapacity> proTraits;
  nsAutoTArray<PRUint32, kTraitAutoCapacity> antiTraits;
  if (aTraitCount > kTraitAutoCapacity)
  {
    proTraits.SetCapacity(aTraitCount);
    antiTraits.SetCapacity(aTraitCount);
  }
  proTraits.AppendElements(aProTraits, aTraitCount);
  antiTraits.AppendElements(aAntiTraits, aTraitCount);

  MessageClassifier* analyzer = new MessageClassifier(this, aJunkListener,
    aTraitListener, nsnull, proTraits, antiTraits, aMsgWindow, aCount, aMsgURIs);
  if (!analyzer)
    return NS_ERROR_OUT_OF_MEMORY;

  TokenStreamListener *tokenListener = new TokenStreamListener(analyzer);
  if (!tokenListener)
    return NS_ERROR_OUT_OF_MEMORY;

  analyzer->setTokenListener(tokenListener);
  return tokenizeMessage(aMsgURIs[0], aMsgWindow, analyzer);
}

class MessageObserver : public TokenAnalyzer {
public:
  MessageObserver(nsBayesianFilter* filter,
                  nsTArray<PRUint32>& aOldClassifications,
                  nsTArray<PRUint32>& aNewClassifications,
                  nsIJunkMailClassificationListener* aJunkListener,
                  nsIMsgTraitClassificationListener* aTraitListener)
      :   mFilter(filter), mSupports(filter), mJunkListener(aJunkListener),
          mTraitListener(aTraitListener),
          mOldClassifications(aOldClassifications),
          mNewClassifications(aNewClassifications)
  {
  }

  virtual void analyzeTokens(Tokenizer& tokenizer)
  {
    mFilter->observeMessage(tokenizer, mTokenSource.get(), mOldClassifications,
                            mNewClassifications, mJunkListener, mTraitListener);
    // release reference to listener, which will allow us to go away as well.
    mTokenListener = nsnull;
  }

private:
  nsBayesianFilter* mFilter;
  nsCOMPtr<nsISupports> mSupports;
  nsCOMPtr<nsIJunkMailClassificationListener> mJunkListener;
  nsCOMPtr<nsIMsgTraitClassificationListener> mTraitListener;
  nsTArray<PRUint32> mOldClassifications;
  nsTArray<PRUint32> mNewClassifications;
};

NS_IMETHODIMP nsBayesianFilter::SetMsgTraitClassification(
    const char *aMsgURI,
    PRUint32 aOldCount,
    PRUint32 *aOldTraits,
    PRUint32 aNewCount,
    PRUint32 *aNewTraits,
    nsIMsgTraitClassificationListener *aTraitListener,
    nsIMsgWindow *aMsgWindow,
    nsIJunkMailClassificationListener *aJunkListener)
{
  nsAutoTArray<PRUint32, kTraitAutoCapacity> oldTraits;
  nsAutoTArray<PRUint32, kTraitAutoCapacity> newTraits;
  if (aOldCount > kTraitAutoCapacity)
    oldTraits.SetCapacity(aOldCount);
  if (aNewCount > kTraitAutoCapacity)
    newTraits.SetCapacity(aNewCount);
  oldTraits.AppendElements(aOldTraits, aOldCount);
  newTraits.AppendElements(aNewTraits, aNewCount);

  MessageObserver* analyzer = new MessageObserver(this, oldTraits,
    newTraits, aJunkListener, aTraitListener);
  if (!analyzer)
    return NS_ERROR_OUT_OF_MEMORY;
  TokenStreamListener *tokenListener = new TokenStreamListener(analyzer);
  if (!tokenListener)
    return NS_ERROR_OUT_OF_MEMORY;
  analyzer->setTokenListener(tokenListener);
  return tokenizeMessage(aMsgURI, aMsgWindow, analyzer);
}

// set new message classifications for a message
void nsBayesianFilter::observeMessage(
    Tokenizer& tokenizer,
    const char* messageURL,
    nsTArray<PRUint32>& oldClassifications,
    nsTArray<PRUint32>& newClassifications,
    nsIJunkMailClassificationListener* aJunkListener,
    nsIMsgTraitClassificationListener* aTraitListener)
{

    PRBool trainingDataWasDirty = mTrainingDataDirty;
    TokenEnumeration tokens = tokenizer.getTokens();

    // Uhoh...if the user is re-training then the message may already be classified and we are classifying it again with the same classification.
    // the old code would have removed the tokens for this message then added them back. But this really hurts the message occurrence
    // count for tokens if you just removed training.dat and are re-training. See Bug #237095 for more details.
    // What can we do here? Well we can skip the token removal step if the classifications are the same and assume the user is
    // just re-training. But this then allows users to re-classify the same message on the same training set over and over again
    // leading to data skew. But that's all I can think to do right now to address this.....
    PRUint32 oldLength = oldClassifications.Length();
    for (PRUint32 index = 0; index < oldLength; index++)
    {
      PRUint32 trait = oldClassifications.ElementAt(index);
      // skip removing if trait is also in the new set
      if (newClassifications.Contains(trait))
        continue;
      // remove the tokens from the token set it is currently in
      PRUint32 messageCount;
      messageCount = mCorpus.getMessageCount(trait);
      if (messageCount > 0)
      {
        mCorpus.setMessageCount(trait, messageCount - 1);
        mCorpus.forgetTokens(tokens, trait, 1);
        mTrainingDataDirty = PR_TRUE;
      }
    }

    nsMsgJunkStatus newClassification = nsIJunkMailPlugin::UNCLASSIFIED;
    PRUint32 junkPercent = 0; // 0 here is no possibility of meeting the classification
    PRUint32 newLength = newClassifications.Length();
    for (PRUint32 index = 0; index < newLength; index++)
    {
      PRUint32 trait = newClassifications.ElementAt(index);
      mCorpus.setMessageCount(trait, mCorpus.getMessageCount(trait) + 1);
      mCorpus.rememberTokens(tokens, trait, 1);
      mTrainingDataDirty = PR_TRUE;

      if (aJunkListener)
      {
        if (trait == kJunkTrait)
        {
          junkPercent = nsIJunkMailPlugin::IS_SPAM_SCORE;
          newClassification = nsIJunkMailPlugin::JUNK;
        }
        else if (trait == kGoodTrait)
        {
          junkPercent = nsIJunkMailPlugin::IS_HAM_SCORE;
          newClassification = nsIJunkMailPlugin::GOOD;
        }
      }
    }

    if (aJunkListener)
      aJunkListener->OnMessageClassified(messageURL, newClassification, junkPercent);

    if (aTraitListener)
    {
      // construct the outgoing listener arrays
      nsAutoTArray<PRUint32, kTraitAutoCapacity> traits;
      nsAutoTArray<PRUint32, kTraitAutoCapacity> percents;
      PRUint32 newLength = newClassifications.Length();
      if (newLength > kTraitAutoCapacity)
      {
        traits.SetCapacity(newLength);
        percents.SetCapacity(newLength);
      }
      traits.AppendElements(newClassifications);
      for (PRUint32 index = 0; index < newLength; index++)
        percents.AppendElement(100); // This is 100 percent, or certainty
      aTraitListener->OnMessageTraitsClassified(messageURL,
          traits.Length(), traits.Elements(), percents.Elements());
    }

    if (mTrainingDataDirty && !trainingDataWasDirty && ( mTimer != nsnull ))
    {
        // if training data became dirty just now, schedule flush
        // mMinFlushInterval msec from now
        PR_LOG(
            BayesianFilterLogModule, PR_LOG_DEBUG,
            ("starting training data flush timer %i msec", mMinFlushInterval));
        mTimer->InitWithFuncCallback(nsBayesianFilter::TimerCallback, this, mMinFlushInterval, nsITimer::TYPE_ONE_SHOT);
    }
}

NS_IMETHODIMP nsBayesianFilter::GetUserHasClassified(PRBool *aResult)
{
  *aResult = (  (mCorpus.getMessageCount(kGoodTrait) +
                 mCorpus.getMessageCount(kJunkTrait)) &&
                 mCorpus.countTokens());
  return NS_OK;
}

// Set message classification (only allows junk and good)
NS_IMETHODIMP nsBayesianFilter::SetMessageClassification(
    const char *aMsgURL,
    nsMsgJunkStatus aOldClassification,
    nsMsgJunkStatus aNewClassification,
    nsIMsgWindow *aMsgWindow,
    nsIJunkMailClassificationListener *aListener)
{
  nsAutoTArray<PRUint32, 1> oldClassifications;
  nsAutoTArray<PRUint32, 1> newClassifications;

  // convert between classifications and trait
  if (aOldClassification == nsIJunkMailPlugin::JUNK)
    oldClassifications.AppendElement(kJunkTrait);
  else if (aOldClassification == nsIJunkMailPlugin::GOOD)
    oldClassifications.AppendElement(kGoodTrait);
  if (aNewClassification == nsIJunkMailPlugin::JUNK)
    newClassifications.AppendElement(kJunkTrait);
  else if (aNewClassification == nsIJunkMailPlugin::GOOD)
    newClassifications.AppendElement(kGoodTrait);

  MessageObserver* analyzer = new MessageObserver(this, oldClassifications,
    newClassifications, aListener, nsnull);
  if (!analyzer)
    return NS_ERROR_OUT_OF_MEMORY;

  TokenStreamListener *tokenListener = new TokenStreamListener(analyzer);
  if (!tokenListener)
    return NS_ERROR_OUT_OF_MEMORY;

  analyzer->setTokenListener(tokenListener);
  return tokenizeMessage(aMsgURL, aMsgWindow, analyzer);
}

NS_IMETHODIMP nsBayesianFilter::ResetTrainingData()
{
  if (mCorpus)
    return mCorpus.resetTrainingData();
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsBayesianFilter::DetailMessage(const char *aMsgURI,
    PRUint32 aProTrait, PRUint32 aAntiTrait,
    nsIMsgTraitDetailListener *aDetailListener, nsIMsgWindow *aMsgWindow)
{
  nsAutoTArray<PRUint32, 1> proTraits;
  nsAutoTArray<PRUint32, 1> antiTraits;
  proTraits.AppendElement(aProTrait);
  antiTraits.AppendElement(aAntiTrait);

  MessageClassifier* analyzer = new MessageClassifier(this, nsnull,
    nsnull, aDetailListener, proTraits, antiTraits, aMsgWindow, 1, &aMsgURI);
  if (!analyzer)
    return NS_ERROR_OUT_OF_MEMORY;

  TokenStreamListener *tokenListener = new TokenStreamListener(analyzer);
  if (!tokenListener)
    return NS_ERROR_OUT_OF_MEMORY;

  analyzer->setTokenListener(tokenListener);
  return tokenizeMessage(aMsgURI, aMsgWindow, analyzer);
}

/* Corpus Store */

/*
    Format of the training file for version 1:
    [0xFEEDFACE]
    [number good messages][number bad messages]
    [number good tokens]
    [count][length of word]word
    ...
    [number bad tokens]
    [count][length of word]word
    ...

     Format of the trait file for version 1:
    [0xFCA93601]  (the 01 is the version)
    for each trait to write
      [id of trait to write] (0 means end of list)
      [number of messages per trait]
      for each token with non-zero count
        [count]
        [length of word]word
*/

CorpusStore::CorpusStore() :
  TokenHash(sizeof(CorpusToken)),
  mNextTraitIndex(1) // skip 0 since index=0 will mean end of linked list
{
  getTrainingFile(getter_AddRefs(mTrainingFile));
  mTraitStore.SetCapacity(kTraitStoreCapacity);
  TraitPerToken traitPT(0, 0);
  mTraitStore.AppendElement(traitPT); // dummy 0th element
}

CorpusStore::~CorpusStore()
{
}

inline int writeUInt32(FILE* stream, PRUint32 value)
{
    value = PR_htonl(value);
    return fwrite(&value, sizeof(PRUint32), 1, stream);
}

inline int readUInt32(FILE* stream, PRUint32* value)
{
    int n = fread(value, sizeof(PRUint32), 1, stream);
    if (n == 1) {
        *value = PR_ntohl(*value);
    }
    return n;
}

void CorpusStore::forgetTokens(TokenEnumeration tokens,
                    PRUint32 aTraitId, PRUint32 aCount)
{
  // if we are forgetting the tokens for a message, should only
  // subtract 1 from the occurrence count for that token in the training set
  // because we assume we only bumped the training set count once per messages
  // containing the token.
  while (tokens.hasMoreTokens())
  {
    CorpusToken* token = static_cast<CorpusToken*>(tokens.nextToken());
    remove(token->mWord, aTraitId, aCount);
  }
}

void CorpusStore::rememberTokens(TokenEnumeration tokens,
                    PRUint32 aTraitId, PRUint32 aCount)
{
  while (tokens.hasMoreTokens())
  {
    CorpusToken* token = static_cast<CorpusToken*>(tokens.nextToken());
    if (!token)
    {
      NS_ERROR("null token");
      continue;
    }
    add(token->mWord, aTraitId, aCount);
  }
}

PRBool CorpusStore::writeTokens(FILE* stream, PRBool shrink, PRUint32 aTraitId)
{
  PRUint32 tokenCount = countTokens();
  PRUint32 newTokenCount = 0;

  // calculate the tokens for this trait to write

  TokenEnumeration tokens = getTokens();
  for (PRUint32 i = 0; i < tokenCount; ++i)
  {
    CorpusToken* token = static_cast<CorpusToken*>(tokens.nextToken());
    PRUint32 count = getTraitCount(token, aTraitId);
    // Shrinking the token database is accomplished by dividing all token counts by 2.
    // If shrinking, we'll ignore counts < 2, otherwise only ignore counts of < 1
    if ((shrink && count > 1) || (!shrink && count))
      newTokenCount++;
  }

  if (writeUInt32(stream, newTokenCount) != 1)
    return PR_FALSE;

  if (newTokenCount > 0)
  {
    TokenEnumeration tokens = getTokens();
    for (PRUint32 i = 0; i < tokenCount; ++i)
    {
      CorpusToken* token = static_cast<CorpusToken*>(tokens.nextToken());
      PRUint32 wordCount = getTraitCount(token, aTraitId);
      if (shrink)
        wordCount /= 2;
      if (!wordCount)
        continue; // Don't output zero count words
      if (writeUInt32(stream, wordCount) != 1)
        return PR_FALSE;
      PRUint32 tokenLength = strlen(token->mWord);
      if (writeUInt32(stream, tokenLength) != 1)
        return PR_FALSE;
      if (fwrite(token->mWord, tokenLength, 1, stream) != 1)
        return PR_FALSE;
    }
  }
  return PR_TRUE;
}

PRBool CorpusStore::readTokens(FILE* stream, PRInt64 fileSize, PRUint32 aTraitId)
{
    PRUint32 tokenCount;
    if (readUInt32(stream, &tokenCount) != 1)
        return PR_FALSE;

    PRInt64 fpos = ftell(stream);
    if (fpos < 0)
        return PR_FALSE;

    PRUint32 bufferSize = 4096;
    char* buffer = new char[bufferSize];
    if (!buffer) return PR_FALSE;

    for (PRUint32 i = 0; i < tokenCount; ++i) {
        PRUint32 count;
        if (readUInt32(stream, &count) != 1)
            break;
        PRUint32 size;
        if (readUInt32(stream, &size) != 1)
            break;
        fpos += 8;
        if (fpos + size > fileSize) {
            delete[] buffer;
            return PR_FALSE;
        }
        if (size >= bufferSize) {
            delete[] buffer;
            while (size >= bufferSize) {
                bufferSize *= 2;
                if (bufferSize == 0)
                    return PR_FALSE;
            }
            buffer = new char[bufferSize];
            if (!buffer) return PR_FALSE;
        }
        if (fread(buffer, size, 1, stream) != 1)
            break;
        fpos += size;
        buffer[size] = '\0';
        add(buffer, aTraitId, count);
    }

    delete[] buffer;

    return PR_TRUE;
}

nsresult CorpusStore::getTrainingFile(nsILocalFile ** aTrainingFile)
{
  // should we cache the profile manager's directory?
  nsCOMPtr<nsIFile> profileDir;

  nsresult rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR, getter_AddRefs(profileDir));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = profileDir->Append(NS_LITERAL_STRING("training.dat"));
  NS_ENSURE_SUCCESS(rv, rv);

  return profileDir->QueryInterface(NS_GET_IID(nsILocalFile), (void **) aTrainingFile);
}

nsresult CorpusStore::getTraitFile(nsILocalFile ** aTraitFile)
{
  // should we cache the profile manager's directory?
  nsCOMPtr<nsIFile> profileDir;

  nsresult rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR, getter_AddRefs(profileDir));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = profileDir->Append(NS_LITERAL_STRING("traits.dat"));
  NS_ENSURE_SUCCESS(rv, rv);

  return profileDir->QueryInterface(NS_GET_IID(nsILocalFile), (void **) aTraitFile);
}

static const char kMagicCookie[] = { '\xFE', '\xED', '\xFA', '\xCE' };

// random string used to identify trait file and version (last byte is version)
static const char kTraitCookie[] = { '\xFC', '\xA9', '\x36', '\x01' };

void CorpusStore::writeTrainingData(PRInt32 aMaximumTokenCount)
{
  PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG, ("writeTrainingData() entered"));
  if (!mTrainingFile)
    return;

  /*
   * For backwards compatibility, write the good and junk tokens to
   * training.dat; additional traits are added to a different file
   */

  // open the file, and write out training data
  FILE* stream;
  nsresult rv = mTrainingFile->OpenANSIFileDesc("wb", &stream);
  if (NS_FAILED(rv))
    return;

  // If the number of tokens exceeds our limit, set the shrink flag
  PRBool shrink = false;
  if ((aMaximumTokenCount > 0) && // if 0, do not limit tokens
      (countTokens() > aMaximumTokenCount))
  {
    shrink = true;
    PR_LOG(BayesianFilterLogModule, PR_LOG_WARNING, ("shrinking token data file"));
  }

  // We implement shrink by dividing counts by two
  PRUint32 shrinkFactor = shrink ? 2 : 1;

  if (!((fwrite(kMagicCookie, sizeof(kMagicCookie), 1, stream) == 1) &&
      (writeUInt32(stream, getMessageCount(kGoodTrait) / shrinkFactor)) &&
      (writeUInt32(stream, getMessageCount(kJunkTrait) / shrinkFactor)) &&
       writeTokens(stream, shrink, kGoodTrait) &&
       writeTokens(stream, shrink, kJunkTrait)))
  {
    NS_WARNING("failed to write training data.");
    fclose(stream);
    // delete the training data file, since it is potentially corrupt.
    mTrainingFile->Remove(PR_FALSE);
  }
  else
  {
    fclose(stream);
  }

  /*
   * Write the remaining data to a second file traits.dat
   */

  if (!mTraitFile)
  {
    getTraitFile(getter_AddRefs(mTraitFile));
    if (!mTraitFile)
     return;
  }

  // open the file, and write out training data
  rv = mTraitFile->OpenANSIFileDesc("wb", &stream);
  if (NS_FAILED(rv))
    return;

  PRUint32 numberOfTraits = mMessageCounts.Length();
  PRBool error;
  while (1) // break on error or done
  {
    if (error = (fwrite(kTraitCookie, sizeof(kTraitCookie), 1, stream) != 1))
      break;

    for (PRUint32 index = 0; index < numberOfTraits; index++)
    {
      PRUint32 trait = mMessageCountsId[index];
      if (trait == 1 || trait == 2)
        continue; // junk traits are stored in training.dat
      if (error = (writeUInt32(stream, trait) != 1))
        break;
      if (error = (writeUInt32(stream, mMessageCounts[index] / shrinkFactor) != 1))
        break;
      if (error = !writeTokens(stream, shrink, trait))
        break;
    }
    break;
  }
  // we add a 0 at the end to represent end of trait list
  error = writeUInt32(stream, 0) != 1;

  fclose(stream);
  if (error)
  {
    NS_WARNING("failed to write trait data.");
    // delete the trait data file, since it is probably corrupt.
    mTraitFile->Remove(PR_FALSE);
  }

  if (shrink)
  {
    // We'll clear the tokens, and read them back in from the file.
    // Yes this is slower than in place, but this is a rare event.

    if (countTokens())
    {
      clearTokens();
      for (PRUint32 index = 0; index < numberOfTraits; index++)
        mMessageCounts[index] = 0;
    }

  readTrainingData();
  }
}

void CorpusStore::readTrainingData()
{

  /*
   * To maintain backwards compatibility, good and junk traits
   * are stored in a file "training.dat"
   */
  if (!mTrainingFile)
    return;

  PRBool exists;
  nsresult rv = mTrainingFile->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return;

  FILE* stream;
  rv = mTrainingFile->OpenANSIFileDesc("rb", &stream);
  if (NS_FAILED(rv))
    return;

  PRInt64 fileSize;
  rv = mTrainingFile->GetFileSize(&fileSize);
  if (NS_FAILED(rv))
    return;

  // FIXME:  should make sure that the tokenizers are empty.
  char cookie[4];
  PRUint32 goodMessageCount, junkMessageCount;
  if (!((fread(cookie, sizeof(cookie), 1, stream) == 1) &&
        (memcmp(cookie, kMagicCookie, sizeof(cookie)) == 0) &&
        (readUInt32(stream, &goodMessageCount) == 1) &&
        (readUInt32(stream, &junkMessageCount) == 1) &&
         readTokens(stream, fileSize, kGoodTrait) &&
         readTokens(stream, fileSize, kJunkTrait))) {
      NS_WARNING("failed to read training data.");
      PR_LOG(BayesianFilterLogModule, PR_LOG_ERROR, ("failed to read training data."));
  }
  setMessageCount(kGoodTrait, goodMessageCount);
  setMessageCount(kJunkTrait, junkMessageCount);

  fclose(stream);

  /*
   * Additional traits are stored in traits.dat
   */

  if (!mTraitFile)
  {
    getTraitFile(getter_AddRefs(mTraitFile));
    if (!mTraitFile)
     return;
  }

  rv = mTraitFile->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
    return;

  rv = mTraitFile->OpenANSIFileDesc("rb", &stream);
  if (NS_FAILED(rv))
    return;

  rv = mTraitFile->GetFileSize(&fileSize);
  if (NS_FAILED(rv))
    return;

  PRBool error;

  while(1) // break on error or done
  {
    if (error = (fread(cookie, sizeof(cookie), 1, stream) != 1))
      break;

    if (error = memcmp(cookie, kTraitCookie, sizeof(cookie)))
      break;

    PRUint32 trait;
    while ( !(error = (readUInt32(stream, &trait) != 1)) && trait)
    {
      PRUint32 count;
      if (error = (readUInt32(stream, &count) != 1))
        break;

      setMessageCount(trait, count);

      if (error = !readTokens(stream, fileSize, trait))
        break;
    }
    break;
  }
  if (error)
  {
    NS_WARNING("failed to read training data.");
    PR_LOG(BayesianFilterLogModule, PR_LOG_ERROR, ("failed to read training data."));
  }
  return;
}

nsresult CorpusStore::resetTrainingData()
{
  // clear out our in memory training tokens...
  if (countTokens())
    clearTokens();

  PRUint32 length = mMessageCounts.Length();
  for (PRUint32 index = 0 ; index < length; index++)
    mMessageCounts[index] = 0;

  if (mTrainingFile)
    mTrainingFile->Remove(PR_FALSE);
  if (mTraitFile)
    mTraitFile->Remove(PR_FALSE);
  return NS_OK;
}

inline CorpusToken* CorpusStore::get(const char* word)
{
  return static_cast<CorpusToken*>(TokenHash::get(word));
}

nsresult CorpusStore::updateTrait(CorpusToken* token, PRUint32 aTraitId,
                                  PRInt32 aCountChange)
{
  NS_ENSURE_ARG_POINTER(token);
  PRUint32 nextLink = token->mTraitLink;
  PRUint32 lastLink = 0;

  PRUint32 linkCount, maxLinks = 100; //sanity check
  for (linkCount = 0; nextLink && linkCount < maxLinks; linkCount++)
  {
    TraitPerToken& traitPT = mTraitStore[nextLink];
    if (traitPT.mId == aTraitId)
    {
      // be careful with signed versus unsigned issues here
      if (static_cast<PRInt32>(traitPT.mCount) + aCountChange > 0)
        traitPT.mCount += aCountChange;
      else
        traitPT.mCount = 0;
      // we could delete zero count traits here, but let's not. It's rare anyway.
      return NS_OK;
    }
    lastLink = nextLink;
    nextLink = traitPT.mNextLink;
  }
  if (linkCount >= maxLinks)
    return NS_ERROR_FAILURE;

  // trait does not exist, so add it

  if (aCountChange > 0) // don't set a negative count
  {
    TraitPerToken traitPT(aTraitId, aCountChange);
    if (mTraitStore.Length() == mNextTraitIndex)
      mTraitStore.InsertElementAt(mNextTraitIndex, traitPT);
    else if (mTraitStore.Length() > mNextTraitIndex)
      mTraitStore.ReplaceElementsAt(mNextTraitIndex, 1, traitPT);
    else
      return NS_ERROR_FAILURE;
    if (lastLink)
      // the token had a parent, so update it
      mTraitStore[lastLink].mNextLink = mNextTraitIndex;
    else
      // need to update the token's root link
      token->mTraitLink = mNextTraitIndex;
    mNextTraitIndex++;
  }
  return NS_OK;
}

PRUint32 CorpusStore::getTraitCount(CorpusToken* token, PRUint32 aTraitId)
{
  PRUint32 nextLink;
  if (!token || !(nextLink = token->mTraitLink))
    return 0;

  PRUint32 linkCount, maxLinks = 100; //sanity check
  for (linkCount = 0; nextLink && linkCount < maxLinks; linkCount++)
  {
    TraitPerToken& traitPT = mTraitStore[nextLink];
    if (traitPT.mId == aTraitId)
      return traitPT.mCount;
    nextLink = traitPT.mNextLink;
  }
  NS_ASSERTION(linkCount < maxLinks, "Corrupt trait count store");

  // trait not found (or error), so count is zero
  return 0;
}

CorpusToken* CorpusStore::add(const char* word, PRUint32 aTraitId, PRUint32 aCount)
{
  CorpusToken* token = static_cast<CorpusToken*>(TokenHash::add(word));
  if (token) {
    PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG,
           ("adding word to corpus store: %s (Trait=%d) (deltaCount=%d)",
            word, aTraitId, aCount));
    updateTrait(token, aTraitId, aCount);
  }
  return token;
 }

void CorpusStore::remove(const char* word, PRUint32 aTraitId, PRUint32 aCount)
{
  PR_LOG(BayesianFilterLogModule, PR_LOG_DEBUG,
         ("remove word: %s (TraitId=%d) (Count=%d)",
         word, aTraitId, aCount));
  CorpusToken* token = get(word);
  if (token)
    updateTrait(token, aTraitId, -static_cast<PRInt32>(aCount));
}

PRUint32 CorpusStore::getMessageCount(PRUint32 aTraitId)
{
  const PRUint32 kNoIndex = PRUint32(-1);
  PRUint32 index = mMessageCountsId.IndexOf(aTraitId);
  if (index == kNoIndex)
    return 0;
  return mMessageCounts.ElementAt(index);
}

void CorpusStore::setMessageCount(PRUint32 aTraitId, PRUint32 aCount)
{
  const PRUint32 kNoIndex = PRUint32(-1);
  PRUint32 index = mMessageCountsId.IndexOf(aTraitId);
  if (index == kNoIndex)
  {
    mMessageCounts.AppendElement(aCount);
    mMessageCountsId.AppendElement(aTraitId);
  }
  else
  {
    mMessageCounts[index] = aCount;
  }
}
