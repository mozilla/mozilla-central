/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _rebuffer_h_
#define _rebuffer_h_

#include <stdint.h>
#include "nsStringGlue.h"

//////////////////////////////////////////////////////////////
// A rebuffering class necessary for stream output buffering
//////////////////////////////////////////////////////////////

class MimeRebuffer {
public: 
    MimeRebuffer (void);
    virtual       ~MimeRebuffer (void);

    uint32_t      GetSize();
    uint32_t      IncreaseBuffer(const nsACString &addBuf);
    uint32_t      ReduceBuffer(uint32_t numBytes);
    nsACString &  GetBuffer();

protected:
    nsCString     mBuf;
};

#endif /* _rebuffer_h_ */
