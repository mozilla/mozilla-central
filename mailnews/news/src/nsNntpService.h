/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsNntpService_h___
#define nsNntpService_h___

#include "nsINntpService.h"
#include "nsIProtocolHandler.h"
#include "nsIMsgMessageService.h"
#include "nsINntpIncomingServer.h"
#include "nsIMsgIncomingServer.h"
#include "nsIFile.h"
#include "MailNewsTypes.h"
#include "nsIMsgProtocolInfo.h"
#include "nsIMsgWindow.h"
#include "nsINntpUrl.h"
#include "nsCOMPtr.h"
#include "nsIContentHandler.h"
#include "nsICacheSession.h"

#include "nsICommandLineHandler.h"

class nsIURI;
class nsIUrlListener;

class nsNntpService : public nsINntpService,
                      public nsIMsgMessageService,
                      public nsIMsgMessageFetchPartService,
                      public nsIProtocolHandler,
                      public nsIMsgProtocolInfo,
                      public nsICommandLineHandler,
                      public nsIContentHandler
{
public:

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSINNTPSERVICE
  NS_DECL_NSIMSGMESSAGESERVICE
  NS_DECL_NSIPROTOCOLHANDLER
  NS_DECL_NSIMSGPROTOCOLINFO
  NS_DECL_NSICONTENTHANDLER
  NS_DECL_NSIMSGMESSAGEFETCHPARTSERVICE
  NS_DECL_NSICOMMANDLINEHANDLER

  // nsNntpService
  nsNntpService();
  virtual ~nsNntpService();

protected:
  nsresult GetNntpServerByAccount(const char *aAccountKey, nsIMsgIncomingServer **aNntpServer);
  nsresult SetUpNntpUrlForPosting(const char *aAccountKey, char **newsUrlSpec);
  nsresult FindHostFromGroup(nsCString &host, nsCString &groupName);
  nsresult FindServerWithNewsgroup(nsCString &host, nsCString &groupName);

  nsresult CreateMessageIDURL(nsIMsgFolder *folder, nsMsgKey key, char **url);
  nsresult GetMessageFromUrl(nsIURI *aUrl, nsIMsgWindow *aMsgWindow, nsISupports *aDisplayConsumer);
  // a convience routine used to put together news urls
  nsresult ConstructNntpUrl(const char * urlString, nsIUrlListener *aUrlListener,  nsIMsgWindow * aMsgWindow, const char *originalMessageUri, int32_t action, nsIURI ** aUrl);
  nsresult CreateNewsAccount(const char *aHostname, bool aIsSecure, int32_t aPort, nsIMsgIncomingServer **aServer);
  nsresult GetServerForUri(nsIURI *aUri, nsINntpIncomingServer **aProtocol);
  // a convience routine to run news urls
  nsresult RunNewsUrl (nsIURI * aUrl, nsIMsgWindow *aMsgWindow, nsISupports * aConsumer);
  // a convience routine to go from folder uri to msg folder
  nsresult GetFolderFromUri(const char *uri, nsIMsgFolder **folder);
  nsresult DecomposeNewsMessageURI(const char * aMessageURI, nsIMsgFolder ** aFolder, nsMsgKey *aMsgKey);

  bool              mPrintingOperation; // Flag for printing operations
  bool        mOpenAttachmentOperation; // Flag for opening attachments

  nsCOMPtr<nsICacheSession> mCacheSession; // the cache session used by news
};

#endif /* nsNntpService_h___ */
