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
 
#import "PrivacyPane.h"

#import "NSString+Gecko.h"
#import "NSArray+Utils.h"
#import "CHPermissionManager.h"
#import "ExtendedTableView.h"

#include "nsCOMPtr.h"
#include "nsServiceManagerUtils.h"
#include "nsNetCID.h"
#include "nsICookie.h"
#include "nsICookieManager.h"
#include "nsIPref.h"
#include "nsISimpleEnumerator.h"
#include "nsNetUtil.h"
#include "nsString.h"

// we should really get this from "CHBrowserService.h",
// but that requires linkage and extra search paths.
static NSString* XPCOMShutDownNotificationName = @"XPCOMShutDown";

// prefs for keychain password autofill
static const char* const gUseKeychainPref = "chimera.store_passwords_with_keychain";

// network.cookie.lifetimePolicy settings
const int kAcceptCookiesNormally = 0;
const int kWarnAboutCookies = 1;

// sort order indicators
const int kSortReverse = 1;

@interface OrgMozillaChimeraPreferencePrivacy(Private)

// helper method for blocking/allowing multiple sites at once
- (void)addPermissionForSelection:(int)inPermission;

- (int)numCookiesSelectedInCookiePanel;
- (int)numPermissionsSelectedInPermissionsPanel;
// get the number of unique cookie sites that are selected,
// and if it's just one, return the site name (with leading period removed, if necessary)
- (int)numUniqueCookieSitesSelected:(NSString**)outSiteName;
- (NSString*)permissionsBlockingNameForCookieHostname:(NSString*)inHostname;
- (NSArray*)selectedCookieSites;
- (int)indexForPolicy:(int)policy;
- (int)policyForIndex:(int)index;
- (void)updateSortIndicatorWithColumn:(NSTableColumn *)aTableColumn;
- (void)sortCookiesByColumn:(NSTableColumn *)aTableColumn inAscendingOrder:(BOOL)ascending;
- (void)sortPermissionsByKey:(NSString *)sortKey inAscendingOrder:(BOOL)ascending;

@end

#pragma mark -

PR_STATIC_CALLBACK(int) compareCookieHosts(nsICookie* aCookie1, nsICookie* aCookie2, void* aData)
{
  nsCAutoString host1;
  aCookie1->GetHost(host1);
  nsCAutoString host2;
  aCookie2->GetHost(host2);
  if ((int)aData == kSortReverse)
    return Compare(host2, host1);
  else
    return Compare(host1, host2);
}

PR_STATIC_CALLBACK(int) compareNames(nsICookie* aCookie1, nsICookie* aCookie2, void* aData)
{
  nsCAutoString name1;
  aCookie1->GetName(name1);
  nsCAutoString name2;
  aCookie2->GetName(name2);
  
  if ((int)aData == kSortReverse)
    return Compare(name2, name1);
  else
    return Compare(name1, name2);
}

PR_STATIC_CALLBACK(int) comparePaths(nsICookie* aCookie1, nsICookie* aCookie2, void* aData)
{
  nsCAutoString path1;
  aCookie1->GetPath(path1);
  nsCAutoString path2;
  aCookie2->GetPath(path2);
  
  if ((int)aData == kSortReverse)
    return Compare(path1, path2);
  else
    return Compare(path2, path1);
}

PR_STATIC_CALLBACK(int) compareSecures(nsICookie* aCookie1, nsICookie* aCookie2, void* aData)
{
  PRBool secure1;
  aCookie1->GetIsSecure(&secure1);
  PRBool secure2;
  aCookie2->GetIsSecure(&secure2);
  
  if (secure1 == secure2)
    return 0;
  if ((int)aData == kSortReverse)
    return (secure2) ? -1 : 1;
  else
    return (secure1) ? -1 : 1;
}

PR_STATIC_CALLBACK(int) compareExpires(nsICookie* aCookie1, nsICookie* aCookie2, void* aData)
{
  PRUint64 expires1;
  aCookie1->GetExpires(&expires1);
  PRUint64 expires2;
  aCookie2->GetExpires(&expires2);
  
  if (expires1 == expires2) return 0;
  if ((int)aData == kSortReverse)
    return (expires2 < expires1) ? -1 : 1;
  else
    return (expires1 < expires2) ? -1 : 1;
}

PR_STATIC_CALLBACK(int) compareValues(nsICookie* aCookie1, nsICookie* aCookie2, void* aData)
{
  nsCAutoString value1;
  aCookie1->GetValue(value1);
  nsCAutoString value2;
  aCookie2->GetValue(value2);
  if ((int)aData == kSortReverse)
    return Compare(value2, value1);
  else
    return Compare(value1, value2);
}

#pragma mark -

@implementation OrgMozillaChimeraPreferencePrivacy

-(void) dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];

  // NOTE: no need to worry about mCachedPermissions or mCachedCookies because
  // if we're going away the respective sheets have closed and cleaned up.
  
  NS_IF_RELEASE(mCookieManager);
  [super dealloc];
}

- (void)xpcomShutdown:(NSNotification*)notification
{
  // this nulls the pointer
  NS_IF_RELEASE(mCookieManager);
}

-(void) mainViewDidLoad
{
  if (!mPrefService)
    return;
  
  // we need to register for xpcom shutdown so that we can clear the
  // services before XPCOM is shut down. We can't rely on dealloc, 
  // because we don't know when it will get called (we might be autoreleased).
  [[NSNotificationCenter defaultCenter] addObserver:self
                              selector:@selector(xpcomShutdown:)
                              name:XPCOMShutDownNotificationName
                              object:nil];

  // Hookup cookie prefs.
  PRInt32 acceptCookies = eAcceptAllCookies;
  mPrefService->GetIntPref("network.cookie.cookieBehavior", &acceptCookies);
  [self mapCookiePrefToGUI:acceptCookies];

  // lifetimePolicy now controls asking about cookies, despite being totally unintuitive
  PRInt32 lifetimePolicy = kAcceptCookiesNormally;
  mPrefService->GetIntPref("network.cookie.lifetimePolicy", &lifetimePolicy);
  if (lifetimePolicy == kWarnAboutCookies)
    [mAskAboutCookies setState:NSOnState];
  else if (lifetimePolicy == kAcceptCookiesNormally)
    [mAskAboutCookies setState:NSOffState];
  else
    [mAskAboutCookies setState:NSMixedState];

  // store cookie manager service
  nsCOMPtr<nsICookieManager> cm(do_GetService(NS_COOKIEMANAGER_CONTRACTID));
  mCookieManager = cm.get();
  NS_IF_ADDREF(mCookieManager);

  // Keychain checkbox
  PRBool storePasswords = PR_TRUE;
  mPrefService->GetBoolPref(gUseKeychainPref, &storePasswords);
  [mStorePasswords setState:(storePasswords ? NSOnState : NSOffState)];

  // set up policy popups
  NSPopUpButtonCell *popupButtonCell = [mPermissionColumn dataCell];
  [popupButtonCell setEditable:YES];
  [popupButtonCell addItemsWithTitles:[NSArray arrayWithObjects:[self localizedStringForKey:@"Allow"],
                                                                [self localizedStringForKey:@"Allow for Session"],
                                                                [self localizedStringForKey:@"Deny"],
                                                                nil]];
}

-(void) mapCookiePrefToGUI:(int)pref
{
  [mCookieBehavior selectCellWithTag:pref];
  [mAskAboutCookies setEnabled:(pref == eAcceptAllCookies || pref == eAcceptCookiesFromOriginatingServer)];
}

//
// Stored cookie editing methods
//

-(void) populateCookieCache
{
  nsCOMPtr<nsISimpleEnumerator> cookieEnum;
  if (mCookieManager)
    mCookieManager->GetEnumerator(getter_AddRefs(cookieEnum));
  
  mCachedCookies = new nsCOMArray<nsICookie>;
  if (mCachedCookies && cookieEnum) {
    mCachedCookies->Clear();
    PRBool hasMoreElements = PR_FALSE;
    cookieEnum->HasMoreElements(&hasMoreElements);
    while (hasMoreElements) {
      nsCOMPtr<nsICookie> cookie;
      cookieEnum->GetNext(getter_AddRefs(cookie));
      mCachedCookies->AppendObject(cookie);
      cookieEnum->HasMoreElements(&hasMoreElements);
    }
  }
}

-(IBAction) editCookies:(id)aSender
{
  // build parallel cookie list
  [self populateCookieCache];
  
  [mCookiesTable setDeleteAction:@selector(removeCookies:)];
  [mCookiesTable setTarget:self];
  
  CookieDateFormatter* cookieDateFormatter = [[CookieDateFormatter alloc] initWithDateFormat:@"%b %d, %Y" allowNaturalLanguage:NO];
  // Once we are 10.4+, the above and all the CF stuff in CookieDateFormatter
  // can be replaced with the following:
  //CookieDateFormatter* cookieDateFormatter = [[CookieDateFormatter alloc] init];
  //[cookieDateFormatter setFormatterBehavior:NSDateFormatterBehavior10_4];
  //[cookieDateFormatter setDateStyle:NSDateFormatterMediumStyle];
  //[cookieDateFormatter setTimeStyle:NSDateFormatterNoStyle];
  [[[mCookiesTable tableColumnWithIdentifier:@"Expires"] dataCell] setFormatter:cookieDateFormatter];
  [cookieDateFormatter release];

  // start sorted by host
  mCachedCookies->Sort(compareCookieHosts, nsnull);
  NSTableColumn* sortedColumn = [mCookiesTable tableColumnWithIdentifier:@"Website"];
  [mCookiesTable setHighlightedTableColumn:sortedColumn];
  [mCookiesTable setIndicatorImage:[NSImage imageNamed:@"NSAscendingSortIndicator"]
                     inTableColumn:sortedColumn];
  mSortedAscending = YES;
  
  // ensure a row is selected (cocoa doesn't do this for us, but will keep
  // us from unselecting a row once one is set; go figure).
  [mCookiesTable selectRow:0 byExtendingSelection:NO];
  
  [mCookiesTable setUsesAlternatingRowBackgroundColors:YES];
  NSArray* columns = [mCookiesTable tableColumns];
  if (columns) {
    int numColumns = [columns count];
    for (int i = 0; i < numColumns; ++i)
      [[[columns objectAtIndex:i] dataCell] setDrawsBackground:NO];
  }
  
  //clear the filter field
  [mCookiesFilterField setStringValue:@""];

  // we shouldn't need to do this, but the scrollbar won't enable unless we
  // force the table to reload its data. Oddly it gets the number of rows correct,
  // it just forgets to tell the scrollbar. *shrug*
  [mCookiesTable reloadData];
  
  [mCookiesPanel setFrameAutosaveName:@"cookies_sheet"];
  
  // bring up sheet
  [NSApp beginSheet:mCookiesPanel
     modalForWindow:[mAskAboutCookies window]   // any old window accessor
      modalDelegate:self
     didEndSelector:NULL
        contextInfo:NULL];
  NSSize min = {440, 240};
  [mCookiesPanel setMinSize:min];
}

-(IBAction) removeCookies:(id)aSender
{
  int rowToSelect = -1;

  if (mCachedCookies && mCookieManager) {
    NSArray *rows = [[mCookiesTable selectedRowEnumerator] allObjects];
    NSEnumerator *e = [rows reverseObjectEnumerator];
    NSNumber *index;
    while ((index = [e nextObject]))
    {
      int row = [index intValue];
      if (rowToSelect == -1)
        rowToSelect = row;
      else
        --rowToSelect;

      nsCAutoString host, name, path;
      mCachedCookies->ObjectAt(row)->GetHost(host);
      mCachedCookies->ObjectAt(row)->GetName(name);
      mCachedCookies->ObjectAt(row)->GetPath(path);
      mCookieManager->Remove(host, name, path, PR_FALSE);  // don't block permanently
      mCachedCookies->RemoveObjectAt(row);
    }
  }
  
  [mCookiesTable reloadData];

  if (rowToSelect >=0 && rowToSelect < [mCookiesTable numberOfRows])
    [mCookiesTable selectRow:rowToSelect byExtendingSelection:NO];
  else
    [mCookiesTable deselectAll:self];
}

-(IBAction) removeAllCookies: (id)aSender
{
  if (NSRunCriticalAlertPanel([self localizedStringForKey:@"RemoveAllCookiesWarningTitle"],
                              [self localizedStringForKey:@"RemoveAllCookiesWarning"],
                              [self localizedStringForKey:@"Remove All Cookies"],
                              [self localizedStringForKey:@"CancelButtonText"],
                              nil) == NSAlertDefaultReturn)
  {
    if (mCookieManager) {
      // remove all cookies from cookie manager
      mCookieManager->RemoveAll();
      // create new cookie cache
      delete mCachedCookies;
      mCachedCookies = new nsCOMArray<nsICookie>;
    }
    [mCookiesTable reloadData];
  }
}

-(IBAction) allowCookiesFromSites:(id)aSender
{
  [self addPermissionForSelection:CHPermissionAllow];
}

-(IBAction) blockCookiesFromSites:(id)aSender
{
  [self addPermissionForSelection:CHPermissionDeny];
}

-(IBAction) removeCookiesAndBlockSites:(id)aSender
{
  if (mCachedCookies) {
    // first fetch the list of sites
    NSArray* selectedSites = [self selectedCookieSites];
    int rowToSelect = -1;
    
    // remove the cookies
    for (int row = 0; row < mCachedCookies->Count(); row++) {
      nsCAutoString host, name, path;
      // only search on the host
      mCachedCookies->ObjectAt(row)->GetHost(host);
      NSString* cookieHost = [NSString stringWith_nsACString:host];
      if ([selectedSites containsObject:cookieHost])
      {
        if (rowToSelect == -1)
          rowToSelect = row;

        mCachedCookies->ObjectAt(row)->GetName(name);
        mCachedCookies->ObjectAt(row)->GetPath(path);
        mCookieManager->Remove(host, name, path, PR_FALSE);  // don't block permanently
        mCachedCookies->RemoveObjectAt(row);
        --row;    // to account for removal
      }
    }
    
    // and block the sites
    CHPermissionManager* permManager = [CHPermissionManager permissionManager];
    NSEnumerator* sitesEnum = [selectedSites objectEnumerator];
    NSString* curSite;
    while ((curSite = [sitesEnum nextObject]))
      [permManager setPolicy:CHPermissionDeny
                     forHost:curSite
                        type:CHPermissionTypeCookie];

    // and reload data
    [mCookiesTable reloadData];

    if (rowToSelect >=0 && rowToSelect < [mCookiesTable numberOfRows])
      [mCookiesTable selectRow:rowToSelect byExtendingSelection:NO];
    else
      [mCookiesTable deselectAll:self];
  }
}

-(IBAction) editCookiesDone:(id)aSender
{
  // save stuff
  [mCookiesPanel orderOut:self];
  [NSApp endSheet:mCookiesPanel];

  delete mCachedCookies;
  mCachedCookies = nsnull;
}

//
// Site permission editing methods

-(void) populatePermissionCache
{
  if (mCachedPermissions)
    [mCachedPermissions release];
  mCachedPermissions = [[[CHPermissionManager permissionManager]
                           permissionsOfType:CHPermissionTypeCookie] mutableCopy];
  if (!mCachedPermissions)
    mCachedPermissions = [[NSMutableArray alloc] init];
}

-(IBAction) editPermissions:(id)aSender
{
  // build parallel permission list for speed with a lot of blocked sites
  [self populatePermissionCache];

  [mPermissionsTable setDeleteAction:@selector(removeCookiePermissions:)];
  [mPermissionsTable setTarget:self];

  [mPermissionsTable setUsesAlternatingRowBackgroundColors:YES];

  //clear the filter field
  [mPermissionFilterField setStringValue: @""];

  // start sorted by host
  mSortedAscending = YES;
  [self sortPermissionsByKey:@"host" inAscendingOrder:YES];

  // ensure a row is selected (cocoa doesn't do this for us, but will keep
  // us from unselecting a row once one is set; go figure).
  if ([mPermissionsTable numberOfRows] > 0)
    [mPermissionsTable selectRow:0 byExtendingSelection:NO];

  [mPermissionsPanel setFrameAutosaveName:@"permissions_sheet"];
  
  // bring up sheet
  [NSApp beginSheet:mPermissionsPanel
     modalForWindow:[mAskAboutCookies window]   // any old window accessor
      modalDelegate:self
     didEndSelector:NULL
        contextInfo:NULL];
  NSSize min = {440, 240};
  [mPermissionsPanel setMinSize:min];
}

-(IBAction) removeCookiePermissions:(id)aSender
{
  CHPermissionManager* permManager = [CHPermissionManager permissionManager];
    
  // Walk the selected rows backwards, removing permissions.
  NSIndexSet* selectedIndexes = [mPermissionsTable selectedRowIndexes];
  for (unsigned int i = [selectedIndexes lastIndex];
       i != NSNotFound;
       i = [selectedIndexes indexLessThanIndex:i])
  {
    [permManager removePermissionForHost:[[mCachedPermissions objectAtIndex:i] host]
                                    type:CHPermissionTypeCookie];
    [mCachedPermissions removeObjectAtIndex:i];
  }

  [mPermissionsTable reloadData];

  // Select the row after the last deleted row.
  if ([mPermissionsTable numberOfRows] > 0) {
    int rowToSelect = [selectedIndexes lastIndex] - ([selectedIndexes count] - 1);
    if ((rowToSelect < 0) || (rowToSelect >= [mPermissionsTable numberOfRows]))
      rowToSelect = [mPermissionsTable numberOfRows] - 1;
    [mPermissionsTable selectRow:rowToSelect byExtendingSelection:NO];
  }
}

-(IBAction) removeAllCookiePermissions: (id)aSender
{
  CHPermissionManager* permManager = [CHPermissionManager permissionManager];
  if (!permManager)
    return;
  if (NSRunCriticalAlertPanel([self localizedStringForKey:@"RemoveAllCookiePermissionsWarningTitle"],
                              [self localizedStringForKey:@"RemoveAllCookiePermissionsWarning"],
                              [self localizedStringForKey:@"Remove All Exceptions"],
                              [self localizedStringForKey:@"CancelButtonText"],
                              nil) == NSAlertDefaultReturn)
  {
    NSEnumerator* permissionEnumerator = [mCachedPermissions objectEnumerator];
    CHPermission* permission;
    while ((permission = [permissionEnumerator nextObject])) {
      [permManager removePermissionForHost:[permission host] type:[permission type]];
      }

    [mCachedPermissions release];
    mCachedPermissions = [[NSMutableArray alloc] init];

    [mPermissionsTable reloadData];
  }
}

-(IBAction) editPermissionsDone:(id)aSender
{
  // save stuff
  [mPermissionsPanel orderOut:self];
  [NSApp endSheet:mPermissionsPanel];
  
  [mCachedPermissions release];
  mCachedPermissions = nil;
}

-(int) rowForPermissionWithHost:(NSString *)aHost
{
  int numRows = [mCachedPermissions count];
  for (int row = 0; row < numRows; ++row) {
    if ([[mCachedPermissions objectAtIndex:row] isEqualToString:aHost])
      return row;
  }
  return -1;
}

//
// NSTableDataSource protocol methods
//

-(int) numberOfRowsInTableView:(NSTableView *)aTableView
{
  int numRows = 0;
  if (aTableView == mPermissionsTable) {
    numRows = [mCachedPermissions count];
  } else if (aTableView == mCookiesTable) {
    if (mCachedCookies)
      numRows = mCachedCookies->Count();
  }

  return (int) numRows;
}

-(id) tableView:(NSTableView *)aTableView objectValueForTableColumn:(NSTableColumn *)aTableColumn row:(int)rowIndex
{
  id retVal = nil;
  if (aTableView == mPermissionsTable) {
    if ([[aTableColumn identifier] isEqualToString: @"host"]) {
      return [[mCachedPermissions objectAtIndex:rowIndex] host];
    }
    else {
      int policy = [[mCachedPermissions objectAtIndex:rowIndex] policy];
      return [NSNumber numberWithInt:[self indexForPolicy:policy]];
    }
  }
  else if (aTableView == mCookiesTable) {
    if (mCachedCookies) {
      nsCAutoString cookieVal;
      if ([[aTableColumn identifier] isEqualToString: @"Website"]) {
        mCachedCookies->ObjectAt(rowIndex)->GetHost(cookieVal);
      } else if ([[aTableColumn identifier] isEqualToString: @"Name"]) {
        mCachedCookies->ObjectAt(rowIndex)->GetName(cookieVal);
      } else if ([[aTableColumn identifier] isEqualToString: @"Path"]) {
        mCachedCookies->ObjectAt(rowIndex)->GetPath(cookieVal);
      } else if ([[aTableColumn identifier] isEqualToString: @"Secure"]) {
        PRBool secure = PR_FALSE;
        mCachedCookies->ObjectAt(rowIndex)->GetIsSecure(&secure);
        return [self localizedStringForKey:(secure ? @"yes": @"no")]; // special case return
      } else if ([[aTableColumn identifier] isEqualToString: @"Expires"]) {
        PRUint64 expires = 0;
        mCachedCookies->ObjectAt(rowIndex)->GetExpires(&expires);
        // If expires is 0, it's a session cookie.
        // We use a custom formatter to display a localised string in this case.
        NSDate *date = [NSDate dateWithTimeIntervalSince1970:(NSTimeInterval)expires];
        return date;   // special case return
      } else if ([[aTableColumn identifier] isEqualToString: @"Value"]) {
        mCachedCookies->ObjectAt(rowIndex)->GetValue(cookieVal);
      }
      retVal = [NSString stringWithCString: cookieVal.get()];
    }
  }
  
  return retVal;
}

// currently, this only applies to the site allow/deny, since that's the only editable column
-(void) tableView:(NSTableView *)aTableView
   setObjectValue:anObject
   forTableColumn:(NSTableColumn *)aTableColumn
              row:(int)rowIndex
{
  if (aTableView == mPermissionsTable && aTableColumn == mPermissionColumn) {
    CHPermission* permission = [mCachedPermissions objectAtIndex:rowIndex];
    [permission setPolicy:[self policyForIndex:[anObject intValue]]];
    
    // Re-sort if policy was the sort column.
    if ([mPermissionsTable highlightedTableColumn] == mPermissionColumn) {
      [self sortPermissionsByKey:[mPermissionColumn identifier] inAscendingOrder:mSortedAscending];
      int newRowIndex = [mCachedPermissions indexOfObject:permission];
      if (newRowIndex != NSNotFound) {
        [aTableView selectRow:newRowIndex byExtendingSelection:NO];
        [aTableView scrollRowToVisible:newRowIndex];
      }
    }
  }
}

-(void) sortPermissionsByKey:(NSString *)sortKey inAscendingOrder:(BOOL)ascending
{
  NSMutableArray* sortDescriptors = [NSMutableArray array];
  NSSortDescriptor *mainSort = [[[NSSortDescriptor alloc] initWithKey:sortKey
                                                            ascending:ascending] autorelease];
  [sortDescriptors addObject:mainSort];
  // When not sorted by host, break ties in host-alphabetical order.
  if (![sortKey isEqualToString:@"host"]) {
    NSSortDescriptor *hostSort = [[[NSSortDescriptor alloc] initWithKey:@"host"
                                                              ascending:YES] autorelease];
    [sortDescriptors addObject:hostSort];
    }
  [mCachedPermissions sortUsingDescriptors:sortDescriptors];

  [mPermissionsTable reloadData];

  [self updateSortIndicatorWithColumn:[mPermissionsTable tableColumnWithIdentifier:sortKey]];
}

-(void) sortCookiesByColumn:(NSTableColumn *)aTableColumn inAscendingOrder:(BOOL)ascending
{
  if(mCachedCookies) {
    if ([[aTableColumn identifier] isEqualToString:@"Website"])
      mCachedCookies->Sort(compareCookieHosts, (ascending) ? nsnull : (void *)kSortReverse);
    else if ([[aTableColumn identifier] isEqualToString:@"Name"])
      mCachedCookies->Sort(compareNames, (ascending) ? nsnull : (void *)kSortReverse);
    else if ([[aTableColumn identifier] isEqualToString:@"Path"])
      mCachedCookies->Sort(comparePaths, (ascending) ? nsnull : (void *)kSortReverse);
    else if ([[aTableColumn identifier] isEqualToString:@"Secure"])
      mCachedCookies->Sort(compareSecures, (ascending) ? nsnull : (void *)kSortReverse);
    else if ([[aTableColumn identifier] isEqualToString:@"Expires"])
      mCachedCookies->Sort(compareExpires, (ascending) ? nsnull : (void *)kSortReverse);
    else if ([[aTableColumn identifier] isEqualToString:@"Value"])
      mCachedCookies->Sort(compareValues, (ascending) ? nsnull : (void *)kSortReverse);

    [mCookiesTable reloadData];
    
    [self updateSortIndicatorWithColumn:aTableColumn];
  }
}

- (void)updateSortIndicatorWithColumn:(NSTableColumn *)aTableColumn
{
  NSTableView* table = [aTableColumn tableView];
  NSTableColumn* oldColumn = [table highlightedTableColumn];
  if (oldColumn)
    [table setIndicatorImage:nil inTableColumn:oldColumn];
  
  NSImage *sortIndicator = [NSImage imageNamed:(mSortedAscending ? @"NSAscendingSortIndicator"
                                                                 : @"NSDescendingSortIndicator")];
  [table setIndicatorImage:sortIndicator inTableColumn:aTableColumn];
  [table setHighlightedTableColumn:aTableColumn];
}

// NSTableView delegate methods

- (void) tableView:(NSTableView *)aTableView didClickTableColumn:(NSTableColumn *)aTableColumn
{
  // reverse the sort if clicking again on the same column
  if (aTableColumn == [aTableView highlightedTableColumn])
    mSortedAscending = !mSortedAscending;
  else
    mSortedAscending = YES;
  
  if (aTableView == mPermissionsTable) {
    if (mCachedPermissions) {
      // save the currently selected rows, if any.
      NSMutableArray* selectedItems = [NSMutableArray array];
      NSIndexSet* selectedIndexes = [mPermissionsTable selectedRowIndexes];
      for (unsigned int i = [selectedIndexes lastIndex];
           i != NSNotFound;
           i = [selectedIndexes indexLessThanIndex:i])
      {
        [selectedItems addObject:[mCachedPermissions objectAtIndex:i]];
      }

      // sort the table data
      [self sortPermissionsByKey:[aTableColumn identifier] inAscendingOrder:mSortedAscending];

      // if any rows were selected before, find them again
      [mPermissionsTable deselectAll:self];
      int selectedItemCount = [selectedItems count];
      for (int i = 0; i < selectedItemCount; ++i) {
        int newRowIndex = [mCachedPermissions indexOfObject:[selectedItems objectAtIndex:i]];
        if (newRowIndex != NSNotFound) {
          // scroll to the first item (arbitrary, but at least one should show)
          if (i == 0)
            [mPermissionsTable scrollRowToVisible:newRowIndex];
          [mPermissionsTable selectRow:newRowIndex byExtendingSelection:YES];
        }
      }
    }
  } else if (aTableView == mCookiesTable) {
    if (mCachedCookies) {
      // save the currently selected rows, if any.
      nsCOMArray<nsICookie> selectedItems;
      NSEnumerator *e = [mCookiesTable selectedRowEnumerator];
      NSNumber *index;
      while ((index = [e nextObject])) {
        int row = [index intValue];
        selectedItems.AppendObject(mCachedCookies->ObjectAt(row));
      }
      // sort the table data
      [self sortCookiesByColumn:aTableColumn inAscendingOrder:mSortedAscending];
      // if any rows were selected before, find them again
      [mCookiesTable deselectAll:self];
      for (int i = 0; i < selectedItems.Count(); ++i) {
        int newRowIndex = mCachedCookies->IndexOf(selectedItems.ObjectAt(i));
        if (newRowIndex >= 0) {
          // scroll to the first item (arbitrary, but at least one should show)
          if (i == 0)
            [mCookiesTable scrollRowToVisible:newRowIndex];
          [mCookiesTable selectRow:newRowIndex byExtendingSelection:YES];
        }
      }
    }
  }
}

//
// Buttons
//

-(IBAction) clickCookieBehavior:(id)sender
{
  int row = [mCookieBehavior selectedRow];
  [self setPref:"network.cookie.cookieBehavior" toInt:row];
  [self mapCookiePrefToGUI:row];
}

-(IBAction) clickAskAboutCookies:(id)sender
{
  [sender setAllowsMixedState:NO];
  [self setPref:"network.cookie.lifetimePolicy" toInt:([sender state] == NSOnState) ? kWarnAboutCookies : kAcceptCookiesNormally];
}


//
// clickStorePasswords
//
-(IBAction) clickStorePasswords:(id)sender
{
  if (!mPrefService)
    return;
  mPrefService->SetBoolPref("chimera.store_passwords_with_keychain",
                            ([mStorePasswords state] == NSOnState) ? PR_TRUE : PR_FALSE);
}

-(IBAction) launchKeychainAccess:(id)sender
{
  FSRef fsRef;
  CFURLRef urlRef;
  OSErr err = ::LSGetApplicationForInfo('APPL', 'kcmr', NULL, kLSRolesAll, &fsRef, &urlRef);
  if (!err) {
    CFStringRef fileSystemURL = ::CFURLCopyFileSystemPath(urlRef, kCFURLPOSIXPathStyle);
    [[NSWorkspace sharedWorkspace] launchApplication:(NSString*)fileSystemURL];
    CFRelease(fileSystemURL);
  }
}

// Delegate method for the filter search fields. Watches for an Enter or
// Return in the filter, and passes it off to the sheet to trigger the default
// button to dismiss the sheet.
- (void)controlTextDidEndEditing:(NSNotification *)aNotification {
  id source = [aNotification object];
  if (!(source == mCookiesFilterField || source == mPermissionFilterField))
    return;
  
  NSEvent* currentEvent = [NSApp currentEvent];
  if (([currentEvent type] == NSKeyDown) && [[currentEvent characters] length] > 0) {
    unichar character = [[currentEvent characters] characterAtIndex:0];
    if ((character == NSCarriageReturnCharacter) || (character == NSEnterCharacter)) {
      if (source == mCookiesFilterField)
        [mCookiesPanel performKeyEquivalent:currentEvent];
      else
        [mPermissionsPanel performKeyEquivalent:currentEvent];
    }
  }
}

- (IBAction)cookieFilterChanged:(id)sender
{
  if (!mCachedCookies || !mCookieManager)
    return;

  NSString* filterString = [sender stringValue];

  // reinitialize the list of cookies in case user deleted or replaced a letter
  [self filterCookiesWithString:filterString];
  // re-sort
  [self sortCookiesByColumn:[mCookiesTable highlightedTableColumn] inAscendingOrder:mSortedAscending];
  [mCookiesTable deselectAll:self];   // don't want any traces of previous selection
  [mCookiesTable reloadData];
}

- (IBAction)permissionFilterChanged:(id)sender
{
  if (!mCachedPermissions)
    return;

  NSString* filterString = [sender stringValue];

  // reinitialize the list of permission in case user deleted or replaced a letter.
  [self filterCookiesPermissionsWithString:filterString];
  // re-sort
  [self sortPermissionsByKey:[[mPermissionsTable highlightedTableColumn] identifier]
            inAscendingOrder:mSortedAscending];

  [mPermissionsTable deselectAll:self];   // don't want any traces of previous selection
  [mPermissionsTable reloadData];
}

- (void)filterCookiesPermissionsWithString:(NSString*)inFilterString
{
  // Reinitialize the list in case the user deleted or replaced a letter.
  [self populatePermissionCache];

  if ([inFilterString length] == 0)
    return;

  for (int i = [mCachedPermissions count] - 1; i >= 0; --i) {
    NSString* host = [[mCachedPermissions objectAtIndex:i] host];
    if ([host rangeOfString:inFilterString].location == NSNotFound)
      [mCachedPermissions removeObjectAtIndex:i];
  }
}

- (void) filterCookiesWithString: (NSString*) inFilterString
{
  // reinitialize the list of cookies in case user deleted a letter or replaced a letter
  [self populateCookieCache];
  
  if ([inFilterString length]) {
    NSMutableArray *indexToRemove = [NSMutableArray array];
    for (int row = 0; row < mCachedCookies->Count(); row++) {
      nsCAutoString host;
      // only search on the host
      mCachedCookies->ObjectAt(row)->GetHost(host);
      if ([[NSString stringWithUTF8String:host.get()] rangeOfString:inFilterString].location == NSNotFound)
        [indexToRemove addObject:[NSNumber numberWithInt:row]];
    }
    
    //remove the items at the saved indexes
    //
    NSEnumerator *theEnum = [indexToRemove reverseObjectEnumerator];
    NSNumber *currentItem;
    while ((currentItem = [theEnum nextObject]))
      mCachedCookies->RemoveObjectAt([currentItem intValue]);
  }
}

- (void)addPermissionForSelection:(int)inPermission
{
  if (mCachedCookies) {
    CHPermissionManager* permManager = [CHPermissionManager permissionManager];
    NSArray* rows = [[mCookiesTable selectedRowEnumerator] allObjects];
    NSEnumerator* e = [rows reverseObjectEnumerator];
    NSNumber* index;
    while ((index = [e nextObject]))
    {
      int row = [index intValue];

      nsCAutoString host;
      mCachedCookies->ObjectAt(row)->GetHost(host);
      [permManager setPolicy:inPermission
                     forHost:[NSString stringWith_nsACString:host]
                        type:CHPermissionTypeCookie];

    }
  }
}

- (int)numCookiesSelectedInCookiePanel
{
  int numSelected = 0;
  if ([mCookiesPanel isVisible])
    numSelected = [mCookiesTable numberOfSelectedRows];

  return numSelected;
}

- (int)numPermissionsSelectedInPermissionsPanel
{
  int numSelected = 0;
  if ([mPermissionsPanel isVisible])
    numSelected = [mPermissionsTable numberOfSelectedRows];

  return numSelected;
}

- (int)numUniqueCookieSitesSelected:(NSString**)outSiteName
{
  if (outSiteName)
    *outSiteName = nil;

  NSArray* selectedSites = [self selectedCookieSites];
  unsigned int numHosts = [selectedSites count];
  if (numHosts == 1 && outSiteName)
    *outSiteName = [self permissionsBlockingNameForCookieHostname:[selectedSites firstObject]];

  return numHosts;
}

- (NSString*)permissionsBlockingNameForCookieHostname:(NSString*)inHostname
{
  // if the host string starts with a '.', remove it (because this is
  // how the permissions manager looks up hosts)
  if ([inHostname hasPrefix:@"."])
    inHostname = [inHostname substringFromIndex:1];
  return inHostname;
}

- (NSArray*)selectedCookieSites
{
  // the set does the uniquifying for us
  NSMutableSet* selectedHostsSet = [[[NSMutableSet alloc] init] autorelease];
  NSEnumerator* e = [mCookiesTable selectedRowEnumerator];
  NSNumber* index;
  while ((index = [e nextObject]))
  {
    int row = [index intValue];

    nsCAutoString host;
    mCachedCookies->ObjectAt(row)->GetHost(host);

    NSString* hostString = [NSString stringWith_nsACString:host];
    [selectedHostsSet addObject:hostString];
  }
  return [selectedHostsSet allObjects];
}

- (BOOL)validateMenuItem:(NSMenuItem*)inMenuItem
{
  SEL action = [inMenuItem action];
  
  // cookies context menu
  if (action == @selector(removeCookies:))
    return ([self numCookiesSelectedInCookiePanel] > 0);

  // only allow "remove all" if we're not filtering
  if (action == @selector(removeAllCookies:))
    return ([[mCookiesFilterField stringValue] length] == 0);

  if (action == @selector(allowCookiesFromSites:))
  {
    NSString* siteName = nil;
    int numCookieSites = [self numUniqueCookieSitesSelected:&siteName];
    NSString* menuTitle = (numCookieSites == 1) ?
                            [NSString stringWithFormat:[self localizedStringForKey:@"AllowCookieFromSite"], siteName] :
                            [self localizedStringForKey:@"AllowCookiesFromSites"];
    [inMenuItem setTitle:menuTitle];
    return (numCookieSites > 0);
  }

  if (action == @selector(blockCookiesFromSites:))
  {
    NSString* siteName = nil;
    int numCookieSites = [self numUniqueCookieSitesSelected:&siteName];
    NSString* menuTitle = (numCookieSites == 1) ?
                            [NSString stringWithFormat:[self localizedStringForKey:@"BlockCookieFromSite"], siteName] :
                            [self localizedStringForKey:@"BlockCookiesFromSites"];
    [inMenuItem setTitle:menuTitle];
    return (numCookieSites > 0);
  }

  if (action == @selector(removeCookiesAndBlockSites:))
  {
    NSString* siteName = nil;
    int numCookieSites = [self numUniqueCookieSitesSelected:&siteName];

    NSString* menuTitle = (numCookieSites == 1) ?
                            [NSString stringWithFormat:[self localizedStringForKey:@"RemoveAndBlockCookieFromSite"], siteName] :
                            [self localizedStringForKey:@"RemoveAndBlockCookiesFromSites"];
    [inMenuItem setTitle:menuTitle];
    return (numCookieSites > 0);
  }

  // permissions context menu
  if (action == @selector(removeCookiePermissions:))
    return ([self numPermissionsSelectedInPermissionsPanel] > 0);

  // only allow "remove all" if we're not filtering
  if (action == @selector(removeAllCookiePermissions:))
    return ([[mPermissionFilterField stringValue] length] == 0);

  return YES;
}

// Private method to convert from a popup index to the corresponding policy.
- (int)indexForPolicy:(int)policy
{
  if (policy == CHPermissionDeny)
    return eDenyIndex;
  if (policy == CHPermissionAllowForSession)
    return eSessionOnlyIndex;
  return eAllowIndex;
}

// Private method to convert from a policy to the corresponding popup index.
- (int)policyForIndex:(int)index
{
  switch (index) {
    case eDenyIndex:
      return CHPermissionDeny;
    case eSessionOnlyIndex:
      return CHPermissionAllowForSession;
    case eAllowIndex:
    default:
      return CHPermissionAllow;
  }
}

@end

#pragma mark -

@implementation CookieDateFormatter

- (id)initWithDateFormat:(NSString*)format allowNaturalLanguage:(BOOL)flag;
{
  if ((self = [super initWithDateFormat:format allowNaturalLanguage:flag])) {
    CFLocaleRef userLocale = CFLocaleCopyCurrent();
    if (userLocale) {
      mLocaleFormatter = CFDateFormatterCreate(NULL,
                                               userLocale,
                                               kCFDateFormatterMediumStyle,
                                               kCFDateFormatterNoStyle);
      CFRelease(userLocale);
    }
  }
  return self;
}

- (void)dealloc
{
  if (mLocaleFormatter)
    CFRelease(mLocaleFormatter);
  [super dealloc];
}

- (NSString*)stringForObjectValue:(id)anObject
{
  if ([(NSDate*)anObject timeIntervalSince1970] == 0)
    return NSLocalizedStringFromTableInBundle(@"CookieExpiresOnQuit", nil,
                                              [NSBundle bundleForClass:[self class]], nil);
  if (mLocaleFormatter) {
    NSString* dateString = (NSString*)CFDateFormatterCreateStringWithDate(NULL,
                                                                          mLocaleFormatter,
                                                                          (CFDateRef)anObject);
    if (dateString)
      return [dateString autorelease];
  }

  // If all else fails, fall back on the standard date formatter
  return [super stringForObjectValue:anObject];
}

@end
