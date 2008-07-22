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
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Seth Spitzer <sspitzer@netscape.com>
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

#include "nsDirectoryDataSource.h"
#include "nsAbBaseCID.h"
#include "nsIAbDirectory.h"
#include "nsIAbManager.h"
#include "nsIAbCard.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsArrayEnumerator.h"
#include "rdf.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsIRDFNode.h"
#include "nsEnumeratorUtils.h"
#include "nsIObserverService.h"

#include "nsCOMPtr.h"
#include "nsStringGlue.h"

#include "nsMsgRDFUtils.h"
#include "nsILocaleService.h"
#include "nsCollationCID.h"
#include "prmem.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"

#define NC_RDF_DIRNAME              "http://home.netscape.com/NC-rdf#DirName"
#define NC_RDF_DIRURI               "http://home.netscape.com/NC-rdf#DirUri"
#define NC_RDF_ISMAILLIST           "http://home.netscape.com/NC-rdf#IsMailList"
#define NC_RDF_ISREMOTE             "http://home.netscape.com/NC-rdf#IsRemote"
#define NC_RDF_ISWRITEABLE          "http://home.netscape.com/NC-rdf#IsWriteable"
#define NC_RDF_DIRTREENAMESORT      "http://home.netscape.com/NC-rdf#DirTreeNameSort"
#define NC_RDF_SUPPORTSMAILINGLISTS "http://home.netscape.com/NC-rdf#SupportsMailingLists"

////////////////////////////////////////////////////////////////////////

nsAbDirectoryDataSource::nsAbDirectoryDataSource()
{
}

nsAbDirectoryDataSource::~nsAbDirectoryDataSource()
{
}

nsresult nsAbDirectoryDataSource::Cleanup()
{
  nsresult rv;
  nsCOMPtr <nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = rdf->UnregisterDataSource(this);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = abManager->RemoveAddressBookListener(this);
  NS_ENSURE_SUCCESS(rv,rv);

  return NS_OK;
}

NS_IMETHODIMP
nsAbDirectoryDataSource::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *someData)
{
  if (!strcmp(aTopic,"profile-do-change")) {
    /* the nsDirPrefs code caches all the directories that it got
     * from the first profiles prefs.js
     * When we profile switch, we need to force it to shut down.
     * we'll re-load all the directories from the second profiles prefs.js
     * that happens in nsAbBSDirectory::GetChildNodes()
     * when we call DIR_GetDirectories()
     */
    DIR_ShutDown();
    return NS_OK;
  }
  else if (!strcmp(aTopic,NS_XPCOM_SHUTDOWN_OBSERVER_ID)) {
    DIR_ShutDown();
    return Cleanup();
  }
  return NS_OK;
}

nsresult
nsAbDirectoryDataSource::Init()
{
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // this listener cares about all events
  rv = abManager->AddAddressBookListener(this, nsIAbListener::all);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = rdf->RegisterDataSource(this, PR_FALSE);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_CHILD),
                        getter_AddRefs(kNC_Child));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_DIRNAME),
                        getter_AddRefs(kNC_DirName));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_DIRURI),
                        getter_AddRefs(kNC_DirUri));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_ISMAILLIST),
                        getter_AddRefs(kNC_IsMailList));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_ISREMOTE),
                        getter_AddRefs(kNC_IsRemote));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_ISSECURE),
                        getter_AddRefs(kNC_IsSecure));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_ISWRITEABLE),
                        getter_AddRefs(kNC_IsWriteable));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_DIRTREENAMESORT), getter_AddRefs(kNC_DirTreeNameSort));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = rdf->GetResource(NS_LITERAL_CSTRING(NC_RDF_SUPPORTSMAILINGLISTS),
                        getter_AddRefs(kNC_SupportsMailingLists));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = createNode(NS_LITERAL_STRING("true").get(), getter_AddRefs(kTrueLiteral));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = createNode(NS_LITERAL_STRING("false").get(), getter_AddRefs(kFalseLiteral));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1", &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // since the observer (this) supports weak ref,
  // and we call AddObserver() with PR_TRUE for ownsWeak
  // we don't need to remove our observer from the from the observer service
  rv = observerService->AddObserver(this, "profile-do-change", PR_TRUE);
  NS_ENSURE_SUCCESS(rv,rv);
  rv = observerService->AddObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, PR_TRUE);
  NS_ENSURE_SUCCESS(rv,rv);

  return NS_OK;
}

NS_IMPL_ISUPPORTS_INHERITED3(nsAbDirectoryDataSource, nsAbRDFDataSource, nsIAbListener, nsIObserver, nsISupportsWeakReference)

 // nsIRDFDataSource methods
NS_IMETHODIMP nsAbDirectoryDataSource::GetURI(char* *uri)
{
  if ((*uri = strdup("rdf:addressdirectory")) == nsnull)
    return NS_ERROR_OUT_OF_MEMORY;
  else
    return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryDataSource::GetTarget(nsIRDFResource* source,
                                               nsIRDFResource* property,
                                               PRBool tv,
                                               nsIRDFNode** target)
{
  nsresult rv = NS_RDF_NO_VALUE;
  // we only have positive assertions in the mail data source.
  if (! tv)
    return NS_RDF_NO_VALUE;

  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(source, &rv));
  if (NS_SUCCEEDED(rv) && directory)
    rv = createDirectoryNode(directory, property, target);
  else
    return NS_RDF_NO_VALUE;
  return rv;
}


NS_IMETHODIMP nsAbDirectoryDataSource::GetTargets(nsIRDFResource* source,
                                                  nsIRDFResource* property,
                                                  PRBool tv,
                                                  nsISimpleEnumerator** targets)
{
  nsresult rv = NS_RDF_NO_VALUE;
  NS_ENSURE_ARG_POINTER(targets);

  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(source, &rv));
  if (NS_SUCCEEDED(rv) && directory)
  {
    if ((kNC_Child == property))
    {
      return directory->GetChildNodes(targets);
    }
    else if((kNC_DirName == property) ||
      (kNC_DirUri == property) ||
      (kNC_IsMailList == property) ||
      (kNC_IsRemote == property) ||
      (kNC_IsSecure == property) ||
      (kNC_IsWriteable == property) ||
      (kNC_DirTreeNameSort == property) ||
      (kNC_SupportsMailingLists == property))
    {
      return NS_NewSingletonEnumerator(targets, property);
    }
  }
  return NS_NewEmptyEnumerator(targets);
}

NS_IMETHODIMP nsAbDirectoryDataSource::Assert(nsIRDFResource* source,
                      nsIRDFResource* property,
                      nsIRDFNode* target,
                      PRBool tv)
{
  nsresult rv;
  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(source, &rv));
  //We don't handle tv = PR_FALSE at the moment.
  if(NS_SUCCEEDED(rv) && tv)
    return DoDirectoryAssert(directory, property, target);
  else
    return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsAbDirectoryDataSource::HasAssertion(nsIRDFResource* source,
                            nsIRDFResource* property,
                            nsIRDFNode* target,
                            PRBool tv,
                            PRBool* hasAssertion)
{
  nsresult rv;
  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(source, &rv));
  if(NS_SUCCEEDED(rv))
    return DoDirectoryHasAssertion(directory, property, target, tv, hasAssertion);
  else
    *hasAssertion = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsAbDirectoryDataSource::HasArcOut(nsIRDFResource *aSource, nsIRDFResource *aArc, PRBool *result)
{
  nsresult rv;
  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(aSource, &rv));
  if (NS_SUCCEEDED(rv)) {
    *result = (aArc == kNC_DirName ||
               aArc == kNC_Child ||
               aArc == kNC_DirUri ||
               aArc == kNC_IsMailList ||
               aArc == kNC_IsRemote ||
               aArc == kNC_IsSecure ||
               aArc == kNC_IsWriteable ||
               aArc == kNC_DirTreeNameSort ||
               aArc == kNC_SupportsMailingLists);
  }
  else {
    *result = PR_FALSE;
  }
  return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryDataSource::ArcLabelsOut(nsIRDFResource* source,
                                                 nsISimpleEnumerator** labels)
{
  nsresult rv;

  nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(source, &rv));
  if (NS_SUCCEEDED(rv)) {
    // Initialise with the number of items below, to save reallocating on each
    // addition.
    nsCOMArray<nsIRDFResource> arcs(9);

    arcs.AppendObject(kNC_DirName);
    arcs.AppendObject(kNC_Child);
    arcs.AppendObject(kNC_DirUri);
    arcs.AppendObject(kNC_IsMailList);
    arcs.AppendObject(kNC_IsRemote);
    arcs.AppendObject(kNC_IsSecure);
    arcs.AppendObject(kNC_IsWriteable);
    arcs.AppendObject(kNC_DirTreeNameSort);
    arcs.AppendObject(kNC_SupportsMailingLists);

    return NS_NewArrayEnumerator(labels, arcs);
  }
  return NS_NewEmptyEnumerator(labels);
}

NS_IMETHODIMP nsAbDirectoryDataSource::OnItemAdded(nsISupports *parentDirectory, nsISupports *item)
{
  nsresult rv;
  nsCOMPtr<nsIAbDirectory> directory;
  nsCOMPtr<nsIRDFResource> parentResource;

  if(NS_SUCCEEDED(parentDirectory->QueryInterface(NS_GET_IID(nsIRDFResource), getter_AddRefs(parentResource))))
  {
    //If we are adding a directory
    if (NS_SUCCEEDED(item->QueryInterface(NS_GET_IID(nsIAbDirectory), getter_AddRefs(directory))))
    {
      nsCOMPtr<nsIRDFNode> itemNode(do_QueryInterface(item, &rv));
      if(NS_SUCCEEDED(rv))
      {
        //Notify a directory was added.
        NotifyObservers(parentResource, kNC_Child, itemNode, PR_TRUE, PR_FALSE);
      }
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryDataSource::OnItemRemoved(nsISupports *parentDirectory, nsISupports *item)
{
  nsresult rv;
  nsCOMPtr<nsIAbDirectory> directory;
  nsCOMPtr<nsIRDFResource> parentResource;

  if(NS_SUCCEEDED(parentDirectory->QueryInterface(NS_GET_IID(nsIRDFResource), getter_AddRefs(parentResource))))
  {
    //If we are removing a directory
    if (NS_SUCCEEDED(item->QueryInterface(NS_GET_IID(nsIAbDirectory), getter_AddRefs(directory))))
    {
      nsCOMPtr<nsIRDFNode> itemNode(do_QueryInterface(item, &rv));
      if(NS_SUCCEEDED(rv))
      {
        //Notify a directory was deleted.
        NotifyObservers(parentResource, kNC_Child, itemNode, PR_FALSE, PR_FALSE);
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsAbDirectoryDataSource::OnItemPropertyChanged(nsISupports *item, const char *property,
                               const PRUnichar *oldValue, const PRUnichar *newValue)

{
  nsresult rv;
  nsCOMPtr<nsIRDFResource> resource(do_QueryInterface(item, &rv));

  if (NS_SUCCEEDED(rv))
  {
    if (strcmp("DirName", property) == 0)
    {
      NotifyPropertyChanged(resource, kNC_DirName, oldValue, newValue);
    }
    else if (strcmp("IsSecure", property) == 0)
    {
      NotifyPropertyChanged(resource, kNC_IsSecure, oldValue, newValue);
    }
  }
  return NS_OK;
}

nsresult nsAbDirectoryDataSource::createDirectoryNode(nsIAbDirectory* directory,
                                                 nsIRDFResource* property,
                                                 nsIRDFNode** target)
{
  nsresult rv = NS_RDF_NO_VALUE;

  if ((kNC_DirName == property))
    rv = createDirectoryNameNode(directory, target);
  else if ((kNC_DirUri == property))
    rv = createDirectoryUriNode(directory, target);
  else if ((kNC_Child == property))
    rv = createDirectoryChildNode(directory, target);
  else if ((kNC_IsMailList == property))
    rv = createDirectoryIsMailListNode(directory, target);
  else if ((kNC_IsRemote == property))
    rv = createDirectoryIsRemoteNode(directory, target);
  else if ((kNC_IsSecure == property))
    rv = createDirectoryIsSecureNode(directory, target);
  else if ((kNC_IsWriteable == property))
    rv = createDirectoryIsWriteableNode(directory, target);
  else if ((kNC_DirTreeNameSort == property))
    rv = createDirectoryTreeNameSortNode(directory, target);
  else if ((kNC_SupportsMailingLists == property))
    rv = createDirectorySupportsMailingListsNode(directory, target);
  return rv;
}


nsresult nsAbDirectoryDataSource::createDirectoryNameNode(nsIAbDirectory *directory,
                                                     nsIRDFNode **target)
{
  nsString name;
  nsresult rv = directory->GetDirName(name);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = createNode(name.get(), target);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

nsresult nsAbDirectoryDataSource::createDirectoryUriNode(nsIAbDirectory *directory,
                                                     nsIRDFNode **target)
{
  nsCOMPtr<nsIRDFResource> source(do_QueryInterface(directory));

  nsCString uri;
  nsresult rv = source->GetValue(getter_Copies(uri));
  NS_ENSURE_SUCCESS(rv, rv);
  nsAutoString nameString;
  CopyASCIItoUTF16(uri, nameString);
  rv = createNode(nameString.get(), target);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

nsresult
nsAbDirectoryDataSource::createDirectoryChildNode(nsIAbDirectory *directory,
                                             nsIRDFNode **target)
{
  nsCOMPtr<nsIMutableArray> pAddressLists;
  directory->GetAddressLists(getter_AddRefs(pAddressLists));

  if (pAddressLists)
  {
    PRUint32 total = 0;
    pAddressLists->GetLength(&total);

    if (total)
    {
      PRBool isMailList = PR_FALSE;
      directory->GetIsMailList(&isMailList);
      if (!isMailList)
      {
        // fetch the last element
        nsCOMPtr<nsIRDFResource> mailList = do_QueryElementAt(pAddressLists, total - 1);
        NS_IF_ADDREF(*target = mailList);
      }
    } // if total
  } // if pAddressLists

  return (*target ? NS_OK : NS_RDF_NO_VALUE);
}

nsresult
nsAbDirectoryDataSource::createDirectoryIsRemoteNode(nsIAbDirectory* directory,
                                                     nsIRDFNode **target)
{
  PRBool isRemote;
  nsresult rv = directory->GetIsRemote(&isRemote);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*target = (isRemote ? kTrueLiteral : kFalseLiteral));
  return NS_OK;
}

nsresult
nsAbDirectoryDataSource::createDirectoryIsSecureNode(nsIAbDirectory* directory,
                                                     nsIRDFNode **target)
{
  PRBool IsSecure;
  nsresult rv = directory->GetIsSecure(&IsSecure);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*target = (IsSecure ? kTrueLiteral : kFalseLiteral));
  return NS_OK;
}

nsresult
nsAbDirectoryDataSource::createDirectoryIsWriteableNode(nsIAbDirectory* directory,
                                                        nsIRDFNode **target)
{
  PRBool isWriteable;
  nsresult rv = directory->GetOperations(&isWriteable);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*target = ((isWriteable & nsIAbDirectory::opWrite) ? kTrueLiteral : kFalseLiteral));
  return NS_OK;
}

nsresult
nsAbDirectoryDataSource::createDirectoryIsMailListNode(nsIAbDirectory* directory,
                                                       nsIRDFNode **target)
{
  PRBool isMailList;
  nsresult rv = directory->GetIsMailList(&isMailList);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*target = (isMailList ? kTrueLiteral : kFalseLiteral));
  return NS_OK;
}

nsresult
nsAbDirectoryDataSource::createDirectorySupportsMailingListsNode(nsIAbDirectory* directory,
                                                                 nsIRDFNode **target)
{
  PRBool supportsMailingLists;
  nsresult rv = directory->GetSupportsMailingLists(&supportsMailingLists);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*target = (supportsMailingLists ? kTrueLiteral : kFalseLiteral));
  return NS_OK;
}

nsresult
nsAbDirectoryDataSource::createDirectoryTreeNameSortNode(nsIAbDirectory* directory, nsIRDFNode **target)
{
  nsString name;
  nsresult rv = directory->GetDirName(name);
  NS_ENSURE_SUCCESS(rv, rv);

  /* sort addressbooks in this order - Personal Addressbook, Collected Addresses, MDB, LDAP -
   * by prefixing address book names with numbers and using the xul sort service.
   *
   *  0Personal Address Book
   *  1Collected Address Book
   *  2MAB1
   *    5MAB1LIST1
   *    5MAB1LIST2
   *  2MAB2
   *    5MAB2LIST1
   *    5MAB2LIST2
   *  3LDAP1
   *  3LDAP2
   *  4MAPI1
   *  4MAPI2
   */

  // Get isMailList
  PRBool isMailList = PR_FALSE;
  rv = directory->GetIsMailList(&isMailList);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString sortString;

  if (isMailList)
    // Mailing Lists don't need a top level sort position.
    sortString.AppendInt(5);
  else
  {
    // If its not a mailing list, find out what else we need to know.
    nsCOMPtr<nsIRDFResource> resource = do_QueryInterface(directory);
    const char *uri = nsnull;
    rv = resource->GetValueConst(&uri);
    NS_ENSURE_SUCCESS(rv,rv);

    // Get directory type.
    PRInt32 dirType;
    rv = directory->GetDirType(&dirType);
    NS_ENSURE_SUCCESS(rv, rv);

    PRInt32 position;
    rv = directory->GetPosition(&position);
    NS_ENSURE_SUCCESS(rv, rv);

    // top level sort will be by position. Sort by type under that...
    sortString.Append((PRUnichar) (position + 'a'));

    if (dirType == PABDirectory)
    {
      if (strcmp(uri, kPersonalAddressbookUri) == 0)
        sortString.AppendInt(0);  // Personal addrbook
      else if (strcmp(uri, kCollectedAddressbookUri) == 0)
        sortString.AppendInt(1);  // Collected addrbook
      else
        sortString.AppendInt(2);  // Normal addrbook
    }
    else if (dirType == LDAPDirectory)
      sortString.AppendInt(3);    // LDAP addrbook
    else if (dirType == MAPIDirectory)
      sortString.AppendInt(4);    // MAPI addrbook
    else
      sortString.AppendInt(6);    // everything else comes last
  }

  sortString += name;
  PRUint8 *sortKey = nsnull;
  PRUint32 sortKeyLength;
  rv = CreateCollationKey(sortString, &sortKey, &sortKeyLength);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsIRDFService> rdfService = do_GetService (NS_RDF_CONTRACTID "/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  createBlobNode(sortKey, sortKeyLength, target, rdfService);
  NS_ENSURE_SUCCESS(rv, rv);
  PR_Free(sortKey);

  return NS_OK;

}

nsresult nsAbDirectoryDataSource::CreateCollationKey(const nsString &aSource,  PRUint8 **aKey, PRUint32 *aLength)
{
  NS_ENSURE_ARG_POINTER(aKey);
  NS_ENSURE_ARG_POINTER(aLength);

  nsresult rv;
  if (!mCollationKeyGenerator)
  {
    nsCOMPtr<nsILocaleService> localeSvc = do_GetService(NS_LOCALESERVICE_CONTRACTID,&rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsILocale> locale;
    rv = localeSvc->GetApplicationLocale(getter_AddRefs(locale));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr <nsICollationFactory> factory = do_CreateInstance(NS_COLLATIONFACTORY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = factory->CreateCollation(locale, getter_AddRefs(mCollationKeyGenerator));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return mCollationKeyGenerator->AllocateRawSortKey(nsICollation::kCollationCaseInSensitive, aSource, aKey, aLength);
}

nsresult nsAbDirectoryDataSource::DoDirectoryAssert(nsIAbDirectory *directory, nsIRDFResource *property, nsIRDFNode *target)
{
  return NS_ERROR_FAILURE;
}


nsresult nsAbDirectoryDataSource::DoDirectoryHasAssertion(nsIAbDirectory *directory, nsIRDFResource *property, nsIRDFNode *target,
                           PRBool tv, PRBool *hasAssertion)
{
  nsresult rv = NS_OK;
  if (!hasAssertion)
    return NS_ERROR_NULL_POINTER;

  //We're not keeping track of negative assertions on directory.
  if (!tv)
  {
    *hasAssertion = PR_FALSE;
    return NS_OK;
  }

  if ((kNC_Child == property))
  {
    nsCOMPtr<nsIAbDirectory> newDirectory(do_QueryInterface(target, &rv));
    if(NS_SUCCEEDED(rv))
      rv = directory->HasDirectory(newDirectory, hasAssertion);
  }
  else if ((kNC_IsMailList == property) || (kNC_IsRemote == property) ||
            (kNC_IsSecure == property) || (kNC_IsWriteable == property) ||
            (kNC_SupportsMailingLists == property))
  {
    nsCOMPtr<nsIRDFResource> dirResource(do_QueryInterface(directory, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = GetTargetHasAssertion(this, dirResource, property, tv, target, hasAssertion);
  }
  else
    *hasAssertion = PR_FALSE;

  return rv;

}

nsresult nsAbDirectoryDataSource::GetTargetHasAssertion(nsIRDFDataSource *dataSource, nsIRDFResource* dirResource,
                 nsIRDFResource *property,PRBool tv, nsIRDFNode *target,PRBool* hasAssertion)
{
  nsresult rv;
  if(!hasAssertion)
    return NS_ERROR_NULL_POINTER;

  nsCOMPtr<nsIRDFNode> currentTarget;

  rv = dataSource->GetTarget(dirResource, property,tv, getter_AddRefs(currentTarget));
  if(NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIRDFLiteral> value1(do_QueryInterface(target));
    nsCOMPtr<nsIRDFLiteral> value2(do_QueryInterface(currentTarget));
    if(value1 && value2)
      //If the two values are equal then it has this assertion
      *hasAssertion = (value1 == value2);
  }
  else
    rv = NS_NOINTERFACE;

  return rv;

}
