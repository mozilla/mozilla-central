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
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Josh Aas - josh@mozilla.com
 *   Nate Weaver (Wevah) - wevah@derailer.org
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

#import <Carbon/Carbon.h>
#import <Sparkle/Sparkle.h>
#import <SharedMenusCocoa/SharedMenusObj.h>

#import "NSArray+Utils.h"
#import "NSString+Utils.h"
#import "NSMenu+Utils.h"
#import "NSURL+Utils.h"
#import "NSWorkspace+Utils.h"

#import "ChimeraUIConstants.h"
#import "MainController.h"
#import "BrowserWindow.h"
#import "BrowserWindowController.h"
#import "BookmarkMenu.h"
#import "Bookmark.h"
#import "BookmarkFolder.h"
#import "BookmarkInfoController.h"
#import "BookmarkManager.h"
#import "BookmarkToolbar.h"
#import "BrowserTabView.h"
#import "CHBrowserService.h"
#import "UserDefaults.h"
#import "KeychainService.h"
#import "RemoteDataProvider.h"
#import "ProgressDlgController.h"
#import "JSConsole.h"
#import "NetworkServices.h"
#import "MVPreferencesController.h"
#import "CertificatesWindowController.h"
#import "PageInfoWindowController.h"
#import "PreferenceManager.h"
#import "SiteIconProvider.h"
#import "SessionManager.h"
#import "CHPermissionManager.h"
#import "CmXULAppInfo.h"
#import "AddSearchProviderHandler.h"

#include "nsCOMPtr.h"
#include "nsEmbedAPI.h"
#include "nsString.h"
#include "nsStaticComponents.h"

#include "nsIWebBrowserChrome.h"
#include "nsIServiceManager.h"
#include "nsIIOService.h"
#include "nsIChromeRegistry.h"
#include "nsIObserverService.h"
#include "nsIGenericFactory.h"
#include "nsNetCID.h"
#include "nsICookieManager.h"
#include "nsIBrowserHistory.h"
#include "nsICacheService.h"

extern const nsModuleComponentInfo* GetAppComponents(unsigned int* outNumComponents);

static const char* ioServiceContractID = "@mozilla.org/network/io-service;1";

// Key in the defaults system used to determine if we crashed last time.
NSString* const kPreviousSessionTerminatedNormallyKey = @"PreviousSessionTerminatedNormally";

@interface MainController(Private)<NetworkServicesClient>

- (void)ensureGeckoInitted;
- (void)ensureInitializationCompleted;
- (void)setInitialized:(BOOL)flag;
- (void)setupStartpage;
- (void)setupRendezvous;
- (void)checkDefaultBrowser;
- (void)checkForProblemAddOns;
- (void)prelaunchHelperApps;
- (BOOL)bookmarksItemsEnabled;
- (void)adjustBookmarkMenuItems;
- (void)updateDockMenuBookmarkFolder;
- (void)doBookmarksMenuEnabling;
- (void)adjustTextEncodingMenu;
- (void)windowLayeringDidChange:(NSNotification*)inNotification;
- (void)bookmarkLoadingCompleted:(NSNotification*)inNotification;
- (void)dockMenuBookmarkFolderChanged:(NSNotification*)inNotification;
- (void)menuWillDisplay:(NSNotification*)inNotification;
- (void)showCertificatesNotification:(NSNotification*)inNotification;
- (void)openPanelDidEnd:(NSOpenPanel*)inOpenPanel returnCode:(int)inReturnCode contextInfo:(void*)inContextInfo;
- (void)loadApplicationPage:(NSString*)pageURL;

@end

#pragma mark -

@implementation MainController

- (id)init
{
  if ((self = [super init])) {
//XXX An updated version of this will be needed again once we're 10.4+ (See Bug 336217)
#if 0
    // ensure that we're at least on 10.2 as lower OS versions are not supported any more
    long version = 0;
    ::Gestalt(gestaltSystemVersion, &version);
    if (version < 0x00001020) {
      NSString* appName = NSLocalizedStringFromTable(@"CFBundleName", @"InfoPlist", nil);
      NSString* alert = [NSString stringWithFormat:NSLocalizedString(@"RequiredVersionNotMetTitle", @""), appName];
      NSString* message = [NSString stringWithFormat:NSLocalizedString(@"RequiredVersionNotMet", @""), appName];
      NSString* quit = NSLocalizedString(@"QuitButtonText",@"");
      NSRunAlertPanel(alert, message, quit, nil, nil);
      [NSApp terminate:self];
    }
#endif

    NSUserDefaults* defaults = [NSUserDefaults standardUserDefaults];

    NSString* url = [defaults stringForKey:USER_DEFAULTS_URL_KEY];
    mStartURL = url ? [url retain] : nil;

    mMenuBookmarks = nil;

    [NSApp setServicesProvider:self];
    // Initialize shared menu support
    mSharedMenusObj = [[SharedMenusObj alloc] init];
  }
  return self;
}

- (void)dealloc
{
  if ([self isInitialized])
    [[NSUserDefaults standardUserDefaults] removeObserver:self forKeyPath:SUScheduledCheckIntervalKey];

  [mCharsets release];

  // Terminate shared menus
  [mSharedMenusObj release];

  [mKeychainService release];

  [super dealloc];
#if DEBUG
  NSLog(@"Main controller died");
#endif
}

- (void)awakeFromNib
{
  // Be aware that we load a secondary nib for the accessory views, so this
  // will get called more than once.
}

- (void)ensureGeckoInitted
{
  if (mGeckoInitted)
    return;

  // bring up prefs manager (which inits gecko)
  [PreferenceManager sharedInstance];

  // register our app components with the embed layer
  unsigned int numComps = 0;
  const nsModuleComponentInfo* comps = GetAppComponents(&numComps);
  CHBrowserService::RegisterAppComponents(comps, numComps);

  // add our OpenSearch handler
  AddSearchProviderHandler::InstallHandler();

  mGeckoInitted = YES;
}

- (BOOL)isInitialized
{
  return mInitialized;
}

- (void)setInitialized:(BOOL)flag
{
  mInitialized = flag;
}

- (void)ensureInitializationCompleted
{
  if ([self isInitialized])
    return;

  [self ensureGeckoInitted];

  // To work around bugs on Tiger caused by the view hookup order having been
  // changed from postfix to prefix order, we need to set a user default to
  // return to the old behavior.
  [[NSUserDefaults standardUserDefaults] setBool:NO forKey:@"NSViewSetAncestorsWindowFirst"];

  NSNotificationCenter* notificationCenter = [NSNotificationCenter defaultCenter];
  // turn on menu display notifications
  [NSMenu setupMenuWillDisplayNotifications];

  // register for them for bookmarks
  [notificationCenter addObserver:self selector:@selector(menuWillDisplay:) name:NSMenuWillDisplayNotification object:nil];

  // register for various window layering changes
  [notificationCenter addObserver:self selector:@selector(windowLayeringDidChange:) name:NSWindowDidBecomeKeyNotification object:nil];
  [notificationCenter addObserver:self selector:@selector(windowLayeringDidChange:) name:NSWindowDidResignKeyNotification object:nil];
  [notificationCenter addObserver:self selector:@selector(windowLayeringDidChange:) name:NSWindowDidBecomeMainNotification object:nil];
  [notificationCenter addObserver:self selector:@selector(windowLayeringDidChange:) name:NSWindowDidResignMainNotification object:nil];

  // listen for bookmark loading completion
  [notificationCenter addObserver:self selector:@selector(bookmarkLoadingCompleted:) name:kBookmarkManagerStartedNotification object:nil];
  // listen for changes to the dock menu
  [notificationCenter addObserver:self selector:@selector(dockMenuBookmarkFolderChanged:) name:BookmarkFolderDockMenuChangeNotificaton object:nil];

  // and fire up bookmarks (they will be loaded on a thread)
  [[BookmarkManager sharedBookmarkManager] loadBookmarksLoadingSynchronously:NO];

  // register some special favicon images
  [[SiteIconProvider sharedFavoriteIconProvider] registerFaviconImage:[NSImage imageNamed:@"smallDocument"] forPageURI:@"about:blank"];
  [[SiteIconProvider sharedFavoriteIconProvider] registerFaviconImage:[NSImage imageNamed:@"smallDocument"] forPageURI:@"about:local_file"];
  [[SiteIconProvider sharedFavoriteIconProvider] registerFaviconImage:[NSImage imageNamed:@"bm_favicon"]    forPageURI:@"about:bookmarks"];
  [[SiteIconProvider sharedFavoriteIconProvider] registerFaviconImage:[NSImage imageNamed:@"history_icon"]   forPageURI:@"about:history"];

  // listen for the Show Certificates notification (which is send from the Security prefs panel)
  [notificationCenter addObserver:self selector:@selector(showCertificatesNotification:) name:@"ShowCertificatesNotification" object:nil];

  [self setupStartpage];

  // Initialize offline mode.
  mOffline = NO;
  nsCOMPtr<nsIIOService> ioService(do_GetService(ioServiceContractID));
  if (!ioService)
    return;
  PRBool offline = PR_FALSE;
  ioService->GetOffline(&offline);
  mOffline = offline;

  // Initialize the keychain service.
  mKeychainService = [KeychainService instance];

  // bring up the JS console service
  PreferenceManager* prefManager = [PreferenceManager sharedInstance];
  if ([prefManager getBooleanPref:kGeckoPrefLogJSToConsole withSuccess:NULL])
    [JSConsole sharedJSConsole];

  [self setupRendezvous];

  // load up the charset dictionary with keys and menu titles.
  NSString* charsetPath = [NSBundle pathForResource:@"Charset" ofType:@"dict" inDirectory:[[NSBundle mainBundle] bundlePath]];
  mCharsets = [[NSDictionary dictionaryWithContentsOfFile:charsetPath] retain];

  // Check whether Camino shut down normally last time...
  [[NSUserDefaults standardUserDefaults] registerDefaults:[NSDictionary dictionaryWithObject:[NSNumber numberWithBool:YES] forKey:kPreviousSessionTerminatedNormallyKey]];
  BOOL previousSessionTerminatedNormally = [[NSUserDefaults standardUserDefaults] boolForKey:kPreviousSessionTerminatedNormallyKey];
  // ... then reset the state for the next time around.
  [[NSUserDefaults standardUserDefaults] setBool:NO forKey:kPreviousSessionTerminatedNormallyKey];
  [[NSUserDefaults standardUserDefaults] synchronize];

  // Determine if the previous session's window state should be restored.
  // Obey the camino.remember_window_state preference unless Camino crashed
  // last time, in which case the user is asked what to do.
  BOOL shouldRestoreWindowState = NO;
  if ([[SessionManager sharedInstance] hasSavedState]) {
    if (previousSessionTerminatedNormally) {
      shouldRestoreWindowState = [prefManager getBooleanPref:kGeckoPrefSessionSaveEnabled withSuccess:NULL];
    }
    else if ([prefManager getBooleanPref:kGeckoPrefSessionSaveRestoreAfterCrash withSuccess:NULL]) {
      NSAlert* restoreAfterCrashAlert = [[[NSAlert alloc] init] autorelease];
      [restoreAfterCrashAlert addButtonWithTitle:NSLocalizedString(@"RestoreAfterCrashActionButton", nil)];
      [restoreAfterCrashAlert addButtonWithTitle:NSLocalizedString(@"RestoreAfterCrashCancelButton", nil)];
      [restoreAfterCrashAlert setMessageText:NSLocalizedString(@"RestoreAfterCrashTitle", nil)];
      [restoreAfterCrashAlert setInformativeText:NSLocalizedString(@"RestoreAfterCrashMessage", nil)];
      [restoreAfterCrashAlert setAlertStyle:NSWarningAlertStyle];

      // It should be impossible for a menu to be open so soon, but this
      // should be called before displaying any modal dialogs.
      [NSMenu cancelAllTracking];

      if ([restoreAfterCrashAlert runModal] == NSAlertFirstButtonReturn)
        shouldRestoreWindowState = YES;
    }
  }

  if (shouldRestoreWindowState) {
    // if we've already opened a window (e.g., command line argument or apple event), we need
    // to pull it to the front after restoring the window state
    NSWindow* existingWindow = [self frontmostBrowserWindow];
    [[SessionManager sharedInstance] restoreWindowState];
    [existingWindow makeKeyAndOrderFront:self];
  }
  else {
    [[SessionManager sharedInstance] clearSavedState];
  }
  
  // Watch for any changes to the Sparkle auto-check pref so we can inform
  // the updater to adjust accordingly.
  [[NSUserDefaults standardUserDefaults] addObserver:self
                                          forKeyPath:SUScheduledCheckIntervalKey
                                             options:NSKeyValueObservingOptionNew
                                             context:nil];

  [self setInitialized:YES];
}

- (void)applicationDidFinishLaunching:(NSNotification*)aNotification
{
  [self ensureInitializationCompleted];

  [self checkForProblemAddOns];
  [self prelaunchHelperApps];

  // open a new browser window if we don't already have one or we have a specific
  // start URL we need to show
  NSWindow* browserWindow = [self frontmostBrowserWindow];
  if (!browserWindow || mStartURL)
    [self newWindow:self];

  // delay the default browser check to give the first page time to load
  [self performSelector:@selector(checkDefaultBrowser) withObject:nil afterDelay:2.0f];
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication*)sender
{
  ProgressDlgController* progressWindowController = [ProgressDlgController existingSharedDownloadController];
  if (progressWindowController) {
    NSApplicationTerminateReply progressTerminateReply = [progressWindowController allowTerminate];
    if (progressTerminateReply != NSTerminateNow)
      return progressTerminateReply;
  }

  PreferenceManager* prefManager = [PreferenceManager sharedInstanceDontCreate];
  if (!prefManager)
    return NSTerminateNow;    // we didn't fully launch

  if ([prefManager getBooleanPref:kGeckoPrefWarnWhenClosingWindows withSuccess:NULL]) {
    NSString* quitAlertMsg = nil;
    NSString* quitAlertExpl = nil;

    NSArray* openBrowserWins = [self browserWindows];
    if ([openBrowserWins count] == 1) {
      BrowserWindowController* bwc = [[openBrowserWins firstObject] windowController];
      unsigned int numTabs = [[bwc tabBrowser] numberOfTabViewItems];
      if (numTabs > 1) {
        quitAlertMsg = NSLocalizedString(@"QuitWithMultipleTabsMsg", @"");
        quitAlertExpl = [NSString stringWithFormat:NSLocalizedString(@"QuitWithMultipleTabsExpl", @""), numTabs];
      }
    }
    else if ([openBrowserWins count] > 1) {
      quitAlertMsg = NSLocalizedString(@"QuitWithMultipleWindowsMsg", @"");
      quitAlertExpl = [NSString stringWithFormat:NSLocalizedString(@"QuitWithMultipleWindowsExpl", @""), [openBrowserWins count]];
    }

    if (quitAlertMsg) {
      [NSApp activateIgnoringOtherApps:YES];
      nsAlertController* controller = CHBrowserService::GetAlertController();
      BOOL dontShowAgain = NO;
      BOOL confirmed = NO;

      @try {
        confirmed = [controller confirmCheckEx:nil
                                         title:quitAlertMsg
                                           text:quitAlertExpl
                                        button1:NSLocalizedString(@"QuitButtonText", @"")
                                        button2:NSLocalizedString(@"DontQuitButtonText", @"")
                                        button3:nil
                                       checkMsg:NSLocalizedString(@"DontShowWarningAgainCheckboxLabel", @"")
                                     checkValue:&dontShowAgain];
      }
      @catch (id exception) {
      }

      if (dontShowAgain)
        [prefManager setPref:kGeckoPrefWarnWhenClosingWindows toBoolean:NO];

      if (!confirmed)
        return NSTerminateCancel;
    }
  }

  // Check all the windows to see if any have tabs that shouldn't be closed.
  NSArray* openWindows = [NSApp orderedWindows];
  NSEnumerator* windowEnum = [openWindows objectEnumerator];
  NSWindow* curWindow;
  while ((curWindow = [windowEnum nextObject])) {
    if (![[curWindow windowController] isMemberOfClass:[BrowserWindowController class]])
      continue;

    BrowserWindowController* bwc = [curWindow windowController];
    if (![[bwc tabBrowser] windowShouldClose])
      return NSTerminateCancel;
  }

  return NSTerminateNow;
}

- (void)applicationWillTerminate:(NSNotification*)aNotification
{
#if DEBUG
  NSLog(@"App will terminate notification");
#endif
  // If there's no pref manager then we didn't really start up, so we do nothing.
  PreferenceManager* prefManager = [PreferenceManager sharedInstanceDontCreate];
  if (prefManager) {
    if ([prefManager getBooleanPref:kGeckoPrefSessionSaveEnabled withSuccess:NULL])
      [[SessionManager sharedInstance] saveWindowState];
    else
      [[SessionManager sharedInstance] clearSavedState];
  }

  [NetworkServices shutdownNetworkServices];

  // make sure the info window is closed
  [BookmarkInfoController closeBookmarkInfoController];

  // shut down bookmarks (if we made them)
  [[BookmarkManager sharedBookmarkManagerDontCreate] shutdown];

  // Save or remove the download list according to the users download removal pref
  ProgressDlgController* progressWindowController = [ProgressDlgController existingSharedDownloadController];
  if (progressWindowController)
    [progressWindowController applicationWillTerminate];

  // Autosave one of the windows.
  NSWindow* curMainWindow = [mApplication mainWindow];
  if (curMainWindow && [[curMainWindow windowController] respondsToSelector:@selector(autosaveWindowFrame)])
    [[curMainWindow windowController] autosaveWindowFrame];

  // Indicate that Camino exited normally. Write the default to disk
  // immediately since we cannot wait for automatic synchronization.
  [[NSUserDefaults standardUserDefaults] setBool:YES forKey:kPreviousSessionTerminatedNormallyKey];
  [[NSUserDefaults standardUserDefaults] synchronize];

  // Cancel outstanding site icon loads
  [[RemoteDataProvider sharedRemoteDataProvider] cancelOutstandingRequests];

  // Release before calling TermEmbedding since we need to access XPCOM
  // to save preferences
  [MVPreferencesController clearSharedInstance];

  CHBrowserService::TermEmbedding();

  [self autorelease];
}

- (void)setupStartpage
{
  // only do this if no url was specified in the command-line
  if (mStartURL)
    return;
  // for non-nightly builds, show a special start page
  PreferenceManager* prefManager = [PreferenceManager sharedInstance];
  NSString* vendorSubString = [prefManager getStringPref:kGeckoPrefUserAgentAppVersion withSuccess:NULL];
  if ([vendorSubString rangeOfString:@"pre"].location == NSNotFound) {
    // has the user seen this already?
    NSString* newVersionPageRev = [prefManager getStringPref:kGeckoPrefNewVersionHomepageOverrideVersion
                                                 withSuccess:NULL];
    if (![vendorSubString isEqualToString:newVersionPageRev]) {
      NSString* newVersionPage = NSLocalizedStringFromTable(@"NewVersionPage", @"WebsiteDefaults", nil);
      if ([newVersionPage length] && ![newVersionPage isEqualToString:@"NewVersionPage"]) {
        [mStartURL release];
        mStartURL = [newVersionPage retain];
      }
      // set the pref to say they've seen it
      [prefManager setPref:kGeckoPrefNewVersionHomepageOverrideVersion toString:vendorSubString];
    }
  }
}

- (void)setupRendezvous // aka "Bonjour"
{
  if ([[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefDisableBonjour withSuccess:NULL]) {
    // remove rendezvous items
    int itemIndex;
    while ((itemIndex = [mBookmarksMenu indexOfItemWithTag:kRendezvousRelatedItemTag]) != -1)
      [mBookmarksMenu removeItemAtIndex:itemIndex];

    return;
  }

  NSNotificationCenter* notificationCenter = [NSNotificationCenter defaultCenter];
  [notificationCenter addObserver:self selector:@selector(availableServicesChanged:) name:NetworkServicesAvailableServicesChanged object:nil];
  [notificationCenter addObserver:self selector:@selector(serviceResolved:) name:NetworkServicesResolutionSuccess object:nil];
  [notificationCenter addObserver:self selector:@selector(serviceResolutionFailed:) name:NetworkServicesResolutionFailure object:nil];
}

- (void)checkDefaultBrowser
{
  BOOL prefSet;
  BOOL allowPrompt = [[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefCheckDefaultBrowserAtLaunch
                                                            withSuccess:&prefSet];
  // Don't show the default browser alert on the very first launch (indicated by
  // the absence of any setting for camino.check_default_browser). 
  if (!prefSet) {
    [[PreferenceManager sharedInstance] setPref:kGeckoPrefCheckDefaultBrowserAtLaunch
                                      toBoolean:YES];
    return;
  }

  if (allowPrompt) {
    NSString* defaultBrowserIdentifier = [[NSWorkspace sharedWorkspace] defaultBrowserIdentifier];
    NSString* myIdentifier = [[NSBundle mainBundle] bundleIdentifier];
    if (![defaultBrowserIdentifier isEqualToString:myIdentifier]) {
      nsAlertController* controller = [[nsAlertController alloc] init];
      BOOL dontAskAgain = NO;
      int result = NSAlertErrorReturn;

      @try {
        result = [controller confirmCheckEx:nil // parent
                                      title:NSLocalizedString(@"DefaultBrowserTitle", nil)
                                       text:NSLocalizedString(@"DefaultBrowserMessage", nil)
                                    button1:NSLocalizedString(@"DefaultBrowserAcceptButton", nil)
                                    button2:NSLocalizedString(@"DefaultBrowserDenyButton", nil)
                                    button3:nil
                                   checkMsg:NSLocalizedString(@"DefaultBrowserChecboxTitle", nil)
                                 checkValue:&dontAskAgain];
      }
      @catch (id exception) {
      }

      if (result == NSAlertDefaultReturn)
        [[NSWorkspace sharedWorkspace] setDefaultBrowserWithIdentifier:myIdentifier];

      [[PreferenceManager sharedInstance] setPref:kGeckoPrefCheckDefaultBrowserAtLaunch
                                        toBoolean:!dontAskAgain];
      [controller release];
    }
  }
}

- (void)checkForProblemAddOns
{
  // See if we need to show the once-per-release warning about problem add-ons.
  PreferenceManager* prefManager = [PreferenceManager sharedInstance];
  NSString* vendorSubString = [prefManager getStringPref:kGeckoPrefUserAgentAppVersion withSuccess:NULL];
  if ([vendorSubString rangeOfString:@"pre"].location == NSNotFound) {
    NSString* lastWarningVersion = [prefManager getStringPref:kGeckoPrefLastAddOnWarningVersion
                                                 withSuccess:NULL];
    if (![vendorSubString isEqualToString:lastWarningVersion]) {
      // Check by class for each of the add-ons that are known to have
      // problematic versions in the wild.
      NSDictionary* problemAddOns = [NSDictionary dictionaryWithObjectsAndKeys:
                                      @"CaminoSession", @"CaminoSession",
                                          @"1Password", @"InputManager", // Yes, that's really the class name
                                        @"GrowlCamino", @"GrowlCamino",
                                        @"UnifyCamino", @"UnifyCamino",
                                                        nil];
      NSMutableArray* addOnsPresent = [NSMutableArray array];
      NSEnumerator* classNameEnumerator = [[problemAddOns allKeys] objectEnumerator];
      NSString* className;
      while ((className = [classNameEnumerator nextObject])) {
        if (NSClassFromString(className))
          [addOnsPresent addObject:[problemAddOns objectForKey:className]];
      }
      if ([addOnsPresent count] > 0) {
        NSString* warningText =
          [NSString stringWithFormat:NSLocalizedString(@"ProblematicAddOnWarningMessage", nil),
            [addOnsPresent componentsJoinedByString:@"\n\t"],
            vendorSubString];
        NSAlert* addOnAlert = [[[NSAlert alloc] init] autorelease];
        [addOnAlert addButtonWithTitle:NSLocalizedString(@"OKButtonText", nil)];
        [addOnAlert setMessageText:NSLocalizedString(@"ProblematicAddOnWarningTitle", nil)];
        [addOnAlert setInformativeText:warningText];
        [addOnAlert setAlertStyle:NSWarningAlertStyle];
        
        // It should be impossible for a menu to be open so soon, but this
        // should be called before displaying any modal dialogs.
        [NSMenu cancelAllTracking];
        [addOnAlert runModal];
      }

      [prefManager setPref:kGeckoPrefLastAddOnWarningVersion toString:vendorSubString];
    }
  }
}

// If it hasn't been done yet for this version, pre-launches the feed handlers
// (in the background) so that Launch Services will recognize that they exist
// and they won't show a first-run warning when used.
- (void)prelaunchHelperApps
{
  PreferenceManager* prefManager = [PreferenceManager sharedInstance];
  NSString* lastPrelaunchVersion = [prefManager getStringPref:"camino.last_feed_prelaunch_version"
                                                     withSuccess:NULL];
  NSString* currentVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
  if (![lastPrelaunchVersion isEqualToString:currentVersion]) {
    [NSThread detachNewThreadSelector:@selector(doBackgroundPrelaunch:)
                             toTarget:self
                           withObject:nil];
  }
}

- (void)helperAppPrelaunchComplete
{
  NSString* currentVersion = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
  [[PreferenceManager sharedInstance] setPref:"camino.last_feed_prelaunch_version"
                                     toString:currentVersion];
}

- (void)doBackgroundPrelaunch:(id)ignored
{
  NSAutoreleasePool* pool = [[NSAutoreleasePool alloc] init];

  // Sleep briefly so that we aren't fighting with app launch tasks.
  [NSThread sleepUntilDate:[NSDate dateWithTimeIntervalSinceNow:10]];

  NSString* feedHandlersPath = [[[NSBundle mainBundle] resourcePath] stringByAppendingPathComponent:@"FeedHandlers"];
  NSArray* handlers = [[NSFileManager defaultManager] directoryContentsAtPath:feedHandlersPath];
  NSEnumerator* handlerEnumerator = [handlers objectEnumerator];
  NSString* handler;
  while ((handler = [handlerEnumerator nextObject])) {
    NSString* fullPath = [feedHandlersPath stringByAppendingPathComponent:handler];

    LSLaunchURLSpec launchSpec = {
      (CFURLRef)[NSURL fileURLWithPath:fullPath],
      NULL,
      NULL,
      kLSLaunchDontSwitch,
      NULL
    };
    LSOpenFromURLSpec(&launchSpec, NULL);
  }
  [self performSelectorOnMainThread:@selector(helperAppPrelaunchComplete)
                         withObject:nil
                      waitUntilDone:NO];

  [pool release];
}

//
// bookmarkLoadingCompleted:
//
- (void)bookmarkLoadingCompleted:(NSNotification*)inNotification
{
  // the bookmarks menus get built lazily (by BookmarkMenu)
  [mBookmarksMenu setBookmarkFolder:[[BookmarkManager sharedBookmarkManager] bookmarkMenuFolder]];

  // dock bookmarks
  [self updateDockMenuBookmarkFolder];
}

#pragma mark -
#pragma mark Window Accesssors

- (NSArray*)browserWindows
{
  NSEnumerator* windowEnum = [[NSApp orderedWindows] objectEnumerator];
  NSMutableArray* windowArray = [NSMutableArray array];

  NSWindow* curWindow;
  while ((curWindow = [windowEnum nextObject])) {
    // not all browser windows are created equal. We only consider those with
    // an empty chrome mask, or ones with a toolbar, status bar, and resize control
    // to be real top-level browser windows for purposes of saving size and
    // loading urls in. Others are popups and are transient.
    if (([curWindow isVisible] || [curWindow isMiniaturized] || [NSApp isHidden]) &&
        [[curWindow windowController] isMemberOfClass:[BrowserWindowController class]] &&
        [[curWindow windowController] hasFullBrowserChrome])
    {
      [windowArray addObject:curWindow];
    }
  }

  return windowArray;
}

- (NSWindow*)frontmostBrowserWindow
{
  // for some reason, [NSApp mainWindow] doesn't always work, so we have to
  // do this manually
  NSEnumerator* windowEnum = [[NSApp orderedWindows] objectEnumerator];
  NSWindow* foundWindow = nil;

  NSWindow* curWindow;
  while ((curWindow = [windowEnum nextObject])) {
    // not all browser windows are created equal. We only consider those with
    // an empty chrome mask, or ones with a toolbar, status bar, and resize control
    // to be real top-level browser windows for purposes of saving size and
    // loading urls in. Others are popups and are transient.
    if (([curWindow isVisible] || [curWindow isMiniaturized] || [NSApp isHidden]) &&
        [[curWindow windowController] isMemberOfClass:[BrowserWindowController class]] &&
        [[curWindow windowController] hasFullBrowserChrome])
    {
      foundWindow = curWindow;
      break;
    }
  }

  return foundWindow;
}

- (BrowserWindowController*)mainWindowBrowserController
{
  // note that [NSApp mainWindow] will return NULL if we are not frontmost
  NSWindowController* mainWindowController = [[mApplication mainWindow] windowController];
  if (mainWindowController && [mainWindowController isMemberOfClass:[BrowserWindowController class]])
    return (BrowserWindowController*)mainWindowController;

  return nil;
}

- (BrowserWindowController*)keyWindowBrowserController
{
  NSWindowController* keyWindowController = [[mApplication keyWindow] windowController];
  if (keyWindowController && [keyWindowController isMemberOfClass:[BrowserWindowController class]])
    return (BrowserWindowController*)keyWindowController;

  return nil;
}

#pragma mark -
#pragma mark Page Loading

- (BrowserWindowController*)openBrowserWindowWithURL:(NSString*)aURL andReferrer:(NSString*)aReferrer behind:(NSWindow*)window allowPopups:(BOOL)inAllowPopups
{
  BrowserWindowController* browser = [[BrowserWindowController alloc] initWithWindowNibName:@"BrowserWindow"];

  if (window) {
    BrowserWindow* browserWin = (BrowserWindow*)[browser window];
    [browserWin setSuppressMakeKeyFront:YES];  // prevent gecko focus bringing the window to the front
    [browserWin orderWindow:NSWindowBelow relativeTo:[window windowNumber]];
    [browserWin setSuppressMakeKeyFront:NO];
  }
  else {
    [browser showWindow:self];
  }

  // The process of creating a new tab in this brand new window loads about:blank for us as a
  // side effect of calling GetDocument(). We don't need to do it again.
  if (!aURL || [aURL isBlankURL])
    [browser disableLoadPage];
  else
    [browser loadURL:aURL referrer:aReferrer focusContent:YES allowPopups:inAllowPopups];

  return browser;
}

- (BrowserWindowController*)openBrowserWindowWithURLs:(NSArray*)urlArray behind:(NSWindow*)window allowPopups:(BOOL)inAllowPopups
{
  BrowserWindowController* browser = [[BrowserWindowController alloc] initWithWindowNibName:@"BrowserWindow"];

  if (window) {
    BrowserWindow* browserWin = (BrowserWindow*)[browser window];
    [browserWin setSuppressMakeKeyFront:YES];  // prevent gecko focus bringing the window to the front
    [browserWin orderWindow:NSWindowBelow relativeTo:[window windowNumber]];
    [browserWin setSuppressMakeKeyFront:NO];
  }
  else {
    [browser showWindow:self];
  }

  [browser openURLArray:urlArray tabOpenPolicy:eReplaceTabs allowPopups:inAllowPopups];
  return browser;
}

// Shows a given URL by finding and showing an existing tab/window with that URL, or
// opening a new window or tab (observing the user's pref) if it's not already open
- (void)showURL:(NSString*)aURL
{
  int reuseWindow = [[PreferenceManager sharedInstance] getIntPref:kGeckoPrefExternalLoadBehavior
                                                       withSuccess:NULL];

  // Check to see if we already have the URL somewhere, and just show it if we do.
  NSEnumerator* windowEnumerator = [[NSApp orderedWindows] objectEnumerator];
  NSWindow* window;
  while ((window = [windowEnumerator nextObject])) {
    if ([[window windowController] isMemberOfClass:[BrowserWindowController class]]) {
      BrowserWindowController* browser = (BrowserWindowController*)[window windowController];
      BrowserTabView* tabView = [browser tabBrowser];
      int tabIndex = [tabView indexOfTabViewItemWithURL:aURL];
      if (tabIndex != NSNotFound) {
        [tabView selectTabViewItemAtIndex:tabIndex];
        [[browser window] makeKeyAndOrderFront:self];
        [browser reload:nil];
        return;
      }
    }
  }

  // If we got here, we didn't find it already open. Open it based on user prefs.
  BrowserWindowController* controller = (BrowserWindowController*)[[self frontmostBrowserWindow] windowController];
  if (controller) {
    BOOL tabOrWindowIsAvailable = ([[controller browserWrapper] isEmpty] && ![[controller browserWrapper] isBusy]);

    if (tabOrWindowIsAvailable || reuseWindow == kExternalLoadReusesWindow)
      [controller loadURL:aURL];
    else if (reuseWindow == kExternalLoadOpensNewTab)
      [controller openNewTabWithURL:aURL referrer:nil loadInBackground:NO allowPopups:NO setJumpback:NO];
    else
      controller = [controller openNewWindowWithURL:aURL referrer:nil loadInBackground:NO allowPopups:NO];
    [[controller window] makeKeyAndOrderFront:nil];
  }
  else
    controller = [self openBrowserWindowWithURL:aURL andReferrer:nil behind:nil allowPopups:NO];
}

// Convenience function for loading application pages either in a new window or a new
// tab as appropriate for the user prefs and the current browser state.
- (void)loadApplicationPage:(NSString*)pageURL
{
  BrowserWindowController* browserController = [self mainWindowBrowserController];
  if (browserController && [[browserController window] attachedSheet])
    [self openBrowserWindowWithURL:pageURL andReferrer:nil behind:nil allowPopups:NO];
  else
    [self showURL:pageURL];
}

- (BOOL)application:(NSApplication*)theApplication openFile:(NSString*)filename
{
  // We can get here before the application is fully initialized and the previous
  // session is restored.  We want to avoid opening URLs before that happens.
  [self ensureInitializationCompleted];

  NSURL* urlToOpen = [NSURL decodeLocalFileURL:[NSURL fileURLWithPath:filename]];
  [self showURL:[urlToOpen absoluteString]];
  return YES;
}

// a central place for bookmark opening logic
- (void)loadBookmark:(BookmarkItem*)item
             withBWC:(BrowserWindowController*)browserWindowController
        openBehavior:(EBookmarkOpenBehavior)behavior
     reverseBgToggle:(BOOL)reverseBackgroundPref
{
  if (!browserWindowController)
    browserWindowController = [self mainWindowBrowserController];

  BOOL openInNewWindow = (browserWindowController == nil);
  BOOL openInNewTab = NO;
  BOOL newTabInBackground = NO;

  BOOL loadNewTabsInBackgroundPref = [[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefOpenTabsInBackground
                                                                            withSuccess:NULL];

  // if the caller requests it, reverse the "open new tab/window in background" behavior.
  if (reverseBackgroundPref)
    loadNewTabsInBackgroundPref = !loadNewTabsInBackgroundPref;

  NSWindow* behindWindow = nil;

  switch (behavior) {
    case eBookmarkOpenBehavior_NewPreferred:
      if ([[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefOpenTabsForMiddleClick withSuccess:NULL]) {
        openInNewTab = YES;
        newTabInBackground = loadNewTabsInBackgroundPref;
      }
      else {
        openInNewWindow = YES;
        if (reverseBackgroundPref)
          behindWindow = [browserWindowController window];
      }
      break;

    case eBookmarkOpenBehavior_ForceReuse:
      openInNewTab = NO;
      openInNewWindow = NO;
      newTabInBackground = NO;
      break;

    case eBookmarkOpenBehavior_NewTab:
      openInNewTab = YES;
      newTabInBackground = browserWindowController && loadNewTabsInBackgroundPref;
      break;

    case eBookmarkOpenBehavior_NewWindow:
      openInNewWindow = YES;
      if (reverseBackgroundPref)
        behindWindow = [browserWindowController window];
      break;

    case eBookmarkOpenBehavior_Preferred:
      // default, so nothing to be done.
      break;
  }

  // we allow popups for the load that fires off a bookmark. Subsequent page loads, however, will
  // not allow popups (if blocked).
  if ([item isKindOfClass:[Bookmark class]]) {
    if (openInNewWindow)
      [self openBrowserWindowWithURL:[(Bookmark*)item url] andReferrer:nil behind:behindWindow allowPopups:YES];
    else if (openInNewTab)
      [browserWindowController openNewTabWithURL:[(Bookmark*)item url] referrer:nil loadInBackground:newTabInBackground allowPopups:YES setJumpback:NO];
    else
      [browserWindowController loadURL:[(Bookmark*)item url] referrer:nil focusContent:YES allowPopups:YES];
  }
  else if ([item isKindOfClass:[BookmarkFolder class]]) {
    if (openInNewWindow)
      [self openBrowserWindowWithURLs:[(BookmarkFolder*)item childURLs] behind:behindWindow allowPopups:YES];
    else if (openInNewTab)
      [browserWindowController openURLArray:[(BookmarkFolder*)item childURLs] tabOpenPolicy:eAppendTabs allowPopups:YES];
    else
      [browserWindowController openURLArrayReplacingTabs:[(BookmarkFolder*)item childURLs] closeExtraTabs:[(BookmarkFolder*)item isGroup] allowPopups:YES];
  }
}

//
// Open URL service handler
//
- (void)openURL:(NSPasteboard*)pboard userData:(NSString*)userData error:(NSString**)error
{
  NSArray* types = [pboard types];
  if (![types containsObject:NSStringPboardType]) {
    *error = NSLocalizedString(@"Error: couldn't open URL.",
                               @"pboard couldn't give URL string.");
    return;
  }
  NSString* urlString = [pboard stringForType:NSStringPboardType];
  if (!urlString) {
    *error = NSLocalizedString(@"Error: couldn't open URL.",
                               @"pboard couldn't give URL string.");
    return;
  }

  // check to see if it's a bookmark shortcut
  NSArray* resolvedURLs = [[BookmarkManager sharedBookmarkManager] resolveBookmarksShortcut:urlString];

  if (resolvedURLs) {
    if ([resolvedURLs count] == 1)
      [self showURL:[resolvedURLs lastObject]];
    else
      [self openBrowserWindowWithURLs:resolvedURLs behind:nil allowPopups:NO];
  }
  else {
    urlString = [urlString stringByRemovingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    [self showURL:urlString];
  }
}

#pragma mark -
#pragma mark Delegate/Notification

- (BOOL)applicationShouldHandleReopen:(NSApplication*)theApp hasVisibleWindows:(BOOL)flag
{
  // Don't open a new browser window if we're still launching or if there's a
  // modal alert dialog displayed.
  if (![self isInitialized] || [NSApp modalWindow])
    return NO;

  // ignore |hasVisibleWindows| because we always want to show a browser window when
  // the user clicks on the app icon, even if, say, prefs or the d/l window are open.
  // If there is no browser, create one. If there is one, unminimize it if it's in the dock.
  NSWindow* frontBrowser = [self frontmostBrowserWindow];
  if (!frontBrowser)
    [self newWindow:self];
  else if ([frontBrowser isMiniaturized])
    [frontBrowser deminiaturize:self];

  return NO;
}

- (void)applicationDidChangeScreenParameters:(NSNotification*)aNotification
{
  [NSApp makeWindowsPerform:@selector(display) inOrder:YES];
}

- (void)windowLayeringDidChange:(NSNotification*)inNotification
{
  [self delayedAdjustBookmarksMenuItemsEnabling];
  [self delayedFixCloseMenuItemKeyEquivalents];
  [self delayedUpdatePageInfo];
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary *)change
                       context:(void *)context
{
  if ([keyPath isEqualToString:SUScheduledCheckIntervalKey]) {
    NSTimeInterval updatePeriod = [[NSUserDefaults standardUserDefaults] integerForKey:SUScheduledCheckIntervalKey];
    // Note that this sets up a *repeating* check with this interval, so setting
    // this shorter to cause the next update to happen quickly would be bad.
    // An updatePeriod of 0 here disables the checks, which is what we want.
    [mAutoUpdater scheduleCheckWithInterval:updatePeriod];
  }
}

#pragma mark -
#pragma mark -
#pragma mark Application Menu

//
// -aboutWindow:
//
// Show the standard AppKit about window, but replace the build version in
// parentheses with the Gecko version and build ID.  The build version 
// normally comes from the CFBundleVersion key, but since that's not compatible
// with Mozilla build IDs, we've got to do this ourselves.
//
- (IBAction)aboutWindow:(id)sender
{
  NSString* buildVersion = [NSString stringWithFormat:@"%@ %@",
                                     [XULAppInfo platformVersion],
                                     [XULAppInfo appBuildID]];
  NSDictionary* options = [NSDictionary dictionaryWithObject:buildVersion
                                                      forKey:@"Version"];
  [NSApp orderFrontStandardAboutPanelWithOptions:options];
}

- (IBAction)feedbackLink:(id)aSender
{
  NSString* pageToLoad = NSLocalizedStringFromTable(@"FeedbackPage", @"WebsiteDefaults", nil);
  if (![pageToLoad isEqualToString:@"FeedbackPage"])
    [self loadApplicationPage:pageToLoad];
}

- (IBAction)checkForUpdates:(id)sender
{
  // MainController is the target of the "Check for Updates..." menu item
  // instead of SUUpdater solely to allow MainController to participate in
  // NSMenuValidation for the menu item.
  [mAutoUpdater checkForUpdates:sender];
}

- (IBAction)displayPreferencesWindow:(id)sender
{
  [[MVPreferencesController sharedInstance] showPreferences:nil];
}

//
// -resetBrowser:
//
// Here we need to:
// - warn user about what is going to happen
// - if its OK...
// - close all open windows, delete cache, history, cookies, site permissions,
//    downloads, saved names and passwords, and clear Top 10 group in bookmarks
//
- (IBAction)resetBrowser:(id)sender
{
  NSAlert* resetBrowserAlert = [[[NSAlert alloc] init] autorelease];
  [resetBrowserAlert setMessageText:NSLocalizedString(@"Reset Camino Title", nil)];
  [resetBrowserAlert setInformativeText:NSLocalizedString(@"Reset Warning Message", nil)];
  [resetBrowserAlert addButtonWithTitle:NSLocalizedString(@"Reset Camino", nil)];
  NSButton* dontResetButton = [resetBrowserAlert addButtonWithTitle:NSLocalizedString(@"DontResetButtonText", nil)];
  [dontResetButton setKeyEquivalent:@"\e"]; // escape

  [resetBrowserAlert setAlertStyle:NSCriticalAlertStyle];

  [NSMenu cancelAllTracking];

  if ([resetBrowserAlert runModal] == NSAlertFirstButtonReturn) {
    // close all windows
    NSArray* openWindows = [[NSApp orderedWindows] copy];
    NSEnumerator* windowEnum = [openWindows objectEnumerator];
    NSWindow* curWindow;
    while ((curWindow = [windowEnum nextObject])) {
      // we don't want the "you are closing a window with multiple tabs" warning to show up.
      if ([[curWindow windowController] isMemberOfClass:[BrowserWindowController class]])
        [(BrowserWindowController*)[curWindow windowController] setWindowClosesQuietly:YES];

      if ([curWindow isVisible] || [curWindow isMiniaturized])
        [curWindow performClose:self];
    }
    [openWindows release];

    // clear the saved session in case we crash
    [[SessionManager sharedInstance] clearSavedState];

    // remove cache
    nsCOMPtr<nsICacheService> cacheServ (do_GetService("@mozilla.org/network/cache-service;1"));
    if (cacheServ)
      cacheServ->EvictEntries(nsICache::STORE_ANYWHERE);

    // remove cookies
    nsCOMPtr<nsICookieManager> cm(do_GetService(NS_COOKIEMANAGER_CONTRACTID));
    nsICookieManager* mCookieManager = cm.get();
    if (mCookieManager)
      mCookieManager->RemoveAll();

    // remove site permissions
    [[CHPermissionManager permissionManager] removeAllPermissions];

    // remove history
    nsCOMPtr<nsIBrowserHistory> hist (do_GetService("@mozilla.org/browser/global-history;2"));
    if (hist)
      hist->RemoveAllPages();

    // remove downloads
    [[ProgressDlgController sharedDownloadController] clearAllDownloads];

    // remove saved names and passwords
    [[KeychainService instance] removeAllUsernamesAndPasswords];

    // re-set all bookmarks visit counts to zero
    [[BookmarkManager sharedBookmarkManager] clearAllVisits];

    // open a new window
    [self newWindow:self];
  }
}

//
// -emptyCache:
//
// Puts up a modal panel and if the user gives the go-ahead, emtpies the disk and memory
// caches. We keep this separate from |-resetBrowser:| so the user can just clear the cache
// and not have to delete everything (such as their keychain passwords).
//
- (IBAction)emptyCache:(id)sender
{
  NSAlert* emptyCacheAlert = [[[NSAlert alloc] init] autorelease];
  [emptyCacheAlert setMessageText:NSLocalizedString(@"EmptyCacheTitle", nil)];
  [emptyCacheAlert setInformativeText:NSLocalizedString(@"EmptyCacheMessage", nil)];
  [emptyCacheAlert addButtonWithTitle:NSLocalizedString(@"EmptyCacheButtonText", nil)];
  NSButton* dontEmptyButton = [emptyCacheAlert addButtonWithTitle:NSLocalizedString(@"DontEmptyButtonText", nil)];
  [dontEmptyButton setKeyEquivalent:@"\e"]; // escape

  [emptyCacheAlert setAlertStyle:NSCriticalAlertStyle];

  [NSMenu cancelAllTracking];

  if ([emptyCacheAlert runModal] == NSAlertFirstButtonReturn) {
    // remove cache
    nsCOMPtr<nsICacheService> cacheServ (do_GetService("@mozilla.org/network/cache-service;1"));
    if (cacheServ)
      cacheServ->EvictEntries(nsICache::STORE_ANYWHERE);
  }
}

#pragma mark -
#pragma mark File Menu

- (IBAction)newWindow:(id)aSender
{
  // If we have a key window, have it autosave its dimensions before
  // we open a new window.  That ensures the size ends up matching.
  NSWindow* curMainWindow = [mApplication mainWindow];
  if (curMainWindow && [[curMainWindow windowController] respondsToSelector:@selector(autosaveWindowFrame)])
    [[curMainWindow windowController] autosaveWindowFrame];

  // Now open the new window.
  NSString* homePage = mStartURL ? mStartURL : [[PreferenceManager sharedInstance] homePageUsingStartPage:YES];
  BrowserWindowController* controller = [self openBrowserWindowWithURL:homePage andReferrer:nil behind:nil allowPopups:NO];

  if (!homePage || [homePage isBlankURL])
    [controller focusURLBar];
  else
    [[[controller browserWrapper] browserView] setActive:YES];

  // Only load the command-line specified URL for the first window we open
  if (mStartURL) {
    [mStartURL release];
    mStartURL = nil;
  }
}

- (IBAction)newTab:(id)aSender
{
  BrowserWindowController* browserController = [self mainWindowBrowserController];
  if (browserController)
    [browserController newTab:aSender];
  else {
    // follow the pref about what to load in a new tab (even though we're making a new window)
    int newTabPage = [[PreferenceManager sharedInstance] getIntPref:kGeckoPrefNewTabStartPage withSuccess:NULL];
    BOOL loadHomepage = (newTabPage == kStartPageHome);

    NSString* urlToLoad = @"about:blank";
    if (loadHomepage)
      urlToLoad = [[PreferenceManager sharedInstance] homePageUsingStartPage:NO];

    [self openBrowserWindowWithURL:urlToLoad andReferrer:nil behind:nil allowPopups:NO];
  }
}

- (IBAction)openFile:(id)aSender
{
  NSOpenPanel* openPanel = [NSOpenPanel openPanel];
  [openPanel setCanChooseFiles:YES];
  [openPanel setCanChooseDirectories:NO];
  [openPanel setAllowsMultipleSelection:YES];
  NSArray* fileTypes = [NSArray arrayWithObjects:@"htm",@"html",@"shtml",@"xhtml",@"xml",
                                                 @"txt",@"text",
                                                 @"gif",@"jpg",@"jpeg",@"png",@"bmp",@"svg",@"svgz",
                                                 @"webloc",@"ftploc",@"url",
                                                 NSFileTypeForHFSTypeCode('ilht'),
                                                 NSFileTypeForHFSTypeCode('ilft'),
                                                 NSFileTypeForHFSTypeCode('LINK'),
                                                 NSFileTypeForHFSTypeCode('TEXT'),
                                                 nil];

  BrowserWindowController* browserController = [self mainWindowBrowserController];
  if (browserController) {
    [openPanel beginSheetForDirectory:nil
                                 file:nil
                                types:fileTypes
                       modalForWindow:[browserController window]
                        modalDelegate:self
                       didEndSelector:@selector(openPanelDidEnd:returnCode:contextInfo:)
                          contextInfo:browserController];
  }
  else {
    [NSMenu cancelAllTracking];
    int result = [openPanel runModalForTypes:fileTypes];
    [self openPanelDidEnd:openPanel returnCode:result contextInfo:nil];
  }
}

- (void)openPanelDidEnd:(NSOpenPanel*)inOpenPanel returnCode:(int)inReturnCode contextInfo:(void*)inContextInfo
{
  if (inReturnCode != NSOKButton)
    return;

  BrowserWindowController* browserController = (BrowserWindowController*)inContextInfo;

  NSArray* urlArray = [inOpenPanel URLs];
  if ([urlArray count] == 0)
      return;

  NSMutableArray* urlStringsArray = [NSMutableArray arrayWithCapacity:[urlArray count]];

  // fix them up
  NSEnumerator* urlsEnum = [urlArray objectEnumerator];
  NSURL* curURL;
  while ((curURL = [urlsEnum nextObject])) {
    [[NSDocumentController sharedDocumentController] noteNewRecentDocumentURL:curURL];
    curURL = [NSURL decodeLocalFileURL:curURL];
    [urlStringsArray addObject:[curURL absoluteString]];
  }

  if (!browserController)
    [self openBrowserWindowWithURLs:urlStringsArray behind:nil allowPopups:YES];
  else
    [browserController openURLArray:urlStringsArray tabOpenPolicy:eReplaceFromCurrentTab allowPopups:YES];
}

- (IBAction)openLocation:(id)aSender
{
    NSWindow* browserWindow = [self frontmostBrowserWindow];
    if (!browserWindow) {
      [self openBrowserWindowWithURL:@"about:blank" andReferrer:nil behind:nil allowPopups:NO];
      browserWindow = [mApplication mainWindow];
    }
    else if (![browserWindow isMainWindow] || ![browserWindow isKeyWindow]) {
      [browserWindow makeKeyAndOrderFront:self];
    }

    [[browserWindow windowController] performAppropriateLocationAction];
}

- (IBAction)doSearch:(id)aSender
{
  NSWindow* browserWindow = [self frontmostBrowserWindow];

  if (browserWindow) {
    if (![browserWindow isMainWindow])
      [browserWindow makeKeyAndOrderFront:self];
  }
  else {
    [self newWindow:self];
    browserWindow = [self frontmostBrowserWindow];
  }

  [[browserWindow windowController] performAppropriateSearchAction];
}

//
// Closes all windows (including minimized windows), respecting the "warn before closing multiple tabs" pref
//
- (IBAction)closeAllWindows:(id)aSender
{
  BOOL doCloseWindows = YES;
  PreferenceManager* prefManager = [PreferenceManager sharedInstance];

  if ([prefManager getBooleanPref:kGeckoPrefWarnWhenClosingWindows withSuccess:NULL]) {
    NSString* closeAlertMsg = nil;
    NSString* closeAlertExpl = nil;

    NSArray* openBrowserWins = [self browserWindows];
    // We need different warnings depending on whether there's only a single window with multiple tabs,
    // or multiple windows open
    if ([openBrowserWins count] == 1) {
      BrowserWindowController* bwc = [self mainWindowBrowserController];
      unsigned int numTabs = [[bwc tabBrowser] numberOfTabViewItems];
      if (numTabs > 1) { // only show the warning if there are multiple tabs
        closeAlertMsg  = NSLocalizedString(@"CloseWindowWithMultipleTabsMsg", @"");
        closeAlertExpl = [NSString stringWithFormat:NSLocalizedString(@"CloseWindowWithMultipleTabsExplFormat", @""),
                            numTabs];
      }
    }
    else if ([openBrowserWins count] > 1) {
      closeAlertMsg  = NSLocalizedString(@"CloseMultipleWindowsMsg", @"");
      closeAlertExpl = [NSString stringWithFormat:NSLocalizedString(@"CloseMultipleWindowsExpl", @""),
                            [openBrowserWins count]];
    }

    // make the warning dialog
    if (closeAlertMsg) {
      [NSApp activateIgnoringOtherApps:YES];
      nsAlertController* controller = CHBrowserService::GetAlertController();
      BOOL dontShowAgain = NO;

      @try {
        doCloseWindows = [controller confirmCheckEx:nil
                                              title:closeAlertMsg
                                               text:closeAlertExpl
                                            button1:NSLocalizedString(@"CloseWindowsButtonText", @"")
                                            button2:NSLocalizedString(@"DontCloseButtonText", @"")
                                            button3:nil
                                           checkMsg:NSLocalizedString(@"DontShowWarningAgainCheckboxLabel", @"")
                                         checkValue:&dontShowAgain];
      }
      @catch (id exception) {
      }

      if (dontShowAgain)
        [prefManager setPref:kGeckoPrefWarnWhenClosingWindows toBoolean:NO];
    }
  }

  // Actually close the windows
  if (doCloseWindows) {
    NSArray* windows = [NSApp windows];
    NSEnumerator* windowEnum = [windows objectEnumerator];
    NSWindow* curWindow;
    while ((curWindow = [windowEnum nextObject]))
      [curWindow close];
  }
}

- (IBAction)closeCurrentTab:(id)aSender
{
  [[self mainWindowBrowserController] closeCurrentTab:aSender];
}

- (IBAction)savePage:(id)aSender
{
  [[self mainWindowBrowserController] saveDocument:NO filterView:[self savePanelView]];
}

- (IBAction)sendURL:(id)aSender
{
  [[self mainWindowBrowserController] sendURL:aSender];
}
- (IBAction)importBookmarks:(id)aSender
{
  [[BookmarkManager sharedBookmarkManager] startImportBookmarks];
}

- (IBAction)exportBookmarks:(id)aSender
{
  NSSavePanel* savePanel = [NSSavePanel savePanel];
  [savePanel setPrompt:NSLocalizedString(@"Export", @"Export")];
  [savePanel setRequiredFileType:@"html"];
  [savePanel setCanSelectHiddenExtension:YES];

  // get an accessory view for HTML or Safari .plist output
  if (!mExportPanelView)
    [NSBundle loadNibNamed:@"AccessoryViews" owner:self];
  NSPopUpButton* button = [mExportPanelView viewWithTag:1001];
  [[button itemAtIndex:0] setRepresentedObject:savePanel];
  [[button itemAtIndex:1] setRepresentedObject:savePanel];
  [savePanel setAccessoryView:mExportPanelView];

  // start the save panel
  [NSMenu cancelAllTracking];
  int saveResult = [savePanel runModalForDirectory:nil file:NSLocalizedString(@"ExportedBookmarkFile", @"Exported Bookmarks")];
  int selectedButton = [button indexOfSelectedItem];
  if (saveResult != NSFileHandlingPanelOKButton)
    return;
  if (0 == selectedButton)
    [[BookmarkManager sharedBookmarkManager] writeHTMLFile:[savePanel filename]];
  else
    [[BookmarkManager sharedBookmarkManager] writeSafariFile:[savePanel filename]];
}

- (IBAction)pageSetup:(id)aSender
{
  [[self mainWindowBrowserController] pageSetup:aSender];
}

- (IBAction)printDocument:(id)aSender
{
  [[self mainWindowBrowserController] printDocument:aSender];
}

- (IBAction)toggleOfflineMode:(id)aSender
{
  nsCOMPtr<nsIIOService> ioService(do_GetService(ioServiceContractID));
  if (!ioService)
    return;
  PRBool offline = PR_FALSE;
  ioService->GetOffline(&offline);
  ioService->SetOffline(!offline);
  mOffline = !offline;

  // Update the menu item text.
  // Set the menu item's text to "Go Online" if we're currently
  // offline.
/*
  if (mOffline)
    [mOfflineMenuItem setTitle:@"Go Online"];
  else
    [mOfflineMenuItem setTitle:@"Work Offline"];
*/

  // Indicate that we are working offline.
  [[NSNotificationCenter defaultCenter] postNotificationName:@"offlineModeChanged" object:nil];
}

#pragma mark -
#pragma mark Edit Menu

// Nothing specific, everything is now handled by the BWC. 

#pragma mark -
#pragma mark View Menu

- (IBAction)toggleBookmarksToolbar:(id)aSender
{
  BrowserWindowController* browserController = [self mainWindowBrowserController];
  if (!browserController)
    return;

  BOOL showToolbar = ![[browserController bookmarkToolbar] isVisible];
  [[browserController bookmarkToolbar] setVisible:showToolbar];

  // save prefs here
  NSUserDefaults* defaults = [NSUserDefaults standardUserDefaults];
  [defaults setInteger:((showToolbar) ? 0 : 1) forKey:USER_DEFAULTS_HIDE_PERS_TOOLBAR_KEY];
}

- (IBAction)stop:(id)aSender
{
  [[self mainWindowBrowserController] stop:aSender];
}

- (IBAction)reload:(id)aSender
{
  [[self mainWindowBrowserController] reload:aSender];
}

- (IBAction)reloadAllTabs:(id)aSender
{
  [[self mainWindowBrowserController] reloadAllTabs:aSender];
}

- (IBAction)makeTextBigger:(id)aSender
{
  [[self mainWindowBrowserController] makeTextBigger:aSender];
}

- (IBAction)makeTextDefaultSize:(id)aSender
{
  [[self mainWindowBrowserController] makeTextDefaultSize:aSender];
}

- (IBAction)makeTextSmaller:(id)aSender
{
  [[self mainWindowBrowserController] makeTextSmaller:aSender];
}

- (IBAction)viewPageSource:(id)aSender
{
  [[self mainWindowBrowserController] viewPageSource:aSender];  // top-level page, not focussed frame
}

- (IBAction)reloadWithCharset:(id)aSender
{
  // Figure out which charset to tell gecko to load based on the sender's tag. There
  // is guaranteed to only be 1 key that matches this tag, so we just take the first one.
  BrowserWindowController* browserController = [self mainWindowBrowserController];
  if (browserController) {
    NSArray* charsetList = [mCharsets allKeysForObject:[NSNumber numberWithInt:[aSender tag]]];
    NS_ASSERTION([charsetList count] == 1, "OOPS, multiply defined charsets in plist");
    [browserController reloadWithNewCharset:[charsetList objectAtIndex:0]];
  }
}

- (IBAction)toggleAutoCharsetDetection:(id)aSender
{
  NSString* detectorValue = [[PreferenceManager sharedInstance] getStringPref:kGeckoPrefCharsetDetector withSuccess:NULL];
  BOOL universalChardetOn = [detectorValue isEqualToString:kCharsetDetectorUniversal];
  NSString* newValue = universalChardetOn ? kCharsetDetectorNone : kCharsetDetectorUniversal;
  [[PreferenceManager sharedInstance] setPref:kGeckoPrefCharsetDetector toString:newValue];
  // and reload
  [self reload:nil];
}

#pragma mark -
#pragma mark History Menu

- (IBAction)goHome:(id)aSender
{
  NSWindow* browserWindow = [self frontmostBrowserWindow];
  if (browserWindow) {
    if (![browserWindow isMainWindow])
      [browserWindow makeKeyAndOrderFront:self];

    [[browserWindow windowController] home:aSender];
  }
  else {
    // explicity open the home page to work around "load home page in new window" pref
    [self openBrowserWindowWithURL:(mStartURL ? mStartURL : [[PreferenceManager sharedInstance] homePageUsingStartPage:NO])
                       andReferrer:nil
                            behind:nil
                       allowPopups:NO];
  }
}

- (IBAction)goBack:(id)aSender
{
  [[self mainWindowBrowserController] back:aSender];
}

- (IBAction)goForward:(id)aSender
{
  [[self mainWindowBrowserController] forward:aSender];
}

//
// -showHistory:
//
// show the history in the bookmark manager. Creates a new window if
// one isn't already there. history isn't a toggle, hence the name.
//
- (IBAction)showHistory:(id)aSender
{
  NSWindow* browserWindow = [self frontmostBrowserWindow];
  if (browserWindow) {
    if (![browserWindow isMainWindow])
      [browserWindow makeKeyAndOrderFront:self];
  }
  else {
    [self newWindow:self];
    browserWindow = [mApplication mainWindow];
  }

  [[browserWindow windowController] manageHistory:aSender];
}

//
// -clearHistory:
//
// clear the global history, after showing a warning
//
- (IBAction)clearHistory:(id)aSender
{
  NSAlert* clearHistoryAlert = [[[NSAlert alloc] init] autorelease];
  [clearHistoryAlert setMessageText:NSLocalizedString(@"ClearHistoryTitle", nil)];
  [clearHistoryAlert setInformativeText:NSLocalizedString(@"ClearHistoryMessage", nil)];
  [clearHistoryAlert addButtonWithTitle:NSLocalizedString(@"ClearHistoryButtonText", nil)];
  NSButton* dontClearButton = [clearHistoryAlert addButtonWithTitle:NSLocalizedString(@"DontClearButtonText", nil)];
  [dontClearButton setKeyEquivalent:@"\e"]; // escape

  [clearHistoryAlert setAlertStyle:NSCriticalAlertStyle];

  [NSMenu cancelAllTracking];

  if ([clearHistoryAlert runModal] == NSAlertFirstButtonReturn) {
    // clear history
    nsCOMPtr<nsIBrowserHistory> hist = do_GetService("@mozilla.org/browser/global-history;2");
    if (hist)
      hist->RemoveAllPages();
  }
}

#pragma mark -
#pragma mark Bookmarks Menu

//
// manageBookmarks:
//
// toggle the bookmark manager (creating a new window if needed)
//
- (IBAction)manageBookmarks:(id)aSender
{
  NSWindow* browserWindow = [self frontmostBrowserWindow];
  if (browserWindow) {
    if (![browserWindow isMainWindow])
      [browserWindow makeKeyAndOrderFront:self];
  }
  else {
    [self newWindow:self];
    browserWindow = [mApplication mainWindow];
  }

  [[browserWindow windowController] manageBookmarks:aSender];
}

- (IBAction)openMenuBookmark:(id)aSender
{
  BookmarkItem*  item = [aSender representedObject];
  EBookmarkOpenBehavior openBehavior = eBookmarkOpenBehavior_Preferred;
  BOOL reverseBackgroundPref = NO;

  if ([aSender isAlternate]) {
    reverseBackgroundPref = ([aSender keyEquivalentModifierMask] & NSShiftKeyMask) != 0;
    if ([aSender keyEquivalentModifierMask] & NSCommandKeyMask)
      openBehavior = eBookmarkOpenBehavior_NewPreferred;
  }
  // safeguard for bookmark menus that don't have alternates yet
  else if ([[NSApp currentEvent] modifierFlags] & NSCommandKeyMask)
    openBehavior = eBookmarkOpenBehavior_NewPreferred;

  [self loadBookmark:item withBWC:[self mainWindowBrowserController] openBehavior:openBehavior reverseBgToggle:reverseBackgroundPref];
}

- (IBAction)aboutServers:(id)aSender
{
  NSString* pageToLoad = NSLocalizedStringFromTable(@"RendezvousPage", @"WebsiteDefaults", nil);
  if (![pageToLoad isEqualToString:@"RendezvousPage"])
    [self loadApplicationPage:pageToLoad];
}

- (IBAction)connectToServer:(id)aSender
{
  [[NetworkServices sharedNetworkServices] attemptResolveService:[aSender tag] forSender:self];
}

#pragma mark -
#pragma mark Window Menu

- (IBAction)zoomAll:(id)aSender
{
  NSArray* windows = [NSApp windows];
  NSEnumerator* windowEnum = [windows objectEnumerator];
  NSWindow* curWindow;

  while ((curWindow = [windowEnum nextObject]))
    if ([[curWindow windowController] isMemberOfClass:[BrowserWindowController class]])
      [curWindow zoom:aSender];
}

- (IBAction)previousTab:(id)aSender
{
  [[self mainWindowBrowserController] previousTab:aSender];
}

- (IBAction)nextTab:(id)aSender
{
  [[self mainWindowBrowserController] nextTab:aSender];
}

- (IBAction)downloadsWindow:(id)aSender
{
  ProgressDlgController* dlgController = [ProgressDlgController sharedDownloadController];
  // If the frontmost window is the downloads window, close it.  Otherwise open or bring downloads window to front.
  if ([[dlgController window] isMainWindow])
    [[dlgController window] performClose:self];
  else
    [dlgController showWindow:aSender];
}

#pragma mark -
#pragma mark Help Menu

- (IBAction)supportLink:(id)aSender
{
  NSString* pageToLoad = NSLocalizedStringFromTable(@"SupportPage", @"WebsiteDefaults", nil);
  if (![pageToLoad isEqualToString:@"SupportPage"])
    [self loadApplicationPage:pageToLoad];
}

- (IBAction)keyboardShortcutsLink:(id)aSender
{
  NSString* pageToLoad = NSLocalizedStringFromTable(@"KeyboardShortcutsPage", @"WebsiteDefaults", nil);
  if (![pageToLoad isEqualToString:@"KeyboardShortcutsPage"])
    [self loadApplicationPage:pageToLoad];
}

- (IBAction)infoLink:(id)aSender
{
  NSString* pageToLoad = NSLocalizedStringFromTable(@"InfoPage", @"WebsiteDefaults", nil);
  if (![pageToLoad isEqualToString:@"InfoPage"])
    [self loadApplicationPage:pageToLoad];
}

- (IBAction)aboutPlugins:(id)aSender
{
  [self loadApplicationPage:@"about:plugins"];
}

#pragma mark -
#pragma mark Menu Maintenance

- (BOOL)validateMenuItem:(NSMenuItem*)aMenuItem
{
  BrowserWindowController* browserController = [self mainWindowBrowserController];
  SEL action = [aMenuItem action];

  // NSLog(@"MainController validateMenuItem for %@ (%s)", [aMenuItem title], action);

  // disable window-related menu items if a sheet is up
  if (browserController && [[browserController window] attachedSheet] &&
      (action == @selector(openFile:) ||
       action == @selector(openLocation:) ||
       action == @selector(savePage:) ||
       action == @selector(newTab:) ||
       action == @selector(doSearch:) ||
       action == @selector(toggleBookmarksToolbar:) ||
       action == @selector(goHome:) ||
       action == @selector(showHistory:) ||
       action == @selector(manageBookmarks:) ||
       action == @selector(openMenuBookmark:) ||
       action == @selector(connectToServer:)))
  {
    return NO;
  }

  // check what the state of the personal toolbar should be, but only if there is a browser
  // window open. Popup windows that have the personal toolbar removed should always gray
  // out this menu.
  if (action == @selector(toggleBookmarksToolbar:)) {
    if (browserController) {
      BookmarkToolbar* bookmarkToolbar = [browserController bookmarkToolbar];
      if (bookmarkToolbar) {
        if ([bookmarkToolbar isVisible])
          [mBookmarksToolbarMenuItem setTitle:NSLocalizedString(@"Hide Bookmarks Toolbar", nil)];
        else
          [mBookmarksToolbarMenuItem setTitle:NSLocalizedString(@"Show Bookmarks Toolbar", nil)];
        return YES;
      }
    }
    return NO;
  }

  if (action == @selector(manageBookmarks:)) {
    BOOL showingBookmarks = (browserController && [browserController bookmarkManagerIsVisible]);
    NSString* showBMLabel = showingBookmarks ? NSLocalizedString(@"HideBookmarkManager", nil)
                                             : NSLocalizedString(@"ShowBookmarkManager", nil);
    [aMenuItem setTitle:showBMLabel];
    return showingBookmarks ? [browserController canHideBookmarks] : YES;
  }

  // key alternates
  if (action == @selector(openMenuBookmark:) && [aMenuItem isAlternate]) {
    if ([[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefOpenTabsForMiddleClick withSuccess:NULL])
      [aMenuItem setTitle:NSLocalizedString(@"Open in New Tabs", nil)];
    else
      [aMenuItem setTitle:NSLocalizedString(@"Open in Tabs in New Window", nil)];
  }

  // only enable newTab if there is a browser window frontmost, or if there is no window
  // (i.e., disable it for non-browser windows and popups).
  if (action == @selector(newTab:))
    return (((browserController && ([NSApp mainWindow] == [self frontmostBrowserWindow]))) ||
            ![NSApp mainWindow]);

  // disable openFile if the frontmost window is a popup or view-source window
  if (action == @selector(openFile:)) {
    if (browserController)
      return ([NSApp mainWindow] == [self frontmostBrowserWindow]);
    else
      return YES;
  }

  // disable non-BWC items that aren't relevant if there's no main browser window open
  // or the bookmark/history manager is open
  if (action == @selector(savePage:))
    return (browserController && ![browserController bookmarkManagerIsVisible]);

  // BrowserWindowController decides about actions that are just sent on to
  // the front window's BrowserWindowController. This works because the selectors
  // of these actions are the same here and in BrowserWindowController.

  // goBack: and goForward: don't match; for now we translate them, but eventually
  // BrowserWindowController's methods should be renamed.
  if (action == @selector(goBack:))
    action = @selector(back:);
  if (action == @selector(goForward:))
    action = @selector(forward:);

  if (action == @selector(stop:) ||
      action == @selector(back:) ||
      action == @selector(forward:) ||
      action == @selector(reload:) ||
      action == @selector(reloadAllTabs:) ||
      action == @selector(nextTab:) ||
      action == @selector(previousTab:) || 
      action == @selector(closeCurrentTab:) ||
      action == @selector(makeTextBigger:) ||
      action == @selector(makeTextSmaller:) ||
      action == @selector(makeTextDefaultSize:) ||
      action == @selector(viewPageSource:) ||
      action == @selector(sendURL:) ||
      action == @selector(printDocument:) ||
      action == @selector(pageSetup:))
  {
    if (browserController && [[browserController window] attachedSheet])
      return NO;
    return (browserController && [browserController validateActionBySelector:action]);
  }

  if (action == @selector(checkForUpdates:) &&
      [[[NSUserDefaults standardUserDefaults] stringForKey:SUFeedURLKey] length] == 0) {
    // Disable update checking if there's no feed to check.
    [aMenuItem setToolTip:NSLocalizedString(@"AutoUpdateDisabledToolTip", @"")];
    return NO;
  }

  // default return
  return YES;
}

- (void)menuWillDisplay:(NSNotification*)inNotification
{
  if ([mBookmarksMenu isTargetOfMenuDisplayNotification:[inNotification object]])
    [self adjustBookmarkMenuItems];
  else if ([mTextEncodingsMenu isTargetOfMenuDisplayNotification:[inNotification object]])
    [self adjustTextEncodingMenu];
}

- (void)adjustTextEncodingMenu
{
  BrowserWindowController* browserController = [self mainWindowBrowserController];
  if (browserController && ![browserController bookmarkManagerIsVisible] &&
      ![[browserController window] attachedSheet] &&
      [[[browserController browserWrapper] browserView] isTextBasedContent])
  {
    // enable all items
    [mTextEncodingsMenu setAllItemsEnabled:YES startingWithItemAtIndex:0 includingSubmenus:YES];

    NSString* charset = [browserController currentCharset];
#if DEBUG_CHARSET
    NSLog(@"charset is %@", charset);
#endif
    NSNumber* tag = [mCharsets objectForKey:[charset lowercaseString]];
    [mTextEncodingsMenu checkItemWithTag:[tag intValue] uncheckingOtherItems:YES];
  }
  else {
    [mTextEncodingsMenu setAllItemsEnabled:NO startingWithItemAtIndex:0 includingSubmenus:YES];
    // always enable the autodetect item
    [[mTextEncodingsMenu itemWithTag:kEncodingMenuAutodetectItemTag] setEnabled:YES];
  }

  // update the state of the autodetect item
  NSString* detectorValue = [[PreferenceManager sharedInstance] getStringPref:kGeckoPrefCharsetDetector withSuccess:NULL];
  BOOL universalChardetOn = [detectorValue isEqualToString:kCharsetDetectorUniversal];
  [[mTextEncodingsMenu itemWithTag:kEncodingMenuAutodetectItemTag] setState:(universalChardetOn ? NSOnState : NSOffState)];
}

- (void)adjustBookmarkMenuItems
{
  BOOL enableItems = [self bookmarksItemsEnabled];

  int firstBookmarkItem = [mBookmarksMenu indexOfItemWithTag:kBookmarksDividerTag] + 1;
  [mBookmarksMenu setAllItemsEnabled:enableItems startingWithItemAtIndex:firstBookmarkItem includingSubmenus:YES];
}

- (void)delayedAdjustBookmarksMenuItemsEnabling
{
  // we do this after a delay to ensure that window layer state has been set by the time
  // we do the enabling.
  if (!mBookmarksMenuUpdatePending) {
    [self performSelector:@selector(doBookmarksMenuEnabling) withObject:nil afterDelay:0];
    mBookmarksMenuUpdatePending = YES;
  }
}

//
// -doBookmarksMenuEnabling
//
// We've turned off auto-enabling for the bookmarks menu because of the unknown
// number of bookmarks in the list so we have to manage it manually. This routine
// should be evoked through |delayedAdjustBookmarksMenuItemsEnabling| whenever a
// window goes away, becomes main or is no longer main, and any time the number of
// tabs changes, the active tab changes, or any page is loaded.
//
- (void)doBookmarksMenuEnabling
{
  // update our stand-in menu by hand (because it doesn't get autoupdated)
  [mBookmarksHelperMenu update];

  // For the add bookmark menu items, target + action can't be used as a unique identifier, so use title instead
  // This is safe, since we assume that we're keeping the "real" bookmarks menu and our stand-in synchronized
  [mAddBookmarkMenuItem              takeStateFromItem:[mBookmarksHelperMenu itemWithTitle:[mAddBookmarkMenuItem title]]];
  [mAddBookmarkWithoutPromptMenuItem takeStateFromItem:[mBookmarksHelperMenu itemWithTitle:[mAddBookmarkWithoutPromptMenuItem title]]];
  [mAddTabGroupMenuItem              takeStateFromItem:[mBookmarksHelperMenu itemWithTitle:[mAddTabGroupMenuItem title]]];
  [mAddTabGroupWithoutPromptMenuItem takeStateFromItem:[mBookmarksHelperMenu itemWithTitle:[mAddTabGroupWithoutPromptMenuItem title]]];

  [mCreateBookmarksFolderMenuItem    takeStateFromItem:[mBookmarksHelperMenu itemWithTarget:[mCreateBookmarksFolderMenuItem target]
                                                                                  andAction:[mCreateBookmarksFolderMenuItem action]]];
  [mCreateBookmarksSeparatorMenuItem takeStateFromItem:[mBookmarksHelperMenu itemWithTarget:[mCreateBookmarksSeparatorMenuItem target]
                                                                                  andAction:[mCreateBookmarksSeparatorMenuItem action]]];
  [mShowAllBookmarksMenuItem         takeStateFromItem:[mBookmarksHelperMenu itemWithTarget:[mShowAllBookmarksMenuItem target]
                                                                                  andAction:[mShowAllBookmarksMenuItem action]]];

  // We enable bookmark items themselves from the carbon event handler that fires before the menu is shown.
  mBookmarksMenuUpdatePending = NO;
}

- (BOOL)bookmarksItemsEnabled
{
  // since this menu is not in the menu bar, we have to update it by hand
  [mBookmarksHelperMenu update];
  return [[mBookmarksHelperMenu itemWithTarget:self andAction:@selector(openMenuBookmark:)] isEnabled];
}

- (void)adjustCloseWindowMenuItemKeyEquivalent:(BOOL)inHaveTabs
{
  // capitalization of the key equivalent affects whether the shift modifer is used.
  [mCloseWindowMenuItem setKeyEquivalent:(inHaveTabs ? @"W" : @"w")];
}

- (void)adjustCloseTabMenuItemKeyEquivalent:(BOOL)inHaveTabs
{
  if (inHaveTabs) {
    [mCloseTabMenuItem setKeyEquivalent:@"w"];
    [mCloseTabMenuItem setKeyEquivalentModifierMask:NSCommandKeyMask];
  }
  else {
    [mCloseTabMenuItem setKeyEquivalent:@""];
    [mCloseTabMenuItem setKeyEquivalentModifierMask:0];
  }
}

- (void)delayedFixCloseMenuItemKeyEquivalents
{
  // we do this after a delay to ensure that window layer state has been set by the time
  // we do the enabling.
  if (!mFileMenuUpdatePending) {
    [self performSelector:@selector(fixCloseMenuItemKeyEquivalents) withObject:nil afterDelay:0];
    mFileMenuUpdatePending = YES;
  }
}

// see if we have a window with tabs open, and adjust the key equivalents for
// Close Tab/Close Window accordingly
- (void)fixCloseMenuItemKeyEquivalents
{
  BrowserWindowController* browserController = [self keyWindowBrowserController];
  BOOL windowWithMultipleTabs = (browserController && [[browserController tabBrowser] numberOfTabViewItems] > 1);
  [self adjustCloseWindowMenuItemKeyEquivalent:windowWithMultipleTabs];
  [self adjustCloseTabMenuItemKeyEquivalent:windowWithMultipleTabs];
  mFileMenuUpdatePending = NO;
}

- (NSMenu*)applicationDockMenu:(NSApplication*)sender
{
  // the dock menu doesn't get the usual show notifications, so we rebuild it explicitly here
  [mDockMenu rebuildMenuIncludingSubmenus:YES];
  return mDockMenu;
}

- (void)dockMenuBookmarkFolderChanged:(NSNotification*)inNotification
{
  [self updateDockMenuBookmarkFolder];
}

- (void)updateDockMenuBookmarkFolder
{
  [mDockMenu setBookmarkFolder:[[BookmarkManager sharedBookmarkManager] dockMenuFolder]];
}

static int SortByProtocolAndName(NSDictionary* item1, NSDictionary* item2, void* context)
{
  NSComparisonResult protocolCompare = [[item1 objectForKey:@"name"] compare:[item2 objectForKey:@"name"] options:NSCaseInsensitiveSearch];
  if (protocolCompare != NSOrderedSame)
    return protocolCompare;

  return [[item1 objectForKey:@"protocol"] compare:[item2 objectForKey:@"protocol"] options:NSCaseInsensitiveSearch];
}

//
// NetworkServicesClient implementation
// XXX maybe just use the bookmarks smart folder for this menu?
//
- (void)availableServicesChanged:(NSNotification*)note
{
  // rebuild the submenu, leaving the first item
  while ([mServersSubmenu numberOfItems] > 1)
    [mServersSubmenu removeItemAtIndex:[mServersSubmenu numberOfItems] - 1];

  NetworkServices* netserv = [note object];

  NSEnumerator* keysEnumerator = [netserv serviceEnumerator];
  // build an array of dictionaries, so we can sort it

  NSMutableArray* servicesArray = [[NSMutableArray alloc] initWithCapacity:10];

  id key;
  while ((key = [keysEnumerator nextObject])) {
    NSDictionary* serviceDict = [NSDictionary dictionaryWithObjectsAndKeys:
      key, @"id",
      [netserv serviceName:[key intValue]], @"name",
      [netserv serviceProtocol:[key intValue]], @"protocol", nil];

    [servicesArray addObject:serviceDict];
  }

  if ([servicesArray count] == 0) {
    // add a separator
    [mServersSubmenu addItem:[NSMenuItem separatorItem]];

    NSMenuItem* newItem = [mServersSubmenu addItemWithTitle:NSLocalizedString(@"NoServicesFound", @"") action:nil keyEquivalent:@""];
    [newItem setTag:-1];
    [newItem setTarget:self];
  }
  else {
    // add a separator
    [mServersSubmenu addItem:[NSMenuItem separatorItem]];

    // sort on protocol, then name
    [servicesArray sortUsingFunction:SortByProtocolAndName context:NULL];

    unsigned count = [servicesArray count];
    for (unsigned int i = 0; i < count; i++) {
      NSDictionary* serviceDict = [servicesArray objectAtIndex:i];
      NSString* itemName = [[serviceDict objectForKey:@"name"] stringByAppendingString:NSLocalizedString([serviceDict objectForKey:@"protocol"], @"")];

      id newItem = [mServersSubmenu addItemWithTitle:itemName action:@selector(connectToServer:) keyEquivalent:@""];
      [newItem setTag:[[serviceDict objectForKey:@"id"] intValue]];
      [newItem setTarget:self];
    }
  }
  // when you alloc, you've got to release . . .
  [servicesArray release];
}

- (void)serviceResolved:(NSNotification*)note
{
  NSDictionary* dict = [note userInfo];
  if ([dict objectForKey:NetworkServicesClientKey] == self)
    [self showURL:[dict objectForKey:NetworkServicesResolvedURLKey]];
}

//
// handles resolution failure for everybody else
//
- (void)serviceResolutionFailed:(NSNotification*)note
{
  NSDictionary* dict = [note userInfo];
  NSString* serviceName = [dict objectForKey:NetworkServicesServiceKey];
  NSBeginAlertSheet(NSLocalizedString(@"ServiceResolutionFailedTitle", @""),
                    @"",               // default button
                    nil,               // cancel buttton
                    nil,               // other button
                    [NSApp mainWindow],                // window
                    nil,               // delegate
                    nil,               // end sel
                    nil,               // dismiss sel
                    NULL,              // context
                    [NSString stringWithFormat:NSLocalizedString(@"ServiceResolutionFailedMsgFormat", @""), serviceName]
                    );
}

#pragma mark -
#pragma mark Supplemental View Helpers

- (NSView*)savePanelView
{
  if (!mFilterView) {
    // note that this will cause our -awakeFromNib to get called again
    [NSBundle loadNibNamed:@"AccessoryViews" owner:self];
  }
  return mFilterView;
}

- (void)delayedUpdatePageInfo
{
  if (!mPageInfoUpdatePending) {
    [self performSelector:@selector(updatePageInfo) withObject:nil afterDelay:0];
    mPageInfoUpdatePending = YES;
  }
}

- (void)updatePageInfo
{
  BrowserWindowController* browserController = [self mainWindowBrowserController];
  [[PageInfoWindowController visiblePageInfoWindowController] updateFromBrowserView:[browserController activeBrowserView]];
  mPageInfoUpdatePending = NO;
}

- (IBAction)showCertificates:(id)aSender
{
  [[CertificatesWindowController sharedCertificatesWindowController] showWindow:nil];
}

- (void)showCertificatesNotification:(NSNotification*)inNotification
{
  [self showCertificates:nil];
}

// helper for exportBookmarks function
- (IBAction)setFileExtension:(id)aSender
{
  if ([[aSender title] isEqualToString:@"HTML"])
    [[aSender representedObject] setRequiredFileType:@"html"];
  else
    [[aSender representedObject] setRequiredFileType:@"plist"];
}

@end
