/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsMimePlainEmitter_h_
#define _nsMimePlainEmitter_h_

#include "mozilla/Attributes.h"
#include "prio.h"
#include "nsMimeBaseEmitter.h"
#include "nsMimeRebuffer.h"
#include "nsIStreamListener.h"
#include "nsIOutputStream.h"
#include "nsIURI.h"
#include "nsIChannel.h"

class nsMimePlainEmitter : public nsMimeBaseEmitter {
public: 
    nsMimePlainEmitter ();
    virtual       ~nsMimePlainEmitter (void);

    // Header handling routines.
    NS_IMETHOD    StartHeader(bool rootMailHeader, bool headerOnly, const char *msgID,
                              const char *outCharset) MOZ_OVERRIDE;
    NS_IMETHOD    AddHeaderField(const char *field, const char *value) MOZ_OVERRIDE;
    NS_IMETHOD    EndHeader();

    NS_IMETHOD    WriteBody(const nsACString &buf, uint32_t *amountWritten) MOZ_OVERRIDE;
};

#endif /* _nsMimePlainEmitter_h_ */
