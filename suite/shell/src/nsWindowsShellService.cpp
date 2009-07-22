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
 * The Original Code is Shell Service.
 *
 * The Initial Developer of the Original Code is mozilla.org.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ben Goodger    <ben@mozilla.org>       (Clients, Mail, New Default Browser)
 *  Joe Hewitt     <hewitt@netscape.com>   (Set Background)
 *  Blake Ross     <blake@cs.stanford.edu> (Desktop Color, DDE support)
 *  Jungshik Shin  <jshin@mailaps.org>     (I18N)
 *  Robert Strong  <robert.bugzilla@gmail.com>  (Long paths, DDE)
 *  Asaf Romano    <mano@mozilla.com>
 *  Ryan Jones     <sciguyryan@gmail.com>
 *  Frank Wein     <mcsmurf@mcsmurf.de>
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

#ifdef MOZILLA_1_9_1_BRANCH
#include "gfxIImageFrame.h"
#endif
#include "imgIContainer.h"
#include "imgIRequest.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIImageLoadingContent.h"
#include "nsIPrefService.h"
#include "nsIPrefLocalizedString.h"
#include "nsWindowsShellService.h"
#include "nsIProcess.h"
#include "windows.h"
#include "nsILocalFile.h"
#include "nsNetUtil.h"
#include "nsNativeCharsetUtils.h"
#include "nsUnicharUtils.h"
#include "nsIStringBundle.h"
#include "nsIServiceManager.h"
#include "nsServiceManagerUtils.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsDirectoryServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsCOMPtr.h"
#include <mbstring.h>

#ifdef _WIN32_WINNT
#undef _WIN32_WINNT
#endif
#define _WIN32_WINNT 0x0600
#define INITGUID
#include <shlobj.h>

#ifndef MAX_BUF
#define MAX_BUF 4096
#endif

#define SHELLSERVICE_PROPERTIES "chrome://communicator/locale/shellservice.properties"
#define BRAND_PROPERTIES "chrome://branding/locale/brand.properties"

#define REG_SUCCEEDED(val) \
  (val == ERROR_SUCCESS)

#define REG_FAILED(val) \
  (val != ERROR_SUCCESS)

NS_IMPL_ISUPPORTS1(nsWindowsShellService, nsIShellService)

static nsresult
OpenKeyForReading(HKEY aKeyRoot, const PRUnichar* aKeyName, HKEY* aKey)
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
// Default SeaMonkey OS integration Registry Settings
// Note: Some settings only exist when using the installer!
//       The setting of SeaMonkey as default application is made by a helper
//       application since writing those values may require elevation.
//
// Default Browser settings:
// - File Extension Mappings
//   -----------------------
//   The following file extensions:
//    .htm .html .shtml .xht .xhtml
//   are mapped like so:
//
//   HKCU\SOFTWARE\Classes\.<ext>\      (default)         REG_SZ   SeaMonkeyHTML
//
//   as aliases to the class:
//
//   HKCU\SOFTWARE\Classes\SeaMonkeyHTML\
//     DefaultIcon                      (default)         REG_SZ     <appfolder>\chrome\icons\default\html-file.ico
//     shell\open\command               (default)         REG_SZ     <apppath> -url "%1"
//
// - Windows Vista Protocol Handler
//
//   HKCU\SOFTWARE\Classes\SeaMonkeyURL\(default)         REG_SZ     <appname> URL
//                                      EditFlags         REG_DWORD  2
//                                      FriendlyTypeName  REG_SZ     <appname> URL
//     DefaultIcon                      (default)         REG_SZ     <apppath>,1
//     shell\open\command               (default)         REG_SZ     <apppath> -requestPending -osint -url "%1"
//     shell\open\ddeexec               (default)         REG_SZ     "%1",,0,0,,,,
//     shell\open\ddeexec               NoActivateHandler REG_SZ
//                       \Application   (default)         REG_SZ     SeaMonkey
//                       \Topic         (default)         REG_SZ     WWW_OpenURL
//
// - Protocol Mappings
//   -----------------
//   The following protocols:
//    HTTP, HTTPS, FTP
//   are mapped like so:
//
//   HKCU\SOFTWARE\Classes\<protocol>\
//     DefaultIcon                      (default)         REG_SZ     <apppath>,0
//     shell\open\command               (default)         REG_SZ     <apppath> -requestPending -osint -url "%1"
//     shell\open\ddeexec               (default)         REG_SZ     "%1",,0,0,,,,
//     shell\open\ddeexec               NoActivateHandler REG_SZ
//                       \Application   (default)         REG_SZ     SeaMonkey
//                       \Topic         (default)         REG_SZ     WWW_OpenURL
//
// - Windows Start Menu (Win2K SP2, XP SP1, and newer)
//   -------------------------------------------------
//   The following keys are set to make SeaMonkey appear in the Start Menu as the
//   browser:
//
//   HKCU\SOFTWARE\Clients\StartMenuInternet\SEAMONKEY.EXE\
//                                      (default)         REG_SZ     <appname>
//     DefaultIcon                      (default)         REG_SZ     <apppath>,0
//     InstallInfo                      HideIconsCommand  REG_SZ     <uninstpath> /HideShortcuts
//     InstallInfo                      IconsVisible      REG_DWORD  1
//     InstallInfo                      ReinstallCommand  REG_SZ     <uninstpath> /SetAsDefaultAppGlobal
//     InstallInfo                      ShowIconsCommand  REG_SZ     <uninstpath> /ShowShortcuts
//     shell\open\command               (default)         REG_SZ     <apppath>
//     shell\properties                 (default)         REG_SZ     <appname> &Preferences
//     shell\properties\command         (default)         REG_SZ     <apppath> -preferences
//     shell\safemode                   (default)         REG_SZ     <appname> &Safe Mode
//     shell\safemode\command           (default)         REG_SZ     <apppath> -safe-mode
//
//
//
// Default Mail&News settings
//
// - File Extension Mappings
//   -----------------------
//   The following file extension:
//    .eml
//   is mapped like this:
//
//   HKCU\SOFTWARE\Classes\.eml         (default)         REG_SZ    SeaMonkeyEML
//
//   That aliases to this class:
//   HKCU\SOFTWARE\Classes\SeaMonkeyEML\ (default)        REG_SZ    SeaMonkey (Mail) Document
//                                      FriendlyTypeName  REG_SZ    SeaMonkey (Mail) Document
//     DefaultIcon                      (default)         REG_SZ    <appfolder>\chrome\icons\default\misc-file.ico
//     shell\open\command               (default)         REG_SZ    <apppath> "%1"
//
// - Windows Vista Protocol Handler
//
//   HKCU\SOFTWARE\Classes\SeaMonkeyCOMPOSE (default)     REG_SZ    SeaMonkey (Mail) URL
//                                       DefaultIcon      REG_SZ    <apppath>,0
//                                       EditFlags        REG_DWORD 2
//     shell\open\command                (default)        REG_SZ    <apppath> -osint -compose "%1"
//
//   HKCU\SOFTWARE\Classes\SeaMonkeyNEWS (default)        REG_SZ    SeaMonkey (News) URL
//                                       DefaultIcon      REG_SZ    <apppath>,0
//                                       EditFlags        REG_DWORD 2
//     shell\open\command                (default)        REG_SZ    <apppath> -osint -news "%1"
//
//
// - Protocol Mappings
//   -----------------
//   The following protocol:
//    mailto
//   is mapped like this:
//
//   HKCU\SOFTWARE\Classes\mailto\       (default)       REG_SZ     SeaMonkey (Mail) URL
//                                       EditFlags       REG_DWORD  2
//                                       URL Protocol    REG_SZ
//    DefaultIcon                        (default)       REG_SZ     <apppath>,0
//    shell\open\command                 (default)       REG_SZ     <apppath> -osint -compose "%1"
//
//   The following protocols:
//    news,nntp,snews
//   are mapped like this:
//
//   HKCU\SOFTWARE\Classes\<protocol>\   (default)       REG_SZ     SeaMonkey (News) URL
//                                       EditFlags       REG_DWORD  2
//                                       URL Protocol    REG_SZ
//    DefaultIcon                        (default)       REG_SZ     <appath>,0
//    shell\open\command                 (default)       REG_SZ     <appath> -osint -news "%1"
//
// - Windows Start Menu (Win2K SP2, XP SP1, and newer)
//   -------------------------------------------------
//   The following keys are set to make SeaMonkey appear in the Start Menu as
//   the default mail program:
//
//   HKCU\SOFTWARE\Clients\Mail\SeaMonkey
//                                   (default)           REG_SZ     <appname>
//                                   DLLPath             REG_SZ     <appfolder>\mozMapi32.dll
//    DefaultIcon                    (default)           REG_SZ     <apppath>,0
//    InstallInfo                    HideIconsCommand    REG_SZ     <uninstpath> /HideShortcuts
//    InstallInfo                    ReinstallCommand    REG_SZ     <uninstpath> /SetAsDefaultAppGlobal
//    InstallInfo                    ShowIconsCommand    REG_SZ     <uninstpath> /ShowShortcuts
//    shell\open\command             (default)           REG_SZ     <apppath> -mail
//    shell\properties               (default)           REG_SZ     <appname> &Preferences
//    shell\properties\command       (default)           REG_SZ     <apppath> -preferences
//
//   Also set SeaMonkey as News reader (Usenet), though Windows does currently
//   not expose a default news reader to UI. Applications like Outlook Express
//   also add themselves to this registry key
//
//   HKCU\SOFTWARE\Clients\News\SeaMonkey
//                                   (default)           REG_SZ     <appname>
//                                   DLLPath             REG_SZ     <appfolder>\mozMapi32.dll
//    DefaultIcon                    (default)           REG_SZ     <apppath>,0
//    shell\open\command             (default)           REG_SZ     <apppath> -news
//
///////////////////////////////////////////////////////////////////////////////


typedef enum {
  NO_SUBSTITUTION           = 0x00,
  APP_PATH_SUBSTITUTION     = 0x01
} SettingFlags;

#define APP_REG_NAME L"SeaMonkey"
// APP_REG_NAME_MAIL and APP_REG_NAME_NEWS should be kept in synch with
// AppRegNameMail and AppRegNameNews in the installer file: defines.nsi.in
#define APP_REG_NAME_MAIL L"SeaMonkey (Mail)"
#define APP_REG_NAME_NEWS L"SeaMonkey (News)"
#define CLS_HTML "SeaMonkeyHTML"
#define CLS_URL "SeaMonkeyURL"
#define CLS_EML "SeaMonkeyEML"
#define CLS_MAILTOURL "SeaMonkeyCOMPOSE"
#define CLS_NEWSURL "SeaMonkeyNEWS"
#define CLS_FEEDURL "SeaMonkeyFEED"
#define SMI "SOFTWARE\\Clients\\StartMenuInternet\\"
#define DI "\\DefaultIcon"
#define II "\\InstallInfo"
#define SOP "\\shell\\open\\command"

#define VAL_ICON "%APPPATH%,0"
#define VAL_HTML_OPEN "\"%APPPATH%\" -url \"%1\""
#define VAL_URL_OPEN "\"%APPPATH%\" -requestPending -osint -url \"%1\""
#define VAL_MAIL_OPEN "\"%APPPATH%\" \"%1\""

#define MAKE_KEY_NAME1(PREFIX, MID) \
  PREFIX MID

// The DefaultIcon registry key value should never be used (e.g. NON_ESSENTIAL)
// when checking if SeaMonkey is the default browser since other applications
// (e.g. MS Office) may modify the DefaultIcon registry key value to add Icon
// Handlers.
// see http://msdn2.microsoft.com/en-us/library/aa969357.aspx for more info.
static SETTING gBrowserSettings[] = {
  // File Extension Class - as of 1.8.1.2 the value for VAL_URL_OPEN is also
  // checked for CLS_HTML since SeaMonkey should also own opening local files
  // when set as the default browser.
  { MAKE_KEY_NAME1(CLS_HTML, SOP), "", VAL_HTML_OPEN, APP_PATH_SUBSTITUTION },

  // Protocol Handler Class - for Vista and above
  { MAKE_KEY_NAME1(CLS_URL, SOP), "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION },

  // Protocol Handlers
  { MAKE_KEY_NAME1("HTTP", DI),    "", VAL_ICON, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME1("HTTP", SOP),   "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME1("HTTPS", DI),   "", VAL_ICON, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME1("HTTPS", SOP),  "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION }

  // These values must be set by hand, since they contain localized strings.
  //   seamonkey.exe\shell\properties   (default)   REG_SZ  SeaMonkey &Preferences
  //   seamonkey.exe\shell\safemode     (default)   REG_SZ  SeaMonkey &Safe Mode
};

 static SETTING gMailSettings[] = {
   // File Extension Aliases
   { ".eml", "", CLS_EML, NO_SUBSTITUTION },
   // File Extension Class
   { MAKE_KEY_NAME1(CLS_EML, SOP), "",  VAL_MAIL_OPEN, APP_PATH_SUBSTITUTION},

   // Protocol Handler Class - for Vista and above
   { MAKE_KEY_NAME1(CLS_MAILTOURL, SOP), "", "\"%APPPATH%\" -osint -compose \"%1\"", APP_PATH_SUBSTITUTION },

   // Protocol Handlers
   { MAKE_KEY_NAME1("mailto", SOP), "", "\"%APPPATH%\" -osint -compose \"%1\"", APP_PATH_SUBSTITUTION }
 };
 
 static SETTING gNewsSettings[] = {
    // Protocol Handler Class - for Vista and above
   { MAKE_KEY_NAME1(CLS_NEWSURL, SOP), "", "\"%APPPATH%\" -osint -mail \"%1\"",  APP_PATH_SUBSTITUTION },
 
   // Protocol Handlers
   { MAKE_KEY_NAME1("news", SOP), "", "\"%APPPATH%\" -osint -mail \"%1\"", APP_PATH_SUBSTITUTION },
   { MAKE_KEY_NAME1("nntp", SOP), "", "\"%APPPATH%\" -osint -mail \"%1\"", APP_PATH_SUBSTITUTION },
};

 static SETTING gFeedSettings[] = {
   // Protocol Handler Class - for Vista and above
   { MAKE_KEY_NAME1(CLS_FEEDURL, SOP), "", "\"%APPPATH%\" -osint -mail \"%1\"", APP_PATH_SUBSTITUTION },

   // Protocol Handlers
   { MAKE_KEY_NAME1("feed", SOP), "", "\"%APPPATH%\" -osint -mail \"%1\"", APP_PATH_SUBSTITUTION },
};

/* helper routine. Iterate over the passed in settings object,
   testing each key to see if we are handling it.
*/
PRBool
nsWindowsShellService::TestForDefault(SETTING aSettings[], PRInt32 aSize)
{
  PRUnichar currValue[MAX_BUF];
  SETTING* end = aSettings + aSize;
  for (SETTING * settings = aSettings; settings < end; ++settings) {
    NS_ConvertUTF8toUTF16 dataLongPath(settings->valueData);
    NS_ConvertUTF8toUTF16 dataShortPath(settings->valueData);
    NS_ConvertUTF8toUTF16 key(settings->keyName);
    NS_ConvertUTF8toUTF16 value(settings->valueName);
    if (settings->flags & APP_PATH_SUBSTITUTION) {
      PRInt32 offset = dataLongPath.Find("%APPPATH%");
      dataLongPath.Replace(offset, 9, mAppLongPath);
      // Remove the quotes around %APPPATH% in VAL_OPEN for short paths
      PRInt32 offsetQuoted = dataShortPath.Find("\"%APPPATH%\"");
      if (offsetQuoted != -1)
        dataShortPath.Replace(offsetQuoted, 11, mAppShortPath);
      else
        dataShortPath.Replace(offset, 9, mAppShortPath);
    }

    ::ZeroMemory(currValue, sizeof(currValue));
    HKEY theKey;
    nsresult rv = OpenKeyForReading(HKEY_CLASSES_ROOT, key.get(), &theKey);
    if (NS_FAILED(rv))
      // Key does not exist
      return PR_FALSE;

    DWORD len = sizeof currValue;
    DWORD res = ::RegQueryValueExW(theKey, value.get(),
                                   NULL, NULL, (LPBYTE)currValue, &len);
    // Close the key we opened.
    ::RegCloseKey(theKey);
    if (REG_FAILED(res) ||
        !dataLongPath.Equals(currValue, CaseInsensitiveCompare) &&
        !dataShortPath.Equals(currValue, CaseInsensitiveCompare)) {
      // Key wasn't set, or was set to something else (something else became the default client)
      return PR_FALSE;
    }
  }

  return PR_TRUE;
}

nsresult nsWindowsShellService::Init()
{
  PRUnichar appPath[MAX_BUF];
  if (!::GetModuleFileNameW(0, appPath, MAX_BUF))
    return NS_ERROR_FAILURE;

  mAppLongPath = appPath;

  // Support short path to the exe so if it is already set the user is not
  // prompted to set the default mail client again.
  if (!::GetShortPathNameW(appPath, appPath, MAX_BUF))
    return NS_ERROR_FAILURE;

  mAppShortPath = appPath;

  return NS_OK;
}

PRBool
nsWindowsShellService::IsDefaultClientVista(PRUint16 aApps, PRBool* aIsDefaultClient)
{
#if !defined(MOZ_DISABLE_VISTA_SDK_REQUIREMENTS)
  IApplicationAssociationRegistration* pAAR;

  HRESULT hr = CoCreateInstance(CLSID_ApplicationAssociationRegistration,
                                NULL,
                                CLSCTX_INPROC,
                                IID_IApplicationAssociationRegistration,
                                (void**)&pAAR);
  
  if (SUCCEEDED(hr)) {
    BOOL isDefaultBrowser = PR_TRUE;
    BOOL isDefaultMail    = PR_TRUE;
    BOOL isDefaultNews    = PR_TRUE;
    if (aApps & nsIShellService::BROWSER)
      pAAR->QueryAppIsDefaultAll(AL_EFFECTIVE, APP_REG_NAME, &isDefaultBrowser);
#ifdef MOZ_MAIL_NEWS
    if (aApps & nsIShellService::MAIL)
      pAAR->QueryAppIsDefaultAll(AL_EFFECTIVE, APP_REG_NAME_MAIL, &isDefaultMail);
    if (aApps & nsIShellService::NEWS)
      pAAR->QueryAppIsDefaultAll(AL_EFFECTIVE, APP_REG_NAME_NEWS, &isDefaultNews);
#endif

    *aIsDefaultClient = isDefaultBrowser && isDefaultNews && isDefaultMail;

    pAAR->Release();
    return PR_TRUE;
  }
#endif  
  return PR_FALSE;
}

NS_IMETHODIMP
nsWindowsShellService::IsDefaultClient(PRBool aStartupCheck, PRUint16 aApps, PRBool *aIsDefaultClient)
{
  // If this is the first application window, maintain internal state that we've
  // checked this session (so that subsequent window opens don't show the
  // default client dialog).
  if (aStartupCheck)
    mCheckedThisSessionClient = PR_TRUE;

  *aIsDefaultClient = PR_TRUE;

  // for each type, check if it is the default app
  // browser check needs to be at the top
  if (aApps & nsIShellService::BROWSER) {
    *aIsDefaultClient &= TestForDefault(gBrowserSettings, sizeof(gBrowserSettings)/sizeof(SETTING));
    // Only check if this app is default on Vista if the previous checks
    // indicate that this app is the default.
    if (*aIsDefaultClient)
      IsDefaultClientVista(nsIShellService::BROWSER, aIsDefaultClient);
  }
#ifdef MOZ_MAIL_NEWS
  if (aApps & nsIShellService::MAIL) {
    *aIsDefaultClient &= TestForDefault(gMailSettings, sizeof(gMailSettings)/sizeof(SETTING));
    // Only check if this app is default on Vista if the previous checks
    // indicate that this app is the default.
    if (*aIsDefaultClient)
      IsDefaultClientVista(nsIShellService::MAIL, aIsDefaultClient);
  }
  if (aApps & nsIShellService::NEWS) {
    *aIsDefaultClient &= TestForDefault(gNewsSettings, sizeof(gNewsSettings)/sizeof(SETTING));
    // Only check if this app is default on Vista if the previous checks
    // indicate that this app is the default.
    if (*aIsDefaultClient)
      IsDefaultClientVista(nsIShellService::NEWS, aIsDefaultClient);
  }
#endif

  return NS_OK;
}


NS_IMETHODIMP
nsWindowsShellService::SetDefaultClient(PRBool aForAllUsers,
                                        PRBool aClaimAllTypes, PRUint16 aApps)
{
  nsresult rv;
  nsCOMPtr<nsIProperties> directoryService = 
    do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> appHelper;
  rv = directoryService->Get(NS_XPCOM_CURRENT_PROCESS_DIR, NS_GET_IID(nsILocalFile), getter_AddRefs(appHelper));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appHelper->AppendNative(NS_LITERAL_CSTRING("uninstall"));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appHelper->AppendNative(NS_LITERAL_CSTRING("helper.exe"));
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString appHelperPath;
  rv = appHelper->GetPath(appHelperPath);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (aForAllUsers)
    appHelperPath.AppendLiteral(" /SetAsDefaultAppGlobal");
  else {
    appHelperPath.AppendLiteral(" /SetAsDefaultAppUser");
    if (aApps & nsIShellService::BROWSER)
      appHelperPath.AppendLiteral(" Browser");
    
    if (aApps & nsIShellService::MAIL)
      appHelperPath.AppendLiteral(" Mail");

    if (aApps & nsIShellService::NEWS)
      appHelperPath.AppendLiteral(" News");
   }

  STARTUPINFOW si = {sizeof(si), 0};
  PROCESS_INFORMATION pi = {0};

  BOOL ok = CreateProcessW(NULL, (LPWSTR)appHelperPath.get(), NULL, NULL,
                           FALSE, 0, NULL, NULL, &si, &pi);

  if (!ok)
    return NS_ERROR_FAILURE;

  CloseHandle(pi.hProcess);
  CloseHandle(pi.hThread);

  return NS_OK;
}

NS_IMETHODIMP
nsWindowsShellService::GetShouldCheckDefaultClient(PRBool* aResult)
{
  if (mCheckedThisSessionClient) {
    *aResult = PR_FALSE;
    return NS_OK;
  }

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefs->GetBoolPref("shell.checkDefaultClient", aResult);
}



NS_IMETHODIMP
nsWindowsShellService::SetShouldCheckDefaultClient(PRBool aShouldCheck)
{
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  NS_ENSURE_TRUE(prefs, NS_ERROR_FAILURE);
  return prefs->SetBoolPref("shell.checkDefaultClient", aShouldCheck);
}

NS_IMETHODIMP
nsWindowsShellService::GetShouldBeDefaultClientFor(PRUint16* aApps)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  PRInt32 result;
  rv = prefs->GetIntPref("shell.checkDefaultApps", &result);
  *aApps = result;
  return rv;
}

NS_IMETHODIMP
nsWindowsShellService::SetShouldBeDefaultClientFor(PRUint16 aApps)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return prefs->SetIntPref("shell.checkDefaultApps", aApps);
}

static nsresult
WriteBitmap(nsIFile* aFile, imgIContainer* aImage)
{
#ifdef MOZILLA_1_9_1_BRANCH
  PRInt32 width, height;
  nsCOMPtr<gfxIImageFrame> image;
  nsresult rv = aImage->GetCurrentFrame(getter_AddRefs(image));
  if (!image)
    return rv;

  image->GetWidth(&width);
  image->GetHeight(&height);

  PRUint8* bits;
  PRUint32 length;
  image->LockImageData();
  image->GetImageData(&bits, &length);
  if (!bits) {
    image->UnlockImageData();
    return NS_ERROR_FAILURE;
  }

  PRUint32 bpr;
  image->GetImageBytesPerRow(&bpr);
#else
  nsRefPtr<gfxImageSurface> image;
  nsresult rv = aImage->CopyCurrentFrame(getter_AddRefs(image));
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 width = image->Width();
  PRInt32 height = image->Height();

  PRUint8* bits = image->Data();
  PRUint32 length = image->GetDataSize();
  PRUint32 bpr = PRUint32(image->Stride());
#endif

  PRInt32 bitCount = bpr/width;

  // initialize these bitmap structs which we will later
  // serialize directly to the head of the bitmap file
  BITMAPINFOHEADER bmi;
  bmi.biSize = sizeof(BITMAPINFOHEADER);
  bmi.biWidth = width;
  bmi.biHeight = height;
  bmi.biPlanes = 1;
  bmi.biBitCount = (WORD)bitCount*8;
  bmi.biCompression = BI_RGB;
  bmi.biSizeImage = length;
  bmi.biXPelsPerMeter = 0;
  bmi.biYPelsPerMeter = 0;
  bmi.biClrUsed = 0;
  bmi.biClrImportant = 0;

  BITMAPFILEHEADER bf;
  bf.bfType = 0x4D42; // 'BM'
  bf.bfReserved1 = 0;
  bf.bfReserved2 = 0;
  bf.bfOffBits = sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER);
  bf.bfSize = bf.bfOffBits + bmi.biSizeImage;

  // get a file output stream
  nsCOMPtr<nsIOutputStream> stream;
  rv = NS_NewLocalFileOutputStream(getter_AddRefs(stream), aFile);
  NS_ENSURE_SUCCESS(rv, rv);

  // write the bitmap headers and rgb pixel data to the file
  rv = NS_ERROR_FAILURE;
  if (stream) {
    PRUint32 written;
    stream->Write((const char*)&bf, sizeof(BITMAPFILEHEADER), &written);
    if (written == sizeof(BITMAPFILEHEADER)) {
      stream->Write((const char*)&bmi, sizeof(BITMAPINFOHEADER), &written);
      if (written == sizeof(BITMAPINFOHEADER)) {
        // write out the image data backwards because the desktop won't
        // show bitmaps with negative heights for top-to-bottom
        PRUint32 i = length;
        rv = NS_OK;
        do {
          i -= bpr;

          stream->Write(((const char*)bits) + i, bpr, &written);
          if (written != bpr) {
            rv = NS_ERROR_FAILURE;
            break;
          }
        } while (i != 0);
      }
    }

    stream->Close();
  }

#ifdef MOZILLA_1_9_1_BRANCH
  image->UnlockImageData();
#endif
  return rv;
}

NS_IMETHODIMP
nsWindowsShellService::SetDesktopBackground(nsIDOMElement* aElement,
                                            PRInt32 aPosition)
{
  nsresult rv;

  nsCOMPtr<imgIContainer> container;

  nsCOMPtr<nsIDOMHTMLImageElement> imgElement(do_QueryInterface(aElement));
  if (!imgElement) {
    // XXX write background loading stuff!
  }
  else {
    nsCOMPtr<nsIImageLoadingContent> imageContent =
      do_QueryInterface(aElement, &rv);
    if (!imageContent)
      return rv;

    // get the image container
    nsCOMPtr<imgIRequest> request;
    rv = imageContent->GetRequest(nsIImageLoadingContent::CURRENT_REQUEST,
                                  getter_AddRefs(request));
    if (!request)
      return rv;
    rv = request->GetImage(getter_AddRefs(container));
  }

  if (!container)
    return NS_ERROR_FAILURE;

  // get the file name from localized strings
  nsCOMPtr<nsIStringBundleService>
    bundleService(do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundle> shellBundle;
  rv = bundleService->CreateBundle(SHELLSERVICE_PROPERTIES,
                                   getter_AddRefs(shellBundle));
  NS_ENSURE_SUCCESS(rv, rv);
 
  // e.g. "Desktop Background.bmp"
  nsString fileLeafName;
  rv = shellBundle->GetStringFromName
                      (NS_LITERAL_STRING("desktopBackgroundLeafNameWin").get(),
                       getter_Copies(fileLeafName));
  NS_ENSURE_SUCCESS(rv, rv);

  // get the profile root directory
  nsCOMPtr<nsIFile> file;
  rv = NS_GetSpecialDirectory(NS_APP_APPLICATION_REGISTRY_DIR,
                              getter_AddRefs(file));
  NS_ENSURE_SUCCESS(rv, rv);

  // eventually, the path is "%APPDATA%\Mozilla\SeaMonkey\Desktop Background.bmp"
  rv = file->Append(fileLeafName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString path;
  rv = file->GetPath(path);
  NS_ENSURE_SUCCESS(rv, rv);

  // write the bitmap to a file in the profile directory
  rv = WriteBitmap(file, container);

  // if the file was written successfully, set it as the system wallpaper
  if (NS_SUCCEEDED(rv)) {
     PRBool result = PR_FALSE;
     DWORD  dwDisp = 0;
     HKEY   key;
     // Try to create/open a subkey under HKCU.
     DWORD res = ::RegCreateKeyExW(HKEY_CURRENT_USER,
                                   L"Control Panel\\Desktop",
                                   0, NULL, REG_OPTION_NON_VOLATILE,
                                   KEY_WRITE, NULL, &key, &dwDisp);
     if (REG_SUCCEEDED(res)) {
       PRUnichar tile[2], style[2];
       switch (aPosition) {
         case BACKGROUND_TILE:
           tile[0] = '1';
           style[0] = '1';
           break;
         case BACKGROUND_CENTER:
           tile[0] = '0';
           style[0] = '0';
           break;
         case BACKGROUND_STRETCH:
           tile[0] = '0';
           style[0] = '2';
           break;
       }
       tile[1] = '\0';
       style[1] = '\0';

       // The size is always 2 unicode characters.
       PRInt32 size = 2 * sizeof(PRUnichar);
       ::RegSetValueExW(key, L"TileWallpaper",
                        0, REG_SZ, (const BYTE *)tile, size);
       ::RegSetValueExW(key, L"WallpaperStyle",
                        0, REG_SZ, (const BYTE *)style, size);
       ::SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, (PVOID)path.get(),
                               SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE);
      // Close the key we opened.
      ::RegCloseKey(key);
    }
  }
  return rv;
}

NS_IMETHODIMP
nsWindowsShellService::GetDesktopBackgroundColor(PRUint32* aColor)
{
  PRUint32 color = ::GetSysColor(COLOR_DESKTOP);
  *aColor = (GetRValue(color) << 16) | (GetGValue(color) << 8) | GetBValue(color);
  return NS_OK;
}

NS_IMETHODIMP
nsWindowsShellService::SetDesktopBackgroundColor(PRUint32 aColor)
{
  int parameter = COLOR_BACKGROUND;
  BYTE r = (aColor >> 16);
  BYTE g = (aColor << 16) >> 24;
  BYTE b = (aColor << 24) >> 24;
  COLORREF color = RGB(r,g,b);

  ::SetSysColors(1, &parameter, &color);

  PRBool result = PR_FALSE;
  DWORD  dwDisp = 0;
  HKEY   key;
  // Try to create/open a subkey under HKCU.
  DWORD rv = ::RegCreateKeyExW(HKEY_CURRENT_USER,
                               L"Control Panel\\Colors", 0, NULL,
                               REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL,
                               &key, &dwDisp);
  if (REG_SUCCEEDED(rv)) {
    char rgb[12];
    sprintf((char*)rgb, "%u %u %u\0", r, g, b);
    NS_ConvertUTF8toUTF16 backColor(rgb);
    ::RegSetValueExW(key, L"Background",
                     0, REG_SZ, (const BYTE *)backColor.get(),
                     (backColor.Length() + 1) * sizeof(PRUnichar));
  }
  
  // Close the key we opened.
  ::RegCloseKey(key);
  return NS_OK;
}

