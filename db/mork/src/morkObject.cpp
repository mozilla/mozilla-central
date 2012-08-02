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

#ifndef _MORKENV_
#include "morkEnv.h"
#endif

#ifndef _MORKOBJECT_
#include "morkObject.h"
#endif

#ifndef _MORKHANDLE_
#include "morkHandle.h"
#endif

#include "nsCOMPtr.h"


//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

NS_IMPL_ISUPPORTS1(morkObject, nsIMdbObject)

// ````` ````` ````` ````` ````` 
// { ===== begin morkNode interface =====

/*public virtual*/ void
morkObject::CloseMorkNode(morkEnv* ev) // CloseObject() only if open
{
  if ( this->IsOpenNode() )
  {
    this->MarkClosing();
    this->CloseObject(ev);
    this->MarkShut();
  }
}

/*public virtual*/
morkObject::~morkObject() // assert CloseObject() executed earlier
{
  if (!IsShutNode())
    CloseMorkNode(this->mMorkEnv);
  MORK_ASSERT(mObject_Handle==0);
}

/*public non-poly*/
morkObject::morkObject(const morkUsage& inUsage, nsIMdbHeap* ioHeap,
  mork_color inBeadColor)
: morkBead(inUsage, ioHeap, inBeadColor)
, mObject_Handle( 0 )
{
  mMorkEnv = nullptr;
}

/*public non-poly*/
morkObject::morkObject(morkEnv* ev,
  const morkUsage& inUsage, nsIMdbHeap* ioHeap, 
  mork_color inBeadColor, morkHandle* ioHandle)
: morkBead(ev, inUsage, ioHeap, inBeadColor)
, mObject_Handle( 0 )
{
  mMorkEnv = ev;
  if ( ev->Good() )
  {
    if ( ioHandle )
      morkHandle::SlotWeakHandle(ioHandle, ev, &mObject_Handle);
      
    if ( ev->Good() )
      mNode_Derived = morkDerived_kObject;
  }
}

/*public non-poly*/ void
morkObject::CloseObject(morkEnv* ev) // called by CloseMorkNode();
{
  if ( this )
  {
    if ( this->IsNode() )
    {
      if ( !this->IsShutNode() )
      {
        if ( mObject_Handle )
          morkHandle::SlotWeakHandle((morkHandle*) 0L, ev, &mObject_Handle);
          
        mBead_Color = 0; // this->CloseBead(ev);
        this->MarkShut();
      }
    }
    else
      this->NonNodeError(ev);
  }
  else
    ev->NilPointerError();
}

// } ===== end morkNode methods =====
// ````` ````` ````` ````` ````` 

// { ----- begin factory methods -----
NS_IMETHODIMP
morkObject::GetMdbFactory(nsIMdbEnv* mev, nsIMdbFactory** acqFactory)
{
  nsresult rv;
  nsCOMPtr <nsIMdbObject> obj = do_QueryInterface(mev);
  if (obj)
    rv = obj->GetMdbFactory(mev, acqFactory);
  else
    return NS_ERROR_NO_INTERFACE;

  return rv;
} 
// } ----- end factory methods -----

// { ----- begin ref counting for well-behaved cyclic graphs -----
NS_IMETHODIMP
morkObject::GetWeakRefCount(nsIMdbEnv* mev, // weak refs
  mdb_count* outCount)
{
  *outCount = WeakRefsOnly();
  return NS_OK;
}  
NS_IMETHODIMP
morkObject::GetStrongRefCount(nsIMdbEnv* mev, // strong refs
  mdb_count* outCount)
{
  *outCount = StrongRefsOnly();
  return NS_OK;
}
// ### TODO - clean up this cast, if required
NS_IMETHODIMP
morkObject::AddWeakRef(nsIMdbEnv* mev)
{
  return morkNode::AddWeakRef((morkEnv *) mev);
}
NS_IMETHODIMP
morkObject::AddStrongRef(nsIMdbEnv* mev)
{
  return morkNode::AddStrongRef((morkEnv *) mev);
}

NS_IMETHODIMP
morkObject::CutWeakRef(nsIMdbEnv* mev)
{
  return morkNode::CutWeakRef((morkEnv *) mev);
}
NS_IMETHODIMP
morkObject::CutStrongRef(nsIMdbEnv* mev)
{
  return morkNode::CutStrongRef((morkEnv *) mev);
}

  
NS_IMETHODIMP
morkObject::CloseMdbObject(nsIMdbEnv* mev)
{
  return morkNode::CloseMdbObject((morkEnv *) mev);
}

NS_IMETHODIMP
morkObject::IsOpenMdbObject(nsIMdbEnv* mev, mdb_bool* outOpen)
{
  *outOpen = IsOpenNode();
  return NS_OK;
}
NS_IMETHODIMP
morkObject::IsFrozenMdbObject(nsIMdbEnv* mev, mdb_bool* outIsReadonly)
{
  *outIsReadonly = IsFrozen();
  return NS_OK;
}

//void morkObject::NewNilHandleError(morkEnv* ev) // mObject_Handle is nil
//{
//  ev->NewError("nil mObject_Handle");
//}


//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789
