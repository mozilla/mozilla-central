/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsRssService.h"
#include "nsIRssIncomingServer.h"
#include "nsCOMPtr.h"
#include "nsIFile.h"
#include "nsMailDirServiceDefs.h"
#include "nsIProperties.h"
#include "nsServiceManagerUtils.h"

nsRssService::nsRssService()
{
}

nsRssService::~nsRssService()
{
}

NS_IMPL_ISUPPORTS2(nsRssService,
                   nsIRssService,
                   nsIMsgProtocolInfo)
                   
NS_IMETHODIMP nsRssService::GetDefaultLocalPath(nsIFile * *aDefaultLocalPath)
{
    NS_ENSURE_ARG_POINTER(aDefaultLocalPath);
    *aDefaultLocalPath = nullptr;
    
    nsCOMPtr<nsIFile> localFile;
    nsCOMPtr<nsIProperties> dirService(do_GetService("@mozilla.org/file/directory_service;1"));
    if (!dirService) return NS_ERROR_FAILURE;
    dirService->Get(NS_APP_MAIL_50_DIR, NS_GET_IID(nsIFile), getter_AddRefs(localFile));
    if (!localFile) return NS_ERROR_FAILURE;

    bool exists;
    nsresult rv = localFile->Exists(&exists);
    if (NS_SUCCEEDED(rv) && !exists)
        rv = localFile->Create(nsIFile::DIRECTORY_TYPE, 0775);
    if (NS_FAILED(rv)) return rv;
   
    NS_IF_ADDREF(*aDefaultLocalPath = localFile);
    return NS_OK;

}

NS_IMETHODIMP nsRssService::SetDefaultLocalPath(nsIFile * aDefaultLocalPath)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssService::GetServerIID(nsIID * *aServerIID)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssService::GetRequiresUsername(bool *aRequiresUsername)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssService::GetPreflightPrettyNameWithEmailAddress(bool *aPreflightPrettyNameWithEmailAddress)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsRssService::GetCanDelete(bool *aCanDelete)
{
    NS_ENSURE_ARG_POINTER(aCanDelete);
    *aCanDelete = true;
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetCanLoginAtStartUp(bool *aCanLoginAtStartUp)
{
    NS_ENSURE_ARG_POINTER(aCanLoginAtStartUp);
    *aCanLoginAtStartUp = true;
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetCanDuplicate(bool *aCanDuplicate)
{
    NS_ENSURE_ARG_POINTER(aCanDuplicate);
    *aCanDuplicate = true;
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetDefaultServerPort(bool isSecure, int32_t *_retval)
{
    *_retval = -1;
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetCanGetMessages(bool *aCanGetMessages)
{
    NS_ENSURE_ARG_POINTER(aCanGetMessages);
    *aCanGetMessages = true;
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetCanGetIncomingMessages(bool *aCanGetIncomingMessages)
{
    NS_ENSURE_ARG_POINTER(aCanGetIncomingMessages);
    *aCanGetIncomingMessages = true;
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetDefaultDoBiff(bool *aDefaultDoBiff)
{
    NS_ENSURE_ARG_POINTER(aDefaultDoBiff);
    // by default, do biff for RSS feeds
    *aDefaultDoBiff = true;    
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetShowComposeMsgLink(bool *aShowComposeMsgLink)
{
    NS_ENSURE_ARG_POINTER(aShowComposeMsgLink);
    *aShowComposeMsgLink = false;    
    return NS_OK;
}

NS_IMETHODIMP nsRssService::GetFoldersCreatedAsync(bool *aAsyncCreation)
{
  NS_ENSURE_ARG_POINTER(aAsyncCreation);
  *aAsyncCreation = false;
  return NS_OK;
}
