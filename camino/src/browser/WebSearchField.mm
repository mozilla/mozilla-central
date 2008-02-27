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
* Stuart Morgan.
* Portions created by the Initial Developer are Copyright (C) 2007
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Stuart Morgan <stuart.morgan@alumni.case.edu>
*   Sean Murphy <murph@seanmurph.com>
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

#import "WebSearchField.h"

#import "NSString+Utils.h"
#import "NSMenu+Utils.h"
#import "NSBezierPath+Utils.h"

// For search engine description keys:
#import "SearchEngineManager.h"
// For search plugin description keys:
#import "XMLSearchPluginParser.h"

// Formatter that prevents entry of control characters.
@interface WebSearchFormatter : NSFormatter
{
}
@end

# pragma mark -

static const int kSearchEngineMenuItemTag = 100;
static const int kSeparatorBeforeManageSearchEnginesMenuItemTag = 101;
static const int kSearchPluginRelatedItemsTag = 102;

@interface WebSearchField (Private)

- (void)indicateDetectedSearchPlugin:(BOOL)shouldIndicate;
- (NSImage*)searchButtonImageWithDetectedPlugins;

@end

@implementation WebSearchField

- (void)awakeFromNib
{
  [self registerForDraggedTypes:[NSArray arrayWithObject:NSStringPboardType]];
  [self setFormatter:[[[WebSearchFormatter alloc] init] autorelease]];

  // Set up an initial search menu with our static items.
  NSMenu* searchMenu = [[[NSMenu alloc] initWithTitle:@"Search Menu"] autorelease];
  NSMenuItem* separatorBeforeManageEngines = [NSMenuItem separatorItem];
  [separatorBeforeManageEngines setTag:kSeparatorBeforeManageSearchEnginesMenuItemTag];
  [searchMenu addItem:separatorBeforeManageEngines];
  NSMenuItem* manageEnginesMenuItem = [[[NSMenuItem alloc] initWithTitle:NSLocalizedString(@"ManageSearchEnginesMenuItem", nil)
                                                                  action:@selector(manageSearchEngines:)
                                                           keyEquivalent:@""] autorelease];
  [manageEnginesMenuItem setTarget:[self target]];
  [searchMenu addItem:manageEnginesMenuItem];
  NSMenuItem* findEnginesMenuItem = [[[NSMenuItem alloc] initWithTitle:NSLocalizedString(@"FindSearchEnginesMenuItem", nil)
                                                                action:@selector(findSearchEngines:)
                                                         keyEquivalent:@""] autorelease];
  [findEnginesMenuItem setTarget:[self target]];
  [searchMenu addItem:findEnginesMenuItem];
  [[self cell] setSearchMenuTemplate:searchMenu];
}

- (void)dealloc
{
  [mDetectedSearchPluginImage release];
  [super dealloc];
}

- (void)setSearchEngines:(NSArray*)searchEngines
{
  NSMenu* searchMenu = [[self cell] searchMenuTemplate];
  [searchMenu removeAllItemsWithTag:kSearchEngineMenuItemTag];

  // Insert the search engine menu items at the beginning of our menu.
  NSEnumerator* reverseEnginesEnumerator = [searchEngines reverseObjectEnumerator];
  NSDictionary* engine = nil;
  while ((engine = [reverseEnginesEnumerator nextObject])) {
    NSMenuItem* menuItem =
      [[[NSMenuItem alloc] initWithTitle:[engine objectForKey:kWebSearchEngineNameKey]
                                  action:@selector(searchEngineChanged:)
                           keyEquivalent:@""] autorelease];
    [menuItem setTarget:self];
    [menuItem setRepresentedObject:[engine objectForKey:kWebSearchEngineURLKey]];
    [menuItem setTag:kSearchEngineMenuItemTag];
    [searchMenu insertItem:menuItem atIndex:0];
  }

  [[self cell] setSearchMenuTemplate:searchMenu];

  // Set an initial default
  if ([searchEngines count] > 0)
    [self setCurrentSearchEngine:[[searchEngines objectAtIndex:0] objectForKey:kWebSearchEngineNameKey]];
}

- (void)setCurrentSearchEngine:(NSString*)engineName
{
  NSMenu* engineMenu = [[self cell] searchMenuTemplate];
  NSMenuItem* newSelection = [engineMenu itemWithTitle:engineName];
  if (newSelection) {
    [[self cell] setPlaceholderString:[newSelection title]];
    [[engineMenu firstCheckedItem] setState:NSOffState];
    [newSelection setState:NSOnState];
    [[self cell] setSearchMenuTemplate:engineMenu];
  }
}

- (void)setDetectedSearchPlugins:(NSArray*)detectedSearchPlugins
{
  NSMenu *searchMenu = [[self cell] searchMenuTemplate];

  [searchMenu removeAllItemsWithTag:kSearchPluginRelatedItemsTag];

  if ([detectedSearchPlugins count] > 0) {
    // In theory we should use menuFontOfSize:0, but AppKit (up through at least
    // (10.5) will lie to us and say 13, so hard-code the correct value.
    NSFont* boldMenuFont = [[NSFontManager sharedFontManager] convertFont:[NSFont menuFontOfSize:14.0]
                                                              toHaveTrait:NSBoldFontMask];
    // Style the plugin menu items to make them stand out
    NSDictionary* menuItemStringAttributes = [NSDictionary dictionaryWithObject:boldMenuFont
                                                                         forKey:NSFontAttributeName];

    NSEnumerator* pluginEnumerator = [detectedSearchPlugins objectEnumerator];
    NSDictionary* searchPlugin;
    while ((searchPlugin = [pluginEnumerator nextObject])) {
      // Give the delegate a chance to exclude this plugin
      if ([[self delegate] respondsToSelector:@selector(webSearchField:shouldListDetectedSearchPlugin:)]) {
        if (![[self delegate] webSearchField:self shouldListDetectedSearchPlugin:searchPlugin])
          continue;
      }

      NSString* pluginName = [searchPlugin objectForKey:kWebSearchPluginNameKey];
      NSString* menuItemTitle = [NSString stringWithFormat:NSLocalizedString(@"InstallSearchPluginMenuItem", nil), pluginName];
      NSAttributedString* attributedTitle = [[[NSAttributedString alloc] initWithString:menuItemTitle
                                                                             attributes:menuItemStringAttributes] autorelease];

      NSMenuItem* pluginMenuItem = [[[NSMenuItem alloc] initWithTitle:@""
                                                               action:@selector(installSearchPlugin:)
                                                        keyEquivalent:@""] autorelease];
      [pluginMenuItem setAttributedTitle:attributedTitle];
      [pluginMenuItem setRepresentedObject:searchPlugin];
      [pluginMenuItem setTag:kSearchPluginRelatedItemsTag];
      [pluginMenuItem setTarget:[self target]];
      [searchMenu insertItem:pluginMenuItem
                     atIndex:[searchMenu indexOfItemWithTag:kSeparatorBeforeManageSearchEnginesMenuItemTag]];
    }
  }

  // See if any plugin menu items exist (detectedSearchPlugins could have been
  // nil or the delegate excluded every one) and indicate this fact.
  BOOL pluginItemsWereAdded = [searchMenu itemWithTag:kSearchPluginRelatedItemsTag] ? YES : NO;
  if (pluginItemsWereAdded) {
    // Insert a separator before the plugin items.
    NSMenuItem* separatorItem = [NSMenuItem separatorItem];
    [separatorItem setTag:kSearchPluginRelatedItemsTag];
    [searchMenu insertItem:separatorItem
                  atIndex:[searchMenu indexOfItemWithTag:kSearchPluginRelatedItemsTag]];
  }
  [self indicateDetectedSearchPlugin:pluginItemsWereAdded];

  [[self cell] setSearchMenuTemplate:searchMenu];
}

// Informs the search field to visually indicate that a plugin is available to install.
- (void)indicateDetectedSearchPlugin:(BOOL)shouldIndicate
{
  if (shouldIndicate)
    [[[self cell] searchButtonCell] setImage:[self searchButtonImageWithDetectedPlugins]];
  else
    [[self cell] resetSearchButtonCell];
}

// Returns an image for our search button cell to indicate detected search plugins.
- (NSImage*)searchButtonImageWithDetectedPlugins
{
  if (!mDetectedSearchPluginImage) {

    // Construct a new image for our search button cell.  We do some custom drawing and
    // then composite the original search button image back on top.

    NSImage* systemSearchButtonImage  = [[[self cell] searchButtonCell] image];
    mDetectedSearchPluginImage = [[NSImage alloc] initWithSize:[systemSearchButtonImage size]];

    NSRect searchButtonRect = NSZeroRect;
    searchButtonRect.size = [systemSearchButtonImage size];

    // The search button cell has a lot of extra padding around the actual button image,
    // so we have to trim it down for our background fill area.
    // If the system search button image should change, these values will likely need modification.
    float kDetectedSearchButtonCellTopTrimming    = 5.0f;
    float kDetectedSearchButtonCellBottomTrimming = 2.0f;
    float kDetectedSearchButtonCellLeftTrimming   = 2.5f;
    float kDetectedSearchButtonCellRightTrimming  = 2.5f;

    NSRect backgroundFillRect = searchButtonRect;
    backgroundFillRect.origin.x += kDetectedSearchButtonCellLeftTrimming;
    backgroundFillRect.size.width -= kDetectedSearchButtonCellRightTrimming;
    backgroundFillRect.origin.y += kDetectedSearchButtonCellBottomTrimming;
    backgroundFillRect.size.height -= kDetectedSearchButtonCellTopTrimming;

    [mDetectedSearchPluginImage lockFocus];

    // Draw a rounded fill as our background.
    NSBezierPath* roundedBackgroundPath = [NSBezierPath bezierPathWithRoundCorneredRect:backgroundFillRect
                                                                           cornerRadius:10.0];
    NSColor* backgroundFillColor = [NSColor colorWithCalibratedRed:0.666667f
                                                             green:0.768627f
                                                              blue:0.866667f
                                                             alpha:1.0f];
    [backgroundFillColor set];
    [roundedBackgroundPath fill];

    // Then, composite the original search button image on top.
    [systemSearchButtonImage drawInRect:searchButtonRect
                               fromRect:NSZeroRect
                              operation:NSCompositeSourceOver
                               fraction:1.0];

    [mDetectedSearchPluginImage unlockFocus];
  }

  return mDetectedSearchPluginImage;
}

- (NSString*)currentSearchEngine
{
  return [[[[self cell] searchMenuTemplate] firstCheckedItem] title];
}

- (NSString*)currentSearchURL
{
  return [[[[self cell] searchMenuTemplate] firstCheckedItem] representedObject];
}

- (void)searchEngineChanged:(id)sender
{
  [self setCurrentSearchEngine:[sender title]];
}

// Accepts any string content.
- (NSDragOperation)draggingEntered:(id <NSDraggingInfo>)sender
{
  NSDragOperation sourceDragMask = [sender draggingSourceOperationMask];
  NSPasteboard *pboard = [sender draggingPasteboard];
  if ([[pboard types] containsObject:NSStringPboardType]) {
    if (sourceDragMask & NSDragOperationCopy)
      return NSDragOperationCopy;
  }
  return NSDragOperationNone;
}

// Converts all control characters to spaces, to catch anywhere the text is
// set programatically (thus bypassing the formatter).
- (void)setStringValue:(NSString*)newValue
{
  [super setStringValue:[newValue stringByReplacingCharactersInSet:[NSCharacterSet controlCharacterSet]
                                                        withString:@" "]];
}

// Accepts the dragged text then immediately performs a search with it.
- (BOOL)performDragOperation:(id <NSDraggingInfo>)sender
{
  NSPasteboard *pboard = [sender draggingPasteboard];
  if ([[pboard types] containsObject:NSStringPboardType]) {
    [self setStringValue:[pboard stringForType:NSStringPboardType]];
    [self sendAction:[self action] to:[self target]];
  }
  return YES;
}

@end

#pragma mark -

@implementation WebSearchFormatter

- (NSString *)stringForObjectValue:(id)anObject
{
  return anObject;
}

- (BOOL)getObjectValue:(id *)anObject forString:(NSString *)string errorDescription:(NSString **)error
{
  *anObject = string;
  return YES;
}

- (BOOL)isPartialStringValid:(NSString *)partialString newEditingString:(NSString **)newString errorDescription:(NSString **)error
{
  if ([partialString rangeOfCharacterFromSet:[NSCharacterSet controlCharacterSet]].location != NSNotFound) {
    *newString = [partialString stringByRemovingCharactersInSet:[NSCharacterSet controlCharacterSet]];
    return NO;
  }
  return YES;
}

@end
