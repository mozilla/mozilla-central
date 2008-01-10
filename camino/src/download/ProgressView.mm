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
 * Josh Aas.
 * Portions created by the Initial Developer are Copyright (C) 2003
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Josh Aas <josh@mozilla.com>
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


#import "ProgressView.h"

#import "ProgressViewController.h"

@implementation ProgressView

- (void)dealloc
{
  [mFileIconMouseDownEvent release];
  [super dealloc];
}

-(void)drawRect:(NSRect)rect
{
  if ([mProgressController isSelected]) {
    [[NSColor selectedTextBackgroundColor] set];
  }
  else {
    [[NSColor whiteColor] set];
  }
  [NSBezierPath fillRect:[self bounds]];
}

-(void)mouseDown:(NSEvent*)theEvent
{
  unsigned int mods = [theEvent modifierFlags];
  DownloadSelectionBehavior selectionBehavior;
  // Favor command behavior over shift, like most table views do
  if (mods & NSCommandKeyMask)
    selectionBehavior = DownloadSelectByInverting;
  else if (mods & NSShiftKeyMask)
    selectionBehavior = DownloadSelectByExtending;
  else
    selectionBehavior = DownloadSelectExclusively;
  [mProgressController updateSelectionWithBehavior:selectionBehavior];

  [mFileIconMouseDownEvent release];
  mFileIconMouseDownEvent = nil;
  if ([theEvent type] == NSLeftMouseDown) {
    // See if it's a double-click; if so, send a notification off to the
    // controller which will handle it accordingly. Doing it after processing
    // the selection change allows someone to shift-double-click and open all
    // selected items in the list in one action.
    if ([theEvent clickCount] == 2) {
      [mProgressController openSelectedDownloads];
    }
    // If not, and the download isn't active, see if it's a click on the icon.
    else if (![mProgressController isActive]) {
      NSPoint clickPoint = [self convertPoint:[theEvent locationInWindow] fromView:nil];
      if (NSPointInRect(clickPoint, [mFileIconView frame]))
        mFileIconMouseDownEvent = [theEvent retain];
    }
  }
}

- (BOOL)acceptsFirstMouse:(NSEvent*)theEvent {
  // Allow click-through on the file icon to allow dragging files even if the
  // view is in a background window.
  NSPoint clickPoint = [self convertPoint:[theEvent locationInWindow] fromView:nil];
  return NSPointInRect(clickPoint, [mFileIconView frame]);
}

- (void)mouseDragged:(NSEvent*)aEvent
{
  if (!mFileIconMouseDownEvent)
    return;

  // Check that the controller thinks this view represents a file we know about,
  // but also that the file is actually still there in case the controller's
  // information is stale.
  if (![mProgressController fileExists])
    return;
  NSString* filePath = [mProgressController representedFilePath];
  if (!(filePath && [[NSFileManager defaultManager] fileExistsAtPath:filePath]))
    return;

  NSPasteboard* pasteboard = [NSPasteboard pasteboardWithName:NSDragPboard];
  [pasteboard declareTypes:[NSArray arrayWithObject:NSFilenamesPboardType] owner:nil];
  [pasteboard setPropertyList:[NSArray arrayWithObject:filePath] forType:NSFilenamesPboardType];

  NSRect fileIconFrame = [mFileIconView frame];

  NSImage* dragImage = [[[NSImage alloc] initWithSize:fileIconFrame.size] autorelease];
  [dragImage lockFocus];
  NSRect imageRect = NSMakeRect(0, 0, fileIconFrame.size.width, fileIconFrame.size.height);
  [[mFileIconView image] drawAtPoint:NSMakePoint(0, 0)
                           fromRect:imageRect
                          operation:NSCompositeCopy
                           fraction:0.8];
  [dragImage unlockFocus];

  NSPoint clickLocation = [self convertPoint:[mFileIconMouseDownEvent locationInWindow] fromView:nil];
  [self dragImage:dragImage
               at:fileIconFrame.origin
           offset:NSMakeSize(clickLocation.x - fileIconFrame.origin.x,
                             clickLocation.y - fileIconFrame.origin.y)
            event:mFileIconMouseDownEvent
       pasteboard:pasteboard
           source:self
        slideBack:YES];
}

- (unsigned int)draggingSourceOperationMaskForLocal:(BOOL)localFlag
{
  return NSDragOperationEvery;
}

- (void)draggedImage:(NSImage *)anImage endedAt:(NSPoint)aPoint operation:(NSDragOperation)operation
{
  if (operation == NSDragOperationDelete) {
    [mProgressController deleteFile];
    [mProgressController remove:self];
  }
  if (operation == NSDragOperationMove)
    [mProgressController remove:self];
}

-(void)setController:(ProgressViewController*)controller
{
  mProgressController = controller;
}

-(ProgressViewController*)controller
{
  return mProgressController;
}

-(NSMenu*)menuForEvent:(NSEvent*)theEvent
{  
  // if the item is unselected, select it and deselect everything else before displaying the contextual menu
  if (![mProgressController isSelected]) {
    [mProgressController updateSelectionWithBehavior:DownloadSelectExclusively];
    [self display]; // change visual selection immediately
  }
  return [[self controller] contextualMenu];
}

-(BOOL)performKeyEquivalent:(NSEvent*)theEvent
{
  // Catch a command-period key down event and send the cancel request
  if (([theEvent type] == NSKeyDown && 
      ([theEvent modifierFlags] & NSCommandKeyMask) != 0) && 
      [[theEvent characters] isEqualToString:@"."]) 
  {
    [mProgressController cancelSelectedDownloads];
    return YES;
  }
  
  return [super performKeyEquivalent:theEvent];
}

-(NSView*)hitTest:(NSPoint)aPoint
{
  if (NSMouseInRect(aPoint, [self frame], YES)) {
    return self;
  }
  else {
    return nil;
  }
}

@end
