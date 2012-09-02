/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Most of this code is copied from mimethpl; see there for source comments.
   If you find a bug here, check that class, too.
*/

#include "mimethsa.h"
#include "prmem.h"
#include "prlog.h"
#include "msgCore.h"
#include "mimemoz2.h"
#include "nsIPrefBranch.h"
#include "nsStringGlue.h"

//#define DEBUG_BenB

#define MIME_SUPERCLASS mimeInlineTextHTMLClass
MimeDefClass(MimeInlineTextHTMLSanitized, MimeInlineTextHTMLSanitizedClass,
       mimeInlineTextHTMLSanitizedClass, &MIME_SUPERCLASS);

static int MimeInlineTextHTMLSanitized_parse_line (const char *, int32_t,
                                                   MimeObject *);
static int MimeInlineTextHTMLSanitized_parse_begin (MimeObject *obj);
static int MimeInlineTextHTMLSanitized_parse_eof (MimeObject *, bool);
static void MimeInlineTextHTMLSanitized_finalize (MimeObject *obj);

static int
MimeInlineTextHTMLSanitizedClassInitialize(MimeInlineTextHTMLSanitizedClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  NS_ASSERTION(!oclass->class_initialized, "problem with superclass");
  oclass->parse_line  = MimeInlineTextHTMLSanitized_parse_line;
  oclass->parse_begin = MimeInlineTextHTMLSanitized_parse_begin;
  oclass->parse_eof   = MimeInlineTextHTMLSanitized_parse_eof;
  oclass->finalize    = MimeInlineTextHTMLSanitized_finalize;

  return 0;
}

static int
MimeInlineTextHTMLSanitized_parse_begin (MimeObject *obj)
{
#ifdef DEBUG_BenB
printf("parse_begin\n");
#endif
  MimeInlineTextHTMLSanitized *textHTMLSan =
                                       (MimeInlineTextHTMLSanitized *) obj;
  textHTMLSan->complete_buffer = new nsString();
#ifdef DEBUG_BenB
printf(" B1\n");
printf(" cbp: %d\n", textHTMLSan->complete_buffer);
#endif
  int status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_begin(obj);
  if (status < 0)
    return status;
#ifdef DEBUG_BenB
printf(" B2\n");
#endif

  // charset
  /* honestly, I don't know how that charset stuff works in libmime.
     The part in mimethtm doesn't make much sense to me either.
     I'll just dump the charset we get in the mime headers into a
     HTML meta http-equiv.
     XXX Not sure, if that is correct, though. */
  char *content_type =
    (obj->headers
     ? MimeHeaders_get(obj->headers, HEADER_CONTENT_TYPE, false, false)
     : 0);
  if (content_type)
  {
    char* charset = MimeHeaders_get_parameter(content_type,
                                              HEADER_PARM_CHARSET,
                                              NULL, NULL);
    PR_Free(content_type);
    if (charset)
    {
      nsAutoCString charsetline(
        "\n<meta http-equiv=\"Context-Type\" content=\"text/html; charset=");
      charsetline += charset;
      charsetline += "\">\n";
      int status = MimeObject_write(obj,
                                    charsetline.get(),
                                    charsetline.Length(),
                                    true);
      PR_Free(charset);
      if (status < 0)
        return status;
    }
  }
#ifdef DEBUG_BenB
printf("/parse_begin\n");
#endif
  return 0;
}

static int
MimeInlineTextHTMLSanitized_parse_eof (MimeObject *obj, bool abort_p)
{
#ifdef DEBUG_BenB
printf("parse_eof\n");
#endif

  if (obj->closed_p)
    return 0;
  int status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
  if (status < 0)
    return status;
  MimeInlineTextHTMLSanitized *textHTMLSan =
                                       (MimeInlineTextHTMLSanitized *) obj;

#ifdef DEBUG_BenB
printf(" cbp: %d\n", textHTMLSan->complete_buffer);
printf(" closed_p: %s\n", obj->closed_p?"true":"false");
#endif
  if (!textHTMLSan || !textHTMLSan->complete_buffer)
  {
#ifdef DEBUG_BenB
printf("/parse_eof (early exit)\n");
#endif
    return 0;
  }
#ifdef DEBUG_BenB
printf(" E1\n");
printf("buffer: -%s-\n", NS_LossyConvertUTF16toASCII(*textHTMLSan->complete_buffer).get());
#endif

#ifdef DEBUG_BenB
printf(" E2\n");
#endif
  nsString& cb = *(textHTMLSan->complete_buffer);
#ifdef DEBUG_BenB
printf(" E3\n");
#endif
  nsString sanitized;
#ifdef DEBUG_BenB
printf(" E4\n");
#endif
  HTMLSanitize(cb, sanitized);
#ifdef DEBUG_BenB
printf(" E5\n");
#endif

  NS_ConvertUTF16toUTF8 resultCStr(sanitized);
#ifdef DEBUG_BenB
printf(" E6\n");
#endif
  // TODO parse each line independently
  /* That function doesn't work correctly, if the first META tag is no
     charset spec. (It assumes that it's on its own line.)
     Most likely not fatally wrong, however. */
  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_line(
                             resultCStr.BeginWriting(),
                             resultCStr.Length(),
                             obj);
#ifdef DEBUG_BenB
printf(" E7\n");
#endif

#ifdef DEBUG_BenB
printf(" E8\n");
#endif

  cb.Truncate();

#ifdef DEBUG_BenB
printf("/parse_eof\n");
#endif

  return status;
}

void
MimeInlineTextHTMLSanitized_finalize (MimeObject *obj)
{
#ifdef DEBUG_BenB
printf("finalize\n");
#endif
  MimeInlineTextHTMLSanitized *textHTMLSan =
                                        (MimeInlineTextHTMLSanitized *) obj;
#ifdef DEBUG_BenB
printf(" cbp: %d\n", textHTMLSan->complete_buffer);
printf(" F1\n");
#endif

  if (textHTMLSan && textHTMLSan->complete_buffer)
  {
    obj->clazz->parse_eof(obj, false);
#ifdef DEBUG_BenB
printf(" F2\n");
#endif
    delete textHTMLSan->complete_buffer;
#ifdef DEBUG_BenB
printf(" cbp: %d\n", textHTMLSan->complete_buffer);
printf(" F3\n");
#endif
    textHTMLSan->complete_buffer = NULL;
  }

#ifdef DEBUG_BenB
printf(" cbp: %d\n", textHTMLSan->complete_buffer);
printf(" F4\n");
#endif
  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize (obj);
#ifdef DEBUG_BenB
printf("/finalize\n");
#endif
}

static int
MimeInlineTextHTMLSanitized_parse_line (const char *line, int32_t length,
                                          MimeObject *obj)
{
#ifdef DEBUG_BenB
printf("p");
#endif
  MimeInlineTextHTMLSanitized *textHTMLSan =
                                       (MimeInlineTextHTMLSanitized *) obj;
#ifdef DEBUG_BenB
printf("%d", textHTMLSan->complete_buffer);
#endif

  if (!textHTMLSan || !(textHTMLSan->complete_buffer))
  {
#ifdef DEBUG
printf("Can't output: %s\n", line);
#endif
    return -1;
  }

  nsCString linestr(line, length);
  NS_ConvertUTF8toUTF16 line_ucs2(linestr.get());
  if (length && line_ucs2.IsEmpty())
    CopyASCIItoUTF16(linestr, line_ucs2);
  (textHTMLSan->complete_buffer)->Append(line_ucs2);

#ifdef DEBUG_BenB
printf("l ");
#endif
  return 0;
}
