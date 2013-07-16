/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsAbManager_h
#define __nsAbManager_h
 
#include "nsIAbManager.h"
#include "nsTObserverArray.h"
#include "nsCOMPtr.h"
#include "nsICommandLineHandler.h"
#include "nsIObserver.h"
#include "nsInterfaceHashtable.h"
#include "nsIAbDirFactoryService.h"
#include "nsIAbDirectory.h"

class nsIAbLDAPAttributeMap;

class nsAbManager : public nsIAbManager,
                    public nsICommandLineHandler,
                    public nsIObserver
{
  
public:
	nsAbManager();
	virtual ~nsAbManager();

	NS_DECL_THREADSAFE_ISUPPORTS
 	NS_DECL_NSIABMANAGER
  NS_DECL_NSIOBSERVER
  NS_DECL_NSICOMMANDLINEHANDLER

  nsresult Init();

private:
  nsresult GetRootDirectory(nsIAbDirectory **aResult);
  nsresult ExportDirectoryToDelimitedText(nsIAbDirectory *aDirectory, const char *aDelim, uint32_t aDelimLen, nsIFile *aLocalFile);
  nsresult ExportDirectoryToLDIF(nsIAbDirectory *aDirectory, nsIFile *aLocalFile);
  nsresult AppendLDIFForMailList(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendDNForCard(const char *aProperty, nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendBasicLDIFForCard(nsIAbCard *aCard, nsIAbLDAPAttributeMap *aAttrMap, nsACString &aResult);
  nsresult AppendProperty(const char *aProperty, const PRUnichar *aValue, nsACString &aResult);
  bool IsSafeLDIFString(const PRUnichar *aStr);

  struct abListener {
    nsCOMPtr<nsIAbListener> mListener;
    uint32_t mNotifyFlags;

    abListener(nsIAbListener *aListener, uint32_t aNotifyFlags)
      : mListener(aListener), mNotifyFlags(aNotifyFlags) {}
    abListener(const abListener &aListener)
      : mListener(aListener.mListener), mNotifyFlags(aListener.mNotifyFlags) {}
    ~abListener() {}

    int operator==(nsIAbListener* aListener) const {
      return mListener == aListener;
    }
    int operator==(const abListener &aListener) const {
      return mListener == aListener.mListener;
    }
  };

  nsTObserverArray<abListener> mListeners;
  nsCOMPtr<nsIAbDirectory> mCacheTopLevelAb;
  nsInterfaceHashtable<nsCStringHashKey, nsIAbDirectory> mAbStore;
};

#endif
