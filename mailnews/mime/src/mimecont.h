/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMECONT_H_
#define _MIMECONT_H_

#include "mimeobj.h"

/* MimeContainer is the class for the objects representing all MIME
   types which can contain other MIME objects within them.  In addition
   to the methods inherited from MimeObject, it provides one method:

   int add_child (MimeObject *parent, MimeObject *child)

     Given a parent (a subclass of MimeContainer) this method adds the
     child (any MIME object) to the parent's list of children.

     The MimeContainer `finalize' method will finalize the children as well.
 */

typedef struct MimeContainerClass MimeContainerClass;
typedef struct MimeContainer      MimeContainer;

struct MimeContainerClass {
  MimeObjectClass object;
  int (*add_child) (MimeObject *parent, MimeObject *child);
};

extern MimeContainerClass mimeContainerClass;

struct MimeContainer {
  MimeObject object;    /* superclass variables */

  MimeObject **children;  /* list of contained objects */
  int32_t nchildren;      /* how many */
};

#endif /* _MIMECONT_H_ */
