/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKOBJECT_
#define _MORKOBJECT_ 1

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _MORKNODE_
#include "morkNode.h"
#endif

#ifndef _MORKBEAD_
#include "morkBead.h"
#endif

#ifndef _MORKCONFIG_
#include "morkConfig.h"
#endif

#ifndef _ORKINHEAP_
#include "orkinHeap.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#define morkDerived_kObject   /*i*/ 0x6F42 /* ascii 'oB' */

/*| morkObject: subclass of morkNode that adds knowledge of db suite factory
**| and containing port to those objects that are exposed as instances of
**| nsIMdbObject in the public interface.
|*/
class morkObject : public morkBead, public nsIMdbObject { 

// public: // slots inherited from morkNode (meant to inform only)
  // nsIMdbHeap*    mNode_Heap;

  // mork_base      mNode_Base;     // must equal morkBase_kNode
  // mork_derived   mNode_Derived;  // depends on specific node subclass
  
  // mork_access    mNode_Access;   // kOpen, kClosing, kShut, or kDead
  // mork_usage     mNode_Usage;    // kHeap, kStack, kMember, kGlobal, kNone
  // mork_able      mNode_Mutable;  // can this node be modified?
  // mork_load      mNode_Load;     // is this node clean or dirty?
  
  // mork_uses      mNode_Uses;     // refcount for strong refs
  // mork_refs      mNode_Refs;     // refcount for strong refs + weak refs

  // mork_color      mBead_Color;   // ID for this bead
  
public: // state is public because the entire Mork system is private

  morkHandle*      mObject_Handle;   // weak ref to handle for this object

  morkEnv * mMorkEnv; // weak ref to environment this object created in.
// { ===== begin morkNode interface =====
public: // morkNode virtual methods
  virtual void CloseMorkNode(morkEnv* ev); // CloseObject() only if open
  virtual ~morkObject(); // assert that CloseObject() executed earlier
#ifdef MORK_DEBUG_HEAP_STATS
  void operator delete(void* ioAddress, size_t size)
  { 
    mork_u4* array = (mork_u4*) ioAddress;
    array -= 3;
    orkinHeap *heap = (orkinHeap *) *array;
    if (heap)
      heap->Free(nullptr, ioAddress);
  }
#endif

  NS_DECL_ISUPPORTS

    // { ----- begin attribute methods -----
  NS_IMETHOD IsFrozenMdbObject(nsIMdbEnv* ev, mdb_bool* outIsReadonly);
  // same as nsIMdbPort::GetIsPortReadonly() when this object is inside a port.
  // } ----- end attribute methods -----

  // { ----- begin factory methods -----
  NS_IMETHOD GetMdbFactory(nsIMdbEnv* ev, nsIMdbFactory** acqFactory); 
  // } ----- end factory methods -----

  // { ----- begin ref counting for well-behaved cyclic graphs -----
  NS_IMETHOD GetWeakRefCount(nsIMdbEnv* ev, // weak refs
    mdb_count* outCount);  
  NS_IMETHOD GetStrongRefCount(nsIMdbEnv* ev, // strong refs
    mdb_count* outCount);

  NS_IMETHOD AddWeakRef(nsIMdbEnv* ev);
  NS_IMETHOD AddStrongRef(nsIMdbEnv* ev);

  NS_IMETHOD CutWeakRef(nsIMdbEnv* ev);
  NS_IMETHOD CutStrongRef(nsIMdbEnv* ev);
  
  NS_IMETHOD CloseMdbObject(nsIMdbEnv* ev); // called at strong refs zero
  NS_IMETHOD IsOpenMdbObject(nsIMdbEnv* ev, mdb_bool* outOpen);
  // } ----- end ref counting -----
  

protected: // special case construction of first env without preceding env
  morkObject(const morkUsage& inUsage, nsIMdbHeap* ioHeap,
    mork_color inBeadColor);
  
public: // morkEnv construction & destruction
  morkObject(morkEnv* ev, const morkUsage& inUsage, nsIMdbHeap* ioHeap, 
     mork_color inBeadColor, morkHandle* ioHandle); // ioHandle can be nil
  void CloseObject(morkEnv* ev); // called by CloseMorkNode();

private: // copying is not allowed
  morkObject(const morkObject& other);
  morkObject& operator=(const morkObject& other);

public: // dynamic type identification
  mork_bool IsObject() const
  { return IsNode() && mNode_Derived == morkDerived_kObject; }
// } ===== end morkNode methods =====

  // void NewNilHandleError(morkEnv* ev); // mObject_Handle is nil
  
public: // typesafe refcounting inlines calling inherited morkNode methods
  static void SlotWeakObject(morkObject* me,
    morkEnv* ev, morkObject** ioSlot)
  { morkNode::SlotWeakNode((morkNode*) me, ev, (morkNode**) ioSlot); }
  
  static void SlotStrongObject(morkObject* me,
    morkEnv* ev, morkObject** ioSlot)
  { morkNode::SlotStrongNode((morkNode*) me, ev, (morkNode**) ioSlot); }
};

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKOBJECT_ */
