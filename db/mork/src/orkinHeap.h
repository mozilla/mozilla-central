/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _ORKINHEAP_
#define _ORKINHEAP_ 1

#ifndef _MDB_
#include "mdb.h"
#endif

#ifndef _MORK_
#include "mork.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#define orkinHeap_kTag 0x68456150 /* ascii 'hEaP' */

/*| orkinHeap: 
|*/
class orkinHeap : public nsIMdbHeap { //

#ifdef MORK_DEBUG_HEAP_STATS
protected:
  mork_num sHeap_AllocCount;  // number of times Alloc() is called
  mork_num sHeap_FreeCount;   // number of times Free() is called
  mork_num sHeap_BlockCount;  // number of outstanding blocks
  
  mork_num sHeap_BlockVolume; // sum of sizes for all outstanding blocks
  mork_num sHeap_HighWaterVolume;  // largest value of sHeap_BlockVolume seen
  mork_num sHeap_HighWaterTenKilo; // HighWaterVolume in 10K granularity
  mork_num sHeap_HighWaterHundredKilo; // HighWaterVolume in 100K granularity
  
public: // getters
  mork_num HeapAllocCount() const { return sHeap_AllocCount; }
  mork_num HeapFreeCount() const { return sHeap_FreeCount; }
  mork_num HeapBlockCount() const { return sHeap_AllocCount - sHeap_FreeCount; }
  
  mork_num HeapBlockVolume() const { return sHeap_BlockVolume; }
  mork_num HeapHighWaterVolume() const { return sHeap_HighWaterVolume; }
#endif /*MORK_DEBUG_HEAP_STATS*/
  
public:
  orkinHeap(); // does nothing
  virtual ~orkinHeap(); // does nothing
    
private: // copying is not allowed
  orkinHeap(const orkinHeap& other);
  orkinHeap& operator=(const orkinHeap& other);

public:

// { ===== begin nsIMdbHeap methods =====
  NS_IMETHOD Alloc(nsIMdbEnv* ev, // allocate a piece of memory
    mdb_size inSize,   // requested size of new memory block 
    void** outBlock);  // memory block of inSize bytes, or nil
    
  NS_IMETHOD Free(nsIMdbEnv* ev, // free block allocated earlier by Alloc()
    void* inBlock);
// } ===== end nsIMdbHeap methods =====

};

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _ORKINHEAP_ */
