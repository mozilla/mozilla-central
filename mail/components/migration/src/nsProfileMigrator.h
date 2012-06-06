/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIFile.h"
#include "nsIProfileMigrator.h"
#include "nsIMailProfileMigrator.h"
#include "nsIServiceManager.h"
#include "nsIToolkitProfile.h"
#include "nsIToolkitProfileService.h"
#include "nsCOMPtr.h"
#include "nsDirectoryServiceDefs.h"

#include "nsStringGlue.h"

#define NS_THUNDERBIRD_PROFILEIMPORT_CID \
{ 0xb3c78baf, 0x3a52, 0x41d2, { 0x97, 0x18, 0xc3, 0x19, 0xbe, 0xf9, 0xaf, 0xfc } }

class nsProfileMigrator : public nsIProfileMigrator
{
public:
  NS_DECL_NSIPROFILEMIGRATOR
  NS_DECL_ISUPPORTS

  nsProfileMigrator() { };

protected:
  ~nsProfileMigrator() { };

  nsresult GetDefaultMailMigratorKey(nsACString& key, nsCOMPtr<nsIMailProfileMigrator>& mailMigrator);
};
