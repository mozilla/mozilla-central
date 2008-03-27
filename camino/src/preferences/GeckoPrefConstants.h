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
 * The Original Code is Camino code.
 *
 * The Initial Developer of the Original Code is
 * Stuart Morgan
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Morgan <stuart.morgan@alumni.case.edu>
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

#import <Foundation/Foundation.h>

#pragma GCC visibility push(default)

#pragma mark Tab Behavior

// Controls whether the tab bar is show even when there is only one tab.
extern const char* const kGeckoPrefAlwaysShowTabBar;                   // bool

// Controls the load behavior of URLs loaded from external applications.
extern const char* const kGeckoPrefExternalLoadBehavior;               // int
// Possible values:
extern const int kExternalLoadOpensNewWindow;
extern const int kExternalLoadOpensNewTab;
extern const int kExternalLoadReusesWindow;

// Controls whether middle/command-clicking opens a tab instead of a window
extern const char* const kGeckoPrefOpenTabsForMiddleClick;             // bool

// Controls whether user-opened tabs open in the background (i.e., don't focus)
extern const char* const kGeckoPrefOpenTabsInBackground;               // bool

// Controls where links that would open new windows open.
extern const char* const kGeckoPrefSingleWindowModeTargetBehavior;     // int
// Posible values:
extern const int kSingleWindowModeUseDefault;
extern const int kSingleWindowModeUseCurrentTab;
extern const int kSingleWindowModeUseNewTab;
extern const int kSingleWindowModeUseNewWindow;

// Controls when kGeckoPrefSingleWindowModeTargetBehavior actually applies
extern const char* const kGeckoPrefSingleWindowModeRestriction;        // int
// Possible values:
extern const int kSingleWindowModeApplyAlways;
extern const int kSingleWindowModeApplyNever;
extern const int kSingleWindowModeApplyOnlyToUnfeatured;

// Controls whether tabs diverted by SWM open in the background
extern const char* const kGeckoPrefSingleWindowModeTabsOpenInBackground; // bool

// Controls whether tab jumpback is enabled
extern const char* const kGeckoPrefEnableTabJumpback;                  // bool

// Controls wheter source is opened in a tab rather than a window
extern const char* const kGeckoPrefViewSourceInTab;                    // bool

#pragma mark Warnings

// Controls whether there is a warning before closing multi-tab windows
extern const char* const kGeckoPrefWarnWhenClosingWindows;             // bool

// Controls whether there is a warning before opening a feed: link
extern const char* const kGeckoPrefWarnBeforeOpeningFeeds;             // bool

// The last version for which the user was warned about possible add-on problems
extern const char* const kGeckoPrefLastAddOnWarningVersion;            // string

#pragma mark Content Control

// Controls whether Javascript is enabled
extern const char* const kGeckoPrefEnableJavascript;                   // bool

// Controls whether Java is enabled
extern const char* const kGeckoPrefEnableJava;                         // bool

// Controls whether Plugins are enabled
extern const char* const kGeckoPrefEnablePlugins;                      // bool

// Controls whether the popup blocker is enabled
extern const char* const kGeckoPrefBlockPopups;                        // bool

// Controls whether ads are blocked
extern const char* const kGeckoPrefBlockAds;                           // bool

// Controls whether Flashblock is enabled
extern const char* const kGeckoPrefBlockFlash;                         // bool

// Controls how animated images are allowed to animate
extern const char* const kGeckoPrefImageAnimationBehavior;             // string
// Possible values:
extern NSString* const kImageAnimationNone;
extern NSString* const kImageAnimationOnce;
extern NSString* const kImageAnimationLoop;

// Controls whether JS window resizing is disabled
extern const char* const kGeckoPrefPreventDOMWindowResize;             // bool

// Controls whether JS window status bar updating is disabled
extern const char* const kGeckoPrefPreventDOMStatusChange;             // bool

// Controls whether JS window reordering is disabled
extern const char* const kGeckoPrefPreventDOMWindowFocus;              // bool

#pragma mark Home Page

// The homepage URL
extern const char* const kGeckoPrefHomepageURL;                        // string

// Controls what page is loaded in new windows
extern const char* const kGeckoPrefNewWindowStartPage;                 // int
// Controls what page is loaded in new tabs
extern const char* const kGeckoPrefNewTabStartPage;                    // int
// Possible values:
extern const int kStartPageBlank;
extern const int kStartPageHome;
// other Mozilla/Firefox values are not implement in Camino

// Records the last version where the homepage override has been applied
extern const char* const kGeckoPrefNewVersionHomepageOverrideVersion;  // string

#pragma mark Security

// Controls how personal certificates are chosen
extern const char* const kGeckoPrefDefaultCertificateBehavior;         // string
// Possible values:
extern NSString* const kPersonalCertificateSelectAutomatically;
extern NSString* const kPersonalCertificateAlwaysAsk;

// Controls whether autocomplete="off" is ignored for password managment
extern const char* const kGeckoPrefIgnoreAutocompleteOff;              // bool

#pragma mark Miscellaneous UI Controls

// Controls whether JS/CSS errors are logged to the console
extern const char* const kGeckoPrefLogJSToConsole;                     // bool

// Controls whether favicons are used in browser chrome
extern const char* const kGeckoPrefEnableFavicons;                     // bool

// Controls whether URL fixup (e.g., search on DNS failure) is enabled
extern const char* const kGeckoPrefEnableURLFixup;                     // bool

// Controls whether Bonjour has been disabled
extern const char* const kGeckoPrefDisableBonjour;                     // bool

// Controls whether the default browser is checked at each launch
extern const char* const kGeckoPrefCheckDefaultBrowserAtLaunch;        // bool

#pragma mark Keyboard Shortcuts

// Controls the behavior of the backspace/delete key
extern const char* const kGeckoPrefBackspaceAction;                    // int
// Possible values:
extern const int kBackspaceActionBack;
extern const int kBackspaceActionNone;
// paging is not implemented in Camino

// Controls the behavior of tabbing through page elements.
extern const char* const kGeckoPrefTabFocusBehavior;                   // int
// Possible values (note that these are OR-able, not mutually exclusive):
extern const int kTabFocusesTextFields;
extern const int kTabFocusesForms;
extern const int kTabFocusesLinks;

#pragma mark Auto-Update

// The base URL for software update checks
extern const char* const kGeckoPrefUpdateURL;                          // string

// A user-override for kGeckoPrefUpdateURL
extern const char* const kGeckoPrefUpdateURLOverride;                  // string

#pragma mark i18n

// The ranked languages to send in the Accept-Languages header
extern const char* const kGeckoPrefAcceptLanguages;                    // string

// A user override for the automatically-determined kGeckoPrefAcceptLanguages
extern const char* const kGeckoPrefAcceptLanguagesOverride;            // string

// The automatic character set detector to use for unspecified pages
extern const char* const kGeckoPrefCharsetDetector;                    // string
// Possible values:
extern NSString* const kCharsetDetectorNone;
extern NSString* const kCharsetDetectorUniversal;

#pragma mark Session Saving

// Controls whether session restore is enabled for normal relaunches
extern const char* const kGeckoPrefSessionSaveEnabled;                 // bool

// Controls whether session restore is enabled across crashes (for auto-tests)
extern const char* const kGeckoPrefSessionSaveRestoreAfterCrash;       // bool

#pragma mark History

// Controls how many days history is kept for
extern const char* const kGeckoPrefHistoryLifetimeDays;                // int

#pragma mark Cookies

// Controls how cookies are handled by default
extern const char* const kGeckoPrefCookieDefaultAcceptPolicy;          // int
// Possible values:
extern const int kCookieAcceptAll;
extern const int kCookieAcceptFromOriginatingServer;
extern const int kCookieAcceptNone;

// Controls how long cookies last. Also whether or not the user is prompted
// for each cookie, because mashing orthogonal concepts together is fun!
extern const char* const kGeckoPrefCookieLifetimePolicy;               // int
// Possible values:
extern const int kCookieLifetimeNormal;
extern const int kCookieLifetimeAsk;
extern const int kCookieLifetimeSession;

#pragma mark Proxies

// Controls whether the proxy settings are taken from the OS settings
extern const char* const kGeckoPrefProxyUsesSystemSettings;            // bool

// The url of a PAC file to use for proxy settings
extern const char* const kGeckoPrefProxyAutoconfigURL;                 // string

// A list of sites for which the proxy should not be applied
extern const char* const kGeckoPrefProxyBypassList;                    // string

#pragma mark Downloads

// Controls whether downloads should be auto-launched
extern const char* const kGeckoPrefAutoOpenDownloads;                  // bool

extern const char* const kGeckoPrefDownloadCleanupPolicy;              // int
// Possible values:
extern const int kRemoveDownloadsManually;
extern const int kRemoveDownloadsOnQuit;
extern const int kRemoveDownloadsOnSuccess;

// Controls whether the download manager is focused when a download is started
extern const char* const kGeckoPrefFocusDownloadManagerOnDownload;     // bool

// Controls whether the download manager stays open after downloads complete
extern const char* const kGeckoPrefLeaveDownloadManagerOpen;           // bool

#pragma mark Page Appearance

// Controls whether links are underlined by default
extern const char* const kGeckoPrefUnderlineLinks;                     // bool

// Controls whether page-specified fonts should be used
extern const char* const kGeckoPrefUsePageFonts;                       // bool

// Controls whether page-specified colors should be used
extern const char* const kGeckoPrefUsePageColors;                      // bool

// The default page background color
extern const char* const kGeckoPrefPageBackgroundColor;                // color

// The default page foreground color
extern const char* const kGeckoPrefPageForegroundColor;                // color

// The default link color
extern const char* const kGeckoPrefLinkColor;                          // color

// The default visited link color
extern const char* const kGeckoPrefVisitedLinkColor;                   // color

#pragma mark User Agent

// The application version to use in the user agent
extern const char* const kGeckoPrefUserAgentAppVersion;                // string

// The locale to use in the user agent
extern const char* const kGeckoPrefUserAgentLocale;                    // string

// A user override for the automatically-determined kGeckoPrefUserAgentLocale
extern const char* const kGeckoPrefUserAgentLocaleOverride;            // string

// An extra suffix for the user agent identifying the multilingual build
extern const char* const kGeckoPrefUserAgentMultiLangAddition;         // string

#pragma GCC visibility pop
