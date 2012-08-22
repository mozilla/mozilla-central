/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This is the definitions for the Content Type Handler plugins for
 * libmime. This will allow developers the dynamically add the ability
 * for libmime to render new content types in the MHTML rendering of
 * HTML messages.
 */

#ifndef _MIMECTH_H_
#define _MIMECTH_H_

#include "mimei.h"
#include "mimeobj.h"  /*  MimeObject (abstract)              */
#include "mimecont.h"  /*   |--- MimeContainer (abstract)          */
#include "mimemult.h"  /*   |     |--- MimeMultipart (abstract)      */
#include "mimemsig.h"  /*   |     |     |--- MimeMultipartSigned (abstract)*/
#include "mimetext.h"  /*   |     |--- MimeInlineText (abstract)      */
#include "mimecryp.h"

/*
  This header exposes functions that are necessary to access the
  object hierarchy for the mime chart. The class hierarchy is:

     MimeObject (abstract)
      |
      |--- MimeContainer (abstract)
      |     |
      |     |--- MimeMultipart (abstract)
      |     |     |
      |     |     |--- MimeMultipartMixed
      |     |     |
      |     |     |--- MimeMultipartDigest
      |     |     |
      |     |     |--- MimeMultipartParallel
      |     |     |
      |     |     |--- MimeMultipartAlternative
      |     |     |
      |     |     |--- MimeMultipartRelated
      |     |     |
      |     |     |--- MimeMultipartAppleDouble
      |     |     |
      |     |     |--- MimeSunAttachment
      |     |     |
      |     |     |--- MimeMultipartSigned (abstract)
      |     |          |
      |     |          |--- MimeMultipartSigned
      |     |
      |     |--- MimeXlateed (abstract)
      |     |     |
      |     |     |--- MimeXlateed
      |     |
      |     |--- MimeMessage
      |     |
      |     |--- MimeUntypedText
      |
      |--- MimeLeaf (abstract)
      |     |
      |     |--- MimeInlineText (abstract)
      |     |     |
      |     |     |--- MimeInlineTextPlain
      |     |     |
      |     |     |--- MimeInlineTextHTML
      |     |     |
      |     |     |--- MimeInlineTextRichtext
      |     |     |     |
      |     |     |     |--- MimeInlineTextEnriched
      |     |      |
      |     |      |--- MimeInlineTextVCard
      |     |
      |     |--- MimeInlineImage
      |     |
      |     |--- MimeExternalObject
      |
      |--- MimeExternalBody
 */

#include "nsIMimeContentTypeHandler.h"

/*
 * These functions are exposed by libmime to be used by content type
 * handler plugins for processing stream data.
 */
/*
 * This is the write call for outputting processed stream data.
 */
extern int                        MIME_MimeObject_write(MimeObject *,
                                                        const char *data,
                                                        int32_t length,
                                                        bool user_visible_p);
/*
 * The following group of calls expose the pointers for the object
 * system within libmime.
 */
extern MimeInlineTextClass       *MIME_GetmimeInlineTextClass(void);
extern MimeLeafClass             *MIME_GetmimeLeafClass(void);
extern MimeObjectClass           *MIME_GetmimeObjectClass(void);
extern MimeContainerClass        *MIME_GetmimeContainerClass(void);
extern MimeMultipartClass        *MIME_GetmimeMultipartClass(void);
extern MimeMultipartSignedClass  *MIME_GetmimeMultipartSignedClass(void);
extern MimeEncryptedClass        *MIME_GetmimeEncryptedClass(void);

/*
 * These are the functions that need to be implemented by the
 * content type handler plugin. They will be called by by libmime
 * when the module is loaded at runtime.
 */

/*
 * MIME_GetContentType() is called by libmime to identify the content
 * type handled by this plugin.
 */
extern "C"
char            *MIME_GetContentType(void);

/*
 * This will create the MimeObjectClass object to be used by the libmime
 * object system.
 */
extern "C"
MimeObjectClass *MIME_CreateContentTypeHandlerClass(const char *content_type,
                                   contentTypeHandlerInitStruct *initStruct);

/*
 * Typedefs for libmime to use when locating and calling the above
 * defined functions.
 */
typedef char * (*mime_get_ct_fn_type)(void);
typedef MimeObjectClass * (*mime_create_class_fn_type)
                              (const char *, contentTypeHandlerInitStruct *);

#endif /* _MIMECTH_H_ */
