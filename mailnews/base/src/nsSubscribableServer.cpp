/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsSubscribableServer.h"
#include "prmem.h"
#include "rdf.h"
#include "nsRDFCID.h"
#include "nsIServiceManager.h"
#include "nsMsgI18N.h"
#include "nsMsgUtils.h"
#include "nsCOMArray.h"
#include "nsArrayEnumerator.h"
#include "nsServiceManagerUtils.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

nsSubscribableServer::nsSubscribableServer(void)
{
    mDelimiter = '.';
    mShowFullName = true;
    mTreeRoot = nullptr;
    mStopped = false;
}

nsresult
nsSubscribableServer::Init()
{
    nsresult rv;

    rv = EnsureRDFService();
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "child"),
                                  getter_AddRefs(kNC_Child));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "Subscribed"),
                                  getter_AddRefs(kNC_Subscribed));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetLiteral(NS_LITERAL_STRING("true").get(),getter_AddRefs(kTrueLiteral));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetLiteral(NS_LITERAL_STRING("false").get(),getter_AddRefs(kFalseLiteral));
    NS_ENSURE_SUCCESS(rv,rv);
    return NS_OK;
}

nsSubscribableServer::~nsSubscribableServer(void)
{
    nsresult rv = NS_OK;
#ifdef DEBUG_seth
    printf("free subscribe tree\n");
#endif
    rv = FreeSubtree(mTreeRoot);
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed to free tree");
}

NS_IMPL_ISUPPORTS1(nsSubscribableServer, nsISubscribableServer)

NS_IMETHODIMP
nsSubscribableServer::SetIncomingServer(nsIMsgIncomingServer *aServer)
{
  mIncomingServer = aServer;
  return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::GetDelimiter(char *aDelimiter)
{
  if (!aDelimiter) return NS_ERROR_NULL_POINTER;
  *aDelimiter = mDelimiter;
  return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::SetDelimiter(char aDelimiter)
{
  mDelimiter = aDelimiter;
  return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::SetAsSubscribed(const nsACString &path)
{
    nsresult rv = NS_OK;

    SubscribeTreeNode *node = nullptr;
    rv = FindAndCreateNode(path, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    node->isSubscribable = true;
    node->isSubscribed = true;

    rv = NotifyChange(node, kNC_Subscribed, node->isSubscribed);
    NS_ENSURE_SUCCESS(rv,rv);

    return rv;
}

NS_IMETHODIMP
nsSubscribableServer::AddTo(const nsACString& aName, bool aAddAsSubscribed,
                            bool aSubscribable, bool aChangeIfExists)
{
    nsresult rv = NS_OK;

    if (mStopped) {
#ifdef DEBUG_seth
        printf("stopped!\n");
#endif
        return NS_ERROR_FAILURE;
    }

    SubscribeTreeNode *node = nullptr;

    // todo, shouldn't we pass in aAddAsSubscribed, for the
    // default value if we create it?
    rv = FindAndCreateNode(aName, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    if (aChangeIfExists) {
        node->isSubscribed = aAddAsSubscribed;
        rv = NotifyChange(node, kNC_Subscribed, node->isSubscribed);
        NS_ENSURE_SUCCESS(rv,rv);
    }

    node->isSubscribable = aSubscribable;
    return rv;
}

NS_IMETHODIMP
nsSubscribableServer::SetState(const nsACString &aPath, bool aState,
                               bool *aStateChanged)
{
    nsresult rv = NS_OK;
    NS_ASSERTION(!aPath.IsEmpty() && aStateChanged, "no path or stateChanged");
    if (aPath.IsEmpty() || !aStateChanged) return NS_ERROR_NULL_POINTER;

    NS_ASSERTION(MsgIsUTF8(aPath), "aPath is not in UTF-8");

    *aStateChanged = false;

    SubscribeTreeNode *node = nullptr;
    rv = FindAndCreateNode(aPath, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    NS_ASSERTION(node->isSubscribable, "fix this");
    if (!node->isSubscribable) {
        return NS_OK;
    }

    if (node->isSubscribed == aState) {
        return NS_OK;
    }
    else {
        node->isSubscribed = aState;
        *aStateChanged = true;
        rv = NotifyChange(node, kNC_Subscribed, node->isSubscribed);
        NS_ENSURE_SUCCESS(rv,rv);
    }

    return rv;
}

void
nsSubscribableServer::BuildURIFromNode(SubscribeTreeNode *node, nsACString &uri)
{
    if (node->parent) {
        BuildURIFromNode(node->parent, uri);
        if (node->parent == mTreeRoot) {
            uri += "/";
        }
        else {
            uri += mDelimiter;
        }
    }

    uri += node->name;
    return;
}

nsresult
nsSubscribableServer::NotifyAssert(SubscribeTreeNode *subjectNode, nsIRDFResource *property, SubscribeTreeNode *objectNode)
{
    nsresult rv;

    bool hasObservers = true;
    rv = EnsureSubscribeDS();
    NS_ENSURE_SUCCESS(rv,rv);
    rv = mSubscribeDS->GetHasObservers(&hasObservers);
    NS_ENSURE_SUCCESS(rv,rv);
    // no need to do all this work, there are no observers
    if (!hasObservers) {
        return NS_OK;
    }

    nsAutoCString subjectUri;
    BuildURIFromNode(subjectNode, subjectUri);

    // we could optimize this, since we know that objectUri == subjectUri + mDelimiter + object->name
    // is it worth it?
    nsAutoCString objectUri;
    BuildURIFromNode(objectNode, objectUri);

    nsCOMPtr <nsIRDFResource> subject;
    nsCOMPtr <nsIRDFResource> object;

    rv = EnsureRDFService();
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(subjectUri, getter_AddRefs(subject));
    NS_ENSURE_SUCCESS(rv,rv);
    rv = mRDFService->GetResource(objectUri, getter_AddRefs(object));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = Notify(subject, property, object, true, false);
    NS_ENSURE_SUCCESS(rv,rv);
    return NS_OK;
}

nsresult
nsSubscribableServer::EnsureRDFService()
{
    nsresult rv;

    if (!mRDFService) {
        mRDFService = do_GetService(kRDFServiceCID, &rv);
        NS_ASSERTION(NS_SUCCEEDED(rv) && mRDFService, "failed to get rdf service");
        NS_ENSURE_SUCCESS(rv,rv);
        if (!mRDFService) return NS_ERROR_FAILURE;
    }
    return NS_OK;
}

nsresult
nsSubscribableServer::NotifyChange(SubscribeTreeNode *subjectNode, nsIRDFResource *property, bool value)
{
    nsresult rv;
    nsCOMPtr <nsIRDFResource> subject;

    bool hasObservers = true;
    rv = EnsureSubscribeDS();
    NS_ENSURE_SUCCESS(rv,rv);
    rv = mSubscribeDS->GetHasObservers(&hasObservers);
    NS_ENSURE_SUCCESS(rv,rv);
    // no need to do all this work, there are no observers
    if (!hasObservers) {
        return NS_OK;
    }

    nsAutoCString subjectUri;
    BuildURIFromNode(subjectNode, subjectUri);

    rv = EnsureRDFService();
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(subjectUri, getter_AddRefs(subject));
    NS_ENSURE_SUCCESS(rv,rv);

    if (value) {
        rv = Notify(subject,property,kTrueLiteral,false,true);
    }
    else {
        rv = Notify(subject,property,kFalseLiteral,false,true);
    }

    NS_ENSURE_SUCCESS(rv,rv);
    return NS_OK;
}

nsresult
nsSubscribableServer::EnsureSubscribeDS()
{
    nsresult rv = NS_OK;

    if (!mSubscribeDS) {
        nsCOMPtr<nsIRDFDataSource> ds;

        rv = EnsureRDFService();
        NS_ENSURE_SUCCESS(rv,rv);

        rv = mRDFService->GetDataSource("rdf:subscribe", getter_AddRefs(ds));
        NS_ENSURE_SUCCESS(rv,rv);
        if (!ds) return NS_ERROR_FAILURE;

        mSubscribeDS = do_QueryInterface(ds, &rv);
        NS_ENSURE_SUCCESS(rv,rv);
        if (!mSubscribeDS) return NS_ERROR_FAILURE;
    }
    return NS_OK;
}

nsresult
nsSubscribableServer::Notify(nsIRDFResource *subject, nsIRDFResource *property, nsIRDFNode *object, bool isAssert, bool isChange)
{
    nsresult rv = NS_OK;

    rv = EnsureSubscribeDS();
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mSubscribeDS->NotifyObservers(subject, property, object, isAssert, isChange);
    NS_ENSURE_SUCCESS(rv,rv);
    return rv;
}

NS_IMETHODIMP
nsSubscribableServer::SetSubscribeListener(nsISubscribeListener *aListener)
{
	mSubscribeListener = aListener;
	return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::GetSubscribeListener(nsISubscribeListener **aListener)
{
	if (!aListener) return NS_ERROR_NULL_POINTER;
	if (mSubscribeListener) {
			*aListener = mSubscribeListener;
			NS_ADDREF(*aListener);
	}
	return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::SubscribeCleanup()
{
	NS_ASSERTION(false,"override this.");
	return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsSubscribableServer::StartPopulatingWithUri(nsIMsgWindow *aMsgWindow, bool aForceToServer, const char *uri)
{
    mStopped = false;
    return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::StartPopulating(nsIMsgWindow *aMsgWindow, bool aForceToServer, bool aGetOnlyNew /*ignored*/)
{
    nsresult rv = NS_OK;

    mStopped = false;

    rv = FreeSubtree(mTreeRoot);
    mTreeRoot = nullptr;
    NS_ENSURE_SUCCESS(rv,rv);
    return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::StopPopulating(nsIMsgWindow *aMsgWindow)
{
    mStopped = true;
    return NS_OK;
}


NS_IMETHODIMP
nsSubscribableServer::UpdateSubscribed()
{
	NS_ASSERTION(false,"override this.");
	return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsSubscribableServer::Subscribe(const PRUnichar *aName)
{
	NS_ASSERTION(false,"override this.");
	return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsSubscribableServer::Unsubscribe(const PRUnichar *aName)
{
	NS_ASSERTION(false,"override this.");
	return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsSubscribableServer::SetShowFullName(bool showFullName)
{
	mShowFullName = showFullName;
	return NS_OK;
}

nsresult
nsSubscribableServer::FreeSubtree(SubscribeTreeNode *node)
{
    nsresult rv = NS_OK;

    if (node) {
        // recursively free the children
        if (node->firstChild) {
            // will free node->firstChild
            rv = FreeSubtree(node->firstChild);
            NS_ENSURE_SUCCESS(rv,rv);
            node->firstChild = nullptr;
        }

        // recursively free the siblings
        if (node->nextSibling) {
            // will free node->nextSibling
            rv = FreeSubtree(node->nextSibling);
            NS_ENSURE_SUCCESS(rv,rv);
            node->nextSibling = nullptr;
        }

#ifdef HAVE_SUBSCRIBE_DESCRIPTION
        NS_ASSERTION(node->description == nullptr, "you need to free the description");
#endif
        NS_Free(node->name);
#if 0
        node->name = nullptr;
        node->parent = nullptr;
        node->lastChild = nullptr;
        node->cachedChild = nullptr;
#endif

        PR_Free(node);
    }

    return NS_OK;
}

nsresult
nsSubscribableServer::CreateNode(SubscribeTreeNode *parent, const char *name, SubscribeTreeNode **result)
{
    NS_ASSERTION(result && name, "result or name is null");
    if (!result || !name) return NS_ERROR_NULL_POINTER;

    *result = (SubscribeTreeNode *) PR_Malloc(sizeof(SubscribeTreeNode));
    if (!*result) return NS_ERROR_OUT_OF_MEMORY;

    (*result)->name = strdup(name);
    if (!(*result)->name) return NS_ERROR_OUT_OF_MEMORY;

    (*result)->parent = parent;
    (*result)->prevSibling = nullptr;
    (*result)->nextSibling = nullptr;
    (*result)->firstChild = nullptr;
    (*result)->lastChild = nullptr;
    (*result)->isSubscribed = false;
    (*result)->isSubscribable = false;
#ifdef HAVE_SUBSCRIBE_DESCRIPTION
    (*result)->description = nullptr;
#endif
#ifdef HAVE_SUBSCRIBE_MESSAGES
    (*result)->messages = 0;
#endif
    (*result)->cachedChild = nullptr;

    if (parent) {
        parent->cachedChild = *result;
    }

    return NS_OK;
}

nsresult
nsSubscribableServer::AddChildNode(SubscribeTreeNode *parent, const char *name, SubscribeTreeNode **child)
{
    nsresult rv = NS_OK;
    NS_ASSERTION(parent && child && name, "parent, child or name is null");
    if (!parent || !child || !name) return NS_ERROR_NULL_POINTER;

    if (!parent->firstChild) {
        // CreateNode will set the parent->cachedChild
        rv = CreateNode(parent, name, child);
        NS_ENSURE_SUCCESS(rv,rv);

        parent->firstChild = *child;
        parent->lastChild = *child;

        rv = NotifyAssert(parent, kNC_Child, *child);
        NS_ENSURE_SUCCESS(rv,rv);

        return NS_OK;
    }
    else {
        if (parent->cachedChild) {
            if (strcmp(parent->cachedChild->name,name) == 0) {
                *child = parent->cachedChild;
                return NS_OK;
            }
        }

        SubscribeTreeNode *current = parent->firstChild;

        /*
         * insert in reverse alphabetical order
         * this will reduce the # of strcmps
         * since this is faster assuming:
         *  1) the hostinfo.dat feeds us the groups in alphabetical order
         *     since we control the hostinfo.dat file, we can guarantee this.
         *  2) the server gives us the groups in alphabetical order
         *     we can't guarantee this, but it seems to be a common thing
         *
         * because we have firstChild, lastChild, nextSibling, prevSibling
         * we can efficiently reverse the order when dumping to hostinfo.dat
         * or to GetTargets()
         */
        int32_t compare = strcmp(current->name, name);

        while (current && (compare != 0)) {
            if (compare < 0) {
                // CreateNode will set the parent->cachedChild
                rv = CreateNode(parent, name, child);
                NS_ENSURE_SUCCESS(rv,rv);

                (*child)->nextSibling = current;
                (*child)->prevSibling = current->prevSibling;
                current->prevSibling = (*child);
                if (!(*child)->prevSibling) {
                    parent->firstChild = (*child);
                }
                else {
                    (*child)->prevSibling->nextSibling = (*child);
                }

                rv = NotifyAssert(parent, kNC_Child, *child);
                NS_ENSURE_SUCCESS(rv,rv);
                return NS_OK;
            }
            current = current->nextSibling;
            if (current) {
                NS_ASSERTION(current->name, "no name!");
                compare = strcmp(current->name,name);
            }
            else {
                compare = -1; // anything but 0, since that would be a match
            }
        }

        if (compare == 0) {
            // already exists;
            *child = current;

            // set the cachedChild
            parent->cachedChild = *child;
            return NS_OK;
        }

        // CreateNode will set the parent->cachedChild
        rv = CreateNode(parent, name, child);
        NS_ENSURE_SUCCESS(rv,rv);

        (*child)->prevSibling = parent->lastChild;
        (*child)->nextSibling = nullptr;
        parent->lastChild->nextSibling = *child;
        parent->lastChild = *child;

        rv = NotifyAssert(parent, kNC_Child, *child);
        NS_ENSURE_SUCCESS(rv,rv);
        return NS_OK;
    }
    return NS_OK;
}

nsresult
nsSubscribableServer::FindAndCreateNode(const nsACString &aPath,
                                        SubscribeTreeNode **aResult)
{
  nsresult rv = NS_OK;
  NS_ASSERTION(aResult, "no result");
  if (!aResult) return NS_ERROR_NULL_POINTER;

  if (!mTreeRoot) {
      nsCString serverUri;
      rv = mIncomingServer->GetServerURI(serverUri);
      NS_ENSURE_SUCCESS(rv,rv);
      // the root has no parent, and its name is server uri
      rv = CreateNode(nullptr, serverUri.get(), &mTreeRoot);
      NS_ENSURE_SUCCESS(rv,rv);
  }

  if (aPath.IsEmpty()) {
      *aResult = mTreeRoot;
      return NS_OK;
  }

  char *token = nullptr;
  nsCString pathStr(aPath);
  char *rest = pathStr.BeginWriting();

  // todo do this only once
  char delimstr[2];
  delimstr[0] = mDelimiter;
  delimstr[1] = '\0';

  *aResult = nullptr;

  SubscribeTreeNode *parent = mTreeRoot;
  SubscribeTreeNode *child = nullptr;

  token = NS_strtok(delimstr, &rest); 
  // special case paths that start with the hierarchy delimiter.
  // We want to include that delimiter in the first token name.
  if (token && pathStr[0] == mDelimiter)
    --token;
  while (token && *token) {
    rv = AddChildNode(parent, token, &child);
    if (NS_FAILED(rv))
      return rv;
    token = NS_strtok(delimstr, &rest);
    parent = child;
  }

  // the last child we add is the result
  *aResult = child;
  return rv;
}

NS_IMETHODIMP
nsSubscribableServer::HasChildren(const nsACString &aPath, bool *aHasChildren)
{
    nsresult rv = NS_OK;
    NS_ASSERTION(aHasChildren, "no hasChildren");
    if (!aHasChildren) return NS_ERROR_NULL_POINTER;

    *aHasChildren = false;

    SubscribeTreeNode *node = nullptr;
    rv = FindAndCreateNode(aPath, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    *aHasChildren = (node->firstChild != nullptr);
    return NS_OK;
}


NS_IMETHODIMP
nsSubscribableServer::IsSubscribed(const nsACString &aPath,
                                   bool *aIsSubscribed)
{
    NS_ENSURE_ARG_POINTER(aIsSubscribed);

    *aIsSubscribed = false;

    SubscribeTreeNode *node = nullptr;
    nsresult rv = FindAndCreateNode(aPath, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    *aIsSubscribed = node->isSubscribed;
    return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::IsSubscribable(const nsACString &aPath,
                                     bool *aIsSubscribable)
{
    NS_ENSURE_ARG_POINTER(aIsSubscribable);

    *aIsSubscribable = false;

    SubscribeTreeNode *node = nullptr;
    nsresult rv = FindAndCreateNode(aPath, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    *aIsSubscribable = node->isSubscribable;
    return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::GetLeafName(const nsACString &aPath, nsAString &aLeafName)
{
    SubscribeTreeNode *node = nullptr;
    nsresult rv = FindAndCreateNode(aPath, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    // XXX TODO FIXME
    // I'm assuming that mShowFullName is true for NNTP, false for IMAP.
    // for imap, the node name is in modified UTF7
    // for news, the path is escaped UTF8
    //
    // when we switch to using the tree, this hack will go away.
    if (mShowFullName) {
       return NS_MsgDecodeUnescapeURLPath(aPath, aLeafName);
    }

    return CopyMUTF7toUTF16(nsDependentCString(node->name), aLeafName);
}

NS_IMETHODIMP
nsSubscribableServer::GetFirstChildURI(const nsACString &aPath,
                                       nsACString &aResult)
{
    aResult.Truncate();

    SubscribeTreeNode *node = nullptr;
    nsresult rv = FindAndCreateNode(aPath, &node);
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node) return NS_ERROR_FAILURE;

    // no children
    if (!node->firstChild) return NS_ERROR_FAILURE;

    BuildURIFromNode(node->firstChild, aResult);

    return NS_OK;
}

NS_IMETHODIMP
nsSubscribableServer::GetChildren(const nsACString &aPath,
                                  nsISimpleEnumerator **aResult)
{
    SubscribeTreeNode *node = nullptr;
    nsresult rv = FindAndCreateNode(aPath, &node);
    NS_ENSURE_SUCCESS(rv, rv);

    NS_ASSERTION(node,"didn't find the node");
    if (!node)
      return NS_ERROR_FAILURE;

    nsAutoCString uriPrefix;
    NS_ASSERTION(mTreeRoot, "no tree root!");
    if (!mTreeRoot)
      return NS_ERROR_UNEXPECTED;

    uriPrefix = mTreeRoot->name; // the root's name is the server uri
    uriPrefix += "/";
    if (!aPath.IsEmpty()) {
        uriPrefix += aPath;
        uriPrefix += mDelimiter;
    }

    // we inserted them in reverse alphabetical order.
    // so pull them out in reverse to get the right order
    // in the subscribe dialog
    SubscribeTreeNode *current = node->lastChild;
    // return failure if there are no children.
    if (!current)
      return NS_ERROR_FAILURE;

    nsCOMArray<nsIRDFResource> result;

    while (current) {
        nsAutoCString uri;
        uri = uriPrefix;
        NS_ASSERTION(current->name, "no name");
        if (!current->name)
          return NS_ERROR_FAILURE;

        uri += current->name;

        nsCOMPtr <nsIRDFResource> res;
        rv = EnsureRDFService();
        NS_ENSURE_SUCCESS(rv,rv);

        // todo, is this creating nsMsgFolders?
        mRDFService->GetResource(uri, getter_AddRefs(res));
        result.AppendObject(res);

        current = current->prevSibling;
    }

    return NS_NewArrayEnumerator(aResult, result);
}

NS_IMETHODIMP
nsSubscribableServer::CommitSubscribeChanges()
{
    NS_ASSERTION(false,"override this.");
    return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsSubscribableServer::SetSearchValue(const nsAString &aSearchValue)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsSubscribableServer::GetSupportsSubscribeSearch(bool *retVal)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}
