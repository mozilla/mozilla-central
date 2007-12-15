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
 * Mike Pinkerton
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Pinkerton
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
#import "Find.h"

@class BrowserContentView;
@class RolloverImageButton;

// sent when the Find bar has left the window. Object is the find bar view.
#define kFindBarDidHideNotification @"FindBarDidHideNotification"


//
// FindBarController
//
// Manages showing and hiding the find bar in the UI, as well as dealing with
// the functionality of the find bar. This class doesn't actually implement
// anything to do with the actual find, but instead makes use of an object that
// implements to the |Find| protocol.
//
// Right now, this class only replaces the find dialog, it leaves the "find
// as you type" functionality embedded within gecko. We may one day want to
// pull it out into a separate find bar ui, like Ff. 
//
// The current search query is read from and written to the find pasteboard.
//

@interface FindBarController : NSObject
{
  IBOutlet NSView* mFindBar;
  IBOutlet NSSearchField* mSearchField;
  IBOutlet NSButton* mMatchCase;
  IBOutlet NSTextField* mStatusText;
  IBOutlet RolloverImageButton* mCloseBox;
  
  id<Find>  mFinder;                    // actually performs the find, weak
  BrowserContentView* mContentView;     // weak
}

- (id)initWithContent:(BrowserContentView*)inContentView finder:(id<Find>)inFinder;

// show and hide the various find bars. Showing the find bar sets the focus to
// the search field. Hiding the bar posts the |kFindBarDidHideNotification|
// notification.
- (void)showFindBar;
- (IBAction)hideFindBar:(id)sender;

- (IBAction)findNext:(id)sender;
- (IBAction)findPrevious:(id)sender;
- (IBAction)findAll:(id)sender;

@end
