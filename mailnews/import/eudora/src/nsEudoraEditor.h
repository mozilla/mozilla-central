/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsIEditor.h"
#include "nsIEditorMailSupport.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsIFile.h"


class nsEudoraEditor
{
  public:
    nsEudoraEditor(const char * pBody, nsIFile * pMailImportLocation);
    ~nsEudoraEditor();

    bool GetEmbeddedImageCID(uint32_t aCIDHash, const nsAString & aOldRef, nsString &aCID);
    bool HasEmbeddedContent();
    nsresult GetEmbeddedObjects(nsISupportsArray ** aNodeList);
    nsresult GetBody(nsAString & _retval) {_retval = m_body; return NS_OK;}
  protected:
    NS_ConvertASCIItoUTF16      m_body;
    nsCOMPtr <nsIFile>          m_pMailImportLocation;
    nsCOMPtr<nsISupportsArray>  m_EmbeddedObjectList; // Initialized when GetEmbeddedObjects is called
};

