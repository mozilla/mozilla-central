/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMailDirProvider_h__
#define nsMailDirProvider_h__

#include "nsIDirectoryService.h"
#include "nsISimpleEnumerator.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"

class nsMailDirProvider : public nsIDirectoryServiceProvider2
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIDIRECTORYSERVICEPROVIDER
  NS_DECL_NSIDIRECTORYSERVICEPROVIDER2

private:
  nsresult EnsureDirectory(nsIFile *aDirectory);

  class AppendingEnumerator : public nsISimpleEnumerator
  {
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSISIMPLEENUMERATOR

    AppendingEnumerator(nsISimpleEnumerator* aBase);

  private:
    nsCOMPtr<nsISimpleEnumerator> mBase;
    nsCOMPtr<nsIFile>             mNext;
    nsCOMPtr<nsIFile>             mNextWithLocale;
    nsCString                     mLocale;
  };
};

#endif // nsMailDirProvider_h__
