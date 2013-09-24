/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsNntpIncomingServer_h
#define __nsNntpIncomingServer_h

#include "nsINntpIncomingServer.h"
#include "nsIUrlListener.h"
#include "nscore.h"

#include "nsMsgIncomingServer.h"

#include "prmem.h"
#include "plstr.h"
#include "prprf.h"

#include "nsIMsgWindow.h"
#include "nsISubscribableServer.h"
#include "nsITimer.h"
#include "nsIFile.h"
#include "nsITreeView.h"
#include "nsITreeSelection.h"
#include "nsIAtom.h"
#include "nsCOMArray.h"

#include "nsNntpMockChannel.h"
#include "nsAutoPtr.h"

class nsINntpUrl;
class nsIMsgMailNewsUrl;

/* get some implementation from nsMsgIncomingServer */
class nsNntpIncomingServer : public nsMsgIncomingServer,
                             public nsINntpIncomingServer,
                             public nsIUrlListener,
                             public nsISubscribableServer,
                             public nsITreeView
                             
{
public:
    NS_DECL_ISUPPORTS_INHERITED
    NS_DECL_NSINNTPINCOMINGSERVER
    NS_DECL_NSIURLLISTENER
    NS_DECL_NSISUBSCRIBABLESERVER
    NS_DECL_NSITREEVIEW

    nsNntpIncomingServer();
    virtual ~nsNntpIncomingServer();

    NS_IMETHOD GetLocalStoreType(nsACString& type);
    NS_IMETHOD CloseCachedConnections();
    NS_IMETHOD PerformBiff(nsIMsgWindow *aMsgWindow);
    NS_IMETHOD PerformExpand(nsIMsgWindow *aMsgWindow);
    NS_IMETHOD OnUserOrHostNameChanged(const nsACString& oldName,
                                       const nsACString& newName,
                                       bool hostnameChanged);

    // for nsMsgLineBuffer
    virtual nsresult HandleLine(const char *line, uint32_t line_size);

    // override to clear all passwords associated with server
    NS_IMETHODIMP ForgetPassword();
    NS_IMETHOD GetCanSearchMessages(bool *canSearchMessages);
    NS_IMETHOD GetOfflineSupportLevel(int32_t *aSupportLevel);
    NS_IMETHOD GetDefaultCopiesAndFoldersPrefsToServer(bool *aCopiesAndFoldersOnServer);
    NS_IMETHOD GetCanCreateFoldersOnServer(bool *aCanCreateFoldersOnServer);
    NS_IMETHOD GetCanFileMessagesOnServer(bool *aCanFileMessagesOnServer);
    NS_IMETHOD GetFilterScope(nsMsgSearchScopeValue *filterScope);
    NS_IMETHOD GetSearchScope(nsMsgSearchScopeValue *searchScope);

    NS_IMETHOD GetSocketType(int32_t *aSocketType); // override nsMsgIncomingServer impl
    NS_IMETHOD SetSocketType(int32_t aSocketType); // override nsMsgIncomingServer impl
    NS_IMETHOD GetSortOrder(int32_t* aSortOrder);

protected:
   virtual nsresult CreateRootFolderFromUri(const nsCString &serverUri,
                                            nsIMsgFolder **rootFolder);
    nsresult GetNntpConnection(nsIURI *url, nsIMsgWindow *window,
                               nsINNTPProtocol **aNntpConnection);
    nsresult CreateProtocolInstance(nsINNTPProtocol **aNntpConnection,
                                    nsIURI *url, nsIMsgWindow *window);
    bool ConnectionTimeOut(nsINNTPProtocol* aNntpConnection);
    nsCOMArray<nsINNTPProtocol> mConnectionCache;
    nsTArray<nsRefPtr<nsNntpMockChannel> > m_queuedChannels;

    /**
     * Downloads the newsgroup headers.
     */
    nsresult DownloadMail(nsIMsgWindow *aMsgWindow);

    NS_IMETHOD GetServerRequiresPasswordForBiff(bool *aServerRequiresPasswordForBiff);
    nsresult SetupNewsrcSaveTimer();
    static void OnNewsrcSaveTimer(nsITimer *timer, void *voidIncomingServer);
    void WriteLine(nsIOutputStream *stream, nsCString &str);

private:
    nsTArray<nsCString> mSubscribedNewsgroups;
    nsTArray<nsCString> mGroupsOnServer;
    nsTArray<nsCString> mSubscribeSearchResult;
    bool mSearchResultSortDescending;
    // the list of of subscribed newsgroups within a given
    // subscribed dialog session.  
    // we need to keep track of them so we know what to show as "checked"
    // in the search view
    nsTArray<nsCString> mTempSubscribed;
    nsCOMPtr<nsIAtom> mSubscribedAtom;
    nsCOMPtr<nsIAtom> mNntpAtom;

    nsCOMPtr<nsITreeBoxObject> mTree;
    nsCOMPtr<nsITreeSelection> mTreeSelection;

    bool     mHasSeenBeginGroups;
    bool     mGetOnlyNew;
    nsresult WriteHostInfoFile();
    nsresult LoadHostInfoFile();
    nsresult AddGroupOnServer(const nsACString &name);

    bool mNewsrcHasChanged;
    bool mHostInfoLoaded;
    bool mHostInfoHasChanged;
    nsCOMPtr <nsIFile> mHostInfoFile;
    
    uint32_t mLastGroupDate;
    PRTime mFirstNewDate;
    int32_t mUniqueId;    
    uint32_t mLastUpdatedTime;
    int32_t mVersion;
    bool mPostingAllowed;

    nsCOMPtr<nsITimer> mNewsrcSaveTimer;
    nsCOMPtr <nsIMsgWindow> mMsgWindow;

    nsCOMPtr <nsISubscribableServer> mInner;
    nsresult EnsureInner();
    nsresult ClearInner();
    bool IsValidRow(int32_t row);
    nsCOMPtr<nsIFile> mNewsrcFilePath;
};

#endif
