/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mimetenr.h"
#include "prlog.h"

/* All the magic for this class is in mimetric.c; since text/enriched and
   text/richtext are so similar, it was easiest to implement them in the
   same method (but this is a subclass anyway just for general goodness.)
 */

#define MIME_SUPERCLASS mimeInlineTextRichtextClass
MimeDefClass(MimeInlineTextEnriched, MimeInlineTextEnrichedClass,
       mimeInlineTextEnrichedClass, &MIME_SUPERCLASS);

static int
MimeInlineTextEnrichedClassInitialize(MimeInlineTextEnrichedClass *clazz)
{
#ifdef DEBUG
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  PR_ASSERT(!oclass->class_initialized);
#endif
  MimeInlineTextRichtextClass *rclass = (MimeInlineTextRichtextClass *) clazz;
  rclass->enriched_p = true;
  return 0;
}
