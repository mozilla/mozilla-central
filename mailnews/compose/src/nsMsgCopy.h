/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgCopy_H_
#define _nsMsgCopy_H_

#include "mozilla/Attributes.h"
#include "nscore.h"
#include "nsIFile.h"
#include "nsMsgSend.h"
#include "nsIMsgFolder.h"
#include "nsITransactionManager.h"
#include "nsIMsgCopyServiceListener.h"
#include "nsIMsgCopyService.h"

// {0874C3B5-317D-11d3-8EFB-00A024A7D144}
#define NS_IMSGCOPY_IID           \
{ 0x874c3b5, 0x317d, 0x11d3,      \
{ 0x8e, 0xfb, 0x0, 0xa0, 0x24, 0xa7, 0xd1, 0x44 } };

// Forward declarations...
class   nsMsgCopy;

////////////////////////////////////////////////////////////////////////////////////
// This is the listener class for the copy operation. We have to create this class 
// to listen for message copy completion and eventually notify the caller
////////////////////////////////////////////////////////////////////////////////////
class CopyListener : public nsIMsgCopyServiceListener
{
public:
  CopyListener(void);
  virtual ~CopyListener(void);

  // nsISupports interface
  NS_DECL_ISUPPORTS

  NS_IMETHOD OnStartCopy() MOZ_OVERRIDE;
  
  NS_IMETHOD OnProgress(uint32_t aProgress, uint32_t aProgressMax) MOZ_OVERRIDE;

  NS_IMETHOD SetMessageKey(uint32_t aMessageKey) MOZ_OVERRIDE;
  
  NS_IMETHOD GetMessageId(nsACString& aMessageId) MOZ_OVERRIDE;
  
  NS_IMETHOD OnStopCopy(nsresult aStatus) MOZ_OVERRIDE;

  NS_IMETHOD SetMsgComposeAndSendObject(nsIMsgSend *obj);
  
  bool                            mCopyInProgress;

private:
  nsCOMPtr<nsIMsgSend>       mComposeAndSend;
};

//
// This is a class that deals with processing remote attachments. It implements
// an nsIStreamListener interface to deal with incoming data
//
class nsMsgCopy : public nsIUrlListener
{
public:
  nsMsgCopy();
  virtual ~nsMsgCopy();

  // nsISupports interface
  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER


  //////////////////////////////////////////////////////////////////////
  // Object methods...
  //////////////////////////////////////////////////////////////////////
  //
  nsresult              StartCopyOperation(nsIMsgIdentity       *aUserIdentity,
                                           nsIFile          *aFile, 
                                           nsMsgDeliverMode     aMode,
                                           nsIMsgSend           *aMsgSendObj,
                                           const char           *aSavePref,
                                           nsIMsgDBHdr          *aMsgToReplace);

  nsresult              DoCopy(nsIFile *aDiskFile, nsIMsgFolder *dstFolder,
                               nsIMsgDBHdr *aMsgToReplace, bool aIsDraft,
                               nsIMsgWindow *msgWindow,
                               nsIMsgSend   *aMsgSendObj);

  nsresult	GetUnsentMessagesFolder(nsIMsgIdentity *userIdentity, nsIMsgFolder **msgFolder, bool *waitForUrl);
  nsresult	GetDraftsFolder(nsIMsgIdentity *userIdentity, nsIMsgFolder **msgFolder, bool *waitForUrl);
  nsresult	GetTemplatesFolder(nsIMsgIdentity *userIdentity, nsIMsgFolder **msgFolder, bool *waitForUrl);
  nsresult	GetSentFolder(nsIMsgIdentity *userIdentity,  nsIMsgFolder **msgFolder, bool *waitForUrl);
  nsresult   CreateIfMissing(nsIMsgFolder **folder, bool *waitForUrl);

  
  //
  // Vars for implementation...
  //
  nsIFile                     *mFile;     // the file we are sending...
  nsMsgDeliverMode                mMode;
  nsCOMPtr<nsIMsgFolder>          mDstFolder;
  nsCOMPtr<nsIMsgDBHdr>           mMsgToReplace;
  bool                            mIsDraft;
  nsCOMPtr<nsIMsgSend>            mMsgSendObj;
  char                            *mSavePref;
};

// Useful function for the back end...
nsresult	LocateMessageFolder(nsIMsgIdentity   *userIdentity, 
                                       nsMsgDeliverMode aFolderType,
                                       const char       *aSaveURI,
				       nsIMsgFolder **msgFolder);

nsresult	MessageFolderIsLocal(nsIMsgIdentity   *userIdentity, 
                                       nsMsgDeliverMode aFolderType,
                                       const char       *aSaveURI,
				       bool		*aResult);

#endif /* _nsMsgCopy_H_ */
