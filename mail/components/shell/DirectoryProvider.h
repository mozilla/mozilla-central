/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef DirectoryProvider_h__
#define DirectoryProvider_h__

#include "nsIDirectoryService.h"
#include "nsComponentManagerUtils.h"
#include "nsISimpleEnumerator.h"
#include "nsIFile.h"

#define NS_MAILDIRECTORYPROVIDER_CONTRACTID \
  "@mozilla.org/mail/directory-provider;1"

#define NS_MAILDIRECTORYPROVIDER_CID \
  { 0xa7e8e047, 0xd36e, 0x4605, { 0xa5, 0xab, 0x1a, 0x62, 0x29, 0x03, 0x85, 0x99 }}

namespace mozilla {
namespace mail {

/**
 * Ideally this would be a javascript class, however, when we do so, this somehow breaks
 * our xpcshell-tests due to various errors probably because of the xpconnect process.
 * For now, we'll work around it with c++ until we can fix those issues. See bug 733802
 * for more details.
 */
class DirectoryProvider : public nsIDirectoryServiceProvider2
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIDIRECTORYSERVICEPROVIDER
  NS_DECL_NSIDIRECTORYSERVICEPROVIDER2

  DirectoryProvider() {}
  virtual ~DirectoryProvider() {}

private:
  class AppendingEnumerator : public nsISimpleEnumerator
  {
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSISIMPLEENUMERATOR

    AppendingEnumerator(nsISimpleEnumerator* aBase,
                        char const *const *aAppendList);
    virtual ~AppendingEnumerator() {}

  private:
    nsCOMPtr<nsISimpleEnumerator> mBase;
    char const *const *const      mAppendList;
    nsCOMPtr<nsIFile>             mNext;
  };
};

} // namespace mail
} // namespace mozilla

#endif // DirectoryProvider_h__
