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
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Scott MacGregor <scott@scott-macgregor.org>
 *   Dan Mosedale <dmose@mozillamessaging.com>
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

#include "nsMsgContentPolicy.h"
#include "nsIServiceManager.h"
#include "nsIDocShellTreeItem.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch2.h"
#include "nsIURI.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIMsgHeaderParser.h"
#include "nsIAbManager.h"
#include "nsIAbDirectory.h"
#include "nsIAbCard.h"
#include "nsIMsgWindow.h"
#include "nsIMimeMiscStatus.h"
#include "nsIMsgMessageService.h"
#include "nsIMsgHdr.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"

#include "nsIMsgComposeService.h"
#include "nsIMsgCompose.h"
#include "nsMsgCompCID.h"

// needed by the content load policy manager
#include "nsIExternalProtocolService.h"
#include "nsCExternalHandlerService.h"

// needed for mailnews content load policy manager
#include "nsIDocShell.h"
#include "nsIWebNavigation.h"
#include "nsContentPolicyUtils.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsILoadContext.h"
#include "nsIFrameLoader.h"
#include "nsIWebProgress.h"

static const char kBlockRemoteImages[] = "mailnews.message_display.disable_remote_image";
static const char kAllowPlugins[] = "mailnews.message_display.allow.plugins";
static const char kTrustedDomains[] =  "mail.trusteddomains";

// Per message headder flags to keep track of whether the user is allowing remote
// content for a particular message. 
// if you change or add more values to these constants, be sure to modify
// the corresponding definitions in mailWindowOverlay.js
#define kNoRemoteContentPolicy 0
#define kBlockRemoteContent 1
#define kAllowRemoteContent 2

NS_IMPL_ISUPPORTS4(nsMsgContentPolicy, 
                   nsIContentPolicy,
                   nsIWebProgressListener,
                   nsIObserver,
                   nsISupportsWeakReference)

nsMsgContentPolicy::nsMsgContentPolicy()
{
  mAllowPlugins = PR_FALSE;
  mBlockRemoteImages = PR_TRUE;
}

nsMsgContentPolicy::~nsMsgContentPolicy()
{
  // hey, we are going away...clean up after ourself....unregister our observer
  nsresult rv;
  nsCOMPtr<nsIPrefBranch2> prefInternal = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
  {
    prefInternal->RemoveObserver(kBlockRemoteImages, this);
    prefInternal->RemoveObserver(kAllowPlugins, this);
  }
}

nsresult nsMsgContentPolicy::Init()
{
  nsresult rv;

  // register ourself as an observer on the mail preference to block remote images
  nsCOMPtr<nsIPrefBranch2> prefInternal = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  prefInternal->AddObserver(kBlockRemoteImages, this, PR_TRUE);
  prefInternal->AddObserver(kAllowPlugins, this, PR_TRUE);

  prefInternal->GetBoolPref(kAllowPlugins, &mAllowPlugins);
  prefInternal->GetCharPref(kTrustedDomains, getter_Copies(mTrustedMailDomains));
  prefInternal->GetBoolPref(kBlockRemoteImages, &mBlockRemoteImages);

  return NS_OK;
}

/** 
 * returns true if the sender referenced by aMsgHdr is in one one of our local
 * address books and the user has explicitly allowed remote content for the sender
 */
PRBool
nsMsgContentPolicy::ShouldAcceptRemoteContentForSender(nsIMsgDBHdr *aMsgHdr)
{
  if (!aMsgHdr)
    return PR_FALSE;

  // extract the e-mail address from the msg hdr
  nsCString author;
  nsresult rv = aMsgHdr->GetAuthor(getter_Copies(author));
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  nsCOMPtr<nsIMsgHeaderParser> headerParser =
    do_GetService("@mozilla.org/messenger/headerparser;1", &rv);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  nsCString emailAddress; 
  rv = headerParser->ExtractHeaderAddressMailboxes(author, emailAddress);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  nsCOMPtr<nsIAbManager> abManager = do_GetService("@mozilla.org/abmanager;1",
                                                   &rv);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = abManager->GetDirectories(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  nsCOMPtr<nsISupports> supports;
  nsCOMPtr<nsIAbDirectory> directory;
  nsCOMPtr<nsIAbCard> cardForAddress;
  PRBool hasMore;

  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore &&
         !cardForAddress)
  {
    rv = enumerator->GetNext(getter_AddRefs(supports));
    NS_ENSURE_SUCCESS(rv, rv);
    directory = do_QueryInterface(supports);
    if (directory)
    {
      rv = directory->CardForEmailAddress(emailAddress, getter_AddRefs(cardForAddress));
      if (NS_FAILED(rv) && rv != NS_ERROR_NOT_IMPLEMENTED)
        return PR_FALSE;
    }
  }
  
  // If we found a card from the sender, check if the remote content property
  // is set to allow.
  if (!cardForAddress)
    return PR_FALSE;

  PRBool allowForSender;
  cardForAddress->GetPropertyAsBool(kAllowRemoteContentProperty,
                                    &allowForSender);
  return allowForSender;
}

/**
 * Extract the host name from aContentLocation, and look it up in our list
 * of trusted domains.
 */
PRBool nsMsgContentPolicy::IsTrustedDomain(nsIURI * aContentLocation)
{
  PRBool trustedDomain = PR_FALSE;
  // get the host name of the server hosting the remote image
  nsCAutoString host;
  nsresult rv = aContentLocation->GetHost(host);

  if (NS_SUCCEEDED(rv) && !mTrustedMailDomains.IsEmpty()) 
    trustedDomain = MsgHostDomainIsTrusted(host, mTrustedMailDomains);

  return trustedDomain;
}

NS_IMETHODIMP
nsMsgContentPolicy::ShouldLoad(PRUint32          aContentType,
                               nsIURI           *aContentLocation,
                               nsIURI           *aRequestingLocation,
                               nsISupports      *aRequestingContext,
                               const nsACString &aMimeGuess,
                               nsISupports      *aExtra,
                               PRInt16          *aDecision)
{
  nsresult rv = NS_OK;
  // The default decision at the start of the function is to accept the load.
  // Once we have checked the content type and the requesting location, then
  // we switch it to reject.
  //
  // Be very careful about returning error codes - if this method returns an
  // NS_ERROR_*, any decision made here will be ignored, and the document could
  // be accepted when we don't want it to be.
  //
  // In most cases if an error occurs, its something we didn't expect so we
  // should be rejecting the document anyway.
  *aDecision = nsIContentPolicy::ACCEPT;

  NS_ENSURE_ARG_POINTER(aContentLocation);

#ifdef DEBUG_MsgContentPolicy
  nsCString spec;
  (void)aContentLocation->GetSpec(spec);
  fprintf(stderr, "aContentType: %d\naContentLocation = %s\n",
          aContentType,
          spec.get());
#endif

#ifndef MOZ_THUNDERBIRD
  // Go find out if we are dealing with mailnews. Anything else
  // isn't our concern and we accept content.
  nsCOMPtr<nsIDocShell> rootDocShell;
  rv = GetRootDocShellForContext(aRequestingContext,
                                 getter_AddRefs(rootDocShell));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 appType;
  rv = rootDocShell->GetAppType(&appType);
  // We only want to deal with mailnews
  if (NS_FAILED(rv) || appType != nsIDocShell::APP_TYPE_MAIL)
    return NS_OK;
#endif

  switch(aContentType) {

  case nsIContentPolicy::TYPE_OBJECT:
    // only allow the plugin to load if the allow plugins pref has been set
    if (!mAllowPlugins)
      *aDecision = nsIContentPolicy::REJECT_TYPE;
    return NS_OK;

  case nsIContentPolicy::TYPE_DOCUMENT:
    // At this point, we have no intention of supporting a different JS
    // setting on a subdocument, so we don't worry about TYPE_SUBDOCUMENT here.
   
    // If the timing were right, we'd enable JavaScript on the docshell
    // for non mailnews URIs here.  However, at this point, the
    // old document may still be around, so we can't do any enabling just yet.  
    // Instead, we apply the policy in nsIWebProgressListener::OnLocationChange. 
    // For now, we explicitly disable JavaScript in order to be safe rather than
    // sorry, because OnLocationChange isn't guaranteed to necessarily be called
    // soon enough to disable it in time (though bz says it _should_ be called 
    // soon enough "in all sane cases").
    rv = DisableJSOnMailNewsUrlDocshells(aContentLocation, aRequestingContext);

    // if something went wrong during the tweaking, reject this content
    if (NS_FAILED(rv)) {
      *aDecision = nsIContentPolicy::REJECT_TYPE;
      return NS_OK;
    }
    break;

  default:
    break;
  }
  
  // NOTE: Not using NS_ENSURE_ARG_POINTER because this is a legitimate case
  // that can happen.  Also keep in mind that the default policy used for a
  // failure code is ACCEPT.
  if (!aRequestingLocation)
    return NS_ERROR_INVALID_POINTER;

#ifdef DEBUG_MsgContentPolicy
  (void)aRequestingLocation->GetSpec(spec);
  fprintf(stderr, "aRequestingLocation = %s\n", spec.get());
#endif

  // If the requesting location is safe, accept the content location request.
  if (IsSafeRequestingLocation(aRequestingLocation))
    return rv;

  // Now default to reject so early returns via NS_ENSURE_SUCCESS 
  // cause content to be rejected.
  *aDecision = nsIContentPolicy::REJECT_REQUEST;

  // if aContentLocation is a protocol we handle (imap, pop3, mailbox, etc)
  // or is a chrome url, then allow the load

  if (IsExposedProtocol(aContentLocation))
  {
    *aDecision = nsIContentPolicy::ACCEPT;
    return NS_OK;
  }

  // never load unexposed protocols except for http, https and file. 
  // Protocols like ftp, gopher are always blocked.
  if (ShouldBlockUnexposedProtocol(aContentLocation))
    return NS_OK;

  // If we are allowing all remote content...
  if (!mBlockRemoteImages)
  {
    *aDecision = nsIContentPolicy::ACCEPT;
    return NS_OK;
  }

  // Non-Thunderbird apps got this earlier.
#ifdef MOZ_THUNDERBIRD
  nsCOMPtr<nsIDocShell> rootDocShell;
  rv = GetRootDocShellForContext(aRequestingContext,
                                 getter_AddRefs(rootDocShell));
  NS_ENSURE_SUCCESS(rv, rv);
#endif

  // Extract the windowtype to handle compose windows separately from mail
  PRBool isComposeWindow = PR_FALSE;
  rv = IsComposeWindow(rootDocShell, isComposeWindow);
  NS_ENSURE_SUCCESS(rv, NS_OK);

  // Work out if we're in a compose window or not.
  if (isComposeWindow)
  {
    ComposeShouldLoad(rootDocShell, aRequestingContext, aContentLocation,
                      aDecision);
    return NS_OK;
  }

  // Find out the URI that originally initiated the set of requests for this
  // context.
  nsCOMPtr<nsIURI> originatorLocation;
  rv = GetOriginatingURIForContext(aRequestingContext,
                                   getter_AddRefs(originatorLocation));
  NS_ENSURE_SUCCESS(rv, NS_OK);

#ifdef DEBUG_MsgContentPolicy
  (void)originatorLocation->GetSpec(spec);
  fprintf(stderr, "originatorLocation = %s\n", spec.get());
#endif

  // Allow content when using a remote page.
  PRBool isHttp;
  PRBool isHttps;
  rv = originatorLocation->SchemeIs("http", &isHttp);
  rv |= originatorLocation->SchemeIs("https", &isHttps);
  if (NS_SUCCEEDED(rv) && (isHttp || isHttps))
  {
    *aDecision = nsIContentPolicy::ACCEPT;
    return NS_OK;
  }

  // The default decision is still to reject.
  ShouldAcceptContentForPotentialMsg(originatorLocation, aContentLocation,
                                     aDecision);
  return NS_OK;
}

/**
 * Determines if the requesting location is a safe one, i.e. its under the
 * app/user's control - so file, about, chrome etc.
 */
PRBool
nsMsgContentPolicy::IsSafeRequestingLocation(nsIURI *aRequestingLocation)
{
  if (!aRequestingLocation)
    return PR_FALSE;

  // if aRequestingLocation is chrome, resource about or file, allow
  // aContentLocation to load
  PRBool isChrome;
  PRBool isRes;
  PRBool isAbout;
  PRBool isFile;

  nsresult rv = aRequestingLocation->SchemeIs("chrome", &isChrome);
  rv |= aRequestingLocation->SchemeIs("resource", &isRes);
  rv |= aRequestingLocation->SchemeIs("about", &isAbout);
  rv |= aRequestingLocation->SchemeIs("file", &isFile);

  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  return isChrome || isRes || isAbout || isFile;
}

/**
 * Determines if the content location is a scheme that we're willing to expose.
 */
PRBool
nsMsgContentPolicy::IsExposedProtocol(nsIURI *aContentLocation)
{
  nsCAutoString contentScheme;
  nsresult rv = aContentLocation->GetScheme(contentScheme);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  PRBool isExposedProtocol = PR_FALSE;
#ifdef MOZ_THUNDERBIRD
  nsCOMPtr<nsIExternalProtocolService> extProtService =
    do_GetService(NS_EXTERNALPROTOCOLSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  rv = extProtService->IsExposedProtocol(contentScheme.get(), &isExposedProtocol);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);

#else
  isExposedProtocol = contentScheme.LowerCaseEqualsLiteral("mailto") ||
    contentScheme.LowerCaseEqualsLiteral("news") ||
    contentScheme.LowerCaseEqualsLiteral("snews") ||
    contentScheme.LowerCaseEqualsLiteral("nntp") ||
    contentScheme.LowerCaseEqualsLiteral("imap") ||
    contentScheme.LowerCaseEqualsLiteral("addbook") ||
    contentScheme.LowerCaseEqualsLiteral("pop") ||
    contentScheme.LowerCaseEqualsLiteral("mailbox") ||
    contentScheme.LowerCaseEqualsLiteral("about");
#endif

  if (isExposedProtocol)
    return PR_TRUE;

  PRBool isData;
  PRBool isChrome;
  PRBool isRes;
  rv = aContentLocation->SchemeIs("chrome", &isChrome);
  rv |= aContentLocation->SchemeIs("resource", &isRes);
  rv |= aContentLocation->SchemeIs("data", &isData);

  NS_ENSURE_SUCCESS(rv, PR_FALSE);

  return isChrome || isRes || isData;
}

/**
 * We block most unexposed protocols - apart from http(s) and file.
 */
PRBool
nsMsgContentPolicy::ShouldBlockUnexposedProtocol(nsIURI *aContentLocation)
{
  PRBool isHttp;
  PRBool isHttps;
  PRBool isFile;
  nsresult rv = aContentLocation->SchemeIs("http", &isHttp);
  rv |= aContentLocation->SchemeIs("https", &isHttps);
  rv |= aContentLocation->SchemeIs("file", &isFile);

  // Error condition - we must return true so that we block.
  NS_ENSURE_SUCCESS(rv, PR_TRUE);

  return !isHttp && !isHttps && !isFile;
}

/**
 * The default for this function will be to reject the content request.
 * When determining if to allow the request for a given msg hdr, the function
 * will go through the list of remote content blocking criteria:
 *
 * #1 Allow if there is a db header for a manual override.
 * #2 Allow if the message is in an RSS folder.
 * #3 Allow if the domain for the remote image in our white list.
 * #4 Allow if the author has been specifically white listed.
 */
PRInt16
nsMsgContentPolicy::ShouldAcceptRemoteContentForMsgHdr(nsIMsgDBHdr *aMsgHdr,
                                                       nsIURI *aRequestingLocation,
                                                       nsIURI *aContentLocation)
{
  if (!aMsgHdr)
    return static_cast<PRInt16>(nsIContentPolicy::REJECT_REQUEST);

  // Case #1, check the db hdr for the remote content policy on this particular
  // message.
  PRUint32 remoteContentPolicy = kNoRemoteContentPolicy;
  aMsgHdr->GetUint32Property("remoteContentPolicy", &remoteContentPolicy);

  // Case #2, check if the message is in an RSS folder
  PRBool isRSS = PR_FALSE;
  IsRSSArticle(aRequestingLocation, &isRSS);

  // Case #3, the domain for the remote image is in our white list
  PRBool trustedDomain = IsTrustedDomain(aContentLocation);

  // Case 4 is expensive as we're looking up items in the address book. So if
  // either of the two previous items means we load the data, just do it.
  if (isRSS || remoteContentPolicy == kAllowRemoteContent || trustedDomain)
    return nsIContentPolicy::ACCEPT;

  // Case #4, author is in our white list..
  PRBool allowForSender = ShouldAcceptRemoteContentForSender(aMsgHdr);

  PRInt16 result = allowForSender ?
    static_cast<PRInt16>(nsIContentPolicy::ACCEPT) :
    static_cast<PRInt16>(nsIContentPolicy::REJECT_REQUEST);

  // kNoRemoteContentPolicy means we have never set a value on the message
  if (result == nsIContentPolicy::REJECT_REQUEST && !remoteContentPolicy)
    aMsgHdr->SetUint32Property("remoteContentPolicy", kBlockRemoteContent);
  
  return result;
}

/** 
 * This function is used to determine if we allow content for a remote message.
 * If we reject loading remote content, then we'll inform the message window
 * that this message has remote content (and hence we are not loading it).
 *
 * See ShouldAcceptRemoteContentForMsgHdr for the actual decisions that
 * determine if we are going to allow remote content.
 */
void
nsMsgContentPolicy::ShouldAcceptContentForPotentialMsg(nsIURI *aOriginatorLocation,
                                                       nsIURI *aContentLocation,
                                                       PRInt16 *aDecision)
{
  NS_PRECONDITION(*aDecision == nsIContentPolicy::REJECT_REQUEST,
                  "AllowContentForPotentialMessage expects default decision to be reject!");

  // Is it a mailnews url?
  nsresult rv;
  nsCOMPtr<nsIMsgMessageUrl> msgUrl(do_QueryInterface(aOriginatorLocation,
                                                      &rv));
  if (NS_FAILED(rv))
  {
    // It isn't a mailnews url - so we accept the load here, and let other
    // content policies make the decision if we should be loading it or not.
    *aDecision = nsIContentPolicy::ACCEPT;
    return;
  }

  nsCString resourceURI;
  rv = msgUrl->GetUri(getter_Copies(resourceURI));
  NS_ENSURE_SUCCESS(rv, );

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  rv = GetMsgDBHdrFromURI(resourceURI.get(), getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, );

  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl(do_QueryInterface(aOriginatorLocation, &rv));
  NS_ENSURE_SUCCESS(rv, );

  // Get a decision on whether or not to allow remote content for this message
  // header.
  *aDecision = ShouldAcceptRemoteContentForMsgHdr(msgHdr, aOriginatorLocation,
                                                  aContentLocation);

  // If we're not allowing the remote content, tell the nsIMsgWindow loading
  // this url that this is the case, so that the UI knows to show the remote
  // content header bar, so the user can override if they wish.
  if (*aDecision == nsIContentPolicy::REJECT_REQUEST)
  {
    nsCOMPtr<nsIMsgWindow> msgWindow;
    (void)mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow)); 
    if (msgWindow)
    {
      nsCOMPtr<nsIMsgHeaderSink> msgHdrSink;
      (void)msgWindow->GetMsgHeaderSink(getter_AddRefs(msgHdrSink));
      if (msgHdrSink)
        msgHdrSink->OnMsgHasRemoteContent(msgHdr);
    }
  }
}

/** 
 * Content policy logic for compose windows
 * 
 */
void nsMsgContentPolicy::ComposeShouldLoad(nsIDocShell * aRootDocShell, nsISupports * aRequestingContext,
                                               nsIURI * aContentLocation, PRInt16 * aDecision)
{
  NS_PRECONDITION(*aDecision == nsIContentPolicy::REJECT_REQUEST,
                  "ComposeShouldLoad expects default decision to be reject!");

  nsresult rv;

  nsCOMPtr<nsIDOMWindowInternal> window(do_GetInterface(aRootDocShell, &rv));
  NS_ENSURE_SUCCESS(rv, );

  nsCOMPtr<nsIMsgComposeService> composeService (do_GetService(NS_MSGCOMPOSESERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, );

  nsCOMPtr<nsIMsgCompose> msgCompose;
  rv = composeService->GetMsgComposeForWindow(window, getter_AddRefs(msgCompose));
  NS_ENSURE_SUCCESS(rv, );

  nsCString originalMsgURI;
  msgCompose->GetOriginalMsgURI(getter_Copies(originalMsgURI));
  NS_ENSURE_SUCCESS(rv, );

  MSG_ComposeType composeType;
  rv = msgCompose->GetType(&composeType);
  NS_ENSURE_SUCCESS(rv, );

  // Only allow remote content for new mail compositions.
  // Block remote content for all other types (drafts, templates, forwards, replies, etc)
  // unless there is an associated msgHdr which allows the load, or unless the image is being
  // added by the user and not the quoted message content...
  if (composeType == nsIMsgCompType::New)
    *aDecision = nsIContentPolicy::ACCEPT;
  else if (!originalMsgURI.IsEmpty())
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    rv = GetMsgDBHdrFromURI(originalMsgURI.get(), getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, );
    *aDecision = ShouldAcceptRemoteContentForMsgHdr(msgHdr, nsnull,
                                                    aContentLocation);

    // Special case image elements. When replying to a message, we want to allow the 
    // user to add remote images to the message. But we don't want remote images
    // that are a part of the quoted content to load. Fortunately, after the quoted message
    // has been inserted into the document, mail compose flags remote content elements that came 
    // from the original message with a moz-do-not-send attribute. 
    if (*aDecision == nsIContentPolicy::REJECT_REQUEST)
    {
      PRBool insertingQuotedContent = PR_TRUE;
      msgCompose->GetInsertingQuotedContent(&insertingQuotedContent);
      nsCOMPtr<nsIDOMHTMLImageElement> imageElement = do_QueryInterface(aRequestingContext);
      if (!insertingQuotedContent && imageElement)
      {
        PRBool doNotSendAttrib;
        if (NS_SUCCEEDED(imageElement->HasAttribute(NS_LITERAL_STRING("moz-do-not-send"), &doNotSendAttrib)) && 
            !doNotSendAttrib)
           *aDecision = nsIContentPolicy::ACCEPT;
      }
    }
  }
}

/**
 * Uses the root docshell to determine if we're in a compose window or not.
 */
nsresult nsMsgContentPolicy::IsComposeWindow(nsIDocShell *aRootDocShell,
                                             PRBool &aIsComposeWindow)
{
  nsresult rv;
  // get the dom document element
  nsCOMPtr<nsIDOMDocument> domDocument = do_GetInterface(aRootDocShell, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDOMElement> windowEl;
  rv = domDocument->GetDocumentElement(getter_AddRefs(windowEl));
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString windowType;
  // GetDocumentElement may succeed but return nsnull, if it does, we'll
  // treat the window as a non-msgcompose window.
  if (windowEl)
  {
    rv = windowEl->GetAttribute(NS_LITERAL_STRING("windowtype"), windowType);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  aIsComposeWindow = windowType.Equals(NS_LITERAL_STRING("msgcompose"));
  return NS_OK;
}

nsresult nsMsgContentPolicy::DisableJSOnMailNewsUrlDocshells(
  nsIURI *aContentLocation, nsISupports *aRequestingContext)
{
  // XXX if this class changes so that this method can be called from
  // ShouldProcess, and if it's possible for this to be null when called from
  // ShouldLoad, but not in the corresponding ShouldProcess call,
  // we need to re-think the assumptions underlying this code.
  
  // If there's no docshell to get to, there's nowhere for the JavaScript to 
  // run, so we're already safe and don't need to disable anything.
  if (!aRequestingContext) {
    return NS_OK;
  }

  // the policy we're trying to enforce is around the settings for 
  // message URLs, so if this isn't one of those, bail out
  nsresult rv;
  nsCOMPtr<nsIMsgMessageUrl> msgUrl = do_QueryInterface(aContentLocation, &rv);
  if (NS_FAILED(rv)) {
    return NS_OK;
  }

  // since NS_CP_GetDocShellFromContext returns the containing docshell rather
  // than the contained one we need, we can't use that here, so...
  
  nsCOMPtr<nsIFrameLoaderOwner> flOwner = do_QueryInterface(aRequestingContext,
                                                            &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFrameLoader> frameLoader;
  rv = flOwner->GetFrameLoader(getter_AddRefs(frameLoader));
  NS_ENSURE_SUCCESS(rv, rv);
  NS_ENSURE_TRUE(frameLoader, NS_ERROR_INVALID_POINTER);
  
  nsCOMPtr<nsIDocShell> shell;
  rv = frameLoader->GetDocShell(getter_AddRefs(shell));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocShellTreeItem> docshellTreeItem(do_QueryInterface(shell, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // what sort of docshell is this?
  PRInt32 itemType;
  rv = docshellTreeItem->GetItemType(&itemType);
  NS_ENSURE_SUCCESS(rv, rv);

  // we're only worried about policy settings in content docshells
  if (itemType != nsIDocShellTreeItem::typeContent) {
    return NS_OK;
  }

  return shell->SetAllowJavascript(PR_FALSE);
}

/**
 * Gets the root docshell from a requesting context.
 */
nsresult
nsMsgContentPolicy::GetRootDocShellForContext(nsISupports *aRequestingContext,
                                              nsIDocShell **aDocShell)
{
  NS_ENSURE_ARG_POINTER(aRequestingContext);
  nsresult rv;

  nsIDocShell *shell = NS_CP_GetDocShellFromContext(aRequestingContext);
  nsCOMPtr<nsIDocShellTreeItem> docshellTreeItem(do_QueryInterface(shell, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocShellTreeItem> rootItem;
  rv = docshellTreeItem->GetRootTreeItem(getter_AddRefs(rootItem));
  NS_ENSURE_SUCCESS(rv, rv);

  return CallQueryInterface(rootItem, aDocShell);
}

/**
 * Gets the originating URI that started off a set of requests, accounting
 * for multiple iframes.
 *
 * Navigates up the docshell tree from aRequestingContext and finds the
 * highest parent with the same type docshell as aRequestingContext, then
 * returns the URI associated with that docshell.
 */ 
nsresult
nsMsgContentPolicy::GetOriginatingURIForContext(nsISupports *aRequestingContext,
                                                nsIURI **aURI)
{
  NS_ENSURE_ARG_POINTER(aRequestingContext);
  nsresult rv;

  nsIDocShell *shell = NS_CP_GetDocShellFromContext(aRequestingContext);
  nsCOMPtr<nsIDocShellTreeItem> docshellTreeItem(do_QueryInterface(shell, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocShellTreeItem> rootItem;
  rv = docshellTreeItem->GetSameTypeRootTreeItem(getter_AddRefs(rootItem));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIWebNavigation> webNavigation(do_QueryInterface(rootItem, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return webNavigation->GetCurrentURI(aURI);
}

NS_IMETHODIMP
nsMsgContentPolicy::ShouldProcess(PRUint32          aContentType,
                                  nsIURI           *aContentLocation,
                                  nsIURI           *aRequestingLocation,
                                  nsISupports      *aRequestingContext,
                                  const nsACString &aMimeGuess,
                                  nsISupports      *aExtra,
                                  PRInt16          *aDecision)
{
  // XXX Returning ACCEPT is presumably only a reasonable thing to do if we
  // think that ShouldLoad is going to catch all possible cases (i.e. that
  // everything we use to make decisions is going to be available at 
  // ShouldLoad time, and not only become available in time for ShouldProcess).
  // Do we think that's actually the case?
  *aDecision = nsIContentPolicy::ACCEPT;
  return NS_OK;
}

NS_IMETHODIMP nsMsgContentPolicy::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *aData)
{
  if (!strcmp(NS_PREFBRANCH_PREFCHANGE_TOPIC_ID, aTopic)) 
  {
    NS_LossyConvertUTF16toASCII pref(aData);

    nsresult rv;

    nsCOMPtr<nsIPrefBranch2> prefBranchInt = do_QueryInterface(aSubject, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    if (pref.Equals(kBlockRemoteImages))
      prefBranchInt->GetBoolPref(kBlockRemoteImages, &mBlockRemoteImages);
  }

  return NS_OK;
}

/** 
 * We implement the nsIWebProgressListener interface in order to enforce
 * settings at onLocationChange time.
 */
NS_IMETHODIMP 
nsMsgContentPolicy::OnStateChange(nsIWebProgress *aWebProgress,
                                  nsIRequest *aRequest, PRUint32 aStateFlags,
                                  nsresult aStatus)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgContentPolicy::OnProgressChange(nsIWebProgress *aWebProgress,
                                     nsIRequest *aRequest,
                                     PRInt32 aCurSelfProgress,
                                     PRInt32 aMaxSelfProgress,
                                     PRInt32 aCurTotalProgress,
                                     PRInt32 aMaxTotalProgress)
{
  return NS_OK;
}

NS_IMETHODIMP 
nsMsgContentPolicy::OnLocationChange(nsIWebProgress *aWebProgress,
                                     nsIRequest *aRequest, nsIURI *aLocation)
{
  nsresult rv;

  // If anything goes wrong and/or there's no docshell associated with this
  // request, just give up.  The behavior ends up being "don't consider 
  // re-enabling JS on the docshell", which is the safe thing to do (and if
  // the problem was that there's no docshell, that means that there was 
  // nowhere for any JavaScript to run, so we're already safe
  
  nsCOMPtr<nsIDocShell> docShell = do_QueryInterface(aWebProgress, &rv);
  if (NS_FAILED(rv)) {
    return NS_OK;
  }

#ifdef DEBUG
  nsCOMPtr<nsIChannel> channel = do_QueryInterface(aRequest, &rv);
  if (NS_SUCCEEDED(rv)) {
    nsCOMPtr<nsIDocShell> docShell2;
    NS_QueryNotificationCallbacks(channel, docShell2);
    NS_ASSERTION(docShell == docShell2, "aWebProgress and channel callbacks"
                                        " do not point to the same docshell");
  }
#endif
  
  // If this is a mailnews url, turn off JavaScript, otherwise turn it on
  nsCOMPtr<nsIMsgMessageUrl> messageUrl = do_QueryInterface(aLocation, &rv);
  return docShell->SetAllowJavascript(NS_FAILED(rv));
}

NS_IMETHODIMP
nsMsgContentPolicy::OnStatusChange(nsIWebProgress *aWebProgress,
                                   nsIRequest *aRequest, nsresult aStatus,
                                   const PRUnichar *aMessage)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgContentPolicy::OnSecurityChange(nsIWebProgress *aWebProgress,
                                     nsIRequest *aRequest, PRUint32 aState)
{
  return NS_OK;
}
