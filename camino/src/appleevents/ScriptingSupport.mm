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
 * The Initial Developer of the Original Code is
 * Peter Jaros <peter.a.jaros@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Peter Jaros <peter.a.jaros@gmail.com> (Original Author)
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
@class AutoCompleteWindow;
@class BrowserWindowController;


// This file adds scripting support to various classes.
// 
// Scripting classes and the Obj-C classes that implement them:
// 
//  application................NSApplication w/ MainController (delegate)
//  browser window.............BrowserWindow
//  tab........................BrowserWrapper


#pragma mark -
#pragma mark Scripting class: application

@implementation MainController (ScriptingSupport)

// Delegate method: Declares NSApp should let MainController handle certain KVC keys.
// Causes, for instance, [NSApp valueForKey:@"orderedWindows"] to call
// [[NSApp delegate] valueForKey:@"orderedWindows"], but does not affect calls directly
// to [NSApp orderedWindows].
- (BOOL)application:(NSApplication *)sender delegateHandlesKey:(NSString *)key
{
  return [key isEqualTo:@"orderedWindows"] ||
         [key isEqualTo:@"allBrowserWindows"];
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
  return [self valueForKeyPath:@"windowController.getTabBrowser.tabViewItems.view"];
}

- (BrowserWrapper *)currentTab
{
  return [self valueForKeyPath:@"windowController.getTabBrowser.selectedTabViewItem.view"];
}

@end


#pragma mark -
#pragma mark Scripting class: tab

@implementation BrowserWrapper (ScriptingSupport)

- (NSScriptObjectSpecifier *)objectSpecifier
{
  BrowserWindow *window = (BrowserWindow *)[self nativeWindow];
  NSArray *tabArray = [window valueForKeyPath:@"windowController.getTabBrowser.tabViewItems.view"];
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
