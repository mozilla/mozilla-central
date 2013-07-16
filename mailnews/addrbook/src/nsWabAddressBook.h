/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsWabAddressBook_h___
#define nsWabAddressBook_h___

#include "mozilla/Attributes.h"
#include "nsAbWinHelper.h"
#include <wab.h>

class nsWabAddressBook : public nsAbWinHelper
{
public :
    nsWabAddressBook(void) ;
    virtual ~nsWabAddressBook(void) ;

protected :
    // Session and address book that will be shared by all instances
    // (see nsMapiAddressBook.h for details)
    static LPWABOBJECT mRootSession ;
    static LPADRBOOK mRootBook ;
    // Class members to handle library loading/entry points
    static int32_t mLibUsage ;
    static HMODULE mLibrary ;
    static LPWABOPEN mWABOpen ;

    // Load the WAB environment
    BOOL Initialize(void) ;
    // Allocation of a buffer for transmission to interfaces
    virtual void AllocateBuffer(ULONG aByteCount, LPVOID *aBuffer) MOZ_OVERRIDE;
    // Destruction of a buffer provided by the interfaces
    virtual void FreeBuffer(LPVOID aBuffer) MOZ_OVERRIDE;
    // Manage the library
    static BOOL LoadWabLibrary(void) ;
    static void FreeWabLibrary(void) ;

private :
} ;

// Additional definitions for WAB stuff. These properties are
// only defined with regards to the default character sizes, 
// and not in two _A and _W versions...
#define PR_BUSINESS_ADDRESS_CITY_A                    PR_LOCALITY_A
#define PR_BUSINESS_ADDRESS_COUNTRY_A                 PR_COUNTRY_A
#define PR_BUSINESS_ADDRESS_POSTAL_CODE_A             PR_POSTAL_CODE_A
#define PR_BUSINESS_ADDRESS_STATE_OR_PROVINCE_A       PR_STATE_OR_PROVINCE_A
#define PR_BUSINESS_ADDRESS_STREET_A                  PR_STREET_ADDRESS_A

#define PR_BUSINESS_ADDRESS_CITY_W                    PR_LOCALITY_W
#define PR_BUSINESS_ADDRESS_COUNTRY_W                 PR_COUNTRY_W
#define PR_BUSINESS_ADDRESS_POSTAL_CODE_W             PR_POSTAL_CODE_W
#define PR_BUSINESS_ADDRESS_STATE_OR_PROVINCE_W       PR_STATE_OR_PROVINCE_W
#define PR_BUSINESS_ADDRESS_STREET_W                  PR_STREET_ADDRESS_W

#endif // nsWABAddressBook_h___

