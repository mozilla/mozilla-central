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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

// Forward declares
class QuotingOutputStreamListener;
class nsMsgComposeSendListener;
class nsIEditorMailSupport;
class nsIRDFService;
class nsIArray;

class nsMsgCompose : public nsIMsgCompose, public nsSupportsWeakReference
{
 public: 

	nsMsgCompose();
	virtual ~nsMsgCompose();

	/* this macro defines QueryInterface, AddRef and Release for this class */
	NS_DECL_ISUPPORTS

	/*** nsIMsgCompose pure virtual functions */
	NS_DECL_NSIMSGCOMPOSE

  /* nsIMsgSendListener interface */
  NS_DECL_NSIMSGSENDLISTENER

private:

 // Deal with quoting issues...
	nsresult                      QuoteOriginalMessage(const char * originalMsgURI, PRInt32 what); // New template
  nsresult                      SetQuotingToFollow(bool aVal);
  nsresult                      ConvertHTMLToText(nsILocalFile *aSigFile, nsString &aSigData);
  nsresult                      ConvertTextToHTML(nsILocalFile *aSigFile, nsString &aSigData);
  bool                          IsEmbeddedObjectSafe(const char * originalScheme,
                                                     const char * originalHost,
                                                     const char * originalPath,
                                                     nsIDOMNode * object);
  nsresult                      ResetUrisForEmbeddedObjects();
  nsresult                      TagEmbeddedObjects(nsIEditorMailSupport *aMailEditor);

  nsCString                     mQuoteCharset;
  nsCString                     mOriginalMsgURI; // used so we can mark message disposition flags after we send the message

  PRInt32                       mWhatHolder;

  nsresult                      LoadDataFromFile(nsILocalFile *file,
                                                 nsString &sigData,
                                                 bool aAllowUTF8 = true,
                                                 bool aAllowUTF16 = true);

  bool                          CheckIncludeSignaturePrefs(nsIMsgIdentity *identity);
  //m_folderName to store the value of the saved drafts folder.
  nsCString                     m_folderName;

 private:
  nsresult _SendMsg(MSG_DeliverMode deliverMode, nsIMsgIdentity *identity, const char *accountKey, bool entityConversionDone);
  nsresult CreateMessage(const char * originalMsgURI, MSG_ComposeType type, nsIMsgCompFields* compFields);
  void CleanUpRecipients(nsString& recipients);
  nsresult GetABDirectories(const nsACString& aDirUri,
                            nsCOMArray<nsIAbDirectory> &aDirArray);
  nsresult BuildMailListArray(nsIAbDirectory* parentDir,
                              nsISupportsArray* array);
  nsresult GetMailListAddresses(nsString& name, nsISupportsArray* mailListArray, nsIMutableArray** addresses);
  nsresult TagConvertible(nsIDOMNode *node,  PRInt32 *_retval);
  nsresult _BodyConvertible(nsIDOMNode *node, PRInt32 *_retval);

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
    nsString                  mCiteReference;
    nsCOMPtr<nsIMimeConverter> mMimeConverter;
    nsCOMPtr<nsIUnicodeDecoder> mUnicodeDecoder;
    PRInt32                   mUnicodeBufferCharacterLength;
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
class nsMsgMailList : public nsISupports
{
public:
  nsMsgMailList();
  nsMsgMailList(nsString listName, nsString listDescription, nsIAbDirectory* directory);
	virtual ~nsMsgMailList();

  NS_DECL_ISUPPORTS
  
public:
  nsString mFullName;  /* full email address (name + email) */
  nsCOMPtr<nsIAbDirectory> mDirectory;
};

#endif /* _nsMsgCompose_H_ */
