/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"  // for pre-compiled headers

#include "nsImapCore.h"
#include "nsImapSearchResults.h"
#include "prmem.h"
#include "nsCRT.h"

nsImapSearchResultSequence::nsImapSearchResultSequence()
{
}

nsImapSearchResultSequence *nsImapSearchResultSequence::CreateSearchResultSequence()
{
  return new nsImapSearchResultSequence;
}

void nsImapSearchResultSequence::Clear(void)
{
  if (mImpl) 
  {
    int32_t i = mImpl->mCount;
    while (0 <= --i) 
    {
      char* string = (char*)mImpl->mArray[i];
      PR_Free(string);
    }
    nsVoidArray::Clear();
  }
}

nsImapSearchResultSequence::~nsImapSearchResultSequence()
{
  Clear();
}


void nsImapSearchResultSequence::ResetSequence()
{
  Clear();
}

void nsImapSearchResultSequence::AddSearchResultLine(const char *searchLine)
{
  // The first add becomes node 2.  Fix this.
  char *copiedSequence = PL_strdup(searchLine + 9); // 9 == "* SEARCH "
  
  if (copiedSequence)	// if we can't allocate this then the search won't hit
    AppendElement(copiedSequence);
}


nsImapSearchResultIterator::nsImapSearchResultIterator(nsImapSearchResultSequence &sequence) :
fSequence(sequence)
{
  ResetIterator();
}

nsImapSearchResultIterator::~nsImapSearchResultIterator()
{
}

void  nsImapSearchResultIterator::ResetIterator()
{
  fSequenceIndex = 0;
  fCurrentLine = (char *) fSequence.SafeElementAt(fSequenceIndex);
  fPositionInCurrentLine = fCurrentLine;
}

int32_t nsImapSearchResultIterator::GetNextMessageNumber()
{
  int32_t returnValue = 0;
  if (fPositionInCurrentLine)
  {	
    returnValue = atoi(fPositionInCurrentLine);
    
    // eat the current number
    while (isdigit(*++fPositionInCurrentLine))
      ;
    
    if (*fPositionInCurrentLine == 0xD)	// found CR, no more digits on line
    {
      fCurrentLine = (char *) fSequence.SafeElementAt(++fSequenceIndex);
      fPositionInCurrentLine = fCurrentLine;
    }
    else	// eat the space
      fPositionInCurrentLine++;
  }
  
  return returnValue;
}
