/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef eudoraprofilemigrator___h___
#define eudoraprofilemigrator___h___

#include "nsIMailProfileMigrator.h"
#include "nsIFile.h"
#include "nsIObserverService.h"
#include "nsString.h"
#include "nsITimer.h"
#include "nsIImportGeneric.h"
#include "nsIImportModule.h"
#include "nsIMsgAccount.h"
#include "nsProfileMigratorBase.h"

class nsIFile;
class nsIPrefBranch;
class nsIPrefService;

class nsEudoraProfileMigrator : public nsIMailProfileMigrator,
                            public nsITimerCallback,
                            public nsProfileMigratorBase
{
public:
  NS_DECL_NSIMAILPROFILEMIGRATOR
  NS_DECL_ISUPPORTS
  NS_DECL_NSITIMERCALLBACK

  nsEudoraProfileMigrator();
  virtual ~nsEudoraProfileMigrator();

  virtual nsresult ContinueImport();

private:
};
 
#endif
