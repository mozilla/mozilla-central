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

#import "ThumbnailView.h"

static const int kShadowX = 0;
static const int kShadowY = -3;
static const int kShadowRadius = 5;
static const int kShadowPadding = 5;
static const int kThumbnailTitleHeight = 20;

@implementation ThumbnailView

- (id)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    mThumbnail = nil;
    mTitleCell = [[NSCell alloc] initTextCell:@""];
    [mTitleCell setAlignment:NSCenterTextAlignment];
  }

  return self;
}

- (void)setThumbnail:(NSImage*)image
{
  if (image != mThumbnail) {
    [mThumbnail release];
    mThumbnail = [image retain];
  }
}

- (void)setTitle:(NSString*)title
{
  [mTitleCell setTitle:title];
}

- (void)setRepresentedObject:(id)object
{
  if (mRepresentedObject != object) {
    [mRepresentedObject release];
    mRepresentedObject = [object retain];
  }
}

- (id)representedObject;
{
  return mRepresentedObject;
}

- (void)setDelegate:(id)delegate
{
  mDelegate = delegate;
}

- (id)delegate
{ 
  return mDelegate;
}

- (void)drawRect:(NSRect)rect
{
  NSShadow* shadow = [[[NSShadow alloc] init] autorelease];
  [shadow setShadowOffset:NSMakeSize(kShadowX, kShadowY)];
  [shadow setShadowBlurRadius:kShadowRadius];
  [shadow set];

  NSRect thumbnailImageRect;
  NSRect thumbnailTitleRect;
  NSDivideRect([self bounds], &thumbnailTitleRect, &thumbnailImageRect, kThumbnailTitleHeight, NSMinYEdge);

  if (mThumbnail) {
    [[NSGraphicsContext currentContext] setImageInterpolation:NSImageInterpolationHigh];
    [mThumbnail setScalesWhenResized:YES];

    [mThumbnail drawInRect:NSInsetRect(thumbnailImageRect, kShadowPadding, kShadowPadding)
                  fromRect:NSZeroRect
                 operation:NSCompositeSourceOver
                  fraction:1];
  }

  if (mTitleCell)
    [mTitleCell drawWithFrame:thumbnailTitleRect inView:self];
}

- (void)mouseUp:(NSEvent*)theEvent
{
  if ([mDelegate respondsToSelector:@selector(thumbnailViewWasSelected:)])
    [mDelegate thumbnailViewWasSelected:self];
}

- (void)dealloc
{
  [mThumbnail release];
  [mTitleCell release];
  [mRepresentedObject release];
  [super dealloc];
}

@end
