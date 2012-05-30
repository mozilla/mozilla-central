/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsPop3Service_h___
#define nsPop3Service_h___

#include "nscore.h"

#include "nsIPop3Service.h"
#include "nsIPop3URL.h"
#include "nsIUrlListener.h"
#include "nsIStreamListener.h"
#include "nsIProtocolHandler.h"
#include "nsIMsgProtocolInfo.h"
#include "nsTObserverArray.h"

class nsIMsgMailNewsUrl;

class nsPop3Service : public nsIPop3Service,
                      public nsIProtocolHandler,
                      public nsIMsgProtocolInfo
{
public:

  nsPop3Service();
  virtual ~nsPop3Service();
  
  NS_DECL_ISUPPORTS
  NS_DECL_NSIPOP3SERVICE
  NS_DECL_NSIPROTOCOLHANDLER
  NS_DECL_NSIMSGPROTOCOLINFO

protected:
  nsresult GetMail(bool downloadNewMail,
                   nsIMsgWindow* aMsgWindow, 
                   nsIUrlListener * aUrlListener,
                   nsIMsgFolder *inbox, 
                   nsIPop3IncomingServer *popServer,
                   nsIURI ** aURL);
  // convience function to make constructing of the pop3 url easier...
  nsresult BuildPop3Url(const char * urlSpec, nsIMsgFolder *inbox,
                    nsIPop3IncomingServer *, nsIUrlListener * aUrlListener,
                    nsIURI ** aUrl, nsIMsgWindow *aMsgWindow);

  nsresult RunPopUrl(nsIMsgIncomingServer * aServer, nsIURI * aUrlToRun);
  void AlertServerBusy(nsIMsgMailNewsUrl *url);
  nsTObserverArray<nsCOMPtr<nsIPop3ServiceListener> > mListeners;
};

#endif /* nsPop3Service_h___ */
