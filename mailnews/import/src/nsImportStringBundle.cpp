/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "prprf.h"
#include "prmem.h"
#include "nsCOMPtr.h"
#include "nsIStringBundle.h"
#include "nsImportStringBundle.h"
#include "nsIServiceManager.h"
#include "nsIURI.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "mozilla/Services.h"

nsresult nsImportStringBundle::GetStringBundle(const char *aPropertyURL,
                                               nsIStringBundle **aBundle)
{
  nsresult rv;

  nsCOMPtr<nsIStringBundleService> sBundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(sBundleService, NS_ERROR_UNEXPECTED);
  rv = sBundleService->CreateBundle(aPropertyURL, aBundle);

  return rv;
}

void nsImportStringBundle::GetStringByID(int32_t aStringID,
                                         nsIStringBundle *aBundle,
                                         nsString &aResult)
{
  aResult.Adopt(GetStringByID(aStringID, aBundle));
}

PRUnichar *nsImportStringBundle::GetStringByID(int32_t aStringID,
                                               nsIStringBundle *aBundle)
{
  if (aBundle)
  {
    PRUnichar *ptrv = nullptr;
    nsresult rv = aBundle->GetStringFromID(aStringID, &ptrv);

    if (NS_SUCCEEDED(rv) && ptrv)
      return ptrv;
  }

  nsString resultString(NS_LITERAL_STRING("[StringID "));
  resultString.AppendInt(aStringID);
  resultString.AppendLiteral("?]");

  return ToNewUnicode(resultString);
}

void nsImportStringBundle::GetStringByName(const char *aName,
                                           nsIStringBundle *aBundle,
                                           nsString &aResult)
{
  aResult.Adopt(GetStringByName(aName, aBundle));
}

PRUnichar *nsImportStringBundle::GetStringByName(const char *aName,
                                                 nsIStringBundle *aBundle)
{
  if (aBundle)
  {
    PRUnichar *ptrv = nullptr;
    nsresult rv = aBundle->GetStringFromName(
        NS_ConvertUTF8toUTF16(aName).get(), &ptrv);

    if (NS_SUCCEEDED(rv) && ptrv)
      return ptrv;
  }

  nsString resultString(NS_LITERAL_STRING("[StringName "));
  resultString.Append(NS_ConvertUTF8toUTF16(aName).get());
  resultString.AppendLiteral("?]");

  return ToNewUnicode(resultString);
}
