/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef SuiteProfileMigratorUtils_h__
#define SuiteProfileMigratorUtils_h__

#define MIGRATION_ITEMBEFOREMIGRATE "Migration:ItemBeforeMigrate"
#define MIGRATION_ITEMAFTERMIGRATE  "Migration:ItemAfterMigrate"
#define MIGRATION_STARTED           "Migration:Started"
#define MIGRATION_ENDED             "Migration:Ended"
#define MIGRATION_PROGRESS          "Migration:Progress"

#define NOTIFY_OBSERVERS(message, item) \
  mObserverService->NotifyObservers(nullptr, message, item)

#define COPY_DATA(func, replace, itemIndex) \
  if (NS_SUCCEEDED(rv) && (aItems & itemIndex || !aItems)) { \
    nsAutoString index; \
    index.AppendInt(itemIndex); \
    NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get()); \
    rv = func(replace); \
    NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get()); \
  }

#define NC_URI(property) \
  NS_LITERAL_CSTRING("http://home.netscape.com/NC-rdf#"#property)


#include "nsStringAPI.h"
#include "nscore.h"
#include "nsCOMPtr.h"

class nsIPrefBranch;
class nsIProfileStartup;
class nsIFile;

void SetUnicharPref(const char* aPref, const nsAString& aValue,
                    nsIPrefBranch* aPrefs);

// Proxy utilities shared by the Opera and IE migrators
void ParseOverrideServers(const nsAString& aServers, nsIPrefBranch* aBranch);
void SetProxyPref(const nsAString& aHostPort, const char* aPref,
                  const char* aPortPref, nsIPrefBranch* aPrefs);

struct MigrationData {
  const char* fileName;
  PRUint32 sourceFlag;
  bool replaceOnly;
};

class nsIFile;
void GetMigrateDataFromArray(MigrationData* aDataArray,
                             PRInt32 aDataArrayLength,
                             bool aReplace,
                             nsIFile* aSourceProfile,
                             PRUint16* aResult);


// get the base directory of the *target* profile
// this is already cloned, modify it to your heart's content
void GetProfilePath(nsIProfileStartup* aStartup,
                    nsIFile** aProfileDir);

// The Netscape Bookmarks Format (bookmarks.html) is fairly standard but
// each browser vendor seems to have their own way of identifying the
// Personal Toolbar Folder. This function scans for the vendor-specific
// name in the source Bookmarks file and then writes out a normalized
// variant into the target folder.
nsresult AnnotatePersonalToolbarFolder(nsIFile* aSourceBookmarksFile,
                                       nsIFile* aTargetBookmarksFile,
                                       const char* aToolbarFolderName);

// In-place import from aBookmarksFile into a folder in the user's bookmarks
// with the name "From (STR:aImportSourceNameKey)" (aImportSourceNameKey
// is a key into migration.properties with the pretty name of the application.
nsresult ImportBookmarksHTML(nsIFile* aBookmarksFile,
                             const PRUnichar* aImportSourceNameKey);

#endif
