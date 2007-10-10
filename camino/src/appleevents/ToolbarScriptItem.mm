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

#import "ToolbarScriptItem.h"

NSString * const kScriptItemIdentifierPrefix = @"ScriptItem:";

@implementation ToolbarScriptItem

// Returns an array of toolbar item identifiers for the script items available.
+ (NSArray *)scriptItemIdentifiers
{
  // Get script paths.
  NSString *libraryPath = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) objectAtIndex:0];
  NSString *appName = [[[NSBundle mainBundle] infoDictionary] valueForKey:@"CFBundleName"];
  NSString *scriptDirPath = [[libraryPath stringByAppendingPathComponent:@"Scripts/Applications"] stringByAppendingPathComponent:appName];

  NSMutableArray *identifiers = [[[NSMutableArray alloc] init] autorelease];
  NSDirectoryEnumerator *dirEnum = [[NSFileManager defaultManager] enumeratorAtPath:scriptDirPath];
  id eachRelativePath;
  // -nextObject yields relative paths.  We need absolute paths.
  while ((eachRelativePath = [dirEnum nextObject])) {
    NSString *eachAbsolutePath = [scriptDirPath stringByAppendingPathComponent:eachRelativePath];
    NSString *eachPathExtension = [eachAbsolutePath pathExtension];
    if ([eachPathExtension isEqualToString:@"scpt"] ||
        [eachPathExtension isEqualToString:@"applescript"] ||
        [eachPathExtension isEqualToString:@"scptd"] ||
        [eachPathExtension isEqualToString:@"app"]) {
      [identifiers addObject:[NSString stringWithFormat:@"%@%@", kScriptItemIdentifierPrefix, eachAbsolutePath]];
    }
    // Don't look inside script bundles or application bundles.
    if ([eachPathExtension isEqualToString:@"scptd"] ||
        [eachPathExtension isEqualToString:@"app"]) {
      [dirEnum skipDescendents];
    }
  }

  return identifiers;
}


- (id)initWithItemIdentifier:(NSString *)ident
{
  // Sanity check: Make sure this is a valid ToolbarScriptItem identifier.
  if ([ident hasPrefix:kScriptItemIdentifierPrefix] && [super initWithItemIdentifier:ident]) {
    [self setLabel:[self scriptName]];
    [self setPaletteLabel:[NSString stringWithFormat:@"%@: %@", NSLocalizedString(@"ScriptItem", nil), [self scriptName]]];
    [self setToolTip:[NSString stringWithFormat:NSLocalizedString(@"ScriptItemToolTipFormat", nil), [self scriptName]]];
    [self setImage:[[NSWorkspace sharedWorkspace] iconForFile:[self scriptPath]]];
    [self setTarget:self];
    [self setAction:@selector(runScript:)];

    return self;
  }
  return nil;
}

- (NSString *)scriptPath
{
  return [[self itemIdentifier] substringFromIndex:[kScriptItemIdentifierPrefix length]];
}

- (NSString *)scriptName
{
  return [[[self scriptPath] lastPathComponent] stringByDeletingPathExtension];
}

- (void)runScript:(id)sender
{
  NSDictionary *errDict = nil;
  
  // Load the script.
  NSAppleScript *script = [[[NSAppleScript alloc] initWithContentsOfURL:[NSURL fileURLWithPath:[self scriptPath]] error:&errDict] autorelease];
  if (!script) {
    NSBeep();
    NSLog(@"Error loading script at %@: %@", [self scriptPath], [errDict valueForKey:NSAppleScriptErrorMessage]);
    return;
  }
  
  // Run the script.
  NSAppleEventDescriptor *result = [script executeAndReturnError:&errDict];
  if (!result) {
    NSBeep();
    NSLog(@"Error running script at %@: %@", [self scriptPath], [errDict valueForKey:NSAppleScriptErrorMessage]);
  }
}

@end
