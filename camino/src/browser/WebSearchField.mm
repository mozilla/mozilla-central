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

NSString* const kWebSearchEngineNameKey = @"SearchEngineName";
NSString* const kWebSearchEngineURLKey = @"SearchEngineURL";


// Formatter that prevents entry of control characters.
@interface WebSearchFormatter : NSFormatter
{
}
@end

# pragma mark -

@implementation WebSearchField

- (void)awakeFromNib
{
  [self registerForDraggedTypes:[NSArray arrayWithObject:NSStringPboardType]];
  [self setFormatter:[[[WebSearchFormatter alloc] init] autorelease]];
}

- (void)setSearchEngines:(NSArray*)searchEngines
{
  NSMenu* engineMenu = [[[NSMenu alloc] initWithTitle:@"Search Engines"] autorelease];

  NSEnumerator* engineEnumerator = [searchEngines objectEnumerator];
  NSDictionary* engine;
  while ((engine = [engineEnumerator nextObject])) {
    NSMenuItem* menuItem =
      [[[NSMenuItem alloc] initWithTitle:[engine objectForKey:kWebSearchEngineNameKey]
                                  action:@selector(searchEngineChanged:)
                           keyEquivalent:@""] autorelease];
    [menuItem setTarget:self];
    [menuItem setRepresentedObject:[engine objectForKey:kWebSearchEngineURLKey]];
    [engineMenu addItem:menuItem];
  }

  [[self cell] setSearchMenuTemplate:engineMenu];
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
