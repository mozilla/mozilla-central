/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
  Eudora settings
*/

#include "nsCOMPtr.h"
#include "nscore.h"
#include "nsEudoraSettings.h"
#include "nsEudoraStringBundle.h"
#include "nsComponentManagerUtils.h"
#include "EudoraDebugLog.h"

#if defined(XP_WIN) || defined(XP_OS2)
#include "nsEudoraWin32.h"
#endif
#ifdef XP_MACOSX
#include "nsEudoraMac.h"
#endif


////////////////////////////////////////////////////////////////////////
nsresult nsEudoraSettings::Create(nsIImportSettings** aImport)
{
    NS_PRECONDITION(aImport != nullptr, "null ptr");
    if (! aImport)
        return NS_ERROR_NULL_POINTER;

    *aImport = new nsEudoraSettings();
    if (! *aImport)
        return NS_ERROR_OUT_OF_MEMORY;

    NS_ADDREF(*aImport);
    return NS_OK;
}

nsEudoraSettings::nsEudoraSettings()
{
}

nsEudoraSettings::~nsEudoraSettings()
{
}

NS_IMPL_ISUPPORTS1(nsEudoraSettings, nsIImportSettings)

NS_IMETHODIMP nsEudoraSettings::AutoLocate(PRUnichar **description, nsIFile **location, bool *_retval)
{
    NS_PRECONDITION(description != nullptr, "null ptr");
    NS_PRECONDITION(_retval != nullptr, "null ptr");
    NS_PRECONDITION(location != nullptr, "null ptr");
  if (!description || !_retval || !location)
    return NS_ERROR_NULL_POINTER;

  *description = nullptr;
  *_retval = false;

  nsresult  rv;
        m_pLocation =  do_CreateInstance (NS_LOCAL_FILE_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
  *description = nsEudoraStringBundle::GetStringByID(EUDORAIMPORT_NAME);

#if defined(XP_WIN) || defined(XP_OS2)
  *_retval = nsEudoraWin32::FindSettingsFile(getter_AddRefs(m_pLocation));
#endif

  NS_IF_ADDREF(*location = m_pLocation);
  return NS_OK;
}

NS_IMETHODIMP nsEudoraSettings::SetLocation(nsIFile *location)
{
  m_pLocation = location;
  return NS_OK;
}

NS_IMETHODIMP nsEudoraSettings::Import(nsIMsgAccount **localMailAccount, bool *_retval)
{
  NS_PRECONDITION(_retval != nullptr, "null ptr");

  *_retval = false;

  // Get the settings file if it doesn't exist
  if (!m_pLocation) {
#if defined(XP_WIN) || defined(XP_OS2)
    nsresult  rv;
                m_pLocation =  do_CreateInstance (NS_LOCAL_FILE_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv)) {
      if (!nsEudoraWin32::FindSettingsFile(getter_AddRefs(m_pLocation))) {
        m_pLocation = nullptr;
      }
    }
#endif
#ifdef XP_MACOSX
                nsEudoraMac::FindSettingsFile(getter_AddRefs(m_pLocation));
#endif
  }

  if (!m_pLocation) {
    IMPORT_LOG0("*** Error, unable to locate settings file for import.\n");
    return NS_ERROR_FAILURE;
  }

  // do the settings import
#if defined(XP_WIN) || defined(XP_OS2)
  *_retval = nsEudoraWin32::ImportSettings(m_pLocation, localMailAccount);
#endif
#ifdef XP_MACOSX
  *_retval = nsEudoraMac::ImportSettings(m_pLocation, localMailAccount);
#endif

  if (*_retval) {
    IMPORT_LOG0("Successful import of eudora settings\n");
  }
  else {
    IMPORT_LOG0("*** Error, Unsuccessful import of eudora settings\n");
  }

  return NS_OK;
}
