/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is The Browser Profile Migrator.
 *
 * The Initial Developer of the Original Code is Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ben Goodger <ben@bengoodger.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsProfileMigrator.h"

#include "nsIDOMWindowInternal.h"
#include "nsILocalFile.h"
#include "nsISupportsPrimitives.h"
#include "nsISupportsArray.h"
#include "nsIToolkitProfile.h"
#include "nsIToolkitProfileService.h"
#include "nsIWindowWatcher.h"
#include "nsDirectoryServiceDefs.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "NSReg.h"
#include "nsStringAPI.h"
#include "nsIProperties.h"
#include "nsMemory.h"
#ifdef XP_WIN
#include <windows.h>
#include "nsIWindowsRegKey.h"
#include "nsILocalFileWin.h"
#include "nsUnicharUtils.h"
#endif

#ifndef MAXPATHLEN
#ifdef _MAX_PATH
#define MAXPATHLEN _MAX_PATH
#elif defined(CCHMAXPATH)
#define MAXPATHLEN CCHMAXPATH
#else
#define MAXPATHLEN 1024
#endif
#endif

///////////////////////////////////////////////////////////////////////////////
// nsIProfileMigrator

#define MIGRATION_WIZARD_FE_URL "chrome://communicator/content/migration/migration.xul"
#define MIGRATION_WIZARD_FE_FEATURES "chrome,dialog,modal,centerscreen,titlebar"

NS_IMETHODIMP
nsProfileMigrator::Migrate(nsIProfileStartup* aStartup)
{
  nsCAutoString key;
  nsCOMPtr<nsISuiteProfileMigrator> spm;

  // Get the migration key/profile to use as default. If it returns failure,
  // we haven't got any profiles avaiable to us, so just return and let the
  // app start.
  nsresult rv = GetSuiteMigratorKey(key, getter_AddRefs(spm));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsISupportsCString> cstr
    (do_CreateInstance("@mozilla.org/supports-cstring;1"));
  if (!cstr)
    return NS_ERROR_OUT_OF_MEMORY;
  cstr->SetData(key);

  // By opening the Migration FE with a supplied spm, it will automatically
  // migrate from it.
  nsCOMPtr<nsIWindowWatcher> ww(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
  nsCOMPtr<nsISupportsArray> params;
  NS_NewISupportsArray(getter_AddRefs(params));
  if (!ww || !params)
    return NS_ERROR_FAILURE;

  params->AppendElement(cstr);
  params->AppendElement(spm);
  params->AppendElement(aStartup);

  nsCOMPtr<nsIDOMWindow> migrateWizard;
  return ww->OpenWindow(nsnull,
                        MIGRATION_WIZARD_FE_URL,
                        "_blank",
                        MIGRATION_WIZARD_FE_FEATURES,
                        params,
                        getter_AddRefs(migrateWizard));
}

NS_IMETHODIMP
nsProfileMigrator::Import()
{
  // This is purposely broken as using this would mean that we have
  // to use data from where profiles exist currently. We want to copy
  // it so that we can create a "fresh" profile. There may be a way
  // to do it from here, but currently we haven't found an easy one.
  //if (ImportRegistryProfiles(NS_LITERAL_CSTRING("mozilla")))
  //    return NS_OK;

  return NS_ERROR_FAILURE;
}

///////////////////////////////////////////////////////////////////////////////
// nsProfileMigrator

NS_IMPL_ISUPPORTS1(nsProfileMigrator, nsIProfileMigrator)

struct sInternalNameToMigratorName {
  const char* internalName;
  const char* key;
};

static const sInternalNameToMigratorName nameMap[] = {
  // Possiblities for migrators when/if we have them
  // ("iexplore", "ie"),
  // ("opera", "opera"),
  // ("firebird", "firefox"), Note: Internally the firebird->firefox migrator
  // ("firefox", "firefox"),  in firefox is known as phoenix.
  // ("phoenix", "firefox"),
  {"seamonkey", "seamonkey"},
  {"apprunner", "seamonkey"}
};

static const char* migratorNames[] = {
  "seamonkey",
  "thunderbird"
};

// The purpose of this function is to attempt to get the default item
// to migrate from the default browser key. If for some reason we haven't
// got a default browser (e.g. wrong os) or we haven't got a migrator for
// the default browser, then we'll just return a migrator which has profiles
// that we can migrate.
nsresult
nsProfileMigrator::GetSuiteMigratorKey(nsACString& aKey,
                                       nsISuiteProfileMigrator** spm)
{
  *spm = nsnull;

  // Declare these here because of the #if - we need them in both bits
  PRBool exists = PR_FALSE;
  nsCString migratorID;
  nsCOMPtr<nsISuiteProfileMigrator> result;
#if XP_WIN

  nsCOMPtr<nsIWindowsRegKey> regKey =
    do_CreateInstance("@mozilla.org/windows-registry-key;1");
  if (!regKey)
    return NS_ERROR_FAILURE;

  NS_NAMED_LITERAL_STRING(kCommandKey,
                          "SOFTWARE\\Classes\\HTTP\\shell\\open\\command");

  if (NS_FAILED(regKey->Open(nsIWindowsRegKey::ROOT_KEY_LOCAL_MACHINE,
                             kCommandKey, nsIWindowsRegKey::ACCESS_READ)))
    return NS_ERROR_FAILURE;

  nsAutoString value;
  if (NS_FAILED(regKey->ReadStringValue(EmptyString(), value)))
    return NS_ERROR_FAILURE;

  PRInt32 len = value.Find(NS_LITERAL_STRING(".exe"), CaseInsensitiveCompare);
  if (len == -1)
    return NS_ERROR_FAILURE;

  // Move past ".exe"
  len += 4;

  PRUint32 start = 0;
  // skip an opening quotation mark if present
  if (value.get()[1] != ':') {
    start = 1;
    --len;
  }

  const nsDependentSubstring filePath(Substring(value, start, len)); 

  // We want to find out what the default browser is but the path in and of
  // itself isn't enough. Why? Because sometimes on Windows paths get truncated
  // like so:
  // C:\PROGRA~1\MOZILL~2\MOZILL~1.EXE
  // How do we know what product that is? Mozilla or Mozilla Firebird? etc.
  // Mozilla's file objects do nothing to 'normalize' the path so we need to
  // attain an actual product descriptor from the file somehow, and in this
  // case it means getting the "InternalName" field of the file's VERSIONINFO
  // resource.
  //
  // In the file's resource segment there is a VERSIONINFO section that is laid
  // out like this:
  //
  // VERSIONINFO
  //   StringFileInfo
  //     <TranslationID>
  //       InternalName           "iexplore"
  //   VarFileInfo
  //     Translation              <TranslationID>
  //
  // By Querying the VERSIONINFO section for its Tranlations, we can find out
  // where the InternalName lives. (A file can have more than one translation
  // of its VERSIONINFO segment, but we just assume the first one).
  nsCOMPtr<nsILocalFile> lf;
  NS_NewLocalFile(filePath, PR_TRUE, getter_AddRefs(lf));
  if (!lf)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsILocalFileWin> lfw = do_QueryInterface(lf);
  if (!lfw)
    return NS_ERROR_FAILURE;

  nsAutoString internalName;
  if (NS_FAILED(lfw->GetVersionInfoField("InternalName", internalName)))
    return NS_ERROR_FAILURE;

  if (!internalName.IsEmpty()) {
    PRUint32 i;
    for (i = 0; i < NS_ARRAY_LENGTH(nameMap); ++i) {
      if (internalName.Equals(NS_ConvertUTF8toUTF16(nameMap[i].internalName),
                              CaseInsensitiveCompare)) {
        aKey.Assign(nameMap[i].key);
        break;
      }
    }
  }

  if (!aKey.IsEmpty()) {
    migratorID.AssignLiteral(NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX);
    migratorID.Append(aKey);
    result = do_CreateInstance(migratorID.get());

    if (result)
      result->GetSourceExists(&exists);

    if (exists) {
      result.swap(*spm);
      return NS_OK;
    }
  }
#endif

  // We can't get the default migrator (either wrong OS or we don't have a
  // migrator for the default browser), so fall back to finding a valid
  // profile to migrator manually - first try what we've been given.
  for (PRUint32 j = 0; j < NS_ARRAY_LENGTH(migratorNames); ++j) {
    migratorID.AssignLiteral(NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX);
    migratorID.Append(migratorNames[j]);

    result = do_CreateInstance(migratorID.get());

    if (result)
      result->GetSourceExists(&exists);

    if (exists) {
      aKey.Assign(migratorNames[j]);
      result.swap(*spm);
      return NS_OK;
    }
  }
  return NS_ERROR_FAILURE;
}
