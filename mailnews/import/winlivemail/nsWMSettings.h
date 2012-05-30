/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsWMSettings_h___
#define nsWMSettings_h___

#include "nsIImportSettings.h"

class nsWMSettings : public nsIImportSettings {
public:
  nsWMSettings();
  virtual ~nsWMSettings();
  static nsresult Create(nsIImportSettings** aImport);
  NS_DECL_ISUPPORTS
  NS_DECL_NSIIMPORTSETTINGS

private:
};

#endif /* nsWMSettings_h___ */
