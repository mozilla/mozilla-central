/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsILDAPControl.h"
#include "nsCOMPtr.h"
#include "nsILDAPBERValue.h"
#include "nsStringGlue.h"
#include "ldap.h"

// {5B608BBE-C0EA-4f74-B209-9CDCD79EC401}
#define NS_LDAPCONTROL_CID \
  { 0x5b608bbe, 0xc0ea, 0x4f74, \
      { 0xb2, 0x9, 0x9c, 0xdc, 0xd7, 0x9e, 0xc4, 0x1 } }

class nsLDAPControl : public nsILDAPControl
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSILDAPCONTROL

  nsLDAPControl();

  /**
   * return a pointer to C-SDK compatible LDAPControl structure.  Note that
   * this is allocated with NS_Alloc and must be freed with NS_Free, both by 
   * ldap_control_free() and friends.
   *
   * @exception null pointer return if allocation failed
   */
  nsresult ToLDAPControl(LDAPControl **aControl);

private:
  ~nsLDAPControl();

protected:
  nsCOMPtr<nsILDAPBERValue> mValue;	// the value portion of this control
  bool mIsCritical;      // should server abort if control not understood?
  nsCString mOid;          // Object ID for this control
};
