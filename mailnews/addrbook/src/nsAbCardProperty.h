/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <mark@standard8.demon.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
	PRBool   m_IsMailList;
	nsCString m_MailListURI;

  // Store most of the properties here
  nsInterfaceHashtable<nsCStringHashKey, nsIVariant> m_properties;

private:
  nsresult AppendSection(const AppendItem *aArray, PRInt16 aCount, const nsString& aHeading, nsIStringBundle *aBundle, mozITXTToHTMLConv *aConv, nsString &aResult);
  nsresult AppendLine(const AppendItem &aItem, mozITXTToHTMLConv *aConv, nsString &aResult);
  nsresult AppendLabel(const AppendItem &aItem, nsIStringBundle *aBundle, mozITXTToHTMLConv *aConv, nsString &aResult);
  nsresult AppendCityStateZip(const AppendItem &aItem, nsIStringBundle *aBundle, mozITXTToHTMLConv *aConv, nsString &aResult);

  nsresult ConvertToBase64EncodedXML(nsACString &result);
  nsresult ConvertToXMLPrintData(nsAString &result);
  nsresult ConvertToEscapedVCard(nsACString &result);
};

#endif
