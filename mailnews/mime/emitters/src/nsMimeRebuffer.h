/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _rebuffer_h_
#define _rebuffer_h_

#include "prtypes.h"

//////////////////////////////////////////////////////////////
// A rebuffering class necessary for stream output buffering
//////////////////////////////////////////////////////////////

class MimeRebuffer {
public: 
    MimeRebuffer (void);
    virtual       ~MimeRebuffer (void);

    PRUint32      GetSize();
    PRUint32      IncreaseBuffer(const char *addBuf, PRUint32 size);
    PRUint32      ReduceBuffer(PRUint32 numBytes);
    char          *GetBuffer();

protected:
    PRUint32      mSize;
    char          *mBuf;
};

#endif /* _rebuffer_h_ */
