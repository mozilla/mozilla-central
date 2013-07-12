/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsDBFolderInfo.h"
#include "nsMsgDatabase.h"
#include "nsMsgFolderFlags.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIPrefLocalizedString.h"
#include "nsIObserver.h"
#include "nsIObserverService.h"
#include "nsIMsgDBView.h"
#include "nsISupportsObsolete.h"
#include "nsServiceManagerUtils.h"
#include "nsImapCore.h"
#include "mozilla/Services.h"

static const char *kDBFolderInfoScope = "ns:msg:db:row:scope:dbfolderinfo:all";
static const char *kDBFolderInfoTableKind = "ns:msg:db:table:kind:dbfolderinfo";

struct mdbOid gDBFolderInfoOID;

static const char * kNumMessagesColumnName ="numMsgs";
// have to leave this as numNewMsgs even though it's numUnread Msgs
static const char * kNumUnreadMessagesColumnName = "numNewMsgs";
static const char * kFlagsColumnName = "flags";
static const char * kFolderSizeColumnName = "folderSize";
static const char * kExpungedBytesColumnName = "expungedBytes";
static const char * kFolderDateColumnName = "folderDate";
static const char * kHighWaterMessageKeyColumnName = "highWaterKey";

static const char * kImapUidValidityColumnName = "UIDValidity";
static const char * kTotalPendingMessagesColumnName = "totPendingMsgs";
static const char * kUnreadPendingMessagesColumnName = "unreadPendingMsgs";
static const char * kMailboxNameColumnName = "mailboxName";
static const char * kKnownArtsSetColumnName = "knownArts";
static const char * kExpiredMarkColumnName = "expiredMark";
static const char * kVersionColumnName = "version";
static const char * kCharacterSetColumnName = "charSet";
static const char * kCharacterSetOverrideColumnName = "charSetOverride";
static const char * kLocaleColumnName = "locale";


#define kMAILNEWS_VIEW_DEFAULT_CHARSET        "mailnews.view_default_charset"
#define kMAILNEWS_DEFAULT_CHARSET_OVERRIDE    "mailnews.force_charset_override"
static nsCString* gDefaultCharacterSet = nullptr;
static bool       gDefaultCharacterOverride;
static nsIObserver *gFolderCharsetObserver = nullptr;

// observer for charset related preference notification
class nsFolderCharsetObserver : public nsIObserver {

public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER

  nsFolderCharsetObserver() { }
  virtual ~nsFolderCharsetObserver() {}
};

NS_IMPL_ISUPPORTS1(nsFolderCharsetObserver, nsIObserver)

NS_IMETHODIMP nsFolderCharsetObserver::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *someData)
{
  nsresult rv;

  nsCOMPtr<nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIPrefBranch> prefBranch;
  rv = prefs->GetBranch(nullptr, getter_AddRefs(prefBranch));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!strcmp(aTopic, NS_PREFBRANCH_PREFCHANGE_TOPIC_ID))
  {
    nsDependentString prefName(someData);

    if (prefName.EqualsLiteral(kMAILNEWS_VIEW_DEFAULT_CHARSET))
    {
      nsCOMPtr<nsIPrefLocalizedString> pls;
      rv = prefBranch->GetComplexValue(kMAILNEWS_VIEW_DEFAULT_CHARSET,
                      NS_GET_IID(nsIPrefLocalizedString), getter_AddRefs(pls));
      if (NS_SUCCEEDED(rv))
      {
        nsString ucsval;
        pls->ToString(getter_Copies(ucsval));
        if (!ucsval.IsEmpty())
        {
          if (gDefaultCharacterSet)
            CopyUTF16toUTF8(ucsval, *gDefaultCharacterSet);
        }
      }
    }
    else if (prefName.EqualsLiteral(kMAILNEWS_DEFAULT_CHARSET_OVERRIDE))
    {
      rv = prefBranch->GetBoolPref(kMAILNEWS_DEFAULT_CHARSET_OVERRIDE, &gDefaultCharacterOverride);
    }
  }
  else if (!strcmp(aTopic, NS_XPCOM_SHUTDOWN_OBSERVER_ID))
  {
    rv = prefBranch->RemoveObserver(kMAILNEWS_VIEW_DEFAULT_CHARSET, this);
    rv = prefBranch->RemoveObserver(kMAILNEWS_DEFAULT_CHARSET_OVERRIDE, this);
    NS_IF_RELEASE(gFolderCharsetObserver);
    delete gDefaultCharacterSet;
    gDefaultCharacterSet = nullptr;
  }
  return rv;
}


NS_IMPL_ADDREF(nsDBFolderInfo)
NS_IMPL_RELEASE(nsDBFolderInfo)

NS_IMETHODIMP
nsDBFolderInfo::QueryInterface(REFNSIID iid, void** result)
{
  if (! result)
    return NS_ERROR_NULL_POINTER;

  *result = nullptr;
  if(iid.Equals(NS_GET_IID(nsIDBFolderInfo)) ||
    iid.Equals(NS_GET_IID(nsISupports)))
  {
    *result = static_cast<nsIDBFolderInfo*>(this);
    AddRef();
    return NS_OK;
  }
  return NS_NOINTERFACE;
}


nsDBFolderInfo::nsDBFolderInfo(nsMsgDatabase *mdb)
                  : m_flags(0),
                    m_expiredMark(0),
                    m_expiredMarkColumnToken(0)
{
  m_mdbTable = NULL;
  m_mdbRow = NULL;
  m_version = 1; // for upgrading...
  m_IMAPHierarchySeparator = 0; // imap path separator
  // mail only (for now)
  m_folderSize = 0;
  m_folderDate = 0;
  m_expungedBytes = 0; // sum of size of deleted messages in folder
  m_highWaterMessageKey = 0;

  m_numUnreadMessages = 0;
  m_numMessages = 0;
  // IMAP only
  m_ImapUidValidity = kUidUnknown;
  m_totalPendingMessages =0;
  m_unreadPendingMessages = 0;

  m_mdbTokensInitialized = false;
  m_charSetOverride = false;

  if (!gFolderCharsetObserver)
  {
    nsresult rv;
    nsCOMPtr<nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
    nsCOMPtr<nsIPrefBranch> prefBranch;
    if (NS_SUCCEEDED(rv))
    {
      rv = prefs->GetBranch(nullptr, getter_AddRefs(prefBranch));
    }
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIPrefLocalizedString> pls;
      rv = prefBranch->GetComplexValue(kMAILNEWS_VIEW_DEFAULT_CHARSET,
        NS_GET_IID(nsIPrefLocalizedString), getter_AddRefs(pls));
      if (NS_SUCCEEDED(rv))
      {
        nsString ucsval;
        pls->ToString(getter_Copies(ucsval));
        if (!ucsval.IsEmpty())
        {
          if (!gDefaultCharacterSet)
            gDefaultCharacterSet = new nsCString;

          if (gDefaultCharacterSet)
            CopyUTF16toUTF8(ucsval, *gDefaultCharacterSet);
        }
      }
      rv = prefBranch->GetBoolPref(kMAILNEWS_DEFAULT_CHARSET_OVERRIDE, &gDefaultCharacterOverride);

      gFolderCharsetObserver = new nsFolderCharsetObserver();
      NS_ASSERTION(gFolderCharsetObserver, "failed to create observer");

      // register prefs callbacks
      if (gFolderCharsetObserver)
      {
        NS_ADDREF(gFolderCharsetObserver);
        rv = prefBranch->AddObserver(kMAILNEWS_VIEW_DEFAULT_CHARSET, gFolderCharsetObserver, false);
        rv = prefBranch->AddObserver(kMAILNEWS_DEFAULT_CHARSET_OVERRIDE, gFolderCharsetObserver, false);

        // also register for shutdown
        nsCOMPtr<nsIObserverService> observerService =
          mozilla::services::GetObserverService();
        if (observerService)
        {
          rv = observerService->AddObserver(gFolderCharsetObserver, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);
        }
      }
    }
  }

  m_mdb = mdb;
  if (mdb)
  {
    mdb_err err;

    //		mdb->AddRef();
    err = m_mdb->GetStore()->StringToToken(mdb->GetEnv(), kDBFolderInfoScope, &m_rowScopeToken);
    if (NS_SUCCEEDED(err))
    {
      err = m_mdb->GetStore()->StringToToken(mdb->GetEnv(), kDBFolderInfoTableKind, &m_tableKindToken);
      if (NS_SUCCEEDED(err))
      {
        gDBFolderInfoOID.mOid_Scope = m_rowScopeToken;
        gDBFolderInfoOID.mOid_Id = 1;
      }
    }
    InitMDBInfo();
  }
}

nsDBFolderInfo::~nsDBFolderInfo()
{
  // nsMsgDatabase strictly owns nsDBFolderInfo, so don't ref-count db.
  ReleaseExternalReferences();
}

// Release any objects we're holding onto. This needs to be safe
// to call multiple times.
void nsDBFolderInfo::ReleaseExternalReferences()
{
  if (m_mdb)
  {
    if (m_mdbTable)
    {
      NS_RELEASE(m_mdbTable);
      m_mdbTable = nullptr;
    }
    if (m_mdbRow)
    {
      NS_RELEASE(m_mdbRow);
      m_mdbRow = nullptr;
    }
    m_mdb = nullptr;
  }
}

// this routine sets up a new db to know about the dbFolderInfo stuff...
nsresult nsDBFolderInfo::AddToNewMDB()
{
  nsresult ret = NS_OK;
  if (m_mdb && m_mdb->GetStore())
  {
    nsIMdbStore *store = m_mdb->GetStore();
    // create the unique table for the dbFolderInfo.
    mdb_err err = store->NewTable(m_mdb->GetEnv(), m_rowScopeToken,
      m_tableKindToken, true, nullptr, &m_mdbTable);

    // create the singleton row for the dbFolderInfo.
    err  = store->NewRowWithOid(m_mdb->GetEnv(),
      &gDBFolderInfoOID, &m_mdbRow);

    // add the row to the singleton table.
    if (m_mdbRow && NS_SUCCEEDED(err))
      err = m_mdbTable->AddRow(m_mdb->GetEnv(), m_mdbRow);

    ret = err;	// what are we going to do about mdb_err's?
  }
  return ret;
}

nsresult nsDBFolderInfo::InitFromExistingDB()
{
  nsresult ret = NS_OK;
  if (m_mdb && m_mdb->GetStore())
  {
    nsIMdbStore *store = m_mdb->GetStore();
    if (store)
    {
      mdb_pos		rowPos;
      mdb_count outTableCount; // current number of such tables
      mdb_bool mustBeUnique; // whether port can hold only one of these
      mdb_bool hasOid;
      ret = store->GetTableKind(m_mdb->GetEnv(), m_rowScopeToken, m_tableKindToken, &outTableCount,
        &mustBeUnique, &m_mdbTable);
      //			NS_ASSERTION(mustBeUnique && outTableCount == 1, "only one global db info allowed");

      if (m_mdbTable)
      {
        // find singleton row for global info.
        ret = m_mdbTable->HasOid(m_mdb->GetEnv(), &gDBFolderInfoOID, &hasOid);
        if (NS_SUCCEEDED(ret))
        {
          nsIMdbTableRowCursor *rowCursor;
          rowPos = -1;
          ret= m_mdbTable->GetTableRowCursor(m_mdb->GetEnv(), rowPos, &rowCursor);
          if (NS_SUCCEEDED(ret))
          {
            ret = rowCursor->NextRow(m_mdb->GetEnv(), &m_mdbRow, &rowPos);
            NS_RELEASE(rowCursor);
            if (!m_mdbRow)
              ret = NS_ERROR_FAILURE;
            if (NS_SUCCEEDED(ret))
              LoadMemberVariables();
          }
        }
      }
      else
        ret = NS_ERROR_FAILURE;
    }
  }
  return ret;
}

nsresult nsDBFolderInfo::InitMDBInfo()
{
  nsresult ret = NS_OK;
  if (!m_mdbTokensInitialized && m_mdb && m_mdb->GetStore())
  {
    nsIMdbStore *store = m_mdb->GetStore();
    nsIMdbEnv	*env = m_mdb->GetEnv();

    store->StringToToken(env,  kNumMessagesColumnName, &m_numMessagesColumnToken);
    store->StringToToken(env,  kNumUnreadMessagesColumnName, &m_numUnreadMessagesColumnToken);
    store->StringToToken(env,  kFlagsColumnName, &m_flagsColumnToken);
    store->StringToToken(env,  kFolderSizeColumnName, &m_folderSizeColumnToken);
    store->StringToToken(env,  kExpungedBytesColumnName, &m_expungedBytesColumnToken);
    store->StringToToken(env,  kFolderDateColumnName, &m_folderDateColumnToken);

    store->StringToToken(env,  kHighWaterMessageKeyColumnName, &m_highWaterMessageKeyColumnToken);
    store->StringToToken(env,  kMailboxNameColumnName, &m_mailboxNameColumnToken);

    store->StringToToken(env,  kImapUidValidityColumnName, &m_imapUidValidityColumnToken);
    store->StringToToken(env,  kTotalPendingMessagesColumnName, &m_totalPendingMessagesColumnToken);
    store->StringToToken(env,  kUnreadPendingMessagesColumnName, &m_unreadPendingMessagesColumnToken);
    store->StringToToken(env,  kExpiredMarkColumnName, &m_expiredMarkColumnToken);
    store->StringToToken(env,  kVersionColumnName, &m_versionColumnToken);
    m_mdbTokensInitialized  = true;
  }

  return ret;
}

nsresult nsDBFolderInfo::LoadMemberVariables()
{
  // it's really not an error for these properties to not exist...
  GetInt32PropertyWithToken(m_numMessagesColumnToken, m_numMessages);
  GetInt32PropertyWithToken(m_numUnreadMessagesColumnToken, m_numUnreadMessages);
  GetInt32PropertyWithToken(m_flagsColumnToken, m_flags);
  GetUint64PropertyWithToken(m_folderSizeColumnToken, &m_folderSize);
  GetInt32PropertyWithToken(m_folderDateColumnToken, (int32_t &) m_folderDate);
  GetInt32PropertyWithToken(m_imapUidValidityColumnToken, m_ImapUidValidity, kUidUnknown);
  GetInt32PropertyWithToken(m_expiredMarkColumnToken, (int32_t &) m_expiredMark);
  GetInt32PropertyWithToken(m_expungedBytesColumnToken, (int32_t &) m_expungedBytes);
  GetInt32PropertyWithToken(m_highWaterMessageKeyColumnToken, (int32_t &) m_highWaterMessageKey);
  int32_t version;

  GetInt32PropertyWithToken(m_versionColumnToken, version);
  m_version = (uint16_t) version;
  m_charSetOverride = gDefaultCharacterOverride;
  uint32_t propertyValue;
  nsresult rv = GetUint32Property(kCharacterSetOverrideColumnName, gDefaultCharacterOverride, &propertyValue);
  if (NS_SUCCEEDED(rv))
    m_charSetOverride = propertyValue;

  m_mdb->GetProperty(m_mdbRow, kCharacterSetColumnName, getter_Copies(m_charSet));
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetVersion(uint32_t version)
{
  m_version = version;
  return SetUint32PropertyWithToken(m_versionColumnToken, (uint32_t) m_version);
}

NS_IMETHODIMP nsDBFolderInfo::GetVersion(uint32_t *version)
{
  *version = m_version;
  return NS_OK;
}


nsresult nsDBFolderInfo::AdjustHighWater(nsMsgKey highWater, bool force)
{
  if (force || m_highWaterMessageKey < highWater)
  {
    m_highWaterMessageKey = highWater;
    SetUint32PropertyWithToken(m_highWaterMessageKeyColumnToken, highWater);
  }

  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetHighWater(nsMsgKey highWater)
{
  return AdjustHighWater(highWater, true);
}

NS_IMETHODIMP nsDBFolderInfo::OnKeyAdded(nsMsgKey aNewKey)
{
  return AdjustHighWater(aNewKey, false);
}

NS_IMETHODIMP
nsDBFolderInfo::GetFolderSize(uint64_t *size)
{
  NS_ENSURE_ARG_POINTER(size);
  *size = m_folderSize;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetFolderSize(uint64_t size)
{
  m_folderSize = size;
  return SetUint64Property(kFolderSizeColumnName, m_folderSize);
}

NS_IMETHODIMP
nsDBFolderInfo::GetFolderDate(uint32_t *folderDate)
{
  NS_ENSURE_ARG_POINTER(folderDate);
  *folderDate = m_folderDate;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetFolderDate(uint32_t folderDate)
{
  m_folderDate = folderDate;
  return SetUint32PropertyWithToken(m_folderDateColumnToken, folderDate);
}

NS_IMETHODIMP nsDBFolderInfo::GetHighWater(nsMsgKey *result)
{
  // Sanity check highwater - if it gets too big, other code
  // can fail. Look through last 100 messages to recalculate
  // the highwater mark.
  *result = m_highWaterMessageKey;
  if (m_highWaterMessageKey > 0xFFFFFF00 && m_mdb)
  {
    nsCOMPtr <nsISimpleEnumerator> hdrs;
    nsresult rv = m_mdb->ReverseEnumerateMessages(getter_AddRefs(hdrs));
    if (NS_FAILED(rv))
      return rv;
    bool hasMore = false;
    nsCOMPtr<nsIMsgDBHdr> pHeader;
    nsMsgKey recalculatedHighWater = 1;
    int32_t i = 0;
    while(i++ < 100 && NS_SUCCEEDED(rv = hdrs->HasMoreElements(&hasMore))
              && hasMore)
    {
      (void) hdrs->GetNext(getter_AddRefs(pHeader));
      if (pHeader)
      {
        nsMsgKey msgKey;
        pHeader->GetMessageKey(&msgKey);
        if (msgKey > recalculatedHighWater)
          recalculatedHighWater = msgKey;
      }
    }
    NS_ASSERTION(m_highWaterMessageKey >= recalculatedHighWater,
                 "highwater incorrect");
    m_highWaterMessageKey = recalculatedHighWater;
  }
  *result = m_highWaterMessageKey;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetExpiredMark(nsMsgKey expiredKey)
{
  m_expiredMark = expiredKey;
  return SetUint32PropertyWithToken(m_expiredMarkColumnToken, expiredKey);
}

NS_IMETHODIMP nsDBFolderInfo::GetExpiredMark(nsMsgKey *result)
{
  *result = m_expiredMark;
  return NS_OK;
}

NS_IMETHODIMP
nsDBFolderInfo::ChangeExpungedBytes(int32_t delta)
{
    return SetExpungedBytes(m_expungedBytes + delta);
}

NS_IMETHODIMP nsDBFolderInfo::SetMailboxName(const nsAString &newBoxName)
{
  return SetPropertyWithToken(m_mailboxNameColumnToken, newBoxName);
}

NS_IMETHODIMP nsDBFolderInfo::GetMailboxName(nsAString &boxName)
{
  return GetPropertyWithToken(m_mailboxNameColumnToken, boxName);
}

NS_IMETHODIMP nsDBFolderInfo::ChangeNumUnreadMessages(int32_t delta)
{
  m_numUnreadMessages += delta;
  // m_numUnreadMessages can never be set to negative.
  if (m_numUnreadMessages < 0)
  {
#ifdef DEBUG_bienvenu1
     NS_ASSERTION(false, "Hardcoded assertion");
#endif
      m_numUnreadMessages = 0;
  }
  return SetUint32PropertyWithToken(m_numUnreadMessagesColumnToken, m_numUnreadMessages);
}

NS_IMETHODIMP nsDBFolderInfo::ChangeNumMessages(int32_t delta)
{
  m_numMessages += delta;
  // m_numMessages can never be set to negative.
  if (m_numMessages < 0)
  {
#ifdef DEBUG_bienvenu
    NS_ASSERTION(false, "num messages can't be < 0");
#endif
    m_numMessages = 0;
  }
  return SetUint32PropertyWithToken(m_numMessagesColumnToken, m_numMessages);
}


NS_IMETHODIMP nsDBFolderInfo::GetNumUnreadMessages(int32_t *result)
{
  *result = m_numUnreadMessages;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetNumUnreadMessages(int32_t numUnreadMessages)
{
  m_numUnreadMessages = numUnreadMessages;
  return SetUint32PropertyWithToken(m_numUnreadMessagesColumnToken, m_numUnreadMessages);
}

NS_IMETHODIMP nsDBFolderInfo::GetNumMessages(int32_t *result)
{
  *result = m_numMessages;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetNumMessages(int32_t numMessages)
{
  m_numMessages = numMessages;
  return SetUint32PropertyWithToken(m_numMessagesColumnToken, m_numMessages);
}

NS_IMETHODIMP nsDBFolderInfo::GetExpungedBytes(int32_t *result)
{
  *result = m_expungedBytes;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetExpungedBytes(int32_t expungedBytes)
{
  m_expungedBytes = expungedBytes;
  return SetUint32PropertyWithToken(m_expungedBytesColumnToken, m_expungedBytes);
}


NS_IMETHODIMP nsDBFolderInfo::GetFlags(int32_t *result)
{
  *result = m_flags;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetFlags(int32_t flags)
{
  nsresult ret = NS_OK;

  if (m_flags != flags)
  {
    NS_ASSERTION((m_flags & nsMsgFolderFlags::Inbox) == 0 || (flags & nsMsgFolderFlags::Inbox) != 0, "lost inbox flag");
    m_flags = flags;
    ret = SetInt32PropertyWithToken(m_flagsColumnToken, m_flags);
  }
  return ret;
}

NS_IMETHODIMP nsDBFolderInfo::OrFlags(int32_t flags, int32_t *result)
{
  m_flags |= flags;
  *result = m_flags;
  return SetInt32PropertyWithToken(m_flagsColumnToken, m_flags);
}

NS_IMETHODIMP nsDBFolderInfo::AndFlags(int32_t flags, int32_t *result)
{
  m_flags &= flags;
  *result = m_flags;
  return SetInt32PropertyWithToken(m_flagsColumnToken, m_flags);
}

NS_IMETHODIMP	nsDBFolderInfo::GetImapUidValidity(int32_t *result)
{
  *result = m_ImapUidValidity;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetImapUidValidity(int32_t uidValidity)
{
  m_ImapUidValidity = uidValidity;
  return SetUint32PropertyWithToken(m_imapUidValidityColumnToken, m_ImapUidValidity);
}

bool nsDBFolderInfo::TestFlag(int32_t flags)
{
  return (m_flags & flags) != 0;
}

NS_IMETHODIMP
nsDBFolderInfo::GetCharacterSet(nsACString &result)
{
  if (!m_charSet.IsEmpty())
    result.Assign(m_charSet);
  else if (gDefaultCharacterSet)
    result.Assign(*gDefaultCharacterSet);
  else
    result.Truncate();

  return NS_OK;
}

NS_IMETHODIMP
nsDBFolderInfo::GetEffectiveCharacterSet(nsACString &result)
{
  result.Truncate();
  if (NS_FAILED(GetCharProperty(kCharacterSetColumnName, result)) ||
      (result.IsEmpty() && gDefaultCharacterSet))
    result = *gDefaultCharacterSet;

  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetCharacterSet(const nsACString &charSet)
{
  m_charSet.Assign(charSet);
  return SetCharProperty(kCharacterSetColumnName, charSet);
}

NS_IMETHODIMP nsDBFolderInfo::GetCharacterSetOverride(bool *characterSetOverride)
{
  NS_ENSURE_ARG_POINTER(characterSetOverride);
  *characterSetOverride = m_charSetOverride;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetCharacterSetOverride(bool characterSetOverride)
{
  m_charSetOverride = characterSetOverride;
  return SetUint32Property(kCharacterSetOverrideColumnName, characterSetOverride);
}

NS_IMETHODIMP
nsDBFolderInfo::GetLocale(nsAString &result)
{
  GetProperty(kLocaleColumnName, result);
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetLocale(const nsAString &locale)
{
  return SetProperty(kLocaleColumnName, locale);
}

NS_IMETHODIMP
nsDBFolderInfo::GetImapTotalPendingMessages(int32_t *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = m_totalPendingMessages;
  return NS_OK;
}

void nsDBFolderInfo::ChangeImapTotalPendingMessages(int32_t delta)
{
  m_totalPendingMessages+=delta;
  SetInt32PropertyWithToken(m_totalPendingMessagesColumnToken, m_totalPendingMessages);
}

NS_IMETHODIMP
nsDBFolderInfo::GetImapUnreadPendingMessages(int32_t *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = m_unreadPendingMessages;
  return NS_OK;
}

NS_IMETHODIMP nsDBFolderInfo::SetImapUnreadPendingMessages(int32_t numUnreadPendingMessages)
{
  m_unreadPendingMessages = numUnreadPendingMessages;
  return SetUint32PropertyWithToken(m_unreadPendingMessagesColumnToken, m_unreadPendingMessages);
}

NS_IMETHODIMP nsDBFolderInfo::SetImapTotalPendingMessages(int32_t numTotalPendingMessages)
{
  m_totalPendingMessages = numTotalPendingMessages;
  return SetUint32PropertyWithToken(m_totalPendingMessagesColumnToken, m_totalPendingMessages);
}

void nsDBFolderInfo::ChangeImapUnreadPendingMessages(int32_t delta)
{
  m_unreadPendingMessages+=delta;
  SetInt32PropertyWithToken(m_unreadPendingMessagesColumnToken, m_unreadPendingMessages);
}

/* attribute nsMsgViewTypeValue viewType; */
NS_IMETHODIMP nsDBFolderInfo::GetViewType(nsMsgViewTypeValue *aViewType)
{
  uint32_t viewTypeValue;
  nsresult rv = GetUint32Property("viewType", nsMsgViewType::eShowAllThreads, &viewTypeValue);
  *aViewType = viewTypeValue;
  return rv;
}
NS_IMETHODIMP nsDBFolderInfo::SetViewType(nsMsgViewTypeValue aViewType)
{
  return SetUint32Property("viewType", aViewType);
}

/* attribute nsMsgViewFlagsTypeValue viewFlags; */
NS_IMETHODIMP nsDBFolderInfo::GetViewFlags(nsMsgViewFlagsTypeValue *aViewFlags)
{
  nsMsgViewFlagsTypeValue defaultViewFlags;
  nsresult rv = m_mdb->GetDefaultViewFlags(&defaultViewFlags);
  NS_ENSURE_SUCCESS(rv,rv);

  uint32_t viewFlagsValue;
  rv = GetUint32Property("viewFlags", defaultViewFlags, &viewFlagsValue);
  *aViewFlags = viewFlagsValue;
  return rv;
}
NS_IMETHODIMP nsDBFolderInfo::SetViewFlags(nsMsgViewFlagsTypeValue aViewFlags)
{
  return SetUint32Property("viewFlags", aViewFlags);
}

/* attribute nsMsgViewSortTypeValue sortType; */
NS_IMETHODIMP nsDBFolderInfo::GetSortType(nsMsgViewSortTypeValue *aSortType)
{
  nsMsgViewSortTypeValue defaultSortType;
  nsresult rv = m_mdb->GetDefaultSortType(&defaultSortType);
  NS_ENSURE_SUCCESS(rv,rv);

  uint32_t sortTypeValue;
  rv = GetUint32Property("sortType", defaultSortType, &sortTypeValue);
  *aSortType = sortTypeValue;
  return rv;
}
NS_IMETHODIMP nsDBFolderInfo::SetSortType(nsMsgViewSortTypeValue aSortType)
{
  return SetUint32Property("sortType", aSortType);
}

/* attribute nsMsgViewSortOrderValue sortOrder; */
NS_IMETHODIMP nsDBFolderInfo::GetSortOrder(nsMsgViewSortOrderValue *aSortOrder)
{
  nsMsgViewSortOrderValue defaultSortOrder;
  nsresult rv = m_mdb->GetDefaultSortOrder(&defaultSortOrder);
  NS_ENSURE_SUCCESS(rv,rv);

  uint32_t sortOrderValue;
  rv = GetUint32Property("sortOrder", defaultSortOrder, &sortOrderValue);
  *aSortOrder = sortOrderValue;
  return rv;
}

NS_IMETHODIMP nsDBFolderInfo::SetSortOrder(nsMsgViewSortOrderValue aSortOrder)
{
  return SetUint32Property("sortOrder", aSortOrder);
}

NS_IMETHODIMP nsDBFolderInfo::SetKnownArtsSet(const char *newsArtSet)
{
  return m_mdb->SetProperty(m_mdbRow, kKnownArtsSetColumnName, newsArtSet);
}

NS_IMETHODIMP nsDBFolderInfo::GetKnownArtsSet(char **newsArtSet)
{
  return m_mdb->GetProperty(m_mdbRow, kKnownArtsSetColumnName, newsArtSet);
}

// get arbitrary property, aka row cell value.
NS_IMETHODIMP nsDBFolderInfo::GetProperty(const char *propertyName, nsAString &resultProperty)
{
  return m_mdb->GetPropertyAsNSString(m_mdbRow, propertyName, resultProperty);
}

NS_IMETHODIMP nsDBFolderInfo::SetCharProperty(const char *aPropertyName,
                                              const nsACString &aPropertyValue)
{
  return m_mdb->SetProperty(m_mdbRow, aPropertyName,
                            nsCString(aPropertyValue).get());
}

NS_IMETHODIMP nsDBFolderInfo::GetCharProperty(const char *propertyName,
                                              nsACString &resultProperty)
{
  nsCString result;
  nsresult rv = m_mdb->GetProperty(m_mdbRow, propertyName, getter_Copies(result));
  if (NS_SUCCEEDED(rv))
    resultProperty.Assign(result);
  return rv;
}

NS_IMETHODIMP nsDBFolderInfo::SetUint32Property(const char *propertyName, uint32_t propertyValue)
{
  return m_mdb->SetUint32Property(m_mdbRow, propertyName, propertyValue);
}

NS_IMETHODIMP	nsDBFolderInfo::SetProperty(const char *propertyName, const nsAString &propertyStr)
{
  return m_mdb->SetPropertyFromNSString(m_mdbRow, propertyName, propertyStr);
}

nsresult nsDBFolderInfo::SetPropertyWithToken(mdb_token aProperty, const nsAString &propertyStr)
{
  return m_mdb->SetNSStringPropertyWithToken(m_mdbRow, aProperty, propertyStr);
}

nsresult  nsDBFolderInfo::SetUint32PropertyWithToken(mdb_token aProperty, uint32_t propertyValue)
{
  return m_mdb->UInt32ToRowCellColumn(m_mdbRow, aProperty, propertyValue);
}

nsresult  nsDBFolderInfo::SetUint64Property(const char *aProperty,
                                            uint64_t propertyValue)
{
  return m_mdb->SetUint64Property(m_mdbRow, aProperty, propertyValue);
}

nsresult  nsDBFolderInfo::SetInt32PropertyWithToken(mdb_token aProperty, int32_t propertyValue)
{
  nsAutoString propertyStr;
  propertyStr.AppendInt(propertyValue, 16);
  return SetPropertyWithToken(aProperty, propertyStr);
}

nsresult nsDBFolderInfo::GetPropertyWithToken(mdb_token aProperty, nsAString &resultProperty)
{
  return m_mdb->RowCellColumnTonsString(m_mdbRow, aProperty, resultProperty);
}

nsresult nsDBFolderInfo::GetUint32PropertyWithToken(mdb_token aProperty, uint32_t &propertyValue, uint32_t defaultValue)
{
  return m_mdb->RowCellColumnToUInt32(m_mdbRow, aProperty, propertyValue, defaultValue);
}

nsresult nsDBFolderInfo::GetInt32PropertyWithToken(mdb_token aProperty, int32_t &propertyValue, int32_t defaultValue)
{
  return m_mdb->RowCellColumnToUInt32(m_mdbRow, aProperty, (uint32_t &) propertyValue, defaultValue);
}

NS_IMETHODIMP nsDBFolderInfo::GetUint32Property(const char *propertyName, uint32_t defaultValue, uint32_t *propertyValue)
{
  return m_mdb->GetUint32Property(m_mdbRow, propertyName, propertyValue, defaultValue);
}

nsresult nsDBFolderInfo::GetUint64PropertyWithToken(mdb_token columnToken,
                                                    uint64_t *propertyValue)
{
  return m_mdb->RowCellColumnToUInt64(m_mdbRow, columnToken, propertyValue, 0);
}

NS_IMETHODIMP nsDBFolderInfo::GetBooleanProperty(const char *propertyName, bool defaultValue, bool *propertyValue)
{
  uint32_t defaultUint32Value = (defaultValue) ? 1 : 0;
  uint32_t returnValue;
  nsresult rv = m_mdb->GetUint32Property(m_mdbRow, propertyName, &returnValue, defaultUint32Value);
  *propertyValue = (returnValue != 0);
  return rv;
}
NS_IMETHODIMP	nsDBFolderInfo::SetBooleanProperty(const char *propertyName, bool propertyValue)
{
  return m_mdb->SetUint32Property(m_mdbRow, propertyName, propertyValue ? 1 : 0);
}

NS_IMETHODIMP nsDBFolderInfo::GetFolderName(nsACString &folderName)
{
  return GetCharProperty("folderName", folderName);
}

NS_IMETHODIMP nsDBFolderInfo::SetFolderName(const nsACString &folderName)
{
  return SetCharProperty("folderName", folderName);
}

class nsTransferDBFolderInfo : public nsDBFolderInfo
{
public:
  nsTransferDBFolderInfo();
  virtual ~nsTransferDBFolderInfo();
  // parallel arrays of properties and values
  nsTArray<nsCString> m_properties;
  nsTArray<nsCString> m_values;
};

nsTransferDBFolderInfo::nsTransferDBFolderInfo() : nsDBFolderInfo(nullptr)
{
}

nsTransferDBFolderInfo::~nsTransferDBFolderInfo()
{
}

/* void GetTransferInfo (out nsIDBFolderInfo transferInfo); */
NS_IMETHODIMP nsDBFolderInfo::GetTransferInfo(nsIDBFolderInfo **transferInfo)
{
  NS_ENSURE_ARG_POINTER(transferInfo);

  nsTransferDBFolderInfo *newInfo = new nsTransferDBFolderInfo;
  *transferInfo = newInfo;
  NS_ADDREF(newInfo);

  mdb_count numCells;
  mdbYarn cellYarn;
  mdb_column cellColumn;
  char columnName[100];
  mdbYarn cellName = { columnName, 0, sizeof(columnName), 0, 0, nullptr };

  NS_ASSERTION(m_mdbRow, "null row in getTransferInfo");
  m_mdbRow->GetCount(m_mdb->GetEnv(), &numCells);
  // iterate over the cells in the dbfolderinfo remembering attribute names and values.
  for (mdb_count cellIndex = 0; cellIndex < numCells; cellIndex++)
  {
    mdb_err err = m_mdbRow->SeekCellYarn(m_mdb->GetEnv(), cellIndex, &cellColumn, nullptr);
    if (NS_SUCCEEDED(err))
    {
      err = m_mdbRow->AliasCellYarn(m_mdb->GetEnv(), cellColumn, &cellYarn);
      if (NS_SUCCEEDED(err))
      {
        m_mdb->GetStore()->TokenToString(m_mdb->GetEnv(), cellColumn, &cellName);
        newInfo->m_values.AppendElement(Substring((const char *)cellYarn.mYarn_Buf,
                                        (const char *) cellYarn.mYarn_Buf + cellYarn.mYarn_Fill));
        newInfo->m_properties.AppendElement(Substring((const char *) cellName.mYarn_Buf,
                                            (const char *) cellName.mYarn_Buf + cellName.mYarn_Fill));
      }
    }
  }

  return NS_OK;
}


/* void InitFromTransferInfo (in nsIDBFolderInfo transferInfo); */
NS_IMETHODIMP nsDBFolderInfo::InitFromTransferInfo(nsIDBFolderInfo *aTransferInfo)
{
  NS_ENSURE_ARG(aTransferInfo);

  nsTransferDBFolderInfo *transferInfo = static_cast<nsTransferDBFolderInfo *>(aTransferInfo);

  for (uint32_t i = 0; i < transferInfo->m_values.Length(); i++)
    SetCharProperty(transferInfo->m_properties[i].get(), transferInfo->m_values[i]);

  LoadMemberVariables();
  return NS_OK;
}

