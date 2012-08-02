/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#define MSGCOMP_TRACE_PERFORMANCE 1

#include "nsIMsgComposeService.h"
#include "nsCOMPtr.h"
#include "nsIDOMWindow.h"
#include "nsIXULWindow.h"
#include "nsIObserver.h"
#include "nsWeakReference.h"
#include "nsIMimeStreamConverter.h"
#include "nsInterfaceHashtable.h"

#include "nsICommandLineHandler.h"
#define ICOMMANDLINEHANDLER nsICommandLineHandler

class nsMsgCachedWindowInfo
{
public:
  void Initialize(nsIDOMWindow *aWindow, nsIXULWindow *aXULWindow, nsIMsgComposeRecyclingListener *aListener, bool aHtmlCompose)
  {
    window = aWindow;
    xulWindow = aXULWindow;
    listener = aListener;
    htmlCompose = aHtmlCompose;
  }
    
  void Clear()
  {
    window = nullptr;
    listener = nullptr;
  }
  
  nsCOMPtr<nsIDOMWindow>                    window;
  nsCOMPtr<nsIXULWindow>                    xulWindow;
  nsCOMPtr<nsIMsgComposeRecyclingListener>  listener;
  bool                                      htmlCompose;
};

class nsMsgComposeService : 
  public nsIMsgComposeService,
  public nsIObserver,
  public ICOMMANDLINEHANDLER,
  public nsSupportsWeakReference
{
public: 
	nsMsgComposeService();
	virtual ~nsMsgComposeService();

	NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGCOMPOSESERVICE
  NS_DECL_NSIOBSERVER
  NS_DECL_NSICOMMANDLINEHANDLER

  nsresult Init();
  void Reset();
  void DeleteCachedWindows();
  nsresult AddGlobalHtmlDomains();

private:
  bool mLogComposePerformance;

  PRInt32 mMaxRecycledWindows;
  nsMsgCachedWindowInfo *mCachedWindows;
  
  void CloseHiddenCachedWindow(nsIDOMWindow *domWindow);

  nsresult LoadDraftOrTemplate(const nsACString& aMsgURI, nsMimeOutputType aOutType, 
                               nsIMsgIdentity * aIdentity, const char * aOriginalMsgURI, 
                               nsIMsgDBHdr * aOrigMsgHdr, bool aForwardInline,
                               bool overrideComposeFormat,
                               nsIMsgWindow *aMsgWindow);

  nsresult RunMessageThroughMimeDraft(const nsACString& aMsgURI,
                                      nsMimeOutputType aOutType,
                                      nsIMsgIdentity * aIdentity,
                                      const char * aOriginalMsgURI,
                                      nsIMsgDBHdr * aOrigMsgHdr,
                                      bool aForwardInline,
                                      const nsAString &forwardTo,
                                      bool overrideComposeFormat,
                                      nsIMsgWindow *aMsgWindow);

  nsresult ShowCachedComposeWindow(nsIDOMWindow *aComposeWindow, nsIXULWindow *aXULWindow, bool aShow);

  // hash table mapping dom windows to nsIMsgCompose objects
  nsInterfaceHashtable<nsISupportsHashKey, nsIWeakReference> mOpenComposeWindows;

  // When doing a reply and the settings are enabled, get the HTML of the selected text
  // in the original message window so that it can be quoted instead of the entire message.
  nsresult GetOrigWindowSelection(MSG_ComposeType type, nsIMsgWindow *aMsgWindow, nsACString& aSelHTML);

#ifdef MSGCOMP_TRACE_PERFORMANCE
  PRIntervalTime            mStartTime;
  PRIntervalTime            mPreviousTime;
#endif
};
