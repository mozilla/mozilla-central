/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#include "nscore.h"
#include "nsImportMailboxDescriptor.h"
#include "nsComponentManagerUtils.h"

////////////////////////////////////////////////////////////////////////



NS_METHOD nsImportMailboxDescriptor::Create(nsISupports *aOuter, REFNSIID aIID, void **aResult)
{
  if (aOuter)
    return NS_ERROR_NO_AGGREGATION;

  nsImportMailboxDescriptor *it = new nsImportMailboxDescriptor();
  if (it == nullptr)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(it);
  nsresult rv = it->QueryInterface(aIID, aResult);
  NS_RELEASE(it);
  return rv;
}

NS_IMPL_ISUPPORTS1(nsImportMailboxDescriptor, nsIImportMailboxDescriptor)

nsImportMailboxDescriptor::nsImportMailboxDescriptor()
{
  m_import = true;
  m_size = 0;
  m_depth = 0;
  m_id = 0;
        m_pFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID);
}
