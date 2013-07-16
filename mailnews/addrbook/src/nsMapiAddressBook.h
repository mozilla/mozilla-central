/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsMapiAddressBook_h___
#define nsMapiAddressBook_h___

#include "mozilla/Attributes.h"
#include "nsAbWinHelper.h"
 
class nsMapiAddressBook : public nsAbWinHelper
{
public :
    nsMapiAddressBook(void) ;
    virtual ~nsMapiAddressBook(void) ;

protected :
    // Class members to handle the library/entry points
    static HMODULE mLibrary ;
    static int32_t mLibUsage ;
    static LPMAPIINITIALIZE mMAPIInitialize ;
    static LPMAPIUNINITIALIZE mMAPIUninitialize ;
    static LPMAPIALLOCATEBUFFER mMAPIAllocateBuffer ;
    static LPMAPIFREEBUFFER mMAPIFreeBuffer ;
    static LPMAPILOGONEX mMAPILogonEx ;
    // Shared session and address book used by all instances.
    // For reasons best left unknown, MAPI doesn't seem to like
    // having different threads playing with supposedly different
    // sessions and address books. They ll end up fighting over
    // the same resources, with hangups and GPF resulting. Not nice.
    // So it seems that if everybody (as long as some client is 
    // still alive) is using the same sessions and address books,
    // MAPI feels better. And who are we to get in the way of MAPI
    // happiness? Thus the following class members:
    static BOOL mInitialized ;
    static BOOL mLogonDone ;
    static LPMAPISESSION mRootSession ;
    static LPADRBOOK mRootBook ;

    // Load the MAPI environment
    BOOL Initialize(void) ;
    // Allocation of a buffer for transmission to interfaces
    virtual void AllocateBuffer(ULONG aByteCount, LPVOID *aBuffer) MOZ_OVERRIDE;
    // Destruction of a buffer provided by the interfaces
    virtual void FreeBuffer(LPVOID aBuffer) MOZ_OVERRIDE;
    // Library management 
    static BOOL LoadMapiLibrary(void) ;
    static void FreeMapiLibrary(void) ;

private :
} ;

#endif // nsMapiAddressBook_h___

