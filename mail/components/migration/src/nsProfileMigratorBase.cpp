/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMailProfileMigratorUtils.h"
#include "nsISupportsPrimitives.h"
#include "nsProfileMigratorBase.h"
#include "nsIMailProfileMigrator.h"

#include "nsIImportSettings.h"
#include "nsIImportFilters.h"

#define kPersonalAddressbookUri "moz-abmdbdirectory://abook.mab"

nsProfileMigratorBase::nsProfileMigratorBase()
{
  mObserverService = do_GetService("@mozilla.org/observer-service;1");
  mProcessingMailFolders = false;
}

nsProfileMigratorBase::~nsProfileMigratorBase()
{
  if (mFileIOTimer)
    mFileIOTimer->Cancel();
}

nsresult nsProfileMigratorBase::ImportSettings(nsIImportModule * aImportModule)
{
  nsresult rv;

  nsAutoString index;
  index.AppendInt(nsIMailProfileMigrator::ACCOUNT_SETTINGS);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());

  nsCOMPtr<nsIImportSettings> importSettings;
  rv = aImportModule->GetImportInterface(NS_IMPORT_SETTINGS_STR, getter_AddRefs(importSettings));
  NS_ENSURE_SUCCESS(rv, rv);

  bool importedSettings = false;

  rv = importSettings->Import(getter_AddRefs(mLocalFolderAccount), &importedSettings);

  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  return rv;
}

nsresult nsProfileMigratorBase::ImportAddressBook(nsIImportModule * aImportModule)
{
  nsresult rv;

  nsAutoString index;
  index.AppendInt(nsIMailProfileMigrator::ADDRESSBOOK_DATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());

  rv = aImportModule->GetImportInterface(NS_IMPORT_ADDRESS_STR, getter_AddRefs(mGenericImporter));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsCString> pabString = do_CreateInstance(NS_SUPPORTS_CSTRING_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // we want to migrate the outlook express addressbook into our personal address book
  pabString->SetData(nsDependentCString(kPersonalAddressbookUri));
  mGenericImporter->SetData("addressDestination", pabString);

  bool importResult;
  bool wantsProgress;
  mGenericImporter->WantsProgress(&wantsProgress);
  rv = mGenericImporter->BeginImport(nullptr, nullptr, &importResult);

  if (wantsProgress)
    ContinueImport();
  else
    FinishCopyingAddressBookData();

  return rv;
}

nsresult nsProfileMigratorBase::FinishCopyingAddressBookData()
{
  nsAutoString index;
  index.AppendInt(nsIMailProfileMigrator::ADDRESSBOOK_DATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  // now kick off the mail migration code
  ImportMailData(mImportModule);

  return NS_OK;
}

nsresult nsProfileMigratorBase::ImportMailData(nsIImportModule * aImportModule)
{
  nsresult rv;

  nsAutoString index;
  index.AppendInt(nsIMailProfileMigrator::MAILDATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());

  rv = aImportModule->GetImportInterface(NS_IMPORT_MAIL_STR, getter_AddRefs(mGenericImporter));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsPRBool> migrating = do_CreateInstance(NS_SUPPORTS_PRBOOL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // by setting the migration flag, we force the import utility to install local folders from OE
  // directly into Local Folders and not as a subfolder
  migrating->SetData(true);
  mGenericImporter->SetData("migration", migrating);

  bool importResult;
  bool wantsProgress;
  mGenericImporter->WantsProgress(&wantsProgress);
  rv = mGenericImporter->BeginImport(nullptr, nullptr, &importResult);

  mProcessingMailFolders = true;

  if (wantsProgress)
    ContinueImport();
  else
    FinishCopyingMailFolders();

  return rv;
}

nsresult nsProfileMigratorBase::FinishCopyingMailFolders()
{
  nsAutoString index;
  index.AppendInt(nsIMailProfileMigrator::MAILDATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  // now kick off the filters migration code
  return ImportFilters(mImportModule);
}

nsresult nsProfileMigratorBase::ImportFilters(nsIImportModule * aImportModule)
{
  nsresult rv = NS_OK;

  nsCOMPtr<nsIImportFilters> importFilters;
  nsresult rv2 = aImportModule->GetImportInterface(NS_IMPORT_FILTERS_STR, getter_AddRefs(importFilters));

  if (NS_SUCCEEDED(rv2))
  {
    nsAutoString index;
    index.AppendInt(nsIMailProfileMigrator::FILTERS);
    NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());

    bool importedFilters = false;
    PRUnichar* error;

    rv = importFilters->Import(&error, &importedFilters);

    NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());
  }

  // migration is now done...notify the UI.
  NOTIFY_OBSERVERS(MIGRATION_ENDED, nullptr);

  return rv;
}

