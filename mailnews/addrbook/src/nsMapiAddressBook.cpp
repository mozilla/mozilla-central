/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsMapiAddressBook.h"

#include "prlog.h"

#ifdef PR_LOGGING
static PRLogModuleInfo* gMapiAddressBookLog
    = PR_NewLogModule("nsMapiAddressBookLog");
#endif

#define PRINTF(args) PR_LOG(gMapiAddressBookLog, PR_LOG_DEBUG, args)

using namespace mozilla;

HMODULE nsMapiAddressBook::mLibrary = NULL ;
int32_t nsMapiAddressBook::mLibUsage = 0 ;
LPMAPIINITIALIZE nsMapiAddressBook::mMAPIInitialize = NULL ;
LPMAPIUNINITIALIZE nsMapiAddressBook::mMAPIUninitialize = NULL ;
LPMAPIALLOCATEBUFFER nsMapiAddressBook::mMAPIAllocateBuffer = NULL ;
LPMAPIFREEBUFFER nsMapiAddressBook::mMAPIFreeBuffer = NULL ;
LPMAPILOGONEX nsMapiAddressBook::mMAPILogonEx = NULL ;

BOOL nsMapiAddressBook::mInitialized = FALSE ;
BOOL nsMapiAddressBook::mLogonDone = FALSE ;
LPMAPISESSION nsMapiAddressBook::mRootSession = NULL ;
LPADRBOOK nsMapiAddressBook::mRootBook = NULL ;

BOOL nsMapiAddressBook::LoadMapiLibrary(void)
{
    if (mLibrary) { ++ mLibUsage ; return TRUE ; }
    HMODULE libraryHandle = LoadLibrary("MAPI32.DLL") ;

    if (!libraryHandle) { return FALSE ; }
    FARPROC entryPoint = GetProcAddress(libraryHandle, "MAPIGetNetscapeVersion") ;

    if (entryPoint) {
        FreeLibrary(libraryHandle) ;
        libraryHandle = LoadLibrary("MAPI32BAK.DLL") ;
        if (!libraryHandle) { return FALSE ; }
    }
    mLibrary = libraryHandle ;
    ++ mLibUsage ;
    mMAPIInitialize = reinterpret_cast<LPMAPIINITIALIZE>(GetProcAddress(mLibrary, "MAPIInitialize")) ;
    if (!mMAPIInitialize) { return FALSE ; }
    mMAPIUninitialize = reinterpret_cast<LPMAPIUNINITIALIZE>(GetProcAddress(mLibrary, "MAPIUninitialize")) ;
    if (!mMAPIUninitialize) { return FALSE ; }
    mMAPIAllocateBuffer = reinterpret_cast<LPMAPIALLOCATEBUFFER>(GetProcAddress(mLibrary, "MAPIAllocateBuffer")) ;
    if (!mMAPIAllocateBuffer) { return FALSE ; }
    mMAPIFreeBuffer = reinterpret_cast<LPMAPIFREEBUFFER>(GetProcAddress(mLibrary, "MAPIFreeBuffer")) ;
    if (!mMAPIFreeBuffer) { return FALSE ; }
    mMAPILogonEx = reinterpret_cast<LPMAPILOGONEX>(GetProcAddress(mLibrary, "MAPILogonEx")) ;
    if (!mMAPILogonEx) { return FALSE ; }
    MAPIINIT_0 mapiInit = { MAPI_INIT_VERSION, MAPI_MULTITHREAD_NOTIFICATIONS } ;
    HRESULT retCode = mMAPIInitialize(&mapiInit) ;

    if (HR_FAILED(retCode)) { 
        PRINTF(("Cannot initialize MAPI %08x.\n", retCode)) ; return FALSE ;
    }
    mInitialized = TRUE ;
    retCode = mMAPILogonEx(0, NULL, NULL,
                           MAPI_NO_MAIL | 
                           MAPI_USE_DEFAULT | 
                           MAPI_EXTENDED | 
                           MAPI_NEW_SESSION,
                           &mRootSession) ;
    if (HR_FAILED(retCode)) { 
        PRINTF(("Cannot logon to MAPI %08x.\n", retCode)) ; return FALSE ;
    }
    mLogonDone = TRUE ;
    retCode = mRootSession->OpenAddressBook(0, NULL, 0, &mRootBook) ;
    if (HR_FAILED(retCode)) { 
        PRINTF(("Cannot open MAPI address book %08x.\n", retCode)) ;
    }
    return HR_SUCCEEDED(retCode) ;
}

void nsMapiAddressBook::FreeMapiLibrary(void)
{
    if (mLibrary) {
        if (-- mLibUsage == 0) {
            {
                if (mRootBook) { mRootBook->Release() ; }
                if (mRootSession) {
                    if (mLogonDone) { 
                        mRootSession->Logoff(NULL, 0, 0) ; 
                        mLogonDone = FALSE ;
                    }
                    mRootSession->Release() ;
                }
                if (mInitialized) { 
                    mMAPIUninitialize() ; 
                    mInitialized = FALSE ;
                }
            }  
            FreeLibrary(mLibrary) ;
            mLibrary = NULL ; 
        }
    }
}

nsMapiAddressBook::nsMapiAddressBook(void)
: nsAbWinHelper()
{
    BOOL result = Initialize() ;

    NS_ASSERTION(result == TRUE, "Couldn't initialize Mapi Helper") ;
    MOZ_COUNT_CTOR(nsMapiAddressBook) ;
}

nsMapiAddressBook::~nsMapiAddressBook(void)
{
    MutexAutoLock guard(*mMutex) ;

    FreeMapiLibrary() ;
    MOZ_COUNT_DTOR(nsMapiAddressBook) ;
}

BOOL nsMapiAddressBook::Initialize(void)
{
    if (mAddressBook) { return TRUE ; }
    MutexAutoLock guard(*mMutex) ;

    if (!LoadMapiLibrary()) {
        PRINTF(("Cannot load library.\n")) ;
        return FALSE ;
    }
    mAddressBook = mRootBook ; 
    return TRUE ;
}

void nsMapiAddressBook::AllocateBuffer(ULONG aByteCount, LPVOID *aBuffer)
{
    mMAPIAllocateBuffer(aByteCount, aBuffer) ;
}

void nsMapiAddressBook::FreeBuffer(LPVOID aBuffer)
{
    mMAPIFreeBuffer(aBuffer) ;
}





