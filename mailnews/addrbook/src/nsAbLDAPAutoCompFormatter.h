/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsStringGlue.h"
#include "nsIAbLDAPAutoCompFormatter.h"
#include "nsIConsoleService.h"
#include "nsCOMPtr.h"

class nsAbLDAPAutoCompFormatter : public nsIAbLDAPAutoCompFormatter
{
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSILDAPAUTOCOMPFORMATTER
    NS_DECL_NSIABLDAPAUTOCOMPFORMATTER

    nsAbLDAPAutoCompFormatter();
    virtual ~nsAbLDAPAutoCompFormatter();

  protected:
    nsString mNameFormat;               // how to format these pieces
    nsString mAddressFormat;
    nsString mCommentFormat;

    // parse and process format
    nsresult ProcessFormat(const nsAString & aFormat,
                           nsILDAPMessage *aMessage, 
                           nsACString *aValue,
                           nsCString *aAttrs);

    // process a single attribute while parsing format
    nsresult ParseAttrName(const PRUnichar **aIter,  
                           const PRUnichar *aIterEnd, 
                           bool aAttrRequired,
                           nsCOMPtr<nsIConsoleService> & aConsoleSvc,
                           nsACString & aAttrName);

    // append the first value associated with aAttrName in aMessage to aValue
    nsresult AppendFirstAttrValue(const nsACString &aAttrName, 
                                  nsILDAPMessage *aMessage,
                                  bool aAttrRequired,
                                  nsACString &aValue);
};

