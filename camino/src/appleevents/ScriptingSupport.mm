/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Peter Jaros <peter.a.jaros@gmail.com> (Original Author)
 *   David Haas <haasd@cae.wisc.edu>
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

#import "MainController.h"
#import "BrowserWindow.h"
#import "BrowserWrapper.h"
#import "BookmarkManager.h"
#import "BookmarkFolder.h"
#import "Bookmark.h"
@class AutoCompleteWindow;
@class BrowserWindowController;


// This file adds scripting support to various classes.
// 
// Scripting classes and the Obj-C classes that implement them:
// 
//  application................NSApplication w/ MainController (delegate)
//  browser window.............BrowserWindow
//  tab........................BrowserWrapper
//  bookmark item..............BookmarkItem
//  bookmark folder............BookmarkFolder
//  bookmark...................Bookmark


@interface MainController (ScriptingSupport)
- (BOOL)application:(NSApplication *)sender delegateHandlesKey:(NSString *)key;
- (NSArray *)orderedWindows;
- (NSArray *)allBrowserWindows;
- (NSArray *)bookmarkCollections;
- (void)insertInBookmarkCollections:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex;
- (void)insertInBookmarkCollections:(BookmarkFolder *)aItem;
- (void)removeFromBookmarkCollectionsAtIndex:(unsigned)aIndex;
- (void)replaceInBookmarkCollections:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex;
@end

@interface BrowserWindow (ScriptingSupport)
- (NSScriptObjectSpecifier *)objectSpecifier;
- (NSArray *)tabs;
- (BrowserWrapper *)currentTab;
@end

@interface BrowserWrapper (ScriptingSupport)
- (NSScriptObjectSpecifier *)objectSpecifier;
- (void)setCurrentURI:(NSString *)newURI;
@end

@interface BookmarkItem (ScriptingSupport)
- (void)setScriptingProperties:(NSDictionary *)properties;
@end

@interface BookmarkFolder (ScriptingSupport)
- (NSScriptObjectSpecifier *)objectSpecifier;
- (NSArray *)folderItemsWithClass:(Class)theClass;
- (NSArray *)childBookmarks;
- (NSArray *)childFolders;
- (void)insertInChildArray:(BookmarkItem *)aItem atIndex:(unsigned)aIndex;
- (void)insertInChildFolders:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex;
- (void)insertInChildBookmarks:(Bookmark *)aItem atIndex:(unsigned)aIndex;
- (void)insertInChildArray:(BookmarkItem *)aItem;
- (void)insertInChildFolders:(BookmarkFolder *)aItem;
- (void)insertInChildBookmarks:(Bookmark *)aItem;
- (void)removeFromChildArrayAtIndex:(unsigned)aIndex;
- (void)removeFromChildFoldersAtIndex:(unsigned)aIndex;
- (void)removeFromChildBookmarksAtIndex:(unsigned)aIndex;
- (void)replaceInChildArray:(BookmarkItem *)aItem atIndex:(unsigned)aIndex;
- (void)replaceInChildFolders:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex;
- (void)replaceInChildBookmarks:(Bookmark *)aItem atIndex:(unsigned)aIndex;
- (NSArray *)indicesOfObjectsByEvaluatingObjectSpecifier:(NSScriptObjectSpecifier *)specifier;
- (NSArray *)indicesOfObjectsByEvaluatingRelativeSpecifier:(NSRelativeSpecifier *)relSpec;
- (NSArray *)indicesOfObjectsByEvaluatingRangeSpecifier:(NSRangeSpecifier *)rangeSpec;
@end

@interface Bookmark (ScriptingSupport)
- (NSScriptObjectSpecifier *)objectSpecifier;
@end


#pragma mark -
#pragma mark Scripting class: application

@implementation MainController (ScriptingSupport)

// Delegate method: Declares NSApp should let MainController handle certain KVC keys.
// Causes, for instance, [NSApp valueForKey:@"orderedWindows"] to call
// [[NSApp delegate] valueForKey:@"orderedWindows"], but does not affect calls directly
// to [NSApp orderedWindows].
- (BOOL)application:(NSApplication *)sender delegateHandlesKey:(NSString *)key
{
  return [key isEqualToString:@"orderedWindows"] ||
         [key isEqualToString:@"allBrowserWindows"] ||
         [key isEqualToString:@"bookmarkCollections"] ||
         [key isEqualToString:@"bookmarkMenuFolder"] ||
         [key isEqualToString:@"toolbarFolder"] ||
         [key isEqualToString:@"top10Folder"] ||
         [key isEqualToString:@"rendezvousFolder"] ||
         [key isEqualToString:@"addressBookFolder"];
}

// These keys are "forwarded" to the Bookmark Manager.
- (id)valueForKey:(NSString *)key
{
  if ([key isEqualToString:@"bookmarkMenuFolder"] ||
      [key isEqualToString:@"toolbarFolder"] ||
      [key isEqualToString:@"top10Folder"] ||
      [key isEqualToString:@"rendezvousFolder"] ||
      [key isEqualToString:@"addressBookFolder"]) {
    return [[BookmarkManager sharedBookmarkManager] valueForKey:key];
  }
  else {
    [super valueForKey:key];
  }
}


// Returns "windows that are typically scriptable" as per -[NSApplication orderedWindows]
// documentation.  Includes browser windows, downloads window, and preferences window, but
// ignores invisible windows that NSApplication's implementation doesn't know to ignore.
- (NSArray *)orderedWindows
{
  NSEnumerator* windowEnum = [[NSApp orderedWindows] objectEnumerator];
  NSMutableArray* windowArray = [NSMutableArray array];

  NSWindow* curWindow;
  while ((curWindow = [windowEnum nextObject])) {
    // Two kinds of invisible windows show up in [NSApp orderedWindows]:
    // AutoCompleteWindows and NSWindows with uniqueID == -1.  It is unclear what
    // the second set of windows is, but they certainly shouldn't be included.
    // Note: there is no -[NSWindow uniqueID] method; the uniqueID key is only
    // availible via KVC.
    if (![curWindow isKindOfClass:[AutoCompleteWindow class]] &&
        [[curWindow valueForKey:@"uniqueID"] intValue] != -1) {
          [windowArray addObject:curWindow];
    }
  }

  return windowArray;
}

// Returns all windows controlled by a BWC. Similar to -browserWindows, but
// returns chrome-less BWs such as view-source:'s and popups as well.
- (NSArray *)allBrowserWindows
{
  NSEnumerator* windowEnum = [[NSApp orderedWindows] objectEnumerator];
  NSMutableArray* windowArray = [NSMutableArray array];

  NSWindow* curWindow;
  while ((curWindow = [windowEnum nextObject])) {
    if ([[curWindow windowController] isKindOfClass:[BrowserWindowController class]])
      [windowArray addObject:curWindow];
  }

  return windowArray;
}


// Returns the user-defined (non-special) top-level BookmarkFolders from the Bookmark Manager's Collections pane.
- (NSArray *)bookmarkCollections
{
  // Get the top-level folders, then filter out special folders.
  NSArray *array = [[BookmarkManager sharedBookmarkManager] valueForKeyPath:@"rootBookmarks.childArray"];
  NSMutableArray *collections = [NSMutableArray array];
  NSEnumerator *e = [array objectEnumerator];
  id eachFolder;
  while ((eachFolder = [e nextObject])) {
    if (![eachFolder isSpecial])
      [collections addObject:eachFolder];
  }
  return collections;
}


// NSScriptKeyValueCoding protocol support.
// These methods are called through Scripting-KVC by NSObject's implementation of the
// NSScriptKeyValueCoding informal protocol.  See BookmarkFolder(ScriptingSupport) for more
// information.  These methods pass the buck to the rootBookmarks folder, which actually
// manages "application's bookmark folders", after making sure we're not touching the
// special collections at the top of the list.

// Offset for bookmarkCollections within rootBookmarks' childFolders.
- (unsigned)_bookmarkCollectionsOffset
{
  return [[[[BookmarkManager sharedBookmarkManager] rootBookmarks] childArray] count] - [[self bookmarkCollections] count];
}

- (void)insertInBookmarkCollections:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex
{
  [[[BookmarkManager sharedBookmarkManager] rootBookmarks] insertInChildFolders:aItem atIndex:[self _bookmarkCollectionsOffset]+aIndex];
}

- (void)insertInBookmarkCollections:(BookmarkFolder *)aItem
{
  [[[BookmarkManager sharedBookmarkManager] rootBookmarks] insertInChildFolders:aItem];
}

- (void)removeFromBookmarkCollectionsAtIndex:(unsigned)aIndex
{
  [[[BookmarkManager sharedBookmarkManager] rootBookmarks] removeFromChildFoldersAtIndex:[self _bookmarkCollectionsOffset]+aIndex];
}

- (void)replaceInBookmarkCollections:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex
{
  [[[BookmarkManager sharedBookmarkManager] rootBookmarks] replaceInChildFolders:aItem atIndex:[self _bookmarkCollectionsOffset]+aIndex];
}

@end


#pragma mark -
#pragma mark Scripting class: browser window

@implementation BrowserWindow (ScriptingSupport)

- (NSScriptObjectSpecifier *)objectSpecifier
{
  NSArray *browserWindows = [[NSApp delegate] allBrowserWindows];
  unsigned index = [browserWindows indexOfObjectIdenticalTo:self];
  NSScriptClassDescription *containerClassDesc = (NSScriptClassDescription *)[NSScriptClassDescription classDescriptionForClass:[NSApp class]];

  if (index != NSNotFound) {
    return [[[NSIndexSpecifier alloc] initWithContainerClassDescription:containerClassDesc
                                                     containerSpecifier:[NSApp objectSpecifier]
                                                                    key:@"allBrowserWindows"
                                                                  index:index] autorelease];
  }
  else {
    return nil;
  }
}

// Returns the BrowserWrappers (tabs) in this BrowserWindow (browser window).
- (NSArray *)tabs
{
  return [self valueForKeyPath:@"windowController.tabBrowser.tabViewItems.view"];
}

- (BrowserWrapper *)currentTab
{
  return [self valueForKeyPath:@"windowController.tabBrowser.selectedTabViewItem.view"];
}

@end


#pragma mark -
#pragma mark Scripting class: tab

@implementation BrowserWrapper (ScriptingSupport)

- (NSScriptObjectSpecifier *)objectSpecifier
{
  BrowserWindow *window = (BrowserWindow *)[self nativeWindow];
  NSArray *tabArray = [window valueForKeyPath:@"windowController.tabBrowser.tabViewItems.view"];
  unsigned index = [tabArray indexOfObjectIdenticalTo:self];
  
  if (index != NSNotFound) {
    return [[[NSIndexSpecifier alloc] initWithContainerClassDescription:(NSScriptClassDescription *)[NSScriptClassDescription classDescriptionForClass:[window class]]
                                                     containerSpecifier:[window objectSpecifier]
                                                                    key:@"tabs"
                                                                  index:index] autorelease];
  }
  else {
    return nil;
  }
}

// BrowserWindow implements a -currentURI but not a -setCurrentURI:.
// This method lets "tab's URL" be a read/write property.
- (void)setCurrentURI:(NSString *)newURI
{
  [self loadURI:newURI referrer:nil flags:NSLoadFlagsNone focusContent:YES allowPopups:NO];
}

@end


#pragma mark -
#pragma mark Scripting class: bookmark item

@implementation BookmarkItem (ScriptingSupport)

// We need to make sure Cocoa Scripting gives us the right types for our properties.
// NSObject's implementation blithely assigns the value, regardless of type.
- (void)setScriptingProperties:(NSDictionary *)properties
{
  // Note: The current code depends on two facts:
  // 
  //  1. The keys to the dictionary are valid, writable scripting keys according to the dictionary, and
  //  2. All writable properties of BookmarkItem (and its decendents) are strings.
  // 
  // (1) is guaranteed by the documentation for setScriptingProperties:.  (2) is liable to change in the future.
  
  NSEnumerator *e = [properties keyEnumerator];
  id key;
  while ((key = [e nextObject])) {
    id value = [properties valueForKey:key];
    if ([value isKindOfClass:[NSString class]]) {
      [self setValue:value forKey:key];
    }
    // Because the language is weird, given certain syntaxes, AppleScript
    // sends us a property specifier rather than the evaluated object.
    // We try to handle that transparently here.
    else if ([value isKindOfClass:[NSPropertySpecifier class]] && [[value objectsByEvaluatingSpecifier] isKindOfClass:[NSString class]]) {
      [self setValue:[value objectsByEvaluatingSpecifier] forKey:key];
    }
    else {
      [[NSScriptCommand currentCommand] setScriptErrorNumber:NSArgumentsWrongScriptError];
      NSString *scriptingClassName = [(NSScriptClassDescription *)[NSScriptClassDescription classDescriptionForClass:[value class]] className];
      [[NSScriptCommand currentCommand] setScriptErrorString:[NSString stringWithFormat:@"A bookmark item's %@ can't be that type.", scriptingClassName]];
    }
  }
}

@end


#pragma mark -
#pragma mark Scripting class: bookmark folder

@implementation BookmarkFolder (ScriptingSupport)

// BookmarkFolders identify themselves by name.
- (NSScriptObjectSpecifier *)objectSpecifier
{
  BookmarkFolder *parent = [self parent];

  // If our parent has a parent, we're contained by our parent.  If not, we're a collection contained by application.
  if ([parent parent]) {
    return [[[NSNameSpecifier alloc] initWithContainerClassDescription:(NSScriptClassDescription *)[NSScriptClassDescription classDescriptionForClass:[parent class]]
                                                    containerSpecifier:[parent objectSpecifier]
                                                                   key:@"childFolders"
                                                                  name:[self title]] autorelease];
  }
  else {
    // If we're not a special collection, we belong to NSApp's bookmarkCollections collection.
    if (![self isSpecial]) {
      return [[[NSNameSpecifier alloc] initWithContainerClassDescription:(NSScriptClassDescription *)[NSScriptClassDescription classDescriptionForClass:[NSApp class]]
                                                      containerSpecifier:[NSApp objectSpecifier]
                                                                     key:@"bookmarkCollections"
                                                                    name:[self title]] autorelease];
    }
    // If we're a special folder, we're a specific property of NSApp.
    else {
      NSString *key;
      if (self == [[BookmarkManager sharedBookmarkManager] bookmarkMenuFolder])
        key = @"bookmarkMenuFolder";
      else if (self == [[BookmarkManager sharedBookmarkManager] toolbarFolder])
        key = @"toolbarFolder";
      else if (self == [[BookmarkManager sharedBookmarkManager] top10Folder])
        key = @"top10Folder";
      else if (self == [[BookmarkManager sharedBookmarkManager] rendezvousFolder])
        key = @"rendezvousFolder";
      else if (self == [[BookmarkManager sharedBookmarkManager] addressBookFolder])
        key = @"addressBookFolder";
      else
        return nil;   // Error case: if we're special but we're not one of these folders, something's very wrong, so just bail.
      
      return [[[NSPropertySpecifier alloc] initWithContainerClassDescription:(NSScriptClassDescription *)[NSScriptClassDescription classDescriptionForClass:[NSApp class]]
                                                          containerSpecifier:[NSApp objectSpecifier]
                                                                         key:key] autorelease];
    }
  }
}


// Accessors for childBookmarks and childFolders

- (NSArray *)folderItemsWithClass:(Class)theClass
{
  NSEnumerator* childEnum = [[self childArray] objectEnumerator];
  NSMutableArray *result = [NSMutableArray array];
  id curItem;
  while ((curItem = [childEnum nextObject])) {
    if ([curItem isKindOfClass:theClass]) {
      [result addObject:curItem];
    }
  }

  return result;
}

- (NSArray *)childBookmarks
{
  return [self folderItemsWithClass:[Bookmark class]];
}

- (NSArray *)childFolders
{
  return [self folderItemsWithClass:[BookmarkFolder class]];
}

#pragma mark -

// Overrides setValue:forKey to stop scripts from changing smart folders' properties.
- (void)setValue:(id)value forKey:(NSString *)key
{
  // If we're a smart folder, none of our properties may be modified by script commands.
  if ([self isSmartFolder] && [NSScriptCommand currentCommand]) {
    [[NSScriptCommand currentCommand] setScriptErrorNumber:NSReceiversCantHandleCommandScriptError];
    [[NSScriptCommand currentCommand] setScriptErrorString:[NSString stringWithFormat:@"Can't modify properties of special folder '%@'.", [self title]]];
    return;
  }
  else
    [super setValue:value forKey:key];
}


// NSScriptKeyValueCoding protocol support.
// These methods are called through Scripting-KVC by NSObject's implementation of the
// NSScriptKeyValueCoding informal protocol.  We handle three keys here:
// - childArray
// - childFolders
// - childBookmarks
// 
// Note that the childFolders and childBookmarks collections are filtered
// from the childArray.  They contain all the folders/bookmarks (respectively)
// of childArray in the order they appear there.  Indexes when dealing with these
// collections refer to the filtered collection, not to the original index in
// childArray.

// Returns false and sets a script error if contents shouldn't be modified by scripting.
- (BOOL)shouldModifyContentsByScripting
{
  if ([self isSmartFolder]) {
    [[NSScriptCommand currentCommand] setScriptErrorNumber:NSReceiversCantHandleCommandScriptError];
    [[NSScriptCommand currentCommand] setScriptErrorString:[NSString stringWithFormat:@"Can't modify contents of smart folder '%@'.", [self title]]];
    return NO;
  }
  return YES;
}

// -insertIn<key>:atIndex:
// Used to create children with a location specifier.

- (void)insertInChildArray:(BookmarkItem *)aItem atIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  [self insertChild:aItem atIndex:aIndex isMove:NO];
}

// These two methods currently treat the incoming index as an index into the filtered array of
// folders or bookmarks, and find a place to put the new item in the full childArray so they come
// out at the right index of the applicable filtered array.  This may or may not be desired by
// scripters, depending on the reference form used.

- (void)insertInChildFolders:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  NSArray *folderArray = [self childFolders];
  BookmarkFolder *aFolder;
  unsigned realIndex;
  if (aIndex < [folderArray count]) {
    aFolder = [folderArray objectAtIndex:aIndex];
    realIndex = [[self childArray] indexOfObject:aFolder];
  }
  else {
    aFolder = [folderArray lastObject];
    realIndex = 1 + [[self childArray] indexOfObject:aFolder];
  }
  [self insertChild:aItem atIndex:realIndex isMove:NO];
}

- (void)insertInChildBookmarks:(Bookmark *)aItem atIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  NSArray *bookmarkArray = [self childBookmarks];
  Bookmark *aBookmark;
  unsigned realIndex;
  if (aIndex < [bookmarkArray count])  {
    aBookmark = [bookmarkArray objectAtIndex:aIndex];
    realIndex = [[self childArray] indexOfObject:aBookmark];
  }
  else {
    aBookmark = [bookmarkArray lastObject];
    realIndex = 1 + [[self childArray] indexOfObject:aBookmark];
  }
  [self insertChild:aItem atIndex:realIndex isMove:NO];
}


// -insertIn<key>:
// Used to create children without a location specifier.
// Adds to end of entire childArray in all cases, since inserting after last bookmark/folder
// isn't particularly useful.

- (void)insertInChildArray:(BookmarkItem *)aItem
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  [self appendChild:aItem];
}

- (void)insertInChildFolders:(BookmarkFolder *)aItem
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  [self insertInChildArray:aItem];
}

- (void)insertInChildBookmarks:(Bookmark *)aItem
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  [self insertInChildArray:aItem];
}


// -removeFrom<Key>AtIndex:
// Removes the object at the specified index from the collection.

- (void)removeFromChildArrayAtIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  BookmarkItem* aKid = [[self childArray] objectAtIndex:aIndex];
  [self deleteChild:aKid];
}

- (void)removeFromChildFoldersAtIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  BookmarkFolder* aKid = [[self childFolders] objectAtIndex:aIndex];
  [self deleteChild:aKid];
}

- (void)removeFromChildBookmarksAtIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  Bookmark* aKid = [[self childBookmarks] objectAtIndex:aIndex];
  [self deleteChild:aKid];
}


// -replaceIn<Key>:atIndex:
// Replaces the object at the specified index in the collection.

- (void)replaceInChildArray:(BookmarkItem *)aItem atIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  [self removeFromChildArrayAtIndex:aIndex];
  [self insertChild:aItem atIndex:aIndex isMove:NO];
}

- (void)replaceInChildFolders:(BookmarkFolder *)aItem atIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  [self removeFromChildFoldersAtIndex:aIndex];
  [self insertInChildFolders:aItem atIndex:aIndex];
}

- (void)replaceInChildBookmarks:(Bookmark *)aItem atIndex:(unsigned)aIndex
{
  // Bail if we shouldn't be modified.
  if (![self shouldModifyContentsByScripting]) return;
  
  [self removeFromChildBookmarksAtIndex:aIndex];
  [self insertInChildBookmarks:aItem atIndex:aIndex];
}


#pragma mark -

// XXX These three methods were moved directly from BookmarkFolder.m.  They were part of the Great
// Bookmark Rewrite (bug 212630).  indicesOfObjectsByEvaluatingObjectSpecifier: is an optional
// method; it allows a container to override the default specifier evaluation algorithm for
// performance or other reasons (see the NSScriptObjectSpecifiers informal protocol.) Since
// AppleScript support was poorly understood when these were added, and they are templated
// from Apple's Sketch.app, it is unclear whether these methods serve a purpose or were included
// because Apple's code used them.  This should be examined later.  In the interests of maintaining
// the status quo, they are retained below (along with their original comment).

//
// These next 3 methods swiped almost exactly out of sketch.app by apple.
// look there for an explanation if you're confused.
//
- (NSArray *)indicesOfObjectsByEvaluatingObjectSpecifier:(NSScriptObjectSpecifier *)specifier
{
  if ([specifier isKindOfClass:[NSRangeSpecifier class]])
    return [self indicesOfObjectsByEvaluatingRangeSpecifier:(NSRangeSpecifier *)specifier];
  else if ([specifier isKindOfClass:[NSRelativeSpecifier class]])
    return [self indicesOfObjectsByEvaluatingRelativeSpecifier:(NSRelativeSpecifier *)specifier];
  // If we didn't handle it, return nil so that the default object specifier evaluation will do it.
  return nil;
}

- (NSArray *)indicesOfObjectsByEvaluatingRelativeSpecifier:(NSRelativeSpecifier *)relSpec
{
  NSString *key = [relSpec key];
  if ([key isEqualToString:@"childBookmarks"] ||
      [key isEqualToString:@"childArray"] ||
      [key isEqualToString:@"childFolders"])
  {
    NSScriptObjectSpecifier *baseSpec = [relSpec baseSpecifier];
    NSString *baseKey = [baseSpec key];
    NSArray *children = [self childArray];
    NSRelativePosition relPos = [relSpec relativePosition];
    if (baseSpec == nil)
      return nil;

    if ([children count] == 0)
      return [NSArray array];

    if ([baseKey isEqualToString:@"childBookmarks"] ||
        [baseKey isEqualToString:@"childArray"] ||
        [baseKey isEqualToString:@"childFolders"])
    {
      unsigned baseIndex;
      id baseObject = [baseSpec objectsByEvaluatingWithContainers:self];
      if ([baseObject isKindOfClass:[NSArray class]]) {
        int baseCount = [baseObject count];
        if (baseCount == 0)
          baseObject = nil;
        else {
          if (relPos == NSRelativeBefore)
            baseObject = [baseObject objectAtIndex:0];
          else
            baseObject = [baseObject objectAtIndex:(baseCount-1)];
        }
      }

      if (!baseObject)
        // Oops.  We could not find the base object.
        return nil;

      baseIndex = [children indexOfObjectIdenticalTo:baseObject];
      if (baseIndex == NSNotFound)
        // Oops.  We couldn't find the base object in the child array.  This should not happen.
        return nil;

      NSMutableArray *result = [NSMutableArray array];
      BOOL keyIsArray = [key isEqualToString:@"childArray"];
      NSArray *relKeyObjects = (keyIsArray ? nil : [self valueForKey:key]);
      id curObj;
      unsigned curKeyIndex, childrenCount = [children count];
      if (relPos == NSRelativeBefore)
          baseIndex--;
      else
          baseIndex++;

      while ((baseIndex >= 0) && (baseIndex < childrenCount)) {
        if (keyIsArray) {
          [result addObject:[NSNumber numberWithInt:baseIndex]];
          break;
        }
        else {
          curObj = [children objectAtIndex:baseIndex];
          curKeyIndex = [relKeyObjects indexOfObjectIdenticalTo:curObj];
          if (curKeyIndex != NSNotFound) {
            [result addObject:[NSNumber numberWithInt:curKeyIndex]];
            break;
          }
        }

        if (relPos == NSRelativeBefore)
          baseIndex--;
        else
          baseIndex++;
      }
      return result;
    }
  }
  return nil;
}

- (NSArray *)indicesOfObjectsByEvaluatingRangeSpecifier:(NSRangeSpecifier *)rangeSpec
{
  NSString *key = [rangeSpec key];
  if ([key isEqualToString:@"childBookmarks"] ||
      [key isEqualToString:@"childArray"] ||
      [key isEqualToString:@"childFolders"])
  {
    NSScriptObjectSpecifier *startSpec = [rangeSpec startSpecifier];
    NSScriptObjectSpecifier *endSpec = [rangeSpec endSpecifier];
    NSString *startKey = [startSpec key];
    NSString *endKey = [endSpec key];
    NSArray *children = [self childArray];

    if ((startSpec == nil) && (endSpec == nil))
      return nil;
    if ([children count] == 0)
      return [NSArray array];

    if ((!startSpec || [startKey isEqualToString:@"childBookmarks"] ||
         [startKey isEqualToString:@"childArray"] || [startKey isEqualToString:@"childFolders"]) &&
        (!endSpec || [endKey isEqualToString:@"childBookmarks"] || [endKey isEqualToString:@"childArray"] ||
         [endKey isEqualToString:@"childFolders"]))
    {
      unsigned startIndex;
      unsigned endIndex;
      if (startSpec) {
        id startObject = [startSpec objectsByEvaluatingSpecifier];
        if ([startObject isKindOfClass:[NSArray class]]) {
          if ([startObject count] == 0)
            startObject = nil;
          else
            startObject = [startObject objectAtIndex:0];
        }
        if (!startObject)
          return nil;
        startIndex = [children indexOfObjectIdenticalTo:startObject];
        if (startIndex == NSNotFound)
          return nil;
      }
      else
        startIndex = 0;

      if (endSpec) {
        id endObject = [endSpec objectsByEvaluatingSpecifier];
        if ([endObject isKindOfClass:[NSArray class]]) {
          unsigned endObjectsCount = [endObject count];
          if (endObjectsCount == 0)
            endObject = nil;
          else
            endObject = [endObject objectAtIndex:(endObjectsCount-1)];
        }
        if (!endObject)
          return nil;
        endIndex = [children indexOfObjectIdenticalTo:endObject];
        if (endIndex == NSNotFound)
          return nil;
      }
      else
        endIndex = [children count] - 1;

      if (endIndex < startIndex) {
        int temp = endIndex;
        endIndex = startIndex;
        startIndex = temp;
      }

      NSMutableArray *result = [NSMutableArray array];
      BOOL keyIsArray = [key isEqual:@"childArray"];
      NSArray *rangeKeyObjects = (keyIsArray ? nil : [self valueForKey:key]);
      id curObj;
      unsigned curKeyIndex, i;
      for (i = startIndex; i <= endIndex; i++) {
        if (keyIsArray)
          [result addObject:[NSNumber numberWithInt:i]];
        else {
          curObj = [children objectAtIndex:i];
          curKeyIndex = [rangeKeyObjects indexOfObjectIdenticalTo:curObj];
          if (curKeyIndex != NSNotFound)
            [result addObject:[NSNumber numberWithInt:curKeyIndex]];
        }
      }
      return result;
    }
  }
  return nil;
}



@end


#pragma mark -
#pragma mark Scripting class: bookmark

@implementation Bookmark (ScriptingSupport)

// Bookmarks identify themselves by name.
- (NSScriptObjectSpecifier *)objectSpecifier
{
  BookmarkFolder *parent = [self parent];
  return [[[NSNameSpecifier alloc] initWithContainerClassDescription:(NSScriptClassDescription *)[NSScriptClassDescription classDescriptionForClass:[parent class]]
                                                  containerSpecifier:[parent objectSpecifier]
                                                                 key:@"childBookmarks"
                                                                name:[self title]] autorelease];
}

@end
