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
 * The Original Code is nsIXULAppInfo for Camino.
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Mark Mentovai <mark@moxienet.com> (Original Author)
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

#define XPCOM_TRANSLATE_NSGM_ENTRY_POINT 1

#include "CmXULAppInfo.h"

#include "CmXULAppData.h"
#include "nsIGenericFactory.h"
#include "nsString.h"

//
// CmXULAppInfo module
//

static const CmXULAppInfo kCmXULAppInfo;

static NS_METHOD CmXULAppInfoConstructor(nsISupports *outer,
                                         REFNSIID iid,
                                         void **result) {
  NS_ENSURE_NO_AGGREGATION(outer);
  return const_cast<CmXULAppInfo *>(&kCmXULAppInfo)->QueryInterface(iid,
                                                                    result);
}

// {76849bf1-199d-41a6-aae6-873fcaf123ea}
#define CMXULAPPINFO_CID \
  {0x76849bf1, 0x199d, 0x41a6, {0xaa, 0xe6, 0x87, 0x3f, 0xca, 0xf1, 0x23, 0xea}}

static nsModuleComponentInfo kComponents[] = {
  {
    "CmXULAppInfo",
    CMXULAPPINFO_CID,
    "@mozilla.org/xre/app-info;1",
    CmXULAppInfoConstructor
  }
};

NS_IMPL_NSGETMODULE(CmXULAppInfoModule, kComponents)

//
// CmXULAppInfo class (XPCOM/C++)
//

// This can only exist as a singleton object, instantiated as a static const
// object above.  Deny destruction attempts by avoiding NS_IMPL_ISUPPORTS and
// overriding AddRef and Release.

NS_IMPL_QUERY_INTERFACE1(CmXULAppInfo, nsIXULAppInfo)

NS_IMETHODIMP_(nsrefcnt) CmXULAppInfo::AddRef() {
  return 1;
}

NS_IMETHODIMP_(nsrefcnt) CmXULAppInfo::Release() {
  return 1;
}

// Pass everything through to XULAppInfo.

NS_IMETHODIMP CmXULAppInfo::GetVendor(nsACString &result) {
  result.Assign([[XULAppInfo vendor] UTF8String]);
  return NS_OK;
}

NS_IMETHODIMP CmXULAppInfo::GetName(nsACString &result) {
  result.Assign([[XULAppInfo name] UTF8String]);
  return NS_OK;
}

NS_IMETHODIMP CmXULAppInfo::GetID(nsACString &result) {
  result.Assign([[XULAppInfo ID] UTF8String]);
  return NS_OK;
}

NS_IMETHODIMP CmXULAppInfo::GetVersion(nsACString &result) {
  result.Assign([[XULAppInfo version] UTF8String]);
  return NS_OK;
}

NS_IMETHODIMP CmXULAppInfo::GetAppBuildID(nsACString &result) {
  result.Assign([[XULAppInfo appBuildID] UTF8String]);
  return NS_OK;
}

NS_IMETHODIMP CmXULAppInfo::GetPlatformVersion(nsACString &result) {
  result.Assign([[XULAppInfo platformVersion] UTF8String]);
  return NS_OK;
}

NS_IMETHODIMP CmXULAppInfo::GetPlatformBuildID(nsACString &result) {
  result.Assign([[XULAppInfo platformBuildID] UTF8String]);
  return NS_OK;
}

//
// XULAppInfo class (Objective-C)
//

@implementation XULAppInfo

+ (NSString *)vendor {
  return @CMXULAPPDATA_VENDOR;
}

+ (NSString *)name {
  // CMXULAPPDATA_NAME
  return [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleName"];
}

+ (NSString *)ID {
  return @CMXULAPPDATA_ID;
}

+ (NSString *)version {
  // CMXULAPPDATA_VERSION
  return [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
}

+ (NSString *)appBuildID {
  return @CMXULAPPDATA_BUILD_ID;
}

+ (NSString *)platformVersion {
  return @CMXULAPPDATA_PLATFORM_VERSION;
}

+ (NSString *)platformBuildID {
  return @CMXULAPPDATA_PLATFORM_BUILD_ID;
}

@end
