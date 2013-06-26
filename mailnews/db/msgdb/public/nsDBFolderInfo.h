/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This class encapsulates the global information about a folder stored in the
	summary file.
*/
#ifndef _nsDBFolderInfo_H
#define _nsDBFolderInfo_H

#include "mozilla/MemoryReporting.h"
#include "nsStringGlue.h"
#include "MailNewsTypes.h"
#include "mdb.h"
#include "nsTArray.h"
#include "nsIDBFolderInfo.h"
#include <time.h>

class nsMsgDatabase;

// again, this could inherit from nsISupports, but I don't see the need as of yet.
// I'm not sure it needs to be ref-counted (but I think it does).

// I think these getters and setters really need to go through mdb and not rely on the object
// caching the values. If this somehow turns out to be prohibitively expensive, we can invent
// some sort of dirty mechanism, but I think it turns out that these values will be cached by 
// the MSG_FolderInfo's anyway.
class nsDBFolderInfo : public nsIDBFolderInfo
{
public:
  friend class nsMsgDatabase;
  
  nsDBFolderInfo(nsMsgDatabase *mdb);
  virtual ~nsDBFolderInfo();
  
  NS_DECL_ISUPPORTS
    // interface methods.
    NS_DECL_NSIDBFOLDERINFO
    // create the appropriate table and row in a new db.
    nsresult			AddToNewMDB();
  // accessor methods.
  
  bool      TestFlag(int32_t flags);
  int16_t   GetIMAPHierarchySeparator() ;
  void      SetIMAPHierarchySeparator(int16_t hierarchyDelimiter) ;
  void      ChangeImapTotalPendingMessages(int32_t delta);
  void      ChangeImapUnreadPendingMessages(int32_t delta) ;
  
  nsresult      InitFromExistingDB();
  // get and set arbitrary property, aka row cell value.
  nsresult SetPropertyWithToken(mdb_token aProperty, const nsAString &propertyStr);
  nsresult SetUint32PropertyWithToken(mdb_token aProperty, uint32_t propertyValue);
  nsresult SetInt32PropertyWithToken(mdb_token aProperty, int32_t propertyValue);
  nsresult GetPropertyWithToken(mdb_token aProperty, nsAString &resultProperty);
  nsresult GetUint32PropertyWithToken(mdb_token aProperty, uint32_t &propertyValue, uint32_t defaultValue = 0);
  nsresult GetInt32PropertyWithToken(mdb_token aProperty, int32_t &propertyValue, int32_t defaultValue = 0);
  nsresult SetUint64Property(const char *aProperty, uint64_t propertyValue);
  nsresult GetUint64PropertyWithToken(mdb_token columnToken,
                                      uint64_t *propertyValue);

  nsTArray<nsMsgKey> m_lateredKeys; // list of latered messages

  virtual size_t SizeOfExcludingThis(mozilla::MallocSizeOf aMallocSizeOf) const
  {
    return m_lateredKeys.SizeOfExcludingThis(aMallocSizeOf);
  }
  virtual size_t SizeOfIncludingThis(mozilla::MallocSizeOf aMallocSizeOf) const
  {
    return aMallocSizeOf(this) + SizeOfExcludingThis(aMallocSizeOf);
  }
protected:

  // initialize from appropriate table and row in existing db.
  nsresult InitMDBInfo();
  nsresult LoadMemberVariables();

  nsresult AdjustHighWater(nsMsgKey highWater, bool force);

  void ReleaseExternalReferences(); // let go of any references to other objects.

  uint64_t  m_folderSize;
  int32_t   m_expungedBytes; // sum of size of deleted messages in folder
  uint32_t  m_folderDate;
  nsMsgKey  m_highWaterMessageKey; // largest news article number or imap uid whose header we've seen

  //  m_numUnreadMessages and m_numMessages can never be negative. 0 means 'no msgs'.
  int32_t   m_numUnreadMessages;
  int32_t   m_numMessages;    // includes expunged and ignored messages

  int32_t   m_flags;  // folder specific flags. This holds things like re-use thread pane,
  // configured for off-line use, use default retrieval, purge article/header options

  uint16_t    m_version;                // for upgrading...
  int16_t     m_IMAPHierarchySeparator;	// imap path separator
  
  // mail only (for now)
  
  // IMAP only
  int32_t     m_ImapUidValidity;
  int32_t     m_totalPendingMessages;
  int32_t     m_unreadPendingMessages;
  
  // news only (for now)
  nsMsgKey    m_expiredMark;		// Highest invalid article number in group - for expiring
  // the db folder info will have to know what db and row it belongs to, since it is really
  // just a wrapper around the singleton folder info row in the mdb. 
  nsMsgDatabase *m_mdb;
  nsIMdbTable   *m_mdbTable;	// singleton table in db
  nsIMdbRow     *m_mdbRow;	// singleton row in table;

  nsCString     m_charSet;
  bool          m_charSetOverride;
  bool          m_mdbTokensInitialized;
  
  mdb_token     m_rowScopeToken;
  mdb_token     m_tableKindToken;
  // tokens for the pre-set columns - we cache these for speed, which may be silly
  mdb_token     m_mailboxNameColumnToken;
  mdb_token     m_numMessagesColumnToken;
  mdb_token     m_numUnreadMessagesColumnToken;
  mdb_token     m_flagsColumnToken;
  mdb_token     m_folderSizeColumnToken;
  mdb_token     m_expungedBytesColumnToken;
  mdb_token     m_folderDateColumnToken;
  mdb_token     m_highWaterMessageKeyColumnToken;
  
  mdb_token     m_imapUidValidityColumnToken;
  mdb_token     m_totalPendingMessagesColumnToken;
  mdb_token     m_unreadPendingMessagesColumnToken;
  mdb_token     m_expiredMarkColumnToken;
  mdb_token     m_versionColumnToken;
};

#endif
