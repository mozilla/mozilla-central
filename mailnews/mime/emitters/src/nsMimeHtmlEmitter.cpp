/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 *   Henrik Gemal <mozilla@gemal.dk>
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
#include "nsCOMPtr.h"
#include <stdio.h>
#include "nsMimeRebuffer.h"
#include "nsMimeHtmlEmitter.h"
#include "plstr.h"
#include "nsMailHeaders.h"
#include "nscore.h"
#include "nsEmitterUtils.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIMimeStreamConverter.h"
#include "nsIMsgWindow.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsMimeTypes.h"
#include "prtime.h"
#include "prprf.h"
#include "nsIStringEnumerator.h"
#include "nsStringEnumerator.h"
#include "nsServiceManagerUtils.h"
// hack: include this to fix opening news attachments.
#include "nsINntpUrl.h"
#include "nsComponentManagerUtils.h"
#include "nsIMimeConverter.h"
#include "nsMsgMimeCID.h"
#include "nsDateTimeFormatCID.h"
#include "nsMsgUtils.h"
#include "nsAutoPtr.h"
#include "nsINetUtil.h"
#include "nsMemory.h"
#include "nsTextFormatter.h"

#define VIEW_ALL_HEADERS 2

/**
 * A helper class to implement nsIUTF8StringEnumerator
 */

class nsMimeStringEnumerator : public nsIUTF8StringEnumerator {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIUTF8STRINGENUMERATOR

  nsMimeStringEnumerator() : mCurrentIndex(0) {}

  template<class T>
  nsCString* Append(T value) { return mValues.AppendElement(value); }

protected:
  nsTArray<nsCString> mValues;
  PRUint32 mCurrentIndex; // consumers expect first-in first-out enumeration
};

NS_IMPL_ISUPPORTS1(nsMimeStringEnumerator, nsIUTF8StringEnumerator)

NS_IMETHODIMP
nsMimeStringEnumerator::HasMore(PRBool *result)
{
  NS_ENSURE_ARG_POINTER(result);
  *result = mCurrentIndex < mValues.Length();
  return NS_OK;
}

NS_IMETHODIMP
nsMimeStringEnumerator::GetNext(nsACString& result)
{
  if (mCurrentIndex >= mValues.Length())
    return NS_ERROR_UNEXPECTED;

  result = mValues[mCurrentIndex++];
  return NS_OK;
}

/*
 * nsMimeHtmlEmitter definitions....
 */
nsMimeHtmlDisplayEmitter::nsMimeHtmlDisplayEmitter() : nsMimeBaseEmitter()
{
  mFirst = PR_TRUE;
  mSkipAttachment = PR_FALSE;
}

nsMimeHtmlDisplayEmitter::~nsMimeHtmlDisplayEmitter(void)
{
}

nsresult nsMimeHtmlDisplayEmitter::Init()
{
  return NS_OK;
}

PRBool nsMimeHtmlDisplayEmitter::BroadCastHeadersAndAttachments()
{
  // try to get a header sink if there is one....
  nsCOMPtr<nsIMsgHeaderSink> headerSink;
  nsresult rv = GetHeaderSink(getter_AddRefs(headerSink));
  if (NS_SUCCEEDED(rv) && headerSink && mDocHeader)
    return PR_TRUE;
  else
    return PR_FALSE;
}

nsresult
nsMimeHtmlDisplayEmitter::WriteHeaderFieldHTMLPrefix()
{
  if (!BroadCastHeadersAndAttachments() || (mFormat == nsMimeOutput::nsMimeMessagePrintOutput))
    return nsMimeBaseEmitter::WriteHeaderFieldHTMLPrefix();
  else
    return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::WriteHeaderFieldHTML(const char *field, const char *value)
{
  if (!BroadCastHeadersAndAttachments() || (mFormat == nsMimeOutput::nsMimeMessagePrintOutput))
    return nsMimeBaseEmitter::WriteHeaderFieldHTML(field, value);
  else
    return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::WriteHeaderFieldHTMLPostfix()
{
  if (!BroadCastHeadersAndAttachments() || (mFormat == nsMimeOutput::nsMimeMessagePrintOutput))
    return nsMimeBaseEmitter::WriteHeaderFieldHTMLPostfix();
  else
    return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::GetHeaderSink(nsIMsgHeaderSink ** aHeaderSink)
{
  nsresult rv = NS_OK;
  if ( (mChannel) && (!mHeaderSink) )
  {
    nsCOMPtr<nsIURI> uri;
    mChannel->GetURI(getter_AddRefs(uri));
    if (uri)
    {
      nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(uri));
      if (msgurl)
      {
        msgurl->GetMsgHeaderSink(getter_AddRefs(mHeaderSink));
        if (!mHeaderSink)  // if the url is not overriding the header sink, then just get the one from the msg window
        {
        nsCOMPtr<nsIMsgWindow> msgWindow;
        msgurl->GetMsgWindow(getter_AddRefs(msgWindow));
        if (msgWindow)
          msgWindow->GetMsgHeaderSink(getter_AddRefs(mHeaderSink));
      }
    }
  }
  }

  *aHeaderSink = mHeaderSink;
  NS_IF_ADDREF(*aHeaderSink);
  return rv;
}

nsresult nsMimeHtmlDisplayEmitter::BroadcastHeaders(nsIMsgHeaderSink * aHeaderSink, PRInt32 aHeaderMode, PRBool aFromNewsgroup)
{
  // two string enumerators to pass out to the header sink
  nsRefPtr<nsMimeStringEnumerator> headerNameEnumerator = new nsMimeStringEnumerator();
  NS_ENSURE_TRUE(headerNameEnumerator, NS_ERROR_OUT_OF_MEMORY);
  nsRefPtr<nsMimeStringEnumerator> headerValueEnumerator = new nsMimeStringEnumerator();
  NS_ENSURE_TRUE(headerValueEnumerator, NS_ERROR_OUT_OF_MEMORY);

  nsCString extraExpandedHeaders;
  nsTArray<nsCString> extraExpandedHeadersArray;
  nsCAutoString convertedDateString;

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (pPrefBranch)
  {
    pPrefBranch->GetCharPref("mailnews.headers.extraExpandedHeaders", getter_Copies(extraExpandedHeaders));
    // todo - should make this upper case
    if (!extraExpandedHeaders.IsEmpty())
    {
      ToLowerCase(extraExpandedHeaders);
      ParseString(extraExpandedHeaders, ' ', extraExpandedHeadersArray);
    }

  }

  for (PRInt32 i=0; i<mHeaderArray->Count(); i++)
  {
    headerInfoType * headerInfo = (headerInfoType *) mHeaderArray->ElementAt(i);
    if ( (!headerInfo) || (!headerInfo->name) || (!(*headerInfo->name)) || (!headerInfo->value) || (!(*headerInfo->value)))
      continue;

    const char * headerValue = headerInfo->value;

    // optimization: if we aren't in view all header view mode, we only show a small set of the total # of headers.
    // don't waste time sending those out to the UI since the UI is going to ignore them anyway.
    if (aHeaderMode != VIEW_ALL_HEADERS && (mFormat != nsMimeOutput::nsMimeMessageFilterSniffer))
    {
      nsDependentCString headerStr(headerInfo->name);
      if (PL_strcasecmp("to", headerInfo->name) && PL_strcasecmp("from", headerInfo->name) &&
          PL_strcasecmp("cc", headerInfo->name) && PL_strcasecmp("newsgroups", headerInfo->name) &&
          PL_strcasecmp("bcc", headerInfo->name) && PL_strcasecmp("followup-to", headerInfo->name) &&
          PL_strcasecmp("reply-to", headerInfo->name) && PL_strcasecmp("subject", headerInfo->name) &&
          PL_strcasecmp("organization", headerInfo->name) && PL_strcasecmp("user-agent", headerInfo->name) &&
          PL_strcasecmp("content-base", headerInfo->name) && PL_strcasecmp("sender", headerInfo->name) &&
          PL_strcasecmp("date", headerInfo->name) && PL_strcasecmp("x-mailer", headerInfo->name) &&
          PL_strcasecmp("content-type", headerInfo->name) && PL_strcasecmp("message-id", headerInfo->name) &&
          PL_strcasecmp("x-newsreader", headerInfo->name) && PL_strcasecmp("x-mimeole", headerInfo->name) &&
          PL_strcasecmp("references", headerInfo->name) && PL_strcasecmp("in-reply-to", headerInfo->name) &&
          PL_strcasecmp("list-post", headerInfo->name) &&
          // make headerStr lower case because IndexOf is case-sensitive
         (!extraExpandedHeadersArray.Length() || (ToLowerCase(headerStr),
            extraExpandedHeadersArray.IndexOf(headerStr) ==
            extraExpandedHeadersArray.NoIndex)))
            continue;
    }

    if (!PL_strcasecmp("Date", headerInfo->name))
    {
      GenerateDateString(headerValue, convertedDateString);
      headerValueEnumerator->Append(convertedDateString);
    }
    else // append the header value as is
      headerValueEnumerator->Append(headerValue);

    headerNameEnumerator->Append(headerInfo->name);
  }

  aHeaderSink->ProcessHeaders(headerNameEnumerator, headerValueEnumerator, aFromNewsgroup);
  return rv;
}

NS_IMETHODIMP nsMimeHtmlDisplayEmitter::WriteHTMLHeaders()
{
  // if we aren't broadcasting headers OR printing...just do whatever
  // our base class does...
  if (mFormat == nsMimeOutput::nsMimeMessagePrintOutput)
  {
    return nsMimeBaseEmitter::WriteHTMLHeaders();
  }
  else if (!BroadCastHeadersAndAttachments() || !mDocHeader)
  {
    // This needs to be here to correct the output format if we are
    // not going to broadcast headers to the XUL document.
    if (mFormat == nsMimeOutput::nsMimeMessageBodyDisplay)
      mFormat = nsMimeOutput::nsMimeMessagePrintOutput;

    return nsMimeBaseEmitter::WriteHTMLHeaders();
  }
  else
    mFirstHeaders = PR_FALSE;

  PRBool bFromNewsgroups = PR_FALSE;
  for (PRInt32 j=0; j < mHeaderArray->Count(); j++)
  {
    headerInfoType *headerInfo = (headerInfoType *)mHeaderArray->ElementAt(j);
    if (!(headerInfo && headerInfo->name && *headerInfo->name))
      continue;

    if (!PL_strcasecmp("Newsgroups", headerInfo->name))
    {
      bFromNewsgroups = PR_TRUE;
    break;
    }
  }

  // try to get a header sink if there is one....
  nsCOMPtr<nsIMsgHeaderSink> headerSink;
  nsresult rv = GetHeaderSink(getter_AddRefs(headerSink));

  if (headerSink)
  {
  PRInt32 viewMode = 0;
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (pPrefBranch)
    rv = pPrefBranch->GetIntPref("mail.show_headers", &viewMode);

    rv = BroadcastHeaders(headerSink, viewMode, bFromNewsgroups);
  } // if header Sink

  return NS_OK;
}

nsresult nsMimeHtmlDisplayEmitter::GenerateDateString(const char * dateString, nsACString &formattedDate)
{
  nsresult rv = NS_OK;

  if (!mDateFormatter) {
    mDateFormatter = do_CreateInstance(NS_DATETIMEFORMAT_CONTRACTID, &rv);
    if (NS_FAILED(rv))
      return rv;
  }

  /**
   * See if the user wants to have the date displayed in the senders
   * timezone (including the timezone offset).
   * We also evaluate the pref original_date which was introduced
   * as makeshift in bug 118899.
   */
  PRBool displaySenderTimezone = PR_FALSE;
  PRBool displayOriginalDate = PR_FALSE;

  nsCOMPtr<nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIPrefBranch> dateFormatPrefs;
  rv = prefs->GetBranch("mailnews.display.", getter_AddRefs(dateFormatPrefs));
  NS_ENSURE_SUCCESS(rv, rv);

  dateFormatPrefs->GetBoolPref("date_senders_timezone", &displaySenderTimezone);
  dateFormatPrefs->GetBoolPref("original_date", &displayOriginalDate);
  // migrate old pref to date_senders_timezone
  if (displayOriginalDate && !displaySenderTimezone)
    dateFormatPrefs->SetBoolPref("date_senders_timezone", PR_TRUE);

  PRExplodedTime explodedMsgTime;
  rv = PR_ParseTimeStringToExplodedTime(dateString, PR_FALSE, &explodedMsgTime);
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

  // if the message is from today, don't show the date, only the time. (i.e. 3:15 pm)
  // if the message is from the last week, show the day of the week.   (i.e. Mon 3:15 pm)
  // in all other cases, show the full date (03/19/01 3:15 pm)
  nsDateFormatSelector dateFormat = kDateFormatShort;
  if (explodedCurrentTime.tm_year == explodedCompTime.tm_year &&
      explodedCurrentTime.tm_month == explodedCompTime.tm_month &&
      explodedCurrentTime.tm_mday == explodedCompTime.tm_mday)
  {
    // same day...
    dateFormat = kDateFormatNone;
  }
  // the following chunk of code causes us to show a day instead of a number if the message was received
  // within the last 7 days. i.e. Mon 5:10pm. We need to add a preference so folks to can enable this behavior
  // if they want it.
/*
  else if (LL_CMP(currentTime, >, dateOfMsg))
  {
    PRInt64 microSecondsPerSecond, secondsInDays, microSecondsInDays;
    LL_I2L(microSecondsPerSecond, PR_USEC_PER_SEC);
    LL_UI2L(secondsInDays, 60 * 60 * 24 * 7); // how many seconds in 7 days.....
    LL_MUL(microSecondsInDays, secondsInDays, microSecondsPerSecond); // turn that into microseconds

    PRInt64 diff;
    LL_SUB(diff, currentTime, dateOfMsg);
    if (LL_CMP(diff, <=, microSecondsInDays)) // within the same week
      dateFormat = kDateFormatWeekday;
  }
*/

  nsAutoString formattedDateString;
  if (NS_SUCCEEDED(rv))
  {
    rv = mDateFormatter->FormatPRExplodedTime(nsnull /* nsILocale* locale */,
                                              dateFormat,
                                              kTimeFormatNoSeconds,
                                              &explodedCompTime,
                                              formattedDateString);

    if (NS_SUCCEEDED(rv))
    {
      if (displaySenderTimezone)
      {
        // offset of local time from UTC in minutes
        PRInt32 senderoffset = (explodedMsgTime.tm_params.tp_gmt_offset + explodedMsgTime.tm_params.tp_dst_offset) / 60;
        // append offset to date string
        PRUnichar *tzstring = nsTextFormatter::smprintf(NS_LITERAL_STRING(" %+05d").get(), (senderoffset / 60 * 100) + (senderoffset % 60));
        formattedDateString.Append(tzstring);
        nsTextFormatter::smprintf_free(tzstring);
      }

      CopyUTF16toUTF8(formattedDateString, formattedDate);
    }
  }

  return rv;
}

nsresult
nsMimeHtmlDisplayEmitter::EndHeader()
{
  if (mDocHeader && (mFormat != nsMimeOutput::nsMimeMessageFilterSniffer))
  {
    UtilityWriteCRLF("<html>");
    UtilityWriteCRLF("<head>");

    const char * val = GetHeaderValue(HEADER_SUBJECT); // do not free this value
    if (val)
    {
      char * subject = MsgEscapeHTML(val);
      if (subject)
      {
        PRInt32 bufLen = strlen(subject) + 16;
        char *buf = new char[bufLen];
        if (!buf)
          return NS_ERROR_OUT_OF_MEMORY;
        PR_snprintf(buf, bufLen, "<title>%s</title>", subject);
        UtilityWriteCRLF(buf);
        delete [] buf;
        nsMemory::Free(subject);
      }
    }

    // Stylesheet info!
    UtilityWriteCRLF("<link rel=\"important stylesheet\" href=\"chrome://messagebody/skin/messageBody.css\">");

    UtilityWriteCRLF("</head>");
    UtilityWriteCRLF("<body>");
  }

  WriteHTMLHeaders();
  return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::StartAttachment(const nsACString &name,
                                          const char *contentType,
                                          const char *url,
                                          PRBool aIsExternalAttachment)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgHeaderSink> headerSink;
  rv = GetHeaderSink(getter_AddRefs(headerSink));

  if (NS_SUCCEEDED(rv) && headerSink)
  {
    nsCString uriString;

    nsCOMPtr<nsIMsgMessageUrl> msgurl (do_QueryInterface(mURL, &rv));
    if (NS_SUCCEEDED(rv))
    {
      // HACK: news urls require us to use the originalSpec. Everyone
      // else uses GetURI to get the RDF resource which describes the message.
      nsCOMPtr<nsINntpUrl> nntpUrl (do_QueryInterface(mURL, &rv));
      if (NS_SUCCEEDED(rv) && nntpUrl)
        rv = msgurl->GetOriginalSpec(getter_Copies(uriString));
      else
        rv = msgurl->GetUri(getter_Copies(uriString));
    }

    // we need to convert the attachment name from UTF-8 to unicode before
    // we emit it.  The attachment name has already been rfc2047 processed
    // upstream of us.  (Namely, mime_decode_filename has been called, deferring
    // to nsIMimeHeaderParam.decodeParameter.)
    nsString unicodeHeaderValue;
    CopyUTF8toUTF16(name, unicodeHeaderValue);

    headerSink->HandleAttachment(contentType, url /* was escapedUrl */,
                                 unicodeHeaderValue.get(), uriString.get(),
                                 aIsExternalAttachment);

    mSkipAttachment = PR_TRUE;
  }
  else if (mFormat == nsMimeOutput::nsMimeMessagePrintOutput)
  {
    // then we need to deal with the attachments in the body by inserting
    // them into a table..
    rv = StartAttachmentInBody(name, contentType, url);
  }
  else
  {
    // If we don't need or cannot broadcast attachment info, just ignore it
    mSkipAttachment = PR_TRUE;
    rv = NS_OK;
  }

  return rv;
}

// Attachment handling routines
// Ok, we are changing the way we handle these now...It used to be that we output
// HTML to make a clickable link, etc... but now, this should just be informational
// and only show up during printing
// XXX should they also show up during quoting?
nsresult
nsMimeHtmlDisplayEmitter::StartAttachmentInBody(const nsACString &name,
                                                const char *contentType,
                                                const char *url)
{
  mSkipAttachment = PR_FALSE;

  if ( (contentType) &&
       ((!strcmp(contentType, APPLICATION_XPKCS7_MIME)) ||
        (!strcmp(contentType, APPLICATION_XPKCS7_SIGNATURE)) ||
        (!strcmp(contentType, TEXT_VCARD)))
     ) {
     mSkipAttachment = PR_TRUE;
     return NS_OK;
  }

  if (!mFirst)
    UtilityWrite("<hr width=\"90%\" size=4>");

  mFirst = PR_FALSE;

  UtilityWrite("<center>");
  UtilityWrite("<table border>");
  UtilityWrite("<tr>");
  UtilityWrite("<td>");

  UtilityWrite("<div align=right class=\"headerdisplayname\" style=\"display:inline;\">");

  UtilityWrite(name);

  UtilityWrite("</div>");

  UtilityWrite("</td>");
  UtilityWrite("<td>");
  UtilityWrite("<table border=0>");
  return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::AddAttachmentField(const char *field, const char *value)
{
  if (mSkipAttachment || BroadCastHeadersAndAttachments())
    return NS_OK;

  // Don't let bad things happen
  if ( !value || !*value )
    return NS_OK;

  // Don't output this ugly header...
  if (!strcmp(field, HEADER_X_MOZILLA_PART_URL))
    return NS_OK;

  char  *newValue = MsgEscapeHTML(value);

  UtilityWrite("<tr>");

  UtilityWrite("<td>");
  UtilityWrite("<div align=right class=\"headerdisplayname\" style=\"display:inline;\">");

  UtilityWrite(field);
  UtilityWrite(":");
  UtilityWrite("</div>");
  UtilityWrite("</td>");
  UtilityWrite("<td>");

  UtilityWrite(newValue);

  UtilityWrite("</td>");
  UtilityWrite("</tr>");

  PR_Free(newValue);
  return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::EndAttachment()
{
  if (mSkipAttachment)
    return NS_OK;

  mSkipAttachment = PR_FALSE; // reset it for next attachment round

  if (BroadCastHeadersAndAttachments())
    return NS_OK;

  if (mFormat == nsMimeOutput::nsMimeMessagePrintOutput) {
    UtilityWrite("</table>");
    UtilityWrite("</td>");
    UtilityWrite("</tr>");

    UtilityWrite("</table>");
    UtilityWrite("</center>");
    UtilityWrite("<br>");
  }
  return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::EndAllAttachments()
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgHeaderSink> headerSink;
  rv = GetHeaderSink(getter_AddRefs(headerSink));
  if (headerSink)
    headerSink->OnEndAllAttachments();
  return rv;
}

nsresult
nsMimeHtmlDisplayEmitter::WriteBody(const nsACString &buf,
                                    PRUint32 *amountWritten)
{
  Write(buf, amountWritten);
  return NS_OK;
}

nsresult
nsMimeHtmlDisplayEmitter::EndBody()
{
  if (mFormat != nsMimeOutput::nsMimeMessageFilterSniffer)
  {
  UtilityWriteCRLF("</body>");
  UtilityWriteCRLF("</html>");
  }
  nsCOMPtr<nsIMsgHeaderSink> headerSink;
  nsresult rv = GetHeaderSink(getter_AddRefs(headerSink));
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl (do_QueryInterface(mURL, &rv));
  if (headerSink)
    headerSink->OnEndMsgHeaders(mailnewsUrl);

  return NS_OK;
}


