/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsRssService_h___
#define nsRssService_h___

#include "nsIRssService.h"
#include "nsIMsgProtocolInfo.h"

class nsRssService : public nsIMsgProtocolInfo, public nsIRssService
{
public:

  nsRssService();
  virtual ~nsRssService();
  
  NS_DECL_ISUPPORTS
  NS_DECL_NSIRSSSERVICE
  NS_DECL_NSIMSGPROTOCOLINFO

};

#endif /* nsRssService_h___ */
