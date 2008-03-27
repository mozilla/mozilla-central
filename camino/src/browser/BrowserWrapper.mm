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

#import "NSView+Utils.h"

#import "PreferenceManager.h"
#import "BrowserWrapper.h"
#import "BrowserWindowController.h"
#import "BookmarksClient.h"
#import "SiteIconProvider.h"
#import "BrowserTabView.h"
#import "BrowserTabViewItem.h"
#import "ToolTip.h"
#import "FormFillController.h"
#import "PageProxyIcon.h"
#import "KeychainService.h"
#import "AutoCompleteTextField.h"
#import "RolloverImageButton.h"
#import "CHPermissionManager.h"
#import "XMLSearchPluginParser.h"
#import "FindBarController.h"
#import "CHGradient.h"

#include "CHBrowserService.h"
#include "ContentClickListener.h"

#include "nsCOMPtr.h"

#ifdef MOZILLA_1_8_BRANCH
#include "nsIArray.h"
#else
#include "nsIMutableArray.h"
#endif

#include "nsIArray.h"
#include "nsIURI.h"
#include "nsNetUtil.h"
#include "nsIIOService.h"
#include "nsIDocument.h"
#include "nsIDOMWindow.h"
#include "nsIWebBrowser.h"
#include "nsIWebNavigation.h"
#include "nsIWebBrowserSetup.h"
#include "nsIDOMDocument.h"
#include "nsIDOMHTMLDocument.h"
#include "nsPIDOMEventTarget.h"
#include "nsPIDOMWindow.h"
#include "nsIDOMEventTarget.h"
#include "nsIWebProgressListener.h"
#include "nsIBrowserDOMWindow.h"
#include "nsIScriptSecurityManager.h"

class nsIDOMPopupBlockedEvent;

// types of status bar messages, in order of priority for showing to the user
enum StatusPriority {
  eStatusLinkTarget    = 0, // link mouseover info
  eStatusProgress      = 1, // loading progress
  eStatusScript        = 2, // javascript window.status
  eStatusScriptDefault = 3, // javascript window.defaultStatus
};

@interface BrowserWrapper(Private)

- (void)ensureContentClickListeners;

- (void)setPendingActive:(BOOL)active;
- (void)registerNotificationListener;

- (void)clearStatusStrings;

- (void)setSiteIconImage:(NSImage*)inSiteIcon;
- (void)setSiteIconURI:(NSString*)inSiteIconURI;

- (void)updateSiteIconImage:(NSImage*)inSiteIcon withURI:(NSString *)inSiteIconURI loadError:(BOOL)inLoadError;

- (void)updateStatusString:(NSString*)statusString withPriority:(StatusPriority)priority;

- (void)setPendingURI:(NSString*)inURI;

- (NSString*)displayTitleForPageURL:(NSString*)inURL title:(NSString*)inTitle;

- (void)updatePluginsEnabledState;

- (void)checkForCustomViewOnLoad:(NSString*)inURL;

- (BOOL)popupsAreBlacklistedForURL:(NSString*)inURL;
- (void)showPopupsWhitelistingSource:(BOOL)shouldWhitelist;
- (void)addBlockedPopupViewAndDisplay;
- (void)removeBlockedPopupViewAndDisplay;

- (void)addFindBarViewAndDisplay;
- (void)removeFindBarViewAndDisplay;

@end

#pragma mark -

@implementation BrowserWrapper

- (id)initWithTab:(NSTabViewItem*)aTab inWindow:(NSWindow*)window
{
  if (([self initWithFrame:NSZeroRect inWindow:window]))
  {
    mTabItem = aTab;
  }
  return self;
}

//
// initWithFrame:  (designated initializer)
//
// Create a Gecko browser view and hook everything up to the UI
//
- (id)initWithFrame:(NSRect)frameRect inWindow:(NSWindow*)window
{
  if ((self = [super initWithFrame: frameRect]))
  {
    mWindow = window;

    // We retain the browser view so that we can rip it out for custom view support    
    mBrowserView = [[CHBrowserView alloc] initWithFrame:[self bounds] andWindow:window];
    [self addSubview:mBrowserView];

    [mBrowserView setContainer:self];
    [mBrowserView addListener:self];

    [[KeychainService instance] addListenerToView:mBrowserView];

    mIsBusy = NO;
    mListenersAttached = NO;
    mSecureState = nsIWebProgressListener::STATE_IS_INSECURE;
    mProgress = 0.0;
    mFeedList = nil;

    [self updatePluginsEnabledState];

    mToolTip = [[ToolTip alloc] init];

    mFormFillController = [[FormFillController alloc] init]; 
    [mFormFillController attachToBrowser:mBrowserView];

    mFindBarController = [[FindBarController alloc] initWithContent:self
                                                             finder:(id<Find>)mBrowserView];

    //[self setSiteIconImage:[NSImage imageNamed:@"globe_ico"]];
    //[self setSiteIconURI: [NSString string]];

    // prefill with a null value for each of the four types of status strings
    mStatusStrings = [[NSMutableArray alloc] initWithObjects:[NSNull null], [NSNull null],
                                                             [NSNull null], [NSNull null], nil];

    mDisplayTitle = [NSLocalizedString(@"UntitledPageTitle", nil) retain];
    
    mLoadingResources = [[NSMutableSet alloc] init];
    
    mDetectedSearchPlugins = [[NSMutableArray alloc] initWithCapacity:1];

    [self registerNotificationListener];
  }
  return self;
}

-(void)dealloc
{
#if DEBUG
  NSLog(@"The browser wrapper died.");
#endif

  [[NSNotificationCenter defaultCenter] removeObserver: self];
  
  [mSiteIconImage release];
  [mSiteIconURI release];
  [mStatusStrings release];
  [mLoadingResources release];

  [mToolTip release];
  [mDisplayTitle release];
  [mFormFillController release];
  [mPendingURI release];
  
  NS_IF_RELEASE(mBlockedPopups);
  
  [mFeedList release];
  [mDetectedSearchPlugins release];

  // Make sure this is gone before |mBrowserView|, which it has a weak ref to.
  [mFindBarView removeFromSuperviewWithoutNeedingDisplay];
  [mFindBarController release];

  [mBrowserView release];
  [mContentViewProviders release];

  // |mBlockedPopupView| has a retain count of 1 when it comes out of the nib,
  // we have to release it manually.
  [mBlockedPopupView release];
  
  [super dealloc];
}

- (BOOL)isFlipped
{
  return YES;
}

- (BOOL)browserShouldClose
{
  return [mBrowserView shouldUnload];
}

-(void)browserClosed
{
  // Break the cycle, but don't clear ourselves as the container 
  // before we call |destroyWebBrowser| or onUnload handlers won't be
  // able to create new windows. The container will get cleared
  // when the CHBrowserListener goes away as a result of the
  // |destroyWebBrowser| call. (bug 174416)
  [mBrowserView removeListener: self];
  [mBrowserView destroyWebBrowser];

  // We don't want site icon notifications when the window has gone away
  [[NSNotificationCenter defaultCenter] removeObserver:self name:SiteIconLoadNotificationName object:nil];
  // We're basically a zombie now. Clear fields which are in an undefined state.
  mDelegate = nil;
  mWindow = nil;
}

- (void)setUICreationDelegate:(id<BrowserUICreationDelegate>)delegate
{
  mCreateDelegate = delegate;
}

- (void)setDelegate:(id<BrowserUIDelegate>)delegate
{
  mDelegate = delegate;
}

- (id<BrowserUIDelegate>)delegate
{
  return mDelegate;
}

-(void)setTab: (NSTabViewItem*)tab
{
  mTabItem = tab;
}

-(NSTabViewItem*)tab
{
  return mTabItem;
}

-(NSString*)pendingURI
{
  return mPendingURI;
}

-(NSString*)currentURI
{
  return [mBrowserView currentURI];
}

- (void)setFrame:(NSRect)frameRect
{
  [self setFrame:frameRect resizingBrowserViewIfHidden:NO];
}

- (void)setFrame:(NSRect)frameRect resizingBrowserViewIfHidden:(BOOL)inResizeBrowser
{
  [super setFrame:frameRect];

  // Only resize our browser view if we are visible, unless the caller requests it.
  // If we're hidden, the frame will get reset when we get placed back into the
  // view hierarchy anyway. This enhancement keeps resizing in a window with
  // many tabs from being slow.
  // However, this requires us to do the resize on loadURI: below to make
  // sure that we maintain the scroll position in background tabs correctly.
  if ([self window] || inResizeBrowser) {
    NSRect bounds = [self bounds];
    NSRect browserFrame = bounds;
    if (mBlockedPopupView) {
      // First resize the width of blockedPopupView to match this view.
      // The blockedPopupView will, during its setFrame method, wrap information 
      // text if necessary and adjust its own height to enclose that text.
      // Then find out the actual (possibly adjusted) height of blockedPopupView 
      // and adjust the browser view frame accordingly.
      // Recall that we're flipped, so the origin is the top left.

      NSRect popupBlockFrame = [mBlockedPopupView frame];
      popupBlockFrame.origin = NSZeroPoint;
      popupBlockFrame.size.width = bounds.size.width;
      [mBlockedPopupView setFrame:popupBlockFrame];

      NSRect blockedPopupViewFrameAfterResized = [mBlockedPopupView frame];
      browserFrame.origin.y = blockedPopupViewFrameAfterResized.size.height;
      browserFrame.size.height -= blockedPopupViewFrameAfterResized.size.height;
    }
    if (mFindBarView) {
      NSRect findBarFrame;
      NSRect remainderRect;
      NSDivideRect(browserFrame, &findBarFrame, &remainderRect,
                   [mFindBarView frame].size.height, NSMaxYEdge);
      [mFindBarView setFrame:findBarFrame];

      browserFrame = remainderRect;
    }
    [mBrowserView setFrame:browserFrame];
  }
}

- (void)reapplyFrame
{
  [self setFrame:[self frame] resizingBrowserViewIfHidden:YES];
}

- (void)setBrowserActive:(BOOL)inActive
{
  [mBrowserView setActive:inActive];
}

-(BOOL)isBusy
{
  return mIsBusy;
}

- (NSString*)pageTitle
{
  return mDisplayTitle;
}

- (NSImage*)siteIcon
{
  return mSiteIconImage;
}

- (NSString*)statusString
{
  // Return the highest-priority status string that is set, or the empty string if none are set
  for (unsigned int i = 0; i < [mStatusStrings count]; ++i)
  {
    id status = [mStatusStrings objectAtIndex:i];
    if (status != [NSNull null])
      return status;
  }
  return @"";
}

- (float)loadingProgress
{
  return mProgress;
}

- (BOOL)popupsBlocked
{
  if (!mBlockedPopups) return NO;
  
  PRUint32 numBlocked = 0;
  mBlockedPopups->GetLength(&numBlocked);
  
  return (numBlocked > 0);
}

- (unsigned long)securityState
{
  return mSecureState;
}

- (BOOL)feedsDetected
{
	return (mFeedList && [mFeedList count] > 0);
}

- (void)loadURI:(NSString*)urlSpec referrer:(NSString*)referrer flags:(unsigned int)flags focusContent:(BOOL)focusContent allowPopups:(BOOL)inAllowPopups
{
  // blast it into the urlbar immediately so that we know what we're 
  // trying to load, even if it doesn't work
  [mDelegate updateLocationFields:urlSpec ignoreTyping:YES];
  
  [self setPendingURI:urlSpec];

  // if we're not the primary tab, make sure that the browser view is 
  // the correct size when loading a url so that if the url is a relative
  // anchor, which will cause a scroll to the anchor on load, the scroll
  // position isn't messed up when we finally display the tab.
  if (mDelegate == nil)
  {
    NSRect tabContentRect = [[[mWindow delegate] tabBrowser] contentRect];
    [self setFrame:tabContentRect resizingBrowserViewIfHidden:YES];
  }

  if ([[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefEnableURLFixup withSuccess:NULL])
    flags |= NSLoadFlagsAllowThirdPartyFixup;

  [self setPendingActive:focusContent];
  [mBrowserView loadURI:urlSpec referrer:referrer flags:flags allowPopups:inAllowPopups];
}

- (void)ensureContentClickListeners
{
  if (!mListenersAttached)
  {
    mListenersAttached = YES;
    
    // We need to hook up our click and context menu listeners.
    ContentClickListener* clickListener = new ContentClickListener([mWindow delegate]);
    if (!clickListener)
      return;
    
    nsCOMPtr<nsIDOMWindow> contentWindow = [[self browserView] contentWindow];
    nsCOMPtr<nsPIDOMWindow> piWindow(do_QueryInterface(contentWindow));
    nsPIDOMEventTarget *chromeHandler = piWindow->GetChromeEventHandler();
    if (chromeHandler)
      chromeHandler->AddEventListenerByIID(clickListener, NS_GET_IID(nsIDOMMouseListener));
  }
}

- (void)didBecomeActiveBrowser
{
  [self ensureContentClickListeners];
}

-(void)willResignActiveBrowser
{
  [mToolTip closeToolTip];

  [mBrowserView setActive:NO];
}


#pragma mark -

// custom view support

- (void)registerContentViewProvider:(id<ContentViewProvider>)inProvider forURL:(NSString*)inURL
{
  if (!mContentViewProviders)
    mContentViewProviders = [[NSMutableDictionary alloc] init];
    
  NSString* lowercaseURL = [inURL lowercaseString];
  [mContentViewProviders setObject:inProvider forKey:lowercaseURL];
}

- (void)unregisterContentViewProviderForURL:(NSString*)inURL
{
  [mContentViewProviders removeObjectForKey:[inURL lowercaseString]];
}

- (id)contentViewProviderForURL:(NSString*)inURL
{
  return [mContentViewProviders objectForKey:[inURL lowercaseString]];
}

- (void)checkForCustomViewOnLoad:(NSString*)inURL
{
  id<ContentViewProvider> provider = [mContentViewProviders objectForKey:[inURL lowercaseString]];
  NSView* providedView = [provider provideContentViewForURL:inURL];   // ok with nil provider

  NSView* newContentView = providedView ? providedView : mBrowserView;

  if ([self firstSubview] != newContentView)
  {
    [self swapFirstSubview:newContentView];
    [mDelegate contentViewChangedTo:newContentView forURL:inURL];
    
    // tell the provider that we swapped in its view
    if (providedView)
      [provider contentView:providedView usedForURL:inURL];
  }
}

#pragma mark -

- (void)onLoadingStarted 
{
  [self clearStatusStrings];

  mProgress = 0.0;
  mIsBusy = YES;

  [mDelegate loadingStarted];
  [mDelegate setLoadingActive:YES];
  [mDelegate setLoadingProgress:mProgress];
  
  [mLoadingResources removeAllObjects];
  
  [self updateStatusString:NSLocalizedString(@"TabLoading", @"") withPriority:eStatusProgress];

  [(BrowserTabViewItem*)mTabItem startLoadAnimation];
  
  [mDelegate showFeedDetected:NO];
  [mFeedList removeAllObjects];
  [mDelegate showSearchPluginDetected:NO];
  [mDetectedSearchPlugins removeAllObjects];
  
  [mTabItem setLabel:NSLocalizedString(@"TabLoading", @"")];
}

- (void)onLoadingCompleted:(BOOL)succeeded
{
  [mDelegate loadingDone:mActivateOnLoad];
  mActivateOnLoad = NO;
  mIsBusy = NO;
  [self setPendingURI:nil];
  
  [mDelegate setLoadingActive:NO];
  
  [self updateStatusString:nil withPriority:eStatusProgress];

  [(BrowserTabViewItem*)mTabItem stopLoadAnimation];

  NSString *urlString = [self currentURI];
  NSString *titleString = [mBrowserView pageTitle];
  
  // If we never got a page title, then the tab title will be stuck at "Loading..."
  // so be sure to set the title here
  NSString* tabTitle = [self displayTitleForPageURL:urlString title:titleString];
  [mTabItem setLabel:tabTitle];
  
  mProgress = 1.0;

  // tell the bookmarks when a url loaded.
  // note that this currently fires even when you go Back of Forward to the page,
  // so it's not a great way to count bookmark visits.
  if (urlString && ![urlString isEqualToString:@"about:blank"])
  {
    NSDictionary*   userInfo = [NSDictionary dictionaryWithObject:[NSNumber numberWithBool:succeeded] forKey:URLLoadSuccessKey];
    NSNotification* note     = [NSNotification notificationWithName:URLLoadNotification object:urlString userInfo:userInfo];
    [[NSNotificationQueue defaultQueue] enqueueNotification:note postingStyle:NSPostWhenIdle];
  }
}

- (void)onResourceLoadingStarted:(NSValue*)resourceIdentifier
{
  [mLoadingResources addObject:resourceIdentifier];
}

- (void)onResourceLoadingCompleted:(NSValue*)resourceIdentifier
{
  if ([mLoadingResources containsObject:resourceIdentifier])
  {
    [mLoadingResources removeObject:resourceIdentifier];
    // When the last sub-resource finishes loading (which may be after
    // onLoadingCompleted: is called), clear the status string, since otherwise
    // it will stay stuck on the last loading message.
    if ([mLoadingResources count] == 0)
      [self updateStatusString:nil withPriority:eStatusProgress];
  }
}

- (void)onProgressChange64:(long long)currentBytes outOf:(long long)maxBytes 
{
  if (maxBytes > 0)
  {
    mProgress = ((double)currentBytes / (double)maxBytes) * 100.0;
    [mDelegate setLoadingProgress:mProgress];
  }
}

- (void)onProgressChange:(long)currentBytes outOf:(long)maxBytes 
{
  if (maxBytes > 0)
  {
    mProgress = ((double)currentBytes / (double)maxBytes) * 100.0;
    [mDelegate setLoadingProgress:mProgress];
  }
}

- (void)onLocationChange:(NSString*)urlSpec isNewPage:(BOOL)newPage requestSucceeded:(BOOL)requestOK
{
  if (newPage)
  {
    // Defer hiding of extra views until we've loaded the new page.
    // If we are being called from within a history navigation, then core code
    // has already stored our old size, and will incorrectly truncate the page
    // later (see bug 350752, and the XXXbryner comment in nsDocShell.cpp). To
    // work around that, re-set the frame once core is done meddling.
    BOOL needsFrameAdjustment = NO;
    if (mBlockedPopupView) {
      [self removeBlockedPopupViewAndDisplay];
      needsFrameAdjustment = YES;
    }
    if (mFindBarView) {
      [self removeFindBarViewAndDisplay];
      needsFrameAdjustment = YES;
    }
    if (needsFrameAdjustment)
      [self performSelector:@selector(reapplyFrame) withObject:nil afterDelay:0];

    if(mBlockedPopups)
      mBlockedPopups->Clear();
    [mDelegate showPopupBlocked:NO];
  
    NSString* faviconURI = [SiteIconProvider defaultFaviconLocationStringFromURI:urlSpec];
    if (requestOK && [faviconURI length] > 0)
    {
      SiteIconProvider* faviconProvider = [SiteIconProvider sharedFavoriteIconProvider];

      // if the favicon uri has changed, do the favicon load
      if (![faviconURI isEqualToString:mSiteIconURI])
      {
        // first get a cached image for this site, if we have one. we'll go ahead
        // and request the load anyway, in case the site updated their icon.
        NSImage*  cachedImage = [faviconProvider favoriteIconForPage:urlSpec];
        NSString* cachedImageURI = nil;

        if (cachedImage)
          cachedImageURI = faviconURI;
        
        // immediately update the site icon (to the cached one, or the default)
        [self updateSiteIconImage:cachedImage withURI:cachedImageURI loadError:NO];

        if ([[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefEnableFavicons withSuccess:NULL])
        {
          // note that this is the only time we hit the network for site icons.
          // note also that we may get a site icon from a link element later,
          // which will replace any we get from the default location.
          // when this completes, our imageLoadedNotification: will get called.
          [faviconProvider fetchFavoriteIconForPage:urlSpec
                                   withIconLocation:nil
                                       allowNetwork:YES
                                    notifyingClient:self];
        }
      }
    }
    else
    {
      if ([urlSpec hasPrefix:@"about:"])
        faviconURI = urlSpec;
      else
      	faviconURI = @"";

      [self updateSiteIconImage:nil withURI:faviconURI loadError:!requestOK];
    }
  }
  
  [mDelegate updateLocationFields:urlSpec ignoreTyping:NO];

  // see if someone wants to replace the main view
  [self checkForCustomViewOnLoad:urlSpec];
}

- (void)onStatusChange:(NSString*)aStatusString
{
  [self updateStatusString:aStatusString withPriority:eStatusProgress];
}

//
// onSecurityStateChange:
//
// Update the lock to the appropriate icon to match what necko is telling us, but
// only if we own the UI. If we're not the primary browser, we have no business
// mucking with the lock icon.
//
- (void)onSecurityStateChange:(unsigned long)newState
{
  mSecureState = newState;
  [mDelegate showSecurityState:mSecureState];
}

- (void)setStatus:(NSString *)statusString ofType:(NSStatusType)type 
{
  StatusPriority priority;

  if (type == NSStatusTypeScriptDefault)
    priority = eStatusScriptDefault;
  else if (type == NSStatusTypeScript)
    priority = eStatusScript;
  else
    priority = eStatusLinkTarget;

  [self updateStatusString:statusString withPriority:priority];
}

// Private method to consolidate all status string changes, as status strings
// can come from Gecko through several callbacks.
- (void)updateStatusString:(NSString*)statusString withPriority:(StatusPriority)priority
{
  [mStatusStrings replaceObjectAtIndex:priority withObject:(statusString ? (id)statusString
                                                                         : (id)[NSNull null])];
  [mDelegate updateStatus:[self statusString]];
}

- (void)clearStatusStrings
{
  for (unsigned int i = 0; i < [mStatusStrings count]; ++i)
    [mStatusStrings replaceObjectAtIndex:i withObject:[NSNull null]];
}

- (NSString *)title
{
  return mDisplayTitle;
}

// this should only be called from the CHBrowserListener
- (void)setTitle:(NSString *)title
{
  [mDisplayTitle autorelease];
  mDisplayTitle = [[self displayTitleForPageURL:[self currentURI] title:title] retain];
  
  [mTabItem setLabel:mDisplayTitle];
  [mDelegate updateWindowTitle:mDisplayTitle];
}

- (NSString*)displayTitleForPageURL:(NSString*)inURL title:(NSString*)inTitle
{
  NSString* viewSourcePrefix = @"view-source:";
  if ([inURL hasPrefix:viewSourcePrefix])
    return [NSString stringWithFormat:NSLocalizedString(@"SourceOf", @""), [inURL substringFromIndex:[viewSourcePrefix length]]];

  if ([inTitle length] > 0)
    return inTitle;

  if (![inURL isEqualToString:@"about:blank"])
  {
    if ([inURL hasPrefix:@"file://"])
      return [inURL lastPathComponent];

    return inURL;
  }

  return NSLocalizedString(@"UntitledPageTitle", @"");
}

- (void)updatePluginsEnabledState
{
  BOOL gotPref;
  BOOL pluginsEnabled = [[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefEnablePlugins
                                                               withSuccess:&gotPref];

  // If we can't get the pref, ensure we leave plugins enabled.
  [mBrowserView setProperty:nsIWebBrowserSetup::SETUP_ALLOW_PLUGINS toValue:(gotPref ? pluginsEnabled : YES)];
}

//
// onShowTooltip:where:withText
//
// Unfortunately, we can't use cocoa's apis here because they rely on setting a region
// and waiting. We already have waited and we just want to display the tooltip, so we
// drop down to the Carbon help manager routines.
//
// |where| is relative to the browser view in QD coordinates (top left is (0,0)) 
// and must be converted to global QD coordinates for the carbon help manager.
//
- (void)onShowTooltip:(NSPoint)where withText:(NSString*)text
{
  // if this tooltip originates from a tab that is (now) in the background,
  // or a background window, don't show it.
  if (![self window] || ![[self window] isMainWindow])
    return;

  NSPoint point = [[self window] convertBaseToScreen:[self convertPoint: where toView:nil]];
  [mToolTip showToolTipAtPoint: point withString: text overWindow:mWindow];
}

- (void)onHideTooltip
{
  [mToolTip closeToolTip];
}

//
// - onPopupBlocked:
//
// Called when gecko blocks a popup, telling us who it came from, the modifiers of the popup
// and more data that we'll need if the user wants to unblock the popup later.
//
- (void)onPopupBlocked:(nsIDOMPopupBlockedEvent*)eventData;
{
  // If popups from this site have been blacklisted, silently discard the event.
  if ([self popupsAreBlacklistedForURL:[self currentURI]])
    return;
  // lazily instantiate.
  if (!mBlockedPopups)
    CallCreateInstance(NS_ARRAY_CONTRACTID, &mBlockedPopups);
  if (mBlockedPopups) {
    mBlockedPopups->AppendElement((nsISupports*)eventData, PR_FALSE);
    [self addBlockedPopupViewAndDisplay];
    [mDelegate showPopupBlocked:YES];
  }
}

// Called when a "shortcut icon" link element is noticed
- (void)onFoundShortcutIcon:(NSString*)inIconURI
{
  BOOL useSiteIcons = [[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefEnableFavicons withSuccess:NULL];
  if (!useSiteIcons)
    return;
  
  if ([inIconURI length] > 0)
  {
    // if the favicon uri has changed, fire off favicon load. When it completes, our
    // imageLoadedNotification selector gets called.
    if (![inIconURI isEqualToString:mSiteIconURI])
    {
      [[SiteIconProvider sharedFavoriteIconProvider] fetchFavoriteIconForPage:[self currentURI]
                                                             withIconLocation:inIconURI
                                                                 allowNetwork:YES
                                                              notifyingClient:self];
    }
  }
}

- (void)onFeedDetected:(NSString*)inFeedURI feedTitle:(NSString*)inFeedTitle
{
  // add the two in variables to a dictionary, then store in the feed array
  NSDictionary* feed = [NSDictionary dictionaryWithObjectsAndKeys:inFeedURI, @"feeduri", inFeedTitle, @"feedtitle", nil];
  
  if (!mFeedList)
    mFeedList = [[NSMutableArray alloc] init];
  
  [mFeedList addObject:feed];
  // notify the browser UI that a feed was found
  [mDelegate showFeedDetected:YES];
}

- (void)onSearchPluginDetected:(NSURL*)pluginURL mimeType:(NSString*)pluginMIMEType displayName:(NSString*)pluginName
{
  if ([XMLSearchPluginParser canParsePluginMIMEType:pluginMIMEType]) {
    NSDictionary* searchPluginDict = [NSDictionary dictionaryWithObjectsAndKeys:pluginURL, kWebSearchPluginURLKey,
                                                                                pluginMIMEType, kWebSearchPluginMIMETypeKey,
                                                                                pluginName, kWebSearchPluginNameKey, 
                                                                                nil];
    [mDetectedSearchPlugins addObject:searchPluginDict];
    [mDelegate showSearchPluginDetected:YES];
  }
}

// Called when a context menu should be shown.
- (void)onShowContextMenu:(int)flags domEvent:(nsIDOMEvent*)aEvent domNode:(nsIDOMNode*)aNode
{
  // presumably this is only called on the primary tab
  [[mWindow delegate] onShowContextMenu:flags domEvent:aEvent domNode:aNode];
}

// -deleteBackward:
//
// map backspace key to Back according to browser.backspace_action pref
//
- (void)deleteBackward:(id)sender
{
  // there are times when backspaces can seep through from IME gone wrong. As a 
  // workaround until we can get them all fixed, ignore backspace when the
  // focused widget is a text field or plugin
  if ([mBrowserView isTextFieldFocused] || [mBrowserView isPluginFocused])
    return;

  int backspaceAction = [[PreferenceManager sharedInstance] getIntPref:kGeckoPrefBackspaceAction
                                                           withSuccess:NULL];

  if (backspaceAction == kBackspaceActionBack) {
    if ([[NSApp currentEvent] modifierFlags] & NSShiftKeyMask)
      [mBrowserView goForward];
    else
      [mBrowserView goBack];
  }
  // Any other value means no action for backspace. We deliberately don't
  // support 1 (PgUp/PgDn) as it has no precedent on Mac OS.
}

-(NSMenu*)contextMenu
{
  return [[mWindow delegate] contextMenu];
}

-(NSWindow*)nativeWindow
{
  // use the view's window first
  NSWindow* viewsWindow = [self window];
  if (viewsWindow)
    return viewsWindow;

  return mWindow;
}


//
// closeBrowserWindow
//
// Gecko wants us to close the browser associated with this gecko instance. However,
// we're just one tab in the window so we don't really have the power to do this.
// Let the window controller have final say.
// 
- (void)closeBrowserWindow
{
  [[mWindow delegate] closeBrowserWindow:self];
}

//
// sendBrowserWindowToBack
//
// Send the window the back of the window stack, and unfocus it if it's the key
// window.
//
- (void)sendBrowserWindowToBack
{
  [[mWindow delegate] sendBrowserWindowToBack:self];
}


//
// willShowPrompt
//
// Called before a prompt is shown for the contained view
// 
- (void)willShowPrompt
{
  [[mWindow delegate] willShowPromptForBrowser:self];
}

//
// didDismissPrompt
//
// Called after a prompt is shown for the contained view
//
- (void)didDismissPrompt
{
  [[mWindow delegate] didDismissPromptForBrowser:self];
}

//
// sizeBrowserTo
//
// Sizes window so that browser has dimensions given by |dimensions|
//
- (void)sizeBrowserTo:(NSSize)dimensions
{
  NSRect bounds = [self bounds];
  float dx = dimensions.width - bounds.size.width;
  float dy = dimensions.height - bounds.size.height;

  NSRect frame = [[self window] frame];
  NSPoint topLeft = NSMakePoint(NSMinX(frame), NSMaxY(frame));
  frame.size.width += dx;
  frame.size.height += dy;
  
  // if we just call setFrame, it will change the top-left corner of the
  // window as it pulls the extra space from the top and right sides of the window,
  // which is not at all what the website desired. We must preserve
  // topleft of the window and reset it after we resize.
  [[self window] setFrame:frame display:YES];
  [[self window] setFrameTopLeftPoint:topLeft];
}

- (CHBrowserView*)createBrowserWindow:(unsigned int)aMask
{
  BrowserWindowController* controller = [[BrowserWindowController alloc] initWithWindowNibName: @"BrowserWindow"];
  [controller setChromeMask: aMask];
  [controller disableAutosave]; // The Web page opened this window, so we don't ever use its settings.
  [controller disableLoadPage]; // don't load about:blank initially since this is a script-opened window
  
  [controller window];		// force window load. The window gets made visible by CHBrowserListener::SetVisibility
  
  [[controller browserWrapper] setPendingActive: YES];
  return [[controller browserWrapper] browserView];
}


//
// -reuseExistingBrowserWindow:
//
// Check the exact value of the "single-window mode" pref and if it's set to
// reuse the same view, return it. If it's set to create a new tab, do that
// and return that tab's view.
//
- (CHBrowserView*)reuseExistingBrowserWindow:(unsigned int)aMask
{
  CHBrowserView* viewToUse = mBrowserView;
  int openNewWindow = [[PreferenceManager sharedInstance] getIntPref:kGeckoPrefSingleWindowModeTargetBehavior
                                                         withSuccess:NULL];
  if (openNewWindow == kSingleWindowModeUseNewTab) {
    // If browser.tabs.loadDivertedInBackground isn't set, we decide whether or
    // not to open the new tab in the background based on whether we're the fg
    // tab. If we are, we assume the user wants to see the new tab because it's 
    // contextually relevant. If this tab is in the bg, the user doesn't want to
    // be bothered with a bg tab throwing things up in their face. We know
    // we're in the bg if our delegate is nil.
    BOOL loadInBackground;
    if ([[PreferenceManager sharedInstance] getBooleanPref:kGeckoPrefSingleWindowModeTabsOpenInBackground withSuccess:NULL])
      loadInBackground = YES;
    else
      loadInBackground = (mDelegate == nil);
    viewToUse = [mCreateDelegate createNewTabBrowser:loadInBackground];
  }

  return viewToUse;
}

//
// -shouldReuseExistingWindow
//
// Checks the pref to see if we want to reuse the same window (either in a new tab
// or re-use the same browser view) when loading a URL requesting a new window
//
- (BOOL)shouldReuseExistingWindow
{
  int openNewWindow = [[PreferenceManager sharedInstance] getIntPref:kGeckoPrefSingleWindowModeTargetBehavior
                                                         withSuccess:NULL];
  BOOL shouldReuse = (openNewWindow == kSingleWindowModeUseCurrentTab ||
                      openNewWindow == kSingleWindowModeUseNewTab);
  return shouldReuse;
}

// Checks to see if we should allow window.open calls with specified size/position to open new windows (regardless of SWM)
- (int)respectWindowOpenCallsWithSizeAndPosition
{
  return ([[PreferenceManager sharedInstance] getIntPref:kGeckoPrefSingleWindowModeRestriction
                                             withSuccess:NULL] == kSingleWindowModeApplyOnlyToUnfeatured);
}

- (CHBrowserView*)browserView
{
  return mBrowserView;
}

- (void)setPendingActive:(BOOL)active
{
  mActivateOnLoad = active;
}

- (void)setSiteIconImage:(NSImage*)inSiteIcon
{
  [mSiteIconImage autorelease];
  mSiteIconImage = [inSiteIcon retain];
}

- (void)setSiteIconURI:(NSString*)inSiteIconURI
{
  [mSiteIconURI autorelease];
  mSiteIconURI = [inSiteIconURI retain];
}

// A nil inSiteIcon image indicates that we should use the default icon
- (void)updateSiteIconImage:(NSImage*)inSiteIcon withURI:(NSString *)inSiteIconURI loadError:(BOOL)inLoadError
{
  BOOL     resetTabIcon     = NO;
  BOOL     tabIconDraggable = YES;
  NSImage* siteIcon         = inSiteIcon;
  
  if (![mSiteIconURI isEqualToString:inSiteIconURI] || inLoadError)
  {
    if (!siteIcon)
    {
      if (inLoadError)
        siteIcon = [NSImage imageNamed:@"error_page_site_icon"];
      else
        siteIcon = [NSImage imageNamed:@"globe_ico"];
    }

    if ([inSiteIconURI isEqualToString:@"about:blank"])
      tabIconDraggable = NO;

    [self setSiteIconImage:siteIcon];
    [self setSiteIconURI:inSiteIconURI];
  
    // update the proxy icon
    [mDelegate updateSiteIcons:mSiteIconImage ignoreTyping:NO];
      
    resetTabIcon = YES;
  }

  // update the tab icon
  if ([mTabItem isMemberOfClass:[BrowserTabViewItem class]])
  {
    BrowserTabViewItem* tabItem = (BrowserTabViewItem*)mTabItem;
    if (resetTabIcon || ![tabItem tabIcon])
      [tabItem setTabIcon:mSiteIconImage isDraggable:tabIconDraggable];
  }
}

- (void)setPendingURI:(NSString*)inURI
{
  [mPendingURI autorelease];
  mPendingURI = [inURI retain];
}

- (void)registerNotificationListener
{
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(imageLoadedNotification:)
                                               name:SiteIconLoadNotificationName
                                             object:self];
}

// called when [[SiteIconProvider sharedFavoriteIconProvider] fetchFavoriteIconForPage:...] completes
- (void)imageLoadedNotification:(NSNotification*)notification
{
  NSDictionary* userInfo = [notification userInfo];
  if (userInfo)
  {
  	NSImage*  iconImage     = [userInfo objectForKey:SiteIconLoadImageKey];
    NSString* siteIconURI   = [userInfo objectForKey:SiteIconLoadURIKey];
    NSString* pageURI       = [userInfo objectForKey:SiteIconLoadUserDataKey];
    
    if (iconImage == nil)
      siteIconURI = @"";	// go back to default image
  
    if ([pageURI isEqualToString:[self currentURI]]) // make sure it's for the current page
      [self updateSiteIconImage:iconImage withURI:siteIconURI loadError:NO];
  }
}


//
// -isEmpty
//
// YES if the page currently loaded in the browser view is "about:blank", NO otherwise
//
- (BOOL) isEmpty
{
  return [[self currentURI] isEqualToString:@"about:blank"];
}

- (BOOL)isInternalURI
{
  NSString* currentURI = [self currentURI];
  return ([currentURI hasPrefix:@"about:"] || [currentURI hasPrefix:@"view-source:"]);
}

//
// -isBookmarkable
//
// Returns YES if the current URI is appropriate and safe for bookmarking.
//
- (BOOL)isBookmarkable
{
  if ([self isEmpty])
    return NO;

  // Check for any potential security implications as determined by nsIScriptSecurityManager's
  // DISALLOW_INHERIT_PRINCIPAL. (e.g. |javascript:| or |data:| URIs)
  nsCOMPtr<nsIDOMWindow> domWindow = [mBrowserView contentWindow];
  if (!domWindow) 
    return NO;
  nsCOMPtr<nsIDOMDocument> domDocument;
  domWindow->GetDocument(getter_AddRefs(domDocument));
  if (!domDocument)
    return NO;
  nsCOMPtr<nsIDocument> document(do_QueryInterface(domDocument));
  if (!document)
    return NO;
  nsCOMPtr<nsIScriptSecurityManager> scriptSecurityManager(do_GetService(NS_SCRIPTSECURITYMANAGER_CONTRACTID));
  if (!scriptSecurityManager)
    return NO;
  nsresult uriIsSafe = 
    scriptSecurityManager->CheckLoadURIWithPrincipal(document->NodePrincipal(), 
                                                     document->GetDocumentURI(), 
                                                     nsIScriptSecurityManager::DISALLOW_INHERIT_PRINCIPAL);
  return (NS_SUCCEEDED(uriIsSafe) ? YES : NO);
}

- (BOOL)canReload
{
  NSString* curURI = [[self currentURI] lowercaseString];
  return (![self isEmpty] &&
          !([curURI isEqualToString:@"about:bookmarks"] ||
            [curURI isEqualToString:@"about:history"] ||
            [curURI isEqualToString:@"about:config"]));
}

- (void)reload:(unsigned int)reloadFlags
{
  // Toss the favicon when force reloading
  if (reloadFlags == NSLoadFlagsBypassCacheAndProxy)
    [[SiteIconProvider sharedFavoriteIconProvider] removeImageForPageURL:[self currentURI]];

  [mBrowserView reload:reloadFlags];
}

- (IBAction)reloadWithNewCharset:(NSString*)charset
{
  [[self browserView] reloadWithNewCharset:charset];
}

- (NSString*)currentCharset
{
  return [[self browserView] currentCharset];
}

//
// -feedList:
//
// Return the list of feeds that were found on this page.
//
- (NSArray*)feedList
{
  return mFeedList;
}

- (NSArray*)detectedSearchPlugins
{
  return mDetectedSearchPlugins;
}

#pragma mark -

- (BOOL)popupsAreBlacklistedForURL:(NSString*)inURL
{
  int policy = [[CHPermissionManager permissionManager] policyForURI:inURL
                                                                type:CHPermissionTypePopup];
  return (policy == CHPermissionDeny);
}

//
// -showPopups:
//
// Called when the user clicks on the "Allow Once" button in the blocked popup view.
// Shows the blocked popups without whitelisting the source page.
//
- (IBAction)showPopups:(id)sender
{
  [self showPopupsWhitelistingSource:NO];
}

//
// -unblockPopups:
//
// Called when the user clicks on the "Always Allow" button in the blocked popup view.
// Shows the blocked popups and whitelists the source page.
//
- (IBAction)unblockPopups:(id)sender
{
  [self showPopupsWhitelistingSource:YES];
}

//
// -blacklistPopups:
//
// Called when the user clicks on the "Never Allow" button in the blocked popup view.
// Adds the current site to the blacklist, and dismisses the blocked popup UI.
//
- (IBAction)blacklistPopups:(id)sender
{
  [mDelegate blacklistPopupsFromURL:[self currentURI]];
  [self removeBlockedPopupViewAndDisplay];
}

//
// -showPopupsWhitelistingSource:
//
// Private helper method to handle showing blocked popups.
// Sends the the list of popups we just blocked to our UI delegate so it can
// handle them. This also removes the blocked popup UI from the current window.
//
- (void)showPopupsWhitelistingSource:(BOOL)shouldWhitelist
{
  NS_ASSERTION([self popupsBlocked], "no popups to unblock!");
  if ([self popupsBlocked]) {
    nsCOMPtr<nsIArray> blockedSites = do_QueryInterface(mBlockedPopups);
    [mDelegate showBlockedPopups:blockedSites whitelistingSource:shouldWhitelist];
    [self removeBlockedPopupViewAndDisplay];
    mBlockedPopups->Clear();
    [mDelegate showPopupBlocked:NO];
  }
}

//
// -addBlockedPopupViewAndDisplay
//
// Even if we're hidden, we ensure that the new view is in the view hierarchy
// and it will be resized when the current tab is eventually displayed.
//
- (void)addBlockedPopupViewAndDisplay
{
  if ([self popupsBlocked] && !mBlockedPopupView) {
    [NSBundle loadNibNamed:@"PopupBlockView" owner:self];
    
    NSString* currentHost = [[NSURL URLWithString:[self currentURI]] host];
    if (!currentHost)
      currentHost = NSLocalizedString(@"GenericHostString", nil);
    [mBlockedPopupLabel setStringValue:[NSString stringWithFormat:NSLocalizedString(@"PopupDisplayRequest", nil), currentHost]];
    [mBlockedPopupCloseButton setImage:[NSImage imageNamed:@"popup_close"]];
    [mBlockedPopupCloseButton setAlternateImage:[NSImage imageNamed:@"popup_close_pressed"]];
    [mBlockedPopupCloseButton setHoverImage:[NSImage imageNamed:@"popup_close_hover"]];
    
    [self addSubview:mBlockedPopupView];
    [self setFrame:[self frame] resizingBrowserViewIfHidden:YES];
    [self display];
  }
}

//
// -removeBlockedPopupViewAndDisplay
//
// If we're showing the blocked popup view, this removes it and resizes the
// browser view to fill that space. Causes a full redraw of our view.
//
- (void)removeBlockedPopupViewAndDisplay
{
  if (mBlockedPopupView) {
    [mBlockedPopupView removeFromSuperview];
    [mBlockedPopupView release]; // retain count of 1 from nib
    mBlockedPopupView = nil;
    [self setFrame:[self frame] resizingBrowserViewIfHidden:YES];
    [self display];
  }
}

- (IBAction)hideBlockedPopupView:(id)sender
{
  [self removeBlockedPopupViewAndDisplay];
}

#pragma mark -
#pragma mark Find Bar

//
// -showFindBar
//
// Shows the find bar at the bottom of the content area.
//
- (void)showFindBar
{
  [mFindBarController showFindBar];
}

//
// -showFindBarView:
//
// Meant for use by FindBarController; internally, use
// add/removeFindBarViewAndDisplay.
//
- (void)showFindBarView:(NSView*)inBarView
{
  if (inBarView && (inBarView != mFindBarView)) {
    [mFindBarView removeFromSuperviewWithoutNeedingDisplay];
    mFindBarView = inBarView;
    if (inBarView)
      [self addFindBarViewAndDisplay];
  }
  else if (!inBarView && mFindBarView) {
    // Pull focus back to the content area.
    [[self window] makeFirstResponder:mBrowserView];
    [self removeFindBarViewAndDisplay];
  }
}

//
// -addFindBarViewAndDisplay
//
// Even if we're hidden, we ensure that the new view is in the view hierarchy
// and it will be resized when the current tab is eventually displayed.
//
- (void)addFindBarViewAndDisplay
{
  [self addSubview:mFindBarView];
  [self setFrame:[self frame] resizingBrowserViewIfHidden:YES];
  [self display];
}

//
// -removeFindBarViewAndDisplay
//
// If we're showing the find bar view, this removes it and resizes the
// browser view to fill that space. Causes a full redraw of our view.
//
- (void)removeFindBarViewAndDisplay
{
  if (mFindBarView) {
    [mFindBarView removeFromSuperview];
    mFindBarView = nil;
    [self setFrame:[self frame] resizingBrowserViewIfHidden:YES];
    [self display];
  }
}

@end

#pragma mark -

// This value keeps the message text field from wrapping excessively.
#define kMessageTextMinWidth 70

@implementation InformationPanelView

- (void)awakeFromNib
{
  [self verticallyCenterAllSubviews];

  // Padding & strut length are required when setting the panel's frame.
  NSRect textFieldFrame = [mPopupBlockedMessageTextField frame];
  mVerticalPadding = [mPopupBlockedMessageTextField frame].origin.y;
  mMessageTextRightStrutLength = [self frame].size.width - NSMaxX(textFieldFrame);
}

//
// -setFrame:
// In addition to setting the panel's frame rectangle this method accounts
// for wrapping of the message text field in response to this new frame and
// adjusts to properly enclose the text, maintaining vertical padding.
//
- (void)setFrame:(NSRect)newPanelFrame
{
  NSRect existingPanelFrame = [self frame];
  NSRect textFieldFrame = [mPopupBlockedMessageTextField frame];

  // Resize the text field's width (based on its right strut).
  float currentStrutLength = newPanelFrame.size.width - NSMaxX(textFieldFrame);
  textFieldFrame.size.width -= mMessageTextRightStrutLength - currentStrutLength;

  // Enforce a minimum size for the text field.
  if (textFieldFrame.size.width < kMessageTextMinWidth)
    textFieldFrame.size.width = kMessageTextMinWidth;

  // Text field will wrap/resize when its new frame is applied.
  [mPopupBlockedMessageTextField setFrame:textFieldFrame];
  textFieldFrame = [mPopupBlockedMessageTextField frame];

  newPanelFrame.size.height = textFieldFrame.size.height + 2 * mVerticalPadding;
  [super setFrame:newPanelFrame];

  [self verticallyCenterAllSubviews];
}

- (void)verticallyCenterAllSubviews
{
  NSRect panelFrame = [self frame];

  NSEnumerator *subviewEnum = [[self subviews] objectEnumerator];
  NSView *currentSubview;

  while ((currentSubview = [subviewEnum nextObject])) {
    NSRect currentSubviewFrame = [currentSubview frame];
    // The panel's NSButtons draw incorrectly on non-integral pixel boundaries.
    float verticallyCenteredYLocation = (int)((panelFrame.size.height - currentSubviewFrame.size.height) / 2.0f);

    [currentSubview setFrameOrigin:NSMakePoint(currentSubviewFrame.origin.x, verticallyCenteredYLocation)];
  }
}

//
// -drawRect:
//
// Draws a shading behind the view's contents.
//
- (void)drawRect:(NSRect)aRect
{
  NSRect bounds = [self bounds];
  NSRect topHalf, bottomHalf;
  NSDivideRect(bounds, &topHalf, &bottomHalf, ceilf(bounds.size.height / 2.0), NSMaxYEdge);

  CHGradient* topGradient =
    [[[CHGradient alloc] initWithStartingColor:[NSColor colorWithDeviceWhite:0.364706
                                                                       alpha:1.0]
                                   endingColor:[NSColor colorWithDeviceWhite:0.298039
                                                                       alpha:1.0]] autorelease];
  CHGradient* bottomGradient =
    [[[CHGradient alloc] initWithStartingColor:[NSColor colorWithDeviceWhite:0.207843
                                                                       alpha:1.0]
                                   endingColor:[NSColor colorWithDeviceWhite:0.290196
                                                                       alpha:1.0]] autorelease];
  [topGradient drawInRect:topHalf angle:270.0];
  [bottomGradient drawInRect:bottomHalf angle:270.0];

  [super drawRect:aRect];
}

@end
