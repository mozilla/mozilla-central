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
* Stuart Morgan
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

#import <Cocoa/Cocoa.h>

class nsIPermission;
class nsIPermissionManager;

// Policy constants.
__attribute__((visibility("default"))) extern const int CHPermissionUnknown;
__attribute__((visibility("default"))) extern const int CHPermissionAllow;
__attribute__((visibility("default"))) extern const int CHPermissionDeny;
// Cookie-only policy constant.
__attribute__((visibility("default"))) extern const int CHPermissionAllowForSession;

// Permission type constants.
__attribute__((visibility("default"))) extern NSString* const CHPermissionTypeCookie;
__attribute__((visibility("default"))) extern NSString* const CHPermissionTypePopup;

// An object encompasing a specific permission entry. Used only for enumerating
// existing permissions; to check or set the permissions for a single host,
// use CHPermissionManager directly.
@interface CHPermission : NSObject {
 @private
  NSString* mHost;   // strong
  NSString* mType;   // strong
  int       mPolicy;
}

// The host the permission applies to.
- (NSString*)host;

// The type of the permission. May be an arbitrary value, but common values
// are defined in the CHPermissionType* constants.
- (NSString*)type;

// The policy for the permission. May be an arbitrary value, but common values
// are defined in the CHPermission* constants.
- (int)policy;
- (void)setPolicy:(int)policy;

@end

#pragma mark -

// The object responsible for querying and setting the permissions (cookies,
// popups, etc.) of specific hosts. Wraps the Gecko nsIPermissionManager. 
@interface CHPermissionManager : NSObject {
 @private
  nsIPermissionManager* mManager; // strong
}

// Returns the shared CHPermissionManager instance.
+ (CHPermissionManager*)permissionManager;

// Gets all permissions of the given type. |type| can be an arbitrary value,
// but common types are defined in the CHPermissionType* constants.
- (NSArray*)permissionsOfType:(NSString*)type;

// Removes a specific permission for host |host|
- (void)removePermissionForHost:(NSString*)host type:(NSString*)type;

// Clears all permissions, of all types, far all hosts. Handle with care.
- (void)removeAllPermissions;

// Getters and setters for individual site policies. Sites can be specified
// either by host (www.foo.com) or full URI. Policy and type may be arbitrary
// values, but common values are defined as constants above.
- (int)policyForHost:(NSString*)host type:(NSString*)type;
- (int)policyForURI:(NSString*)uri type:(NSString*)type;
- (void)setPolicy:(int)policy forHost:(NSString*)host type:(NSString*)type;
- (void)setPolicy:(int)policy forURI:(NSString*)uri type:(NSString*)type;

@end
