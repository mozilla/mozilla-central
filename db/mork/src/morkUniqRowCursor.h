/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKUNIQROWCURSOR_
#define _MORKUNIQROWCURSOR_ 1

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _MORKCURSOR_
#include "morkCursor.h"
#endif

#ifndef _MORKMAP_
#include "morkMap.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

class orkinTableRowCursor;
// #define morkDerived_kUniqRowCursor  /*i*/ 0x7352 /* ascii 'sR' */

class morkUniqRowCursor : public morkTableRowCursor { // row iterator

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

  // morkFactory* mObject_Factory;  // weak ref to suite factory

  // mork_seed  mCursor_Seed;
  // mork_pos   mCursor_Pos;
  // mork_bool  mCursor_DoFailOnSeedOutOfSync;
  // mork_u1    mCursor_Pad[ 3 ]; // explicitly pad to u4 alignment

  // morkTable*  mTableRowCursor_Table; // weak ref to table

public: // state is public because the entire Mork system is private
    
// { ===== begin morkNode interface =====
public: // morkNode virtual methods
  virtual void CloseMorkNode(morkEnv* ev); // CloseUniqRowCursor()
  virtual ~morkUniqRowCursor(); // assert that close executed earlier
  
public: // morkUniqRowCursor construction & destruction
  morkUniqRowCursor(morkEnv* ev, const morkUsage& inUsage,
    nsIMdbHeap* ioHeap, morkTable* ioTable, mork_pos inRowPos);
  void CloseUniqRowCursor(morkEnv* ev); // called by CloseMorkNode();

private: // copying is not allowed
  morkUniqRowCursor(const morkUniqRowCursor& other);
  morkUniqRowCursor& operator=(const morkUniqRowCursor& other);

public: // dynamic type identification
  // mork_bool IsUniqRowCursor() const
  // { return IsNode() && mNode_Derived == morkDerived_kUniqRowCursor; }
// } ===== end morkNode methods =====

public: // typing
  static void NonUniqRowCursorTypeError(morkEnv* ev);

public: // other search row cursor methods

  virtual mork_bool CanHaveDupRowMembers(morkEnv* ev);
  virtual mork_count GetMemberCount(morkEnv* ev);

  virtual orkinTableRowCursor* AcquireUniqueRowCursorHandle(morkEnv* ev);
  
  // virtual mdb_pos NextRowOid(morkEnv* ev, mdbOid* outOid);
  virtual morkRow* NextRow(morkEnv* ev, mdbOid* outOid, mdb_pos* outPos);

public: // typesafe refcounting inlines calling inherited morkNode methods
  static void SlotWeakUniqRowCursor(morkUniqRowCursor* me,
    morkEnv* ev, morkUniqRowCursor** ioSlot)
  { morkNode::SlotWeakNode((morkNode*) me, ev, (morkNode**) ioSlot); }
  
  static void SlotStrongUniqRowCursor(morkUniqRowCursor* me,
    morkEnv* ev, morkUniqRowCursor** ioSlot)
  { morkNode::SlotStrongNode((morkNode*) me, ev, (morkNode**) ioSlot); }
};

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKUNIQROWCURSOR_ */
