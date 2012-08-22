/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsURLFetcher.h"

#include "msgCore.h" // for pre-compiled headers
#include "nsCOMPtr.h"
#include <stdio.h>
#include "nscore.h"
#include "nsIFactory.h"
#include "nsISupports.h"
#include "comi18n.h"
#include "prmem.h"
#include "plstr.h"
#include "nsIComponentManager.h"
#include "nsStringGlue.h"
#include "nsIIOService.h"
#include "nsIChannel.h"
#include "nsNetUtil.h"
#include "nsMimeTypes.h"
#include "nsIHttpChannel.h"
#include "nsIWebProgress.h"
#include "nsMsgAttachmentHandler.h"
#include "nsMsgSend.h"
#include "nsISeekableStream.h"
#include "nsIStreamConverterService.h"
#include "nsIMsgProgress.h"
#include "nsMsgUtils.h"

NS_IMPL_ISUPPORTS7(nsURLFetcher,
                   nsIURLFetcher,
                   nsIStreamListener,
                   nsIRequestObserver,
                   nsIURIContentListener,
                   nsIInterfaceRequestor,
                   nsIWebProgressListener,
                   nsISupportsWeakReference)


/* 
 * Inherited methods for nsMimeConverter
 */
nsURLFetcher::nsURLFetcher()
{
  // Init member variables...
  mTotalWritten = 0;
  mBuffer = nullptr;
  mBufferSize = 0;
  mStillRunning = true;
  mCallback = nullptr;
  mOnStopRequestProcessed = false;
  mIsFile=false;
  nsURLFetcherStreamConsumer *consumer = new nsURLFetcherStreamConsumer(this);
  mConverter = do_QueryInterface(consumer);
}

nsURLFetcher::~nsURLFetcher()
{
  mStillRunning = false;
  
  PR_FREEIF(mBuffer);
  // Remove the DocShell as a listener of the old WebProgress...
  if (mLoadCookie) 
  {
    nsCOMPtr<nsIWebProgress> webProgress(do_QueryInterface(mLoadCookie));

    if (webProgress)
      webProgress->RemoveProgressListener(this);
  }
}

NS_IMETHODIMP nsURLFetcher::GetInterface(const nsIID & aIID, void * *aInstancePtr)
{
   NS_ENSURE_ARG_POINTER(aInstancePtr);
   return QueryInterface(aIID, aInstancePtr);
}

// nsIURIContentListener support
NS_IMETHODIMP 
nsURLFetcher::OnStartURIOpen(nsIURI* aURI, bool* aAbortOpen)
{
   return NS_OK;
}

NS_IMETHODIMP 
nsURLFetcher::IsPreferred(const char * aContentType,
                                char ** aDesiredContentType,
                                bool * aCanHandleContent)

{
  return CanHandleContent(aContentType, true, aDesiredContentType,
                          aCanHandleContent);
}

NS_IMETHODIMP 
nsURLFetcher::CanHandleContent(const char * aContentType,
                                bool aIsContentPreferred,
                                char ** aDesiredContentType,
                                bool * aCanHandleContent)

{
    if (!mIsFile && PL_strcasecmp(aContentType, MESSAGE_RFC822) == 0)
      *aDesiredContentType = strdup("text/html");

    // since we explicilty loaded the url, we always want to handle it!
    *aCanHandleContent = true;
  return NS_OK;
} 

NS_IMETHODIMP 
nsURLFetcher::DoContent(const char * aContentType,
                      bool aIsContentPreferred,
                      nsIRequest *request,
                      nsIStreamListener ** aContentHandler,
                      bool * aAbortProcess)
{
  nsresult rv = NS_OK;

  if (aAbortProcess)
    *aAbortProcess = false;
  QueryInterface(NS_GET_IID(nsIStreamListener), (void **) aContentHandler);

  /*
    Check the content-type to see if we need to insert a converter
  */
  if (PL_strcasecmp(aContentType, UNKNOWN_CONTENT_TYPE) == 0 ||
      PL_strcasecmp(aContentType, MULTIPART_MIXED_REPLACE) == 0 ||
      PL_strcasecmp(aContentType, MULTIPART_MIXED) == 0 ||
      PL_strcasecmp(aContentType, MULTIPART_BYTERANGES) == 0)
  {
    rv = InsertConverter(aContentType);
    if (NS_SUCCEEDED(rv))
      mConverterContentType = aContentType;
  }

  return rv;
}

NS_IMETHODIMP 
nsURLFetcher::GetParentContentListener(nsIURIContentListener** aParent)
{
  *aParent = nullptr;
  return NS_OK;
}

NS_IMETHODIMP 
nsURLFetcher::SetParentContentListener(nsIURIContentListener* aParent)
{
  return NS_OK;
}

NS_IMETHODIMP 
nsURLFetcher::GetLoadCookie(nsISupports ** aLoadCookie)
{
  *aLoadCookie = mLoadCookie;
  NS_IF_ADDREF(*aLoadCookie);
  return NS_OK;
}

NS_IMETHODIMP 
nsURLFetcher::SetLoadCookie(nsISupports * aLoadCookie)
{
  // Remove the DocShell as a listener of the old WebProgress...
  if (mLoadCookie) 
  {
    nsCOMPtr<nsIWebProgress> webProgress(do_QueryInterface(mLoadCookie));

    if (webProgress)
      webProgress->RemoveProgressListener(this);
  }

  mLoadCookie = aLoadCookie;

  // Add the DocShell as a listener to the new WebProgress...
  if (mLoadCookie) 
  {
    nsCOMPtr<nsIWebProgress> webProgress(do_QueryInterface(mLoadCookie));

    if (webProgress) 
      webProgress->AddProgressListener(this, nsIWebProgress::NOTIFY_STATE_ALL);
  }
  return NS_OK;

}

nsresult
nsURLFetcher::StillRunning(bool *running)
{
  *running = mStillRunning;
  return NS_OK;
}


// Methods for nsIStreamListener...
nsresult
nsURLFetcher::OnDataAvailable(nsIRequest *request, nsISupports * ctxt, nsIInputStream *aIStream, 
                              uint32_t sourceOffset, uint32_t aLength)
{
  /* let our converter or consumer process the data */
  if (!mConverter)
    return NS_ERROR_FAILURE;

  return mConverter->OnDataAvailable(request, ctxt, aIStream, sourceOffset, aLength);
}


// Methods for nsIStreamObserver 
nsresult
nsURLFetcher::OnStartRequest(nsIRequest *request, nsISupports *ctxt)
{
  /* check if the user has canceld the operation */
  nsMsgAttachmentHandler *attachmentHdl = (nsMsgAttachmentHandler *)mTagData;
  if (attachmentHdl)
  {
    nsCOMPtr<nsIMsgSend> sendPtr;
    attachmentHdl->GetMimeDeliveryState(getter_AddRefs(sendPtr));
    if (sendPtr)
    {
      nsCOMPtr<nsIMsgProgress> progress;
      sendPtr->GetProgress(getter_AddRefs(progress));
      if (progress)
      {
        bool cancel = false;
        progress->GetProcessCanceledByUser(&cancel);
        if (cancel)
          return request->Cancel(NS_ERROR_ABORT);
      }
    }
    attachmentHdl->mRequest = request;
  }

  /* call our converter or consumer */
  if (mConverter)
    return mConverter->OnStartRequest(request, ctxt);

  return NS_OK;
}

NS_IMETHODIMP
nsURLFetcher::OnStopRequest(nsIRequest *request, nsISupports * ctxt, nsresult aStatus)
{

  nsresult rv = NS_OK;

  // it's possible we could get in here from the channel calling us with an OnStopRequest and from our
  // onStatusChange method (in the case of an error). So we should protect against this to make sure we
  // don't process the on stop request twice...

  if (mOnStopRequestProcessed)
    return NS_OK;
  mOnStopRequestProcessed = true;
  
  /* first, call our converter or consumer */
  if (mConverter)
    rv = mConverter->OnStopRequest(request, ctxt, aStatus);

  nsMsgAttachmentHandler *attachmentHdl = (nsMsgAttachmentHandler *)mTagData;
  if (attachmentHdl)
    attachmentHdl->mRequest = nullptr;

  //
  // Now complete the stream!
  //
  mStillRunning = false;

  // time to close the output stream...
  if (mOutStream)
  {
    mOutStream->Close();
    mOutStream = nullptr;
  
    /* In case of multipart/x-mixed-replace, we need to truncate the file to the current part size */
    if (MsgLowerCaseEqualsLiteral(mConverterContentType, MULTIPART_MIXED_REPLACE))
    {
      mLocalFile->SetFileSize(mTotalWritten);
    }
  }

  // Now if there is a callback, we need to call it...
  if (mCallback)
    mCallback (aStatus, mContentType, mCharset, mTotalWritten, nullptr, mTagData);

  // Time to return...
  return NS_OK;
}

nsresult 
nsURLFetcher::Initialize(nsIFile *localFile, 
                         nsIOutputStream *outputStream,
                         nsAttachSaveCompletionCallback cb, 
                         void *tagData)
{
  if (!outputStream || !localFile)
    return NS_ERROR_INVALID_ARG;

  mOutStream = outputStream;
  mLocalFile = localFile;
  mCallback = cb;     //JFD: Please, no more callback, use a listener...
  mTagData = tagData; //JFD: TODO, WE SHOULD USE A NSCOMPTR to hold this stuff!!!
  return NS_OK;
}

nsresult
nsURLFetcher::FireURLRequest(nsIURI *aURL, nsIFile *localFile, nsIOutputStream *outputStream, 
                             nsAttachSaveCompletionCallback cb, void *tagData)
{
  nsresult rv;

  rv = Initialize(localFile, outputStream, cb, tagData);
  NS_ENSURE_SUCCESS(rv, rv);

  //check to see if aURL is a local file or not
  aURL->SchemeIs("file", &mIsFile);
  
  // we're about to fire a new url request so make sure the on stop request flag is cleared...
  mOnStopRequestProcessed = false;

  // let's try uri dispatching...
  nsCOMPtr<nsIURILoader> pURILoader (do_GetService(NS_URI_LOADER_CONTRACTID));
  NS_ENSURE_TRUE(pURILoader, NS_ERROR_FAILURE);

  nsCOMPtr<nsIChannel> channel;
  NS_ENSURE_SUCCESS(NS_NewChannel(getter_AddRefs(channel), aURL, nullptr, nullptr, this), NS_ERROR_FAILURE);
 
  return pURILoader->OpenURI(channel, false, this);
}

nsresult
nsURLFetcher::InsertConverter(const char * aContentType)
{
  nsresult rv;

  nsCOMPtr<nsIStreamConverterService> convServ(do_GetService("@mozilla.org/streamConverters;1", &rv));
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIStreamListener> toListener(mConverter);
    nsCOMPtr<nsIStreamListener> fromListener;

    rv = convServ->AsyncConvertData(aContentType,
                                    "*/*",
                                    toListener,
                                    nullptr,
                                    getter_AddRefs(fromListener));
    if (NS_SUCCEEDED(rv))
      mConverter = fromListener;
  }

  return rv;
}

// web progress listener implementation

NS_IMETHODIMP
nsURLFetcher::OnProgressChange(nsIWebProgress *aProgress, nsIRequest *aRequest,
                             int32_t aCurSelfProgress, int32_t aMaxSelfProgress,
                             int32_t aCurTotalProgress, int32_t aMaxTotalProgress)
{
  return NS_OK;
}

NS_IMETHODIMP
nsURLFetcher::OnStateChange(nsIWebProgress *aProgress, nsIRequest *aRequest,
                          uint32_t aStateFlags, nsresult aStatus)
{
  // all we care about is the case where an error occurred (as in we were unable to locate the
  // the url....

  if (NS_FAILED(aStatus))
    OnStopRequest(aRequest, nullptr, aStatus);

  return NS_OK;
}

NS_IMETHODIMP
nsURLFetcher::OnLocationChange(nsIWebProgress* aWebProgress,
                               nsIRequest* aRequest,
                               nsIURI *aURI,
                               uint32_t aFlags)
{
  NS_NOTREACHED("notification excluded in AddProgressListener(...)");
  return NS_OK;
}

NS_IMETHODIMP 
nsURLFetcher::OnStatusChange(nsIWebProgress* aWebProgress,
                             nsIRequest* aRequest,
                             nsresult aStatus,
                             const PRUnichar* aMessage)
{
  NS_NOTREACHED("notification excluded in AddProgressListener(...)");
  return NS_OK;
}

NS_IMETHODIMP 
nsURLFetcher::OnSecurityChange(nsIWebProgress *aWebProgress, 
                               nsIRequest *aRequest, 
                               uint32_t state)
{
  NS_NOTREACHED("notification excluded in AddProgressListener(...)");
  return NS_OK;
}


/**
 * Stream consumer used for handling special content type like multipart/x-mixed-replace
 */

NS_IMPL_ISUPPORTS2(nsURLFetcherStreamConsumer, nsIStreamListener, nsIRequestObserver)

nsURLFetcherStreamConsumer::nsURLFetcherStreamConsumer(nsURLFetcher* urlFetcher) :
  mURLFetcher(urlFetcher)
{
}

nsURLFetcherStreamConsumer::~nsURLFetcherStreamConsumer()
{
}

/** nsIRequestObserver methods **/

/* void onStartRequest (in nsIRequest request, in nsISupports ctxt); */
NS_IMETHODIMP nsURLFetcherStreamConsumer::OnStartRequest(nsIRequest *aRequest, nsISupports *ctxt)
{
  if (!mURLFetcher || !mURLFetcher->mOutStream)
    return NS_ERROR_FAILURE;

  /* In case of multipart/x-mixed-replace, we need to erase the output file content */
  if (MsgLowerCaseEqualsLiteral(mURLFetcher->mConverterContentType, MULTIPART_MIXED_REPLACE))
  {
    nsCOMPtr<nsISeekableStream> seekStream = do_QueryInterface(mURLFetcher->mOutStream);
    if (seekStream)
      seekStream->Seek(nsISeekableStream::NS_SEEK_SET, 0);
    mURLFetcher->mTotalWritten = 0;
  }

  return NS_OK;
}

/* void onStopRequest (in nsIRequest request, in nsISupports ctxt, in nsresult status); */
NS_IMETHODIMP nsURLFetcherStreamConsumer::OnStopRequest(nsIRequest *aRequest, nsISupports *ctxt, nsresult status)
{
  if (!mURLFetcher)
    return NS_ERROR_FAILURE;

  // Check the content type!
  nsCAutoString contentType;
  nsCAutoString charset;

  nsCOMPtr<nsIChannel> channel = do_QueryInterface(aRequest);
  if(!channel) return NS_ERROR_FAILURE;

  if (NS_SUCCEEDED(channel->GetContentType(contentType)) &&
      !contentType.EqualsLiteral(UNKNOWN_CONTENT_TYPE))
  {
    nsCAutoString uriSpec;
    nsCOMPtr <nsIURI> channelURI;
    channel->GetURI(getter_AddRefs(channelURI));
    channelURI->GetSpec(uriSpec);
    if (uriSpec.Find("&realtype=message/rfc822") >= 0)
      mURLFetcher->mContentType = MESSAGE_RFC822;
    else
      mURLFetcher->mContentType = contentType;
  }

  if (NS_SUCCEEDED(channel->GetContentCharset(charset)) && !charset.IsEmpty())
  {
    mURLFetcher->mCharset = charset;
  }

  return NS_OK;
}

/** nsIStreamListener methods **/

/* void onDataAvailable (in nsIRequest request, in nsISupports ctxt, in nsIInputStream inStr, in unsigned long sourceOffset, in unsigned long count); */
NS_IMETHODIMP nsURLFetcherStreamConsumer::OnDataAvailable(nsIRequest *aRequest, nsISupports *ctxt, nsIInputStream *inStr, uint32_t sourceOffset, uint32_t count)
{
  uint32_t        readLen = count;
  uint32_t        wroteIt;

  if (!mURLFetcher)
    return NS_ERROR_FAILURE;

  if (!mURLFetcher->mOutStream)
    return NS_ERROR_INVALID_ARG;

  if (mURLFetcher->mBufferSize < count)
  {
    PR_FREEIF(mURLFetcher->mBuffer);

    if (count > 0x1000)
      mURLFetcher->mBufferSize = count;
    else
      mURLFetcher->mBufferSize = 0x1000;

    mURLFetcher->mBuffer = (char *)PR_Malloc(mURLFetcher->mBufferSize);
    if (!mURLFetcher->mBuffer)
      return NS_ERROR_OUT_OF_MEMORY; /* we couldn't allocate the object */
  }

  // read the data from the input stram...
  nsresult rv = inStr->Read(mURLFetcher->mBuffer, count, &readLen);
  if (NS_FAILED(rv))
    return rv;

  // write to the output file...
  mURLFetcher->mOutStream->Write(mURLFetcher->mBuffer, readLen, &wroteIt);

  if (wroteIt != readLen)
    return NS_ERROR_FAILURE;
  else
  {
    mURLFetcher->mTotalWritten += wroteIt;
    return NS_OK;
  }
}
