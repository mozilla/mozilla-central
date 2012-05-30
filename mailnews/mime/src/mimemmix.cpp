/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mimemmix.h"
#include "prlog.h"

#define MIME_SUPERCLASS mimeMultipartClass
MimeDefClass(MimeMultipartMixed, MimeMultipartMixedClass,
       mimeMultipartMixedClass, &MIME_SUPERCLASS);

static int
MimeMultipartMixedClassInitialize(MimeMultipartMixedClass *clazz)
{
#ifdef DEBUG
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  PR_ASSERT(!oclass->class_initialized);
#endif
  return 0;
}
