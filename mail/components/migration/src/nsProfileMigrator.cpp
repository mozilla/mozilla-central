/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIFile.h"
#include "nsIDOMWindow.h"
#include "nsIProfileMigrator.h"
#include "nsIPrefService.h"
#include "nsIServiceManager.h"
#include "nsIToolkitProfile.h"
#include "nsIToolkitProfileService.h"
#include "nsIWindowWatcher.h"
#include "nsISupportsPrimitives.h"
#include "nsIMutableArray.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsIProperties.h"
#include "nsDirectoryServiceDefs.h"
#include "nsProfileMigrator.h"
#include "nsMailMigrationCID.h"

#ifdef XP_WIN
#include <windows.h>
#else
#include <limits.h>
#endif

NS_IMPL_ISUPPORTS1(nsProfileMigrator, nsIProfileMigrator)

#define MIGRATION_WIZARD_FE_URL "chrome://messenger/content/migration/migration.xul"
#define MIGRATION_WIZARD_FE_FEATURES "chrome,dialog,modal,centerscreen"

NS_IMETHODIMP
nsProfileMigrator::Migrate(nsIProfileStartup* aStartup, const nsACString& aKey)
{
  nsCAutoString key;
  nsCOMPtr<nsIMailProfileMigrator> mailMigrator;
  nsresult rv = GetDefaultMailMigratorKey(key, mailMigrator);
  NS_ENSURE_SUCCESS(rv, rv); // abort migration if we failed to get a mailMigrator (if we were supposed to)

  nsCOMPtr<nsISupportsCString> cstr (do_CreateInstance("@mozilla.org/supports-cstring;1"));
  NS_ENSURE_TRUE(cstr, NS_ERROR_OUT_OF_MEMORY);
  cstr->SetData(key);

  // By opening the Migration FE with a supplied mailMigrator, it will automatically
  // migrate from it.
  nsCOMPtr<nsIWindowWatcher> ww (do_GetService(NS_WINDOWWATCHER_CONTRACTID));
  nsCOMPtr<nsIMutableArray> params (do_CreateInstance(NS_ARRAY_CONTRACTID));
  if (!ww || !params) return NS_ERROR_FAILURE;

  params->AppendElement(cstr, false);
  params->AppendElement(mailMigrator, false);
  params->AppendElement(aStartup, false);

  nsCOMPtr<nsIDOMWindow> migrateWizard;
  return ww->OpenWindow(nullptr,
                        MIGRATION_WIZARD_FE_URL,
                        "_blank",
                        MIGRATION_WIZARD_FE_FEATURES,
                        params,
                        getter_AddRefs(migrateWizard));
}

#ifdef XP_WIN
typedef struct {
  WORD wLanguage;
  WORD wCodePage;
} LANGANDCODEPAGE;

#define INTERNAL_NAME_THUNDERBIRD     "Thunderbird"
#define INTERNAL_NAME_SEAMONKEY       "Mozilla"
#endif

nsresult
nsProfileMigrator::GetDefaultMailMigratorKey(nsACString& aKey, nsCOMPtr<nsIMailProfileMigrator>& mailMigrator)
{
  // look up the value of profile.force.migration in case we are supposed to force migration using a particular
  // migrator....
  nsresult rv = NS_OK;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString forceMigrationType;
  prefs->GetCharPref("profile.force.migration", getter_Copies(forceMigrationType));

  // if we are being forced to migrate to a particular migration type, then create an instance of that migrator
  // and return it.
  NS_NAMED_LITERAL_CSTRING(migratorPrefix,
                           NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX);
  nsCAutoString migratorID;
  if (!forceMigrationType.IsEmpty())
  {
    bool exists = false;
    migratorID = migratorPrefix;
    migratorID.Append(forceMigrationType);
    mailMigrator = do_CreateInstance(migratorID.get());
    if (!mailMigrator)
      return NS_ERROR_NOT_AVAILABLE;

    mailMigrator->GetSourceExists(&exists);
    /* trying to force migration on a source which doesn't
     * have any profiles.
     */
    if (!exists)
      return NS_ERROR_NOT_AVAILABLE;
    aKey = forceMigrationType;
    return NS_OK;
  }

  #define MAX_SOURCE_LENGTH 10
  const char sources[][MAX_SOURCE_LENGTH] = {
    "seamonkey",
    "oexpress",
    "outlook",
    "eudora",
    ""
  };
  for (PRUint32 i = 0; sources[i][0]; ++i)
  {
    migratorID = migratorPrefix;
    migratorID.Append(sources[i]);
    mailMigrator = do_CreateInstance(migratorID.get());
    if (!mailMigrator)
      continue;

    bool exists = false;
    mailMigrator->GetSourceExists(&exists);
    if (exists)
    {
      mailMigrator = nullptr;
      return NS_OK;
    }
  }

  return NS_ERROR_NOT_AVAILABLE;
}
