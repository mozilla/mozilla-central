/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsMimeXmlEmitter_h_
#define _nsMimeXmlEmitter_h_

#include "mozilla/Attributes.h"
#include "prio.h"
#include "nsMimeBaseEmitter.h"
#include "nsMimeRebuffer.h"
#include "nsIStreamListener.h"
#include "nsIOutputStream.h"
#include "nsIURI.h"
#include "nsIChannel.h"

class nsMimeXmlEmitter : public nsMimeBaseEmitter {
public: 
    nsMimeXmlEmitter ();
    virtual       ~nsMimeXmlEmitter (void);

    NS_IMETHOD    Complete() MOZ_OVERRIDE;

    // Header handling routines.
    NS_IMETHOD    StartHeader(bool rootMailHeader, bool headerOnly, const char *msgID,
                              const char *outCharset) MOZ_OVERRIDE;
    NS_IMETHOD    AddHeaderField(const char *field, const char *value) MOZ_OVERRIDE;
    NS_IMETHOD    EndHeader();

    // Attachment handling routines
    NS_IMETHOD    StartAttachment(const nsACString &name,
                                  const char *contentType, const char *url,
                                  bool aIsExternalAttachment) MOZ_OVERRIDE;
    NS_IMETHOD    AddAttachmentField(const char *field, const char *value) MOZ_OVERRIDE;
    NS_IMETHOD    EndAttachment() MOZ_OVERRIDE;

    NS_IMETHOD    WriteXMLHeader(const char *msgID);
    NS_IMETHOD    WriteXMLTag(const char *tagName, const char *value);

protected:

    // For header determination...
    bool                mXMLHeaderStarted; 
    int32_t             mAttachCount;
};

#endif /* _nsMimeXmlEmitter_h_ */
