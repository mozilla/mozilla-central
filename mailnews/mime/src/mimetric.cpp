/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "mimetric.h"
#include "mimebuf.h"
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "msgCore.h"
#include <ctype.h>

#define MIME_SUPERCLASS mimeInlineTextClass
MimeDefClass(MimeInlineTextRichtext, MimeInlineTextRichtextClass,
       mimeInlineTextRichtextClass, &MIME_SUPERCLASS);

static int MimeInlineTextRichtext_parse_line (const char *, int32_t, MimeObject *);
static int MimeInlineTextRichtext_parse_begin (MimeObject *);
static int MimeInlineTextRichtext_parse_eof (MimeObject *, bool);

static int
MimeInlineTextRichtextClassInitialize(MimeInlineTextRichtextClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  PR_ASSERT(!oclass->class_initialized);
  oclass->parse_begin = MimeInlineTextRichtext_parse_begin;
  oclass->parse_line  = MimeInlineTextRichtext_parse_line;
  oclass->parse_eof   = MimeInlineTextRichtext_parse_eof;
  return 0;
}

/* This function has this clunky interface because it needs to be called
   from outside this module (no MimeObject, etc.)
 */
int
MimeRichtextConvert (const char *line, int32_t length,
           MimeObject *obj,
           char **obufferP,
           int32_t *obuffer_sizeP,
           bool enriched_p)
{
  /* RFC 1341 (the original MIME spec) defined text/richtext.
   RFC 1563 superceded text/richtext with text/enriched.
   The changes from text/richtext to text/enriched are:
    - CRLF semantics are different
    - << maps to <
    - These tags were added:
       <VERBATIM>, <NOFILL>, <PARAM>, <FLUSHBOTH>
    - These tags were removed:
       <COMMENT>, <OUTDENT>, <OUTDENTRIGHT>, <SAMEPAGE>, <SUBSCRIPT>,
         <SUPERSCRIPT>, <HEADING>, <FOOTING>, <PARAGRAPH>, <SIGNATURE>,
       <LT>, <NL>, <NP>
   This method implements them both.

   draft-resnick-text-enriched-03.txt is a proposed update to 1563.
    - These tags were added:
      <FONTFAMILY>, <COLOR>, <PARAINDENT>, <LANG>.
    However, all of these rely on the magic <PARAM> tag, which we
    don't implement, so we're ignoring all of these.
   Interesting fact: it's by Peter W. Resnick from Qualcomm (Eudora).
   And it also says "It is fully expected that other text formatting
   standards like HTML and SGML will supplant text/enriched in
   Internet mail."
   */
  int status = 0;
  char *out;
  const char *data_end;
  const char *last_end;
  const char *this_start;
  const char *this_end;
  unsigned int desired_size;

  // The code below must never expand the input by more than 5x;
  // if it does, the desired_size multiplier (5) below must be changed too
#define BGROWTH 5
  if ( (uint32_t)length >= ( (uint32_t) 0xfffffffe)/BGROWTH )
      return -1;
  desired_size = (length * BGROWTH) + 1;
#undef BGROWTH  
  if (desired_size >= (uint32_t) *obuffer_sizeP)
  status = mime_GrowBuffer (desired_size, sizeof(char), 1024,
               obufferP, obuffer_sizeP);
  if (status < 0) return status;

  if (enriched_p)
  {
    for (this_start = line; this_start < line + length; this_start++)
    if (!IS_SPACE (*this_start)) break;
    if (this_start >= line + length) /* blank line */
    {
      PL_strncpyz (*obufferP, "<BR>", *obuffer_sizeP);
      return MimeObject_write(obj, *obufferP, strlen(*obufferP), true);
    }
  }

  uint32_t outlen = (uint32_t) *obuffer_sizeP;
  out = *obufferP;
  *out = 0;

  data_end = line + length;
  last_end = line;
  this_start = last_end;
  this_end = this_start;
  uint32_t addedlen = 0;
  while (this_end < data_end)
  {
    /* Skip forward to next special character. */
    while (this_start < data_end &&
       *this_start != '<' && *this_start != '>' &&
       *this_start != '&')
    this_start++;

    this_end = this_start;

    /* Skip to the end of the tag. */
    if (this_start < data_end && *this_start == '<')
    {
      this_end++;
      while (this_end < data_end &&
         !IS_SPACE(*this_end) &&
         *this_end != '<' && *this_end != '>' &&
         *this_end != '&')
      this_end++;
    }

    this_end++;

    /* Push out the text preceeding the tag. */
    if (last_end && last_end != this_start)
    {
      memcpy (out, last_end, this_start - last_end);
      out += this_start - last_end;
      *out = 0;
      outlen -= (this_start - last_end);
    }

    if (this_start >= data_end)
    break;
    else if (*this_start == '&')
    {
      PL_strncpyz (out, "&amp;", outlen); 
      addedlen = strlen(out);
      outlen -= addedlen; 
      out += addedlen;
    }
    else if (*this_start == '>')
    {
      PL_strncpyz (out, "&gt;", outlen); 
      addedlen = strlen(out); 
      outlen -= addedlen; 
      out += addedlen;
    }
    else if (enriched_p &&
         this_start < data_end + 1 &&
         this_start[0] == '<' &&
         this_start[1] == '<')
    {
      PL_strncpyz (out, "&lt;", outlen); 
      addedlen = strlen(out); 
      outlen -= addedlen; 
      out += addedlen;
    }
    else if (this_start != this_end)
    {
      /* Push out this ID. */
      const char *old = this_start + 1;
      const char *tag_open  = 0;
      const char *tag_close = 0;
      if (*old == '/')
      {
        /* This is </tag> */
        old++;
      }

      switch (*old)
      {
      case 'b': case 'B':
        if (!PL_strncasecmp ("BIGGER>", old, 7))
        tag_open = "<FONT SIZE=\"+1\">", tag_close = "</FONT>";
        else if (!PL_strncasecmp ("BLINK>", old, 5))
        /* Of course, both text/richtext and text/enriched must be
           enhanced *somehow*...  Or else what would people think. */
        tag_open = "<BLINK>", tag_close = "</BLINK>";
        else if (!PL_strncasecmp ("BOLD>", old, 5))
        tag_open = "<B>", tag_close = "</B>";
        break;
      case 'c': case 'C':
        if (!PL_strncasecmp ("CENTER>", old, 7))
        tag_open = "<CENTER>", tag_close = "</CENTER>";
        else if (!enriched_p &&
             !PL_strncasecmp ("COMMENT>", old, 8))
        tag_open = "<!-- ", tag_close = " -->";
        break;
      case 'e': case 'E':
        if (!PL_strncasecmp ("EXCERPT>", old, 8))
        tag_open = "<BLOCKQUOTE>", tag_close = "</BLOCKQUOTE>";
        break;
      case 'f': case 'F':
        if (!PL_strncasecmp ("FIXED>", old, 6))
        tag_open = "<TT>", tag_close = "</TT>";
        else if (enriched_p &&
             !PL_strncasecmp ("FLUSHBOTH>", old, 10))
        tag_open = "<P ALIGN=LEFT>", tag_close = "</P>";
        else if (!PL_strncasecmp ("FLUSHLEFT>", old, 10))
        tag_open = "<P ALIGN=LEFT>", tag_close = "</P>";
        else if (!PL_strncasecmp ("FLUSHRIGHT>", old, 11))
        tag_open = "<P ALIGN=RIGHT>", tag_close = "</P>";
        else if (!enriched_p &&
             !PL_strncasecmp ("FOOTING>", old, 8))
        tag_open = "<H6>", tag_close = "</H6>";
        break;
      case 'h': case 'H':
        if (!enriched_p &&
          !PL_strncasecmp ("HEADING>", old, 8))
        tag_open = "<H6>", tag_close = "</H6>";
        break;
      case 'i': case 'I':
        if (!PL_strncasecmp ("INDENT>", old, 7))
        tag_open = "<UL>", tag_close = "</UL>";
        else if (!PL_strncasecmp ("INDENTRIGHT>", old, 12))
        tag_open = 0, tag_close = 0;
/*        else if (!enriched_p &&
               !PL_strncasecmp ("ISO-8859-", old, 9))
        tag_open = 0, tag_close = 0; */
        else if (!PL_strncasecmp ("ITALIC>", old, 7))
        tag_open = "<I>", tag_close = "</I>";
        break;
      case 'l': case 'L':
        if (!enriched_p &&
          !PL_strncasecmp ("LT>", old, 3))
        tag_open = "&lt;", tag_close = 0;
        break;
      case 'n': case 'N':
        if (!enriched_p &&
          !PL_strncasecmp ("NL>", old, 3))
        tag_open = "<BR>", tag_close = 0;
        if (enriched_p &&
          !PL_strncasecmp ("NOFILL>", old, 7))
        tag_open = "<NOBR>", tag_close = "</NOBR>";
/*        else if (!enriched_p &&
               !PL_strncasecmp ("NO-OP>", old, 6))
        tag_open = 0, tag_close = 0; */
/*        else if (!enriched_p &&
               !PL_strncasecmp ("NP>", old, 3))
        tag_open = 0, tag_close = 0; */
        break;
      case 'o': case 'O':
        if (!enriched_p &&
          !PL_strncasecmp ("OUTDENT>", old, 8))
        tag_open = 0, tag_close = 0;
        else if (!enriched_p &&
             !PL_strncasecmp ("OUTDENTRIGHT>", old, 13))
        tag_open = 0, tag_close = 0;
        break;
      case 'p': case 'P':
        if (enriched_p &&
          !PL_strncasecmp ("PARAM>", old, 6))
        tag_open = "<!-- ", tag_close = " -->";
        else if (!enriched_p &&
             !PL_strncasecmp ("PARAGRAPH>", old, 10))
        tag_open = "<P>", tag_close = 0;
        break;
      case 's': case 'S':
        if (!enriched_p &&
          !PL_strncasecmp ("SAMEPAGE>", old, 9))
        tag_open = 0, tag_close = 0;
        else if (!enriched_p &&
             !PL_strncasecmp ("SIGNATURE>", old, 10))
        tag_open = "<I><FONT SIZE=\"-1\">", tag_close = "</FONT></I>";
        else if (!PL_strncasecmp ("SMALLER>", old, 8))
        tag_open = "<FONT SIZE=\"-1\">", tag_close = "</FONT>";
        else if (!enriched_p &&
             !PL_strncasecmp ("SUBSCRIPT>", old, 10))
        tag_open = "<SUB>", tag_close = "</SUB>";
        else if (!enriched_p &&
             !PL_strncasecmp ("SUPERSCRIPT>", old, 12))
        tag_open = "<SUP>", tag_close = "</SUP>";
        break;
      case 'u': case 'U':
        if (!PL_strncasecmp ("UNDERLINE>", old, 10))
        tag_open = "<U>", tag_close = "</U>";
/*        else if (!enriched_p &&
             !PL_strncasecmp ("US-ASCII>", old, 10))
        tag_open = 0, tag_close = 0; */
        break;
      case 'v': case 'V':
        if (enriched_p &&
          !PL_strncasecmp ("VERBATIM>", old, 9))
        tag_open = "<PRE>", tag_close = "</PRE>";
        break;
      }

      if (this_start[1] == '/')
      {
        if (tag_close) PL_strncpyz (out, tag_close, outlen);
        addedlen = strlen (out);
        outlen -= addedlen;
        out += addedlen;
      }
      else
      {
        if (tag_open) PL_strncpyz (out, tag_open, outlen);
        addedlen = strlen (out);
        outlen -= addedlen;
        out += addedlen;
      }
    }

    /* now go around again */
    last_end = this_end;
    this_start = last_end;
  }
  *out = 0;

  return MimeObject_write(obj, *obufferP, out - *obufferP, true);
}


static int
MimeInlineTextRichtext_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  bool enriched_p = (((MimeInlineTextRichtextClass *) obj->clazz)
            ->enriched_p);

  return MimeRichtextConvert (line, length,
                obj,
                &obj->obuffer, &obj->obuffer_size,
                enriched_p);
}


static int
MimeInlineTextRichtext_parse_begin (MimeObject *obj)
{
  int status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_begin(obj);
  char s[] = "";
  if (status < 0) return status;
  return MimeObject_write(obj, s, 0, true); /* force out any separators... */
}


static int
MimeInlineTextRichtext_parse_eof (MimeObject *obj, bool abort_p)
{
  int status;
  if (obj->closed_p) return 0;

  /* Run parent method first, to flush out any buffered data. */
  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
  if (status < 0) return status;

  return 0;
}
