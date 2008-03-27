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

#import "NSArray+Utils.h"
#import "CHCookieStorage.h"
#import "CHPermissionManager.h"
#import "ExtendedTableView.h"
#import "KeychainDenyList.h"
#import "GeckoPrefConstants.h"

@interface CookieDateFormatter : NSDateFormatter
@end

// prefs for keychain password autofill
static const char* const kUseKeychainPref = "chimera.store_passwords_with_keychain";

// sort order indicators
const int kSortReverse = 1;

@interface OrgMozillaCaminoPreferencePrivacy(Private)

- (void)mapCookiePrefToGUI:(int)pref;

- (void)loadCookies;
- (NSArray*)selectedCookieSites;
- (void)addPermissionForSelection:(int)inPermission;
- (int)numUniqueCookieSitesSelected:(NSString**)outSiteName;
- (NSString*)permissionsBlockingNameForCookieHostname:(NSString*)inHostname;

- (void)loadPermissions;
- (int)rowForPermissionWithHost:(NSString *)aHost;
+ (int)indexForPolicy:(int)policy;
+ (int)policyForIndex:(int)index;
+ (NSString*)superdomainForHost:(NSString*)host;

- (void)loadKeychainExclusions;

- (void)initializeTable:(ExtendedTableView*)table
     withInitialSortKey:(NSString*)sortKey
           deleteAction:(SEL)deleteAction;
- (void)sortByColumn:(NSTableColumn*)tableColumn;
- (void)updateSortIndicatorWithColumn:(NSTableColumn*)aTableColumn;
- (void)sortCookiesByKey:(NSString*)sortKey
        inAscendingOrder:(BOOL)ascending;
- (void)sortPermissionsByKey:(NSString*)sortKey
            inAscendingOrder:(BOOL)ascending;
- (void)sortKeychainExclusionsByKey:(NSString*)sortKey
                   inAscendingOrder:(BOOL)asecending;
- (void)filterCookiesPermissionsWithString:(NSString*)inFilterString;
- (void)filterCookiesWithString:(NSString*)inFilterString;
- (void)filterKeychainExclusionsWithString:(NSString*)filterString;

@end

#pragma mark -

@interface NSString(HostSortComparator)
- (NSComparisonResult)reverseHostnameCompare:(NSString *)otherString;
@end

@implementation NSString(HostSortComparator)
- (NSComparisonResult)reverseHostnameCompare:(NSString *)otherString {
  NSArray* selfComponents = [self componentsSeparatedByString:@"."];
  NSArray* otherStringComponents = [otherString componentsSeparatedByString:@"."];
  int selfIndex = [selfComponents count] - 1;
  int otherIndex = [otherStringComponents count] - 1;
  for (; selfIndex >= 0 && otherIndex >= 0; --selfIndex, --otherIndex) {
    NSComparisonResult result =
      [[selfComponents objectAtIndex:selfIndex] caseInsensitiveCompare:[otherStringComponents objectAtIndex:otherIndex]];
    if (result != NSOrderedSame)
      return result;
  }
  if (selfIndex < otherIndex)
    return NSOrderedAscending;
  else if (selfIndex > otherIndex)
    return NSOrderedDescending;
  else
    return NSOrderedSame;
}
@end

#pragma mark -

@implementation OrgMozillaCaminoPreferencePrivacy

#pragma mark Main Pane

- (void)dealloc
{
  // These should have been released when the sheets closed, but make sure.
  [mPermissions release];
  [mCookies release];
  [mKeychainExclusions release];

  [super dealloc];
}

- (void)mainViewDidLoad
{
  // Hook up cookie prefs.
  BOOL gotPref = NO;
  int acceptCookies = [self getIntPref:kGeckoPrefCookieDefaultAcceptPolicy
                           withSuccess:&gotPref];
  if (!gotPref)
    acceptCookies = kCookieAcceptAll;
  [self mapCookiePrefToGUI:acceptCookies];

  // lifetimePolicy now controls asking about cookies, despite being totally unintuitive
  int lifetimePolicy = [self getIntPref:kGeckoPrefCookieLifetimePolicy
                            withSuccess:&gotPref];
  if (!gotPref)
    lifetimePolicy = kCookieLifetimeNormal;
  if (lifetimePolicy == kCookieLifetimeAsk)
    [mAskAboutCookies setState:NSOnState];
  else if (lifetimePolicy == kCookieLifetimeNormal)
    [mAskAboutCookies setState:NSOffState];
  else
    [mAskAboutCookies setState:NSMixedState];

  // Keychain checkbox
  BOOL storePasswords = [self getBooleanPref:kUseKeychainPref withSuccess:NULL];
  [mStorePasswords setState:(storePasswords ? NSOnState : NSOffState)];

  // set up policy popups
  NSPopUpButtonCell *popupButtonCell = [mPermissionColumn dataCell];
  [popupButtonCell setEditable:YES];
  [popupButtonCell addItemsWithTitles:[NSArray arrayWithObjects:
    NSLocalizedString(@"Allow", nil),
    NSLocalizedString(@"Allow for Session", nil),
    NSLocalizedString(@"Deny", nil),
    nil]];
}

- (IBAction)clickCookieBehavior:(id)sender
{
  int row = [mCookieBehavior selectedRow];
  [self setPref:kGeckoPrefCookieDefaultAcceptPolicy toInt:row];
  [self mapCookiePrefToGUI:row];
}

- (IBAction)clickAskAboutCookies:(id)sender
{
  [sender setAllowsMixedState:NO];
  [self setPref:kGeckoPrefCookieLifetimePolicy
          toInt:([sender state] == NSOnState) ? kCookieLifetimeAsk
                                              : kCookieLifetimeNormal];
}

- (IBAction)clickStorePasswords:(id)sender
{
  [self setPref:kUseKeychainPref toBoolean:([mStorePasswords state] == NSOnState)];
}

- (IBAction)launchKeychainAccess:(id)sender
{
  CFURLRef urlRef;
  OSErr err = ::LSGetApplicationForInfo('APPL', 'kcmr', NULL, kLSRolesAll,
                                        NULL, &urlRef);
  if (!err) {
    CFStringRef fileSystemURL = ::CFURLCopyFileSystemPath(urlRef, kCFURLPOSIXPathStyle);
    [[NSWorkspace sharedWorkspace] launchApplication:(NSString*)fileSystemURL];
    ::CFRelease(fileSystemURL);
    ::CFRelease(urlRef);
  }
}

- (void)mapCookiePrefToGUI:(int)pref
{
  [mCookieBehavior selectCellWithTag:pref];
  [mAskAboutCookies setEnabled:(pref == kCookieAcceptAll ||
                                pref == kCookieAcceptFromOriginatingServer)];
}

#pragma mark -
#pragma mark Cookie Sheet

- (IBAction)editCookies:(id)aSender
{
  // build cookie list
  [self loadCookies];

  CookieDateFormatter* dateFormatter = [[CookieDateFormatter alloc] init];
  [dateFormatter setFormatterBehavior:NSDateFormatterBehavior10_4];
  [dateFormatter setDateStyle:NSDateFormatterMediumStyle];
  [dateFormatter setTimeStyle:NSDateFormatterNoStyle];
  [[[mCookiesTable tableColumnWithIdentifier:@"expiresDate"] dataCell] setFormatter:dateFormatter];
  [dateFormatter release];

  [self initializeTable:mCookiesTable
     withInitialSortKey:@"domain"
           deleteAction:@selector(removeCookies:)];

  // This is an artifact of something weird in the nib; if the table is
  // rebuilt (or the nib is otherwise fixed) this can be removed).
  // XXX This may have been 10.2-specific, so it may be removable now.
  NSArray* columns = [mCookiesTable tableColumns];
  if (columns) {
    int numColumns = [columns count];
    for (int i = 0; i < numColumns; ++i)
      [[[columns objectAtIndex:i] dataCell] setDrawsBackground:NO];
  }

  [mCookiesFilterField setStringValue:@""];

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

- (IBAction)editCookiesDone:(id)aSender
{
  // save stuff
  [mCookiesPanel orderOut:self];
  [NSApp endSheet:mCookiesPanel];

  [mCookies release];
  mCookies = nil;
}

- (void)loadCookies
{
  if (mCookies)
    [mCookies release];
  mCookies = [[[CHCookieStorage cookieStorage] cookies] mutableCopy];
  if (!mCookies)
    mCookies = [[NSMutableArray alloc] init];
}

- (IBAction)removeCookies:(id)aSender
{
  CHCookieStorage* cookieStorage = [CHCookieStorage cookieStorage];

  // Walk the selected rows backwards, removing cookies.
  NSIndexSet* selectedIndexes = [mCookiesTable selectedRowIndexes];
  for (unsigned int i = [selectedIndexes lastIndex];
       i != NSNotFound;
       i = [selectedIndexes indexLessThanIndex:i])
  {
    [cookieStorage deleteCookie:[mCookies objectAtIndex:i]];
    [mCookies removeObjectAtIndex:i];
  }

  [mCookiesTable reloadData];

  // Select the row after the last deleted row.
  if ([mCookiesTable numberOfRows] > 0) {
    int rowToSelect = [selectedIndexes lastIndex] - ([selectedIndexes count] - 1);
    if ((rowToSelect < 0) || (rowToSelect >= [mCookiesTable numberOfRows]))
      rowToSelect = [mCookiesTable numberOfRows] - 1;
    [mCookiesTable selectRow:rowToSelect byExtendingSelection:NO];
  }
}

- (IBAction)removeAllCookies:(id)aSender
{
  NSAlert* removeAllCookiesAlert = [[[NSAlert alloc] init] autorelease];
  [removeAllCookiesAlert setMessageText:[self localizedStringForKey:@"RemoveAllCookiesWarningTitle"]];
  [removeAllCookiesAlert setInformativeText:[self localizedStringForKey:@"RemoveAllCookiesWarning"]];
  [removeAllCookiesAlert addButtonWithTitle:[self localizedStringForKey:@"Remove All Cookies"]];
  NSButton* dontRemoveButton = [removeAllCookiesAlert addButtonWithTitle:[self localizedStringForKey:@"DontRemoveButtonText"]];
  [dontRemoveButton setKeyEquivalent:@"\e"]; // escape

  [removeAllCookiesAlert setAlertStyle:NSCriticalAlertStyle];

  if ([removeAllCookiesAlert runModal] == NSAlertFirstButtonReturn) {
    [[CHCookieStorage cookieStorage] deleteAllCookies];

    [mCookies release];
    mCookies = [[NSMutableArray alloc] init];

    [mCookiesTable reloadData];
  }
}

- (IBAction)allowCookiesFromSites:(id)aSender
{
  [self addPermissionForSelection:CHPermissionAllow];
}

- (IBAction)blockCookiesFromSites:(id)aSender
{
  [self addPermissionForSelection:CHPermissionDeny];
}

- (IBAction)removeCookiesAndBlockSites:(id)aSender
{
  // Block the sites.
  CHPermissionManager* permManager = [CHPermissionManager permissionManager];
  NSArray* selectedSites = [self selectedCookieSites];
  NSEnumerator* sitesEnum = [selectedSites objectEnumerator];
  NSString* curSite;
  while ((curSite = [sitesEnum nextObject])) {
    [permManager setPolicy:CHPermissionDeny
                    forHost:curSite
                      type:CHPermissionTypeCookie];
  }

  // Then remove the cookies.
  [self removeCookies:aSender];
}

- (NSArray*)selectedCookieSites
{
  // the set does the uniquifying for us
  NSMutableSet* selectedHostsSet = [[[NSMutableSet alloc] init] autorelease];
  NSIndexSet* selectedIndexes = [mCookiesTable selectedRowIndexes];
  for (unsigned int index = [selectedIndexes lastIndex];
       index != NSNotFound;
       index = [selectedIndexes indexLessThanIndex:index])
  {
    [selectedHostsSet addObject:[[mCookies objectAtIndex:index] domain]];
  }
  return [selectedHostsSet allObjects];
}

// Helper method for blocking/allowing multiple sites at once.
- (void)addPermissionForSelection:(int)inPermission
{
  CHPermissionManager* permManager = [CHPermissionManager permissionManager];
  NSIndexSet* selectedIndexes = [mCookiesTable selectedRowIndexes];
  for (unsigned int index = [selectedIndexes lastIndex];
       index != NSNotFound;
       index = [selectedIndexes indexLessThanIndex:index])
  {
    NSString* host = [[mCookies objectAtIndex:index] domain];
    if ([host hasPrefix:@"."] && [host length] > 1)
      host = [host substringFromIndex:1];
    [permManager setPolicy:inPermission
                   forHost:host
                      type:CHPermissionTypeCookie];
  }
}

// Gets the number of unique cookie sites that are selected, and if it's just
// one, |outSiteName| is set to the site name (with any leading period removed).
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

#pragma mark -
#pragma mark Cookie Permissions Sheet

- (IBAction)editPermissions:(id)aSender
{
  [self loadPermissions];

  [mPermissionFilterField setStringValue:@""];

  [self initializeTable:mPermissionsTable
     withInitialSortKey:@"host"
           deleteAction:@selector(removeCookiePermissions:)];

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

- (IBAction)editPermissionsDone:(id)aSender
{
  // save stuff
  [mPermissionsPanel orderOut:self];
  [NSApp endSheet:mPermissionsPanel];

  [mPermissions release];
  mPermissions = nil;
}

- (void)loadPermissions
{
  if (mPermissions)
    [mPermissions release];
  mPermissions = [[[CHPermissionManager permissionManager]
                      permissionsOfType:CHPermissionTypeCookie] mutableCopy];
  if (!mPermissions)
    mPermissions = [[NSMutableArray alloc] init];
}

// Note that this operates only a single row (enforced by menu validation),
// unlike many of the other context menu actions.
- (IBAction)expandCookiePermission:(id)aSender
{
  CHPermission* selectedPermission = [mPermissions objectAtIndex:[mPermissionsTable selectedRow]];
  NSString* host = [selectedPermission host];
  NSString* superdomain = [[self class] superdomainForHost:host];
  int policy = [selectedPermission policy];

  CHPermissionManager* permManager = [CHPermissionManager permissionManager];
  // Walk the permissions, cleaning up any that are superceded by the general
  // policy (but leaving any that have a different policy).
  NSString* domainSuffix = [NSString stringWithFormat:@".%@", superdomain];
  NSEnumerator* permEnumerator = [mPermissions objectEnumerator];
  CHPermission* perm;
  while ((perm = [permEnumerator nextObject])) {
    if ([perm policy] == policy && [[perm host] hasSuffix:domainSuffix])
      [permManager removePermissionForHost:[perm host]
                                      type:CHPermissionTypeCookie];
  }
  // Add the new general policy.
  [permManager setPolicy:policy forHost:superdomain type:CHPermissionTypeCookie];

  // Re-applying the filter will take care of refreshing the cache
  [self filterCookiesPermissionsWithString:[mPermissionFilterField stringValue]];
  [self sortByColumn:[mPermissionsTable highlightedTableColumn]];
  [mPermissionsTable reloadData];

  // Select the new permission.
  if ([mPermissionsTable numberOfRows] > 0) {
    int rowToSelect = [self rowForPermissionWithHost:superdomain];
    if ((rowToSelect >= 0) && (rowToSelect < [mPermissionsTable numberOfRows])) {
      [mPermissionsTable selectRow:rowToSelect byExtendingSelection:NO];
      [mPermissionsTable scrollRowToVisible:rowToSelect];
    }
  }
}

- (IBAction)removeCookiePermissions:(id)aSender
{
  CHPermissionManager* permManager = [CHPermissionManager permissionManager];

  // Walk the selected rows backwards, removing permissions.
  NSIndexSet* selectedIndexes = [mPermissionsTable selectedRowIndexes];
  for (unsigned int i = [selectedIndexes lastIndex];
       i != NSNotFound;
       i = [selectedIndexes indexLessThanIndex:i])
  {
    [permManager removePermissionForHost:[[mPermissions objectAtIndex:i] host]
                                    type:CHPermissionTypeCookie];
    [mPermissions removeObjectAtIndex:i];
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

- (IBAction)removeAllCookiePermissions:(id)aSender
{
  CHPermissionManager* permManager = [CHPermissionManager permissionManager];
  if (!permManager)
    return;

  NSAlert* removeAllCookiePermissionsAlert = [[[NSAlert alloc] init] autorelease];
  [removeAllCookiePermissionsAlert setMessageText:[self localizedStringForKey:@"RemoveAllCookiePermissionsWarningTitle"]];
  [removeAllCookiePermissionsAlert setInformativeText:[self localizedStringForKey:@"RemoveAllCookiePermissionsWarning"]];
  [removeAllCookiePermissionsAlert addButtonWithTitle:[self localizedStringForKey:@"Remove All Exceptions"]];
  NSButton* dontRemoveButton = [removeAllCookiePermissionsAlert addButtonWithTitle:[self localizedStringForKey:@"DontRemoveButtonText"]];
  [dontRemoveButton setKeyEquivalent:@"\e"]; // escape

  [removeAllCookiePermissionsAlert setAlertStyle:NSCriticalAlertStyle];

  if ([removeAllCookiePermissionsAlert runModal] == NSAlertFirstButtonReturn) {
    NSEnumerator* permissionEnumerator = [mPermissions objectEnumerator];
    CHPermission* permission;
    while ((permission = [permissionEnumerator nextObject])) {
      [permManager removePermissionForHost:[permission host] type:[permission type]];
      }

    [mPermissions release];
    mPermissions = [[NSMutableArray alloc] init];

    [mPermissionsTable reloadData];
  }
}

- (int)rowForPermissionWithHost:(NSString *)aHost
{
  int numRows = [mPermissions count];
  for (int row = 0; row < numRows; ++row) {
    if ([[[mPermissions objectAtIndex:row] host] isEqualToString:aHost])
      return row;
  }
  return -1;
}

// Private method to convert from a popup index to the corresponding policy.
+ (int)indexForPolicy:(int)policy
{
  if (policy == CHPermissionDeny)
    return eDenyIndex;
  if (policy == CHPermissionAllowForSession)
    return eSessionOnlyIndex;
  return eAllowIndex;
}

// Private method to convert from a policy to the corresponding popup index.
+ (int)policyForIndex:(int)index
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

// Returns the host that is one level more broad than the given host (e.g.,
// foo.bar.com -> bar.com), or nil if the given host has only one component.
+ (NSString*)superdomainForHost:(NSString*)host
{
  NSRange dotRange = [host rangeOfString:@"."];
  if (dotRange.location == NSNotFound || dotRange.location == ([host length] - 1))
    return nil;
  if (dotRange.location == 0) // .bar.com == bar.com
    return [[self class] superdomainForHost:[host substringFromIndex:1]];
  else
    return [host substringFromIndex:(dotRange.location + 1)];
}

#pragma mark -
#pragma mark Keychain Exclusions Sheet

- (IBAction)editKeychainExclusions:(id)sender {
  [self loadKeychainExclusions];

  [self initializeTable:mKeychainExclusionsTable
     withInitialSortKey:@"Website"
           deleteAction:@selector(removeKeychainExclusions:)];

  [mKeychainExclusionsFilterField setStringValue:@""];

  [mKeychainExclusionsPanel setFrameAutosaveName:@"keychain_exclusions_sheet"];

  [NSApp beginSheet:mKeychainExclusionsPanel
     modalForWindow:[sender window]
      modalDelegate:self
     didEndSelector:NULL
        contextInfo:NULL];

  NSSize min = {350, 225};
  [mKeychainExclusionsPanel setMinSize:min];
}

- (IBAction)editKeychainExclusionsDone:(id)sender {
  [mKeychainExclusionsPanel orderOut:self];
  [NSApp endSheet:mKeychainExclusionsPanel];
  [mKeychainExclusions release];
  mKeychainExclusions = nil;
}

- (void)loadKeychainExclusions {
  [mKeychainExclusions release];
  mKeychainExclusions = [[[KeychainDenyList instance] listHosts] mutableCopy];
}

- (IBAction)removeKeychainExclusions:(id)sender {
  NSIndexSet* selectedIndexes = [mKeychainExclusionsTable selectedRowIndexes];
  for (unsigned int index = [selectedIndexes lastIndex];
       index != NSNotFound;
       index = [selectedIndexes indexLessThanIndex:index]) {
    [[KeychainDenyList instance] removeHost:[mKeychainExclusions objectAtIndex:index]];
    [mKeychainExclusions removeObjectAtIndex:index];
  }

  [mKeychainExclusionsTable reloadData];

  // Select the row after the last deleted row.
  if ([mKeychainExclusionsTable numberOfRows] > 0) {
    int rowToSelect = [selectedIndexes lastIndex] - ([selectedIndexes count] - 1);
    if ((rowToSelect < 0) ||
        (rowToSelect >= [mKeychainExclusionsTable numberOfRows])) {
      rowToSelect = [mKeychainExclusionsTable numberOfRows] - 1;
    }
    [mKeychainExclusionsTable selectRow:rowToSelect byExtendingSelection:NO];
  }
}

- (IBAction)removeAllKeychainExclusions:(id)sender {
  NSAlert* removeAllKeychainExclusionsAlert = [[[NSAlert alloc] init] autorelease];
  [removeAllKeychainExclusionsAlert setMessageText:[self localizedStringForKey:@"RemoveAllKeychainExclusionsWarningTitle"]];
  [removeAllKeychainExclusionsAlert setInformativeText:[self localizedStringForKey:@"RemoveAllKeychainExclusionsWarning"]];
  [removeAllKeychainExclusionsAlert addButtonWithTitle:[self localizedStringForKey:@"RemoveAllKeychainExclusionsButton"]];
  NSButton* dontRemoveButton = [removeAllKeychainExclusionsAlert addButtonWithTitle:[self localizedStringForKey:@"DontRemoveButtonText"]];
  [dontRemoveButton setKeyEquivalent:@"\e"]; // escape

  [removeAllKeychainExclusionsAlert setAlertStyle:NSCriticalAlertStyle];

  if ([removeAllKeychainExclusionsAlert runModal] == NSAlertFirstButtonReturn) {
    [[KeychainDenyList instance] removeAllHosts];
    [mKeychainExclusions removeAllObjects];
    [mKeychainExclusionsTable reloadData];
  }
}

#pragma mark -
#pragma mark Shared Sheet Methods

//
// NSTableDataSource protocol methods
//

- (int)numberOfRowsInTableView:(NSTableView *)aTableView
{
  int numRows = 0;
  if (aTableView == mPermissionsTable) {
    numRows = [mPermissions count];
  } else if (aTableView == mCookiesTable) {
    numRows = [mCookies count];
  } else if (aTableView == mKeychainExclusionsTable) {
    numRows = [mKeychainExclusions count];
  }

  return numRows;
}

- (id)tableView:(NSTableView *)aTableView
objectValueForTableColumn:(NSTableColumn *)aTableColumn
            row:(int)rowIndex
{
  if (aTableView == mPermissionsTable) {
    if ([[aTableColumn identifier] isEqualToString:@"host"]) {
      return [[mPermissions objectAtIndex:rowIndex] host];
    }
    else {
      int policy = [[mPermissions objectAtIndex:rowIndex] policy];
      return [NSNumber numberWithInt:[[self class] indexForPolicy:policy]];
    }
  }
  else if (aTableView == mCookiesTable) {
    if ([[aTableColumn identifier] isEqualToString:@"isSecure"]) {
      BOOL secure = [[mCookies objectAtIndex:rowIndex] isSecure];
      return [self localizedStringForKey:(secure ? @"yes": @"no")];
    } else if ([[aTableColumn identifier] isEqualToString:@"expiresDate"]) {
      NSHTTPCookie* cookie = [mCookies objectAtIndex:rowIndex];
      BOOL isSessionCookie = [cookie isSessionOnly];
      // If it's a session cookie, set the expiration date to the epoch,
      // so the custom formatter can display a localized string.
      return isSessionCookie ? [NSDate dateWithTimeIntervalSince1970:0]
                             : [cookie expiresDate];
    } else {
      return [[mCookies objectAtIndex:rowIndex] valueForKey:[aTableColumn identifier]];
    }
  }
  else if (aTableView == mKeychainExclusionsTable) {
    if ([[aTableColumn identifier] isEqualToString:@"Website"]) {
      return [mKeychainExclusions objectAtIndex:rowIndex];
    }
  }

  return nil;
}

- (void)tableView:(NSTableView *)aTableView
   setObjectValue:anObject
   forTableColumn:(NSTableColumn *)aTableColumn
              row:(int)rowIndex
{
  // Currently, site permission is the only editable column.
  if (aTableView == mPermissionsTable && aTableColumn == mPermissionColumn) {
    CHPermission* permission = [mPermissions objectAtIndex:rowIndex];
    [permission setPolicy:[[self class] policyForIndex:[anObject intValue]]];

    // Re-sort if policy was the sort column.
    if ([mPermissionsTable highlightedTableColumn] == mPermissionColumn) {
      [self sortByColumn:mPermissionColumn];
      int newRowIndex = [mPermissions indexOfObject:permission];
      if (newRowIndex != NSNotFound) {
        [aTableView selectRow:newRowIndex byExtendingSelection:NO];
        [aTableView scrollRowToVisible:newRowIndex];
      }
    }
  }
}

# pragma mark -

- (void)initializeTable:(ExtendedTableView*)table
     withInitialSortKey:(NSString*)sortKey
           deleteAction:(SEL)deleteAction
{
  [table setDeleteAction:deleteAction];
  [table setTarget:self];

  [table setUsesAlternatingRowBackgroundColors:YES];

  mSortedAscending = YES;
  [self sortByColumn:[table tableColumnWithIdentifier:sortKey]];

  // ensure a row is selected (cocoa doesn't do this for us, but will keep
  // us from unselecting a row once one is set; go figure).
  if ([table numberOfRows] > 0)
    [table selectRow:0 byExtendingSelection:NO];
}

- (void)sortByColumn:(NSTableColumn*)tableColumn
{
  NSTableView* table = [tableColumn tableView];
  NSString* sortKey = [tableColumn identifier];

  if (table == mPermissionsTable)
    [self sortPermissionsByKey:sortKey inAscendingOrder:mSortedAscending];
  else if (table == mCookiesTable)
    [self sortCookiesByKey:sortKey inAscendingOrder:mSortedAscending];
  else if (table == mKeychainExclusionsTable)
    [self sortKeychainExclusionsByKey:sortKey inAscendingOrder:mSortedAscending];

  [table reloadData];
  [self updateSortIndicatorWithColumn:tableColumn];
}

- (void)sortPermissionsByKey:(NSString*)sortKey inAscendingOrder:(BOOL)ascending
{
  NSMutableArray* sortDescriptors;
  if ([sortKey isEqualToString:@"host"]) {
    NSSortDescriptor* sort =
      [[[NSSortDescriptor alloc] initWithKey:sortKey
                                   ascending:ascending
                                    selector:@selector(reverseHostnameCompare:)] autorelease];
    sortDescriptors = [NSArray arrayWithObject:sort];
  }
  else {
    NSSortDescriptor* mainSort =
      [[[NSSortDescriptor alloc] initWithKey:sortKey
                                   ascending:ascending] autorelease];
    // When not sorted by host, break ties in host order.
    NSSortDescriptor *hostSort = [[[NSSortDescriptor alloc] initWithKey:@"host"
                                                              ascending:YES
                                                               selector:@selector(reverseHostnameCompare:)] autorelease];
    sortDescriptors = [NSArray arrayWithObjects:mainSort, hostSort, nil];
  }
  [mPermissions sortUsingDescriptors:sortDescriptors];
}

- (void)sortCookiesByKey:(NSString*)sortKey inAscendingOrder:(BOOL)ascending
{
  NSArray* sortDescriptors = nil;
  if ([sortKey isEqualToString:@"domain"]) {
    NSSortDescriptor *sort = [[[NSSortDescriptor alloc] initWithKey:@"domain"
                                                          ascending:ascending
                                                           selector:@selector(reverseHostnameCompare:)] autorelease];
    sortDescriptors = [NSArray arrayWithObject:sort];
  }
  else if ([sortKey isEqualToString:@"expiresDate"]) {
    NSSortDescriptor *sessionSort = [[[NSSortDescriptor alloc] initWithKey:@"isSessionOnly"
                                                                 ascending:ascending] autorelease];
    NSSortDescriptor *expirySort = [[[NSSortDescriptor alloc] initWithKey:@"expiresDate"
                                                                ascending:ascending] autorelease];
    sortDescriptors = [NSArray arrayWithObjects:sessionSort, expirySort, nil];
  }
  else { // All the other column just use a default sort
    NSSortDescriptor *sort = [[[NSSortDescriptor alloc] initWithKey:sortKey
                                                          ascending:ascending] autorelease];
    sortDescriptors = [NSArray arrayWithObject:sort];
  }
  [mCookies sortUsingDescriptors:sortDescriptors];
}

- (void)sortKeychainExclusionsByKey:(NSString*)sortKey
                   inAscendingOrder:(BOOL)ascending {
  NSArray* sortDescriptors = nil;
  if ([sortKey isEqualToString:@"Website"]) {
    NSSortDescriptor* sort =
        [[[NSSortDescriptor alloc] initWithKey:@"self"
                                     ascending:ascending
                                      selector:@selector(reverseHostnameCompare:)] autorelease];
    sortDescriptors = [NSArray arrayWithObject:sort];
  }
  [mKeychainExclusions sortUsingDescriptors:sortDescriptors];
}

- (void)updateSortIndicatorWithColumn:(NSTableColumn *)tableColumn
{
  NSTableView* table = [tableColumn tableView];
  NSTableColumn* oldColumn = [table highlightedTableColumn];
  if (oldColumn)
    [table setIndicatorImage:nil inTableColumn:oldColumn];

  NSImage *sortIndicator = [NSImage imageNamed:(mSortedAscending ? @"NSAscendingSortIndicator"
                                                                 : @"NSDescendingSortIndicator")];
  [table setIndicatorImage:sortIndicator inTableColumn:tableColumn];
  [table setHighlightedTableColumn:tableColumn];
}

// NSTableView delegate methods

- (void)tableView:(NSTableView *)aTableView didClickTableColumn:(NSTableColumn *)aTableColumn
{
  // reverse the sort if clicking again on the same column
  if (aTableColumn == [aTableView highlightedTableColumn])
    mSortedAscending = !mSortedAscending;
  else
    mSortedAscending = YES;

  NSArray* dataSource = nil;
  if (aTableView == mPermissionsTable)
    dataSource = mPermissions;
  else if (aTableView == mCookiesTable)
    dataSource = mCookies;
  else if (aTableView == mKeychainExclusionsTable)
    dataSource = mKeychainExclusions;

  if (!dataSource)
    return;

  // Save the currently selected rows, if any.
  NSMutableArray* selectedItems = [NSMutableArray array];
  NSIndexSet* selectedIndexes = [aTableView selectedRowIndexes];
  for (unsigned int i = [selectedIndexes lastIndex];
       i != NSNotFound;
       i = [selectedIndexes indexLessThanIndex:i])
  {
    [selectedItems addObject:[dataSource objectAtIndex:i]];
  }

  // Sort the table data.
  [self sortByColumn:aTableColumn];

  // If any rows were selected before, find them again.
  [aTableView deselectAll:self];
  for (unsigned int i = 0; i < [selectedItems count]; ++i) {
    int newRowIndex = [dataSource indexOfObject:[selectedItems objectAtIndex:i]];
    if (newRowIndex != NSNotFound) {
      // scroll to the first item (arbitrary, but at least one should show)
      if (i == 0)
        [aTableView scrollRowToVisible:newRowIndex];
      [aTableView selectRow:newRowIndex byExtendingSelection:YES];
    }
  }
}

// Delegate method for the filter search fields. Watches for an Enter or
// Return in the filter, and passes it off to the sheet to trigger the default
// button to dismiss the sheet.
- (void)controlTextDidEndEditing:(NSNotification *)aNotification {
  id source = [aNotification object];
  if (!(source == mCookiesFilterField || source == mPermissionFilterField ||
        source == mKeychainExclusionsFilterField)) {
    return;
  }

  NSEvent* currentEvent = [NSApp currentEvent];
  if (([currentEvent type] == NSKeyDown) && [[currentEvent characters] length] > 0) {
    unichar character = [[currentEvent characters] characterAtIndex:0];
    if ((character == NSCarriageReturnCharacter) || (character == NSEnterCharacter)) {
      if (source == mCookiesFilterField)
        [mCookiesPanel performKeyEquivalent:currentEvent];
      else if (source == mPermissionFilterField)
        [mPermissionsPanel performKeyEquivalent:currentEvent];
      else if (source == mKeychainExclusionsFilterField)
        [mKeychainExclusionsPanel performKeyEquivalent:currentEvent];
    }
  }
}

- (IBAction)filterChanged:(id)sender
{
  NSString* filterString = [sender stringValue];

  // reinitialize the data source in case user deleted or replaced a letter
  NSTableView* activeTable = nil;
  if (sender == mCookiesFilterField) {
    [self filterCookiesWithString:filterString];
    activeTable = mCookiesTable;
  }
  else if (sender == mPermissionFilterField) {
    [self filterCookiesPermissionsWithString:filterString];
    activeTable = mPermissionsTable;
  }
  else if (sender == mKeychainExclusionsFilterField) {
    [self filterKeychainExclusionsWithString:filterString];
    activeTable = mKeychainExclusionsTable;
  }
  else {
    return;
  }

  [self sortByColumn:[activeTable highlightedTableColumn]];

  [activeTable deselectAll:self];
  [activeTable reloadData];
}

- (void)filterCookiesPermissionsWithString:(NSString*)inFilterString
{
  // Reinitialize the list in case the user deleted or replaced a letter.
  [self loadPermissions];

  if ([inFilterString length] == 0)
    return;

  for (int i = [mPermissions count] - 1; i >= 0; --i) {
    NSString* host = [[mPermissions objectAtIndex:i] host];
    if ([host rangeOfString:inFilterString].location == NSNotFound)
      [mPermissions removeObjectAtIndex:i];
  }
}

- (void)filterCookiesWithString:(NSString*)inFilterString
{
  // Reinitialize the list in case the user deleted or replaced a letter.
  [self loadCookies];

  if ([inFilterString length] == 0)
    return;

  for (int i = [mCookies count] - 1; i >= 0; --i) {
    NSString* host = [[mCookies objectAtIndex:i] domain];
    // Only search by host; other fields are probably not interesting to users
    if ([host rangeOfString:inFilterString].location == NSNotFound)
      [mCookies removeObjectAtIndex:i];
  }
}

- (void)filterKeychainExclusionsWithString:(NSString*)filterString
{
  [self loadKeychainExclusions];

  if ([filterString length]) {
    for (int index = [mKeychainExclusions count] - 1; index >= 0; --index) {
      if ([[mKeychainExclusions objectAtIndex:index] rangeOfString:filterString].location == NSNotFound) {
        [mKeychainExclusions removeObjectAtIndex:index];
      }
    }
  }
}

- (BOOL)validateMenuItem:(NSMenuItem*)inMenuItem
{
  SEL action = [inMenuItem action];

  // cookies context menu
  if (action == @selector(removeCookies:))
    return ([mCookiesTable numberOfSelectedRows] > 0);

  // only allow "remove all" when there are items and when not filtering
  if (action == @selector(removeAllCookies:))
    return ([mCookiesTable numberOfRows] > 0 &&
            [[mCookiesFilterField stringValue] length] == 0);

  if (action == @selector(allowCookiesFromSites:)) {
    NSString* siteName = nil;
    int numCookieSites = [self numUniqueCookieSitesSelected:&siteName];
    NSString* menuTitle = (numCookieSites == 1) ?
                            [NSString stringWithFormat:[self localizedStringForKey:@"AllowCookieFromSite"], siteName] :
                            [self localizedStringForKey:@"AllowCookiesFromSites"];
    [inMenuItem setTitle:menuTitle];
    return (numCookieSites > 0);
  }

  if (action == @selector(blockCookiesFromSites:)) {
    NSString* siteName = nil;
    int numCookieSites = [self numUniqueCookieSitesSelected:&siteName];
    NSString* menuTitle = (numCookieSites == 1) ?
                            [NSString stringWithFormat:[self localizedStringForKey:@"BlockCookieFromSite"], siteName] :
                            [self localizedStringForKey:@"BlockCookiesFromSites"];
    [inMenuItem setTitle:menuTitle];
    return (numCookieSites > 0);
  }

  if (action == @selector(removeCookiesAndBlockSites:)) {
    NSString* siteName = nil;
    int numCookieSites = [self numUniqueCookieSitesSelected:&siteName];

    NSString* menuTitle = (numCookieSites == 1) ?
                            [NSString stringWithFormat:[self localizedStringForKey:@"RemoveAndBlockCookieFromSite"], siteName] :
                            [self localizedStringForKey:@"RemoveAndBlockCookiesFromSites"];
    [inMenuItem setTitle:menuTitle];
    return (numCookieSites > 0);
  }

  if (action == @selector(expandCookiePermission:)) {
    // If there is excatly one row selected and it is expandable (i.e., not
    // just a TLD already), enable the menu and give it a  descriptive title,
    // otherwise disable it and give it a generic title.
    int selectedRowCount = [[mPermissionsTable selectedRowIndexes] count];
    NSString* superdomain = nil;
    if (selectedRowCount == 1) {
      NSString* selectedHost = [[mPermissions objectAtIndex:[mPermissionsTable selectedRow]] host];
      superdomain = [[self class] superdomainForHost:selectedHost];
    }
    NSString* menuTitle = superdomain ? [NSString stringWithFormat:[self localizedStringForKey:@"ExpandExceptionForSite"], superdomain]
                                      : [self localizedStringForKey:@"ExpandException"];
    [inMenuItem setTitle:menuTitle];
    return (superdomain != nil);
  }

  // permissions context menu
  if (action == @selector(removeCookiePermissions:))
    return ([mPermissionsTable numberOfSelectedRows] > 0);

  // only allow "remove all" when there are items and when not filtering
  if (action == @selector(removeAllCookiePermissions:))
    return ([mPermissionsTable numberOfRows] > 0 &&
            [[mPermissionFilterField stringValue] length] == 0);

  // Keychain Exclusions context/action menu
  if (action == @selector(removeKeychainExclusions:)) {
    return ([mKeychainExclusionsTable numberOfSelectedRows] > 0);
  }

  if (action == @selector(removeAllKeychainExclusions:)) {
    // Only allow "Remove All..." when there are items to remove, and when
    // no filer is applied.
    return ([mKeychainExclusionsTable numberOfRows] > 0 &&
            [[mKeychainExclusionsFilterField stringValue] length] == 0);
  }

  return YES;
}

@end

#pragma mark -

@implementation CookieDateFormatter

- (NSString*)stringForObjectValue:(id)object {
  if ([object isKindOfClass:[NSDate class]] &&
      [(NSDate*)object timeIntervalSince1970] == 0) {
    return NSLocalizedStringFromTableInBundle(@"CookieExpiresOnQuit",
                                              nil,
                                              [NSBundle bundleForClass:[self class]],
                                              nil);
  }
  return [super stringForObjectValue:object];
}

@end
