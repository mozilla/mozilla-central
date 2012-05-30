/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMsgSearchValue_h
#define __nsMsgSearchValue_h

#include "nsIMsgSearchValue.h"
#include "nsMsgSearchCore.h"

class nsMsgSearchValueImpl : public nsIMsgSearchValue {
  public:
    nsMsgSearchValueImpl(nsMsgSearchValue *aInitialValue);

    virtual ~nsMsgSearchValueImpl();
                                  
    NS_DECL_ISUPPORTS
    NS_DECL_NSIMSGSEARCHVALUE
        
  private:
    nsMsgSearchValue mValue;
        
};

#endif
