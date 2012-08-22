/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...

#include "nsNoneService.h"
#include "nsINoIncomingServer.h"
#include "nsINoneService.h"
#include "nsIMsgProtocolInfo.h"

#include "nsMsgLocalCID.h"
#include "nsMsgBaseCID.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"
#include "nsMsgUtils.h"

#include "nsIDirectoryService.h"
#include "nsMailDirServiceDefs.h"

#define PREF_MAIL_ROOT_NONE "mail.root.none"        // old - for backward compatibility only
#define PREF_MAIL_ROOT_NONE_REL "mail.root.none-rel"

nsNoneService::nsNoneService()
{
}

nsNoneService::~nsNoneService()
{}

NS_IMPL_ISUPPORTS2(nsNoneService, nsINoneService, nsIMsgProtocolInfo)

NS_IMETHODIMP
nsNoneService::SetDefaultLocalPath(nsIFile *aPath)
{
    NS_ENSURE_ARG(aPath);
    return NS_SetPersistentFile(PREF_MAIL_ROOT_NONE_REL, PREF_MAIL_ROOT_NONE, aPath);
}     

NS_IMETHODIMP
nsNoneService::GetDefaultLocalPath(nsIFile ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    *aResult = nullptr;
    
    bool havePref;
    nsCOMPtr<nsIFile> localFile;    
    nsresult rv = NS_GetPersistentFile(PREF_MAIL_ROOT_NONE_REL,
                              PREF_MAIL_ROOT_NONE,
                              NS_APP_MAIL_50_DIR,
                              havePref,
                              getter_AddRefs(localFile));
    if (NS_FAILED(rv)) return rv;
    
    bool exists;
    rv = localFile->Exists(&exists);
    if (NS_SUCCEEDED(rv) && !exists)
        rv = localFile->Create(nsIFile::DIRECTORY_TYPE, 0775);
    if (NS_FAILED(rv)) return rv;
    
    if (!havePref || !exists) 
    {
        rv = NS_SetPersistentFile(PREF_MAIL_ROOT_NONE_REL, PREF_MAIL_ROOT_NONE, localFile);
        NS_ASSERTION(NS_SUCCEEDED(rv), "Failed to set root dir pref.");
    }
        
    NS_IF_ADDREF(*aResult = localFile);
    return NS_OK;

}
    

NS_IMETHODIMP
nsNoneService::GetServerIID(nsIID* *aServerIID)
{
    *aServerIID = new nsIID(NS_GET_IID(nsINoIncomingServer));
    return NS_OK;
}

NS_IMETHODIMP
nsNoneService::GetRequiresUsername(bool *aRequiresUsername)
{
  NS_ENSURE_ARG_POINTER(aRequiresUsername);
  *aRequiresUsername = true;
  return NS_OK;
}

NS_IMETHODIMP
nsNoneService::GetPreflightPrettyNameWithEmailAddress(bool *aPreflightPrettyNameWithEmailAddress)
{
  NS_ENSURE_ARG_POINTER(aPreflightPrettyNameWithEmailAddress);
  *aPreflightPrettyNameWithEmailAddress = true;
  return NS_OK;
}

NS_IMETHODIMP
nsNoneService::GetCanLoginAtStartUp(bool *aCanLoginAtStartUp)
{
  NS_ENSURE_ARG_POINTER(aCanLoginAtStartUp);
  *aCanLoginAtStartUp = false;
  return NS_OK;
}

NS_IMETHODIMP
nsNoneService::GetCanDelete(bool *aCanDelete)
{
  NS_ENSURE_ARG_POINTER(aCanDelete);
  *aCanDelete = false;
  return NS_OK;
}  

NS_IMETHODIMP
nsNoneService::GetCanDuplicate(bool *aCanDuplicate)
{
  NS_ENSURE_ARG_POINTER(aCanDuplicate);
  *aCanDuplicate = false;
  return NS_OK;
}  

NS_IMETHODIMP
nsNoneService::GetCanGetMessages(bool *aCanGetMessages)
{
    NS_ENSURE_ARG_POINTER(aCanGetMessages);
    *aCanGetMessages = false;
    return NS_OK;
}  

NS_IMETHODIMP
nsNoneService::GetCanGetIncomingMessages(bool *aCanGetIncomingMessages)
{
    NS_ENSURE_ARG_POINTER(aCanGetIncomingMessages);
    *aCanGetIncomingMessages = false;
    return NS_OK;
} 

NS_IMETHODIMP 
nsNoneService::GetDefaultDoBiff(bool *aDoBiff)
{
    NS_ENSURE_ARG_POINTER(aDoBiff);
    // by default, don't do biff for "none" servers
    *aDoBiff = false;    
    return NS_OK;
}

NS_IMETHODIMP
nsNoneService::GetDefaultServerPort(bool isSecure, int32_t *aDefaultPort)
{
    NS_ENSURE_ARG_POINTER(aDefaultPort);
    *aDefaultPort = -1;
    return NS_OK;
}

NS_IMETHODIMP 
nsNoneService::GetShowComposeMsgLink(bool *showComposeMsgLink)
{
    NS_ENSURE_ARG_POINTER(showComposeMsgLink);
    *showComposeMsgLink = false;    
    return NS_OK;
}
