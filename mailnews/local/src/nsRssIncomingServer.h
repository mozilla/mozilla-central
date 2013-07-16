/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsRssIncomingServer_h
#define __nsRssIncomingServer_h

#include "mozilla/Attributes.h"
#include "nsIRssIncomingServer.h"
#include "nsILocalMailIncomingServer.h"
#include "nsMsgIncomingServer.h"
#include "nsIMsgFolderListener.h"
#include "nsMailboxServer.h"

class nsRssIncomingServer : public nsMailboxServer,
                            public nsIRssIncomingServer,
                            public nsILocalMailIncomingServer,
                            public nsIMsgFolderListener

{
public:
    NS_DECL_ISUPPORTS_INHERITED
    NS_DECL_NSIRSSINCOMINGSERVER
    NS_DECL_NSILOCALMAILINCOMINGSERVER
    NS_DECL_NSIMSGFOLDERLISTENER

    NS_IMETHOD GetOfflineSupportLevel(int32_t *aSupportLevel) MOZ_OVERRIDE;
    NS_IMETHOD GetSupportsDiskSpace(bool *aSupportsDiskSpace) MOZ_OVERRIDE;
    NS_IMETHOD GetAccountManagerChrome(nsAString& aResult) MOZ_OVERRIDE;
    NS_IMETHOD PerformBiff(nsIMsgWindow *aMsgWindow) MOZ_OVERRIDE;
    NS_IMETHOD GetServerRequiresPasswordForBiff(bool *aServerRequiresPasswordForBiff
						) MOZ_OVERRIDE;
    NS_IMETHOD GetCanSearchMessages(bool *canSearchMessages) MOZ_OVERRIDE;
    NS_IMETHOD GetSortOrder(int32_t* aSortOrder) MOZ_OVERRIDE;

    nsRssIncomingServer();
    virtual ~nsRssIncomingServer();
protected:
    nsresult FolderChanged(nsIMsgFolder *aFolder, bool aUnsubscribe);
    nsresult FillInDataSourcePath(const nsAString& aDataSourceName, nsIFile ** aLocation);
    static nsrefcnt gInstanceCount;
};

#endif /* __nsRssIncomingServer_h */
