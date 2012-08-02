/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMailProfileMigratorUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIObserverService.h"
#include "nsIPrefLocalizedString.h"
#include "nsIPrefService.h"
#include "nsIServiceManager.h"
#include "nsISupportsPrimitives.h"
#include "nsNetCID.h"
#include "nsNetUtil.h"
#include "nsEudoraProfileMigrator.h"
#include "nsIProfileMigrator.h"
#include "nsIImportSettings.h"
#include "nsIFile.h"


NS_IMPL_ISUPPORTS2(nsEudoraProfileMigrator, nsIMailProfileMigrator, nsITimerCallback)


nsEudoraProfileMigrator::nsEudoraProfileMigrator()
{
  mProcessingMailFolders = false;
  // get the import service
  mImportModule = do_CreateInstance("@mozilla.org/import/import-eudora;1");
}

nsEudoraProfileMigrator::~nsEudoraProfileMigrator()
{
}

nsresult nsEudoraProfileMigrator::ContinueImport()
{
  return Notify(nullptr);
}

///////////////////////////////////////////////////////////////////////////////
// nsITimerCallback

NS_IMETHODIMP
nsEudoraProfileMigrator::Notify(nsITimer *timer)
{
  PRInt32 progress;
  mGenericImporter->GetProgress(&progress);

  nsAutoString index;
  index.AppendInt( progress );
  NOTIFY_OBSERVERS(MIGRATION_PROGRESS, index.get());

  if (progress == 100) // are we done yet?
  {
    if (mProcessingMailFolders)
      return FinishCopyingMailFolders();
    else
      return FinishCopyingAddressBookData();
  }
  else
  {
    // fire a timer to handle the next one.
    mFileIOTimer = do_CreateInstance("@mozilla.org/timer;1");
    if (mFileIOTimer)
      mFileIOTimer->InitWithCallback(static_cast<nsITimerCallback *>(this), 100, nsITimer::TYPE_ONE_SHOT);
  }
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// nsIMailProfileMigrator

NS_IMETHODIMP
nsEudoraProfileMigrator::Migrate(PRUint16 aItems, nsIProfileStartup* aStartup, const PRUnichar* aProfile)
{
  nsresult rv = NS_OK;

  if (aStartup)
  {
    rv = aStartup->DoStartup();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  NOTIFY_OBSERVERS(MIGRATION_STARTED, nullptr);
  rv = ImportSettings(mImportModule);

  // now import address books
  // this routine will asynchronously import address book data and it will then kick off
  // the final migration step, copying the mail folders over.
  rv = ImportAddressBook(mImportModule);

  // don't broadcast an on end migration here. We aren't done until our asynch import process says we are done.
  return rv;
}

NS_IMETHODIMP
nsEudoraProfileMigrator::GetMigrateData(const PRUnichar* aProfile,
                                           bool aReplace,
                                           PRUint16* aResult)
{
  // There's no harm in assuming everything is available.
  *aResult = nsIMailProfileMigrator::ACCOUNT_SETTINGS | nsIMailProfileMigrator::ADDRESSBOOK_DATA |
             nsIMailProfileMigrator::MAILDATA | nsIMailProfileMigrator::FILTERS;
  return NS_OK;
}

NS_IMETHODIMP
nsEudoraProfileMigrator::GetSourceExists(bool* aResult)
{
  *aResult = false;

  nsCOMPtr<nsIImportSettings> importSettings;
  mImportModule->GetImportInterface(NS_IMPORT_SETTINGS_STR, getter_AddRefs(importSettings));

  if (importSettings)
  {
    nsString description;
    nsCOMPtr<nsIFile> location;
    importSettings->AutoLocate(getter_Copies(description), getter_AddRefs(location), aResult);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsEudoraProfileMigrator::GetSourceHasMultipleProfiles(bool* aResult)
{
  *aResult = false;
  return NS_OK;
}

NS_IMETHODIMP
nsEudoraProfileMigrator::GetSourceProfiles(nsIArray** aResult)
{
  *aResult = nullptr;
  return NS_OK;
}

