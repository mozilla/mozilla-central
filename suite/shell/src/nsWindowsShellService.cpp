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

#include "gfxIImageFrame.h"
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
#include "nsStringEnumerator.h"
#include "nsUnicharUtils.h"
#include "nsIStringBundle.h"
#include "nsIServiceManager.h"
#include "nsServiceManagerUtils.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsCOMPtr.h"
#ifdef MOZ_MAIL_NEWS
#include "nsIMapiSupport.h"
#endif
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
OpenUserKeyForReading(HKEY aStartKey, LPCWSTR aKeyName, HKEY* aKey)
{
  DWORD res = ::RegOpenKeyExW(aStartKey, aKeyName, 0, KEY_READ, aKey);

  if (res == ERROR_FILE_NOT_FOUND && aStartKey != HKEY_LOCAL_MACHINE) {
    // retry with HKEY_LOCAL_MACHINE
    res = ::RegOpenKeyExW(HKEY_LOCAL_MACHINE, aKeyName, 0, KEY_READ, aKey);
  }

  return REG_FAILED(res) ? NS_ERROR_FILE_ACCESS_DENIED : NS_OK;  
}

// Sets the default registry keys for Windows versions prior to Vista.
// Try to open / create the key in HKLM and if that fails try to do the same
// in HKCU. Though this is not strictly the behavior I would expect it is the
// same behavior that SeaMonkey and IE have when setting the default browser
// previous to Vista.
static nsresult
OpenKeyForWriting(HKEY aStartKey, LPCWSTR aKeyName, HKEY* aKey,
                  PRBool aHKLMOnly)
{
  DWORD dwDisp = 0;
  DWORD res = ::RegCreateKeyExW(aStartKey, aKeyName, 0, NULL,
                                0, KEY_READ | KEY_WRITE, NULL, aKey,
                                &dwDisp);
  
  if (REG_FAILED(res) && !aHKLMOnly) {
    // fallback to HKCU immediately on error since we won't be able
    // to create the key.
    res = ::RegCreateKeyExW(HKEY_CURRENT_USER, aKeyName, 0, NULL, 0,
                            KEY_READ | KEY_WRITE, NULL, aKey, &dwDisp);
  }

  return REG_FAILED(res) ? NS_ERROR_FILE_ACCESS_DENIED : NS_OK;
}

///////////////////////////////////////////////////////////////////////////////
// Default SeaMonkey OS integration Registry Settings
// Note: Some settings only exist when using the installer!
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
//     DefaultIcon                      (default)         REG_SZ     <apppath>,1
//     shell\open\command               (default)         REG_SZ     <apppath> -requestPending -osint -url "%1"
//     shell\open\ddeexec               (default)         REG_SZ     "%1",,0,0,,,,
//     shell\open\ddeexec               NoActivateHandler REG_SZ
//                       \Application   (default)         REG_SZ     SeaMonkey
//                       \Topic         (default)         REG_SZ     WWW_OpenURL
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
//     DefaultIcon                      (default)         REG_SZ     <apppath>,1
//     shell\open\command               (default)         REG_SZ     <apppath> -requestPending -url "%1"
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
//     DefaultIcon                      (default)         REG_SZ    <apppath>,0
//     shell\open\command               (default)         REG_SZ    <apppath> "%1"
//
// - Windows Vista Protocol Handler
//
//   HKCU\SOFTWARE\Classes\SeaMonkey.Url.mailto (default) REG_SZ    SeaMonkey (Mail) URL
//                                       DefaultIcon      REG_SZ    <apppath>,0
//                                       EditFlags        REG_DWORD 2
//     shell\open\command                (default)        REG_SZ    <apppath> -osint -compose "%1"
//
//   HKCU\SOFTWARE\Classes\SeaMonkey.Url.news (default)   REG_SZ    SeaMonkey (News) URL
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
  APP_PATH_SUBSTITUTION     = 0x01,
  EXE_NAME_SUBSTITUTION     = 0x02,
  UNINST_PATH_SUBSTITUTION  = 0x04,
  MAPIDLL_PATH_SUBSTITUTION = 0x08,
  HKLM_ONLY                 = 0x10,
  USE_FOR_DEFAULT_TEST      = 0x20,
  NON_ESSENTIAL             = 0x40,
  APP_NAME_SUBSTITUTION     = 0x80
} SettingFlags;

#define APP_REG_NAME L"SeaMonkey"
// APP_REG_NAME_MAIL and APP_REG_NAME_NEWS should be kept in synch with
// AppRegNameMail and AppRegNameNews in the installer file: defines.nsi.in
#define APP_REG_NAME_MAIL L"SeaMonkey (Mail)"
#define APP_REG_NAME_NEWS L"SeaMonkey (News)"
#define CLS "SOFTWARE\\Classes\\"
#define CLS_HTML "SeaMonkeyHTML"
#define CLS_URL "SeaMonkeyURL"
#define CLS_EML "SeaMonkeyEML"
#define CLS_MAILTOURL "SeaMonkey.Url.mailto"
#define CLS_NEWSURL "SeaMonkey.Url.news"
#define SMI "SOFTWARE\\Clients\\StartMenuInternet\\"
#define MAILCLIENTS "SOFTWARE\\Clients\\Mail\\"
#define NEWSCLIENTS "SOFTWARE\\Clients\\News\\"
#define MOZ_CLIENT_MAIL_KEY "Software\\Clients\\Mail"
#define MOZ_CLIENT_NEWS_KEY "Software\\Clients\\News"
#define DI "\\DefaultIcon"
#define II "\\InstallInfo"
#define SOP "\\shell\\open\\command"
#define DDE "\\shell\\open\\ddeexec\\"
#define DDE_NAME "SeaMonkey" // Keep in sync with app name from nsXREAppData
#define DDE_COMMAND "\"%1\",,0,0,,,,"
// For the InstallInfo HideIconsCommand, ShowIconsCommand, and ReinstallCommand
// registry keys. This must be kept in sync with the uninstaller.
#define UNINSTALL_EXE "\\uninstall\\helper.exe"

#define VAL_ICON "%APPPATH%,0"
#define VAL_FILE_ICON "%APPPATH%,1"
#define VAL_URL_OPEN "\"%APPPATH%\" -requestPending -osint -url \"%1\""
#define VAL_MAIL_OPEN "\"%APPPATH%\" \"%1\""

#define MAKE_KEY_NAME1(PREFIX, MID) \
  PREFIX MID

#define MAKE_KEY_NAME2(PREFIX, MID, SUFFIX) \
  PREFIX MID SUFFIX

#define MAKE_KEY_NAME3(PREFIX, MID, MID2, SUFFIX) \
  PREFIX MID MID2 SUFFIX

// The DefaultIcon registry key value should never be used (e.g. NON_ESSENTIAL)
// when checking if SeaMonkey is the default browser since other applications
// (e.g. MS Office) may modify the DefaultIcon registry key value to add Icon
// Handlers.
// see http://msdn2.microsoft.com/en-us/library/aa969357.aspx for more info.
static SETTING gBrowserSettings[] = {
  // File Extension Aliases
  { MAKE_KEY_NAME1(CLS, ".htm"),    "", CLS_HTML, NO_SUBSTITUTION },
  { MAKE_KEY_NAME1(CLS, ".html"),   "", CLS_HTML, NO_SUBSTITUTION },
  { MAKE_KEY_NAME1(CLS, ".shtml"),  "", CLS_HTML, NO_SUBSTITUTION },
  { MAKE_KEY_NAME1(CLS, ".xht"),    "", CLS_HTML, NO_SUBSTITUTION },
  { MAKE_KEY_NAME1(CLS, ".xhtml"),  "", CLS_HTML, NO_SUBSTITUTION },

  // File Extension Class - as of 1.8.1.2 the value for VAL_URL_OPEN is also
  // checked for CLS_HTML since SeaMonkey should also own opening local files
  // when set as the default browser.
  { MAKE_KEY_NAME2(CLS, CLS_HTML, DI),  "", VAL_FILE_ICON, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, CLS_HTML, SOP), "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST },

  // Protocol Handler Class - for Vista and above
  { MAKE_KEY_NAME2(CLS, CLS_URL, DI),  "", VAL_FILE_ICON, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, CLS_URL, SOP), "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST },

  // Protocol Handlers
  { MAKE_KEY_NAME2(CLS, "HTTP", DI),    "", VAL_FILE_ICON, APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST },
  { MAKE_KEY_NAME2(CLS, "HTTP", SOP),   "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST },
  { MAKE_KEY_NAME2(CLS, "HTTPS", DI),   "", VAL_FILE_ICON, APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST },
  { MAKE_KEY_NAME2(CLS, "HTTPS", SOP),  "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST },
  { MAKE_KEY_NAME2(CLS, "FTP", DI),     "", VAL_FILE_ICON, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, "FTP", SOP),    "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, "GOPHER", DI),  "", VAL_FILE_ICON, APP_PATH_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, "GOPHER", SOP), "", VAL_URL_OPEN, APP_PATH_SUBSTITUTION },

  // DDE settings
  { MAKE_KEY_NAME2(CLS, CLS_HTML, DDE), "", DDE_COMMAND, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, CLS_HTML, DDE, "Application"), "", DDE_NAME, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, CLS_HTML, DDE, "Topic"), "", "WWW_OpenURL", NO_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, CLS_URL, DDE), "", DDE_COMMAND, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, CLS_URL, DDE, "Application"), "", DDE_NAME, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, CLS_URL, DDE, "Topic"), "", "WWW_OpenURL", NO_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, "HTTP", DDE), "", DDE_COMMAND, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "HTTP", DDE, "Application"), "", DDE_NAME, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "HTTP", DDE, "Topic"), "", "WWW_OpenURL", NO_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, "HTTPS", DDE), "", DDE_COMMAND, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "HTTPS", DDE, "Application"), "", DDE_NAME, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "HTTPS", DDE, "Topic"), "", "WWW_OpenURL", NO_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, "FTP", DDE), "", DDE_COMMAND, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "FTP", DDE, "Application"), "", DDE_NAME, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "FTP", DDE, "Topic"), "", "WWW_OpenURL", NO_SUBSTITUTION },
  { MAKE_KEY_NAME2(CLS, "GOPHER", DDE), "", DDE_COMMAND, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "GOPHER", DDE, "Application"), "", DDE_NAME, NO_SUBSTITUTION },
  { MAKE_KEY_NAME3(CLS, "GOPHER", DDE, "Topic"), "", "WWW_OpenURL", NO_SUBSTITUTION },

  // Windows XP Start Menu
  { MAKE_KEY_NAME2(SMI, "%APPEXE%", DI),
    "",
    "%APPPATH%,0",
    APP_PATH_SUBSTITUTION | EXE_NAME_SUBSTITUTION | HKLM_ONLY },
  { MAKE_KEY_NAME2(SMI, "%APPEXE%", II),
    "HideIconsCommand",
    "\"%UNINSTPATH%\" /HideShortcuts",
    UNINST_PATH_SUBSTITUTION | EXE_NAME_SUBSTITUTION | HKLM_ONLY },
  { MAKE_KEY_NAME2(SMI, "%APPEXE%", II),
    "ReinstallCommand",
    "\"%UNINSTPATH%\" /SetAsDefaultAppGlobal",
    UNINST_PATH_SUBSTITUTION | EXE_NAME_SUBSTITUTION | HKLM_ONLY },
  { MAKE_KEY_NAME2(SMI, "%APPEXE%", II),
    "ShowIconsCommand",
    "\"%UNINSTPATH%\" /ShowShortcuts",
    UNINST_PATH_SUBSTITUTION | EXE_NAME_SUBSTITUTION | HKLM_ONLY },
  { MAKE_KEY_NAME2(SMI, "%APPEXE%", SOP),
    "",
    "%APPPATH%",
    APP_PATH_SUBSTITUTION | EXE_NAME_SUBSTITUTION | HKLM_ONLY },
  { MAKE_KEY_NAME1(SMI, "%APPEXE%\\shell\\properties\\command"),
    "",
    "\"%APPPATH%\" -preferences",
    APP_PATH_SUBSTITUTION | EXE_NAME_SUBSTITUTION | HKLM_ONLY },
  { MAKE_KEY_NAME1(SMI, "%APPEXE%\\shell\\safemode\\command"),
    "",
    "\"%APPPATH%\" -safe-mode",
    APP_PATH_SUBSTITUTION | EXE_NAME_SUBSTITUTION | HKLM_ONLY }

  // These values must be set by hand, since they contain localized strings.
  //   seamonkey.exe\shell\properties   (default)   REG_SZ  SeaMonkey &Preferences
  //   seamonkey.exe\shell\safemode     (default)   REG_SZ  SeaMonkey &Safe Mode
};


 static SETTING gMailSettings[] = {
   // File Extension Aliases
   { MAKE_KEY_NAME1(CLS, ".eml"),    "", CLS_EML, NO_SUBSTITUTION },
   // File Extension Class
   { MAKE_KEY_NAME2(CLS, CLS_EML, DI),  "",  VAL_ICON, APP_PATH_SUBSTITUTION },
   { MAKE_KEY_NAME2(CLS, CLS_EML, SOP), "",  VAL_MAIL_OPEN, APP_PATH_SUBSTITUTION},

   // Protocol Handler Class - for Vista and above
   { MAKE_KEY_NAME2(CLS, CLS_MAILTOURL, DI),  "", VAL_ICON, APP_PATH_SUBSTITUTION },
   { MAKE_KEY_NAME2(CLS, CLS_MAILTOURL, SOP), "", "\"%APPPATH%\" -osint -compose \"%1\"", APP_PATH_SUBSTITUTION },

   // Protocol Handlers
   { MAKE_KEY_NAME2(CLS, "mailto", DI),  "", VAL_ICON, APP_PATH_SUBSTITUTION},
   { MAKE_KEY_NAME2(CLS, "mailto", SOP), "", "\"%APPPATH%\" -osint -compose \"%1\"", APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST}, 

   // Mail Client Keys
   { MAKE_KEY_NAME1(MAILCLIENTS, "%APPNAME%"),
     "DLLPath",
     "%MAPIDLLPATH%",
     MAPIDLL_PATH_SUBSTITUTION | HKLM_ONLY | APP_NAME_SUBSTITUTION },
   { MAKE_KEY_NAME2(MAILCLIENTS, "%APPNAME%", II),
     "HideIconsCommand",
     "\"%UNINSTPATH%\" /HideShortcuts",
     UNINST_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
   { MAKE_KEY_NAME2(MAILCLIENTS, "%APPNAME%", II),
     "ReinstallCommand",
     "\"%UNINSTPATH%\" /SetAsDefaultAppGlobal",
     UNINST_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
   { MAKE_KEY_NAME2(MAILCLIENTS, "%APPNAME%", II),
     "ShowIconsCommand",
     "\"%UNINSTPATH%\" /ShowShortcuts",
     UNINST_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
   { MAKE_KEY_NAME2(MAILCLIENTS, "%APPNAME%", DI),
     "",
     "%APPPATH%,0",
     APP_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
   { MAKE_KEY_NAME2(MAILCLIENTS, "%APPNAME%", SOP),
     "",
     "\"%APPPATH%\" -mail",
     APP_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
   { MAKE_KEY_NAME1(MAILCLIENTS, "%APPNAME%\\shell\\properties\\command"),
     "",
     "\"%APPPATH%\" -preferences",
     APP_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
 };
 
 static SETTING gNewsSettings[] = {
    // Protocol Handler Class - for Vista and above
   { MAKE_KEY_NAME2(CLS, CLS_NEWSURL, DI),  "", VAL_ICON, APP_PATH_SUBSTITUTION },
   { MAKE_KEY_NAME2(CLS, CLS_NEWSURL, SOP), "", "\"%APPPATH%\" -osint -news \"%1\"", APP_PATH_SUBSTITUTION },
 
   // Protocol Handlers
   { MAKE_KEY_NAME2(CLS, "news", DI),  "", VAL_ICON, APP_PATH_SUBSTITUTION},
   { MAKE_KEY_NAME2(CLS, "news", SOP), "", "\"%APPPATH%\" -osint -news \"%1\"", APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST},
   { MAKE_KEY_NAME2(CLS, "nntp", DI),  "", VAL_ICON, APP_PATH_SUBSTITUTION},
   { MAKE_KEY_NAME2(CLS, "nntp", SOP), "", "\"%APPPATH%\" -osint -news \"%1\"", APP_PATH_SUBSTITUTION | USE_FOR_DEFAULT_TEST}, 
   { MAKE_KEY_NAME2(CLS, "snews", DI),  "", VAL_ICON, APP_PATH_SUBSTITUTION},
   { MAKE_KEY_NAME2(CLS, "snews", SOP), "", "\"%APPPATH%\" -osint -news \"%1\"", APP_PATH_SUBSTITUTION}, 
 
   // News Client Keys
   { MAKE_KEY_NAME1(NEWSCLIENTS, "%APPNAME%"),
     "DLLPath",
     "%MAPIDLLPATH%",
     MAPIDLL_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
   { MAKE_KEY_NAME2(NEWSCLIENTS, "%APPNAME%", DI),
     "",
     "%APPPATH%,0",
     APP_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
   { MAKE_KEY_NAME2(NEWSCLIENTS, "%APPNAME%", SOP),
     "",
     "\"%APPPATH%\" -mail",
     APP_PATH_SUBSTITUTION | APP_NAME_SUBSTITUTION | HKLM_ONLY },
};

/* helper routine. Iterate over the passed in settings object,
   testing each key with the USE_FOR_DEFAULT_TEST to see if
   we are handling it.
*/
PRBool
nsWindowsShellService::TestForDefault(SETTING aSettings[], PRInt32 aSize)
{
  nsCOMPtr<nsILocalFile> lf;
  nsresult rv = NS_NewLocalFile(mAppShortPath, PR_TRUE,
                                getter_AddRefs(lf));

  if (NS_FAILED(rv))
    return PR_FALSE;

  nsAutoString exeName;
  rv = lf->GetLeafName(exeName);
  if (NS_FAILED(rv))
    return PR_FALSE;
  ToUpperCase(exeName);
 
  PRUnichar currValue[MAX_BUF];
  SETTING* end = aSettings + aSize;
  for (SETTING * settings = aSettings; settings < end; ++settings) {
    if (settings->flags & USE_FOR_DEFAULT_TEST) {
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
      if (settings->flags & APP_NAME_SUBSTITUTION) {
        PRInt32 offset = key.Find("%APPNAME%");
        key.Replace(offset, 9, mBrandFullName);
      }
      if (settings->flags & EXE_NAME_SUBSTITUTION) {
        PRInt32 offset = key.Find("%APPEXE%");
        key.Replace(offset, 8, exeName);
      }

      ::ZeroMemory(currValue, sizeof(currValue));
      HKEY theKey;
      nsresult rv = OpenUserKeyForReading(HKEY_CURRENT_USER, key.get(), &theKey);
      if (NS_SUCCEEDED(rv)) {
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
    }
  }  // for each registry key we want to look at

  return PR_TRUE;
}

nsresult nsWindowsShellService::Init()
{
  nsresult rv;

  nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIStringBundle> brandBundle;
  rv = bundleService->CreateBundle(BRAND_PROPERTIES, getter_AddRefs(brandBundle));
  NS_ENSURE_SUCCESS(rv, rv);

  brandBundle->GetStringFromName(NS_LITERAL_STRING("brandFullName").get(),
                                 getter_Copies(mBrandFullName));
  brandBundle->GetStringFromName(NS_LITERAL_STRING("brandShortName").get(),
                                 getter_Copies(mBrandShortName));

  PRUnichar appPath[MAX_BUF];
  if (!::GetModuleFileNameW(0, appPath, MAX_BUF))
    return NS_ERROR_FAILURE;

  mAppLongPath = appPath;

  nsCOMPtr<nsILocalFile> lf;
  rv = NS_NewLocalFile(mAppLongPath, PR_TRUE,
                       getter_AddRefs(lf));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> appDir;
  rv = lf->GetParent(getter_AddRefs(appDir));
  NS_ENSURE_SUCCESS(rv, rv);

  appDir->GetPath(mUninstallPath);
  mUninstallPath.AppendLiteral(UNINSTALL_EXE);

  // Support short path to the exe so if it is already set the user is not
  // prompted to set the default mail client again.
  if (!::GetShortPathNameW(appPath, appPath, MAX_BUF))
    return NS_ERROR_FAILURE;

  ToUpperCase(mAppShortPath = appPath);

  rv = NS_NewLocalFile(mAppLongPath, PR_TRUE, getter_AddRefs(lf));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = lf->SetLeafName(NS_LITERAL_STRING("mozMapi32.dll"));
  NS_ENSURE_SUCCESS(rv, rv);

  return lf->GetPath(mMapiDLLPath);
}

PRBool
nsWindowsShellService::IsDefaultClientVista(PRBool aStartupCheck, PRUint16 aApps, PRBool* aIsDefaultClient)
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
    
    // If this is the first application window, maintain internal state that we've
    // checked this session (so that subsequent window opens don't show the default
    // client dialog).
    if (aStartupCheck)
      mCheckedThisSessionClient = PR_TRUE;
    
    pAAR->Release();
    return PR_TRUE;
  }
#endif  
  return PR_FALSE;
}

PRBool
nsWindowsShellService::SetDefaultClientVista(PRUint16 aApps)
{
#if !defined(MOZ_DISABLE_VISTA_SDK_REQUIREMENTS)
  IApplicationAssociationRegistration* pAAR;

  HRESULT hr = CoCreateInstance(CLSID_ApplicationAssociationRegistration,
                                NULL,
                                CLSCTX_INPROC,
                                IID_IApplicationAssociationRegistration,
                                (void**)&pAAR);
  
  if (SUCCEEDED(hr)) {
    if (aApps & nsIShellService::BROWSER)
      pAAR->SetAppAsDefaultAll(APP_REG_NAME);
#ifdef MOZ_MAIL_NEWS
    if (aApps & nsIShellService::MAIL)
      pAAR->SetAppAsDefaultAll(APP_REG_NAME_MAIL);
    if (aApps & nsIShellService::NEWS)
      pAAR->SetAppAsDefaultAll(APP_REG_NAME_NEWS);
#endif

    pAAR->Release();
    return PR_TRUE;
  }
#endif  
  return PR_FALSE;
}

NS_IMETHODIMP
nsWindowsShellService::IsDefaultClient(PRBool aStartupCheck, PRUint16 aApps, PRBool *aIsDefaultClient)
{
  if (IsDefaultClientVista(aStartupCheck, aApps, aIsDefaultClient))
    return NS_OK;

  *aIsDefaultClient = PR_TRUE;

  // for each type, check if it is the default app
  // browser check needs to be at the top
  if (aApps & nsIShellService::BROWSER)
    *aIsDefaultClient &= TestForDefault(gBrowserSettings, sizeof(gBrowserSettings)/sizeof(SETTING));
#ifdef MOZ_MAIL_NEWS
  if (aApps & nsIShellService::MAIL)
    *aIsDefaultClient &= TestForDefault(gMailSettings, sizeof(gMailSettings)/sizeof(SETTING));
  if (aApps & nsIShellService::NEWS)
    *aIsDefaultClient &= TestForDefault(gNewsSettings, sizeof(gNewsSettings)/sizeof(SETTING));
#endif

  // If this is the first application window, maintain internal state that we've
  // checked this session (so that subsequent window opens don't show the
  // default client dialog).
  if (aStartupCheck)
    mCheckedThisSessionClient = PR_TRUE;

  return NS_OK;
}

static DWORD
DeleteRegKeyDefaultValue(HKEY baseKey, LPCWSTR keyName)
{
  HKEY key;
  DWORD res = ::RegOpenKeyExW(baseKey, keyName,
                              0, KEY_WRITE, &key);
  if (res == ERROR_SUCCESS) {
    res = ::RegDeleteValueW(key, NULL);
    ::RegCloseKey(key);
  }
  return res;
}

// Utility function to delete a registry subkey.
static DWORD
DeleteRegTree(HKEY baseKey, LPCWSTR keyName)
{
  // Make sure input subkey isn't null.
  if (!keyName || !*keyName)
    return ERROR_BADKEY;

  // Open subkey.
  HKEY key;
  DWORD res = ::RegOpenKeyExW(baseKey, keyName, 0,
                              KEY_ENUMERATE_SUB_KEYS | DELETE, &key);
 
  // Continue till we get an error or are done.
  while (res == ERROR_SUCCESS) {
    PRUnichar subkeyName[_MAX_PATH];
    DWORD len = sizeof subkeyName;
    // Get first subkey name.  Note that we always get the
    // first one, then delete it.  So we need to get
    // the first one next time, also.
    res = ::RegEnumKeyExW(key, 0, subkeyName, &len, NULL, NULL,
                          NULL, NULL);
    if (res == ERROR_NO_MORE_ITEMS) {
      // No more subkeys.  Delete the main one.
      res = ::RegDeleteKeyW(baseKey, keyName);
      break;
    }
    // If we find another subkey, delete it, recursively.
    if (res == ERROR_SUCCESS) {
      // Another subkey, delete it, recursively.
      res = DeleteRegTree(key, subkeyName);
    }
  }
 
  // Close the key we opened.
  ::RegCloseKey(key);
  return res;
}

void
nsWindowsShellService::SetRegKey(const nsString& aKeyName,
                                 const nsString& aValueName,
                                 const nsString& aValue,
                                 PRBool aHKLMOnly)
{
  PRUnichar buf[MAX_BUF];
  DWORD len = sizeof buf;

  HKEY theKey;
  nsresult rv = OpenKeyForWriting(HKEY_LOCAL_MACHINE, aKeyName.get(), &theKey,
                                  aHKLMOnly);
  if (NS_FAILED(rv))
    return;

  // Get the old value
  DWORD res = ::RegQueryValueExW(theKey, aValueName.get(),
                                 NULL, NULL, (LPBYTE)buf, &len);

  // Set the new value
  if (REG_FAILED(res) || !aValue.Equals(buf, CaseInsensitiveCompare)) {
    ::RegSetValueExW(theKey, aValueName.get(), 
                     0, REG_SZ, (const BYTE *)aValue.get(),
                     (aValue.Length() + 1) * sizeof(PRUnichar));
  }

  // Close the key we opened.
  ::RegCloseKey(theKey);
}


NS_IMETHODIMP
nsWindowsShellService::SetDefaultClient(PRBool aForAllUsers,
                                        PRBool aClaimAllTypes, PRUint16 aApps)
{
  // Delete the protocol and file handlers under HKCU if they exist. This way
  // the HKCU registry is cleaned up when HKLM is writeable or if it isn't
  // the values will then be added under HKCU.
  if (aApps & nsIShellService::BROWSER) {
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\http\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\http\\DefaultIcon");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\https\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\https\\DefaultIcon");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\ftp\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\ftp\\DefaultIcon");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\gopher\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\gopher\\DefaultIcon");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\SeaMonkeyURL");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\SeaMonkeyHTML");

    (void)DeleteRegKeyDefaultValue(HKEY_CURRENT_USER,
      L"Software\\Classes\\.htm");
    (void)DeleteRegKeyDefaultValue(HKEY_CURRENT_USER,
      L"Software\\Classes\\.html");
    (void)DeleteRegKeyDefaultValue(HKEY_CURRENT_USER,
      L"Software\\Classes\\.shtml");
    (void)DeleteRegKeyDefaultValue(HKEY_CURRENT_USER,
      L"Software\\Classes\\.xht");
    (void)DeleteRegKeyDefaultValue(HKEY_CURRENT_USER,
      L"Software\\Classes\\.xhtml");
  }

#ifdef MOZ_MAIL_NEWS
  if (aApps & nsIShellService::MAIL) {
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\SeaMonkeyEML");
    (void)DeleteRegKeyDefaultValue(HKEY_CURRENT_USER,
      L"Software\\Classes\\.eml");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\mailto\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\mailto\\DefaultIcon");
  }

  if (aApps & nsIShellService::NEWS) {
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\news\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\news\\DefaultIcon");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\snews\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\snews\\DefaultIcon");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\nntp\\shell\\open");
    (void)DeleteRegTree(HKEY_CURRENT_USER,
      L"Software\\Classes\\nntp\\DefaultIcon");
  }
#endif

  if (!aForAllUsers && SetDefaultClientVista(aApps))
    return NS_OK;

  nsresult rv = NS_OK;
  if (aApps & nsIShellService::BROWSER)
    rv |= setDefaultBrowser();

#ifdef MOZ_MAIL_NEWS
  if (aApps & nsIShellService::MAIL)
    rv |= setDefaultMail();

  if (aApps & nsIShellService::NEWS)
    rv |= setDefaultNews();
#endif

  // Refresh the Shell
  SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, 0, 0);
  return rv;
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


nsresult
nsWindowsShellService::setDefaultBrowser()
{
  SETTING* settings;
  SETTING* end = gBrowserSettings + sizeof(gBrowserSettings)/sizeof(SETTING);

  nsCOMPtr<nsILocalFile> lf;
  nsresult rv = NS_NewLocalFile(mAppLongPath, PR_TRUE,
                                getter_AddRefs(lf));
  if (NS_FAILED(rv))
    return rv;

  nsAutoString exeName;
  rv = lf->GetLeafName(exeName);
  if (NS_FAILED(rv))
    return rv;
  ToUpperCase(exeName);

  nsCOMPtr<nsIFile> appDir;
  rv = lf->GetParent(getter_AddRefs(appDir));
  if (NS_FAILED(rv))
    return rv;

  nsAutoString uninstLongPath;
  appDir->GetPath(uninstLongPath);
  uninstLongPath.AppendLiteral(UNINSTALL_EXE);

  for (settings = gBrowserSettings; settings < end; ++settings) {
    NS_ConvertUTF8toUTF16 dataLongPath(settings->valueData);
    NS_ConvertUTF8toUTF16 key(settings->keyName);
    NS_ConvertUTF8toUTF16 value(settings->valueName);
    if (settings->flags & APP_PATH_SUBSTITUTION) {
      PRInt32 offset = dataLongPath.Find("%APPPATH%");
      dataLongPath.Replace(offset, 9, mAppLongPath);
    }
    if (settings->flags & UNINST_PATH_SUBSTITUTION) {
      PRInt32 offset = dataLongPath.Find("%UNINSTPATH%");
      dataLongPath.Replace(offset, 12, uninstLongPath);
    }
    if (settings->flags & EXE_NAME_SUBSTITUTION) {
      PRInt32 offset = key.Find("%APPEXE%");
      key.Replace(offset, 8, exeName);
    }

    SetRegKey(key, value, dataLongPath,
              (settings->flags & HKLM_ONLY));
  }

  // Select the Default Browser for the Windows XP Start Menu
  SetRegKey(NS_LITERAL_STRING(SMI), EmptyString(), exeName, PR_TRUE);

  nsCOMPtr<nsIStringBundleService>
    bundleService(do_GetService("@mozilla.org/intl/stringbundle;1"));
  if (!bundleService)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIStringBundle> bundle, brandBundle;
  rv = bundleService->CreateBundle(SHELLSERVICE_PROPERTIES, getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = bundleService->CreateBundle(BRAND_PROPERTIES, getter_AddRefs(brandBundle));
  NS_ENSURE_SUCCESS(rv, rv);

  // Create the Start Menu item if it doesn't exist
  nsString brandFullName;
  brandBundle->GetStringFromName(NS_LITERAL_STRING("brandFullName").get(),
                                 getter_Copies(brandFullName));

  nsAutoString key1(NS_LITERAL_STRING(SMI));
  key1.Append(exeName);
  key1.AppendLiteral("\\");
  SetRegKey(key1, EmptyString(), brandFullName, PR_TRUE);

  // Set the Preferences and Safe Mode start menu context menu item labels
  nsAutoString preferencesKey(NS_LITERAL_STRING(SMI));
  preferencesKey.Append(exeName);
  preferencesKey.AppendLiteral("\\shell\\properties");

  nsAutoString safeModeKey(NS_LITERAL_STRING(SMI));
  safeModeKey.Append(exeName);
  safeModeKey.AppendLiteral("\\shell\\safemode");

  nsString brandShortName;
  brandBundle->GetStringFromName(NS_LITERAL_STRING("brandShortName").get(),
                                 getter_Copies(brandShortName));

  const PRUnichar* brandNameStrings[] = { brandShortName.get() };

  // Set the Preferences menu item
  nsString preferencesTitle;
  bundle->FormatStringFromName(NS_LITERAL_STRING("preferencesLabel").get(),
                               brandNameStrings, 1,
                               getter_Copies(preferencesTitle));
  // Set the Safe Mode menu item
  nsString safeModeTitle;
  bundle->FormatStringFromName(NS_LITERAL_STRING("safeModeLabel").get(),
                               brandNameStrings, 1,
                               getter_Copies(safeModeTitle));

  SetRegKey(preferencesKey, EmptyString(), preferencesTitle, PR_TRUE);
  SetRegKey(safeModeKey, EmptyString(), safeModeTitle, PR_TRUE);
  return NS_OK;
  }

#ifdef MOZ_MAIL_NEWS
nsresult
nsWindowsShellService::setDefaultMail()
{
  nsresult rv;
  setKeysForSettings(gMailSettings, sizeof(gMailSettings)/sizeof(SETTING));

  // at least for now, this key needs to be written to HKLM instead of HKCU
  // which is where the windows operating system looks (at least on Win XP and
  // earlier)
  SetRegKey(NS_LITERAL_STRING(MOZ_CLIENT_MAIL_KEY), EmptyString(), mBrandFullName, PR_TRUE);

  nsAutoString key1(NS_LITERAL_STRING(MAILCLIENTS));
  key1.Append(mBrandFullName);
  key1.AppendLiteral("\\");
  SetRegKey(key1, EmptyString(), mBrandFullName, PR_TRUE);

  // Set the Preferences and Safe Mode start menu context menu item labels
  nsCOMPtr<nsIStringBundle> bundle;
  nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = bundleService->CreateBundle(SHELLSERVICE_PROPERTIES, getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);
  nsAutoString preferencesKey(NS_LITERAL_STRING(MAILCLIENTS));
  preferencesKey.AppendLiteral("%APPNAME%\\shell\\properties");
  PRInt32 offset = preferencesKey.Find("%APPNAME%");
  preferencesKey.Replace(offset, 9, mBrandFullName);

  const PRUnichar* brandNameStrings[] = { mBrandShortName.get() };

  // Set the Preferences menu item
  nsString preferencesTitle;
  bundle->FormatStringFromName(NS_LITERAL_STRING("preferencesLabel").get(),
                               brandNameStrings, 1, getter_Copies(preferencesTitle));
  // Set the registry keys
  SetRegKey(preferencesKey, EmptyString(), preferencesTitle, PR_TRUE);
#ifndef __MINGW32__
  // Tell the MAPI Service to register the mapi proxy dll now that we are the default mail application
  nsCOMPtr<nsIMapiSupport> mapiService (do_GetService(NS_IMAPISUPPORT_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return mapiService->RegisterServer();
#else
  return NS_OK;
#endif
}

nsresult
nsWindowsShellService::setDefaultNews()
{
  setKeysForSettings(gNewsSettings, sizeof(gNewsSettings)/sizeof(SETTING));

  // at least for now, this key needs to be written to HKLM instead of HKCU
  // which is where the windows operating system looks (at least on Win XP and earlier)
  SetRegKey(NS_LITERAL_STRING(MOZ_CLIENT_NEWS_KEY), EmptyString(), mBrandFullName, PR_TRUE);

  nsAutoString key1(NS_LITERAL_STRING(NEWSCLIENTS));
  key1.Append(mBrandFullName);
  key1.AppendLiteral("\\");
  SetRegKey(key1, EmptyString(), mBrandFullName, PR_TRUE);
  return NS_OK;
}
#endif

static nsresult
WriteBitmap(nsIFile* aFile, gfxIImageFrame* aImage)
{
  PRInt32 width, height;
  aImage->GetWidth(&width);
  aImage->GetHeight(&height);

  PRUint8* bits;
  PRUint32 length;
  aImage->LockImageData();
  aImage->GetImageData(&bits, &length);
  if (!bits) {
      aImage->UnlockImageData();
      return NS_ERROR_FAILURE;
  }

  PRUint32 bpr;
  aImage->GetImageBytesPerRow(&bpr);
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
  nsresult rv = NS_NewLocalFileOutputStream(getter_AddRefs(stream), aFile);
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

  aImage->UnlockImageData();
  return rv;
}

NS_IMETHODIMP
nsWindowsShellService::SetDesktopBackground(nsIDOMElement* aElement,
                                            PRInt32 aPosition)
{
  nsresult rv;

  nsCOMPtr<gfxIImageFrame> gfxFrame;

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
    nsCOMPtr<imgIContainer> container;
    rv = request->GetImage(getter_AddRefs(container));
    if (!container)
      return NS_ERROR_FAILURE;

    // get the current frame, which holds the image data
    container->GetCurrentFrame(getter_AddRefs(gfxFrame));
  }

  if (!gfxFrame)
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
  rv = WriteBitmap(file, gfxFrame);

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


/* helper routine. Iterate over the passed in settings array, setting each key
 * in the windows registry.
*/

void
nsWindowsShellService::setKeysForSettings(SETTING aSettings[], PRInt32 aSize)
{
  SETTING* settings;
  SETTING* end = aSettings + aSize;
  PRInt32 offset;

  for (settings = aSettings; settings < end; ++settings)
  {
    NS_ConvertUTF8toUTF16 data(settings->valueData);
    NS_ConvertUTF8toUTF16 key(settings->keyName);
    NS_ConvertUTF8toUTF16 value(settings->valueName);
    if (settings->flags & APP_PATH_SUBSTITUTION)
    {
      offset = data.Find("%APPPATH%");
      data.Replace(offset, 9, mAppLongPath);
    }
    if (settings->flags & MAPIDLL_PATH_SUBSTITUTION)
    {
      offset = data.Find("%MAPIDLLPATH%");
      data.Replace(offset, 13, mMapiDLLPath);
    }
    if (settings->flags & APP_NAME_SUBSTITUTION)
    {
      offset = key.Find("%APPNAME%");
      key.Replace(offset, 9, mBrandFullName);
    }
    if (settings->flags & UNINST_PATH_SUBSTITUTION)
    {
      offset = data.Find("%UNINSTPATH%");
      data.Replace(offset, 12, mUninstallPath);
    }

    SetRegKey(key, value, data, settings->flags & HKLM_ONLY);
  }
}

