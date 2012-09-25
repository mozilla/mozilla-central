/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include <stdio.h>
#include "nscore.h"
#include "plstr.h"
//#include "mimecth.h"
#include "nsMimeContentTypeHandler.h"

/*
 * The following macros actually implement addref, release and
 * query interface for our component.
 */
NS_IMPL_ISUPPORTS1(nsMimeContentTypeHandler, nsIMimeContentTypeHandler)

/*
 * nsIMimeEmitter definitions....
 */
nsMimeContentTypeHandler::nsMimeContentTypeHandler(const char *aMimeType,
                                                   MCTHCreateCTHClass callback)
{
  NS_ASSERTION(aMimeType, "nsMimeContentTypeHandler should be initialized with non-null mime type");
  NS_ASSERTION(callback, "nsMimeContentTypeHandler should be initialized with non-null callback");
  mimeType = PL_strdup(aMimeType);
  realCreateContentTypeHandlerClass = callback;
}

nsMimeContentTypeHandler::~nsMimeContentTypeHandler(void)
{
  if (mimeType) {
    NS_Free(mimeType);
    mimeType = 0;
  }
  realCreateContentTypeHandlerClass = 0;
}

// Get the content type if necessary
nsresult
nsMimeContentTypeHandler::GetContentType(char **contentType)
{
  *contentType = PL_strdup(mimeType);
  return NS_OK;
}

// Set the output stream for processed data.
nsresult
nsMimeContentTypeHandler::CreateContentTypeHandlerClass(const char *content_type,
                                                contentTypeHandlerInitStruct *initStruct,
                                                MimeObjectClass **objClass)
{
  *objClass = realCreateContentTypeHandlerClass(content_type, initStruct);
  if (!*objClass)
    return NS_ERROR_OUT_OF_MEMORY; /* we couldn't allocate the object */
  else
    return NS_OK;
}



