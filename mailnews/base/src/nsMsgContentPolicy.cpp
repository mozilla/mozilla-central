/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgContentPolicy.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIMsgHeaderParser.h"
#include "nsIAbManager.h"
#include "nsIAbDirectory.h"
#include "nsIAbCard.h"
#include "nsIMsgWindow.h"
#include "nsIMimeMiscStatus.h"
#include "nsIMsgHdr.h"
#include "nsNetUtil.h"
#include "nsIMsgComposeService.h"
#include "nsMsgCompCID.h"
#include "nsIDocShellTreeItem.h"
#include "nsIWebNavigation.h"
#include "nsContentPolicyUtils.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIFrameLoader.h"
#include "nsIWebProgress.h"
#include "nsMsgUtils.h"
#include "nsThreadUtils.h"

static const char kBlockRemoteImages[] = "mailnews.message_display.disable_remote_image";
static const char kAllowPlugins[] = "mailnews.message_display.allow_plugins";
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
  mAllowPlugins = false;
  mBlockRemoteImages = true;
}

nsMsgContentPolicy::~nsMsgContentPolicy()
{
  // hey, we are going away...clean up after ourself....unregister our observer
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefInternal = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
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
  nsCOMPtr<nsIPrefBranch> prefInternal = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  prefInternal->AddObserver(kBlockRemoteImages, this, true);
  prefInternal->AddObserver(kAllowPlugins, this, true);

  prefInternal->GetBoolPref(kAllowPlugins, &mAllowPlugins);
  prefInternal->GetCharPref(kTrustedDomains, getter_Copies(mTrustedMailDomains));
  prefInternal->GetBoolPref(kBlockRemoteImages, &mBlockRemoteImages);

  return NS_OK;
}

/** 
 * returns true if the sender referenced by aMsgHdr is in one one of our local
 * address books and the user has explicitly allowed remote content for the sender
 */
bool
nsMsgContentPolicy::ShouldAcceptRemoteContentForSender(nsIMsgDBHdr *aMsgHdr)
{
  if (!aMsgHdr)
    return false;

  // extract the e-mail address from the msg hdr
  nsCString author;
  nsresult rv = aMsgHdr->GetAuthor(getter_Copies(author));
  NS_ENSURE_SUCCESS(rv, false);

  nsCOMPtr<nsIMsgHeaderParser> headerParser =
    do_GetService("@mozilla.org/messenger/headerparser;1", &rv);
  NS_ENSURE_SUCCESS(rv, false);

  nsCString emailAddress; 
  rv = headerParser->ExtractHeaderAddressMailboxes(author, emailAddress);
  NS_ENSURE_SUCCESS(rv, false);

  nsCOMPtr<nsIAbManager> abManager = do_GetService("@mozilla.org/abmanager;1",
                                                   &rv);
  NS_ENSURE_SUCCESS(rv, false);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = abManager->GetDirectories(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, false);

  nsCOMPtr<nsISupports> supports;
  nsCOMPtr<nsIAbDirectory> directory;
  nsCOMPtr<nsIAbCard> cardForAddress;
  bool hasMore;

  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore &&
         !cardForAddress)
  {
    rv = enumerator->GetNext(getter_AddRefs(supports));
    NS_ENSURE_SUCCESS(rv, false);
    directory = do_QueryInterface(supports);
    if (directory)
    {
      rv = directory->CardForEmailAddress(emailAddress, getter_AddRefs(cardForAddress));
      if (NS_FAILED(rv) && rv != NS_ERROR_NOT_IMPLEMENTED)
        return false;
    }
  }
  
  // If we found a card from the sender, check if the remote content property
  // is set to allow.
  if (!cardForAddress)
    return false;

  bool allowForSender;
  cardForAddress->GetPropertyAsBool(kAllowRemoteContentProperty,
                                    &allowForSender);
  return allowForSender;
}

/**
 * Extract the host name from aContentLocation, and look it up in our list
 * of trusted domains.
 */
bool nsMsgContentPolicy::IsTrustedDomain(nsIURI * aContentLocation)
{
  bool trustedDomain = false;
  // get the host name of the server hosting the remote image
  nsAutoCString host;
  nsresult rv = aContentLocation->GetHost(host);

  if (NS_SUCCEEDED(rv) && !mTrustedMailDomains.IsEmpty()) 
    trustedDomain = MsgHostDomainIsTrusted(host, mTrustedMailDomains);

  return trustedDomain;
}

NS_IMETHODIMP
nsMsgContentPolicy::ShouldLoad(uint32_t          aContentType,
                               nsIURI           *aContentLocation,
                               nsIURI           *aRequestingLocation,
                               nsISupports      *aRequestingContext,
                               const nsACString &aMimeGuess,
                               nsISupports      *aExtra,
                               nsIPrincipal     *aRequestPrincipal,
                               int16_t          *aDecision)
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

  uint32_t appType;
  rv = rootDocShell->GetAppType(&appType);
  // We only want to deal with mailnews
  if (NS_FAILED(rv) || appType != nsIDocShell::APP_TYPE_MAIL)
    return NS_OK;
#endif

  switch(aContentType) {
    // Plugins (nsIContentPolicy::TYPE_OBJECT) are blocked on document load.
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
    rv = SetDisableItemsOnMailNewsUrlDocshells(aContentLocation,
                                               aRequestingContext);
    // if something went wrong during the tweaking, reject this content
    if (NS_FAILED(rv)) {
      NS_WARNING("Failed to set disable items on docShells");
      *aDecision = nsIContentPolicy::REJECT_TYPE;
      return NS_OK;
    }
    break;

  case nsIContentPolicy::TYPE_CSP_REPORT:
    // We cannot block CSP reports.
    *aDecision = nsIContentPolicy::ACCEPT;
    return NS_OK;
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
  // Protocols like ftp are always blocked.
  if (ShouldBlockUnexposedProtocol(aContentLocation))
    return NS_OK;

  // If we are allowing all remote content...
  if (!mBlockRemoteImages)
  {
    *aDecision = nsIContentPolicy::ACCEPT;
    return NS_OK;
  }

  // Extract the windowtype to handle compose windows separately from mail
  nsCOMPtr<nsIMsgCompose> msgCompose = GetMsgComposeForContext(aRequestingContext);
  // Work out if we're in a compose window or not.
  if (msgCompose)
  {
    ComposeShouldLoad(msgCompose, aRequestingContext, aContentLocation,
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
  bool isHttp;
  bool isHttps;
  rv = originatorLocation->SchemeIs("http", &isHttp);
  nsresult rv2 = originatorLocation->SchemeIs("https", &isHttps);
  if (NS_SUCCEEDED(rv) && NS_SUCCEEDED(rv2) && (isHttp || isHttps))
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
bool
nsMsgContentPolicy::IsSafeRequestingLocation(nsIURI *aRequestingLocation)
{
  if (!aRequestingLocation)
    return false;

  // if aRequestingLocation is chrome, resource about or file, allow
  // aContentLocation to load
  bool isChrome;
  bool isRes;
  bool isAbout;
  bool isFile;

  nsresult rv = aRequestingLocation->SchemeIs("chrome", &isChrome);
  NS_ENSURE_SUCCESS(rv, false);
  rv = aRequestingLocation->SchemeIs("resource", &isRes);
  NS_ENSURE_SUCCESS(rv, false);
  rv = aRequestingLocation->SchemeIs("file", &isFile);
  NS_ENSURE_SUCCESS(rv, false);

  if (isChrome || isRes || isFile)
    return true;

  // Only allow about: to load anything if the requesting location is not the
  // special about:blank one.
  rv = aRequestingLocation->SchemeIs("about", &isAbout);
  NS_ENSURE_SUCCESS(rv, false);

  if (!isAbout)
    return false;


  nsCString fullSpec;
  rv = aRequestingLocation->GetSpec(fullSpec);
  NS_ENSURE_SUCCESS(rv, false);

  return !fullSpec.EqualsLiteral("about:blank");
}

/**
 * Determines if the content location is a scheme that we're willing to expose
 * for unlimited loading of content.
 */
bool
nsMsgContentPolicy::IsExposedProtocol(nsIURI *aContentLocation)
{
  nsAutoCString contentScheme;
  nsresult rv = aContentLocation->GetScheme(contentScheme);
  NS_ENSURE_SUCCESS(rv, false);

  // If you are changing this list, you may need to also consider changing the
  // list of network.protocol-handler.expose.* prefs in all-thunderbird.js.
  if (MsgLowerCaseEqualsLiteral(contentScheme, "mailto") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "news") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "snews") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "nntp") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "imap") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "addbook") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "pop") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "mailbox") ||
      MsgLowerCaseEqualsLiteral(contentScheme, "about"))
    return true;

  bool isData;
  bool isChrome;
  bool isRes;
  rv = aContentLocation->SchemeIs("chrome", &isChrome);
  NS_ENSURE_SUCCESS(rv, false);
  rv = aContentLocation->SchemeIs("resource", &isRes);
  NS_ENSURE_SUCCESS(rv, false);
  rv = aContentLocation->SchemeIs("data", &isData);
  NS_ENSURE_SUCCESS(rv, false);

  return isChrome || isRes || isData;
}

/**
 * We block most unexposed protocols - apart from http(s) and file.
 */
bool
nsMsgContentPolicy::ShouldBlockUnexposedProtocol(nsIURI *aContentLocation)
{
  bool isHttp;
  bool isHttps;
  bool isFile;
  // Error condition - we must return true so that we block.
  nsresult rv = aContentLocation->SchemeIs("http", &isHttp);
  NS_ENSURE_SUCCESS(rv, true);
  rv = aContentLocation->SchemeIs("https", &isHttps);
  NS_ENSURE_SUCCESS(rv, true);
  rv = aContentLocation->SchemeIs("file", &isFile);
  NS_ENSURE_SUCCESS(rv, true);

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
int16_t
nsMsgContentPolicy::ShouldAcceptRemoteContentForMsgHdr(nsIMsgDBHdr *aMsgHdr,
                                                       nsIURI *aRequestingLocation,
                                                       nsIURI *aContentLocation)
{
  if (!aMsgHdr)
    return static_cast<int16_t>(nsIContentPolicy::REJECT_REQUEST);

  // Case #1, check the db hdr for the remote content policy on this particular
  // message.
  uint32_t remoteContentPolicy = kNoRemoteContentPolicy;
  aMsgHdr->GetUint32Property("remoteContentPolicy", &remoteContentPolicy);

  // Case #2, check if the message is in an RSS folder
  bool isRSS = false;
  IsRSSArticle(aRequestingLocation, &isRSS);

  // Case #3, the domain for the remote image is in our white list
  bool trustedDomain = IsTrustedDomain(aContentLocation);

  // Case 4 is expensive as we're looking up items in the address book. So if
  // either of the two previous items means we load the data, just do it.
  if (isRSS || remoteContentPolicy == kAllowRemoteContent || trustedDomain)
    return nsIContentPolicy::ACCEPT;

  // Case #4, author is in our white list..
  bool allowForSender = ShouldAcceptRemoteContentForSender(aMsgHdr);

  int16_t result = allowForSender ?
    static_cast<int16_t>(nsIContentPolicy::ACCEPT) :
    static_cast<int16_t>(nsIContentPolicy::REJECT_REQUEST);

  // kNoRemoteContentPolicy means we have never set a value on the message
  if (result == nsIContentPolicy::REJECT_REQUEST && !remoteContentPolicy)
    aMsgHdr->SetUint32Property("remoteContentPolicy", kBlockRemoteContent);
  
  return result;
}

class RemoteContentNotifierEvent : public nsRunnable
{
public:
  RemoteContentNotifierEvent(nsIMsgWindow *aMsgWindow, nsIMsgDBHdr *aMsgHdr)
    : mMsgWindow(aMsgWindow), mMsgHdr(aMsgHdr)
  {}

  NS_IMETHOD Run()
  {
    if (mMsgWindow)
    {
      nsCOMPtr<nsIMsgHeaderSink> msgHdrSink;
      (void)mMsgWindow->GetMsgHeaderSink(getter_AddRefs(msgHdrSink));
      if (msgHdrSink)
        msgHdrSink->OnMsgHasRemoteContent(mMsgHdr);
    }
    return NS_OK;
  }

private:
  nsCOMPtr<nsIMsgWindow> mMsgWindow;
  nsCOMPtr<nsIMsgDBHdr> mMsgHdr;
};

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
                                                       int16_t *aDecision)
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
  NS_ENSURE_SUCCESS_VOID(rv);

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  rv = GetMsgDBHdrFromURI(resourceURI.get(), getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS_VOID(rv);

  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl(do_QueryInterface(aOriginatorLocation, &rv));
  NS_ENSURE_SUCCESS_VOID(rv);

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
      nsCOMPtr<nsIRunnable> event = new RemoteContentNotifierEvent(msgWindow,
                                                                   msgHdr);
      // Post this as an event because it can cause dom mutations, and we
      // get called at a bad time to be causing dom mutations.
      if (event)
        NS_DispatchToCurrentThread(event);
    }
  }
}

/** 
 * Content policy logic for compose windows
 * 
 */
void nsMsgContentPolicy::ComposeShouldLoad(nsIMsgCompose *aMsgCompose,
                                           nsISupports *aRequestingContext,
                                           nsIURI *aContentLocation,
                                           int16_t *aDecision)
{
  NS_PRECONDITION(*aDecision == nsIContentPolicy::REJECT_REQUEST,
                  "ComposeShouldLoad expects default decision to be reject!");

  nsCString originalMsgURI;
  nsresult rv = aMsgCompose->GetOriginalMsgURI(getter_Copies(originalMsgURI));
  NS_ENSURE_SUCCESS_VOID(rv);

  MSG_ComposeType composeType;
  rv = aMsgCompose->GetType(&composeType);
  NS_ENSURE_SUCCESS_VOID(rv);

  // Only allow remote content for new mail compositions or mailto
  // Block remote content for all other types (drafts, templates, forwards, replies, etc)
  // unless there is an associated msgHdr which allows the load, or unless the image is being
  // added by the user and not the quoted message content...
  if (composeType == nsIMsgCompType::New ||
      composeType == nsIMsgCompType::MailToUrl)
    *aDecision = nsIContentPolicy::ACCEPT;
  else if (!originalMsgURI.IsEmpty())
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    rv = GetMsgDBHdrFromURI(originalMsgURI.get(), getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS_VOID(rv);
    *aDecision = ShouldAcceptRemoteContentForMsgHdr(msgHdr, nullptr,
                                                    aContentLocation);

    // Special case image elements. When replying to a message, we want to allow
    // the user to add remote images to the message. But we don't want remote
    // images that are a part of the quoted content to load. Fortunately, after
    // the quoted message has been inserted into the document, mail compose
    // flags remote content elements that came from the original message with a
    // moz-do-not-send attribute. 
    if (*aDecision == nsIContentPolicy::REJECT_REQUEST)
    {
      bool insertingQuotedContent = true;
      aMsgCompose->GetInsertingQuotedContent(&insertingQuotedContent);
      nsCOMPtr<nsIDOMHTMLImageElement> imageElement(do_QueryInterface(aRequestingContext));
      if (!insertingQuotedContent && imageElement)
      {
        nsCOMPtr<nsIDOMElement> element(do_QueryInterface(imageElement));
        if (element)
        {
          bool doNotSendAttrib;
          if (NS_SUCCEEDED(element->HasAttribute(NS_LITERAL_STRING("moz-do-not-send"), &doNotSendAttrib)) && 
              !doNotSendAttrib)
            *aDecision = nsIContentPolicy::ACCEPT;
        }
      }
    }
  }
}

already_AddRefed<nsIMsgCompose> nsMsgContentPolicy::GetMsgComposeForContext(nsISupports *aRequestingContext)
{
  nsresult rv;

  nsIDocShell *shell = NS_CP_GetDocShellFromContext(aRequestingContext);
  nsCOMPtr<nsIDocShellTreeItem> docShellTreeItem(do_QueryInterface(shell, &rv));
  NS_ENSURE_SUCCESS(rv, nullptr);

  nsCOMPtr<nsIDocShellTreeItem> rootItem;
  rv = docShellTreeItem->GetSameTypeRootTreeItem(getter_AddRefs(rootItem));
  NS_ENSURE_SUCCESS(rv, nullptr);

  nsCOMPtr<nsIDocShell> docShell(do_QueryInterface(rootItem, &rv));
  NS_ENSURE_SUCCESS(rv, nullptr);

  nsCOMPtr<nsIMsgComposeService> composeService(do_GetService(NS_MSGCOMPOSESERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, nullptr);

  nsCOMPtr<nsIMsgCompose> msgCompose;
  // Don't bother checking rv, as GetMsgComposeForDocShell returns NS_ERROR_FAILURE
  // for not found.
  composeService->GetMsgComposeForDocShell(docShell,
                                           getter_AddRefs(msgCompose));
  return msgCompose.forget();
}

nsresult nsMsgContentPolicy::SetDisableItemsOnMailNewsUrlDocshells(
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
  
  nsCOMPtr<nsIDocShell> docShell;
  rv = frameLoader->GetDocShell(getter_AddRefs(docShell));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIDocShellTreeItem> docshellTreeItem(do_QueryInterface(docShell, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // what sort of docshell is this?
  int32_t itemType;
  rv = docshellTreeItem->GetItemType(&itemType);
  NS_ENSURE_SUCCESS(rv, rv);

  // we're only worried about policy settings in content docshells
  if (itemType != nsIDocShellTreeItem::typeContent) {
    return NS_OK;
  }

  // For messages, we must always disable javascript...
  rv = docShell->SetAllowJavascript(false);
  NS_ENSURE_SUCCESS(rv, rv);

  // ...and we allow plugins according to the mail specific preference.
  rv = docShell->SetAllowPlugins(mAllowPlugins);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
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
nsMsgContentPolicy::ShouldProcess(uint32_t          aContentType,
                                  nsIURI           *aContentLocation,
                                  nsIURI           *aRequestingLocation,
                                  nsISupports      *aRequestingContext,
                                  const nsACString &aMimeGuess,
                                  nsISupports      *aExtra,
                                  nsIPrincipal     *aRequestPrincipal,
                                  int16_t          *aDecision)
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

    nsCOMPtr<nsIPrefBranch> prefBranchInt = do_QueryInterface(aSubject, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    if (pref.Equals(kBlockRemoteImages))
      prefBranchInt->GetBoolPref(kBlockRemoteImages, &mBlockRemoteImages);
    if (pref.Equals(kAllowPlugins))
      prefBranchInt->GetBoolPref(kAllowPlugins, &mAllowPlugins);
  }

  return NS_OK;
}

/** 
 * We implement the nsIWebProgressListener interface in order to enforce
 * settings at onLocationChange time.
 */
NS_IMETHODIMP 
nsMsgContentPolicy::OnStateChange(nsIWebProgress *aWebProgress,
                                  nsIRequest *aRequest, uint32_t aStateFlags,
                                  nsresult aStatus)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgContentPolicy::OnProgressChange(nsIWebProgress *aWebProgress,
                                     nsIRequest *aRequest,
                                     int32_t aCurSelfProgress,
                                     int32_t aMaxSelfProgress,
                                     int32_t aCurTotalProgress,
                                     int32_t aMaxTotalProgress)
{
  return NS_OK;
}

NS_IMETHODIMP 
nsMsgContentPolicy::OnLocationChange(nsIWebProgress *aWebProgress,
                                     nsIRequest *aRequest, nsIURI *aLocation,
                                     uint32_t aFlags)
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
  
  nsCOMPtr<nsIMsgMessageUrl> messageUrl = do_QueryInterface(aLocation, &rv);

  if (NS_SUCCEEDED(rv)) {
    // Disable javascript on message URLs.
    rv = docShell->SetAllowJavascript(false);
    NS_ASSERTION(NS_SUCCEEDED(rv),
                 "Failed to set javascript disabled on docShell");
    // Also disable plugins if the preference requires it.
    rv = docShell->SetAllowPlugins(mAllowPlugins);
    NS_ASSERTION(NS_SUCCEEDED(rv),
                 "Failed to set plugins disabled on docShell");
  }
  else {
    // Disable javascript and plugins are allowed on non-message URLs.
    rv = docShell->SetAllowJavascript(true);
    NS_ASSERTION(NS_SUCCEEDED(rv),
                 "Failed to set javascript allowed on docShell");
    rv = docShell->SetAllowPlugins(true);
    NS_ASSERTION(NS_SUCCEEDED(rv),
                 "Failed to set plugins allowed on docShell");
  }

  return NS_OK;
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
                                     nsIRequest *aRequest, uint32_t aState)
{
  return NS_OK;
}
