/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMessengerOSXIntegration_h
#define __nsMessengerOSXIntegration_h

#include "nsIMessengerOSIntegration.h"
#include "nsIFolderListener.h"
#include "nsIAtom.h"
#include "nsITimer.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsIObserver.h"
#include "nsIAlertsService.h"

#define NS_MESSENGEROSXINTEGRATION_CID \
  {0xaa83266, 0x4225, 0x4c4b, \
  {0x93, 0xf8, 0x94, 0xb1, 0x82, 0x58, 0x6f, 0x93}}

class nsIStringBundle;

class nsMessengerOSXIntegration : public nsIMessengerOSIntegration,
                                  public nsIFolderListener,
                                  public nsIObserver
{
public:
  nsMessengerOSXIntegration();
  virtual ~nsMessengerOSXIntegration();
  virtual nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMESSENGEROSINTEGRATION
  NS_DECL_NSIFOLDERLISTENER
  NS_DECL_NSIOBSERVER

private:
  nsCOMPtr<nsIAtom> mBiffStateAtom;
  nsCOMPtr<nsIAtom> mNewMailReceivedAtom;
  nsCOMPtr<nsIAtom> mTotalUnreadMessagesAtom;
  nsresult ShowAlertMessage(const nsAString& aAlertTitle, const nsAString& aAlertText, const nsACString& aFolderURI);
  nsresult OnAlertFinished();
  nsresult OnAlertClicked(const PRUnichar * aAlertCookie);
  nsresult GetStringBundle(nsIStringBundle **aBundle);
  void FillToolTipInfo(nsIMsgFolder *aFolder, PRInt32 aNewCount);
  nsresult GetFirstFolderWithNewMail(nsIMsgFolder* aFolder, nsCString& aFolderURI);
  nsresult BadgeDockIcon();
  nsresult RestoreDockIcon();
  nsresult BounceDockIcon();
  nsresult GetNewMailAuthors(nsIMsgFolder* aFolder, nsString& aAuthors, PRInt32 aNewCount, PRInt32* aNotDisplayed);
  nsresult GetTotalUnread(nsIMsgFolder* aFolder, bool deep, PRInt32* aTotal);
  nsresult ConfirmShouldCount(nsIMsgFolder* aFolder, bool* aCountFolder);
  void InitUnreadCount();

  PRInt32 mUnreadTotal;
  PRInt32 mUnreadChat;
  PRInt32 mNewTotal;
  bool mOnlyCountInboxes;
  bool mDoneInitialCount;
};

#endif // __nsMessengerOSXIntegration_h
