/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImapSearchResults_h___
#define nsImapSearchResults_h___

#include "nsVoidArray.h"

class nsImapSearchResultSequence : public nsVoidArray
{
public:
    virtual ~nsImapSearchResultSequence();
    static nsImapSearchResultSequence *CreateSearchResultSequence();
    
    virtual void AddSearchResultLine(const char *searchLine);
    virtual void ResetSequence();
    void  Clear();
    
    friend class nsImapSearchResultIterator;
private:
    nsImapSearchResultSequence();
};

class nsImapSearchResultIterator {
public:
    nsImapSearchResultIterator(nsImapSearchResultSequence &sequence);
    virtual ~nsImapSearchResultIterator();
    
    void  ResetIterator();
    int32_t GetNextMessageNumber();   // returns 0 at end of list
private:
    nsImapSearchResultSequence &fSequence;
    int32_t fSequenceIndex;
    char  *fCurrentLine;
    char  *fPositionInCurrentLine;
};



#endif
