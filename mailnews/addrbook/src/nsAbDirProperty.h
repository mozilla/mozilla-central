/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/********************************************************************************************************
 
   Interface for representing Address Book Directory
 
*********************************************************************************************************/

#ifndef nsAbDirProperty_h__
#define nsAbDirProperty_h__

#include "nsIAbDirectory.h" /* include the interface we are going to support */
#include "nsIAbCard.h"
#include "nsCOMPtr.h"
#include "nsDirPrefs.h"
#include "nsIAddrDatabase.h"
#include "nsStringGlue.h"
#include "nsIPrefBranch.h"
#include "nsIMutableArray.h"
#include "nsWeakReference.h"

 /* 
  * Address Book Directory
  */ 

class nsAbDirProperty: public nsIAbDirectory,
                       public nsSupportsWeakReference
{
public: 
	nsAbDirProperty(void);
	virtual ~nsAbDirProperty(void);

  NS_DECL_ISUPPORTS
  NS_DECL_NSIABITEM
  NS_DECL_NSIABCOLLECTION
  NS_DECL_NSIABDIRECTORY

protected:
  /**
   * Initialise the directory prefs for this branch
   */
  nsresult InitDirectoryPrefs();

	uint32_t m_LastModifiedDate;

	nsString m_ListDirName;
	nsString m_ListName;
	nsString m_ListNickName;
	nsString m_Description;
	bool     m_IsMailList;

  nsCString mURI;
  nsCString mQueryString;
  nsCString mURINoQuery;
  bool mIsValidURI;
  bool mIsQueryURI;


  /*
   * Note that any derived implementations should ensure that this item
   * (m_DirPrefId) is correctly initialised correctly
   */
  nsCString m_DirPrefId;  // ie,"ldap_2.servers.pab"

  nsCOMPtr<nsIPrefBranch> m_DirectoryPrefs;
  nsCOMPtr<nsIMutableArray> m_AddressList;
};
#endif
