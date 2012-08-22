/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsNewsDownloadDialogArgs.h"

nsNewsDownloadDialogArgs::nsNewsDownloadDialogArgs()
{
    mArticleCount = 0;
    mServerKey = "";
    mHitOK = false;
    mDownloadAll = false;
}

nsNewsDownloadDialogArgs::~nsNewsDownloadDialogArgs()
{
}

NS_IMPL_ISUPPORTS1(nsNewsDownloadDialogArgs, nsINewsDownloadDialogArgs)

NS_IMETHODIMP nsNewsDownloadDialogArgs::GetGroupName(nsAString & aGroupName)
 {
    aGroupName = mGroupName;
 
    return NS_OK;
 }
NS_IMETHODIMP nsNewsDownloadDialogArgs::SetGroupName(const nsAString & aGroupName)
 {
 
     mGroupName = aGroupName;
 
     return NS_OK;
 }
NS_IMETHODIMP nsNewsDownloadDialogArgs::GetArticleCount(int32_t *aArticleCount)
{
    NS_ENSURE_ARG_POINTER(aArticleCount);

    *aArticleCount = mArticleCount;

    return NS_OK;
}
NS_IMETHODIMP nsNewsDownloadDialogArgs::SetArticleCount(int32_t aArticleCount)
{
    mArticleCount = aArticleCount;

    return NS_OK;
}
NS_IMETHODIMP nsNewsDownloadDialogArgs::GetServerKey(char * *aServerKey)
{
    NS_ENSURE_ARG_POINTER(aServerKey);
    
    *aServerKey = ToNewCString(mServerKey);
    return NS_OK;
}
NS_IMETHODIMP nsNewsDownloadDialogArgs::SetServerKey(const char * aServerKey)
{
    NS_ENSURE_ARG_POINTER(aServerKey);

    mServerKey = aServerKey;

    return NS_OK;
}
NS_IMETHODIMP nsNewsDownloadDialogArgs::GetHitOK(bool *aHitOK)
{
    NS_ENSURE_ARG_POINTER(aHitOK);
    
    *aHitOK = mHitOK;

    return NS_OK;
}
NS_IMETHODIMP nsNewsDownloadDialogArgs::SetHitOK(bool aHitOK)
{
    mHitOK = aHitOK;

    return NS_OK;
}
NS_IMETHODIMP nsNewsDownloadDialogArgs::GetDownloadAll(bool *aDownloadAll)
{
    NS_ENSURE_ARG_POINTER(aDownloadAll);

    *aDownloadAll = mDownloadAll;

    return NS_OK;
}
NS_IMETHODIMP nsNewsDownloadDialogArgs::SetDownloadAll(bool aDownloadAll)
{
    mDownloadAll = aDownloadAll;

    return NS_OK;
}
