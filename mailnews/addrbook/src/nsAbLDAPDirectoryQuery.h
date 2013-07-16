/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbLDAPDirectoryQuery_h__
#define nsAbLDAPDirectoryQuery_h__

#include "nsIAbDirectoryQuery.h"
#include "nsILDAPConnection.h"
#include "nsILDAPMessageListener.h"
#include "nsILDAPURL.h"
#include "nsWeakReference.h"

#include "nsStringGlue.h"
#include "nsCOMArray.h"

class nsAbLDAPDirectoryQuery : public nsIAbDirectoryQuery,
                             public nsIAbDirectoryQueryResultListener
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIABDIRECTORYQUERY
  NS_DECL_NSIABDIRECTORYQUERYRESULTLISTENER

  nsAbLDAPDirectoryQuery();
  virtual ~nsAbLDAPDirectoryQuery();

protected:
  nsCOMPtr<nsILDAPMessageListener> mListener;

private:
  nsCOMPtr<nsILDAPConnection> mConnection;
  nsCOMPtr<nsILDAPURL> mDirectoryUrl;
  nsCString mDirectoryId;
  nsCOMArray<nsIAbDirSearchListener> mListeners;
  nsCString mCurrentLogin;
  nsCString mCurrentMechanism;
  uint32_t mCurrentProtocolVersion;

  bool mInitialized;
};

#endif // nsAbLDAPDirectoryQuery_h__
