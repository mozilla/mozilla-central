/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPControl.h"
#include "prmem.h"
#include "plstr.h"
#include "nsLDAPBERValue.h"

NS_IMPL_ISUPPORTS1(nsLDAPControl, nsILDAPControl)

nsLDAPControl::nsLDAPControl()
  : mIsCritical(false)
{
}

nsLDAPControl::~nsLDAPControl()
{
}

/* attribute ACString oid; */
NS_IMETHODIMP nsLDAPControl::GetOid(nsACString & aOid)
{
  aOid.Assign(mOid);
  return NS_OK;
}
NS_IMETHODIMP nsLDAPControl::SetOid(const nsACString & aOid)
{
  mOid = aOid;
  return NS_OK;
}

/* attribute nsILDAPBERValue value; */
NS_IMETHODIMP
nsLDAPControl::GetValue(nsILDAPBERValue * *aValue)
{
  NS_IF_ADDREF(*aValue = mValue);
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPControl::SetValue(nsILDAPBERValue * aValue)
{
  mValue = aValue;
  return NS_OK;
}

/* attribute boolean isCritical; */
NS_IMETHODIMP 
nsLDAPControl::GetIsCritical(bool *aIsCritical)
{
  *aIsCritical = mIsCritical;
  return NS_OK;
}
NS_IMETHODIMP
nsLDAPControl::SetIsCritical(bool aIsCritical)
{
  mIsCritical = aIsCritical;
  return NS_OK;
}

/**
 * utility routine for use inside the LDAP XPCOM SDK
 */
nsresult
nsLDAPControl::ToLDAPControl(LDAPControl **control)
{
  // because nsLDAPProtocolModule::Init calls prldap_install_routines we know
  // that the C SDK will be using the NSPR allocator under the hood, so our
  // callers will therefore be able to use ldap_control_free() and friends on
  // this control.
  LDAPControl *ctl = static_cast<LDAPControl *>(PR_Calloc(1, sizeof(LDAPControl)));
  if (!ctl) {
    return NS_ERROR_OUT_OF_MEMORY;
  }

  // need to ensure that this string is also alloced by PR_Alloc
  ctl->ldctl_oid = PL_strdup(mOid.get());
  if (!ctl->ldctl_oid) {
    PR_Free(ctl);
    return NS_ERROR_OUT_OF_MEMORY;
  }

  ctl->ldctl_iscritical = mIsCritical;

  if (!mValue) {
    // no data associated with this control
    ctl->ldctl_value.bv_len = 0;
    ctl->ldctl_value.bv_val = 0;
  } else {

    // just to make the code below a bit more readable
    nsLDAPBERValue *nsBerVal = 
      static_cast<nsLDAPBERValue *>(static_cast<nsILDAPBERValue *>
                             (mValue.get()));
    ctl->ldctl_value.bv_len = nsBerVal->mSize;

    if (!nsBerVal->mSize) {
      // a zero-length value is associated with this control
      return NS_ERROR_NOT_IMPLEMENTED;
    } else {

      // same for the berval itself
      ctl->ldctl_value.bv_len = nsBerVal->mSize;
      ctl->ldctl_value.bv_val = static_cast<char *>
                                           (PR_Malloc(nsBerVal->mSize));
      if (!ctl->ldctl_value.bv_val) {
        ldap_control_free(ctl);
        return NS_ERROR_OUT_OF_MEMORY;
      }
  
      memcpy(ctl->ldctl_value.bv_val, nsBerVal->mValue,
             ctl->ldctl_value.bv_len);
    }
  }

  *control = ctl;

  return NS_OK;
}
