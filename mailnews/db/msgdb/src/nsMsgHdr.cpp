/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "msgCore.h"
#include "nsMsgHdr.h"
#include "nsMsgDatabase.h"
#include "nsMsgUtils.h"
#include "nsIMsgHeaderParser.h"
#include "nsMsgMimeCID.h"
#include "nsIMimeConverter.h"

NS_IMPL_ISUPPORTS1(nsMsgHdr, nsIMsgDBHdr)

#define FLAGS_INITED 0x1
#define CACHED_VALUES_INITED 0x2
#define REFERENCES_INITED 0x4
#define THREAD_PARENT_INITED 0x8

nsMsgHdr::nsMsgHdr(nsMsgDatabase *db, nsIMdbRow *dbRow)
{
  m_mdb = db;
  Init();
  m_mdbRow = dbRow;
  if(m_mdb)
  {
    m_mdb->AddRef();
    mdbOid outOid;
    if (dbRow && dbRow->GetOid(m_mdb->GetEnv(), &outOid) == NS_OK)
    {
      m_messageKey = outOid.mOid_Id;
      m_mdb->AddHdrToUseCache((nsIMsgDBHdr *) this, m_messageKey);
    }
  }
}


void nsMsgHdr::Init()
{
  m_initedValues = 0;
  m_statusOffset = 0xffffffff;
  m_messageKey = nsMsgKey_None;
  m_messageSize = 0;
  m_date = LL_ZERO;
  m_flags = 0;
  m_mdbRow = NULL;
  m_numReferences = 0;
  m_threadId = nsMsgKey_None;
  m_threadParent = nsMsgKey_None;
}

nsresult nsMsgHdr::InitCachedValues()
{
  nsresult err = NS_OK;

  if (!m_mdb || !m_mdbRow)
    return NS_ERROR_NULL_POINTER;

  if (!(m_initedValues & CACHED_VALUES_INITED))
  {
    PRUint32 uint32Value;
    mdbOid outOid;
    if (m_mdbRow->GetOid(m_mdb->GetEnv(), &outOid) == NS_OK)
      m_messageKey = outOid.mOid_Id;

    err = GetUInt32Column(m_mdb->m_messageSizeColumnToken, &m_messageSize);

    err = GetUInt32Column(m_mdb->m_dateColumnToken, &uint32Value);
    Seconds2PRTime(uint32Value, &m_date);

    err = GetUInt32Column(m_mdb->m_messageThreadIdColumnToken, &m_threadId);
    err = GetUInt32Column(m_mdb->m_numReferencesColumnToken, &uint32Value);
    if (NS_SUCCEEDED(err))
      m_numReferences = (PRUint16) uint32Value;

    if (NS_SUCCEEDED(err))
      m_initedValues |= CACHED_VALUES_INITED;
  }
  return err;
}

nsresult nsMsgHdr::InitFlags()
{

  nsresult err = NS_OK;

  if (!m_mdb)
    return NS_ERROR_NULL_POINTER;

  if(!(m_initedValues & FLAGS_INITED))
  {
    err = GetUInt32Column(m_mdb->m_flagsColumnToken, &m_flags);
    m_flags &= ~nsMsgMessageFlags::New; // don't get new flag from MDB

    if(NS_SUCCEEDED(err))
      m_initedValues |= FLAGS_INITED;
  }

  return err;

}

nsMsgHdr::~nsMsgHdr()
{
  if (m_mdbRow)
  {
    if (m_mdb)
    {
      NS_RELEASE(m_mdbRow);
      m_mdb->RemoveHdrFromUseCache((nsIMsgDBHdr *) this, m_messageKey);
      m_mdb->Release();
    }
  }
}

NS_IMETHODIMP nsMsgHdr::GetMessageKey(nsMsgKey *result)
{
  if (m_messageKey == nsMsgKey_None && m_mdbRow != NULL)
  {
    mdbOid outOid;
    if (m_mdbRow->GetOid(m_mdb->GetEnv(), &outOid) == NS_OK)
      m_messageKey = outOid.mOid_Id;

  }
  *result = m_messageKey;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetThreadId(nsMsgKey *result)
{

  if (!(m_initedValues & CACHED_VALUES_INITED))
    InitCachedValues();

  if (result)
  {
    *result = m_threadId;
    return NS_OK;
  }
  return NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsMsgHdr::SetThreadId(nsMsgKey inKey)
{
  m_threadId = inKey;
  return SetUInt32Column(m_threadId, m_mdb->m_messageThreadIdColumnToken);
}

NS_IMETHODIMP nsMsgHdr::SetMessageKey(nsMsgKey value)
{
  m_messageKey = value;
  return NS_OK;
}

nsresult nsMsgHdr::GetRawFlags(PRUint32 *result)
{
  if (!(m_initedValues & FLAGS_INITED))
    InitFlags();
  *result = m_flags;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetFlags(PRUint32 *result)
{
  if (!(m_initedValues & FLAGS_INITED))
    InitFlags();
  if (m_mdb)
    *result = m_mdb->GetStatusFlags(this, m_flags);
  else
    *result = m_flags;
#ifdef DEBUG_bienvenu
  NS_ASSERTION(! (*result & (nsMsgMessageFlags::Elided)), "shouldn't be set in db");
#endif
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::SetFlags(PRUint32 flags)
{
#ifdef DEBUG_bienvenu
  NS_ASSERTION(! (flags & (nsMsgMessageFlags::Elided)), "shouldn't set this flag on db");
#endif
  m_initedValues |= FLAGS_INITED;
  m_flags = flags;
  // don't write out nsMsgMessageFlags::New to MDB.
  return SetUInt32Column(m_flags & ~nsMsgMessageFlags::New, m_mdb->m_flagsColumnToken);
}

NS_IMETHODIMP nsMsgHdr::OrFlags(PRUint32 flags, PRUint32 *result)
{
  if (!(m_initedValues & FLAGS_INITED))
    InitFlags();
  if ((m_flags & flags) != flags)
    SetFlags (m_flags | flags);
  *result = m_flags;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::AndFlags(PRUint32 flags, PRUint32 *result)
{
  if (!(m_initedValues & FLAGS_INITED))
    InitFlags();
  if ((m_flags & flags) != m_flags)
    SetFlags (m_flags & flags);
  *result = m_flags;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::MarkHasAttachments(PRBool bHasAttachments)
{
  nsresult rv = NS_OK;

  if(m_mdb)
  {
    nsMsgKey key;
    rv = GetMessageKey(&key);
    if(NS_SUCCEEDED(rv))
      rv = m_mdb->MarkHasAttachments(key, bHasAttachments, nsnull);
  }
  return rv;
}

NS_IMETHODIMP nsMsgHdr::MarkRead(PRBool bRead)
{
  nsresult rv = NS_OK;

  if(m_mdb)
  {
    nsMsgKey key;
    rv = GetMessageKey(&key);
    if(NS_SUCCEEDED(rv))
      rv = m_mdb->MarkRead(key, bRead, nsnull);
  }
  return rv;
}

NS_IMETHODIMP nsMsgHdr::MarkFlagged(PRBool bFlagged)
{
  nsresult rv = NS_OK;

  if(m_mdb)
  {
    nsMsgKey key;
    rv = GetMessageKey(&key);
    if(NS_SUCCEEDED(rv))
      rv = m_mdb->MarkMarked(key, bFlagged, nsnull);
  }
  return rv;
}

NS_IMETHODIMP nsMsgHdr::GetProperty(const char *propertyName, nsAString &resultProperty)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  return m_mdb->GetPropertyAsNSString(GetMDBRow(), propertyName, resultProperty);
}

NS_IMETHODIMP nsMsgHdr::SetProperty(const char *propertyName, const nsAString &propertyStr)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  return m_mdb->SetPropertyFromNSString(m_mdbRow, propertyName, propertyStr);
}

NS_IMETHODIMP nsMsgHdr::SetStringProperty(const char *propertyName, const char *propertyValue)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  return m_mdb->SetProperty(m_mdbRow, propertyName, propertyValue);
}

NS_IMETHODIMP nsMsgHdr::GetStringProperty(const char *propertyName, char **aPropertyValue)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  return m_mdb->GetProperty(m_mdbRow, propertyName, aPropertyValue);
}

NS_IMETHODIMP nsMsgHdr::GetUint32Property(const char *propertyName, PRUint32 *pResult)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  return m_mdb->GetUint32Property(GetMDBRow(), propertyName, pResult);
}

NS_IMETHODIMP nsMsgHdr::SetUint32Property(const char *propertyName, PRUint32 value)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  return m_mdb->SetUint32Property(GetMDBRow(), propertyName, value);
}


NS_IMETHODIMP nsMsgHdr::GetNumReferences(PRUint16 *result)
{
	if (!(m_initedValues & CACHED_VALUES_INITED))
		InitCachedValues();

  *result = m_numReferences;
	return NS_OK;
}

nsresult nsMsgHdr::ParseReferences(const char *references)
{
  const char *startNextRef = references;
  nsCAutoString resultReference;

  while (startNextRef && *startNextRef)
  {
    startNextRef = GetNextReference(startNextRef, resultReference,
                                    startNextRef == references);
    if (!resultReference.IsEmpty())
      m_references.AppendCString(resultReference);
  }
  m_numReferences = m_references.Count();
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetStringReference(PRInt32 refNum, nsACString& resultReference)
{
  nsresult err = NS_OK;

  if(!(m_initedValues & REFERENCES_INITED))
  {
    const char *references;
    err = m_mdb->RowCellColumnToConstCharPtr(GetMDBRow(), m_mdb->m_referencesColumnToken, &references);

    if(NS_SUCCEEDED(err))
    {
      ParseReferences(references);
      m_initedValues |= REFERENCES_INITED;
    }
  }

  if (refNum < m_numReferences)
    m_references.CStringAt(refNum, resultReference);
  return err;
}

NS_IMETHODIMP nsMsgHdr::GetDate(PRTime *result)
{
  if (!(m_initedValues & CACHED_VALUES_INITED))
    InitCachedValues();

  *result = m_date;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetDateInSeconds(PRUint32 *aResult)
{
  return GetUInt32Column(m_mdb->m_dateColumnToken, aResult);
}

NS_IMETHODIMP nsMsgHdr::SetMessageId(const char *messageId)
{
  if (messageId && *messageId == '<')
  {
    nsCAutoString tempMessageID(messageId + 1);
    if (tempMessageID.CharAt(tempMessageID.Length() - 1) == '>')
      tempMessageID.SetLength(tempMessageID.Length() - 1);
    return SetStringColumn(tempMessageID.get(), m_mdb->m_messageIdColumnToken);
  }
  return SetStringColumn(messageId, m_mdb->m_messageIdColumnToken);
}

NS_IMETHODIMP nsMsgHdr::SetSubject(const char *subject)
{
	return SetStringColumn(subject, m_mdb->m_subjectColumnToken);
}

NS_IMETHODIMP nsMsgHdr::SetAuthor(const char *author)
{
	return SetStringColumn(author, m_mdb->m_senderColumnToken);
}

NS_IMETHODIMP nsMsgHdr::SetReferences(const char *references)
{
  NS_ENSURE_ARG_POINTER(references);
  if (*references == '\0') {
    m_numReferences = 0;
  }
  else {
    m_references.Clear();
    ParseReferences(references);
  }

  SetUInt32Column(m_numReferences, m_mdb->m_numReferencesColumnToken);
  m_initedValues |= REFERENCES_INITED;

  return SetStringColumn(references, m_mdb->m_referencesColumnToken);
}

NS_IMETHODIMP nsMsgHdr::SetRecipients(const char *recipients)
{
  // need to put in rfc822 address parsing code here (or make caller do it...)
  return SetStringColumn(recipients, m_mdb->m_recipientsColumnToken);
}

nsresult nsMsgHdr::BuildRecipientsFromArray(const char *names, const char *addresses, PRUint32 numAddresses, nsCAutoString& allRecipients)
{
  NS_ENSURE_ARG_POINTER(names);
  NS_ENSURE_ARG_POINTER(addresses);
  nsresult ret = NS_OK;
  const char *curName = names;
  const char *curAddress = addresses;
  nsIMsgHeaderParser *headerParser = m_mdb->GetHeaderParser();

  for (PRUint32 i = 0; i < numAddresses; i++, curName += strlen(curName) + 1, curAddress += strlen(curAddress) + 1)
  {
    if (i > 0)
      allRecipients += ", ";

    if (headerParser)
    {
       nsCString fullAddress;
       ret = headerParser->MakeFullAddressString(curName, curAddress,
                                                 getter_Copies(fullAddress));
       if (NS_SUCCEEDED(ret) && !fullAddress.IsEmpty())
       {
          allRecipients += fullAddress;
          continue;
       }
    }

        // Just in case the parser failed...
    if (strlen(curName))
    {
      allRecipients += curName;
      allRecipients += ' ';
    }

    if (strlen(curAddress))
    {
      allRecipients += '<';
      allRecipients += curAddress;
      allRecipients += '>';
    }
  }

  return ret;
}

NS_IMETHODIMP nsMsgHdr::SetRecipientsArray(const char *names, const char *addresses, PRUint32 numAddresses)
{
	nsresult ret;
	nsCAutoString	allRecipients;

    ret = BuildRecipientsFromArray(names, addresses, numAddresses, allRecipients);
    if (NS_FAILED(ret))
        return ret;

	ret = SetRecipients(allRecipients.get());
	return ret;
}

NS_IMETHODIMP nsMsgHdr::SetCcList(const char *ccList)
{
	return SetStringColumn(ccList, m_mdb->m_ccListColumnToken);
}

// ###should make helper routine that takes column token!
NS_IMETHODIMP nsMsgHdr::SetCCListArray(const char *names, const char *addresses, PRUint32 numAddresses)
{
	nsresult ret;
	nsCAutoString	allRecipients;

    ret = BuildRecipientsFromArray(names, addresses, numAddresses, allRecipients);
    if (NS_FAILED(ret))
        return ret;

	ret = SetCcList(allRecipients.get());
	return ret;
}


NS_IMETHODIMP nsMsgHdr::SetMessageSize(PRUint32 messageSize)
{
  SetUInt32Column(messageSize, m_mdb->m_messageSizeColumnToken);
  m_messageSize = messageSize;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetOfflineMessageSize(PRUint32 *result)
{
  PRUint32 size;
  nsresult res = GetUInt32Column(m_mdb->m_offlineMessageSizeColumnToken, &size);

  *result = size;
  return res;
}

NS_IMETHODIMP nsMsgHdr::SetOfflineMessageSize(PRUint32 messageSize)
{
  return SetUInt32Column(messageSize, m_mdb->m_offlineMessageSizeColumnToken);
}


NS_IMETHODIMP nsMsgHdr::SetLineCount(PRUint32 lineCount)
{
  SetUInt32Column(lineCount, m_mdb->m_numLinesColumnToken);
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::SetStatusOffset(PRUint32 statusOffset)
{
  return SetUInt32Column(statusOffset, m_mdb->m_statusOffsetColumnToken);
}

NS_IMETHODIMP nsMsgHdr::SetDate(PRTime date)
{
  m_date = date;
  PRUint32 seconds;
  PRTime2Seconds(date, &seconds);
  return SetUInt32Column((PRUint32) seconds, m_mdb->m_dateColumnToken);
}

NS_IMETHODIMP nsMsgHdr::GetStatusOffset(PRUint32 *result)
{
  PRUint32 offset = 0;
  nsresult res = GetUInt32Column(m_mdb->m_statusOffsetColumnToken, &offset);

  *result = offset;
  return res;
}

NS_IMETHODIMP nsMsgHdr::SetPriority(nsMsgPriorityValue priority)
{
  SetUInt32Column((PRUint32) priority, m_mdb->m_priorityColumnToken);
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetPriority(nsMsgPriorityValue *result)
{
  if (!result)
    return NS_ERROR_NULL_POINTER;

  PRUint32 priority = 0;
  nsresult rv = GetUInt32Column(m_mdb->m_priorityColumnToken, &priority);
  if (NS_FAILED(rv)) return rv;

  *result = (nsMsgPriorityValue) priority;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::SetLabel(nsMsgLabelValue label)
{
  SetUInt32Column((PRUint32) label, m_mdb->m_labelColumnToken);
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetLabel(nsMsgLabelValue *result)
{
  NS_ENSURE_ARG_POINTER(result);

  return GetUInt32Column(m_mdb->m_labelColumnToken, result);
}

// I'd like to not store the account key, if the msg is in
// the same account as it was received in, to save disk space and memory.
// This might be problematic when a message gets moved...
// And I'm not sure if we should short circuit it here,
// or at a higher level where it might be more efficient.
NS_IMETHODIMP nsMsgHdr::SetAccountKey(const char *aAccountKey)
{
  return SetStringProperty("account", aAccountKey);
}

NS_IMETHODIMP nsMsgHdr::GetAccountKey(char **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  return GetStringProperty("account", aResult);
}


NS_IMETHODIMP nsMsgHdr::GetMessageOffset(PRUint32 *result)
{
  NS_ENSURE_ARG(result);

  // if we have the message body offline, then return the message offset column
  // (this will only be true for news and imap messages).
  PRUint32 rawFlags;
  GetRawFlags(&rawFlags);
  if (rawFlags & nsMsgMessageFlags::Offline)
  {
    return GetUInt32Column(m_mdb->m_offlineMsgOffsetColumnToken, result);
  }
  else
  {
    *result = m_messageKey;
    return NS_OK;
  }
}

NS_IMETHODIMP nsMsgHdr::SetMessageOffset(PRUint32 offset)
{
  SetUInt32Column(offset, m_mdb->m_offlineMsgOffsetColumnToken);
  return NS_OK;
}


NS_IMETHODIMP nsMsgHdr::GetMessageSize(PRUint32 *result)
{
  PRUint32 size;
  nsresult res = GetUInt32Column(m_mdb->m_messageSizeColumnToken, &size);

  *result = size;
  return res;
}

NS_IMETHODIMP nsMsgHdr::GetLineCount(PRUint32 *result)
{
  PRUint32 linecount;
  nsresult res = GetUInt32Column(m_mdb->m_numLinesColumnToken, &linecount);
  *result = linecount;
  return res;
}

NS_IMETHODIMP nsMsgHdr::SetPriorityString(const char *priority)
{
  nsMsgPriorityValue priorityVal = nsMsgPriority::Default;

  // We can ignore |NS_MsgGetPriorityFromString()| return value,
  // since we set a default value for |priorityVal|.
  NS_MsgGetPriorityFromString(priority, priorityVal);

  return SetPriority(priorityVal);
}

NS_IMETHODIMP nsMsgHdr::GetAuthor(char* *resultAuthor)
{
  return m_mdb->RowCellColumnToCharPtr(GetMDBRow(), m_mdb->m_senderColumnToken, resultAuthor);
}

NS_IMETHODIMP nsMsgHdr::GetSubject(char* *resultSubject)
{
  return m_mdb->RowCellColumnToCharPtr(GetMDBRow(), m_mdb->m_subjectColumnToken, resultSubject);
}

NS_IMETHODIMP nsMsgHdr::GetRecipients(char* *resultRecipients)
{
  return m_mdb->RowCellColumnToCharPtr(GetMDBRow(), m_mdb->m_recipientsColumnToken, resultRecipients);
}

NS_IMETHODIMP nsMsgHdr::GetCcList(char * *resultCCList)
{
  return m_mdb->RowCellColumnToCharPtr(GetMDBRow(), m_mdb->m_ccListColumnToken, resultCCList);
}

NS_IMETHODIMP nsMsgHdr::GetMessageId(char * *resultMessageId)
{
  return m_mdb->RowCellColumnToCharPtr(GetMDBRow(), m_mdb->m_messageIdColumnToken, resultMessageId);
}

NS_IMETHODIMP nsMsgHdr::GetMime2DecodedAuthor(nsAString &resultAuthor)
{
  return m_mdb->RowCellColumnToMime2DecodedString(GetMDBRow(), m_mdb->m_senderColumnToken, resultAuthor);
}

NS_IMETHODIMP nsMsgHdr::GetMime2DecodedSubject(nsAString &resultSubject)
{
  return m_mdb->RowCellColumnToMime2DecodedString(GetMDBRow(), m_mdb->m_subjectColumnToken, resultSubject);
}

NS_IMETHODIMP nsMsgHdr::GetMime2DecodedRecipients(nsAString &resultRecipients)
{
  return m_mdb->RowCellColumnToMime2DecodedString(GetMDBRow(), m_mdb->m_recipientsColumnToken, resultRecipients);
}


NS_IMETHODIMP nsMsgHdr::GetAuthorCollationKey(PRUint8 **resultAuthor, PRUint32 *len)
{
  return m_mdb->RowCellColumnToAddressCollationKey(GetMDBRow(), m_mdb->m_senderColumnToken, resultAuthor, len);
}

NS_IMETHODIMP nsMsgHdr::GetSubjectCollationKey(PRUint8 **resultSubject, PRUint32 *len)
{
  return m_mdb->RowCellColumnToCollationKey(GetMDBRow(), m_mdb->m_subjectColumnToken, resultSubject, len);
}

NS_IMETHODIMP nsMsgHdr::GetRecipientsCollationKey(PRUint8 **resultRecipients, PRUint32 *len)
{
  return m_mdb->RowCellColumnToCollationKey(GetMDBRow(), m_mdb->m_recipientsColumnToken, resultRecipients, len);
}

NS_IMETHODIMP nsMsgHdr::GetCharset(char **aCharset)
{
  return m_mdb->RowCellColumnToCharPtr(GetMDBRow(), m_mdb->m_messageCharSetColumnToken, aCharset);
}

NS_IMETHODIMP nsMsgHdr::SetCharset(const char *aCharset)
{
  return SetStringColumn(aCharset, m_mdb->m_messageCharSetColumnToken);
}

NS_IMETHODIMP nsMsgHdr::SetThreadParent(nsMsgKey inKey)
{
  m_threadParent = inKey;
  if (inKey == m_messageKey)
    NS_ASSERTION(PR_FALSE, "can't be your own parent");
  SetUInt32Column(m_threadParent, m_mdb->m_threadParentColumnToken);
  m_initedValues |= THREAD_PARENT_INITED;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetThreadParent(nsMsgKey *result)
{
  nsresult res;
  if(!(m_initedValues & THREAD_PARENT_INITED))
  {
    res = GetUInt32Column(m_mdb->m_threadParentColumnToken, &m_threadParent, nsMsgKey_None);
    if (NS_SUCCEEDED(res))
      m_initedValues |= THREAD_PARENT_INITED;
  }
  *result = m_threadParent;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetFolder(nsIMsgFolder **result)
{
  NS_ENSURE_ARG(result);

  if (m_mdb && m_mdb->m_folder)
  {
    *result = m_mdb->m_folder;
    NS_ADDREF(*result);
  }
  else
    *result = nsnull;
  return NS_OK;
}

nsresult nsMsgHdr::SetStringColumn(const char *str, mdb_token token)
{
  NS_ENSURE_ARG_POINTER(str);
  return m_mdb->CharPtrToRowCellColumn(m_mdbRow, token, str);
}

nsresult nsMsgHdr::SetUInt32Column(PRUint32 value, mdb_token token)
{
  return m_mdb->UInt32ToRowCellColumn(m_mdbRow, token, value);
}

nsresult nsMsgHdr::GetUInt32Column(mdb_token token, PRUint32 *pvalue, PRUint32 defaultValue)
{
  return m_mdb->RowCellColumnToUInt32(GetMDBRow(), token, pvalue, defaultValue);
}

/**
 * Roughly speaking, get the next message-id (starts with a '<' ends with a
 *  '>').  Except, we also try to handle the case where your reference is of
 *  a prehistoric vintage that just stuck any old random junk in there.  Our
 *  old logic would (unintentionally?) just trim the whitespace off the front
 *  and hand you everything after that.  We change things at all because that
 *  same behaviour does not make sense if we have already seen a proper message
 *  id.  We keep the old behaviour at all because it would seem to have
 *  benefits.  (See jwz's non-zero stats: http://www.jwz.org/doc/threading.html) 
 * So, to re-state, if there is a valid message-id in there at all, we only
 *  return valid message-id's (sans bracketing '<' and '>').  If there isn't,
 *  our result (via "references") is a left-trimmed copy of the string.  If
 *  there is nothing in there, our result is an empty string.)  We do require
 *  that you pass allowNonDelimitedReferences what it demands, though.
 * For example: "<valid@stuff> this stuff is invalid" would net you
 *  "valid@stuff" and "this stuff is invalid" as results.  We now only would
 *  provide "valid-stuff" and an empty string (which you should ignore) as
 *  results.  However "this stuff is invalid" would return itself, allowing
 *  anything relying on that behaviour to keep working.
 * 
 * Note: We accept anything inside the '<' and '>'; technically, we should want
 *  at least a '@' in there (per rfc 2822).  But since we're going out of our
 *  way to support weird things...
 * 
 * @param startNextRef The position to start at; this should either be the start
 *     of your references string or our return value from a previous call.
 * @param reference You pass a nsCString by reference, we put the reference we
 *     find in it, if we find one.  It may be empty!  Beware!
 * @param allowNonDelimitedReferences Should we support the
 *     pre-reasonable-standards form of In-Reply-To where it could be any
 *     arbitrary string and our behaviour was just to take off leading
 *     whitespace.  It only makes sense to pass true for your first call to this
 *     function, as if you are around to make a second call, it means we found
 *     a properly formatted message-id and so we should only look for more
 *     properly formatted message-ids.
 * @returns The next starting position of this routine, which may be pointing at
 *     a nul '\0' character to indicate termination.
 */ 
const char *nsMsgHdr::GetNextReference(const char *startNextRef,
                                       nsCString &reference,
                                       PRBool acceptNonDelimitedReferences)
{
  const char *ptr = startNextRef;
  const char *whitespaceEndedAt = nsnull;
  const char *firstMessageIdChar = nsnull;

  // make the reference result string empty by default; we will set it to
  //  something valid if the time comes.
  reference.Truncate();

  // walk until we find a '<', but keep track of the first point we found that
  //  was not whitespace (as defined by previous versions of this code.)
  for (PRBool foundLessThan = PR_FALSE; !foundLessThan; ptr++)
  {
    switch (*ptr)
    {
      case '\0':
        // if we are at the end of the string, we found some non-whitespace, and
        //  the caller requested that we accept non-delimited whitespace,
        //  give them that as their reference.  (otherwise, leave it empty)
        if (acceptNonDelimitedReferences && whitespaceEndedAt)
          reference = whitespaceEndedAt;
        return ptr;
      case ' ':
      case '\r':
      case '\n':
      case '\t':
        // do nothing, make default case mean you didn't get whitespace
        break;
      case '<':
        firstMessageIdChar = ++ptr; // skip over the '<'
        foundLessThan = PR_TRUE; // (flag to stop)
        // intentional fallthrough so whitespaceEndedAt will definitely have
        //  a non-NULL value, just in case the message-id is not valid (no '>')
        //  and the old-school support is desired.
      default:
        if (!whitespaceEndedAt)
            whitespaceEndedAt = ptr;
        break;
    }
  }

  // keep going until we hit a '>' or hit the end of the string 
  for(; *ptr ; ptr++)
  {
    if (*ptr == '>')
    {
      // it's valid, update reference, making sure to stop before the '>'
      reference.Assign(firstMessageIdChar, ptr - firstMessageIdChar);
      // and return a start point just after the '>'
      return ++ptr;
    }
  }

  // we did not have a fully-formed, valid message-id, so consider falling back
  if (acceptNonDelimitedReferences && whitespaceEndedAt)
    reference = whitespaceEndedAt;
  return ptr;
}

PRBool nsMsgHdr::IsParentOf(nsIMsgDBHdr *possibleChild)
{
  PRUint16 referenceToCheck = 0;
  possibleChild->GetNumReferences(&referenceToCheck);
  nsCAutoString reference;

  nsCString messageId;
  GetMessageId(getter_Copies(messageId));

  while (referenceToCheck > 0)
  {
    possibleChild->GetStringReference(referenceToCheck - 1, reference);

    if (reference.Equals(messageId))
      return PR_TRUE;
    // if reference didn't match, check if this ref is for a non-existent
    // header. If it is, continue looking at ancestors.
    nsCOMPtr <nsIMsgDBHdr> refHdr;
    if (!m_mdb)
      break;
    (void) m_mdb->GetMsgHdrForMessageID(reference.get(), getter_AddRefs(refHdr));
    if (refHdr)
      break;
    referenceToCheck--;
  }
  return PR_FALSE;
}

PRBool nsMsgHdr::IsAncestorOf(nsIMsgDBHdr *possibleChild)
{
  const char *references;
  nsMsgHdr* curHdr = static_cast<nsMsgHdr*>(possibleChild);      // closed system, cast ok
  m_mdb->RowCellColumnToConstCharPtr(curHdr->GetMDBRow(), m_mdb->m_referencesColumnToken, &references);
  if (!references)
    return PR_FALSE;

  nsCString messageId;
  // should put < > around message id to make strstr strictly match
  GetMessageId(getter_Copies(messageId));
  return (strstr(references, messageId.get()) != nsnull);
}

NS_IMETHODIMP nsMsgHdr::GetIsRead(PRBool *isRead)
{
  NS_ENSURE_ARG_POINTER(isRead);
  if (!(m_initedValues & FLAGS_INITED))
    InitFlags();
  *isRead = m_flags & nsMsgMessageFlags::Read;
  return NS_OK;
}

NS_IMETHODIMP nsMsgHdr::GetIsFlagged(PRBool *isFlagged)
{
  NS_ENSURE_ARG_POINTER(isFlagged);
  if (!(m_initedValues & FLAGS_INITED))
    InitFlags();
  *isFlagged = m_flags & nsMsgMessageFlags::Marked;
  return NS_OK;
}

void nsMsgHdr::ReparentInThread(nsIMsgThread *thread)
{
  NS_WARNING("Borked message header, attempting to fix!");
  PRUint32 numChildren;
  thread->GetNumChildren(&numChildren);
  // bail out early for the singleton thread case.
  if (numChildren == 1)
  {
    SetThreadParent(nsMsgKey_None);
    return;
  }
  else
  {
    nsCOMPtr<nsIMsgDBHdr> curHdr;
    // loop through thread, looking for our proper parent.
    for (PRUint32 childIndex = 0; childIndex < numChildren; childIndex++)
    {
      thread->GetChildHdrAt(childIndex, getter_AddRefs(curHdr));
      // closed system, cast ok
      nsMsgHdr* curMsgHdr = static_cast<nsMsgHdr*>(curHdr.get());
      if (curHdr && curMsgHdr->IsParentOf(this))
      {
        nsMsgKey curHdrKey;
        curHdr->GetMessageKey(&curHdrKey);
        SetThreadParent(curHdrKey);
        return;
      }
    }
    // we didn't find it. So either the root header is our parent,
    // or we're the root.
    PRInt32 rootIndex;
    nsCOMPtr<nsIMsgDBHdr> rootHdr;
    thread->GetRootHdr(&rootIndex, getter_AddRefs(rootHdr));
    NS_ASSERTION(rootHdr, "thread has no root hdr - shouldn't happen");
    if (rootHdr)
    {
      nsMsgKey rootKey;
      rootHdr->GetMessageKey(&rootKey);
      // if we're the root, our thread parent is -1.
      SetThreadParent(rootKey == m_messageKey ? nsMsgKey_None : rootKey);
    }
  }
}

PRBool nsMsgHdr::IsAncestorKilled(PRUint32 ancestorsToCheck)
{
  if (!(m_initedValues & FLAGS_INITED))
    InitFlags();
  PRBool isKilled = m_flags & nsMsgMessageFlags::Ignored;

  if (!isKilled)
  {
    nsMsgKey threadParent;
    GetThreadParent(&threadParent);

    if (threadParent == m_messageKey)
    {
      // isKilled is false by virtue of the enclosing if statement
      NS_ERROR("Thread is parent of itself, please fix!");
      nsCOMPtr<nsIMsgThread> thread;
      (void) m_mdb->GetThreadContainingMsgHdr(this, getter_AddRefs(thread));
      ReparentInThread(thread);
      // Something's wrong, but the problem happened some time ago, so erroring
      // out now is probably not a good idea. Ergo, we'll pretend to be OK, show
      // the user the thread (err on the side of caution), and let the assertion
      // alert debuggers to a problem.
      return PR_FALSE;
    }
    if (threadParent != nsMsgKey_None)
    {
      nsCOMPtr<nsIMsgDBHdr> parentHdr;
      (void) m_mdb->GetMsgHdrForKey(threadParent, getter_AddRefs(parentHdr));

      if (parentHdr)
      {
        // More proofing against crashers. This crasher was derived from the
        // fact that something got borked, leaving is in hand with a circular
        // reference to borked headers inducing these loops. The defining
        // characteristic of these headers is that they don't actually seat
        // themselves in the thread properly.
        nsCOMPtr<nsIMsgThread> thread;
        (void) m_mdb->GetThreadContainingMsgHdr(this, getter_AddRefs(thread));
        if (thread)
        {
          nsCOMPtr<nsIMsgDBHdr> claimant;
          (void) thread->GetChild(threadParent, getter_AddRefs(claimant));
          if (!claimant)
          {
            // attempt to reparent, and say the thread isn't killed,
            // erring on the side of safety.
            ReparentInThread(thread);
            return PR_FALSE;
          }
        }

        if (!ancestorsToCheck)
        {
          // We think we have a parent, but we have no more ancestors to check
          NS_ASSERTION(PR_FALSE, "cycle in parent relationship, please fix!");
          return PR_FALSE;
        }
        // closed system, cast ok
        nsMsgHdr* parent = static_cast<nsMsgHdr*>(parentHdr.get());
        return parent->IsAncestorKilled(ancestorsToCheck - 1);
      }
    }
  }
  return isKilled;
}

NS_IMETHODIMP nsMsgHdr::GetIsKilled(PRBool *isKilled)
{
  NS_ENSURE_ARG_POINTER(isKilled);
  *isKilled = PR_FALSE;
  nsCOMPtr<nsIMsgThread> thread;
  (void) m_mdb->GetThreadContainingMsgHdr(this, getter_AddRefs(thread));
  // if we can't find the thread, let's at least check one level; maybe
  // the header hasn't been added to a thread yet.
  PRUint32 numChildren = 1;
  if (thread)
    thread->GetNumChildren(&numChildren);
  if (!numChildren)
    return NS_ERROR_FAILURE;
  // We can't have as many ancestors as there are messages in the thread,
  // so tell IsAncestorKilled to only check numChildren - 1 ancestors.
  *isKilled = IsAncestorKilled(numChildren - 1);
  return NS_OK;
}
