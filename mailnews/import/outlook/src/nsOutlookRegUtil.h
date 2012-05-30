/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOutlookRegUtil_h___
#define nsOutlookRegUtil_h___

#include <windows.h>

class nsOutlookRegUtil
{
public:
  static BYTE *  GetValueBytes(HKEY hKey, const char *pValueName);
  static void    FreeValueBytes(BYTE *pBytes);
};



#endif /* nsOutlookRegUtil_h___ */
