/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "prsystem.h"

#include "nsMessenger.h"

// xpcom
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsIStringStream.h"
#include "nsIFile.h"
#include "nsDirectoryServiceDefs.h"
#include "nsISupportsObsolete.h"
#include "nsQuickSort.h"
#include "nsAutoPtr.h"
#include "nsNativeCharsetUtils.h"
#include "nsIMutableArray.h"
#include "mozilla/Services.h"

// necko
#include "nsMimeTypes.h"
#include "nsIURL.h"
#include "nsIPrompt.h"
#include "nsIStreamListener.h"
#include "nsIStreamConverterService.h"
#include "nsNetUtil.h"
#include "nsIFileURL.h"
#include "nsIMIMEInfo.h"

// rdf
#include "nsIRDFResource.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"

// gecko
#include "nsLayoutCID.h"
#include "nsIMarkupDocumentViewer.h"
#include "nsIContentViewer.h"

// embedding
#ifdef NS_PRINTING
#include "nsIWebBrowserPrint.h"
#include "nsMsgPrintEngine.h"
#endif

/* for access to docshell */
#include "nsPIDOMWindow.h"
#include "nsIDocShell.h"
#include "nsIDocShellLoadInfo.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDocShellTreeNode.h"
#include "nsIWebNavigation.h"

// mail
#include "nsIMsgMailNewsUrl.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgMailSession.h"
#include "nsIMailboxUrl.h"
#include "nsIMsgFolder.h"
#include "nsMsgFolderFlags.h"
#include "nsMsgMessageFlags.h"
#include "nsIMsgIncomingServer.h"

#include "nsIMsgMessageService.h"
#include "nsMsgRDFUtils.h"

#include "nsIMsgHdr.h"
#include "nsIMimeMiscStatus.h"
// compose
#include "nsMsgCompCID.h"
#include "nsMsgI18N.h"
#include "nsNativeCharsetUtils.h"

// draft/folders/sendlater/etc
#include "nsIMsgCopyService.h"
#include "nsIMsgCopyServiceListener.h"
#include "nsIUrlListener.h"

// undo
#include "nsITransaction.h"
#include "nsMsgTxn.h"

// charset conversions
#include "nsMsgMimeCID.h"
#include "nsIMimeConverter.h"

// Save As
#include "nsIFilePicker.h"
#include "nsIStringBundle.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsCExternalHandlerService.h"
#include "nsIExternalProtocolService.h"
#include "nsIMIMEService.h"
#include "nsITransfer.h"

#include "nsILinkHandler.h"

static NS_DEFINE_CID(kRDFServiceCID,  NS_RDFSERVICE_CID);
static NS_DEFINE_CID(kMsgSendLaterCID, NS_MSGSENDLATER_CID);

#define FOUR_K 4096
#define MESSENGER_SAVE_DIR_PREF_NAME "messenger.save.dir"
#define MIMETYPE_DELETED    "text/x-moz-deleted"
#define ATTACHMENT_PERMISSION 00664

//
// Convert an nsString buffer to plain text...
//
#include "nsMsgUtils.h"
#include "nsCharsetSource.h"

static void ConvertAndSanitizeFileName(const char * displayName, nsString& aResult)
{
  nsCString unescapedName;

  /* we need to convert the UTF-8 fileName to platform specific character set.
     The display name is in UTF-8 because it has been escaped from JS
  */
  MsgUnescapeString(nsDependentCString(displayName), 0, unescapedName);
  CopyUTF8toUTF16(unescapedName, aResult);

  // replace platform specific path separator and illegale characters to avoid any confusion
  MsgReplaceChar(aResult, FILE_PATH_SEPARATOR FILE_ILLEGAL_CHARACTERS, '-');
}

// ***************************************************
// jefft - this is a rather obscured class serves for Save Message As File,
// Save Message As Template, and Save Attachment to a file
//
class nsSaveAllAttachmentsState;

class nsSaveMsgListener : public nsIUrlListener,
                          public nsIMsgCopyServiceListener,
                          public nsIStreamListener,
                          public nsICancelable
{
public:
  nsSaveMsgListener(nsIFile *file, nsMessenger *aMessenger, nsIUrlListener *aListener);
  virtual ~nsSaveMsgListener();

  NS_DECL_ISUPPORTS

  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGCOPYSERVICELISTENER
  NS_DECL_NSISTREAMLISTENER
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSICANCELABLE

  nsCOMPtr<nsIFile> m_file;
  nsCOMPtr<nsIOutputStream> m_outputStream;
  nsAutoPtr<char> m_dataBuffer;
  nsCOMPtr<nsIChannel> m_channel;
  nsCString m_templateUri;
  nsMessenger *m_messenger; // not ref counted
  nsSaveAllAttachmentsState *m_saveAllAttachmentsState;

  // rhp: For character set handling
  bool          m_doCharsetConversion;
  nsString      m_charset;
  enum {
    eUnknown,
    ePlainText,
    eHTML
  }             m_outputFormat;
  nsCString     m_msgBuffer;

  nsCString     m_contentType;    // used only when saving attachment

  nsCOMPtr<nsITransfer> mTransfer;
  nsCOMPtr<nsIUrlListener> mListener;
  nsCOMPtr<nsIURI> mListenerUri;
  int64_t mProgress;
  int64_t mMaxProgress;
  bool    mCanceled;
  bool    mInitialized;
  bool    mUrlHasStopped;
  bool    mRequestHasStopped;
  nsresult InitializeDownload(nsIRequest * aRequest, uint32_t aBytesDownloaded);
};

class nsSaveAllAttachmentsState
{
public:
  nsSaveAllAttachmentsState(uint32_t count,
                            const char **contentTypeArray,
                            const char **urlArray,
                            const char **displayNameArray,
                            const char **messageUriArray,
                            const char *directoryName,
                            bool detachingAttachments);
  virtual ~nsSaveAllAttachmentsState();

  uint32_t m_count;
  uint32_t m_curIndex;
  char* m_directoryName;
  char** m_contentTypeArray;
  char** m_urlArray;
  char** m_displayNameArray;
  char** m_messageUriArray;
  bool m_detachingAttachments;

  // if detaching, do without warning? Will create unique files instead of
  //  prompting if duplicate files exist.
  bool m_withoutWarning;
  nsTArray<nsCString> m_savedFiles; // if detaching first, remember where we saved to.
};

//
// nsMessenger
//
nsMessenger::nsMessenger()
{
  mCurHistoryPos = -2; // first message selected goes at position 0.
  //  InitializeFolderRoot();
}

nsMessenger::~nsMessenger()
{
}


NS_IMPL_ISUPPORTS3(nsMessenger, nsIMessenger, nsISupportsWeakReference, nsIFolderListener)

NS_IMETHODIMP nsMessenger::SetWindow(nsIDOMWindow *aWin, nsIMsgWindow *aMsgWindow)
{
  nsresult rv;

  nsCOMPtr<nsIMsgMailSession> mailSession =
    do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  if (aWin)
  {
    mMsgWindow = aMsgWindow;
    mWindow = aWin;

    rv = mailSession->AddFolderListener(this, nsIFolderListener::removed);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsPIDOMWindow> win( do_QueryInterface(aWin) );
    NS_ENSURE_TRUE(win, NS_ERROR_FAILURE);

    nsIDocShell *docShell = win->GetDocShell();
    nsCOMPtr<nsIDocShellTreeItem> docShellAsItem(do_QueryInterface(docShell));
    NS_ENSURE_TRUE(docShellAsItem, NS_ERROR_FAILURE);

    nsCOMPtr<nsIDocShellTreeItem> rootDocShellAsItem;
    docShellAsItem->GetSameTypeRootTreeItem(getter_AddRefs(rootDocShellAsItem));

    nsCOMPtr<nsIDocShellTreeNode> rootDocShellAsNode(do_QueryInterface(rootDocShellAsItem));
    if (rootDocShellAsNode)
    {
      nsCOMPtr<nsIDocShellTreeItem> childAsItem;
      rv = rootDocShellAsNode->FindChildWithName(NS_LITERAL_STRING("messagepane").get(),
                                                 true, false, nullptr, nullptr, getter_AddRefs(childAsItem));

      mDocShell = do_QueryInterface(childAsItem);
      if (NS_SUCCEEDED(rv) && mDocShell) {
        mCurrentDisplayCharset = ""; // Important! Clear out mCurrentDisplayCharset so we reset a default charset on mDocshell the next time we try to load something into it.

        if (aMsgWindow)
          aMsgWindow->GetTransactionManager(getter_AddRefs(mTxnMgr));
      }
    }

    // we don't always have a message pane, like in the addressbook
    // so if we don't have a docshell, use the one for the xul window.
    // we do this so OpenURL() will work.
    if (!mDocShell)
      mDocShell = docShell;
  } // if aWin
  else
  {
    // Remove the folder listener if we added it, i.e. if mWindow is non-null
    if (mWindow)
    {
      rv = mailSession->RemoveFolderListener(this);
      NS_ENSURE_SUCCESS(rv, rv);
    }

    mWindow = nullptr;
  }

  return NS_OK;
}

NS_IMETHODIMP nsMessenger::SetDisplayCharset(const nsACString& aCharset)
{
  // libmime always converts to UTF-8 (both HTML and XML)
  if (mDocShell)
  {
    nsCOMPtr<nsIContentViewer> cv;
    mDocShell->GetContentViewer(getter_AddRefs(cv));
    if (cv)
    {
      nsCOMPtr<nsIMarkupDocumentViewer> muDV = do_QueryInterface(cv);
      if (muDV)
      {
        muDV->SetHintCharacterSet(aCharset);
        muDV->SetHintCharacterSetSource(kCharsetFromChannel);
      }

      mCurrentDisplayCharset = aCharset;
    }
  }

  return NS_OK;
}

nsresult
nsMessenger::PromptIfFileExists(nsIFile *file)
{
  nsresult rv = NS_ERROR_FAILURE;
  bool exists;
  file->Exists(&exists);
  if (exists)
  {
    nsCOMPtr<nsIPrompt> dialog(do_GetInterface(mDocShell));
    if (!dialog) return rv;
    nsAutoString path;
    bool dialogResult = false;
    nsString errorMessage;

    file->GetPath(path);
    const PRUnichar *pathFormatStrings[] = { path.get() };

    if (!mStringBundle)
    {
      rv = InitStringBundle();
      NS_ENSURE_SUCCESS(rv, rv);
    }
    rv = mStringBundle->FormatStringFromName(NS_LITERAL_STRING("fileExists").get(),
                                             pathFormatStrings, 1,
                                             getter_Copies(errorMessage));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = dialog->Confirm(nullptr, errorMessage.get(), &dialogResult);
    NS_ENSURE_SUCCESS(rv, rv);

    if (dialogResult)
    {
      return NS_OK; // user says okay to replace
    }
    else
    {
      // if we don't re-init the path for redisplay the picker will
      // show the full path, not just the file name
      nsCOMPtr<nsIFile> currentFile = do_CreateInstance("@mozilla.org/file/local;1");
      if (!currentFile) return NS_ERROR_FAILURE;

      rv = currentFile->InitWithPath(path);
      NS_ENSURE_SUCCESS(rv, rv);

      nsAutoString leafName;
      currentFile->GetLeafName(leafName);
      if (!leafName.IsEmpty())
        path.Assign(leafName); // path should be a copy of leafName

      nsCOMPtr<nsIFilePicker> filePicker =
        do_CreateInstance("@mozilla.org/filepicker;1", &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      nsString saveAttachmentStr;
      GetString(NS_LITERAL_STRING("SaveAttachment"), saveAttachmentStr);
      filePicker->Init(mWindow,
                       saveAttachmentStr,
                       nsIFilePicker::modeSave);
      filePicker->SetDefaultString(path);
      filePicker->AppendFilters(nsIFilePicker::filterAll);

      nsCOMPtr <nsIFile> lastSaveDir;
      rv = GetLastSaveDirectory(getter_AddRefs(lastSaveDir));
      if (NS_SUCCEEDED(rv) && lastSaveDir) {
        filePicker->SetDisplayDirectory(lastSaveDir);
      }

      int16_t dialogReturn;
      rv = filePicker->Show(&dialogReturn);
      if (NS_FAILED(rv) || dialogReturn == nsIFilePicker::returnCancel) {
        // XXX todo
        // don't overload the return value like this
        // change this function to have an out boolean
        // that we check to see if the user cancelled
        return NS_ERROR_FAILURE;
      }

      nsCOMPtr<nsIFile> localFile;

      rv = filePicker->GetFile(getter_AddRefs(localFile));
      NS_ENSURE_SUCCESS(rv, rv);

      rv = SetLastSaveDirectory(localFile);
      NS_ENSURE_SUCCESS(rv,rv);

      // reset the file to point to the new path
      return file->InitWithFile(localFile);
    }
  }
  else
  {
    return NS_OK;
  }
  return rv;
}

NS_IMETHODIMP
nsMessenger::AddMsgUrlToNavigateHistory(const nsACString& aURL)
{
  // mNavigatingToUri is set to a url if we're already doing a back/forward,
  // in which case we don't want to add the url to the history list.
  // Or if the entry at the cur history pos is the same as what we're loading, don't
  // add it to the list.
  if (!mNavigatingToUri.Equals(aURL) && (mCurHistoryPos < 0 || !mLoadedMsgHistory[mCurHistoryPos].Equals(aURL)))
  {
    mNavigatingToUri = aURL;
    nsCString curLoadedFolderUri;
    nsCOMPtr <nsIMsgFolder> curLoadedFolder;

    mMsgWindow->GetOpenFolder(getter_AddRefs(curLoadedFolder));
    // for virtual folders, we want to select the right folder,
    // which isn't the same as the folder specified in the msg uri.
    // So add the uri for the currently loaded folder to the history list.
    if (curLoadedFolder)
      curLoadedFolder->GetURI(curLoadedFolderUri);

    mLoadedMsgHistory.InsertElementAt(mCurHistoryPos++ + 2, mNavigatingToUri);
    mLoadedMsgHistory.InsertElementAt(mCurHistoryPos++ + 2, curLoadedFolderUri);
    // we may want to prune this history if it gets large, but I think it's
    // more interesting to prune the back and forward menu.
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMessenger::OpenURL(const nsACString& aURL)
{
  // This is to setup the display DocShell as UTF-8 capable...
  SetDisplayCharset(NS_LITERAL_CSTRING("UTF-8"));

  nsCOMPtr <nsIMsgMessageService> messageService;
  nsresult rv = GetMessageServiceFromURI(aURL, getter_AddRefs(messageService));

  if (NS_SUCCEEDED(rv) && messageService)
  {
    messageService->DisplayMessage(PromiseFlatCString(aURL).get(), mDocShell, mMsgWindow, nullptr, nullptr, nullptr);
    AddMsgUrlToNavigateHistory(aURL);
    mLastDisplayURI = aURL; // remember the last uri we displayed....
    return NS_OK;
  }

  nsCOMPtr<nsIWebNavigation> webNav(do_QueryInterface(mDocShell));
  if(!webNav)
    return NS_ERROR_FAILURE;
  rv = webNav->LoadURI(NS_ConvertASCIItoUTF16(aURL).get(),   // URI string
                       nsIWebNavigation::LOAD_FLAGS_IS_LINK, // Load flags
                       nullptr,                               // Referring URI
                       nullptr,                               // Post stream
                       nullptr);                              // Extra headers
  return rv;
}

NS_IMETHODIMP nsMessenger::LaunchExternalURL(const nsACString& aURL)
{
  nsresult rv;

  nsCOMPtr<nsIURI> uri;
  rv = NS_NewURI(getter_AddRefs(uri), PromiseFlatCString(aURL).get());
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIExternalProtocolService> extProtService = do_GetService(NS_EXTERNALPROTOCOLSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  return extProtService->LoadUrl(uri);
}

NS_IMETHODIMP
nsMessenger::LoadURL(nsIDOMWindow *aWin, const nsACString& aURL)
{
  nsresult rv;

  SetDisplayCharset(NS_LITERAL_CSTRING("UTF-8"));

  NS_ConvertASCIItoUTF16 uriString(aURL);
  // Cleanup the empty spaces that might be on each end.
  uriString.Trim(" ");
  // Eliminate embedded newlines, which single-line text fields now allow:
  uriString.StripChars("\r\n");
  NS_ENSURE_TRUE(!uriString.IsEmpty(), NS_ERROR_FAILURE);

  bool loadingFromFile = false;
  bool getDummyMsgHdr = false;
  int64_t fileSize;

  if (StringBeginsWith(uriString, NS_LITERAL_STRING("file:")))
  {
    nsCOMPtr<nsIURI> fileUri;
    rv = NS_NewURI(getter_AddRefs(fileUri), uriString);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIFileURL> fileUrl = do_QueryInterface(fileUri, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIFile> file;
    rv = fileUrl->GetFile(getter_AddRefs(file));
    NS_ENSURE_SUCCESS(rv, rv);
    file->GetFileSize(&fileSize);
    uriString.Replace(0, 5, NS_LITERAL_STRING("mailbox:"));
    uriString.Append(NS_LITERAL_STRING("&number=0"));
    loadingFromFile = true;
    getDummyMsgHdr = true;
  }
  else if (StringBeginsWith(uriString, NS_LITERAL_STRING("mailbox:")) &&
           (CaseInsensitiveFindInReadable(NS_LITERAL_STRING(".eml?"), uriString)))
  {
    // if we have a mailbox:// url that points to an .eml file, we have to read
    // the file size as well
    uriString.Replace(0, 8, NS_LITERAL_STRING("file:"));
    nsCOMPtr<nsIURI> fileUri;
    rv = NS_NewURI(getter_AddRefs(fileUri), uriString);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIFileURL> fileUrl = do_QueryInterface(fileUri, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIFile> file;
    rv = fileUrl->GetFile(getter_AddRefs(file));
    NS_ENSURE_SUCCESS(rv, rv);
    file->GetFileSize(&fileSize);
    uriString.Replace(0, 5, NS_LITERAL_STRING("mailbox:"));
    loadingFromFile = true;
    getDummyMsgHdr = true;
  }
  else if (uriString.Find("type=application/x-message-display") >= 0)
    getDummyMsgHdr = true;

  nsCOMPtr<nsIURI> uri;
  rv = NS_NewURI(getter_AddRefs(uri), uriString);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ENSURE_TRUE(mDocShell, NS_ERROR_FAILURE);
  nsCOMPtr<nsIMsgMailNewsUrl> msgurl = do_QueryInterface(uri);
  if (msgurl)
  {
    msgurl->SetMsgWindow(mMsgWindow);
    if (loadingFromFile || getDummyMsgHdr)
    {
      if (loadingFromFile)
      {
        nsCOMPtr <nsIMailboxUrl> mailboxUrl = do_QueryInterface(msgurl, &rv);
        mailboxUrl->SetMessageSize((uint32_t) fileSize);
      }
      if (getDummyMsgHdr)
      {
        nsCOMPtr <nsIMsgHeaderSink> headerSink;
         // need to tell the header sink to capture some headers to create a fake db header
         // so we can do reply to a .eml file or a rfc822 msg attachment.
        mMsgWindow->GetMsgHeaderSink(getter_AddRefs(headerSink));
        if (headerSink)
        {
          nsCOMPtr <nsIMsgDBHdr> dummyHeader;
          headerSink->GetDummyMsgHeader(getter_AddRefs(dummyHeader));
          if (dummyHeader && loadingFromFile)
            dummyHeader->SetMessageSize((uint32_t) fileSize);
        }
      }
    }
  }

  nsCOMPtr<nsIDocShellLoadInfo> loadInfo;
  rv = mDocShell->CreateLoadInfo(getter_AddRefs(loadInfo));
  NS_ENSURE_SUCCESS(rv, rv);
  loadInfo->SetLoadType(nsIDocShellLoadInfo::loadNormal);
  AddMsgUrlToNavigateHistory(aURL);
  mNavigatingToUri.Truncate();
  return mDocShell->LoadURI(uri, loadInfo, 0, true);
}

NS_IMETHODIMP nsMessenger::SaveAttachmentToFile(nsIFile *aFile,
                                                const nsACString &aURL,
                                                const nsACString &aMessageUri,
                                                const nsACString &aContentType,
                                                nsIUrlListener *aListener)
{
  return SaveAttachment(aFile, aURL, aMessageUri, aContentType, nullptr, aListener);
}

NS_IMETHODIMP
nsMessenger::DetachAttachmentsWOPrompts(nsIFile* aDestFolder,
                                        uint32_t aCount,
                                        const char **aContentTypeArray,
                                        const char **aUrlArray,
                                        const char **aDisplayNameArray,
                                        const char **aMessageUriArray,
                                        nsIUrlListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aDestFolder);
  NS_ENSURE_ARG_POINTER(aContentTypeArray);
  NS_ENSURE_ARG_POINTER(aUrlArray);
  NS_ENSURE_ARG_POINTER(aMessageUriArray);
  NS_ENSURE_ARG_POINTER(aDisplayNameArray);
  if (!aCount)
    return NS_OK;
  nsSaveAllAttachmentsState *saveState;
  nsCOMPtr<nsIFile> attachmentDestination;
  nsresult rv = aDestFolder->Clone(getter_AddRefs(attachmentDestination));
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString path;
  rv = attachmentDestination->GetNativePath(path);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString unescapedFileName;
  ConvertAndSanitizeFileName(aDisplayNameArray[0], unescapedFileName);
  rv = attachmentDestination->Append(unescapedFileName);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = attachmentDestination->CreateUnique(nsIFile::NORMAL_FILE_TYPE, ATTACHMENT_PERMISSION);
  NS_ENSURE_SUCCESS(rv, rv);

  saveState = new nsSaveAllAttachmentsState(aCount,
                                            aContentTypeArray,
                                            aUrlArray,
                                            aDisplayNameArray,
                                            aMessageUriArray,
                                            path.get(),
                                            true);

  // This method is used in filters, where we don't want to warn
  saveState->m_withoutWarning = true;
  rv = SaveAttachment(attachmentDestination,
                      nsDependentCString(aUrlArray[0]),
                      nsDependentCString(aMessageUriArray[0]),
                      nsDependentCString(aContentTypeArray[0]),
                      (void *)saveState,
                      aListener);
  return rv;
}

nsresult nsMessenger::SaveAttachment(nsIFile *aFile,
                                     const nsACString &aURL,
                                     const nsACString &aMessageUri,
                                     const nsACString &aContentType,
                                     void *closure,
                                     nsIUrlListener *aListener)
{
  nsCOMPtr<nsIMsgMessageService> messageService;
  nsSaveAllAttachmentsState *saveState= (nsSaveAllAttachmentsState*) closure;
  nsCOMPtr<nsIMsgMessageFetchPartService> fetchService;
  nsAutoCString urlString;
  nsCOMPtr<nsIURI> URL;
  nsAutoCString fullMessageUri(aMessageUri);

  // This instance will be held onto by the listeners, and will be released once 
  // the transfer has been completed.
  nsRefPtr<nsSaveMsgListener> saveListener(new nsSaveMsgListener(aFile, this, aListener));
  if (!saveListener)
    return NS_ERROR_OUT_OF_MEMORY;

  saveListener->m_contentType = aContentType;
  if (saveState)
  {
    saveListener->m_saveAllAttachmentsState = saveState;
    if (saveState->m_detachingAttachments)
    {
      nsCOMPtr<nsIURI> outputURI;
      nsresult rv = NS_NewFileURI(getter_AddRefs(outputURI), aFile);
      NS_ENSURE_SUCCESS(rv, rv);
      nsAutoCString fileUriSpec;
      outputURI->GetSpec(fileUriSpec);
      saveState->m_savedFiles.AppendElement(fileUriSpec);
    }
  }

  urlString = aURL;
  // strip out ?type=application/x-message-display because it confuses libmime

  int32_t typeIndex = urlString.Find("?type=application/x-message-display");
  if (typeIndex != kNotFound)
  {
    urlString.Cut(typeIndex, sizeof("?type=application/x-message-display") - 1);
    // we also need to replace the next '&' with '?'
    int32_t firstPartIndex = urlString.FindChar('&');
    if (firstPartIndex != kNotFound)
      urlString.SetCharAt('?', firstPartIndex);
  }

  MsgReplaceSubstring(urlString, "/;section", "?section");
  nsresult rv = CreateStartupUrl(urlString.get(), getter_AddRefs(URL));

  if (NS_SUCCEEDED(rv))
  {
    rv = GetMessageServiceFromURI(aMessageUri, getter_AddRefs(messageService));
    if (NS_SUCCEEDED(rv))
    {
      fetchService = do_QueryInterface(messageService);
      // if the message service has a fetch part service then we know we can fetch mime parts...
      if (fetchService)
      {
        int32_t partPos = urlString.FindChar('?');
        if (partPos == kNotFound)
          return NS_ERROR_FAILURE;
        fullMessageUri.Append(Substring(urlString, partPos));
      }

      nsCOMPtr<nsIStreamListener> convertedListener;
      saveListener->QueryInterface(NS_GET_IID(nsIStreamListener),
                                 getter_AddRefs(convertedListener));

#ifndef XP_MACOSX
      // if the content type is bin hex we are going to do a hokey hack and make sure we decode the bin hex
      // when saving an attachment to disk..
      if (MsgLowerCaseEqualsLiteral(aContentType, APPLICATION_BINHEX))
      {
        nsCOMPtr<nsIStreamListener> listener (do_QueryInterface(convertedListener));
        nsCOMPtr<nsIStreamConverterService> streamConverterService = do_GetService("@mozilla.org/streamConverters;1", &rv);
        nsCOMPtr<nsISupports> channelSupport = do_QueryInterface(saveListener->m_channel);

        rv = streamConverterService->AsyncConvertData(APPLICATION_BINHEX,
                                                      "*/*",
                                                      listener,
                                                      channelSupport,
                                                      getter_AddRefs(convertedListener));
      }
#endif
      if (fetchService)
        rv = fetchService->FetchMimePart(URL, fullMessageUri.get(), convertedListener, mMsgWindow, saveListener, nullptr);
      else
        rv = messageService->DisplayMessage(fullMessageUri.get(), convertedListener, mMsgWindow, nullptr, nullptr, nullptr);
    } // if we got a message service
  } // if we created a url

  if (NS_FAILED(rv))
    Alert("saveAttachmentFailed");

  return rv;
}

NS_IMETHODIMP
nsMessenger::OpenAttachment(const nsACString& aContentType, const nsACString& aURL,
                            const nsACString& aDisplayName, const nsACString& aMessageUri, bool aIsExternalAttachment)
{
  nsresult rv = NS_OK;

  // open external attachments inside our message pane which in turn should trigger the
  // helper app dialog...
  if (aIsExternalAttachment)
    rv = OpenURL(aURL);
  else
  {
    nsCOMPtr <nsIMsgMessageService> messageService;
    rv = GetMessageServiceFromURI(aMessageUri, getter_AddRefs(messageService));
    if (messageService)
      rv = messageService->OpenAttachment(PromiseFlatCString(aContentType).get(), PromiseFlatCString(aDisplayName).get(),
                                          PromiseFlatCString(aURL).get(), PromiseFlatCString(aMessageUri).get(),
                                          mDocShell, mMsgWindow, nullptr);
  }

  return rv;
}

NS_IMETHODIMP
nsMessenger::SaveAttachmentToFolder(const nsACString& contentType, const nsACString& url, const nsACString& displayName,
                                    const nsACString& messageUri, nsIFile * aDestFolder, nsIFile ** aOutFile)
{
  NS_ENSURE_ARG_POINTER(aDestFolder);
  nsresult rv;

  nsCOMPtr<nsIFile> attachmentDestination;
  rv = aDestFolder->Clone(getter_AddRefs(attachmentDestination));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString unescapedFileName;
  ConvertAndSanitizeFileName(PromiseFlatCString(displayName).get(), unescapedFileName);
  rv = attachmentDestination->Append(unescapedFileName);
  NS_ENSURE_SUCCESS(rv, rv);
#ifdef XP_MACOSX
  rv = attachmentDestination->CreateUnique(nsIFile::NORMAL_FILE_TYPE, ATTACHMENT_PERMISSION);
  NS_ENSURE_SUCCESS(rv, rv);
#endif

  rv = SaveAttachment(attachmentDestination, url, messageUri, contentType, nullptr, nullptr);
  attachmentDestination.swap(*aOutFile);
  return rv;
}

NS_IMETHODIMP
nsMessenger::SaveAttachment(const nsACString& aContentType, const nsACString& aURL,
                            const nsACString& aDisplayName, const nsACString& aMessageUri, bool aIsExternalAttachment)
{
  // open external attachments inside our message pane which in turn should trigger the
  // helper app dialog...
  if (aIsExternalAttachment)
    return OpenURL(aURL);
  return SaveOneAttachment(PromiseFlatCString(aContentType).get(),
                           PromiseFlatCString(aURL).get(),
                           PromiseFlatCString(aDisplayName).get(),
                           PromiseFlatCString(aMessageUri).get(),
                           false);
}

nsresult
nsMessenger::SaveOneAttachment(const char * aContentType, const char * aURL,
                               const char * aDisplayName, const char * aMessageUri,
                               bool detaching)
{
  nsresult rv = NS_ERROR_OUT_OF_MEMORY;
  nsCOMPtr<nsIFilePicker> filePicker =
      do_CreateInstance("@mozilla.org/filepicker;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  int16_t dialogResult;
  nsCOMPtr<nsIFile> localFile;
  nsCOMPtr<nsIFile> lastSaveDir;
  nsCString filePath;
  nsString saveAttachmentStr;
  nsString defaultDisplayString;
  ConvertAndSanitizeFileName(aDisplayName, defaultDisplayString);

  GetString(NS_LITERAL_STRING("SaveAttachment"), saveAttachmentStr);
  filePicker->Init(mWindow, saveAttachmentStr,
                   nsIFilePicker::modeSave);
  filePicker->SetDefaultString(defaultDisplayString);
  filePicker->AppendFilters(nsIFilePicker::filterAll);

  rv = GetLastSaveDirectory(getter_AddRefs(lastSaveDir));
  if (NS_SUCCEEDED(rv) && lastSaveDir)
    filePicker->SetDisplayDirectory(lastSaveDir);

  rv = filePicker->Show(&dialogResult);
  if (NS_FAILED(rv) || dialogResult == nsIFilePicker::returnCancel)
    return rv;

  rv = filePicker->GetFile(getter_AddRefs(localFile));
  NS_ENSURE_SUCCESS(rv, rv);

  SetLastSaveDirectory(localFile);

  nsCString dirName;
  rv = localFile->GetNativePath(dirName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsSaveAllAttachmentsState *saveState = 
    new nsSaveAllAttachmentsState(1,
                                  &aContentType,
                                  &aURL,
                                  &aDisplayName,
                                  &aMessageUri,
                                  dirName.get(),
                                  detaching);

  return SaveAttachment(localFile, nsDependentCString(aURL), nsDependentCString(aMessageUri),
                        nsDependentCString(aContentType), (void *)saveState, nullptr);
}


NS_IMETHODIMP
nsMessenger::SaveAllAttachments(uint32_t count,
                                const char **contentTypeArray,
                                const char **urlArray,
                                const char **displayNameArray,
                                const char **messageUriArray)
{
  if (!count)
    return NS_ERROR_INVALID_ARG;
  return SaveAllAttachments(count, contentTypeArray, urlArray, displayNameArray, messageUriArray, false);
}

nsresult
nsMessenger::SaveAllAttachments(uint32_t count,
                                const char **contentTypeArray,
                                const char **urlArray,
                                const char **displayNameArray,
                                const char **messageUriArray,
                                bool detaching)
{
  nsresult rv = NS_ERROR_OUT_OF_MEMORY;
  nsCOMPtr<nsIFilePicker> filePicker =
    do_CreateInstance("@mozilla.org/filepicker;1", &rv);
  nsCOMPtr<nsIFile> localFile;
  nsCOMPtr<nsIFile> lastSaveDir;
  int16_t dialogResult;
  nsString saveAttachmentStr;

  NS_ENSURE_SUCCESS(rv, rv);
  GetString(NS_LITERAL_STRING("SaveAllAttachments"), saveAttachmentStr);
  filePicker->Init(mWindow,
                   saveAttachmentStr,
                   nsIFilePicker::modeGetFolder);

  rv = GetLastSaveDirectory(getter_AddRefs(lastSaveDir));
  if (NS_SUCCEEDED(rv) && lastSaveDir)
    filePicker->SetDisplayDirectory(lastSaveDir);

  rv = filePicker->Show(&dialogResult);
  if (NS_FAILED(rv) || dialogResult == nsIFilePicker::returnCancel)
    return rv;

  rv = filePicker->GetFile(getter_AddRefs(localFile));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SetLastSaveDirectory(localFile);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString dirName;
  nsSaveAllAttachmentsState *saveState = nullptr;
  rv = localFile->GetNativePath(dirName);
  NS_ENSURE_SUCCESS(rv, rv);

  saveState = new nsSaveAllAttachmentsState(count,
                                            contentTypeArray,
                                            urlArray,
                                            displayNameArray,
                                            messageUriArray,
                                            dirName.get(),
                                            detaching);
  nsString unescapedName;
  ConvertAndSanitizeFileName(displayNameArray[0], unescapedName);
  rv = localFile->Append(unescapedName);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = PromptIfFileExists(localFile);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SaveAttachment(localFile, nsDependentCString(urlArray[0]), nsDependentCString(messageUriArray[0]),
                      nsDependentCString(contentTypeArray[0]), (void *)saveState, nullptr);
  return rv;
}

enum MESSENGER_SAVEAS_FILE_TYPE
{
 EML_FILE_TYPE =  0,
 HTML_FILE_TYPE = 1,
 TEXT_FILE_TYPE = 2,
 ANY_FILE_TYPE = 3
};
#define HTML_FILE_EXTENSION ".htm"
#define HTML_FILE_EXTENSION2 ".html"
#define TEXT_FILE_EXTENSION ".txt"

NS_IMETHODIMP
nsMessenger::SaveAs(const nsACString& aURI, bool aAsFile,
                    nsIMsgIdentity *aIdentity, const nsAString& aMsgFilename,
                    bool aBypassFilePicker)
{
  nsCOMPtr<nsIMsgMessageService> messageService;
  nsCOMPtr<nsIUrlListener> urlListener;
  nsSaveMsgListener *saveListener = nullptr;
  nsCOMPtr<nsIURI> url;
  nsCOMPtr<nsIStreamListener> convertedListener;
  int32_t saveAsFileType = EML_FILE_TYPE;

  nsresult rv = GetMessageServiceFromURI(aURI, getter_AddRefs(messageService));
  if (NS_FAILED(rv))
    goto done;

  if (aAsFile)
  {
    nsCOMPtr<nsIFile> saveAsFile;
    // show the file picker if BypassFilePicker is not specified (null) or false
    if (!aBypassFilePicker) {
      rv = GetSaveAsFile(aMsgFilename, &saveAsFileType, getter_AddRefs(saveAsFile));
      // A null saveAsFile means that the user canceled the save as
      if (NS_FAILED(rv) || !saveAsFile)
        goto done;
    }
    else {
      saveAsFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
      rv = saveAsFile->InitWithPath(aMsgFilename);
      if (NS_FAILED(rv))
        goto done;      
      if (StringEndsWith(aMsgFilename, NS_LITERAL_STRING(TEXT_FILE_EXTENSION),
                         nsCaseInsensitiveStringComparator()))
        saveAsFileType = TEXT_FILE_TYPE;
      else if ((StringEndsWith(aMsgFilename,
                               NS_LITERAL_STRING(HTML_FILE_EXTENSION),
                               nsCaseInsensitiveStringComparator())) ||
               (StringEndsWith(aMsgFilename,
                               NS_LITERAL_STRING(HTML_FILE_EXTENSION2),
                               nsCaseInsensitiveStringComparator())))
        saveAsFileType = HTML_FILE_TYPE;
      else
        saveAsFileType = EML_FILE_TYPE;
    } 

    // After saveListener goes out of scope, the listener will be owned by
    // whoever the listener is registered with, usually a URL.
    nsRefPtr<nsSaveMsgListener> saveListener = new nsSaveMsgListener(saveAsFile, this, nullptr);
    if (!saveListener) {
      rv = NS_ERROR_OUT_OF_MEMORY;
      goto done;
    }
    rv = saveListener->QueryInterface(NS_GET_IID(nsIUrlListener), getter_AddRefs(urlListener));
    if (NS_FAILED(rv))
      goto done;

    if (saveAsFileType == EML_FILE_TYPE)
    {
      rv = messageService->SaveMessageToDisk(PromiseFlatCString(aURI).get(), saveAsFile, false,
        urlListener, nullptr,
        true, mMsgWindow);
    }
    else
    {
      nsAutoCString urlString(aURI);

      // we can't go RFC822 to TXT until bug #1775 is fixed
      // so until then, do the HTML to TXT conversion in
      // nsSaveMsgListener::OnStopRequest(), see ConvertBufToPlainText()
      //
      // Setup the URL for a "Save As..." Operation...
      // For now, if this is a save as TEXT operation, then do
      // a "printing" operation
      if (saveAsFileType == TEXT_FILE_TYPE)
      {
        saveListener->m_outputFormat = nsSaveMsgListener::ePlainText;
        saveListener->m_doCharsetConversion = true;
        urlString.AppendLiteral("?header=print");
      }
      else
      {
        saveListener->m_outputFormat = nsSaveMsgListener::eHTML;
        saveListener->m_doCharsetConversion = false;
        urlString.AppendLiteral("?header=saveas");
      }

      rv = CreateStartupUrl(urlString.get(), getter_AddRefs(url));
      NS_ASSERTION(NS_SUCCEEDED(rv), "CreateStartupUrl failed");
      if (NS_FAILED(rv))
        goto done;

      saveListener->m_channel = nullptr;
      rv = NS_NewInputStreamChannel(getter_AddRefs(saveListener->m_channel),
        url,
        nullptr);                // inputStream
      NS_ASSERTION(NS_SUCCEEDED(rv), "NS_NewInputStreamChannel failed");
      if (NS_FAILED(rv))
        goto done;

      nsCOMPtr<nsIStreamConverterService> streamConverterService = do_GetService("@mozilla.org/streamConverters;1");
      nsCOMPtr<nsISupports> channelSupport = do_QueryInterface(saveListener->m_channel);

      // we can't go RFC822 to TXT until bug #1775 is fixed
      // so until then, do the HTML to TXT conversion in
      // nsSaveMsgListener::OnStopRequest(), see ConvertBufToPlainText()
      rv = streamConverterService->AsyncConvertData(MESSAGE_RFC822,
        TEXT_HTML,
        saveListener,
        channelSupport,
        getter_AddRefs(convertedListener));
      NS_ASSERTION(NS_SUCCEEDED(rv), "AsyncConvertData failed");
      if (NS_FAILED(rv))
        goto done;

      rv = messageService->DisplayMessage(urlString.get(), convertedListener, mMsgWindow,
        nullptr, nullptr, nullptr);
    }
  }
  else
  {
    // ** save as Template
    nsCOMPtr <nsIFile> tmpFile;
    nsresult rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
                                                  "nsmail.tmp",
                                                  getter_AddRefs(tmpFile));

    NS_ENSURE_SUCCESS(rv, rv);

    // For temp file, we should use restrictive 00600 instead of ATTACHMENT_PERMISSION 
    rv = tmpFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
    if (NS_FAILED(rv)) goto done;

    // The saveListener is owned by whoever we ultimately register the
    // listener with, generally a URL.
    saveListener = new nsSaveMsgListener(tmpFile, this, nullptr);
    if (!saveListener) {
      rv = NS_ERROR_OUT_OF_MEMORY;
      goto done;
    }

    if (aIdentity)
      rv = aIdentity->GetStationeryFolder(saveListener->m_templateUri);
    if (NS_FAILED(rv))
      goto done;

    bool needDummyHeader = StringBeginsWith(saveListener->m_templateUri, NS_LITERAL_CSTRING("mailbox://"));
    bool canonicalLineEnding = StringBeginsWith(saveListener->m_templateUri, NS_LITERAL_CSTRING("imap://"));

    rv = saveListener->QueryInterface(
      NS_GET_IID(nsIUrlListener),
      getter_AddRefs(urlListener));
    if (NS_FAILED(rv))
      goto done;

    rv = messageService->SaveMessageToDisk(PromiseFlatCString(aURI).get(), tmpFile,
      needDummyHeader,
      urlListener, nullptr,
      canonicalLineEnding, mMsgWindow);
  }

done:
  if (NS_FAILED(rv))
  {
    NS_IF_RELEASE(saveListener);
    Alert("saveMessageFailed");
  }
  return rv;
}

nsresult
nsMessenger::GetSaveAsFile(const nsAString& aMsgFilename, int32_t *aSaveAsFileType,
                           nsIFile **aSaveAsFile)
{
  nsresult rv;
  nsCOMPtr<nsIFilePicker> filePicker = do_CreateInstance("@mozilla.org/filepicker;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsString saveMailAsStr;
  GetString(NS_LITERAL_STRING("SaveMailAs"), saveMailAsStr);
  filePicker->Init(mWindow, saveMailAsStr, nsIFilePicker::modeSave);

  // if we have a non-null filename use it, otherwise use default save message one
  if (aMsgFilename.IsEmpty())
  {
    nsString saveMsgStr;
    GetString(NS_LITERAL_STRING("defaultSaveMessageAsFileName"), saveMsgStr);
    filePicker->SetDefaultString(saveMsgStr);
  }
  else
  {
    filePicker->SetDefaultString(aMsgFilename);
  }

  // because we will be using GetFilterIndex()
  // we must call AppendFilters() one at a time,
  // in MESSENGER_SAVEAS_FILE_TYPE order
  nsString emlFilesStr;
  GetString(NS_LITERAL_STRING("EMLFiles"), emlFilesStr);
  filePicker->AppendFilter(emlFilesStr,
                           NS_LITERAL_STRING("*.eml"));
  filePicker->AppendFilters(nsIFilePicker::filterHTML);
  filePicker->AppendFilters(nsIFilePicker::filterText);
  filePicker->AppendFilters(nsIFilePicker::filterAll);

  // Save as the "All Files" file type by default. We want to save as .eml by
  // default, but the filepickers on some platforms don't switch extensions
  // based on the file type selected (bug 508597).
  filePicker->SetFilterIndex(ANY_FILE_TYPE);
  // Yes, this is fine even if we ultimately save as HTML or text. On Windows,
  // this actually is a boolean telling the file picker to automatically add
  // the correct extension depending on the filter. On Mac or Linux this is a
  // no-op.
  filePicker->SetDefaultExtension(NS_LITERAL_STRING("eml"));

  int16_t dialogResult;

  nsCOMPtr <nsIFile> lastSaveDir;
  rv = GetLastSaveDirectory(getter_AddRefs(lastSaveDir));
  if (NS_SUCCEEDED(rv) && lastSaveDir)
    filePicker->SetDisplayDirectory(lastSaveDir);

  nsCOMPtr<nsIFile> localFile;
  rv = filePicker->Show(&dialogResult);
  NS_ENSURE_SUCCESS(rv, rv);
  if (dialogResult == nsIFilePicker::returnCancel)
  {
    // We'll indicate this by setting the outparam to null.
    *aSaveAsFile = nullptr;
    return NS_OK;
  }

  rv = filePicker->GetFile(getter_AddRefs(localFile));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SetLastSaveDirectory(localFile);
  NS_ENSURE_SUCCESS(rv, rv);

  int32_t selectedSaveAsFileType;
  rv = filePicker->GetFilterIndex(&selectedSaveAsFileType);
  NS_ENSURE_SUCCESS(rv, rv);

  // If All Files was selected, look at the extension
  if (selectedSaveAsFileType == ANY_FILE_TYPE)
  {
    nsAutoString fileName;
    rv = localFile->GetLeafName(fileName);
    NS_ENSURE_SUCCESS(rv, rv);

    if (StringEndsWith(fileName, NS_LITERAL_STRING(HTML_FILE_EXTENSION),
                       nsCaseInsensitiveStringComparator()) ||
        StringEndsWith(fileName, NS_LITERAL_STRING(HTML_FILE_EXTENSION2),
                       nsCaseInsensitiveStringComparator()))
      *aSaveAsFileType = HTML_FILE_TYPE;
    else if (StringEndsWith(fileName, NS_LITERAL_STRING(TEXT_FILE_EXTENSION),
                            nsCaseInsensitiveStringComparator()))
      *aSaveAsFileType = TEXT_FILE_TYPE;
    else
      // The default is .eml
      *aSaveAsFileType = EML_FILE_TYPE;
  }
  else
  {
    *aSaveAsFileType = selectedSaveAsFileType;
  }

  if (dialogResult == nsIFilePicker::returnReplace)
  {
    // be extra safe and only delete when the file is really a file
    bool isFile;
    rv = localFile->IsFile(&isFile);
    if (NS_SUCCEEDED(rv) && isFile)
    {
      rv = localFile->Remove(false /* recursive delete */);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    else
    {
      // We failed, or this isn't a file. We can't do anything about it.
      return NS_ERROR_FAILURE;
    }
  }

  *aSaveAsFile = nullptr;
  localFile.swap(*aSaveAsFile);
  return NS_OK;
}

/**
 * Show a Save All dialog allowing the user to pick which folder to save
 * messages to.
 * @param [out] aSaveDir directory to save to. Will be null on cancel.
 */
nsresult
nsMessenger::GetSaveToDir(nsIFile **aSaveDir)
{
  nsresult rv;
  nsCOMPtr<nsIFilePicker> filePicker =
    do_CreateInstance("@mozilla.org/filepicker;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsString chooseFolderStr;
  GetString(NS_LITERAL_STRING("ChooseFolder"), chooseFolderStr);
  filePicker->Init(mWindow, chooseFolderStr, nsIFilePicker::modeGetFolder);

  nsCOMPtr<nsIFile> lastSaveDir;
  rv = GetLastSaveDirectory(getter_AddRefs(lastSaveDir));
  if (NS_SUCCEEDED(rv) && lastSaveDir)
    filePicker->SetDisplayDirectory(lastSaveDir);

  int16_t dialogResult;
  rv = filePicker->Show(&dialogResult);
  if (NS_FAILED(rv) || dialogResult == nsIFilePicker::returnCancel)
  {
    // We'll indicate this by setting the outparam to null.
    *aSaveDir = nullptr;
    return NS_OK;
  }

  nsCOMPtr<nsIFile> dir;
  rv = filePicker->GetFile(getter_AddRefs(dir));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SetLastSaveDirectory(dir);
  NS_ENSURE_SUCCESS(rv, rv);

  *aSaveDir = nullptr;
  dir.swap(*aSaveDir);
  return NS_OK;
}

NS_IMETHODIMP
nsMessenger::SaveMessages(uint32_t aCount,
                          const PRUnichar **aFilenameArray,
                          const char **aMessageUriArray)
{
  NS_ENSURE_ARG_MIN(aCount, 1);
  NS_ENSURE_ARG_POINTER(aFilenameArray);
  NS_ENSURE_ARG_POINTER(aMessageUriArray);

  nsresult rv;

  nsCOMPtr<nsIFile> saveDir;
  rv = GetSaveToDir(getter_AddRefs(saveDir));
  NS_ENSURE_SUCCESS(rv, rv);
  if (!saveDir) // A null saveDir means that the user canceled the save.
    return NS_OK;

  for (uint32_t i = 0; i < aCount; i++) {
    if (!aFilenameArray[i]) // just to be sure
      return NS_ERROR_FAILURE;

    nsCOMPtr<nsIFile> saveToFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = saveToFile->InitWithFile(saveDir);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = saveToFile->Append(nsDependentString(aFilenameArray[i]));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = PromptIfFileExists(saveToFile);
    if (NS_FAILED(rv))
      continue;

    nsCOMPtr<nsIMsgMessageService> messageService;
    nsCOMPtr<nsIUrlListener> urlListener;

    rv = GetMessageServiceFromURI(nsDependentCString(aMessageUriArray[i]),
                                  getter_AddRefs(messageService));
    if (NS_FAILED(rv)) {
      Alert("saveMessageFailed");
      return rv;
    }

    nsSaveMsgListener *saveListener = new nsSaveMsgListener(saveToFile, this, nullptr);
    if (!saveListener) {
      NS_IF_RELEASE(saveListener);
      Alert("saveMessageFailed");
      return NS_ERROR_OUT_OF_MEMORY;
    }
    NS_ADDREF(saveListener);

    rv = saveListener->QueryInterface(NS_GET_IID(nsIUrlListener),
                                      getter_AddRefs(urlListener));
    if (NS_FAILED(rv)) {
      NS_IF_RELEASE(saveListener);
      Alert("saveMessageFailed");
      return rv;
    }

    // Ok, now save the message.
    rv = messageService->SaveMessageToDisk(aMessageUriArray[i],
                                           saveToFile, false,
                                           urlListener, nullptr,
                                           true, mMsgWindow);
  }
  return rv;
}

nsresult
nsMessenger::Alert(const char *stringName)
{
  nsresult rv = NS_OK;

  if (mDocShell)
  {
    nsCOMPtr<nsIPrompt> dialog(do_GetInterface(mDocShell));

    if (dialog)
    {
      nsString alertStr;
      GetString(NS_ConvertASCIItoUTF16(stringName), alertStr);
      rv = dialog->Alert(nullptr, alertStr.get());
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMessenger::MessageServiceFromURI(const nsACString& aUri, nsIMsgMessageService **aMsgService)
{
  NS_ENSURE_ARG_POINTER(aMsgService);
  return GetMessageServiceFromURI(aUri, aMsgService);
}

NS_IMETHODIMP
nsMessenger::MsgHdrFromURI(const nsACString& aUri, nsIMsgDBHdr **aMsgHdr)
{
  NS_ENSURE_ARG_POINTER(aMsgHdr);
  nsCOMPtr <nsIMsgMessageService> msgService;
  nsresult rv;


  if (mMsgWindow &&
      (StringBeginsWith(aUri, NS_LITERAL_CSTRING("file:")) ||
       PromiseFlatCString(aUri).Find("type=application/x-message-display") >= 0))
  {
    nsCOMPtr <nsIMsgHeaderSink> headerSink;
    mMsgWindow->GetMsgHeaderSink(getter_AddRefs(headerSink));
    if (headerSink)
    {
      rv = headerSink->GetDummyMsgHeader(aMsgHdr);
      // Is there a way to check if they're asking for the hdr currently
      // displayed in a stand-alone msg window from a .eml file?
      // (pretty likely if this is a file: uri)
      return rv;
    }
  }

  rv = GetMessageServiceFromURI(aUri, getter_AddRefs(msgService));
  NS_ENSURE_SUCCESS(rv, rv);
  return msgService->MessageURIToMsgHdr(PromiseFlatCString(aUri).get(), aMsgHdr);
}

NS_IMETHODIMP nsMessenger::GetUndoTransactionType(uint32_t *txnType)
{
  NS_ENSURE_TRUE(txnType && mTxnMgr, NS_ERROR_NULL_POINTER);

  nsresult rv;
  *txnType = nsMessenger::eUnknown;
  nsCOMPtr<nsITransaction> txn;
  rv = mTxnMgr->PeekUndoStack(getter_AddRefs(txn));
  if (NS_SUCCEEDED(rv) && txn)
  {
    nsCOMPtr <nsIPropertyBag2> propertyBag = do_QueryInterface(txn, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    return propertyBag->GetPropertyAsUint32(NS_LITERAL_STRING("type"), txnType);
  }
  return rv;
}

NS_IMETHODIMP nsMessenger::CanUndo(bool *bValue)
{
  NS_ENSURE_TRUE(bValue && mTxnMgr, NS_ERROR_NULL_POINTER);

  nsresult rv;
  *bValue = false;
  int32_t count = 0;
  rv = mTxnMgr->GetNumberOfUndoItems(&count);
  if (NS_SUCCEEDED(rv) && count > 0)
    *bValue = true;
  return rv;
}

NS_IMETHODIMP nsMessenger::GetRedoTransactionType(uint32_t *txnType)
{
  NS_ENSURE_TRUE(txnType && mTxnMgr, NS_ERROR_NULL_POINTER);

  nsresult rv;
  *txnType = nsMessenger::eUnknown;
  nsCOMPtr<nsITransaction> txn;
  rv = mTxnMgr->PeekRedoStack(getter_AddRefs(txn));
  if (NS_SUCCEEDED(rv) && txn)
  {
    nsCOMPtr <nsIPropertyBag2> propertyBag = do_QueryInterface(txn, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    return propertyBag->GetPropertyAsUint32(NS_LITERAL_STRING("type"), txnType);
  }
  return rv;
}

NS_IMETHODIMP nsMessenger::CanRedo(bool *bValue)
{
  NS_ENSURE_TRUE(bValue && mTxnMgr, NS_ERROR_NULL_POINTER);

  nsresult rv;
  *bValue = false;
  int32_t count = 0;
  rv = mTxnMgr->GetNumberOfRedoItems(&count);
  if (NS_SUCCEEDED(rv) && count > 0)
    *bValue = true;
  return rv;
}

NS_IMETHODIMP
nsMessenger::Undo(nsIMsgWindow *msgWindow)
{
  nsresult rv = NS_OK;
  if (mTxnMgr)
  {
    int32_t numTxn = 0;
    rv = mTxnMgr->GetNumberOfUndoItems(&numTxn);
    if (NS_SUCCEEDED(rv) && numTxn > 0)
    {
        nsCOMPtr<nsITransaction> txn;
        rv = mTxnMgr->PeekUndoStack(getter_AddRefs(txn));
        if (NS_SUCCEEDED(rv) && txn)
        {
            static_cast<nsMsgTxn*>(static_cast<nsITransaction*>(txn.get()))->SetMsgWindow(msgWindow);
        }
        mTxnMgr->UndoTransaction();
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMessenger::Redo(nsIMsgWindow *msgWindow)
{
  nsresult rv = NS_OK;
  if (mTxnMgr)
  {
    int32_t numTxn = 0;
    rv = mTxnMgr->GetNumberOfRedoItems(&numTxn);
    if (NS_SUCCEEDED(rv) && numTxn > 0)
    {
        nsCOMPtr<nsITransaction> txn;
        rv = mTxnMgr->PeekRedoStack(getter_AddRefs(txn));
        if (NS_SUCCEEDED(rv) && txn)
        {
            static_cast<nsMsgTxn*>(static_cast<nsITransaction*>(txn.get()))->SetMsgWindow(msgWindow);
        }
        mTxnMgr->RedoTransaction();
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMessenger::GetTransactionManager(nsITransactionManager* *aTxnMgr)
{
  NS_ENSURE_TRUE(mTxnMgr && aTxnMgr, NS_ERROR_NULL_POINTER);

  *aTxnMgr = mTxnMgr;
  NS_ADDREF(*aTxnMgr);

  return NS_OK;
}

NS_IMETHODIMP nsMessenger::SetDocumentCharset(const nsACString& aCharacterSet)
{
  // We want to redisplay the currently selected message (if any) but forcing the
  // redisplay to use characterSet
  if (!mLastDisplayURI.IsEmpty())
  {
    SetDisplayCharset(NS_LITERAL_CSTRING("UTF-8"));

    nsCOMPtr <nsIMsgMessageService> messageService;
    nsresult rv = GetMessageServiceFromURI(mLastDisplayURI, getter_AddRefs(messageService));

    if (NS_SUCCEEDED(rv) && messageService)
    {
      messageService->DisplayMessage(mLastDisplayURI.get(), mDocShell, mMsgWindow, nullptr,
                                     PromiseFlatCString(aCharacterSet).get(), nullptr);
    }
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMessenger::GetLastDisplayedMessageUri(nsACString& aLastDisplayedMessageUri)
{
  aLastDisplayedMessageUri = mLastDisplayURI;
  return NS_OK;
}

nsSaveMsgListener::nsSaveMsgListener(nsIFile* aFile, nsMessenger *aMessenger, nsIUrlListener *aListener)
{
  m_file = do_QueryInterface(aFile);
  m_messenger = aMessenger;
  mListener = aListener;
  mUrlHasStopped = false;
  mRequestHasStopped = false;
  
    // rhp: for charset handling
  m_doCharsetConversion = false;
  m_saveAllAttachmentsState = nullptr;
  mProgress = 0;
  mMaxProgress = -1;
  mCanceled = false;
  m_outputFormat = eUnknown;
  mInitialized = false;
  m_dataBuffer = new char[FOUR_K];
}

nsSaveMsgListener::~nsSaveMsgListener()
{
}

//
// nsISupports
//
NS_IMPL_ISUPPORTS5(nsSaveMsgListener,
                   nsIUrlListener,
                   nsIMsgCopyServiceListener,
                   nsIStreamListener,
                   nsIRequestObserver,
                   nsICancelable)

NS_IMETHODIMP
nsSaveMsgListener::Cancel(nsresult status)
{
  mCanceled = true;
  return NS_OK;
}

//
// nsIUrlListener
//
NS_IMETHODIMP
nsSaveMsgListener::OnStartRunningUrl(nsIURI* url)
{
  if (mListener)
    mListener->OnStartRunningUrl(url);
  return NS_OK;
}

NS_IMETHODIMP
nsSaveMsgListener::OnStopRunningUrl(nsIURI *url, nsresult exitCode)
{
  nsresult rv = exitCode;
  mUrlHasStopped = true;

  // ** save as template goes here
  if (!m_templateUri.IsEmpty()) 
  {
    nsCOMPtr<nsIRDFService> rdf(do_GetService(kRDFServiceCID, &rv));
    if (NS_FAILED(rv)) goto done;
    nsCOMPtr<nsIRDFResource> res;
    rv = rdf->GetResource(m_templateUri, getter_AddRefs(res));
    if (NS_FAILED(rv)) goto done;
    nsCOMPtr<nsIMsgFolder> templateFolder;
    templateFolder = do_QueryInterface(res, &rv);
    if (NS_FAILED(rv)) goto done;
    nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID);
    if (copyService)
    {
      nsCOMPtr<nsIFile> clone;
      m_file->Clone(getter_AddRefs(clone));
      rv = copyService->CopyFileMessage(clone, templateFolder, nullptr,
                                        true, nsMsgMessageFlags::Read,
                                        EmptyCString(), this, nullptr);
      // Clear this so we don't end up in a loop if OnStopRunningUrl gets
      // called again.
      m_templateUri.Truncate();
    }
  }
  else if (m_outputStream && mRequestHasStopped)
  {
    m_outputStream->Close();
    m_outputStream = nullptr;
  }

done:
  if (NS_FAILED(rv))
  {
    if (m_file)
      m_file->Remove(false);
    if (m_messenger)
        m_messenger->Alert("saveMessageFailed");
  }
  
  if (mRequestHasStopped && mListener)
    mListener->OnStopRunningUrl(url, exitCode);
  else
    mListenerUri = url;
  
  return rv;
}

NS_IMETHODIMP
nsSaveMsgListener::OnStartCopy(void)
{
  return NS_OK;
}

NS_IMETHODIMP
nsSaveMsgListener::OnProgress(uint32_t aProgress, uint32_t aProgressMax)
{
  return NS_OK;
}

NS_IMETHODIMP
nsSaveMsgListener::SetMessageKey(uint32_t aKey)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsSaveMsgListener::GetMessageId(nsACString& aMessageId)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsSaveMsgListener::OnStopCopy(nsresult aStatus)
{
  if (m_file)
    m_file->Remove(false);
  return aStatus;
}

// initializes the progress window if we are going to show one
// and for OSX, sets creator flags on the output file
nsresult nsSaveMsgListener::InitializeDownload(nsIRequest * aRequest, uint32_t aBytesDownloaded)
{
  nsresult rv = NS_OK;
  
  mInitialized = true;
  nsCOMPtr<nsIChannel> channel (do_QueryInterface(aRequest));
  
  if (!channel)
    return rv;
  
  // Get the max progress from the URL if we haven't already got it.
  if (mMaxProgress == -1)
  {
    nsCOMPtr<nsIURI> uri;
    channel->GetURI(getter_AddRefs(uri));
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl(do_QueryInterface(uri));
    if (mailnewsUrl)
      mailnewsUrl->GetMaxProgress(&mMaxProgress);
  }
  
  if (!m_contentType.IsEmpty())
  {
    nsCOMPtr<nsIMIMEService> mimeService (do_GetService(NS_MIMESERVICE_CONTRACTID));
    nsCOMPtr<nsIMIMEInfo> mimeinfo;
    
    mimeService->GetFromTypeAndExtension(m_contentType, EmptyCString(), getter_AddRefs(mimeinfo));
    
    // create a download progress window
    // We don't want to show the progress dialog if the download is really small.
    // but what is a small download? Well that's kind of arbitrary
    // so make an arbitrary decision based on the content length of the
    // attachment -- show it if less than half of the download has completed

    // When we don't allow warnings, also don't show progress, as this
    //  is an environment (typically filters) where we don't want
    //  interruption.
    bool allowProgress = true;
    if (m_saveAllAttachmentsState)
      allowProgress = !m_saveAllAttachmentsState->m_withoutWarning;
    if (allowProgress && mMaxProgress != -1 &&
        mMaxProgress > aBytesDownloaded * 2)
    {
      nsCOMPtr<nsITransfer> tr = do_CreateInstance(NS_TRANSFER_CONTRACTID, &rv);
      if (tr && m_file)
      {
        PRTime timeDownloadStarted = PR_Now();
        
        nsCOMPtr<nsIURI> outputURI;
        NS_NewFileURI(getter_AddRefs(outputURI), m_file);
        
        nsCOMPtr<nsIURI> url;
        channel->GetURI(getter_AddRefs(url));
        rv = tr->Init(url, outputURI, EmptyString(), mimeinfo,
                      timeDownloadStarted, nullptr, this, false);
        
          // now store the web progresslistener
        mTransfer = tr;
      }
    }
  }
  return rv;
}

NS_IMETHODIMP
nsSaveMsgListener::OnStartRequest(nsIRequest* request, nsISupports* aSupport)
{
  if (m_file)
    MsgNewBufferedFileOutputStream(getter_AddRefs(m_outputStream), m_file, -1, ATTACHMENT_PERMISSION);
  if (!m_outputStream)
  {
    mCanceled = true;
    if (m_messenger)
      m_messenger->Alert("saveAttachmentFailed");
  }
  return NS_OK;
}

NS_IMETHODIMP
nsSaveMsgListener::OnStopRequest(nsIRequest* request, nsISupports* aSupport,
                                 nsresult status)
{
  nsresult rv = NS_OK;
  mRequestHasStopped = true;
  
  // rhp: If we are doing the charset conversion magic, this is different
  // processing, otherwise, its just business as usual.
  //
  if ( (m_doCharsetConversion) && (m_outputStream) )
  {
    char        *conBuf = nullptr;
    uint32_t    conLength = 0;
    
    // If we need text/plain, then we need to convert the HTML and then convert
    // to the systems charset
    //
    if (m_outputFormat == ePlainText)
    {
      NS_ConvertUTF8toUTF16 utf16Buffer(m_msgBuffer);
      ConvertBufToPlainText(utf16Buffer, false, false);
      rv = nsMsgI18NSaveAsCharset(TEXT_PLAIN, nsMsgI18NFileSystemCharset(),
                                  utf16Buffer.get(), &conBuf);
      if ( NS_SUCCEEDED(rv) && (conBuf) )
        conLength = strlen(conBuf);
    }
    
    if ( (NS_SUCCEEDED(rv)) && (conBuf) )
    {
      uint32_t      writeCount;
      rv = m_outputStream->Write(conBuf, conLength, &writeCount);
      if (conLength != writeCount)
        rv = NS_ERROR_FAILURE;
    }
    
    NS_Free(conBuf);
  }
 
  if (m_outputStream)
  {
    m_outputStream->Close();
    m_outputStream = nullptr;
  }
  
  if (m_saveAllAttachmentsState)
  {
    m_saveAllAttachmentsState->m_curIndex++;
    if (!mCanceled && m_saveAllAttachmentsState->m_curIndex < m_saveAllAttachmentsState->m_count)
    {
      nsSaveAllAttachmentsState *state = m_saveAllAttachmentsState;
      uint32_t i = state->m_curIndex;
      nsString unescapedName;
      nsCOMPtr<nsIFile> localFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
      if (NS_FAILED(rv)) goto done;
      rv = localFile->InitWithNativePath(nsDependentCString(state->m_directoryName));
      
      if (NS_FAILED(rv)) goto done;
      
      ConvertAndSanitizeFileName(state->m_displayNameArray[i], unescapedName);
      rv = localFile->Append(unescapedName);
      if (NS_FAILED(rv))
        goto done;

      // When we are running with no warnings (typically filters and other automatic
      //  uses), then don't prompt for duplicates, but create a unique file
      //  instead.
      if (!m_saveAllAttachmentsState->m_withoutWarning)
      {
        rv = m_messenger->PromptIfFileExists(localFile);
        if (NS_FAILED(rv)) goto done;
      }
      else
      {
        rv = localFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, ATTACHMENT_PERMISSION);
        if (NS_FAILED(rv)) goto done;
      }
      rv = m_messenger->SaveAttachment(localFile,
                                       nsDependentCString(state->m_urlArray[i]),
                                       nsDependentCString(state->m_messageUriArray[i]),
                                       nsDependentCString(state->m_contentTypeArray[i]),
                                       (void *)state, nullptr);
      done:
        if (NS_FAILED(rv))
        {
          delete state;
          m_saveAllAttachmentsState = nullptr;
        }
    }
    else
    {
          // check if we're saving attachments prior to detaching them.
      if (m_saveAllAttachmentsState->m_detachingAttachments && !mCanceled)
      {
        nsSaveAllAttachmentsState *state = m_saveAllAttachmentsState;
        m_messenger->DetachAttachments(state->m_count,
                                       (const char **) state->m_contentTypeArray,
                                       (const char **) state->m_urlArray,
                                       (const char **) state->m_displayNameArray,
                                       (const char **) state->m_messageUriArray,
                                       &state->m_savedFiles,
                                       state->m_withoutWarning);
      }

      delete m_saveAllAttachmentsState;
      m_saveAllAttachmentsState = nullptr;
    }
  }

  if(mTransfer)
  {
    mTransfer->OnProgressChange64(nullptr, nullptr, mMaxProgress, mMaxProgress, mMaxProgress, mMaxProgress);
    mTransfer->OnStateChange(nullptr, nullptr, nsIWebProgressListener::STATE_STOP |
      nsIWebProgressListener::STATE_IS_NETWORK, NS_OK);
    mTransfer = nullptr; // break any circular dependencies between the progress dialog and use
  }

  if (mUrlHasStopped && mListener)
    mListener->OnStopRunningUrl(mListenerUri, rv);

  return NS_OK;
}

NS_IMETHODIMP
nsSaveMsgListener::OnDataAvailable(nsIRequest* request,
                                  nsISupports* aSupport,
                                  nsIInputStream* inStream,
                                  uint64_t srcOffset,
                                  uint32_t count)
{
  nsresult rv = NS_ERROR_FAILURE;
  // first, check to see if we've been canceled....
  if (mCanceled) // then go cancel our underlying channel too
    return request->Cancel(NS_BINDING_ABORTED);
  
  if (!mInitialized)
    InitializeDownload(request, count);

  if (m_dataBuffer && m_outputStream)
  {
    mProgress += count;
    uint64_t available;
    uint32_t readCount, maxReadCount = FOUR_K;
    uint32_t writeCount;
    rv = inStream->Available(&available);
    while (NS_SUCCEEDED(rv) && available)
    {
      if (maxReadCount > available)
        maxReadCount = (uint32_t)available;
      rv = inStream->Read(m_dataBuffer, maxReadCount, &readCount);

      // rhp:
      // Ok, now we do one of two things. If we are sending out HTML, then
      // just write it to the HTML stream as it comes along...but if this is
      // a save as TEXT operation, we need to buffer this up for conversion
      // when we are done. When the stream converter for HTML-TEXT gets in place,
      // this magic can go away.
      //
      if (NS_SUCCEEDED(rv))
      {
        if ( (m_doCharsetConversion) && (m_outputFormat == ePlainText) )
          m_msgBuffer.Append(Substring(m_dataBuffer, m_dataBuffer + readCount));
        else
          rv = m_outputStream->Write(m_dataBuffer, readCount, &writeCount);

        available -= readCount;
      }
    }

    if (NS_SUCCEEDED(rv) && mTransfer) // Send progress notification.
      mTransfer->OnProgressChange64(nullptr, request, mProgress, mMaxProgress, mProgress, mMaxProgress);
  }
  return rv;
}

#define MESSENGER_STRING_URL       "chrome://messenger/locale/messenger.properties"

nsresult
nsMessenger::InitStringBundle()
{
  if (mStringBundle)
    return NS_OK;

  const char propertyURL[] = MESSENGER_STRING_URL;
  nsCOMPtr<nsIStringBundleService> sBundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(sBundleService, NS_ERROR_UNEXPECTED);
  return sBundleService->CreateBundle(propertyURL,
                                      getter_AddRefs(mStringBundle));
}

void
nsMessenger::GetString(const nsString& aStringName, nsString& aValue)
{
  nsresult rv;
  aValue.Truncate();

  if (!mStringBundle)
    rv = InitStringBundle();

  if (mStringBundle)
    rv = mStringBundle->GetStringFromName(aStringName.get(), getter_Copies(aValue));

  if (NS_FAILED(rv) || aValue.IsEmpty())
    aValue = aStringName;
  return;
}

nsSaveAllAttachmentsState::nsSaveAllAttachmentsState(uint32_t count,
                                                     const char **contentTypeArray,
                                                     const char **urlArray,
                                                     const char **nameArray,
                                                     const char **uriArray,
                                                     const char *dirName,
                                                     bool detachingAttachments)
    : m_withoutWarning(false)
{
    uint32_t i;
    NS_ASSERTION(count && urlArray && nameArray && uriArray && dirName,
                 "fatal - invalid parameters\n");

    m_count = count;
    m_curIndex = 0;
    m_contentTypeArray = new char*[count];
    m_urlArray = new char*[count];
    m_displayNameArray = new char*[count];
    m_messageUriArray = new char*[count];
    for (i = 0; i < count; i++)
    {
        m_contentTypeArray[i] = strdup(contentTypeArray[i]);
        m_urlArray[i] = strdup(urlArray[i]);
        m_displayNameArray[i] = strdup(nameArray[i]);
        m_messageUriArray[i] = strdup(uriArray[i]);
    }
    m_directoryName = strdup(dirName);
    m_detachingAttachments = detachingAttachments;
}

nsSaveAllAttachmentsState::~nsSaveAllAttachmentsState()
{
    uint32_t i;
    for (i = 0; i < m_count; i++)
    {
      NS_Free(m_contentTypeArray[i]);
      NS_Free(m_urlArray[i]);
      NS_Free(m_displayNameArray[i]);
      NS_Free(m_messageUriArray[i]);
    }
    delete[] m_contentTypeArray;
    delete[] m_urlArray;
    delete[] m_displayNameArray;
    delete[] m_messageUriArray;
    NS_Free(m_directoryName);
}

nsresult
nsMessenger::GetLastSaveDirectory(nsIFile **aLastSaveDir)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // this can fail, and it will, on the first time we call it, as there is no default for this pref.
  nsCOMPtr <nsIFile> localFile;
  rv = prefBranch->GetComplexValue(MESSENGER_SAVE_DIR_PREF_NAME, NS_GET_IID(nsIFile), getter_AddRefs(localFile));
  if (NS_SUCCEEDED(rv)) {
    NS_IF_ADDREF(*aLastSaveDir = localFile);
  }
  return rv;
}

nsresult
nsMessenger::SetLastSaveDirectory(nsIFile *aLocalFile)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIFile> file = do_QueryInterface(aLocalFile, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // if the file is a directory, just use it for the last dir chosen
  // otherwise, use the parent of the file as the last dir chosen.
  // IsDirectory() will return error on saving a file, as the
  // file doesn't exist yet.
  bool isDirectory;
  rv = file->IsDirectory(&isDirectory);
  if (NS_SUCCEEDED(rv) && isDirectory) {
    rv = prefBranch->SetComplexValue(MESSENGER_SAVE_DIR_PREF_NAME, NS_GET_IID(nsIFile), aLocalFile);
    NS_ENSURE_SUCCESS(rv,rv);
  }
  else {
    nsCOMPtr <nsIFile> parent;
    rv = file->GetParent(getter_AddRefs(parent));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = prefBranch->SetComplexValue(MESSENGER_SAVE_DIR_PREF_NAME, NS_GET_IID(nsIFile), parent);
    NS_ENSURE_SUCCESS(rv,rv);
  }
  return NS_OK;
}

/* void getUrisAtNavigatePos (in long aPos, out ACString aFolderUri, out ACString aMsgUri); */
// aPos is relative to the current history cursor - 1 is forward, -1 is back.
NS_IMETHODIMP nsMessenger::GetMsgUriAtNavigatePos(int32_t aPos, nsACString& aMsgUri)
{
  int32_t desiredArrayIndex = (mCurHistoryPos + (aPos << 1));
  if (desiredArrayIndex >= 0 && desiredArrayIndex < (int32_t)mLoadedMsgHistory.Length())
  {
    mNavigatingToUri = mLoadedMsgHistory[desiredArrayIndex];
    aMsgUri = mNavigatingToUri;
    return NS_OK;
  }
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMessenger::SetNavigatePos(int32_t aPos)
{
  if ((aPos << 1) < (int32_t)mLoadedMsgHistory.Length())
  {
    mCurHistoryPos = aPos << 1;
    return NS_OK;
  }
  else
    return NS_ERROR_INVALID_ARG;
}

NS_IMETHODIMP nsMessenger::GetNavigatePos(int32_t *aPos)
{
  NS_ENSURE_ARG_POINTER(aPos);
  *aPos = mCurHistoryPos >> 1;
  return NS_OK;
}

// aPos is relative to the current history cursor - 1 is forward, -1 is back.
NS_IMETHODIMP nsMessenger::GetFolderUriAtNavigatePos(int32_t aPos, nsACString& aFolderUri)
{
  int32_t desiredArrayIndex = (mCurHistoryPos + (aPos << 1));
  if (desiredArrayIndex >= 0 && desiredArrayIndex < (int32_t)mLoadedMsgHistory.Length())
  {
    mNavigatingToUri = mLoadedMsgHistory[desiredArrayIndex + 1];
    aFolderUri = mNavigatingToUri;
    return NS_OK;
  }
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMessenger::GetNavigateHistory(uint32_t *aCurPos, uint32_t *aCount, char *** aHistoryUris)
{
  NS_ENSURE_ARG_POINTER(aCount);
  NS_ENSURE_ARG_POINTER(aCurPos);

  *aCurPos = mCurHistoryPos >> 1;
  *aCount = mLoadedMsgHistory.Length();
  // for just enabling commands, we don't need the history uris.
  if (!aHistoryUris)
    return NS_OK;

  char **outArray, **next;
  next = outArray = (char **)nsMemory::Alloc(*aCount * sizeof(char *));
  if (!outArray) return NS_ERROR_OUT_OF_MEMORY;
  for (uint32_t i = 0; i < *aCount; i++)
  {
    *next = ToNewCString(mLoadedMsgHistory[i]);
    if (!*next)
      return NS_ERROR_OUT_OF_MEMORY;
    next++;
  }
  *aHistoryUris = outArray;
  return NS_OK;
}

NS_IMETHODIMP
nsMessenger::FormatFileSize(uint64_t aSize, bool aUseKB, nsAString& aFormattedSize)
{
  return ::FormatFileSize(aSize, aUseKB, aFormattedSize);
}


/* void OnItemAdded (in nsIMsgFolder parentItem, in nsISupports item); */
NS_IMETHODIMP nsMessenger::OnItemAdded(nsIMsgFolder *parentItem, nsISupports *item)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnItemRemoved (in nsIMsgFolder parentItem, in nsISupports item); */
NS_IMETHODIMP nsMessenger::OnItemRemoved(nsIMsgFolder *parentItem, nsISupports *item)
{
  // check if this item is a message header that's in our history list. If so,
  // remove it from the history list.
  nsCOMPtr <nsIMsgDBHdr> msgHdr = do_QueryInterface(item);
  if (msgHdr)
  {
    nsCOMPtr <nsIMsgFolder> folder;
    msgHdr->GetFolder(getter_AddRefs(folder));
    if (folder)
    {
      nsCString msgUri;
      nsMsgKey msgKey;
      msgHdr->GetMessageKey(&msgKey);
      folder->GenerateMessageURI(msgKey, msgUri);
      // need to remove the correspnding folder entry, and
      // adjust the current history pos.
      int32_t uriPos = mLoadedMsgHistory.IndexOf(msgUri);
      if (uriPos != kNotFound)
      {
        mLoadedMsgHistory.RemoveElementAt(uriPos);
        mLoadedMsgHistory.RemoveElementAt(uriPos); // and the folder uri entry
        if ((int32_t) mCurHistoryPos >= uriPos)
          mCurHistoryPos -= 2;
      }
    }
  }
  return NS_OK;
}

/* void OnItemPropertyChanged (in nsIMsgFolder item, in nsIAtom property, in string oldValue, in string newValue); */
NS_IMETHODIMP nsMessenger::OnItemPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const char *oldValue, const char *newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnItemIntPropertyChanged (in nsIMsgFolder item, in nsIAtom property, in long oldValue, in long newValue); */
NS_IMETHODIMP nsMessenger::OnItemIntPropertyChanged(nsIMsgFolder *item, nsIAtom *property, int32_t oldValue, int32_t newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnItemBoolPropertyChanged (in nsIMsgFolder item, in nsIAtom property, in boolean oldValue, in boolean newValue); */
NS_IMETHODIMP nsMessenger::OnItemBoolPropertyChanged(nsIMsgFolder *item, nsIAtom *property, bool oldValue, bool newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnItemUnicharPropertyChanged (in nsIMsgFolder item, in nsIAtom property, in wstring oldValue, in wstring newValue); */
NS_IMETHODIMP nsMessenger::OnItemUnicharPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const PRUnichar *oldValue, const PRUnichar *newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnItemPropertyFlagChanged (in nsIMsgDBHdr item, in nsIAtom property, in unsigned long oldFlag, in unsigned long newFlag); */
NS_IMETHODIMP nsMessenger::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, uint32_t oldFlag, uint32_t newFlag)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnItemEvent (in nsIMsgFolder item, in nsIAtom event); */
NS_IMETHODIMP nsMessenger::OnItemEvent(nsIMsgFolder *item, nsIAtom *event)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

///////////////////////////////////////////////////////////////////////////////
// Detach/Delete Attachments
///////////////////////////////////////////////////////////////////////////////

static const char * GetAttachmentPartId(const char * aAttachmentUrl)
{
  static const char partIdPrefix[] = "part=";
  const char * partId = PL_strstr(aAttachmentUrl, partIdPrefix);
  return partId ? (partId + sizeof(partIdPrefix) - 1) : nullptr;
}

static int CompareAttachmentPartId(const char * aAttachUrlLeft, const char * aAttachUrlRight)
{
  // part ids are numbers separated by periods, like "1.2.3.4".
  // we sort by doing a numerical comparison on each item in turn. e.g. "1.4" < "1.25"
  // shorter entries come before longer entries. e.g. "1.4" < "1.4.1.2"
  // return values:
  //  -2  left is a parent of right
  //  -1  left is less than right
  //   0  left == right
  //   1  right is greater than left
  //   2  right is a parent of left

  const char * partIdLeft  = GetAttachmentPartId(aAttachUrlLeft);
  const char * partIdRight = GetAttachmentPartId(aAttachUrlRight);

  // for detached attachments the URL does not contain any "part=xx"
  if(!partIdLeft)
    partIdLeft = "0";

  if(!partIdRight)
    partIdRight = "0";

  long idLeft, idRight;
  do
  {
    NS_ABORT_IF_FALSE(partIdLeft && IS_DIGIT(*partIdLeft), "Invalid character in part id string");
    NS_ABORT_IF_FALSE(partIdRight && IS_DIGIT(*partIdRight), "Invalid character in part id string");

    // if the part numbers are different then the numerically smaller one is first
    char *fixConstLoss;
    idLeft  = strtol(partIdLeft, &fixConstLoss, 10);
    partIdLeft = fixConstLoss;
    idRight = strtol(partIdRight, &fixConstLoss, 10);
    partIdRight = fixConstLoss;
    if (idLeft != idRight)
      return idLeft < idRight ? -1 : 1;

    // if one part id is complete but the other isn't, then the shortest one
    // is first (parents before children)
    if (*partIdLeft != *partIdRight)
      return *partIdRight ? -2 : 2;

    // if both part ids are complete (*partIdLeft == *partIdRight now) then
    // they are equal
    if (!*partIdLeft)
      return 0;

    NS_ABORT_IF_FALSE(*partIdLeft == '.', "Invalid character in part id string");
    NS_ABORT_IF_FALSE(*partIdRight == '.', "Invalid character in part id string");

    ++partIdLeft;
    ++partIdRight;
  }
  while (true);
  return 0;
}

// ------------------------------------

// struct on purpose -> show that we don't ever want a vtable
struct msgAttachment
{
  msgAttachment()
    : mContentType(nullptr),
      mUrl(nullptr),
      mDisplayName(nullptr),
      mMessageUri(nullptr)
  {
  }

  ~msgAttachment()
  {
    Clear();
  }

  void Clear()
  {
    NS_Free(mContentType);
    NS_Free(mUrl);
    NS_Free(mDisplayName);
    NS_Free(mMessageUri);
  }

  bool Init(const char * aContentType, const char * aUrl,
              const char * aDisplayName, const char * aMessageUri)
  {
    Clear();
    mContentType = strdup(aContentType);
    mUrl = strdup(aUrl);
    mDisplayName = strdup(aDisplayName);
    mMessageUri = strdup(aMessageUri);
    return (mContentType && mUrl && mDisplayName && mMessageUri);
  }

  // take the pointers from aSource
  void Adopt(msgAttachment & aSource)
  {
    Clear();

    mContentType = aSource.mContentType;
    mUrl = aSource.mUrl;
    mDisplayName = aSource.mDisplayName;
    mMessageUri = aSource.mMessageUri;

    aSource.mContentType = nullptr;
    aSource.mUrl = nullptr;
    aSource.mDisplayName = nullptr;
    aSource.mMessageUri = nullptr;
  }

  char* mContentType;
  char* mUrl;
  char* mDisplayName;
  char* mMessageUri;

private:
  // disable by not implementing
  msgAttachment(const msgAttachment & rhs);
  msgAttachment & operator=(const msgAttachment & rhs);
};

// ------------------------------------

class nsAttachmentState
{
public:
  nsAttachmentState();
  ~nsAttachmentState();
  nsresult Init(uint32_t aCount,
                const char **aContentTypeArray,
                const char **aUrlArray,
                const char **aDisplayNameArray,
                const char **aMessageUriArray);
  nsresult PrepareForAttachmentDelete();

private:
  static int SortAttachmentsByPartId(const void * aLeft, const void * aRight, void *);

public:
  uint32_t        mCount;
  uint32_t        mCurIndex;
  msgAttachment*  mAttachmentArray;
};

nsAttachmentState::nsAttachmentState()
  : mCount(0),
    mCurIndex(0),
    mAttachmentArray(nullptr)
{
}

nsAttachmentState::~nsAttachmentState()
{
  delete[] mAttachmentArray;
}

nsresult
nsAttachmentState::Init(uint32_t aCount, const char ** aContentTypeArray,
                        const char ** aUrlArray, const char ** aDisplayNameArray,
                        const char ** aMessageUriArray)
{
  NS_ABORT_IF_FALSE(aCount > 0, "count is invalid");

  mCount = aCount;
  mCurIndex = 0;
  delete[] mAttachmentArray;

  mAttachmentArray = new msgAttachment[aCount];
  if (!mAttachmentArray)
    return NS_ERROR_OUT_OF_MEMORY;

  for(uint32_t u = 0; u < aCount; ++u)
  {
    if (!mAttachmentArray[u].Init(aContentTypeArray[u], aUrlArray[u],
      aDisplayNameArray[u], aMessageUriArray[u]))
      return NS_ERROR_OUT_OF_MEMORY;
  }

  return NS_OK;
}

nsresult
nsAttachmentState::PrepareForAttachmentDelete()
{
  // this must be called before any processing
  if (mCurIndex != 0)
    return NS_ERROR_FAILURE;

  // this prepares the attachment list for use in deletion. In order to prepare, we
  // sort the attachments in numerical ascending order on their part id, remove all
  // duplicates and remove any subparts which will be removed automatically by the
  // removal of the parent.
  //
  // e.g. the attachment list processing (showing only part ids)
  // before: 1.11, 1.3, 1.2, 1.2.1.3, 1.4.1.2
  // sorted: 1.2, 1.2.1.3, 1.3, 1.4.1.2, 1.11
  // after:  1.2, 1.3, 1.4.1.2, 1.11

  // sort
  NS_QuickSort(mAttachmentArray, mCount, sizeof(msgAttachment), SortAttachmentsByPartId, nullptr);

  // remove duplicates and sub-items
  int nCompare;
  for(uint32_t u = 1; u < mCount;)
  {
    nCompare = ::CompareAttachmentPartId(mAttachmentArray[u-1].mUrl, mAttachmentArray[u].mUrl);
    if (nCompare == 0 || nCompare == -2) // [u-1] is the same as or a parent of [u]
    {
      // shuffle the array down (and thus keeping the sorted order)
      // this will get rid of the current unnecessary element
      for (uint32_t i = u + 1; i < mCount; ++i)
      {
        mAttachmentArray[i-1].Adopt(mAttachmentArray[i]);
      }
      --mCount;
    }
    else
    {
      ++u;
    }
  }

  return NS_OK;
}

int
nsAttachmentState::SortAttachmentsByPartId(const void * aLeft, const void * aRight, void *)
{
  msgAttachment & attachLeft  = *((msgAttachment*) aLeft);
  msgAttachment & attachRight = *((msgAttachment*) aRight);
  return ::CompareAttachmentPartId(attachLeft.mUrl, attachRight.mUrl);
}

// ------------------------------------

class nsDelAttachListener : public nsIStreamListener,
                            public nsIUrlListener,
                            public nsIMsgCopyServiceListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSISTREAMLISTENER
  NS_DECL_NSIREQUESTOBSERVER
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGCOPYSERVICELISTENER

public:
  nsDelAttachListener();
  virtual ~nsDelAttachListener();
  nsresult StartProcessing(nsMessenger * aMessenger, nsIMsgWindow * aMsgWindow,
    nsAttachmentState * aAttach, bool aSaveFirst);
  nsresult DeleteOriginalMessage();
  void SelectNewMessage();

public:
  nsAttachmentState * mAttach;                      // list of attachments to process
  bool mSaveFirst;                                // detach (true) or delete (false)
  nsCOMPtr<nsIFile> mMsgFile;                       // temporary file (processed mail)
  nsCOMPtr<nsIOutputStream> mMsgFileStream;         // temporary file (processed mail)
  nsCOMPtr<nsIMsgMessageService> mMessageService;   // original message service
  nsCOMPtr<nsIMsgDBHdr> mOriginalMessage;           // original message header
  nsCOMPtr<nsIMsgFolder> mMessageFolder;            // original message folder
  nsCOMPtr<nsIMessenger> mMessenger;                // our messenger instance
  nsCOMPtr<nsIMsgWindow> mMsgWindow;                // our UI window
  uint32_t mNewMessageKey;                          // new message key
  uint32_t mOrigMsgFlags;


   enum {
      eStarting,
      eCopyingNewMsg,
      eUpdatingFolder, // for IMAP
      eDeletingOldMessage,
      eSelectingNewMessage
    } m_state;
   // temp
  bool mWrittenExtra;
  bool mDetaching;
  nsTArray<nsCString> mDetachedFileUris;
};

//
// nsISupports
//
NS_IMPL_ISUPPORTS4(nsDelAttachListener,
                   nsIStreamListener,
                   nsIRequestObserver,
                   nsIUrlListener,
                   nsIMsgCopyServiceListener)

//
// nsIRequestObserver
//
NS_IMETHODIMP
nsDelAttachListener::OnStartRequest(nsIRequest * aRequest, nsISupports * aContext)
{
  // called when we start processing the StreamMessage request.
  // This is called after OnStartRunningUrl().
  return NS_OK;
}

NS_IMETHODIMP
nsDelAttachListener::OnStopRequest(nsIRequest * aRequest, nsISupports * aContext, nsresult aStatusCode)
{
  // called when we have completed processing the StreamMessage request.
  // This is called after OnStopRequest(). This means that we have now
  // received all data of the message and we have completed processing.
  // We now start to copy the processed message from the temporary file
  // back into the message store, replacing the original message.

  mMessageFolder->CopyDataDone();
  if (NS_FAILED(aStatusCode))
    return aStatusCode;

  // called when we complete processing of the StreamMessage request.
  // This is called before OnStopRunningUrl().
  nsresult rv;

  // copy the file back into the folder. Note: setting msgToReplace only copies
  // metadata, so we do the delete ourselves
  nsCOMPtr<nsIMsgCopyServiceListener> listenerCopyService;
  rv = this->QueryInterface( NS_GET_IID(nsIMsgCopyServiceListener), getter_AddRefs(listenerCopyService) );
  NS_ENSURE_SUCCESS(rv,rv);

  mMsgFileStream->Close();
  mMsgFileStream = nullptr;
  mNewMessageKey = PR_UINT32_MAX;
  nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID);
  m_state = eCopyingNewMsg;
  // clone file because nsIFile on Windows caches the wrong file size.
  nsCOMPtr <nsIFile> clone;
  mMsgFile->Clone(getter_AddRefs(clone));
  if (copyService)
  {
    nsCString originalKeys;
    mOriginalMessage->GetStringProperty("keywords", getter_Copies(originalKeys));
    rv = copyService->CopyFileMessage(clone, mMessageFolder, mOriginalMessage, false,
                                      mOrigMsgFlags, originalKeys, listenerCopyService, mMsgWindow);
  }
  return rv;
}

//
// nsIStreamListener
//

NS_IMETHODIMP
nsDelAttachListener::OnDataAvailable(nsIRequest * aRequest, nsISupports * aSupport,
                                     nsIInputStream * aInStream, uint64_t aSrcOffset,
                                     uint32_t aCount)
{
  if (!mMsgFileStream)
    return NS_ERROR_NULL_POINTER;
  return mMessageFolder->CopyDataToOutputStreamForAppend(aInStream, aCount, mMsgFileStream);
}

//
// nsIUrlListener
//

NS_IMETHODIMP
nsDelAttachListener::OnStartRunningUrl(nsIURI * aUrl)
{
  // called when we start processing the StreamMessage request. This is
  // called before OnStartRequest().
  return NS_OK;
}

nsresult nsDelAttachListener::DeleteOriginalMessage()
{
  nsresult rv;
  nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = messageArray->AppendElement(mOriginalMessage, false);
  NS_ENSURE_SUCCESS(rv,rv);
  nsCOMPtr<nsIMsgCopyServiceListener> listenerCopyService;

  QueryInterface( NS_GET_IID(nsIMsgCopyServiceListener), getter_AddRefs(listenerCopyService) );

  mOriginalMessage = nullptr;
  m_state = eDeletingOldMessage;
  return mMessageFolder->DeleteMessages(
    messageArray,         // messages
    mMsgWindow,           // msgWindow
    true,              // deleteStorage
    false,              // isMove
    listenerCopyService,  // listener
    false);            // allowUndo
}

void nsDelAttachListener::SelectNewMessage()
{
  nsCString displayUri;
  // all attachments refer to the same message
  const char * messageUri = mAttach->mAttachmentArray[0].mMessageUri;
  mMessenger->GetLastDisplayedMessageUri(displayUri);
  if (displayUri.Equals(messageUri))
  {
    mMessageFolder->GenerateMessageURI(mNewMessageKey, displayUri);
    if (!displayUri.IsEmpty() && mMsgWindow)
    {
      nsCOMPtr<nsIMsgWindowCommands> windowCommands;
      mMsgWindow->GetWindowCommands(getter_AddRefs(windowCommands));
      if (windowCommands)
        windowCommands->SelectMessage(displayUri);
    }
  }
  mNewMessageKey = PR_UINT32_MAX;
}

NS_IMETHODIMP
nsDelAttachListener::OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode)
{
  nsresult rv = NS_OK;
  const char * messageUri = mAttach->mAttachmentArray[0].mMessageUri;
  if (mOriginalMessage && !strncmp(messageUri, "imap-message:", 13))
  {
    if (m_state == eUpdatingFolder)
      rv = DeleteOriginalMessage();
  }
  // check if we've deleted the original message, and we know the new msg id.
  else if (m_state == eDeletingOldMessage && mMsgWindow)
    SelectNewMessage();

  return rv;
}

//
// nsIMsgCopyServiceListener
//

NS_IMETHODIMP
nsDelAttachListener::OnStartCopy(void)
{
  // never called?
  return NS_OK;
}

NS_IMETHODIMP
nsDelAttachListener::OnProgress(uint32_t aProgress, uint32_t aProgressMax)
{
  // never called?
  return NS_OK;
}

NS_IMETHODIMP
nsDelAttachListener::SetMessageKey(uint32_t aKey)
{
  // called during the copy of the modified message back into the message
  // store to notify us of the message key of the newly created message.
  mNewMessageKey = aKey;
  return NS_OK;
}

NS_IMETHODIMP
nsDelAttachListener::GetMessageId(nsACString& aMessageId)
{
  // never called?
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsDelAttachListener::OnStopCopy(nsresult aStatus)
{
  // only if the currently selected message is the one that we are about to delete then we
  // change the selection to the new message that we just added. Failures in this code are not fatal.
  // Note that can only do this if we have the new message key, which we don't always get from IMAP.
  // delete the original message
  if (NS_FAILED(aStatus))
    return aStatus;

  // check if we've deleted the original message, and we know the new msg id.
  if (m_state == eDeletingOldMessage && mMsgWindow)
    SelectNewMessage();
  // do this for non-imap messages - for imap, we'll do the delete in
  // OnStopRunningUrl. For local messages, we won't get an OnStopRunningUrl
  // notification. And for imap, it's too late to delete the message here,
  // because we'll be updating the folder naturally as a result of
  // running an append url. If we delete the header here, that folder
  // update will think we need to download the header...If we do it
  // in OnStopRunningUrl, we'll issue the delete before we do the
  // update....all nasty stuff.
  const char * messageUri = mAttach->mAttachmentArray[0].mMessageUri;
  if (mOriginalMessage && strncmp(messageUri, "imap-message:", 13))
    return DeleteOriginalMessage();
  else
    m_state = eUpdatingFolder;
  return NS_OK;
}

//
// local methods
//

nsDelAttachListener::nsDelAttachListener()
{
  mAttach = nullptr;
  mSaveFirst = false;
  mWrittenExtra = false;
  mNewMessageKey = PR_UINT32_MAX;
  m_state = eStarting;
}

nsDelAttachListener::~nsDelAttachListener()
{
  if (mAttach)
  {
    delete mAttach;
  }
  if (mMsgFileStream)
  {
    mMsgFileStream->Close();
    mMsgFileStream = nullptr;
  }
  if (mMsgFile)
  {
    mMsgFile->Remove(false);
  }
}

nsresult
nsDelAttachListener::StartProcessing(nsMessenger * aMessenger, nsIMsgWindow * aMsgWindow,
                                     nsAttachmentState * aAttach, bool detaching)
{
  aMessenger->QueryInterface(NS_GET_IID(nsIMessenger), getter_AddRefs(mMessenger));
  mMsgWindow = aMsgWindow;
  mAttach    = aAttach;
  mDetaching = detaching;

  nsresult rv;

  // all attachments refer to the same message
  const char * messageUri = mAttach->mAttachmentArray[0].mMessageUri;

  // get the message service, original message and folder for this message
  rv = GetMessageServiceFromURI(nsDependentCString(messageUri), getter_AddRefs(mMessageService));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = mMessageService->MessageURIToMsgHdr(messageUri, getter_AddRefs(mOriginalMessage));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = mOriginalMessage->GetFolder(getter_AddRefs(mMessageFolder));
  NS_ENSURE_SUCCESS(rv,rv);
  mOriginalMessage->GetFlags(&mOrigMsgFlags);

  // ensure that we can store and delete messages in this folder, if we
  // can't then we can't do attachment deleting
  bool canDelete = false;
  mMessageFolder->GetCanDeleteMessages(&canDelete);
  bool canFile = false;
  mMessageFolder->GetCanFileMessages(&canFile);
  if (!canDelete || !canFile)
    return NS_ERROR_FAILURE;

  // create an output stream on a temporary file. This stream will save the modified
  // message data to a file which we will later use to replace the existing message.
  // The file is removed in the destructor.
  rv = GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR, "nsmail.tmp",
                                       getter_AddRefs(mMsgFile));
  NS_ENSURE_SUCCESS(rv,rv);

  // For temp file, we should use restrictive 00600 instead of ATTACHMENT_PERMISSION 
  rv = mMsgFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = MsgNewBufferedFileOutputStream(getter_AddRefs(mMsgFileStream), mMsgFile, -1, ATTACHMENT_PERMISSION);

  // create the additional header for data conversion. This will tell the stream converter
  // which MIME emitter we want to use, and it will tell the MIME emitter which attachments
  // should be deleted.
  const char * partId;
  const char * nextField;
  nsAutoCString sHeader("attach&del=");
  nsAutoCString detachToHeader("&detachTo=");
  for (uint32_t u = 0; u < mAttach->mCount; ++u)
  {
    if (u > 0)
    {
      sHeader.Append(",");
      if (detaching)
        detachToHeader.Append(",");
    }
    partId = GetAttachmentPartId(mAttach->mAttachmentArray[u].mUrl);
    nextField = PL_strchr(partId, '&');
    sHeader.Append(partId, nextField ? nextField - partId : -1);
    if (detaching)
      detachToHeader.Append(mDetachedFileUris[u]);
  }

  if (detaching)
    sHeader.Append(detachToHeader);
  // stream this message to our listener converting it via the attachment mime
  // converter. The listener will just write the converted message straight to disk.
  nsCOMPtr<nsISupports> listenerSupports;
  rv = this->QueryInterface(NS_GET_IID(nsISupports), getter_AddRefs(listenerSupports));
  NS_ENSURE_SUCCESS(rv,rv);
  nsCOMPtr<nsIUrlListener> listenerUrlListener = do_QueryInterface(listenerSupports, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = mMessageService->StreamMessage(messageUri, listenerSupports, mMsgWindow,
                                      listenerUrlListener, true, sHeader,
                                      false, nullptr);
  NS_ENSURE_SUCCESS(rv,rv);

  return NS_OK;
}

// ------------------------------------

NS_IMETHODIMP
nsMessenger::DetachAttachment(const char * aContentType, const char * aUrl,
                              const char * aDisplayName, const char * aMessageUri,
                              bool aSaveFirst, bool withoutWarning = false)
{
  NS_ENSURE_ARG_POINTER(aContentType);
  NS_ENSURE_ARG_POINTER(aUrl);
  NS_ENSURE_ARG_POINTER(aDisplayName);
  NS_ENSURE_ARG_POINTER(aMessageUri);

  if (aSaveFirst)
    return SaveOneAttachment(aContentType, aUrl, aDisplayName, aMessageUri, true);
  return DetachAttachments(1, &aContentType, &aUrl, &aDisplayName, &aMessageUri, nullptr, withoutWarning);
}

NS_IMETHODIMP
nsMessenger::DetachAllAttachments(uint32_t aCount,
                                  const char ** aContentTypeArray,
                                  const char ** aUrlArray,
                                  const char ** aDisplayNameArray,
                                  const char ** aMessageUriArray,
                                  bool aSaveFirst,
                                  bool withoutWarning = false)
{
  NS_ENSURE_ARG_MIN(aCount, 1);
  NS_ENSURE_ARG_POINTER(aContentTypeArray);
  NS_ENSURE_ARG_POINTER(aUrlArray);
  NS_ENSURE_ARG_POINTER(aDisplayNameArray);
  NS_ENSURE_ARG_POINTER(aMessageUriArray);

  if (aSaveFirst)
    return SaveAllAttachments(aCount, aContentTypeArray, aUrlArray, aDisplayNameArray, aMessageUriArray, true);
  else
    return DetachAttachments(aCount, aContentTypeArray, aUrlArray, aDisplayNameArray, aMessageUriArray, nullptr, withoutWarning);
}

nsresult
nsMessenger::DetachAttachments(uint32_t aCount,
                               const char ** aContentTypeArray,
                               const char ** aUrlArray,
                               const char ** aDisplayNameArray,
                               const char ** aMessageUriArray,
                               nsTArray<nsCString> *saveFileUris,
                               bool withoutWarning)
{
  // if withoutWarning no dialog for user
  if (!withoutWarning && NS_FAILED(PromptIfDeleteAttachments(saveFileUris != nullptr, aCount, aDisplayNameArray)))
      return NS_OK;
  
  nsresult rv = NS_OK;

  // ensure that our arguments are valid
//  char * partId;
  for (uint32_t u = 0; u < aCount; ++u)
  {
    // ensure all of the message URI are the same, we cannot process
    // attachments from different messages
    if (u > 0 && 0 != strcmp(aMessageUriArray[0], aMessageUriArray[u]))
    {
      rv = NS_ERROR_INVALID_ARG;
      break;
    }

    // ensure that we don't have deleted messages in this list
    if (0 == strcmp(aContentTypeArray[u], MIMETYPE_DELETED))
    {
      rv = NS_ERROR_INVALID_ARG;
      break;
    }

    // for the moment we prevent any attachments other than root level
    // attachments being deleted (i.e. you can't delete attachments from a
    // email forwarded as an attachment). We do this by ensuring that the
    // part id only has a single period in it (e.g. "1.2").
    //TODO: support non-root level attachment delete
//    partId = ::GetAttachmentPartId(aUrlArray[u]);
//    if (!partId || PL_strchr(partId, '.') != PL_strrchr(partId, '.'))
//    {
//      rv = NS_ERROR_INVALID_ARG;
//      break;
//    }
  }
  if (NS_FAILED(rv))
  {
    Alert("deleteAttachmentFailure");
    return rv;
  }

  //TODO: ensure that nothing else is processing this message uri at the same time

  //TODO: if any of the selected attachments are messages that contain other
  // attachments we need to warn the user that all sub-attachments of those
  // messages will also be deleted. Best to display a list of them.

  // get the listener for running the url
  nsDelAttachListener * listener = new nsDelAttachListener;
  if (!listener)
    return NS_ERROR_OUT_OF_MEMORY;
  nsCOMPtr<nsISupports> listenerSupports; // auto-delete of the listener with error
  listener->QueryInterface(NS_GET_IID(nsISupports), getter_AddRefs(listenerSupports));

  if (saveFileUris)
    listener->mDetachedFileUris = *saveFileUris;
  // create the attachments for use by the listener
  nsAttachmentState * attach = new nsAttachmentState;
  if (!attach)
    return NS_ERROR_OUT_OF_MEMORY;
  rv = attach->Init(aCount, aContentTypeArray, aUrlArray, aDisplayNameArray, aMessageUriArray);
  if (NS_SUCCEEDED(rv))
    rv = attach->PrepareForAttachmentDelete();
  if (NS_FAILED(rv))
  {
    delete attach;
    return rv;
  }

  // initialize our listener with the attachments and details. The listener takes ownership
  // of 'attach' immediately irrespective of the return value (error or not).
  return listener->StartProcessing(this, mMsgWindow, attach, saveFileUris != nullptr);
}

nsresult
nsMessenger::PromptIfDeleteAttachments(bool aSaveFirst,
                                       uint32_t aCount,
                                       const char ** aDisplayNameArray)
{
  nsresult rv = NS_ERROR_FAILURE;

  nsCOMPtr<nsIPrompt> dialog(do_GetInterface(mDocShell));
  if (!dialog) return rv;

  if (!mStringBundle)
  {
    rv = InitStringBundle();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // create the list of attachments we are removing
  nsString displayString;
  nsString attachmentList;
  for (uint32_t u = 0; u < aCount; ++u)
  {
    ConvertAndSanitizeFileName(aDisplayNameArray[u], displayString);
    attachmentList.Append(displayString);
    attachmentList.Append(PRUnichar('\n'));
  }
  const PRUnichar *formatStrings[] = { attachmentList.get() };

  // format the message and display
  nsString promptMessage;
  const PRUnichar * propertyName = aSaveFirst ?
    NS_LITERAL_STRING("detachAttachments").get() : NS_LITERAL_STRING("deleteAttachments").get();
  rv = mStringBundle->FormatStringFromName(propertyName, formatStrings, 1,getter_Copies(promptMessage));
  NS_ENSURE_SUCCESS(rv, rv);

  bool dialogResult = false;
  rv = dialog->Confirm(nullptr, promptMessage.get(), &dialogResult);
  NS_ENSURE_SUCCESS(rv, rv);

  return dialogResult ? NS_OK : NS_ERROR_FAILURE;
}

