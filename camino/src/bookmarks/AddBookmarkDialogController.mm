/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

#import "NSString+Utils.h"

#import "BookmarkFolder.h"
#import "Bookmark.h"
#import "BookmarkManager.h"

#import "BookmarkViewController.h"
#import "UserDefaults.h"

#import "AddBookmarkDialogController.h"

NSString* const kAddBookmarkItemURLKey        = @"url";
NSString* const kAddBookmarkItemTitleKey      = @"title";
NSString* const kAddBookmarkItemPrimaryTabKey = @"primary";

static NSString* BookmarkUrlForItem(NSDictionary* inItem) {
  return [inItem objectForKey:kAddBookmarkItemURLKey];
}

static NSString* BookmarkTitleForItem(NSDictionary* inItem) {
  NSString* bookmarkTitle = [inItem objectForKey:kAddBookmarkItemTitleKey];
  bookmarkTitle  = [bookmarkTitle stringByReplacingCharactersInSet:[NSCharacterSet controlCharacterSet] withString:@" "];
  if (!bookmarkTitle || ![bookmarkTitle length])
    bookmarkTitle = BookmarkUrlForItem(inItem);
  return bookmarkTitle;
}

static NSDictionary* PrimaryBookmarkItem(NSArray* inItems) {
  NSEnumerator* itemsEnum = [inItems objectEnumerator];
  id curItem;
  while ((curItem = [itemsEnum nextObject])) {
    if ([[curItem objectForKey:kAddBookmarkItemPrimaryTabKey] boolValue])
      return curItem;
  }

  if ([inItems count] > 0)
    return [inItems objectAtIndex:0];

  return nil;
}

#pragma mark -

@interface AddBookmarkDialogController(Private)

- (void)sheetDidEnd:(NSWindow*)sheet
         returnCode:(int)returnCode
        contextInfo:(void*)contextInfo;

- (void)updateTitle:(BOOL)isTabGroup;

- (void)buildBookmarksFolderPopup;
- (void)createBookmarks;

@end

#pragma mark -

@implementation AddBookmarkDialogController

+ (AddBookmarkDialogController*)controller {
  return [[[AddBookmarkDialogController alloc] initWithWindowNibName:@"AddBookmark"] autorelease];
}

- (id)initWithWindowNibName:(NSString*)windowNibName
{
  if ((self = [super initWithWindowNibName:windowNibName])) {
    // Remember the last bookmark folder used in the dialog's popup menu
    NSString* uuid = [[NSUserDefaults standardUserDefaults] objectForKey:USER_DEFAULTS_LAST_SELECTED_BM_FOLDER];
    if (uuid && ![uuid isEqualToString:@""]) {
      BookmarkFolder* foundFolder = (BookmarkFolder*)[[[BookmarkManager sharedBookmarkManager] rootBookmarks] itemWithUUID:uuid];
      if (foundFolder)
        [self setDefaultParentFolder:foundFolder andIndex:-1];
    }
  }
  return self;
}

- (void)dealloc
{
  [mInitialParentFolder release];
  [mDefaultTitle release];
  [mBookmarkItems release];

  [super dealloc];
}

- (IBAction)confirmAddBookmark:(id)sender
{
  BookmarkItem* selectedItem = [[mParentFolderPopup selectedItem] representedObject];
  [[NSUserDefaults standardUserDefaults] setObject:[selectedItem UUID] forKey:USER_DEFAULTS_LAST_SELECTED_BM_FOLDER];
  [self setDefaultParentFolder:(BookmarkFolder*)selectedItem andIndex:-1];

  [self createBookmarks];

  [[self window] orderOut:self];
  [NSApp endSheet:[self window] returnCode:1];  // releases self
}

- (IBAction)cancelAddBookmark:(id)sender
{
  [[self window] orderOut:self];
  [NSApp endSheet:[self window] returnCode:1];  // releases self
}

- (IBAction)parentFolderChanged:(id)sender
{
  mInitialParentFolderIndex = -1;
}

- (IBAction)toggleTabGroup:(id)sender
{
  BOOL isTabGroup = ([mTabGroupCheckbox state] == NSOnState);
  [self updateTitle:isTabGroup];
}

- (void)makeTabGroup:(BOOL)isTabGroup
{
  [mTabGroupCheckbox setState:(isTabGroup ? NSOnState : NSOffState)];
  [self updateTitle:isTabGroup];
}

- (void)updateTitle:(BOOL)isTabGroup
{
  NSString* defaultGroupTitle = [NSString stringWithFormat:NSLocalizedString(@"defaultTabGroupTitle", @"[%d tabs] %@"),
                                                           [mBookmarkItems count],
                                                           mDefaultTitle];

  // If the title is unedited, update to the default name
  if ([[mTitleField stringValue] isEqualToString:mDefaultTitle] ||
      [[mTitleField stringValue] isEqualToString:defaultGroupTitle])
    [mTitleField setStringValue:(isTabGroup ? defaultGroupTitle : mDefaultTitle)];
}

- (void)setDefaultTitle:(NSString*)aString
{
  [mDefaultTitle release];
  mDefaultTitle = [aString retain];
}

// -1 index means put at end
- (void)setDefaultParentFolder:(BookmarkFolder*)inFolder andIndex:(int)inIndex
{
  [mInitialParentFolder release];
  mInitialParentFolder = [inFolder retain];
  mInitialParentFolderIndex = inIndex;
}

- (void)setBookmarkViewController:(BookmarkViewController*)inBMViewController
{
  mBookmarkViewController = inBMViewController;
}

- (void)showDialogWithLocationsAndTitles:(NSArray*)inItems isFolder:(BOOL)inIsFolder onWindow:(NSWindow*)inWindow
{
  [self window];  // force nib loading

  if (!inIsFolder && [inItems count] == 0)
    return;

  [mBookmarkItems release];
  mBookmarkItems = [inItems retain];

  if (inIsFolder) {
    [self setDefaultTitle:NSLocalizedString(@"NewBookmarkFolder", nil)];
    [mTabGroupCheckbox removeFromSuperview];
    mTabGroupCheckbox = nil;
  }
  else {
    [self setDefaultTitle:BookmarkTitleForItem(PrimaryBookmarkItem(inItems))];
    if ([inItems count] == 1) {
      [mTabGroupCheckbox setEnabled:NO];
    }
  }

  [mTitleField setStringValue:mDefaultTitle];

  [self buildBookmarksFolderPopup];

  [self retain];  // will release when dismissed in sheetDidEnd:...
  [NSApp beginSheet:[self window]
     modalForWindow:inWindow
      modalDelegate:self
     didEndSelector:@selector(sheetDidEnd:returnCode:contextInfo:)
        contextInfo:nil];
}

- (void)sheetDidEnd:(NSWindow*)sheet
         returnCode:(int)returnCode
        contextInfo:(void*)contextInfo {
  [self release];
}

#pragma mark -

- (void)buildBookmarksFolderPopup
{
  BookmarkManager* bookmarkManager = [BookmarkManager sharedBookmarkManager];
  [mParentFolderPopup removeAllItems];
  [[bookmarkManager rootBookmarks] buildFlatFolderList:[mParentFolderPopup menu] depth:1];

  BookmarkFolder* initialFolder = mInitialParentFolder;
  if (!initialFolder)
    initialFolder = [bookmarkManager lastUsedBookmarkFolder];

  int initialItemIndex = [[mParentFolderPopup menu] indexOfItemWithRepresentedObject:initialFolder];
  if (initialItemIndex != -1)
    [mParentFolderPopup selectItemAtIndex:initialItemIndex];

  [mParentFolderPopup synchronizeTitleAndSelectedItem];
}

- (void)createBookmarks
{
  BookmarkFolder* parentFolder = [[mParentFolderPopup selectedItem] representedObject];
  NSString*       titleString  = [mTitleField stringValue];

  BookmarkItem* newItem = nil;
  unsigned int  insertPosition = (mInitialParentFolderIndex != -1) ? mInitialParentFolderIndex : [parentFolder count];

  if (!mTabGroupCheckbox) {
    // No checkbox means to create a folder
    newItem = [parentFolder addBookmarkFolder:titleString inPosition:insertPosition isGroup:NO];
  }
  else if (([mBookmarkItems count] > 1) &&
           ([mTabGroupCheckbox state] == NSOnState)) {
    // bookmark all tabs
    BookmarkFolder* newGroup = [parentFolder addBookmarkFolder:titleString inPosition:insertPosition isGroup:YES];

    unsigned int numItems = [mBookmarkItems count];
    for (unsigned int i = 0; i < numItems; i++) {
      id curItem = [mBookmarkItems objectAtIndex:i];
      NSString* itemURL   = BookmarkUrlForItem(curItem);
      NSString* itemTitle = BookmarkTitleForItem(curItem);

      newItem = [Bookmark bookmarkWithTitle:itemTitle url:itemURL];
      [newGroup insertChild:newItem atIndex:i isMove:NO];
    }
  }
  else {
    // Bookmark a single item
    id curItem = PrimaryBookmarkItem(mBookmarkItems);

    NSString* itemURL = BookmarkUrlForItem(curItem);

    newItem = [Bookmark bookmarkWithTitle:titleString url:itemURL];
    [parentFolder insertChild:newItem atIndex:insertPosition isMove:NO];
  }

  [mBookmarkViewController revealItem:newItem scrollIntoView:YES selecting:YES byExtendingSelection:NO];
  [[BookmarkManager sharedBookmarkManager] setLastUsedBookmarkFolder:parentFolder];
}

@end
