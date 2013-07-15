/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsSMIMEStub.h"

#include "mimecth.h"
#include "mimexpcom.h"
#include "nsIStringBundle.h"
#include "prmem.h"
#include "plstr.h"
#include "mozilla/Services.h"

#define SMIME_PROPERTIES_URL          "chrome://messenger/locale/smime.properties"
#define SMIME_STR_NOT_SUPPORTED_ID    1000

static char *SMimeGetStringByID(int32_t aMsgId)
{
  nsCOMPtr<nsIStringBundleService> stringBundleService =
    mozilla::services::GetStringBundleService();

  nsCOMPtr<nsIStringBundle> stringBundle;
  stringBundleService->CreateBundle(SMIME_PROPERTIES_URL,
                                    getter_AddRefs(stringBundle));
  if (stringBundle)
  {
    nsString v;
    if (NS_SUCCEEDED(stringBundle->GetStringFromID(aMsgId, getter_Copies(v))))
      return ToNewUTF8String(v);
  }

  return strdup("???");
}

static int MimeInlineTextSMIMEStub_parse_line (const char *, int32_t, MimeObject *);
static int MimeInlineTextSMIMEStub_parse_eof (MimeObject *, bool);
static int MimeInlineTextSMIMEStub_parse_begin (MimeObject *obj);

 /* This is the object definition. Note: we will set the superclass
    to NULL and manually set this on the class creation */

MimeDefClass(MimeInlineTextSMIMEStub, MimeInlineTextSMIMEStubClass, mimeInlineTextSMIMEStubClass, NULL);

extern "C" MimeObjectClass *
MIME_SMimeCreateContentTypeHandlerClass(const char *content_type,
                                   contentTypeHandlerInitStruct *initStruct)
{
  MimeObjectClass *clazz = (MimeObjectClass *)&mimeInlineTextSMIMEStubClass;
  /*
   * Must set the superclass by hand.
   */
  if (!COM_GetmimeInlineTextClass())
    return NULL;

  clazz->superclass = (MimeObjectClass *)COM_GetmimeInlineTextClass();
  initStruct->force_inline_display = true;
  return clazz;
}

static int
MimeInlineTextSMIMEStubClassInitialize(MimeInlineTextSMIMEStubClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  NS_ASSERTION(!oclass->class_initialized, "1.1 <rhp@netscape.com> 28 Nov 1999 19:36");
  oclass->parse_begin = MimeInlineTextSMIMEStub_parse_begin;
  oclass->parse_line  = MimeInlineTextSMIMEStub_parse_line;
  oclass->parse_eof   = MimeInlineTextSMIMEStub_parse_eof;

  return 0;
}

int
GenerateMessage(char** html)
{
  nsCString temp;
  temp.Append("<BR><text=\"#000000\" bgcolor=\"#FFFFFF\" link=\"#FF0000\" vlink=\"#800080\" alink=\"#0000FF\">");
  temp.Append("<center><table BORDER=1 ><tr><td><CENTER>");

  char *tString = SMimeGetStringByID(SMIME_STR_NOT_SUPPORTED_ID);
  temp.Append(tString);
  PR_FREEIF(tString);

  temp.Append("</CENTER></td></tr></table></center><BR>");
  *html = ToNewCString(temp);
  return 0;
}

static int
MimeInlineTextSMIMEStub_parse_begin(MimeObject *obj)
{
  MimeInlineTextSMIMEStubClass *clazz;
  int status = ((MimeObjectClass*)COM_GetmimeLeafClass())->parse_begin(obj);

  if (status < 0)
    return status;

  if (!obj->output_p || !obj->options || !obj->options->write_html_p)
    return 0;

  /* This is a fine place to write out any HTML before the real meat begins. */

  // Initialize the clazz variable...
  clazz = ((MimeInlineTextSMIMEStubClass *) obj->clazz);
  return 0;
}

static int
MimeInlineTextSMIMEStub_parse_line(const char *line, int32_t length, MimeObject *obj)
{
 /*
  * This routine gets fed each line of data, one at a time. We just buffer
  * it all up, to be dealt with all at once at the end.
  */
  if (!obj->output_p || !obj->options || !obj->options->output_fn)
    return 0;

  if (!obj->options->write_html_p)
    return COM_MimeObject_write(obj, line, length, true);

  return 0;
}

static int
MimeInlineTextSMIMEStub_parse_eof (MimeObject *obj, bool abort_p)
{
  if (obj->closed_p)
    return 0;

  /* Run parent method first, to flush out any buffered data. */
  int status = ((MimeObjectClass*)COM_GetmimeInlineTextClass())->parse_eof(obj, abort_p);
  if (status < 0)
    return status;

  if (  (obj->options) &&
        ((obj->options->format_out == nsMimeOutput::nsMimeMessageQuoting) ||
         (obj->options->format_out == nsMimeOutput::nsMimeMessageBodyQuoting))
     )
    return 0;

  char* html = NULL;
  status = GenerateMessage(&html);
  if (status < 0)
    return status;

  status = COM_MimeObject_write(obj, html, PL_strlen(html), true);
  PR_FREEIF(html);
  if (status < 0)
    return status;

  return 0;
}
