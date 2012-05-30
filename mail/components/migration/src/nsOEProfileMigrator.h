/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef oeprofilemigrator___h___
#define oeprofilemigrator___h___

#include "nsIMailProfileMigrator.h"
#include "nsITimer.h"
#include "nsProfileMigratorBase.h"

class nsIFile;
class nsIPrefBranch;
class nsIPrefService;

class nsOEProfileMigrator : public nsIMailProfileMigrator,
                            public nsITimerCallback,
                            public nsProfileMigratorBase
{
public:
  NS_DECL_NSIMAILPROFILEMIGRATOR
  NS_DECL_ISUPPORTS
  NS_DECL_NSITIMERCALLBACK

  nsOEProfileMigrator();
  virtual ~nsOEProfileMigrator();

  virtual nsresult ContinueImport();

private:
};
 
#endif
