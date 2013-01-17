/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMessengerUnixIntegration_h
#define __nsMessengerUnixIntegration_h

#include "nsIMessengerOSIntegration.h"
#include "nsIFolderListener.h"
#include "nsIUrlListener.h"
#include "nsISupportsArray.h"
#include "nsIStringBundle.h"
#include "nsIObserver.h"
#include "nsIAtom.h"
#include "nsDataHashtable.h"

#define NS_MESSENGERUNIXINTEGRATION_CID \
  {0xf62f3d3a, 0x1dd1, 0x11b2, \
    {0xa5, 0x16, 0xef, 0xad, 0xb1, 0x31, 0x61, 0x5c}}

class nsIStringBundle;

class nsMessengerUnixIntegration : public nsIFolderListener,
                                   public nsIObserver,
                                   public nsIUrlListener,
                                   public nsIMessengerOSIntegration
{
public:
  nsMessengerUnixIntegration();
  virtual nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMESSENGEROSINTEGRATION
  NS_DECL_NSIFOLDERLISTENER
  NS_DECL_NSIOBSERVER
  NS_DECL_NSIURLLISTENER

private:
  nsresult ShowAlertMessage(const nsAString& aAlertTitle, const nsAString& aAlertText, const nsACString& aFolderURI);
  nsresult GetFirstFolderWithNewMail(nsACString& aFolderURI);
  nsresult GetStringBundle(nsIStringBundle **aBundle);
  nsresult AlertFinished();
  nsresult AlertClicked();
  void FillToolTipInfo();
  nsresult GetMRUTimestampForFolder(nsIMsgFolder *aFolder, uint32_t *aLastMRUTime);

  bool BuildNotificationBody(nsIMsgDBHdr *aHdr, nsIStringBundle *Bundle, nsString &aBody);
  bool BuildNotificationTitle(nsIMsgFolder *aFolder, nsIStringBundle *aBundle, nsString &aTitle);
  nsresult ShowNewAlertNotification(bool aUserInitiated);
  nsresult PutMRUTimestampForFolder(nsIMsgFolder *aFolder, uint32_t aLastMRUTime);

  nsCOMPtr<nsISupportsArray> mFoldersWithNewMail;  // keep track of all the root folders with pending new mail
  nsCOMPtr<nsIAtom> mBiffStateAtom;
  nsCOMPtr<nsIAtom> mNewMailReceivedAtom;
  bool mAlertInProgress;
  nsDataHashtable<nsCStringHashKey, uint32_t> mLastMRUTimes; // We keep track of the last time we did a new mail notification for each account
  nsTArray<nsCString> mFetchingURIs;
};

#endif // __nsMessengerUnixIntegration_h
