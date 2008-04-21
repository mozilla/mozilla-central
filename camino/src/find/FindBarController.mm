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
 * Mike Pinkerton.
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
#import "FindBarController.h"

#import "BrowserWrapper.h"
#import "RolloverImageButton.h"
#import "NSWorkspace+Utils.h"


@interface FindBarController(Private)
- (void)lazyLoad;
- (void)setupCloseBox:(RolloverImageButton*)button;
- (void)putStringOnFindPasteboard:(NSString*)inStr;
- (NSString*)findPasteboardString;
- (void)doFindForwards:(BOOL)inNext;
@end


@implementation FindBarController

// TODO
// - turn bar red when there are no matches
// - hookup status text for wraparound (need to use FastFind?)
// - find all (requires converting Ff's custom JS to C++, there's no API)

- (id)initWithContent:(BrowserWrapper*)inContentView finder:(id<Find>)inFinder
{
  if ((self = [super init])) {
    mContentView = inContentView;
    mFinder = inFinder;
    // lazily load the nibs
  }
  return self;
}

- (void)dealloc
{
  // Balance the implicit retain from being a top-level nib object.
  [mFindBar release];

  [super dealloc];
}

//
// -lazyLoad
//
// We don't want to load a separate nib every time the user opens a browser 
// window, since we assume that most windows won't want the find bar. Load the
// nibs lazily and set them up when needed.
//
- (void)lazyLoad
{
  NSString* nibName;
  BOOL isLeopardOrHigher = [NSWorkspace isLeopardOrHigher];
  if (isLeopardOrHigher)
    nibName = @"FindBarTextured";
  else
    nibName = @"FindBar";
  BOOL success = [NSBundle loadNibNamed:nibName owner:self];
  if (!success) {
    NSLog(@"Error, couldn't load find bar. Find won't work");
    return;
  }
  
  [self setupCloseBox:mCloseBox];
  [mStatusText setStringValue:@""];
  if (isLeopardOrHigher) {
    // The textured buttons at regular size use a larger font size than the
    // status text that's right next to it, which looks bad. To work around it,
    // we use a smaller control in the nib (so that localizers are sizing the
    // button width based on the font size that will actually be used), then we
    // fix up the controlSize and height of the button as we load it.
    [[mMatchCase cell] setControlSize:NSRegularControlSize];
    NSSize buttonSize = [mMatchCase frame].size;
    buttonSize.height = [[mMatchCase cell] cellSize].height;
    [mMatchCase setFrameSize:buttonSize];
  }
}

//
// -showFindBar
//
// Makes the find bar visible and makes the search field take focus and sets
// its value to the contents of the find pasteboard.
//
- (void)showFindBar {
  if (!mFindBar)
    [self lazyLoad];

  [mStatusText setStringValue:@""];
  [mSearchField setStringValue:[self findPasteboardString]];
  [mContentView showFindBarView:mFindBar];
  [[mFindBar window] makeFirstResponder:mSearchField];
}

//
// -hideFindBar:
//
// Makes the find bar go away.
//
- (IBAction)hideFindBar:(id)sender {
  [mContentView showFindBarView:nil];
}

//
// -findNext:
// -findPrevious:
//
// Actions for the search field and the UI buttons.
//
- (IBAction)findNext:(id)sender
{
  [self doFindForwards:YES];
  // Return/enter ends editing and unfocuses the search field, which we don't
  // want. Rather than setting up a custom field editor, just force focus back
  // if it's not focused.
  if (![mSearchField currentEditor] ||
      [[mSearchField window] firstResponder] != [mSearchField currentEditor])
  {
    [[mSearchField window] makeFirstResponder:mSearchField];
  }
}

- (IBAction)findPrevious:(id)sender
{
  [self doFindForwards:NO];
}

//
// -findPreviousNextClicked:
//
// Action for the segmented previous/next button for 10.5+.
//
- (IBAction)findPreviousNextClicked:(id)sender
{
  if ([sender selectedSegment] == 0)
    [self doFindForwards:NO];
  else
    [self doFindForwards:YES];
}

//
// -toggleCaseSensitivity:
//
// Action for the case sensitivity button.
//
- (IBAction)toggleCaseSensitivity:(id)sender
{
  [self doFindForwards:YES];
}

//
// -doFindForwards:
//
// Tell gecko to find the text in the search field. |inNext| determines the direction,
// YES being forwards NO being backwards, which is actually the opposite of the
// way that Gecko wants it.
//
- (void)doFindForwards:(BOOL)inNext
{
  NSString* searchText = [mSearchField stringValue];
  if (![searchText length])
    return;
  BOOL caseSensitive = [mMatchCase state] == NSOnState;
  [self putStringOnFindPasteboard:searchText];
  BOOL success = [mFinder findInPageWithPattern:searchText caseSensitive:caseSensitive wrap:YES backwards:!inNext];

  [mStatusText setStringValue:(success ? NSLocalizedString(@"", nil) : NSLocalizedString(@"TextNotFound", nil))];
}

- (IBAction)findAll:(id)sender
{
  // alas, there's no API call to do this directly, firefox does it with a bunch of JS. Save
  // for someone with more free time. See
  //  toolkit/components/typeaheadfind/content/findBar.js
}

//
// -setupCloseBox
//
// Do some additional setup that we can't easily do in the nib.
//
- (void)setupCloseBox:(RolloverImageButton*)closebox
{
  [closebox setTitle:NSLocalizedString(@"CloseFindBarTitle", nil)];   // doesn't show, but used for accessibility
  [closebox setBezelStyle:NSShadowlessSquareBezelStyle];
  [closebox setImage:[NSImage imageNamed:@"tab_close"]];
  [closebox setImagePosition:NSImageOnly];
  [closebox setButtonType:NSMomentaryChangeButton];
  [closebox setBordered:NO];
  [closebox setAlternateImage:[NSImage imageNamed:@"tab_close_pressed"]];
  [closebox setHoverImage:[NSImage imageNamed:@"tab_close_hover"]];
}

//
// -control:textView:doCommandBySelector:
// delegate method
// 
// Hook in to handle the user hitting the escape key which will hide the bar
//
- (BOOL)control:(NSControl *)control textView:(NSTextView *)textView doCommandBySelector:(SEL)command
{
  if (command == @selector(cancelOperation:) || command == @selector(cancel:)) {
    [self hideFindBar:self];
    return YES;
  }
  return NO;
}

//
// -putStringOnFindPasteboard:
//
// Puts |inStr| on the find pasteboard.
//
- (void)putStringOnFindPasteboard:(NSString*)inStr
{
  NSPasteboard* pasteboard = [NSPasteboard pasteboardWithName:NSFindPboard];
  [pasteboard declareTypes:[NSArray arrayWithObject:NSStringPboardType] owner:nil];
  [pasteboard setString:inStr forType:NSStringPboardType];
}

//
// -findPasteboardString
//
// Retrieve the most recent search string
//
- (NSString*)findPasteboardString;
{
  NSString* searchText = @"";

  NSPasteboard* findPboard = [NSPasteboard pasteboardWithName:NSFindPboard];
  if ([[findPboard types] indexOfObject:NSStringPboardType] != NSNotFound)
    searchText = [findPboard stringForType:NSStringPboardType];

  return searchText;
}

@end

