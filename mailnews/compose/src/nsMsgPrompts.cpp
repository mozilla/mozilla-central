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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
#include "nsMsgPrompts.h"

#include "nsMsgCopy.h"
#include "nsIPrompt.h"
#include "nsIWindowWatcher.h"
#include "nsMsgCompCID.h"
#include "nsComposeStrings.h"
#include "nsIStringBundle.h"

nsresult
nsMsgBuildErrorMessageByID(PRInt32 msgID, nsString& retval, nsString* param0, nsString* param1)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString msg;
  rv = bundle->GetStringFromID(NS_IS_MSG_ERROR(msgID) ? NS_ERROR_GET_CODE(msgID) : msgID,
                          getter_Copies(retval));
  NS_ENSURE_SUCCESS(rv, rv);

  if (param0)
    retval.ReplaceSubstring(NS_LITERAL_STRING("%P0%"), *param0);
  if (param1)
    retval.ReplaceSubstring(NS_LITERAL_STRING("%P1%"), *param1);
  return rv;
}

nsresult
nsMsgDisplayMessageByID(nsIPrompt * aPrompt, PRInt32 msgID, const PRUnichar * windowTitle)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
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
nsMsgAskBooleanQuestionByID(nsIPrompt * aPrompt, PRInt32 msgID, PRBool *answer, const PRUnichar * windowTitle)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString msg;
  bundle->GetStringFromID(msgID, getter_Copies(msg));
  return nsMsgAskBooleanQuestionByString(aPrompt, msg.get(), answer, windowTitle);
}

nsresult
nsMsgAskBooleanQuestionByString(nsIPrompt * aPrompt, const PRUnichar * msg, PRBool *answer, const PRUnichar * windowTitle)
{
  nsresult rv;
  PRInt32 result;
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
    rv = dialog->Confirm(windowTitle, msg, &result);
    if (result == 1)
      *answer = PR_TRUE;
    else
      *answer = PR_FALSE;
  }

  return NS_OK;
}
