/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMovemailService_h___
#define nsMovemailService_h___

#include "nscore.h"
#include "nsCOMPtr.h"

#include "nsIMovemailService.h"
#include "nsIMsgProtocolInfo.h"
#include "nsIMsgWindow.h"

class nsParseNewMailState;
class nsIMsgFolder;

class nsMovemailService : public nsIMsgProtocolInfo, public nsIMovemailService
{
public:

  nsMovemailService();
  virtual ~nsMovemailService();
  
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMOVEMAILSERVICE
  NS_DECL_NSIMSGPROTOCOLINFO
  
private:
  void Error(const char* errorCode, const PRUnichar **params, uint32_t length);
  nsCOMPtr<nsIMsgWindow> mMsgWindow;
};

#endif /* nsMovemailService_h___ */
