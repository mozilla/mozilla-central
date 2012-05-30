/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImapFlagAndUidState_h___
#define nsImapFlagAndUidState_h___

#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIImapFlagAndUidState.h"
#include "mozilla/Mutex.h"

const PRInt32 kImapFlagAndUidStateSize =	100;

#include "nsBaseHashtable.h"
#include "nsDataHashtable.h"

class nsImapFlagAndUidState : public nsIImapFlagAndUidState
{
public:
    NS_DECL_ISUPPORTS
    nsImapFlagAndUidState(int numberOfMessages);
    virtual ~nsImapFlagAndUidState();

    NS_DECL_NSIIMAPFLAGANDUIDSTATE

    PRInt32               NumberOfDeletedMessages();
    
    imapMessageFlagsType  GetMessageFlagsFromUID(PRUint32 uid, bool *foundIt, PRInt32 *ndx);

    bool         IsLastMessageUnseen(void);
    bool         GetPartialUIDFetch() {return fPartialUIDFetch;}
    void         SetPartialUIDFetch(bool isPartial) {fPartialUIDFetch = isPartial;}
    PRUint32     GetHighestNonDeletedUID();
    PRUint16     GetSupportedUserFlags() { return fSupportedUserFlags; }

private:

  static PLDHashOperator FreeCustomFlags(const PRUint32 &aKey, char *aData, void *closure);
    nsTArray<nsMsgKey>      fUids;
    nsTArray<imapMessageFlagsType> fFlags;
    // Hash table, mapping uids to extra flags
    nsDataHashtable<nsUint32HashKey, char *> m_customFlagsHash;
    PRUint16                fSupportedUserFlags;
    PRInt32                 fNumberDeleted;
    bool                    fPartialUIDFetch;
    mozilla::Mutex mLock;
};




#endif
