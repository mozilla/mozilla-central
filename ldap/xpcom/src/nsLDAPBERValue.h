/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsLDAPBERValue_h_
#define _nsLDAPBERValue_h_

#include "ldap.h"
#include "nsILDAPBERValue.h"

// 7c9fa10e-1dd2-11b2-a097-ac379e6803b2
//
#define NS_LDAPBERVALUE_CID \
{ 0x7c9fa10e, 0x1dd2, 0x11b2, \
  {0xa0, 0x97, 0xac, 0x37, 0x9e, 0x68, 0x03, 0xb2 }}

class nsLDAPBERValue : public nsILDAPBERValue
{
public:
    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSILDAPBERVALUE

    nsLDAPBERValue();
    virtual ~nsLDAPBERValue();
    
protected:

    /** 
     * nsLDAPControl needs to be able to grovel through this without an
     * an extra copy
     */
    friend class nsLDAPControl;

    uint8_t *mValue;    // pointer to an array
    uint32_t mSize;	    // size of the value, in bytes
};

#endif // _nsLDAPBERValue_h_
