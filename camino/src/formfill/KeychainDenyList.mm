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
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Morgan <stuart.morgan@gmail.com>
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

#import "KeychainDenyList.h"
#import "PreferenceManager.h"

@interface KeychainDenyList (KeychainDenyListPrivate)
- (void)writeToDisk;
- (NSString*)pathToDenyListFile;
- (NSString*)pathToLegacyDenyListFile;
@end


@implementation KeychainDenyList

static KeychainDenyList *sDenyListInstance = nil;

+ (KeychainDenyList*)instance
{
  return sDenyListInstance ? sDenyListInstance : sDenyListInstance = [[self alloc] init];
}

- (id)init
{
  if ((self = [super init])) {
    mDenyList = [[NSMutableArray alloc] initWithContentsOfFile:[self pathToDenyListFile]];
    // If there's no new deny list file, try the old one
    if (!mDenyList)
      mDenyList = [[NSUnarchiver unarchiveObjectWithFile:[self pathToLegacyDenyListFile]] retain];
    if (!mDenyList)
      mDenyList = [[NSMutableArray alloc] init];
  }
  return self;
}

- (void)dealloc
{
  [mDenyList release];
  [super dealloc];
}

//
// writeToDisk
//
// flushes the deny list to the save file in the user's profile.
//
- (void)writeToDisk
{
  [mDenyList writeToFile:[self pathToDenyListFile] atomically:YES];
}

- (BOOL)isHostPresent:(NSString*)host
{
  return [mDenyList containsObject:host];
}

- (void)addHost:(NSString*)host
{
  if (![self isHostPresent:host]) {
    [mDenyList addObject:host];
    [self writeToDisk];
  }
}

- (void)removeHost:(NSString*)host
{
  if ([self isHostPresent:host]) {
    [mDenyList removeObject:host];
    [self writeToDisk];
  }
}

- (void)removeAllHosts
{
  [mDenyList removeAllObjects];
  [self writeToDisk];
}

- (NSArray*)listHosts
{
  return mDenyList;
}

- (NSString*)pathToDenyListFile
{
  NSString* profilePath = [[PreferenceManager sharedInstance] profilePath];
  return [profilePath stringByAppendingPathComponent:@"KeychainDenyList.plist"];
}

- (NSString*)pathToLegacyDenyListFile
{
  NSString* profilePath = [[PreferenceManager sharedInstance] profilePath];
  return [profilePath stringByAppendingPathComponent:@"Keychain Deny List"];
}

@end
