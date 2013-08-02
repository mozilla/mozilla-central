/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgRDFDataSource.h"
#include "nsRDFCID.h"
#include "rdf.h"
#include "plstr.h"
#include "nsMsgRDFUtils.h"
#include "nsEnumeratorUtils.h"
#include "nsIObserverService.h"
#include "nsServiceManagerUtils.h"
#include "nsMsgUtils.h"
#include "mozilla/Services.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

nsMsgRDFDataSource::nsMsgRDFDataSource():
    m_shuttingDown(false),
    mInitialized(false)
{
}

nsMsgRDFDataSource::~nsMsgRDFDataSource()
{
  // final shutdown happens here
  NS_ASSERTION(!mInitialized, "Object going away without cleanup, possibly dangerous!");
  if (mInitialized) Cleanup();
}

/* initialization happens here - object is constructed,
   but possibly partially shut down
*/
nsresult
nsMsgRDFDataSource::Init()
{
  NS_ENSURE_TRUE(!mInitialized, NS_ERROR_ALREADY_INITIALIZED);

  nsresult rv;
  /* Add an observer to XPCOM shutdown */
  nsCOMPtr<nsIObserverService> obs =
    mozilla::services::GetObserverService();
  NS_ENSURE_TRUE(obs, NS_ERROR_UNEXPECTED);
  rv = obs->AddObserver(static_cast<nsIObserver*>(this), NS_XPCOM_SHUTDOWN_OBSERVER_ID, true);
  NS_ENSURE_SUCCESS(rv, rv);

  getRDFService();

  mInitialized=true;
  return rv;
}

void nsMsgRDFDataSource::Cleanup()
{
  mRDFService = nullptr;

  // release the window
  mWindow = nullptr;

  mInitialized = false;
}

NS_IMPL_CYCLE_COLLECTION_CLASS(nsMsgRDFDataSource)

NS_IMPL_CYCLE_COLLECTION_UNLINK_BEGIN(nsMsgRDFDataSource)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mObservers)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mWindow)
  NS_IMPL_CYCLE_COLLECTION_UNLINK(mRDFService)
NS_IMPL_CYCLE_COLLECTION_UNLINK_END

NS_IMPL_CYCLE_COLLECTION_TRAVERSE_BEGIN(nsMsgRDFDataSource)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mObservers)
  NS_IMPL_CYCLE_COLLECTION_TRAVERSE(mRDFService)
NS_IMPL_CYCLE_COLLECTION_TRAVERSE_END

NS_IMPL_CYCLE_COLLECTING_ADDREF(nsMsgRDFDataSource)
NS_IMPL_CYCLE_COLLECTING_RELEASE(nsMsgRDFDataSource)

NS_INTERFACE_MAP_BEGIN(nsMsgRDFDataSource)
  NS_INTERFACE_MAP_ENTRY(nsIRDFDataSource)
  NS_INTERFACE_MAP_ENTRY(nsIObserver)
  NS_INTERFACE_MAP_ENTRY(nsIMsgRDFDataSource)
  NS_INTERFACE_MAP_ENTRY(nsISupportsWeakReference)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIRDFDataSource)
  NS_INTERFACE_MAP_ENTRIES_CYCLE_COLLECTION(nsMsgRDFDataSource)
NS_INTERFACE_MAP_END

/* readonly attribute string URI; */
NS_IMETHODIMP
nsMsgRDFDataSource::GetURI(char * *aURI)
{
    NS_NOTREACHED("should be implemented by a subclass");
    return NS_ERROR_UNEXPECTED;
}


/* nsIRDFResource GetSource (in nsIRDFResource aProperty, in nsIRDFNode aTarget, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgRDFDataSource::GetSource(nsIRDFResource *aProperty, nsIRDFNode *aTarget, bool aTruthValue, nsIRDFResource **_retval)
{
    return NS_RDF_NO_VALUE;
}


/* nsISimpleEnumerator GetSources (in nsIRDFResource aProperty, in nsIRDFNode aTarget, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgRDFDataSource::GetSources(nsIRDFResource *aProperty, nsIRDFNode *aTarget, bool aTruthValue, nsISimpleEnumerator **_retval)
{
    return NS_RDF_NO_VALUE;
}


/* nsIRDFNode GetTarget (in nsIRDFResource aSource, in nsIRDFResource aProperty, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgRDFDataSource::GetTarget(nsIRDFResource *aSource, nsIRDFResource *aProperty, bool aTruthValue, nsIRDFNode **_retval)
{
    return NS_RDF_NO_VALUE;
}


/* nsISimpleEnumerator GetTargets (in nsIRDFResource aSource, in nsIRDFResource aProperty, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgRDFDataSource::GetTargets(nsIRDFResource *aSource, nsIRDFResource *aProperty, bool aTruthValue, nsISimpleEnumerator **_retval)
{
    return NS_RDF_NO_VALUE;
}


/* void Assert (in nsIRDFResource aSource, in nsIRDFResource aProperty, in nsIRDFNode aTarget, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgRDFDataSource::Assert(nsIRDFResource *aSource, nsIRDFResource *aProperty, nsIRDFNode *aTarget, bool aTruthValue)
{
    return NS_RDF_NO_VALUE;
}


/* void Unassert (in nsIRDFResource aSource, in nsIRDFResource aProperty, in nsIRDFNode aTarget); */
NS_IMETHODIMP
nsMsgRDFDataSource::Unassert(nsIRDFResource *aSource, nsIRDFResource *aProperty, nsIRDFNode *aTarget)
{
    return NS_RDF_NO_VALUE;
}


NS_IMETHODIMP
nsMsgRDFDataSource::Change(nsIRDFResource *aSource,
                           nsIRDFResource *aProperty,
                           nsIRDFNode *aOldTarget,
                           nsIRDFNode *aNewTarget)
{
    return NS_RDF_NO_VALUE;
}

NS_IMETHODIMP
nsMsgRDFDataSource::Move(nsIRDFResource *aOldSource,
                         nsIRDFResource *aNewSource,
                         nsIRDFResource *aProperty,
                         nsIRDFNode *aTarget)
{
    return NS_RDF_NO_VALUE;
}


/* boolean HasAssertion (in nsIRDFResource aSource, in nsIRDFResource aProperty, in nsIRDFNode aTarget, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgRDFDataSource::HasAssertion(nsIRDFResource *aSource, nsIRDFResource *aProperty, nsIRDFNode *aTarget, bool aTruthValue, bool *_retval)
{
    *_retval = false;
    return NS_OK;
}


/* void AddObserver (in nsIRDFObserver aObserver); */
NS_IMETHODIMP
nsMsgRDFDataSource::AddObserver(nsIRDFObserver *aObserver)
{
  NS_ENSURE_ARG_POINTER(aObserver);
  if (!mInitialized)
      Init();
  mObservers.AppendObject(aObserver);
  return NS_OK;
}

/* void RemoveObserver (in nsIRDFObserver aObserver); */
NS_IMETHODIMP
nsMsgRDFDataSource::RemoveObserver(nsIRDFObserver *aObserver)
{
  NS_ENSURE_ARG_POINTER(aObserver);
  mObservers.RemoveObject(aObserver);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRDFDataSource::HasArcIn(nsIRDFNode *aNode, nsIRDFResource *aArc, bool *result)
{
  *result = false;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgRDFDataSource::HasArcOut(nsIRDFResource *aSource, nsIRDFResource *aArc, bool *result)
{
  *result = false;
  return NS_OK;
}

/* nsISimpleEnumerator ArcLabelsIn (in nsIRDFNode aNode); */
NS_IMETHODIMP
nsMsgRDFDataSource::ArcLabelsIn(nsIRDFNode *aNode, nsISimpleEnumerator **_retval)
{
  return NS_NewEmptyEnumerator(_retval);
}


/* nsISimpleEnumerator ArcLabelsOut (in nsIRDFResource aSource); */
NS_IMETHODIMP
nsMsgRDFDataSource::ArcLabelsOut(nsIRDFResource *aSource, nsISimpleEnumerator **_retval)
{
    return NS_RDF_NO_VALUE;
}


/* nsISimpleEnumerator GetAllResources (); */
NS_IMETHODIMP
nsMsgRDFDataSource::GetAllResources(nsISimpleEnumerator **_retval)
{
    return NS_RDF_NO_VALUE;
}


/* nsISimpleEnumerator GetAllCmds (in nsIRDFResource aSource); */
NS_IMETHODIMP
nsMsgRDFDataSource::GetAllCmds(nsIRDFResource *aSource, nsISimpleEnumerator **_retval)
{
    return NS_RDF_NO_VALUE;
}


/* boolean IsCommandEnabled (in nsISupportsArray aSources, in nsIRDFResource aCommand, in nsISupportsArray aArguments); */
NS_IMETHODIMP
nsMsgRDFDataSource::IsCommandEnabled(nsISupportsArray *aSources, nsIRDFResource *aCommand, nsISupportsArray *aArguments, bool *_retval)
{
    return NS_RDF_NO_VALUE;
}


/* void DoCommand (in nsISupportsArray aSources, in nsIRDFResource aCommand, in nsISupportsArray aArguments); */
NS_IMETHODIMP
nsMsgRDFDataSource::DoCommand(nsISupportsArray *aSources, nsIRDFResource *aCommand, nsISupportsArray *aArguments)
{
    return NS_RDF_NO_VALUE;
}

/* void BeginUpdateBatch (); */
NS_IMETHODIMP
nsMsgRDFDataSource::BeginUpdateBatch()
{
    return NS_OK;
}

/* void EndUpdateBatch (); */
NS_IMETHODIMP
nsMsgRDFDataSource::EndUpdateBatch()
{
    return NS_OK;
}


/* XPCOM Shutdown observer */
NS_IMETHODIMP
nsMsgRDFDataSource::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *someData )
{
  if (!strcmp(aTopic, NS_XPCOM_SHUTDOWN_OBSERVER_ID)) {
    m_shuttingDown = true;
    Cleanup();
  }
  return NS_OK;
}


NS_IMETHODIMP nsMsgRDFDataSource::GetWindow(nsIMsgWindow * *aWindow)
{
  if(!aWindow)
    return NS_ERROR_NULL_POINTER;

  *aWindow = mWindow;
  NS_IF_ADDREF(*aWindow);
  return NS_OK;
}

NS_IMETHODIMP nsMsgRDFDataSource::SetWindow(nsIMsgWindow * aWindow)
{
  mWindow = aWindow;
  return NS_OK;
}


nsIRDFService *
nsMsgRDFDataSource::getRDFService()
{
    if (!mRDFService && !m_shuttingDown) {
        nsresult rv;
        mRDFService = do_GetService(kRDFServiceCID, &rv);
        if (NS_FAILED(rv)) return nullptr;
    }

    return mRDFService;
}

nsresult nsMsgRDFDataSource::NotifyPropertyChanged(nsIRDFResource *resource,
                                                   nsIRDFResource *propertyResource,
                                                   nsIRDFNode *newNode,
                                                   nsIRDFNode *oldNode /* = nullptr */)
{

  NotifyObservers(resource, propertyResource, newNode, oldNode, false, true);
  return NS_OK;

}

nsresult nsMsgRDFDataSource::NotifyObservers(nsIRDFResource *subject,
                                                nsIRDFResource *property,
                                                nsIRDFNode *newObject,
                                                nsIRDFNode *oldObject,
                                                bool assert, bool change)
{
  NS_ASSERTION(!(change && assert),
               "Can't change and assert at the same time!\n");
  nsMsgRDFNotification note = { this, subject, property, newObject, oldObject };
  if(change)
    mObservers.EnumerateForwards(changeEnumFunc, &note);
  else if (assert)
    mObservers.EnumerateForwards(assertEnumFunc, &note);
  else
    mObservers.EnumerateForwards(unassertEnumFunc, &note);
  return NS_OK;
}

bool
nsMsgRDFDataSource::assertEnumFunc(nsIRDFObserver *aObserver, void *aData)
{
  nsMsgRDFNotification *note = (nsMsgRDFNotification *)aData;
  aObserver->OnAssert(note->datasource,
                     note->subject,
                     note->property,
                     note->newObject);
  return true;
}

bool
nsMsgRDFDataSource::unassertEnumFunc(nsIRDFObserver *aObserver, void *aData)
{
  nsMsgRDFNotification* note = (nsMsgRDFNotification *)aData;
  aObserver->OnUnassert(note->datasource,
                       note->subject,
                       note->property,
                       note->newObject);
  return true;
}

bool
nsMsgRDFDataSource::changeEnumFunc(nsIRDFObserver *aObserver, void *aData)
{
  nsMsgRDFNotification* note = (nsMsgRDFNotification *)aData;
  aObserver->OnChange(note->datasource,
                     note->subject,
                     note->property,
                     note->oldObject, note->newObject);
  return true;
}
