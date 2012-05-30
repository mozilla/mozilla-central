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

#ifndef _MORKYARN_
#include "morkYarn.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

// ````` ````` ````` ````` ````` 
// { ===== begin morkNode interface =====

/*public virtual*/ void
morkYarn::CloseMorkNode(morkEnv* ev) /*i*/ // CloseYarn() only if open
{
  if ( this->IsOpenNode() )
  {
    this->MarkClosing();
    this->CloseYarn(ev);
    this->MarkShut();
  }
}

/*public virtual*/
morkYarn::~morkYarn() /*i*/ // assert CloseYarn() executed earlier
{
  MORK_ASSERT(mYarn_Body.mYarn_Buf==0);
}

/*public non-poly*/
morkYarn::morkYarn(morkEnv* ev, /*i*/
  const morkUsage& inUsage, nsIMdbHeap* ioHeap)
  : morkNode(ev, inUsage, ioHeap)
{
  if ( ev->Good() )
    mNode_Derived = morkDerived_kYarn;
}

/*public non-poly*/ void
morkYarn::CloseYarn(morkEnv* ev) /*i*/ // called by CloseMorkNode();
{
  if ( this )
  {
    if ( this->IsNode() )
      this->MarkShut();
    else
      this->NonNodeError(ev);
  }
  else
    ev->NilPointerError();
}

// } ===== end morkNode methods =====
// ````` ````` ````` ````` ````` 

/*static*/ void
morkYarn::NonYarnTypeError(morkEnv* ev)
{
  ev->NewError("non morkYarn");
}

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789
