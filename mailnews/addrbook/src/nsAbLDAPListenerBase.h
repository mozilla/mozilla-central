/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbLDAPListenerBase_h__
#define nsAbLDAPListenerBase_h__

#include "mozilla/Attributes.h"
#include "nsCOMPtr.h"
#include "nsILDAPMessageListener.h"
#include "nsILDAPURL.h"
#include "nsILDAPConnection.h"
#include "nsILDAPOperation.h"
#include "nsStringGlue.h"
#include "mozilla/Mutex.h"

class nsAbLDAPListenerBase : public nsILDAPMessageListener
{
public:
  // Note that the directoryUrl is the details of the ldap directory
  // without any search params or attributes specified.
  nsAbLDAPListenerBase(nsILDAPURL* directoryUrl = nullptr,
                       nsILDAPConnection* connection = nullptr,
                       const nsACString &login = EmptyCString(),
                       const int32_t timeOut = 0);
  virtual ~nsAbLDAPListenerBase();

  NS_IMETHOD OnLDAPInit(nsILDAPConnection *aConn, nsresult aStatus) MOZ_OVERRIDE;

protected:
  nsresult OnLDAPMessageBind(nsILDAPMessage *aMessage);

  nsresult Initiate();

  // Called if an LDAP initialization fails.
  virtual void InitFailed(bool aCancelled = false) = 0;

  // Called to start off the required task after a bind.
  virtual nsresult DoTask() = 0;

  nsCOMPtr<nsILDAPURL> mDirectoryUrl;
  nsCOMPtr<nsILDAPOperation> mOperation;        // current ldap op
  nsILDAPConnection* mConnection;
  nsCString mLogin;
  nsCString mSaslMechanism;
  int32_t mTimeOut;
  bool mBound;
  bool mInitialized;

  mozilla::Mutex mLock;
};

#endif
