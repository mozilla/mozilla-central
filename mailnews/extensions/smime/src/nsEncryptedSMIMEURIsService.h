/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsEncryptedSMIMEURIsService_H_
#define _nsEncryptedSMIMEURIsService_H_

#include "nsIEncryptedSMIMEURIsSrvc.h"
#include "nsTArray.h"
#include "nsStringGlue.h"

class nsEncryptedSMIMEURIsService : public nsIEncryptedSMIMEURIsService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIENCRYPTEDSMIMEURISSERVICE

  nsEncryptedSMIMEURIsService();
  virtual ~nsEncryptedSMIMEURIsService();

protected:
  nsTArray<nsCString> mEncryptedURIs;
};

#endif
