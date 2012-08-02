/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportABDescriptor_h___
#define nsImportABDescriptor_h___

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIImportABDescriptor.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"

////////////////////////////////////////////////////////////////////////

class nsImportABDescriptor : public nsIImportABDescriptor
{
public:
  NS_DECL_ISUPPORTS

  NS_IMETHOD GetIdentifier(PRUint32 *pIdentifier) {
    *pIdentifier = mId;
    return NS_OK;
  }
  NS_IMETHOD SetIdentifier(PRUint32 ident) {
    mId = ident;
    return NS_OK;
  }

  NS_IMETHOD GetRef(PRUint32 *pRef) {
    *pRef = mRef;
    return NS_OK;
  }
  NS_IMETHOD SetRef(PRUint32 ref) {
    mRef = ref;
    return NS_OK;
  }

  /* attribute unsigned long size; */
  NS_IMETHOD GetSize(PRUint32 *pSize) {
    *pSize = mSize;
    return NS_OK;
  }
  NS_IMETHOD SetSize(PRUint32 theSize) {
    mSize = theSize;
    return NS_OK;
  }

  /* attribute AString displayName; */
  NS_IMETHOD GetPreferredName(nsAString &aName) {
    aName = mDisplayName;
    return NS_OK;
  }
  NS_IMETHOD SetPreferredName(const nsAString &aName) {
    mDisplayName = aName;
    return NS_OK;
  }

  /* readonly attribute nsIFile fileSpec; */
  NS_IMETHOD GetAbFile(nsIFile **aFile) {
    if (!mFile)
      return NS_ERROR_NULL_POINTER;

    return mFile->Clone(aFile);
  }

  NS_IMETHOD SetAbFile(nsIFile *aFile) {
    if (!aFile) {
      mFile = nullptr;
      return NS_OK;
    }

    return aFile->Clone(getter_AddRefs(mFile));
  }

  /* attribute boolean import; */
  NS_IMETHOD GetImport(bool *pImport) {
    *pImport = mImport;
    return NS_OK;
  }
  NS_IMETHOD SetImport(bool doImport) {
    mImport = doImport;
    return NS_OK;
  }

  nsImportABDescriptor();
  virtual ~nsImportABDescriptor() {}

  static NS_METHOD Create(nsISupports *aOuter, REFNSIID aIID, void **aResult);

private:
  PRUint32 mId; // used by creator of the structure
  PRUint32 mRef; // depth in the hierarchy
  nsString mDisplayName; // name of this mailbox
  nsCOMPtr<nsIFile> mFile; // source file (if applicable)
  PRUint32 mSize; // size
  bool mImport; // import it or not?
};


#endif
