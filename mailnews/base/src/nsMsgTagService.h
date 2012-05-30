/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgTagService_h__
#define nsMsgTagService_h__

#include "nsIMsgTagService.h"
#include "nsIPrefBranch.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"

class nsMsgTag : public nsIMsgTag
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGTAG

  nsMsgTag(const nsACString &aKey,
           const nsAString  &aTag,
           const nsACString &aColor,
           const nsACString &aOrdinal);
  ~nsMsgTag();

protected:
  nsString  mTag;
  nsCString mKey, mColor, mOrdinal;
};


class nsMsgTagService : public nsIMsgTagService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGTAGSERVICE

  nsMsgTagService();

private:
  ~nsMsgTagService();

protected:
  nsresult SetUnicharPref(const char *prefName,
                          const nsAString &prefValue);
  nsresult GetUnicharPref(const char *prefName,
                          nsAString &prefValue);
  nsresult MigrateLabelsToTags();
  nsresult RefreshKeyCache();

  nsCOMPtr<nsIPrefBranch> m_tagPrefBranch;
  nsTArray<nsCString> m_keys;
};

#endif
