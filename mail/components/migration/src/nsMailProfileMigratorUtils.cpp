/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMailProfileMigratorUtils.h"
#include "nsIFile.h"
#include "nsIProperties.h"
#include "nsIProfileMigrator.h"

#include "nsServiceManagerUtils.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsXPCOMCID.h"

void SetProxyPref(const nsACString& aHostPort, const char* aPref,
                  const char* aPortPref, nsIPrefBranch* aPrefs)
{
  nsAutoCString hostPort(aHostPort);
  int32_t portDelimOffset = hostPort.RFindChar(':');
  if (portDelimOffset > 0) {
    nsAutoCString host(Substring(hostPort, 0, portDelimOffset));
    nsAutoCString port(Substring(hostPort, portDelimOffset + 1,
                                 hostPort.Length() - (portDelimOffset + 1)));

    aPrefs->SetCharPref(aPref, host.get());
    nsresult stringErr;
    int32_t portValue = port.ToInteger(&stringErr);
    aPrefs->SetIntPref(aPortPref, portValue);
  }
  else
    aPrefs->SetCharPref(aPref, hostPort.get());
}

void ParseOverrideServers(const char* aServers, nsIPrefBranch* aBranch)
{
  // Windows (and Opera) formats its proxy override list in the form:
  // server;server;server where server is a server name or ip address,
  // or "<local>". Mozilla's format is server,server,server, and <local>
  // must be translated to "localhost,127.0.0.1"
  nsAutoCString override(aServers);
  int32_t left = 0, right = 0;
  for (;;) {
    right = override.FindChar(';', right);
    const nsACString& host = Substring(override, left,
                                       (right < 0 ? override.Length() : right) - left);
    if (host.Equals("<local>"))
      override.Replace(left, 7, NS_LITERAL_CSTRING("localhost,127.0.0.1"));
    if (right < 0)
      break;
    left = right + 1;
    override.Replace(right, 1, NS_LITERAL_CSTRING(","));
  }
  aBranch->SetCharPref("network.proxy.no_proxies_on", override.get());
}

void GetMigrateDataFromArray(MigrationData* aDataArray, int32_t aDataArrayLength,
                             bool aReplace, nsIFile* aSourceProfile,
                             uint16_t* aResult)
{
  nsCOMPtr<nsIFile> sourceFile;
  bool exists;
  MigrationData* cursor;
  MigrationData* end = aDataArray + aDataArrayLength;
  for (cursor = aDataArray; cursor < end && cursor->fileName; ++cursor) {
    // When in replace mode, all items can be imported.
    // When in non-replace mode, only items that do not require file replacement
    // can be imported.
    if (aReplace || !cursor->replaceOnly) {
      aSourceProfile->Clone(getter_AddRefs(sourceFile));
      sourceFile->Append(nsDependentString(cursor->fileName));
      sourceFile->Exists(&exists);
      if (exists)
        *aResult |= cursor->sourceFlag;
    }
    NS_Free(cursor->fileName);
    cursor->fileName = nullptr;
  }
}

void
GetProfilePath(nsIProfileStartup* aStartup, nsCOMPtr<nsIFile>& aProfileDir)
{
  if (aStartup) {
    aStartup->GetDirectory(getter_AddRefs(aProfileDir));
  }
  else {
    nsCOMPtr<nsIProperties> dirSvc
      (do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID));
    if (dirSvc) {
      dirSvc->Get(NS_APP_USER_PROFILE_50_DIR, NS_GET_IID(nsIFile),
                  (void**) getter_AddRefs(aProfileDir));
    }
  }
}
