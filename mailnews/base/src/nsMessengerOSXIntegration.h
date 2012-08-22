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
#include "mozINewMailListener.h"

#define NS_MESSENGEROSXINTEGRATION_CID \
  {0xaa83266, 0x4225, 0x4c4b, \
  {0x93, 0xf8, 0x94, 0xb1, 0x82, 0x58, 0x6f, 0x93}}

class nsIStringBundle;

class nsMessengerOSXIntegration : public nsIMessengerOSIntegration,
                                  public nsIFolderListener,
                                  public nsIObserver,
                                  public mozINewMailListener
{
public:
  nsMessengerOSXIntegration();
  virtual ~nsMessengerOSXIntegration();
  virtual nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMESSENGEROSINTEGRATION
  NS_DECL_NSIFOLDERLISTENER
  NS_DECL_NSIOBSERVER
  NS_DECL_MOZINEWMAILLISTENER

private:
  nsCOMPtr<nsIAtom> mBiffStateAtom;
  nsCOMPtr<nsIAtom> mNewMailReceivedAtom;
  nsresult ShowAlertMessage(const nsAString& aAlertTitle, const nsAString& aAlertText, const nsACString& aFolderURI);
  nsresult OnAlertFinished();
  nsresult OnAlertClicked(const PRUnichar * aAlertCookie);
  nsresult GetStringBundle(nsIStringBundle **aBundle);
  void FillToolTipInfo(nsIMsgFolder *aFolder, int32_t aNewCount);
  nsresult GetFirstFolderWithNewMail(nsIMsgFolder* aFolder, nsCString& aFolderURI);
  nsresult BadgeDockIcon();
  nsresult RestoreDockIcon();
  nsresult BounceDockIcon();
  nsresult GetNewMailAuthors(nsIMsgFolder* aFolder, nsString& aAuthors, int32_t aNewCount, int32_t* aNotDisplayed);

  int32_t mUnreadTotal;
  int32_t mUnreadChat;
};

#endif // __nsMessengerOSXIntegration_h
