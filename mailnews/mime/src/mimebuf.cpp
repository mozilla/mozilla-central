/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Original Code has been modified by IBM Corporation. Modifications made by IBM
 * described herein are Copyright (c) International Business Machines Corporation, 2000.
 * Modifications to Mozilla code or documentation identified per MPL Section 3.3
 *
 * Date             Modified by     Description of modification
 * 04/20/2000       IBM Corp.      OS/2 VisualAge build.
 */
/*
 * mimebuf.c -  libmsg like buffer handling routines for libmime
 */
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "msgCore.h"
#include "nsMimeStringResources.h"

extern "C" int
mime_GrowBuffer (uint32_t desired_size, uint32_t element_size, uint32_t quantum,
        char **buffer, int32_t *size)
{
  if ((uint32_t) *size <= desired_size)
  {
    char *new_buf;
    uint32_t increment = desired_size - *size;
    if (increment < quantum) /* always grow by a minimum of N bytes */
    increment = quantum;

    new_buf = (*buffer
         ? (char *) PR_Realloc (*buffer, (*size + increment)
                    * (element_size / sizeof(char)))
         : (char *) PR_MALLOC ((*size + increment)
                    * (element_size / sizeof(char))));
    if (! new_buf)
      return MIME_OUT_OF_MEMORY;
    *buffer = new_buf;
    *size += increment;
  }
  return 0;
}

/* The opposite of mime_LineBuffer(): takes small buffers and packs them
   up into bigger buffers before passing them along.

   Pass in a desired_buffer_size 0 to tell it to flush (for example, in
   in the very last call to this function.)
 */
extern "C" int
mime_ReBuffer (const char *net_buffer, int32_t net_buffer_size,
        uint32_t desired_buffer_size,
        char **bufferP, int32_t *buffer_sizeP, uint32_t *buffer_fpP,
        int32_t (*per_buffer_fn) (char *buffer, uint32_t buffer_size,
                    void *closure),
        void *closure)
{
  int status = 0;

  if (desired_buffer_size >= (uint32_t) (*buffer_sizeP))
  {
    status = mime_GrowBuffer (desired_buffer_size, sizeof(char), 1024,
                 bufferP, buffer_sizeP);
    if (status < 0) return status;
  }

  do
  {
    int32_t size = *buffer_sizeP - *buffer_fpP;
    if (size > net_buffer_size)
    size = net_buffer_size;
    if (size > 0)
    {
      memcpy ((*bufferP) + (*buffer_fpP), net_buffer, size);
      (*buffer_fpP) += size;
      net_buffer += size;
      net_buffer_size -= size;
    }

    if (*buffer_fpP > 0 &&
      *buffer_fpP >= desired_buffer_size)
    {
      status = (*per_buffer_fn) ((*bufferP), (*buffer_fpP), closure);
      *buffer_fpP = 0;
      if (status < 0) return status;
    }
  }
  while (net_buffer_size > 0);

  return 0;
}

static int
convert_and_send_buffer(char* buf, int length, bool convert_newlines_p,
              int32_t (* per_line_fn) (char *line,
                          uint32_t line_length,
                          void *closure),
              void *closure)
{
  /* Convert the line terminator to the native form.
   */
  char* newline;

#if (MSG_LINEBREAK_LEN == 2)
  /***
  * This is a patch to support a mail DB corruption cause by earlier version that lead to a crash.
  * What happened is that the line terminator is CR+NULL+LF. Therefore, we first process a line
  * terminated by CR then a second line that contains only NULL+LF. We need to ignore this second
  * line. See bug http://bugzilla.mozilla.org/show_bug.cgi?id=61412 for more information.
  ***/
  if (length == 2 && buf[0] == 0x00 && buf[1] == '\n')
    return 0;
#endif

  NS_ASSERTION(buf && length > 0, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  if (!buf || length <= 0) return -1;
  newline = buf + length;
  NS_ASSERTION(newline[-1] == '\r' || newline[-1] == '\n', "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  if (newline[-1] != '\r' && newline[-1] != '\n') return -1;

  if (!convert_newlines_p)
  {
  }
#if (MSG_LINEBREAK_LEN == 1)
  else if ((newline - buf) >= 2 &&
       newline[-2] == '\r' &&
       newline[-1] == '\n')
  {
    /* CRLF -> CR or LF */
    buf [length - 2] = MSG_LINEBREAK[0];
    length--;
  }
  else if (newline > buf + 1 &&
       newline[-1] != MSG_LINEBREAK[0])
  {
    /* CR -> LF or LF -> CR */
    buf [length - 1] = MSG_LINEBREAK[0];
  }
#else
  else if (((newline - buf) >= 2 && newline[-2] != '\r') ||
       ((newline - buf) >= 1 && newline[-1] != '\n'))
  {
    /* LF -> CRLF or CR -> CRLF */
    length++;
    buf[length - 2] = MSG_LINEBREAK[0];
    buf[length - 1] = MSG_LINEBREAK[1];
  }
#endif

  return (*per_line_fn)(buf, length, closure);
}

extern "C" int
mime_LineBuffer (const char *net_buffer, int32_t net_buffer_size,
        char **bufferP, int32_t *buffer_sizeP, uint32_t *buffer_fpP,
        bool convert_newlines_p,
        int32_t (* per_line_fn) (char *line, uint32_t line_length,
                    void *closure),
        void *closure)
{
  int status = 0;
  if (*buffer_fpP > 0 && *bufferP && (*bufferP)[*buffer_fpP - 1] == '\r' &&
    net_buffer_size > 0 && net_buffer[0] != '\n') {
  /* The last buffer ended with a CR.  The new buffer does not start
     with a LF.  This old buffer should be shipped out and discarded. */
  NS_ASSERTION((uint32_t) *buffer_sizeP > *buffer_fpP, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  if ((uint32_t) *buffer_sizeP <= *buffer_fpP) return -1;
  status = convert_and_send_buffer(*bufferP, *buffer_fpP,
                     convert_newlines_p,
                     per_line_fn, closure);
  if (status < 0) return status;
  *buffer_fpP = 0;
  }
  while (net_buffer_size > 0)
  {
    const char *net_buffer_end = net_buffer + net_buffer_size;
    const char *newline = 0;
    const char *s;


    for (s = net_buffer; s < net_buffer_end; s++)
    {
      /* Move forward in the buffer until the first newline.
       Stop when we see CRLF, CR, or LF, or the end of the buffer.
       *But*, if we see a lone CR at the *very end* of the buffer,
       treat this as if we had reached the end of the buffer without
       seeing a line terminator.  This is to catch the case of the
       buffers splitting a CRLF pair, as in "FOO\r\nBAR\r" "\nBAZ\r\n".
       */
      if (*s == '\r' || *s == '\n')
      {
        newline = s;
        if (newline[0] == '\r')
        {
          if (s == net_buffer_end - 1)
          {
            /* CR at end - wait for the next character. */
            newline = 0;
            break;
          }
          else if (newline[1] == '\n')
          /* CRLF seen; swallow both. */
          newline++;
        }
        newline++;
        break;
      }
    }

    /* Ensure room in the net_buffer and append some or all of the current
     chunk of data to it. */
    {
    const char *end = (newline ? newline : net_buffer_end);
    uint32_t desired_size = (end - net_buffer) + (*buffer_fpP) + 1;

    if (desired_size >= (uint32_t) (*buffer_sizeP))
      {
      status = mime_GrowBuffer (desired_size, sizeof(char), 1024,
                   bufferP, buffer_sizeP);
      if (status < 0) return status;
      }
    memcpy ((*bufferP) + (*buffer_fpP), net_buffer, (end - net_buffer));
    (*buffer_fpP) += (end - net_buffer);
        (*bufferP)[*buffer_fpP] = '\0';
    }

    /* Now *bufferP contains either a complete line, or as complete
     a line as we have read so far.

     If we have a line, process it, and then remove it from `*bufferP'.
     Then go around the loop again, until we drain the incoming data.
     */
    if (!newline)
    return 0;

    status = convert_and_send_buffer(*bufferP, *buffer_fpP,
                       convert_newlines_p,
                       per_line_fn, closure);
    if (status < 0)
      return status;

    net_buffer_size -= (newline - net_buffer);
    net_buffer = newline;
    (*buffer_fpP) = 0;
  }
  return 0;
}
