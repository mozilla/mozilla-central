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

#import "ImageAdditions.h"
#import "NSString+Utils.h"

#import "BrowserTabViewItem.h"
#import "BrowserTabView.h"
#import "TabButtonView.h"

#import "BrowserWrapper.h"
#import "TruncatingTextAndImageCell.h"

NSString* const kTabWillChangeNotifcation = @"kTabWillChangeNotifcation";

// truncate menuitem title to the same width as the bookmarks menu
const int kMenuTruncationChars = 60;

@interface BrowserTabViewItem(Private)
- (void)setTag:(int)tag;
@end

#pragma mark -

@implementation BrowserTabViewItem

-(id)initWithIdentifier:(id)identifier
{
  if ((self = [super initWithIdentifier:identifier])) {
    static int sTabItemTag = 1; // used to uniquely identify tabs for context menus  
    [self setTag:sTabItemTag];
    sTabItemTag++;

    mTabButtonView = [[TabButtonView alloc] initWithFrame:NSMakeRect(0, 0, 0, 0)
                                               andTabItem:self];
    
    // create a menu item, to be used when there are more tabs than screen real estate. keep a strong ref
    // since it will be added to and removed from the menu repeatedly
    mMenuItem = [[NSMenuItem alloc] initWithTitle:[self label] action:@selector(selectTab:) keyEquivalent:@""];
    [mMenuItem setTarget:self];

    [[self tabView] setAutoresizesSubviews:YES];

    mDraggable = NO;
  }
  return self;
}

-(void)dealloc
{	
  // We can either be closing a single tab here, in which case we need to remove our view
  // from the superview, or the tab view may be closing, in which case it has already
  // removed all its subviews.
  [mTabButtonView removeFromSuperview];   // may be noop
  [mTabButtonView release];
  [mTabIcon release];
  [mMenuItem release];
  [super dealloc];
}

- (TabButtonView*)buttonView
{
  return mTabButtonView;
}

- (void)setTag:(int)tag
{
  mTag = tag;
}

- (int)tag
{
  return mTag;
}

- (void)closeTab:(id)sender
{
  if ([[self view] browserShouldClose]) {
    [[self view] browserClosed];
    [[self tabView] removeTabViewItem:self];
  }
}

- (BOOL)draggable
{
  return mDraggable;
}

- (void)setLabel:(NSString *)label
{
  [super setLabel:label];
  [mMenuItem setTitle:[label stringByTruncatingTo:kMenuTruncationChars
                                               at:kTruncateAtMiddle]];
  [mTabButtonView setLabel:label];
}

-(NSImage *)tabIcon
{
  return mTabIcon;
}

- (void)setTabIcon:(NSImage *)newIcon isDraggable:(BOOL)draggable
{
  mDraggable = draggable;

  [mTabIcon autorelease];
  mTabIcon = [newIcon copy];

  [mMenuItem setImage:mTabIcon];
  [mTabButtonView setIcon:mTabIcon isDraggable:draggable];
}

- (void)willBeRemoved
{
  [mTabButtonView removeFromSuperview];
}

#pragma mark -

- (void)startLoadAnimation
{
  [mTabButtonView startLoadAnimation];
}

- (void)stopLoadAnimation
{
  [mTabButtonView stopLoadAnimation];
}

- (NSMenuItem *) menuItem
{
  return mMenuItem;
}

- (void) selectTab:(id)sender
{
  [[NSNotificationCenter defaultCenter] postNotificationName:kTabWillChangeNotifcation object:self];
  [[self tabView] selectTabViewItem:self];
}

// called by delegate when a tab will be deselected
- (void) willDeselect
{
  [mMenuItem setState:NSOffState];
}
// called by delegate when a tab will be selected
- (void) willSelect
{
  [mMenuItem setState:NSOnState];
}

#pragma mark -

+ (NSImage*)closeIcon
{
  static NSImage* sCloseIcon = nil;
  if ( !sCloseIcon )
    sCloseIcon = [[NSImage imageNamed:@"tab_close"] retain];
  return sCloseIcon;
}

+ (NSImage*)closeIconPressed
{
  static NSImage* sCloseIconPressed = nil;
  if ( !sCloseIconPressed )
    sCloseIconPressed = [[NSImage imageNamed:@"tab_close_pressed"] retain];
  return sCloseIconPressed;
}

+ (NSImage*)closeIconHover
{
  static NSImage* sCloseIconHover = nil;
  if ( !sCloseIconHover )
    sCloseIconHover = [[NSImage imageNamed:@"tab_close_hover"] retain];
  return sCloseIconHover;
}

@end
