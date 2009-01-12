/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alec Flett <alecf@netscape.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef nsMsgIdentity_h___
#define nsMsgIdentity_h___

#include "nsIMsgIdentity.h"
#include "nsIPrefBranch.h"
#include "msgCore.h"
#include "nsCOMPtr.h"


class NS_MSG_BASE nsMsgIdentity : public nsIMsgIdentity
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGIDENTITY
  
private:
  nsCString mKey;
  nsCOMPtr<nsIPrefBranch> mPrefBranch;
  nsCOMPtr<nsIPrefBranch> mDefPrefBranch;

protected:
  nsresult getFolderPref(const char *pref, nsCString&, const char *, PRUint32);
  nsresult setFolderPref(const char *pref, const nsACString&, PRUint32);
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
nsMsgIdentity::Get##_postfix(PRBool *retval)         \
{                                                    \
  return GetBoolAttribute(_prefname, retval);        \
}                                                    \
NS_IMETHODIMP                                        \
nsMsgIdentity::Set##_postfix(PRBool value)           \
{                                                    \
  return mPrefBranch->SetBoolPref(_prefname, value); \
}

#define NS_IMPL_IDPREF_INT(_postfix, _prefname)     \
NS_IMETHODIMP                                       \
nsMsgIdentity::Get##_postfix(PRInt32 *retval)       \
{                                                   \
  return GetIntAttribute(_prefname, retval);        \
}                                                   \
NS_IMETHODIMP                                       \
nsMsgIdentity::Set##_postfix(PRInt32 value)         \
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
