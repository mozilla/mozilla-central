/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMESUN_H_
#define _MIMESUN_H_

#include "mimemult.h"

/* MimeSunAttachment is the class for X-Sun-Attachment message contents, which
   is the Content-Type assigned by that pile of garbage called MailTool.  This
   is not a MIME type per se, but it's very similar to multipart/mixed, so it's
   easy to parse.  Lots of people use MailTool, so what the hell.

   The format is this:

    = Content-Type is X-Sun-Attachment
  = parts are separated by lines of exactly ten dashes
  = just after the dashes comes a block of headers, including:

      X-Sun-Data-Type: (manditory)
      Values are Text, Postscript, Scribe, SGML, TeX, Troff, DVI,
      and Message.

      X-Sun-Encoding-Info: (optional)
        Ordered, comma-separated values, including Compress and Uuencode.

      X-Sun-Data-Name: (optional)
        File name, maybe.

      X-Sun-Data-Description: (optional)
      Longer text.

      X-Sun-Content-Lines: (manditory, unless Length is present)
      Number of lines in the body, not counting headers and the blank
      line that follows them.

      X-Sun-Content-Length: (manditory, unless Lines is present)
        Bytes, presumably using Unix line terminators.
 */

typedef struct MimeSunAttachmentClass MimeSunAttachmentClass;
typedef struct MimeSunAttachment      MimeSunAttachment;

struct MimeSunAttachmentClass {
  MimeMultipartClass multipart;
};

extern MimeSunAttachmentClass mimeSunAttachmentClass;

struct MimeSunAttachment {
  MimeMultipart multipart;
};

#endif /* _MIMESUN_H_ */
