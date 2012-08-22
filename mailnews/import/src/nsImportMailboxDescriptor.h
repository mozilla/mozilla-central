/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportMailboxDescriptor_h___
#define nsImportMailboxDescriptor_h___

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIImportMailboxDescriptor.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"

////////////////////////////////////////////////////////////////////////


class nsImportMailboxDescriptor : public nsIImportMailboxDescriptor
{
public:
  NS_DECL_ISUPPORTS

  NS_IMETHOD  GetIdentifier(uint32_t *pIdentifier) { *pIdentifier = m_id; return NS_OK;}
  NS_IMETHOD  SetIdentifier(uint32_t ident) { m_id = ident; return NS_OK;}

  /* attribute unsigned long depth; */
  NS_IMETHOD  GetDepth(uint32_t *pDepth) { *pDepth = m_depth; return NS_OK;}
  NS_IMETHOD  SetDepth(uint32_t theDepth) { m_depth = theDepth; return NS_OK;}

  /* attribute unsigned long size; */
  NS_IMETHOD  GetSize(uint32_t *pSize) { *pSize = m_size; return NS_OK;}
  NS_IMETHOD  SetSize(uint32_t theSize) { m_size = theSize; return NS_OK;}

  /* attribute wstring displayName; */
  NS_IMETHOD  GetDisplayName(PRUnichar **pName) { *pName = ToNewUnicode(m_displayName); return NS_OK;}
  NS_IMETHOD  SetDisplayName(const PRUnichar * pName) { m_displayName = pName; return NS_OK;}

  /* attribute boolean import; */
  NS_IMETHOD  GetImport(bool *pImport) { *pImport = m_import; return NS_OK;}
  NS_IMETHOD  SetImport(bool doImport) { m_import = doImport; return NS_OK;}

  /* readonly attribute nsIFile file; */
  NS_IMETHOD GetFile(nsIFile * *aFile) { if (m_pFile) { NS_ADDREF(*aFile = m_pFile); return NS_OK;} else return NS_ERROR_FAILURE; }



  nsImportMailboxDescriptor();
  virtual ~nsImportMailboxDescriptor() {}

   static NS_METHOD Create(nsISupports *aOuter, REFNSIID aIID, void **aResult);

private:
  uint32_t    m_id;      // used by creator of the structure
  uint32_t    m_depth;    // depth in the hierarchy
  nsString    m_displayName;// name of this mailbox
  nsCOMPtr <nsIFile> m_pFile;  // source file (if applicable)
  uint32_t    m_size;
  bool        m_import;    // import it or not?
};


#endif
