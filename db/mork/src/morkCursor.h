/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKCURSOR_
#define _MORKCURSOR_ 1

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _MORKOBJECT_
#include "morkObject.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#define morkDerived_kCursor  /*i*/ 0x4375 /* ascii 'Cu' */

class morkCursor : public morkObject, public nsIMdbCursor{ // collection iterator

// public: // slots inherited from morkObject (meant to inform only)
  // nsIMdbHeap*     mNode_Heap;
  // mork_able    mNode_Mutable; // can this node be modified?
  // mork_load    mNode_Load;    // is this node clean or dirty?
  // mork_base    mNode_Base;    // must equal morkBase_kNode
  // mork_derived mNode_Derived; // depends on specific node subclass
  // mork_access  mNode_Access;  // kOpen, kClosing, kShut, or kDead
  // mork_usage   mNode_Usage;   // kHeap, kStack, kMember, kGlobal, kNone
  // mork_uses    mNode_Uses;    // refcount for strong refs
  // mork_refs    mNode_Refs;    // refcount for strong refs + weak refs

  // mork_color   mBead_Color;   // ID for this bead
  // morkHandle*  mObject_Handle;  // weak ref to handle for this object

public: // state is public because the entire Mork system is private
  NS_DECL_ISUPPORTS_INHERITED

  // { ----- begin attribute methods -----
  NS_IMETHOD IsFrozenMdbObject(nsIMdbEnv* ev, mdb_bool* outIsReadonly);
  // same as nsIMdbPort::GetIsPortReadonly() when this object is inside a port.
  // } ----- end attribute methods -----

  // { ----- begin ref counting for well-behaved cyclic graphs -----
  NS_IMETHOD GetWeakRefCount(nsIMdbEnv* ev, // weak refs
    mdb_count* outCount);  
  NS_IMETHOD GetStrongRefCount(nsIMdbEnv* ev, // strong refs
    mdb_count* outCount);

  NS_IMETHOD AddWeakRef(nsIMdbEnv* ev);
    NS_IMETHOD_(mork_uses) AddStrongRef(nsIMdbEnv* ev);

  NS_IMETHOD CutWeakRef(nsIMdbEnv* ev);
  NS_IMETHOD CutStrongRef(nsIMdbEnv* ev);
  
  NS_IMETHOD CloseMdbObject(nsIMdbEnv* ev); // called at strong refs zero
  NS_IMETHOD IsOpenMdbObject(nsIMdbEnv* ev, mdb_bool* outOpen);
  // } ----- end ref counting -----
  
// } ===== end nsIMdbObject methods =====

// { ===== begin nsIMdbCursor methods =====

  // { ----- begin attribute methods -----
  NS_IMETHOD GetCount(nsIMdbEnv* ev, mdb_count* outCount); // readonly
  NS_IMETHOD GetSeed(nsIMdbEnv* ev, mdb_seed* outSeed);    // readonly
  
  NS_IMETHOD SetPos(nsIMdbEnv* ev, mdb_pos inPos);   // mutable
  NS_IMETHOD GetPos(nsIMdbEnv* ev, mdb_pos* outPos);
  
  NS_IMETHOD SetDoFailOnSeedOutOfSync(nsIMdbEnv* ev, mdb_bool inFail);
  NS_IMETHOD GetDoFailOnSeedOutOfSync(nsIMdbEnv* ev, mdb_bool* outFail);
  // } ----- end attribute methods -----

// } ===== end nsIMdbCursor methods =====
    
  // } ----- end attribute methods -----

  mork_seed  mCursor_Seed;
  mork_pos   mCursor_Pos;
  mork_bool  mCursor_DoFailOnSeedOutOfSync;
  mork_u1    mCursor_Pad[ 3 ]; // explicitly pad to u4 alignment
  
// { ===== begin morkNode interface =====
public: // morkNode virtual methods
  virtual void CloseMorkNode(morkEnv* ev); // CloseCursor() only if open
  virtual ~morkCursor(); // assert that CloseCursor() executed earlier
  
public: // morkCursor construction & destruction
  morkCursor(morkEnv* ev, const morkUsage& inUsage, nsIMdbHeap* ioHeap);
  void CloseCursor(morkEnv* ev); // called by CloseMorkNode();

private: // copying is not allowed
  morkCursor(const morkCursor& other);
  morkCursor& operator=(const morkCursor& other);

public: // dynamic type identification
  mork_bool IsCursor() const
  { return IsNode() && mNode_Derived == morkDerived_kCursor; }
// } ===== end morkNode methods =====

public: // other cursor methods

public: // typesafe refcounting inlines calling inherited morkNode methods
  static void SlotWeakCursor(morkCursor* me,
    morkEnv* ev, morkCursor** ioSlot)
  { morkNode::SlotWeakNode((morkNode*) me, ev, (morkNode**) ioSlot); }
  
  static void SlotStrongCursor(morkCursor* me,
    morkEnv* ev, morkCursor** ioSlot)
  { morkNode::SlotStrongNode((morkNode*) me, ev, (morkNode**) ioSlot); }
};


//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKCURSOR_ */
