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
 *   Simon Fraser <sfraser@netscape.com>
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

#import "BrowserContentViews.h"

#import "BookmarkToolbar.h"
#import "BrowserTabView.h"
#import "BrowserTabBarView.h"
#import "TabThumbnailGridView.h"

/*
  These various content views are required to deal with several non-standard sizing issues
  in the bookmarks toolbar and browser tab view.
  
  First, the bookmarks toolbar can expand downwards as it reflows its buttons. The 
  BrowserContentView is required to deal with this, shrinking the BrowserContainerView
  to accomodate it.
  
  Second, we have to play tricks with the BrowserTabView, shifting it around
  when showing and hiding tabs, and expanding it outside the bounds of its
  enclosing control to clip out the shadows. The BrowserContainerView exists
  to handle this, and to draw background in extra space that is created as
  a result.
  
  Finally, the find bar can come and go depending on user action. It also 
  can be either the temporary "quickfind" or the persistant find bar, depending
  on the context. It's up to an external controller to set the find bar to the
  appropriate variant. Both setting and clearing the bar forces a reflow. 
  
  Note that having this code overrides the autoresize behaviour of these views
  as set in IB.
 ______________
 | Window
 | 
 | 
 |  _________________________________________________________________
    | BrowserContentView                                            |
    | ____________________________________________________________  |
    | | BookmarkToolbar                                           | |
    | |___________________________________________________________| |
    |                                                               |
    | ____________________________________________________________  |
    | | BrowserContainerView                                      | |
    | |                  _______  ________                        | |
    | | ________________/       \/        \_____________________  | |
    | | | BrowserTabView                                        | | |
    | | |                                                       | | |
    | | |                                                       | | |
    | | |                                                       | | |
    | | |                                                       | | |
    | | |                                                       | | |
    | | |                                                       | | |
    | | |_______________________________________________________| | |
    | |___________________________________________________________| |
    | ____________________________________________________________  |
    | | Find bar                                                  | |
    | |___________________________________________________________| |
    | ____________________________________________________________  |
    | | Status bar                                                | |
    | |___________________________________________________________| |
    |_______________________________________________________________|
    
*/

@implementation BrowserContentView

- (void) dealloc
{
  [mTabThumbnailGridView release];
  [super dealloc];
}

- (void)awakeFromNib
{
}

- (void)resizeSubviewsWithOldSize:(NSSize)oldFrameSize
{
  float bmToolbarHeight = 0.0;
  float statusBarHeight = 0.0;
  float findBarHeight = 0.0;

  if (mBookmarksToolbar) {
    // first resize the toolbar, which can reflow to a different height
    [mBookmarksToolbar resizeWithOldSuperviewSize: oldFrameSize];
      
    // make sure the toolbar doesn't get pushed off the top. This view is not flipped,
    // so the top is MaxY
    if (NSMaxY([mBookmarksToolbar frame]) > NSMaxY([self bounds])) {
      NSRect	newFrame = [mBookmarksToolbar frame];
      newFrame = NSOffsetRect(newFrame, 0, NSMaxY([self bounds]) - NSMaxY([mBookmarksToolbar frame]));
      [mBookmarksToolbar setFrame:newFrame];
    }
    
    if (![mBookmarksToolbar isHidden])
      bmToolbarHeight = NSHeight([mBookmarksToolbar frame]);
  }
  
  // size/position the status bar, if present
  if (mStatusBar && ![mStatusBar isHidden]) {
    statusBarHeight = NSHeight([mStatusBar frame]);
    NSRect statusRect = [self bounds];
    statusRect.size.height = statusBarHeight;
    [mStatusBar setFrame:statusRect];
  }

  // position the find bar above the status bar, if present. Unlike the other bars, if it's set, 
  // it's meant to be visible.
  if (mFindBar) {
    findBarHeight = NSHeight([mFindBar frame]);
    NSRect findRect = [self bounds];
    findRect.size.height = findBarHeight;
    findRect.origin.y = statusBarHeight;
    [mFindBar setFrame:findRect];
  }
  
  // figure out how much space is left for the browser view
  NSRect browserRect = [self bounds];
  // subtract bm toolbar
  browserRect.size.height -= bmToolbarHeight;
  
  // subtract status bar and find bar
  browserRect.size.height -= statusBarHeight + findBarHeight;
  browserRect.origin.y += statusBarHeight + findBarHeight;
  
  // resize our current content area, whatever it may be. We will
  // take care of resizing the other view when we toggle it to
  // match the size to avoid taking the hit of resizing it when it's
  // not visible.
  [mBrowserContainerView setFrame:browserRect];
  [mBrowserContainerView setNeedsDisplay:YES];
  // NSLog(@"resizing to %f %f", browserRect.size.width, browserRect.size.height);

  if (mTabThumbnailGridView)
  {
    NSRect tabposeRect = NSMakeRect(0, 0, browserRect.size.width,browserRect.size.height + statusBarHeight);
    [mTabThumbnailGridView setFrame:tabposeRect];
  }
}

// displays |inBarView| as the find bar just above the status bar. Pass nil to
// make the bar disappear. 
- (void)showFindBar:(NSView*)inBarView
{
  // out with the old
  if (mFindBar)
    [mFindBar removeFromSuperviewWithoutNeedingDisplay];

  // in with the new
  mFindBar = inBarView;
  if (inBarView)
    [self addSubview:inBarView];
    
  // resize everyone
  [self resizeSubviewsWithOldSize:[self frame].size];
}

- (void)willRemoveSubview:(NSView *)subview
{
  if (subview == mBookmarksToolbar)
    mBookmarksToolbar = nil;
  else if (subview == mStatusBar)
    mStatusBar = nil;
  else if (subview == mFindBar)   // just in case callers don't clear it themselves
    mFindBar = nil;

  [super willRemoveSubview:subview];
}

- (void)didAddSubview:(NSView *)subview
{
  // figure out if mStatusBar or mBookmarksToolbar has been added back?
  [super didAddSubview:subview];
}

- (void)showTabThumbnailGridView
{
  if (!mTabThumbnailGridView) {
    NSRect browserRect = [self bounds];
    float bookmarkBarHeight = [mBookmarksToolbar isVisible] ? NSHeight([mBookmarksToolbar frame]) : 0;
    NSRect newRect = NSMakeRect(0, 0, browserRect.size.width,browserRect.size.height - bookmarkBarHeight);
    mTabThumbnailGridView = [[TabThumbnailGridView alloc] initWithFrame:newRect];
  }

  mStatusBarWasHidden = [mStatusBar isHidden];
  [mStatusBar setHidden:YES];
  [mBrowserContainerView setHidden:YES];

  [self addSubview:mTabThumbnailGridView];

}

- (void)hideTabThumbnailGridView
{
  [mTabThumbnailGridView removeFromSuperview];
  [mBrowserContainerView setHidden:NO];

  if (!mStatusBarWasHidden)
    [mStatusBar setHidden:NO];

  [mTabThumbnailGridView release];
  mTabThumbnailGridView = nil;
}

- (void)toggleTabThumbnailGridView
{
  if ([mTabThumbnailGridView isDescendantOf:self])
    [self hideTabThumbnailGridView];
  else
    [self showTabThumbnailGridView];
}

//
// Temporary, For testing purposes only
//
- (BOOL)performKeyEquivalent:(NSEvent *)theEvent
{
  // Control+Command+T envokes tabpose
  if ([theEvent modifierFlags] & NSControlKeyMask && NSCommandKeyMask) {
    NSString *keystroke = [theEvent charactersIgnoringModifiers];
    if ([keystroke isEqualToString:@"t"]) {
      [self toggleTabThumbnailGridView];
      return YES;
    }
  }
  return [super performKeyEquivalent:theEvent];
}

@end

#pragma mark -

@implementation BrowserContainerView

- (void)resizeSubviewsWithOldSize:(NSSize)oldFrameSize
{
  NSRect adjustedRect = [self bounds];
  // mTabView will have set the appropriate size by now
  adjustedRect.size.height -= [mTabBarView frame].size.height;  
  [mTabView setFrame:adjustedRect];
  
  NSRect tbRect = adjustedRect;
  tbRect.size.height = [mTabBarView frame].size.height;
  tbRect.origin.x = 0;
  tbRect.origin.y = NSMaxY(adjustedRect);
  [mTabBarView setFrame:tbRect];
}

@end
