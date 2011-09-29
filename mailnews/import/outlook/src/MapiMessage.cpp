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

#ifndef INITGUID
#define INITGUID
#endif

#ifndef USES_IID_IMessage
#define USES_IID_IMessage
#endif

#include "nscore.h"
#include <time.h>
#include "nsString.h"
#include "nsDirectoryServiceDefs.h"
#include "nsMsgUtils.h"
#include "nsMimeTypes.h"

#include "nsMsgCompCID.h"
#include "nsIMutableArray.h"
#include "MapiDbgLog.h"
#include "MapiApi.h"

#include "MapiMimeTypes.h"

#include <algorithm>
#include "nsMsgI18N.h"
#include "nsICharsetConverterManager.h"

#include "nsNetUtil.h"
#include "MapiMessage.h"

#include "nsOutlookMail.h"

// needed for the call the OpenStreamOnFile
extern LPMAPIALLOCATEBUFFER gpMapiAllocateBuffer;
extern LPMAPIFREEBUFFER gpMapiFreeBuffer;

// Sample From line: From - 1 Jan 1965 00:00:00

typedef const char * PC_S8;

static const char * kWhitespace = "\b\t\r\n ";
static const char * sFromLine = "From - ";
static const char * sFromDate = "Mon Jan 1 00:00:00 1965";
static const char * sDaysOfWeek[7] = {
  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
};

static const char *sMonths[12] = {
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
};

CMapiMessage::CMapiMessage( LPMESSAGE lpMsg)
  : m_lpMsg(lpMsg), m_pIOService(0), m_dldStateHeadersOnly(false), m_msgFlags(0)
{
  nsresult rv;
  NS_WITH_PROXIED_SERVICE(nsIIOService, service, NS_IOSERVICE_CONTRACTID,
                          NS_PROXY_TO_MAIN_THREAD, &rv);
  if (NS_FAILED(rv))
    return;
  NS_IF_ADDREF(m_pIOService = service);

  FetchHeaders();
  if (ValidState()) {
    BuildFromLine();
    FetchFlags();
    GetDownloadState();
    if (FullMessageDownloaded()) {
      FetchBody();
      ProcessAttachments();
    }
  }
}

CMapiMessage::~CMapiMessage()
{
  ClearAttachments();
  if (m_lpMsg)
    m_lpMsg->Release();
  NS_IF_RELEASE(m_pIOService);
}

void CMapiMessage::FormatDateTime(SYSTEMTIME& tm, nsCString& s, bool includeTZ)
{
  long offset = _timezone;
  s += sDaysOfWeek[tm.wDayOfWeek];
  s += ", ";
  s.AppendInt((PRInt32) tm.wDay);
  s += " ";
  s += sMonths[tm.wMonth - 1];
  s += " ";
  s.AppendInt((PRInt32) tm.wYear);
  s += " ";
  int val = tm.wHour;
  if (val < 10)
    s += "0";
  s.AppendInt((PRInt32) val);
  s += ":";
  val = tm.wMinute;
  if (val < 10)
    s += "0";
  s.AppendInt((PRInt32) val);
  s += ":";
  val = tm.wSecond;
  if (val < 10)
    s += "0";
  s.AppendInt((PRInt32) val);
  if (includeTZ) {
    s += " ";
    if (offset < 0) {
      offset *= -1;
      s += "+";
    }
    else
      s += "-";
    offset /= 60;
    val = (int) (offset / 60);
    if (val < 10)
      s += "0";
    s.AppendInt((PRInt32) val);
    val = (int) (offset % 60);
    if (val < 10)
      s += "0";
    s.AppendInt((PRInt32) val);
  }
}

bool CMapiMessage::EnsureHeader(CMapiMessageHeaders::SpecialHeader special,
                                ULONG mapiTag)
{
  if (m_headers.Value(special))
    return true;

  LPSPropValue pVal = CMapiApi::GetMapiProperty(m_lpMsg, mapiTag);
  bool success = false;
  if (pVal) {
    if (PROP_TYPE(pVal->ulPropTag) == PT_STRING8) {
      if (pVal->Value.lpszA && strlen(pVal->Value.lpszA)) {
        m_headers.SetValue(special, pVal->Value.lpszA);
        success = true;
      }
    }
    else if (PROP_TYPE(pVal->ulPropTag) == PT_UNICODE) {
      if (pVal->Value.lpszW && wcslen(pVal->Value.lpszW)) {
        m_headers.SetValue(special, NS_ConvertUTF16toUTF8(pVal->Value.lpszW).get());
        success = true;
      }
    }
    CMapiApi::MAPIFreeBuffer(pVal);
  }

  return success;
}

bool CMapiMessage::EnsureDate()
{
  if (m_headers.Value(CMapiMessageHeaders::hdrDate))
    return true;

  LPSPropValue pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_MESSAGE_DELIVERY_TIME);
  if (!pVal)
    pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_CREATION_TIME);
  if (pVal) {
    SYSTEMTIME st;
    // the following call returns UTC
    ::FileTimeToSystemTime(&(pVal->Value.ft), &st);
    CMapiApi::MAPIFreeBuffer(pVal);
    // FormatDateTime would append the local time zone, so don't use it.
    // Instead, we just append +0000 for GMT/UTC here.
    nsCString str;
    FormatDateTime(st, str, false);
    str += " +0000";
    m_headers.SetValue(CMapiMessageHeaders::hdrDate, str.get());
    return true;
  }

  return false;
}

void CMapiMessage::BuildFromLine( void)
{
  m_fromLine = sFromLine;
  LPSPropValue pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_CREATION_TIME);
  if (pVal) {
    SYSTEMTIME st;
    ::FileTimeToSystemTime(&(pVal->Value.ft), &st);
    CMapiApi::MAPIFreeBuffer(pVal);
    FormatDateTime(st, m_fromLine, FALSE);
  }
  else
    m_fromLine += sFromDate;

  m_fromLine += "\x0D\x0A";
}

#ifndef dispidHeaderItem
#define dispidHeaderItem 0x8578
#endif
DEFINE_OLEGUID(PSETID_Common, MAKELONG(0x2000+(8),0x0006),0,0);

void CMapiMessage::GetDownloadState()
{
  // See http://support.microsoft.com/kb/912239
  HRESULT         hRes = S_OK;
  ULONG           ulVal = 0;
  LPSPropValue    lpPropVal = NULL;
  LPSPropTagArray lpNamedPropTag = NULL;
  MAPINAMEID      NamedID = {0};
  LPMAPINAMEID    lpNamedID = NULL;

  NamedID.lpguid = (LPGUID) &PSETID_Common;
  NamedID.ulKind = MNID_ID;
  NamedID.Kind.lID = dispidHeaderItem;
  lpNamedID = &NamedID;

  hRes = m_lpMsg->GetIDsFromNames(1, &lpNamedID, NULL, &lpNamedPropTag);

  if (lpNamedPropTag && 1 == lpNamedPropTag->cValues)
  {
    lpNamedPropTag->aulPropTag[0] = CHANGE_PROP_TYPE(lpNamedPropTag->aulPropTag[0], PT_LONG);

    //Get the value of the property.
    hRes = m_lpMsg->GetProps(lpNamedPropTag, 0, &ulVal, &lpPropVal);
    if (lpPropVal && 1 == ulVal && PT_LONG == PROP_TYPE(lpPropVal->ulPropTag) &&
        lpPropVal->Value.ul)
      m_dldStateHeadersOnly = true;
  }

  CMapiApi::MAPIFreeBuffer(lpPropVal);
  CMapiApi::MAPIFreeBuffer(lpNamedPropTag);
}

// Headers - fetch will get PR_TRANSPORT_MESSAGE_HEADERS
// or if they do not exist will build a header from
//  PR_DISPLAY_TO, _CC, _BCC
//  PR_SUBJECT
//  PR_MESSAGE_RECIPIENTS
// and PR_CREATION_TIME if needed?
bool CMapiMessage::FetchHeaders( void)
{
  ULONG tag = PR_TRANSPORT_MESSAGE_HEADERS_A;
  LPSPropValue pVal = CMapiApi::GetMapiProperty(m_lpMsg, tag);
  if (!pVal)
    pVal = CMapiApi::GetMapiProperty(m_lpMsg, tag = PR_TRANSPORT_MESSAGE_HEADERS_W);
  if (pVal) {
    if (CMapiApi::IsLargeProperty(pVal)) {
      nsCString headers;
      CMapiApi::GetLargeStringProperty(m_lpMsg, tag, headers);
      m_headers.Assign(headers.get());
    }
    else if ((PROP_TYPE(pVal->ulPropTag) == PT_STRING8) &&
             (pVal->Value.lpszA) && (*(pVal->Value.lpszA)))
      m_headers.Assign(pVal->Value.lpszA);
    else if ((PROP_TYPE(pVal->ulPropTag) == PT_UNICODE) &&
             (pVal->Value.lpszW) && (*(pVal->Value.lpszW))) {
      nsCString headers;
      LossyCopyUTF16toASCII(pVal->Value.lpszW, headers);
      m_headers.Assign(headers.get());
    }

    CMapiApi::MAPIFreeBuffer(pVal);
  }

  EnsureDate();
  if (!EnsureHeader(CMapiMessageHeaders::hdrFrom, PR_SENDER_NAME_W))
    EnsureHeader(CMapiMessageHeaders::hdrFrom, PR_SENDER_EMAIL_ADDRESS_W);
  EnsureHeader(CMapiMessageHeaders::hdrSubject, PR_SUBJECT_W);
  EnsureHeader(CMapiMessageHeaders::hdrTo, PR_DISPLAY_TO_W);
  EnsureHeader(CMapiMessageHeaders::hdrCc, PR_DISPLAY_CC_W);
  EnsureHeader(CMapiMessageHeaders::hdrBcc, PR_DISPLAY_BCC_W);

  ProcessContentType();

  return( !m_headers.IsEmpty());
}

bool CMapiMessage::IsMultipart( void) const
{
  nsCString left;
  m_mimeContentType.Left( left, 10);
  if (left.LowerCaseEqualsLiteral("multipart/"))
    return true;
  return false;
}

// Mime-Version: 1.0
// Content-Type: text/plain; charset="US-ASCII"
// Content-Type: multipart/mixed; boundary="=====================_874475278==_"

void CMapiMessage::ProcessContentType()
{
  m_mimeContentType.Truncate();
  m_mimeBoundary.Truncate();
  m_mimeCharset.Truncate();

  const char* contentType = m_headers.Value(CMapiMessageHeaders::hdrContentType);
  if (!contentType)
    return;

  const char *begin = contentType, *end;
  nsCString tStr;

  // Note: this isn't a complete parser, the content type
  // we extract could have rfc822 comments in it
  while (*begin && IsSpace(*begin))
    begin++;
  if (!(*begin))
    return;
  end = begin;
  while (*end && (*end != ';'))
    end++;
  m_mimeContentType.Assign(begin, end-begin);
  if (!(*end))
    return;
  // look for "boundary="
  begin = end + 1;
  bool haveB;
  bool haveC;
  while (*begin) {
    haveB = false;
    haveC = false;
    while (*begin && IsSpace(*begin))
      begin++;
    if (!(*begin))
      return;
    end = begin;
    while (*end && (*end != '='))
      end++;
    if (end - begin) {
      tStr.Assign(begin, end-begin);
      if (tStr.LowerCaseEqualsLiteral("boundary"))
        haveB = true;
      else if (tStr.LowerCaseEqualsLiteral("charset"))
        haveC = true;
    }
    if (!(*end))
      return;
    begin = end+1;
    while (*begin && IsSpace(*begin))
      begin++;
    if (*begin == '"') {
      begin++;
      bool slash = false;
      tStr.Truncate();
      while (*begin) {
        if (slash) {
          slash = false;
          tStr.Append(*begin);
        }
        else if (*begin == '"')
          break;
        else if (*begin != '\\')
          tStr.Append(*begin);
        else
          slash = true;
        begin++;
      }
      if (haveB) {
        m_mimeBoundary = tStr;
        haveB = false;
      }
      if (haveC) {
        m_mimeCharset = tStr;
        haveC = false;
      }
      if (!(*begin))
        return;
      begin++;
    }
    tStr.Truncate();
    while (*begin && (*begin != ';')) {
      tStr.Append(*(begin++));
    }
    if (haveB) {
      tStr.Trim(kWhitespace);
      m_mimeBoundary = tStr;
    }
    if (haveC) {
      tStr.Trim(kWhitespace);
      m_mimeCharset = tStr;
    }
    if (*begin)
      begin++;
  }
}

const char* CpToCharset(unsigned int cp)
{
  struct CODEPAGE_TO_CHARSET {
    unsigned long cp;
    const char* charset;
  };

  // This table is based on http://msdn.microsoft.com/en-us/library/dd317756(v=VS.85).aspx#1;
  // Please extend as appropriate. The codepage values are sorted ascending.
  static const CODEPAGE_TO_CHARSET cptocharset[] =
    {
      {37, "IBM037"}, // IBM EBCDIC US-Canada
      {437, "IBM437"}, //OEM United States
      {500, "IBM500"}, //IBM EBCDIC International
      {708, "ASMO-708"}, //Arabic (ASMO 708)
      //709  Arabic (ASMO-449+, BCON V4)
      //710  Arabic - Transparent Arabic
      {720, "DOS-720"}, //Arabic (Transparent ASMO); Arabic (DOS)
      {737, "ibm737"}, // OEM Greek (formerly 437G); Greek (DOS)
      {775, "ibm775"}, // OEM Baltic; Baltic (DOS)
      {850, "ibm850"}, // OEM Multilingual Latin 1; Western European (DOS)
      {852, "ibm852"}, // OEM Latin 2; Central European (DOS)
      {855, "IBM855"}, // OEM Cyrillic (primarily Russian)
      {857, "ibm857"}, // OEM Turkish; Turkish (DOS)
      {858, "IBM00858"}, // OEM Multilingual Latin 1 + Euro symbol
      {860, "IBM860"}, // OEM Portuguese; Portuguese (DOS)
      {861, "ibm861"}, // OEM Icelandic; Icelandic (DOS)
      {862, "DOS-862"}, // OEM Hebrew; Hebrew (DOS)
      {863, "IBM863"}, // OEM French Canadian; French Canadian (DOS)
      {864, "IBM864"}, // OEM Arabic; Arabic (864)
      {865, "IBM865"}, // OEM Nordic; Nordic (DOS)
      {866, "cp866"}, // OEM Russian; Cyrillic (DOS)
      {869, "ibm869"}, // OEM Modern Greek; Greek, Modern (DOS)
      {870, "IBM870"}, // IBM EBCDIC Multilingual/ROECE (Latin 2); IBM EBCDIC Multilingual Latin 2
      {874, "windows-874"}, // ANSI/OEM Thai (same as 28605, ISO 8859-15); Thai (Windows)
      {875, "cp875"}, // IBM EBCDIC Greek Modern
      {932, "shift_jis"}, // ANSI/OEM Japanese; Japanese (Shift-JIS)
      {936, "gb2312"}, // ANSI/OEM Simplified Chinese (PRC, Singapore); Chinese Simplified (GB2312)
      {949, "ks_c_5601-1987"}, // ANSI/OEM Korean (Unified Hangul Code)
      {950, "big5"}, // ANSI/OEM Traditional Chinese (Taiwan; Hong Kong SAR, PRC); Chinese Traditional (Big5)
      {1026, "IBM1026"}, // IBM EBCDIC Turkish (Latin 5)
      {1047, "IBM01047"}, // IBM EBCDIC Latin 1/Open System
      {1140, "IBM01140"}, // IBM EBCDIC US-Canada (037 + Euro symbol); IBM EBCDIC (US-Canada-Euro)
      {1141, "IBM01141"}, // IBM EBCDIC Germany (20273 + Euro symbol); IBM EBCDIC (Germany-Euro)
      {1142, "IBM01142"}, // IBM EBCDIC Denmark-Norway (20277 + Euro symbol); IBM EBCDIC (Denmark-Norway-Euro)
      {1143, "IBM01143"}, // IBM EBCDIC Finland-Sweden (20278 + Euro symbol); IBM EBCDIC (Finland-Sweden-Euro)
      {1144, "IBM01144"}, // IBM EBCDIC Italy (20280 + Euro symbol); IBM EBCDIC (Italy-Euro)
      {1145, "IBM01145"}, // IBM EBCDIC Latin America-Spain (20284 + Euro symbol); IBM EBCDIC (Spain-Euro)
      {1146, "IBM01146"}, // IBM EBCDIC United Kingdom (20285 + Euro symbol); IBM EBCDIC (UK-Euro)
      {1147, "IBM01147"}, // IBM EBCDIC France (20297 + Euro symbol); IBM EBCDIC (France-Euro)
      {1148, "IBM01148"}, // IBM EBCDIC International (500 + Euro symbol); IBM EBCDIC (International-Euro)
      {1149, "IBM01149"}, // IBM EBCDIC Icelandic (20871 + Euro symbol); IBM EBCDIC (Icelandic-Euro)
      {1200, "utf-16"}, // Unicode UTF-16, little endian byte order (BMP of ISO 10646); available only to managed applications
      {1201, "unicodeFFFE"}, // Unicode UTF-16, big endian byte order; available only to managed applications
      {1250, "windows-1250"}, // ANSI Central European; Central European (Windows)
      {1251, "windows-1251"}, // ANSI Cyrillic; Cyrillic (Windows)
      {1252, "windows-1252"}, // ANSI Latin 1; Western European (Windows)
      {1253, "windows-1253"}, // ANSI Greek; Greek (Windows)
      {1254, "windows-1254"}, // ANSI Turkish; Turkish (Windows)
      {1255, "windows-1255"}, // ANSI Hebrew; Hebrew (Windows)
      {1256, "windows-1256"}, // ANSI Arabic; Arabic (Windows)
      {1257, "windows-1257"}, // ANSI Baltic; Baltic (Windows)
      {1258, "windows-1258"}, // ANSI/OEM Vietnamese; Vietnamese (Windows)
      {1361, "Johab"}, // Korean (Johab)
      {10000, "macintosh"}, // MAC Roman; Western European (Mac)
      {10001, "x-mac-japanese"}, // Japanese (Mac)
      {10002, "x-mac-chinesetrad"}, // MAC Traditional Chinese (Big5); Chinese Traditional (Mac)
      {10003, "x-mac-korean"}, // Korean (Mac)
      {10004, "x-mac-arabic"}, // Arabic (Mac)
      {10005, "x-mac-hebrew"}, // Hebrew (Mac)
      {10006, "x-mac-greek"}, // Greek (Mac)
      {10007, "x-mac-cyrillic"}, // Cyrillic (Mac)
      {10008, "x-mac-chinesesimp"}, // MAC Simplified Chinese (GB 2312); Chinese Simplified (Mac)
      {10010, "x-mac-romanian"}, // Romanian (Mac)
      {10017, "x-mac-ukrainian"}, // Ukrainian (Mac)
      {10021, "x-mac-thai"}, // Thai (Mac)
      {10029, "x-mac-ce"}, // MAC Latin 2; Central European (Mac)
      {10079, "x-mac-icelandic"}, // Icelandic (Mac)
      {10081, "x-mac-turkish"}, // Turkish (Mac)
      {10082, "x-mac-croatian"}, // Croatian (Mac)
      // Unicode UTF-32, little endian byte order; available only to managed applications 
      // impossible in 8-bit mail
      {12000, "utf-32"},
       // Unicode UTF-32, big endian byte order; available only to managed applications
       // impossible in 8-bit mail
      {12001, "utf-32BE"},
      {20000, "x-Chinese_CNS"}, // CNS Taiwan; Chinese Traditional (CNS)
      {20001, "x-cp20001"}, // TCA Taiwan
      {20002, "x_Chinese-Eten"}, // Eten Taiwan; Chinese Traditional (Eten)
      {20003, "x-cp20003"}, // IBM5550 Taiwan
      {20004, "x-cp20004"}, // TeleText Taiwan
      {20005, "x-cp20005"}, // Wang Taiwan
      {20105, "x-IA5"}, // IA5 (IRV International Alphabet No. 5, 7-bit); Western European (IA5)
      {20106, "x-IA5-German"}, // IA5 German (7-bit)
      {20107, "x-IA5-Swedish"}, // IA5 Swedish (7-bit)
      {20108, "x-IA5-Norwegian"}, // IA5 Norwegian (7-bit)
      {20127, "us-ascii"}, // US-ASCII (7-bit)
      {20261, "x-cp20261"}, // T.61
      {20269, "x-cp20269"}, // ISO 6937 Non-Spacing Accent
      {20273, "IBM273"}, // IBM EBCDIC Germany
      {20277, "IBM277"}, // IBM EBCDIC Denmark-Norway
      {20278, "IBM278"}, // IBM EBCDIC Finland-Sweden
      {20280, "IBM280"}, // IBM EBCDIC Italy
      {20284, "IBM284"}, // IBM EBCDIC Latin America-Spain
      {20285, "IBM285"}, // IBM EBCDIC United Kingdom
      {20290, "IBM290"}, // IBM EBCDIC Japanese Katakana Extended
      {20297, "IBM297"}, // IBM EBCDIC France
      {20420, "IBM420"}, // IBM EBCDIC Arabic
      {20423, "IBM423"}, // IBM EBCDIC Greek
      {20424, "IBM424"}, // IBM EBCDIC Hebrew
      {20833, "x-EBCDIC-KoreanExtended"}, // IBM EBCDIC Korean Extended
      {20838, "IBM-Thai"}, // IBM EBCDIC Thai
      {20866, "koi8-r"}, // Russian (KOI8-R); Cyrillic (KOI8-R)
      {20871, "IBM871"}, // IBM EBCDIC Icelandic
      {20880, "IBM880"}, // IBM EBCDIC Cyrillic Russian
      {20905, "IBM905"}, // IBM EBCDIC Turkish
      {20924, "IBM00924"}, // IBM EBCDIC Latin 1/Open System (1047 + Euro symbol)
      {20932, "EUC-JP"}, // Japanese (JIS 0208-1990 and 0121-1990)
      {20936, "x-cp20936"}, // Simplified Chinese (GB2312); Chinese Simplified (GB2312-80)
      {20949, "x-cp20949"}, // Korean Wansung
      {21025, "cp1025"}, // IBM EBCDIC Cyrillic Serbian-Bulgarian
      //21027  (deprecated)
      {21866, "koi8-u"}, // Ukrainian (KOI8-U); Cyrillic (KOI8-U)
      {28591, "iso-8859-1"}, // ISO 8859-1 Latin 1; Western European (ISO)
      {28592, "iso-8859-2"}, // ISO 8859-2 Central European; Central European (ISO)
      {28593, "iso-8859-3"}, // ISO 8859-3 Latin 3
      {28594, "iso-8859-4"}, // ISO 8859-4 Baltic
      {28595, "iso-8859-5"}, // ISO 8859-5 Cyrillic
      {28596, "iso-8859-6"}, // ISO 8859-6 Arabic
      {28597, "iso-8859-7"}, // ISO 8859-7 Greek
      {28598, "iso-8859-8"}, // ISO 8859-8 Hebrew; Hebrew (ISO-Visual)
      {28599, "iso-8859-9"}, // ISO 8859-9 Turkish
      {28603, "iso-8859-13"}, // ISO 8859-13 Estonian
      {28605, "iso-8859-15"}, // ISO 8859-15 Latin 9
      {29001, "x-Europa"}, // Europa 3
      {38598, "iso-8859-8-i"}, // ISO 8859-8 Hebrew; Hebrew (ISO-Logical)
      {50220, "iso-2022-jp"}, // ISO 2022 Japanese with no halfwidth Katakana; Japanese (JIS)
      {50221, "csISO2022JP"}, // ISO 2022 Japanese with halfwidth Katakana; Japanese (JIS-Allow 1 byte Kana)
      {50222, "iso-2022-jp"}, // ISO 2022 Japanese JIS X 0201-1989; Japanese (JIS-Allow 1 byte Kana - SO/SI)
      {50225, "iso-2022-kr"}, // ISO 2022 Korean
      {50227, "x-cp50227"}, // ISO 2022 Simplified Chinese; Chinese Simplified (ISO 2022)
      //50229  ISO 2022 Traditional Chinese
      //50930  EBCDIC Japanese (Katakana) Extended
      //50931  EBCDIC US-Canada and Japanese
      //50933  EBCDIC Korean Extended and Korean
      //50935  EBCDIC Simplified Chinese Extended and Simplified Chinese
      //50936  EBCDIC Simplified Chinese
      //50937  EBCDIC US-Canada and Traditional Chinese
      //50939  EBCDIC Japanese (Latin) Extended and Japanese
      {51932, "euc-jp"}, // EUC Japanese
      {51936, "EUC-CN"}, // EUC Simplified Chinese; Chinese Simplified (EUC)
      {51949, "euc-kr"}, // EUC Korean
      //51950  EUC Traditional Chinese
      {52936, "hz-gb-2312"}, // HZ-GB2312 Simplified Chinese; Chinese Simplified (HZ)
      {54936, "GB18030"}, // Windows XP and later: GB18030 Simplified Chinese (4 byte); Chinese Simplified (GB18030)
      {57002, "x-iscii-de"}, // ISCII Devanagari
      {57003, "x-iscii-be"}, // ISCII Bengali
      {57004, "x-iscii-ta"}, // ISCII Tamil
      {57005, "x-iscii-te"}, // ISCII Telugu
      {57006, "x-iscii-as"}, // ISCII Assamese
      {57007, "x-iscii-or"}, // ISCII Oriya
      {57008, "x-iscii-ka"}, // ISCII Kannada
      {57009, "x-iscii-ma"}, // ISCII Malayalam
      {57010, "x-iscii-gu"}, // ISCII Gujarati
      {57011, "x-iscii-pa"}, // ISCII Punjabi
      {65000, "utf-7"}, // Unicode (UTF-7)
      {65001, "utf-8"}, // Unicode (UTF-8)
    };

  // Binary search
  int begin = 0, end = sizeof(cptocharset)/sizeof(cptocharset[0])-1;
  while (begin <= end) {
    int mid = (begin+end)/2;
    unsigned int mid_cp = cptocharset[mid].cp;
    if (cp == mid_cp)
      return cptocharset[mid].charset;
    if (cp < mid_cp)
      end = mid - 1;
    else // cp > cptocharset[mid].cp
      begin = mid + 1;
  }
  return 0; // not found
}

// We don't use nsMsgI18Ncheck_data_in_charset_range because it returns true
// even if there's no such charset:
// 1. result initialized by PR_TRUE and returned if, eg, GetUnicodeEncoderRaw fail
// 2. it uses GetUnicodeEncoderRaw(), not GetUnicodeEncoder() (to normalize the
//    charset string) (see nsMsgI18N.cpp)
// This function returns true only if the unicode (utf-16) text can be
// losslessly represented in specified charset
bool CMapiMessage::CheckBodyInCharsetRange(const char* charset)
{
  if (m_body.IsEmpty())
    return true;
  if (!_stricmp(charset, "utf-8"))
    return true;
  if (!_stricmp(charset, "utf-7"))
    return true;

  nsresult rv;
  static nsCOMPtr<nsICharsetConverterManager> ccm =
    do_GetService(NS_CHARSETCONVERTERMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, false);
  nsCOMPtr<nsIUnicodeEncoder> encoder;

  // get an unicode converter
  rv = ccm->GetUnicodeEncoder(charset, getter_AddRefs(encoder));
  NS_ENSURE_SUCCESS(rv, false);
  rv = encoder->SetOutputErrorBehavior(nsIUnicodeEncoder::kOnError_Signal, nsnull, 0);
  NS_ENSURE_SUCCESS(rv, false);

  const wchar_t *txt = m_body.get();
  PRInt32 txtLen = m_body.Length();
  const wchar_t *currentSrcPtr = txt;
  int srcLength;
  int dstLength;
  char localbuf[512];
  int consumedLen = 0;

  // convert
  while (consumedLen < txtLen) {
    srcLength = txtLen - consumedLen;  
    dstLength = sizeof(localbuf)/sizeof(localbuf[0]);
    rv = encoder->Convert(currentSrcPtr, &srcLength, localbuf, &dstLength);
    if (rv == NS_ERROR_UENC_NOMAPPING)
      return false;
    if (NS_FAILED(rv) || dstLength == 0)
      break;

    currentSrcPtr += srcLength;
    consumedLen = currentSrcPtr - txt; // src length used so far
  }
  return true;
}

bool CaseInsensitiveComp (wchar_t elem1, wchar_t elem2 )
{
  return _wcsnicmp(&elem1, &elem2, 1) == 0;
}

void ExtractMetaCharset( const wchar_t* body, int bodySz, /*out*/nsCString& charset)
{
  charset.Truncate();
  const wchar_t* body_end = body+bodySz;
  const wchar_t str_eohd[] = L"/head";
  const wchar_t *str_eohd_end = str_eohd+sizeof(str_eohd)/sizeof(str_eohd[0])-1;
  const wchar_t* eohd_pos = std::search(body, body_end, str_eohd, str_eohd_end,
                                        CaseInsensitiveComp);
  if (eohd_pos == body_end) // No header!
    return;
  const wchar_t str_chset[] = L"charset=";
  const wchar_t *str_chset_end =
    str_chset + sizeof(str_chset)/sizeof(str_chset[0])-1;
  const wchar_t* chset_pos = std::search(body, eohd_pos, str_chset,
                                         str_chset_end, CaseInsensitiveComp);
  if (chset_pos == eohd_pos) // No charset!
    return;
  chset_pos += 8;

  // remove everything from the string after the next ; or " or space,
  // whichever comes first.
  // The inital sting looks something like
  // <META content="text/html; charset=utf-8" http-equiv=Content-Type>
  // <META content="text/html; charset=utf-8;" http-equiv=Content-Type>
  // <META content="text/html; charset=utf-8 ;" http-equiv=Content-Type>
  // <META content="text/html; charset=utf-8 " http-equiv=Content-Type>
  const wchar_t term[] = L";\" ", *term_end= term+sizeof(term)/sizeof(term[0])-1;
  const wchar_t* chset_end = std::find_first_of(chset_pos, eohd_pos, term,
                                                term_end);
  if (chset_end != eohd_pos)
    LossyCopyUTF16toASCII(Substring(chset_pos, chset_end), charset);
}

bool CMapiMessage::FetchBody( void)
{
  m_bodyIsHtml = false;
  m_body.Truncate();

  // Get the Outlook codepage info; if unsuccessful then it defaults to 0 (CP_ACP) -> system default
  // Maybe we can use this info later?
  unsigned int codepage=0;
  LPSPropValue pVal = CMapiApi::GetMapiProperty( m_lpMsg, PR_INTERNET_CPID);
  if (pVal) {
    if (PROP_TYPE( pVal->ulPropTag) == PT_LONG)
      codepage = pVal->Value.l;
    CMapiApi::MAPIFreeBuffer( pVal);
  }

  unsigned long nativeBodyType = 0;
  if (CMapiApi::GetRTFPropertyDecodedAsUTF16(m_lpMsg, m_body, nativeBodyType,
                                             codepage)) {
    m_bodyIsHtml = nativeBodyType == MAPI_NATIVE_BODY_TYPE_HTML;
  }
  else { // Cannot get RTF version
    // Is it html?
    pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_BODY_HTML_W);
    if (pVal) {
      if (CMapiApi::IsLargeProperty(pVal))
        CMapiApi::GetLargeStringProperty(m_lpMsg, PR_BODY_HTML_W, m_body);
      else if ((PROP_TYPE(pVal->ulPropTag) == PT_UNICODE) &&
               (pVal->Value.lpszW) && (*(pVal->Value.lpszW)))
        m_body.Assign(pVal->Value.lpszW);
      CMapiApi::MAPIFreeBuffer( pVal);
    }

    // Kind-hearted Outlook will give us html even for a plain text message.
    // But it will include a comment saying it did the conversion.
    // We'll use this as a hack to really use the plain text part.
    //
    // Sadly there are cases where this string is returned despite the fact
    // that the message is indeed HTML.
    //
    // To detect the "true" plain text messages, we look for our string
    // immediately following the <BODY> tag.
    if (!m_body.IsEmpty() &&
        m_body.Find(L"<BODY>\r\n<!-- Converted from text/plain format -->") ==
        kNotFound) {
      m_bodyIsHtml = true;
    }
    else {
      pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_BODY_W);
      if (pVal) {
        if (CMapiApi::IsLargeProperty(pVal))
          CMapiApi::GetLargeStringProperty(m_lpMsg, PR_BODY_W, m_body);
        else if ((PROP_TYPE(pVal->ulPropTag) == PT_UNICODE) &&
                 (pVal->Value.lpszW) && (*(pVal->Value.lpszW)))
          m_body.Assign(pVal->Value.lpszW);
        CMapiApi::MAPIFreeBuffer(pVal);
      }
    }
  }

  // OK, now let's restore the original encoding!
  // 1. We may have a header defining the charset (we already called the FetchHeaders(), and there ProcessHeaders();
  //    in this case, the m_mimeCharset is set. See nsOutlookMail::ImportMailbox())
  // 2. We may have the codepage walue provided by Outlook ("codepage" at the very beginning of this function)
  // 3. We may have an HTML charset header.

  bool bFoundCharset = false;

  if (!m_mimeCharset.IsEmpty()) // The top-level header data
    bFoundCharset = CheckBodyInCharsetRange(m_mimeCharset.get());
  // No valid charset in the message header - try the HTML header.
  // arguably may be useless
  if (!bFoundCharset && m_bodyIsHtml) {
    ExtractMetaCharset(m_body.get(), m_body.Length(), m_mimeCharset);
    if (!m_mimeCharset.IsEmpty())
      bFoundCharset = CheckBodyInCharsetRange(m_mimeCharset.get());
  }
  // Get from Outlook (seems like it keeps the MIME part header encoding info)
  if (!bFoundCharset && codepage) {
    const char* charset = CpToCharset(codepage);
    if (charset) {
      bFoundCharset = CheckBodyInCharsetRange(charset);
      if (bFoundCharset)
        m_mimeCharset.Assign(charset);
    }
  }
  if (!bFoundCharset) { // Use system default
    const char* charset = nsMsgI18NFileSystemCharset();
    if (charset) {
      bFoundCharset = CheckBodyInCharsetRange(charset);
      if (bFoundCharset)
        m_mimeCharset.Assign(charset);
    }
  }
  if (!bFoundCharset) // Everything else failed, let's use the lossless utf-8...
    m_mimeCharset.Assign("utf-8");

  MAPI_DUMP_STRING(m_body.get());
  MAPI_TRACE0("\r\n");

  return true;
}

void CMapiMessage::GetBody(nsCString& dest) const
{
  nsMsgI18NConvertFromUnicode(m_mimeCharset.get(), m_body, dest);
}

void CMapiMessage::FetchFlags(void)
{
  LPSPropValue pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_MESSAGE_FLAGS);
  if (pVal)
    m_msgFlags = CMapiApi::GetLongFromProp(pVal);
  pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_LAST_VERB_EXECUTED);
  if (pVal)
    m_msgLastVerb = CMapiApi::GetLongFromProp(pVal);
}

enum {
  ieidPR_ATTACH_NUM = 0,
  ieidAttachMax
};

static const SizedSPropTagArray(ieidAttachMax, ptaEid)=
{
  ieidAttachMax,
  {
    PR_ATTACH_NUM
  }
};

bool CMapiMessage::IterateAttachTable(LPMAPITABLE lpTable)
{
  ULONG rowCount;
  HRESULT hr = lpTable->GetRowCount( 0, &rowCount);
  if (!rowCount) {
    return true;
  }

  hr = lpTable->SetColumns( (LPSPropTagArray)&ptaEid, 0);
  if (FAILED(hr)) {
    MAPI_TRACE2( "SetColumns for attachment table failed: 0x%lx, %d\r\n", (long)hr, (int)hr);
    return false;
  }

  hr = lpTable->SeekRow( BOOKMARK_BEGINNING, 0, NULL);
  if (FAILED(hr)) {
    MAPI_TRACE2( "SeekRow for attachment table failed: 0x%lx, %d\r\n", (long)hr, (int)hr);
    return false;
  }

  int cNumRows = 0;
  LPSRowSet lpRow;
  bool bResult = true;
  do {

    lpRow = NULL;
    hr = lpTable->QueryRows( 1, 0, &lpRow);

    if(HR_FAILED(hr)) {
      MAPI_TRACE2( "QueryRows for attachment table failed: 0x%lx, %d\n", (long)hr, (int)hr);
      bResult = false;
      break;
    }

    if (lpRow) {
      cNumRows = lpRow->cRows;

      if (cNumRows) {
        DWORD aNum = lpRow->aRow[0].lpProps[ieidPR_ATTACH_NUM].Value.ul;
        AddAttachment(aNum);
        MAPI_TRACE1( "\t\t****Attachment found - #%d\r\n", (int)aNum);
      }
      CMapiApi::FreeProws( lpRow);
    }

  } while ( SUCCEEDED(hr) && cNumRows && lpRow);

  return( bResult);
}

bool CMapiMessage::GetTmpFile(/*out*/ nsILocalFile **aResult)
{
  nsCOMPtr<nsIFile> tmpFile;
  nsresult rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
    "mapiattach.tmp",
    getter_AddRefs(tmpFile));
  if (NS_FAILED(rv))
    return false;

  rv = tmpFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
  if (NS_FAILED(rv))
    return false;

  return NS_SUCCEEDED(CallQueryInterface(tmpFile, aResult));
}

bool CMapiMessage::CopyMsgAttachToFile(LPATTACH lpAttach, /*out*/ nsILocalFile **tmp_file)
{
  bool bResult = true;
  LPMESSAGE  lpMsg;
  HRESULT hr = lpAttach->OpenProperty(PR_ATTACH_DATA_OBJ, &IID_IMessage, 0, 0,
                                      reinterpret_cast<LPUNKNOWN *>(&lpMsg));
  NS_ENSURE_SUCCESS(hr, false);

  if (!GetTmpFile(tmp_file))
    return false;

  nsCOMPtr<nsIOutputStream> destOutputStream;
  nsresult rv = MsgNewBufferedFileOutputStream(getter_AddRefs(destOutputStream), *tmp_file, -1, 0600);
  if (NS_SUCCEEDED(rv))
    rv = nsOutlookMail::ImportMessage(lpMsg, destOutputStream, nsIMsgSend::nsMsgSaveAsDraft);

  if (NS_FAILED(rv)) {
    (*tmp_file)->Remove(PR_FALSE);
    (*tmp_file)->Release();
    tmp_file = 0;
  }

  return NS_SUCCEEDED(rv);
}

bool CMapiMessage::CopyBinAttachToFile(LPATTACH lpAttach,
                                       nsILocalFile **tmp_file)
{
  nsCOMPtr<nsIFile> _tmp_file;
  nsresult rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
    "mapiattach.tmp",
    getter_AddRefs(_tmp_file));
  NS_ENSURE_SUCCESS(rv, false);

  rv = _tmp_file->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
  NS_ENSURE_SUCCESS(rv, false);

  nsCString tmpPath;
  _tmp_file->GetNativePath(tmpPath);
  LPSTREAM lpStreamFile;
  HRESULT hr = CMapiApi::OpenStreamOnFile( gpMapiAllocateBuffer, gpMapiFreeBuffer, STGM_READWRITE | STGM_CREATE,
    const_cast<char*>(tmpPath.get()), NULL, &lpStreamFile);
  if (HR_FAILED(hr)) {
    MAPI_TRACE1("~~ERROR~~ OpenStreamOnFile failed - temp path: %s\r\n",
                tmpPath.get());
    return false;
  }

  bool bResult = true;
  LPSTREAM lpAttachStream;
  hr = lpAttach->OpenProperty( PR_ATTACH_DATA_BIN, &IID_IStream, 0, 0, (LPUNKNOWN *)&lpAttachStream);

  if (HR_FAILED( hr)) {
    MAPI_TRACE0( "~~ERROR~~ OpenProperty failed for PR_ATTACH_DATA_BIN.\r\n");
    lpAttachStream = NULL;
    bResult = false;
  }
  else {
    STATSTG st;
    hr = lpAttachStream->Stat( &st, STATFLAG_NONAME);
    if (HR_FAILED( hr)) {
      MAPI_TRACE0( "~~ERROR~~ Stat failed for attachment stream\r\n");
      bResult = false;
    }
    else {
      hr = lpAttachStream->CopyTo( lpStreamFile, st.cbSize, NULL, NULL);
      if (HR_FAILED( hr)) {
        MAPI_TRACE0( "~~ERROR~~ Attach Stream CopyTo temp file failed.\r\n");
        bResult = false;
      }
    }
  }

  if (lpAttachStream)
    lpAttachStream->Release();
  lpStreamFile->Release();
  if (!bResult)
    _tmp_file->Remove(PR_FALSE);
  else
    CallQueryInterface(_tmp_file, tmp_file);

  return bResult;
}

bool CMapiMessage::GetURL(nsIFile *aFile, nsIURI **url)
{
  if (!m_pIOService)
    return false;

  nsresult rv = m_pIOService->NewFileURI(aFile, url);
  return NS_SUCCEEDED(rv);
}

bool CMapiMessage::AddAttachment(DWORD aNum)
{
  LPATTACH lpAttach = NULL;
  HRESULT hr = m_lpMsg->OpenAttach(aNum, NULL, 0, &lpAttach);
  if (HR_FAILED(hr)) {
    MAPI_TRACE2("\t\t****Attachment error, unable to open attachment: %d, 0x%lx\r\n", idx, hr);
    return false;
  }

  bool bResult = false;
  attach_data *data = new attach_data;
  ULONG aMethod;
  if (data) {
    bResult = true;

    // 1. Get the file that contains the attachment data
    LPSPropValue pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_METHOD);
    if (pVal) {
      aMethod = CMapiApi::GetLongFromProp( pVal);
      switch (aMethod) {
      case ATTACH_BY_VALUE:
        MAPI_TRACE1( "\t\t** Attachment #%d by value.\r\n", aNum);
        bResult = CopyBinAttachToFile(lpAttach, getter_AddRefs(data->tmp_file));
        data->delete_file = true;
        break;
      case ATTACH_BY_REFERENCE:
      case ATTACH_BY_REF_RESOLVE:
      case ATTACH_BY_REF_ONLY:
        pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_PATHNAME_W);
        if (pVal) {
          nsCString path;
          CMapiApi::GetStringFromProp(pVal, path);
          nsresult rv;
          data->tmp_file = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
          if (NS_FAILED(rv) || !data->tmp_file) {
            MAPI_TRACE0("*** Error creating file spec for attachment\n");
            bResult = false;
          }
          else data->tmp_file->InitWithNativePath(path);
        }
        MAPI_TRACE2("\t\t** Attachment #%d by ref: %s\r\n",
          aNum, m_attachPath.get());
        break;
      case ATTACH_EMBEDDED_MSG:
        MAPI_TRACE1("\t\t** Attachment #%d by Embedded Message??\r\n", aNum);
        // Convert the embedded IMessage from PR_ATTACH_DATA_OBJ to rfc822 attachment
        // (see http://msdn.microsoft.com/en-us/library/cc842329.aspx)
        // This is a recursive call.
        bResult = CopyMsgAttachToFile(lpAttach, getter_AddRefs(data->tmp_file));
        data->delete_file = true;
        break;
      case ATTACH_OLE:
        MAPI_TRACE1("\t\t** Attachment #%d by OLE - yuck!!!\r\n", aNum);
        break;
      default:
        MAPI_TRACE2("\t\t** Attachment #%d unknown attachment method - 0x%lx\r\n", aNum, aMethod);
        bResult = false;
      }
    }
    else
      bResult = false;

    if (bResult)
      bResult = data->tmp_file;

    if (bResult) {
      bool isFile = false;
      bool exists = false;
      data->tmp_file->Exists(&exists);
      data->tmp_file->IsFile(&isFile);

      if (!exists || !isFile) {
        bResult = false;
        MAPI_TRACE0("Attachment file does not exist\n");
      }
    }

    if (bResult)
      bResult = GetURL(data->tmp_file, getter_AddRefs(data->orig_url));

    if (bResult) {
      // Now we have the file; proceed to the other properties

      data->encoding = NS_strdup(ENCODING_BINARY);

      nsString fname, fext;
      pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_LONG_FILENAME_W);
      if (!pVal)
        pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_FILENAME_W);
      CMapiApi::GetStringFromProp(pVal, fname);
      pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_EXTENSION_W);
      CMapiApi::GetStringFromProp(pVal, fext);
      MAPI_TRACE2("\t\t\t--- File name: %s, extension: %s\r\n",
        fname.get(), fext.get());

      if (fext.IsEmpty()) {
        int idx = fname.RFindChar(L'.');
        if (idx != -1)
          fname.Right(fext, fname.Length() - idx);
      }
      else if (fname.RFindChar(L'.') == -1) {
        fname += L".";
        fname += fext;
      }
      if (fname.IsEmpty()) {
        // If no description use "Attachment i" format.
        fname = L"Attachment ";
        fname.AppendInt(static_cast<PRUint32>(aNum));
      }
      data->real_name = ToNewUTF8String(fname);

      nsCString tmp;
       // We have converted it to the rfc822 document
      if (aMethod == ATTACH_EMBEDDED_MSG) {
        data->type = NS_strdup(MESSAGE_RFC822);
      } else {
        pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_MIME_TAG_A);
        CMapiApi::GetStringFromProp(pVal, tmp);
        MAPI_TRACE1("\t\t\t--- Mime type: %s\r\n", tmp.get());
        if (tmp.IsEmpty()) {
          PRUint8 *pType = NULL;
          if (!fext.IsEmpty()) {
            pType = CMimeTypes::GetMimeType(fext);
          }
          if (pType)
            data->type = NS_strdup((PC_S8)pType);
          else
            data->type = NS_strdup(APPLICATION_OCTET_STREAM);
        }
        else
          data->type = ToNewCString(tmp);
      }

      pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_CONTENT_ID_A);
      CMapiApi::GetStringFromProp(pVal, tmp);
      if (!tmp.IsEmpty())
        data->cid = ToNewCString(tmp);
    }
    if (bResult) {
      // Now we need to decide if this attachment is embedded or not.
      // At first, I tried to simply check for the presence of the Content-Id.
      // But it turned out that this method is unreliable, since there exist cases
      // when an attachment has a Content-Id while isn't embedded (even in a message
      // with a plain-text body!). So next I tried to look for <img> tags that contain
      // the found Content-Id. But this is unreliable, too, because there exist cases
      // where other places of HTML reference the embedded messages (e.g. it may be
      // a background of a table cell, or some CSS; further, it is possible that the
      // reference to an embedded object is not in the main body, but in another
      // embedded object - like body references a CSS attachment that in turn references
      // a picture as a background of its element). From the other hand, it's unreliable
      // to relax the search criteria to any occurence of the Content-Id string in the body -
      // partly because the string may be simply in a text or other non-referencing part,
      // partly because of the abovementioned possibility that the reference is outside
      // the body at all.
      // There exist the PR_ATTACH_FLAGS property of the attachment. The MS documentation
      // tells about two possible flags in it: ATT_INVISIBLE_IN_HTML and ATT_INVISIBLE_IN_RTF.
      // There is at least one more undocumented flag: ATT_MHTML_REF. Some sources in Internet
      // suggest simply check for the latter flag to distinguish between the embedded
      // and ordinary attachments. But my observations indicate that even if the flags
      // don't include ATT_MHTML_REF, the attachment is still may be embedded.
      // However, my observations always show that the message is embedded if the flags
      // is not 0.
      // So now I will simply test for the non-zero flags to decide whether the attachment
      // is embedded or not. Possible advantage is reliability (I hope).
      // Another advantage is that it's much faster than search the body for Content-Id.

      DWORD flags = 0;

      pVal = CMapiApi::GetMapiProperty(lpAttach, PR_ATTACH_FLAGS);
      if (pVal)
        flags = CMapiApi::GetLongFromProp(pVal);
      if (m_bodyIsHtml && data->cid && (flags != 0)) // this is the embedded attachment
        m_embattachments.push_back(data);
      else // this is ordinary attachment
        m_stdattachments.push_back(data);
    }
    else {
      delete data;
    }
  }

  lpAttach->Release();
  return( bResult);
}

void CMapiMessage::ClearAttachment(attach_data* data)
{
  if (data->delete_file && data->tmp_file)
    data->tmp_file->Remove(PR_FALSE);

  if (data->type)
    NS_Free(data->type);
  if (data->encoding)
    NS_Free(data->encoding);
  if (data->real_name)
    NS_Free(data->real_name);
  if (data->cid)
    NS_Free(data->cid);

  delete data;
}

void CMapiMessage::ClearAttachments()
{
  std::for_each(m_stdattachments.begin(), m_stdattachments.end(), ClearAttachment);
  m_stdattachments.clear();
  std::for_each(m_embattachments.begin(), m_embattachments.end(), ClearAttachment);
  m_embattachments.clear();
}

// This method must be called AFTER the retrieval of the body,
// since the decision if an attachment is embedded or not is made
// based on the body type and contents
void CMapiMessage::ProcessAttachments()
{
  LPSPropValue pVal = CMapiApi::GetMapiProperty(m_lpMsg, PR_HASATTACH);
  bool hasAttach = true;

  if (pVal) {
    if (PROP_TYPE( pVal->ulPropTag) == PT_BOOLEAN)
      hasAttach = (pVal->Value.b != 0);
    CMapiApi::MAPIFreeBuffer( pVal);
  }

  if (!hasAttach)
    return;

  // Get the attachment table?
  LPMAPITABLE pTable = NULL;
  HRESULT hr = m_lpMsg->GetAttachmentTable( 0, &pTable);
  if (FAILED( hr) || !pTable)
    return;
  IterateAttachTable(pTable);
  pTable->Release();
}

nsresult CMapiMessage::GetAttachments(nsIArray **aArray)
{
  nsresult rv;
  nsCOMPtr<nsIMutableArray> attachments (do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  NS_IF_ADDREF(*aArray = attachments);

  for (std::vector<attach_data*>::const_iterator it = m_stdattachments.begin();
       it != m_stdattachments.end(); it++) {
    nsCOMPtr<nsIMsgAttachedFile> a(do_CreateInstance(NS_MSGATTACHEDFILE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    a->SetOrigUrl((*it)->orig_url);
    a->SetTmpFile((*it)->tmp_file);
    a->SetEncoding(nsDependentCString((*it)->encoding));
    a->SetRealName(nsDependentCString((*it)->real_name));
    a->SetType(nsDependentCString((*it)->type));
    attachments->AppendElement(a, PR_FALSE);
  }
  return rv;
}

bool CMapiMessage::GetEmbeddedAttachmentInfo(unsigned int i, nsIURI **uri,
                                             const char **cid,
                                             const char **name) const
{
  if ((i < 0) || ( i >= m_embattachments.size()))
    return false;
  attach_data* data = m_embattachments[i];
  if (!data)
    return false;
  *uri = data->orig_url;
  *cid = data->cid;
  *name = data->real_name;
  return true;
}

//////////////////////////////////////////////////////

// begin and end MUST point to the same string
char* dup(const char* begin, const char* end)
{
  if (begin >= end)
    return 0;
  char* str = new char[end-begin+1];
  memcpy(str, begin, (end-begin)*sizeof(begin[0]));
  str[end - begin] = 0;
  return str;
}

// See RFC822
inline bool IsPrintableASCII(char c) { return (c > 32) && (c < 127); }
inline bool IsWSP(char c) { return (c == 32) || (c == 9); }

CMapiMessageHeaders::CHeaderField::CHeaderField(const char* begin, int len)
  : m_fname(0), m_fbody(0), m_fbody_utf8(false)
{
  const char *end = begin+len, *fname_end = begin;
  while ((fname_end < end) && IsPrintableASCII(*fname_end) && (*fname_end != ':'))
    ++fname_end;
  if ((fname_end == end) || (*fname_end != ':'))
    return; // Not a valid header!
  m_fname = dup(begin, fname_end+1); // including colon
  m_fbody = dup(fname_end+1, end);
}

CMapiMessageHeaders::CHeaderField::CHeaderField(const char* name, const char* body, bool utf8)
  : m_fname(dup(name, name+strlen(name))), m_fbody(dup(body, body+strlen(body))), m_fbody_utf8(utf8)
{
}

CMapiMessageHeaders::CHeaderField::~CHeaderField()
{
  delete[] m_fname;
  delete[] m_fbody;
}

void CMapiMessageHeaders::CHeaderField::set_fbody(const char* txt)
{
  if (m_fbody == txt)
    return; // to avoid assigning to self
  char* oldbody = m_fbody;
  m_fbody = dup(txt, txt+strlen(txt));
  delete[] oldbody;
  m_fbody_utf8 = true;
}

void CMapiMessageHeaders::CHeaderField::GetUnfoldedString(nsString& dest,
                                          const char* fallbackCharset) const
{
  dest.Truncate();
  if (!m_fbody)
    return;
  nsCString unfolded;
  const char* pos = m_fbody;
  while (*pos) {
    if ((*pos == '\x0D') && (*(pos+1) == '\x0A') && IsWSP(*(pos+2)))
      pos += 2; // Skip CRLF if it is followed by SPACE or TAB
    else
      unfolded.Append(*(pos++));
  }
  if (m_fbody_utf8)
    CopyUTF8toUTF16(unfolded, dest);
  else
    nsMsgI18NConvertToUnicode(fallbackCharset, unfolded, dest);
}

////////////////////////////////////////

const char* CMapiMessageHeaders::Specials[hdrMax] = {
  "Date:",
  "From:",
  "Sender:",
  "Reply-To:",
  "To:",
  "Cc:",
  "Bcc:",
  "Message-ID:",
  "Subject:",
  "Mime-Version:",
  "Content-Type:",
  "Content-Transfer-Encoding:"
};

CMapiMessageHeaders::~CMapiMessageHeaders()
{
  ClearHeaderFields();
}

void Delete(void* p) { delete p; }

void CMapiMessageHeaders::ClearHeaderFields()
{
  std::for_each(m_headerFields.begin(), m_headerFields.end(), Delete);
  m_headerFields.clear();
}

void CMapiMessageHeaders::Assign(const char* headers)
{
  for (int i=0; i<hdrMax; i++)
    m_SpecialHeaders[i] = 0;
  ClearHeaderFields();
  if (!headers)
    return;
  const char *start=headers, *end=headers;
  while (*end) {
    if ((*end == '\x0D') && (*(end+1) == '\x0A')) { // CRLF
      if (!IsWSP(*(end+2))) { // Not SPACE nor TAB (avoid FSP) -> next header or EOF
        Add(new CHeaderField(start, end-start));
        start = ++end + 1;
      }
    }
    ++end;
  }

  if (start < end) { // Last header left
    Add(new CHeaderField(start, end-start));
  }
}

void CMapiMessageHeaders::Add(CHeaderField* f)
{
  if (!f)
    return;
  if (!f->Valid()) {
    delete f;
    return;
  }

  SpecialHeader idx = CheckSpecialHeader(f->fname());
  if (idx != hdrNone) {
    // Now check if the special header was already inserted;
    // if so, remove previous and add this new
    CHeaderField* PrevSpecial = m_SpecialHeaders[idx];
    if (PrevSpecial) {
      std::vector<CHeaderField*>::iterator iter = std::find(m_headerFields.begin(), m_headerFields.end(), PrevSpecial);
      if (iter != m_headerFields.end())
        m_headerFields.erase(iter);
      delete PrevSpecial;
    }
    m_SpecialHeaders[idx] = f;
  }
  m_headerFields.push_back(f);
}

CMapiMessageHeaders::SpecialHeader CMapiMessageHeaders::CheckSpecialHeader(const char* fname)
{
  for (int i = hdrFirst; i < hdrMax; i++)
    if (stricmp(fname, Specials[i]) == 0)
      return static_cast<SpecialHeader>(i);

  return hdrNone;
}

const CMapiMessageHeaders::CHeaderField* CMapiMessageHeaders::CFind(const char* name) const
{
  SpecialHeader special = CheckSpecialHeader(name);
  if ((special > hdrNone) && (special < hdrMax))
    return m_SpecialHeaders[special]; // No need to search further, because it MUST be here

  std::vector<CHeaderField*>::const_iterator iter = std::find_if(m_headerFields.begin(), m_headerFields.end(), fname_equals(name));
  if (iter == m_headerFields.end())
    return 0;
  return *iter;
}

const char* CMapiMessageHeaders::SpecialName(SpecialHeader special)
{
  if ((special <= hdrNone) || (special >= hdrMax))
    return 0;
  return Specials[special];
}

const char* CMapiMessageHeaders::Value(SpecialHeader special) const
{
  if ((special <= hdrNone) || (special >= hdrMax))
    return 0;
  return (m_SpecialHeaders[special]) ? m_SpecialHeaders[special]->fbody() : 0;
}

const char* CMapiMessageHeaders::Value(const char* name) const
{
  const CHeaderField* result = CFind(name);
  return result ? result->fbody() : 0;
}

void CMapiMessageHeaders::UnfoldValue(const char* name, nsString& dest, const char* fallbackCharset) const
{
  const CHeaderField* result = CFind(name);
  if (result)
    result->GetUnfoldedString(dest, fallbackCharset);
  else
    dest.Truncate();
}

void CMapiMessageHeaders::UnfoldValue(SpecialHeader special, nsString& dest, const char* fallbackCharset) const
{
  if ((special <= hdrNone) || (special >= hdrMax) || (!m_SpecialHeaders[special]))
    dest.Truncate();
  else
    m_SpecialHeaders[special]->GetUnfoldedString(dest, fallbackCharset);
}

int CMapiMessageHeaders::SetValue(const char* name, const char* value, bool replace)
{
  if (!replace) {
    CHeaderField* result = Find(name);
    if (result) {
      result->set_fbody(value);
      return 0;
    }
  }
  Add(new CHeaderField(name, value, true));
  return 0; // No sensible result is returned; maybe do something senseful later
}

int CMapiMessageHeaders::SetValue(SpecialHeader special, const char* value)
{
  CHeaderField* result = m_SpecialHeaders[special];
  if (result)
    result->set_fbody(value);
  else
    Add(new CHeaderField(Specials[special], value, true));
  return 0;
}

void CMapiMessageHeaders::write_to_stream::operator () (const CHeaderField* f)
{
  if (!f || NS_FAILED(m_rv))
    return;

  PRUint32 written;
  m_rv = m_pDst->Write( f->fname(), strlen(f->fname()), &written);
  NS_ENSURE_SUCCESS(m_rv,);
  if (f->fbody()) {
    m_rv = m_pDst->Write(f->fbody(), strlen(f->fbody()), &written);
    NS_ENSURE_SUCCESS(m_rv,);
  }
  m_rv = m_pDst->Write( "\x0D\x0A", 2, &written);
}

nsresult CMapiMessageHeaders::ToStream(nsIOutputStream *pDst) const
{
  nsresult rv = std::for_each(m_headerFields.begin(), m_headerFields.end(),
                              write_to_stream(pDst));
  if (NS_SUCCEEDED(rv)) {
    PRUint32 written;
    rv = pDst->Write( "\x0D\x0A", 2, &written); // Separator line
  }
  return rv;
}
