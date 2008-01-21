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

#import <Cocoa/Cocoa.h>

@class FormFillController;

//
// FormFillPopupWindow
//
// The popup window needs to look like a "key" (activated) window even thought it's
// a child window. This subclass overrides |isKeyWindow| to return YES so that it is
// able to be a key window (and have activated scrollbars, etc) but not steal focus.
//
@interface FormFillPopupWindow : NSPanel
@end

// FormFillPopup
//
// Manages the display of the popup window and receives data from the FormFillController.
//
@interface FormFillPopup : NSObject
{
  FormFillPopupWindow*  mPopupWin;        // strong
  NSArray*              mItems;           // strong

  NSTableView*          mTableView;       // weak
  FormFillController*   mController;      // weak
}

- (void)attachToController:(FormFillController*)controller;

// openPopup expects an origin point in Cocoa coordinates and a width that
// should be equal to the text box.
- (void)openPopup:(NSWindow*)browserWindow withOrigin:(NSPoint)origin width:(float)width;
- (void)resizePopup;
- (void)closePopup;
- (BOOL)isPopupOpen;

- (int)visibleRows;
- (int)rowCount;
- (void)selectRow:(int)index;
- (int)selectedRow;

- (void)setItems:(NSArray*)items;
- (NSString*)resultForRow:(int)index;

@end
