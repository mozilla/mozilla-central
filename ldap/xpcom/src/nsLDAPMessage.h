/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsLDAPMessage_h_
#define _nsLDAPMessage_h_

#include "ldap.h"
#include "nsILDAPMessage.h"
#include "nsILDAPOperation.h"
#include "nsCOMPtr.h"

// 76e061ad-a59f-43b6-b812-ee6e8e69423f
//
#define NS_LDAPMESSAGE_CID \
{ 0x76e061ad, 0xa59f, 0x43b6, \
  { 0xb8, 0x12, 0xee, 0x6e, 0x8e, 0x69, 0x42, 0x3f }}

class nsLDAPMessage : public nsILDAPMessage
{
    friend class nsLDAPOperation;
    friend class nsLDAPConnection;
    friend class nsLDAPConnectionRunnable;
    friend class nsOnLDAPMessageRunnable;

  public:

    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSILDAPMESSAGE

    // constructor & destructor
    //
    nsLDAPMessage();
    virtual ~nsLDAPMessage();

  protected:
    nsresult IterateAttrErrHandler(int32_t aLderrno, uint32_t *aAttrCount,
                            char** *aAttributes, BerElement *position);
    nsresult IterateAttributes(uint32_t *aAttrCount, char** *aAttributes,
                              bool getP);
    nsresult Init(nsILDAPConnection *aConnection,
                  LDAPMessage *aMsgHandle);
    LDAPMessage *mMsgHandle; // the message we're wrapping
    nsCOMPtr<nsILDAPOperation> mOperation;  // operation this msg relates to

    LDAP *mConnectionHandle; // cached connection this op is on

    // since we're caching the connection handle (above), we need to
    // hold an owning ref to the relevant nsLDAPConnection object as long
    // as we're around
    //
    nsCOMPtr<nsILDAPConnection> mConnection;

    // the next five member vars are returned by ldap_parse_result()
    //
    int mErrorCode;
    char *mMatchedDn;
    char *mErrorMessage;
    char **mReferrals;
    LDAPControl **mServerControls;
};

#endif // _nsLDAPMessage_h
