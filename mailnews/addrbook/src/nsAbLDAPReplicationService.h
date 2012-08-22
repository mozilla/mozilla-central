/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



#ifndef nsAbLDAPReplicationService_h___
#define nsAbLDAPReplicationService_h___

#include "nsIAbLDAPReplicationService.h"
#include "nsIAbLDAPReplicationQuery.h"
#include "nsStringGlue.h"

class nsAbLDAPReplicationService : public nsIAbLDAPReplicationService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIABLDAPREPLICATIONSERVICE

  nsAbLDAPReplicationService();
  virtual ~nsAbLDAPReplicationService();

  int32_t DecideProtocol();

protected:
  nsCOMPtr<nsIAbLDAPReplicationQuery> mQuery; 
  bool           mReplicating;
  nsCOMPtr<nsIAbLDAPDirectory> mDirectory;

};


#endif /* nsAbLDAPReplicationService_h___ */
