/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**********************************************************************************
 * nsMsgContentPolicy enforces the specified content policy on images, js, plugins, etc.
 * This is the class used to determine what elements in a message should be loaded.
 *
 * nsMsgCookiePolicy enforces our cookie policy for mail and RSS messages. 
 ***********************************************************************************/

#ifndef _nsMsgContentPolicy_H_
#define _nsMsgContentPolicy_H_

#include "nsIContentPolicy.h"
#include "nsIObserver.h"
#include "nsWeakReference.h"
#include "nsStringGlue.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIWebProgressListener.h"
#include "nsIMsgCompose.h"
#include "nsIDocShell.h"

/* DBFCFDF0-4489-4faa-8122-190FD1EFA16C */
#define NS_MSGCONTENTPOLICY_CID \
{ 0xdbfcfdf0, 0x4489, 0x4faa, { 0x81, 0x22, 0x19, 0xf, 0xd1, 0xef, 0xa1, 0x6c } }

#define NS_MSGCONTENTPOLICY_CONTRACTID "@mozilla.org/messenger/content-policy;1"

class nsIMsgDBHdr;
class nsIDocShell;

class nsMsgContentPolicy : public nsIContentPolicy,
                           public nsIObserver,
                           public nsIWebProgressListener,
                           public nsSupportsWeakReference
{
public:
  nsMsgContentPolicy();
  virtual ~nsMsgContentPolicy();

  nsresult Init();
    
  NS_DECL_ISUPPORTS
  NS_DECL_NSICONTENTPOLICY
  NS_DECL_NSIOBSERVER
  NS_DECL_NSIWEBPROGRESSLISTENER
  
protected:
  bool     mBlockRemoteImages;
  bool     mAllowPlugins;
  nsCString mTrustedMailDomains;

  bool IsTrustedDomain(nsIURI * aContentLocation);
  bool IsSafeRequestingLocation(nsIURI *aRequestingLocation);
  bool IsExposedProtocol(nsIURI *aContentLocation);
  bool IsExposedChromeProtocol(nsIURI *aContentLocation);
  bool ShouldBlockUnexposedProtocol(nsIURI *aContentLocation);

  bool ShouldAcceptRemoteContentForSender(nsIMsgDBHdr *aMsgHdr);
  int16_t ShouldAcceptRemoteContentForMsgHdr(nsIMsgDBHdr *aMsgHdr,
                                             nsIURI *aRequestingLocation,
                                             nsIURI *aContentLocation);
  void ShouldAcceptContentForPotentialMsg(nsIURI *aOriginatorLocation,
                                          nsIURI *aContentLocation,
                                          int16_t *aDecision);
  void ComposeShouldLoad(nsIMsgCompose *aMsgCompose,
                         nsISupports *aRequestingContext, 
                         nsIURI *aContentLocation, int16_t *aDecision);
  already_AddRefed<nsIMsgCompose> GetMsgComposeForContext(nsISupports *aRequestingContext);

  nsresult GetRootDocShellForContext(nsISupports *aRequestingContext,
                                     nsIDocShell **aDocShell);
  nsresult GetOriginatingURIForContext(nsISupports *aRequestingContext,
                                       nsIURI **aURI);
  nsresult SetDisableItemsOnMailNewsUrlDocshells(nsIURI *aContentLocation,
                                                 nsISupports *aRequestingContext);
};

#endif // _nsMsgContentPolicy_H_
