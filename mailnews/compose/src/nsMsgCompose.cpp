/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgCompose.h"
#include "nsIScriptGlobalObject.h"
#include "nsIScriptContext.h"
#include "nsIDOMDocument.h"
#include "nsIDOMNode.h"
#include "nsIDOMNodeList.h"
#include "nsIDOMText.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIDOMHTMLLinkElement.h"
#include "nsIDOMHTMLAnchorElement.h"
#include "nsPIDOMWindow.h"
#include "nsISelectionController.h"
#include "nsMsgI18N.h"
#include "nsMsgCompCID.h"
#include "nsMsgQuote.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIDocumentEncoder.h"    // for editor output flags
#include "nsIMsgHeaderParser.h"
#include "nsMsgCompUtils.h"
#include "nsComposeStrings.h"
#include "nsIMsgSend.h"
#include "nsMailHeaders.h"
#include "nsMsgPrompts.h"
#include "nsMimeTypes.h"
#include "nsICharsetConverterManager.h"
#include "nsTextFormatter.h"
#include "nsIPlaintextEditor.h"
#include "nsIHTMLEditor.h"
#include "nsIEditorMailSupport.h"
#include "plstr.h"
#include "prmem.h"
#include "nsIDocShell.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsAbBaseCID.h"
#include "nsIAbMDBDirectory.h"
#include "nsCExternalHandlerService.h"
#include "nsIMIMEService.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDocShellTreeOwner.h"
#include "nsIWindowMediator.h"
#include "nsIURL.h"
#include "nsIMsgMailSession.h"
#include "nsMsgBaseCID.h"
#include "nsMsgMimeCID.h"
#include "nsDateTimeFormatCID.h"
#include "nsIDateTimeFormat.h"
#include "nsILocaleService.h"
#include "nsILocale.h"
#include "nsIMsgComposeService.h"
#include "nsIMsgComposeProgressParams.h"
#include "nsMsgUtils.h"
#include "nsIMsgImapMailFolder.h"
#include "nsImapCore.h"
#include "nsUnicharUtils.h"
#include "nsNetUtil.h"
#include "nsIContentViewer.h"
#include "nsIMarkupDocumentViewer.h"
#include "nsIMsgMdnGenerator.h"
#include "plbase64.h"
#include "nsUConvCID.h"
#include "nsIUnicodeNormalizer.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgProgress.h"
#include "nsMsgFolderFlags.h"
#include "nsIMsgDatabase.h"
#include "nsStringStream.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsIMsgWindow.h"
#include "nsITextToSubURI.h"
#include "nsIAbManager.h"
#include "nsCRT.h"
#include "mozilla/Services.h"

static void GetReplyHeaderInfo(int32_t* reply_header_type,
                               nsString& reply_header_locale,
                               nsString& reply_header_authorwrote,
                               nsString& reply_header_ondate,
                               nsString& reply_header_separator,
                               nsString& reply_header_colon,
                               nsString& reply_header_originalmessage)
{
  nsresult  rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));

  *reply_header_type = 1;
  if(NS_SUCCEEDED(rv)) {
    prefBranch->GetIntPref("mailnews.reply_header_type", reply_header_type);

    NS_GetUnicharPreferenceWithDefault(prefBranch, "mailnews.reply_header_locale", EmptyString(), reply_header_locale);
    NS_GetLocalizedUnicharPreferenceWithDefault(prefBranch, "mailnews.reply_header_authorwrote", NS_LITERAL_STRING("%s wrote"), reply_header_authorwrote);
    NS_GetLocalizedUnicharPreferenceWithDefault(prefBranch, "mailnews.reply_header_ondate", NS_LITERAL_STRING("On %s"), reply_header_ondate);
    NS_GetUnicharPreferenceWithDefault(prefBranch, "mailnews.reply_header_separator", NS_LITERAL_STRING(", "), reply_header_separator);
    NS_GetUnicharPreferenceWithDefault(prefBranch, "mailnews.reply_header_colon", NS_LITERAL_STRING(":"), reply_header_colon);
    NS_GetLocalizedUnicharPreferenceWithDefault(prefBranch, "mailnews.reply_header_originalmessage", NS_LITERAL_STRING("--- Original Message ---"), reply_header_originalmessage);
  }
}

static void TranslateLineEnding(nsString& data)
{
  PRUnichar* rPtr;   //Read pointer
  PRUnichar* wPtr;   //Write pointer
  PRUnichar* sPtr;   //Start data pointer
  PRUnichar* ePtr;   //End data pointer

  rPtr = wPtr = sPtr = data.BeginWriting();
  ePtr = rPtr + data.Length();

  while (rPtr < ePtr)
  {
    if (*rPtr == nsCRT::CR) {
      *wPtr = nsCRT::LF;
      if (rPtr + 1 < ePtr && *(rPtr + 1) == nsCRT::LF)
        rPtr ++;
    }
    else
      *wPtr = *rPtr;

    rPtr ++;
    wPtr ++;
  }

  data.SetLength(wPtr - sPtr);
}

static void GetTopmostMsgWindowCharacterSet(nsCString& charset, bool* charsetOverride)
{
  // HACK: if we are replying to a message and that message used a charset over ride
  // (as specified in the top most window (assuming the reply originated from that window)
  // then use that over ride charset instead of the charset specified in the message
  nsCOMPtr <nsIMsgMailSession> mailSession (do_GetService(NS_MSGMAILSESSION_CONTRACTID));
  if (mailSession)
  {
    nsCOMPtr<nsIMsgWindow>    msgWindow;
    mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
    if (msgWindow)
    {
      msgWindow->GetMailCharacterSet(charset);
      msgWindow->GetCharsetOverride(charsetOverride);
    }
  }
}

nsMsgCompose::nsMsgCompose()
{

  mQuotingToFollow = false;
  mInsertingQuotedContent = false;
  mWhatHolder = 1;
  m_window = nullptr;
  m_editor = nullptr;
  mQuoteStreamListener=nullptr;
  mCharsetOverride = false;
  mDeleteDraft = false;
  m_compFields = nullptr;    //m_compFields will be set during nsMsgCompose::Initialize
  mType = nsIMsgCompType::New;

  // For TagConvertible
  // Read and cache pref
  mConvertStructs = false;
  nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (prefBranch)
    prefBranch->GetBoolPref("converter.html2txt.structs", &mConvertStructs);

  m_composeHTML = false;
  mRecycledWindow = true;
}


nsMsgCompose::~nsMsgCompose()
{
  NS_IF_RELEASE(m_compFields);
  NS_IF_RELEASE(mQuoteStreamListener);
}

/* the following macro actually implement addref, release and query interface for our component. */
NS_IMPL_ISUPPORTS3(nsMsgCompose, nsIMsgCompose, nsIMsgSendListener,
  nsISupportsWeakReference)

//
// Once we are here, convert the data which we know to be UTF-8 to UTF-16
// for insertion into the editor
//
nsresult
GetChildOffset(nsIDOMNode *aChild, nsIDOMNode *aParent, int32_t &aOffset)
{
  NS_ASSERTION((aChild && aParent), "bad args");
  nsresult result = NS_ERROR_NULL_POINTER;
  if (aChild && aParent)
  {
    nsCOMPtr<nsIDOMNodeList> childNodes;
    result = aParent->GetChildNodes(getter_AddRefs(childNodes));
    if ((NS_SUCCEEDED(result)) && (childNodes))
    {
      int32_t i=0;
      for ( ; NS_SUCCEEDED(result); i++)
      {
        nsCOMPtr<nsIDOMNode> childNode;
        result = childNodes->Item(i, getter_AddRefs(childNode));
        if ((NS_SUCCEEDED(result)) && (childNode))
        {
          if (childNode.get()==aChild)
          {
            aOffset = i;
            break;
          }
        }
        else if (!childNode)
          result = NS_ERROR_NULL_POINTER;
      }
    }
    else if (!childNodes)
      result = NS_ERROR_NULL_POINTER;
  }
  return result;
}

nsresult
GetNodeLocation(nsIDOMNode *inChild, nsCOMPtr<nsIDOMNode> *outParent, int32_t *outOffset)
{
  NS_ASSERTION((outParent && outOffset), "bad args");
  nsresult result = NS_ERROR_NULL_POINTER;
  if (inChild && outParent && outOffset)
  {
    result = inChild->GetParentNode(getter_AddRefs(*outParent));
    if ( (NS_SUCCEEDED(result)) && (*outParent) )
    {
      result = GetChildOffset(inChild, *outParent, *outOffset);
    }
  }

  return result;
}

bool nsMsgCompose::IsEmbeddedObjectSafe(const char * originalScheme,
                                          const char * originalHost,
                                          const char * originalPath,
                                          nsIDOMNode * object)
{
  nsresult rv;

  nsCOMPtr<nsIDOMHTMLImageElement> image;
  nsCOMPtr<nsIDOMHTMLLinkElement> link;
  nsCOMPtr<nsIDOMHTMLAnchorElement> anchor;
  nsAutoString objURL;

  if (!object || !originalScheme || !originalPath) //having a null host is ok...
    return false;

  if ((image = do_QueryInterface(object)))
  {
    if (NS_FAILED(image->GetSrc(objURL)))
      return false;
  }
  else if ((link = do_QueryInterface(object)))
  {
    if (NS_FAILED(link->GetHref(objURL)))
      return false;
  }
  else if ((anchor = do_QueryInterface(object)))
  {
    if (NS_FAILED(anchor->GetHref(objURL)))
      return false;
  }
  else
    return false;

  if (!objURL.IsEmpty())
  {
    nsCOMPtr<nsIURI> uri;
    rv = NS_NewURI(getter_AddRefs(uri), objURL);
    if (NS_SUCCEEDED(rv) && uri)
    {
      nsAutoCString scheme;
      rv = uri->GetScheme(scheme);
      if (NS_SUCCEEDED(rv) && scheme.Equals(originalScheme, nsCaseInsensitiveCStringComparator()))
      {
        nsAutoCString host;
        rv = uri->GetAsciiHost(host);
        // mailbox url don't have a host therefore don't be too strict.
        if (NS_SUCCEEDED(rv) && (host.IsEmpty() || originalHost || host.Equals(originalHost, nsCaseInsensitiveCStringComparator())))
        {
          nsAutoCString path;
          rv = uri->GetPath(path);
          if (NS_SUCCEEDED(rv))
          {
            const char * query = strrchr(path.get(), '?');
            if (query && PL_strncasecmp(path.get(), originalPath, query - path.get()) == 0)
                return true; //This object is a part of the original message, we can send it safely.
          }
        }
      }
    }
  }

  return false;
}

/* Reset the uri's of embedded objects because we've saved the draft message, and the
   original message doesn't exist anymore.
 */
nsresult nsMsgCompose::ResetUrisForEmbeddedObjects()
{
  nsCOMPtr<nsISupportsArray> aNodeList;
  uint32_t numNodes;
  uint32_t i;

  nsCOMPtr<nsIEditorMailSupport> mailEditor (do_QueryInterface(m_editor));
  if (!mailEditor)
    return NS_ERROR_FAILURE;

  nsresult rv = mailEditor->GetEmbeddedObjects(getter_AddRefs(aNodeList));
  if ((NS_FAILED(rv) || (!aNodeList)))
    return NS_ERROR_FAILURE;

  if (NS_FAILED(aNodeList->Count(&numNodes)))
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIDOMNode> node;
  nsCString curDraftIdURL;

  rv = m_compFields->GetDraftId(getter_Copies(curDraftIdURL));

  // Skip if no draft id (probably a new draft msg).
  if (NS_SUCCEEDED(rv) && mMsgSend && !curDraftIdURL.IsEmpty())
  {
    nsCOMPtr <nsIMsgDBHdr> msgDBHdr;
    rv = GetMsgDBHdrFromURI(curDraftIdURL.get(), getter_AddRefs(msgDBHdr));
    NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't get msg header DB interface pointer.");
    if (NS_SUCCEEDED(rv) && msgDBHdr)
    {
      // build up the old and new ?number= parts. This code assumes it is
      // called *before* RemoveCurrentDraftMessage, so that curDraftIdURL
      // is the previous draft.
      // This code works for both imap and local messages.
      nsMsgKey newMsgKey;
      nsCString folderUri;
      nsCString baseMsgUri;
      mMsgSend->GetMessageKey(&newMsgKey);
      mMsgSend->GetFolderUri(folderUri);
      nsCOMPtr<nsIMsgFolder> folder;
      rv = GetExistingFolder(folderUri, getter_AddRefs(folder));
      NS_ENSURE_SUCCESS(rv, rv);
      folder->GetBaseMessageURI(baseMsgUri);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIDOMElement> domElement;
      for (i = 0; i < numNodes; i ++)
      {
        domElement = do_QueryElementAt(aNodeList, i);
        if (!domElement)
          continue;

        nsCOMPtr<nsIDOMHTMLImageElement> image = do_QueryInterface(domElement);
        if (!image)
          continue;
        nsCString partNum;
        mMsgSend->GetPartForDomIndex(i, partNum);
        // do we care about anything besides images?
        nsAutoString objURL;
        image->GetSrc(objURL);
        // the objURL is the full path to the embedded content. We need
        // to update it with uri for the folder we just saved to, and the new
        // msg key.
        int32_t restOfUrlIndex = objURL.Find("?number=");
        if (restOfUrlIndex == kNotFound)
          restOfUrlIndex = objURL.FindChar('?');
        else
          restOfUrlIndex = objURL.FindChar('&', restOfUrlIndex);

        if (restOfUrlIndex == kNotFound)
          continue;

        nsCString newURI(baseMsgUri);
        newURI.Append('#');
        newURI.AppendInt(newMsgKey);
        nsString restOfUrl(Substring(objURL, restOfUrlIndex, objURL.Length() - restOfUrlIndex));
        int32_t partIndex = restOfUrl.Find("part=");
        if (partIndex != kNotFound)
        {
          partIndex += 5;
          int32_t endPart = restOfUrl.FindChar('&', partIndex);
          int32_t existingPartLen = (endPart == kNotFound) ? -1 : endPart - partIndex;
          restOfUrl.Replace(partIndex, existingPartLen, NS_ConvertASCIItoUTF16(partNum));
        }

        nsCOMPtr<nsIMsgMessageService> msgService;
        rv = GetMessageServiceFromURI(newURI, getter_AddRefs(msgService));
        if (NS_FAILED(rv))
          continue;
        nsCOMPtr<nsIURI> newUrl;
        rv = msgService->GetUrlForUri(newURI.get(), getter_AddRefs(newUrl), nullptr);
        if (!newUrl)
          continue;
        nsCString spec;
        newUrl->GetSpec(spec);
        nsString newSrc;
        // mailbox urls will have ?number=xxx; imap urls won't. We need to
        // handle both cases because we may be going from a mailbox url to
        // and imap url, or vice versa, depending on the original folder,
        // and the destination drafts folder.
        bool specHasQ = (spec.FindChar('?') != kNotFound);
        if (specHasQ && restOfUrl.CharAt(0) == '?')
          restOfUrl.SetCharAt('&', 0);
        else if (!specHasQ && restOfUrl.CharAt(0) == '&')
          restOfUrl.SetCharAt('?', 0);
        AppendUTF8toUTF16(spec, newSrc);
        newSrc.Append(restOfUrl);
        image->SetSrc(newSrc);
      }
    }
  }

  return NS_OK;
}


/* The purpose of this function is to mark any embedded object that wasn't a RFC822 part
   of the original message as moz-do-not-send.
   That will prevent us to attach data not specified by the user or not present in the
   original message.
*/
nsresult nsMsgCompose::TagEmbeddedObjects(nsIEditorMailSupport *aEditor)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsISupportsArray> aNodeList;
  uint32_t count;
  uint32_t i;

  if (!aEditor)
    return NS_ERROR_FAILURE;

  rv = aEditor->GetEmbeddedObjects(getter_AddRefs(aNodeList));
  if ((NS_FAILED(rv) || (!aNodeList)))
    return NS_ERROR_FAILURE;

  if (NS_FAILED(aNodeList->Count(&count)))
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIDOMNode> node;

  nsCOMPtr<nsIURI> originalUrl;
  nsCString originalScheme;
  nsCString originalHost;
  nsCString originalPath;

  // first, convert the rdf original msg uri into a url that represents the message...
  nsCOMPtr <nsIMsgMessageService> msgService;
  rv = GetMessageServiceFromURI(mOriginalMsgURI, getter_AddRefs(msgService));
  if (NS_SUCCEEDED(rv))
  {
    rv = msgService->GetUrlForUri(mOriginalMsgURI.get(), getter_AddRefs(originalUrl), nullptr);
    if (NS_SUCCEEDED(rv) && originalUrl)
    {
      originalUrl->GetScheme(originalScheme);
      originalUrl->GetAsciiHost(originalHost);
      originalUrl->GetPath(originalPath);
    }
  }

  // Then compare the url of each embedded objects with the original message.
  // If they a not coming from the original message, they should not be sent
  // with the message.
  nsCOMPtr<nsIDOMElement> domElement;
  for (i = 0; i < count; i ++)
  {
    node = do_QueryElementAt(aNodeList, i);
    if (!node)
      continue;
    if (IsEmbeddedObjectSafe(originalScheme.get(), originalHost.get(),
                             originalPath.get(), node))
      continue; //Don't need to tag this object, it safe to send it.

    //The source of this object should not be sent with the message
    domElement = do_QueryInterface(node);
    if (domElement)
      domElement->SetAttribute(NS_LITERAL_STRING("moz-do-not-send"), NS_LITERAL_STRING("true"));
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompose::GetInsertingQuotedContent(bool * aInsertingQuotedText)
{
  NS_ENSURE_ARG_POINTER(aInsertingQuotedText);
  *aInsertingQuotedText = mInsertingQuotedContent;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompose::SetInsertingQuotedContent(bool aInsertingQuotedText)
{
  mInsertingQuotedContent = aInsertingQuotedText;
  return NS_OK;
}

void
nsMsgCompose::InsertDivWrappedTextAtSelection(const nsAString &aText,
                                              const nsAString &classStr)
{
  NS_ASSERTION(m_editor, "InsertDivWrappedTextAtSelection called, but no editor exists\n");
  if (!m_editor)
    return;

  nsCOMPtr<nsIDOMElement> divElem;
  nsCOMPtr<nsIHTMLEditor> htmlEditor(do_QueryInterface(m_editor));
  nsCOMPtr<nsIPlaintextEditor> textEditor(do_QueryInterface(m_editor));

  nsresult rv = htmlEditor->CreateElementWithDefaults(NS_LITERAL_STRING("div"),
                                                      getter_AddRefs(divElem));

  NS_ENSURE_SUCCESS_VOID(rv);

  nsCOMPtr<nsIDOMNode> divNode (do_QueryInterface(divElem));

  // We need the document
  nsCOMPtr<nsIDOMDocument> doc;
  rv = m_editor->GetDocument(getter_AddRefs(doc));
  NS_ENSURE_SUCCESS_VOID(rv);

  // Break up the text by newlines, and then insert text nodes followed
  // by <br> nodes.
  int32_t start = 0;
  int32_t end = aText.Length();

  for (;;)
  {
    int32_t delimiter = aText.FindChar('\n', start);
    if (delimiter == kNotFound)
      delimiter = end;

    nsCOMPtr<nsIDOMText> textNode;
    rv = doc->CreateTextNode(Substring(aText, start, delimiter - start), getter_AddRefs(textNode));
    NS_ENSURE_SUCCESS_VOID(rv);

    nsCOMPtr<nsIDOMNode> newTextNode = do_QueryInterface(textNode);
    nsCOMPtr<nsIDOMNode> resultNode;
    rv = divElem->AppendChild(newTextNode, getter_AddRefs(resultNode));
    NS_ENSURE_SUCCESS_VOID(rv);

    // Now create and insert a BR
    nsCOMPtr<nsIDOMElement> brElem;
    rv = htmlEditor->CreateElementWithDefaults(NS_LITERAL_STRING("br"),
                                               getter_AddRefs(brElem));
    rv = divElem->AppendChild(brElem, getter_AddRefs(resultNode));
    NS_ENSURE_SUCCESS_VOID(rv);

    if (delimiter == end)
      break;
    start = ++delimiter;
    if (start == end)
      break;
  }

  htmlEditor->InsertElementAtSelection(divElem, true);
  nsCOMPtr<nsIDOMNode> parent;
  int32_t offset;

  rv = GetNodeLocation(divNode, address_of(parent), &offset);
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISelection> selection;
    m_editor->GetSelection(getter_AddRefs(selection));

    if (selection)
      selection->Collapse(parent, offset + 1);
  }
  if (divElem)
    divElem->SetAttribute(NS_LITERAL_STRING("class"), classStr);
}

NS_IMETHODIMP
nsMsgCompose::ConvertAndLoadComposeWindow(nsString& aPrefix,
                                          nsString& aBuf,
                                          nsString& aSignature,
                                          bool aQuoted,
                                          bool aHTMLEditor)
{
  NS_ASSERTION(m_editor, "ConvertAndLoadComposeWindow but no editor\n");
  NS_ENSURE_TRUE(m_editor && m_identity, NS_ERROR_NOT_INITIALIZED);

  // First, get the nsIEditor interface for future use
  nsCOMPtr<nsIDOMNode> nodeInserted;

  TranslateLineEnding(aPrefix);
  TranslateLineEnding(aBuf);
  TranslateLineEnding(aSignature);

  // We're going to be inserting stuff, and MsgComposeCommands
  // may have set the editor to readonly in the recycled case.
  // So set it back to writable.
  // Note!  enableEditableFields in gComposeRecyclingListener::onReopen
  // will redundantly set this flag to writable, but it gets there
  // too late.
  uint32_t flags = 0;
  m_editor->GetFlags(&flags);
  flags &= ~nsIPlaintextEditor::eEditorReadonlyMask;
  m_editor->SetFlags(flags);

  m_editor->EnableUndo(false);

  // Ok - now we need to figure out the charset of the aBuf we are going to send
  // into the editor shell. There are I18N calls to sniff the data and then we need
  // to call the new routine in the editor that will allow us to send in the charset
  //

  // Now, insert it into the editor...
  nsCOMPtr<nsIHTMLEditor> htmlEditor (do_QueryInterface(m_editor));
  nsCOMPtr<nsIPlaintextEditor> textEditor (do_QueryInterface(m_editor));
  nsCOMPtr<nsIEditorMailSupport> mailEditor (do_QueryInterface(m_editor));
  int32_t reply_on_top = 0;
  bool sig_bottom = true;
  m_identity->GetReplyOnTop(&reply_on_top);
  m_identity->GetSigBottom(&sig_bottom);
  bool sigOnTop = (reply_on_top == 1 && !sig_bottom);
  bool isForwarded = (mType == nsIMsgCompType::ForwardInline);

  if (aQuoted)
  {
    mInsertingQuotedContent = true;
    if (!aPrefix.IsEmpty())
    {
      if (!aHTMLEditor)
        aPrefix.AppendLiteral("\n");

      int32_t reply_on_top = 0;
      m_identity->GetReplyOnTop(&reply_on_top);
      if (reply_on_top == 1)
      {
        // add one newline if a signature comes before the quote, two otherwise
        bool includeSignature = true;
        bool sig_bottom = true;
        bool attachFile = false;
        nsString prefSigText;

        m_identity->GetSigOnReply(&includeSignature);
        m_identity->GetSigBottom(&sig_bottom);
        m_identity->GetHtmlSigText(prefSigText);
        nsresult rv = m_identity->GetAttachSignature(&attachFile);
        if (includeSignature && !sig_bottom &&
            ((NS_SUCCEEDED(rv) && attachFile) || !prefSigText.IsEmpty()))
          textEditor->InsertLineBreak();
        else {
          textEditor->InsertLineBreak();
          textEditor->InsertLineBreak();
        }
      }

      InsertDivWrappedTextAtSelection(aPrefix,
                                      NS_LITERAL_STRING("moz-cite-prefix"));
    }

    if (!aBuf.IsEmpty() && mailEditor)
    {
      // This leaves the caret at the right place to insert a bottom signature.
      if (aHTMLEditor && !mCiteReference.IsEmpty())
        mailEditor->InsertAsCitedQuotation(aBuf,
                                           mCiteReference,
                                           true,
                                           getter_AddRefs(nodeInserted));
      else
        mailEditor->InsertAsQuotation(aBuf,
                                      getter_AddRefs(nodeInserted));

    }

    mInsertingQuotedContent = false;

    (void)TagEmbeddedObjects(mailEditor);

    if (!aSignature.IsEmpty())
    {
      //we cannot add it on top earlier, because TagEmbeddedObjects will mark all images in the signature as "moz-do-not-send"
      if( sigOnTop )
        m_editor->BeginningOfDocument();

      if (aHTMLEditor && htmlEditor)
        htmlEditor->InsertHTML(aSignature);
      else if (htmlEditor)
      {
        textEditor->InsertLineBreak();
        InsertDivWrappedTextAtSelection(aSignature,
                                        NS_LITERAL_STRING("moz-signature"));
      }

      if( sigOnTop )
        m_editor->EndOfDocument();
    }
  }
  else
  {
    if (aHTMLEditor && htmlEditor)
    {
      mInsertingQuotedContent = true;
      htmlEditor->RebuildDocumentFromSource(aBuf);
      mInsertingQuotedContent = false;

      // when forwarding a message as inline, tag any embedded objects
      // which refer to local images or files so we know not to include
      // send them
      if (isForwarded)
        (void)TagEmbeddedObjects(mailEditor);

      if (!aSignature.IsEmpty())
      {
        if (isForwarded && sigOnTop)
          m_editor->BeginningOfDocument();
        else
          m_editor->EndOfDocument();
        htmlEditor->InsertHTML(aSignature);
        if (isForwarded && sigOnTop)
          m_editor->EndOfDocument();
      }
      else
        m_editor->EndOfDocument();
    }
    else if (htmlEditor)
    {
      if (isForwarded && sigOnTop && !aSignature.IsEmpty())
      {
        textEditor->InsertLineBreak();
        InsertDivWrappedTextAtSelection(aSignature,
                                        NS_LITERAL_STRING("moz-signature"));
        m_editor->EndOfDocument();
      }

      if (!aBuf.IsEmpty())
      {
        if (mailEditor)
          mailEditor->InsertTextWithQuotations(aBuf);
        else
          textEditor->InsertText(aBuf);
        m_editor->EndOfDocument();
      }

      if ((!isForwarded || !sigOnTop) && !aSignature.IsEmpty()) {
        textEditor->InsertLineBreak();
        InsertDivWrappedTextAtSelection(aSignature,
                                        NS_LITERAL_STRING("moz-signature"));
      }
    }
  }

  if (aBuf.IsEmpty())
    m_editor->BeginningOfDocument();
  else
  {
    switch (reply_on_top)
    {
      // This should set the cursor after the body but before the sig
      case 0:
      {
        if (!textEditor)
        {
          m_editor->BeginningOfDocument();
          break;
        }

        nsCOMPtr<nsISelection> selection = nullptr;
        nsCOMPtr<nsIDOMNode>      parent = nullptr;
        int32_t                   offset;
        nsresult                  rv;

        // get parent and offset of mailcite
        rv = GetNodeLocation(nodeInserted, address_of(parent), &offset);
        if (NS_FAILED(rv) || (!parent))
        {
          m_editor->BeginningOfDocument();
          break;
        }

        // get selection
        m_editor->GetSelection(getter_AddRefs(selection));
        if (!selection)
        {
          m_editor->BeginningOfDocument();
          break;
        }

        // place selection after mailcite
        selection->Collapse(parent, offset+1);

        // insert a break at current selection
        textEditor->InsertLineBreak();

        // i'm not sure if you need to move the selection back to before the
        // break. expirement.
        selection->Collapse(parent, offset+1);

        break;
      }

      case 2:
      {
        m_editor->SelectAll();
        break;
      }

      // This should set the cursor to the top!
      default:
      {
        m_editor->BeginningOfDocument();
        break;
      }
    }
  }

  nsCOMPtr<nsISelectionController> selCon;
  m_editor->GetSelectionController(getter_AddRefs(selCon));

  if (selCon)
    selCon->ScrollSelectionIntoView(nsISelectionController::SELECTION_NORMAL, nsISelectionController::SELECTION_ANCHOR_REGION, true);

  m_editor->EnableUndo(true);
  SetBodyModified(false);

#ifdef MSGCOMP_TRACE_PERFORMANCE
  nsCOMPtr<nsIMsgComposeService> composeService (do_GetService(NS_MSGCOMPOSESERVICE_CONTRACTID));
  composeService->TimeStamp("Finished inserting data into the editor. The window is finally ready!", false);
#endif
  return NS_OK;
}

/**
 * Check the identity pref to include signature on replies and forwards.
 */
bool nsMsgCompose::CheckIncludeSignaturePrefs(nsIMsgIdentity *identity)
{
  bool includeSignature = true;
  switch (mType)
  {
    case nsIMsgCompType::ForwardInline:
    case nsIMsgCompType::ForwardAsAttachment:
      identity->GetSigOnForward(&includeSignature);
      break;
    case nsIMsgCompType::Reply:
    case nsIMsgCompType::ReplyAll:
    case nsIMsgCompType::ReplyToList:
    case nsIMsgCompType::ReplyToGroup:
    case nsIMsgCompType::ReplyToSender:
    case nsIMsgCompType::ReplyToSenderAndGroup:
      identity->GetSigOnReply(&includeSignature);
      break;
  }
  return includeSignature;
}

nsresult
nsMsgCompose::SetQuotingToFollow(bool aVal)
{
  mQuotingToFollow = aVal;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompose::GetQuotingToFollow(bool* quotingToFollow)
{
  NS_ENSURE_ARG(quotingToFollow);
  *quotingToFollow = mQuotingToFollow;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompose::Initialize(nsIMsgComposeParams *aParams,
                         nsIDOMWindow *aWindow,
                         nsIDocShell *aDocShell)
{
  NS_ENSURE_ARG_POINTER(aParams);
  nsresult rv;

  aParams->GetIdentity(getter_AddRefs(m_identity));

  if (aWindow)
  {
    m_window = aWindow;
    nsCOMPtr<nsPIDOMWindow> window(do_QueryInterface(aWindow));
    if (!window)
      return NS_ERROR_FAILURE;

    nsCOMPtr<nsIDocShellTreeItem>  treeItem =
      do_QueryInterface(window->GetDocShell());
    nsCOMPtr<nsIDocShellTreeOwner> treeOwner;
    rv = treeItem->GetTreeOwner(getter_AddRefs(treeOwner));
    if (NS_FAILED(rv)) return rv;

    m_baseWindow = do_QueryInterface(treeOwner);

    window->GetDocShell()->SetAppType(nsIDocShell::APP_TYPE_EDITOR);
  }

  MSG_ComposeFormat format;
  aParams->GetFormat(&format);

  MSG_ComposeType type;
  aParams->GetType(&type);

  nsCString originalMsgURI;
  aParams->GetOriginalMsgURI(getter_Copies(originalMsgURI));
  aParams->GetOrigMsgHdr(getter_AddRefs(mOrigMsgHdr));

  nsCOMPtr<nsIMsgCompFields> composeFields;
  aParams->GetComposeFields(getter_AddRefs(composeFields));

  nsCOMPtr<nsIMsgComposeService> composeService = do_GetService(NS_MSGCOMPOSESERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = composeService->DetermineComposeHTML(m_identity, format, &m_composeHTML);
  NS_ENSURE_SUCCESS(rv,rv);

  if (composeFields)
  {
    nsAutoCString draftId; // will get set for drafts and templates
    rv = composeFields->GetDraftId(getter_Copies(draftId));
    NS_ENSURE_SUCCESS(rv,rv);

    // Set return receipt flag and type, and if we should attach a vCard
    // by checking the identity prefs - but don't clobber the values for
    // drafts and templates as they were set up already by mime when
    // initializing the message.
    if (m_identity && draftId.IsEmpty())
    {
      bool requestReturnReceipt = false;
      rv = m_identity->GetRequestReturnReceipt(&requestReturnReceipt);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = composeFields->SetReturnReceipt(requestReturnReceipt);
      NS_ENSURE_SUCCESS(rv, rv);

      int32_t receiptType = nsIMsgMdnGenerator::eDntType;
      rv = m_identity->GetReceiptHeaderType(&receiptType);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = composeFields->SetReceiptHeaderType(receiptType);
      NS_ENSURE_SUCCESS(rv, rv);

      bool requestDSN = false;
      rv = m_identity->GetRequestDSN(&requestDSN);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = composeFields->SetDSN(requestDSN);
      NS_ENSURE_SUCCESS(rv, rv);

      bool attachVCard;
      rv = m_identity->GetAttachVCard(&attachVCard);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = composeFields->SetAttachVCard(attachVCard);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }

  nsCOMPtr<nsIMsgSendListener> externalSendListener;
  aParams->GetSendListener(getter_AddRefs(externalSendListener));
  if(externalSendListener)
    AddMsgSendListener( externalSendListener );

  nsCString smtpPassword;
  aParams->GetSmtpPassword(getter_Copies(smtpPassword));
  mSmtpPassword = smtpPassword;

  aParams->GetHtmlToQuote(mHtmlToQuote);

  if (aDocShell)
  {
    mDocShell = aDocShell;
    // register the compose object with the compose service
    rv = composeService->RegisterComposeDocShell(aDocShell, this);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  return CreateMessage(originalMsgURI.get(), type, composeFields);
}

nsresult nsMsgCompose::SetDocumentCharset(const char *aCharset)
{
  NS_ENSURE_TRUE(m_compFields && m_editor, NS_ERROR_NOT_INITIALIZED);

  // Set charset, this will be used for the MIME charset labeling.
  m_compFields->SetCharacterSet(aCharset);

  // notify the change to editor
  nsCString charset;
  if (aCharset)
    charset = nsDependentCString(aCharset);
  if (m_editor)
    m_editor->SetDocumentCharacterSet(charset);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompose::RegisterStateListener(nsIMsgComposeStateListener *aStateListener)
{
  NS_ENSURE_ARG_POINTER(aStateListener);

  return mStateListeners.AppendElement(aStateListener) ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsMsgCompose::UnregisterStateListener(nsIMsgComposeStateListener *aStateListener)
{
  NS_ENSURE_ARG_POINTER(aStateListener);

  int32_t index = mStateListeners.IndexOf(aStateListener);
  if (index == -1)
    return NS_ERROR_FAILURE;

  return mStateListeners.RemoveElement(aStateListener) ? NS_OK : NS_ERROR_FAILURE;
}

// Added to allow easier use of the nsIMsgSendListener
NS_IMETHODIMP nsMsgCompose::AddMsgSendListener( nsIMsgSendListener *aMsgSendListener )
{
  NS_ENSURE_ARG_POINTER(aMsgSendListener);
  return mExternalSendListeners.AppendElement(aMsgSendListener) ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgCompose::RemoveMsgSendListener( nsIMsgSendListener *aMsgSendListener )
{
  NS_ENSURE_ARG_POINTER(aMsgSendListener);
  return mExternalSendListeners.RemoveElement(aMsgSendListener) ? NS_OK : NS_ERROR_FAILURE;
}

nsresult nsMsgCompose::_SendMsg(MSG_DeliverMode deliverMode, nsIMsgIdentity *identity,
                                const char *accountKey, bool entityConversionDone)
{
  nsresult rv = NS_OK;

  // clear saved message id if sending, so we don't send out the same message-id.
  if (deliverMode == nsIMsgCompDeliverMode::Now ||
      deliverMode == nsIMsgCompDeliverMode::Later ||
      deliverMode == nsIMsgCompDeliverMode::Background)
    m_compFields->SetMessageId("");

  if (m_compFields && identity)
  {
    // Pref values are supposed to be stored as UTF-8, so no conversion
    nsCString email;
    nsString fullName;
    nsString organization;

    identity->GetEmail(email);
    identity->GetFullName(fullName);
    identity->GetOrganization(organization);

    nsCString sender;
    nsCOMPtr<nsIMsgHeaderParser> parser (do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID));
    if (parser) {
      // convert to UTF8 before passing to MakeFullAddressString
      parser->MakeFullAddressString(NS_ConvertUTF16toUTF8(fullName).get(),
                                    email.get(), getter_Copies(sender));
    }

    m_compFields->SetFrom(sender.IsEmpty() ? email.get() : sender.get());
    m_compFields->SetOrganization(organization);
    mMsgSend = do_CreateInstance(NS_MSGSEND_CONTRACTID);
    if (mMsgSend)
    {
      nsCString bodyString(m_compFields->GetBody());
      const char  attachment1_type[] = TEXT_HTML;  // we better be "text/html" at this point

      if (!entityConversionDone)
      {
        // Convert body to mail charset
        nsAutoCString outCString;

        if (!bodyString.IsEmpty())
        {
          // Apply entity conversion then convert to a mail charset.
          bool isAsciiOnly;
          rv = nsMsgI18NSaveAsCharset(attachment1_type, m_compFields->GetCharacterSet(),
                                      NS_ConvertUTF8toUTF16(bodyString).get(),
                                      getter_Copies(outCString),
                                      nullptr, &isAsciiOnly);
          if (NS_SUCCEEDED(rv))
          {
            if (m_compFields->GetForceMsgEncoding())
              isAsciiOnly = false;

            m_compFields->SetBodyIsAsciiOnly(isAsciiOnly);
            bodyString = outCString;
          }
        }
      }

      // Create the listener for the send operation...
      nsCOMPtr<nsIMsgComposeSendListener> composeSendListener = do_CreateInstance(NS_MSGCOMPOSESENDLISTENER_CONTRACTID);
      if (!composeSendListener)
        return NS_ERROR_OUT_OF_MEMORY;

      // right now, AutoSaveAsDraft is identical to SaveAsDraft as
      // far as the msg send code is concerned. This way, we don't have
      // to add an nsMsgDeliverMode for autosaveasdraft, and add cases for
      // it in the msg send code.
      if (deliverMode == nsIMsgCompDeliverMode::AutoSaveAsDraft)
        deliverMode = nsIMsgCompDeliverMode::SaveAsDraft;

      nsRefPtr<nsIMsgCompose> msgCompose(this);
      composeSendListener->SetMsgCompose(msgCompose);
      composeSendListener->SetDeliverMode(deliverMode);

      if (mProgress)
      {
        nsCOMPtr<nsIWebProgressListener> progressListener = do_QueryInterface(composeSendListener);
        mProgress->RegisterListener(progressListener);
      }

      // If we are composing HTML, then this should be sent as
      // multipart/related which means we pass the editor into the
      // backend...if not, just pass nullptr
      //
      nsCOMPtr<nsIMsgSendListener> sendListener = do_QueryInterface(composeSendListener);
      rv = mMsgSend->CreateAndSendMessage(
                    m_composeHTML ? m_editor.get() : nullptr,
                    identity,
                    accountKey,
                    m_compFields,
                    false,
                    false,
                    (nsMsgDeliverMode)deliverMode,
                    nullptr,
                    m_composeHTML ? TEXT_HTML : TEXT_PLAIN,
                    bodyString,
                    nullptr,
                    nullptr,
                    m_window,
                    mProgress,
                    sendListener,
                    mSmtpPassword.get(),
                    mOriginalMsgURI,
                    mType);
    }
    else
        rv = NS_ERROR_FAILURE;
  }
  else
    rv = NS_ERROR_NOT_INITIALIZED;

  if (NS_FAILED(rv))
    NotifyStateListeners(nsIMsgComposeNotificationType::ComposeProcessDone, rv);

  return rv;
}

NS_IMETHODIMP nsMsgCompose::SendMsg(MSG_DeliverMode deliverMode, nsIMsgIdentity *identity, const char *accountKey, nsIMsgWindow *aMsgWindow, nsIMsgProgress *progress)
{
  nsresult rv = NS_OK;
  bool entityConversionDone = false;
  nsCOMPtr<nsIPrompt> prompt;

  // i'm assuming the compose window is still up at this point...
  if (!prompt && m_window)
     m_window->GetPrompter(getter_AddRefs(prompt));

  if (m_compFields && !m_composeHTML)
  {
    // The plain text compose window was used
    const char contentType[] = "text/plain";
    nsString msgBody;
    uint32_t flags = nsIDocumentEncoder::OutputFormatted | nsIDocumentEncoder::OutputCRLineBreak |
      nsIDocumentEncoder::OutputLFLineBreak;
    if (m_editor)
    {
      // Reset message body previously stored in the compose fields
      // There is 2 nsIMsgCompFields::SetBody() functions using a pointer as argument,
      // therefore a casting is required.
      m_compFields->SetBody((const char *)nullptr);

      const char *charset = m_compFields->GetCharacterSet();
      if(UseFormatFlowed(charset))
          flags |= nsIDocumentEncoder::OutputFormatFlowed;

      rv = m_editor->OutputToString(NS_LITERAL_STRING("text/plain"), flags, msgBody);
    }
    else
    {
      m_compFields->GetBody(msgBody);
    }
    if (NS_SUCCEEDED(rv) && !msgBody.IsEmpty())
    {
      // Convert body to mail charset
      nsCString outCString;
      nsCString fallbackCharset;
      bool isAsciiOnly;
      // check if the body text is covered by the current charset.
      rv = nsMsgI18NSaveAsCharset(contentType, m_compFields->GetCharacterSet(),
                                  msgBody.get(), getter_Copies(outCString),
                                  getter_Copies(fallbackCharset), &isAsciiOnly);
      if (m_compFields->GetForceMsgEncoding())
        isAsciiOnly = false;
      if (NS_SUCCEEDED(rv) && !outCString.IsEmpty())
      {
        // If the body contains characters outside the repertoire of the current
        // charset, just convert to UTF-8 and be done with it
        // unless disable_fallback_to_utf8 is set for this charset.
        if (NS_ERROR_UENC_NOMAPPING == rv && m_editor)
        {
          bool needToCheckCharset;
          m_compFields->GetNeedToCheckCharset(&needToCheckCharset);
          if (needToCheckCharset)
          {
            bool disableFallback = false;
            nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
            if (prefBranch)
            {
              nsCString prefName("mailnews.disable_fallback_to_utf8.");
              prefName.Append(m_compFields->GetCharacterSet());
              prefBranch->GetBoolPref(prefName.get(), &disableFallback);
            }
            if (!disableFallback)
            {
              CopyUTF16toUTF8(msgBody, outCString);
              m_compFields->SetCharacterSet("UTF-8");
            }
          }
        }
        else if (!fallbackCharset.IsEmpty())
        {
          // re-label to the fallback charset
          m_compFields->SetCharacterSet(fallbackCharset.get());
        }
        m_compFields->SetBodyIsAsciiOnly(isAsciiOnly);
        m_compFields->SetBody(outCString.get());
        entityConversionDone = true;
      }
      else
        m_compFields->SetBody(NS_LossyConvertUTF16toASCII(msgBody).get());
    }
  }

  // Let's open the progress dialog
  if (progress)
  {
    mProgress = progress;

    if (deliverMode != nsIMsgCompDeliverMode::AutoSaveAsDraft)
    {
      nsAutoString msgSubject;
      m_compFields->GetSubject(msgSubject);

      bool showProgress = false;
      nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID));
      if (prefBranch)
      {
        prefBranch->GetBoolPref("mailnews.show_send_progress", &showProgress);
        if (showProgress)
        {
          nsCOMPtr<nsIMsgComposeProgressParams> params = do_CreateInstance(NS_MSGCOMPOSEPROGRESSPARAMS_CONTRACTID, &rv);
          if (NS_FAILED(rv) || !params)
            return NS_ERROR_FAILURE;

          params->SetSubject(msgSubject.get());
          params->SetDeliveryMode(deliverMode);

          mProgress->OpenProgressDialog(m_window, aMsgWindow,
                                        "chrome://messenger/content/messengercompose/sendProgress.xul",
                                        false, params);
        }
      }
    }

    mProgress->OnStateChange(nullptr, nullptr, nsIWebProgressListener::STATE_START, NS_OK);
  }

  bool attachVCard = false;
  if (m_compFields)
      m_compFields->GetAttachVCard(&attachVCard);

  if (attachVCard && identity &&
      (deliverMode == nsIMsgCompDeliverMode::Now ||
       deliverMode == nsIMsgCompDeliverMode::Later ||
       deliverMode == nsIMsgCompDeliverMode::Background))
  {
      nsCString escapedVCard;
      // make sure, if there is no card, this returns an empty string, or NS_ERROR_FAILURE
      rv = identity->GetEscapedVCard(escapedVCard);

      if (NS_SUCCEEDED(rv) && !escapedVCard.IsEmpty())
      {
          nsCString vCardUrl;
          vCardUrl = "data:text/x-vcard;charset=utf-8;base64,";
          nsCString unescapedData;
          MsgUnescapeString(escapedVCard, 0, unescapedData);
          char *result = PL_Base64Encode(unescapedData.get(), 0, nullptr);
          vCardUrl += result;
          PR_Free(result);

          nsCOMPtr<nsIMsgAttachment> attachment = do_CreateInstance(NS_MSGATTACHMENT_CONTRACTID, &rv);
          if (NS_SUCCEEDED(rv) && attachment)
          {
              // [comment from 4.x]
              // Send the vCard out with a filename which distinguishes this user. e.g. jsmith.vcf
              // The main reason to do this is for interop with Eudora, which saves off
              // the attachments separately from the message body
              nsCString userid;
              (void)identity->GetEmail(userid);
              int32_t index = userid.FindChar('@');
              if (index != kNotFound)
                  userid.SetLength(index);

              if (userid.IsEmpty())
                  attachment->SetName(NS_LITERAL_STRING("vcard.vcf"));
              else
              {
                  // Replace any dot with underscore to stop vCards
                  // generating false positives with some heuristic scanners
                  MsgReplaceChar(userid, '.', '_');
                  userid.AppendLiteral(".vcf");
                  attachment->SetName(NS_ConvertASCIItoUTF16(userid));
              }

              attachment->SetUrl(vCardUrl);
              m_compFields->AddAttachment(attachment);
          }
      }
  }

  // Save the identity being sent for later use.
  m_identity = identity;

  rv = _SendMsg(deliverMode, identity, accountKey, entityConversionDone);
  if (NS_FAILED(rv))
  {
    nsCOMPtr<nsIMsgSendReport> sendReport;
    if (mMsgSend)
      mMsgSend->GetSendReport(getter_AddRefs(sendReport));
    if (sendReport)
    {
      nsresult theError;
      sendReport->DisplayReport(prompt, true, true, &theError);
    }
    else
    {
      /* If we come here it's because we got an error before we could intialize a
         send report! Let's try our best...
      */
      switch (deliverMode)
      {
        case nsIMsgCompDeliverMode::Later:
          nsMsgDisplayMessageByID(prompt, NS_MSG_UNABLE_TO_SEND_LATER);
          break;
        case nsIMsgCompDeliverMode::AutoSaveAsDraft:
        case nsIMsgCompDeliverMode::SaveAsDraft:
          nsMsgDisplayMessageByID(prompt, NS_MSG_UNABLE_TO_SAVE_DRAFT);
          break;
        case nsIMsgCompDeliverMode::SaveAsTemplate:
          nsMsgDisplayMessageByID(prompt, NS_MSG_UNABLE_TO_SAVE_TEMPLATE);
          break;

        default:
          nsMsgDisplayMessageByID(prompt, NS_ERROR_SEND_FAILED);
          break;
      }
    }

    if (progress)
      progress->CloseProgressDialog(true);
  }

  return rv;
}

// XXX when do we break this ref to the listener?
NS_IMETHODIMP nsMsgCompose::SetRecyclingListener(nsIMsgComposeRecyclingListener *aRecyclingListener)
{
  mRecyclingListener = aRecyclingListener;
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::GetRecyclingListener(nsIMsgComposeRecyclingListener **aRecyclingListener)
{
  NS_ENSURE_ARG_POINTER(aRecyclingListener);
  *aRecyclingListener = mRecyclingListener;
  NS_IF_ADDREF(*aRecyclingListener);
  return NS_OK;
}

/* attribute boolean recycledWindow; */
NS_IMETHODIMP nsMsgCompose::GetRecycledWindow(bool *aRecycledWindow)
{
  NS_ENSURE_ARG_POINTER(aRecycledWindow);
  *aRecycledWindow = mRecycledWindow;
  return NS_OK;
}
NS_IMETHODIMP nsMsgCompose::SetRecycledWindow(bool aRecycledWindow)
{
  mRecycledWindow = aRecycledWindow;
  return NS_OK;
}

/* attribute boolean deleteDraft */
NS_IMETHODIMP nsMsgCompose::GetDeleteDraft(bool *aDeleteDraft)
{
  NS_ENSURE_ARG_POINTER(aDeleteDraft);
  *aDeleteDraft = mDeleteDraft;
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::SetDeleteDraft(bool aDeleteDraft)
{
  mDeleteDraft = aDeleteDraft;
  return NS_OK;
}

bool nsMsgCompose::IsLastWindow()
{
  nsresult rv;
  bool more;
  nsCOMPtr<nsIWindowMediator> windowMediator =
              do_GetService(NS_WINDOWMEDIATOR_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISimpleEnumerator> windowEnumerator;
    rv = windowMediator->GetEnumerator(nullptr,
               getter_AddRefs(windowEnumerator));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsISupports> isupports;

      if (NS_SUCCEEDED(windowEnumerator->GetNext(getter_AddRefs(isupports))))
        if (NS_SUCCEEDED(windowEnumerator->HasMoreElements(&more)))
          return !more;
    }
  }
  return true;
}

NS_IMETHODIMP nsMsgCompose::CloseWindow(bool recycleIt)
{
  nsresult rv;

  nsCOMPtr<nsIMsgComposeService> composeService = do_GetService(NS_MSGCOMPOSESERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // unregister the compose object with the compose service
  rv = composeService->UnregisterComposeDocShell(mDocShell);
  NS_ENSURE_SUCCESS(rv, rv);
  mDocShell = nullptr;

  // ensure that the destructor of nsMsgSend is invoked to remove
  // temporary files.
  mMsgSend = nullptr;

  recycleIt = recycleIt && !IsLastWindow();
  if (recycleIt)
  {
    rv = composeService->CacheWindow(m_window, m_composeHTML, mRecyclingListener);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIHTMLEditor> htmlEditor (do_QueryInterface(m_editor));
      NS_ASSERTION(htmlEditor, "no editor");
      if (htmlEditor)
      {
        // XXX clear undo txn manager?

        rv = m_editor->EnableUndo(false);
        NS_ENSURE_SUCCESS(rv,rv);

        rv = htmlEditor->RebuildDocumentFromSource(EmptyString());
        NS_ENSURE_SUCCESS(rv,rv);

        rv = m_editor->EnableUndo(true);
        NS_ENSURE_SUCCESS(rv,rv);

        SetBodyModified(false);
      }
      if (mRecyclingListener)
      {
        mRecyclingListener->OnClose();

        /**
         * In order to really free the memory, we need to call the JS garbage collector for our window.
         * If we don't call GC, the nsIMsgCompose object held by JS will not be released despite we set
         * the JS global that held it to null. Each time we reopen a recycled window, we allocate a new
         * nsIMsgCompose that we really need to be released when we recycle the window. In fact despite
         * we call GC here, the release won't occur right away. But if we don't call it, the release
         * will happen only when we physically close the window which will happen only on quit.
         */
        nsCOMPtr<nsIScriptGlobalObject> sgo(do_QueryInterface(m_window));
        if (sgo)
        {
          nsIScriptContext *scriptContext = sgo->GetContext();
          if (scriptContext)
            scriptContext->GC(JS::gcreason::NSJSCONTEXT_DESTROY);
        }
      }
      return NS_OK;
    }
  }

  //We are going away for real, we need to do some clean up first
  if (m_baseWindow)
  {
    if (m_editor)
    {
        /* The editor will be destroyed during yje close window.
         * Set it to null to be sure we won't use it anymore
         */
      m_editor = nullptr;
    }
    nsIBaseWindow * window = m_baseWindow;
    m_baseWindow = nullptr;
    rv = window->Destroy();
  }

  return rv;
}

nsresult nsMsgCompose::Abort()
{
  if (mMsgSend)
    mMsgSend->Abort();

  if (mProgress)
    mProgress->CloseProgressDialog(true);

  return NS_OK;
}

nsresult nsMsgCompose::GetEditor(nsIEditor * *aEditor)
{
  NS_IF_ADDREF(*aEditor = m_editor);
  return NS_OK;
}

nsresult nsMsgCompose::ClearEditor()
{
  m_editor = nullptr;
  return NS_OK;
}

// This used to be called BEFORE editor was created
//  (it did the loadUrl that triggered editor creation)
// It is called from JS after editor creation
//  (loadUrl is done in JS)
NS_IMETHODIMP nsMsgCompose::InitEditor(nsIEditor* aEditor, nsIDOMWindow* aContentWindow)
{
  NS_ENSURE_ARG_POINTER(aEditor);
  NS_ENSURE_ARG_POINTER(aContentWindow);

  m_editor = aEditor;

  // Set the charset
  const nsDependentCString msgCharSet(m_compFields->GetCharacterSet());
  m_editor->SetDocumentCharacterSet(msgCharSet);

  nsCOMPtr<nsPIDOMWindow> window = do_QueryInterface(aContentWindow);

  nsIDocShell *docShell = window->GetDocShell();
  NS_ENSURE_TRUE(docShell, NS_ERROR_UNEXPECTED);

  nsCOMPtr<nsIContentViewer> childCV;
  NS_ENSURE_SUCCESS(docShell->GetContentViewer(getter_AddRefs(childCV)), NS_ERROR_FAILURE);
  if (childCV)
  {
    nsCOMPtr<nsIMarkupDocumentViewer> markupCV = do_QueryInterface(childCV);
    if (markupCV) {
      NS_ENSURE_SUCCESS(markupCV->SetDefaultCharacterSet(msgCharSet), NS_ERROR_FAILURE);
      NS_ENSURE_SUCCESS(markupCV->SetForceCharacterSet(msgCharSet), NS_ERROR_FAILURE);
    }
  }

  // This is what used to be done in mDocumentListener,
  //   nsMsgDocumentStateListener::NotifyDocumentCreated()
  bool quotingToFollow = false;
  GetQuotingToFollow(&quotingToFollow);
  if (quotingToFollow)
    return BuildQuotedMessageAndSignature();
  else
  {
    NotifyStateListeners(nsIMsgComposeNotificationType::ComposeFieldsReady, NS_OK);
    nsresult rv = BuildBodyMessageAndSignature();
    NotifyStateListeners(nsIMsgComposeNotificationType::ComposeBodyReady, NS_OK);
    return rv;
  }
}

nsresult nsMsgCompose::GetBodyModified(bool * modified)
{
  nsresult rv;

  if (! modified)
    return NS_ERROR_NULL_POINTER;

  *modified = true;

  if (m_editor)
  {
    rv = m_editor->GetDocumentModified(modified);
    if (NS_FAILED(rv))
      *modified = true;
  }

  return NS_OK;
}

nsresult nsMsgCompose::SetBodyModified(bool modified)
{
  nsresult  rv = NS_OK;

  if (m_editor)
  {
    if (modified)
    {
      int32_t  modCount = 0;
      m_editor->GetModificationCount(&modCount);
      if (modCount == 0)
        m_editor->IncrementModificationCount(1);
    }
    else
      m_editor->ResetModificationCount();
  }

  return rv;
}

NS_IMETHODIMP
nsMsgCompose::GetDomWindow(nsIDOMWindow * *aDomWindow)
{
  NS_IF_ADDREF(*aDomWindow = m_window);
  return NS_OK;
}

nsresult nsMsgCompose::GetCompFields(nsIMsgCompFields * *aCompFields)
{
  *aCompFields = (nsIMsgCompFields*)m_compFields;
  NS_IF_ADDREF(*aCompFields);
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::GetComposeHTML(bool *aComposeHTML)
{
  *aComposeHTML = m_composeHTML;
  return NS_OK;
}

nsresult nsMsgCompose::GetWrapLength(int32_t *aWrapLength)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv)) return rv;

  return prefBranch->GetIntPref("mailnews.wraplength", aWrapLength);
}

nsresult nsMsgCompose::CreateMessage(const char * originalMsgURI,
                                     MSG_ComposeType type,
                                     nsIMsgCompFields * compFields)
{
  nsresult rv = NS_OK;
  mType = type;
  mDraftDisposition = nsIMsgFolder::nsMsgDispositionState_None;

  mDeleteDraft = (type == nsIMsgCompType::Draft);
  nsAutoCString msgUri(originalMsgURI);
  bool fileUrl = StringBeginsWith(msgUri, NS_LITERAL_CSTRING("file:"));
  int32_t typeIndex = msgUri.Find("type=application/x-message-display");
  if (typeIndex != kNotFound && typeIndex > 0)
  {
    // Strip out type=application/x-message-display because it confuses libmime.
    msgUri.Cut(typeIndex, sizeof("type=application/x-message-display"));
    if (fileUrl) // we're dealing with an .eml file msg
    {
      // We have now removed the type from the uri. Make sure we don't have
      // an uri with "&&" now. If we do, remove the second '&'.
      if (msgUri.CharAt(typeIndex) == '&')
        msgUri.Cut(typeIndex, 1);
      // Remove possible trailing '?'.
      if (msgUri.CharAt(msgUri.Length() - 1) == '?')
        msgUri.Cut(msgUri.Length() - 1, 1);
    }
    else // we're dealing with a message/rfc822 attachment
    {
      // nsURLFetcher will check for "realtype=message/rfc822" and will set the
      // content type to message/rfc822 in the forwarded message.
      msgUri.Append("&realtype=message/rfc822");
    }
    originalMsgURI = msgUri.get();
  }

  if (compFields)
  {
    NS_IF_RELEASE(m_compFields);
    m_compFields = reinterpret_cast<nsMsgCompFields*>(compFields);
    NS_ADDREF(m_compFields);
  }
  else
  {
    m_compFields = new nsMsgCompFields();
    if (m_compFields)
      NS_ADDREF(m_compFields);
    else
      return NS_ERROR_OUT_OF_MEMORY;
  }

  nsCOMPtr<nsIMsgHeaderParser> parser =
    do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  if (m_identity)
  {
    /* Setup reply-to field */
    nsCString replyTo;
    m_identity->GetReplyTo(replyTo);
    if (!replyTo.IsEmpty())
    {
      nsCString resultStr;
      rv = parser->RemoveDuplicateAddresses(nsDependentCString(m_compFields->GetReplyTo()),
                                            replyTo, resultStr);
      if (NS_SUCCEEDED(rv) && !resultStr.IsEmpty())
      {
        replyTo.Append(',');
        replyTo.Append(resultStr);
      }
      m_compFields->SetReplyTo(replyTo.get());
    }

    /* Setup cc field */
    bool doCc;
    m_identity->GetDoCc(&doCc);
    if (doCc)
    {
      nsCString ccList;
      m_identity->GetDoCcList(ccList);

      nsCString resultStr;
      rv = parser->RemoveDuplicateAddresses(nsDependentCString(m_compFields->GetCc()),
                                            ccList, resultStr);
      if (NS_SUCCEEDED(rv) && !resultStr.IsEmpty())
      {
        ccList.Append(',');
        ccList.Append(resultStr);
      }
      m_compFields->SetCc(ccList.get());
    }

    /* Setup bcc field */
    bool doBcc;
    m_identity->GetDoBcc(&doBcc);
    if (doBcc)
    {
      nsCString bccList;
      m_identity->GetDoBccList(bccList);

      nsCString resultStr;
      rv = parser->RemoveDuplicateAddresses(nsDependentCString(m_compFields->GetBcc()),
                                            bccList, resultStr);
      if (NS_SUCCEEDED(rv) && !resultStr.IsEmpty())
      {
        bccList.Append(',');
        bccList.Append(resultStr);
      }
      m_compFields->SetBcc(bccList.get());
    }
  }

  if (mType == nsIMsgCompType::Draft)
  {
    nsCString curDraftIdURL;
    rv = m_compFields->GetDraftId(getter_Copies(curDraftIdURL));
    NS_ASSERTION(NS_SUCCEEDED(rv) && !curDraftIdURL.IsEmpty(), "CreateMessage can't get draft id");

    // Skip if no draft id (probably a new draft msg).
    if (NS_SUCCEEDED(rv) && !curDraftIdURL.IsEmpty())
    {
      nsCOMPtr <nsIMsgDBHdr> msgDBHdr;
      rv = GetMsgDBHdrFromURI(curDraftIdURL.get(), getter_AddRefs(msgDBHdr));
      NS_ASSERTION(NS_SUCCEEDED(rv), "CreateMessage can't get msg header DB interface pointer.");
      if (msgDBHdr)
      {
        nsCString queuedDisposition;
        msgDBHdr->GetStringProperty(QUEUED_DISPOSITION_PROPERTY, getter_Copies(queuedDisposition));
        nsCString originalMsgURIs;
        msgDBHdr->GetStringProperty(ORIG_URI_PROPERTY, getter_Copies(originalMsgURIs));
        mOriginalMsgURI = originalMsgURIs;
        if (!queuedDisposition.IsEmpty())
        {
          if (queuedDisposition.Equals("replied"))
             mDraftDisposition = nsIMsgFolder::nsMsgDispositionState_Replied;
          else if (queuedDisposition.Equals("forward"))
             mDraftDisposition = nsIMsgFolder::nsMsgDispositionState_Forwarded;
        }
      }
    }
  }

  // If we don't have an original message URI, nothing else to do...
  if (!originalMsgURI || *originalMsgURI == 0)
    return NS_OK;

  // store the original message URI so we can extract it after we send the message to properly
  // mark any disposition flags like replied or forwarded on the message.
  if (mOriginalMsgURI.IsEmpty())
    mOriginalMsgURI = originalMsgURI;

  nsCOMPtr<nsIPrefBranch> prefs (do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // If we are forwarding inline, mime did already setup the compose fields therefore we should stop now
  if (type == nsIMsgCompType::ForwardInline )
  {
    bool replyInDefault = false;
    prefs->GetBoolPref("mailnews.reply_in_default_charset",
                        &replyInDefault);
    // Use send_default_charset if reply_in_default_charset is on.
    if (replyInDefault)
    {
      nsString str;
      nsCString charset;
      NS_GetLocalizedUnicharPreferenceWithDefault(prefs, "mailnews.send_default_charset",
                                                  EmptyString(), str);
      if (!str.IsEmpty())
      {
        LossyCopyUTF16toASCII(str, charset);
        m_compFields->SetCharacterSet(charset.get());
      }
    }

    // We want to treat this message as a reference too
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    rv = GetMsgDBHdrFromURI(originalMsgURI, getter_AddRefs(msgHdr));
    if (NS_SUCCEEDED(rv))
    {
      nsAutoCString messageId;
      msgHdr->GetMessageId(getter_Copies(messageId));

      nsAutoCString reference;
      reference.Append(NS_LITERAL_CSTRING("<"));
      reference.Append(messageId);
      reference.Append(NS_LITERAL_CSTRING(">"));
      // We're forwarding, which means we're composing a message that has no
      // references yet, so we can set the value safely
      m_compFields->SetReferences(reference.get());
    }

    return NS_OK;
  }

  char *uriList = PL_strdup(originalMsgURI);
  if (!uriList)
    return NS_ERROR_OUT_OF_MEMORY;

  nsCString charset;
  // use a charset of the original message
  nsCString mailCharset;
  bool charsetOverride = false;
  GetTopmostMsgWindowCharacterSet(mailCharset, &mCharsetOverride);
  if (!mailCharset.IsEmpty())
  {
    charset = mailCharset;
    charsetOverride = mCharsetOverride;
  }

  // although the charset in which to _send_ the message might change,
  // the original message will be parsed for quoting using the charset it is
  // now displayed with
  mQuoteCharset = charset;

  bool isFirstPass = true;
  char *uri = uriList;
  char *nextUri;
  do
  {
    nextUri = strstr(uri, "://");
    if (nextUri)
    {
      // look for next ://, and then back up to previous ','
      nextUri = strstr(nextUri + 1, "://");
      if (nextUri)
      {
        *nextUri = '\0';
        char *saveNextUri = nextUri;
        nextUri = strrchr(uri, ',');
        if (nextUri)
          *nextUri = '\0';
        *saveNextUri = ':';
      }
    }

    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    if (mOrigMsgHdr)
      msgHdr = mOrigMsgHdr;
    else
    {
      rv = GetMsgDBHdrFromURI(uri, getter_AddRefs(msgHdr));
      NS_ENSURE_SUCCESS(rv,rv);
    }
    if (msgHdr)
    {
      nsCString decodedCString;

      if (!charsetOverride && charset.IsEmpty())
      {
        rv = msgHdr->GetCharset(getter_Copies(charset));
        if (NS_FAILED(rv)) return rv;
      }

      // save the charset of a message being replied to because
      // we need to use it when decoding RFC-2047-encoded author name
      // with |charsetOverride|.
      nsAutoCString originCharset(charset);

      bool replyInDefault = false;
      prefs->GetBoolPref("mailnews.reply_in_default_charset",
                          &replyInDefault);
      // Use send_default_charset if reply_in_default_charset is on.
      if (replyInDefault)
      {
        nsString str;
        NS_GetLocalizedUnicharPreferenceWithDefault(prefs, "mailnews.send_default_charset",
                                                    EmptyString(), str);
        if (!str.IsEmpty())
          LossyCopyUTF16toASCII(str, charset);
      }

      // No matter what, we should block x-windows-949 (our internal name)
      // from being used for outgoing emails (bug 234958)
      if (charset.Equals("x-windows-949",
            nsCaseInsensitiveCStringComparator()))
        charset = "EUC-KR";

      // get an original charset, used for a label, UTF-8 is used for the internal processing
      if (isFirstPass && !charset.IsEmpty())
        m_compFields->SetCharacterSet(charset.get());

      nsString subject;
      rv = msgHdr->GetMime2DecodedSubject(subject);
      if (NS_FAILED(rv)) return rv;

      // Check if (was: is present in the subject
      int32_t wasOffset = subject.RFind(NS_LITERAL_STRING(" (was:"));
      bool strip = true;

      if (wasOffset >= 0) {
        // Check the number of references, to check if was: should be stripped
        // First, assume that it should be stripped; the variable will be set to
        // false later if stripping should not happen.
        uint16_t numRef;
        msgHdr->GetNumReferences(&numRef);
        if (numRef) {
          // If there are references, look for the first message in the thread
          // firstly, get the database via the folder
          nsCOMPtr<nsIMsgFolder> folder;
          msgHdr->GetFolder(getter_AddRefs(folder));
          if (folder) {
            nsCOMPtr<nsIMsgDatabase> db;
            folder->GetMsgDatabase(getter_AddRefs(db));

            if (db) {
              nsAutoCString reference;
              msgHdr->GetStringReference(0, reference);

              nsCOMPtr<nsIMsgDBHdr> refHdr;
              db->GetMsgHdrForMessageID(reference.get(), getter_AddRefs(refHdr));

              if (refHdr) {
                nsCString refSubject;
                rv = refHdr->GetSubject(getter_Copies(refSubject));
                if (NS_SUCCEEDED(rv)) {
                  if (refSubject.Find(" (was:") >= 0)
                    strip = false;
                }
              }
            }
          }
        }
        else
          strip = false;
      }

      if (strip && wasOffset >= 0) {
        // Strip off the "(was: old subject)" part
        subject.Assign(Substring(subject, 0, wasOffset));
      }

      switch (type)
      {
        default: break;
        case nsIMsgCompType::Reply :
        case nsIMsgCompType::ReplyAll:
        case nsIMsgCompType::ReplyToList:
        case nsIMsgCompType::ReplyToGroup:
        case nsIMsgCompType::ReplyToSender:
        case nsIMsgCompType::ReplyToSenderAndGroup:
          {
            if (!isFirstPass)       // safeguard, just in case...
            {
              PR_Free(uriList);
              return rv;
            }
            mQuotingToFollow = true;

            subject.Insert(NS_LITERAL_STRING("Re: "), 0);
            m_compFields->SetSubject(subject);

            // Setup quoting callbacks for later...
            mWhatHolder = 1;
            break;
          }
        case nsIMsgCompType::ForwardAsAttachment:
          {
            // Add the forwarded message in the references, first
            nsAutoCString messageId;
            msgHdr->GetMessageId(getter_Copies(messageId));
            if (isFirstPass)
            {
              nsAutoCString reference;
              reference.Append(NS_LITERAL_CSTRING("<"));
              reference.Append(messageId);
              reference.Append(NS_LITERAL_CSTRING(">"));
              m_compFields->SetReferences(reference.get());
            }
            else
            {
              nsAutoCString references;
              m_compFields->GetReferences(getter_Copies(references));
              references.Append(NS_LITERAL_CSTRING(" <"));
              references.Append(messageId);
              references.Append(NS_LITERAL_CSTRING(">"));
              m_compFields->SetReferences(references.get());
            }

            uint32_t flags;

            msgHdr->GetFlags(&flags);
            if (flags & nsMsgMessageFlags::HasRe)
              subject.Insert(NS_LITERAL_STRING("Re: "), 0);

            // Setup quoting callbacks for later...
            mQuotingToFollow = false;  //We don't need to quote the original message.
            nsCOMPtr<nsIMsgAttachment> attachment = do_CreateInstance(NS_MSGATTACHMENT_CONTRACTID, &rv);
            if (NS_SUCCEEDED(rv) && attachment)
            {
              bool addExtension = true;
              nsString sanitizedSubj;
              prefs->GetBoolPref("mail.forward_add_extension", &addExtension);

              // copy subject string to sanitizedSubj, use default if empty
              if (subject.IsEmpty())
              {
                nsresult rv;
                nsCOMPtr<nsIStringBundleService> bundleService =
                  mozilla::services::GetStringBundleService();
                NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
                nsCOMPtr<nsIStringBundle> composeBundle;
                rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties",
                                                 getter_AddRefs(composeBundle));
                NS_ENSURE_SUCCESS(rv, rv);
                composeBundle->GetStringFromName(NS_LITERAL_STRING("messageAttachmentSafeName").get(),
                                                 getter_Copies(sanitizedSubj));
              }
              else
                sanitizedSubj.Assign(subject);

              // set the file size
              uint32_t messageSize;
              msgHdr->GetMessageSize(&messageSize);
              attachment->SetSize(messageSize);

              // change all '.' to '_'  see bug #271211
              MsgReplaceChar(sanitizedSubj, ".", '_');
              if (addExtension)
                sanitizedSubj.AppendLiteral(".eml");
              attachment->SetName(sanitizedSubj);
              attachment->SetUrl(nsDependentCString(uri));
              m_compFields->AddAttachment(attachment);
            }

            if (isFirstPass)
            {
              nsCString fwdPrefix;
              prefs->GetCharPref("mail.forward_subject_prefix", getter_Copies(fwdPrefix));
              if (!fwdPrefix.IsEmpty())
              {
                nsString unicodeFwdPrefix;
                CopyUTF8toUTF16(fwdPrefix, unicodeFwdPrefix);
                unicodeFwdPrefix.AppendLiteral(": ");
                subject.Insert(unicodeFwdPrefix, 0);
              }
              else
              {
                subject.Insert(NS_LITERAL_STRING("Fwd: "), 0);
              }
              m_compFields->SetSubject(subject);
            }
            break;
          }
        case nsIMsgCompType::Redirect:
          {
            // For a redirect, set the Reply-To: header to what was in the original From: header...
            nsAutoCString author;
            msgHdr->GetAuthor(getter_Copies(author));
            m_compFields->SetReplyTo(author.get());

            // ... and empty out the various recipient headers
            nsAutoString empty;
            m_compFields->SetTo(empty);
            m_compFields->SetCc(empty);
            m_compFields->SetBcc(empty);
            m_compFields->SetNewsgroups(empty);
            m_compFields->SetFollowupTo(empty);
            break;
          }
      }
    }
    isFirstPass = false;
    uri = nextUri + 1;
  }
  while (nextUri);
  PR_Free(uriList);
  return rv;
}

NS_IMETHODIMP nsMsgCompose::GetProgress(nsIMsgProgress **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = mProgress;
  NS_IF_ADDREF(*_retval);
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::GetMessageSend(nsIMsgSend **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = mMsgSend;
  NS_IF_ADDREF(*_retval);
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::ClearMessageSend()
{
  mMsgSend = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::SetCiteReference(nsString citeReference)
{
  mCiteReference = citeReference;
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::SetSavedFolderURI(const char *folderURI)
{
  m_folderName = folderURI;
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::GetSavedFolderURI(char ** folderURI)
{
  NS_ENSURE_ARG_POINTER(folderURI);
  *folderURI = ToNewCString(m_folderName);
  return (*folderURI) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP nsMsgCompose::GetOriginalMsgURI(char ** originalMsgURI)
{
  NS_ENSURE_ARG_POINTER(originalMsgURI);
  *originalMsgURI = ToNewCString(mOriginalMsgURI);
  return (*originalMsgURI) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

////////////////////////////////////////////////////////////////////////////////////
// THIS IS THE CLASS THAT IS THE STREAM CONSUMER OF THE HTML OUPUT
// FROM LIBMIME. THIS IS FOR QUOTING
////////////////////////////////////////////////////////////////////////////////////
QuotingOutputStreamListener::~QuotingOutputStreamListener()
{
  if (mUnicodeConversionBuffer)
    nsMemory::Free(mUnicodeConversionBuffer);
}

QuotingOutputStreamListener::QuotingOutputStreamListener(const char * originalMsgURI,
                                                         nsIMsgDBHdr *originalMsgHdr,
                                                         bool quoteHeaders,
                                                         bool headersOnly,
                                                         nsIMsgIdentity *identity,
                                                         const char *charset,
                                                         bool charsetOverride,
                                                         bool quoteOriginal,
                                                         const nsACString& htmlToQuote)
{
  nsresult rv;
  mQuoteHeaders = quoteHeaders;
  mHeadersOnly = headersOnly;
  mIdentity = identity;
  mOrigMsgHdr = originalMsgHdr;
  mUnicodeBufferCharacterLength = 0;
  mUnicodeConversionBuffer = nullptr;
  mQuoteOriginal = quoteOriginal;
  mHtmlToQuote = htmlToQuote;

  if (!mHeadersOnly || !mHtmlToQuote.IsEmpty())
  {
    nsString replyHeaderOriginalmessage;
    // For the built message body...
    if (originalMsgHdr && !quoteHeaders)
    {
      // Setup the cite information....
      nsCString myGetter;
      if (NS_SUCCEEDED(originalMsgHdr->GetMessageId(getter_Copies(myGetter))))
      {
        if (!myGetter.IsEmpty())
        {
          nsAutoCString buf;
          mCiteReference.AssignLiteral("mid:");
          MsgEscapeURL(myGetter,
                       nsINetUtil::ESCAPE_URL_FILE_BASENAME | nsINetUtil::ESCAPE_URL_FORCED,
                       buf);
          mCiteReference.Append(NS_ConvertASCIItoUTF16(buf));
        }
      }

      bool header, headerDate;
      int32_t replyHeaderType;
      nsAutoString replyHeaderLocale;
      nsString replyHeaderAuthorwrote;
      nsString replyHeaderOndate;
      nsAutoString replyHeaderSeparator;
      nsAutoString replyHeaderColon;

      // Get header type, locale and strings from pref.
      GetReplyHeaderInfo(&replyHeaderType,
                         replyHeaderLocale,
                         replyHeaderAuthorwrote,
                         replyHeaderOndate,
                         replyHeaderSeparator,
                         replyHeaderColon,
                         replyHeaderOriginalmessage);

      switch (replyHeaderType)
      {
        case 0: // No reply header at all
          header=false;
          headerDate=false;
          break;

        case 2: // Insert both the original author and date in the reply header (date followed by author)
        case 3: // Insert both the original author and date in the reply header (author followed by date)
          header=true;
          headerDate=true;
          break;

        case 4: // XXX implement user specified header
        case 1: // Default is to only view the author. We will reconsider this decision when bug 75377 is fixed.
        default:
          header=true;
          headerDate=false;
          break;
      }

      nsAutoString citePrefixDate;
      nsAutoString citePrefixAuthor;

      if (header)
      {
        if (headerDate)
        {
          nsCOMPtr<nsIDateTimeFormat> dateFormatter = do_CreateInstance(NS_DATETIMEFORMAT_CONTRACTID, &rv);

          if (NS_SUCCEEDED(rv))
          {
            PRTime originalMsgDate;
            rv = originalMsgHdr->GetDate(&originalMsgDate);

            if (NS_SUCCEEDED(rv))
            {
              nsAutoString formattedDateString;
              nsCOMPtr<nsILocale> locale;
              nsCOMPtr<nsILocaleService> localeService(do_GetService(NS_LOCALESERVICE_CONTRACTID));

              // Format date using "mailnews.reply_header_locale", if empty then use application default locale.
              if (!replyHeaderLocale.IsEmpty())
                rv = localeService->NewLocale(replyHeaderLocale, getter_AddRefs(locale));

              if (NS_SUCCEEDED(rv))
              {
                rv = dateFormatter->FormatPRTime(locale,
                                                 kDateFormatShort,
                                                 kTimeFormatNoSeconds,
                                                 originalMsgDate,
                                                 formattedDateString);

                if (NS_SUCCEEDED(rv))
                {
                  // take care "On %s"
                  PRUnichar *formatedString = nullptr;
                  formatedString = nsTextFormatter::smprintf(replyHeaderOndate.get(),
                                                             NS_ConvertUTF16toUTF8(formattedDateString.get()).get());
                  if (formatedString)
                  {
                    citePrefixDate.Assign(formatedString);
                    nsTextFormatter::smprintf_free(formatedString);
                  }
                }
              }
            }
          }
        }


      nsCString author;
      rv = originalMsgHdr->GetAuthor(getter_Copies(author));

      if (NS_SUCCEEDED(rv))
      {
        mMimeConverter = do_GetService(NS_MIME_CONVERTER_CONTRACTID);
        nsCOMPtr<nsIMsgHeaderParser> parser (do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID));

        if (parser)
        {
          nsCString authorName;
          rv = parser->ExtractHeaderAddressName(author, authorName);
          // take care "%s wrote"
          PRUnichar *formattedString = nullptr;
          if (NS_SUCCEEDED(rv) && !authorName.IsEmpty())
          {
            nsCString decodedAuthor;
            // Decode header, the result string is null
            // if the input is not MIME encoded ASCII.
            if (mMimeConverter)
              mMimeConverter->DecodeMimeHeaderToUTF8(authorName, charset,
                                                     charsetOverride, true,
                                                     decodedAuthor);
            formattedString = nsTextFormatter::smprintf(replyHeaderAuthorwrote.get(),
                                                        (!decodedAuthor.IsEmpty() ?
                                                         decodedAuthor.get() : authorName.get()));
          }
          else
          {
            formattedString = nsTextFormatter::smprintf(replyHeaderAuthorwrote.get(),
                                                        author.get());
          }
          if (formattedString)
          {
            citePrefixAuthor.Assign(formattedString);
            nsTextFormatter::smprintf_free(formattedString);
          }
        }


        }
        if (replyHeaderType == 2)
        {
          mCitePrefix.Append(citePrefixDate);
          mCitePrefix.Append(replyHeaderSeparator);
          mCitePrefix.Append(citePrefixAuthor);
        }
        else if (replyHeaderType == 3)
        {
          mCitePrefix.Append(citePrefixAuthor);
          mCitePrefix.Append(replyHeaderSeparator);
          mCitePrefix.Append(citePrefixDate);
        }
        else
          mCitePrefix.Append(citePrefixAuthor);
        mCitePrefix.Append(replyHeaderColon);
      }
    }

    if (mCitePrefix.IsEmpty())
    {
      if (replyHeaderOriginalmessage.IsEmpty())
      {
        // This is not likely to happen but load the string if it's not done already.
        int32_t replyHeaderType;
        nsAutoString replyHeaderLocale;
        nsString replyHeaderAuthorwrote;
        nsString replyHeaderOndate;
        nsAutoString replyHeaderSeparator;
        nsAutoString replyHeaderColon;
        GetReplyHeaderInfo(&replyHeaderType,
                           replyHeaderLocale,
                           replyHeaderAuthorwrote,
                           replyHeaderOndate,
                           replyHeaderSeparator,
                           replyHeaderColon,
                           replyHeaderOriginalmessage);
      }
      mCitePrefix.AppendLiteral("\n\n");
      mCitePrefix.Append(replyHeaderOriginalmessage);
      mCitePrefix.AppendLiteral("\n");
    }
  }
}

/**
 * The formatflowed parameter directs if formatflowed should be used in the conversion.
 * format=flowed (RFC 2646) is a way to represent flow in a plain text mail, without
 * disturbing the plain text.
 */
nsresult
QuotingOutputStreamListener::ConvertToPlainText(bool formatflowed /* = false */)
{
  nsresult rv = ConvertBufToPlainText(mMsgBody, formatflowed, true);
  NS_ENSURE_SUCCESS (rv, rv);
  return ConvertBufToPlainText(mSignature, formatflowed, true);
}

NS_IMETHODIMP QuotingOutputStreamListener::OnStartRequest(nsIRequest *request, nsISupports * /* ctxt */)
{
  return NS_OK;
}

NS_IMETHODIMP QuotingOutputStreamListener::OnStopRequest(nsIRequest *request, nsISupports *ctxt, nsresult status)
{
  nsresult rv = NS_OK;
  nsAutoString aCharset;

  if (!mHtmlToQuote.IsEmpty())
  {
    // If we had a selection in the original message to quote, we can add
    // it now that we are done ignoring the original body of the message
    mHeadersOnly = false;
    rv = AppendToMsgBody(mHtmlToQuote);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCOMPtr<nsIMsgCompose> compose = do_QueryReferent(mWeakComposeObj);
  NS_ENSURE_TRUE(compose, NS_ERROR_NULL_POINTER);

  MSG_ComposeType type;
  compose->GetType(&type);

  // Assign cite information if available...
  if (!mCiteReference.IsEmpty())
    compose->SetCiteReference(mCiteReference);

  if (mHeaders && (type == nsIMsgCompType::Reply ||
                   type == nsIMsgCompType::ReplyAll ||
                   type == nsIMsgCompType::ReplyToList ||
                   type == nsIMsgCompType::ReplyToSender ||
                   type == nsIMsgCompType::ReplyToGroup ||
                   type == nsIMsgCompType::ReplyToSenderAndGroup) &&
      mQuoteOriginal)
  {
    nsCOMPtr<nsIMsgCompFields> compFields;
    compose->GetCompFields(getter_AddRefs(compFields));
    if (compFields)
    {
      aCharset.AssignLiteral("UTF-8");
      nsAutoString from;
      nsAutoString to;
      nsAutoString cc;
      nsAutoString replyTo;
      nsAutoString mailReplyTo;
      nsAutoString mailFollowupTo;
      nsAutoString newgroups;
      nsAutoString followUpTo;
      nsAutoString messageId;
      nsAutoString references;
      nsAutoString listPost;

      nsCString outCString; // Temp helper string.

      bool needToRemoveDup = false;
      if (!mMimeConverter)
      {
        mMimeConverter = do_GetService(NS_MIME_CONVERTER_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
      }
      nsCString charset;
      compFields->GetCharacterSet(getter_Copies(charset));

      mHeaders->ExtractHeader(HEADER_FROM, true, outCString);
      ConvertRawBytesToUTF16(outCString, charset.get(), from);

      mHeaders->ExtractHeader(HEADER_TO, true, outCString);
      ConvertRawBytesToUTF16(outCString, charset.get(), to);

      mHeaders->ExtractHeader(HEADER_CC, true, outCString);
      ConvertRawBytesToUTF16(outCString, charset.get(), cc);

      mHeaders->ExtractHeader(HEADER_MAIL_FOLLOWUP_TO, true, outCString);
      ConvertRawBytesToUTF16(outCString, charset.get(), mailFollowupTo);

      mHeaders->ExtractHeader(HEADER_REPLY_TO, false, outCString);
      ConvertRawBytesToUTF16(outCString, charset.get(), replyTo);

      mHeaders->ExtractHeader(HEADER_MAIL_REPLY_TO, true, outCString);
      ConvertRawBytesToUTF16(outCString, charset.get(), mailReplyTo);

      mHeaders->ExtractHeader(HEADER_NEWSGROUPS, false, outCString);
      if (!outCString.IsEmpty())
        mMimeConverter->DecodeMimeHeader(outCString.get(), charset.get(),
                                         false, true, newgroups);

      mHeaders->ExtractHeader(HEADER_FOLLOWUP_TO, false, outCString);
      if (!outCString.IsEmpty())
        mMimeConverter->DecodeMimeHeader(outCString.get(), charset.get(),
                                         false, true, followUpTo);

      mHeaders->ExtractHeader(HEADER_MESSAGE_ID, false, outCString);
      if (!outCString.IsEmpty())
        mMimeConverter->DecodeMimeHeader(outCString.get(), charset.get(),
                                         false, true, messageId);

      mHeaders->ExtractHeader(HEADER_REFERENCES, false, outCString);
      if (!outCString.IsEmpty())
        mMimeConverter->DecodeMimeHeader(outCString.get(), charset.get(),
                                         false, true, references);

      nsCOMPtr<nsIMsgHeaderParser> parser =
        do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCString fromEmailAddress;
      rv = parser->ExtractHeaderAddressMailboxes(NS_ConvertUTF16toUTF8(from),
                                                 fromEmailAddress);
      NS_ENSURE_SUCCESS(rv,rv);

      nsCString toEmailAddresses;
      rv = parser->ExtractHeaderAddressMailboxes(NS_ConvertUTF16toUTF8(to),
                                                 toEmailAddresses);
      NS_ENSURE_SUCCESS(rv,rv);

      nsCString  ccEmailAddresses;
      rv = parser->ExtractHeaderAddressMailboxes(NS_ConvertUTF16toUTF8(cc),
                                                 ccEmailAddresses);
      NS_ENSURE_SUCCESS(rv,rv);

      nsCOMPtr<nsIPrefBranch> prefs (do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      bool replyToSelfCheckAll = false;
      prefs->GetBoolPref("mailnews.reply_to_self_check_all_ident",
                         &replyToSelfCheckAll);

      nsCOMPtr<nsIMsgAccountManager> accountManager =
        do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv,rv);

      nsCOMPtr<nsIArray> identities;
      nsCString accountKey;
      mOrigMsgHdr->GetAccountKey(getter_Copies(accountKey));
      if (replyToSelfCheckAll)
      {
        // Check all avaliable identities if the pref was set.
        accountManager->GetAllIdentities(getter_AddRefs(identities));
      }
      else if (!accountKey.IsEmpty())
      {
         // Check headers to see which account the message came in from
         // (only works for pop3).
        nsCOMPtr<nsIMsgAccount> account;
        accountManager->GetAccount(accountKey, getter_AddRefs(account));

        if (account)
          account->GetIdentities(getter_AddRefs(identities));
      }
      else
      {
        // Check identities only for the server of the folder that the message
        // is in.
        nsCOMPtr <nsIMsgFolder> msgFolder;
        rv = mOrigMsgHdr->GetFolder(getter_AddRefs(msgFolder));

        if (NS_SUCCEEDED(rv) && msgFolder){
          nsCOMPtr<nsIMsgIncomingServer> nsIMsgIncomingServer;
          rv = msgFolder->GetServer(getter_AddRefs(nsIMsgIncomingServer));

          if (NS_SUCCEEDED(rv) && nsIMsgIncomingServer)
            accountManager->GetIdentitiesForServer(nsIMsgIncomingServer, getter_AddRefs(identities));
        }
      }

      bool isReplyToSelf = false;
      if (identities)
      {
        // Go through the identities to see if any of them is the author of
        // the email.
        nsCOMPtr<nsIMsgIdentity> lookupIdentity;

        uint32_t count = 0;
        identities->GetLength(&count);

        for (uint32_t i = 0; i < count; i++)
        {
          lookupIdentity = do_QueryElementAt(identities, i, &rv);
          if (NS_FAILED(rv))
            continue;

          nsCString curIdentityEmail;
          lookupIdentity->GetEmail(curIdentityEmail);

          // See if it's a reply to own message, but not a reply between identities.
          if (curIdentityEmail.Equals(fromEmailAddress))
          {
            isReplyToSelf = true;
            // For a true reply-to-self, none of your identities are in To or CC.
            for (uint32_t j = 0; j < count; j++)
            {
              nsCOMPtr<nsIMsgIdentity> lookupIdentity2;
              rv = identities->QueryElementAt(j, NS_GET_IID(nsIMsgIdentity),
                                              getter_AddRefs(lookupIdentity2));
              if (NS_FAILED(rv))
                continue;

              nsCString curIdentityEmail2;
              lookupIdentity2->GetEmail(curIdentityEmail2);
              if (toEmailAddresses.Find(curIdentityEmail2) != kNotFound ||
                  ccEmailAddresses.Find(curIdentityEmail2) != kNotFound)
              {
                // An identity among the recipients -> not reply-to-self.
                isReplyToSelf = false;
                break;
              }
            }
            break;
          }
        }
      }

      if (type == nsIMsgCompType::ReplyToSender || type == nsIMsgCompType::Reply)
      {
        if (isReplyToSelf)
        {
          compFields->SetTo(to);
        }
        else if (!mailReplyTo.IsEmpty())
        {
          // handle Mail-Reply-To (http://cr.yp.to/proto/replyto.html)
          compFields->SetTo(mailReplyTo);
          needToRemoveDup = true;
        }
        else if (!replyTo.IsEmpty())
        {
          // default behaviour for messages without Mail-Reply-To
          compFields->SetTo(replyTo);
          needToRemoveDup = true;
        }
        else {
          compFields->SetTo(from);
        }
      }
      else if (type == nsIMsgCompType::ReplyAll)
      {
        if (isReplyToSelf)
        {
          compFields->SetTo(to);
         compFields->SetCc(cc);
        }
        else if (mailFollowupTo.IsEmpty()) {
          // default behaviour for messages without Mail-Followup-To

          nsAutoString allTo;
          if (!replyTo.IsEmpty())
          {
            // default behaviour for messages without Mail-Reply-To
            allTo.Assign(replyTo);
            needToRemoveDup = true;
          }
          else
          {
            allTo.Assign(from);
          }

          allTo.AppendLiteral(", ");
          allTo.Append(to);
          compFields->SetTo(allTo);

          nsAutoString allCc;
          compFields->GetCc(allCc); // auto-cc
          if (!allCc.IsEmpty())
            allCc.AppendLiteral(", ");
          allCc.Append(cc);
          compFields->SetCc(allCc);

          needToRemoveDup = true;
        }
        else
        {
          // handle Mail-Followup-To (http://cr.yp.to/proto/replyto.html)

          compFields->SetTo(mailFollowupTo);
          compFields->SetCc(EmptyString());
        }

        // Preserve BCC for the reply-to-self case (can be known if replying
        // from the Sent folder).
        mHeaders->ExtractHeader(HEADER_BCC, true, outCString);
        if (!outCString.IsEmpty())
        {
          nsAutoString bcc;
          ConvertRawBytesToUTF16(outCString, charset.get(), bcc);
          compFields->SetBcc(bcc);
        }
      }
      else if (type == nsIMsgCompType::ReplyToList)
      {
        if (isReplyToSelf)
        {
          compFields->SetTo(to);
        }
        else {
          mHeaders->ExtractHeader(HEADER_LIST_POST, true, outCString);
          if (!outCString.IsEmpty())
            mMimeConverter->DecodeMimeHeader(outCString.get(), charset.get(),
                                             false, true, listPost);

          if (!listPost.IsEmpty())
          {
            int32_t startPos = listPost.Find("<mailto:");
            int32_t endPos = listPost.FindChar('>', startPos);
            // Extract the e-mail address.
            if (endPos > startPos)
            {
              const uint32_t mailtoLen = strlen("<mailto:");
              listPost = Substring(listPost, startPos + mailtoLen, endPos - (startPos + mailtoLen));
              compFields->SetTo(listPost);
            }
          }
        }
      }

      if (!newgroups.IsEmpty())
      {
        if ((type != nsIMsgCompType::Reply) && (type != nsIMsgCompType::ReplyToSender))
          compFields->SetNewsgroups(newgroups);
        if (type == nsIMsgCompType::ReplyToGroup)
          compFields->SetTo(EmptyString());
      }

      if (!followUpTo.IsEmpty())
      {
        // Handle "followup-to: poster" magic keyword here
        if (followUpTo.EqualsLiteral("poster"))
        {
          nsCOMPtr<nsIDOMWindow> composeWindow;
          nsCOMPtr<nsIPrompt> prompt;
          compose->GetDomWindow(getter_AddRefs(composeWindow));
          if (composeWindow)
            composeWindow->GetPrompter(getter_AddRefs(prompt));
          nsMsgDisplayMessageByName(prompt, NS_LITERAL_STRING("followupToSenderMessage"));

          if (!replyTo.IsEmpty())
          {
            compFields->SetTo(replyTo);
          }
          else
          {
            // If reply-to is empty, use the From header to fetch the original
            // sender's email.
            compFields->SetTo(from);
          }

          // Clear the newsgroup: header field, because followup-to: poster
          // only follows up to the original sender
          if (!newgroups.IsEmpty())
            compFields->SetNewsgroups(EmptyString());
        }
        else // Process "followup-to: newsgroup-content" here
        {
          if (type != nsIMsgCompType::ReplyToSender)
            compFields->SetNewsgroups(followUpTo);
          if (type == nsIMsgCompType::Reply)
          {
            compFields->SetTo(EmptyString());
          }
        }
      }

      if (!references.IsEmpty())
        references.Append(PRUnichar(' '));
      references += messageId;
      compFields->SetReferences(NS_LossyConvertUTF16toASCII(references).get());

      // Remove my address from Reply fields.
      nsAutoCString resultStr;

      // Cast interface to concrete class that has direct field getters etc.
      nsMsgCompFields* _compFields = static_cast<nsMsgCompFields*>(compFields.get());
      if (mIdentity)
      {
        nsCString email;
        mIdentity->GetEmail(email);
        // We need to remove dups for the Reply fields.

        // If it's a reply to self, self should not be removed.
        if (NS_ConvertUTF16toUTF8(from).Find(email) == kNotFound) {
          parser->RemoveDuplicateAddresses(nsDependentCString(_compFields->GetTo()),
                                           email, resultStr);
          _compFields->SetTo(resultStr.get());
        }

        parser->RemoveDuplicateAddresses(nsDependentCString(_compFields->GetCc()),
                                         email, resultStr);
        _compFields->SetCc(resultStr.get());
      }

      // Remove duplicate addresses between TO && CC
      if (needToRemoveDup)
      {
        nsCString addressToBeRemoved(_compFields->GetTo());
        // Remove my own address if using Mail-Followup-To (see bug 325429)
        if (mIdentity)
        {
          bool removeMyEmailInCc = true;
          nsCString myEmail;
          mIdentity->GetEmail(myEmail);

          // Remove own address from CC unless we want it in there
          // through the automatic-CC-to-self (see bug 584962). There are
          // three cases:
          // - user has no automatic CC
          // - user has automatic CC but own email is not in it
          // - user has automatic CC and own email in it
          // Only in the last case do we want our own email address to stay
          // in the CC list.
          bool automaticCc;
          mIdentity->GetDoCc(&automaticCc);
          if (automaticCc)
          {
            nsCString ccList, ccEmailAddresses;
            mIdentity->GetDoCcList(ccList);
            rv = parser->ExtractHeaderAddressMailboxes(ccList,
                                                       ccEmailAddresses);
            if (NS_SUCCEEDED(rv) &&
                ccEmailAddresses.Find(myEmail) != kNotFound)
              removeMyEmailInCc = false;
          }

          if (removeMyEmailInCc)
          {
            addressToBeRemoved.AppendLiteral(", ");
            addressToBeRemoved.Append(myEmail);
          }

          rv = parser->RemoveDuplicateAddresses(nsDependentCString(_compFields->GetTo()),
                                                myEmail, resultStr);
          if (NS_SUCCEEDED(rv))
          {
            if (type == nsIMsgCompType::ReplyAll && !mailFollowupTo.IsEmpty())
              _compFields->SetTo(resultStr.get());
          }
        }
        rv = parser->RemoveDuplicateAddresses(nsDependentCString(_compFields->GetCc()),
                                              addressToBeRemoved, resultStr);
        if (NS_SUCCEEDED(rv))
          _compFields->SetCc(resultStr.get());
      }
    }
  }

#ifdef MSGCOMP_TRACE_PERFORMANCE
  nsCOMPtr<nsIMsgComposeService> composeService (do_GetService(NS_MSGCOMPOSESERVICE_CONTRACTID));
  composeService->TimeStamp("Done with MIME. Now we're updating the UI elements", false);
#endif

  if (mQuoteOriginal)
    compose->NotifyStateListeners(nsIMsgComposeNotificationType::ComposeFieldsReady, NS_OK);

#ifdef MSGCOMP_TRACE_PERFORMANCE
  composeService->TimeStamp("Addressing widget, window title and focus are now set, time to insert the body", false);
#endif

  if (! mHeadersOnly)
    mMsgBody.AppendLiteral("</html>");

  // Now we have an HTML representation of the quoted message.
  // If we are in plain text mode, we need to convert this to plain
  // text before we try to insert it into the editor. If we don't, we
  // just get lots of HTML text in the message...not good.
  //
  // XXX not m_composeHTML? /BenB
  bool composeHTML = true;
  compose->GetComposeHTML(&composeHTML);
  if (!composeHTML)
  {
    // Downsampling. The charset should only consist of ascii.

    bool formatflowed =
      UseFormatFlowed(NS_LossyConvertUTF16toASCII(aCharset).get());
    ConvertToPlainText(formatflowed);
  }

  compose->ProcessSignature(mIdentity, true, &mSignature);

  nsCOMPtr<nsIEditor> editor;
  if (NS_SUCCEEDED(compose->GetEditor(getter_AddRefs(editor))) && editor)
  {
    if (mQuoteOriginal)
      compose->ConvertAndLoadComposeWindow(mCitePrefix,
                                           mMsgBody, mSignature,
                                           true, composeHTML);
    else
      InsertToCompose(editor, composeHTML);
  }

  if (mQuoteOriginal)
    compose->NotifyStateListeners(nsIMsgComposeNotificationType::ComposeBodyReady, NS_OK);
  return rv;
}

NS_IMETHODIMP QuotingOutputStreamListener::OnDataAvailable(nsIRequest *request,
                              nsISupports *ctxt, nsIInputStream *inStr,
                              uint64_t sourceOffset, uint32_t count)
{
  nsresult rv = NS_OK;
  NS_ENSURE_ARG(inStr);

  if (mHeadersOnly)
    return rv;

  char *newBuf = (char *)PR_Malloc(count + 1);
  if (!newBuf)
    return NS_ERROR_FAILURE;

  uint32_t numWritten = 0;
  rv = inStr->Read(newBuf, count, &numWritten);
  if (rv == NS_BASE_STREAM_WOULD_BLOCK)
    rv = NS_OK;
  newBuf[numWritten] = '\0';
  if (NS_SUCCEEDED(rv) && numWritten > 0)
  {
    rv = AppendToMsgBody(nsDependentCString(newBuf, numWritten));
  }

  PR_FREEIF(newBuf);
  return rv;
}

NS_IMETHODIMP QuotingOutputStreamListener::AppendToMsgBody(const nsCString &inStr)
{
  nsresult rv = NS_OK;

  if (!inStr.IsEmpty())
  {
    // Create unicode decoder.
    if (!mUnicodeDecoder)
    {
      nsCOMPtr<nsICharsetConverterManager> ccm =
               do_GetService(NS_CHARSETCONVERTERMANAGER_CONTRACTID, &rv);
      if (NS_SUCCEEDED(rv))
      {
        rv = ccm->GetUnicodeDecoderRaw("UTF-8",
                                       getter_AddRefs(mUnicodeDecoder));
      }
    }

    if (NS_SUCCEEDED(rv))
    {
      int32_t unicharLength;
      int32_t inputLength = inStr.Length();
      rv = mUnicodeDecoder->GetMaxLength(inStr.get(), inStr.Length(), &unicharLength);
      if (NS_SUCCEEDED(rv))
      {
        // Use this local buffer if possible.
        const int32_t kLocalBufSize = 4096;
        PRUnichar localBuf[kLocalBufSize];
        PRUnichar *unichars = localBuf;

        if (unicharLength > kLocalBufSize)
        {
          // Otherwise, use the buffer of the class.
          if (!mUnicodeConversionBuffer ||
              unicharLength > mUnicodeBufferCharacterLength)
          {
            if (mUnicodeConversionBuffer)
              nsMemory::Free(mUnicodeConversionBuffer);
            mUnicodeConversionBuffer = (PRUnichar *) nsMemory::Alloc(unicharLength * sizeof(PRUnichar));
            if (!mUnicodeConversionBuffer)
            {
              mUnicodeBufferCharacterLength = 0;
              return NS_ERROR_OUT_OF_MEMORY;
            }
            mUnicodeBufferCharacterLength = unicharLength;
          }
          unichars = mUnicodeConversionBuffer;
        }

        int32_t consumedInputLength = 0;
        int32_t originalInputLength = inputLength;
        const char *inputBuffer = inStr.get();
        int32_t convertedOutputLength = 0;
        int32_t outputBufferLength = unicharLength;
        PRUnichar *originalOutputBuffer = unichars;
        do
        {
          rv = mUnicodeDecoder->Convert(inputBuffer, &inputLength, unichars, &unicharLength);
          if (NS_SUCCEEDED(rv))
          {
            convertedOutputLength += unicharLength;
            break;
          }

          // if we failed, we consume one byte, replace it with a question mark
          // and try the conversion again.
          unichars += unicharLength;
          *unichars = (PRUnichar)'?';
          unichars++;
          unicharLength++;

          mUnicodeDecoder->Reset();

          inputBuffer += ++inputLength;
          consumedInputLength += inputLength;
          inputLength = originalInputLength - consumedInputLength;  // update input length to convert
          convertedOutputLength += unicharLength;
          unicharLength = outputBufferLength - unicharLength;       // update output length

        } while (NS_FAILED(rv) &&
                 (originalInputLength > consumedInputLength) &&
                 (outputBufferLength > convertedOutputLength));

        if (convertedOutputLength > 0)
          mMsgBody.Append(originalOutputBuffer, convertedOutputLength);
      }
    }
  }

  return rv;
}

nsresult
QuotingOutputStreamListener::SetComposeObj(nsIMsgCompose *obj)
{
  mWeakComposeObj = do_GetWeakReference(obj);
  return NS_OK;
}

nsresult
QuotingOutputStreamListener::SetMimeHeaders(nsIMimeHeaders * headers)
{
  mHeaders = headers;
  return NS_OK;
}

NS_IMETHODIMP
QuotingOutputStreamListener::InsertToCompose(nsIEditor *aEditor,
                                             bool aHTMLEditor)
{
  // First, get the nsIEditor interface for future use
  nsCOMPtr<nsIDOMNode> nodeInserted;

  TranslateLineEnding(mMsgBody);

  // Now, insert it into the editor...
  if (aEditor)
    aEditor->EnableUndo(true);

  nsCOMPtr<nsIMsgCompose> compose = do_QueryReferent(mWeakComposeObj);
  if (!mMsgBody.IsEmpty() && compose)
  {
    compose->SetInsertingQuotedContent(true);
    if (!mCitePrefix.IsEmpty())
    {
      if (!aHTMLEditor)
        mCitePrefix.AppendLiteral("\n");
      nsCOMPtr<nsIPlaintextEditor> textEditor (do_QueryInterface(aEditor));
      if (textEditor)
        textEditor->InsertText(mCitePrefix);
    }

    nsCOMPtr<nsIEditorMailSupport> mailEditor (do_QueryInterface(aEditor));
    if (mailEditor)
    {
      if (aHTMLEditor)
        mailEditor->InsertAsCitedQuotation(mMsgBody, EmptyString(), true,
                                           getter_AddRefs(nodeInserted));
      else
        mailEditor->InsertAsQuotation(mMsgBody, getter_AddRefs(nodeInserted));
    }
    compose->SetInsertingQuotedContent(false);
  }

  if (aEditor)
  {
    nsCOMPtr<nsIPlaintextEditor> textEditor = do_QueryInterface(aEditor);
    if (textEditor)
    {
      nsCOMPtr<nsISelection> selection;
      nsCOMPtr<nsIDOMNode>   parent;
      int32_t                offset;
      nsresult               rv;

      // get parent and offset of mailcite
      rv = GetNodeLocation(nodeInserted, address_of(parent), &offset);
      NS_ENSURE_SUCCESS(rv, rv);

      // get selection
      aEditor->GetSelection(getter_AddRefs(selection));
      if (selection)
      {
        // place selection after mailcite
        selection->Collapse(parent, offset+1);
        // insert a break at current selection
        textEditor->InsertLineBreak();
        selection->Collapse(parent, offset+1);
      }
      nsCOMPtr<nsISelectionController> selCon;
      aEditor->GetSelectionController(getter_AddRefs(selCon));

      if (selCon)
        // After ScrollSelectionIntoView(), the pending notifications might be
        // flushed and PresShell/PresContext/Frames may be dead. See bug 418470.
        selCon->ScrollSelectionIntoView(
                  nsISelectionController::SELECTION_NORMAL,
                  nsISelectionController::SELECTION_ANCHOR_REGION,
                  true);
    }
  }

  return NS_OK;
}

NS_IMPL_ISUPPORTS3(QuotingOutputStreamListener,
                   nsIMsgQuotingOutputStreamListener,
                   nsIRequestObserver,
                   nsIStreamListener)

////////////////////////////////////////////////////////////////////////////////////
// END OF QUOTING LISTENER
////////////////////////////////////////////////////////////////////////////////////

/* attribute MSG_ComposeType type; */
NS_IMETHODIMP nsMsgCompose::SetType(MSG_ComposeType aType)
{

  mType = aType;
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::GetType(MSG_ComposeType *aType)
{
  NS_ENSURE_ARG_POINTER(aType);

  *aType = mType;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompose::QuoteMessage(const char *msgURI)
{
  NS_ENSURE_ARG_POINTER(msgURI);

  nsresult rv;
  mQuotingToFollow = false;

  // Create a mime parser (nsIStreamConverter)!
  mQuote = do_CreateInstance(NS_MSGQUOTE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  rv = GetMsgDBHdrFromURI(msgURI, getter_AddRefs(msgHdr));

  // Create the consumer output stream.. this will receive all the HTML from libmime
  mQuoteStreamListener =
    new QuotingOutputStreamListener(msgURI, msgHdr, false, !mHtmlToQuote.IsEmpty(), m_identity,
                                    m_compFields->GetCharacterSet(), mCharsetOverride, false,
                                    mHtmlToQuote);

  if (!mQuoteStreamListener)
    return NS_ERROR_FAILURE;
  NS_ADDREF(mQuoteStreamListener);

  mQuoteStreamListener->SetComposeObj(this);

  rv = mQuote->QuoteMessage(msgURI, false, mQuoteStreamListener,
                            mCharsetOverride ? m_compFields->GetCharacterSet() : "",
                            false, msgHdr);
  return rv;
}

nsresult
nsMsgCompose::QuoteOriginalMessage() // New template
{
  nsresult    rv;

  mQuotingToFollow = false;

  // Create a mime parser (nsIStreamConverter)!
  mQuote = do_CreateInstance(NS_MSGQUOTE_CONTRACTID, &rv);
  if (NS_FAILED(rv) || !mQuote)
    return NS_ERROR_FAILURE;

  bool bAutoQuote = true;
  m_identity->GetAutoQuote(&bAutoQuote);

  nsCOMPtr <nsIMsgDBHdr> originalMsgHdr = mOrigMsgHdr;
  if (!originalMsgHdr)
  {
    rv = GetMsgDBHdrFromURI(mOriginalMsgURI.get(), getter_AddRefs(originalMsgHdr));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  bool fileUrl = StringBeginsWith(mOriginalMsgURI, NS_LITERAL_CSTRING("file:"));
  if (fileUrl)
  {
    mOriginalMsgURI.Replace(0, 5, NS_LITERAL_CSTRING("mailbox:"));
    mOriginalMsgURI.AppendLiteral("?number=0");
  }

  // Create the consumer output stream.. this will receive all the HTML from libmime
  mQuoteStreamListener =
    new QuotingOutputStreamListener(mOriginalMsgURI.get(), originalMsgHdr, mWhatHolder != 1,
                                    !bAutoQuote || !mHtmlToQuote.IsEmpty(), m_identity,
                                    mQuoteCharset.get(), mCharsetOverride, true, mHtmlToQuote);

  if (!mQuoteStreamListener)
    return NS_ERROR_FAILURE;
  NS_ADDREF(mQuoteStreamListener);

  mQuoteStreamListener->SetComposeObj(this);

  rv = mQuote->QuoteMessage(mOriginalMsgURI.get(), mWhatHolder != 1, mQuoteStreamListener,
                            mCharsetOverride ? mQuoteCharset.get() : "",
                            !bAutoQuote, originalMsgHdr);
  return rv;
}

//CleanUpRecipient will remove un-necessary "<>" when a recipient as an address without name
void nsMsgCompose::CleanUpRecipients(nsString& recipients)
{
  uint16_t i;
  bool startANewRecipient = true;
  bool removeBracket = false;
  nsAutoString newRecipient;
  PRUnichar aChar;

  for (i = 0; i < recipients.Length(); i ++)
  {
    aChar = recipients[i];
    switch (aChar)
    {
      case '<'  :
        if (startANewRecipient)
          removeBracket = true;
        else
          newRecipient += aChar;
        startANewRecipient = false;
        break;

      case '>'  :
        if (removeBracket)
          removeBracket = false;
        else
          newRecipient += aChar;
        break;

      case ' '  :
        newRecipient += aChar;
        break;

      case ','  :
        newRecipient += aChar;
        startANewRecipient = true;
        removeBracket = false;
        break;

      default   :
        newRecipient += aChar;
        startANewRecipient = false;
        break;
    }
  }
  recipients = newRecipient;
}

NS_IMETHODIMP nsMsgCompose::RememberQueuedDisposition()
{
  // need to find the msg hdr in the saved folder and then set a property on
  // the header that we then look at when we actually send the message.
  nsresult rv;
  nsAutoCString dispositionSetting;

  if (mType == nsIMsgCompType::Reply ||
      mType == nsIMsgCompType::ReplyAll ||
      mType == nsIMsgCompType::ReplyToList ||
      mType == nsIMsgCompType::ReplyToGroup ||
      mType == nsIMsgCompType::ReplyToSender ||
      mType == nsIMsgCompType::ReplyToSenderAndGroup)
  {
    dispositionSetting.AssignLiteral("replied");
  }
  else if (mType == nsIMsgCompType::ForwardAsAttachment ||
           mType == nsIMsgCompType::ForwardInline)
  {
    dispositionSetting.AssignLiteral("forwarded");
  }
  else if (mType == nsIMsgCompType::Draft)
  {
    nsAutoCString curDraftIdURL;
    rv = m_compFields->GetDraftId(getter_Copies(curDraftIdURL));
    NS_ENSURE_SUCCESS(rv, rv);
    if (!curDraftIdURL.IsEmpty()) {
      nsCOMPtr <nsIMsgDBHdr> draftHdr;
      rv = GetMsgDBHdrFromURI(curDraftIdURL.get(), getter_AddRefs(draftHdr));
      NS_ENSURE_SUCCESS(rv, rv);
      draftHdr->GetStringProperty(QUEUED_DISPOSITION_PROPERTY, getter_Copies(dispositionSetting));
    }
  }

  nsMsgKey msgKey;
  if (mMsgSend)
  {
    mMsgSend->GetMessageKey(&msgKey);
    nsAutoCString msgUri(m_folderName);
    nsCString identityKey;

    m_identity->GetKey(identityKey);

    int32_t insertIndex = StringBeginsWith(msgUri, NS_LITERAL_CSTRING("mailbox")) ? 7 : 4;
    msgUri.Insert("-message", insertIndex); // "mailbox/imap: -> "mailbox/imap-message:"
    msgUri.Append('#');
    msgUri.AppendInt(msgKey);
    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    rv = GetMsgDBHdrFromURI(msgUri.get(), getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);
    uint32_t pseudoHdrProp = 0;
    msgHdr->GetUint32Property("pseudoHdr", &pseudoHdrProp);
    if (pseudoHdrProp)
    {
      // Use SetAttributeOnPendingHdr for IMAP pseudo headers, as those
      // will get deleted (and properties set using SetStringProperty lost.)
      nsCOMPtr<nsIMsgFolder> folder;
      rv = msgHdr->GetFolder(getter_AddRefs(folder));
      NS_ENSURE_SUCCESS(rv,rv);
      nsCOMPtr<nsIMsgDatabase> msgDB;
      rv = folder->GetMsgDatabase(getter_AddRefs(msgDB));
      NS_ENSURE_SUCCESS(rv,rv);

      nsCString messageId;
      mMsgSend->GetMessageId(messageId);
      msgHdr->SetMessageId(messageId.get());
      if (!mOriginalMsgURI.IsEmpty())
      {
        msgDB->SetAttributeOnPendingHdr(msgHdr, ORIG_URI_PROPERTY, mOriginalMsgURI.get());
        if (!dispositionSetting.IsEmpty())
          msgDB->SetAttributeOnPendingHdr(msgHdr, QUEUED_DISPOSITION_PROPERTY,
                                          dispositionSetting.get());
      }
      msgDB->SetAttributeOnPendingHdr(msgHdr, HEADER_X_MOZILLA_IDENTITY_KEY, identityKey.get());
    }
    else if (msgHdr)
    {
      if (!mOriginalMsgURI.IsEmpty())
      {
        msgHdr->SetStringProperty(ORIG_URI_PROPERTY, mOriginalMsgURI.get());
        if (!dispositionSetting.IsEmpty())
          msgHdr->SetStringProperty(QUEUED_DISPOSITION_PROPERTY, dispositionSetting.get());
      }
      msgHdr->SetStringProperty(HEADER_X_MOZILLA_IDENTITY_KEY, identityKey.get());
    }
  }
  return NS_OK;
}

nsresult nsMsgCompose::ProcessReplyFlags()
{
  nsresult rv;
  // check to see if we were doing a reply or a forward, if we were, set the answered field flag on the message folder
  // for this URI.
  if (mType == nsIMsgCompType::Reply ||
      mType == nsIMsgCompType::ReplyAll ||
      mType == nsIMsgCompType::ReplyToList ||
      mType == nsIMsgCompType::ReplyToGroup ||
      mType == nsIMsgCompType::ReplyToSender ||
      mType == nsIMsgCompType::ReplyToSenderAndGroup ||
      mType == nsIMsgCompType::ForwardAsAttachment ||
      mType == nsIMsgCompType::ForwardInline ||
      mDraftDisposition != nsIMsgFolder::nsMsgDispositionState_None)
  {
    if (!mOriginalMsgURI.IsEmpty())
    {
      nsCString msgUri (mOriginalMsgURI);
      char *newStr = msgUri.BeginWriting();
      char *uri;
      while (nullptr != (uri = NS_strtok(",", &newStr)))
      {
        nsCOMPtr <nsIMsgDBHdr> msgHdr;
        rv = GetMsgDBHdrFromURI(uri, getter_AddRefs(msgHdr));
        NS_ENSURE_SUCCESS(rv,rv);
        if (msgHdr)
        {
          // get the folder for the message resource
          nsCOMPtr<nsIMsgFolder> msgFolder;
          msgHdr->GetFolder(getter_AddRefs(msgFolder));
          if (msgFolder)
          {
            // If it's a draft with disposition, default to replied, otherwise,
            // check if it's a forward.
            nsMsgDispositionState dispositionSetting = nsIMsgFolder::nsMsgDispositionState_Replied;
            if (mDraftDisposition != nsIMsgFolder::nsMsgDispositionState_None)
              dispositionSetting = mDraftDisposition;
            else if (mType == nsIMsgCompType::ForwardAsAttachment ||
                mType == nsIMsgCompType::ForwardInline)
              dispositionSetting = nsIMsgFolder::nsMsgDispositionState_Forwarded;

            msgFolder->AddMessageDispositionState(msgHdr, dispositionSetting);
            if (mType != nsIMsgCompType::ForwardAsAttachment)
              break;         // just safeguard
          }
        }
      }
    }
  }

  return NS_OK;
}
NS_IMETHODIMP nsMsgCompose::OnStartSending(const char *aMsgID, uint32_t aMsgSize)
{
  nsTObserverArray<nsCOMPtr<nsIMsgSendListener> >::ForwardIterator iter(mExternalSendListeners);
  nsCOMPtr<nsIMsgSendListener> externalSendListener;

  while (iter.HasMore())
  {
    externalSendListener = iter.GetNext();
    externalSendListener->OnStartSending(aMsgID, aMsgSize);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::OnProgress(const char *aMsgID, uint32_t aProgress, uint32_t aProgressMax)
{
  nsTObserverArray<nsCOMPtr<nsIMsgSendListener> >::ForwardIterator iter(mExternalSendListeners);
  nsCOMPtr<nsIMsgSendListener> externalSendListener;

  while (iter.HasMore())
  {
    externalSendListener = iter.GetNext();
    externalSendListener->OnProgress(aMsgID, aProgress, aProgressMax);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::OnStatus(const char *aMsgID, const PRUnichar *aMsg)
{
  nsTObserverArray<nsCOMPtr<nsIMsgSendListener> >::ForwardIterator iter(mExternalSendListeners);
  nsCOMPtr<nsIMsgSendListener> externalSendListener;

  while (iter.HasMore())
  {
    externalSendListener = iter.GetNext();
    externalSendListener->OnStatus(aMsgID, aMsg);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::OnStopSending(const char *aMsgID, nsresult aStatus, const PRUnichar *aMsg,
                                      nsIFile *returnFile)
{
  nsTObserverArray<nsCOMPtr<nsIMsgSendListener> >::ForwardIterator iter(mExternalSendListeners);
  nsCOMPtr<nsIMsgSendListener> externalSendListener;

  while (iter.HasMore())
  {
    externalSendListener = iter.GetNext();
    externalSendListener->OnStopSending(aMsgID, aStatus, aMsg, returnFile);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::OnSendNotPerformed(const char *aMsgID, nsresult aStatus)
{
  nsTObserverArray<nsCOMPtr<nsIMsgSendListener> >::ForwardIterator iter(mExternalSendListeners);
  nsCOMPtr<nsIMsgSendListener> externalSendListener;

  while (iter.HasMore())
  {
    externalSendListener = iter.GetNext();
    externalSendListener->OnSendNotPerformed(aMsgID, aStatus);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgCompose::OnGetDraftFolderURI(const char *aFolderURI)
{
  m_folderName = aFolderURI;
  nsTObserverArray<nsCOMPtr<nsIMsgSendListener> >::ForwardIterator iter(mExternalSendListeners);
  nsCOMPtr<nsIMsgSendListener> externalSendListener;

  while (iter.HasMore())
  {
    externalSendListener = iter.GetNext();
    externalSendListener->OnGetDraftFolderURI(aFolderURI);
  }
  return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////////
// This is the listener class for both the send operation and the copy operation.
// We have to create this class to listen for message send completion and deal with
// failures in both send and copy operations
////////////////////////////////////////////////////////////////////////////////////
NS_IMPL_ADDREF(nsMsgComposeSendListener)
NS_IMPL_RELEASE(nsMsgComposeSendListener)

/*
NS_IMPL_QUERY_INTERFACE4(nsMsgComposeSendListener,
                         nsIMsgComposeSendListener,
                         nsIMsgSendListener,
                         nsIMsgCopyServiceListener,
                         nsIWebProgressListener)
*/
NS_INTERFACE_MAP_BEGIN(nsMsgComposeSendListener)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMsgComposeSendListener)
  NS_INTERFACE_MAP_ENTRY(nsIMsgComposeSendListener)
  NS_INTERFACE_MAP_ENTRY(nsIMsgSendListener)
  NS_INTERFACE_MAP_ENTRY(nsIMsgCopyServiceListener)
  NS_INTERFACE_MAP_ENTRY(nsIWebProgressListener)
NS_INTERFACE_MAP_END


nsMsgComposeSendListener::nsMsgComposeSendListener(void)
{
  mDeliverMode = 0;
}

nsMsgComposeSendListener::~nsMsgComposeSendListener(void)
{
}

NS_IMETHODIMP nsMsgComposeSendListener::SetMsgCompose(nsIMsgCompose *obj)
{
  mWeakComposeObj = do_GetWeakReference(obj);
  return NS_OK;
}

NS_IMETHODIMP nsMsgComposeSendListener::SetDeliverMode(MSG_DeliverMode deliverMode)
{
  mDeliverMode = deliverMode;
  return NS_OK;
}

nsresult
nsMsgComposeSendListener::OnStartSending(const char *aMsgID, uint32_t aMsgSize)
{
  nsresult rv;
  nsCOMPtr<nsIMsgSendListener> composeSendListener = do_QueryReferent(mWeakComposeObj, &rv);
  if (NS_SUCCEEDED(rv) && composeSendListener)
    composeSendListener->OnStartSending(aMsgID, aMsgSize);

  return NS_OK;
}

nsresult
nsMsgComposeSendListener::OnProgress(const char *aMsgID, uint32_t aProgress, uint32_t aProgressMax)
{
  nsresult rv;
  nsCOMPtr<nsIMsgSendListener> composeSendListener = do_QueryReferent(mWeakComposeObj, &rv);
  if (NS_SUCCEEDED(rv) && composeSendListener)
    composeSendListener->OnProgress(aMsgID, aProgress, aProgressMax);
  return NS_OK;
}

nsresult
nsMsgComposeSendListener::OnStatus(const char *aMsgID, const PRUnichar *aMsg)
{
  nsresult rv;
  nsCOMPtr<nsIMsgSendListener> composeSendListener = do_QueryReferent(mWeakComposeObj, &rv);
  if (NS_SUCCEEDED(rv) && composeSendListener)
    composeSendListener->OnStatus(aMsgID, aMsg);
  return NS_OK;
}

nsresult nsMsgComposeSendListener::OnSendNotPerformed(const char *aMsgID, nsresult aStatus)
{
 // since OnSendNotPerformed is called in the case where the user aborts the operation
 // by closing the compose window, we need not do the stuff required
 // for closing the windows. However we would need to do the other operations as below.

  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgCompose> msgCompose = do_QueryReferent(mWeakComposeObj, &rv);
  if (msgCompose)
    msgCompose->NotifyStateListeners(nsIMsgComposeNotificationType::ComposeProcessDone, aStatus);

  nsCOMPtr<nsIMsgSendListener> composeSendListener = do_QueryReferent(mWeakComposeObj, &rv);
  if (NS_SUCCEEDED(rv) && composeSendListener)
    composeSendListener->OnSendNotPerformed(aMsgID, aStatus);

  return rv;
}

nsresult nsMsgComposeSendListener::OnStopSending(const char *aMsgID, nsresult aStatus,
                                                 const PRUnichar *aMsg, nsIFile *returnFile)
{
  nsresult rv = NS_OK;

  nsCOMPtr<nsIMsgCompose> msgCompose = do_QueryReferent(mWeakComposeObj, &rv);
  if (msgCompose)
  {
    nsCOMPtr<nsIMsgProgress> progress;
    msgCompose->GetProgress(getter_AddRefs(progress));

    if (NS_SUCCEEDED(aStatus))
    {
      nsCOMPtr<nsIMsgCompFields> compFields;
      msgCompose->GetCompFields(getter_AddRefs(compFields));

      // only process the reply flags if we successfully sent the message
      msgCompose->ProcessReplyFlags();

      // See if there is a composer window
      bool hasDomWindow = true;
      nsCOMPtr<nsIDOMWindow> domWindow;
      rv = msgCompose->GetDomWindow(getter_AddRefs(domWindow));
      if (NS_FAILED(rv) || !domWindow)
        hasDomWindow = false;

      // Close the window ONLY if we are not going to do a save operation
      nsAutoString fieldsFCC;
      if (NS_SUCCEEDED(compFields->GetFcc(fieldsFCC)))
      {
        if (!fieldsFCC.IsEmpty())
        {
          if (fieldsFCC.LowerCaseEqualsLiteral("nocopy://"))
          {
            msgCompose->NotifyStateListeners(nsIMsgComposeNotificationType::ComposeProcessDone, NS_OK);
            if (progress)
            {
              progress->UnregisterListener(this);
              progress->CloseProgressDialog(false);
            }
            if (hasDomWindow)
              msgCompose->CloseWindow(true);
          }
        }
      }
      else
      {
        msgCompose->NotifyStateListeners(nsIMsgComposeNotificationType::ComposeProcessDone, NS_OK);
        if (progress)
        {
          progress->UnregisterListener(this);
          progress->CloseProgressDialog(false);
        }
        if (hasDomWindow)
          msgCompose->CloseWindow(true);  // if we fail on the simple GetFcc call, close the window to be safe and avoid
                                              // windows hanging around to prevent the app from exiting.
      }

      // Remove the current draft msg when sending draft is done.
      bool deleteDraft;
      msgCompose->GetDeleteDraft(&deleteDraft);
      if (deleteDraft)
        RemoveCurrentDraftMessage(msgCompose, false);
    }
    else
    {
      msgCompose->NotifyStateListeners(nsIMsgComposeNotificationType::ComposeProcessDone, aStatus);
      if (progress)
      {
        progress->CloseProgressDialog(true);
        progress->UnregisterListener(this);
      }
    }

  }

  nsCOMPtr<nsIMsgSendListener> composeSendListener = do_QueryReferent(mWeakComposeObj, &rv);
  if (NS_SUCCEEDED(rv) && composeSendListener)
    composeSendListener->OnStopSending(aMsgID, aStatus, aMsg, returnFile);

  return rv;
}

nsresult
nsMsgComposeSendListener::OnGetDraftFolderURI(const char *aFolderURI)
{
  nsresult rv;
  nsCOMPtr<nsIMsgSendListener> composeSendListener = do_QueryReferent(mWeakComposeObj, &rv);
  if (NS_SUCCEEDED(rv) && composeSendListener)
    composeSendListener->OnGetDraftFolderURI(aFolderURI);

  return NS_OK;
}


nsresult
nsMsgComposeSendListener::OnStartCopy()
{
  return NS_OK;
}

nsresult
nsMsgComposeSendListener::OnProgress(uint32_t aProgress, uint32_t aProgressMax)
{
  return NS_OK;
}

nsresult
nsMsgComposeSendListener::OnStopCopy(nsresult aStatus)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgCompose> msgCompose = do_QueryReferent(mWeakComposeObj, &rv);
  if (msgCompose)
  {
    if (mDeliverMode == nsIMsgSend::nsMsgQueueForLater ||
        mDeliverMode == nsIMsgSend::nsMsgDeliverBackground ||
        mDeliverMode == nsIMsgSend::nsMsgSaveAsDraft)
    {
      msgCompose->RememberQueuedDisposition();
    }

    // Ok, if we are here, we are done with the send/copy operation so
    // we have to do something with the window....SHOW if failed, Close
    // if succeeded

    nsCOMPtr<nsIMsgProgress> progress;
    msgCompose->GetProgress(getter_AddRefs(progress));
    if (progress)
    {
      // Unregister ourself from msg compose progress
      progress->UnregisterListener(this);
      progress->CloseProgressDialog(NS_FAILED(aStatus));
    }

    msgCompose->NotifyStateListeners(nsIMsgComposeNotificationType::ComposeProcessDone, aStatus);

    if (NS_SUCCEEDED(aStatus))
    {
      // We should only close the window if we are done. Things like templates
      // and drafts aren't done so their windows should stay open
      if (mDeliverMode == nsIMsgSend::nsMsgSaveAsDraft ||
          mDeliverMode == nsIMsgSend::nsMsgSaveAsTemplate)
      {
        msgCompose->NotifyStateListeners(nsIMsgComposeNotificationType::SaveInFolderDone, aStatus);
        // Remove the current draft msg when saving as draft/template is done.
        msgCompose->SetDeleteDraft(true);
        RemoveCurrentDraftMessage(msgCompose, true);
      }
      else
      {
        // Remove (possible) draft if we're in send later mode
        if (mDeliverMode == nsIMsgSend::nsMsgQueueForLater ||
            mDeliverMode == nsIMsgSend::nsMsgDeliverBackground)
        {
          msgCompose->SetDeleteDraft(true);
          RemoveCurrentDraftMessage(msgCompose, true);
        }
        msgCompose->CloseWindow(true);
      }
    }
    msgCompose->ClearMessageSend();
  }

  return rv;
}

nsresult
nsMsgComposeSendListener::GetMsgFolder(nsIMsgCompose *compObj, nsIMsgFolder **msgFolder)
{
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> aMsgFolder;
  nsCString folderUri;

  rv = compObj->GetSavedFolderURI(getter_Copies(folderUri));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFService> rdfService (do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIRDFResource> resource;
  rv = rdfService->GetResource(folderUri, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);

  aMsgFolder = do_QueryInterface(resource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  NS_IF_ADDREF(*msgFolder = aMsgFolder);
  return rv;
}

nsresult
nsMsgComposeSendListener::RemoveCurrentDraftMessage(nsIMsgCompose *compObj, bool calledByCopy)
{
  nsresult rv;
  nsCOMPtr <nsIMsgCompFields> compFields = nullptr;

  rv = compObj->GetCompFields(getter_AddRefs(compFields));
  NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't get compose fields");
  if (NS_FAILED(rv) || !compFields)
    return rv;

  nsCString curDraftIdURL;
  nsMsgKey newUid = 0;
  nsCString newDraftIdURL;
  nsCOMPtr<nsIMsgFolder> msgFolder;

  rv = compFields->GetDraftId(getter_Copies(curDraftIdURL));
  NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't get draft id");

  // Skip if no draft id (probably a new draft msg).
  if (NS_SUCCEEDED(rv) && !curDraftIdURL.IsEmpty())
  {
    nsCOMPtr <nsIMsgDBHdr> msgDBHdr;
    rv = GetMsgDBHdrFromURI(curDraftIdURL.get(), getter_AddRefs(msgDBHdr));
    NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't get msg header DB interface pointer.");
    if (NS_SUCCEEDED(rv) && msgDBHdr)
    {
      // get the folder for the message resource
      msgDBHdr->GetFolder(getter_AddRefs(msgFolder));
      NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't get msg folder interface pointer.");
      if (NS_SUCCEEDED(rv) && msgFolder)
      {
        uint32_t folderFlags;
        msgFolder->GetFlags(&folderFlags);
        // only do this if it's a drafts or templates folder.
        if (folderFlags & nsMsgFolderFlags::Drafts)
        {
          // build the msg arrary
          nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
          NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't allocate array.");

          //nsCOMPtr<nsISupports> msgSupport = do_QueryInterface(msgDBHdr, &rv);
          //NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't get msg header interface pointer.");
          if (NS_SUCCEEDED(rv) && messageArray)
          {
            // ready to delete the msg
            rv = messageArray->AppendElement(msgDBHdr, false);
            NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't append msg header to array.");
            if (NS_SUCCEEDED(rv))
              rv = msgFolder->DeleteMessages(messageArray, nullptr, true, false, nullptr, false /*allowUndo*/);
            NS_ASSERTION(NS_SUCCEEDED(rv), "RemoveCurrentDraftMessage can't delete message.");
          }
        }
      }
    }
    else
    {
      // If we get here we have the case where the draft folder
      // is on the server and
      // it's not currently open (in thread pane), so draft
      // msgs are saved to the server
      // but they're not in our local DB. In this case,
      // GetMsgDBHdrFromURI() will never
      // find the msg. If the draft folder is a local one
      // then we'll not get here because
      // the draft msgs are saved to the local folder and
      // are in local DB. Make sure the
      // msg folder is imap.  Even if we get here due to
      // DB errors (worst case), we should
      // still try to delete msg on the server because
      // that's where the master copy of the
      // msgs are stored, if draft folder is on the server.
      // For local case, since DB is bad
      // we can't do anything with it anyway so it'll be
      // noop in this case.
      rv = GetMsgFolder(compObj, getter_AddRefs(msgFolder));
      if (NS_SUCCEEDED(rv) && msgFolder)
      {
        nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(msgFolder);
        NS_ASSERTION(imapFolder, "The draft folder MUST be an imap folder in order to mark the msg delete!");
        if (NS_SUCCEEDED(rv) && imapFolder)
        {
          const char * str = PL_strchr(curDraftIdURL.get(), '#');
          NS_ASSERTION(str, "Failed to get current draft id url");
          if (str)
          {
            nsAutoCString srcStr(str+1);
            nsresult err;
            nsMsgKey messageID = srcStr.ToInteger(&err);
            if (messageID != nsMsgKey_None)
            {
              rv = imapFolder->StoreImapFlags(kImapMsgDeletedFlag, true,
                                              &messageID, 1, nullptr);
            }
          }
        }
      }
    }
  }

  // Now get the new uid so that next save will remove the right msg
  // regardless whether or not the exiting msg can be deleted.
  if (calledByCopy)
  {
    nsCOMPtr<nsIMsgFolder> savedToFolder;
    nsCOMPtr<nsIMsgSend> msgSend;
    rv = compObj->GetMessageSend(getter_AddRefs(msgSend));
    NS_ASSERTION(msgSend, "RemoveCurrentDraftMessage msgSend is null.");
    if (NS_FAILED(rv) || !msgSend)
      return rv;

    rv = msgSend->GetMessageKey(&newUid);
    NS_ENSURE_SUCCESS(rv, rv);

    // Make sure we have a folder interface pointer
    rv = GetMsgFolder(compObj, getter_AddRefs(savedToFolder));

    // Reset draft (uid) url with the new uid.
    if (savedToFolder && newUid != nsMsgKey_None)
    {
      uint32_t folderFlags;
      savedToFolder->GetFlags(&folderFlags);
      if (folderFlags & nsMsgFolderFlags::Drafts)
      {
        rv = savedToFolder->GenerateMessageURI(newUid, newDraftIdURL);
        NS_ENSURE_SUCCESS(rv, rv);
        compFields->SetDraftId(newDraftIdURL.get());
      }
    }
  }
  return rv;
}

nsresult
nsMsgComposeSendListener::SetMessageKey(uint32_t aMessageKey)
{
  return NS_OK;
}

nsresult
nsMsgComposeSendListener::GetMessageId(nsACString& messageId)
{
  return NS_OK;
}

/* void onStateChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in unsigned long aStateFlags, in nsresult aStatus); */
NS_IMETHODIMP nsMsgComposeSendListener::OnStateChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, uint32_t aStateFlags, nsresult aStatus)
{
  if (aStateFlags == nsIWebProgressListener::STATE_STOP)
  {
    nsCOMPtr<nsIMsgCompose> msgCompose = do_QueryReferent(mWeakComposeObj);
    if (msgCompose)
    {
      nsCOMPtr<nsIMsgProgress> progress;
      msgCompose->GetProgress(getter_AddRefs(progress));

      // Time to stop any pending operation...
      if (progress)
      {
        // Unregister ourself from msg compose progress
        progress->UnregisterListener(this);

        bool bCanceled = false;
        progress->GetProcessCanceledByUser(&bCanceled);
        if (bCanceled)
        {
          nsresult rv;
          nsCOMPtr<nsIStringBundleService> bundleService =
            mozilla::services::GetStringBundleService();
          NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
          nsCOMPtr<nsIStringBundle> bundle;
          rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
          NS_ENSURE_SUCCESS(rv, rv);
          nsString msg;
          bundle->GetStringFromID(NS_ERROR_GET_CODE(NS_MSG_CANCELLING), getter_Copies(msg));
          progress->OnStatusChange(nullptr, nullptr, NS_OK, msg.get());
        }
      }

      nsCOMPtr<nsIMsgSend> msgSend;
      msgCompose->GetMessageSend(getter_AddRefs(msgSend));
      if (msgSend)
        msgSend->Abort();
    }
  }
  return NS_OK;
}

/* void onProgressChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in long aCurSelfProgress, in long aMaxSelfProgress, in long aCurTotalProgress, in long aMaxTotalProgress); */
NS_IMETHODIMP nsMsgComposeSendListener::OnProgressChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, int32_t aCurSelfProgress, int32_t aMaxSelfProgress, int32_t aCurTotalProgress, int32_t aMaxTotalProgress)
{
  /* Ignore this call */
  return NS_OK;
}

/* void onLocationChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in nsIURI location, in unsigned long aFlags); */
NS_IMETHODIMP nsMsgComposeSendListener::OnLocationChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, nsIURI *location, uint32_t aFlags)
{
  /* Ignore this call */
  return NS_OK;
}

/* void onStatusChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in nsresult aStatus, in wstring aMessage); */
NS_IMETHODIMP nsMsgComposeSendListener::OnStatusChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, nsresult aStatus, const PRUnichar *aMessage)
{
  /* Ignore this call */
  return NS_OK;
}

/* void onSecurityChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in unsigned long state); */
NS_IMETHODIMP nsMsgComposeSendListener::OnSecurityChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, uint32_t state)
{
  /* Ignore this call */
  return NS_OK;
}

nsresult
nsMsgCompose::ConvertHTMLToText(nsIFile *aSigFile, nsString &aSigData)
{
  nsAutoString origBuf;

  nsresult rv = LoadDataFromFile(aSigFile, origBuf);
  NS_ENSURE_SUCCESS (rv, rv);

  ConvertBufToPlainText(origBuf, false, true);
  aSigData = origBuf;
  return NS_OK;
}

nsresult
nsMsgCompose::ConvertTextToHTML(nsIFile *aSigFile, nsString &aSigData)
{
  nsresult    rv;
  nsAutoString    origBuf;

  rv = LoadDataFromFile(aSigFile, origBuf);
  if (NS_FAILED(rv))
    return rv;

  // Ok, once we are here, we need to escape the data to make sure that
  // we don't do HTML stuff with plain text sigs.
  //
  PRUnichar *escaped = MsgEscapeHTML2(origBuf.get(), origBuf.Length());
  if (escaped)
  {
    aSigData.Append(escaped);
    NS_Free(escaped);
  }
  else
    aSigData.Append(origBuf);
  return NS_OK;
}

nsresult
nsMsgCompose::LoadDataFromFile(nsIFile *file, nsString &sigData,
                               bool aAllowUTF8, bool aAllowUTF16)
{
  int32_t       readSize;
  uint32_t       nGot;
  char          *readBuf;
  char          *ptr;

  bool isDirectory = false;
  file->IsDirectory(&isDirectory);
  if (isDirectory) {
    NS_ERROR("file is a directory");
    return NS_MSG_ERROR_READING_FILE;
  }


  nsCOMPtr <nsIInputStream> inputFile;
  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(inputFile), file);
  if (NS_FAILED(rv))
    return NS_MSG_ERROR_READING_FILE;

  int64_t fileSize;
  file->GetFileSize(&fileSize);
  readSize = (uint32_t) fileSize;


  ptr = readBuf = (char *)PR_Malloc(readSize + 1);  if (!readBuf)
    return NS_ERROR_OUT_OF_MEMORY;
  memset(readBuf, 0, readSize + 1);

  while (readSize) {
    inputFile->Read(ptr, readSize, &nGot);
    if (nGot) {
      readSize -= nGot;
      ptr += nGot;
    }
    else {
      readSize = 0;
    }
  }
  inputFile->Close();

  readSize = (uint32_t) fileSize;

  nsAutoCString sigEncoding(nsMsgI18NParseMetaCharset(file));
  bool removeSigCharset = !sigEncoding.IsEmpty() && m_composeHTML;

  if (sigEncoding.IsEmpty()) {
    if (aAllowUTF8 && MsgIsUTF8(nsDependentCString(readBuf))) {
      sigEncoding.Assign("UTF-8");
    }
    else if (sigEncoding.IsEmpty() && aAllowUTF16 &&
             readSize % 2 == 0 && readSize >= 2 &&
             ((readBuf[0] == char(0xFE) && readBuf[1] == char(0xFF)) ||
              (readBuf[0] == char(0xFF) && readBuf[1] == char(0xFE)))) {
      sigEncoding.Assign("UTF-16");
    }
    else {
      //default to platform encoding for plain text files w/o meta charset
      nsAutoCString textFileCharset;
      nsMsgI18NTextFileCharset(textFileCharset);
      sigEncoding.Assign(textFileCharset);
    }
  }

  nsAutoCString readStr(readBuf, (int32_t) fileSize);
  PR_FREEIF(readBuf);

  if (NS_FAILED(ConvertToUnicode(sigEncoding.get(), readStr, sigData)))
    CopyASCIItoUTF16(readStr, sigData);

  //remove sig meta charset to allow user charset override during composition
  if (removeSigCharset)
  {
    nsAutoCString metaCharset("charset=");
    metaCharset.Append(sigEncoding);
    int32_t pos = sigData.Find(metaCharset.BeginReading(), true);
    if (pos != kNotFound)
      sigData.Cut(pos, metaCharset.Length());
  }

  return NS_OK;
}

nsresult
nsMsgCompose::BuildQuotedMessageAndSignature(void)
{
  //
  // This should never happen...if it does, just bail out...
  //
  NS_ASSERTION(m_editor, "BuildQuotedMessageAndSignature but no editor!\n");
  if (!m_editor)
    return NS_ERROR_FAILURE;

  // We will fire off the quote operation and wait for it to
  // finish before we actually do anything with Ender...
  return QuoteOriginalMessage();
}

//
// This will process the signature file for the user. This method
// will always append the results to the mMsgBody member variable.
//
nsresult
nsMsgCompose::ProcessSignature(nsIMsgIdentity *identity, bool aQuoted, nsString *aMsgBody)
{
  nsresult    rv = NS_OK;

  // Now, we can get sort of fancy. This is the time we need to check
  // for all sorts of user defined stuff, like signatures and editor
  // types and the like!
  //
  //    user_pref(".....sig_file", "y:\\sig.html");
  //    user_pref(".....attach_signature", true);
  //    user_pref(".....htmlSigText", "unicode sig");
  //
  // Note: We will have intelligent signature behavior in that we
  // look at the signature file first...if the extension is .htm or
  // .html, we assume its HTML, otherwise, we assume it is plain text
  //
  // ...and that's not all! What we will also do now is look and see if
  // the file is an image file. If it is an image file, then we should
  // insert the correct HTML into the composer to have it work, but if we
  // are doing plain text compose, we should insert some sort of message
  // saying "Image Signature Omitted" or something (not done yet).
  //
  // If there's a sig pref, it will only be used if there is no sig file defined,
  // thus if attach_signature is checked, htmlSigText is ignored (bug 324495).
  // Plain-text signatures may or may not have a trailing line break (bug 428040).

  nsAutoCString sigNativePath;
  bool          attachFile = false;
  bool          useSigFile = false;
  bool          htmlSig = false;
  bool          imageSig = false;
  nsAutoString  sigData;
  nsAutoString sigOutput;
  int32_t      reply_on_top = 0;
  bool         sig_bottom = true;
  bool          suppressSigSep = false;

  nsCOMPtr<nsIFile> sigFile;
  if (identity)
  {
    if (!CheckIncludeSignaturePrefs(identity))
      return NS_OK;

    identity->GetReplyOnTop(&reply_on_top);
    identity->GetSigBottom(&sig_bottom);
    identity->GetSuppressSigSep(&suppressSigSep);

    rv = identity->GetAttachSignature(&attachFile);
    if (NS_SUCCEEDED(rv) && attachFile)
    {
      rv = identity->GetSignature(getter_AddRefs(sigFile));
      if (NS_SUCCEEDED(rv) && sigFile) {
        rv = sigFile->GetNativePath(sigNativePath);
        if (NS_SUCCEEDED(rv) && !sigNativePath.IsEmpty()) {
          bool exists = false;
          sigFile->Exists(&exists);
          if (exists) {
            useSigFile = true; // ok, there's a signature file

            // Now, most importantly, we need to figure out what the content type is for
            // this signature...if we can't, we assume text
            nsAutoCString sigContentType;
            nsresult rv2; // don't want to clobber the other rv
            nsCOMPtr<nsIMIMEService> mimeFinder (do_GetService(NS_MIMESERVICE_CONTRACTID, &rv2));
            if (NS_SUCCEEDED(rv2)) {
              rv2 = mimeFinder->GetTypeFromFile(sigFile, sigContentType);
              if (NS_SUCCEEDED(rv2)) {
                if (StringBeginsWith(sigContentType, NS_LITERAL_CSTRING("image/"), nsCaseInsensitiveCStringComparator()))
                  imageSig = true;
                else if (sigContentType.Equals(TEXT_HTML, nsCaseInsensitiveCStringComparator()))
                  htmlSig = true;
              }
            }
          }
        }
      }
    }
  }

  // Unless signature to be attached from file, use preference value;
  // the htmlSigText value is always going to be treated as html if
  // the htmlSigFormat pref is true, otherwise it is considered text
  nsString prefSigText;
  if (identity && !attachFile)
    identity->GetHtmlSigText(prefSigText);
  // Now, if they didn't even want to use a signature, we should
  // just return nicely.
  //
  if ((!useSigFile  && prefSigText.IsEmpty()) || NS_FAILED(rv))
    return NS_OK;

  static const char      htmlBreak[] = "<br>";
  static const char      dashes[] = "-- ";
  static const char      htmlsigopen[] = "<div class=\"moz-signature\">";
  static const char      htmlsigclose[] = "</div>";    /* XXX: Due to a bug in
                             4.x' HTML editor, it will not be able to
                             break this HTML sig, if quoted (for the user to
                             interleave a comment). */
  static const char      _preopen[] = "<pre class=\"moz-signature\" cols=%d>";
  char*                  preopen;
  static const char      preclose[] = "</pre>";

  int32_t wrapLength = 72; // setup default value in case GetWrapLength failed
  GetWrapLength(&wrapLength);
  preopen = PR_smprintf(_preopen, wrapLength);
  if (!preopen)
    return NS_ERROR_OUT_OF_MEMORY;

  if (imageSig)
  {
    // We have an image signature. If we're using the in HTML composer, we
    // should put in the appropriate HTML for inclusion, otherwise, do nothing.
    if (m_composeHTML)
    {
      sigOutput.AppendLiteral(htmlBreak);
      sigOutput.AppendLiteral(htmlsigopen);
      if ((mType == nsIMsgCompType::NewsPost || !suppressSigSep) &&
          (reply_on_top != 1 || sig_bottom || !aQuoted)) {
        sigOutput.AppendLiteral(dashes);
      }

      sigOutput.AppendLiteral(htmlBreak);
      sigOutput.AppendLiteral("<img src=\"file:///");
           /* XXX pp This gives me 4 slashes on Unix, that's at least one to
              much. Better construct the URL with some service. */
      // this isn't right on windows - need to convert to url format...
      sigOutput.Append(NS_ConvertASCIItoUTF16(sigNativePath));
      sigOutput.AppendLiteral("\" border=0>");
      sigOutput.AppendLiteral(htmlsigclose);
    }
  }
  else if (useSigFile)
  {
    // is this a text sig with an HTML editor?
    if ( (m_composeHTML) && (!htmlSig) )
      ConvertTextToHTML(sigFile, sigData);
    // is this a HTML sig with a text window?
    else if ( (!m_composeHTML) && (htmlSig) )
      ConvertHTMLToText(sigFile, sigData);
    else // We have a match...
      LoadDataFromFile(sigFile, sigData);  // Get the data!
  }

  // if we have a prefSigText, append it to sigData.
  if (!prefSigText.IsEmpty())
  {
    // set htmlSig if the pref is supposed to contain HTML code, defaults to false
    rv = identity->GetHtmlSigFormat(&htmlSig);
    if (NS_FAILED(rv))
      htmlSig = false;

    if (!m_composeHTML)
    {
      if (htmlSig)
        ConvertBufToPlainText(prefSigText, false, true);
      sigData.Append(prefSigText);
    }
    else
    {
      if (!htmlSig)
      {
        PRUnichar* escaped = MsgEscapeHTML2(prefSigText.get(), prefSigText.Length());
        if (escaped)
        {
          sigData.Append(escaped);
          NS_Free(escaped);
        }
        else
          sigData.Append(prefSigText);
      }
      else
        sigData.Append(prefSigText);
    }
  }

  // post-processing for plain-text signatures to ensure we end in CR, LF, or CRLF
  if (!htmlSig && !m_composeHTML)
  {
    int32_t sigLength = sigData.Length();
    if (sigLength > 0 && !(sigData.CharAt(sigLength - 1) == '\r')
                      && !(sigData.CharAt(sigLength - 1) == '\n'))
      sigData.AppendLiteral(CRLF);
  }

  // Now that sigData holds data...if any, append it to the body in a nice
  // looking manner
  if (!sigData.IsEmpty())
  {
    if (m_composeHTML)
    {
      sigOutput.AppendLiteral(htmlBreak);
      if (htmlSig)
        sigOutput.AppendLiteral(htmlsigopen);
      else
        sigOutput.Append(NS_ConvertASCIItoUTF16(preopen));
    }

    if ((reply_on_top != 1 || sig_bottom || !aQuoted) &&
        sigData.Find("\r-- \r", true) < 0 &&
        sigData.Find("\n-- \n", true) < 0 &&
        sigData.Find("\n-- \r", true) < 0)
    {
      nsDependentSubstring firstFourChars(sigData, 0, 4);

      if ((mType == nsIMsgCompType::NewsPost || !suppressSigSep) &&
         !(firstFourChars.EqualsLiteral("-- \n") ||
           firstFourChars.EqualsLiteral("-- \r")))
      {
        sigOutput.AppendLiteral(dashes);

        if (!m_composeHTML || !htmlSig)
          sigOutput.AppendLiteral(CRLF);
        else if (m_composeHTML)
          sigOutput.AppendLiteral(htmlBreak);
      }
    }

    // add CRLF before signature for plain-text mode if signature comes before quote
    if (!m_composeHTML && reply_on_top == 1 && !sig_bottom && aQuoted)
      sigOutput.AppendLiteral(CRLF);

    sigOutput.Append(sigData);

    if (m_composeHTML)
    {
      if (htmlSig)
        sigOutput.AppendLiteral(htmlsigclose);
      else
        sigOutput.AppendLiteral(preclose);
    }
  }

  aMsgBody->Append(sigOutput);
  PR_Free(preopen);
  return NS_OK;
}

nsresult
nsMsgCompose::BuildBodyMessageAndSignature()
{
  nsresult    rv = NS_OK;

  //
  // This should never happen...if it does, just bail out...
  //
  if (!m_editor)
    return NS_ERROR_FAILURE;

  //
  // Now, we have the body so we can just blast it into the
  // composition editor window.
  //
  nsAutoString   body;
  m_compFields->GetBody(body);

  /* Some time we want to add a signature and sometime we wont. Let's figure that now...*/
  bool addSignature;
  bool addDashes = false;
  switch (mType)
  {
    case nsIMsgCompType::ForwardInline :
      addSignature = true;
      addDashes = true;
      break;
    case nsIMsgCompType::New :
    case nsIMsgCompType::MailToUrl :    /* same as New */
    case nsIMsgCompType::Reply :        /* should not happen! but just in case */
    case nsIMsgCompType::ReplyAll :       /* should not happen! but just in case */
    case nsIMsgCompType::ReplyToList :    /* should not happen! but just in case */
    case nsIMsgCompType::ForwardAsAttachment :  /* should not happen! but just in case */
    case nsIMsgCompType::NewsPost :
    case nsIMsgCompType::ReplyToGroup :
    case nsIMsgCompType::ReplyToSender :
    case nsIMsgCompType::ReplyToSenderAndGroup :
      addSignature = true;
      break;

    case nsIMsgCompType::Draft :
    case nsIMsgCompType::Template :
    case nsIMsgCompType::Redirect :
      addSignature = false;
      break;

    default :
      addSignature = false;
      break;
  }

  nsAutoString tSignature;
  if (addSignature)
    ProcessSignature(m_identity, addDashes, &tSignature);

  // if type is new, but we have body, this is probably a mapi send, so we need to
  // replace '\n' with <br> so that the line breaks won't be lost by html.
  // if mailtourl, do the same.
  if (m_composeHTML && (mType == nsIMsgCompType::New || mType == nsIMsgCompType::MailToUrl))
    MsgReplaceSubstring(body, NS_LITERAL_STRING("\n"), NS_LITERAL_STRING("<br>"));

  // Restore flowed text wrapping for Drafts/Templates.
  // Look for unquoted lines - if we have an unquoted line
  // that ends in a space, join this line with the next one
  // by removing the end of line char(s).
  int32_t wrapping_enabled = 0;
  GetWrapLength(&wrapping_enabled);
  if (!m_composeHTML && !addSignature && wrapping_enabled)
  {
    bool quote = false;
    for (uint32_t i = 0; i < body.Length(); i ++)
    {
      if (i == 0 || body[i - 1] == '\n')  // newline
      {
        if (body[i] == '>')
        {
          quote = true;
          continue;
        }
        nsString s(Substring(body, i, 10));
        if (StringBeginsWith(s, NS_LITERAL_STRING("-- \r")) ||
            StringBeginsWith(s, NS_LITERAL_STRING("-- \n")))
        {
          i += 4;
          continue;
        }
        if (StringBeginsWith(s, NS_LITERAL_STRING("- -- \r")) ||
            StringBeginsWith(s, NS_LITERAL_STRING("- -- \n")))
        {
          i += 6;
          continue;
        }
      }
      if (body[i] == '\n' && i > 1)
      {
        if (quote)
        {
          quote = false;
          continue;   // skip quoted lines
        }
        uint32_t j = i - 1;  // look backward for space
        if (body[j] == '\r')
          j --;
        if (body[j] == ' ')  // join this line with next one
          body.Cut(j + 1, i - j);  // remove CRLF
      }
    }
  }

  nsString empty;
  rv = ConvertAndLoadComposeWindow(empty, body, tSignature,
                                   false, m_composeHTML);

  return rv;
}

nsresult nsMsgCompose::NotifyStateListeners(int32_t aNotificationType, nsresult aResult)
{

  if (aNotificationType == nsIMsgComposeNotificationType::SaveInFolderDone)
    ResetUrisForEmbeddedObjects();

  nsTObserverArray<nsCOMPtr<nsIMsgComposeStateListener> >::ForwardIterator iter(mStateListeners);
  nsCOMPtr<nsIMsgComposeStateListener> thisListener;

  while (iter.HasMore())
  {
    thisListener = iter.GetNext();

    switch (aNotificationType)
    {
    case nsIMsgComposeNotificationType::ComposeFieldsReady:
      thisListener->NotifyComposeFieldsReady();
      break;

    case nsIMsgComposeNotificationType::ComposeProcessDone:
      thisListener->ComposeProcessDone(aResult);
      break;

    case nsIMsgComposeNotificationType::SaveInFolderDone:
      thisListener->SaveInFolderDone(m_folderName.get());
      break;

    case nsIMsgComposeNotificationType::ComposeBodyReady:
      thisListener->NotifyComposeBodyReady();
      break;

    default:
      NS_NOTREACHED("Unknown notification");
      break;
    }
  }

  return NS_OK;
}

nsresult nsMsgCompose::AttachmentPrettyName(const nsACString & scheme, const char* charset, nsACString& _retval)
{
  nsresult rv;

  if (MsgLowerCaseEqualsLiteral(StringHead(scheme, 5), "file:"))
  {
    nsCOMPtr<nsIFile> file;
    rv = NS_GetFileFromURLSpec(scheme,
                               getter_AddRefs(file));
    NS_ENSURE_SUCCESS(rv, rv);
    nsAutoString leafName;
    rv = file->GetLeafName(leafName);
    NS_ENSURE_SUCCESS(rv, rv);
    CopyUTF16toUTF8(leafName, _retval);
    return rv;
  }

  // To work around a mysterious bug in VC++ 6.
  const char* cset = (!charset || !*charset) ? "UTF-8" : charset;

  nsCOMPtr<nsITextToSubURI> textToSubURI = do_GetService(NS_ITEXTTOSUBURI_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString retUrl;
  rv = textToSubURI->UnEscapeURIForUI(nsDependentCString(cset), scheme, retUrl);

  if (NS_SUCCEEDED(rv)) {
    CopyUTF16toUTF8(retUrl, _retval);
  } else {
    _retval.Assign(scheme);
  }
  if (MsgLowerCaseEqualsLiteral(StringHead(scheme, 5), "http:"))
    _retval.Cut(0, 7);

  return NS_OK;
}

nsresult nsMsgCompose::GetABDirectories(const nsACString& aDirUri,
                                        nsCOMArray<nsIAbDirectory> &aDirArray)
{
  static bool collectedAddressbookFound;
  if (aDirUri.EqualsLiteral(kMDBDirectoryRoot))
    collectedAddressbookFound = false;

  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory;
  rv = abManager->GetDirectory(aDirUri, getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> subDirectories;
  if (NS_SUCCEEDED(directory->GetChildNodes(getter_AddRefs(subDirectories))) && subDirectories)
  {
    nsCOMPtr<nsISupports> item;
    bool hasMore;
    while (NS_SUCCEEDED(rv = subDirectories->HasMoreElements(&hasMore)) && hasMore)
    {
      if (NS_SUCCEEDED(subDirectories->GetNext(getter_AddRefs(item))))
      {
        directory = do_QueryInterface(item, &rv);
        if (NS_SUCCEEDED(rv))
        {
          bool bIsMailList;

          if (NS_SUCCEEDED(directory->GetIsMailList(&bIsMailList)) && bIsMailList)
            continue;

          nsCString uri;
          rv = directory->GetURI(uri);
          NS_ENSURE_SUCCESS(rv, rv);

          int32_t pos;
          if (uri.EqualsLiteral(kPersonalAddressbookUri))
            pos = 0;
          else
          {
            uint32_t count = aDirArray.Count();

            if (uri.EqualsLiteral(kCollectedAddressbookUri))
            {
              collectedAddressbookFound = true;
              pos = count;
            }
            else
            {
              if (collectedAddressbookFound && count > 1)
                pos = count - 1;
              else
                pos = count;
            }
          }

          aDirArray.InsertObjectAt(directory, pos);
          rv = GetABDirectories(uri, aDirArray);
        }
      }
    }
  }
  return rv;
}

nsresult nsMsgCompose::BuildMailListArray(nsIAbDirectory* parentDir,
                                          nsTArray<nsMsgMailList>& array)
{
  nsresult rv;

  nsCOMPtr<nsIAbDirectory> directory;
  nsCOMPtr<nsISimpleEnumerator> subDirectories;

  if (NS_SUCCEEDED(parentDir->GetChildNodes(getter_AddRefs(subDirectories))) && subDirectories)
  {
    nsCOMPtr<nsISupports> item;
    bool hasMore;
    while (NS_SUCCEEDED(rv = subDirectories->HasMoreElements(&hasMore)) && hasMore)
    {
      if (NS_SUCCEEDED(subDirectories->GetNext(getter_AddRefs(item))))
      {
        directory = do_QueryInterface(item, &rv);
        if (NS_SUCCEEDED(rv))
        {
          bool bIsMailList;

          if (NS_SUCCEEDED(directory->GetIsMailList(&bIsMailList)) && bIsMailList)
          {
            array.AppendElement(directory);
          }
        }
      }
    }
  }
  return rv;
}

struct nsMsgMailListComparator
{
  bool Equals(const nsMsgMailList& mailList, const nsString& name) const {
    return mailList.mFullName.Equals(name, nsCaseInsensitiveStringComparator());
  }
};

nsresult nsMsgCompose::GetMailListAddresses(nsString& name, nsTArray<nsMsgMailList>& mailListArray, nsIMutableArray** addressesArray)
{
  uint32_t index = mailListArray.IndexOf(name, 0, nsMsgMailListComparator());
  if (index != mailListArray.NoIndex &&
      mailListArray[index].mDirectory)
    return mailListArray[index].mDirectory->GetAddressLists(addressesArray);

  return NS_ERROR_FAILURE;
}


// 3 = To, Cc, Bcc
#define MAX_OF_RECIPIENT_ARRAY    3

NS_IMETHODIMP
nsMsgCompose::CheckAndPopulateRecipients(bool aPopulateMailList,
                                         bool aReturnNonHTMLRecipients,
                                         nsAString &aNonHTMLRecipients,
                                         uint32_t *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsresult rv = NS_OK;

  aNonHTMLRecipients.Truncate();

  if (aResult)
    *aResult = nsIAbPreferMailFormat::unknown;

  // First, build some arrays with the original recipients.
  nsTArray<nsMsgRecipient> recipientsList[MAX_OF_RECIPIENT_ARRAY];

  nsAutoString originalRecipients[MAX_OF_RECIPIENT_ARRAY];
  m_compFields->GetTo(originalRecipients[0]);
  m_compFields->GetCc(originalRecipients[1]);
  m_compFields->GetBcc(originalRecipients[2]);

  uint32_t i, j, k;

  for (i = 0; i < MAX_OF_RECIPIENT_ARRAY; ++i)
  {
    if (originalRecipients[i].IsEmpty())
      continue;

    rv = m_compFields->SplitRecipientsEx(originalRecipients[i],
                                         recipientsList[i]);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // Then look them up in the Addressbooks
  bool stillNeedToSearch = true;
  nsCOMPtr<nsIAbDirectory> abDirectory;
  nsCOMPtr<nsIAbCard> existingCard;
  nsCOMPtr<nsIMutableArray> mailListAddresses;
  nsCOMPtr<nsIMsgHeaderParser> parser(do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID));
  nsTArray<nsMsgMailList> mailListArray;

  nsCOMArray<nsIAbDirectory> addrbookDirArray;
  rv = GetABDirectories(NS_LITERAL_CSTRING(kAllDirectoryRoot),
                        addrbookDirArray);
  if (NS_SUCCEEDED(rv))
  {
    nsString dirPath;
    uint32_t nbrAddressbook = addrbookDirArray.Count();

    for (k = 0; k < nbrAddressbook && stillNeedToSearch; ++k)
    {
      // Avoid recursive mailing lists
      if (abDirectory && (addrbookDirArray[k] == abDirectory))
      {
        stillNeedToSearch = false;
        break;
      }

      abDirectory = addrbookDirArray[k];

      bool supportsMailingLists;
      rv = abDirectory->GetSupportsMailingLists(&supportsMailingLists);
      if (NS_FAILED(rv) || !supportsMailingLists)
        continue;

      // Ensure the existing list is empty before filling it
      mailListArray.Clear();

      // Collect all mailing lists defined in this address book
      rv = BuildMailListArray(abDirectory, mailListArray);
      if (NS_FAILED(rv))
        return rv;

      stillNeedToSearch = false;
      for (i = 0; i < MAX_OF_RECIPIENT_ARRAY; i ++)
      {
        // Note: We check this each time to allow for length changes.
        for (j = 0; j < recipientsList[i].Length(); ++j)
        {
          nsMsgRecipient &recipient = recipientsList[i][j];
          if (!recipient.mProcessed)
          {
            // First check if it's a mailing list
            if (NS_SUCCEEDED(GetMailListAddresses(recipient.mAddress,
                                                  mailListArray,
                                                  getter_AddRefs(mailListAddresses))))
            {
              // It is, so populate it if we are required to do so.
              if (aPopulateMailList)
              {
                  uint32_t nbrAddresses = 0;
                  for (mailListAddresses->GetLength(&nbrAddresses); nbrAddresses > 0; nbrAddresses --)
                  {
                    existingCard = do_QueryElementAt(mailListAddresses,
                                                     nbrAddresses - 1, &rv);
                    if (NS_FAILED(rv))
                      return rv;

                    nsMsgRecipient newRecipient;
                    nsAutoString pDisplayName;

                    bool bIsMailList;
                    rv = existingCard->GetIsMailList(&bIsMailList);
                    if (NS_FAILED(rv))
                      return rv;

                    rv = existingCard->GetDisplayName(pDisplayName);
                    if (NS_FAILED(rv))
                      return rv;

                    if (bIsMailList)
                      rv = existingCard->GetPropertyAsAString(kNotesProperty, newRecipient.mEmail);
                    else
                      rv = existingCard->GetPrimaryEmail(newRecipient.mEmail);

                    if (NS_FAILED(rv))
                      return rv;

                    if (parser)
                      parser->MakeFullAddress(pDisplayName, newRecipient.mEmail,
                                              newRecipient.mAddress);

                    if (newRecipient.mAddress.IsEmpty())
                    {
                      // oops, parser problem! I will try to do my best...
                      newRecipient.mAddress = pDisplayName;
                      newRecipient.mAddress.AppendLiteral(" <");
                      if (bIsMailList)
                      {
                        if (!newRecipient.mEmail.IsEmpty())
                          newRecipient.mAddress += newRecipient.mEmail;
                        else
                          newRecipient.mAddress += pDisplayName;
                      }
                      else
                        newRecipient.mAddress += newRecipient.mEmail;
                      newRecipient.mAddress.Append(PRUnichar('>'));
                    }

                    if (newRecipient.mAddress.IsEmpty())
                      continue;

                    // Now we need to insert the new address into the list of
                    // recipient
                    if (bIsMailList)
                    {
                      stillNeedToSearch = true;
                    }
                    else
                    {
                      newRecipient.mPreferFormat = nsIAbPreferMailFormat::unknown;
                      rv = existingCard->GetPropertyAsUint32(
                          kPreferMailFormatProperty, &newRecipient.mPreferFormat);
                      if (NS_SUCCEEDED(rv))
                        newRecipient.mProcessed = true;
                    }
                    rv = recipientsList[i].InsertElementAt(j + 1, newRecipient) ? NS_OK : NS_ERROR_FAILURE;
                    if (NS_FAILED(rv))
                      return rv;
                  }
                  recipientsList[i].RemoveElementAt(j);
                 --j;
              }
              else
                recipient.mProcessed = true;

              continue;
            }

            if (!abDirectory)
            {
              stillNeedToSearch = true;
              continue;
            }

            // find a card that contains this e-mail address
            rv = abDirectory->CardForEmailAddress(NS_ConvertUTF16toUTF8(recipient.mEmail),
                                                  getter_AddRefs(existingCard));

            if (NS_SUCCEEDED(rv) && existingCard)
            {
              recipient.mPreferFormat = nsIAbPreferMailFormat::unknown;
              rv = existingCard->GetPropertyAsUint32(kPreferMailFormatProperty,
                                                     &recipient.mPreferFormat);
              if (NS_SUCCEEDED(rv))
                recipient.mProcessed = true;

              bool readOnly;
              rv = abDirectory->GetReadOnly(&readOnly);
              NS_ENSURE_SUCCESS(rv,rv);

              // bump the popularity index for this card since we are about to send e-mail to it
              uint32_t popularityIndex = 0;
              if (!readOnly)
              {
                if (NS_FAILED(existingCard->GetPropertyAsUint32(
                      kPopularityIndexProperty, &popularityIndex)))
                {
                  // TB 2 wrote the popularity value as hex, so if we get here,
                  // then we've probably got a hex value. We'll convert it back
                  // to decimal, as that's the best we can do.

                  nsCString hexPopularity;
                  if (NS_SUCCEEDED(existingCard->GetPropertyAsAUTF8String(kPopularityIndexProperty, hexPopularity)))
                  {
                    nsresult errorCode = NS_OK;
                    popularityIndex = hexPopularity.ToInteger(&errorCode, 16);
                    if (NS_FAILED(errorCode))
                      // We failed, just set it to zero.
                      popularityIndex = 0;
                  }
                  else
                    // We couldn't get it as a string either, so just reset to
                    // zero.
                    popularityIndex = 0;
                }

                existingCard->SetPropertyAsUint32(kPopularityIndexProperty,
                                                  ++popularityIndex);
                abDirectory->ModifyCard(existingCard);
              }
            }
            else
              stillNeedToSearch = true;
          }
        }
      }
    }
  }

  // Finally return the list of non HTML recipient if requested and/or rebuilt
  // the recipient field. Also, check for domain preference when preferFormat
  // is unknown
  nsAutoString recipientsStr;
  nsAutoString nonHtmlRecipientsStr;
  nsString plaintextDomains;
  nsString htmlDomains;
  nsAutoString domain;

  nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID));
  if (prefBranch)
  {
    NS_GetUnicharPreferenceWithDefault(prefBranch, "mailnews.plaintext_domains",
                                       EmptyString(), plaintextDomains);
    NS_GetUnicharPreferenceWithDefault(prefBranch, "mailnews.html_domains",
                                       EmptyString(), htmlDomains);
  }

  bool atLeastOneRecipientPrefersUnknown = false;
  bool atLeastOneRecipientPrefersPlainText = false;
  bool atLeastOneRecipientPrefersHTML = false;

  for (i = 0; i < MAX_OF_RECIPIENT_ARRAY; ++i)
  {
    uint32_t nbrRecipients = recipientsList[i].Length();
    if (nbrRecipients == 0)
      continue;
    recipientsStr.Truncate();

    for (j = 0; j < nbrRecipients; ++j)
    {
      nsMsgRecipient &recipient = recipientsList[i][j];

      // if we don't have a prefer format for a recipient, check the domain in
      // case we have a format defined for it
      if (recipient.mPreferFormat == nsIAbPreferMailFormat::unknown &&
          (plaintextDomains.Length() || htmlDomains.Length()))
      {
        int32_t atPos = recipient.mEmail.FindChar('@');
        if (atPos >= 0)
        {
          domain = Substring(recipient.mEmail, atPos + 1);
          if (CaseInsensitiveFindInReadable(domain, plaintextDomains))
            recipient.mPreferFormat = nsIAbPreferMailFormat::plaintext;
          else
            if (CaseInsensitiveFindInReadable(domain, htmlDomains))
              recipient.mPreferFormat = nsIAbPreferMailFormat::html;
        }
      }

      switch (recipient.mPreferFormat)
      {
      case nsIAbPreferMailFormat::html:
        atLeastOneRecipientPrefersHTML = true;
        break;

      case nsIAbPreferMailFormat::plaintext:
        atLeastOneRecipientPrefersPlainText = true;
        break;

      default: // nsIAbPreferMailFormat::unknown
        atLeastOneRecipientPrefersUnknown = true;
        break;
      }

      if (aPopulateMailList)
      {
        if (!recipientsStr.IsEmpty())
          recipientsStr.Append(PRUnichar(','));
        recipientsStr.Append(recipient.mAddress);
      }

      if (aReturnNonHTMLRecipients &&
          recipient.mPreferFormat != nsIAbPreferMailFormat::html)
      {
        if (!nonHtmlRecipientsStr.IsEmpty())
          nonHtmlRecipientsStr.Append(PRUnichar(','));
        nonHtmlRecipientsStr.Append(recipient.mEmail);
      }
    }

    if (aPopulateMailList)
    {
      switch (i)
      {
      case 0 : m_compFields->SetTo(recipientsStr);  break;
      case 1 : m_compFields->SetCc(recipientsStr);  break;
      case 2 : m_compFields->SetBcc(recipientsStr); break;
      }
    }
  }

  if (aReturnNonHTMLRecipients)
    aNonHTMLRecipients = nonHtmlRecipientsStr;

  if (atLeastOneRecipientPrefersUnknown)
    *aResult = nsIAbPreferMailFormat::unknown;
  else if (atLeastOneRecipientPrefersHTML)
  {
    // if we have at least one recipient that prefers html
    // and at least one that recipients that prefers plain text
    // we need to return unknown, so that we can prompt the user
    if (atLeastOneRecipientPrefersPlainText)
      *aResult = nsIAbPreferMailFormat::unknown;
    else
      *aResult = nsIAbPreferMailFormat::html;
  }
  else
  {
    NS_ASSERTION(atLeastOneRecipientPrefersPlainText, "at least one should prefer plain text");
    *aResult = nsIAbPreferMailFormat::plaintext;
  }

  return rv;
}

/* Decides which tags trigger which convertible mode, i.e. here is the logic
   for BodyConvertible */
// Helper function. Parameters are not checked.
nsresult nsMsgCompose::TagConvertible(nsIDOMNode *node,  int32_t *_retval)
{
    nsresult rv;

    *_retval = nsIMsgCompConvertible::No;

    uint16_t nodeType;
    rv = node->GetNodeType(&nodeType);
    if (NS_FAILED(rv))
      return rv;

    nsAutoString element;
    rv = node->GetNodeName(element);
    if (NS_FAILED(rv))
      return rv;

    nsCOMPtr<nsIDOMNode> pItem;
    if      (
              nodeType == nsIDOMNode::TEXT_NODE ||
              element.LowerCaseEqualsLiteral("br") ||
              element.LowerCaseEqualsLiteral("p") ||
              element.LowerCaseEqualsLiteral("pre") ||
              element.LowerCaseEqualsLiteral("tt") ||
              element.LowerCaseEqualsLiteral("html") ||
              element.LowerCaseEqualsLiteral("head") ||
              element.LowerCaseEqualsLiteral("title")
            )
    {
      *_retval = nsIMsgCompConvertible::Plain;
    }
    else if (
              //element.LowerCaseEqualsLiteral("blockquote") || // see below
              element.LowerCaseEqualsLiteral("ul") ||
              element.LowerCaseEqualsLiteral("ol") ||
              element.LowerCaseEqualsLiteral("li") ||
              element.LowerCaseEqualsLiteral("dl") ||
              element.LowerCaseEqualsLiteral("dt") ||
              element.LowerCaseEqualsLiteral("dd")
            )
    {
      *_retval = nsIMsgCompConvertible::Yes;
    }
    else if (
              //element.LowerCaseEqualsLiteral("a") || // see below
              element.LowerCaseEqualsLiteral("h1") ||
              element.LowerCaseEqualsLiteral("h2") ||
              element.LowerCaseEqualsLiteral("h3") ||
              element.LowerCaseEqualsLiteral("h4") ||
              element.LowerCaseEqualsLiteral("h5") ||
              element.LowerCaseEqualsLiteral("h6") ||
              element.LowerCaseEqualsLiteral("hr") ||
              (
                mConvertStructs
                &&
                (
                  element.LowerCaseEqualsLiteral("em") ||
                  element.LowerCaseEqualsLiteral("strong") ||
                  element.LowerCaseEqualsLiteral("code") ||
                  element.LowerCaseEqualsLiteral("b") ||
                  element.LowerCaseEqualsLiteral("i") ||
                  element.LowerCaseEqualsLiteral("u")
                )
              )
            )
    {
      *_retval = nsIMsgCompConvertible::Altering;
    }
    else if (element.LowerCaseEqualsLiteral("body"))
    {
      *_retval = nsIMsgCompConvertible::Plain;

      nsCOMPtr<nsIDOMElement> domElement = do_QueryInterface(node);
      if (domElement)
      {
        bool hasAttribute;
        nsAutoString color;
        if (NS_SUCCEEDED(domElement->HasAttribute(NS_LITERAL_STRING("background"), &hasAttribute))
            && hasAttribute)  // There is a background image
          *_retval = nsIMsgCompConvertible::No;
        else if (NS_SUCCEEDED(domElement->HasAttribute(NS_LITERAL_STRING("text"), &hasAttribute)) &&
                 hasAttribute &&
                 NS_SUCCEEDED(domElement->GetAttribute(NS_LITERAL_STRING("text"), color)) &&
                 !color.EqualsLiteral("#000000")) {
          *_retval = nsIMsgCompConvertible::Altering;
        }
        else if (NS_SUCCEEDED(domElement->HasAttribute(NS_LITERAL_STRING("bgcolor"), &hasAttribute)) &&
                 hasAttribute &&
                 NS_SUCCEEDED(domElement->GetAttribute(NS_LITERAL_STRING("bgcolor"), color)) &&
                 !color.LowerCaseEqualsLiteral("#ffffff")) {
          *_retval = nsIMsgCompConvertible::Altering;
        }
        else if (NS_SUCCEEDED(domElement->HasAttribute(NS_LITERAL_STRING("dir"), &hasAttribute))
            && hasAttribute)  // dir=rtl attributes should not downconvert
          *_retval = nsIMsgCompConvertible::No;

        //ignore special color setting for link, vlink and alink at this point.
      }

    }
    else if (element.LowerCaseEqualsLiteral("blockquote"))
    {
      // Skip <blockquote type="cite">
      *_retval = nsIMsgCompConvertible::Yes;

      nsCOMPtr<nsIDOMElement> domElement = do_QueryInterface(node);
      if (domElement)
      {
        nsString typeValue;
        if (NS_SUCCEEDED(domElement->GetAttribute(NS_LITERAL_STRING("type"), typeValue)) &&
            typeValue.LowerCaseEqualsLiteral("cite"))
          *_retval = nsIMsgCompConvertible::Plain;
      }
    }
    else if (
              element.LowerCaseEqualsLiteral("div") ||
              element.LowerCaseEqualsLiteral("span") ||
              element.LowerCaseEqualsLiteral("a")
            )
    {
      /* Do some special checks for these tags. They are inside this |else if|
         for performance reasons */
      nsCOMPtr<nsIDOMElement> domElement = do_QueryInterface(node);
      if (domElement)
      {
        nsString classValue;
        if (NS_SUCCEEDED(domElement->GetAttribute(NS_LITERAL_STRING("class"), classValue)) &&
            StringBeginsWith(classValue, NS_LITERAL_STRING("moz-txt"), nsCaseInsensitiveStringComparator()))
        {
          *_retval = nsIMsgCompConvertible::Plain;
          return rv;  // Inconsistent :-(
        }
      }

      // Maybe, it's an <a> element inserted by another recognizer (e.g. 4.x')
      if (element.LowerCaseEqualsLiteral("a"))
      {
        /* Ignore anchor tag, if the URI is the same as the text
           (as inserted by recognizers) */
        *_retval = nsIMsgCompConvertible::Altering;

        nsCOMPtr<nsIDOMElement> domElement = do_QueryInterface(node);
        if (domElement)
        {
          nsString hrefValue;
          bool hasChild;
          if (NS_SUCCEEDED(domElement->GetAttribute(NS_LITERAL_STRING("href"), hrefValue)) &&
              NS_SUCCEEDED(node->HasChildNodes(&hasChild)) && hasChild)
          {
            nsCOMPtr<nsIDOMNodeList> children;
            if (NS_SUCCEEDED(node->GetChildNodes(getter_AddRefs(children))) &&
                children &&
                NS_SUCCEEDED(children->Item(0, getter_AddRefs(pItem))) &&
                pItem)
            {
              nsAutoString textValue;
              if (NS_SUCCEEDED(pItem->GetNodeValue(textValue)) &&
                  textValue == hrefValue)
                *_retval = nsIMsgCompConvertible::Plain;
            }
          }
        }
      }

      // Lastly, test, if it is just a "simple" <div> or <span>
      else if (
                element.LowerCaseEqualsLiteral("div") ||
                element.LowerCaseEqualsLiteral("span")
              )
      {
        /* skip only if no style attribute */
        *_retval = nsIMsgCompConvertible::Plain;

        nsCOMPtr<nsIDOMElement> domElement = do_QueryInterface(node);
        if (domElement)
        {
          nsAutoString styleValue;
          if (NS_SUCCEEDED(domElement->GetAttribute(NS_LITERAL_STRING("style"), styleValue)) &&
              !styleValue.IsEmpty())
            *_retval = nsIMsgCompConvertible::No;
        }
      }
    }

    return rv;
}

nsresult nsMsgCompose::_BodyConvertible(nsIDOMNode *node, int32_t *_retval)
{
    NS_ENSURE_TRUE(node && _retval, NS_ERROR_NULL_POINTER);

    nsresult rv;
    int32_t result;

    // Check this node
    rv = TagConvertible(node, &result);
    if (NS_FAILED(rv))
        return rv;

    // Walk tree recursively to check the children
    bool hasChild;
    if (NS_SUCCEEDED(node->HasChildNodes(&hasChild)) && hasChild)
    {
      nsCOMPtr<nsIDOMNodeList> children;
      if (NS_SUCCEEDED(node->GetChildNodes(getter_AddRefs(children)))
          && children)
      {
        uint32_t nbrOfElements;
        rv = children->GetLength(&nbrOfElements);
        for (uint32_t i = 0; NS_SUCCEEDED(rv) && i < nbrOfElements; i++)
        {
          nsCOMPtr<nsIDOMNode> pItem;
          if (NS_SUCCEEDED(children->Item(i, getter_AddRefs(pItem)))
              && pItem)
          {
            int32_t curresult;
            rv = _BodyConvertible(pItem, &curresult);
            if (NS_SUCCEEDED(rv) && curresult > result)
              result = curresult;
          }
        }
      }
    }

    *_retval = result;
    return rv;
}

nsresult nsMsgCompose::BodyConvertible(int32_t *_retval)
{
    NS_ENSURE_TRUE(_retval, NS_ERROR_NULL_POINTER);

    nsresult rv;

    if (!m_editor)
      return NS_ERROR_FAILURE;

    nsCOMPtr<nsIDOMElement> rootElement;
    rv = m_editor->GetRootElement(getter_AddRefs(rootElement));
    if (NS_FAILED(rv) || nullptr == rootElement)
      return rv;

    nsCOMPtr<nsIDOMNode> node = do_QueryInterface(rootElement);
    if (nullptr == node)
      return NS_ERROR_FAILURE;

    return _BodyConvertible(node, _retval);
}

NS_IMETHODIMP
nsMsgCompose::GetIdentity(nsIMsgIdentity **aIdentity)
{
  NS_ENSURE_ARG_POINTER(aIdentity);
  NS_IF_ADDREF(*aIdentity = m_identity);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgCompose::SetIdentity(nsIMsgIdentity *aIdentity)
{
  NS_ENSURE_ARG_POINTER(aIdentity);

  m_identity = aIdentity;

  nsresult rv;

  if (! m_editor)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIDOMElement> rootElement;
  rv = m_editor->GetRootElement(getter_AddRefs(rootElement));
  if (NS_FAILED(rv) || nullptr == rootElement)
    return rv;

  //First look for the current signature, if we have one
  nsCOMPtr<nsIDOMNode> lastNode;
  nsCOMPtr<nsIDOMNode> node;
  nsCOMPtr<nsIDOMNode> tempNode;
  nsAutoString tagLocalName;

  rv = rootElement->GetLastChild(getter_AddRefs(lastNode));
  if (NS_SUCCEEDED(rv) && nullptr != lastNode)
  {
    node = lastNode;
    // In html, the signature is inside an element with
    // class="moz-signature"
    bool signatureFound = false;
    nsAutoString attributeName;
    attributeName.AssignLiteral("class");

    do
    {
      nsCOMPtr<nsIDOMElement> element = do_QueryInterface(node);
      if (element)
      {
        nsAutoString attributeValue;

        rv = element->GetAttribute(attributeName, attributeValue);

        if (attributeValue.Find("moz-signature", true) != kNotFound) {
          signatureFound = true;
          break;
        }
      }
    } while (!signatureFound &&
             node &&
             NS_SUCCEEDED(node->GetPreviousSibling(getter_AddRefs(node))));

    if (signatureFound)
    {
      m_editor->BeginTransaction();
      node->GetPreviousSibling(getter_AddRefs(tempNode));
      rv = m_editor->DeleteNode(node);
      if (NS_FAILED(rv))
      {
        m_editor->EndTransaction();
        return rv;
      }

      //Also, remove the <br> right before the signature.
      if (tempNode)
      {
        tempNode->GetLocalName(tagLocalName);
        if (tagLocalName.EqualsLiteral("br"))
          m_editor->DeleteNode(tempNode);
      }
      m_editor->EndTransaction();
    }
  }

  if (!CheckIncludeSignaturePrefs(aIdentity))
    return NS_OK;

  // Then add the new one if needed
  nsAutoString aSignature;

  // No delimiter needed if not a compose window
  bool noDelimiter;
  switch (mType)
  {
    case nsIMsgCompType::New :
    case nsIMsgCompType::NewsPost :
    case nsIMsgCompType::MailToUrl :
    case nsIMsgCompType::ForwardAsAttachment :
      noDelimiter = false;
      break;
    default :
      noDelimiter = true;
      break;
  }

  ProcessSignature(aIdentity, noDelimiter, &aSignature);

  if (!aSignature.IsEmpty())
  {
    TranslateLineEnding(aSignature);

    m_editor->BeginTransaction();
    int32_t reply_on_top = 0;
    bool sig_bottom = true;
    aIdentity->GetReplyOnTop(&reply_on_top);
    aIdentity->GetSigBottom(&sig_bottom);
    bool sigOnTop = (reply_on_top == 1 && !sig_bottom);
    if (sigOnTop && noDelimiter)
      m_editor->BeginningOfDocument();
    else
      m_editor->EndOfDocument();

    nsCOMPtr<nsIHTMLEditor> htmlEditor (do_QueryInterface(m_editor));
    nsCOMPtr<nsIPlaintextEditor> textEditor (do_QueryInterface(m_editor));

    if (m_composeHTML)
      rv = htmlEditor->InsertHTML(aSignature);
    else {
      rv = textEditor->InsertLineBreak();
      InsertDivWrappedTextAtSelection(aSignature, NS_LITERAL_STRING("moz-signature"));
    }

    if (sigOnTop && noDelimiter)
      m_editor->EndOfDocument();
    m_editor->EndTransaction();
  }

  return rv;
}

NS_IMETHODIMP nsMsgCompose::CheckCharsetConversion(nsIMsgIdentity *identity, char **fallbackCharset, bool *_retval)
{
  NS_ENSURE_ARG_POINTER(identity);
  NS_ENSURE_ARG_POINTER(_retval);

  nsresult rv = m_compFields->CheckCharsetConversion(fallbackCharset, _retval);
  NS_ENSURE_SUCCESS(rv, rv);

  if (*_retval)
  {
    nsString fullName;
    nsString organization;
    nsAutoString identityStrings;

    rv = identity->GetFullName(fullName);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!fullName.IsEmpty())
      identityStrings.Append(fullName);

    rv = identity->GetOrganization(organization);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!organization.IsEmpty())
      identityStrings.Append(organization);

    if (!identityStrings.IsEmpty())
    {
      // use fallback charset if that's already set
      const char *charset = (fallbackCharset && *fallbackCharset) ? *fallbackCharset : m_compFields->GetCharacterSet();
      *_retval = nsMsgI18Ncheck_data_in_charset_range(charset, identityStrings.get(),
                                                      fallbackCharset);
    }
  }

  return NS_OK;
}

nsMsgMailList::nsMsgMailList(nsIAbDirectory* directory) :
  mDirectory(directory)
{
  nsCOMPtr<nsIMsgHeaderParser> parser (do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID));

  nsString listName, listDescription;
  mDirectory->GetDirName(listName);
  mDirectory->GetDescription(listDescription);

  if (parser)
    parser->MakeFullAddress(listName,
                            listDescription.IsEmpty() ? listName : listDescription,
                            mFullName);

  if (mFullName.IsEmpty())
  {
      //oops, parser problem! I will try to do my best...
      mFullName = listName;
      mFullName.AppendLiteral(" <");
      if (listDescription.IsEmpty())
        mFullName += listName;
      else
        mFullName += listDescription;
      mFullName.Append(PRUnichar('>'));
  }

  mDirectory = directory;
}
