/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#ifndef nsAbLDAPReplicationQuery_h__
#define nsAbLDAPReplicationQuery_h__

#include "nsIWebProgressListener.h"
#include "nsIAbLDAPReplicationQuery.h"
#include "nsIAbLDAPReplicationData.h"
#include "nsIAbLDAPDirectory.h"
#include "nsILDAPConnection.h"
#include "nsILDAPOperation.h"
#include "nsILDAPURL.h"
#include "nsDirPrefs.h"
#include "nsStringGlue.h"

class nsAbLDAPReplicationQuery : public nsIAbLDAPReplicationQuery
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIABLDAPREPLICATIONQUERY

  nsAbLDAPReplicationQuery();

  nsresult InitLDAPData();
  nsresult ConnectToLDAPServer();

protected :
  // pointer to interfaces used by this object
  nsCOMPtr<nsILDAPConnection> mConnection;
  nsCOMPtr<nsILDAPOperation> mOperation;
  nsCOMPtr<nsILDAPURL> mURL;
  nsCOMPtr<nsIAbLDAPDirectory> mDirectory;

  nsCOMPtr<nsIAbLDAPProcessReplicationData> mDataProcessor;

  bool mInitialized;
  nsCString mLogin;
};

#endif // nsAbLDAPReplicationQuery_h__
