/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <stdio.h>
#include "nsMimeRebuffer.h"
#include "nsMimeXmlEmitter.h"
#include "plstr.h"
#include "nsMailHeaders.h"
#include "nscore.h"
#include "prmem.h"
#include "nsEmitterUtils.h"
#include "nsCOMPtr.h"
#include "nsUnicharUtils.h"
#include "nsMsgUtils.h"

/*
 * nsMimeXmlEmitter definitions....
 */
nsMimeXmlEmitter::nsMimeXmlEmitter()
{
}


nsMimeXmlEmitter::~nsMimeXmlEmitter(void)
{
}


// Note - this is teardown only...you should not write
// anything to the stream since these may be image data
// output streams, etc...
nsresult
nsMimeXmlEmitter::Complete()
{
  char  buf[16];

  // Now write out the total count of attachments for this message
  UtilityWrite("<mailattachcount>");
  sprintf(buf, "%d", mAttachCount);
  UtilityWrite(buf);
  UtilityWrite("</mailattachcount>");

  UtilityWrite("</message>");

  return nsMimeBaseEmitter::Complete();

}

nsresult
nsMimeXmlEmitter::WriteXMLHeader(const char *msgID)
{
  if ( (!msgID) || (!*msgID) )
    msgID = "none";

  char  *newValue = MsgEscapeHTML(msgID);
  if (!newValue)
    return NS_ERROR_OUT_OF_MEMORY;

  UtilityWrite("<?xml version=\"1.0\"?>");

  UtilityWriteCRLF("<?xml-stylesheet href=\"chrome://messagebody/skin/messageBody.css\" type=\"text/css\"?>");

  UtilityWrite("<message id=\"");
  UtilityWrite(newValue);
  UtilityWrite("\">");

  mXMLHeaderStarted = true;
  PR_FREEIF(newValue);
  return NS_OK;
}

nsresult
nsMimeXmlEmitter::WriteXMLTag(const char *tagName, const char *value)
{
  if ( (!value) || (!*value) )
    return NS_OK;

  char  *upCaseTag = NULL;
  char  *newValue = MsgEscapeHTML(value);
  if (!newValue)
    return NS_OK;

  nsCString newTagName(tagName);
  newTagName.StripWhitespace();
  ToUpperCase(newTagName);
  upCaseTag = ToNewCString(newTagName);

  UtilityWrite("<header field=\"");
  UtilityWrite(upCaseTag);
  UtilityWrite("\">");

  // Here is where we are going to try to L10N the tagName so we will always
  // get a field name next to an emitted header value. Note: Default will always
  // be the name of the header itself.
  //
  UtilityWrite("<headerdisplayname>");
  char *l10nTagName = LocalizeHeaderName(upCaseTag, tagName);
  if ( (!l10nTagName) || (!*l10nTagName) )
    UtilityWrite(tagName);
  else
  {
    UtilityWrite(l10nTagName);
    PR_FREEIF(l10nTagName);
  }

  UtilityWrite(": ");
  UtilityWrite("</headerdisplayname>");

  // Now write out the actual value itself and move on!
  //
  UtilityWrite(newValue);
  UtilityWrite("</header>");

  NS_Free(upCaseTag);
  PR_FREEIF(newValue);

  return NS_OK;
}

// Header handling routines.
nsresult
nsMimeXmlEmitter::StartHeader(bool rootMailHeader, bool headerOnly, const char *msgID,
                           const char *outCharset)
{
  mDocHeader = rootMailHeader;
  WriteXMLHeader(msgID);
  UtilityWrite("<mailheader>");

  return NS_OK;
}

nsresult
nsMimeXmlEmitter::AddHeaderField(const char *field, const char *value)
{
  if ( (!field) || (!value) )
    return NS_OK;

  WriteXMLTag(field, value);
  return NS_OK;
}

nsresult
nsMimeXmlEmitter::EndHeader()
{
  UtilityWrite("</mailheader>");
  return NS_OK;
}


// Attachment handling routines
nsresult
nsMimeXmlEmitter::StartAttachment(const nsACString &name,
                                  const char *contentType,
                                  const char *url,
                                  bool aIsExternalAttachment)
{
  char    buf[128];

  ++mAttachCount;

  sprintf(buf, "<mailattachment id=\"%d\">", mAttachCount);
  UtilityWrite(buf);

  AddAttachmentField(HEADER_PARM_FILENAME, PromiseFlatCString(name).get());
  return NS_OK;
}

nsresult
nsMimeXmlEmitter::AddAttachmentField(const char *field, const char *value)
{
  WriteXMLTag(field, value);
  return NS_OK;
}

nsresult
nsMimeXmlEmitter::EndAttachment()
{
  UtilityWrite("</mailattachment>");
  return NS_OK;
}


