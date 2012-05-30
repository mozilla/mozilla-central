/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMovemailIncomingServer_h
#define __nsMovemailIncomingServer_h

#include "msgCore.h"
#include "nsIMovemailIncomingServer.h"
#include "nsILocalMailIncomingServer.h"
#include "nsMailboxServer.h"

/* get some implementation from nsMsgIncomingServer */
class nsMovemailIncomingServer : public nsMailboxServer,
                                 public nsIMovemailIncomingServer,
                                 public nsILocalMailIncomingServer

{
public:
    NS_DECL_ISUPPORTS_INHERITED
    NS_DECL_NSIMOVEMAILINCOMINGSERVER
    NS_DECL_NSILOCALMAILINCOMINGSERVER

    nsMovemailIncomingServer();
    virtual ~nsMovemailIncomingServer();

    NS_IMETHOD PerformBiff(nsIMsgWindow *aMsgWindow);
    NS_IMETHOD GetDownloadMessagesAtStartup(bool *getMessages);
    NS_IMETHOD GetCanBeDefaultServer(bool *canBeDefaultServer);
    NS_IMETHOD GetCanSearchMessages(bool *canSearchMessages);
    NS_IMETHOD GetServerRequiresPasswordForBiff(bool *aServerRequiresPasswordForBiff);
    NS_IMETHOD GetAccountManagerChrome(nsAString& aResult);
};


#endif
