/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This interface is implemented by content type handlers that will be
 * called upon by libmime to process various attachments types. The primary
 * purpose of these handlers will be to represent the attached data in a
 * viewable HTML format that is useful for the user
 *
 * Note: These will all register by their content type prefixed by the
 *       following:  mimecth:text/vcard
 *
 *       libmime will then use the XPCOM Component Manager to
 *       locate the appropriate Content Type handler
 */
#ifndef nsIMimeContentTypeHandler_h_
#define nsIMimeContentTypeHandler_h_

typedef struct {
  bool        force_inline_display;
} contentTypeHandlerInitStruct;

#include "nsISupports.h"
#include "mimecth.h"

// {20DABD99-F8B5-11d2-8EE0-00A024A7D144}
#define NS_IMIME_CONTENT_TYPE_HANDLER_IID \
      { 0x20dabd99, 0xf8b5, 0x11d2,   \
      { 0x8e, 0xe0, 0x0, 0xa0, 0x24, 0xa7, 0xd1, 0x44 } }

// {20DABDA1-F8B5-11d2-8EE0-00A024A7D144}
#define NS_VCARD_CONTENT_TYPE_HANDLER_CID \
      { 0x20dabda1, 0xf8b5, 0x11d2, \
      { 0x8e, 0xe0, 0x0, 0xa0, 0x24, 0xa7, 0xd1, 0x44 } }

#define NS_SMIME_CONTENT_TYPE_HANDLER_CID \
      { 0x20dabdac, 0xf8b5, 0x11d2, \
      { 0xFF, 0xe0, 0x0, 0xa0, 0x24, 0xa7, 0xd1, 0x44 } }

#define NS_SIGNED_CONTENT_TYPE_HANDLER_CID \
      { 0x20dabdac, 0xf8b5, 0x11d2, \
      { 0xFF, 0xe0, 0x0, 0xaf, 0x19, 0xa7, 0xd1, 0x44 } }

#define NS_PGPMIME_CONTENT_TYPE_HANDLER_CID \
      { 0x212f415f, 0xf8b5, 0x11d2, \
      { 0xFF, 0xe0, 0x0, 0xaf, 0x19, 0xa7, 0xd1, 0x44 } }


class nsIMimeContentTypeHandler : public nsISupports {
public:
  NS_DECLARE_STATIC_IID_ACCESSOR(NS_IMIME_CONTENT_TYPE_HANDLER_IID)

  NS_IMETHOD    GetContentType(char **contentType) = 0;

  NS_IMETHOD    CreateContentTypeHandlerClass(const char *content_type,
                                              contentTypeHandlerInitStruct *initStruct,
                                              MimeObjectClass **objClass) = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsIMimeContentTypeHandler,
                              NS_IMIME_CONTENT_TYPE_HANDLER_IID)

#endif /* nsIMimeContentTypeHandler_h_ */
