/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOutlookSettings_h___
#define nsOutlookSettings_h___

#include "nsIImportSettings.h"


class nsOutlookSettings : public nsIImportSettings {
public:
    nsOutlookSettings();
    virtual ~nsOutlookSettings();

  static nsresult Create(nsIImportSettings** aImport);

    // nsISupports interface
    NS_DECL_ISUPPORTS

  // nsIImportSettings interface
  NS_DECL_NSIIMPORTSETTINGS

private:

};

#endif /* nsOutlookSettings_h___ */
