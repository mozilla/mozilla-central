/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbLDAPDirectoryModify_h__
#define nsAbLDAPDirectoryModify_h__

#include "nsAbLDAPListenerBase.h"
#include "nsIAbLDAPDirectory.h"
#include "nsILDAPOperation.h"
#include "nsIArray.h"

class nsILDAPURL;

class nsAbLDAPDirectoryModify
{
public:
  nsAbLDAPDirectoryModify();
  virtual ~nsAbLDAPDirectoryModify();

protected:
  nsresult DoModify(nsIAbLDAPDirectory *directory,
                    const int32_t &aUpdateType,
                    const nsACString &aCardDN,
                    nsIArray* modArray,
                    const nsACString &aNewRDN,
                    const nsACString &aNewBaseDN);
};

#endif // nsAbLDAPDirectoryModify_h__
