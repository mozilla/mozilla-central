/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsLDAPOperation_h_
#define _nsLDAPOperation_h_

#include "ldap.h"
#include "nsCOMPtr.h"
#include "nsILDAPConnection.h"
#include "nsILDAPOperation.h"
#include "nsILDAPMessageListener.h"
#include "nsStringGlue.h"
#include "nsIMutableArray.h"
#include "nsLDAPConnection.h"

// 97a479d0-9a44-47c6-a17a-87f9b00294bb
#define NS_LDAPOPERATION_CID \
{ 0x97a479d0, 0x9a44, 0x47c6, \
  { 0xa1, 0x7a, 0x87, 0xf9, 0xb0, 0x02, 0x94, 0xbb}}

class nsLDAPOperation : public nsILDAPOperation
{
  public:

    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSILDAPOPERATION

    // constructor & destructor
    //
    nsLDAPOperation();
    virtual ~nsLDAPOperation();

    /**
     * used to break cycles
     */
    void Clear();

  private:
    /**
     * wrapper for ldap_add_ext()
     *
     * XXX should move to idl, once LDAPControls have an IDL representation
     */
    nsresult AddExt(const char *base, // base DN to add
                    nsIArray *mods, // Array of modifications
                    LDAPControl **serverctrls,
                    LDAPControl **clientctrls);

    /**
     * wrapper for ldap_delete_ext()
     *
     * XXX should move to idl, once LDAPControls have an IDL representation
     */
    nsresult DeleteExt(const char *base, // base DN to delete
                       LDAPControl **serverctrls,
                       LDAPControl **clientctrls);

    /**
     * wrapper for ldap_modify_ext()
     *
     * XXX should move to idl, once LDAPControls have an IDL representation
     */
    nsresult ModifyExt(const char *base, // base DN to modify
                       nsIArray *mods, // array of modifications
                       LDAPControl **serverctrls,
                       LDAPControl **clientctrls);

    /**
     * wrapper for ldap_rename()
     *
     * XXX should move to idl, once LDAPControls have an IDL representation
     */
    nsresult Rename(const char *base, // base DN to rename
                    const char *newRDn, // new RDN
                    const char *newParent, // DN of the new parent
                    bool deleteOldRDn, // remove old RDN in the entry?
                    LDAPControl **serverctrls,
                    LDAPControl **clientctrls);

    /**
     * Helper function to copy the values of an nsILDAPModification into an
     * array of berval's.
     */
    static nsresult CopyValues(nsILDAPModification* aMod, berval*** aBValues);

    nsCOMPtr<nsILDAPMessageListener> mMessageListener; // results go here
    nsCOMPtr<nsISupports> mClosure;  // private parameter (anything caller desires)
    nsRefPtr<nsLDAPConnection> mConnection; // connection this op is on

    LDAP *mConnectionHandle; // cache connection handle
    nsCString mSavePassword;
    nsCString mMechanism;
    nsCOMPtr<nsIAuthModule> mAuthModule;
    int32_t mMsgID;          // opaque handle to outbound message for this op

    nsCOMPtr<nsIMutableArray> mClientControls;
    nsCOMPtr<nsIMutableArray> mServerControls;
};

#endif // _nsLDAPOperation_h
