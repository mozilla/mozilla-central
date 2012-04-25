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


#include "nsOutlookEditor.h"
#include "nsMsgUtils.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsComponentManagerUtils.h"
#include "nsStringGlue.h"
#include "nsNetUtil.h"
#include "nsIMsgSend.h"

NS_IMPL_THREADSAFE_ISUPPORTS5(nsOutlookHTMLImageElement,
                              nsOutlookHTMLImageElement,
                              nsIDOMHTMLImageElement,
                              nsIDOMHTMLElement,
                              nsIDOMElement,
                              nsIDOMNode)

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

nsOutlookHTMLImageElement::nsOutlookHTMLImageElement
   (nsIURI *uri, const nsAString &cid, const nsAString &name)
   : m_name(name), m_cid_orig(cid)
{
  // Get the URL for the embedded image
  nsCString embeddedImageURL;
  uri->GetSpec(embeddedImageURL);
  CopyASCIItoUTF16(embeddedImageURL, m_src);

  // The cid that is passed here is not prepended with "cid:", so if it
  // becomes important that it is, we'd need to prepend it here.
}

nsOutlookHTMLImageElement::~nsOutlookHTMLImageElement()
{
}

// readonly attribute DOMString nodeName
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNodeName(nsAString & aNodeName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString nodeValue
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNodeValue(nsAString & aNodeValue)
{
  aNodeValue = m_cid_orig;
  return NS_OK;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetNodeValue(const nsAString & aNodeValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute unsigned short nodeType
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNodeType(PRUint16 *aNodeType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode parentNode
NS_IMETHODIMP nsOutlookHTMLImageElement::GetParentNode(nsIDOMNode * *aParentNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode parentElement
NS_IMETHODIMP nsOutlookHTMLImageElement::GetParentElement(nsIDOMElement * *aParentElement)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNodeList childNodes
NS_IMETHODIMP nsOutlookHTMLImageElement::GetChildNodes(nsIDOMNodeList * *aChildNodes)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode firstChild
NS_IMETHODIMP nsOutlookHTMLImageElement::GetFirstChild(nsIDOMNode * *aFirstChild)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode lastChild
NS_IMETHODIMP nsOutlookHTMLImageElement::GetLastChild(nsIDOMNode * *aLastChild)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode previousSibling
NS_IMETHODIMP nsOutlookHTMLImageElement::GetPreviousSibling(nsIDOMNode * *aPreviousSibling)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetPreviousElementSibling(nsIDOMElement **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode nextSibling
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNextSibling(nsIDOMNode * *aNextSibling)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode nextSibling
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNextElementSibling(nsIDOMElement * *aNextSibling)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNamedNodeMap attributes
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAttributes(nsIDOMNamedNodeMap * *aAttributes)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMDocument ownerDocument
NS_IMETHODIMP nsOutlookHTMLImageElement::GetOwnerDocument(nsIDOMDocument * *aOwnerDocument)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNode insertBefore (in nsIDOMNode newChild, in nsIDOMNode refChild)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::InsertBefore(nsIDOMNode *newChild, nsIDOMNode *refChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNode replaceChild (in nsIDOMNode newChild, in nsIDOMNode oldChild)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::ReplaceChild(nsIDOMNode *newChild, nsIDOMNode *oldChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNode removeChild (in nsIDOMNode oldChild)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::RemoveChild(nsIDOMNode *oldChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNode appendChild (in nsIDOMNode newChild)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::AppendChild(nsIDOMNode *newChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean hasChildNodes ()
NS_IMETHODIMP nsOutlookHTMLImageElement::HasChildNodes(bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNode cloneNode (in boolean deep)
NS_IMETHODIMP nsOutlookHTMLImageElement::CloneNode(bool deep, PRUint8 aOptionalArgc, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void normalize ()
NS_IMETHODIMP nsOutlookHTMLImageElement::Normalize()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean isSupported (in DOMString feature, in DOMString version)
NS_IMETHODIMP nsOutlookHTMLImageElement::IsSupported(const nsAString & feature, const nsAString & version, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute DOMString namespaceURI
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNamespaceURI(nsAString & aNamespaceURI)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString prefix
NS_IMETHODIMP nsOutlookHTMLImageElement::GetPrefix(nsAString & aPrefix)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute DOMString localName
NS_IMETHODIMP nsOutlookHTMLImageElement::GetLocalName(nsAString & aLocalName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean hasAttributes ()
NS_IMETHODIMP nsOutlookHTMLImageElement::HasAttributes(bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute DOMString tagName
NS_IMETHODIMP nsOutlookHTMLImageElement::GetTagName(nsAString & aTagName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// DOMString getAttribute (in DOMString name)
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAttribute(const nsAString & name, nsAString & _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void setAttribute (in DOMString name, in DOMString value)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::SetAttribute(const nsAString & name, const nsAString & value)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void removeAttribute (in DOMString name)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::RemoveAttribute(const nsAString & name)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMAttr getAttributeNode (in DOMString name)
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAttributeNode(const nsAString & name, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMAttr setAttributeNode (in nsIDOMAttr newAttr)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::SetAttributeNode(nsIDOMAttr *newAttr, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMAttr removeAttributeNode (in nsIDOMAttr oldAttr)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::RemoveAttributeNode(nsIDOMAttr *oldAttr, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNodeList getElementsByTagName (in DOMString name)
NS_IMETHODIMP nsOutlookHTMLImageElement::GetElementsByTagName(const nsAString & name, nsIDOMNodeList **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// DOMString getAttributeNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAttributeNS(const nsAString & namespaceURI, const nsAString & localName, nsAString & _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void setAttributeNS (in DOMString namespaceURI, in DOMString qualifiedName, in DOMString value)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::SetAttributeNS(const nsAString & namespaceURI, const nsAString & qualifiedName, const nsAString & value)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void removeAttributeNS (in DOMString namespaceURI, in DOMString localName)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::RemoveAttributeNS(const nsAString & namespaceURI, const nsAString & localName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMAttr getAttributeNodeNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAttributeNodeNS(const nsAString & namespaceURI, const nsAString & localName, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMAttr setAttributeNodeNS (in nsIDOMAttr newAttr)  raises (DOMException)
NS_IMETHODIMP nsOutlookHTMLImageElement::SetAttributeNodeNS(nsIDOMAttr *newAttr, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNodeList getElementsByTagNameNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsOutlookHTMLImageElement::GetElementsByTagNameNS(const nsAString & namespaceURI, const nsAString & localName, nsIDOMNodeList **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean hasAttribute (in DOMString name)
NS_IMETHODIMP nsOutlookHTMLImageElement::HasAttribute(const nsAString & name, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean hasAttributeNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsOutlookHTMLImageElement::HasAttributeNS(const nsAString & namespaceURI, const nsAString & localName, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetOnmouseenter(JSContext *cx, JS::Value *ret)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetOnmouseenter(JSContext *cx, const JS::Value &aMouseEnter)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetOnmouseleave(JSContext *cx, JS::Value *ret)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetOnmouseleave(JSContext *cx, const JS::Value &aMouseLeave)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString id
NS_IMETHODIMP nsOutlookHTMLImageElement::GetId(nsAString & aId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetId(const nsAString & aId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString title
NS_IMETHODIMP nsOutlookHTMLImageElement::GetTitle(nsAString & aTitle)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetTitle(const nsAString & aTitle)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString lang
NS_IMETHODIMP nsOutlookHTMLImageElement::GetLang(nsAString & aLang)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetLang(const nsAString & aLang)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString dir
NS_IMETHODIMP nsOutlookHTMLImageElement::GetDir(nsAString & aDir)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetDir(const nsAString & aDir)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString className
NS_IMETHODIMP nsOutlookHTMLImageElement::GetClassName(nsAString & aClassName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetClassName(const nsAString & aClassName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMDOMStringMap dataset
NS_IMETHODIMP nsOutlookHTMLImageElement::GetDataset(nsIDOMDOMStringMap * *aDataset)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute boolean hidden
NS_IMETHODIMP nsOutlookHTMLImageElement::GetHidden(bool *aHidden)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetHidden(bool aHidden)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void click ()
NS_IMETHODIMP nsOutlookHTMLImageElement::Click()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute long tabIndex
NS_IMETHODIMP nsOutlookHTMLImageElement::GetTabIndex(PRInt32 *aTabIndex)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetTabIndex(PRInt32 aTabIndex)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void focus ()
NS_IMETHODIMP nsOutlookHTMLImageElement::Focus()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void blur ()
NS_IMETHODIMP nsOutlookHTMLImageElement::Blur()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString accessKey
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAccessKey(nsAString & aAccessKey)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetAccessKey(const nsAString & aAccessKey)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute DOMString accessKeyLabel
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAccessKeyLabel(nsAString & aAccessKeyLabel)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute boolean draggable
NS_IMETHODIMP nsOutlookHTMLImageElement::GetDraggable(bool *aDraggable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetDraggable(bool aDraggable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString contentEditable
NS_IMETHODIMP nsOutlookHTMLImageElement::GetContentEditable(nsAString & aContentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetContentEditable(const nsAString & aContentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute boolean isContentEditable
NS_IMETHODIMP nsOutlookHTMLImageElement::GetIsContentEditable(bool *aIsContentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMHTMLMenuElement contextMenu
NS_IMETHODIMP nsOutlookHTMLImageElement::GetContextMenu(nsIDOMHTMLMenuElement * *aContextMenu)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute boolean spellcheck
NS_IMETHODIMP nsOutlookHTMLImageElement::GetSpellcheck(bool *aSpellcheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetSpellcheck(bool aSpellcheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString innerHTML
NS_IMETHODIMP nsOutlookHTMLImageElement::GetInnerHTML(nsAString & aInnerHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetInnerHTML(const nsAString & aInnerHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsOutlookHTMLImageElement::GetOuterHTML(nsAString & aOuterHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetOuterHTML(const nsAString & aOuterHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void insertAdjacentHTML (in DOMString position, in DOMString text)
NS_IMETHODIMP nsOutlookHTMLImageElement::InsertAdjacentHTML(const nsAString & position, const nsAString & text)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// [optional_argc] void scrollIntoView ([optional] in boolean top)
NS_IMETHODIMP nsOutlookHTMLImageElement::ScrollIntoView(bool top, PRUint8 _argc)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMElement offsetParent
NS_IMETHODIMP nsOutlookHTMLImageElement::GetOffsetParent(nsIDOMElement * *aOffsetParent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetTop
NS_IMETHODIMP nsOutlookHTMLImageElement::GetOffsetTop(PRInt32 *aOffsetTop)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetLeft
NS_IMETHODIMP nsOutlookHTMLImageElement::GetOffsetLeft(PRInt32 *aOffsetLeft)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetWidth
NS_IMETHODIMP nsOutlookHTMLImageElement::GetOffsetWidth(PRInt32 *aOffsetWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetHeight
NS_IMETHODIMP nsOutlookHTMLImageElement::GetOffsetHeight(PRInt32 *aOffsetHeight)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void mozRequestFullScreen ()
NS_IMETHODIMP nsOutlookHTMLImageElement::MozRequestFullScreen()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString name
NS_IMETHODIMP nsOutlookHTMLImageElement::GetName(nsAString & aName)
{
  aName.Assign(m_name);
  return NS_OK;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetName(const nsAString & aName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString align
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAlign(nsAString & aAlign)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetAlign(const nsAString & aAlign)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString crossOrigin
NS_IMETHODIMP nsOutlookHTMLImageElement::GetCrossOrigin(nsAString & aCrossOrigin)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetCrossOrigin(const nsAString & aCrossOrigin)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString alt
NS_IMETHODIMP nsOutlookHTMLImageElement::GetAlt(nsAString & aAlt)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetAlt(const nsAString & aAlt)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString lowsrc
NS_IMETHODIMP nsOutlookHTMLImageElement::GetLowsrc(nsAString &aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetLowsrc(const nsAString &aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute DOMString complete
NS_IMETHODIMP nsOutlookHTMLImageElement::GetComplete(bool *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute long naturalWidth
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNaturalWidth(PRUint32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute long naturalHeight
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNaturalHeight(PRUint32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString border
NS_IMETHODIMP nsOutlookHTMLImageElement::GetBorder(nsAString & aBorder)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetBorder(const nsAString & aBorder)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute long height
NS_IMETHODIMP nsOutlookHTMLImageElement::GetHeight(PRUint32 *aHeight)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetHeight(PRUint32 aHeight)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute long hspace
NS_IMETHODIMP nsOutlookHTMLImageElement::GetHspace(PRInt32 *aHspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetHspace(PRInt32 aHspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute boolean isMap
NS_IMETHODIMP nsOutlookHTMLImageElement::GetIsMap(bool *aIsMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetIsMap(bool aIsMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString longDesc
NS_IMETHODIMP nsOutlookHTMLImageElement::GetLongDesc(nsAString & aLongDesc)
{
  return NS_OK;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetLongDesc(const nsAString & aLongDesc)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString src
NS_IMETHODIMP nsOutlookHTMLImageElement::GetSrc(nsAString & aSrc)
{
  aSrc = m_src;
  return NS_OK;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetSrc(const nsAString & aSrc)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString useMap
NS_IMETHODIMP nsOutlookHTMLImageElement::GetUseMap(nsAString & aUseMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetUseMap(const nsAString & aUseMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute long vspace
NS_IMETHODIMP nsOutlookHTMLImageElement::GetVspace(PRInt32 *aVspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetVspace(PRInt32 aVspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute long width
NS_IMETHODIMP nsOutlookHTMLImageElement::GetWidth(PRUint32 *aWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetWidth(PRUint32 aWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetDOMBaseURI(nsAString &aBaseURI)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::CompareDocumentPosition(nsIDOMNode *other, PRUint16 *_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetTextContent(nsAString & aTextContent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetTextContent(const nsAString & aTextContent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::Contains(nsIDOMNode* aOther, bool* aReturn)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::LookupPrefix(const nsAString & namespaceURI, nsAString & _retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::IsDefaultNamespace(const nsAString & namespaceURI, bool *_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::LookupNamespaceURI(const nsAString & prefix, nsAString & _retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::IsEqualNode(nsIDOMNode *arg, bool *_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetUserData(const nsAString & key, nsIVariant *data,
                          nsIDOMUserDataHandler *handler, nsIVariant **_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetUserData(const nsAString & key, nsIVariant **_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetClientTop(PRInt32 *aClientTop)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetClassList(nsIDOMDOMTokenList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetScrollTop(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetScrollTop(PRInt32 aScrollTop)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetScrollWidth(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetScrollHeight(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetScrollLeft(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetScrollLeft(PRInt32 aScollLeft)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetClientWidth(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetClientLeft(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetElementsByClassName(const nsAString &aClasses, nsIDOMNodeList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetChildElements(nsIDOMNodeList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetChildElementCount(PRUint32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::ReleaseCapture()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::SetCapture(bool aRetargetToElement)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetClientRects(nsIDOMClientRectList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetClientHeight(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetFirstElementChild(nsIDOMElement **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetLastElementChild(nsIDOMElement **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::GetBoundingClientRect(nsIDOMClientRect **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::MozMatchesSelector(const nsAString &aSelector, bool *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookHTMLImageElement::MozRequestPointerLock()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsOutlookHTMLImageElement::GetX(PRInt32* aX)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsOutlookHTMLImageElement::GetY(PRInt32* aY)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
