/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOEMailbox_h___
#define nsOEMailbox_h___

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIFile.h"

class nsIMsgFolder;

class CImportMailbox {
public:
  static bool ImportMailbox(uint32_t *pDone, bool *pAbort, nsString& name,
                            nsIFile * inFile, nsIMsgFolder * outFolder,
                            uint32_t *pCount);

private:
  static bool    GetIndexFile(nsIFile* mbxFile);
};



#endif // nsOEMailbox_h__
