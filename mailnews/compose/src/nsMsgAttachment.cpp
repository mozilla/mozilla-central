/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgAttachment.h"
#include "nsIFile.h"
#include "nsNetUtil.h"

NS_IMPL_ISUPPORTS1(nsMsgAttachment, nsIMsgAttachment)

nsMsgAttachment::nsMsgAttachment()
{
  mTemporary = false;
  mSendViaCloud = false;
  mSize = -1;
}

nsMsgAttachment::~nsMsgAttachment()
{
  if (mTemporary && !mSendViaCloud)
    (void)DeleteAttachment();
}

/* attribute wstring name; */
NS_IMETHODIMP nsMsgAttachment::GetName(nsAString & aName)
{
  aName = mName;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::SetName(const nsAString & aName)
{
  mName = aName;
  return NS_OK;
}

/* attribute string url; */
NS_IMETHODIMP nsMsgAttachment::GetUrl(nsACString & aUrl)
{
  aUrl = mUrl;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::SetUrl(const nsACString & aUrl)
{
  mUrl = aUrl;
  return NS_OK;
}

/* attribute string urlCharset; */
NS_IMETHODIMP nsMsgAttachment::GetUrlCharset(nsACString & aUrlCharset)
{
  aUrlCharset = mUrlCharset;
  return NS_OK;
}
NS_IMETHODIMP nsMsgAttachment::SetUrlCharset(const nsACString & aUrlCharset)
{
  mUrlCharset = aUrlCharset;
  return NS_OK;
}

/* attribute boolean temporary; */
NS_IMETHODIMP nsMsgAttachment::GetTemporary(bool *aTemporary)
{
  NS_ENSURE_ARG_POINTER(aTemporary);

  *aTemporary = mTemporary;
  return NS_OK;
}
NS_IMETHODIMP nsMsgAttachment::SetTemporary(bool aTemporary)
{
  mTemporary = aTemporary;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::GetSendViaCloud(bool *aSendViaCloud)
{
  NS_ENSURE_ARG_POINTER(aSendViaCloud);

  *aSendViaCloud = mSendViaCloud;
  return NS_OK;
}
NS_IMETHODIMP nsMsgAttachment::SetSendViaCloud(bool aSendViaCloud)
{
  mSendViaCloud = aSendViaCloud;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::SetHtmlAnnotation(const nsAString &aAnnotation)
{
  mHtmlAnnotation = aAnnotation;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::GetHtmlAnnotation(nsAString &aAnnotation)
{
  aAnnotation = mHtmlAnnotation;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAttachment::SetCloudProviderKey(const nsACString &aCloudProviderKey)
{
  mCloudProviderKey = aCloudProviderKey;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAttachment::GetCloudProviderKey(nsACString &aCloudProviderKey)
{
  aCloudProviderKey = mCloudProviderKey;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::GetContentLocation(nsACString &aContentLocation)
{
  aContentLocation = mContentLocation;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::SetContentLocation(const nsACString &aContentLocation)
{
  mContentLocation = aContentLocation;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::GetContentType(char * *aContentType)
{
  NS_ENSURE_ARG_POINTER(aContentType);

  *aContentType = ToNewCString(mContentType);
  return (*aContentType ? NS_OK : NS_ERROR_OUT_OF_MEMORY);
}

NS_IMETHODIMP nsMsgAttachment::SetContentType(const char * aContentType)
{
  mContentType = aContentType;
  /* a full content type could also contains parameters but we need to
     keep only the content type alone. Therefore we need to cleanup it.
  */
  int32_t offset = mContentType.FindChar(';');
  if (offset >= 0)
    mContentType.SetLength(offset);

  return NS_OK;
}

NS_IMETHODIMP nsMsgAttachment::GetContentTypeParam(char * *aContentTypeParam)
{
  NS_ENSURE_ARG_POINTER(aContentTypeParam);

  *aContentTypeParam = ToNewCString(mContentTypeParam);
  return (*aContentTypeParam ? NS_OK : NS_ERROR_OUT_OF_MEMORY);
}

NS_IMETHODIMP nsMsgAttachment::SetContentTypeParam(const char * aContentTypeParam)
{
  if (aContentTypeParam)
    while (*aContentTypeParam == ';' || *aContentTypeParam == ' ')
      aContentTypeParam ++;
  mContentTypeParam = aContentTypeParam;

  return NS_OK;
}

/* attribute string charset; */
NS_IMETHODIMP nsMsgAttachment::GetCharset(char * *aCharset)
{
  NS_ENSURE_ARG_POINTER(aCharset);

  *aCharset = ToNewCString(mCharset);
  return (*aCharset ? NS_OK : NS_ERROR_OUT_OF_MEMORY);
}
NS_IMETHODIMP nsMsgAttachment::SetCharset(const char * aCharset)
{
  mCharset = aCharset;
  return NS_OK;
}

/* attribute string macType; */
NS_IMETHODIMP nsMsgAttachment::GetMacType(char * *aMacType)
{
  NS_ENSURE_ARG_POINTER(aMacType);

  *aMacType = ToNewCString(mMacType);
  return (*aMacType ? NS_OK : NS_ERROR_OUT_OF_MEMORY);
}
NS_IMETHODIMP nsMsgAttachment::SetMacType(const char * aMacType)
{
  mMacType = aMacType;
  return NS_OK;
}

/* attribute string macCreator; */
NS_IMETHODIMP nsMsgAttachment::GetMacCreator(char * *aMacCreator)
{
  NS_ENSURE_ARG_POINTER(aMacCreator);

  *aMacCreator = ToNewCString(mMacCreator);
  return (*aMacCreator ? NS_OK : NS_ERROR_OUT_OF_MEMORY);
}
NS_IMETHODIMP nsMsgAttachment::SetMacCreator(const char * aMacCreator)
{
  mMacCreator = aMacCreator;
  return NS_OK;
}

/* attribute int64_t size; */
NS_IMETHODIMP nsMsgAttachment::GetSize(int64_t *aSize)
{
  NS_ENSURE_ARG_POINTER(aSize);

  *aSize = mSize;
  return NS_OK;
}
NS_IMETHODIMP nsMsgAttachment::SetSize(int64_t aSize)
{
  mSize = aSize;
  return NS_OK;
}

/* boolean equalsUrl (in nsIMsgAttachment attachment); */
NS_IMETHODIMP nsMsgAttachment::EqualsUrl(nsIMsgAttachment *attachment, bool *_retval)
{
  NS_ENSURE_ARG_POINTER(attachment);
  NS_ENSURE_ARG_POINTER(_retval);

  nsCAutoString url;
  attachment->GetUrl(url);

  *_retval = mUrl.Equals(url);
  return NS_OK;
}


nsresult nsMsgAttachment::DeleteAttachment()
{
  nsresult rv;
  bool isAFile = false;

  nsCOMPtr<nsIFile> urlFile;
  rv = NS_GetFileFromURLSpec(mUrl, getter_AddRefs(urlFile));
  NS_ASSERTION(NS_SUCCEEDED(rv), "Can't nsIFile from URL string");
  if (NS_SUCCEEDED(rv))
  {
    bool bExists = false;
    rv = urlFile->Exists(&bExists);
    NS_ASSERTION(NS_SUCCEEDED(rv), "Exists() call failed!");
    if (NS_SUCCEEDED(rv) && bExists)
    {
      rv = urlFile->IsFile(&isAFile);
      NS_ASSERTION(NS_SUCCEEDED(rv), "IsFile() call failed!");
    }
  }

  // remove it if it's a valid file
  if (isAFile)
	  rv = urlFile->Remove(false); 

  return rv;
}
