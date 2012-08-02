/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mailprofilemigratorutils___h___
#define mailprofilemigratorutils___h___

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

#include "nsIPrefBranch.h"
#include "nsIFile.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"
class nsIProfileStartup;

// Proxy utilities shared by the Opera and IE migrators
void ParseOverrideServers(const char* aServers, nsIPrefBranch* aBranch);
void SetProxyPref(const nsACString& aHostPort, const char* aPref, 
                  const char* aPortPref, nsIPrefBranch* aPrefs);

struct MigrationData { 
  PRUnichar* fileName; 
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
void GetProfilePath(nsIProfileStartup* aStartup, nsCOMPtr<nsIFile>& aProfileDir);

#endif

