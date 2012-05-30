/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOESettings_h___
#define nsOESettings_h___

#include "nsIImportSettings.h"

class nsOESettings : public nsIImportSettings {
public:
  nsOESettings();
  virtual ~nsOESettings();
  static nsresult Create(nsIImportSettings** aImport);
  NS_DECL_ISUPPORTS
  NS_DECL_NSIIMPORTSETTINGS

private:
};

#endif /* nsOESettings_h___ */
