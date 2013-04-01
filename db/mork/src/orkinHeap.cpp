/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MDB_
#include "mdb.h"
#endif

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _ORKINHEAP_
#include "orkinHeap.h"
#endif

#ifndef _MORKENV_
#include "morkEnv.h"
#endif

#include "nsIMemoryReporter.h"

#include <stdlib.h>

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789


orkinHeap::orkinHeap() // does nothing
  : mUsedSize(0)
{
}

/*virtual*/
orkinHeap::~orkinHeap() // does nothing
{
}

NS_MEMORY_REPORTER_MALLOC_SIZEOF_ON_ALLOC_FUN(MorkSizeOfOnAlloc)
NS_MEMORY_REPORTER_MALLOC_SIZEOF_ON_FREE_FUN(MorkSizeOfOnFree)

// { ===== begin nsIMdbHeap methods =====
/*virtual*/ mdb_err
orkinHeap::Alloc(nsIMdbEnv* mev, // allocate a piece of memory
  mdb_size inSize,  // requested size of new memory block
  void** outBlock)  // memory block of inSize bytes, or nil
{

  MORK_USED_1(mev);
  mdb_err outErr = NS_OK;
  void* block = malloc(inSize);
  if ( !block )
    outErr = morkEnv_kOutOfMemoryError;
  else
    mUsedSize += MorkSizeOfOnAlloc(block);

  MORK_ASSERT(outBlock);
  if ( outBlock )
    *outBlock = block;
  return outErr;
}

/*virtual*/ mdb_err
orkinHeap::Free(nsIMdbEnv* mev, // free block allocated earlier by Alloc()
  void* inBlock)
{
  MORK_USED_1(mev);
  MORK_ASSERT(inBlock);
  if ( inBlock )
  {
    mUsedSize -= MorkSizeOfOnFree(inBlock);
    free(inBlock);
  }
  return NS_OK;
}

size_t
orkinHeap::GetUsedSize()
{
  return mUsedSize;
}
// } ===== end nsIMdbHeap methods =====

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789
