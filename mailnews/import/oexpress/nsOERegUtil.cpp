/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsOERegUtil.h"

#include "OEDebugLog.h"
#include <windows.h>
#include "nsIWindowsRegKey.h"
#include "nsComponentManagerUtils.h"

nsresult nsOERegUtil::GetDefaultUserId(nsAString &aUserId)
{
  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 NS_LITERAL_STRING("Identities"),
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  if (NS_FAILED(rv))
    return rv;

  return key->ReadStringValue(NS_LITERAL_STRING("Default User ID"), aUserId);
}

