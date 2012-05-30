/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "mimecth.h"

/*
 * These calls are necessary to expose the object class hierarchy 
 * to externally developed content type handlers.
 */
MimeInlineTextClass *
MIME_GetmimeInlineTextClass(void)
{
  return &mimeInlineTextClass;
}

MimeLeafClass *
MIME_GetmimeLeafClass(void)
{
  return &mimeLeafClass;
}

MimeObjectClass *
MIME_GetmimeObjectClass(void)
{
  return &mimeObjectClass;
}

MimeContainerClass *
MIME_GetmimeContainerClass(void)
{
  return &mimeContainerClass;
}

MimeMultipartClass *
MIME_GetmimeMultipartClass(void)
{
  return &mimeMultipartClass;
}

MimeMultipartSignedClass *
MIME_GetmimeMultipartSignedClass(void)
{
  return &mimeMultipartSignedClass;
}

MimeEncryptedClass *
MIME_GetmimeEncryptedClass(void)
{
  return &mimeEncryptedClass;
}
