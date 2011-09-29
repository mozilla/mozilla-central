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
 * The Original Code is Thunderbird Windows Integration.
 *
 * The Initial Developer of the Original Code is
 *   Scott MacGregor <mscott@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Strong  <robert.bugzilla@gmail.com>
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

#include "nsMailWinIntegration.h"
#include "nsIServiceManager.h"
#include "nsICategoryManager.h"
#include "nsNativeCharsetUtils.h"
#include "nsIPrefService.h"
#include "windows.h"
#include "shellapi.h"
#include "nsILocalFile.h"
#include "nsDirectoryServiceDefs.h"
#include "nsUnicharUtils.h"
#include "nsIWinTaskbar.h"
#include "nsISupportsPrimitives.h"

#ifdef _WIN32_WINNT
#undef _WIN32_WINNT
#endif
#define _WIN32_WINNT 0x0600
#define INITGUID
#include <shlobj.h>

#include <mbstring.h>

#ifndef MAX_BUF
#define MAX_BUF 4096
#endif

#define REG_FAILED(val) \
  (val != ERROR_SUCCESS)

#define NS_TASKBAR_CONTRACTID "@mozilla.org/windows-taskbar;1"

NS_IMPL_ISUPPORTS2(nsWindowsShellService, nsIWindowsShellService, nsIShellService)

static nsresult
OpenKeyForReading(HKEY aKeyRoot, const nsAString& aKeyName, HKEY* aKey)
{
  const nsString &flatName = PromiseFlatString(aKeyName);

  DWORD res = ::RegOpenKeyExW(aKeyRoot, flatName.get(), 0, KEY_READ, aKey);
  switch (res) {
  case ERROR_SUCCESS:
    break;
  case ERROR_ACCESS_DENIED:
    return NS_ERROR_FILE_ACCESS_DENIED;
  case ERROR_FILE_NOT_FOUND:
    return NS_ERROR_NOT_AVAILABLE;
  }

  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// Default Mail Registry Settings
///////////////////////////////////////////////////////////////////////////////

typedef enum {
  NO_SUBSTITUTION    = 0x00,
  APP_PATH_SUBSTITUTION  = 0x01
} SettingFlags;

// APP_REG_NAME_MAIL and APP_REG_NAME_NEWS should be kept in synch with
// AppRegNameMail and AppRegNameNews in the installer file: defines.nsi.in
#define APP_REG_NAME_MAIL L"Thunderbird"
#define APP_REG_NAME_NEWS L"Thunderbird (News)"
#define CLS_EML "ThunderbirdEML"
#define CLS_MAILTOURL "Thunderbird.Url.mailto"
#define CLS_NEWSURL "Thunderbird.Url.news"
#define CLS_FEEDURL "Thunderbird.Url.feed"
#define SOP "\\shell\\open\\command"
#define VAL_OPEN "\"%APPPATH%\" \"%1\""
#define VAL_MAIL_OPEN "\"%APPPATH%\" -osint -mail \"%1\""
#define VAL_COMPOSE_OPEN "\"%APPPATH%\" -osint -compose \"%1\""

#define MAKE_KEY_NAME1(PREFIX, MID) \
  PREFIX MID

static SETTING gMailSettings[] = {
  // File Extension Class
  { ".eml", "",  CLS_EML, NO_SUBSTITUTION },

  // File Extension Class
  { MAKE_KEY_NAME1(CLS_EML, SOP), "",  VAL_OPEN, APP_PATH_SUBSTITUTION },

  // Protocol Handler Class - for Vista and above
  { MAKE_KEY_NAME1(CLS_MAILTOURL, SOP), "", VAL_COMPOSE_OPEN, APP_PATH_SUBSTITUTION },

  // Protocol Handlers
  { MAKE_KEY_NAME1("mailto", SOP), "", VAL_COMPOSE_OPEN, APP_PATH_SUBSTITUTION },
};

static SETTING gNewsSettings[] = {
   // Protocol Handler Class - for Vista and above
  { MAKE_KEY_NAME1(CLS_NEWSURL, SOP), "", VAL_MAIL_OPEN, APP_PATH_SUBSTITUTION },

  // Protocol Handlers
  { MAKE_KEY_NAME1("news", SOP), "", VAL_MAIL_OPEN, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME1("nntp", SOP), "", VAL_MAIL_OPEN, APP_PATH_SUBSTITUTION },
};

static SETTING gFeedSettings[] = {
   // Protocol Handler Class - for Vista and above
  { MAKE_KEY_NAME1(CLS_FEEDURL, SOP), "", VAL_MAIL_OPEN, APP_PATH_SUBSTITUTION },

  // Protocol Handlers
  { MAKE_KEY_NAME1("feed", SOP), "", VAL_MAIL_OPEN, APP_PATH_SUBSTITUTION },
};

nsresult
GetHelperPath(nsAutoString& aPath)
{
  nsresult rv;
  nsCOMPtr<nsIProperties> directoryService = 
    do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> appHelper;
  rv = directoryService->Get(NS_XPCOM_CURRENT_PROCESS_DIR,
                             NS_GET_IID(nsILocalFile),
                             getter_AddRefs(appHelper));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appHelper->Append(NS_LITERAL_STRING("uninstall"));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appHelper->Append(NS_LITERAL_STRING("helper.exe"));
  NS_ENSURE_SUCCESS(rv, rv);

  return appHelper->GetPath(aPath);
}

nsresult
LaunchHelper(nsAutoString& aPath, nsAutoString& aParams)
{
  SHELLEXECUTEINFOW executeInfo = {0};

  executeInfo.cbSize = sizeof(SHELLEXECUTEINFOW);
  executeInfo.hwnd = NULL;
  executeInfo.fMask = SEE_MASK_NOCLOSEPROCESS;
  executeInfo.lpDirectory = NULL;
  executeInfo.lpFile = aPath.get();
  executeInfo.lpParameters = aParams.get();
  executeInfo.nShow = SW_SHOWNORMAL;

  if (ShellExecuteExW(&executeInfo))
    // Block until the program exits
    WaitForSingleObject(executeInfo.hProcess, INFINITE);
  else
    return NS_ERROR_ABORT;

  // We're going to ignore errors here since there's nothing we can do about
  // them, and helper.exe seems to return non-zero ret on success.
  return NS_OK;
}

NS_IMETHODIMP
nsWindowsShellService::ShortcutMaintenance()
{
  nsresult rv;

  // Launch helper.exe so it can update the application user model ids on
  // shortcuts in the user's taskbar and start menu. This keeps older pinned
  // shortcuts grouped correctly after major updates. Note, we also do this
  // through the upgrade installer script, however, this is the only place we
  // have a chance to trap links created by users who do control the install/
  // update process of the browser.

  nsCOMPtr<nsIWinTaskbar> taskbarInfo = do_GetService(NS_TASKBAR_CONTRACTID);
  if (!taskbarInfo) // If we haven't built with win7 sdk features, this fails.
    return NS_OK;

  // Avoid if this isn't Win7+
  bool isSupported = false;
  taskbarInfo->GetAvailable(&isSupported);
  if (!isSupported)
    return NS_OK;

  nsAutoString appId;
  if (NS_FAILED(taskbarInfo->GetDefaultGroupId(appId)))
    return NS_ERROR_UNEXPECTED;

  NS_NAMED_LITERAL_CSTRING(prefName, "mail.taskbar.lastgroupid");
  nsCOMPtr<nsIPrefService> prefs =
    do_GetService(NS_PREFSERVICE_CONTRACTID);
  if (!prefs)
    return NS_ERROR_UNEXPECTED;

  nsCOMPtr<nsIPrefBranch> prefBranch;
  prefs->GetBranch(nsnull, getter_AddRefs(prefBranch));
  if (!prefBranch)
    return NS_ERROR_UNEXPECTED;

  nsCOMPtr<nsISupportsString> prefString;
  rv = prefBranch->GetComplexValue(prefName.get(),
                                   NS_GET_IID(nsISupportsString),
                                   getter_AddRefs(prefString));
  if (NS_SUCCEEDED(rv)) {
    nsAutoString version;
    prefString->GetData(version);
    if (!version.IsEmpty() && version.Equals(appId)) {
      // We're all good, get out of here.
      return NS_OK;
    }
  }
  // Update the version in prefs
  prefString =
    do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID, &rv);
  if (NS_FAILED(rv))
    return rv;

  prefString->SetData(appId);
  rv = prefBranch->SetComplexValue(prefName.get(),
                                   NS_GET_IID(nsISupportsString),
                                   prefString);
  if (NS_FAILED(rv)) {
    NS_WARNING("Couldn't set last user model id!");
    return NS_ERROR_UNEXPECTED;
  }

  nsAutoString appHelperPath;
  if (NS_FAILED(GetHelperPath(appHelperPath)))
    return NS_ERROR_UNEXPECTED;

  nsAutoString params;
  params.AssignLiteral(" /UpdateShortcutAppUserModelIds");
  return LaunchHelper(appHelperPath, params);
}

nsresult nsWindowsShellService::Init()
{
  nsresult rv;

  PRUnichar appPath[MAX_BUF];
  if (!::GetModuleFileNameW(0, appPath, MAX_BUF))
    return NS_ERROR_FAILURE;

  // Convert the path to a long path since GetModuleFileNameW returns the path
  // that was used to launch the app which is not necessarily a long path.
  if (!::GetLongPathNameW(appPath, appPath, MAX_BUF))
    return NS_ERROR_FAILURE;

  mAppLongPath = appPath;

  return NS_OK;
}

nsWindowsShellService::nsWindowsShellService()
:mCheckedThisSession(PR_FALSE)
{
}

NS_IMETHODIMP
nsWindowsShellService::IsDefaultClient(bool aStartupCheck, PRUint16 aApps, bool *aIsDefaultClient)
{
  // If this is the first mail window, maintain internal state that we've
  // checked this session (so that subsequent window opens don't show the
  // default client dialog).
  if (aStartupCheck)
    mCheckedThisSession = PR_TRUE;

  *aIsDefaultClient = PR_TRUE;

  // for each type,
  if (aApps & nsIShellService::MAIL)
  {
    *aIsDefaultClient &= TestForDefault(gMailSettings, sizeof(gMailSettings)/sizeof(SETTING));
    // Only check if this app is default on Vista if the previous checks
    // indicate that this app is the default.
    if (*aIsDefaultClient)
      IsDefaultClientVista(nsIShellService::MAIL, aIsDefaultClient);
  }
  if (aApps & nsIShellService::NEWS)
  {
    *aIsDefaultClient &= TestForDefault(gNewsSettings, sizeof(gNewsSettings)/sizeof(SETTING));
    // Only check if this app is default on Vista if the previous checks
    // indicate that this app is the default.
    if (*aIsDefaultClient)
      IsDefaultClientVista(nsIShellService::NEWS, aIsDefaultClient);
  }
  // RSS / feed protocol shell integration is not working so return PR_TRUE
  // until it is fixed (bug 445823).
  if (aApps & nsIShellService::RSS)
    *aIsDefaultClient &= PR_TRUE;
//    *aIsDefaultClient &= TestForDefault(gFeedSettings, sizeof(gFeedSettings)/sizeof(SETTING));

  return NS_OK;
}

NS_IMETHODIMP
nsWindowsShellService::SetDefaultClient(bool aForAllUsers, PRUint16 aApps)
{
  nsAutoString appHelperPath;
  if (NS_FAILED(GetHelperPath(appHelperPath)))
    return NS_ERROR_FAILURE;

  nsAutoString params;
  if (aForAllUsers)
  {
    params.AppendLiteral(" /SetAsDefaultAppGlobal");
  }
  else
  {
    params.AppendLiteral(" /SetAsDefaultAppUser");
    if (aApps & nsIShellService::MAIL)
      params.AppendLiteral(" Mail");

    if (aApps & nsIShellService::NEWS)
      params.AppendLiteral(" News");
  }

  return LaunchHelper(appHelperPath, params);
}

NS_IMETHODIMP
nsWindowsShellService::GetShouldCheckDefaultClient(bool* aResult)
{
  if (mCheckedThisSession)
  {
    *aResult = PR_FALSE;
    return NS_OK;
  }

  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  return prefs->GetBoolPref("mail.shell.checkDefaultClient", aResult);
}

NS_IMETHODIMP
nsWindowsShellService::SetShouldCheckDefaultClient(bool aShouldCheck)
{
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  return prefs->SetBoolPref("mail.shell.checkDefaultClient", aShouldCheck);
}

/* helper routine. Iterate over the passed in settings object. */
bool
nsWindowsShellService::TestForDefault(SETTING aSettings[], PRInt32 aSize)
{
  bool isDefault = true;
  PRUnichar currValue[MAX_BUF];
  SETTING* end = aSettings + aSize;
  for (SETTING * settings = aSettings; settings < end; ++settings)
  {
    NS_ConvertUTF8toUTF16 dataLongPath(settings->valueData);
    NS_ConvertUTF8toUTF16 key(settings->keyName);
    NS_ConvertUTF8toUTF16 value(settings->valueName);
    if (settings->flags & APP_PATH_SUBSTITUTION)
    {
      PRInt32 offset = dataLongPath.Find("%APPPATH%");
      dataLongPath.Replace(offset, 9, mAppLongPath);
    }

    ::ZeroMemory(currValue, sizeof(currValue));
    HKEY theKey;
    nsresult rv = OpenKeyForReading(HKEY_CLASSES_ROOT, key, &theKey);
    if (NS_FAILED(rv))
    {
      // Key doesn't exist
      isDefault = PR_FALSE;
      break;
    }

    DWORD len = sizeof currValue;
    DWORD result = ::RegQueryValueExW(theKey, PromiseFlatString(value).get(),
                                      NULL, NULL, (LPBYTE)currValue, &len);
    // Close the key we opened.
    ::RegCloseKey(theKey);
    if (REG_FAILED(result) ||
        !dataLongPath.Equals(currValue, nsCaseInsensitiveStringComparator()))
    {
      // Key wasn't set, or was set to something else (something else became the default client)
      isDefault = PR_FALSE;
      break;
    }
  }  // for each registry key we want to look at

  return isDefault;
}

bool
nsWindowsShellService::IsDefaultClientVista(PRUint16 aApps, bool* aIsDefaultClient)
{
#if MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN
  IApplicationAssociationRegistration* pAAR;

  HRESULT hr = CoCreateInstance (CLSID_ApplicationAssociationRegistration,
                                 NULL,
                                 CLSCTX_INPROC,
                                 IID_IApplicationAssociationRegistration,
                                 (void**)&pAAR);

  if (SUCCEEDED(hr))
  {
    bool isDefaultMail = true;
    bool isDefaultNews = true;
    if (aApps & nsIShellService::MAIL)
      pAAR->QueryAppIsDefaultAll(AL_EFFECTIVE, APP_REG_NAME_MAIL, &isDefaultMail);
    if (aApps & nsIShellService::NEWS)
      pAAR->QueryAppIsDefaultAll(AL_EFFECTIVE, APP_REG_NAME_NEWS, &isDefaultNews);

    *aIsDefaultClient = isDefaultNews && isDefaultMail;

    pAAR->Release();
    return PR_TRUE;
  }
#endif
  return PR_FALSE;
}
