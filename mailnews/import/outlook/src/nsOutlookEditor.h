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
* The Original Code is qualcomm.com code.
*
* The Initial Developer of the Original Code is
* QUALCOMM, Inc.
* Portions created by the Initial Developer are Copyright (C) 2007
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Author: Geoffrey C. Wenger (gwenger@qualcomm.com)
*
* Alternatively, the contents of this file may be used under the terms of
* either the GNU General Public License Version 2 or later (the "GPL"), or
* the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
