/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKROWOBJECT_
#define _MORKROWOBJECT_ 1

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _MORKOBJECT_
#include "morkObject.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

class nsIMdbRow;
#define morkDerived_kRowObject  /*i*/ 0x724F /* ascii 'rO' */

class morkRowObject : public morkObject, public nsIMdbRow  { //

public: // state is public because the entire Mork system is private
  NS_DECL_ISUPPORTS_INHERITED
  
  morkRow*    mRowObject_Row;     // non-refcounted alias to morkRow
  morkStore*  mRowObject_Store;   // non-refcounted ptr to store containing row
  
// { ===== begin morkNode interface =====
public: // morkNode virtual methods
  virtual void CloseMorkNode(morkEnv* ev); // CloseRowObject() only if open
  virtual ~morkRowObject(); // assert that CloseRowObject() executed earlier
  
public: // morkRowObject construction & destruction
  morkRowObject(morkEnv* ev, const morkUsage& inUsage,
    nsIMdbHeap* ioHeap, morkRow* ioRow, morkStore* ioStore);
  void CloseRowObject(morkEnv* ev); // called by CloseMorkNode();

// { ===== begin nsIMdbCollection methods =====

  // { ----- begin attribute methods -----
  NS_IMETHOD GetSeed(nsIMdbEnv* ev,
    mdb_seed* outSeed);    // member change count
  NS_IMETHOD GetCount(nsIMdbEnv* ev,
    mdb_count* outCount); // member count

  NS_IMETHOD GetPort(nsIMdbEnv* ev,
    nsIMdbPort** acqPort); // collection container
  // } ----- end attribute methods -----

  // { ----- begin cursor methods -----
  NS_IMETHOD GetCursor( // make a cursor starting iter at inMemberPos
    nsIMdbEnv* ev, // context
    mdb_pos inMemberPos, // zero-based ordinal pos of member in collection
    nsIMdbCursor** acqCursor); // acquire new cursor instance
  // } ----- end cursor methods -----

  // { ----- begin ID methods -----
  NS_IMETHOD GetOid(nsIMdbEnv* ev,
    mdbOid* outOid); // read object identity
  NS_IMETHOD BecomeContent(nsIMdbEnv* ev,
    const mdbOid* inOid); // exchange content
  // } ----- end ID methods -----

  // { ----- begin activity dropping methods -----
  NS_IMETHOD DropActivity( // tell collection usage no longer expected
    nsIMdbEnv* ev);
  // } ----- end activity dropping methods -----

// } ===== end nsIMdbCollection methods =====
// { ===== begin nsIMdbRow methods =====

  // { ----- begin cursor methods -----
  NS_IMETHOD GetRowCellCursor( // make a cursor starting iteration at inRowPos
    nsIMdbEnv* ev, // context
    mdb_pos inRowPos, // zero-based ordinal position of row in table
    nsIMdbRowCellCursor** acqCursor); // acquire new cursor instance
  // } ----- end cursor methods -----

  // { ----- begin column methods -----
  NS_IMETHOD AddColumn( // make sure a particular column is inside row
    nsIMdbEnv* ev, // context
    mdb_column inColumn, // column to add
    const mdbYarn* inYarn); // cell value to install

  NS_IMETHOD CutColumn( // make sure a column is absent from the row
    nsIMdbEnv* ev, // context
    mdb_column inColumn); // column to ensure absent from row

  NS_IMETHOD CutAllColumns( // remove all columns from the row
    nsIMdbEnv* ev); // context
  // } ----- end column methods -----

  // { ----- begin cell methods -----
  NS_IMETHOD NewCell( // get cell for specified column, or add new one
    nsIMdbEnv* ev, // context
    mdb_column inColumn, // column to add
    nsIMdbCell** acqCell); // cell column and value
    
  NS_IMETHOD AddCell( // copy a cell from another row to this row
    nsIMdbEnv* ev, // context
    const nsIMdbCell* inCell); // cell column and value
    
  NS_IMETHOD GetCell( // find a cell in this row
    nsIMdbEnv* ev, // context
    mdb_column inColumn, // column to find
    nsIMdbCell** acqCell); // cell for specified column, or null
    
  NS_IMETHOD EmptyAllCells( // make all cells in row empty of content
    nsIMdbEnv* ev); // context
  // } ----- end cell methods -----

  // { ----- begin row methods -----
  NS_IMETHOD AddRow( // add all cells in another row to this one
    nsIMdbEnv* ev, // context
    nsIMdbRow* ioSourceRow); // row to union with
    
  NS_IMETHOD SetRow( // make exact duplicate of another row
    nsIMdbEnv* ev, // context
    nsIMdbRow* ioSourceRow); // row to duplicate
  // } ----- end row methods -----

  // { ----- begin blob methods -----  
  NS_IMETHOD SetCellYarn(nsIMdbEnv* ev, // synonym for AddColumn()
    mdb_column inColumn, // column to write
    const mdbYarn* inYarn);   // reads from yarn slots
  // make this text object contain content from the yarn's buffer
  
  NS_IMETHOD GetCellYarn(nsIMdbEnv* ev, 
    mdb_column inColumn, // column to read 
    mdbYarn* outYarn);  // writes some yarn slots 
  // copy content into the yarn buffer, and update mYarn_Fill and mYarn_Form
  
  NS_IMETHOD AliasCellYarn(nsIMdbEnv* ev, 
    mdb_column inColumn, // column to alias
    mdbYarn* outYarn); // writes ALL yarn slots
  
  NS_IMETHOD NextCellYarn(nsIMdbEnv* ev, // iterative version of GetCellYarn()
    mdb_column* ioColumn, // next column to read
    mdbYarn* outYarn);  // writes some yarn slots 
  // copy content into the yarn buffer, and update mYarn_Fill and mYarn_Form
  //
  // The ioColumn argument is an inout parameter which initially contains the
  // last column accessed and returns the next column corresponding to the
  // content read into the yarn.  Callers should start with a zero column
  // value to say 'no previous column', which causes the first column to be
  // read.  Then the value returned in ioColumn is perfect for the next call
  // to NextCellYarn(), since it will then be the previous column accessed.
  // Callers need only examine the column token returned to see which cell
  // in the row is being read into the yarn.  When no more columns remain,
  // and the iteration has ended, ioColumn will return a zero token again.
  // So iterating over cells starts and ends with a zero column token.

  NS_IMETHOD SeekCellYarn( // resembles nsIMdbRowCellCursor::SeekCell()
    nsIMdbEnv* ev, // context
    mdb_pos inPos, // position of cell in row sequence
    mdb_column* outColumn, // column for this particular cell
    mdbYarn* outYarn); // writes some yarn slots
  // copy content into the yarn buffer, and update mYarn_Fill and mYarn_Form
  // Callers can pass nil for outYarn to indicate no interest in content, so
  // only the outColumn value is returned.  NOTE to subclasses: you must be
  // able to ignore outYarn when the pointer is nil; please do not crash.

  // } ----- end blob methods -----

// } ===== end nsIMdbRow methods =====

private: // copying is not allowed
  morkRowObject(const morkRowObject& other);
  morkRowObject& operator=(const morkRowObject& other);

public: // dynamic type identification
  mork_bool IsRowObject() const
  { return IsNode() && mNode_Derived == morkDerived_kRowObject; }
// } ===== end morkNode methods =====

public: // typing
  static void NonRowObjectTypeError(morkEnv* ev);
  static void NilRowError(morkEnv* ev);
  static void NilStoreError(morkEnv* ev);
  static void RowObjectRowNotSelfError(morkEnv* ev);

public: // other row node methods

  nsIMdbRow* AcquireRowHandle(morkEnv* ev); // mObject_Handle
  
public: // typesafe refcounting inlines calling inherited morkNode methods
  static void SlotWeakRowObject(morkRowObject* me,
    morkEnv* ev, morkRowObject** ioSlot)
  { morkNode::SlotWeakNode((morkNode*) me, ev, (morkNode**) ioSlot); }
  
  static void SlotStrongRowObject(morkRowObject* me,
    morkEnv* ev, morkRowObject** ioSlot)
  { morkNode::SlotStrongNode((morkNode*) me, ev, (morkNode**) ioSlot); }
};

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKROWOBJECT_ */
