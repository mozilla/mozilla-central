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

#ifndef nsBayesianFilter_h__
#define nsBayesianFilter_h__

#include <stdio.h>
#include "nsCOMPtr.h"
#include "nsIMsgFilterPlugin.h"
#include "nsISemanticUnitScanner.h"
#include "pldhash.h"
#include "nsITimer.h"
#include "nsTArray.h"
#include "nsStringGlue.h"

// XXX can't simply byte align arenas, must at least 2-byte align.
#define PL_ARENA_CONST_ALIGN_MASK 1
#include "plarena.h"

#define DEFAULT_MIN_INTERVAL_BETWEEN_WRITES             15*60*1000

struct Token;
class TokenEnumeration;
class TokenAnalyzer;
class nsIMsgWindow;
class nsIMimeHeaders;
class nsIUTF8StringEnumerator;
struct BaseToken;
struct CorpusToken;

/**
 * Helper class to enumerate Token objects in a PLDHashTable
 * safely and without copying (see bugzilla #174859). The
 * enumeration is safe to use until a PL_DHASH_ADD
 * or PL_DHASH_REMOVE is performed on the table.
 */
class TokenEnumeration {
public:
    TokenEnumeration(PLDHashTable* table);
    PRBool hasMoreTokens();
    BaseToken* nextToken();

private:
    PRUint32 mEntrySize, mEntryCount, mEntryOffset;
    char *mEntryAddr, *mEntryLimit;
};

// A trait is some aspect of a message, like being junk or tagged as
// Personal, that the statistical classifier should track. The Trait
// structure is a per-token representation of information pertaining to
// a message trait.
//
// Traits per token are maintained as a linked list.
//
struct TraitPerToken
{
  PRUint32 mId;          // identifying number for a trait
  PRUint32 mCount;       // count of messages with this token and trait
  PRUint32 mNextLink;    // index in mTraitStore for the next trait, or 0
                         // for none
  TraitPerToken(PRUint32 aId, PRUint32 aCount); // inititializer
};

// An Analysis is the statistical results for a particular message, a
// particular token, and for a particular pair of trait/antitrait, that
// is then used in subsequent analysis to score the message.
//
// Analyses per token are maintained as a linked list.
//
struct AnalysisPerToken
{
  PRUint32 mTraitIndex;    // index representing a protrait/antitrait pair.
                           // So if we are analyzing 3 different traits, then
                           // the first trait is 0, the second 1, etc.
  double mDistance;        // absolute value of mProbability - 0.5
  double mProbability;     // relative indicator of match of trait to token
  PRUint32 mNextLink;      // index in mAnalysisStore for the Analysis object
                           // for the next trait index, or 0 for none.
  // initializer
  AnalysisPerToken(PRUint32 aTraitIndex, double aDistance, double aProbability);
};

class TokenHash {
public:

    virtual ~TokenHash();
    /**
     * Clears out the previous message tokens.
     */
    nsresult clearTokens();
    operator int() { return mTokenTable.entryStore != NULL; }
    PRUint32 countTokens();
    TokenEnumeration getTokens();
    BaseToken* add(const char* word);

protected:
    TokenHash(PRUint32 entrySize);
    PLArenaPool mWordPool;
    PRUint32 mEntrySize;
    PLDHashTable mTokenTable;
    char* copyWord(const char* word, PRUint32 len);
    /**
     * Calls passed-in function for each token in the table.
     */
    void visit(PRBool (*f) (BaseToken*, void*), void* data);
    BaseToken* get(const char* word);

};

class Tokenizer: public TokenHash {
public:
    Tokenizer();
    ~Tokenizer();

    Token* get(const char* word);

    // The training set keeps an occurrence count on each word. This count
    // is supposed to count the # of messsages it occurs in.
    // When add/remove is called while tokenizing a message and NOT the training set,
    //
    Token* add(const char* word, PRUint32 count = 1);

    Token* copyTokens();

    void tokenize(const char* text);

    /**
     *  Creates specific tokens based on the mime headers for the message being tokenized
     */
    void tokenizeHeaders(nsIUTF8StringEnumerator * aHeaderNames, nsIUTF8StringEnumerator * aHeaderValues);

    void tokenizeAttachment(const char * aContentType, const char * aFileName);

    nsCString mBodyDelimiters; // delimiters for body tokenization
    nsCString mHeaderDelimiters; // delimiters for header tokenization

    // arrays of extra headers to tokenize / to not tokenize
    nsTArray<nsCString> mEnabledHeaders;
    nsTArray<nsCString> mDisabledHeaders;
    // Delimiters used in tokenizing a particular header.
    // Parallel array to mEnabledHeaders
    nsTArray<nsCString> mEnabledHeadersDelimiters;
    PRBool mCustomHeaderTokenization; // Are there any preference-set tokenization customizations?
    PRInt32 mMaxLengthForToken; // maximum length of a token
    // should we convert iframe to div during tokenization?
    PRBool mIframeToDiv;

private:

    void tokenize_ascii_word(char * word);
    void tokenize_japanese_word(char* chunk);
    inline void addTokenForHeader(const char * aTokenPrefix, nsACString& aValue,
        PRBool aTokenizeValue = false, const char* aDelimiters = nsnull);
    nsresult stripHTML(const nsAString& inString, nsAString& outString);
    // helper function to escape \n, \t, etc from a CString
    void UnescapeCString(nsCString& aCString);

private:
    nsCOMPtr<nsISemanticUnitScanner> mScanner;
};

/**
 * Implements storage of a collection of message tokens and counts for
 * a corpus of classified messages
 */

class CorpusStore: public TokenHash {
public:
    CorpusStore();
    ~CorpusStore();

    /**
     * retrieve the token structure for a particular string
     *
     * @param word  the character representation of the token
     *
     * @return      token structure containing counts, null if not found
     */
    CorpusToken* get(const char* word);

    /**
     * add tokens to the storage, or increment counts if already exists.
     *
     * @param tokens     enumerator for the list of tokens to remember
     * @param aTraitId   id for the trait whose counts will be remembered
     * @param aCount     number of new messages represented by the token list
     */
    void rememberTokens(TokenEnumeration tokens, PRUint32 aTraitId, PRUint32 aCount);

    /**
     * decrement counts for tokens in the storage, removing if all counts
     * are zero
     *
     * @param tokens     enumerator for the list of tokens to forget
     * @param aTraitId   id for the trait whose counts will be removed
     * @param aCount     number of messages represented by the token list
     */
    void forgetTokens(TokenEnumeration tokens, PRUint32 aTraitId, PRUint32 aCount);

    /**
     * write the corpus information to file storage
     *
     * @param aMaximumTokenCount  prune tokens if number of tokens exceeds
     *                            this value.  == 0  for no pruning
     */
    void writeTrainingData(PRInt32 aMaximumTokenCount);

    /**
     * read the corpus information from file storage
     */
    void readTrainingData();

    /**
     * delete the local corpus storage file and data
     */
    nsresult resetTrainingData();

    /**
     * get the count of messages whose tokens are stored that are associated
     * with a trait
     *
     * @param aTraitId  identifier for the trait
     * @return          number of messages for that trait
     */
    PRUint32 getMessageCount(PRUint32 aTraitId);

    /**
     * set the count of messages whose tokens are stored that are associated
     * with a trait
     *
     * @param aTraitId  identifier for the trait
     * @param aCount    number of messages for that trait
     */
    void setMessageCount(PRUint32 aTraitId, PRUint32 aCount);

    /**
     * get the count of messages associated with a particular token and trait
     *
     * @param  token     the token string and associated counts
     * @param  aTraitId  identifier for the trait
     */
    PRUint32 getTraitCount(CorpusToken *token, PRUint32 aTraitId);

protected:

    /**
     * return the local corpus storage file for junk traits
     */
    nsresult getTrainingFile(nsILocalFile ** aFile);

    /**
     * return the local corpus storage file for non-junk traits
     */
    nsresult getTraitFile(nsILocalFile ** aFile);

    /**
     * read token strings from the data file
     */
    PRBool readTokens(FILE* stream, PRInt64 fileSize, PRUint32 aTraitId);

    /**
     * write token strings to the data file
     */
    PRBool writeTokens(FILE* stream, PRBool shrink, PRUint32 aTraitId);

    /**
     * remove counts for a token string
     */
    void remove(const char* word, PRUint32 aTraitId, PRUint32 aCount);

    /**
     * add counts for a token string, adding the token string if new
     */
    CorpusToken* add(const char* word, PRUint32 aTraitId, PRUint32 aCount);

    /**
     * change counts in a trait in the traits array, adding the trait if needed
     */
    nsresult updateTrait(CorpusToken* token, PRUint32 aTraitId,
      PRInt32 aCountChange);
    nsCOMPtr<nsILocalFile> mTrainingFile;  // file used to store junk training data
    nsCOMPtr<nsILocalFile> mTraitFile;     // file used to store non-junk
                                           // training data
    nsTArray<TraitPerToken> mTraitStore;   // memory for linked-list of counts
    PRUint32 mNextTraitIndex;              // index in mTraitStore to first empty
                                           // TraitPerToken
    nsTArray<PRUint32> mMessageCounts;     // count of messages per trait
                                           // represented in the store
    nsTArray<PRUint32> mMessageCountsId;   // Parallel array to mMessageCounts, with
                                           // the corresponding trait ID
};

class nsBayesianFilter : public nsIJunkMailPlugin {
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIMSGFILTERPLUGIN
    NS_DECL_NSIJUNKMAILPLUGIN

    nsBayesianFilter();
    virtual ~nsBayesianFilter();

    nsresult tokenizeMessage(const char* messageURI, nsIMsgWindow *aMsgWindow, TokenAnalyzer* analyzer);
    void classifyMessage(Tokenizer& tokens, const char* messageURI,
                        nsIJunkMailClassificationListener* listener);

    void classifyMessage(
      Tokenizer& tokenizer,
      const char* messageURI,
      nsTArray<PRUint32>& aProTraits,
      nsTArray<PRUint32>& aAntiTraits,
      nsIJunkMailClassificationListener* listener,
      nsIMsgTraitClassificationListener* aTraitListener,
      nsIMsgTraitDetailListener* aDetailListener);

    void observeMessage(Tokenizer& tokens, const char* messageURI,
                        nsTArray<PRUint32>& oldClassifications,
                        nsTArray<PRUint32>& newClassifications,
                        nsIJunkMailClassificationListener* listener,
                        nsIMsgTraitClassificationListener* aTraitListener);


protected:

    static void TimerCallback(nsITimer* aTimer, void* aClosure);

    CorpusStore mCorpus;
    double   mJunkProbabilityThreshold;
    PRInt32 mMaximumTokenCount;
    PRPackedBool mTrainingDataDirty;
    PRInt32 mMinFlushInterval; // in milliseconds, must be positive
                               //and not too close to 0
    nsCOMPtr<nsITimer> mTimer;

    // index in mAnalysisStore for first empty AnalysisPerToken
    PRUint32 mNextAnalysisIndex;
     // memory for linked list of AnalysisPerToken objects
    nsTArray<AnalysisPerToken> mAnalysisStore;
    /**
     * Determine the location in mAnalysisStore where the AnalysisPerToken
     * object for a particular token and trait is stored
     */
    PRUint32 getAnalysisIndex(Token& token, PRUint32 aTraitIndex);
    /**
     * Set the value of the AnalysisPerToken object for a particular
     * token and trait
     */
    nsresult setAnalysis(Token& token, PRUint32 aTraitIndex,
                         double aDistance, double aProbability);
};

#endif // _nsBayesianFilter_h__
