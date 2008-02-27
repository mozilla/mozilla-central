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
* Jeff Dlouhy.
* Portions created by the Initial Developer are Copyright (C) 2007
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Jeff Dlouhy <Jeff.Dlouhy@gmail.com>
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

#import "TabThumbnailGridView.h"
#import "ThumbnailView.h"

#import "MainController.h"

#import "BrowserWindowController.h"
#import "BrowserTabViewItem.h"
#import "BrowserWrapper.h"
#import "CHGradient.h"
#import "NSView+Utils.h"

const int kVerticalPadding = 25;
const int kHorizontalPadding = 25;

@interface TabThumbnailGridView (Private)
- (void)updateGridSizeFor:(int)num;
- (void)layoutThumbnails;
- (void)createThumbnailViews;
@end

@implementation TabThumbnailGridView

#pragma mark NSView

- (BOOL)isFlipped
{
  return YES;
}

//
// Updates the grid when the frame size changes
//
- (void)resizeSubviewsWithOldSize:(NSSize)oldBoundsSize
{
  [self layoutThumbnails];
}

- (void)drawRect:(NSRect)rect
{
  CHGradient* gradient =
    [[[CHGradient alloc] initWithStartingColor:[NSColor colorWithDeviceWhite:(250.0/255.0)
                                                                       alpha:1.0]
                                   endingColor:[NSColor colorWithDeviceWhite:(200.0/255.0)
                                                                       alpha:1.0]] autorelease];
  [gradient drawInRect:[self bounds] angle:90.0];
}

#pragma mark Private

//
// Takes thumbnails of the open tabs in a window then creates a
// ThumbnailView for each and adds it as a subview
//
- (void)createThumbnailViews
{
  // Browser wrapper is used here since moving CHBrowserView disconnects needed attributes (i.e. URL)
  // The window isn't hooked up yet, so go through the superview
  BrowserWindowController* bwc = (BrowserWindowController*)[[[self superview] window] windowController];
  BrowserTabView* tabView = [bwc tabBrowser];
  NSArray* openTabs = [tabView tabViewItems];

  NSEnumerator* tabEnum = [openTabs objectEnumerator];
  BrowserTabViewItem* tabViewItem;

  while ((tabViewItem = [tabEnum nextObject])) {
    NSImage* thumb = [[[tabViewItem view] browserView] snapshot];
    if (!thumb)
      continue;
    ThumbnailView* curThumbView = [[[ThumbnailView alloc] init] autorelease];

    if (curThumbView) {
      [curThumbView setThumbnail:thumb];
      [curThumbView setRepresentedObject:tabViewItem];
      [curThumbView setTitle:[tabViewItem label]];
      [curThumbView setDelegate:self];
      [self addSubview:curThumbView];
    }
  }

  [self layoutThumbnails];
}

//
// Draw the views when it's added to a view
//
- (void)viewDidMoveToSuperview
{
  if ([self superview])
    [self createThumbnailViews];
  else
    [self removeAllSubviews];
}

//
// Change the tab to the selected ThumbnailView
//
- (void)thumbnailViewWasSelected:(ThumbnailView*)selectedView
{
  BrowserWindowController* bwc = (BrowserWindowController*)[[self window] windowController];
  BrowserTabView* tabView = [bwc tabBrowser];

  [tabView selectTabViewItem:[selectedView representedObject]];
  [bwc toggleTabThumbnailView:self];
}

//
// Update the grid size based on the number of images
// This tries to keep the grid as square as possible with a
// max of n - 1 views on the bottom row when num is odd
//
- (void)updateGridSizeFor:(int)num
{
  mNumCols = ceilf(sqrtf(num));
  mNumRows = ceilf((float) num / mNumCols);
}

//
// Calculates where each of the subviews should be drawn
// then sets each of their frames
//
- (void)layoutThumbnails
{
  [self updateGridSizeFor:[[self subviews] count]];
  NSSize viewSize = [self bounds].size;
  float aspectRatio = viewSize.width / viewSize.height;
  float subviewWidth = (viewSize.width - (kHorizontalPadding * (mNumCols + 1))) / mNumCols;
  float subviewHeight = subviewWidth / aspectRatio;

  float newX = kHorizontalPadding;
  // Centers the grid vertically
  float newY = kVerticalPadding + ((viewSize.height - ((mNumRows * subviewHeight) + ((mNumRows + 1) * kVerticalPadding))) / 2);

  // This will allow us to center the last row if # of views is < mNumCols
  unsigned int firstItemInLastRow = ((mNumRows - 1) * mNumCols);
  unsigned int numItemsInLastRow = ([[self subviews] count] - firstItemInLastRow);

  unsigned int rowCount = 0;
  unsigned int totalCount = 0;

  while (rowCount < mNumRows) {
    for (unsigned int x = 0; x < mNumCols && totalCount < [[self subviews] count]; x++) {
      NSRect frame = NSMakeRect(newX, newY, subviewWidth, subviewHeight);
      [[[self subviews] objectAtIndex:totalCount++] setFrame:frame];
      newX += kHorizontalPadding + subviewWidth;
    }

    // Once we are done with a row we add on to the y and move on
    // The newX will be centered if the last row has less views than mNumCol
    if (totalCount == firstItemInLastRow && numItemsInLastRow != mNumCols)
      newX = kHorizontalPadding + ((viewSize.width - (kHorizontalPadding + (numItemsInLastRow * (subviewWidth + kHorizontalPadding)))) / 2);
    else
      newX = kHorizontalPadding;

    newY += kVerticalPadding + subviewHeight;
    rowCount++;
  }
}

@end
