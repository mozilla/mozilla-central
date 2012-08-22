/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsSMimeJSHelper_H_
#define _nsSMimeJSHelper_H_

#include "nsISMimeJSHelper.h"
#include "nsIX509Cert.h"
#include "nsIMsgCompFields.h"

class nsSMimeJSHelper : public nsISMimeJSHelper
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISMIMEJSHELPER

  nsSMimeJSHelper();
  virtual ~nsSMimeJSHelper();

private:
  nsresult getMailboxList(nsIMsgCompFields *compFields, uint32_t *mailbox_count, char **mailbox_list);
};

#endif
