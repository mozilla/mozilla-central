/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgLocalCID.h"
#include "nsMsgFolderFlags.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIMovemailService.h"
#include "nsIFile.h"
#include "msgCore.h" // pre-compiled headers
#include "nsMovemailIncomingServer.h"
#include "nsServiceManagerUtils.h"


static NS_DEFINE_CID(kCMovemailServiceCID, NS_MOVEMAILSERVICE_CID);


NS_IMPL_ISUPPORTS_INHERITED2(nsMovemailIncomingServer,
                             nsMsgIncomingServer,
                             nsIMovemailIncomingServer,
                             nsILocalMailIncomingServer)

                            

nsMovemailIncomingServer::nsMovemailIncomingServer()
{    
    m_canHaveFilters = true;
}

nsMovemailIncomingServer::~nsMovemailIncomingServer()
{
}

NS_IMETHODIMP 
nsMovemailIncomingServer::PerformBiff(nsIMsgWindow *aMsgWindow)
{
    nsresult rv;
    nsCOMPtr<nsIMovemailService> movemailService(do_GetService(
                                                 kCMovemailServiceCID, &rv));
    if (NS_FAILED(rv)) return rv;
    nsCOMPtr<nsIMsgFolder> inbox;
    nsCOMPtr<nsIMsgFolder> rootMsgFolder;
    nsCOMPtr<nsIUrlListener> urlListener;
    rv = GetRootMsgFolder(getter_AddRefs(rootMsgFolder));
    if(NS_SUCCEEDED(rv) && rootMsgFolder)
    {
         rootMsgFolder->GetFolderWithFlags(nsMsgFolderFlags::Inbox,
                                           getter_AddRefs(inbox));
         if (!inbox) return NS_ERROR_FAILURE;
    }

    SetPerformingBiff(true);
    urlListener = do_QueryInterface(inbox);

    bool downloadOnBiff = false;
    rv = GetDownloadOnBiff(&downloadOnBiff);
    if (downloadOnBiff)
    {
       nsCOMPtr <nsIMsgLocalMailFolder> localInbox = do_QueryInterface(inbox,
                                                                       &rv);
       if (localInbox && NS_SUCCEEDED(rv))
       {
           bool valid = false;
           nsCOMPtr <nsIMsgDatabase> db;
           rv = inbox->GetMsgDatabase(getter_AddRefs(db));
           if (NS_SUCCEEDED(rv) && db)
           {
               rv = db->GetSummaryValid(&valid);
           }
           if (NS_SUCCEEDED(rv) && valid)
           {
               rv = movemailService->GetNewMail(aMsgWindow, urlListener, inbox,
                                                this, nullptr);
           }
           else
           {
              bool isLocked;
              inbox->GetLocked(&isLocked);
              if (!isLocked)
              {
                 rv = localInbox->ParseFolder(aMsgWindow, urlListener);
              }
              if (NS_SUCCEEDED(rv))
              {
                 rv = localInbox->SetCheckForNewMessagesAfterParsing(true);
              }
           }
       }
    }
    else
    {
        movemailService->CheckForNewMail(urlListener, inbox, this, nullptr); 
    }

    return NS_OK;
}

NS_IMETHODIMP
nsMovemailIncomingServer::SetFlagsOnDefaultMailboxes()
{
    nsCOMPtr<nsIMsgFolder> rootFolder;
    nsresult rv = GetRootFolder(getter_AddRefs(rootFolder));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgLocalMailFolder> localFolder =
        do_QueryInterface(rootFolder, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    return localFolder->SetFlagsOnDefaultMailboxes(nsMsgFolderFlags::SpecialUse);
}

NS_IMETHODIMP nsMovemailIncomingServer::CreateDefaultMailboxes(nsIFile *aPath)
{
  nsresult rv = CreateLocalFolder(NS_LITERAL_STRING("Inbox"));
  NS_ENSURE_SUCCESS(rv, rv);

  return CreateLocalFolder(NS_LITERAL_STRING("Trash"));
}


NS_IMETHODIMP
nsMovemailIncomingServer::GetNewMail(nsIMsgWindow *aMsgWindow,
                                     nsIUrlListener *aUrlListener,
                                     nsIMsgFolder *aMsgFolder,
                                     nsIURI **aResult)
{
    nsresult rv;
    
    nsCOMPtr<nsIMovemailService> movemailService = 
             do_GetService(kCMovemailServiceCID, &rv);
    
    if (NS_FAILED(rv)) return rv;
    
    rv = movemailService->GetNewMail(aMsgWindow, aUrlListener,
                                     aMsgFolder, this, aResult);

    return rv;
}        

NS_IMETHODIMP
nsMovemailIncomingServer::GetDownloadMessagesAtStartup(bool *getMessagesAtStartup)
{
    NS_ENSURE_ARG_POINTER(getMessagesAtStartup);
    *getMessagesAtStartup = true;
    return NS_OK;
}

NS_IMETHODIMP
nsMovemailIncomingServer::GetCanBeDefaultServer(bool *aCanBeDefaultServer)
{
  NS_ENSURE_ARG_POINTER(aCanBeDefaultServer);
  *aCanBeDefaultServer = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailIncomingServer::GetCanSearchMessages(bool *canSearchMessages)
{
    NS_ENSURE_ARG_POINTER(canSearchMessages);
    *canSearchMessages = true;
    return NS_OK;
}

NS_IMETHODIMP 
nsMovemailIncomingServer::GetServerRequiresPasswordForBiff(bool *aServerRequiresPasswordForBiff)
{
    NS_ENSURE_ARG_POINTER(aServerRequiresPasswordForBiff);
    *aServerRequiresPasswordForBiff = false;
    return NS_OK;
}

NS_IMETHODIMP 
nsMovemailIncomingServer::GetAccountManagerChrome(nsAString& aResult)
{
    aResult.AssignLiteral("am-main.xul");
    return NS_OK;
}
