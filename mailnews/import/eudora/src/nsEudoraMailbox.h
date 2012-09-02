/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraMailbox_h__
#define nsEudoraMailbox_h__

#include "nscore.h"
#include "nsStringGlue.h"
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
  uint16_t    GetMozillaStatusFlags();
  uint32_t    GetMozillaStatus2Flags();

  int32_t      m_Offset;
  int32_t      m_Length;
#ifdef XP_MACOSX
  // Mac specific flags and fields for reading message summaries
  bool        HasEudoraLabel() { return false; }
  int16_t      GetLabelNumber() { return 0; }

#else
  // Windows specific flags and fields for reading message summaries
  bool        HasEudoraLabel() { return (m_Label > 0) && (m_Label <= 7); }
  int16_t      GetLabelNumber() { return HasEudoraLabel() ? m_Label : 0; }

  // MesSummary flags (used with m_Flags)
  static const uint16_t MSF_ALT_SIGNATURE    = 0x0001;
  static const uint16_t MSF_USE_SIGNATURE    = 0x0002;
  static const uint16_t MSF_WORD_WRAP      = 0x0004;
  static const uint16_t MSF_TABS_IN_BODY    = 0x0008;
  static const uint16_t MSF_KEEP_COPIES    = 0x0010;
  static const uint16_t MSF_TEXT_AS_DOC    = 0x0020;
  static const uint16_t MSF_RETURN_RECEIPT  = 0x0040;
  static const uint16_t MSF_QUOTED_PRINTABLE  = 0x0080;
  static const uint16_t MSF_ENCODE0      = 0x0100;
  static const uint16_t MSF_ENCODE1      = 0x0200;
  static const uint16_t MSF_SHOW_ALL_HEADERS  = 0x0400;
  static const uint16_t MSF_SUB_PART      = 0x0800;
  static const uint16_t MSF_MAPI_MESSAGE    = 0x1000;
  static const uint16_t MSF_XRICH        = 0x2000;
  static const uint16_t MSF_READ_RECEIPT    = 0x4000;
  static const uint16_t MSF_HAS_ATTACHMENT  = 0x8000;
  static const uint16_t MSF_COMP_MOD_FLAGS  = 0x8FFF;
  static const uint16_t MSF_BINHEX      = 0;
  static const uint16_t MSF_MIME        = MSF_ENCODE0;
  static const uint16_t MSF_UUENCODE      = MSF_ENCODE1;

  // MesSummary extended flags (used with m_FlagsEx)
  static const uint16_t MSFEX_AUTO_ATTACHED  = 0x0001;
  static const uint16_t MSFEX_HTML      = 0x0002;
  static const uint16_t MSFEX_MDN        = 0x0004;
  static const uint16_t MSFEX_MIME_ATTACHED  = 0x0008;
  static const uint16_t MSFEX_SEND_PLAIN    = 0x0010;
  static const uint16_t MSFEX_SEND_STYLED    = 0x0020;
  static const uint16_t MSFEX_FLOWED      = 0x0040;
  static const uint16_t MSFEX_INL_SIGNATURE  = 0x0080;
  static const uint16_t MSFEX_EMPTY_BODY    = 0x0100;

  // MesSummary states
  static const int8_t MS_UNREAD    = 0;
  static const int8_t MS_READ      = 1;
  static const int8_t MS_REPLIED    = 2;
  static const int8_t MS_FORWARDED  = 3;
  static const int8_t MS_REDIRECT    = 4;
  static const int8_t MS_UNSENDABLE  = 5;
  static const int8_t MS_SENDABLE    = 6;
  static const int8_t MS_QUEUED    = 7;
  static const int8_t MS_SENT      = 8;
  static const int8_t MS_UNSENT    = 9;
  static const int8_t MS_TIME_QUEUED  =10;
  static const int8_t MS_SPOOLED    =11;
  static const int8_t MS_RECOVERED  =12;

  // MesSummary priorites
  static const int16_t MSP_HIGHEST  = 1;
  static const int16_t MSP_HIGH    = 2;
  static const int16_t MSP_NORMAL    = 3;
  static const int16_t MSP_LOW    = 4;
  static const int16_t MSP_LOWEST    = 5;

  // MesSummary Mood
  static const int8_t MSM_MOOD_UNKNOWN  = 0;
  static const int8_t MSM_MOOD_CLEAN    = 1;
  static const int8_t MSM_MOOD_LOW    = 2;
  static const int8_t MSM_MOOD_MEDIUM    = 3;
  static const int8_t MSM_MOOD_HIGH    = 4;

  // Imap message flags :
  static const uint32_t IMFLAGS_SEEN    = 0x00000001;
  static const uint32_t IMFLAGS_ANSWERED  = 0x00000002;
  static const uint32_t IMFLAGS_FLAGGED  = 0x00000004;
  static const uint32_t IMFLAGS_DELETED  = 0x00000008;
  static const uint32_t IMFLAGS_DRAFT    = 0x00000010;
  static const uint32_t IMFLAGS_RECENT  = 0x00000020;

  uint16_t    m_Flags;
  uint16_t    m_FlagsEx;
  uint32_t    m_Hash;
  uint32_t    m_UniqueMessageId;
  uint32_t    m_PersonaHash;
  int16_t      m_State;
  uint8_t      m_ucJunkScore;
  bool        m_bManuallyJunked;
  int8_t      m_Priority;
  int8_t      m_nMood;
  int16_t      m_Label;
  int32_t      m_Seconds;
  int32_t      m_lArrivalSeconds;
  int32_t      m_TimeZoneMinutes;
  char      m_Date[28];
  char      m_From[64];
  char      m_Subject[64];

  // IMAP specific attributes
  uint32_t    m_Imflags;    // IMAP message flags - 4 bytes.
  uint16_t    m_MsgSize;
  int32_t      m_nUndownloadedAttachments;  // Number of undownloaded attachments.
#endif
};

class nsEudoraMailbox {
public:
  nsEudoraMailbox();
  virtual ~nsEudoraMailbox();

  // Things that must be overridden because they are platform specific.
    // retrieve the mail folder
  virtual bool      FindMailFolder(nsIFile **pFolder) { return false;}
    // get the list of mailboxes
  virtual nsresult  FindMailboxes(nsIFile *pRoot, nsISupportsArray **ppArray) { return NS_ERROR_FAILURE;}
    // get the toc file corresponding to this mailbox
  virtual nsresult  FindTOCFile(nsIFile *pMailFile, nsIFile **pTOCFile, bool *pDeleteToc) { return NS_ERROR_FAILURE;}
    // interpret the attachment line and return the attached file
  virtual nsresult  GetAttachmentInfo(const char *pFileName, nsIFile *pFile, nsCString& mimeType, nsCString& aAttachment) { return NS_ERROR_FAILURE;}

  // Non-platform specific common stuff
    // import a mailbox
  nsresult ImportMailbox(uint32_t *pBytes, bool *pAbort, const PRUnichar *pName,
                         nsIFile *pSrc, nsIMsgFolder *pDst, int32_t *pMsgCount);
 

  static int32_t    IsEudoraFromSeparator(const char *pData, int32_t maxLen, nsCString& defaultDate);
  static bool      IsEudoraTag(const char *pChar, int32_t maxLen, bool &insideEudoraTags, nsCString &bodyType, int32_t& tagLength);

protected:
  nsresult  CreateTempFile(nsIFile **ppFile);
  nsresult  DeleteFile(nsIFile *pFile);


private:
  nsresult ImportMailboxUsingTOC(uint32_t *pBytes, bool *pAbort,
                                 nsIInputStream *pInputStream,
                                 nsIFile *tocFile,
                                 nsIMsgFolder *pDstFolder, int32_t *pMsgCount);

   nsresult  ReadTOCEntry(nsIInputStream *pToc, EudoraTOCEntry& tocEntry);
   nsresult  ImportMessage(SimpleBufferTonyRCopiedOnce& headers, SimpleBufferTonyRCopiedOnce& body, nsCString& defaultDate, nsAutoCString& bodyType, nsIOutputStream *pDst, int32_t *pMsgCount);
   nsresult  ReadNextMessage(ReadFileState *pState, SimpleBufferTonyRCopiedOnce& copy, SimpleBufferTonyRCopiedOnce& header,
                                        SimpleBufferTonyRCopiedOnce& body, nsCString& defaultDate,
                                        nsCString &defBodyType, EudoraTOCEntry *pTocEntry);
  int32_t    FindStartLine(SimpleBufferTonyRCopiedOnce& data);
  int32_t    FindNextEndLine(SimpleBufferTonyRCopiedOnce& data);
  int32_t    IsEndHeaders(SimpleBufferTonyRCopiedOnce& data);
  nsresult  WriteFromSep(nsIOutputStream *pDst);
  nsresult  FillMailBuffer(ReadFileState *pState, SimpleBufferTonyRCopiedOnce& read);

  void    EmptyAttachments(void);
  nsresult  ExamineAttachment(SimpleBufferTonyRCopiedOnce& data);
  bool      AddAttachment(nsCString& fileName);

  static int32_t    AsciiToLong(const char *pChar, int32_t len);
  static int      IsWeekDayStr(const char *pStr);
  static int      IsMonthStr(const char *pStr);

protected:
  nsCOMPtr <nsIFile>    m_mailImportLocation;

private:
  int64_t    m_mailSize;
  uint32_t      m_fromLen;
  nsVoidArray    m_attachments;
};



#endif /* nsEudoraMailbox_h__ */

