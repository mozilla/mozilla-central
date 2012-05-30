/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKQUICKSORT_
#define _MORKQUICKSORT_ 1

#ifndef _MDB_
#include "mdb.h"
#endif

#ifndef _MORK_
#include "mork.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

extern void
morkQuickSort(mork_u1* ioVec, mork_u4 inCount, mork_u4 inSize,
  mdbAny_Order inOrder, void* ioClosure);
 
//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKQUICKSORT_ */
