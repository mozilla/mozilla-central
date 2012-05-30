/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef ImportTranslate_h___
#define ImportTranslate_h___

#include "nsStringGlue.h"
#include "nsImportTranslator.h"

class ImportTranslate {
public:
  static bool ConvertString(const nsCString& inStr, nsCString& outStr, bool mimeHeader);
  static nsImportTranslator *GetTranslator(void);
  static nsImportTranslator *GetMatchingTranslator(const char *pCharSet);

protected:
  static int m_useTranslator;
};


#endif  /* ImportTranslate_h__ */
