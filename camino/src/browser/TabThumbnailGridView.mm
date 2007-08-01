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

const int kVerticalPadding = 25;
const int kHorizontalPadding = 25;

static CGColorSpaceRef sGenericGreyColorSpace = NULL;

static void drawGradientBackground(CGContextRef context, NSRect rect);
static void VerticalGrayGradient(void* inInfo, float const* inData, float* outData);
static void shadeBackground(CGContextRef context, NSRect rect);
CGColorSpaceRef getTheGreyColorSpace(void);

@interface TabThumbnailGridView (Private)
- (void)removeSubviews;
- (void)updateGridSizeFor:(int)num;
- (void)layoutThumbnails;
- (void)createThumbnailViews;
- (NSImage*)imageWithScreenShotInTabViewItem:(BrowserTabViewItem*)tabViewItem;
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
  CGContextRef context = (CGContextRef)[[NSGraphicsContext currentContext] graphicsPort];
  drawGradientBackground(context, [self frame]);
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
  BrowserWindowController* bwc = [[[self superview] window] windowController];
  BrowserTabView* tabView = [bwc getTabBrowser];
  NSArray* openTabs = [tabView tabViewItems];

  NSEnumerator* tabEnum = [openTabs objectEnumerator];
  BrowserTabViewItem* tabViewItem;

  while ((tabViewItem = [tabEnum nextObject])) {
    NSImage* thumb = [self imageWithScreenShotInTabViewItem:tabViewItem];
    ThumbnailView* curThumbView = [[[ThumbnailView alloc] init] autorelease];

    if (curThumbView) {
      [curThumbView setThumbnail:thumb];
      [self addSubview:curThumbView];
    }
  }

  [self layoutThumbnails];
}

- (void)removeSubviews
{
  NSEnumerator* subEnum = [[self subviews] objectEnumerator];
  ThumbnailView* subview;
  while ((subview = [subEnum nextObject]))
    [subview removeFromSuperview];
}

//
// Draw the views when it's added to a view
//
- (void)viewDidMoveToSuperview
{
  if ([self superview])
    [self createThumbnailViews];
  else
    [self removeSubviews];
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

//
// Draws the given view on a window placed offscreen and takes a screenshot
//
- (NSImage*)imageWithScreenShotInTabViewItem:(BrowserTabViewItem*)tabViewItem
{
  BrowserWrapper* browserWrapper = [[[tabViewItem view] retain] autorelease];
  NSRect bounds = [browserWrapper bounds];
  NSSize windowSize = bounds.size;

  NSRect offscreenRect = NSMakeRect(0, 0, windowSize.width, windowSize.height);

  NSWindow* offscreenWindow = [[NSWindow alloc] initWithContentRect:offscreenRect
                                                          styleMask:NSBorderlessWindowMask
                                                            backing:NSBackingStoreRetained
                                                              defer:NO];

  NSView* placeholderView = [[[NSView alloc] initWithFrame:[browserWrapper frame]] autorelease];
  [tabViewItem setView:placeholderView];

  [offscreenWindow setContentView:browserWrapper];
  [[offscreenWindow contentView] display];

  // Create the NSBitmapImageRep
  [[offscreenWindow contentView] lockFocus];
  NSBitmapImageRep* rep = [[NSBitmapImageRep alloc] initWithFocusedViewRect:offscreenRect];

  // Puts the tab's view back where it came from
  [tabViewItem setView:browserWrapper];

  // Clean up and delete the window, which is no longer needed.
  [[offscreenWindow contentView] unlockFocus];
  [offscreenWindow release];

  // Create an image with the representation
  NSImage* image = [[[NSImage alloc] initWithSize:[rep size]] autorelease];
  [image addRepresentation:rep];
  [rep release];

  return image;
}

#pragma mark Core Graphics

//
// Rotates the context and shades the background
//
static void drawGradientBackground(CGContextRef context, NSRect rect)
{
  CGContextSaveGState(context);
  CGContextRotateCTM(context, M_PI/2);
  shadeBackground(context,rect);
  CGContextRestoreGState(context);
}

//
// Callback function that calculates a grey gradient
//
static void VerticalGrayGradient(void* inInfo, float const* inData, float* outData)
{
  float* grays = NS_STATIC_CAST(float*, inInfo);
  outData[0] = (1.0-inData[0])*grays[0] + inData[0]*grays[1];
  outData[1] = 1.0;
}

//
// Creates an axial shading and draws it to the context
//
static void shadeBackground(CGContextRef context, NSRect rect)
{
  CGFunctionRef axialFunction;
  CGShadingRef shading;
  CGPoint startPoint, endPoint;
  bool extendStart, extendEnd;

  float grays[2] = {250.0/255.0, 200.0/255.0};

  struct CGFunctionCallbacks callbacks = {0, VerticalGrayGradient, NULL};
  axialFunction = CGFunctionCreate(grays, 1, NULL, 2, NULL, &callbacks);

  // The shading needs a function with 1 in and 4 outs
  if (axialFunction == NULL)
    return;

  // X's and Y's are flipped due to the context being rotated
  startPoint.x = 0;
  startPoint.y = rect.size.width;
  endPoint.x = rect.size.height;
  endPoint.y = rect.size.width;

  // Don't extend the shading, it's shady enough
  extendStart = extendEnd = false;

  shading = CGShadingCreateAxial(getTheGreyColorSpace(),
                                 startPoint, endPoint, axialFunction, extendStart, extendEnd);

  // axialFuncion begone!
  CGFunctionRelease(axialFunction);

  if (shading == NULL) {
    NSLog(@"Couldn't create the shading!");
    return;
  }

  // Draw then release
  CGContextDrawShading(context, shading);
  CGShadingRelease(shading);
}

//
// Returns the current Generic Grey Color Space
//
CGColorSpaceRef getTheGreyColorSpace(void)
{
  if (sGenericGreyColorSpace == NULL) {

    // If the kCGColorSpaceUserGray is available, use it
    if (&kCGColorSpaceGenericGray != NULL) {
      sGenericGreyColorSpace = CGColorSpaceCreateWithName(kCGColorSpaceGenericGray);

      // If it's still NULL use the device grey
      if (sGenericGreyColorSpace == NULL)
        sGenericGreyColorSpace = CGColorSpaceCreateDeviceGray();
    }
  }

  return sGenericGreyColorSpace;
}

@end
