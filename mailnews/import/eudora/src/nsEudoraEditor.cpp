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
#include "nsString.h"
#include "nsNetUtil.h"

NS_IMPL_ISUPPORTS2(nsEudoraEditor, nsIEditor, nsIEditorMailSupport)
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

  return (ulSum + 1);
}


nsEudoraEditor::nsEudoraEditor(const char * pBody, nsIFile * pMailImportLocation)
  : m_body(pBody)
{
  m_pMailImportLocation = pMailImportLocation;
}


nsEudoraEditor::~nsEudoraEditor()
{
}


// readonly attribute nsISelection selection
NS_IMETHODIMP nsEudoraEditor::GetSelection(nsISelection * *aSelection)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// [noscript] void init (in nsIDOMDocument doc, in nsIPresShellPtr shell, in nsIContentPtr aRoot, in nsISelectionController aSelCon, in unsigned long aFlags)
NS_IMETHODIMP nsEudoraEditor::Init(nsIDOMDocument *doc, nsIPresShell * shell, nsIContent * aRoot, nsISelectionController *aSelCon, PRUint32 aFlags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void setAttributeOrEquivalent (in nsIDOMElement element, in AString sourceAttrName, in AString sourceAttrValue, in boolean aSuppressTransaction)
NS_IMETHODIMP nsEudoraEditor::SetAttributeOrEquivalent(nsIDOMElement *element, const nsAString & sourceAttrName, const nsAString & sourceAttrValue, PRBool aSuppressTransaction)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void removeAttributeOrEquivalent (in nsIDOMElement element, in DOMString sourceAttrName, in boolean aSuppressTransaction)
NS_IMETHODIMP nsEudoraEditor::RemoveAttributeOrEquivalent(nsIDOMElement *element, const nsAString & sourceAttrName, PRBool aSuppressTransaction)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void postCreate ()
NS_IMETHODIMP nsEudoraEditor::PostCreate()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void preDestroy (in boolean aDestroyingFrames)
NS_IMETHODIMP nsEudoraEditor::PreDestroy(PRBool aDestroyingFrames)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute unsigned long flags
NS_IMETHODIMP nsEudoraEditor::GetFlags(PRUint32 *aFlags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraEditor::SetFlags(PRUint32 aFlags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute string contentsMIMEType
NS_IMETHODIMP nsEudoraEditor::GetContentsMIMEType(char * *aContentsMIMEType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraEditor::SetContentsMIMEType(const char * aContentsMIMEType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute boolean isDocumentEditable
NS_IMETHODIMP nsEudoraEditor::GetIsDocumentEditable(PRBool *aIsDocumentEditable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMDocument document
NS_IMETHODIMP nsEudoraEditor::GetDocument(nsIDOMDocument * *aDocument)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIDOMElement rootElement
NS_IMETHODIMP nsEudoraEditor::GetRootElement(nsIDOMElement * *aRootElement)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsISelectionController selectionController
NS_IMETHODIMP nsEudoraEditor::GetSelectionController(nsISelectionController * *aSelectionController)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void deleteSelection (in short action)
NS_IMETHODIMP nsEudoraEditor::DeleteSelection(PRInt16 action)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute boolean documentIsEmpty
NS_IMETHODIMP nsEudoraEditor::GetDocumentIsEmpty(PRBool *aDocumentIsEmpty)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute boolean documentModified
NS_IMETHODIMP nsEudoraEditor::GetDocumentModified(PRBool *aDocumentModified)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute ACString documentCharacterSet
NS_IMETHODIMP nsEudoraEditor::GetDocumentCharacterSet(nsACString & aDocumentCharacterSet)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraEditor::SetDocumentCharacterSet(const nsACString & aDocumentCharacterSet)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void resetModificationCount ()
NS_IMETHODIMP nsEudoraEditor::ResetModificationCount()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// long getModificationCount ()
NS_IMETHODIMP nsEudoraEditor::GetModificationCount(PRInt32 *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void incrementModificationCount (in long aModCount)
NS_IMETHODIMP nsEudoraEditor::IncrementModificationCount(PRInt32 aModCount)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


//  attribute nsITransactionManager transactionManager
NS_IMETHODIMP nsEudoraEditor::GetTransactionManager(nsITransactionManager * *aTransactionManager)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraEditor::SetTransactionManager(nsITransactionManager *aTxnManager)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void doTransaction (in nsITransaction txn)
NS_IMETHODIMP nsEudoraEditor::DoTransaction(nsITransaction *txn)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void enableUndo (in boolean enable)
NS_IMETHODIMP nsEudoraEditor::EnableUndo(PRBool enable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void undo (in unsigned long count)
NS_IMETHODIMP nsEudoraEditor::Undo(PRUint32 count)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void canUndo (out boolean isEnabled, out boolean canUndo)
NS_IMETHODIMP nsEudoraEditor::CanUndo(PRBool *isEnabled, PRBool *canUndo)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void redo (in unsigned long count)
NS_IMETHODIMP nsEudoraEditor::Redo(PRUint32 count)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void canRedo (out boolean isEnabled, out boolean canRedo)
NS_IMETHODIMP nsEudoraEditor::CanRedo(PRBool *isEnabled, PRBool *canRedo)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void beginTransaction ()
NS_IMETHODIMP nsEudoraEditor::BeginTransaction()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void endTransaction ()
NS_IMETHODIMP nsEudoraEditor::EndTransaction()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void beginPlaceHolderTransaction (in nsIAtom name)
NS_IMETHODIMP nsEudoraEditor::BeginPlaceHolderTransaction(nsIAtom *name)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void endPlaceHolderTransaction ()
NS_IMETHODIMP nsEudoraEditor::EndPlaceHolderTransaction()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean shouldTxnSetSelection ()
NS_IMETHODIMP nsEudoraEditor::ShouldTxnSetSelection(PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void setShouldTxnSetSelection (in boolean should)
NS_IMETHODIMP nsEudoraEditor::SetShouldTxnSetSelection(PRBool should)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute nsIInlineSpellChecker inlineSpellChecker
NS_IMETHODIMP nsEudoraEditor::GetInlineSpellChecker(PRBool autoCreate, nsIInlineSpellChecker * *aInlineSpellChecker)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraEditor::SyncRealTimeSpell()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsEudoraEditor::SetSpellcheckUserOverride(PRBool enable)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

PRBool
nsEudoraEditor::IsModifiableNode(nsIDOMNode *aNode)
{
  return PR_TRUE;
}
// void cut ()
NS_IMETHODIMP nsEudoraEditor::Cut()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean canCut ()
NS_IMETHODIMP nsEudoraEditor::CanCut(PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void copy ()
NS_IMETHODIMP nsEudoraEditor::Copy()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean canCopy ()
NS_IMETHODIMP nsEudoraEditor::CanCopy(PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void paste (in long aSelectionType)
NS_IMETHODIMP nsEudoraEditor::Paste(PRInt32 aSelectionType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean canPaste (in long aSelectionType)
NS_IMETHODIMP nsEudoraEditor::CanPaste(PRInt32 aSelectionType, PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void selectAll ()
NS_IMETHODIMP nsEudoraEditor::SelectAll()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void beginningOfDocument ()
NS_IMETHODIMP nsEudoraEditor::BeginningOfDocument()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void endOfDocument ()
NS_IMETHODIMP nsEudoraEditor::EndOfDocument()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean canDrag (in nsIDOMEvent aEvent)
NS_IMETHODIMP nsEudoraEditor::CanDrag(nsIDOMEvent *aEvent, PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void doDrag (in nsIDOMEvent aEvent)
NS_IMETHODIMP nsEudoraEditor::DoDrag(nsIDOMEvent *aEvent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void insertFromDrop (in nsIDOMEvent aEvent)
NS_IMETHODIMP nsEudoraEditor::InsertFromDrop(nsIDOMEvent *aEvent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void setAttribute (in nsIDOMElement aElement, in AString attributestr, in AString attvalue)
NS_IMETHODIMP nsEudoraEditor::SetAttribute(nsIDOMElement *aElement, const nsAString & attributestr, const nsAString & attvalue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* boolean getAttributeValue (in nsIDOMElement aElement, in AString attributestr, out AString resultValue); */
NS_IMETHODIMP nsEudoraEditor::GetAttributeValue(nsIDOMElement *aElement, const nsAString & attributestr, nsAString & resultValue, PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void removeAttribute (in nsIDOMElement aElement, in AString aAttribute); */
NS_IMETHODIMP nsEudoraEditor::RemoveAttribute(nsIDOMElement *aElement, const nsAString & aAttribute)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void cloneAttribute (in AString aAttribute, in nsIDOMNode aDestNode, in nsIDOMNode aSourceNode); */
NS_IMETHODIMP nsEudoraEditor::CloneAttribute(const nsAString & aAttribute, nsIDOMNode *aDestNode, nsIDOMNode *aSourceNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void cloneAttributes (in nsIDOMNode destNode, in nsIDOMNode sourceNode); */
NS_IMETHODIMP nsEudoraEditor::CloneAttributes(nsIDOMNode *destNode, nsIDOMNode *sourceNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* nsIDOMNode createNode (in AString tag, in nsIDOMNode parent, in long position); */
NS_IMETHODIMP nsEudoraEditor::CreateNode(const nsAString & tag, nsIDOMNode *parent, PRInt32 position, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void insertNode (in nsIDOMNode node, in nsIDOMNode parent, in long aPosition)
NS_IMETHODIMP nsEudoraEditor::InsertNode(nsIDOMNode *node, nsIDOMNode *parent, PRInt32 aPosition)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void splitNode (in nsIDOMNode existingRightNode, in long offset, out nsIDOMNode newLeftNode)
NS_IMETHODIMP nsEudoraEditor::SplitNode(nsIDOMNode *existingRightNode, PRInt32 offset, nsIDOMNode **newLeftNode)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void joinNodes (in nsIDOMNode leftNode, in nsIDOMNode rightNode, in nsIDOMNode parent)
NS_IMETHODIMP nsEudoraEditor::JoinNodes(nsIDOMNode *leftNode, nsIDOMNode *rightNode, nsIDOMNode *parent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void deleteNode (in nsIDOMNode child)
NS_IMETHODIMP nsEudoraEditor::DeleteNode(nsIDOMNode *child)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void markNodeDirty (in nsIDOMNode node)
NS_IMETHODIMP nsEudoraEditor::MarkNodeDirty(nsIDOMNode *node)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void switchTextDirection ()
NS_IMETHODIMP nsEudoraEditor::SwitchTextDirection()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// AString outputToString (in AString formatType, in unsigned long flags)
NS_IMETHODIMP nsEudoraEditor::OutputToString(const nsAString & formatType, PRUint32 flags, nsAString & _retval)
{
  _retval = m_body;

  return NS_OK;
}


// void outputToStream (in nsIOutputStream aStream, in AString formatType, in ACString charsetOverride, in unsigned long flags)
NS_IMETHODIMP nsEudoraEditor::OutputToStream(nsIOutputStream *aStream, const nsAString & formatType, const nsACString & charsetOverride, PRUint32 flags)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void addEditorObserver (in nsIEditorObserver observer)
NS_IMETHODIMP nsEudoraEditor::AddEditorObserver(nsIEditorObserver *observer)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void removeEditorObserver (in nsIEditorObserver observer)
NS_IMETHODIMP nsEudoraEditor::RemoveEditorObserver(nsIEditorObserver *observer)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void addEditActionListener (in nsIEditActionListener listener)
NS_IMETHODIMP nsEudoraEditor::AddEditActionListener(nsIEditActionListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void removeEditActionListener (in nsIEditActionListener listener)
NS_IMETHODIMP nsEudoraEditor::RemoveEditActionListener(nsIEditActionListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void addDocumentStateListener (in nsIDocumentStateListener listener)
NS_IMETHODIMP nsEudoraEditor::AddDocumentStateListener(nsIDocumentStateListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void removeDocumentStateListener (in nsIDocumentStateListener listener)
NS_IMETHODIMP nsEudoraEditor::RemoveDocumentStateListener(nsIDocumentStateListener *listener)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void dumpContentTree ()
NS_IMETHODIMP nsEudoraEditor::DumpContentTree()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void debugDumpContent ()
NS_IMETHODIMP nsEudoraEditor::DebugDumpContent()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void debugUnitTests (out long outNumTests, out long outNumTestsFailed)
NS_IMETHODIMP nsEudoraEditor::DebugUnitTests(PRInt32 *outNumTests, PRInt32 *outNumTestsFailed)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void pasteAsQuotation (in long aSelectionType)
NS_IMETHODIMP nsEudoraEditor::PasteAsQuotation(PRInt32 aSelectionType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode insertAsQuotation (in AString aQuotedText)
NS_IMETHODIMP nsEudoraEditor::InsertAsQuotation(const nsAString & aQuotedText, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void insertTextWithQuotations (in DOMString aStringToInsert)
NS_IMETHODIMP nsEudoraEditor::InsertTextWithQuotations(const nsAString & aStringToInsert)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void pasteAsCitedQuotation (in AString aCitation, in long aSelectionType)
NS_IMETHODIMP nsEudoraEditor::PasteAsCitedQuotation(const nsAString & aCitation, PRInt32 aSelectionType)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode insertAsCitedQuotation (in AString aQuotedText, in AString aCitation, in boolean aInsertHTML)
NS_IMETHODIMP nsEudoraEditor::InsertAsCitedQuotation(const nsAString & aQuotedText, const nsAString & aCitation, PRBool aInsertHTML, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void rewrap (in boolean aRespectNewlines)
NS_IMETHODIMP nsEudoraEditor::Rewrap(PRBool aRespectNewlines)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void stripCites ()
NS_IMETHODIMP nsEudoraEditor::StripCites()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsISupportsArray getEmbeddedObjects ()
NS_IMETHODIMP nsEudoraEditor::GetEmbeddedObjects(nsISupportsArray ** aNodeList)
{
  NS_ENSURE_ARG_POINTER(aNodeList);

  // Check to see if we were already called
  if (m_EmbeddedObjectList != nsnull)
  {
    *aNodeList = m_EmbeddedObjectList;
    return NS_OK;
  }

  // Create array in m_EmbeddedObjectList
  nsresult rv = NS_NewISupportsArray( getter_AddRefs(m_EmbeddedObjectList) );
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
  PRBool      foundEmbeddedContentLines = PR_FALSE;

  // Search for various translations of "Embedded Content" - as of this writing only
  // one that I know of, but then again I didn't realize that Eudora translators had
  // ever translated "Attachment Converted" as suggested by other Eudora importing code.
  for (PRInt32 i = 0; *sEudoraEmbeddedContentLines[i] != '\0'; i++)
  {
    // Search for "Embedded Content: " lines starting after last closing tag (if any)
    PRInt32   startEmbeddedContentLine = startLastClosingTag;
    PRInt32   lenEmbeddedContentTag = strlen(sEudoraEmbeddedContentLines[i]);

    while ( (startEmbeddedContentLine = m_body.Find(sEudoraEmbeddedContentLines[i], PR_TRUE, startEmbeddedContentLine+1)) != kNotFound )
    {
      // Found this translation of "Embedded Content" - remember that so that we don't
      // bother looking for any other translations.
      foundEmbeddedContentLines = PR_TRUE;

      // Extract the file name from the embedded content line
      PRInt32   startFileName = startEmbeddedContentLine + lenEmbeddedContentTag;
      PRInt32   endFileName = m_body.Find(":", PR_FALSE, startFileName);
      nsString  fileName;
      m_body.Mid(fileName, startFileName, endFileName - startFileName);

      // Create the file spec for the embedded image
      embeddedFolderSpec->Clone(getter_AddRefs(embeddedImageSpec));
      embeddedImageSpec->Append(fileName);

      // Verify that the embedded image spec exists and is a file
      PRBool    isFile = PR_FALSE;
      PRBool    exists = PR_FALSE;
      if ( NS_FAILED(embeddedImageSpec->Exists( &exists)) || NS_FAILED(embeddedImageSpec->IsFile(&isFile)) )
        continue;
      if (!exists || !isFile)
        continue;

      // Extract CID hash from the embedded content line
      PRInt32     cidHashValue;
      PRInt32     startCIDHash = m_body.Find(",", PR_FALSE, endFileName);
      if (startCIDHash != kNotFound)
      {
        startCIDHash++;
        PRInt32   endCIDHash = m_body.Find(",", PR_FALSE, startCIDHash);

        if (endCIDHash != kNotFound)
        {
          nsString    cidHash;
          m_body.Mid(cidHash, startCIDHash, endCIDHash - startCIDHash);

          if ( !cidHash.IsEmpty() )
          {
            // Convert CID hash string to numeric value
            PRInt32   aErrorCode;
            cidHashValue = cidHash.ToInteger(&aErrorCode, kRadix16);
          }
        }
      }

      // Get the URL for the embedded image
      nsCString     embeddedImageURL;
      rv = NS_GetURLSpecFromFile(embeddedImageSpec, embeddedImageURL);
      NS_ENSURE_SUCCESS(rv, rv);

      // Create the embedded image node
      nsEudoraHTMLImageElement *         image = new nsEudoraHTMLImageElement(this, NS_ConvertASCIItoUTF16(embeddedImageURL), cidHashValue);

      nsCOMPtr<nsIDOMHTMLImageElement>   imageNode;
      image->QueryInterface( NS_GET_IID(nsIDOMHTMLImageElement), getter_AddRefs(imageNode) );

      // Append the embedded image node to the list
      (*aNodeList)->AppendElement(imageNode);

      PRInt32   endEmbeddedContentLine = m_body.Find("\r\n", PR_TRUE, startEmbeddedContentLine+1);
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

PRBool nsEudoraEditor::UpdateEmbeddedImageReference(PRUint32 aCIDHash, const nsAString & aOldRef, const nsAString & aUpdatedRef)
{
  PRBool    foundMatch = PR_FALSE;
  PRInt32   startImageTag = 0;
  PRInt32   closeImageTag = 0;

  while ( (startImageTag = m_body.Find("<img", PR_TRUE, closeImageTag)) != kNotFound )
  {
    closeImageTag = m_body.Find(">", PR_FALSE, startImageTag);

    // We should always find a close tag, bail if we don't
    if (closeImageTag == kNotFound)
      break;

    // Find the source attribute and make sure it's for our image tag
    PRInt32   startSrcValue = m_body.Find("src", PR_TRUE, startImageTag);
    if ( (startSrcValue == kNotFound) || (startSrcValue > closeImageTag) )
      continue;

    // Move past the src
    startSrcValue += 3;

    // Move past any whitespace
    while ( isspace(m_body.CharAt(startSrcValue)) )
      ++startSrcValue;

    // We should find an = now
    if (m_body.CharAt(startSrcValue) != '=')
      continue;

    // Move past =
    ++startSrcValue;

    // Move past any whitespace
    while ( isspace(m_body.CharAt(startSrcValue)) )
      ++startSrcValue;

    // Get the quote char and verify that it's valid
    char    quoteChar = static_cast <char> (m_body.CharAt(startSrcValue));
    if ( (quoteChar != '"') && (quoteChar != '\'') )
      continue;

    // Move past the quote
    ++startSrcValue;

    PRInt32   endSrcValue = m_body.Find(nsCString(quoteChar), PR_FALSE, startSrcValue);
    PRInt32   srcLength = endSrcValue - startSrcValue;

    nsString  srcValue;
    m_body.Mid(srcValue, startSrcValue, srcLength);

    if (aCIDHash != 0)
    {
      // Verify source value starts with "cid:"
      if ( !srcValue.EqualsIgnoreCase("cid:", 4) )
        continue;

      // Remove "cid:" from the start
      srcValue.Cut(0, 4);

      PRUint32  hashValue = EudoraHashString( NS_LossyConvertUTF16toASCII(srcValue).get() );
      foundMatch = (hashValue == aCIDHash);
    }
    else
    {
      foundMatch = srcValue.Equals(aOldRef);
    }

    if (foundMatch)
    {
      m_body.Replace(startSrcValue, srcLength, aUpdatedRef);
      break;
    }
  }

  return foundMatch;
}


PRBool nsEudoraEditor::HasEmbeddedContent()
{
  // Simple quick test to see if there's any embedded content lines
  PRBool   bHasEmbeddedContent = PR_FALSE;

  for (PRInt32 i = 0; *sEudoraEmbeddedContentLines[i] != '\0'; i++)
  {
    bHasEmbeddedContent = (m_body.Find(sEudoraEmbeddedContentLines[i], PR_TRUE, 0) != kNotFound);

    if (bHasEmbeddedContent)
      break;
  }

  return bHasEmbeddedContent;
}


nsEudoraHTMLImageElement::nsEudoraHTMLImageElement(nsEudoraEditor * pEditor, const nsAString & aSrc, PRUint32 aCIDHash)
  : m_pEditor(pEditor), m_src(aSrc), m_cidHash(aCIDHash)
{
  /* member initializers and constructor code */
}

nsEudoraHTMLImageElement::~nsEudoraHTMLImageElement()
{
  /* destructor code */
}


// readonly attribute DOMString nodeName
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNodeName(nsAString & aNodeName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// attribute DOMString nodeValue
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNodeValue(nsAString & aNodeValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
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


// readonly attribute nsIDOMNode nextSibling
NS_IMETHODIMP nsEudoraHTMLImageElement::GetNextSibling(nsIDOMNode * *aNextSibling)
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
NS_IMETHODIMP nsEudoraHTMLImageElement::HasChildNodes(PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// nsIDOMNode cloneNode (in boolean deep)
NS_IMETHODIMP nsEudoraHTMLImageElement::CloneNode(PRBool deep, nsIDOMNode **_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// void normalize ()
NS_IMETHODIMP nsEudoraHTMLImageElement::Normalize()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean isSupported (in DOMString feature, in DOMString version)
NS_IMETHODIMP nsEudoraHTMLImageElement::IsSupported(const nsAString & feature, const nsAString & version, PRBool *_retval)
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


NS_IMETHODIMP nsEudoraHTMLImageElement::SetPrefix(const nsAString & aPrefix)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// readonly attribute DOMString localName
NS_IMETHODIMP nsEudoraHTMLImageElement::GetLocalName(nsAString & aLocalName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean hasAttributes ()
NS_IMETHODIMP nsEudoraHTMLImageElement::HasAttributes(PRBool *_retval)
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
NS_IMETHODIMP nsEudoraHTMLImageElement::HasAttribute(const nsAString & name, PRBool *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


// boolean hasAttributeNS (in DOMString namespaceURI, in DOMString localName)
NS_IMETHODIMP nsEudoraHTMLImageElement::HasAttributeNS(const nsAString & namespaceURI, const nsAString & localName, PRBool *_retval)
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


// attribute DOMString alt
NS_IMETHODIMP nsEudoraHTMLImageElement::GetAlt(nsAString & aAlt)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetAlt(const nsAString & aAlt)
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
NS_IMETHODIMP nsEudoraHTMLImageElement::GetHeight(PRInt32 *aHeight)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetHeight(PRInt32 aHeight)
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
NS_IMETHODIMP nsEudoraHTMLImageElement::GetIsMap(PRBool *aIsMap)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetIsMap(PRBool aIsMap)
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


// attribute DOMString src
NS_IMETHODIMP nsEudoraHTMLImageElement::GetSrc(nsAString & aSrc)
{
  aSrc = m_src;

  return NS_OK;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetSrc(const nsAString & aSrc)
{
  nsEudoraEditor *    pEditor = static_cast <nsEudoraEditor *> (static_cast <nsIEditor *> (m_pEditor.get()));

  if ( pEditor->UpdateEmbeddedImageReference(m_cidHash, m_src, aSrc) )
    m_cidHash = 0;
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
NS_IMETHODIMP nsEudoraHTMLImageElement::GetWidth(PRInt32 *aWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsEudoraHTMLImageElement::SetWidth(PRInt32 aWidth)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
