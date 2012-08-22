/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mimeunty.h"
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "nsMimeTypes.h"
#include "msgCore.h"
#include "nsMimeStringResources.h"
#include <ctype.h>

#define MIME_SUPERCLASS mimeContainerClass
MimeDefClass(MimeUntypedText, MimeUntypedTextClass,
       mimeUntypedTextClass, &MIME_SUPERCLASS);

static int MimeUntypedText_initialize (MimeObject *);
static void MimeUntypedText_finalize (MimeObject *);
static int MimeUntypedText_parse_begin (MimeObject *);
static int MimeUntypedText_parse_line (const char *, int32_t, MimeObject *);

static int MimeUntypedText_open_subpart (MimeObject *obj,
                     MimeUntypedTextSubpartType ttype,
                     const char *type,
                     const char *enc,
                     const char *name,
                     const char *desc);
static int MimeUntypedText_close_subpart (MimeObject *obj);

static bool MimeUntypedText_uu_begin_line_p(const char *line, int32_t length,
                         MimeDisplayOptions *opt,
                         char **type_ret,
                         char **name_ret);
static bool MimeUntypedText_uu_end_line_p(const char *line, int32_t length);

static bool MimeUntypedText_yenc_begin_line_p(const char *line, int32_t length,
                         MimeDisplayOptions *opt,
                         char **type_ret,
                         char **name_ret);
static bool MimeUntypedText_yenc_end_line_p(const char *line, int32_t length);

static bool MimeUntypedText_binhex_begin_line_p(const char *line,
                           int32_t length,
                           MimeDisplayOptions *opt);
static bool MimeUntypedText_binhex_end_line_p(const char *line,
                         int32_t length);

static int
MimeUntypedTextClassInitialize(MimeUntypedTextClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  PR_ASSERT(!oclass->class_initialized);
  oclass->initialize  = MimeUntypedText_initialize;
  oclass->finalize    = MimeUntypedText_finalize;
  oclass->parse_begin = MimeUntypedText_parse_begin;
  oclass->parse_line  = MimeUntypedText_parse_line;
  return 0;
}


static int
MimeUntypedText_initialize (MimeObject *object)
{
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->initialize(object);
}

static void
MimeUntypedText_finalize (MimeObject *object)
{
  MimeUntypedText *uty = (MimeUntypedText *) object;

  if (uty->open_hdrs)
  {
    /* Oops, those shouldn't still be here... */
    MimeHeaders_free(uty->open_hdrs);
    uty->open_hdrs = 0;
  }

  /* What about the open_subpart?  We're gonna have to assume that it
   is also on the MimeContainer->children list, and will get cleaned
   up by that class. */

  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize(object);
}

static int
MimeUntypedText_parse_begin (MimeObject *obj)
{
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_begin(obj);
}

static int
MimeUntypedText_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  MimeUntypedText *uty = (MimeUntypedText *) obj;
  int status = 0;
  char *name = 0, *type = 0;
  bool begin_line_p = false;

  NS_ASSERTION(line && *line, "empty line in mime untyped parse_line");
  if (!line || !*line) return -1;

  /* If we're supposed to write this object, but aren't supposed to convert
   it to HTML, simply pass it through unaltered. */
  if (obj->output_p &&
    obj->options &&
    !obj->options->write_html_p &&
    obj->options->output_fn)
  return MimeObject_write(obj, line, length, true);


  /* Open a new sub-part if this line demands it.
   */
  if (line[0] == 'b' &&
    MimeUntypedText_uu_begin_line_p(line, length, obj->options,
                    &type, &name))
  {
    /* Close the old part and open a new one. */
    status = MimeUntypedText_open_subpart (obj,
                       MimeUntypedTextSubpartTypeUUE,
                       type, ENCODING_UUENCODE,
                       name, NULL);
    PR_FREEIF(name);
    PR_FREEIF(type);
    if (status < 0) return status;
    begin_line_p = true;
  }

  else if (line[0] == '=' &&
    MimeUntypedText_yenc_begin_line_p(line, length, obj->options,
                    &type, &name))
  {
    /* Close the old part and open a new one. */
    status = MimeUntypedText_open_subpart (obj,
                       MimeUntypedTextSubpartTypeYEnc,
                       type, ENCODING_YENCODE,
                       name, NULL);
    PR_FREEIF(name);
    PR_FREEIF(type);
    if (status < 0) return status;
    begin_line_p = true;
  }

  else if (line[0] == '(' && line[1] == 'T' &&
       MimeUntypedText_binhex_begin_line_p(line, length, obj->options))
  {
    /* Close the old part and open a new one. */
    status = MimeUntypedText_open_subpart (obj,
                       MimeUntypedTextSubpartTypeBinhex,
                       APPLICATION_BINHEX, NULL,
                       NULL, NULL);
    if (status < 0) return status;
    begin_line_p = true;
  }

  /* Open a text/plain sub-part if there is no sub-part open.
   */
  if (!uty->open_subpart)
  {
    // rhp: If we get here and we are being fed a line ending, we should
    // just eat it and continue and if we really get more data, we'll open
    // up the subpart then.
    //
    if (line[0] == '\r') return 0;
    if (line[0] == '\n') return 0;

    PR_ASSERT(!begin_line_p);
    status = MimeUntypedText_open_subpart (obj,
                       MimeUntypedTextSubpartTypeText,
                       TEXT_PLAIN, NULL, NULL, NULL);
    PR_ASSERT(uty->open_subpart);
    if (!uty->open_subpart) return -1;
    if (status < 0) return status;
  }

  /* Hand this line to the currently-open sub-part.
   */
  status = uty->open_subpart->clazz->parse_buffer(line, length,
                          uty->open_subpart);
  if (status < 0) return status;

  /* Close this sub-part if this line demands it.
   */
  if (begin_line_p)
  ;
  else if (line[0] == 'e' &&
       uty->type == MimeUntypedTextSubpartTypeUUE &&
       MimeUntypedText_uu_end_line_p(line, length))
  {
    status = MimeUntypedText_close_subpart (obj);
    if (status < 0) return status;
    NS_ASSERTION(!uty->open_subpart, "no open subpart");
  }
  else if (line[0] == '=' &&
       uty->type == MimeUntypedTextSubpartTypeYEnc &&
       MimeUntypedText_yenc_end_line_p(line, length))
  {
    status = MimeUntypedText_close_subpart (obj);
    if (status < 0) return status;
    NS_ASSERTION(!uty->open_subpart, "no open subpart");
  }
  else if (uty->type == MimeUntypedTextSubpartTypeBinhex &&
       MimeUntypedText_binhex_end_line_p(line, length))
  {
    status = MimeUntypedText_close_subpart (obj);
    if (status < 0) return status;
    NS_ASSERTION(!uty->open_subpart, "no open subpart");
  }

  return 0;
}


static int
MimeUntypedText_close_subpart (MimeObject *obj)
{
  MimeUntypedText *uty = (MimeUntypedText *) obj;
  int status;

  if (uty->open_subpart)
  {
    status = uty->open_subpart->clazz->parse_eof(uty->open_subpart, false);
    uty->open_subpart = 0;

    PR_ASSERT(uty->open_hdrs);
    if (uty->open_hdrs)
    {
      MimeHeaders_free(uty->open_hdrs);
      uty->open_hdrs = 0;
    }
    uty->type = MimeUntypedTextSubpartTypeText;
    if (status < 0) return status;

    /* Never put out a separator between sub-parts of UntypedText.
     (This bypasses the rule that text/plain subparts always
     have separators before and after them.)
     */
    if (obj->options && obj->options->state)
    obj->options->state->separator_suppressed_p = true;
  }

  PR_ASSERT(!uty->open_hdrs);
  return 0;
}

static int
MimeUntypedText_open_subpart (MimeObject *obj,
                MimeUntypedTextSubpartType ttype,
                const char *type,
                const char *enc,
                const char *name,
                const char *desc)
{
  MimeUntypedText *uty = (MimeUntypedText *) obj;
  int status = 0;
  char *h = 0;

  if (!type || !*type || !PL_strcasecmp(type, UNKNOWN_CONTENT_TYPE))
  type = APPLICATION_OCTET_STREAM;
  if (enc && !*enc)
  enc = 0;
  if (desc && !*desc)
  desc = 0;
  if (name && !*name)
  name = 0;

  if (uty->open_subpart)
  {
    status = MimeUntypedText_close_subpart (obj);
    if (status < 0) return status;
  }
  NS_ASSERTION(!uty->open_subpart, "no open subpart");
  NS_ASSERTION(!uty->open_hdrs, "no open headers");

  /* To make one of these implicitly-typed sub-objects, we make up a fake
   header block, containing only the minimum number of MIME headers needed.
   We could do most of this (Type and Encoding) by making a null header
   block, and simply setting obj->content_type and obj->encoding; but making
   a fake header block is better for two reasons: first, it means that
   something will actually be displayed when in `Show All Headers' mode;
   and second, it's the only way to communicate the filename parameter,
   aside from adding a new slot to MimeObject (which is something to be
   avoided when possible.)
   */

  uty->open_hdrs = MimeHeaders_new();
  if (!uty->open_hdrs) return MIME_OUT_OF_MEMORY;

  uint32_t hlen = strlen(type) +
                (enc ? strlen(enc) : 0) +
                (desc ? strlen(desc) : 0) +
                (name ? strlen(name) : 0) +
                100;
  h = (char *) PR_MALLOC(hlen);
  if (!h) return MIME_OUT_OF_MEMORY;

  PL_strncpyz(h, HEADER_CONTENT_TYPE ": ", hlen);
  PL_strcatn(h, hlen, type);
  PL_strcatn(h, hlen, MSG_LINEBREAK);
  status = MimeHeaders_parse_line(h, strlen(h), uty->open_hdrs);
  if (status < 0) goto FAIL;

  if (enc)
  {
    PL_strncpyz(h, HEADER_CONTENT_TRANSFER_ENCODING ": ", hlen);
    PL_strcatn(h, hlen, enc);
    PL_strcatn(h, hlen, MSG_LINEBREAK);
    status = MimeHeaders_parse_line(h, strlen(h), uty->open_hdrs);
    if (status < 0) goto FAIL;
  }

  if (desc)
  {
    PL_strncpyz(h, HEADER_CONTENT_DESCRIPTION ": ", hlen);
    PL_strcatn(h, hlen, desc);
    PL_strcatn(h, hlen, MSG_LINEBREAK);
    status = MimeHeaders_parse_line(h, strlen(h), uty->open_hdrs);
    if (status < 0) goto FAIL;
  }
  if (name)
  {
    PL_strncpyz(h, HEADER_CONTENT_DISPOSITION ": inline; filename=\"", hlen);
    PL_strcatn(h, hlen, name);
    PL_strcatn(h, hlen, "\"" MSG_LINEBREAK);
    status = MimeHeaders_parse_line(h, strlen(h), uty->open_hdrs);
    if (status < 0) goto FAIL;
  }

  /* push out a blank line. */
  PL_strncpyz(h, MSG_LINEBREAK, hlen);
  status = MimeHeaders_parse_line(h, strlen(h), uty->open_hdrs);
  if (status < 0) goto FAIL;


  /* Create a child... */
  {
  bool horrid_kludge = (obj->options && obj->options->state &&
               obj->options->state->first_part_written_p);
  if (horrid_kludge)
    obj->options->state->first_part_written_p = false;

  uty->open_subpart = mime_create(type, uty->open_hdrs, obj->options);

  if (horrid_kludge)
    obj->options->state->first_part_written_p = true;

  if (!uty->open_subpart)
    {
    status = MIME_OUT_OF_MEMORY;
    goto FAIL;
    }
  }

  /* Add it to the list... */
  status = ((MimeContainerClass *) obj->clazz)->add_child(obj,
                              uty->open_subpart);
  if (status < 0)
  {
    mime_free(uty->open_subpart);
    uty->open_subpart = 0;
    goto FAIL;
  }

  /* And start its parser going. */
  status = uty->open_subpart->clazz->parse_begin(uty->open_subpart);
  if (status < 0)
  {
    /* MimeContainer->finalize will take care of shutting it down now. */
    uty->open_subpart = 0;
    goto FAIL;
  }

  uty->type = ttype;

 FAIL:
  PR_FREEIF(h);

  if (status < 0 && uty->open_hdrs)
  {
    MimeHeaders_free(uty->open_hdrs);
    uty->open_hdrs = 0;
  }

  return status;
}

static bool
MimeUntypedText_uu_begin_line_p(const char *line, int32_t length,
                MimeDisplayOptions *opt,
                char **type_ret, char **name_ret)
{
  const char *s;
  char *name = 0;
  char *type = 0;

  if (type_ret) *type_ret = 0;
  if (name_ret) *name_ret = 0;

  if (strncmp (line, "begin ", 6)) return false;
  /* ...then three or four octal digits. */
  s = line + 6;
  if (*s < '0' || *s > '7') return false;
  s++;
  if (*s < '0' || *s > '7') return false;
  s++;
  if (*s < '0' || *s > '7') return false;
  s++;
  if (*s == ' ')
  s++;
  else
  {
    if (*s < '0' || *s > '7') return false;
    s++;
    if (*s != ' ') return false;
  }

  while (IS_SPACE(*s))
  s++;

  name = (char *) PR_MALLOC(((line+length)-s) + 1);
  if (!name) return false; /* grr... */
  memcpy(name, s, (line+length)-s);
  name[(line+length)-s] = 0;

  /* take off newline. */
  if (name[strlen(name)-1] == '\n') name[strlen(name)-1] = 0;
  if (name[strlen(name)-1] == '\r') name[strlen(name)-1] = 0;

  /* Now try and figure out a type.
   */
  if (opt && opt->file_type_fn)
  type = opt->file_type_fn(name, opt->stream_closure);
  else
  type = 0;

  if (name_ret)
  *name_ret = name;
  else
  PR_FREEIF(name);

  if (type_ret)
  *type_ret = type;
  else
  PR_FREEIF(type);

  return true;
}

static bool
MimeUntypedText_uu_end_line_p(const char *line, int32_t length)
{
#if 0
  /* A strictly conforming uuencode end line. */
  return (line[0] == 'e' &&
      line[1] == 'n' &&
      line[2] == 'd' &&
      (line[3] == 0 || IS_SPACE(line[3])));
#else
  /* ...but, why don't we accept any line that begins with the three
   letters "END" in any case: I've seen lots of partial messages
   that look like

    BEGIN----- Cut Here-----
    begin 644 foo.gif
    Mxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    Mxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    Mxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    END------- Cut Here-----

   so let's be lenient here.  (This is only for the untyped-text-plain
   case -- the uudecode parser itself is strict.)
   */
  return (line[0] == ' ' ||
      line[0] == '\t' ||
      ((line[0] == 'e' || line[0] == 'E') &&
       (line[1] == 'n' || line[1] == 'N') &&
       (line[2] == 'd' || line[2] == 'D')));
#endif
}

static bool
MimeUntypedText_yenc_begin_line_p(const char *line, int32_t length,
                MimeDisplayOptions *opt,
                char **type_ret, char **name_ret)
{
  const char *s;
  const char *endofline = line + length;
  char *name = 0;
  char *type = 0;

  if (type_ret) *type_ret = 0;
  if (name_ret) *name_ret = 0;

  /* we don't support yenc V2 neither multipart yencode,
     therefore the second parameter should always be "line="*/
  if (length < 13 || strncmp (line, "=ybegin line=", 13)) return false;

  /* ...then couple digits. */
  for (s = line + 13; s < endofline; s ++)
    if (*s < '0' || *s > '9')
      break;

  /* ...next, look for <space>size= */
  if ((endofline - s) < 6 || strncmp (s, " size=", 6)) return false;

  /* ...then couple digits. */
  for (s += 6; s < endofline; s ++)
    if (*s < '0' || *s > '9')
      break;

   /* ...next, look for <space>name= */
  if ((endofline - s) < 6 || strncmp (s, " name=", 6)) return false;

  /* anything left is the file name */
  s += 6;
  name = (char *) PR_MALLOC((endofline-s) + 1);
  if (!name) return false; /* grr... */
  memcpy(name, s, endofline-s);
  name[endofline-s] = 0;

  /* take off newline. */
  if (name[strlen(name)-1] == '\n') name[strlen(name)-1] = 0;
  if (name[strlen(name)-1] == '\r') name[strlen(name)-1] = 0;

  /* Now try and figure out a type.
   */
  if (opt && opt->file_type_fn)
  type = opt->file_type_fn(name, opt->stream_closure);
  else
  type = 0;

  if (name_ret)
  *name_ret = name;
  else
  PR_FREEIF(name);

  if (type_ret)
  *type_ret = type;
  else
  PR_FREEIF(type);

  return true;
}

static bool
MimeUntypedText_yenc_end_line_p(const char *line, int32_t length)
{
  if (length < 11 || strncmp (line, "=yend size=", 11)) return false;

  return true;
}


#define BINHEX_MAGIC "(This file must be converted with BinHex 4.0)"
#define BINHEX_MAGIC_LEN 45

static bool
MimeUntypedText_binhex_begin_line_p(const char *line, int32_t length,
                  MimeDisplayOptions *opt)
{
  if (length <= BINHEX_MAGIC_LEN)
  return false;

  while(length > 0 && IS_SPACE(line[length-1]))
  length--;

  if (length != BINHEX_MAGIC_LEN)
  return false;

  if (!strncmp(line, BINHEX_MAGIC, BINHEX_MAGIC_LEN))
  return true;
  else
  return false;
}

static bool
MimeUntypedText_binhex_end_line_p(const char *line, int32_t length)
{
  if (length > 0 && line[length-1] == '\n') length--;
  if (length > 0 && line[length-1] == '\r') length--;

  if (length != 0 && length != 64)
  return true;
  else
  return false;
}
