/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbOSXCard_h___
#define nsAbOSXCard_h___

#include "mozilla/Attributes.h"
#include "nsAbCardProperty.h"

#define NS_ABOSXCARD_URI_PREFIX NS_ABOSXCARD_PREFIX "://"

#define NS_IABOSXCARD_IID \
  { 0xa7e5b697, 0x772d, 0x4fb5, \
    { 0x81, 0x16, 0x23, 0xb7, 0x5a, 0xac, 0x94, 0x56 } }

class nsIAbOSXCard : public nsISupports
{
public:
  NS_DECLARE_STATIC_IID_ACCESSOR(NS_IABOSXCARD_IID)

  virtual nsresult Init(const char *aUri) = 0;
  virtual nsresult Update(bool aNotify) = 0;
  virtual nsresult GetURI(nsACString &aURI) = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsIAbOSXCard, NS_IABOSXCARD_IID)

class nsAbOSXCard : public nsAbCardProperty,
                    public nsIAbOSXCard
{
public:
  NS_DECL_ISUPPORTS_INHERITED
    
  nsresult Update(bool aNotify) MOZ_OVERRIDE;
  nsresult GetURI(nsACString &aURI) MOZ_OVERRIDE;
  nsresult Init(const char *aUri) MOZ_OVERRIDE;
  // this is needed so nsAbOSXUtils.mm can get at nsAbCardProperty
  friend class nsAbOSXUtils;
private:
  nsCString mURI;

};

#endif // nsAbOSXCard_h___
