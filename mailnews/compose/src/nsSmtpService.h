/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsSmtpService_h___
#define nsSmtpService_h___

#include "nscore.h"
#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "nsISmtpService.h"
#include "nsISmtpServer.h"
#include "nsIProtocolHandler.h"

////////////////////////////////////////////////////////////////////////////////////////
// The Smtp Service is an interfaced designed to make building and running mail to urls
// easier. I'm not sure if this service will go away when the new networking model comes
// on line (as part of the N2 project). So I reserve the right to change my mind and take
// this service away =).
////////////////////////////////////////////////////////////////////////////////////////

class nsSmtpService : public nsISmtpService, public nsIProtocolHandler
{
public:

	nsSmtpService();
	virtual ~nsSmtpService();
	
	NS_DECL_ISUPPORTS

	////////////////////////////////////////////////////////////////////////
	// we suppport the nsISmtpService interface 
	////////////////////////////////////////////////////////////////////////    
	NS_DECL_NSISMTPSERVICE

	//////////////////////////////////////////////////////////////////////////
	// we suppport the nsIProtocolHandler interface 
	//////////////////////////////////////////////////////////////////////////
  NS_DECL_NSIPROTOCOLHANDLER

protected:
    nsresult loadSmtpServers();

    
private:
    static bool findServerByKey(nsISmtpServer *aServer, void *aData);
    static bool findServerByHostname(nsISmtpServer *aServer, void *aData);
    
    nsresult createKeyedServer(const char* key,
                               nsISmtpServer **aResult = nullptr);
    nsresult saveKeyList();
    
    nsCOMArray<nsISmtpServer> mSmtpServers;
    nsCOMPtr<nsISmtpServer> mDefaultSmtpServer;
    nsCOMPtr<nsISmtpServer> mSessionDefaultServer;

    nsCString mServerKeyList;

    bool mSmtpServersLoaded;
};

#endif /* nsSmtpService_h___ */
