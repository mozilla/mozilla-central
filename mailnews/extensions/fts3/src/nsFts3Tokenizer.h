/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsFts3Tokenizer_h__
#define nsFts3Tokenizer_h__

#include "nsCOMPtr.h"
#include "nsIFts3Tokenizer.h"
#include "fts3_tokenizer.h"

extern const sqlite3_tokenizer_module* getWindowsTokenizer();

class nsFts3Tokenizer : public nsIFts3Tokenizer {
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIFTS3TOKENIZER

    nsFts3Tokenizer();

private:
  ~nsFts3Tokenizer();
};

#endif
