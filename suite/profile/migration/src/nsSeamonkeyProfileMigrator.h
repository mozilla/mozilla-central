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
 * The Original Code is The Browser Profile Migrator.
 *
 * The Initial Developer of the Original Code is Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ben Goodger <ben@bengoodger.com>
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

#ifndef SeamonkeyProfileMigrator_h__
#define SeamonkeyProfileMigrator_h__

#include "nsISuiteProfileMigrator.h"
#include "nsILocalFile.h"
#include "nsISupportsArray.h"
#include "nsNetscapeProfileMigratorBase.h"
#include "nsStringAPI.h"

class nsIFile;
class nsIPrefBranch;
class nsIPrefService;

#define NS_SEAMONKEYPROFILEMIGRATOR_CID \
{ 0x9a28ffa7, 0xe6ef, 0x4b52, { 0xa1, 0x27, 0x6a, 0xd9, 0x51, 0xde, 0x8e, 0x9b } }

class nsSeamonkeyProfileMigrator : public nsNetscapeProfileMigratorBase
{
public:
  NS_DECL_ISUPPORTS

  nsSeamonkeyProfileMigrator();
  virtual ~nsSeamonkeyProfileMigrator();

  // nsISuiteProfileMigrator methods
  NS_IMETHOD Migrate(PRUint16 aItems, nsIProfileStartup *aStartup,
                     const PRUnichar *aProfile);
  NS_IMETHOD GetMigrateData(const PRUnichar *aProfile, PRBool aDoingStartup,
                            PRUint16 *_retval);
  NS_IMETHOD GetSupportedItems(PRUint16 *aSupportedItems);

protected:
  nsresult FillProfileDataFromRegistry();
  nsresult CopyPreferences(PRBool aReplace);
  nsresult TransformPreferences(const char* aSourcePrefFileName,
                                const char* aTargetPrefFileName);

  nsresult CopyHistory(PRBool aReplace);
  nsresult LocateSignonsFile(char** aResult);
};
 
#endif
