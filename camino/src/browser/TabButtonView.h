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
 * Portions created by the Initial Developer are Copyright (C) 2007
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

#import <Cocoa/Cocoa.h>

@class BrowserTabViewItem;
@class TruncatingTextAndImageCell;
@class RolloverImageButton;

// A view for visible tab buttons; there is a one-to-one correspondence between
// a BrowserTabViewItem and a TabButtonView.
@interface TabButtonView : NSView
{
  BrowserTabViewItem*           mTabViewItem;       // weak ref
  RolloverImageButton*          mCloseButton;       // strong ref
  NSProgressIndicator*          mProgressWheel;     // strong ref
  TruncatingTextAndImageCell*   mLabelCell;         // strong ref
  NSRect                        mLabelRect;
  NSTrackingRectTag             mTrackingTag;
  BOOL                          mMouseWithin;
  BOOL                          mIsDragTarget;
  BOOL                          mSelectTabOnMouseUp;
  BOOL                          mNeedsDivider;
}

- (id)initWithFrame:(NSRect)frameRect andTabItem:(BrowserTabViewItem*)tabViewItem;

// Returns the associated tabViewItem
- (BrowserTabViewItem*)tabViewItem;

// Set the label on the tab. Truncation will be handled automatically.
- (void)setLabel:(NSString*)label;

// Set the icon on the tab, and whether or not the icon is draggable.
- (void)setIcon:(NSImage *)newIcon isDraggable:(BOOL)draggable;

// Enable or disable the close button.
- (void)setCloseButtonEnabled:(BOOL)isEnabled;

// Enable or disable draving of a right-side divider.
- (void)setDrawsDivider:(BOOL)drawsDivider;

// Start and stop the tab loading animation.
- (void)startLoadAnimation;
- (void)stopLoadAnimation;


// TODO: The following three methods should be removed from the public
// interface, and all tracking should be handled internally to the class

// Start tracking mouse movements.
- (void)addTrackingRect;
// Stop tracking mouse movements.
- (void)removeTrackingRect;
// Inform the view that it should re-evaluate the state of its mouse tracking.
- (void)updateHoverState:(BOOL)isHovered;

@end