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
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Simon Fraser
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

#import "PreferencePaneBase.h"

#import "PreferenceManager.h"

@implementation PreferencePaneBase

- (id)initWithBundle:(NSBundle*)bundle
{
  self = [super initWithBundle:bundle];

  // Grab the shared PreferenceManager to be sure it's inited. We use
  // sharedInstanceDontCreate everywhere else in case we live past Gecko teardown
  [PreferenceManager sharedInstance];

  return self;
}

#pragma mark -

- (NSString*)getStringPref:(const char*)prefName withSuccess:(BOOL*)outSuccess
{
  return [[PreferenceManager sharedInstanceDontCreate] getStringPref:prefName
                                                         withSuccess:outSuccess];
}

- (NSColor*)getColorPref:(const char*)prefName withSuccess:(BOOL*)outSuccess
{
  return [[PreferenceManager sharedInstanceDontCreate] getColorPref:prefName
                                                        withSuccess:outSuccess];
}

- (BOOL)getBooleanPref:(const char*)prefName withSuccess:(BOOL*)outSuccess
{
  return [[PreferenceManager sharedInstanceDontCreate] getBooleanPref:prefName
                                                          withSuccess:outSuccess];
}

- (int)getIntPref:(const char*)prefName withSuccess:(BOOL*)outSuccess
{
  return [[PreferenceManager sharedInstanceDontCreate] getIntPref:prefName
                                                      withSuccess:outSuccess];
}

- (void)setPref:(const char*)prefName toString:(NSString*)value
{
  [[PreferenceManager sharedInstanceDontCreate] setPref:prefName
                                               toString:value];
}

- (void)setPref:(const char*)prefName toColor:(NSColor*)value
{
  // make sure we have a color in the RGB colorspace
  NSColor*	rgbColor = [value colorUsingColorSpaceName:NSCalibratedRGBColorSpace];
  
  int	redInt 		= (int)([rgbColor redComponent] * 255.0);
  int greenInt	= (int)([rgbColor greenComponent] * 255.0);
  int blueInt		= (int)([rgbColor blueComponent] * 255.0);

  NSString* colorString = [NSString stringWithFormat:@"#%02x%02x%02x", redInt, greenInt, blueInt];
  [self setPref:prefName toString:colorString];
}

- (void)setPref:(const char*)prefName toBoolean:(BOOL)value
{
  [[PreferenceManager sharedInstanceDontCreate] setPref:prefName
                                              toBoolean:value];
}

- (void)setPref:(const char*)prefName toInt:(int)value
{
  [[PreferenceManager sharedInstanceDontCreate] setPref:prefName
                                                  toInt:value];
}

- (void)clearPref:(const char*)prefName
{
  [[PreferenceManager sharedInstanceDontCreate] clearPref:prefName];
}

- (NSString*)localizedStringForKey:(NSString*)key
{
  return NSLocalizedStringFromTableInBundle(key, nil, [NSBundle bundleForClass:[self class]], @"");
}

@end

// Compatibility wrappers for third-party pref panes that use methods that we
// have renamed or modified. Should not be used for any new development.
@implementation PreferencePaneBase (LegacyCompatibility)

- (NSString*)getLocalizedString:(NSString*)key
{
  return [self localizedStringForKey:key];
}

@end

