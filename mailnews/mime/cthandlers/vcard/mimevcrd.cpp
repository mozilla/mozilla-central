/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mimevcrd.h"
 
#include "mimecth.h"
#include "mimexpcom.h"
#include "nsIMsgVCardService.h"
#include "nsINetUtil.h"
#include "nsMsgUtils.h"
#include "prmem.h"
#include "prprf.h"
#include "nsServiceManagerUtils.h"

static int MimeInlineTextVCard_parse_line (const char *, int32_t, MimeObject *);
static int MimeInlineTextVCard_parse_eof (MimeObject *, bool);
static int MimeInlineTextVCard_parse_begin (MimeObject *obj);

static int s_unique = 0;

static int BeginVCard (MimeObject *obj);
static int EndVCard (MimeObject *obj);
static int WriteOutVCard (MimeObject *obj, VObject* v);

static int GenerateVCardData(MimeObject * aMimeObj, VObject* aVcard);
static int OutputVcardAttribute(MimeObject *aMimeObj, VObject *aVcard, const char* id, nsACString& vCardOutput);
static int OutputBasicVcard(MimeObject *aMimeObj, VObject *aVcard, nsACString& vCardOutput);

typedef struct
  {
    const char *attributeName;
    int resourceId;
  } AttributeName;

#define kNumAttributes 12

#define     MSGVCARDSERVICE_CONTRACT_ID "@mozilla.org/addressbook/msgvcardservice;1"

/* This is the object definition. Note: we will set the superclass
   to NULL and manually set this on the class creation */
MimeDefClass(MimeInlineTextVCard, MimeInlineTextVCardClass,
             mimeInlineTextVCardClass, NULL);

extern "C" MimeObjectClass *
MIME_VCardCreateContentTypeHandlerClass(const char *content_type,
                                   contentTypeHandlerInitStruct *initStruct)
{
  MimeObjectClass *clazz = (MimeObjectClass *)&mimeInlineTextVCardClass;
  /*
   * Must set the superclass by hand.
   */
  if (!COM_GetmimeInlineTextClass())
    return NULL;

  clazz->superclass = (MimeObjectClass *)COM_GetmimeInlineTextClass();
  initStruct->force_inline_display = true;
  return clazz;
}

/*
 * Implementation of VCard clazz
 */
static int
MimeInlineTextVCardClassInitialize(MimeInlineTextVCardClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  NS_ASSERTION(!oclass->class_initialized, "1.1 <rhp@netscape.com> 19 Mar 1999 12:11");
  oclass->parse_begin = MimeInlineTextVCard_parse_begin;
  oclass->parse_line  = MimeInlineTextVCard_parse_line;
  oclass->parse_eof   = MimeInlineTextVCard_parse_eof;
  return 0;
}

static int
MimeInlineTextVCard_parse_begin (MimeObject *obj)
{
  int status = ((MimeObjectClass*)COM_GetmimeLeafClass())->parse_begin(obj);
  MimeInlineTextVCardClass *clazz;
  if (status < 0) return status;

  if (!obj->output_p) return 0;
  if (!obj->options || !obj->options->write_html_p) return 0;

  /* This is a fine place to write out any HTML before the real meat begins.
  In this sample code, we tell it to start a table. */

  clazz = ((MimeInlineTextVCardClass *) obj->clazz);
  /* initialize vcard string to empty; */
  NS_MsgSACopy(&(clazz->vCardString), "");

  obj->options->state->separator_suppressed_p = true;
  return 0;
}

char *strcpySafe (char *dest, const char *src, size_t destLength)
{
  char *result = strncpy (dest, src, --destLength);
  dest[destLength] = '\0';
  return result;
}

static int
MimeInlineTextVCard_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  // This routine gets fed each line of data, one at a time.
  char* linestring;
  MimeInlineTextVCardClass *clazz = ((MimeInlineTextVCardClass *) obj->clazz);

  if (!obj->output_p) return 0;
  if (!obj->options || !obj->options->output_fn) return 0;
  if (!obj->options->write_html_p)
  {
    return COM_MimeObject_write(obj, line, length, true);
  }

  linestring = (char *) PR_MALLOC (length + 1);
  memset(linestring, 0, (length + 1));

  if (linestring)
  {
    strcpySafe((char *)linestring, line, length + 1);
    NS_MsgSACat (&clazz->vCardString, linestring);
    PR_Free (linestring);
  }

  return 0;
}


////////////////////////////////////////////////////////////////////////////////
static int
MimeInlineTextVCard_parse_eof (MimeObject *obj, bool abort_p)
{
  nsCOMPtr<nsIMsgVCardService> vCardService =
             do_GetService(MSGVCARDSERVICE_CONTRACT_ID);
  if (!vCardService)
      return -1;

  int status = 0;
  MimeInlineTextVCardClass *clazz = ((MimeInlineTextVCardClass *) obj->clazz);

  VObject *t, *v;

  if (obj->closed_p) return 0;

  /* Run parent method first, to flush out any buffered data. */
  //    status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
  status = ((MimeObjectClass*)COM_GetmimeInlineTextClass())->parse_eof(obj, abort_p);
  if (status < 0) return status;

  // Don't quote vCards...
  if (  (obj->options) &&
    ((obj->options->format_out == nsMimeOutput::nsMimeMessageQuoting) ||
    (obj->options->format_out == nsMimeOutput::nsMimeMessageBodyQuoting))
    )
    return 0;

  if (!clazz->vCardString) return 0;

  v = vCardService->Parse_MIME(clazz->vCardString, strlen(clazz->vCardString));
  NS_ASSERTION(v, "parse of vCard failed");

  if (clazz->vCardString) {
    PR_Free ((char*) clazz->vCardString);
    clazz->vCardString = NULL;
  }

  if (obj->output_p && obj->options && obj->options->write_html_p &&
    obj->options->headers != MimeHeadersCitation) {
    /* This is a fine place to write any closing HTML.  In fact, you may
    want all the writing to be here, and all of the above would just
    collect data into datastructures, though that isn't very
    "streaming". */
    t = v;
    while (v && status >= 0) {
      /* write out html */
      status = WriteOutVCard (obj, v);
      /* parse next vcard incase they're embedded */
      v = vCardService->NextVObjectInList(v);
    }

    (void)vCardService->CleanVObject(t);
  }

  if (status < 0)
    return status;

  return 0;
}

static int EndVCard (MimeObject *obj)
{
  int status = 0;

  /* Scribble HTML-ending stuff into the stream */
  char htmlFooters[32];
  PR_snprintf (htmlFooters, sizeof(htmlFooters), "</BODY>%s</HTML>%s", MSG_LINEBREAK, MSG_LINEBREAK);
  status = COM_MimeObject_write(obj, htmlFooters, strlen(htmlFooters), false);

  if (status < 0) return status;

  return 0;
}

static int BeginVCard (MimeObject *obj)
{
  int status = 0;

  /* Scribble HTML-starting stuff into the stream */
  char htmlHeaders[32];

  s_unique++;
  PR_snprintf (htmlHeaders, sizeof(htmlHeaders), "<HTML>%s<BODY>%s", MSG_LINEBREAK, MSG_LINEBREAK);
    status = COM_MimeObject_write(obj, htmlHeaders, strlen(htmlHeaders), true);

  if (status < 0) return status;

  return 0;
}


static int WriteOutVCard (MimeObject * aMimeObj, VObject* aVcard)
{
  BeginVCard (aMimeObj);

  GenerateVCardData(aMimeObj, aVcard);

  return EndVCard (aMimeObj);
}


static int GenerateVCardData(MimeObject * aMimeObj, VObject* aVcard)
{
  // style is driven from CSS not here. Just layout the minimal vCard data
  nsCString vCardOutput;

  vCardOutput = "<table class=\"moz-vcard-table\"> <tr> ";  // outer table plus the first (and only row) we use for this table

  // we need to get an escaped vCard url to bind to our add to address book button
  nsCOMPtr<nsIMsgVCardService> vCardService = do_GetService(MSGVCARDSERVICE_CONTRACT_ID);
  if (!vCardService)
      return -1;

  nsAutoCString vCard;
  nsAutoCString vEscCard;
  int len = 0;

  vCard.Adopt(vCardService->WriteMemoryVObjects(0, &len, aVcard, false));
  MsgEscapeString(vCard, nsINetUtil::ESCAPE_XALPHAS, vEscCard);

  // first cell in the outer table row is a clickable image which brings up the rich address book UI for the vcard
  vCardOutput += "<td valign=\"top\"> <a class=\"moz-vcard-badge\" href=\"addbook:add?action=add?vcard=";
  vCardOutput += vEscCard; // the href is the vCard
  vCardOutput += "\"></a></td>";

  // the 2nd cell in the outer table row is a nested table containing the actual vCard properties
  vCardOutput += "<td> <table id=\"moz-vcard-properties-table\"> <tr> ";

  OutputBasicVcard(aMimeObj, aVcard, vCardOutput);

  // close the properties table
  vCardOutput += "</table> </td> ";

  // 2nd  cell in the outer table is our vCard image

  vCardOutput += "</tr> </table>";

  // now write out the vCard
  return COM_MimeObject_write(aMimeObj, (char *) vCardOutput.get(), vCardOutput.Length(), true);
}


static int OutputBasicVcard(MimeObject *aMimeObj, VObject *aVcard, nsACString& vCardOutput)
{
  int status = 0;

  VObject *prop = NULL;
  nsAutoCString urlstring;
  nsAutoCString namestring;
  nsAutoCString emailstring;

  nsCOMPtr<nsIMsgVCardService> vCardService =  do_GetService(MSGVCARDSERVICE_CONTRACT_ID);
  if (!vCardService)
      return -1;

  /* get the name and email */
  prop = vCardService->IsAPropertyOf(aVcard, VCFullNameProp);
  if (prop)
  {
    if (VALUE_TYPE(prop))
    {
      if (VALUE_TYPE(prop) != VCVT_RAW)
        namestring.Adopt(vCardService->FakeCString(prop));
      else
        namestring.Adopt(vCardService->VObjectAnyValue(prop));

      if (!namestring.IsEmpty())
      {
        vCardOutput += "<td class=\"moz-vcard-title-property\"> ";

        prop = vCardService->IsAPropertyOf(aVcard, VCURLProp);
        if (prop)
        {
          urlstring.Adopt(vCardService->FakeCString(prop));
          if (urlstring.IsEmpty())
            vCardOutput += namestring;
          else
          {
            char buf[512];
            PR_snprintf(buf, 512, "<a href=""%s"" private>%s</a>", urlstring.get(), namestring.get());
            vCardOutput.Append(buf);
          }
        }
        else
          vCardOutput += namestring;

        /* get the email address */
        prop = vCardService->IsAPropertyOf(aVcard, VCEmailAddressProp);
        if (prop)
        {
          emailstring.Adopt(vCardService->FakeCString(prop));
          if (!emailstring.IsEmpty())
          {
            char buf[512];
            PR_snprintf(buf, 512, "&nbsp;&lt;<a href=""mailto:%s"" private>%s</a>&gt;", emailstring.get(), emailstring.get());
            vCardOutput.Append(buf);
          }
        } // if email address property

        vCardOutput += "</td> </tr> "; // end the cell for the name/email address
      } // if we have a name property
    }
  } // if full name property

  // now each basic property goes on its own line

  // title
  status = OutputVcardAttribute (aMimeObj, aVcard, VCTitleProp, vCardOutput);

  // org name and company name
  prop = vCardService->IsAPropertyOf(aVcard, VCOrgProp);
  if (prop)
  {
    OutputVcardAttribute (aMimeObj, prop, VCOrgUnitProp, vCardOutput);
    OutputVcardAttribute (aMimeObj, prop, VCOrgNameProp, vCardOutput);
  }

  return 0;
}

static int OutputVcardAttribute(MimeObject *aMimeObj, VObject *aVcard, const char* id, nsACString& vCardOutput)
{
  VObject *prop = NULL;
  nsAutoCString string;

  nsCOMPtr<nsIMsgVCardService> vCardService = do_GetService(MSGVCARDSERVICE_CONTRACT_ID);
  if (!vCardService)
      return -1;

  prop = vCardService->IsAPropertyOf(aVcard, id);
  if (prop)
    if (VALUE_TYPE(prop))
    {
      if (VALUE_TYPE(prop) != VCVT_RAW)
        string.Adopt(vCardService->FakeCString(prop));
      else
        string.Adopt(vCardService->VObjectAnyValue(prop));

      if (!string.IsEmpty())
      {
        vCardOutput += "<tr> <td class=\"moz-vcard-property\">";
        vCardOutput += string;
        vCardOutput += "</td> </tr> ";
      }
    }

  return 0;
}
