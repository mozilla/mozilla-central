/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgCompose_H_
#define _nsMsgCompose_H_

#include "nsIMsgCompose.h"
#include "nsCOMArray.h"
#include "nsTObserverArray.h"
#include "nsWeakReference.h"
#include "nsMsgCompFields.h"
#include "nsIOutputStream.h"
#include "nsIMsgQuote.h"
#include "nsIMsgCopyServiceListener.h"
#include "nsIBaseWindow.h"
#include "nsIAbDirectory.h"
#include "nsIWebProgressListener.h"
#include "nsIMimeConverter.h"
#include "nsIUnicodeDecoder.h"
#include "nsIMsgFolder.h"
#include "nsIDOMNode.h"

// Forward declares
class QuotingOutputStreamListener;
class nsMsgComposeSendListener;
class nsIEditorMailSupport;
class nsIRDFService;
class nsIArray;
struct nsMsgMailList;

class nsMsgCompose : public nsIMsgCompose, public nsSupportsWeakReference
{
 public: 

	nsMsgCompose();
	virtual ~nsMsgCompose();

	/* this macro defines QueryInterface, AddRef and Release for this class */
	NS_DECL_THREADSAFE_ISUPPORTS

	/*** nsIMsgCompose pure virtual functions */
	NS_DECL_NSIMSGCOMPOSE

  /* nsIMsgSendListener interface */
  NS_DECL_NSIMSGSENDLISTENER

private:

 // Deal with quoting issues...
	nsresult                      QuoteOriginalMessage(); // New template
  nsresult                      SetQuotingToFollow(bool aVal);
  nsresult                      ConvertHTMLToText(nsIFile *aSigFile, nsString &aSigData);
  nsresult                      ConvertTextToHTML(nsIFile *aSigFile, nsString &aSigData);
  bool                          IsEmbeddedObjectSafe(const char * originalScheme,
                                                     const char * originalHost,
                                                     const char * originalPath,
                                                     nsIDOMNode * object);
  nsresult                      ResetUrisForEmbeddedObjects();
  nsresult                      TagEmbeddedObjects(nsIEditorMailSupport *aMailEditor);

  nsCString                     mQuoteCharset;
  nsCString                     mOriginalMsgURI; // used so we can mark message disposition flags after we send the message

  int32_t                       mWhatHolder;

  nsresult                      LoadDataFromFile(nsIFile *file,
                                                 nsString &sigData,
                                                 bool aAllowUTF8 = true,
                                                 bool aAllowUTF16 = true);

  bool                          CheckIncludeSignaturePrefs(nsIMsgIdentity *identity);
  //m_folderName to store the value of the saved drafts folder.
  nsCString                     m_folderName;
  void InsertDivWrappedTextAtSelection(const nsAString &aText,
                                       const nsAString &classStr);

 private:
  nsresult _SendMsg(MSG_DeliverMode deliverMode, nsIMsgIdentity *identity, const char *accountKey);
  nsresult CreateMessage(const char * originalMsgURI, MSG_ComposeType type, nsIMsgCompFields* compFields);
  void CleanUpRecipients(nsString& recipients);
  nsresult GetABDirectories(const nsACString& aDirUri,
                            nsCOMArray<nsIAbDirectory> &aDirArray);
  nsresult BuildMailListArray(nsIAbDirectory* parentDir,
                              nsTArray<nsMsgMailList>& array);
  nsresult GetMailListAddresses(nsString& name,
                                nsTArray<nsMsgMailList>& mailListArray,
                                nsIMutableArray** addresses);
  nsresult TagConvertible(nsIDOMNode *node,  int32_t *_retval);
  nsresult _BodyConvertible(nsIDOMNode *node, int32_t *_retval);

  bool IsLastWindow();
 
       // Helper function. Parameters are not checked.
  bool                                      mConvertStructs;    // for TagConvertible
  
	nsCOMPtr<nsIEditor>                       m_editor;
	nsIDOMWindow                              *m_window;
  nsCOMPtr<nsIDocShell>                     mDocShell;
  nsCOMPtr<nsIBaseWindow>                   m_baseWindow;
	nsMsgCompFields                           *m_compFields;
	nsCOMPtr<nsIMsgIdentity>                  m_identity;
	bool						                        m_composeHTML;
	QuotingOutputStreamListener               *mQuoteStreamListener;
	nsCOMPtr<nsIOutputStream>                 mBaseStream;

  nsCOMPtr<nsIMsgComposeRecyclingListener>  mRecyclingListener;
  bool                                      mRecycledWindow;
	nsCOMPtr<nsIMsgSend>                      mMsgSend;           // for composition back end
	nsCOMPtr<nsIMsgProgress>                  mProgress;          // use by the back end to report progress to the front end

  // Deal with quoting issues...
  nsString                                  mCiteReference;
	nsCOMPtr<nsIMsgQuote>                     mQuote;
	bool						                        mQuotingToFollow;   // Quoting indicator
	MSG_ComposeType                           mType;		          // Message type
  bool                                      mCharsetOverride;
  bool                                      mDeleteDraft;
  nsMsgDispositionState                     mDraftDisposition;
  nsCOMPtr <nsIMsgDBHdr>                    mOrigMsgHdr;

  nsCString                                 mSmtpPassword;
  nsCString                                 mHtmlToQuote;

  nsTObserverArray<nsCOMPtr<nsIMsgComposeStateListener> > mStateListeners;
  nsTObserverArray<nsCOMPtr<nsIMsgSendListener> > mExternalSendListeners;
    
  bool                                      mInsertingQuotedContent;
    
  friend class QuotingOutputStreamListener;
	friend class nsMsgComposeSendListener;
};

////////////////////////////////////////////////////////////////////////////////////
// THIS IS THE CLASS THAT IS THE STREAM Listener OF THE HTML OUPUT
// FROM LIBMIME. THIS IS FOR QUOTING
////////////////////////////////////////////////////////////////////////////////////
class QuotingOutputStreamListener : public nsIMsgQuotingOutputStreamListener
{
public:
    QuotingOutputStreamListener(const char *originalMsgURI,
                                nsIMsgDBHdr *origMsgHdr,
                                bool quoteHeaders,
                                bool headersOnly,
                                nsIMsgIdentity *identity,
                                const char *charset,
                                bool charetOverride, 
                                bool quoteOriginal,
                                const nsACString& htmlToQuote);
    virtual ~QuotingOutputStreamListener(void);

    NS_DECL_ISUPPORTS
    NS_DECL_NSIREQUESTOBSERVER
    NS_DECL_NSISTREAMLISTENER
    NS_DECL_NSIMSGQUOTINGOUTPUTSTREAMLISTENER

    NS_IMETHOD  SetComposeObj(nsIMsgCompose *obj);
	  NS_IMETHOD  ConvertToPlainText(bool formatflowed = false);
    NS_IMETHOD InsertToCompose(nsIEditor *aEditor, bool aHTMLEditor);
    NS_IMETHOD AppendToMsgBody(const nsCString &inStr);

private:
    nsWeakPtr                 mWeakComposeObj;
    nsString       				    mMsgBody;
    nsString       				    mCitePrefix;
    nsString       				    mSignature;
    bool						        mQuoteHeaders;
    bool						        mHeadersOnly;
    nsCOMPtr<nsIMimeHeaders>	mHeaders;
    nsCOMPtr<nsIMsgIdentity>  mIdentity;
    nsCOMPtr<nsIMsgDBHdr>     mOrigMsgHdr;
    nsString                  mCiteReference;
    nsCOMPtr<nsIMimeConverter> mMimeConverter;
    nsCOMPtr<nsIUnicodeDecoder> mUnicodeDecoder;
    int32_t                   mUnicodeBufferCharacterLength;
    PRUnichar*                mUnicodeConversionBuffer;
    bool                      mQuoteOriginal;
    nsCString                 mHtmlToQuote;
};

////////////////////////////////////////////////////////////////////////////////////
// This is the listener class for the send operation. We have to create this class 
// to listen for message send completion and eventually notify the caller
////////////////////////////////////////////////////////////////////////////////////
class nsMsgComposeSendListener : public nsIMsgComposeSendListener, public nsIMsgSendListener, public nsIMsgCopyServiceListener, public nsIWebProgressListener
{
public:
  nsMsgComposeSendListener(void);
  virtual ~nsMsgComposeSendListener(void);

  // nsISupports interface
  NS_DECL_ISUPPORTS

  // nsIMsgComposeSendListener interface
  NS_DECL_NSIMSGCOMPOSESENDLISTENER

  // nsIMsgSendListener interface
  NS_DECL_NSIMSGSENDLISTENER
  
  // nsIMsgCopyServiceListener interface
  NS_DECL_NSIMSGCOPYSERVICELISTENER
  
	// nsIWebProgressListener interface
	NS_DECL_NSIWEBPROGRESSLISTENER

  nsresult    RemoveCurrentDraftMessage(nsIMsgCompose *compObj, bool calledByCopy);
  nsresult    GetMsgFolder(nsIMsgCompose *compObj, nsIMsgFolder **msgFolder);

private:
  nsWeakPtr               mWeakComposeObj;
	MSG_DeliverMode         mDeliverMode;
};

/******************************************************************************
 * nsMsgMailList
 ******************************************************************************/
struct nsMsgMailList
{
  explicit nsMsgMailList(nsIAbDirectory* directory);

  nsString mFullName;  /* full email address (name + email) */
  nsCOMPtr<nsIAbDirectory> mDirectory;
};

#endif /* _nsMsgCompose_H_ */
