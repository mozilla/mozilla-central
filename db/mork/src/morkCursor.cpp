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

#ifndef _MORKNODE_
#include "morkNode.h"
#endif

#ifndef _MORKMAP_
#include "morkMap.h"
#endif

#ifndef _MORKENV_
#include "morkEnv.h"
#endif

#ifndef _MORKCURSOR_
#include "morkCursor.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

// ````` ````` ````` ````` ````` 
// { ===== begin morkNode interface =====

/*public virtual*/ void
morkCursor::CloseMorkNode(morkEnv* ev) // CloseCursor() only if open
{
  if ( this->IsOpenNode() )
  {
    this->MarkClosing();
    this->CloseCursor(ev);
    this->MarkShut();
  }
}

/*public virtual*/
morkCursor::~morkCursor() // assert CloseCursor() executed earlier
{
}

/*public non-poly*/
morkCursor::morkCursor(morkEnv* ev,
  const morkUsage& inUsage, nsIMdbHeap* ioHeap)
: morkObject(ev, inUsage, ioHeap, morkColor_kNone, (morkHandle*) 0)
, mCursor_Seed( 0 )
, mCursor_Pos( -1 )
, mCursor_DoFailOnSeedOutOfSync( morkBool_kFalse )
{
  if ( ev->Good() )
    mNode_Derived = morkDerived_kCursor;
}

NS_IMPL_ISUPPORTS_INHERITED1(morkCursor, morkObject, nsIMdbCursor)

/*public non-poly*/ void
morkCursor::CloseCursor(morkEnv* ev) // called by CloseMorkNode();
{
  if ( this )
  {
    if ( this->IsNode() )
    {
      mCursor_Seed = 0;
      mCursor_Pos = -1;
      this->MarkShut();
    }
    else
      this->NonNodeError(ev);
  }
  else
    ev->NilPointerError();
}

// { ----- begin ref counting for well-behaved cyclic graphs -----
NS_IMETHODIMP
morkCursor::GetWeakRefCount(nsIMdbEnv* mev, // weak refs
  mdb_count* outCount)
{
  *outCount = WeakRefsOnly();
  return NS_OK;
}  
NS_IMETHODIMP
morkCursor::GetStrongRefCount(nsIMdbEnv* mev, // strong refs
  mdb_count* outCount)
{
  *outCount = StrongRefsOnly();
  return NS_OK;
}
// ### TODO - clean up this cast, if required
NS_IMETHODIMP
morkCursor::AddWeakRef(nsIMdbEnv* mev)
{
  // XXX Casting mork_refs to nsresult
  return static_cast<nsresult>(morkNode::AddWeakRef((morkEnv *) mev));
}
NS_IMETHODIMP
morkCursor::AddStrongRef(nsIMdbEnv* mev)
{
  // XXX Casting mork_uses to nsresult
  return static_cast<nsresult>(morkNode::AddStrongRef((morkEnv *) mev));
}

NS_IMETHODIMP
morkCursor::CutWeakRef(nsIMdbEnv* mev)
{
  // XXX Casting mork_refs to nsresult
  return static_cast<nsresult>(morkNode::CutWeakRef((morkEnv *) mev));
}
NS_IMETHODIMP
morkCursor::CutStrongRef(nsIMdbEnv* mev)
{
  // XXX Casting mork_uses to nsresult
  return static_cast<nsresult>(morkNode::CutStrongRef((morkEnv *) mev));
}

  
NS_IMETHODIMP
morkCursor::CloseMdbObject(nsIMdbEnv* mev)
{
  return morkNode::CloseMdbObject((morkEnv *) mev);
}

NS_IMETHODIMP
morkCursor::IsOpenMdbObject(nsIMdbEnv* mev, mdb_bool* outOpen)
{
  *outOpen = IsOpenNode();
  return NS_OK;
}
NS_IMETHODIMP
morkCursor::IsFrozenMdbObject(nsIMdbEnv* mev, mdb_bool* outIsReadonly)
{
  *outIsReadonly = IsFrozen();
  return NS_OK;
}
// } ===== end morkNode methods =====
// ````` ````` ````` ````` ````` 

NS_IMETHODIMP
morkCursor::GetCount(nsIMdbEnv* mev, mdb_count* outCount)
{
  NS_ASSERTION(false, "not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
morkCursor::GetSeed(nsIMdbEnv* mev, mdb_seed* outSeed)
{
  NS_ASSERTION(false, "not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
morkCursor::SetPos(nsIMdbEnv* mev, mdb_pos inPos)
{
  NS_ASSERTION(false, "not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
morkCursor::GetPos(nsIMdbEnv* mev, mdb_pos* outPos)
{
  NS_ASSERTION(false, "not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
morkCursor::SetDoFailOnSeedOutOfSync(nsIMdbEnv* mev, mdb_bool inFail)
{
  NS_ASSERTION(false, "not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
morkCursor::GetDoFailOnSeedOutOfSync(nsIMdbEnv* mev, mdb_bool* outFail)
{
  NS_ASSERTION(false, "not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}


//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789
