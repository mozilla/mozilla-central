/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgIdentity_h___
#define nsMsgIdentity_h___

#include "nsIMsgIdentity.h"
#include "nsIPrefBranch.h"
#include "msgCore.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"

class NS_MSG_BASE nsMsgIdentity : public nsIMsgIdentity
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIMSGIDENTITY
  
private:
  nsCString mKey;
  nsCOMPtr<nsIPrefBranch> mPrefBranch;
  nsCOMPtr<nsIPrefBranch> mDefPrefBranch;

protected:
  nsresult getFolderPref(const char *pref, nsCString&, const char *, uint32_t);
  nsresult setFolderPref(const char *pref, const nsACString&, uint32_t);
};


#define NS_IMPL_IDPREF_STR(_postfix, _prefname)       \
NS_IMETHODIMP                                         \
nsMsgIdentity::Get##_postfix(nsACString& retval)      \
{                                                     \
  return GetCharAttribute(_prefname, retval);         \
}                                                     \
NS_IMETHODIMP                                         \
nsMsgIdentity::Set##_postfix(const nsACString& value) \
{                                                     \
  return SetCharAttribute(_prefname, value);          \
}

#define NS_IMPL_IDPREF_WSTR(_postfix, _prefname)     \
NS_IMETHODIMP                                        \
nsMsgIdentity::Get##_postfix(nsAString& retval)      \
{                                                    \
  return GetUnicharAttribute(_prefname, retval);     \
}                                                    \
NS_IMETHODIMP                                        \
nsMsgIdentity::Set##_postfix(const nsAString& value) \
{                                                    \
  return SetUnicharAttribute(_prefname, value);      \
}

#define NS_IMPL_IDPREF_BOOL(_postfix, _prefname)     \
NS_IMETHODIMP                                        \
nsMsgIdentity::Get##_postfix(bool *retval)         \
{                                                    \
  return GetBoolAttribute(_prefname, retval);        \
}                                                    \
NS_IMETHODIMP                                        \
nsMsgIdentity::Set##_postfix(bool value)           \
{                                                    \
  return mPrefBranch->SetBoolPref(_prefname, value); \
}

#define NS_IMPL_IDPREF_INT(_postfix, _prefname)     \
NS_IMETHODIMP                                       \
nsMsgIdentity::Get##_postfix(int32_t *retval)       \
{                                                   \
  return GetIntAttribute(_prefname, retval);        \
}                                                   \
NS_IMETHODIMP                                       \
nsMsgIdentity::Set##_postfix(int32_t value)         \
{                                                   \
  return mPrefBranch->SetIntPref(_prefname, value); \
}

#define NS_IMPL_FOLDERPREF_STR(_postfix, _prefname, _foldername, _flag)  \
NS_IMETHODIMP                                               \
nsMsgIdentity::Get##_postfix(nsACString& retval)            \
{                                                           \
  nsresult rv;                                              \
  nsCString folderPref;                                     \
  rv = getFolderPref(_prefname, folderPref, _foldername, _flag); \
  retval = folderPref;                                      \
  return rv;                                                \
}                                                           \
NS_IMETHODIMP                                               \
nsMsgIdentity::Set##_postfix(const nsACString& value)       \
{                                                           \
  return setFolderPref(_prefname, value, _flag); \
}

#endif /* nsMsgIdentity_h___ */
