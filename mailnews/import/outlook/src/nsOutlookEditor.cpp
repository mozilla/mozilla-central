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

NS_IMPL_ISUPPORTS2(nsOutlookEditor, nsIEditor, nsIEditorMailSupport)
NS_IMPL_THREADSAFE_ISUPPORTS5(nsOutlookHTMLImageElement,
                              nsOutlookHTMLImageElement,
                              nsIDOMHTMLImageElement,
                              nsIDOMHTMLElement,
                              nsIDOMElement,
                              nsIDOMNode)

nsOutlookEditor::nsOutlookEditor(const wchar_t * body)
  : m_body(body)
{
}

nsOutlookEditor::~nsOutlookEditor()
{
}

// readonly attribute nsISelection selection
NS_IMETHODIMP nsOutlookEditor::GetSelection(nsISelection * *aSelection)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// [noscript] void init (in nsIDOMDocument doc, in nsIPresShellPtr shell, in nsIContentPtr aRoot, in nsISelectionController aSelCon, in unsigned long aFlags)
NS_IMETHODIMP nsOutlookEditor::Init(nsIDOMDocument *doc, nsIContent * aRoot, nsISelectionController *aSelCon, PRUint32 aFlags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void setAttributeOrEquivalent (in nsIDOMElement element, in AString sourceAttrName, in AString sourceAttrValue, in boolean aSuppressTransaction)
NS_IMETHODIMP nsOutlookEditor::SetAttributeOrEquivalent(nsIDOMElement *element, const nsAString & sourceAttrName, const nsAString & sourceAttrValue, bool aSuppressTransaction)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void removeAttributeOrEquivalent (in nsIDOMElement element, in DOMString sourceAttrName, in boolean aSuppressTransaction)
NS_IMETHODIMP nsOutlookEditor::RemoveAttributeOrEquivalent(nsIDOMElement *element, const nsAString & sourceAttrName, bool aSuppressTransaction)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void postCreate ()
NS_IMETHODIMP nsOutlookEditor::PostCreate()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void preDestroy (in boolean aDestroyingFrames)
NS_IMETHODIMP nsOutlookEditor::PreDestroy(bool aDestroyingFrames)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute unsigned long flags
NS_IMETHODIMP nsOutlookEditor::GetFlags(PRUint32 *aFlags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::SetFlags(PRUint32 aFlags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute string contentsMIMEType
NS_IMETHODIMP nsOutlookEditor::GetContentsMIMEType(char * *aContentsMIMEType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::SetContentsMIMEType(const char * aContentsMIMEType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute boolean isDocumentEditable
NS_IMETHODIMP nsOutlookEditor::GetIsDocumentEditable(bool *aIsDocumentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::GetIsSelectionEditable(bool *aIsSelectionEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMDocument document
NS_IMETHODIMP nsOutlookEditor::GetDocument(nsIDOMDocument * *aDocument)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIDOMElement rootElement
NS_IMETHODIMP nsOutlookEditor::GetRootElement(nsIDOMElement * *aRootElement)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsISelectionController selectionController
NS_IMETHODIMP nsOutlookEditor::GetSelectionController(nsISelectionController * *aSelectionController)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void deleteSelection (in short action)
NS_IMETHODIMP nsOutlookEditor::DeleteSelection(PRInt16 action)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute boolean documentIsEmpty
NS_IMETHODIMP nsOutlookEditor::GetDocumentIsEmpty(bool *aDocumentIsEmpty)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute boolean documentModified
NS_IMETHODIMP nsOutlookEditor::GetDocumentModified(bool *aDocumentModified)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// attribute ACString documentCharacterSet
NS_IMETHODIMP nsOutlookEditor::GetDocumentCharacterSet(nsACString & aDocumentCharacterSet)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::SetDocumentCharacterSet(const nsACString & aDocumentCharacterSet)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void resetModificationCount ()
NS_IMETHODIMP nsOutlookEditor::ResetModificationCount()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// long getModificationCount ()
NS_IMETHODIMP nsOutlookEditor::GetModificationCount(PRInt32 *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void incrementModificationCount (in long aModCount)
NS_IMETHODIMP nsOutlookEditor::IncrementModificationCount(PRInt32 aModCount)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

//  attribute nsITransactionManager transactionManager
NS_IMETHODIMP nsOutlookEditor::GetTransactionManager(nsITransactionManager * *aTransactionManager)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::SetTransactionManager(nsITransactionManager *aTxnManager)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void doTransaction (in nsITransaction txn)
NS_IMETHODIMP nsOutlookEditor::DoTransaction(nsITransaction *txn)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void enableUndo (in boolean enable)
NS_IMETHODIMP nsOutlookEditor::EnableUndo(bool enable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void undo (in unsigned long count)
NS_IMETHODIMP nsOutlookEditor::Undo(PRUint32 count)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void canUndo (out boolean isEnabled, out boolean canUndo)
NS_IMETHODIMP nsOutlookEditor::CanUndo(bool *isEnabled, bool *canUndo)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void redo (in unsigned long count)
NS_IMETHODIMP nsOutlookEditor::Redo(PRUint32 count)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void canRedo (out boolean isEnabled, out boolean canRedo)
NS_IMETHODIMP nsOutlookEditor::CanRedo(bool *isEnabled, bool *canRedo)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void beginTransaction ()
NS_IMETHODIMP nsOutlookEditor::BeginTransaction()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void endTransaction ()
NS_IMETHODIMP nsOutlookEditor::EndTransaction()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void beginPlaceHolderTransaction (in nsIAtom name)
NS_IMETHODIMP nsOutlookEditor::BeginPlaceHolderTransaction(nsIAtom *name)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void endPlaceHolderTransaction ()
NS_IMETHODIMP nsOutlookEditor::EndPlaceHolderTransaction()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean shouldTxnSetSelection ()
NS_IMETHODIMP nsOutlookEditor::ShouldTxnSetSelection(bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void setShouldTxnSetSelection (in boolean should)
NS_IMETHODIMP nsOutlookEditor::SetShouldTxnSetSelection(bool should)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// readonly attribute nsIInlineSpellChecker inlineSpellChecker
NS_IMETHODIMP nsOutlookEditor::GetInlineSpellChecker(bool autoCreate, nsIInlineSpellChecker * *aInlineSpellChecker)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::SyncRealTimeSpell()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::SetSpellcheckUserOverride(bool enable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

bool
nsOutlookEditor::IsModifiableNode(nsIDOMNode *aNode)
{
  return PR_TRUE;
}
// void cut ()
NS_IMETHODIMP nsOutlookEditor::Cut()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean canCut ()
NS_IMETHODIMP nsOutlookEditor::CanCut(bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void copy ()
NS_IMETHODIMP nsOutlookEditor::Copy()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean canCopy ()
NS_IMETHODIMP nsOutlookEditor::CanCopy(bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void paste (in long aSelectionType)
NS_IMETHODIMP nsOutlookEditor::Paste(PRInt32 aSelectionType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean canPaste (in long aSelectionType)
NS_IMETHODIMP nsOutlookEditor::CanPaste(PRInt32 aSelectionType, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

class nsITransferable;

// void pasteTransferable(in nsITransferable aTransferable)
NS_IMETHODIMP nsOutlookEditor::PasteTransferable(nsITransferable *aTransferable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean canPasteTransferable([optional] in nsITransferable aTransferable)
NS_IMETHODIMP nsOutlookEditor::CanPasteTransferable(nsITransferable *aTransferable, bool *aCanPaste)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void selectAll ()
NS_IMETHODIMP nsOutlookEditor::SelectAll()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void beginningOfDocument ()
NS_IMETHODIMP nsOutlookEditor::BeginningOfDocument()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void endOfDocument ()
NS_IMETHODIMP nsOutlookEditor::EndOfDocument()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// boolean canDrag (in nsIDOMEvent aEvent)
NS_IMETHODIMP nsOutlookEditor::CanDrag(nsIDOMEvent *aEvent, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void doDrag (in nsIDOMEvent aEvent)
NS_IMETHODIMP nsOutlookEditor::DoDrag(nsIDOMEvent *aEvent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void insertFromDrop (in nsIDOMEvent aEvent)
NS_IMETHODIMP nsOutlookEditor::InsertFromDrop(nsIDOMEvent *aEvent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void setAttribute (in nsIDOMElement aElement, in AString attributestr, in AString attvalue)
NS_IMETHODIMP nsOutlookEditor::SetAttribute(nsIDOMElement *aElement, const nsAString & attributestr, const nsAString & attvalue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* boolean getAttributeValue (in nsIDOMElement aElement, in AString attributestr, out AString resultValue); */
NS_IMETHODIMP nsOutlookEditor::GetAttributeValue(nsIDOMElement *aElement, const nsAString & attributestr, nsAString & resultValue, bool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void removeAttribute (in nsIDOMElement aElement, in AString aAttribute); */
NS_IMETHODIMP nsOutlookEditor::RemoveAttribute(nsIDOMElement *aElement, const nsAString & aAttribute)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void cloneAttribute (in AString aAttribute, in nsIDOMNode aDestNode, in nsIDOMNode aSourceNode); */
NS_IMETHODIMP nsOutlookEditor::CloneAttribute(const nsAString & aAttribute, nsIDOMNode *aDestNode, nsIDOMNode *aSourceNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void cloneAttributes (in nsIDOMNode destNode, in nsIDOMNode sourceNode); */
NS_IMETHODIMP nsOutlookEditor::CloneAttributes(nsIDOMNode *destNode, nsIDOMNode *sourceNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* nsIDOMNode createNode (in AString tag, in nsIDOMNode parent, in long position); */
NS_IMETHODIMP nsOutlookEditor::CreateNode(const nsAString & tag, nsIDOMNode *parent, PRInt32 position, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void insertNode (in nsIDOMNode node, in nsIDOMNode parent, in long aPosition)
NS_IMETHODIMP nsOutlookEditor::InsertNode(nsIDOMNode *node, nsIDOMNode *parent, PRInt32 aPosition)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void splitNode (in nsIDOMNode existingRightNode, in long offset, out nsIDOMNode newLeftNode)
NS_IMETHODIMP nsOutlookEditor::SplitNode(nsIDOMNode *existingRightNode, PRInt32 offset, nsIDOMNode **newLeftNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void joinNodes (in nsIDOMNode leftNode, in nsIDOMNode rightNode, in nsIDOMNode parent)
NS_IMETHODIMP nsOutlookEditor::JoinNodes(nsIDOMNode *leftNode, nsIDOMNode *rightNode, nsIDOMNode *parent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void deleteNode (in nsIDOMNode child)
NS_IMETHODIMP nsOutlookEditor::DeleteNode(nsIDOMNode *child)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void markNodeDirty (in nsIDOMNode node)
NS_IMETHODIMP nsOutlookEditor::MarkNodeDirty(nsIDOMNode *node)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void switchTextDirection ()
NS_IMETHODIMP nsOutlookEditor::SwitchTextDirection()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// AString outputToString (in AString formatType, in unsigned long flags)
NS_IMETHODIMP
nsOutlookEditor::OutputToString(const nsAString & formatType,
                                PRUint32 flags, nsAString & _retval)
{
  _retval.Assign(m_body);
  return NS_OK;
}

// void outputToStream (in nsIOutputStream aStream, in AString formatType, in ACString charsetOverride, in unsigned long flags)

NS_IMETHODIMP nsOutlookEditor::OutputToStream(nsIOutputStream *aStream,
                                              const nsAString &formatType,
                                              const nsACString &charsetOverride,
                                              PRUint32 flags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void addEditorObserver (in nsIEditorObserver observer)
NS_IMETHODIMP nsOutlookEditor::AddEditorObserver(nsIEditorObserver *observer)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void removeEditorObserver (in nsIEditorObserver observer)
NS_IMETHODIMP nsOutlookEditor::RemoveEditorObserver(nsIEditorObserver *observer)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void addEditActionListener (in nsIEditActionListener listener)
NS_IMETHODIMP nsOutlookEditor::AddEditActionListener(nsIEditActionListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void removeEditActionListener (in nsIEditActionListener listener)
NS_IMETHODIMP nsOutlookEditor::RemoveEditActionListener(nsIEditActionListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void addDocumentStateListener (in nsIDocumentStateListener listener)
NS_IMETHODIMP
nsOutlookEditor::AddDocumentStateListener(nsIDocumentStateListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void removeDocumentStateListener (in nsIDocumentStateListener listener)
NS_IMETHODIMP
nsOutlookEditor::RemoveDocumentStateListener(nsIDocumentStateListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void dumpContentTree ()
NS_IMETHODIMP nsOutlookEditor::DumpContentTree()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void debugDumpContent ()
NS_IMETHODIMP nsOutlookEditor::DebugDumpContent()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void debugUnitTests (out long outNumTests, out long outNumTestsFailed)
NS_IMETHODIMP nsOutlookEditor::DebugUnitTests(PRInt32 *outNumTests,
                                              PRInt32 *outNumTestsFailed)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsOutlookEditor::GetLastKeypressEventTrusted(bool *aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void pasteAsQuotation (in long aSelectionType)
NS_IMETHODIMP nsOutlookEditor::PasteAsQuotation(PRInt32 aSelectionType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNode insertAsQuotation (in AString aQuotedText)
NS_IMETHODIMP nsOutlookEditor::InsertAsQuotation(const nsAString &aQuotedText,
                                                 nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void insertTextWithQuotations (in DOMString aStringToInsert)
NS_IMETHODIMP
nsOutlookEditor::InsertTextWithQuotations(const nsAString & aStringToInsert)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void pasteAsCitedQuotation (in AString aCitation, in long aSelectionType)
NS_IMETHODIMP
nsOutlookEditor::PasteAsCitedQuotation(const nsAString & aCitation,
                                       PRInt32 aSelectionType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsIDOMNode insertAsCitedQuotation (in AString aQuotedText, in AString aCitation, in boolean aInsertHTML)
NS_IMETHODIMP
nsOutlookEditor::InsertAsCitedQuotation(const nsAString &aQuotedText,
                                        const nsAString & aCitation,
                                        bool aInsertHTML,
                                        nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void rewrap (in boolean aRespectNewlines)
NS_IMETHODIMP nsOutlookEditor::Rewrap(bool aRespectNewlines)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// void stripCites ()
NS_IMETHODIMP nsOutlookEditor::StripCites()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// nsISupportsArray getEmbeddedObjects ()
NS_IMETHODIMP nsOutlookEditor::GetEmbeddedObjects(nsISupportsArray ** aNodeList)
{
  NS_ENSURE_ARG_POINTER(aNodeList);

  NS_IF_ADDREF(*aNodeList = m_EmbeddedObjectList);
  return (m_EmbeddedObjectList == nsnull) ? NS_ERROR_NULL_POINTER : NS_OK;
}

nsresult nsOutlookEditor::AddEmbeddedImage(nsIURI *uri, const wchar_t* cid,
                                           const wchar_t *name)
{
  // Check to see if we were already called
  if (!m_EmbeddedObjectList) {
    // Create array in m_EmbeddedObjectList
    nsresult rv = NS_NewISupportsArray(getter_AddRefs(m_EmbeddedObjectList) );
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // Create the embedded image node
  nsCOMPtr<nsIDOMHTMLImageElement> imageNode =
    new nsOutlookHTMLImageElement(this, uri, cid, name);

  // Append the embedded image node to the list
  m_EmbeddedObjectList->AppendElement(imageNode);

  return NS_OK;
}

PRUint32 nsOutlookEditor::EmbeddedObjectsCount() const
{
  if (!m_EmbeddedObjectList)
    return 0;
  PRUint32 res;
  nsresult rv = m_EmbeddedObjectList->Count(&res);
  return (NS_FAILED(rv)) ? 0 : res;
}

nsresult nsOutlookEditor::GetCids(PRUint32 embedIndex, nsACString& origCid,
                                  nsACString& newCid) const
{
  if (!m_EmbeddedObjectList)
    return NS_ERROR_FAILURE;
  nsCOMPtr<nsOutlookHTMLImageElement> node;
  nsresult rv = m_EmbeddedObjectList->QueryElementAt(
    embedIndex, NS_GET_IID(nsOutlookHTMLImageElement), getter_AddRefs(node));
  if (node) {
    if (!node->NewCid())
      return NS_ERROR_FAILURE; // no need to replace anything!
    LossyCopyUTF16toASCII(nsDependentString(node->OrigCid()), origCid);
    LossyCopyUTF16toASCII(nsDependentString(node->NewCid()), newCid);
  }
  return rv;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

nsOutlookHTMLImageElement::nsOutlookHTMLImageElement
  (nsOutlookEditor *pEditor, nsIURI *uri, const wchar_t *cid, const wchar_t *name)
  : m_pEditor(pEditor), m_name(name), m_cid_orig(cid)
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
  return NS_ERROR_NOT_IMPLEMENTED;
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

// readonly attribute nsIDOMNode nextSibling
NS_IMETHODIMP nsOutlookHTMLImageElement::GetNextSibling(nsIDOMNode * *aNextSibling)
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
NS_IMETHODIMP nsOutlookHTMLImageElement::CloneNode(bool deep, nsIDOMNode **_retval)
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
  // nsEudoraHTMLImageElement calls UpdateEmbeddedImageReference(m_cid, aSrc)
  // on the editor here, but our editor doen't implement it.

  // The nsMsgNend::ProcessMultipartRelated seems to call SetSrc twice.
  // I'm not sure if I need to do it second time.
  if (m_cid_new.IsEmpty()) 
    m_cid_new.Assign(Substring(aSrc, 4)); // strip the "cid:"

  return NS_OK;
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

