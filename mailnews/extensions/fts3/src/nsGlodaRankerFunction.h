/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsGlodaRankerFunction_h_
#define _nsGlodaRankerFunction_h_

#include "mozIStorageFunction.h"

/**
 * Basically a port of the example FTS3 ranking function to mozStorage's
 * view of the universe.  This might get fancier at some point.
 */
class nsGlodaRankerFunction : public mozIStorageFunction
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_MOZISTORAGEFUNCTION

  nsGlodaRankerFunction();
private:
  ~nsGlodaRankerFunction();
};

#endif // _nsGlodaRankerFunction_h_
