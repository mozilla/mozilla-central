/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef profilemigratorbase___h___
#define profilemigratorbase___h___

#include "nsIFile.h"
#include "nsIObserverService.h"
#include "nsString.h"
#include "nsITimer.h"
#include "nsIImportGeneric.h"
#include "nsIImportModule.h"
#include "nsIMsgAccount.h"

class nsProfileMigratorBase
{
public:
  nsProfileMigratorBase();
  virtual ~nsProfileMigratorBase();
  virtual nsresult ContinueImport() = 0;

protected:
  nsresult ImportSettings(nsIImportModule * aImportModule);
  nsresult ImportAddressBook(nsIImportModule * aImportModule);
  nsresult ImportMailData(nsIImportModule * aImportModule);
  nsresult ImportFilters(nsIImportModule * aImportModule);
  nsresult FinishCopyingAddressBookData();
  nsresult FinishCopyingMailFolders();

  nsCOMPtr<nsIObserverService> mObserverService;
  nsCOMPtr<nsITimer> mFileIOTimer;
  nsCOMPtr<nsIImportGeneric> mGenericImporter;
  nsCOMPtr<nsIImportModule> mImportModule;
  nsCOMPtr<nsIMsgAccount> mLocalFolderAccount; // needed for nsIImportSettings::Import
  bool mProcessingMailFolders; // we are either asynchronously parsing address books or mail folders
};

#endif
