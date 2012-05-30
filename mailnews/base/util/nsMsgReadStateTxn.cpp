/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgReadStateTxn.h"

#include "nsIMutableArray.h"
#include "nsIMsgHdr.h"
#include "nsComponentManagerUtils.h"


nsMsgReadStateTxn::nsMsgReadStateTxn()
{
}

nsMsgReadStateTxn::~nsMsgReadStateTxn()
{
}

nsresult
nsMsgReadStateTxn::Init(nsIMsgFolder *aParentFolder,
                        PRUint32 aNumKeys,
                        nsMsgKey *aMsgKeyArray)
{
  NS_ENSURE_ARG_POINTER(aParentFolder);

  mParentFolder = aParentFolder;
  mMarkedMessages.AppendElements(aMsgKeyArray, aNumKeys);

  return nsMsgTxn::Init();
}

NS_IMETHODIMP 
nsMsgReadStateTxn::UndoTransaction()
{
  return MarkMessages(false);
}

NS_IMETHODIMP 
nsMsgReadStateTxn::RedoTransaction()
{
  return MarkMessages(true);
}

NS_IMETHODIMP
nsMsgReadStateTxn::MarkMessages(bool aAsRead)
{
  nsresult rv;
  nsCOMPtr<nsIMutableArray> messageArray = 
    do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 length = mMarkedMessages.Length();
  for (PRUint32 i = 0; i < length; i++) {
    nsCOMPtr<nsIMsgDBHdr> curMsgHdr;
    rv = mParentFolder->GetMessageHeader(mMarkedMessages[i], 
                                         getter_AddRefs(curMsgHdr));
    if (NS_SUCCEEDED(rv) && curMsgHdr) {
      messageArray->AppendElement(curMsgHdr, false);
    }
  }

  return mParentFolder->MarkMessagesRead(messageArray, aAsRead);
}

