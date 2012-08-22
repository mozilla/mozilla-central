/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsMsgPrompts.h"

#include "nsMsgCopy.h"
#include "nsIPrompt.h"
#include "nsIWindowWatcher.h"
#include "nsMsgCompCID.h"
#include "nsComposeStrings.h"
#include "nsIStringBundle.h"
#include "nsServiceManagerUtils.h"
#include "nsMsgUtils.h"
#include "mozilla/Services.h"

nsresult
nsMsgGetMessageByID(int32_t aMsgID, nsString& aResult)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  if (NS_IS_MSG_ERROR(aMsgID))
    aMsgID = NS_ERROR_GET_CODE(aMsgID);

  return bundle->GetStringFromID(aMsgID, getter_Copies(aResult));
}

static nsresult
nsMsgBuildMessageByName(const PRUnichar *aName, nsIFile *aFile, nsString& aResult)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString path;
  aFile->GetPath(path);

  const PRUnichar *params[1] = {path.get()};
  return bundle->FormatStringFromName(aName, params, 1, getter_Copies(aResult));
}

nsresult
nsMsgBuildMessageWithFile(nsIFile *aFile, nsString& aResult)
{
  return nsMsgBuildMessageByName(NS_LITERAL_STRING("unableToOpenFile").get(), aFile, aResult);
}

nsresult
nsMsgBuildMessageWithTmpFile(nsIFile *aFile, nsString& aResult)
{
  return nsMsgBuildMessageByName(NS_LITERAL_STRING("unableToOpenTmpFile").get(), aFile, aResult);
}

nsresult
nsMsgDisplayMessageByID(nsIPrompt * aPrompt, int32_t msgID, const PRUnichar * windowTitle)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString msg;
  bundle->GetStringFromID(NS_IS_MSG_ERROR(msgID) ? NS_ERROR_GET_CODE(msgID) : msgID, getter_Copies(msg));
  return nsMsgDisplayMessageByString(aPrompt, msg.get(), windowTitle);
}

nsresult
nsMsgDisplayMessageByString(nsIPrompt * aPrompt, const PRUnichar * msg, const PRUnichar * windowTitle)
{
  NS_ENSURE_ARG_POINTER(msg);
  nsresult rv;
  nsCOMPtr<nsIPrompt> prompt = aPrompt;

  if (!prompt)
  {
    nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
    if (wwatch)
      wwatch->GetNewPrompter(0, getter_AddRefs(prompt));
  }

  if (prompt)
    rv = prompt->Alert(windowTitle, msg);
  return NS_OK;
}

nsresult
nsMsgAskBooleanQuestionByString(nsIPrompt * aPrompt, const PRUnichar * msg, bool *answer, const PRUnichar * windowTitle)
{
  nsresult rv;
  nsCOMPtr<nsIPrompt> dialog = aPrompt;

  if ((!msg) || (!*msg))
    return NS_ERROR_INVALID_ARG;

  if (!dialog)
  {
    nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
    if (wwatch)
      wwatch->GetNewPrompter(0, getter_AddRefs(dialog));
  }

  if (dialog)
  {
    rv = dialog->Confirm(windowTitle, msg, answer);
  }

  return NS_OK;
}
