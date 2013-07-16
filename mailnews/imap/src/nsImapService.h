/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImapService_h___
#define nsImapService_h___

#include "nsIImapService.h"
#include "nsIMsgMessageService.h"
#include "nsCOMPtr.h"
#include "nsIFile.h"
#include "nsIProtocolHandler.h"
#include "nsIMsgProtocolInfo.h"
#include "nsIContentHandler.h"
#include "nsICacheSession.h"

class nsIImapHostSessionList; 
class nsCString;
class nsIImapUrl;
class nsIMsgFolder;
class nsIMsgStatusFeedback;
class nsIMsgIncomingServer;

class nsImapService : public nsIImapService,
                      public nsIMsgMessageService,
                      public nsIMsgMessageFetchPartService,
                      public nsIProtocolHandler,
                      public nsIMsgProtocolInfo,
                      public nsIContentHandler
{
public:
  nsImapService();
  virtual ~nsImapService();

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIMSGPROTOCOLINFO
  NS_DECL_NSIIMAPSERVICE
  NS_DECL_NSIMSGMESSAGESERVICE
  NS_DECL_NSIPROTOCOLHANDLER
  NS_DECL_NSIMSGMESSAGEFETCHPARTSERVICE
  NS_DECL_NSICONTENTHANDLER

protected:
  char GetHierarchyDelimiter(nsIMsgFolder *aMsgFolder);

  nsresult GetFolderName(nsIMsgFolder *aImapFolder, nsACString &aFolderName);

  // This is called by both FetchMessage and StreamMessage
  nsresult GetMessageFromUrl(nsIImapUrl *aImapUrl,
                             nsImapAction aImapAction,
                             nsIMsgFolder *aImapMailFolder, 
                             nsIImapMessageSink *aImapMessage,
                             nsIMsgWindow *aMsgWindow,
                             nsISupports *aDisplayConsumer, 
                             bool aConvertDataToText,
                             nsIURI **aURL);

  nsresult CreateStartOfImapUrl(const nsACString &aImapURI,  // a RDF URI for the current message/folder, can be empty
                                nsIImapUrl  **imapUrl,
                                nsIMsgFolder *aImapFolder,
                                nsIUrlListener *aUrlListener,
                                nsACString &urlSpec,
                                char &hierarchyDelimiter);

  nsresult GetImapConnectionAndLoadUrl(nsIImapUrl *aImapUrl,
                                       nsISupports *aConsumer,
                                       nsIURI **aURL);

  nsresult SetImapUrlSink(nsIMsgFolder *aMsgFolder, nsIImapUrl *aImapUrl);

  nsresult FetchMimePart(nsIImapUrl *aImapUrl,
                         nsImapAction aImapAction,
                         nsIMsgFolder *aImapMailFolder, 
                         nsIImapMessageSink *aImapMessage,
                         nsIURI **aURL,
                         nsISupports *aDisplayConsumer, 
                         const nsACString &messageIdentifierList,
                         const nsACString &mimePart);

  nsresult FolderCommand(nsIMsgFolder *imapMailFolder,
                         nsIUrlListener *urlListener,
                         const char *aCommand,
                         nsImapAction imapAction,
                         nsIMsgWindow *msgWindow,
                         nsIURI **url);

  nsresult ChangeFolderSubscription(nsIMsgFolder *folder,
                                    const nsAString &folderName,
                                    const char *aCommand,
                                    nsIUrlListener *urlListener,
                                    nsIURI **url);

  nsresult DiddleFlags(nsIMsgFolder *aImapMailFolder,
                       nsIUrlListener *aUrlListener,
                       nsIURI **aURL,
                       const nsACString &messageIdentifierList,
                       const char *howToDiddle,
                       imapMessageFlagsType flags,
                       bool messageIdsAreUID);

  nsresult OfflineAppendFromFile(nsIFile *aFile,
                                 nsIURI *aUrl,
                                 nsIMsgFolder *aDstFolder,
                                 const nsACString &messageId,  // to be replaced
                                 bool inSelectedState, // needs to be in
                                 nsIUrlListener *aListener,
                                 nsIURI **aURL,
                                 nsISupports *aCopyState);

  nsresult GetServerFromUrl(nsIImapUrl *aImapUrl, nsIMsgIncomingServer **aServer);

  // just a little helper method...maybe it should be a macro? which helps break down a imap message uri
  // into the folder and message key equivalents
  nsresult DecomposeImapURI(const nsACString &aMessageURI, nsIMsgFolder **aFolder, nsACString &msgKey);
  nsresult DecomposeImapURI(const nsACString &aMessageURI, nsIMsgFolder **aFolder, nsMsgKey *msgKey);


  nsCOMPtr<nsICacheSession> mCacheSession;  // handle to the cache session for imap.....
  bool mPrintingOperation;                // Flag for printing operations
};

#endif /* nsImapService_h___ */
