/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "prprf.h"
#include "prmem.h"
#include "nsCOMPtr.h"
#include "nsIStringBundle.h"
#include "nsEudoraStringBundle.h"
#include "nsServiceManagerUtils.h"
#include "nsIURI.h"
#include "nsTextFormatter.h"
#include "mozilla/Services.h"

#define EUDORA_MSGS_URL       "chrome://messenger/locale/eudoraImportMsgs.properties"

nsIStringBundle *  nsEudoraStringBundle::m_pBundle = nullptr;

nsIStringBundle *nsEudoraStringBundle::GetStringBundle(void)
{
  if (m_pBundle)
    return m_pBundle;

  const char*       propertyURL = EUDORA_MSGS_URL;
  nsIStringBundle*  sBundle = nullptr;

  nsCOMPtr<nsIStringBundleService> sBundleService =
    mozilla::services::GetStringBundleService();
  if (sBundleService)
    sBundleService->CreateBundle(propertyURL, &sBundle);

  m_pBundle = sBundle;
  return sBundle;
}

void nsEudoraStringBundle::GetStringByID(PRInt32 stringID, nsString& result)
{

  PRUnichar *ptrv = GetStringByID(stringID);
  result = ptrv;
  FreeString(ptrv);
}

PRUnichar *nsEudoraStringBundle::GetStringByID(PRInt32 stringID)
{
  if (!m_pBundle)
    m_pBundle = GetStringBundle();

  if (m_pBundle)
  {
    PRUnichar *ptrv = nullptr;
    nsresult rv = m_pBundle->GetStringFromID(stringID, &ptrv);

    if (NS_SUCCEEDED(rv) && ptrv)
      return ptrv;
  }

  nsString resultString(NS_LITERAL_STRING("[StringID "));
  resultString.AppendInt(stringID);
  resultString.AppendLiteral("?]");

  return ToNewUnicode(resultString);
}

nsString nsEudoraStringBundle::FormatString(PRInt32 stringID, ...)
{
  // Yeah, I know.  This causes an extra string buffer allocation, but there's no guarantee
  // that nsString's free and nsTextFormatter::smprintf_free deallocate memory the same way.
  nsAutoString format;
  GetStringByID(stringID, format);

  va_list args;
  va_start(args, stringID);

  PRUnichar *pText = nsTextFormatter::vsmprintf(format.get(), args);
  va_end(args);

  nsString result(pText);
  nsTextFormatter::smprintf_free(pText);
  return result;
}

void nsEudoraStringBundle::Cleanup(void)
{
  if (m_pBundle)
    m_pBundle->Release();
  m_pBundle = nullptr;
}
