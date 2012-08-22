/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#define INCL_DOSMEMMGR
#define INCL_DOSERRORS
#include <os2.h>

#include "nsMessengerOS2Integration.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsMsgUtils.h"

#define WARPCENTER_SHAREDMEM "\\sharemem\\inbox.mem"

nsMessengerOS2Integration::nsMessengerOS2Integration()
{
  PVOID pvObject = NULL;
  PULONG pUnreadState = NULL;
  APIRET rc = DosGetNamedSharedMem((PVOID *)&pUnreadState, WARPCENTER_SHAREDMEM,
                                   PAG_READ | PAG_WRITE);

  if (rc != NO_ERROR) {
#ifdef MOZ_OS2_HIGH_MEMORY
    rc = DosAllocSharedMem(&pvObject, WARPCENTER_SHAREDMEM, sizeof(ULONG),
                           PAG_COMMIT | PAG_WRITE | OBJ_ANY);
    if (rc != NO_ERROR) { // Did the kernel handle OBJ_ANY?
      // Try again without OBJ_ANY and if the first failure was not caused
      // by OBJ_ANY then we will get the same failure, else we have taken
      // care of pre-FP13 systems where the kernel couldn't handle it.
      rc = DosAllocSharedMem(&pvObject, WARPCENTER_SHAREDMEM, sizeof(ULONG),
                             PAG_COMMIT | PAG_WRITE);
    }
#else
    rc = DosAllocSharedMem(&pvObject, WARPCENTER_SHAREDMEM, sizeof(ULONG),
                           PAG_COMMIT | PAG_WRITE);
#endif
    pUnreadState = (PULONG)pvObject;
  }
  *pUnreadState = 0;

  mBiffStateAtom = MsgGetAtom("BiffState");
  mTotalUnreadMessagesAtom = MsgGetAtom("TotalUnreadMessages");
}

nsMessengerOS2Integration::~nsMessengerOS2Integration()
{
  PULONG pUnreadState = NULL;
  APIRET rc = DosGetNamedSharedMem((PVOID *)&pUnreadState, WARPCENTER_SHAREDMEM,
                                   PAG_READ | PAG_WRITE);

  if (rc != NO_ERROR) {
    rc = DosFreeMem(pUnreadState);
  }
}

NS_IMPL_ISUPPORTS2(nsMessengerOS2Integration, nsIMessengerOSIntegration, nsIFolderListener)

nsresult
nsMessengerOS2Integration::Init()
{
  nsresult rv;

  nsCOMPtr <nsIMsgAccountManager> accountManager = 
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // because we care if the default server changes
  rv = accountManager->AddRootFolderListener(this);
  NS_ENSURE_SUCCESS(rv,rv);

  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemPropertyChanged(nsIMsgFolder *, nsIAtom *, char const *, char const *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemUnicharPropertyChanged(nsIMsgFolder *, nsIAtom *, const PRUnichar *, const PRUnichar *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemRemoved(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, uint32_t oldFlag, uint32_t newFlag)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemAdded(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemBoolPropertyChanged(nsIMsgFolder *aItem, nsIAtom *aProperty, bool aOldValue, bool aNewValue)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemEvent(nsIMsgFolder *, nsIAtom *)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMessengerOS2Integration::OnItemIntPropertyChanged(nsIMsgFolder *aItem, nsIAtom *aProperty, int32_t aOldValue, int32_t aNewValue)
{
  PULONG pUnreadState = NULL;
  APIRET rc = DosGetNamedSharedMem((PVOID *)&pUnreadState, WARPCENTER_SHAREDMEM,
                                   PAG_READ | PAG_WRITE);
  if (rc != NO_ERROR)
    return NS_OK;

  if (aProperty == mBiffStateAtom) {
    if (aNewValue == nsIMsgFolder::nsMsgBiffState_NewMail) {
      *pUnreadState = 1;
    } else if (aNewValue == nsIMsgFolder::nsMsgBiffState_NoMail) {
      *pUnreadState = 0;
    } else {
      // setting nothing, unknown state (nsIMsgFolder::nsMsgBiffState_Unknown)
    }
  } else if (aProperty == mTotalUnreadMessagesAtom) {
    // do nothing for now
    // (we just want to reflect the statusbar mail biff in the system)
  }

  return NS_OK;
}
