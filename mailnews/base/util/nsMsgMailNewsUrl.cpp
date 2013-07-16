/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsMsgMailNewsUrl.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgAccountManager.h"
#include "nsStringGlue.h"
#include "nsILoadGroup.h"
#include "nsIDocShell.h"
#include "nsIWebProgress.h"
#include "nsIWebProgressListener.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIIOService.h"
#include "nsNetCID.h"
#include "nsIStreamListener.h"
#include "nsIOutputStream.h"
#include "nsIInputStream.h"
#include "nsNetUtil.h"
#include "nsIFile.h"
#include "prmem.h"
#include <time.h>
#include "nsMsgUtils.h"
#include "mozilla/Services.h"
#include <algorithm>

nsMsgMailNewsUrl::nsMsgMailNewsUrl()
{
  // nsIURI specific state
  m_errorMessage = nullptr;
  m_runningUrl = false;
  m_updatingFolder = false;
  m_addContentToCache = false;
  m_msgIsInLocalCache = false;
  m_suppressErrorMsgs = false;
  mMaxProgress = -1;
  m_baseURL = do_CreateInstance(NS_STANDARDURL_CONTRACTID);
}

#define NOTIFY_URL_LISTENERS(propertyfunc_, params_)                   \
  PR_BEGIN_MACRO                                                       \
  nsTObserverArray<nsCOMPtr<nsIUrlListener> >::ForwardIterator iter(mUrlListeners); \
  while (iter.HasMore()) {                                             \
    nsCOMPtr<nsIUrlListener> listener = iter.GetNext();                \
    listener->propertyfunc_ params_;                                   \
  }                                                                    \
  PR_END_MACRO

nsMsgMailNewsUrl::~nsMsgMailNewsUrl()
{
  PR_FREEIF(m_errorMessage);
}
  
NS_IMPL_ISUPPORTS3(nsMsgMailNewsUrl, nsIMsgMailNewsUrl, nsIURL, nsIURI)

////////////////////////////////////////////////////////////////////////////////////
// Begin nsIMsgMailNewsUrl specific support
////////////////////////////////////////////////////////////////////////////////////

nsresult nsMsgMailNewsUrl::GetUrlState(bool * aRunningUrl)
{
  if (aRunningUrl)
    *aRunningUrl = m_runningUrl;

  return NS_OK;
}

nsresult nsMsgMailNewsUrl::SetUrlState(bool aRunningUrl, nsresult aExitCode)
{
  // if we already knew this running state, return, unless the url was aborted
  if (m_runningUrl == aRunningUrl && aExitCode != NS_MSG_ERROR_URL_ABORTED)
    return NS_OK;
  m_runningUrl = aRunningUrl;
  nsCOMPtr <nsIMsgStatusFeedback> statusFeedback;
  
  // put this back - we need it for urls that don't run through the doc loader
  if (NS_SUCCEEDED(GetStatusFeedback(getter_AddRefs(statusFeedback))) && statusFeedback)
  {
    if (m_runningUrl)
      statusFeedback->StartMeteors();
    else
    {
      statusFeedback->ShowProgress(0);
      statusFeedback->StopMeteors();
    }
  }
  
  if (m_runningUrl)
  {
    NOTIFY_URL_LISTENERS(OnStartRunningUrl, (this));
  }
  else
  {
    NOTIFY_URL_LISTENERS(OnStopRunningUrl, (this, aExitCode));
    mUrlListeners.Clear();
  }
  
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::RegisterListener(nsIUrlListener *aUrlListener)
{
  NS_ENSURE_ARG_POINTER(aUrlListener);
  mUrlListeners.AppendElement(aUrlListener);
  return NS_OK;
}

nsresult nsMsgMailNewsUrl::UnRegisterListener(nsIUrlListener *aUrlListener)
{
  NS_ENSURE_ARG_POINTER(aUrlListener);

  int32_t index = mUrlListeners.IndexOf(aUrlListener);
  // Due to the way mailnews is structured, some listeners attempt to remove
  // themselves twice. This may in fact be an error in the coding, however
  // if they didn't do it as they do currently, then they could fail to remove
  // their listeners.
  if (index != -1)
    mUrlListeners.RemoveElementAt(index);

  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetServer(nsIMsgIncomingServer ** aIncomingServer)
{
  // mscott --> we could cache a copy of the server here....but if we did, we run
  // the risk of leaking the server if any single url gets leaked....of course that
  // shouldn't happen...but it could. so i'm going to look it up every time and
  // we can look at caching it later.

  nsresult rv;
  nsAutoCString urlstr;
  nsAutoCString scheme;

  nsCOMPtr<nsIURL> url = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
  if (NS_FAILED(rv)) return rv;

  m_baseURL->GetSpec(urlstr);
  rv = url->SetSpec(urlstr);
  if (NS_FAILED(rv)) return rv;
  rv = GetScheme(scheme);
    if (NS_SUCCEEDED(rv))
    {
        if (scheme.EqualsLiteral("pop"))
          scheme.Assign("pop3");
        // we use "nntp" in the server list so translate it here.
        if (scheme.EqualsLiteral("news"))
          scheme.Assign("nntp");
        url->SetScheme(scheme);
        nsCOMPtr<nsIMsgAccountManager> accountManager = 
                 do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
        if (NS_FAILED(rv)) return rv;
        
        nsCOMPtr<nsIMsgIncomingServer> server;
        rv = accountManager->FindServerByURI(url, false,
                                        aIncomingServer);
        if (!*aIncomingServer && scheme.EqualsLiteral("imap"))
        {
          // look for any imap server with this host name so clicking on 
          // other users folder urls will work. We could override this method
          // for imap urls, or we could make caching of servers work and
          // just set the server in the imap code for this case.
          url->SetUserPass(EmptyCString());
          rv = accountManager->FindServerByURI(url, false,
                                          aIncomingServer);
        }
    }

    return rv;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetMsgWindow(nsIMsgWindow **aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aMsgWindow);
  *aMsgWindow = nullptr;
  
  nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(m_msgWindowWeak));
  msgWindow.swap(*aMsgWindow);
  return *aMsgWindow ? NS_OK : NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetMsgWindow(nsIMsgWindow *aMsgWindow)
{
#ifdef DEBUG_David_Bienvenu
  NS_ASSERTION(aMsgWindow || !m_msgWindowWeak, "someone crunching non-null msg window");
#endif
  m_msgWindowWeak = do_GetWeakReference(aMsgWindow);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetStatusFeedback(nsIMsgStatusFeedback **aMsgFeedback)
{
  // note: it is okay to return a null status feedback and not return an error
  // it's possible the url really doesn't have status feedback
  *aMsgFeedback = nullptr;
  if (!m_statusFeedbackWeak)
  {
    nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(m_msgWindowWeak));
    if (msgWindow)
      msgWindow->GetStatusFeedback(aMsgFeedback);
  }
  else
  {
    nsCOMPtr<nsIMsgStatusFeedback> statusFeedback(do_QueryReferent(m_statusFeedbackWeak));
    statusFeedback.swap(*aMsgFeedback);
  }
  return *aMsgFeedback ? NS_OK : NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetStatusFeedback(nsIMsgStatusFeedback *aMsgFeedback)
{
  if (aMsgFeedback)
    m_statusFeedbackWeak = do_GetWeakReference(aMsgFeedback);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetMaxProgress(int64_t *aMaxProgress)
{
  *aMaxProgress = mMaxProgress;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetMaxProgress(int64_t aMaxProgress)
{
  mMaxProgress = aMaxProgress;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetLoadGroup(nsILoadGroup **aLoadGroup)
{
  *aLoadGroup = nullptr;
  // note: it is okay to return a null load group and not return an error
  // it's possible the url really doesn't have load group
  nsCOMPtr<nsILoadGroup> loadGroup (do_QueryReferent(m_loadGroupWeak));
  if (!loadGroup)
  {
    nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(m_msgWindowWeak));
    if (msgWindow)
    {
      // XXXbz This is really weird... why are we getting some
      // random loadgroup we're not really a part of?
      nsCOMPtr<nsIDocShell> docShell;
      msgWindow->GetRootDocShell(getter_AddRefs(docShell));
      loadGroup = do_GetInterface(docShell);
      m_loadGroupWeak = do_GetWeakReference(loadGroup);
    }
  }
  loadGroup.swap(*aLoadGroup);
  return *aLoadGroup ? NS_OK : NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetUpdatingFolder(bool *aResult)
{
  NS_ENSURE_ARG(aResult);
  *aResult = m_updatingFolder;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetUpdatingFolder(bool updatingFolder)
{
  m_updatingFolder = updatingFolder;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetAddToMemoryCache(bool *aAddToCache)
{
  NS_ENSURE_ARG(aAddToCache); 
  *aAddToCache = m_addContentToCache;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetAddToMemoryCache(bool aAddToCache)
{
  m_addContentToCache = aAddToCache;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetMsgIsInLocalCache(bool *aMsgIsInLocalCache)
{
  NS_ENSURE_ARG(aMsgIsInLocalCache); 
  *aMsgIsInLocalCache = m_msgIsInLocalCache;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetMsgIsInLocalCache(bool aMsgIsInLocalCache)
{
  m_msgIsInLocalCache = aMsgIsInLocalCache;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetSuppressErrorMsgs(bool *aSuppressErrorMsgs)
{
  NS_ENSURE_ARG(aSuppressErrorMsgs); 
  *aSuppressErrorMsgs = m_suppressErrorMsgs;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetSuppressErrorMsgs(bool aSuppressErrorMsgs)
{
  m_suppressErrorMsgs = aSuppressErrorMsgs;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::IsUrlType(uint32_t type, bool *isType)
{
  //base class doesn't know about any specific types
  NS_ENSURE_ARG(isType);
  *isType = false;
  return NS_OK;

}

NS_IMETHODIMP nsMsgMailNewsUrl::SetSearchSession(nsIMsgSearchSession *aSearchSession)
{
  if (aSearchSession)
    m_searchSession = do_QueryInterface(aSearchSession);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetSearchSession(nsIMsgSearchSession **aSearchSession)
{
  NS_ENSURE_ARG(aSearchSession);
  *aSearchSession = m_searchSession;
  NS_IF_ADDREF(*aSearchSession);
  return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////////
// End nsIMsgMailNewsUrl specific support
////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////
// Begin nsIURI support
////////////////////////////////////////////////////////////////////////////////////


NS_IMETHODIMP nsMsgMailNewsUrl::GetSpec(nsACString &aSpec)
{
  return m_baseURL->GetSpec(aSpec);
}

#define FILENAME_PART_LEN 10

NS_IMETHODIMP nsMsgMailNewsUrl::SetSpec(const nsACString &aSpec)
{
  nsAutoCString spec(aSpec);
  // Parse out "filename" attribute if present.
  char *start, *end;
  start = PL_strcasestr(spec.BeginWriting(),"?filename=");
  if (!start)
    start = PL_strcasestr(spec.BeginWriting(),"&filename=");
  if (start)
  { // Make sure we only get our own value.
    end = PL_strcasestr((char*)(start+FILENAME_PART_LEN),"&");
    if (end)
    {
      *end = 0;
      mAttachmentFileName = start+FILENAME_PART_LEN;
      *end = '&';
    }
    else
      mAttachmentFileName = start+FILENAME_PART_LEN;
  }
  // Now, set the rest.
  return m_baseURL->SetSpec(aSpec);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetPrePath(nsACString &aPrePath)
{
  return m_baseURL->GetPrePath(aPrePath);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetScheme(nsACString &aScheme)
{
  return m_baseURL->GetScheme(aScheme);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetScheme(const nsACString &aScheme)
{
  return m_baseURL->SetScheme(aScheme);
}


NS_IMETHODIMP nsMsgMailNewsUrl::GetUserPass(nsACString &aUserPass)
{
  return m_baseURL->GetUserPass(aUserPass);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetUserPass(const nsACString &aUserPass)
{
  return m_baseURL->SetUserPass(aUserPass);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetUsername(nsACString &aUsername)
{
  /* note:  this will return an escaped string */
  return m_baseURL->GetUsername(aUsername);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetUsername(const nsACString &aUsername)
{
  return m_baseURL->SetUsername(aUsername);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetPassword(nsACString &aPassword)
{
  return m_baseURL->GetPassword(aPassword);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetPassword(const nsACString &aPassword)
{
  return m_baseURL->SetPassword(aPassword);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetHostPort(nsACString &aHostPort)
{
  return m_baseURL->GetHostPort(aHostPort);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetHostPort(const nsACString &aHostPort)
{
  return m_baseURL->SetHostPort(aHostPort);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetHost(nsACString &aHost)
{
  return m_baseURL->GetHost(aHost);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetHost(const nsACString &aHost)
{
  return m_baseURL->SetHost(aHost);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetPort(int32_t *aPort)
{
  return m_baseURL->GetPort(aPort);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetPort(int32_t aPort)
{
  return m_baseURL->SetPort(aPort);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetPath(nsACString &aPath)
{
  return m_baseURL->GetPath(aPath);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetPath(const nsACString &aPath)
{
  return m_baseURL->SetPath(aPath);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetAsciiHost(nsACString &aHostA)
{
    return m_baseURL->GetAsciiHost(aHostA);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetAsciiSpec(nsACString &aSpecA)
{
    return m_baseURL->GetAsciiSpec(aSpecA);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetOriginCharset(nsACString &aOriginCharset)
{
    return m_baseURL->GetOriginCharset(aOriginCharset);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetBaseURI(nsIURI **aBaseURI)
{
  NS_ENSURE_ARG_POINTER(aBaseURI);
  return m_baseURL->QueryInterface(NS_GET_IID(nsIURI), (void**) aBaseURI);
}

NS_IMETHODIMP nsMsgMailNewsUrl::Equals(nsIURI *other, bool *_retval)
{
  // The passed-in URI might be a mail news url. Pass our inner URL to its
  // Equals method. The other mail news url will then pass its inner URL to
  // to the Equals method of our inner URL. Other URIs will return false.
  if (other)
    return other->Equals(m_baseURL, _retval);

  return m_baseURL->Equals(other, _retval);
}

NS_IMETHODIMP nsMsgMailNewsUrl::EqualsExceptRef(nsIURI *other, bool *result)
{
  // The passed-in URI might be a mail news url. Pass our inner URL to its
  // Equals method. The other mail news url will then pass its inner URL to
  // to the Equals method of our inner URL. Other URIs will return false.
  if (other)
    return other->EqualsExceptRef(m_baseURL, result);

  return m_baseURL->EqualsExceptRef(other, result);
}

NS_IMETHODIMP
nsMsgMailNewsUrl::CloneIgnoringRef(nsIURI** result)
{
  nsCOMPtr<nsIURI> clone;
  nsresult rv = Clone(getter_AddRefs(clone));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = clone->SetRef(EmptyCString());
  NS_ENSURE_SUCCESS(rv, rv);

  clone.forget(result);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailNewsUrl::GetSpecIgnoringRef(nsACString &result)
{
  return m_baseURL->GetSpecIgnoringRef(result);
}

NS_IMETHODIMP
nsMsgMailNewsUrl::GetHasRef(bool *result)
{
  return m_baseURL->GetHasRef(result);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SchemeIs(const char *aScheme, bool *_retval)
{
  return m_baseURL->SchemeIs(aScheme, _retval);
}

NS_IMETHODIMP nsMsgMailNewsUrl::Clone(nsIURI **_retval)
{
  nsresult rv;
  nsAutoCString urlSpec;
  nsCOMPtr<nsIIOService> ioService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(ioService, NS_ERROR_UNEXPECTED);
  rv = GetSpec(urlSpec);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = ioService->NewURI(urlSpec, nullptr, nullptr, _retval);
  NS_ENSURE_SUCCESS(rv, rv);

  // add the msg window to the cloned url
  nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(m_msgWindowWeak));
  if (msgWindow)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> msgMailNewsUrl = do_QueryInterface(*_retval, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    msgMailNewsUrl->SetMsgWindow(msgWindow);
  }

  return rv;
} 

NS_IMETHODIMP nsMsgMailNewsUrl::Resolve(const nsACString &relativePath, nsACString &result) 
{
  // only resolve anchor urls....i.e. urls which start with '#' against the mailnews url...
  // everything else shouldn't be resolved against mailnews urls.
  nsresult rv = NS_OK;

  if (!relativePath.IsEmpty() && relativePath.First() == '#') // an anchor
    return m_baseURL->Resolve(relativePath, result);
  else
  {
    // if relativePath is a complete url with it's own scheme then allow it...
    nsCOMPtr<nsIIOService> ioService =
      mozilla::services::GetIOService();
    NS_ENSURE_TRUE(ioService, NS_ERROR_UNEXPECTED);
    nsAutoCString scheme;

    rv = ioService->ExtractScheme(relativePath, scheme);
    // if we have a fully qualified scheme then pass the relative path back as the result
    if (NS_SUCCEEDED(rv) && !scheme.IsEmpty())
    {
      result = relativePath;
      rv = NS_OK;
    }
    else
    {
      result.Truncate();
      rv = NS_ERROR_FAILURE;
    }
  }

  return rv;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetDirectory(nsACString &aDirectory)
{
  return m_baseURL->GetDirectory(aDirectory);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetDirectory(const nsACString &aDirectory)
{

  return m_baseURL->SetDirectory(aDirectory);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetFileName(nsACString &aFileName)
{
  if (!mAttachmentFileName.IsEmpty())
  {
    aFileName = mAttachmentFileName;
    return NS_OK;
  }
  return m_baseURL->GetFileName(aFileName);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetFileBaseName(nsACString &aFileBaseName)
{
  return m_baseURL->GetFileBaseName(aFileBaseName);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetFileBaseName(const nsACString &aFileBaseName)
{
  return m_baseURL->SetFileBaseName(aFileBaseName);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetFileExtension(nsACString &aFileExtension)
{
  if (!mAttachmentFileName.IsEmpty())
  {
    int32_t pos = mAttachmentFileName.RFindChar(PRUnichar('.'));
    if (pos > 0)
      aFileExtension = Substring(mAttachmentFileName, pos + 1 /* skip the '.' */);
    return NS_OK;
  }
  return m_baseURL->GetFileExtension(aFileExtension);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetFileExtension(const nsACString &aFileExtension)
{
  return m_baseURL->SetFileExtension(aFileExtension);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetFileName(const nsACString &aFileName)
{
  mAttachmentFileName = aFileName;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetQuery(nsACString &aQuery)
{
  return m_baseURL->GetQuery(aQuery);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetQuery(const nsACString &aQuery)
{
  return m_baseURL->SetQuery(aQuery);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetRef(nsACString &aRef)
{
  return m_baseURL->GetRef(aRef);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetRef(const nsACString &aRef)
{
  return m_baseURL->SetRef(aRef);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetFilePath(nsACString &o_DirFile)
{
  return m_baseURL->GetFilePath(o_DirFile);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetFilePath(const nsACString &i_DirFile)
{
  return m_baseURL->SetFilePath(i_DirFile);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetCommonBaseSpec(nsIURI *uri2, nsACString &result)
{
  return m_baseURL->GetCommonBaseSpec(uri2, result);
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetRelativeSpec(nsIURI *uri2, nsACString &result)
{
  return m_baseURL->GetRelativeSpec(uri2, result);
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetMemCacheEntry(nsICacheEntryDescriptor *memCacheEntry)
{
  m_memCacheEntry = memCacheEntry;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl:: GetMemCacheEntry(nsICacheEntryDescriptor **memCacheEntry)
{
  NS_ENSURE_ARG(memCacheEntry);
  nsresult rv = NS_OK;

  if (m_memCacheEntry)
  {
    *memCacheEntry = m_memCacheEntry;
    NS_ADDREF(*memCacheEntry);
  }
  else
  {
    *memCacheEntry = nullptr;
    return NS_ERROR_NULL_POINTER;
  }

  return rv;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetImageCacheSession(nsICacheSession *imageCacheSession)
{
  m_imageCacheSession = imageCacheSession;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetImageCacheSession(nsICacheSession **imageCacheSession)
{
  NS_ENSURE_ARG(imageCacheSession);

  NS_IF_ADDREF(*imageCacheSession = m_imageCacheSession);

  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::CacheCacheEntry(nsICacheEntryDescriptor *cacheEntry)
{
  m_cachedMemCacheEntries.AppendObject(cacheEntry);

  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::RemoveCacheEntry(nsICacheEntryDescriptor *cacheEntry)
{
  m_cachedMemCacheEntries.RemoveObject(cacheEntry);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetMimeHeaders(nsIMimeHeaders * *mimeHeaders)
{
    NS_ENSURE_ARG_POINTER(mimeHeaders);
    NS_IF_ADDREF(*mimeHeaders = mMimeHeaders);
    return (mMimeHeaders) ? NS_OK : NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetMimeHeaders(nsIMimeHeaders *mimeHeaders)
{
    mMimeHeaders = mimeHeaders;
    return NS_OK;
}

#define SAVE_BUF_SIZE 8192
class nsMsgSaveAsListener : public nsIStreamListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSISTREAMLISTENER

  nsMsgSaveAsListener(nsIFile *aFile, bool addDummyEnvelope);
  virtual ~nsMsgSaveAsListener();
  nsresult SetupMsgWriteStream(nsIFile *aFile, bool addDummyEnvelope);
protected:
  nsCOMPtr<nsIOutputStream> m_outputStream;
  nsCOMPtr<nsIFile> m_outputFile;
  bool m_addDummyEnvelope;
  bool m_writtenData;
  uint32_t m_leftOver;
  char m_dataBuffer[SAVE_BUF_SIZE+1]; // temporary buffer for this save operation

};

NS_IMPL_ISUPPORTS2(nsMsgSaveAsListener,
                   nsIStreamListener,
                   nsIRequestObserver)

nsMsgSaveAsListener::nsMsgSaveAsListener(nsIFile *aFile, bool addDummyEnvelope)
{
  m_outputFile = aFile;
  m_writtenData = false;
  m_addDummyEnvelope = addDummyEnvelope;
  m_leftOver = 0;
}

nsMsgSaveAsListener::~nsMsgSaveAsListener()
{
}

NS_IMETHODIMP nsMsgSaveAsListener::OnStartRequest(nsIRequest *request, nsISupports *ctxt)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgSaveAsListener::OnStopRequest(nsIRequest *request, nsISupports * aCtxt, nsresult aStatus)
{
  if (m_outputStream)
  {
    m_outputStream->Flush();
    m_outputStream->Close();
  }
  return NS_OK;
} 

NS_IMETHODIMP nsMsgSaveAsListener::OnDataAvailable(nsIRequest* request, 
                                  nsISupports* aSupport,
                                  nsIInputStream* inStream, 
                                  uint64_t srcOffset,
                                  uint32_t count)
{
  nsresult rv;
  uint64_t available;
  rv = inStream->Available(&available);
  if (!m_writtenData)
  {
    m_writtenData = true;
    rv = SetupMsgWriteStream(m_outputFile, m_addDummyEnvelope);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  bool useCanonicalEnding = false;
  nsCOMPtr <nsIMsgMessageUrl> msgUrl = do_QueryInterface(aSupport);
  if (msgUrl)
    msgUrl->GetCanonicalLineEnding(&useCanonicalEnding);
  
  const char *lineEnding = (useCanonicalEnding) ? CRLF : MSG_LINEBREAK;
  uint32_t lineEndingLength = (useCanonicalEnding) ? 2 : MSG_LINEBREAK_LEN;
  
  uint32_t readCount, maxReadCount = SAVE_BUF_SIZE - m_leftOver;
  uint32_t writeCount;
  char *start, *end, lastCharInPrevBuf = '\0';
  uint32_t linebreak_len = 0;

  while (count > 0)
  {
      if (count < maxReadCount)
          maxReadCount = count;
      rv = inStream->Read(m_dataBuffer + m_leftOver,
                          maxReadCount,
                          &readCount);
      if (NS_FAILED(rv)) return rv;

      m_leftOver += readCount;
      m_dataBuffer[m_leftOver] = '\0';

      start = m_dataBuffer;
      // make sure we don't insert another LF, accidentally, by ignoring
      // second half of CRLF spanning blocks.
      if (lastCharInPrevBuf == '\r' && *start == '\n')
        start++;

      end = PL_strchr(start, '\r');
      if (!end)
          end = PL_strchr(start, '\n');
      else if (*(end+1) == '\n' && linebreak_len == 0)
          linebreak_len = 2;

      if (linebreak_len == 0) // not initialize yet
          linebreak_len = 1;

      count -= readCount;
      maxReadCount = SAVE_BUF_SIZE - m_leftOver;

      if (!end && count > maxReadCount)
          // must be a very very long line; sorry cannot handle it
          return NS_ERROR_FAILURE;

      while (start && end)
      {
          if (m_outputStream &&
              PL_strncasecmp(start, "X-Mozilla-Status:", 17) &&
              PL_strncasecmp(start, "X-Mozilla-Status2:", 18) &&
              PL_strncmp(start, "From - ", 7))
          {
              rv = m_outputStream->Write(start, end-start, &writeCount);
              nsresult tmp = m_outputStream->Write(lineEnding, lineEndingLength, &writeCount);
              if (NS_FAILED(tmp)) {
                rv = tmp;
              }
          }
          start = end+linebreak_len;
          if (start >= m_dataBuffer + m_leftOver)
          {
              maxReadCount = SAVE_BUF_SIZE;
              m_leftOver = 0;
              break;
          }
          end = PL_strchr(start, '\r');
          if (!end)
              end = PL_strchr(start, '\n');
          if (start && !end)
          {
              m_leftOver -= (start - m_dataBuffer);
              memcpy(m_dataBuffer, start,
                            m_leftOver+1); // including null
              maxReadCount = SAVE_BUF_SIZE - m_leftOver;
          }
      }
      if (NS_FAILED(rv)) return rv;
      if (end)
          lastCharInPrevBuf = *end;
  }
  return rv;
  
  //  rv = m_outputStream->WriteFrom(inStream, std::min(available, count), &bytesWritten);
}

nsresult nsMsgSaveAsListener::SetupMsgWriteStream(nsIFile *aFile, bool addDummyEnvelope)
{
  // If the file already exists, delete it, but do this before
  // getting the outputstream.
  // Due to bug 328027, the nsSaveMsgListener created in
  // nsMessenger::SaveAs now opens the stream on the nsIFile
  // object, thus creating an empty file. Actual save operations for
  // IMAP and NNTP use this nsMsgSaveAsListener here, though, so we
  // have to close the stream before deleting the file, else data
  // would still be written happily into a now non-existing file.
  // (Windows doesn't care, btw, just unixoids do...)
  aFile->Remove(false);

  nsresult rv = MsgNewBufferedFileOutputStream(getter_AddRefs(m_outputStream),
                                               aFile, -1, 0666);
  NS_ENSURE_SUCCESS(rv, rv);

  if (m_outputStream && addDummyEnvelope)
  {
    nsAutoCString result;
    uint32_t writeCount;

    time_t now = time((time_t*) 0);
    char *ct = ctime(&now);
    // Remove the ending new-line character.
    ct[24] = '\0';
    result = "From - ";
    result += ct;
    result += MSG_LINEBREAK;
    m_outputStream->Write(result.get(), result.Length(), &writeCount);

    result = "X-Mozilla-Status: 0001";
    result += MSG_LINEBREAK;
    result += "X-Mozilla-Status2: 00000000";
    result += MSG_LINEBREAK;
    m_outputStream->Write(result.get(), result.Length(), &writeCount);
  }

  return rv;
}


NS_IMETHODIMP nsMsgMailNewsUrl::GetSaveAsListener(bool addDummyEnvelope, 
                                                  nsIFile *aFile, nsIStreamListener **aSaveListener)
{
  NS_ENSURE_ARG_POINTER(aSaveListener);
  nsMsgSaveAsListener *saveAsListener = new nsMsgSaveAsListener(aFile, addDummyEnvelope);
  return saveAsListener->QueryInterface(NS_GET_IID(nsIStreamListener), (void **) aSaveListener);
}


NS_IMETHODIMP nsMsgMailNewsUrl::SetFolder(nsIMsgFolder * /* aFolder */)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetFolder(nsIMsgFolder ** /* aFolder */)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetMsgHeaderSink(nsIMsgHeaderSink * *aMsgHdrSink)
{
    NS_ENSURE_ARG_POINTER(aMsgHdrSink);
    NS_IF_ADDREF(*aMsgHdrSink = mMsgHeaderSink);
    return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::SetMsgHeaderSink(nsIMsgHeaderSink * aMsgHdrSink)
{
    mMsgHeaderSink = aMsgHdrSink;
    return NS_OK;
}

NS_IMETHODIMP nsMsgMailNewsUrl::GetIsMessageUri(bool *aIsMessageUri)
{
  NS_ENSURE_ARG(aIsMessageUri);
  nsAutoCString scheme;
  m_baseURL->GetScheme(scheme);
  *aIsMessageUri = StringEndsWith(scheme, NS_LITERAL_CSTRING("-message"));
  return NS_OK;
}
