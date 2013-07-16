/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgTxn_h__
#define nsMsgTxn_h__

#include "mozilla/Attributes.h"
#include "nsITransaction.h"
#include "msgCore.h"
#include "nsCOMPtr.h"
#include "nsIMsgWindow.h"
#include "nsInterfaceHashtable.h"
#include "MailNewsTypes2.h"
#include "nsIVariant.h"
#include "nsIWritablePropertyBag.h"
#include "nsIWritablePropertyBag2.h"

#define NS_MESSAGETRANSACTION_IID \
{ /* da621b30-1efc-11d3-abe4-00805f8ac968 */ \
    0xda621b30, 0x1efc, 0x11d3, \
  { 0xab, 0xe4, 0x00, 0x80, 0x5f, 0x8a, 0xc9, 0x68 } }
/**
 * base class for all message undo/redo transactions.
 */

#undef  IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_DEFAULT

class NS_MSG_BASE nsMsgTxn : public nsITransaction, 
                             public nsIWritablePropertyBag,
                             public nsIWritablePropertyBag2
{
public:
    nsMsgTxn();
    virtual ~nsMsgTxn();

    nsresult Init();

    NS_IMETHOD DoTransaction(void) MOZ_OVERRIDE;

    NS_IMETHOD UndoTransaction(void) MOZ_OVERRIDE = 0;

    NS_IMETHOD RedoTransaction(void) MOZ_OVERRIDE = 0;
    
    NS_IMETHOD GetIsTransient(bool *aIsTransient) MOZ_OVERRIDE;

    NS_IMETHOD Merge(nsITransaction *aTransaction, bool *aDidMerge) MOZ_OVERRIDE;

    nsresult GetMsgWindow(nsIMsgWindow **msgWindow);
    nsresult SetMsgWindow(nsIMsgWindow *msgWindow);
    nsresult SetTransactionType(uint32_t txnType);
 
    NS_DECL_ISUPPORTS
    NS_DECL_NSIPROPERTYBAG
    NS_DECL_NSIPROPERTYBAG2
    NS_DECL_NSIWRITABLEPROPERTYBAG
    NS_DECL_NSIWRITABLEPROPERTYBAG2

protected:
    // a hash table of string -> nsIVariant
    nsInterfaceHashtable<nsStringHashKey, nsIVariant> mPropertyHash;
    nsCOMPtr<nsIMsgWindow> m_msgWindow;
    uint32_t m_txnType;
    nsresult CheckForToggleDelete(nsIMsgFolder *aFolder, const nsMsgKey &aMsgKey, bool *aResult);
};

#undef  IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_HIDDEN

#endif
