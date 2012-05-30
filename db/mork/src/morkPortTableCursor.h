/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKPORTTABLECURSOR_
#define _MORKPORTTABLECURSOR_ 1

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _MORKCURSOR_
#include "morkCursor.h"
#endif

#ifndef _MORKROWSPACE_
#include "morkRowSpace.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

class orkinPortTableCursor;
#define morkDerived_kPortTableCursor  /*i*/ 0x7443 /* ascii 'tC' */

class morkPortTableCursor : public morkCursor, public nsIMdbPortTableCursor { // row iterator
public:
  NS_DECL_ISUPPORTS_INHERITED
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
  // { ----- begin attribute methods -----
  NS_IMETHOD SetPort(nsIMdbEnv* ev, nsIMdbPort* ioPort); // sets pos to -1
  NS_IMETHOD GetPort(nsIMdbEnv* ev, nsIMdbPort** acqPort);
  
  NS_IMETHOD SetRowScope(nsIMdbEnv* ev, // sets pos to -1
    mdb_scope inRowScope);
  NS_IMETHOD GetRowScope(nsIMdbEnv* ev, mdb_scope* outRowScope); 
  // setting row scope to zero iterates over all row scopes in port
    
  NS_IMETHOD SetTableKind(nsIMdbEnv* ev, // sets pos to -1
    mdb_kind inTableKind);
  NS_IMETHOD GetTableKind(nsIMdbEnv* ev, mdb_kind* outTableKind);
  // setting table kind to zero iterates over all table kinds in row scope
  // } ----- end attribute methods -----

  // { ----- begin table iteration methods -----
  NS_IMETHOD NextTable( // get table at next position in the db
    nsIMdbEnv* ev, // context
    nsIMdbTable** acqTable); // the next table in the iteration
  // } ----- end table iteration methods -----
  morkStore*    mPortTableCursor_Store;  // weak ref to store
  
  mdb_scope     mPortTableCursor_RowScope;
  mdb_kind      mPortTableCursor_TableKind;
  
  // We only care if LastTable is non-nil, so it is not refcounted;
  // so you must never access table state or methods using LastTable:
  
  morkTable* mPortTableCursor_LastTable; // nil or last table (no refcount)
  morkRowSpace* mPortTableCursor_RowSpace; // current space (strong ref)

  morkRowSpaceMapIter mPortTableCursor_SpaceIter; // iter over spaces
  morkTableMapIter    mPortTableCursor_TableIter; // iter over tables 
  
  // these booleans indicate when the table or space iterator is exhausted:
  
  mork_bool           mPortTableCursor_TablesDidEnd; // no more tables?
  mork_bool           mPortTableCursor_SpacesDidEnd; // no more spaces?
  mork_u1             mPortTableCursor_Pad[ 2 ]; // for u4 alignment
   
// { ===== begin morkNode interface =====
public: // morkNode virtual methods
  virtual void CloseMorkNode(morkEnv* ev); // ClosePortTableCursor()
  virtual ~morkPortTableCursor(); // assert that close executed earlier
  
public: // morkPortTableCursor construction & destruction
  morkPortTableCursor(morkEnv* ev, const morkUsage& inUsage,
    nsIMdbHeap* ioHeap, morkStore* ioStore, mdb_scope inRowScope,
      mdb_kind inTableKind, nsIMdbHeap* ioSlotHeap);
  void ClosePortTableCursor(morkEnv* ev); // called by CloseMorkNode();

private: // copying is not allowed
  morkPortTableCursor(const morkPortTableCursor& other);
  morkPortTableCursor& operator=(const morkPortTableCursor& other);

public: // dynamic type identification
  mork_bool IsPortTableCursor() const
  { return IsNode() && mNode_Derived == morkDerived_kPortTableCursor; }
// } ===== end morkNode methods =====

protected: // utilities

  void init_space_tables_map(morkEnv* ev);

public: // other cursor methods

  static void NilCursorStoreError(morkEnv* ev);
  static void NonPortTableCursorTypeError(morkEnv* ev);

 morkEnv* CanUsePortTableCursor(nsIMdbEnv* mev,
  mork_bool inMutable, mdb_err* outErr) const;

  
  morkRowSpace* NextSpace(morkEnv* ev);
  morkTable* NextTable(morkEnv* ev);

  mork_bool SetRowScope(morkEnv* ev, mork_scope inRowScope);
  mork_bool SetTableKind(morkEnv* ev, mork_kind inTableKind);

public: // typesafe refcounting inlines calling inherited morkNode methods
  static void SlotWeakPortTableCursor(morkPortTableCursor* me,
    morkEnv* ev, morkPortTableCursor** ioSlot)
  { morkNode::SlotWeakNode((morkNode*) me, ev, (morkNode**) ioSlot); }
  
  static void SlotStrongPortTableCursor(morkPortTableCursor* me,
    morkEnv* ev, morkPortTableCursor** ioSlot)
  { morkNode::SlotStrongNode((morkNode*) me, ev, (morkNode**) ioSlot); }
};



//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKPORTTABLECURSOR_ */
