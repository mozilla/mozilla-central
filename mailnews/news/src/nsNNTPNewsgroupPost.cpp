/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...

#include "nsINNTPNewsgroupPost.h"
#include "nsNNTPNewsgroupPost.h"

#include "nsISupportsObsolete.h"

#include "plstr.h"
#include "prmem.h"

NS_IMPL_ISUPPORTS1(nsNNTPNewsgroupPost, nsINNTPNewsgroupPost)

nsNNTPNewsgroupPost::nsNNTPNewsgroupPost()
{
  int i;
  for (i=0; i <= HEADER_LAST; i++)
    m_header[i]=nullptr;

  m_body=nullptr;
  m_messageBuffer=nullptr;

  m_isControl=false;
}

nsNNTPNewsgroupPost::~nsNNTPNewsgroupPost()
{
    int i;
    for (i=0; i<=HEADER_LAST; i++)
        PR_FREEIF(m_header[i]);

    PR_FREEIF(m_body);
    PR_FREEIF(m_messageBuffer);
}

static char *
AppendAndAlloc(char *string, const char *newSubstring, bool withComma)
{
    if (!newSubstring) return NULL;
    
    if (!string) return PL_strdup(newSubstring);
    
    char *separator = (char *) (withComma ? ", " : " ");
    char *oldString = string;
    
    string = (char *)PR_Calloc(PL_strlen(oldString) +
                               PL_strlen(separator) +
                               PL_strlen(newSubstring) + 1,
                               sizeof(char));
    
    PL_strcpy(string, oldString);
    PL_strcat(string, separator);
    PL_strcat(string, newSubstring);

    PR_Free(oldString);
    return string;
}

nsresult
nsNNTPNewsgroupPost::AddNewsgroup(const char *newsgroup)
{
    m_header[IDX_HEADER_NEWSGROUPS]=AppendAndAlloc(m_header[IDX_HEADER_NEWSGROUPS], newsgroup, true);
    return NS_OK;
}


// the message can be stored in a file....allow accessors for getting and setting
// the file name to post...
nsresult
nsNNTPNewsgroupPost::SetPostMessageFile(nsIFile * aPostMessageFile)
{
  NS_LOCK_INSTANCE();
  m_postMessageFile = aPostMessageFile;
  NS_UNLOCK_INSTANCE();
  return NS_OK;
}

nsresult 
nsNNTPNewsgroupPost::GetPostMessageFile(nsIFile ** aPostMessageFile)
{
  NS_LOCK_INSTANCE();
  if (aPostMessageFile)
    NS_IF_ADDREF(*aPostMessageFile = m_postMessageFile);
  NS_UNLOCK_INSTANCE();
  return NS_OK;
}
