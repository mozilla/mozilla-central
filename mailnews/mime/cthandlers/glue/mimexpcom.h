/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This is the definitions for the Content Type Handler plugins to
 * access internals of libmime via XP-COM calls
 */
#ifndef _MIMEXPCOM_H_
#define _MIMEXPCOM_H_

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

/*
 * These functions are exposed by libmime to be used by content type
 * handler plugins for processing stream data.
 */
/*
 * This is the write call for outputting processed stream data.
 */
extern "C" int  COM_MimeObject_write(void *mimeObject, const char *data,
                                      int32_t length,
                                      bool user_visible_p);
/*
 * The following group of calls expose the pointers for the object
 * system within libmime.
 */
extern "C" void *COM_GetmimeInlineTextClass(void);
extern "C" void *COM_GetmimeLeafClass(void);
extern "C" void *COM_GetmimeObjectClass(void);
extern "C" void *COM_GetmimeContainerClass(void);
extern "C" void *COM_GetmimeMultipartClass(void);
extern "C" void *COM_GetmimeMultipartSignedClass(void);

extern "C" void *COM_MimeCreate(char * content_type, void * hdrs, void * opts);

#endif /* _MIMEXPCOM_H_ */
