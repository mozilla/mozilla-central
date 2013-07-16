/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ldap.h"
#include "nsStringGlue.h"
#include "nsCOMArray.h"
#include "nsDataHashtable.h"
#include "nsILDAPService.h"
#include "nsILDAPMessage.h"
#include "nsILDAPMessageListener.h"
#include "nsCOMPtr.h"
#include "nsILDAPServer.h"
#include "nsILDAPConnection.h"
#include "nsILDAPMessage.h"
#include "mozilla/Mutex.h"

// 6a89ae33-7a90-430d-888c-0dede53a951a 
//
#define NS_LDAPSERVICE_CID \
{ \
  0x6a89ae33, 0x7a90, 0x430d, \
  {0x88, 0x8c, 0x0d, 0xed, 0xe5, 0x3a, 0x95, 0x1a} \
}

// This is a little "helper" class, we use to store information
// related to one Service entry (one LDAP server).
//
class nsLDAPServiceEntry
{
  public:
    nsLDAPServiceEntry();
    virtual ~nsLDAPServiceEntry() {};
    bool Init();

    inline uint32_t GetLeases();
    inline void IncrementLeases();
    inline bool DecrementLeases();

    inline PRTime GetTimestamp();
    inline void SetTimestamp();

    inline already_AddRefed<nsILDAPServer> GetServer();
    inline bool SetServer(nsILDAPServer *aServer);

    inline already_AddRefed<nsILDAPConnection> GetConnection();
    inline void SetConnection(nsILDAPConnection *aConnection);

    inline already_AddRefed<nsILDAPMessage> GetMessage();
    inline void SetMessage(nsILDAPMessage *aMessage);

    inline already_AddRefed<nsILDAPMessageListener> PopListener();
    inline bool PushListener(nsILDAPMessageListener *);

    inline bool IsRebinding();
    inline void SetRebinding(bool);

    inline bool DeleteEntry();

  protected:
    uint32_t mLeases;         // The number of leases currently granted
    PRTime mTimestamp;        // Last time this server was "used"
    bool mDelete;           // This entry is due for deletion
    bool mRebinding;        // Keep state if we are rebinding or not

    nsCOMPtr<nsILDAPServer> mServer;
    nsCOMPtr<nsILDAPConnection> mConnection;
    nsCOMPtr<nsILDAPMessage> mMessage;

    // Array holding all the pending callbacks (listeners) for this entry
    nsCOMArray<nsILDAPMessageListener> mListeners;  
};

// This is the interface we're implementing.
//
class nsLDAPService : public nsILDAPService, public nsILDAPMessageListener
{
  public: 
    // interface decls
    //
    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSILDAPSERVICE
    NS_DECL_NSILDAPMESSAGELISTENER

    // constructor and destructor
    //
    nsLDAPService();
    virtual ~nsLDAPService();
    
    nsresult Init();

  protected:
    nsresult EstablishConnection(nsLDAPServiceEntry *,
                                 nsILDAPMessageListener *);

    // kinda like strtok_r, but with iterators.  for use by 
    // createFilter
    //
    char *NextToken(const char **aIter, const char **aIterEnd);

    // count how many tokens are in this string; for use by
    // createFilter; note that unlike with NextToken, these params
    // are copies, not references.
    //
    uint32_t CountTokens(const char * aIter, const char * aIterEnd);
                   
    
    mozilla::Mutex mLock;       // Lock mechanism

    // Hash table holding server entries
    nsDataHashtable<nsStringHashKey, nsLDAPServiceEntry*> mServers;
    // Hash table holding "reverse" lookups from connection to server
    nsDataHashtable<nsVoidPtrHashKey, nsLDAPServiceEntry*> mConnections;
};
