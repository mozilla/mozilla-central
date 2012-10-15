/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-  */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MORKFACTORY_
#define _MORKFACTORY_ 1

#ifndef _MORK_
#include "mork.h"
#endif

#ifndef _MORKENV_
#include "morkEnv.h"
#endif

#ifndef _MORKOBJECT_
#include "morkObject.h"
#endif

#ifndef _ORKINHEAP_
#include "orkinHeap.h"
#endif

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

class nsIMdbFactory;

#define morkDerived_kFactory  /*i*/ 0x4663 /* ascii 'Fc' */
#define morkFactory_kWeakRefCountBonus 0 /* try NOT to leak all factories */

/*| morkFactory: 
|*/
class morkFactory : public morkObject, public nsIMdbFactory { // nsIMdbObject

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

  morkEnv        mFactory_Env; // private env instance used internally
  orkinHeap      mFactory_Heap;

  NS_DECL_ISUPPORTS_INHERITED
// { ===== begin morkNode interface =====
public: // morkFactory virtual methods
  virtual void CloseMorkNode(morkEnv* ev); // CloseFactory() only if open
  virtual ~morkFactory(); // assert that CloseFactory() executed earlier


// { ===== begin nsIMdbFactory methods =====

  // { ----- begin file methods -----
  NS_IMETHOD OpenOldFile(nsIMdbEnv* ev, nsIMdbHeap* ioHeap,
    const char* inFilePath,
    mdb_bool inFrozen, nsIMdbFile** acqFile);
  // Choose some subclass of nsIMdbFile to instantiate, in order to read
  // (and write if not frozen) the file known by inFilePath.  The file
  // returned should be open and ready for use, and presumably positioned
  // at the first byte position of the file.  The exact manner in which
  // files must be opened is considered a subclass specific detail, and
  // other portions or Mork source code don't want to know how it's done.

  NS_IMETHOD CreateNewFile(nsIMdbEnv* ev, nsIMdbHeap* ioHeap,
    const char* inFilePath,
    nsIMdbFile** acqFile);
  // Choose some subclass of nsIMdbFile to instantiate, in order to read
  // (and write if not frozen) the file known by inFilePath.  The file
  // returned should be created and ready for use, and presumably positioned
  // at the first byte position of the file.  The exact manner in which
  // files must be opened is considered a subclass specific detail, and
  // other portions or Mork source code don't want to know how it's done.
  // } ----- end file methods -----

  // { ----- begin env methods -----
  NS_IMETHOD MakeEnv(nsIMdbHeap* ioHeap, nsIMdbEnv** acqEnv); // new env
  // ioHeap can be nil, causing a MakeHeap() style heap instance to be used
  // } ----- end env methods -----

  // { ----- begin heap methods -----
  NS_IMETHOD MakeHeap(nsIMdbEnv* ev, nsIMdbHeap** acqHeap); // new heap
  // } ----- end heap methods -----

  // { ----- begin row methods -----
  NS_IMETHOD MakeRow(nsIMdbEnv* ev, nsIMdbHeap* ioHeap, nsIMdbRow** acqRow); // new row
  // ioHeap can be nil, causing the heap associated with ev to be used
  // } ----- end row methods -----
  
  // { ----- begin port methods -----
  NS_IMETHOD CanOpenFilePort(
    nsIMdbEnv* ev, // context
    // const char* inFilePath, // the file to investigate
    // const mdbYarn* inFirst512Bytes,
    nsIMdbFile* ioFile, // db abstract file interface
    mdb_bool* outCanOpen, // whether OpenFilePort() might succeed
    mdbYarn* outFormatVersion); // informal file format description
    
  NS_IMETHOD OpenFilePort(
    nsIMdbEnv* ev, // context
    nsIMdbHeap* ioHeap, // can be nil to cause ev's heap attribute to be used
    // const char* inFilePath, // the file to open for readonly import
    nsIMdbFile* ioFile, // db abstract file interface
    const mdbOpenPolicy* inOpenPolicy, // runtime policies for using db
    nsIMdbThumb** acqThumb); // acquire thumb for incremental port open
  // Call nsIMdbThumb::DoMore() until done, or until the thumb is broken, and
  // then call nsIMdbFactory::ThumbToOpenPort() to get the port instance.

  NS_IMETHOD ThumbToOpenPort( // redeeming a completed thumb from OpenFilePort()
    nsIMdbEnv* ev, // context
    nsIMdbThumb* ioThumb, // thumb from OpenFilePort() with done status
    nsIMdbPort** acqPort); // acquire new port object
  // } ----- end port methods -----
  
  // { ----- begin store methods -----
  NS_IMETHOD CanOpenFileStore(
    nsIMdbEnv* ev, // context
    // const char* inFilePath, // the file to investigate
    // const mdbYarn* inFirst512Bytes,
    nsIMdbFile* ioFile, // db abstract file interface
    mdb_bool* outCanOpenAsStore, // whether OpenFileStore() might succeed
    mdb_bool* outCanOpenAsPort, // whether OpenFilePort() might succeed
    mdbYarn* outFormatVersion); // informal file format description
    
  NS_IMETHOD OpenFileStore( // open an existing database
    nsIMdbEnv* ev, // context
    nsIMdbHeap* ioHeap, // can be nil to cause ev's heap attribute to be used
    // const char* inFilePath, // the file to open for general db usage
    nsIMdbFile* ioFile, // db abstract file interface
    const mdbOpenPolicy* inOpenPolicy, // runtime policies for using db
    nsIMdbThumb** acqThumb); // acquire thumb for incremental store open
  // Call nsIMdbThumb::DoMore() until done, or until the thumb is broken, and
  // then call nsIMdbFactory::ThumbToOpenStore() to get the store instance.
    
  NS_IMETHOD
  ThumbToOpenStore( // redeem completed thumb from OpenFileStore()
    nsIMdbEnv* ev, // context
    nsIMdbThumb* ioThumb, // thumb from OpenFileStore() with done status
    nsIMdbStore** acqStore); // acquire new db store object
  
  NS_IMETHOD CreateNewFileStore( // create a new db with minimal content
    nsIMdbEnv* ev, // context
    nsIMdbHeap* ioHeap, // can be nil to cause ev's heap attribute to be used
    // const char* inFilePath, // name of file which should not yet exist
    nsIMdbFile* ioFile, // db abstract file interface
    const mdbOpenPolicy* inOpenPolicy, // runtime policies for using db
    nsIMdbStore** acqStore); // acquire new db store object
  // } ----- end store methods -----

// } ===== end nsIMdbFactory methods =====
  
public: // morkYarn construction & destruction
  morkFactory(); // uses orkinHeap
  morkFactory(nsIMdbHeap* ioHeap); // caller supplied heap
  morkFactory(morkEnv* ev, const morkUsage& inUsage, nsIMdbHeap* ioHeap);
  void CloseFactory(morkEnv* ev); // called by CloseMorkNode();
  
  
public: // morkNode memory management operators
  void* operator new(size_t inSize) CPP_THROW_NEW
  { return ::operator new(inSize); }
  
  void* operator new(size_t inSize, nsIMdbHeap& ioHeap, morkEnv* ev) CPP_THROW_NEW
  { return morkNode::MakeNew(inSize, ioHeap, ev); }
  
private: // copying is not allowed
  morkFactory(const morkFactory& other);
  morkFactory& operator=(const morkFactory& other);

public: // dynamic type identification
  mork_bool IsFactory() const
  { return IsNode() && mNode_Derived == morkDerived_kFactory; }
// } ===== end morkNode methods =====

public: // other factory methods

  void NonFactoryTypeError(morkEnv* ev);
  morkEnv* GetInternalFactoryEnv(mdb_err* outErr);
  mork_bool CanOpenMorkTextFile(morkEnv* ev, nsIMdbFile* ioFile);
  
public: // typesafe refcounting inlines calling inherited morkNode methods
  static void SlotWeakFactory(morkFactory* me,
    morkEnv* ev, morkFactory** ioSlot)
  { morkNode::SlotWeakNode((morkNode*) me, ev, (morkNode**) ioSlot); }
  
  static void SlotStrongFactory(morkFactory* me,
    morkEnv* ev, morkFactory** ioSlot)
  { morkNode::SlotStrongNode((morkNode*) me, ev, (morkNode**) ioSlot); }
};

//3456789_123456789_123456789_123456789_123456789_123456789_123456789_123456789

#endif /* _MORKFACTORY_ */
