/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...
#include "nsMimeHeaders.h"

nsMimeHeaders::nsMimeHeaders() :
  mHeaders(nullptr)
{
}

nsMimeHeaders::~nsMimeHeaders()
{
  if (mHeaders)
    MimeHeaders_free(mHeaders);
}

NS_IMPL_ISUPPORTS1(nsMimeHeaders, nsIMimeHeaders)

nsresult nsMimeHeaders::Initialize(const nsACString &aAllHeaders)
{
  /* just in case we want to reuse the object, cleanup...*/
  if (mHeaders)
    MimeHeaders_free(mHeaders);

  mHeaders = MimeHeaders_new();
  if (mHeaders)
    // XXX This function returns -1 in some paths, not nsresult
    return static_cast<nsresult>(MimeHeaders_parse_line(
      aAllHeaders.BeginReading(), aAllHeaders.Length(), mHeaders));

  return NS_ERROR_OUT_OF_MEMORY;
}

nsresult nsMimeHeaders::ExtractHeader(const char *headerName, bool allOfThem,
    nsACString &retval)
{
  NS_ENSURE_TRUE(mHeaders, NS_ERROR_NOT_INITIALIZED);

  // The external API doesn't have nsACString::Adopt, so we need to use a
  // temporary string for adoption instead.
  nsCString tempString;
  tempString.Adopt(MimeHeaders_get(mHeaders, headerName, false, allOfThem));
  retval = tempString;
  return NS_OK;
}

NS_IMETHODIMP nsMimeHeaders::GetAllHeaders(nsACString &allHeaders)
{
  NS_ENSURE_TRUE(mHeaders, NS_ERROR_NOT_INITIALIZED);
  NS_ENSURE_TRUE(mHeaders->all_headers, NS_ERROR_NULL_POINTER);

  allHeaders.Assign(mHeaders->all_headers, mHeaders->all_headers_fp);

  return NS_OK;
}
