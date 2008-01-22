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
 * Bryan Atwood
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bryan Atwood <bryan.h.atwood@gmail.com>
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

#import "FormFillPopup.h"
#import "FormFillController.h"

@implementation FormFillPopupWindow

- (BOOL)isKeyWindow
{
  return YES;
}

@end

@interface FormFillPopup(Private)

- (void)onRowClicked:(NSNotification *)aNote;

@end

@implementation FormFillPopup

- (id)init
{
  if ((self = [super init])) {
    // Construct and configure the popup window.
    mPopupWin = [[FormFillPopupWindow alloc] initWithContentRect:NSMakeRect(0,0,0,0)
                                                       styleMask:NSNonactivatingPanelMask
                                                         backing:NSBackingStoreBuffered
                                                           defer:NO];

    [mPopupWin setReleasedWhenClosed:NO];
    [mPopupWin setHasShadow:YES];
    [mPopupWin setAlphaValue:0.9];

    // Construct and configure the view.
    mTableView = [[[NSTableView alloc] initWithFrame:NSMakeRect(0,0,0,0)] autorelease];
    [mTableView setIntercellSpacing:NSMakeSize(1, 2)];
    [mTableView setTarget:self];
    [mTableView setAction:@selector(onRowClicked:)];

    // Create the text column (only one).
    NSTableColumn* column = [[[NSTableColumn alloc] initWithIdentifier:@"usernames"] autorelease];
    [mTableView addTableColumn:column];

    // Hide the table header.
    [mTableView setHeaderView:nil];

    [mTableView setDataSource:self];

    NSScrollView *scrollView = [[[NSScrollView alloc] initWithFrame:NSMakeRect(0,0,0,0)] autorelease];
    [scrollView setHasVerticalScroller:YES];
    [scrollView setAutohidesScrollers:YES];
    [[scrollView verticalScroller] setControlSize:NSSmallControlSize];
    
    [scrollView setDocumentView:mTableView];

    [mPopupWin setContentView:scrollView];
  }

  return self;
}

- (void)dealloc
{
  [mPopupWin release];
  [mItems release];

  [super dealloc];
}

- (void)attachToController:(FormFillController*)controller
{
  mController = controller;
}

- (BOOL)isPopupOpen
{
  return [mPopupWin isVisible];
}

- (void)openPopup:(NSWindow*)browserWindow withOrigin:(NSPoint)origin width:(float)width
{
  // Set the size of the popup window.
  NSRect tableViewFrame = [mTableView frame];
  tableViewFrame.size.width = width;
  [mTableView setFrame:tableViewFrame];

  // Size the panel correctly.
  tableViewFrame.size.height = (int)([mTableView rowHeight] + [mTableView intercellSpacing].height) * [self visibleRows];
  [mPopupWin setContentSize:tableViewFrame.size];
  [mPopupWin setFrameTopLeftPoint:origin];

  // Show the popup.
  if (![mPopupWin isVisible]) {
    [browserWindow addChildWindow:mPopupWin ordered:NSWindowAbove];
    [mPopupWin orderFront:nil];
  }
}

- (void)resizePopup
{
  // Don't resize if popup isn't visible.
  if (![mPopupWin isVisible])
    return;

  if ([self visibleRows] == 0) {
    [self closePopup];
    return;
  }

  NSRect popupWinFrame = [mPopupWin frame];
  int tableHeight = (int)([mTableView rowHeight] + [mTableView intercellSpacing].height) * [self visibleRows];

  popupWinFrame.origin.y += NSHeight(popupWinFrame) - tableHeight;
  popupWinFrame.size.height = tableHeight;

  [mPopupWin setFrame:popupWinFrame display:YES];
}

- (void)closePopup
{
  // We can get -closePopup even if we didn't show it.
  if ([mPopupWin isVisible]) {
    [[mPopupWin parentWindow] removeChildWindow:mPopupWin];
    [mPopupWin orderOut:nil];
    [[NSNotificationCenter defaultCenter] removeObserver:self];
  }
}

- (void)onRowClicked:(NSNotification *)aNote
{
  [mController popupSelected];
  [self closePopup];
}

- (int)visibleRows
{
   int minRows = [self rowCount];
   return (minRows < kFormFillMaxRows) ? minRows : kFormFillMaxRows;
}

- (int)rowCount
{
  if (!mItems)
    return 0;

  return [mItems count];
}

- (void)selectRow:(int)index
{
  if (index == -1)
    [mTableView deselectAll:self];
  else {
    [mTableView selectRowIndexes:[NSIndexSet indexSetWithIndex:index] byExtendingSelection:NO];
    [mTableView scrollRowToVisible:index];
  }
}

- (int)selectedRow
{
  return [mTableView selectedRow];
}

- (NSString*)resultForRow:(int)index
{
  return [mItems objectAtIndex:index];
}

- (void)setItems:(NSArray*)items
{
  if (items != mItems) {
    [mItems release];
    mItems = [items retain];
  }

  // Update the view any time we get new data
  [mTableView noteNumberOfRowsChanged]; 
  [self resizePopup];
}

// methods for table view interaction
-(int)numberOfRowsInTableView:(NSTableView*)aTableView
{
  return [self rowCount];
}

-(id)tableView:(NSTableView*)aTableView objectValueForTableColumn:(NSTableColumn*)aTableColumn row:(int)aRowIndex
{
  return [self resultForRow:aRowIndex];
}

@end
