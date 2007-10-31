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
 * The Original Code is the Mozilla browser.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   william@dell.wisner.name (William Dell Wisner)
 *   josh@mozilla.com (Josh Aas)
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

#import "History.h"
#import "NSString+Utils.h"

#include "nsCOMPtr.h"
#include "nsIServiceManager.h"
#include "nsIBrowserHistory.h"
#include "nsICacheService.h"

const int kDefaultExpireDays = 9;

// A formatter for the history duration that only accepts integers >= 0
@interface NonNegativeIntegerFormatter : NSFormatter
{
}
@end

@implementation NonNegativeIntegerFormatter

- (NSString *)stringForObjectValue:(id)anObject
{
  return [anObject stringValue];
}

- (BOOL)getObjectValue:(id *)anObject forString:(NSString *)string errorDescription:(NSString **)error
{
  *anObject = [NSNumber numberWithInt:[string intValue]];
  return YES;
}

- (BOOL)isPartialStringValid:(NSString *)partialString newEditingString:(NSString **)newString errorDescription:(NSString **)error
{
  NSCharacterSet* nonDigitSet = [[NSCharacterSet decimalDigitCharacterSet] invertedSet];
  if ([partialString rangeOfCharacterFromSet:nonDigitSet].location != NSNotFound) {
    *newString = [partialString stringByRemovingCharactersInSet:nonDigitSet];
    return NO;
  }
  return YES;
}

@end

#pragma mark -

@implementation OrgMozillaChimeraPreferenceHistory

- (void)mainViewDidLoad
{
  BOOL gotPref;
  int expireDays = [self getIntPref:"browser.history_expire_days" withSuccess:&gotPref];
  if (!gotPref)
    expireDays = kDefaultExpireDays;
  
  [textFieldHistoryDays setIntValue:expireDays];
  [textFieldHistoryDays setFormatter:[[[NonNegativeIntegerFormatter alloc] init] autorelease]];
}

- (void)didUnselect
{
  [self setPref:"browser.history_expire_days" toInt:[textFieldHistoryDays intValue]];
}

- (IBAction)historyDaysModified:(id)sender
{
  [self setPref:"browser.history_expire_days" toInt:[sender intValue]];
}

// Clear the user's disk cache
- (IBAction)clearDiskCache:(id)aSender
{
  NSBeginCriticalAlertSheet([self localizedStringForKey:@"EmptyCacheTitle"],
                            [self localizedStringForKey:@"EmptyButton"],
                            [self localizedStringForKey:@"CancelButtonText"],
                            nil,
                            [textFieldHistoryDays window],    // any view will do
                            self,
                            @selector(clearDiskCacheSheetDidEnd:returnCode:contextInfo:),
                            nil,
                            NULL,
                            [self localizedStringForKey:@"EmptyCacheMessage"]);
}

// use the browser history service to clear out the user's global history
- (IBAction)clearGlobalHistory:(id)sender
{
  NSBeginCriticalAlertSheet([self localizedStringForKey:@"ClearHistoryTitle"],
                            [self localizedStringForKey:@"ClearHistoryButton"],
                            [self localizedStringForKey:@"CancelButtonText"],
                            nil,
                            [textFieldHistoryDays window],    // any view willl do
                            self,
                            @selector(clearGlobalHistorySheetDidEnd:returnCode:contextInfo:),
                            nil,
                            NULL,
                            [self localizedStringForKey:@"ClearHistoryMessage"]);
}

#pragma mark -

- (void)clearDiskCacheSheetDidEnd:(NSWindow *)sheet returnCode:(int)returnCode contextInfo:(void *)contextInfo
{
  if (returnCode == NSAlertDefaultReturn) {
    nsCOMPtr<nsICacheService> cacheServ (do_GetService("@mozilla.org/network/cache-service;1"));
    if (cacheServ)
      cacheServ->EvictEntries(nsICache::STORE_ANYWHERE);
  }
}

- (void)clearGlobalHistorySheetDidEnd:(NSWindow *)sheet returnCode:(int)returnCode contextInfo:(void *)contextInfo
{
  if (returnCode == NSAlertDefaultReturn) {
    nsCOMPtr<nsIBrowserHistory> hist (do_GetService("@mozilla.org/browser/global-history;2"));
    if (hist)
      hist->RemoveAllPages();
  }
}

@end
