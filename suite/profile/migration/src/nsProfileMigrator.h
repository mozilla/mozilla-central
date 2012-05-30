/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
#ifndef ProfileMigrator_h__
#define ProfileMigrator_h__

#include "nsISuiteProfileMigrator.h"
#include "nsIProfileMigrator.h"
#include "nsCOMPtr.h"

#define NS_SUITEPROFILEMIGRATOR_CID \
{ 0x4ca3c946, 0x5408, 0x49f0, { 0x9e, 0xca, 0x3a, 0x97, 0xd5, 0xc6, 0x77, 0x50 } }

#define NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "@mozilla.org/profile/migrator;1?app=suite&type="

class nsProfileMigrator : public nsIProfileMigrator
{
public:
  NS_DECL_NSIPROFILEMIGRATOR
  NS_DECL_ISUPPORTS

  nsProfileMigrator() { }

protected:
  ~nsProfileMigrator() { }

  nsresult GetSuiteMigratorKey(nsACString& key, nsISuiteProfileMigrator** spm);
};

#endif
