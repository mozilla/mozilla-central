/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKROWCELLCURSOR_
#define _MORKROWCELLCURSOR_ 1

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _MORKCURSOR_
#include "morkCursor.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

class orkinRowCellCursor;
#define morkDerived_kRowCellCursor  /*i*/ 0x6343 /* ascii 'cC' */

class morkRowCellCursor : public morkCursor, public nsIMdbRowCellCursor { // row iterator

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

public: // state is public because the entire Mork system is private

  NS_DECL_ISUPPORTS_INHERITED
  morkRowObject*   mRowCellCursor_RowObject;  // strong ref to row
  mork_column      mRowCellCursor_Col;        // col of cell last at mCursor_Pos
  
// { ===== begin morkNode interface =====
public: // morkNode virtual methods
  virtual void CloseMorkNode(morkEnv* ev); // CloseRowCellCursor()
  virtual ~morkRowCellCursor(); // assert that close executed earlier
  
public: // morkRowCellCursor construction & destruction
  morkRowCellCursor(morkEnv* ev, const morkUsage& inUsage,
    nsIMdbHeap* ioHeap, morkRowObject* ioRowObject);
  void CloseRowCellCursor(morkEnv* ev); // called by CloseMorkNode();

  // { ----- begin attribute methods -----
  NS_IMETHOD SetRow(nsIMdbEnv* ev, nsIMdbRow* ioRow); // sets pos to -1
  NS_IMETHOD GetRow(nsIMdbEnv* ev, nsIMdbRow** acqRow);
  // } ----- end attribute methods -----

  // { ----- begin cell creation methods -----
  NS_IMETHOD MakeCell( // get cell at current pos in the row
    nsIMdbEnv* ev, // context
    mdb_column* outColumn, // column for this particular cell
    mdb_pos* outPos, // position of cell in row sequence
    nsIMdbCell** acqCell); // the cell at inPos
  // } ----- end cell creation methods -----

  // { ----- begin cell seeking methods -----
  NS_IMETHOD SeekCell( // same as SetRow() followed by MakeCell()
    nsIMdbEnv* ev, // context
    mdb_pos inPos, // position of cell in row sequence
    mdb_column* outColumn, // column for this particular cell
    nsIMdbCell** acqCell); // the cell at inPos
  // } ----- end cell seeking methods -----

  // { ----- begin cell iteration methods -----
  NS_IMETHOD NextCell( // get next cell in the row
    nsIMdbEnv* ev, // context
    nsIMdbCell** acqCell, // changes to the next cell in the iteration
    mdb_column* outColumn, // column for this particular cell
    mdb_pos* outPos); // position of cell in row sequence
    
  NS_IMETHOD PickNextCell( // get next cell in row within filter set
    nsIMdbEnv* ev, // context
    nsIMdbCell* ioCell, // changes to the next cell in the iteration
    const mdbColumnSet* inFilterSet, // col set of actual caller interest
    mdb_column* outColumn, // column for this particular cell
    mdb_pos* outPos); // position of cell in row sequence

  // Note that inFilterSet should not have too many (many more than 10?)
  // cols, since this might imply a potential excessive consumption of time
  // over many cursor calls when looking for column and filter intersection.
  // } ----- end cell iteration methods -----


private: // copying is not allowed
  morkRowCellCursor(const morkRowCellCursor& other);
  morkRowCellCursor& operator=(const morkRowCellCursor& other);

public: // dynamic type identification
  mork_bool IsRowCellCursor() const
  { return IsNode() && mNode_Derived == morkDerived_kRowCellCursor; }
// } ===== end morkNode methods =====

public: // errors
  static void NilRowObjectError(morkEnv* ev);
  static void NonRowCellCursorTypeError(morkEnv* ev);

public: // typesafe refcounting inlines calling inherited morkNode methods
  static void SlotWeakRowCellCursor(morkRowCellCursor* me,
    morkEnv* ev, morkRowCellCursor** ioSlot)
  { morkNode::SlotWeakNode((morkNode*) me, ev, (morkNode**) ioSlot); }
  
  static void SlotStrongRowCellCursor(morkRowCellCursor* me,
    morkEnv* ev, morkRowCellCursor** ioSlot)
  { morkNode::SlotStrongNode((morkNode*) me, ev, (morkNode**) ioSlot); }
};

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKROWCELLCURSOR_ */
