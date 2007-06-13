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

  // The purpose of this section is to find the current default browser to
  // select the default option in the migration dialog.
  nsresult rv = GetDefaultSuiteMigratorKey(key, getter_AddRefs(spm));
  if (NS_FAILED(rv))
    return rv;

  if (!spm)
  {
    nsCAutoString contractID =
      NS_LITERAL_CSTRING(NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX);
    contractID.Append(key);

    spm = do_CreateInstance(contractID.get());

    // If we don't have a default for this, fallback to one we do know that
    // we have a contract id for - the migration.js code will sort out the
    // rest of it for us.
    if (!spm)
    {
      key.AssignLiteral("seamonkey");
      spm = do_CreateInstance(NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "seamonkey");
      // If we don't have it here, we really are in trouble.
      if (!spm)
        return NS_ERROR_FAILURE;
    }
  }

  PRBool sourceExists;
  spm->GetSourceExists(&sourceExists);
  if (!sourceExists)
  {
#ifdef XP_WIN
    // The "Default Browser" key in the registry was set to a browser for which
    // no profile data exists. On Windows, this means the Default Browser
    // settings in the registry are bad, and we should just fall back to IE
    // in this case.
    spm = do_CreateInstance(NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "ie");
    key.AssignLiteral("ie");
#else
    return NS_ERROR_FAILURE;
#endif
  }

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

#ifdef XP_WIN

#define INTERNAL_NAME_FIREBIRD        "firebird"
#define INTERNAL_NAME_FIREFOX         "firefox"
#define INTERNAL_NAME_PHOENIX         "phoenix"
#define INTERNAL_NAME_IEXPLORE        "iexplore"
#define INTERNAL_NAME_MOZILLA_SUITE   "apprunner"
#define INTERNAL_NAME_SEAMONKEY       "seamonkey"
#define INTERNAL_NAME_DOGBERT         "netscape"
#define INTERNAL_NAME_OPERA           "opera"
#endif

nsresult
nsProfileMigrator::GetDefaultSuiteMigratorKey(nsACString& aKey,
                                              nsISuiteProfileMigrator** spm)
{
  *spm = nsnull;

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

  if (internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_IEXPLORE)) {
    aKey.AssignLiteral("ie");
    return NS_OK;
  }
  if (internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_MOZILLA_SUITE) ||
      internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_SEAMONKEY)) {
    aKey.AssignLiteral("seamonkey");
    return NS_OK;
  }
  if (internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_DOGBERT)) {
    aKey.AssignLiteral("dogbert");
    return NS_OK;
  }
  if (internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_OPERA)) {
    aKey.AssignLiteral("opera");
    return NS_OK;
  }

  // Migrate data from any existing Application Data\Phoenix\* installations.
  if (internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_FIREBIRD) ||
      internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_FIREFOX) ||
      internalName.LowerCaseEqualsLiteral(INTERNAL_NAME_PHOENIX)) {
    aKey.AssignLiteral("phoenix");
    return NS_OK;
  }
#else
  nsCOMPtr<nsISuiteProfileMigrator> result;

  // XXX - until we figure out what to do here with default browsers on
  // MacOS and GNOME, simply copy data from a previous Seamonkey install.
  PRBool exists = PR_FALSE;
  result =
    do_CreateInstance(NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "seamonkey");
  if (result)
    result->GetSourceExists(&exists);
  if (exists) {
    aKey.AssignLiteral("seamonkey");
    result.swap(*spm);
    return NS_OK;
  }

  result =
    do_CreateInstance(NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "thunderbird");
  if (result)
    result->GetSourceExists(&exists);
  if (exists) {
    aKey.AssignLiteral("thunderbird");
    result.swap(*spm);
    return NS_OK;
  }
#endif
  return NS_ERROR_FAILURE;
}
