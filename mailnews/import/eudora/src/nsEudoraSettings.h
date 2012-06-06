/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraSettings_h___
#define nsEudoraSettings_h___

#include "nsIImportSettings.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"

class nsEudoraSettings : public nsIImportSettings {
public:
    nsEudoraSettings();
    virtual ~nsEudoraSettings();

  static nsresult Create(nsIImportSettings** aImport);

    // nsISupports interface
    NS_DECL_ISUPPORTS

  // nsIImportSettings interface
  NS_DECL_NSIIMPORTSETTINGS

private:
  nsCOMPtr<nsIFile> m_pLocation;
};

#endif /* nsEudoraSettings_h___ */
