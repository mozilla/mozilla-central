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
#include "nsIEditor.h"
#include "nsIEditorMailSupport.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsIFile.h"


class nsEudoraEditor : public nsIEditor, public nsIEditorMailSupport
{
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIEDITOR
    NS_DECL_NSIEDITORMAILSUPPORT

                                nsEudoraEditor(const char * pBody, nsIFile * pMailImportLocation);

    PRBool                      UpdateEmbeddedImageReference(PRUint32 aCIDHash, const nsAString & aOldRef, const nsAString & aUpdatedRef);

    PRBool                      HasEmbeddedContent();

    ~nsEudoraEditor();

  protected:
    NS_ConvertASCIItoUTF16      m_body;
    nsCOMPtr <nsIFile>          m_pMailImportLocation;
    nsCOMPtr<nsISupportsArray>  m_EmbeddedObjectList; // it's initialized when GetEmbeddedObjects is called
};


class nsEudoraHTMLImageElement : public nsIDOMHTMLImageElement
{
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIDOMNODE
    NS_DECL_NSIDOMELEMENT
    NS_DECL_NSIDOMHTMLELEMENT
    NS_DECL_NSIDOMHTMLIMAGEELEMENT

                                nsEudoraHTMLImageElement(nsEudoraEditor * pEditor, const nsAString & aSrc, PRUint32 aCIDHash);

  private:
    ~nsEudoraHTMLImageElement();

  protected:
    nsCOMPtr<nsIEditor>         m_pEditor;
    nsString                    m_src;
    PRUint32                    m_cidHash;
};
