/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#ifndef nsAbLDAPReplicationData_h__
#define nsAbLDAPReplicationData_h__

#include "mozilla/Attributes.h"
#include "nsIAbLDAPReplicationData.h"
#include "nsIWebProgressListener.h"
#include "nsIAbLDAPReplicationQuery.h"
#include "nsAbLDAPListenerBase.h"
#include "nsIAddrDatabase.h"
#include "nsIFile.h"
#include "nsDirPrefs.h"
#include "nsIAbLDAPAttributeMap.h"
#include "nsIAbLDAPDirectory.h"
#include "nsStringGlue.h"

class nsAbLDAPProcessReplicationData : public nsIAbLDAPProcessReplicationData,
                                       public nsAbLDAPListenerBase
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIABLDAPPROCESSREPLICATIONDATA

  nsAbLDAPProcessReplicationData();
  virtual ~nsAbLDAPProcessReplicationData();

  // nsILDAPMessageListener
  NS_IMETHOD OnLDAPMessage(nsILDAPMessage *aMessage) MOZ_OVERRIDE;

protected:
  virtual nsresult DoTask() MOZ_OVERRIDE;
  virtual void InitFailed(bool aCancelled = false) MOZ_OVERRIDE;

  // pointer to the interfaces used by this object
  nsCOMPtr<nsIWebProgressListener> mListener;
  // pointer to the query to call back to once we've finished
  nsCOMPtr<nsIAbLDAPReplicationQuery> mQuery;

  nsCOMPtr<nsIAddrDatabase> mReplicationDB;
  nsCOMPtr <nsIFile> mReplicationFile;
  nsCOMPtr <nsIFile> mBackupReplicationFile;

  // state of processing, protocol used and count of results
  int32_t         mState;
  int32_t         mProtocol;
  int32_t         mCount;
  bool            mDBOpen;
  bool            mInitialized;
  
  nsCOMPtr<nsIAbLDAPDirectory> mDirectory;
  nsCOMPtr<nsIAbLDAPAttributeMap> mAttrMap; // maps ab properties to ldap attrs
  
  virtual nsresult OnLDAPSearchEntry(nsILDAPMessage *aMessage);
  virtual nsresult OnLDAPSearchResult(nsILDAPMessage *aMessage);
  
  nsresult OpenABForReplicatedDir(bool bCreate);
  nsresult DeleteCard(nsString & aDn);
  void Done(bool aSuccess);
};


#endif // nsAbLDAPReplicationData_h__
