/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOERegUtil_h___
#define nsOERegUtil_h___

#include <windows.h>
#include "nsStringGlue.h"

class nsOERegUtil
{
public:
  static nsresult GetDefaultUserId(nsAString &aUserId);
};



#endif /* nsOERegUtil_h___ */
