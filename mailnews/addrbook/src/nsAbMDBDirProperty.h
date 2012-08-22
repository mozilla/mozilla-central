/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/********************************************************************************************************
 
   Interface for representing Address Book Directory
 
*********************************************************************************************************/

#ifndef nsAbMDBDirProperty_h__
#define nsAbMDBDirProperty_h__

#include "nsIAbMDBDirectory.h"
#include "nsAbDirProperty.h"
#include "nsIAbCard.h"
#include "nsCOMPtr.h"
#include "nsDirPrefs.h"
#include "nsIAddrDatabase.h"

 /* 
  * Address Book Directory
  */ 

class nsAbMDBDirProperty: public nsIAbMDBDirectory, public nsAbDirProperty
{
public: 
	nsAbMDBDirProperty(void);
	virtual ~nsAbMDBDirProperty(void);

	NS_DECL_ISUPPORTS
	NS_DECL_NSIABMDBDIRECTORY

protected:

	uint32_t m_dbRowID;
};

#endif
