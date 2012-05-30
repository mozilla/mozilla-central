/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbLDAPChangeLogData_h__
#define nsAbLDAPChangeLogData_h__

#include "nsAbLDAPReplicationData.h"
#include "nsAbLDAPChangeLogQuery.h"
#include "nsVoidArray.h"

typedef struct {
  nsCString     changeLogDN;
  PRInt32       firstChangeNumber;
  PRInt32       lastChangeNumber;
  nsCString     dataVersion;
} RootDSEChangeLogEntry;

class nsAbLDAPProcessChangeLogData : public nsAbLDAPProcessReplicationData
{
public :
   
  nsAbLDAPProcessChangeLogData();
  ~nsAbLDAPProcessChangeLogData();

  NS_IMETHOD Init(nsIAbLDAPReplicationQuery * query, nsIWebProgressListener *progressListener);

protected :

  nsCOMPtr <nsIAbLDAPChangeLogQuery> mChangeLogQuery;

  nsresult OnLDAPBind(nsILDAPMessage *aMessage);
  nsresult OnLDAPSearchEntry(nsILDAPMessage *aMessage);
  nsresult OnLDAPSearchResult(nsILDAPMessage *aMessage);

  nsresult ParseChangeLogEntries(nsILDAPMessage *aMessage);
  nsresult ParseRootDSEEntry(nsILDAPMessage *aMessage);

  nsresult  GetAuthData(); // displays username and password prompt
  nsCString mAuthUserID;   // user id of the user making the connection

  nsresult OnSearchAuthDNDone();
  nsresult OnSearchRootDSEDone();
  nsresult OnFindingChangesDone();
  nsresult OnReplicatingChangeDone();

  RootDSEChangeLogEntry mRootDSEEntry;
  bool    mUseChangeLog;
  PRInt32 mChangeLogEntriesCount;

  PRInt32 mEntriesAddedQueryCount;
  nsStringArray mEntriesToAdd;
};


#endif // nsAbLDAPChangeLogData_h__

