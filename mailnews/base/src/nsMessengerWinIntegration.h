/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMessengerWinIntegration_h
#define __nsMessengerWinIntegration_h

#include <windows.h>

// shellapi.h is needed to build with WIN32_LEAN_AND_MEAN
#include <shellapi.h>

#include "nsIMessengerOSIntegration.h"
#include "nsIFolderListener.h"
#include "nsIAtom.h"
#include "nsITimer.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsISupportsArray.h"
#include "nsIObserver.h"

typedef enum tagMOZ_QUERY_USER_NOTIFICATION_STATE {
    QUNS_NOT_PRESENT = 1,
    QUNS_BUSY = 2,
    QUNS_RUNNING_D3D_FULL_SCREEN = 3,
    QUNS_PRESENTATION_MODE = 4,
    QUNS_ACCEPTS_NOTIFICATIONS = 5,
    QUNS_QUIET_TIME = 6
} MOZ_QUERY_USER_NOTIFICATION_STATE;

// this function is exported by shell32.dll on Windows Vista or later
extern "C"
{
// Vista or later
typedef HRESULT (__stdcall *fnSHQueryUserNotificationState)(MOZ_QUERY_USER_NOTIFICATION_STATE *pquns);
}

#define NS_MESSENGERWININTEGRATION_CID \
  {0xf62f3d3a, 0x1dd1, 0x11b2, \
    {0xa5, 0x16, 0xef, 0xad, 0xb1, 0x31, 0x61, 0x5c}}

class nsIStringBundle; 

class nsMessengerWinIntegration : public nsIMessengerOSIntegration,
                                  public nsIFolderListener,
                                  public nsIObserver
{
public:
  nsMessengerWinIntegration();
  virtual ~nsMessengerWinIntegration();
  virtual nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMESSENGEROSINTEGRATION
  NS_DECL_NSIFOLDERLISTENER
  NS_DECL_NSIOBSERVER

#ifdef MOZ_THUNDERBIRD
  nsresult ShowNewAlertNotification(bool aUserInitiated, const nsString& aAlertTitle, const nsString& aAlertText);
#else
  nsresult ShowAlertMessage(const nsString& aAlertTitle, const nsString& aAlertText, const nsACString& aFolderURI);
#endif

private:
  nsresult AlertFinished();
  nsresult AlertClicked();

  void InitializeBiffStatusIcon(); 
  void FillToolTipInfo();
  void GenericShellNotify(DWORD aMessage);
  void DestroyBiffIcon();

  nsresult GetFirstFolderWithNewMail(nsACString& aFolderURI);

  nsresult GetStringBundle(nsIStringBundle **aBundle);
  nsCOMPtr<nsISupportsArray> mFoldersWithNewMail;  // keep track of all the root folders with pending new mail
  nsCOMPtr<nsIAtom> mBiffStateAtom;
  uint32_t mCurrentBiffState;

  bool mBiffIconVisible;
  bool mBiffIconInitialized;
  bool mSuppressBiffIcon;
  bool mAlertInProgress;
  
  // "might" because we don't know until we check 
  // what type of server is associated with the default account
  bool            mDefaultAccountMightHaveAnInbox;

  // True if the timer is running
  bool mUnreadTimerActive;

  nsresult ResetCurrent();
  nsresult RemoveCurrentFromRegistry();
  nsresult UpdateRegistryWithCurrent();
  nsresult SetupInbox();

  nsresult SetupUnreadCountUpdateTimer();
  static void OnUnreadCountUpdateTimer(nsITimer *timer, void *osIntegration);
  nsresult UpdateUnreadCount();

  nsCOMPtr <nsIAtom> mDefaultServerAtom;
  nsCOMPtr <nsIAtom> mTotalUnreadMessagesAtom;
  nsCOMPtr <nsITimer> mUnreadCountUpdateTimer;

  fnSHQueryUserNotificationState mSHQueryUserNotificationState;

  nsCString mInboxURI;
  nsCString mEmail;

  nsString  mAppName;
  nsString  mEmailPrefix;

  nsString mProfilePath;

  int32_t   mCurrentUnreadCount;
  int32_t   mLastUnreadCountWrittenToRegistry;
};

#endif // __nsMessengerWinIntegration_h
