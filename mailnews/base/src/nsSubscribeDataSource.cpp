/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsSubscribeDataSource.h"

#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsIComponentManager.h"
#include "rdf.h"
#include "nsIServiceManager.h"
#include "nsEnumeratorUtils.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"
#include "nsIMsgFolder.h"
#include "nsIMsgIncomingServer.h"
#include "nsCOMArray.h"
#include "nsArrayEnumerator.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMsgUtils.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

nsSubscribeDataSource::nsSubscribeDataSource()
{
}

nsSubscribeDataSource::~nsSubscribeDataSource()
{
}

NS_IMPL_ISUPPORTS2(nsSubscribeDataSource, nsIRDFDataSource, nsISubscribeDataSource) 

nsresult
nsSubscribeDataSource::Init()
{
    nsresult rv;

    mRDFService = do_GetService(kRDFServiceCID, &rv);
    NS_ASSERTION(NS_SUCCEEDED(rv) && mRDFService, "failed to get rdf service");
    NS_ENSURE_SUCCESS(rv,rv);
    if (!mRDFService) return NS_ERROR_FAILURE;

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "child"),
                                  getter_AddRefs(kNC_Child));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "Name"),
                                  getter_AddRefs(kNC_Name));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "LeafName"),
                                  getter_AddRefs(kNC_LeafName));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "Subscribed"),
                                  getter_AddRefs(kNC_Subscribed));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "Subscribable"),
                                  getter_AddRefs(kNC_Subscribable));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetResource(NS_LITERAL_CSTRING(NC_NAMESPACE_URI "ServerType"),
                                  getter_AddRefs(kNC_ServerType));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mRDFService->GetLiteral(NS_LITERAL_STRING("true").get(),getter_AddRefs(kTrueLiteral));
    NS_ENSURE_SUCCESS(rv,rv);
  
    rv = mRDFService->GetLiteral(NS_LITERAL_STRING("false").get(),getter_AddRefs(kFalseLiteral));
    NS_ENSURE_SUCCESS(rv,rv);
	return NS_OK;
}

NS_IMETHODIMP 
nsSubscribeDataSource::GetURI(char * *aURI)
{
  if ((*aURI = strdup("rdf:subscribe")) == nullptr)
    return NS_ERROR_OUT_OF_MEMORY;
  else
    return NS_OK;
}

NS_IMETHODIMP 
nsSubscribeDataSource::GetSource(nsIRDFResource *property, nsIRDFNode *target, bool tv, nsIRDFResource **source)
{
    NS_PRECONDITION(property != nullptr, "null ptr");
    if (! property)
        return NS_ERROR_NULL_POINTER;

    NS_PRECONDITION(target != nullptr, "null ptr");
    if (! target)
        return NS_ERROR_NULL_POINTER;

    NS_PRECONDITION(source != nullptr, "null ptr");
    if (! source)
        return NS_ERROR_NULL_POINTER;

    *source = nullptr;
    return NS_RDF_NO_VALUE;
}

NS_IMETHODIMP
nsSubscribeDataSource::GetTarget(nsIRDFResource *source,
                                nsIRDFResource *property,
                                bool tv,
                                nsIRDFNode **target /* out */)
{
	nsresult rv = NS_RDF_NO_VALUE;

	NS_PRECONDITION(source != nullptr, "null ptr");
	if (! source)
		return NS_ERROR_NULL_POINTER;

	NS_PRECONDITION(property != nullptr, "null ptr");
	if (! property)
		return NS_ERROR_NULL_POINTER;

	NS_PRECONDITION(target != nullptr, "null ptr");
	if (! target)
		return NS_ERROR_NULL_POINTER;

	*target = nullptr;

	// we only have positive assertions in the subscribe data source.
	if (! tv) return NS_RDF_NO_VALUE;

    nsCOMPtr<nsISubscribableServer> server;
    nsCString relativePath;
    rv = GetServerAndRelativePathFromResource(source, getter_AddRefs(server), getter_Copies(relativePath));
    if (NS_FAILED(rv) || !server)
        return NS_RDF_NO_VALUE;

    if (property == kNC_Name.get()) {
        nsCOMPtr<nsIRDFLiteral> name;
        rv = mRDFService->GetLiteral(NS_ConvertUTF8toUTF16(relativePath).get(),
                                     getter_AddRefs(name));
        NS_ENSURE_SUCCESS(rv,rv);

        if (!name) rv = NS_RDF_NO_VALUE;
        if (rv == NS_RDF_NO_VALUE) return(rv);
        return name->QueryInterface(NS_GET_IID(nsIRDFNode), (void**) target);
    }
    else if (property == kNC_Child.get()) {
        nsCString childUri;
        rv = server->GetFirstChildURI(relativePath, childUri);
        if (NS_FAILED(rv)) return NS_RDF_NO_VALUE;
        if (childUri.IsEmpty()) return NS_RDF_NO_VALUE;

        nsCOMPtr <nsIRDFResource> childResource;
        rv = mRDFService->GetResource(childUri, getter_AddRefs(childResource));
        NS_ENSURE_SUCCESS(rv,rv);
        
        return childResource->QueryInterface(NS_GET_IID(nsIRDFNode), (void**) target);
    }
    else if (property == kNC_Subscribed.get()) {
        bool isSubscribed;
        rv = server->IsSubscribed(relativePath, &isSubscribed);
        NS_ENSURE_SUCCESS(rv,rv);
    
        NS_IF_ADDREF(*target = (isSubscribed ? kTrueLiteral : kFalseLiteral));
        return NS_OK;
    }
    else if (property == kNC_Subscribable.get()) {
        bool isSubscribable;
        rv = server->IsSubscribable(relativePath, &isSubscribable);
        NS_ENSURE_SUCCESS(rv,rv);
        
        NS_IF_ADDREF(*target = (isSubscribable ? kTrueLiteral : kFalseLiteral));
        return NS_OK;
    }
    else if (property == kNC_ServerType.get()) {
        nsCString serverTypeStr;
        rv = GetServerType(server, serverTypeStr);
        NS_ENSURE_SUCCESS(rv,rv);

        nsCOMPtr<nsIRDFLiteral> serverType;
        rv = mRDFService->GetLiteral(NS_ConvertASCIItoUTF16(serverTypeStr).get(),
                                     getter_AddRefs(serverType));
        NS_ENSURE_SUCCESS(rv,rv);

        if (!serverType)
          rv = NS_RDF_NO_VALUE;
        if (rv == NS_RDF_NO_VALUE) 
          return rv;
        return serverType->QueryInterface(NS_GET_IID(nsIRDFNode), (void**) target);
    }
    else if (property == kNC_LeafName.get()) {
        nsString leafNameStr;
        rv = server->GetLeafName(relativePath, leafNameStr); 
        NS_ENSURE_SUCCESS(rv,rv);
   
        nsCOMPtr<nsIRDFLiteral> leafName;
        rv = mRDFService->GetLiteral(leafNameStr.get(), getter_AddRefs(leafName));
        NS_ENSURE_SUCCESS(rv,rv);

        if (!leafName)
          rv = NS_RDF_NO_VALUE;
        if (rv == NS_RDF_NO_VALUE)
          return rv;
        return leafName->QueryInterface(NS_GET_IID(nsIRDFNode), (void**) target);
    }
    else {
        // do nothing
    }

  return(NS_RDF_NO_VALUE);
}

NS_IMETHODIMP
nsSubscribeDataSource::GetTargets(nsIRDFResource *source,
				nsIRDFResource *property,
				bool tv,
				nsISimpleEnumerator **targets /* out */)
{
	nsresult rv = NS_OK;

	NS_PRECONDITION(source != nullptr, "null ptr");
	if (! source)
		return NS_ERROR_NULL_POINTER;

	NS_PRECONDITION(property != nullptr, "null ptr");
	if (! property)
		return NS_ERROR_NULL_POINTER;

	NS_PRECONDITION(targets != nullptr, "null ptr");
	if (! targets)
		return NS_ERROR_NULL_POINTER;

    *targets = nullptr;

	// we only have positive assertions in the subscribe data source.
	if (!tv) return NS_RDF_NO_VALUE;

    nsCOMPtr<nsISubscribableServer> server;
    nsCString relativePath;  // UTF-8

    rv = GetServerAndRelativePathFromResource(source, getter_AddRefs(server), getter_Copies(relativePath));
    if (NS_FAILED(rv) || !server) {
	    return NS_NewEmptyEnumerator(targets);
    }

    if (property == kNC_Child.get()) {
        rv = server->GetChildren(relativePath, targets);
        if (NS_FAILED(rv)) {
            return NS_NewEmptyEnumerator(targets);
        }
        return rv;
    }
    else if (property == kNC_LeafName.get()) {
        nsString leafNameStr;
        rv = server->GetLeafName(relativePath, leafNameStr);
        NS_ENSURE_SUCCESS(rv,rv);
    
        nsCOMPtr<nsIRDFLiteral> leafName;
        rv = mRDFService->GetLiteral(leafNameStr.get(), getter_AddRefs(leafName));
        NS_ENSURE_SUCCESS(rv,rv);

        return NS_NewSingletonEnumerator(targets, leafName);
    }
    else if (property == kNC_Subscribed.get()) {
        bool isSubscribed;
        rv = server->IsSubscribed(relativePath, &isSubscribed);
        NS_ENSURE_SUCCESS(rv,rv);

        return NS_NewSingletonEnumerator(targets,
                 isSubscribed ? kTrueLiteral : kFalseLiteral);
    }
    else if (property == kNC_Subscribable.get()) {
        bool isSubscribable;
        rv = server->IsSubscribable(relativePath, &isSubscribable);
        NS_ENSURE_SUCCESS(rv,rv);

        return NS_NewSingletonEnumerator(targets,
                 isSubscribable ? kTrueLiteral : kFalseLiteral);
    }
    else if (property == kNC_Name.get()) {
        nsCOMPtr<nsIRDFLiteral> name;
        rv = mRDFService->GetLiteral(NS_ConvertUTF8toUTF16(relativePath).get(),
                                     getter_AddRefs(name));
        NS_ENSURE_SUCCESS(rv,rv);

        return NS_NewSingletonEnumerator(targets, name);
    }
    else if (property == kNC_ServerType.get()) {
        nsCString serverTypeStr;
        rv = GetServerType(server, serverTypeStr);
        NS_ENSURE_SUCCESS(rv,rv);

        nsCOMPtr<nsIRDFLiteral> serverType;
        rv = mRDFService->GetLiteral(NS_ConvertASCIItoUTF16(serverTypeStr).get(),
                                     getter_AddRefs(serverType));
        NS_ENSURE_SUCCESS(rv,rv);

        return NS_NewSingletonEnumerator(targets, serverType);
    }
    else {
        // do nothing
    }

	return NS_NewEmptyEnumerator(targets);
}

NS_IMETHODIMP
nsSubscribeDataSource::Assert(nsIRDFResource *source,
                       nsIRDFResource *property,
                       nsIRDFNode *target,
                       bool tv)
{
	return NS_RDF_ASSERTION_REJECTED;
}



NS_IMETHODIMP
nsSubscribeDataSource::Unassert(nsIRDFResource *source,
                         nsIRDFResource *property,
                         nsIRDFNode *target)
{
  return NS_RDF_ASSERTION_REJECTED;
}



NS_IMETHODIMP
nsSubscribeDataSource::Change(nsIRDFResource* aSource,
                              nsIRDFResource* aProperty,
                              nsIRDFNode* aOldTarget,
                              nsIRDFNode* aNewTarget)
{
  return NS_RDF_ASSERTION_REJECTED;
}



NS_IMETHODIMP
nsSubscribeDataSource::Move(nsIRDFResource* aOldSource,
                            nsIRDFResource* aNewSource,
                            nsIRDFResource* aProperty,
                            nsIRDFNode* aTarget)
{
  return NS_RDF_ASSERTION_REJECTED;
}

nsresult
nsSubscribeDataSource::GetServerType(nsISubscribableServer *server, nsACString& serverType)
{
  NS_ENSURE_ARG_POINTER(server);
  nsresult rv;
  nsCOMPtr<nsIMsgIncomingServer> incomingServer(do_QueryInterface(server, &rv));
  NS_ENSURE_SUCCESS(rv,rv);
  return incomingServer->GetType(serverType);
}

nsresult
nsSubscribeDataSource::GetServerAndRelativePathFromResource(nsIRDFResource *source, nsISubscribableServer **server, char **relativePath)
{
    nsresult rv = NS_OK;

    const char *sourceURI = nullptr;
    rv = source->GetValueConst(&sourceURI);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIMsgFolder> folder(do_QueryInterface(source, &rv));
    // we expect this to fail sometimes, so don't assert
    if (NS_FAILED(rv))
      return rv;

    nsCOMPtr<nsIMsgIncomingServer> incomingServer;
    rv = folder->GetServer(getter_AddRefs(incomingServer));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = incomingServer->QueryInterface(NS_GET_IID(nsISubscribableServer), (void**)server);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCString serverURI;
    rv = incomingServer->GetServerURI(serverURI);
    NS_ENSURE_SUCCESS(rv,rv);
 
    uint32_t serverURILen = serverURI.Length();
    if (serverURILen == strlen(sourceURI))
      *relativePath = nullptr;
    else {
      // XXX : perhaps, have to unescape before returning 
      *relativePath = strdup(sourceURI + serverURILen + 1);
      if (!*relativePath)
        return NS_ERROR_OUT_OF_MEMORY;
    }

    return NS_OK;
}

NS_IMETHODIMP
nsSubscribeDataSource::HasAssertion(nsIRDFResource *source,
                             nsIRDFResource *property,
                             nsIRDFNode *target,
                             bool tv,
                             bool *hasAssertion /* out */)
{
    nsresult rv = NS_OK;

	NS_PRECONDITION(source != nullptr, "null ptr");
	if (! source)
		return NS_ERROR_NULL_POINTER;

	NS_PRECONDITION(property != nullptr, "null ptr");
	if (! property)
		return NS_ERROR_NULL_POINTER;

	NS_PRECONDITION(target != nullptr, "null ptr");
	if (! target)
		return NS_ERROR_NULL_POINTER;

	NS_PRECONDITION(hasAssertion != nullptr, "null ptr");
	if (! hasAssertion)
		return NS_ERROR_NULL_POINTER;

	*hasAssertion = false;

  // we only have positive assertions in the subscribe data source.
	if (!tv) return NS_OK;

	if (property == kNC_Child.get()) {
    nsCOMPtr<nsISubscribableServer> server;
    nsCString relativePath;

    rv = GetServerAndRelativePathFromResource(source, getter_AddRefs(server), getter_Copies(relativePath));
    if (NS_FAILED(rv) || !server) {
        *hasAssertion = false;
        return NS_OK;
    }

        // not everything has children
        rv = server->HasChildren(relativePath, hasAssertion);
        NS_ENSURE_SUCCESS(rv,rv);
    }
    else if (property == kNC_Name.get()) {
        // everything has a name
        *hasAssertion = true;
    }
    else if (property == kNC_LeafName.get()) {
        // everything has a leaf name
        *hasAssertion = true;
    }
    else if (property == kNC_Subscribed.get()) {
        // everything is subscribed or not
        *hasAssertion = true;
    }
    else if (property == kNC_Subscribable.get()) {
        // everything is subscribable or not
        *hasAssertion = true;
    }
    else if (property == kNC_ServerType.get()) {
        // everything has a server type
        *hasAssertion = true;
    }
    else {
        // do nothing
    }

	return NS_OK;
}


NS_IMETHODIMP 
nsSubscribeDataSource::HasArcIn(nsIRDFNode *aNode, nsIRDFResource *aArc, bool *result)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP 
nsSubscribeDataSource::HasArcOut(nsIRDFResource *source, nsIRDFResource *aArc, bool *result)
{
    nsresult rv = NS_OK;

    nsCOMPtr<nsISubscribableServer> server;
    nsCString relativePath;

    if (aArc == kNC_Child.get()) {
    rv = GetServerAndRelativePathFromResource(source, getter_AddRefs(server), getter_Copies(relativePath));
    if (NS_FAILED(rv) || !server) {
	    *result = false;
        return NS_OK;
    }

        bool hasChildren = false;
        rv = server->HasChildren(relativePath, &hasChildren);
        NS_ENSURE_SUCCESS(rv,rv);
        *result = hasChildren;
        return NS_OK;
    }
    else if ((aArc == kNC_Subscribed.get()) ||
             (aArc == kNC_Subscribable.get()) ||
             (aArc == kNC_LeafName.get()) ||
             (aArc == kNC_ServerType.get()) ||
             (aArc == kNC_Name.get())) {
        *result = true;
        return NS_OK;
    }

    *result = false;
    return NS_OK;
}


NS_IMETHODIMP
nsSubscribeDataSource::ArcLabelsIn(nsIRDFNode *node,
                            nsISimpleEnumerator ** labels /* out */)
{
	return NS_ERROR_NOT_IMPLEMENTED;
}



NS_IMETHODIMP
nsSubscribeDataSource::ArcLabelsOut(nsIRDFResource *source,
				   nsISimpleEnumerator **labels /* out */)
{
    nsresult rv = NS_OK;

    NS_PRECONDITION(source != nullptr, "null ptr");
    if (! source)
	return NS_ERROR_NULL_POINTER;

    NS_PRECONDITION(labels != nullptr, "null ptr");
    if (! labels)
	return NS_ERROR_NULL_POINTER;

    nsCOMPtr<nsISubscribableServer> server;
    nsCString relativePath;

    rv = GetServerAndRelativePathFromResource(source, getter_AddRefs(server), getter_Copies(relativePath));
    if (NS_FAILED(rv) || !server) {
        return NS_NewEmptyEnumerator(labels);
    }

    bool hasChildren = false;
    rv = server->HasChildren(relativePath, &hasChildren);
    NS_ENSURE_SUCCESS(rv,rv);

    // Initialise with the number of items below, to save reallocating on each
    // addition.
    nsCOMArray<nsIRDFResource> array(hasChildren ? 6 : 5);

    array.AppendObject(kNC_Subscribed);
    array.AppendObject(kNC_Subscribable);
    array.AppendObject(kNC_Name);
    array.AppendObject(kNC_ServerType);
    array.AppendObject(kNC_LeafName);

    if (hasChildren) {
        array.AppendObject(kNC_Child);
    }

    return NS_NewArrayEnumerator(labels, array);
}

NS_IMETHODIMP
nsSubscribeDataSource::GetAllResources(nsISimpleEnumerator** aCursor)
{
	NS_NOTYETIMPLEMENTED("sorry!");
	return NS_ERROR_NOT_IMPLEMENTED;
}



NS_IMETHODIMP
nsSubscribeDataSource::AddObserver(nsIRDFObserver *n)
{
  NS_ENSURE_ARG_POINTER(n);
  mObservers.AppendElement(n);
  return NS_OK;
}


NS_IMETHODIMP
nsSubscribeDataSource::RemoveObserver(nsIRDFObserver *n)
{
  NS_ENSURE_ARG_POINTER(n);
  mObservers.RemoveElement(n);
  return NS_OK;
}

NS_IMETHODIMP
nsSubscribeDataSource::GetHasObservers(bool *hasObservers)
{
  NS_ENSURE_ARG_POINTER(hasObservers);
  *hasObservers = !mObservers.IsEmpty();
  return NS_OK;
}

NS_IMETHODIMP
nsSubscribeDataSource::GetAllCmds(nsIRDFResource* source,
                                     nsISimpleEnumerator/*<nsIRDFResource>*/** commands)
{
	return(NS_NewEmptyEnumerator(commands));
}

NS_IMETHODIMP
nsSubscribeDataSource::IsCommandEnabled(nsISupportsArray/*<nsIRDFResource>*/* aSources,
                                       nsIRDFResource*   aCommand,
                                       nsISupportsArray/*<nsIRDFResource>*/* aArguments,
                                       bool* aResult)
{
	return(NS_ERROR_NOT_IMPLEMENTED);
}



NS_IMETHODIMP
nsSubscribeDataSource::DoCommand(nsISupportsArray/*<nsIRDFResource>*/* aSources,
                                nsIRDFResource*   aCommand,
                                nsISupportsArray/*<nsIRDFResource>*/* aArguments)
{
	return(NS_ERROR_NOT_IMPLEMENTED);
}



NS_IMETHODIMP
nsSubscribeDataSource::BeginUpdateBatch()
{
        return NS_OK;
}



NS_IMETHODIMP
nsSubscribeDataSource::EndUpdateBatch()
{
        return NS_OK;
}



NS_IMETHODIMP 
nsSubscribeDataSource::GetSources(nsIRDFResource *aProperty, nsIRDFNode *aTarget, bool aTruthValue, nsISimpleEnumerator **_retval)
{
  NS_ASSERTION(false, "Not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

#define NOTIFY_SUBSCRIBE_LISTENERS(propertyfunc_, params_) \
  PR_BEGIN_MACRO \
  { \
    nsTObserverArray<nsCOMPtr<nsIRDFObserver> >::ForwardIterator iter(mObservers); \
    while (iter.HasMore()) \
    { \
      iter.GetNext()->propertyfunc_ params_; \
    } \
  } \
  PR_END_MACRO

NS_IMETHODIMP
nsSubscribeDataSource::NotifyObservers(nsIRDFResource *subject,
                                                nsIRDFResource *property,
                                                nsIRDFNode *object,
                                                bool assert, bool change)
{
  NS_ASSERTION(!(change && assert),
               "Can't change and assert at the same time!\n");

  if (change)
    NOTIFY_SUBSCRIBE_LISTENERS(OnChange, (this, subject, property, nullptr, object));
  else if (assert)
    NOTIFY_SUBSCRIBE_LISTENERS(OnAssert, (this, subject, property, object));
  else
    NOTIFY_SUBSCRIBE_LISTENERS(OnUnassert, (this, subject, property, object));
  return NS_OK;
}
