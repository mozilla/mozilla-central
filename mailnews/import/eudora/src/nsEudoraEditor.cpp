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


#include "nsEudoraEditor.h"
#include "nsISupportsArray.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsComponentManagerUtils.h"
#include "nsStringGlue.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "nsIMsgSend.h"

NS_IMPL_ISUPPORTS4(nsEudoraHTMLImageElement, nsIDOMNode, nsIDOMElement, nsIDOMHTMLElement, nsIDOMHTMLImageElement)

static char *     sEudoraEmbeddedContentLines[] = {
  "Embedded Content: ",
  "\0"  //  Explicit terminating string
};

// Lightly adapted from code in Windows Eudora that hashes the img src cid.
static PRUint32 EudoraHashString(const char* pszStr)
{
  PRUint32        ulSum = 0;
  const PRUint32  kKRHashPrime = 2147483629;

  // algorithm: KRHash---derived from Karp & Rabin, Harvard Center for Research
  // in Computing Technology Tech. Report TR-31-81. The constant prime number,
  // kKRHashPrime, happens to be the largest prime number that will fit in
  // 31 bits, except for 2^31-1 itself.

  for (; *pszStr; pszStr++)
  {
    for (PRInt32 nBit = 0x80; nBit != 0; nBit >>= 1)
    {
      ulSum += ulSum;
      if (ulSum >= kKRHashPrime)
        ulSum -= kKRHashPrime;
      if ((*pszStr) & nBit)
        ++ulSum;
      if (ulSum>= kKRHashPrime)
        ulSum -= kKRHashPrime;
    }
  }

  return ulSum + 1;
}


nsEudoraEditor::nsEudoraEditor(const char * pBody, nsIFile * pMailImportLocation)
  : m_body(pBody)
{
  m_pMailImportLocation = pMailImportLocation;
}


nsEudoraEditor::~nsEudoraEditor()
{
}

nsresult nsEudoraEditor::GetEmbeddedObjects(nsISupportsArray ** aNodeList)
{
  NS_ENSURE_ARG_POINTER(aNodeList);

  // Check to see if we were already called
  if (m_EmbeddedObjectList != nsnull)
  {
    *aNodeList = m_EmbeddedObjectList;
    return NS_OK;
  }

  // Create array in m_EmbeddedObjectList
  nsresult rv = NS_NewISupportsArray(getter_AddRefs(m_EmbeddedObjectList));
  NS_ENSURE_SUCCESS(rv, rv);

  // Return m_EmbeddedObjectList in aNodeList and increment ref count - caller
  // assumes that we incremented the ref count.
  NS_IF_ADDREF(*aNodeList = m_EmbeddedObjectList);

  // Create the embedded folder spec
  nsCOMPtr<nsIFile>   embeddedFolderSpec;
  // Create the embedded image spec
  nsCOMPtr<nsIFile>   embeddedImageSpec;

  // Fill in the details for the embedded folder spec - "Embedded" folder
  // inside of the mail folder. We don't bother to check to see if the embedded
  // folder exists, because it seems to me that would only save time in the
  // unexpected case where it doesn't exist. Keep in mind that we will be checking
  // for the existence of any embedded images anyway - if the folder doesn't
  // exist that check will fail.
  rv = m_pMailImportLocation->Clone(getter_AddRefs(embeddedFolderSpec));
  NS_ENSURE_SUCCESS(rv, rv);
  embeddedFolderSpec->AppendNative(NS_LITERAL_CSTRING("Embedded"));

  // Look for the start of the last closing tag so that we only search for
  // valid "Embedded Content" lines. (In practice this is not super important,
  // but there were some proof of concept exploits at one point where "Embedded
  // Content" lines were faked in the body of messages).
  PRInt32     startLastClosingTag = m_body.RFind("</");
  if (startLastClosingTag == kNotFound)
    startLastClosingTag = 0;
  bool        foundEmbeddedContentLines = false;

  // Search for various translations of "Embedded Content" - as of this writing only
  // one that I know of, but then again I didn't realize that Eudora translators had
  // ever translated "Attachment Converted" as suggested by other Eudora importing code.
  for (PRInt32 i = 0; *sEudoraEmbeddedContentLines[i] != '\0'; i++)
  {
    // Search for "Embedded Content: " lines starting after last closing tag (if any)
    PRInt32   startEmbeddedContentLine = startLastClosingTag;
    PRInt32   lenEmbeddedContentTag = strlen(sEudoraEmbeddedContentLines[i]);

    while ((startEmbeddedContentLine = m_body.Find(sEudoraEmbeddedContentLines[i],
                                                   true,
                                                   startEmbeddedContentLine+1)) != kNotFound)
    {
      // Found this translation of "Embedded Content" - remember that so that we don't
      // bother looking for any other translations.
      foundEmbeddedContentLines = true;

      // Extract the file name from the embedded content line
      PRInt32   startFileName = startEmbeddedContentLine + lenEmbeddedContentTag;
      PRInt32   endFileName = m_body.Find(":", false, startFileName);

      // Create the file spec for the embedded image
      embeddedFolderSpec->Clone(getter_AddRefs(embeddedImageSpec));
      embeddedImageSpec->Append(Substring(m_body, startFileName, endFileName - startFileName));

      // Verify that the embedded image spec exists and is a file
      bool      isFile = false;
      bool      exists = false;
      if (NS_FAILED(embeddedImageSpec->Exists(&exists)) || NS_FAILED(embeddedImageSpec->IsFile(&isFile)))
        continue;
      if (!exists || !isFile)
        continue;

      // Extract CID hash from the embedded content line
      PRInt32     cidHashValue;
      PRInt32     startCIDHash = m_body.Find(",", false, endFileName);
      if (startCIDHash != kNotFound)
      {
        startCIDHash++;
        PRInt32   endCIDHash = m_body.Find(",", false, startCIDHash);

        if (endCIDHash != kNotFound)
        {
          nsString    cidHash;
          cidHash.Assign(Substring(m_body, startCIDHash, endCIDHash - startCIDHash));

          if (!cidHash.IsEmpty())
          {
            // Convert CID hash string to numeric value
            nsresult aErrorCode;
            cidHashValue = cidHash.ToInteger(&aErrorCode, 16);
          }
        }
      }

      // Get the URL for the embedded image
      nsCString     embeddedImageURL;
      rv = NS_GetURLSpecFromFile(embeddedImageSpec, embeddedImageURL);
      NS_ENSURE_SUCCESS(rv, rv);

      NS_ConvertASCIItoUTF16 srcUrl(embeddedImageURL);
      nsString cid;
      // We're going to remember the original cid in the image element,
      // which the send code will retrieve as the kMozCIDAttrName property.
      GetEmbeddedImageCID(cidHashValue, srcUrl, cid);
      // Create the embedded image node
      nsEudoraHTMLImageElement *image =
        new nsEudoraHTMLImageElement(srcUrl, cid);

      nsCOMPtr<nsIDOMHTMLImageElement> imageNode(do_QueryInterface(image));

      // Append the embedded image node to the list
      (*aNodeList)->AppendElement(imageNode);

      PRInt32   endEmbeddedContentLine = m_body.Find("\r\n", true, startEmbeddedContentLine+1);
      if (endEmbeddedContentLine != kNotFound)
      {
        // We recognized the "Embedded Content" line correctly and found the associated image.
        // Remove the Eudora specific line about it now.
        m_body.Cut(startEmbeddedContentLine, endEmbeddedContentLine - startEmbeddedContentLine + 2);

        // Backup by one to correct where we start looking for the next line
        startEmbeddedContentLine--;
      }
    }

    // Assume at most one translation for "Embedded Content: " in a given message
    if (foundEmbeddedContentLines)
      break;
  }

  return NS_OK;
}

bool nsEudoraEditor::GetEmbeddedImageCID(PRUint32 aCIDHash, const nsAString & aOldRef, nsString &aCID)
{
  bool      foundMatch = false;
  PRInt32   startImageTag = 0;
  PRInt32   closeImageTag = 0;

  while ((startImageTag = m_body.Find("<img", true, closeImageTag)) != kNotFound)
  {
    closeImageTag = m_body.Find(">", false, startImageTag);

    // We should always find a close tag, bail if we don't
    if (closeImageTag == kNotFound)
      break;

    // Find the source attribute and make sure it's for our image tag
    PRInt32   startSrcValue = m_body.Find("src", true, startImageTag);
    if ((startSrcValue == kNotFound) || (startSrcValue > closeImageTag))
      continue;

    // Move past the src
    startSrcValue += 3;

    // Move past any whitespace
    while (isspace(m_body.CharAt(startSrcValue)))
      ++startSrcValue;

    // We should find an = now
    if (m_body.CharAt(startSrcValue) != '=')
      continue;

    // Move past =
    ++startSrcValue;

    // Move past any whitespace
    while (isspace(m_body.CharAt(startSrcValue)))
      ++startSrcValue;

    // Get the quote char and verify that it's valid
    char    quoteChar = static_cast <char> (m_body.CharAt(startSrcValue));
    if ((quoteChar != '"') && (quoteChar != '\''))
      continue;

    // Move past the quote
    ++startSrcValue;

    PRInt32   endSrcValue = m_body.FindChar(quoteChar, startSrcValue);
    PRInt32   srcLength = endSrcValue - startSrcValue;

    nsString  srcValue;
    aCID.Assign(Substring(m_body, startSrcValue, srcLength));

    if (aCIDHash != 0)
    {
      // Verify source value starts with "cid:"
      if (!StringBeginsWith(aCID, NS_LITERAL_STRING("cid:"), nsCaseInsensitiveStringComparator()))
        continue;

      // Remove "cid:" from the start
      aCID.Cut(0, 4);

      PRUint32  hashValue = EudoraHashString(NS_LossyConvertUTF16toASCII(aCID).get());
      foundMatch = (hashValue == aCIDHash);
    }
    else
    {
      foundMatch = aCID.Equals(aOldRef);
    }
  }

  return foundMatch;
}


bool nsEudoraEditor::HasEmbeddedContent()
{
  // Simple quick test to see if there's any embedded content lines
  bool     bHasEmbeddedContent = false;

  for (PRInt32 i = 0; *sEudoraEmbeddedContentLines[i] != '\0'; i++)
  {
    bHasEmbeddedContent = (m_body.Find(sEudoraEmbeddedContentLines[i], true, 0) != kNotFound);

    if (bHasEmbeddedContent)
      break;
  }

  return bHasEmbeddedContent;
}


nsEudoraHTMLImageElement::nsEudoraHTMLImageElement(const nsAString & aSrc,
                                                   const nsAString &aCID)
  : m_src(aSrc), m_cidOrig(aCID)
{
}

nsEudoraHTMLImageElement::~nsEudoraHTMLImageElement()
{
}


// readonly attribute DOMString nodeName
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNodeName(nsAString & aNodeName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString nodeValue
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNodeValue(nsAString & aNodeValue)
{
  aNodeValue = m_cidOrig;
  return NS_OK;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetNodeValue(const nsAString & aNodeValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute unsigned short nodeType
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNodeType(PRUint16 *aNodeType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMNode parentNode
NS_IMETHODIMP nsEudoraHTMLImageElement::GetParentNode(nsIDOMNode * *aParentNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode parentElement
NS_IMETHODIMP nsEudoraHTMLImageElement::GetParentElement(nsIDOMElement * *aParentElement)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNodeList childNodes
NS_IMETHODIMP nsEudoraHTMLImageElement::GetChildNodes(nsIDOMNodeList * *aChildNodes)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMNode firstChild
NS_IMETHODIMP nsEudoraHTMLImageElement::GetFirstChild(nsIDOMNode * *aFirstChild)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMNode lastChild
NS_IMETHODIMP nsEudoraHTMLImageElement::GetLastChild(nsIDOMNode * *aLastChild)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMNode previousSibling
NS_IMETHODIMP nsEudoraHTMLImageElement::GetPreviousSibling(nsIDOMNode * *aPreviousSibling)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetPreviousElementSibling(nsIDOMElement **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode nextSibling
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNextSibling(nsIDOMNode * *aNextSibling)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNode nextSibling
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNextElementSibling(nsIDOMElement * *aNextSibling)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMNamedNodeMap attributes
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAttributes(nsIDOMNamedNodeMap * *aAttributes)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMDocument ownerDocument
NS_IMETHODIMP nsEudoraHTMLImageElement::GetOwnerDocument(nsIDOMDocument * *aOwnerDocument)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode insertBefore (in nsIDOMNode newChild, in nsIDOMNode refChild)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::InsertBefore(nsIDOMNode *newChild, nsIDOMNode *refChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode replaceChild (in nsIDOMNode newChild, in nsIDOMNode oldChild)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::ReplaceChild(nsIDOMNode *newChild, nsIDOMNode *oldChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode removeChild (in nsIDOMNode oldChild)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::RemoveChild(nsIDOMNode *oldChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode appendChild (in nsIDOMNode newChild)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::AppendChild(nsIDOMNode *newChild, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean hasChildNodes ()
NS_IMETHODIMP nsEudoraHTMLImageElement::HasChildNodes(bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode cloneNode (in boolean deep)
NS_IMETHODIMP nsEudoraHTMLImageElement::CloneNode(bool deep, PRUint8 aOptionalArgc, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void normalize ()
NS_IMETHODIMP nsEudoraHTMLImageElement::Normalize()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean isSupported (in DOMString feature, in DOMString version)
NS_IMETHODIMP nsEudoraHTMLImageElement::IsSupported(const nsAString & feature, const nsAString & version, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute DOMString namespaceURI
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNamespaceURI(nsAString & aNamespaceURI)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString prefix
NS_IMETHODIMP nsEudoraHTMLImageElement::GetPrefix(nsAString & aPrefix)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute DOMString localName
NS_IMETHODIMP nsEudoraHTMLImageElement::GetLocalName(nsAString & aLocalName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean hasAttributes ()
NS_IMETHODIMP nsEudoraHTMLImageElement::HasAttributes(bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute DOMString tagName
NS_IMETHODIMP nsEudoraHTMLImageElement::GetTagName(nsAString & aTagName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// DOMString getAttribute (in DOMString name)
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAttribute(const nsAString & name, nsAString & _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void setAttribute (in DOMString name, in DOMString value)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::SetAttribute(const nsAString & name, const nsAString & value)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void removeAttribute (in DOMString name)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::RemoveAttribute(const nsAString & name)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMAttr getAttributeNode (in DOMString name)
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAttributeNode(const nsAString & name, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMAttr setAttributeNode (in nsIDOMAttr newAttr)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::SetAttributeNode(nsIDOMAttr *newAttr, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMAttr removeAttributeNode (in nsIDOMAttr oldAttr)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::RemoveAttributeNode(nsIDOMAttr *oldAttr, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNodeList getElementsByTagName (in DOMString name)
NS_IMETHODIMP nsEudoraHTMLImageElement::GetElementsByTagName(const nsAString & name, nsIDOMNodeList **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// DOMString getAttributeNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAttributeNS(const nsAString & namespaceURI, const nsAString & localName, nsAString & _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void setAttributeNS (in DOMString namespaceURI, in DOMString qualifiedName, in DOMString value)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::SetAttributeNS(const nsAString & namespaceURI, const nsAString & qualifiedName, const nsAString & value)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void removeAttributeNS (in DOMString namespaceURI, in DOMString localName)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::RemoveAttributeNS(const nsAString & namespaceURI, const nsAString & localName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMAttr getAttributeNodeNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAttributeNodeNS(const nsAString & namespaceURI, const nsAString & localName, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMAttr setAttributeNodeNS (in nsIDOMAttr newAttr)  raises (DOMException)
NS_IMETHODIMP nsEudoraHTMLImageElement::SetAttributeNodeNS(nsIDOMAttr *newAttr, nsIDOMAttr **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNodeList getElementsByTagNameNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsEudoraHTMLImageElement::GetElementsByTagNameNS(const nsAString & namespaceURI, const nsAString & localName, nsIDOMNodeList **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean hasAttribute (in DOMString name)
NS_IMETHODIMP nsEudoraHTMLImageElement::HasAttribute(const nsAString & name, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean hasAttributeNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsEudoraHTMLImageElement::HasAttributeNS(const nsAString & namespaceURI, const nsAString & localName, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetOnmouseenter(JSContext *cx, JS::Value *ret)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetOnmouseenter(JSContext *cx, const JS::Value &aMouseEnter)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetOnmouseleave(JSContext *cx, JS::Value *ret)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetOnmouseleave(JSContext *cx, const JS::Value &aMouseLeave)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString id
NS_IMETHODIMP nsEudoraHTMLImageElement::GetId(nsAString & aId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetId(const nsAString & aId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString title
NS_IMETHODIMP nsEudoraHTMLImageElement::GetTitle(nsAString & aTitle)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetTitle(const nsAString & aTitle)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString lang
NS_IMETHODIMP nsEudoraHTMLImageElement::GetLang(nsAString & aLang)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetLang(const nsAString & aLang)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString dir
NS_IMETHODIMP nsEudoraHTMLImageElement::GetDir(nsAString & aDir)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetDir(const nsAString & aDir)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString className
NS_IMETHODIMP nsEudoraHTMLImageElement::GetClassName(nsAString & aClassName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetClassName(const nsAString & aClassName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMDOMStringMap dataset
NS_IMETHODIMP nsEudoraHTMLImageElement::GetDataset(nsIDOMDOMStringMap * *aDataset)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute boolean hidden
NS_IMETHODIMP nsEudoraHTMLImageElement::GetHidden(bool *aHidden)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetHidden(bool aHidden)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void click ()
NS_IMETHODIMP nsEudoraHTMLImageElement::Click()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute long tabIndex
NS_IMETHODIMP nsEudoraHTMLImageElement::GetTabIndex(PRInt32 *aTabIndex)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetTabIndex(PRInt32 aTabIndex)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void focus ()
NS_IMETHODIMP nsEudoraHTMLImageElement::Focus()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void blur ()
NS_IMETHODIMP nsEudoraHTMLImageElement::Blur()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString accessKey
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAccessKey(nsAString & aAccessKey)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetAccessKey(const nsAString & aAccessKey)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute DOMString accessKeyLabel
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAccessKeyLabel(nsAString & aAccessKeyLabel)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute boolean draggable
NS_IMETHODIMP nsEudoraHTMLImageElement::GetDraggable(bool *aDraggable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetDraggable(bool aDraggable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString contentEditable
NS_IMETHODIMP nsEudoraHTMLImageElement::GetContentEditable(nsAString & aContentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetContentEditable(const nsAString & aContentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute boolean isContentEditable
NS_IMETHODIMP nsEudoraHTMLImageElement::GetIsContentEditable(bool *aIsContentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMHTMLMenuElement contextMenu
NS_IMETHODIMP nsEudoraHTMLImageElement::GetContextMenu(nsIDOMHTMLMenuElement * *aContextMenu)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute boolean spellcheck
NS_IMETHODIMP nsEudoraHTMLImageElement::GetSpellcheck(bool *aSpellcheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetSpellcheck(bool aSpellcheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString innerHTML
NS_IMETHODIMP nsEudoraHTMLImageElement::GetInnerHTML(nsAString & aInnerHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetInnerHTML(const nsAString & aInnerHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetOuterHTML(nsAString & aOuterHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetOuterHTML(const nsAString & aOuterHTML)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void insertAdjacentHTML (in DOMString position, in DOMString text)
NS_IMETHODIMP nsEudoraHTMLImageElement::InsertAdjacentHTML(const nsAString & position, const nsAString & text)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// [optional_argc] void scrollIntoView ([optional] in boolean top)
NS_IMETHODIMP nsEudoraHTMLImageElement::ScrollIntoView(bool top, PRUint8 _argc)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMElement offsetParent
NS_IMETHODIMP nsEudoraHTMLImageElement::GetOffsetParent(nsIDOMElement * *aOffsetParent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetTop
NS_IMETHODIMP nsEudoraHTMLImageElement::GetOffsetTop(PRInt32 *aOffsetTop)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetLeft
NS_IMETHODIMP nsEudoraHTMLImageElement::GetOffsetLeft(PRInt32 *aOffsetLeft)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetWidth
NS_IMETHODIMP nsEudoraHTMLImageElement::GetOffsetWidth(PRInt32 *aOffsetWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute long offsetHeight
NS_IMETHODIMP nsEudoraHTMLImageElement::GetOffsetHeight(PRInt32 *aOffsetHeight)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void mozRequestFullScreen ()
NS_IMETHODIMP nsEudoraHTMLImageElement::MozRequestFullScreen()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString name
NS_IMETHODIMP nsEudoraHTMLImageElement::GetName(nsAString & aName)
{
  return NS_OK;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetName(const nsAString & aName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString align
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAlign(nsAString & aAlign)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetAlign(const nsAString & aAlign)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString crossOrigin
NS_IMETHODIMP nsEudoraHTMLImageElement::GetCrossOrigin(nsAString & aCrossOrigin)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetCrossOrigin(const nsAString & aCrossOrigin)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString alt
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAlt(nsAString & aAlt)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetAlt(const nsAString & aAlt)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString lowsrc
NS_IMETHODIMP nsEudoraHTMLImageElement::GetLowsrc(nsAString &aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetLowsrc(const nsAString &aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute DOMString complete
NS_IMETHODIMP nsEudoraHTMLImageElement::GetComplete(bool *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute long naturalWidth
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNaturalWidth(PRUint32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute long naturalHeight
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNaturalHeight(PRUint32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute DOMString border
NS_IMETHODIMP nsEudoraHTMLImageElement::GetBorder(nsAString & aBorder)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetBorder(const nsAString & aBorder)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute long height
NS_IMETHODIMP nsEudoraHTMLImageElement::GetHeight(PRUint32 *aHeight)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetHeight(PRUint32 aHeight)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute long hspace
NS_IMETHODIMP nsEudoraHTMLImageElement::GetHspace(PRInt32 *aHspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetHspace(PRInt32 aHspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute boolean isMap
NS_IMETHODIMP nsEudoraHTMLImageElement::GetIsMap(bool *aIsMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetIsMap(bool aIsMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString longDesc
NS_IMETHODIMP nsEudoraHTMLImageElement::GetLongDesc(nsAString & aLongDesc)
{
  return NS_OK;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetLongDesc(const nsAString & aLongDesc)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetSrc(nsAString & aSrc)
{
  aSrc = m_src;
  return NS_OK;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetSrc(const nsAString & aSrc)
{
  m_src = aSrc;
  return NS_OK;
}

// attribute DOMString useMap
NS_IMETHODIMP nsEudoraHTMLImageElement::GetUseMap(nsAString & aUseMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetUseMap(const nsAString & aUseMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute long vspace
NS_IMETHODIMP nsEudoraHTMLImageElement::GetVspace(PRInt32 *aVspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetVspace(PRInt32 aVspace)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute long width
NS_IMETHODIMP nsEudoraHTMLImageElement::GetWidth(PRUint32 *aWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetWidth(PRUint32 aWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetDOMBaseURI(nsAString &aBaseURI)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::CompareDocumentPosition(nsIDOMNode *other, PRUint16 *_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetTextContent(nsAString & aTextContent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetTextContent(const nsAString & aTextContent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::Contains(nsIDOMNode* aOther, bool* aReturn)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::LookupPrefix(const nsAString & namespaceURI, nsAString & _retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::IsDefaultNamespace(const nsAString & namespaceURI, bool *_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::LookupNamespaceURI(const nsAString & prefix, nsAString & _retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::IsEqualNode(nsIDOMNode *arg, bool *_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetUserData(const nsAString & key, nsIVariant *data,
                          nsIDOMUserDataHandler *handler, nsIVariant **_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetUserData(const nsAString & key, nsIVariant **_retval NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetClientTop(PRInt32 *aClientTop)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetClassList(nsIDOMDOMTokenList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetScrollTop(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetScrollTop(PRInt32 aScrollTop)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetScrollWidth(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetScrollHeight(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetScrollLeft(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetScrollLeft(PRInt32 aScollLeft)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetClientWidth(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetClientLeft(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetElementsByClassName(const nsAString &aClasses, nsIDOMNodeList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetChildElements(nsIDOMNodeList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetChildElementCount(PRUint32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::ReleaseCapture()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::SetCapture(bool aRetargetToElement)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetClientRects(nsIDOMClientRectList **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetClientHeight(PRInt32 *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetFirstElementChild(nsIDOMElement **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetLastElementChild(nsIDOMElement **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::GetBoundingClientRect(nsIDOMClientRect **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::MozMatchesSelector(const nsAString &aSelector, bool *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraHTMLImageElement::MozRequestPointerLock()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsEudoraHTMLImageElement::GetX(PRInt32* aX)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsEudoraHTMLImageElement::GetY(PRInt32* aY)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
