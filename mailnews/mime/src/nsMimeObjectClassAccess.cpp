/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include <stdio.h>
#include "mimecom.h"
#include "nscore.h"
#include "nsMimeObjectClassAccess.h"

/*
 * The following macros actually implement addref, release and
 * query interface for our component.
 */
NS_IMPL_ISUPPORTS1(nsMimeObjectClassAccess, nsIMimeObjectClassAccess)

/*
 * nsMimeObjectClassAccess definitions....
 */

/* 
 * Inherited methods for nsMimeObjectClassAccess
 */
nsMimeObjectClassAccess::nsMimeObjectClassAccess()
{
}

nsMimeObjectClassAccess::~nsMimeObjectClassAccess()
{
}

nsresult
nsMimeObjectClassAccess::MimeObjectWrite(void *mimeObject,
                                         char *data,
                                         int32_t length,
                                         bool user_visible_p)
{
  int rc = XPCOM_MimeObject_write(mimeObject, data, length, user_visible_p);
  NS_ENSURE_FALSE(rc < 0, NS_ERROR_FAILURE);

  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::GetmimeInlineTextClass(void **ptr)
{
  *ptr = XPCOM_GetmimeInlineTextClass();
  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::GetmimeLeafClass(void **ptr)
{
  *ptr = XPCOM_GetmimeLeafClass();
  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::GetmimeObjectClass(void **ptr)
{
  *ptr = XPCOM_GetmimeObjectClass();
  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::GetmimeContainerClass(void **ptr)
{
  *ptr = XPCOM_GetmimeContainerClass();
  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::GetmimeMultipartClass(void **ptr)
{
  *ptr = XPCOM_GetmimeMultipartClass();
  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::GetmimeMultipartSignedClass(void **ptr)
{
  *ptr = XPCOM_GetmimeMultipartSignedClass();
  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::GetmimeEncryptedClass(void **ptr)
{
  *ptr = XPCOM_GetmimeEncryptedClass();
  return NS_OK;
}

nsresult
nsMimeObjectClassAccess::MimeCreate(char * content_type, void * hdrs, void * opts, void **ptr)
{
  *ptr = XPCOM_Mime_create(content_type, hdrs, opts);
  return NS_OK;
}
