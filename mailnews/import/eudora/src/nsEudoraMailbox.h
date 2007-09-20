/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

#ifndef nsEudoraMailbox_h__
#define nsEudoraMailbox_h__

#include "nscore.h"
#include "nsString.h"
#include "nsVoidArray.h"
#include "nsIFile.h"
#include "nsISupportsArray.h"
#include "nsEudoraCompose.h"

class nsIOutputStream;

/////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////

class EudoraTOCEntry {
public:
  PRUint16    GetMozillaStatusFlags();
  PRUint32    GetMozillaStatus2Flags();

  PRInt32      m_Offset;
  PRInt32      m_Length;
#ifdef XP_MACOSX
  // Mac specific flags and fields for reading message summaries
  PRBool      HasEudoraLabel() { return PR_FALSE; }
  PRInt16      GetLabelNumber() { return 0; }

#else
  // Windows specific flags and fields for reading message summaries
  PRBool      HasEudoraLabel() { return (m_Label > 0) && (m_Label <= 7); }
  PRInt16      GetLabelNumber() { return HasEudoraLabel() ? m_Label : 0; }

  // MesSummary flags (used with m_Flags)
  static const PRUint16 MSF_ALT_SIGNATURE    = 0x0001;
  static const PRUint16 MSF_USE_SIGNATURE    = 0x0002;
  static const PRUint16 MSF_WORD_WRAP      = 0x0004;
  static const PRUint16 MSF_TABS_IN_BODY    = 0x0008;
  static const PRUint16 MSF_KEEP_COPIES    = 0x0010;
  static const PRUint16 MSF_TEXT_AS_DOC    = 0x0020;
  static const PRUint16 MSF_RETURN_RECEIPT  = 0x0040;
  static const PRUint16 MSF_QUOTED_PRINTABLE  = 0x0080;
  static const PRUint16 MSF_ENCODE0      = 0x0100;
  static const PRUint16 MSF_ENCODE1      = 0x0200;
  static const PRUint16 MSF_SHOW_ALL_HEADERS  = 0x0400;
  static const PRUint16 MSF_SUB_PART      = 0x0800;
  static const PRUint16 MSF_MAPI_MESSAGE    = 0x1000;
  static const PRUint16 MSF_XRICH        = 0x2000;
  static const PRUint16 MSF_READ_RECEIPT    = 0x4000;
  static const PRUint16 MSF_HAS_ATTACHMENT  = 0x8000;
  static const PRUint16 MSF_COMP_MOD_FLAGS  = 0x8FFF;
  static const PRUint16 MSF_BINHEX      = 0;
  static const PRUint16 MSF_MIME        = MSF_ENCODE0;
  static const PRUint16 MSF_UUENCODE      = MSF_ENCODE1;

  // MesSummary extended flags (used with m_FlagsEx)
  static const PRUint16 MSFEX_AUTO_ATTACHED  = 0x0001;
  static const PRUint16 MSFEX_HTML      = 0x0002;
  static const PRUint16 MSFEX_MDN        = 0x0004;
  static const PRUint16 MSFEX_MIME_ATTACHED  = 0x0008;
  static const PRUint16 MSFEX_SEND_PLAIN    = 0x0010;
  static const PRUint16 MSFEX_SEND_STYLED    = 0x0020;
  static const PRUint16 MSFEX_FLOWED      = 0x0040;
  static const PRUint16 MSFEX_INL_SIGNATURE  = 0x0080;
  static const PRUint16 MSFEX_EMPTY_BODY    = 0x0100;

  // MesSummary states
  static const PRInt8 MS_UNREAD    = 0;
  static const PRInt8 MS_READ      = 1;
  static const PRInt8 MS_REPLIED    = 2;
  static const PRInt8 MS_FORWARDED  = 3;
  static const PRInt8 MS_REDIRECT    = 4;
  static const PRInt8 MS_UNSENDABLE  = 5;
  static const PRInt8 MS_SENDABLE    = 6;
  static const PRInt8 MS_QUEUED    = 7;
  static const PRInt8 MS_SENT      = 8;
  static const PRInt8 MS_UNSENT    = 9;
  static const PRInt8 MS_TIME_QUEUED  =10;
  static const PRInt8 MS_SPOOLED    =11;
  static const PRInt8 MS_RECOVERED  =12;

  // MesSummary priorites
  static const PRInt16 MSP_HIGHEST  = 1;
  static const PRInt16 MSP_HIGH    = 2;
  static const PRInt16 MSP_NORMAL    = 3;
  static const PRInt16 MSP_LOW    = 4;
  static const PRInt16 MSP_LOWEST    = 5;

  // MesSummary Mood
  static const PRInt8 MSM_MOOD_UNKNOWN  = 0;
  static const PRInt8 MSM_MOOD_CLEAN    = 1;
  static const PRInt8 MSM_MOOD_LOW    = 2;
  static const PRInt8 MSM_MOOD_MEDIUM    = 3;
  static const PRInt8 MSM_MOOD_HIGH    = 4;

  // Imap message flags :
  static const PRUint32 IMFLAGS_SEEN    = 0x00000001;
  static const PRUint32 IMFLAGS_ANSWERED  = 0x00000002;
  static const PRUint32 IMFLAGS_FLAGGED  = 0x00000004;
  static const PRUint32 IMFLAGS_DELETED  = 0x00000008;
  static const PRUint32 IMFLAGS_DRAFT    = 0x00000010;
  static const PRUint32 IMFLAGS_RECENT  = 0x00000020;

  PRUint16    m_Flags;
  PRUint16    m_FlagsEx;
  PRUint32    m_Hash;
  PRUint32    m_UniqueMessageId;
  PRUint32    m_PersonaHash;
  PRInt16      m_State;
  PRUint8      m_ucJunkScore;
  PRBool      m_bManuallyJunked;
  PRInt8      m_Priority;
  PRInt8      m_nMood;
  PRInt16      m_Label;
  PRInt32      m_Seconds;
  PRInt32      m_lArrivalSeconds;
  PRInt32      m_TimeZoneMinutes;
  char      m_Date[28];
  char      m_From[64];
  char      m_Subject[64];

  // IMAP specific attributes
  PRUint32    m_Imflags;    // IMAP message flags - 4 bytes.
  PRUint16    m_MsgSize;
  PRInt32      m_nUndownloadedAttachments;  // Number of undownloaded attachments.
#endif
};

class nsEudoraMailbox {
public:
  nsEudoraMailbox();
  virtual ~nsEudoraMailbox();

  // Things that must be overridden because they are platform specific.
    // retrieve the mail folder
  virtual PRBool    FindMailFolder( nsIFile **pFolder) { return( PR_FALSE);}
    // get the list of mailboxes
  virtual nsresult  FindMailboxes( nsIFile *pRoot, nsISupportsArray **ppArray) { return( NS_ERROR_FAILURE);}
    // get the toc file corresponding to this mailbox
  virtual nsresult  FindTOCFile( nsIFile *pMailFile, nsIFile **pTOCFile, PRBool *pDeleteToc) { return( NS_ERROR_FAILURE);}
    // interpret the attachment line and return the attached file
  virtual nsresult  GetAttachmentInfo( const char *pFileName, nsIFile *pFile, nsCString& mimeType, nsCString& aAttachment) { return( NS_ERROR_FAILURE);}

  // Non-platform specific common stuff
    // import a mailbox
  nsresult ImportMailbox( PRUint32 *pBytes, PRBool *pAbort, const PRUnichar *pName, nsIFile *pSrc, nsIFile *pDst, PRInt32 *pMsgCount);

  static PRInt32    IsEudoraFromSeparator( const char *pData, PRInt32 maxLen, nsCString& defaultDate);
  static PRBool    IsEudoraTag( const char *pChar, PRInt32 maxLen, PRBool &insideEudoraTags, nsCString &bodyType, PRInt32& tagLength);

protected:
  nsresult  CreateTempFile( nsIFile **ppFile);
  nsresult  DeleteFile( nsIFile *pFile);


private:
   nsresult  ImportMailboxUsingTOC( PRUint32 *pBytes, PRBool *pAbort, nsIInputStream *pInputStream, nsIFile *tocFile, nsIOutputStream *pDst, PRInt32 *pMsgCount);
   nsresult  ReadTOCEntry(nsIInputStream *pToc, EudoraTOCEntry& tocEntry);
   nsresult  ImportMessage(SimpleBufferTonyRCopiedOnce& headers, SimpleBufferTonyRCopiedOnce& body, nsCString& defaultDate, nsCAutoString& bodyType, nsIOutputStream *pDst, PRInt32 *pMsgCount);
   nsresult  ReadNextMessage( ReadFileState *pState, SimpleBufferTonyRCopiedOnce& copy, SimpleBufferTonyRCopiedOnce& header,
                                        SimpleBufferTonyRCopiedOnce& body, nsCString& defaultDate,
                                        nsCString &defBodyType, EudoraTOCEntry *pTocEntry);
  PRInt32    FindStartLine( SimpleBufferTonyRCopiedOnce& data);
  PRInt32    FindNextEndLine( SimpleBufferTonyRCopiedOnce& data);
  PRInt32    IsEndHeaders( SimpleBufferTonyRCopiedOnce& data);
  nsresult  WriteFromSep( nsIOutputStream *pDst);
  nsresult  FillMailBuffer( ReadFileState *pState, SimpleBufferTonyRCopiedOnce& read);

  void    EmptyAttachments( void);
  nsresult  ExamineAttachment( SimpleBufferTonyRCopiedOnce& data);
  PRBool    AddAttachment( nsCString& fileName);

  static PRInt32    AsciiToLong( const char *pChar, PRInt32 len);
  static int      IsWeekDayStr( const char *pStr);
  static int      IsMonthStr( const char *pStr);

protected:
  nsCOMPtr <nsILocalFile>    m_mailImportLocation;

private:
  PRInt64    m_mailSize;
  PRInt32      m_fromLen;
  nsVoidArray    m_attachments;
};



#endif /* nsEudoraMailbox_h__ */

