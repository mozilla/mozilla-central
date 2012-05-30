/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsIFile.h"
#include "nsISupportsArray.h"
#include "nsIURI.h"

#define NS_OUTLOOKHTMLIMAGEELEMENT_IID_STR "5fb3c060-20b5-11e0-b2ba-0002a5d5c51b"

#define NS_OUTLOOKHTMLIMAGEELEMENT_IID \
  {0x5fb3c060, 0x20b5, 0x11e0, \
    { 0xb2, 0xba, 0x00, 0x02, 0xa5, 0xd5, 0xc5, 0x1b }}

class nsOutlookHTMLImageElement : public nsIDOMHTMLImageElement
{
  public:
    NS_DECLARE_STATIC_IID_ACCESSOR(NS_OUTLOOKHTMLIMAGEELEMENT_IID)

    NS_DECL_ISUPPORTS
    NS_DECL_NSIDOMNODE
    NS_DECL_NSIDOMELEMENT
    NS_DECL_NSIDOMHTMLELEMENT
    NS_DECL_NSIDOMHTMLIMAGEELEMENT

    nsOutlookHTMLImageElement(nsIURI *uri, const nsAString &cid, const nsAString &name);
    inline const wchar_t* OrigCid() const { return m_cid_orig.get(); }

  private:
    ~nsOutlookHTMLImageElement();

    nsString                    m_src;
    nsString                    m_cid_orig;
    nsString                    m_name;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsOutlookHTMLImageElement, NS_OUTLOOKHTMLIMAGEELEMENT_IID)
