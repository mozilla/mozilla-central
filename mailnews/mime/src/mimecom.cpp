/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "mimei.h"
#include "mimeobj.h"  /*  MimeObject (abstract)              */
#include "mimecont.h"  /*   |--- MimeContainer (abstract)          */
#include "mimemult.h"  /*   |     |--- MimeMultipart (abstract)      */
#include "mimemsig.h"  /*   |     |     |--- MimeMultipartSigned (abstract)*/
#include "mimetext.h"  /*   |     |--- MimeInlineText (abstract)      */
#include "mimecryp.h"
#include "mimecth.h"

/*
 * These calls are necessary to expose the object class hierarchy
 * to externally developed content type handlers.
 */
extern "C" void *
XPCOM_GetmimeInlineTextClass(void)
{
  return (void *) &mimeInlineTextClass;
}

extern "C" void *
XPCOM_GetmimeLeafClass(void)
{
  return (void *) &mimeLeafClass;
}

extern "C" void *
XPCOM_GetmimeObjectClass(void)
{
  return (void *) &mimeObjectClass;
}

extern "C" void *
XPCOM_GetmimeContainerClass(void)
{
  return (void *) &mimeContainerClass;
}

extern "C" void *
XPCOM_GetmimeMultipartClass(void)
{
  return (void *) &mimeMultipartClass;
}

extern "C" void *
XPCOM_GetmimeMultipartSignedClass(void)
{
  return (void *) &mimeMultipartSignedClass;
}

extern "C" void *
XPCOM_GetmimeEncryptedClass(void)
{
  return (void *) &mimeEncryptedClass;
}

extern "C" int
XPCOM_MimeObject_write(void *mimeObject,
                       char *data,
                       int32_t length,
                       bool user_visible_p)
{
  return MIME_MimeObject_write((MimeObject *)mimeObject, data,
                                length, user_visible_p);
}

extern "C" void *
XPCOM_Mime_create(char *content_type, void* hdrs, void* opts)
{
  return mime_create(content_type, (MimeHeaders *)hdrs, (MimeDisplayOptions *)opts);
}
