/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/********************************************************************************************************
 
   Interface for representing Address Book Person Card Property
 
*********************************************************************************************************/

#ifndef nsAbCardProperty_h__
#define nsAbCardProperty_h__

#include "nsIAbCard.h"  
#include "nsCOMPtr.h"
#include "nsStringGlue.h"

#include "nsInterfaceHashtable.h"
#include "nsIVariant.h"

class nsIStringBundle;
class mozITXTToHTMLConv;
struct AppendItem;

 /* 
  * Address Book Card Property
  */ 

class nsAbCardProperty: public nsIAbCard
{
public: 
  NS_DECL_ISUPPORTS
  NS_DECL_NSIABCARD
  NS_DECL_NSIABITEM

  nsAbCardProperty();
  virtual ~nsAbCardProperty(void);

protected:
	bool     m_IsMailList;
	nsCString m_MailListURI;

  // Store most of the properties here
  nsInterfaceHashtable<nsCStringHashKey, nsIVariant> m_properties;

  nsCString m_directoryId, m_localId;
private:
  nsresult AppendSection(const AppendItem *aArray, int16_t aCount, const nsString& aHeading, nsIStringBundle *aBundle, mozITXTToHTMLConv *aConv, nsString &aResult);
  nsresult AppendLine(const AppendItem &aItem, mozITXTToHTMLConv *aConv, nsString &aResult);
  nsresult AppendLabel(const AppendItem &aItem, nsIStringBundle *aBundle, mozITXTToHTMLConv *aConv, nsString &aResult);
  nsresult AppendCityStateZip(const AppendItem &aItem, nsIStringBundle *aBundle, mozITXTToHTMLConv *aConv, nsString &aResult);

  nsresult ConvertToBase64EncodedXML(nsACString &result);
  nsresult ConvertToXMLPrintData(nsAString &result);
  nsresult ConvertToEscapedVCard(nsACString &result);
};

#endif
