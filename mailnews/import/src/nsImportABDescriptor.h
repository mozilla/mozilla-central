/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsImportABDescriptor_h___
#define nsImportABDescriptor_h___

#include "mozilla/Attributes.h"
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

  NS_IMETHOD GetIdentifier(uint32_t *pIdentifier) MOZ_OVERRIDE {
    *pIdentifier = mId;
    return NS_OK;
  }
  NS_IMETHOD SetIdentifier(uint32_t ident) MOZ_OVERRIDE {
    mId = ident;
    return NS_OK;
  }

  NS_IMETHOD GetRef(uint32_t *pRef) MOZ_OVERRIDE {
    *pRef = mRef;
    return NS_OK;
  }
  NS_IMETHOD SetRef(uint32_t ref) MOZ_OVERRIDE {
    mRef = ref;
    return NS_OK;
  }

  /* attribute unsigned long size; */
  NS_IMETHOD GetSize(uint32_t *pSize) MOZ_OVERRIDE {
    *pSize = mSize;
    return NS_OK;
  }
  NS_IMETHOD SetSize(uint32_t theSize) MOZ_OVERRIDE {
    mSize = theSize;
    return NS_OK;
  }

  /* attribute AString displayName; */
  NS_IMETHOD GetPreferredName(nsAString &aName) MOZ_OVERRIDE {
    aName = mDisplayName;
    return NS_OK;
  }
  NS_IMETHOD SetPreferredName(const nsAString &aName) MOZ_OVERRIDE {
    mDisplayName = aName;
    return NS_OK;
  }

  /* readonly attribute nsIFile fileSpec; */
  NS_IMETHOD GetAbFile(nsIFile **aFile) MOZ_OVERRIDE {
    if (!mFile)
      return NS_ERROR_NULL_POINTER;

    return mFile->Clone(aFile);
  }

  NS_IMETHOD SetAbFile(nsIFile *aFile) MOZ_OVERRIDE {
    if (!aFile) {
      mFile = nullptr;
      return NS_OK;
    }

    return aFile->Clone(getter_AddRefs(mFile));
  }

  /* attribute boolean import; */
  NS_IMETHOD GetImport(bool *pImport) MOZ_OVERRIDE {
    *pImport = mImport;
    return NS_OK;
  }
  NS_IMETHOD SetImport(bool doImport) MOZ_OVERRIDE {
    mImport = doImport;
    return NS_OK;
  }

  nsImportABDescriptor();
  virtual ~nsImportABDescriptor() {}

  static NS_METHOD Create(nsISupports *aOuter, REFNSIID aIID, void **aResult);

private:
  uint32_t mId; // used by creator of the structure
  uint32_t mRef; // depth in the hierarchy
  nsString mDisplayName; // name of this mailbox
  nsCOMPtr<nsIFile> mFile; // source file (if applicable)
  uint32_t mSize; // size
  bool mImport; // import it or not?
};


#endif
