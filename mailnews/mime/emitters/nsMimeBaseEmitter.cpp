/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include <stdio.h>
#include "nsMimeBaseEmitter.h"
#include "nsMailHeaders.h"
#include "nscore.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIServiceManager.h"
#include "prmem.h"
#include "nsEmitterUtils.h"
#include "nsMimeStringResources.h"
#include "msgCore.h"
#include "nsIMsgHeaderParser.h"
#include "nsIComponentManager.h"
#include "nsEmitterUtils.h"
#include "nsIMimeStreamConverter.h"
#include "nsIMimeConverter.h"
#include "nsMsgMimeCID.h"
#include "prlog.h"
#include "prprf.h"
#include "nsIMimeHeaders.h"
#include "nsIMsgWindow.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsDateTimeFormatCID.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMsgUtils.h"
#include "nsTextFormatter.h"
#include "mozilla/Services.h"
#include <algorithm>

static PRLogModuleInfo * gMimeEmitterLogModule = nullptr;

#define   MIME_HEADER_URL      "chrome://messenger/locale/mimeheader.properties"
#define   MIME_URL             "chrome://messenger/locale/mime.properties"

NS_IMPL_ISUPPORTS2(nsMimeBaseEmitter, nsIMimeEmitter, nsIInterfaceRequestor)

nsMimeBaseEmitter::nsMimeBaseEmitter()
{
  // Initialize data output vars...
  mFirstHeaders = true;

  mBufferMgr = nullptr;
  mTotalWritten = 0;
  mTotalRead = 0;
  mInputStream = nullptr;
  mOutStream = nullptr;
  mOutListener = nullptr;

  // Display output control vars...
  mDocHeader = false;
  m_stringBundle = nullptr;
  mURL = nullptr;
  mHeaderDisplayType = nsMimeHeaderDisplayTypes::NormalHeaders;

  // Setup array for attachments
  mAttachCount = 0;
  mAttachArray = new nsVoidArray();
  mCurrentAttachment = nullptr;

  // Header cache...
  mHeaderArray = new nsVoidArray();

  // Embedded Header Cache...
  mEmbeddedHeaderArray = nullptr;

  // HTML Header Data...
//  mHTMLHeaders = "";
//  mCharset = "";

  // Init the body...
  mBodyStarted = false;
//  mBody = "";

  // This is needed for conversion of I18N Strings...
  mUnicodeConverter = do_GetService(NS_MIME_CONVERTER_CONTRACTID);

  if (!gMimeEmitterLogModule)
    gMimeEmitterLogModule = PR_NewLogModule("MIME");

  // Do prefs last since we can live without this if it fails...
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (pPrefBranch)
    pPrefBranch->GetIntPref("mail.show_headers", &mHeaderDisplayType);
}

nsMimeBaseEmitter::~nsMimeBaseEmitter(void)
{
  int32_t i;

  // Delete the buffer manager...
  if (mBufferMgr)
  {
    delete mBufferMgr;
    mBufferMgr = nullptr;
  }

  // Clean up the attachment array structures...
  if (mAttachArray)
  {
    for (i=0; i<mAttachArray->Count(); i++)
    {
      attachmentInfoType *attachInfo = (attachmentInfoType *)mAttachArray->ElementAt(i);
      if (!attachInfo)
        continue;

      PR_FREEIF(attachInfo->contentType);
      if (attachInfo->displayName)
        NS_Free(attachInfo->displayName);
      PR_FREEIF(attachInfo->urlSpec);
      PR_FREEIF(attachInfo);
    }
    delete mAttachArray;
  }

  // Cleanup allocated header arrays...
  CleanupHeaderArray(mHeaderArray);
  mHeaderArray = nullptr;

  CleanupHeaderArray(mEmbeddedHeaderArray);
  mEmbeddedHeaderArray = nullptr;
}

NS_IMETHODIMP nsMimeBaseEmitter::GetInterface(const nsIID & aIID, void * *aInstancePtr)
{
  NS_ENSURE_ARG_POINTER(aInstancePtr);
  return QueryInterface(aIID, aInstancePtr);
}

void
nsMimeBaseEmitter::CleanupHeaderArray(nsVoidArray *aArray)
{
  if (!aArray)
    return;

  for (int32_t i=0; i<aArray->Count(); i++)
  {
    headerInfoType *headerInfo = (headerInfoType *)aArray->ElementAt(i);
    if (!headerInfo)
      continue;

    PR_FREEIF(headerInfo->name);
    PR_FREEIF(headerInfo->value);
    PR_FREEIF(headerInfo);
  }

  delete aArray;
}

static int32_t MapHeaderNameToID(const char *header)
{
  // emitter passes UPPERCASE for header names
  if (!strcmp(header, "DATE"))
    return MIME_MHTML_DATE;
  else if (!strcmp(header, "FROM"))
    return MIME_MHTML_FROM;
  else if (!strcmp(header, "SUBJECT"))
    return MIME_MHTML_SUBJECT;
  else if (!strcmp(header, "TO"))
    return MIME_MHTML_TO;
  else if (!strcmp(header, "SENDER"))
    return MIME_MHTML_SENDER;
  else if (!strcmp(header, "RESENT-TO"))
    return MIME_MHTML_RESENT_TO;
  else if (!strcmp(header, "RESENT-SENDER"))
    return MIME_MHTML_RESENT_SENDER;
  else if (!strcmp(header, "RESENT-FROM"))
    return MIME_MHTML_RESENT_FROM;
  else if (!strcmp(header, "RESENT-CC"))
    return MIME_MHTML_RESENT_CC;
  else if (!strcmp(header, "REPLY-TO"))
    return MIME_MHTML_REPLY_TO;
  else if (!strcmp(header, "REFERENCES"))
    return MIME_MHTML_REFERENCES;
  else if (!strcmp(header, "NEWSGROUPS"))
    return MIME_MHTML_NEWSGROUPS;
  else if (!strcmp(header, "MESSAGE-ID"))
    return MIME_MHTML_MESSAGE_ID;
  else if (!strcmp(header, "FOLLOWUP-TO"))
    return MIME_MHTML_FOLLOWUP_TO;
  else if (!strcmp(header, "CC"))
    return MIME_MHTML_CC;
  else if (!strcmp(header, "ORGANIZATION"))
    return MIME_MHTML_ORGANIZATION;
  else if (!strcmp(header, "BCC"))
    return MIME_MHTML_BCC;

  return 0;
}

char *
nsMimeBaseEmitter::MimeGetStringByName(const char *aHeaderName)
{
  nsresult res = NS_OK;

  if (!m_headerStringBundle)
  {
    static const char propertyURL[] = MIME_HEADER_URL;

    nsCOMPtr<nsIStringBundleService> sBundleService =
      mozilla::services::GetStringBundleService();
    if (sBundleService)
    {
      res = sBundleService->CreateBundle(propertyURL, getter_AddRefs(m_headerStringBundle));
    }
  }

  if (m_headerStringBundle)
  {
    nsString val;

    res = m_headerStringBundle->GetStringFromName(NS_ConvertASCIItoUTF16(aHeaderName).get(),
                                                  getter_Copies(val));

    if (NS_FAILED(res))
      return nullptr;

    // Here we need to return a new copy of the string
    // This returns a UTF-8 string so the caller needs to perform a conversion
    // if this is used as UCS-2 (e.g. cannot do nsString(utfStr);
    //
    return ToNewUTF8String(val);
  }
  else
  {
    return nullptr;
  }
}

char *
nsMimeBaseEmitter::MimeGetStringByID(int32_t aID)
{
  nsresult res = NS_OK;

  if (!m_stringBundle)
  {
    static const char propertyURL[] = MIME_URL;

    nsCOMPtr<nsIStringBundleService> sBundleService =
      mozilla::services::GetStringBundleService();
    if (sBundleService)
      res = sBundleService->CreateBundle(propertyURL, getter_AddRefs(m_stringBundle));
  }

  if (m_stringBundle)
  {
    nsString val;

    res = m_stringBundle->GetStringFromID(aID, getter_Copies(val));

    if (NS_FAILED(res))
      return nullptr;

    return ToNewUTF8String(val);
  }
  else
    return nullptr;
}

//
// This will search a string bundle (eventually) to find a descriptive header
// name to match what was found in the mail message. aHeaderName is passed in
// in all caps and a dropback default name is provided. The caller needs to free
// the memory returned by this function.
//
char *
nsMimeBaseEmitter::LocalizeHeaderName(const char *aHeaderName, const char *aDefaultName)
{
  char *retVal = nullptr;

  // prefer to use translated strings if not for quoting
  if (mFormat != nsMimeOutput::nsMimeMessageQuoting &&
      mFormat != nsMimeOutput::nsMimeMessageBodyQuoting)
  {
    // map name to id and get the translated string
    int32_t id = MapHeaderNameToID(aHeaderName);
    if (id > 0)
      retVal = MimeGetStringByID(id);
  }

  // get the string from the other bundle (usually not translated)
  if (!retVal)
    retVal = MimeGetStringByName(aHeaderName);

  if (retVal)
    return retVal;
  else
    return strdup(aDefaultName);
}

///////////////////////////////////////////////////////////////////////////
// nsMimeBaseEmitter Interface
///////////////////////////////////////////////////////////////////////////
NS_IMETHODIMP
nsMimeBaseEmitter::SetPipe(nsIInputStream * aInputStream, nsIOutputStream *outStream)
{
  mInputStream = aInputStream;
  mOutStream = outStream;
  return NS_OK;
}

// Note - these is setup only...you should not write
// anything to the stream since these may be image data
// output streams, etc...
NS_IMETHODIMP
nsMimeBaseEmitter::Initialize(nsIURI *url, nsIChannel * aChannel, int32_t aFormat)
{
  // set the url
  mURL = url;
  mChannel = aChannel;

  // Create rebuffering object
  delete mBufferMgr;
  mBufferMgr = new MimeRebuffer();

  // Counters for output stream
  mTotalWritten = 0;
  mTotalRead = 0;
  mFormat = aFormat;

  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::SetOutputListener(nsIStreamListener *listener)
{
  mOutListener = listener;
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::GetOutputListener(nsIStreamListener **listener)
{
  NS_ENSURE_ARG_POINTER(listener);

  NS_IF_ADDREF(*listener = mOutListener);
  return NS_OK;
}


// Attachment handling routines
nsresult
nsMimeBaseEmitter::StartAttachment(const nsACString &name,
                                   const char *contentType,
                                   const char *url,
                                   bool aIsExternalAttachment)
{
  // Ok, now we will setup the attachment info
  mCurrentAttachment = (attachmentInfoType *) PR_NEWZAP(attachmentInfoType);
  if ( (mCurrentAttachment) && mAttachArray)
  {
    ++mAttachCount;

    mCurrentAttachment->displayName = ToNewCString(name);
    mCurrentAttachment->urlSpec = strdup(url);
    mCurrentAttachment->contentType = strdup(contentType);
    mCurrentAttachment->isExternalAttachment = aIsExternalAttachment;
  }

  return NS_OK;
}

nsresult
nsMimeBaseEmitter::EndAttachment()
{
  // Ok, add the attachment info to the attachment array...
  if ( (mCurrentAttachment) && (mAttachArray) )
  {
    mAttachArray->AppendElement(mCurrentAttachment);
    mCurrentAttachment = nullptr;
  }

  return NS_OK;
}

nsresult
nsMimeBaseEmitter::EndAllAttachments()
{
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::AddAttachmentField(const char *field, const char *value)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::UtilityWrite(const char *buf)
{
  NS_ENSURE_ARG_POINTER(buf);

  uint32_t    written;
  Write(nsDependentCString(buf), &written);
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::UtilityWrite(const nsACString &buf)
{
  uint32_t    written;
  Write(buf, &written);
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::UtilityWriteCRLF(const char *buf)
{
  NS_ENSURE_ARG_POINTER(buf);

  uint32_t    written;
  Write(nsDependentCString(buf), &written);
  Write(NS_LITERAL_CSTRING(CRLF), &written);
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::Write(const nsACString &buf, uint32_t *amountWritten)
{
  unsigned int        written = 0;
  nsresult rv = NS_OK;
  uint32_t            needToWrite;

#ifdef DEBUG_BenB
  // If you want to see libmime output...
  printf("%s", buf);
#endif

  PR_LOG(gMimeEmitterLogModule, PR_LOG_ALWAYS, ("%s", PromiseFlatCString(buf).get()));
  //
  // Make sure that the buffer we are "pushing" into has enough room
  // for the write operation. If not, we have to buffer, return, and get
  // it on the next time through
  //
  *amountWritten = 0;

  needToWrite = mBufferMgr->GetSize();
  // First, handle any old buffer data...
  if (needToWrite > 0)
  {
    rv = WriteHelper(mBufferMgr->GetBuffer(), &written);

    mTotalWritten += written;
    mBufferMgr->ReduceBuffer(written);
    *amountWritten = written;

    // if we couldn't write all the old data, buffer the new data
    // and return
    if (mBufferMgr->GetSize() > 0)
    {
      mBufferMgr->IncreaseBuffer(buf);
      return rv;
    }
  }


  // if we get here, we are dealing with new data...try to write
  // and then do the right thing...
  rv = WriteHelper(buf, &written);
  *amountWritten = written;
  mTotalWritten += written;

  if (written < buf.Length()) {
    const nsACString &remainder = Substring(buf, written);
    mBufferMgr->IncreaseBuffer(remainder);
  }

  return rv;
}

nsresult
nsMimeBaseEmitter::WriteHelper(const nsACString &buf, uint32_t *countWritten)
{
  NS_ENSURE_TRUE(mOutStream, NS_ERROR_NOT_INITIALIZED);

  nsresult rv = mOutStream->Write(buf.BeginReading(), buf.Length(), countWritten);
  if (rv == NS_BASE_STREAM_WOULD_BLOCK) {
    // pipe is full, push contents of pipe to listener...
    uint64_t avail;
    rv = mInputStream->Available(&avail);
    if (NS_SUCCEEDED(rv) && avail) {
      mOutListener->OnDataAvailable(mChannel, mURL, mInputStream, 0, 
                                    std::min(avail, uint64_t(PR_UINT32_MAX)));

      // try writing again...
      rv = mOutStream->Write(buf.BeginReading(), buf.Length(), countWritten);
    }
  }
  return rv;
}

//
// Find a cached header! Note: Do NOT free this value!
//
const char *
nsMimeBaseEmitter::GetHeaderValue(const char  *aHeaderName)
{
  int32_t     i;
  char        *retVal = nullptr;
  nsVoidArray *array = mDocHeader? mHeaderArray : mEmbeddedHeaderArray;

  if (!array)
    return nullptr;

  for (i = 0; i < array->Count(); i++)
  {
    headerInfoType *headerInfo = (headerInfoType *)array->ElementAt(i);
    if ( (!headerInfo) || (!headerInfo->name) || (!(*headerInfo->name)) )
      continue;

    if (!PL_strcasecmp(aHeaderName, headerInfo->name))
    {
      retVal = headerInfo->value;
      break;
    }
  }

  return retVal;
}

//
// This is called at the start of the header block for all header information in ANY
// AND ALL MESSAGES (yes, quoted, attached, etc...)
//
// NOTE: This will be called even when headers are will not follow. This is
// to allow us to be notified of the charset of the original message. This is
// important for forward and reply operations
//
NS_IMETHODIMP
nsMimeBaseEmitter::StartHeader(bool rootMailHeader, bool headerOnly, const char *msgID,
                               const char *outCharset)
{
  NS_ENSURE_ARG_POINTER(outCharset);

  mDocHeader = rootMailHeader;

  // If this is not the mail messages header, then we need to create
  // the mEmbeddedHeaderArray structure for use with this internal header
  // structure.
  if (!mDocHeader)
  {
    if (mEmbeddedHeaderArray)
      CleanupHeaderArray(mEmbeddedHeaderArray);

    mEmbeddedHeaderArray = new nsVoidArray();
    NS_ENSURE_TRUE(mEmbeddedHeaderArray, NS_ERROR_OUT_OF_MEMORY);
  }

  // If the main doc, check on updated character set
  if (mDocHeader)
    UpdateCharacterSet(outCharset);
  CopyASCIItoUTF16(nsDependentCString(outCharset), mCharset);
  return NS_OK;
}

// Ok, if we are here, and we have a aCharset passed in that is not
// UTF-8 or US-ASCII, then we should tag the mChannel member with this
// charset. This is because replying to messages with specified charset's
// need to be tagged as that charset by default.
//
NS_IMETHODIMP
nsMimeBaseEmitter::UpdateCharacterSet(const char *aCharset)
{
  if ( (aCharset) && (PL_strcasecmp(aCharset, "US-ASCII")) &&
        (PL_strcasecmp(aCharset, "ISO-8859-1")) &&
        (PL_strcasecmp(aCharset, "UTF-8")) )
  {
    nsAutoCString contentType;

    if (NS_SUCCEEDED(mChannel->GetContentType(contentType)) && !contentType.IsEmpty())
    {
      char *cBegin = contentType.BeginWriting();

      const char *cPtr = PL_strcasestr(cBegin, "charset=");

      if (cPtr)
      {
        char  *ptr = cBegin;
        while (*ptr)
        {
          if ( (*ptr == ' ') || (*ptr == ';') )
          {
            if ((ptr + 1) >= cPtr)
            {
              *ptr = '\0';
              break;
            }
          }

          ++ptr;
        }
      }

      // have to set content-type since it could have an embedded null byte
      mChannel->SetContentType(nsDependentCString(cBegin));
      mChannel->SetContentCharset(nsDependentCString(aCharset));
    }
  }

  return NS_OK;
}

//
// This will be called for every header field regardless if it is in an
// internal body or the outer message.
//
NS_IMETHODIMP
nsMimeBaseEmitter::AddHeaderField(const char *field, const char *value)
{
  if ( (!field) || (!value) )
    return NS_OK;

  nsVoidArray   *tPtr;
  if (mDocHeader)
    tPtr = mHeaderArray;
  else
    tPtr = mEmbeddedHeaderArray;

  // This is a header so we need to cache and output later.
  // Ok, now we will setup the header info for the header array!
  headerInfoType  *ptr = (headerInfoType *) PR_NEWZAP(headerInfoType);
  if ( (ptr) && tPtr)
  {
    ptr->name = strdup(field);
    ptr->value = strdup(value);
    tPtr->AppendElement(ptr);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::AddAllHeaders(const nsACString &allheaders)
{
  if (mDocHeader) //We want to set only the main headers of a message, not the potentially embedded one
  {
    nsresult rv;
    nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(mURL));
    if (msgurl)
    {
        nsCOMPtr<nsIMimeHeaders> mimeHeaders = do_CreateInstance(NS_IMIMEHEADERS_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        mimeHeaders->Initialize(allheaders);
        msgurl->SetMimeHeaders(mimeHeaders);
    }
  }
  return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////
// The following code is responsible for formatting headers in a manner that is
// identical to the normal XUL output.
////////////////////////////////////////////////////////////////////////////////

nsresult
nsMimeBaseEmitter::GenerateDateString(const char * dateString,
                                      nsACString &formattedDate,
                                      bool showDateForToday)
{
  nsresult rv = NS_OK;

  if (!mDateFormatter) {
    mDateFormatter = do_CreateInstance(NS_DATETIMEFORMAT_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  /**
   * See if the user wants to have the date displayed in the senders
   * timezone (including the timezone offset).
   * We also evaluate the pref original_date which was introduced
   * as makeshift in bug 118899.
   */
  bool displaySenderTimezone = false;
  bool displayOriginalDate = false;

  nsCOMPtr<nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIPrefBranch> dateFormatPrefs;
  rv = prefs->GetBranch("mailnews.display.", getter_AddRefs(dateFormatPrefs));
  NS_ENSURE_SUCCESS(rv, rv);

  dateFormatPrefs->GetBoolPref("date_senders_timezone", &displaySenderTimezone);
  dateFormatPrefs->GetBoolPref("original_date", &displayOriginalDate);
  // migrate old pref to date_senders_timezone
  if (displayOriginalDate && !displaySenderTimezone)
    dateFormatPrefs->SetBoolPref("date_senders_timezone", true);

  PRExplodedTime explodedMsgTime;
  // XXX Casting PRStatus to nsresult
  rv = static_cast<nsresult>(
    PR_ParseTimeStringToExplodedTime(dateString, false, &explodedMsgTime));
  /**
   * To determine the date format to use, comparison of current and message
   * time has to be made. If displaying in local time, both timestamps have
   * to be in local time. If displaying in senders time zone, leave the compare
   * time in that time zone.
   * Otherwise in TZ+0100 on 2009-03-12 a message from 2009-03-11T20:49-0700
   * would be displayed as "20:49 -0700" though it in fact is not from the
   * same day.
   */
  PRExplodedTime explodedCompTime;
  if (displaySenderTimezone)
    explodedCompTime = explodedMsgTime;
  else
    PR_ExplodeTime(PR_ImplodeTime(&explodedMsgTime), PR_LocalTimeParameters, &explodedCompTime);

  PRExplodedTime explodedCurrentTime;
  PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &explodedCurrentTime);

  // If we want short dates, check if the message is from today, and if so
  // only show the time (e.g. 3:15 pm).
  nsDateFormatSelector dateFormat = kDateFormatShort;
  if (!showDateForToday &&
      explodedCurrentTime.tm_year == explodedCompTime.tm_year &&
      explodedCurrentTime.tm_month == explodedCompTime.tm_month &&
      explodedCurrentTime.tm_mday == explodedCompTime.tm_mday)
  {
    // same day...
    dateFormat = kDateFormatNone;
  }

  nsAutoString formattedDateString;
  if (NS_SUCCEEDED(rv))
  {
    rv = mDateFormatter->FormatPRExplodedTime(nullptr /* nsILocale* locale */,
                                              dateFormat,
                                              kTimeFormatNoSeconds,
                                              &explodedCompTime,
                                              formattedDateString);

    if (NS_SUCCEEDED(rv))
    {
      if (displaySenderTimezone)
      {
        // offset of local time from UTC in minutes
        int32_t senderoffset = (explodedMsgTime.tm_params.tp_gmt_offset +
                                explodedMsgTime.tm_params.tp_dst_offset) / 60;
        // append offset to date string
        PRUnichar *tzstring =
          nsTextFormatter::smprintf(NS_LITERAL_STRING(" %+05d").get(),
                                    (senderoffset / 60 * 100) +
                                    (senderoffset % 60));
        formattedDateString.Append(tzstring);
        nsTextFormatter::smprintf_free(tzstring);
      }

      CopyUTF16toUTF8(formattedDateString, formattedDate);
    }
  }

  return rv;
}

char*
nsMimeBaseEmitter::GetLocalizedDateString(const char * dateString)
{
  char *i18nValue = nullptr;

  bool displayOriginalDate = false;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));

  if (prefBranch)
    prefBranch->GetBoolPref("mailnews.display.original_date",
                            &displayOriginalDate);

  if (!displayOriginalDate)
  {
    nsAutoCString convertedDateString;
    nsresult rv = GenerateDateString(dateString, convertedDateString, true);
    if (NS_SUCCEEDED(rv))
      i18nValue = strdup(convertedDateString.get());
    else
      i18nValue = strdup(dateString);
  }
  else
    i18nValue = strdup(dateString);

  return i18nValue;
}

nsresult
nsMimeBaseEmitter::WriteHeaderFieldHTML(const char *field, const char *value)
{
  char *newValue = nullptr;
  char *i18nValue = nullptr;

  if ( (!field) || (!value) )
    return NS_OK;

  //
  // This is a check to see what the pref is for header display. If
  // We should only output stuff that corresponds with that setting.
  //
  if (!EmitThisHeaderForPrefSetting(mHeaderDisplayType, field))
    return NS_OK;

  //
  // If we encounter the 'Date' header we try to convert it's value
  // into localized format.
  //
  if ( strcmp(field, "Date") == 0 )
    i18nValue = GetLocalizedDateString(value);
  else
    i18nValue = strdup(value);

  if ( (mUnicodeConverter) && (mFormat != nsMimeOutput::nsMimeMessageSaveAs) )
  {
    nsCString tValue;

    // we're going to need a converter to convert
    nsresult rv = mUnicodeConverter->DecodeMimeHeaderToUTF8(
      nsDependentCString(i18nValue), nullptr, false, true, tValue);
    if (NS_SUCCEEDED(rv) && !tValue.IsEmpty())
      newValue = MsgEscapeHTML(tValue.get());
    else
      newValue = MsgEscapeHTML(i18nValue);
  }
  else
  {
    newValue = MsgEscapeHTML(i18nValue);
  }

  free(i18nValue);

  if (!newValue)
    return NS_OK;

  mHTMLHeaders.Append("<tr>");
  mHTMLHeaders.Append("<td>");

  if (mFormat == nsMimeOutput::nsMimeMessageSaveAs)
    mHTMLHeaders.Append("<b>");
  else
    mHTMLHeaders.Append("<div class=\"headerdisplayname\" style=\"display:inline;\">");

  // Here is where we are going to try to L10N the tagName so we will always
  // get a field name next to an emitted header value. Note: Default will always
  // be the name of the header itself.
  //
  nsCString newTagName(field);
  newTagName.StripWhitespace();
  ToUpperCase(newTagName);

  char *l10nTagName = LocalizeHeaderName(newTagName.get(), field);
  if ( (!l10nTagName) || (!*l10nTagName) )
    mHTMLHeaders.Append(field);
  else
  {
    mHTMLHeaders.Append(l10nTagName);
    PR_FREEIF(l10nTagName);
  }

  mHTMLHeaders.Append(": ");
  if (mFormat == nsMimeOutput::nsMimeMessageSaveAs)
    mHTMLHeaders.Append("</b>");
  else
    mHTMLHeaders.Append("</div>");

  // Now write out the actual value itself and move on!
  //
  mHTMLHeaders.Append(newValue);
  mHTMLHeaders.Append("</td>");

  mHTMLHeaders.Append("</tr>");

  PR_FREEIF(newValue);
  return NS_OK;
}

nsresult
nsMimeBaseEmitter::WriteHeaderFieldHTMLPrefix(const nsACString &name)
{
  if (
      ( (mFormat == nsMimeOutput::nsMimeMessageSaveAs) && (mFirstHeaders) ) ||
      ( (mFormat == nsMimeOutput::nsMimeMessagePrintOutput) && (mFirstHeaders) )
     )
     /* DO NOTHING */ ;   // rhp: Do nothing...leaving the conditional like this so its
                          //      easier to see the logic of what is going on.
  else {
    mHTMLHeaders.Append("<br><fieldset class=\"mimeAttachmentHeader\">");
    if (!name.IsEmpty()) {
      mHTMLHeaders.Append("<legend class=\"mimeAttachmentHeaderName\">");
      nsCString escapedName;
      escapedName.Adopt(MsgEscapeHTML(nsCString(name).get()));
      mHTMLHeaders.Append(escapedName);
      mHTMLHeaders.Append("</legend>");
    }
    mHTMLHeaders.Append("</fieldset>");
  }

  mFirstHeaders = false;
  return NS_OK;
}

nsresult
nsMimeBaseEmitter::WriteHeaderFieldHTMLPostfix()
{
  mHTMLHeaders.Append("<br>");
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::WriteHTMLHeaders(const nsACString &name)
{
  WriteHeaderFieldHTMLPrefix(name);

  // Start with the subject, from date info!
  DumpSubjectFromDate();

  // Continue with the to and cc headers
  DumpToCC();

  // Do the rest of the headers, but these will only be written if
  // the user has the "show all headers" pref set
  if (mHeaderDisplayType == nsMimeHeaderDisplayTypes::AllHeaders)
    DumpRestOfHeaders();

  WriteHeaderFieldHTMLPostfix();

  // Now, we need to either append the headers we built up to the
  // overall body or output to the stream.
  UtilityWriteCRLF(mHTMLHeaders.get());

  mHTMLHeaders = "";

  return NS_OK;
}

nsresult
nsMimeBaseEmitter::DumpSubjectFromDate()
{
  mHTMLHeaders.Append("<table border=0 cellspacing=0 cellpadding=0 width=\"100%\" class=\"header-part1\">");

    // This is the envelope information
    OutputGenericHeader(HEADER_SUBJECT);
    OutputGenericHeader(HEADER_FROM);
    OutputGenericHeader(HEADER_DATE);

    // If we are Quoting a message, then we should dump the To: also
    if ( ( mFormat == nsMimeOutput::nsMimeMessageQuoting ) ||
         ( mFormat == nsMimeOutput::nsMimeMessageBodyQuoting ) )
      OutputGenericHeader(HEADER_TO);

  mHTMLHeaders.Append("</table>");

  return NS_OK;
}

nsresult
nsMimeBaseEmitter::DumpToCC()
{
  const char * toField = GetHeaderValue(HEADER_TO);
  const char * ccField = GetHeaderValue(HEADER_CC);
  const char * bccField = GetHeaderValue(HEADER_BCC);
  const char * newsgroupField = GetHeaderValue(HEADER_NEWSGROUPS);

  // only dump these fields if we have at least one of them! When displaying news
  // messages that didn't have a To or Cc field, we'd always get an empty box
  // which looked weird.
  if (toField || ccField || bccField || newsgroupField)
  {
    mHTMLHeaders.Append("<table border=0 cellspacing=0 cellpadding=0 width=\"100%\" class=\"header-part2\">");

    if (toField)
      WriteHeaderFieldHTML(HEADER_TO, toField);
    if (ccField)
      WriteHeaderFieldHTML(HEADER_CC, ccField);
    if (bccField)
      WriteHeaderFieldHTML(HEADER_BCC, bccField);
    if (newsgroupField)
      WriteHeaderFieldHTML(HEADER_NEWSGROUPS, newsgroupField);

    mHTMLHeaders.Append("</table>");
  }

  return NS_OK;
}

nsresult
nsMimeBaseEmitter::DumpRestOfHeaders()
{
  int32_t     i;
  nsVoidArray *array = mDocHeader? mHeaderArray : mEmbeddedHeaderArray;

  mHTMLHeaders.Append("<table border=0 cellspacing=0 cellpadding=0 width=\"100%\" class=\"header-part3\">");

  for (i = 0; i < array->Count(); i++)
  {
    headerInfoType *headerInfo = (headerInfoType *)array->ElementAt(i);
    if ( (!headerInfo) || (!headerInfo->name) || (!(*headerInfo->name)) ||
      (!headerInfo->value) || (!(*headerInfo->value)))
      continue;

    if ( (!PL_strcasecmp(HEADER_SUBJECT, headerInfo->name)) ||
      (!PL_strcasecmp(HEADER_DATE, headerInfo->name)) ||
      (!PL_strcasecmp(HEADER_FROM, headerInfo->name)) ||
      (!PL_strcasecmp(HEADER_TO, headerInfo->name)) ||
      (!PL_strcasecmp(HEADER_CC, headerInfo->name)) )
      continue;

    WriteHeaderFieldHTML(headerInfo->name, headerInfo->value);
  }

  mHTMLHeaders.Append("</table>");
  return NS_OK;
}

nsresult
nsMimeBaseEmitter::OutputGenericHeader(const char *aHeaderVal)
{
  const char *val = GetHeaderValue(aHeaderVal);

  if (val)
    return WriteHeaderFieldHTML(aHeaderVal, val);

  return NS_ERROR_FAILURE;
}

//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
// These are the methods that should be implemented by the child class!
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////

//
// This should be implemented by the child class if special processing
// needs to be done when the entire message is read.
//
NS_IMETHODIMP
nsMimeBaseEmitter::Complete()
{
  // If we are here and still have data to write, we should try
  // to flush it...if we try and fail, we should probably return
  // an error!
  uint32_t      written;

  nsresult rv = NS_OK;
  while ( NS_SUCCEEDED(rv) && (mBufferMgr) && (mBufferMgr->GetSize() > 0))
    rv = Write(EmptyCString(), &written);

  if (mOutListener)
  {
    uint64_t bytesInStream = 0;
    nsresult rv2 = mInputStream->Available(&bytesInStream);
    NS_ASSERTION(NS_SUCCEEDED(rv2), "Available failed");
    if (bytesInStream)
    {
      nsCOMPtr<nsIRequest> request = do_QueryInterface(mChannel);
      mOutListener->OnDataAvailable(request, mURL, mInputStream, 0, std::min(bytesInStream, uint64_t(PR_UINT32_MAX)));
    }
  }

  return NS_OK;
}

//
// This needs to do the right thing with the stored information. It only
// has to do the output functions, this base class will take care of the
// memory cleanup
//
NS_IMETHODIMP
nsMimeBaseEmitter::EndHeader(const nsACString &name)
{
  return NS_OK;
}

// body handling routines
NS_IMETHODIMP
nsMimeBaseEmitter::StartBody(bool bodyOnly, const char *msgID, const char *outCharset)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::WriteBody(const nsACString &buf, uint32_t *amountWritten)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMimeBaseEmitter::EndBody()
{
  return NS_OK;
}
