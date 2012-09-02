/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nntpCore.h"
#include "nsNewsUtils.h"
#include "nsMsgUtils.h"


/* parses NewsMessageURI */
nsresult
nsParseNewsMessageURI(const char* uri, nsCString& group, uint32_t *key)
{
  NS_ENSURE_ARG_POINTER(uri);
  NS_ENSURE_ARG_POINTER(key);

  nsAutoCString uriStr(uri);
  int32_t keySeparator = uriStr.FindChar('#');
  if(keySeparator != -1)
  {
    int32_t keyEndSeparator = MsgFindCharInSet(uriStr, "?&", keySeparator);

    // Grab between the last '/' and the '#' for the key
    group = StringHead(uriStr, keySeparator);
    int32_t groupSeparator = group.RFind("/");
    if (groupSeparator == -1)
      return NS_ERROR_FAILURE;

    // Our string APIs don't let us unescape into the same buffer from earlier,
    // so escape into a temporary
    nsAutoCString unescapedGroup;
    MsgUnescapeString(Substring(group, groupSeparator + 1), 0, unescapedGroup);
    group = unescapedGroup;

    nsAutoCString keyStr;
    if (keyEndSeparator != -1)
      keyStr = Substring(uriStr, keySeparator + 1, keyEndSeparator - (keySeparator + 1));
    else
      keyStr = Substring(uriStr, keySeparator + 1);
    nsresult errorCode;
    *key = keyStr.ToInteger(&errorCode);

    return errorCode;
  }
  return NS_ERROR_FAILURE;
}

nsresult nsCreateNewsBaseMessageURI(const char *baseURI, nsCString &baseMessageURI)
{
  nsAutoCString tailURI(baseURI);

  // chop off news:/
  if (tailURI.Find(kNewsRootURI) == 0)
    tailURI.Cut(0, PL_strlen(kNewsRootURI));

  baseMessageURI = kNewsMessageRootURI;
  baseMessageURI += tailURI;

  return NS_OK;
}
