/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * RDF datasource for the account manager
 */

#include "nsMsgAccountManagerDS.h"
#include "rdf.h"
#include "nsRDFCID.h"
#include "nsIRDFDataSource.h"
#include "nsEnumeratorUtils.h"
#include "nsIServiceManager.h"
#include "nsMsgRDFUtils.h"
#include "nsIMsgFolder.h"
#include "nsMsgBaseCID.h"

#include "nsICategoryManager.h"
#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsArrayEnumerator.h"
#include "nsMsgUtils.h"
#include "mozilla/Services.h"

// turn this on to see useful output
#undef DEBUG_amds

#define NC_RDF_PAGETITLE_PREFIX               NC_NAMESPACE_URI "PageTitle"
#define NC_RDF_PAGETITLE_MAIN                 NC_RDF_PAGETITLE_PREFIX "Main"
#define NC_RDF_PAGETITLE_SERVER               NC_RDF_PAGETITLE_PREFIX "Server"
#define NC_RDF_PAGETITLE_COPIES               NC_RDF_PAGETITLE_PREFIX "Copies"
#define NC_RDF_PAGETITLE_SYNCHRONIZATION      NC_RDF_PAGETITLE_PREFIX "Synchronization"
#define NC_RDF_PAGETITLE_DISKSPACE            NC_RDF_PAGETITLE_PREFIX "DiskSpace"
#define NC_RDF_PAGETITLE_ADDRESSING           NC_RDF_PAGETITLE_PREFIX "Addressing"
#define NC_RDF_PAGETITLE_SMTP                 NC_RDF_PAGETITLE_PREFIX "SMTP"
#define NC_RDF_PAGETITLE_JUNK                 NC_RDF_PAGETITLE_PREFIX "Junk"
#define NC_RDF_PAGETAG NC_NAMESPACE_URI "PageTag"


#define NC_RDF_ACCOUNTROOT "msgaccounts:/"

typedef struct _serverCreationParams {
  nsCOMArray<nsIRDFResource> *serverArray;
  nsIRDFService *rdfService;
} serverCreationParams;

typedef struct {
  nsCString serverKey;
  bool found;
} findServerByKeyEntry;

// the root resource (msgaccounts:/)
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_AccountRoot=nullptr;

// attributes of accounts
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_Name=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_FolderTreeName=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_FolderTreeSimpleName=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_NameSort=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_FolderTreeNameSort=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTag=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_IsDefaultServer=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_SupportsFilters=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_CanGetMessages=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_CanGetIncomingMessages=nullptr;

// containment
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_Child=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_Settings=nullptr;


// properties corresponding to interfaces
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_Account=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_Server=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_Identity=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_Junk=nullptr;

// individual pages
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleMain=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleServer=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleCopies=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleSynchronization=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleDiskSpace=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleAddressing=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleSMTP=nullptr;
nsIRDFResource* nsMsgAccountManagerDataSource::kNC_PageTitleJunk=nullptr;

// common literals
nsIRDFLiteral* nsMsgAccountManagerDataSource::kTrueLiteral = nullptr;

nsIAtom* nsMsgAccountManagerDataSource::kDefaultServerAtom = nullptr;

nsrefcnt nsMsgAccountManagerDataSource::gAccountManagerResourceRefCnt = 0;

// shared arc lists
nsCOMPtr<nsIMutableArray> nsMsgAccountManagerDataSource::mAccountArcsOut;
nsCOMPtr<nsIMutableArray> nsMsgAccountManagerDataSource::mAccountRootArcsOut;


// RDF to match
#define NC_RDF_ACCOUNT NC_NAMESPACE_URI "Account"
#define NC_RDF_SERVER  NC_NAMESPACE_URI "Server"
#define NC_RDF_IDENTITY NC_NAMESPACE_URI "Identity"
#define NC_RDF_SETTINGS NC_NAMESPACE_URI "Settings"
#define NC_RDF_JUNK NC_NAMESPACE_URI "Junk"
#define NC_RDF_ISDEFAULTSERVER NC_NAMESPACE_URI "IsDefaultServer"
#define NC_RDF_SUPPORTSFILTERS NC_NAMESPACE_URI "SupportsFilters"
#define NC_RDF_CANGETMESSAGES NC_NAMESPACE_URI "CanGetMessages"
#define NC_RDF_CANGETINCOMINGMESSAGES NC_NAMESPACE_URI "CanGetIncomingMessages"

nsMsgAccountManagerDataSource::nsMsgAccountManagerDataSource()
{
#ifdef DEBUG_amds
  printf("nsMsgAccountManagerDataSource() being created\n");
#endif

  // do per-class initialization here
  if (gAccountManagerResourceRefCnt++ == 0) {
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_CHILD), &kNC_Child);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_NAME), &kNC_Name);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_FOLDERTREENAME),
                                 &kNC_FolderTreeName);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_FOLDERTREESIMPLENAME),
                                 &kNC_FolderTreeSimpleName);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_NAME_SORT), &kNC_NameSort);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_FOLDERTREENAME_SORT),
                                 &kNC_FolderTreeNameSort);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETAG), &kNC_PageTag);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_ISDEFAULTSERVER),
                                 &kNC_IsDefaultServer);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_SUPPORTSFILTERS),
                                 &kNC_SupportsFilters);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_CANGETMESSAGES),
                                 &kNC_CanGetMessages);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_CANGETINCOMINGMESSAGES),
                                 &kNC_CanGetIncomingMessages);

    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_ACCOUNT), &kNC_Account);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_SERVER), &kNC_Server);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_IDENTITY), &kNC_Identity);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_JUNK), &kNC_Junk);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_MAIN),
                                 &kNC_PageTitleMain);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_SERVER),
                                 &kNC_PageTitleServer);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_COPIES),
                                 &kNC_PageTitleCopies);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_SYNCHRONIZATION),
                                 &kNC_PageTitleSynchronization);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_DISKSPACE),
                                 &kNC_PageTitleDiskSpace);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_ADDRESSING),
                                 &kNC_PageTitleAddressing);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_SMTP),
                                 &kNC_PageTitleSMTP);
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_PAGETITLE_JUNK),
                                 &kNC_PageTitleJunk);

    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_ACCOUNTROOT),
                                 &kNC_AccountRoot);

    getRDFService()->GetLiteral(NS_LITERAL_STRING("true").get(),
                                &kTrueLiteral);

    // eventually these need to exist in some kind of array
    // that's easily extensible
    getRDFService()->GetResource(NS_LITERAL_CSTRING(NC_RDF_SETTINGS), &kNC_Settings);

    kDefaultServerAtom = MsgNewAtom("DefaultServer");
  }
}

nsMsgAccountManagerDataSource::~nsMsgAccountManagerDataSource()
{
  nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager);
  if (am)
    am->RemoveIncomingServerListener(this);

  if (--gAccountManagerResourceRefCnt == 0) {
    NS_IF_RELEASE(kNC_Child);
    NS_IF_RELEASE(kNC_Name);
    NS_IF_RELEASE(kNC_FolderTreeName);
    NS_IF_RELEASE(kNC_FolderTreeSimpleName);
    NS_IF_RELEASE(kNC_NameSort);
    NS_IF_RELEASE(kNC_FolderTreeNameSort);
    NS_IF_RELEASE(kNC_PageTag);
    NS_IF_RELEASE(kNC_IsDefaultServer);
    NS_IF_RELEASE(kNC_SupportsFilters);
    NS_IF_RELEASE(kNC_CanGetMessages);
    NS_IF_RELEASE(kNC_CanGetIncomingMessages);
    NS_IF_RELEASE(kNC_Account);
    NS_IF_RELEASE(kNC_Server);
    NS_IF_RELEASE(kNC_Identity);
    NS_IF_RELEASE(kNC_Junk);
    NS_IF_RELEASE(kNC_PageTitleMain);
    NS_IF_RELEASE(kNC_PageTitleServer);
    NS_IF_RELEASE(kNC_PageTitleCopies);
    NS_IF_RELEASE(kNC_PageTitleSynchronization);
    NS_IF_RELEASE(kNC_PageTitleDiskSpace);
    NS_IF_RELEASE(kNC_PageTitleAddressing);
    NS_IF_RELEASE(kNC_PageTitleSMTP);
    NS_IF_RELEASE(kNC_PageTitleJunk);
    NS_IF_RELEASE(kTrueLiteral);

    NS_IF_RELEASE(kNC_AccountRoot);

    // eventually these need to exist in some kind of array
    // that's easily extensible
    NS_IF_RELEASE(kNC_Settings);


    NS_IF_RELEASE(kDefaultServerAtom);
    mAccountArcsOut = nullptr;
    mAccountRootArcsOut = nullptr;
  }

}

NS_IMPL_ADDREF_INHERITED(nsMsgAccountManagerDataSource, nsMsgRDFDataSource)
NS_IMPL_RELEASE_INHERITED(nsMsgAccountManagerDataSource, nsMsgRDFDataSource)
NS_INTERFACE_MAP_BEGIN(nsMsgAccountManagerDataSource)
  NS_INTERFACE_MAP_ENTRY(nsIIncomingServerListener)
  NS_INTERFACE_MAP_ENTRY(nsIFolderListener)
NS_INTERFACE_MAP_END_INHERITING(nsMsgRDFDataSource)

nsresult
nsMsgAccountManagerDataSource::Init()
{
  nsresult rv;

  rv = nsMsgRDFDataSource::Init();
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIMsgAccountManager> am;

  // get a weak ref to the account manager
  if (!mAccountManager) 
  {
    am = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    mAccountManager = do_GetWeakReference(am);
  }
  else
    am = do_QueryReferent(mAccountManager);

  if (am) 
  {
    am->AddIncomingServerListener(this);
    am->AddRootFolderListener(this);
  }


  return NS_OK;
}

void nsMsgAccountManagerDataSource::Cleanup()
{
  nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager);

  if (am)
  {
    am->RemoveIncomingServerListener(this);
    am->RemoveRootFolderListener(this);
  }

  nsMsgRDFDataSource::Cleanup();
}

/* nsIRDFNode GetTarget (in nsIRDFResource aSource, in nsIRDFResource property, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgAccountManagerDataSource::GetTarget(nsIRDFResource *source,
                                         nsIRDFResource *property,
                                         bool aTruthValue,
                                         nsIRDFNode **target)
{
  nsresult rv;


  rv = NS_RDF_NO_VALUE;

  nsAutoString str;
  if (property == kNC_Name || property == kNC_FolderTreeName ||
      property == kNC_FolderTreeSimpleName) 
  {
    rv = getStringBundle();
    NS_ENSURE_SUCCESS(rv, rv);

    nsString pageTitle;
    if (source == kNC_PageTitleServer)
      mStringBundle->GetStringFromName(NS_LITERAL_STRING("prefPanel-server").get(),
                                       getter_Copies(pageTitle));

    else if (source == kNC_PageTitleCopies)
      mStringBundle->GetStringFromName(NS_LITERAL_STRING("prefPanel-copies").get(),
                                       getter_Copies(pageTitle));
    else if (source == kNC_PageTitleSynchronization)
      mStringBundle->GetStringFromName(NS_LITERAL_STRING("prefPanel-synchronization").get(),
                                       getter_Copies(pageTitle));
    else if (source == kNC_PageTitleDiskSpace)
      mStringBundle->GetStringFromName(NS_LITERAL_STRING("prefPanel-diskspace").get(),
                                       getter_Copies(pageTitle));
    else if (source == kNC_PageTitleAddressing)
      mStringBundle->GetStringFromName(NS_LITERAL_STRING("prefPanel-addressing").get(),
                                       getter_Copies(pageTitle));
    else if (source == kNC_PageTitleSMTP)
      mStringBundle->GetStringFromName(NS_LITERAL_STRING("prefPanel-smtp").get(),
                                       getter_Copies(pageTitle));
    else if (source == kNC_PageTitleJunk)
      mStringBundle->GetStringFromName(NS_LITERAL_STRING("prefPanel-junk").get(),
                                       getter_Copies(pageTitle));

    else {
      // if it's a server, use the pretty name
      nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(source, &rv);
      if (NS_SUCCEEDED(rv) && folder) {
        bool isServer;
        rv = folder->GetIsServer(&isServer);
        if (NS_SUCCEEDED(rv) && isServer)
          rv = folder->GetPrettyName(pageTitle);
      }
      else {
        // allow for the accountmanager to be dynamically extended.

        nsCOMPtr<nsIStringBundleService> strBundleService =
          mozilla::services::GetStringBundleService();
        NS_ENSURE_TRUE(strBundleService, NS_ERROR_UNEXPECTED);

        const char *sourceValue;
        rv = source->GetValueConst(&sourceValue);
        NS_ENSURE_SUCCESS(rv,rv);

        // make sure the pointer math we're about to do is safe.
        NS_ENSURE_TRUE(sourceValue && (strlen(sourceValue) > strlen(NC_RDF_PAGETITLE_PREFIX)), NS_ERROR_UNEXPECTED);

        nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager, &rv);
        NS_ENSURE_SUCCESS(rv, rv);

        // turn NC#PageTitlefoobar into foobar, so we can get the am-foobar.properties bundle
        nsCString chromePackageName;
        rv = am->GetChromePackageName(nsCString(sourceValue + strlen(NC_RDF_PAGETITLE_PREFIX)), chromePackageName);
        NS_ENSURE_SUCCESS(rv,rv);

        nsAutoCString bundleURL;
        bundleURL = "chrome://";
        bundleURL += chromePackageName;
        bundleURL += "/locale/am-";
        bundleURL += (sourceValue + strlen(NC_RDF_PAGETITLE_PREFIX));
        bundleURL += ".properties";

        nsCOMPtr <nsIStringBundle> bundle;
        rv = strBundleService->CreateBundle(bundleURL.get(), getter_AddRefs(bundle));

        NS_ENSURE_SUCCESS(rv,rv);

        nsAutoString panelTitleName;
        panelTitleName.AssignLiteral("prefPanel-");
        panelTitleName.Append(NS_ConvertASCIItoUTF16(sourceValue + strlen(NC_RDF_PAGETITLE_PREFIX)));
        bundle->GetStringFromName(panelTitleName.get(), getter_Copies(pageTitle));
      }
    }
    str = pageTitle.get();
  }
  else if (property == kNC_PageTag) {
    // do NOT localize these strings. these are the urls of the XUL files
    if (source == kNC_PageTitleServer)
      str.AssignLiteral("am-server.xul");
    else if (source == kNC_PageTitleCopies)
      str.AssignLiteral("am-copies.xul");
    else if ((source == kNC_PageTitleSynchronization) ||
             (source == kNC_PageTitleDiskSpace))
      str.AssignLiteral("am-offline.xul");
    else if (source == kNC_PageTitleAddressing)
      str.AssignLiteral("am-addressing.xul");
    else if (source == kNC_PageTitleSMTP)
      str.AssignLiteral("am-smtp.xul");
    else if (source == kNC_PageTitleJunk)
      str.AssignLiteral("am-junk.xul");
    else {
      nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(source, &rv);
      if (NS_SUCCEEDED(rv) && folder) {
        /* if this is a server, with no identities, then we show a special panel */
        nsCOMPtr<nsIMsgIncomingServer> server;
        rv = getServerForFolderNode(source, getter_AddRefs(server));
        if (server)
          server->GetAccountManagerChrome(str);
        else 
          str.AssignLiteral("am-main.xul");
      }
      else {
        // allow for the accountmanager to be dynamically extended
        const char *sourceValue;
        rv = source->GetValueConst(&sourceValue);
        NS_ENSURE_SUCCESS(rv,rv);

        // make sure the pointer math we're about to do is safe.
        NS_ENSURE_TRUE(sourceValue && (strlen(sourceValue) > strlen(NC_RDF_PAGETITLE_PREFIX)), NS_ERROR_UNEXPECTED);

        // turn NC#PageTitlefoobar into foobar, so we can get the am-foobar.xul file
        str.AssignLiteral("am-");
        str.Append(NS_ConvertASCIItoUTF16(sourceValue + strlen(NC_RDF_PAGETITLE_PREFIX)));
        str.AppendLiteral(".xul");
      }
    }
  }

  // handle sorting of servers
  else if ((property == kNC_NameSort) ||
           (property == kNC_FolderTreeNameSort)) {

    // order for the folder pane
    // and for the account manager tree is:
    //
    // - default mail account
    // - <other mail accounts>
    // - "Local Folders" account
    // - news accounts
    // - smtp settings (note, this is only in account manager tree)

    // make sure we're handling a root folder that is a server
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = getServerForFolderNode(source, getter_AddRefs(server));

    if (NS_SUCCEEDED(rv) && server) {
      int32_t accountNum;
      nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager);

      if (isDefaultServer(server))
        str.AssignLiteral("000000000");
      else {
        rv = am->GetSortOrder(server, &accountNum);
        NS_ENSURE_SUCCESS(rv, rv);
        str.AppendInt(accountNum);
      }
    }
    else {
      const char *sourceValue;
      rv = source->GetValueConst(&sourceValue);
      NS_ENSURE_SUCCESS(rv, NS_RDF_NO_VALUE);

      // if this is a page (which we determine by the prefix of the URI)
      // we want to generate a sort value
      // so that we can sort the categories in the account manager tree
      // (or the folder pane)
      //
      // otherwise, return NS_RDF_NO_VALUE
      // so that the folder data source will take care of it.
      if (sourceValue && (strncmp(sourceValue, NC_RDF_PAGETITLE_PREFIX, strlen(NC_RDF_PAGETITLE_PREFIX)) == 0)) {
        if (source == kNC_PageTitleSMTP)
          str.AssignLiteral("900000000");
        else if (source == kNC_PageTitleServer)
          str.AssignLiteral("1");
        else if (source == kNC_PageTitleCopies)
          str.AssignLiteral("2");
        else if (source == kNC_PageTitleAddressing)
          str.AssignLiteral("3");
        else if (source == kNC_PageTitleSynchronization)
          str.AssignLiteral("4");
        else if (source == kNC_PageTitleDiskSpace)
          str.AssignLiteral("4");
        else if (source == kNC_PageTitleJunk)
          str.AssignLiteral("5");
        else {
          // allow for the accountmanager to be dynamically extended
          // all the other pages come after the standard ones
          // server, copies, addressing, disk space (or offline & disk space)
          CopyASCIItoUTF16(nsDependentCString(sourceValue), str);
        }
      }
      else {
        return NS_RDF_NO_VALUE;
      }
    }
  }

  // GetTargets() stuff - need to return a valid answer so that
  // twisties will appear
  else if (property == kNC_Settings) {
    nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(source,&rv);
    if (NS_FAILED(rv))
      return NS_RDF_NO_VALUE;

    bool isServer=false;
    folder->GetIsServer(&isServer);
    // no need to localize this!
    if (isServer)
      str.AssignLiteral("ServerSettings");
  }

  else if (property == kNC_IsDefaultServer) {
    nsCOMPtr<nsIMsgIncomingServer> thisServer;
    rv = getServerForFolderNode(source, getter_AddRefs(thisServer));
    if (NS_FAILED(rv) || !thisServer) return NS_RDF_NO_VALUE;

    if (isDefaultServer(thisServer))
      str.AssignLiteral("true");
  }

  else if (property == kNC_SupportsFilters) {
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = getServerForFolderNode(source, getter_AddRefs(server));
    if (NS_FAILED(rv) || !server) return NS_RDF_NO_VALUE;

    if (supportsFilters(server))
      str.AssignLiteral("true");
  }
  else if (property == kNC_CanGetMessages) {
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = getServerForFolderNode(source, getter_AddRefs(server));
    if (NS_FAILED(rv) || !server) return NS_RDF_NO_VALUE;

    if (canGetMessages(server))
      str.AssignLiteral("true");
  }
  else if (property == kNC_CanGetIncomingMessages) {
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = getServerForFolderNode(source, getter_AddRefs(server));
    if (NS_FAILED(rv) || !server) return NS_RDF_NO_VALUE;

    if (canGetIncomingMessages(server))
      str.AssignLiteral("true");
  }

  if (!str.IsEmpty())
    rv = createNode(str.get(), target, getRDFService());

  //if we have an empty string and we don't have an error value, then
  //we don't have a value for RDF.
  else if(NS_SUCCEEDED(rv))
    rv = NS_RDF_NO_VALUE;

  return rv;
}



/* nsISimpleEnumerator GetTargets (in nsIRDFResource aSource, in nsIRDFResource property, in boolean aTruthValue); */
NS_IMETHODIMP
nsMsgAccountManagerDataSource::GetTargets(nsIRDFResource *source,
                                          nsIRDFResource *property,
                                          bool aTruthValue,
                                          nsISimpleEnumerator **_retval)
{
  nsresult rv = NS_RDF_NO_VALUE;

  // create array and enumerator
  // even if we're not handling this we need to return something empty?
  nsCOMArray<nsIRDFResource> nodes;
  if (NS_FAILED(rv)) return rv;
  if (source == kNC_AccountRoot)
    rv = createRootResources(property, &nodes);
  else if (property == kNC_Settings)
    rv = createSettingsResources(source, &nodes);

  if (NS_FAILED(rv))
    return NS_RDF_NO_VALUE;
  return NS_NewArrayEnumerator(_retval, nodes);
}

// end of all arcs coming out of msgaccounts:/
nsresult
nsMsgAccountManagerDataSource::createRootResources(nsIRDFResource *property,
                                                   nsCOMArray<nsIRDFResource> *aNodeArray)
{
  nsresult rv = NS_OK;
  if (isContainment(property)) {

    nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager);
    if (!am) return NS_ERROR_FAILURE;

    nsCOMPtr<nsISupportsArray> servers;
    rv = am->GetAllServers(getter_AddRefs(servers));
    if (NS_FAILED(rv)) return rv;

    // fill up the nodes array with the RDF Resources for the servers
    serverCreationParams params = { aNodeArray, getRDFService() };
    servers->EnumerateForwards(createServerResources, (void*)&params);
#ifdef DEBUG_amds
    uint32_t nodecount;
    aNodeArray->GetLength(&nodecount);
    printf("GetTargets(): added %d servers on %s\n", nodecount,
           (const char*)property_arc);
#endif
    // For the "settings" arc, we also want to add SMTP setting.
    if (property == kNC_Settings) {
      aNodeArray->AppendObject(kNC_PageTitleSMTP);
    }
  }

#ifdef DEBUG_amds
  else {
    printf("unknown arc %s on msgaccounts:/\n", (const char*)property_arc);
  }
#endif

  return rv;
}

nsresult
nsMsgAccountManagerDataSource::appendGenericSettingsResources(nsIMsgIncomingServer *server, nsCOMArray<nsIRDFResource> *aNodeArray)
{
  nsresult rv;

  nsCOMPtr<nsICategoryManager> catman = do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsISimpleEnumerator> e;
  rv = catman->EnumerateCategory(MAILNEWS_ACCOUNTMANAGER_EXTENSIONS, getter_AddRefs(e));
  if(NS_SUCCEEDED(rv) && e) {
    while (true) {
      nsCOMPtr<nsISupportsCString> catEntry;
      rv = e->GetNext(getter_AddRefs(catEntry));
      if (NS_FAILED(rv) || !catEntry)
        break;

      nsAutoCString entryString;
      rv = catEntry->GetData(entryString);
      if (NS_FAILED(rv))
        break;

      nsCString contractidString;
      rv = catman->GetCategoryEntry(MAILNEWS_ACCOUNTMANAGER_EXTENSIONS, entryString.get(), getter_Copies(contractidString));
      if (NS_FAILED(rv))
        break;

      nsCOMPtr <nsIMsgAccountManagerExtension> extension =
        do_GetService(contractidString.get(), &rv);
      if (NS_FAILED(rv) || !extension)
        break;

      bool showPanel;
      rv = extension->ShowPanel(server, &showPanel);
      if (NS_FAILED(rv))
        break;

      if (showPanel) {
        nsCString name;
        rv = extension->GetName(name);
        if (NS_FAILED(rv))
          break;

        rv = appendGenericSetting(name.get(), aNodeArray);
        if (NS_FAILED(rv))
          break;
      }
    }
  }
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::appendGenericSetting(const char *name,
                                                    nsCOMArray<nsIRDFResource> *aNodeArray)
{
  NS_ENSURE_ARG_POINTER(name);
  NS_ENSURE_ARG_POINTER(aNodeArray);

  nsCOMPtr <nsIRDFResource> resource;

  nsAutoCString resourceStr;
  resourceStr = NC_RDF_PAGETITLE_PREFIX;
  resourceStr += name;

  nsresult rv = getRDFService()->GetResource(resourceStr, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv,rv);

  // AppendElement will addref.
  aNodeArray->AppendObject(resource);
  return NS_OK;
}

// end of all #Settings arcs
nsresult
nsMsgAccountManagerDataSource::createSettingsResources(nsIRDFResource *aSource,
                                                       nsCOMArray<nsIRDFResource> *aNodeArray)
{
  // If this isn't a server, just return.
  if (aSource == kNC_PageTitleSMTP)
    return NS_OK;

  nsCOMPtr<nsIMsgIncomingServer> server;
  getServerForFolderNode(aSource, getter_AddRefs(server));
  if (server) {
    bool hasIdentities;
    nsresult rv = serverHasIdentities(server, &hasIdentities);

    if (hasIdentities) {
      aNodeArray->AppendObject(kNC_PageTitleServer);
      aNodeArray->AppendObject(kNC_PageTitleCopies);
      aNodeArray->AppendObject(kNC_PageTitleAddressing);
    }

    // Junk settings apply for all server types except for news and rss.
    nsCString serverType;
    server->GetType(serverType);
    if (!MsgLowerCaseEqualsLiteral(serverType, "nntp") &&
        !MsgLowerCaseEqualsLiteral(serverType, "rss"))
      aNodeArray->AppendObject(kNC_PageTitleJunk);

    // Check the offline capability before adding
    // offline item
    int32_t offlineSupportLevel = 0;
    rv = server->GetOfflineSupportLevel(&offlineSupportLevel);
    NS_ENSURE_SUCCESS(rv,rv);

    bool supportsDiskSpace;
    rv = server->GetSupportsDiskSpace(&supportsDiskSpace);
    NS_ENSURE_SUCCESS(rv,rv);

    // currently there is no offline without diskspace
    if (offlineSupportLevel >= OFFLINE_SUPPORT_LEVEL_REGULAR) 
      aNodeArray->AppendObject(kNC_PageTitleSynchronization);
    else if (supportsDiskSpace)
      aNodeArray->AppendObject(kNC_PageTitleDiskSpace);

    if (hasIdentities) {
      // extensions come after the default panels
      rv = appendGenericSettingsResources(server, aNodeArray);
      NS_ASSERTION(NS_SUCCEEDED(rv), "failed to add generic panels");
    }
  }

  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::serverHasIdentities(nsIMsgIncomingServer* aServer,
                                                   bool *aResult)
{
  nsresult rv;
  *aResult = false;

  nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager, &rv);

  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIArray> identities;
  rv = am->GetIdentitiesForServer(aServer, getter_AddRefs(identities));

  // no identities just means no arcs
  if (NS_FAILED(rv)) return NS_OK;

  uint32_t count;
  rv = identities->GetLength(&count);
  if (NS_FAILED(rv)) return NS_OK;

  if (count >0)
    *aResult = true;
  return NS_OK;
}

// enumeration function to convert each server (element)
// to an nsIRDFResource and append it to the array (in data)
// always return true to try on every element instead of aborting early
bool
nsMsgAccountManagerDataSource::createServerResources(nsISupports *element,
                                                     void *data)
{
  nsresult rv;
  // get parameters out of the data argument
  serverCreationParams *params = (serverCreationParams*)data;
  nsCOMArray<nsIRDFResource> *servers = params->serverArray;
  nsCOMPtr<nsIRDFService> rdf = params->rdfService;

  // the server itself is in the element argument
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(element, &rv);
  if (NS_FAILED(rv)) return true;

  nsCOMPtr <nsIMsgFolder> serverFolder;
  rv = server->GetRootFolder(getter_AddRefs(serverFolder));
  if(NS_FAILED(rv)) return true;

  // add the resource to the array
  nsCOMPtr<nsIRDFResource> serverResource = do_QueryInterface(serverFolder);
  if(serverResource)
    (void) servers->AppendObject(serverResource);
  return true;
}

nsresult
nsMsgAccountManagerDataSource::getAccountArcs(nsIMutableArray **aResult)
{
  nsresult rv;
  if (!mAccountArcsOut) {
    mAccountArcsOut = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    mAccountArcsOut->AppendElement(kNC_Settings, false);
    mAccountArcsOut->AppendElement(kNC_Name, false);
    mAccountArcsOut->AppendElement(kNC_FolderTreeName, false);
    mAccountArcsOut->AppendElement(kNC_FolderTreeSimpleName, false);
    mAccountArcsOut->AppendElement(kNC_NameSort, false);
    mAccountArcsOut->AppendElement(kNC_FolderTreeNameSort, false);
    mAccountArcsOut->AppendElement(kNC_PageTag, false);
  }

  *aResult = mAccountArcsOut;
  NS_IF_ADDREF(*aResult);
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::getAccountRootArcs(nsIMutableArray **aResult)
{
  nsresult rv;
  if (!mAccountRootArcsOut) {
    mAccountRootArcsOut = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    mAccountRootArcsOut->AppendElement(kNC_Server, false);
    mAccountRootArcsOut->AppendElement(kNC_Child, false);

    mAccountRootArcsOut->AppendElement(kNC_Settings, false);
    mAccountRootArcsOut->AppendElement(kNC_Name, false);
    mAccountRootArcsOut->AppendElement(kNC_FolderTreeName, false);
    mAccountRootArcsOut->AppendElement(kNC_FolderTreeSimpleName, false);
    mAccountRootArcsOut->AppendElement(kNC_NameSort, false);
    mAccountRootArcsOut->AppendElement(kNC_FolderTreeNameSort, false);
    mAccountRootArcsOut->AppendElement(kNC_PageTag, false);
  }

  *aResult = mAccountRootArcsOut;
  NS_IF_ADDREF(*aResult);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManagerDataSource::HasArcOut(nsIRDFResource *source, nsIRDFResource *aArc, bool *result)
{
  if (aArc == kNC_Settings) {
    // based on createSettingsResources()
    // we only have settings for local folders and servers with identities
    nsCOMPtr<nsIMsgIncomingServer> server;
    nsresult rv = getServerForFolderNode(source, getter_AddRefs(server));
    if (NS_SUCCEEDED(rv) && server) {
      // Check the offline capability before adding arc
      int32_t offlineSupportLevel = 0;
      (void) server->GetOfflineSupportLevel(&offlineSupportLevel);
      if (offlineSupportLevel >= OFFLINE_SUPPORT_LEVEL_REGULAR) {
        *result = true;
        return NS_OK;
      }

      bool supportsDiskSpace;
      (void) server->GetSupportsDiskSpace(&supportsDiskSpace);
      if (supportsDiskSpace) {
        *result = true;
        return NS_OK;
      }
      return serverHasIdentities(server, result);
    }
  }

  *result = false;
  return NS_OK;
}

/* nsISimpleEnumerator ArcLabelsOut (in nsIRDFResource aSource); */
NS_IMETHODIMP
nsMsgAccountManagerDataSource::ArcLabelsOut(nsIRDFResource *source,
                                            nsISimpleEnumerator **_retval)
{
  nsresult rv;

  // we have to return something, so always create the array/enumerators
  nsCOMPtr<nsIMutableArray> arcs;
  if (source == kNC_AccountRoot)
    rv = getAccountRootArcs(getter_AddRefs(arcs));
  else
    rv = getAccountArcs(getter_AddRefs(arcs));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = NS_NewArrayEnumerator(_retval, arcs);
  if (NS_FAILED(rv)) return rv;

#ifdef DEBUG_amds_
  printf("GetArcLabelsOut(%s): Adding child, settings, and name arclabels\n", value);
#endif

  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManagerDataSource::HasAssertion(nsIRDFResource *aSource,
                                            nsIRDFResource *aProperty,
                                            nsIRDFNode *aTarget,
                                            bool aTruthValue,
                                            bool *_retval)
{
  nsresult rv=NS_ERROR_FAILURE;

  //
  // msgaccounts:/ properties
  //
  if (aSource == kNC_AccountRoot) {
    rv = HasAssertionAccountRoot(aProperty, aTarget, aTruthValue, _retval);
  }
  //
  // server properties
  //   try to convert the resource to a folder, and then only
  //   answer if it's a server.. any failure falls through to the default case
  //
  // short-circuit on property, so objects like filters, etc, don't get queried
  else if (aProperty == kNC_IsDefaultServer || aProperty == kNC_CanGetMessages ||
           aProperty == kNC_CanGetIncomingMessages || aProperty == kNC_SupportsFilters) {
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = getServerForFolderNode(aSource, getter_AddRefs(server));
    if (NS_SUCCEEDED(rv) && server)
      rv = HasAssertionServer(server, aProperty, aTarget,
                              aTruthValue, _retval);
  }

  // any failures above fallthrough to the parent class
  if (NS_FAILED(rv))
    return nsMsgRDFDataSource::HasAssertion(aSource, aProperty,
                                            aTarget, aTruthValue, _retval);
  return NS_OK;
}



nsresult
nsMsgAccountManagerDataSource::HasAssertionServer(nsIMsgIncomingServer *aServer,
                                                  nsIRDFResource *aProperty,
                                                  nsIRDFNode *aTarget,
                                                  bool aTruthValue,
                                                  bool *_retval)
{
  if (aProperty == kNC_IsDefaultServer)
    *_retval = (aTarget == kTrueLiteral) ? isDefaultServer(aServer) : !isDefaultServer(aServer);
  else if (aProperty == kNC_SupportsFilters)
    *_retval = (aTarget == kTrueLiteral) ? supportsFilters(aServer) : !supportsFilters(aServer);
  else if (aProperty == kNC_CanGetMessages)
   *_retval = (aTarget == kTrueLiteral) ? canGetMessages(aServer) : !canGetMessages(aServer);
  else if (aProperty == kNC_CanGetIncomingMessages)
    *_retval = (aTarget == kTrueLiteral) ? canGetIncomingMessages(aServer) : !canGetIncomingMessages(aServer);
  else
    *_retval = false;
  return NS_OK;
}

bool
nsMsgAccountManagerDataSource::isDefaultServer(nsIMsgIncomingServer *aServer)
{
  nsresult rv;
  if (!aServer) return false;

  nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager, &rv);
  NS_ENSURE_SUCCESS(rv, false);

  nsCOMPtr<nsIMsgAccount> defaultAccount;
  rv = am->GetDefaultAccount(getter_AddRefs(defaultAccount));
  NS_ENSURE_SUCCESS(rv, false);
  if (!defaultAccount) return false;

  // in some weird case that there is no default and they asked
  // for the default
  nsCOMPtr<nsIMsgIncomingServer> defaultServer;
  rv = defaultAccount->GetIncomingServer(getter_AddRefs(defaultServer));
  NS_ENSURE_SUCCESS(rv, false);
  if (!defaultServer) return false;

  bool isEqual;
  rv = defaultServer->Equals(aServer, &isEqual);
  NS_ENSURE_SUCCESS(rv, false);

  return isEqual;
}


bool
nsMsgAccountManagerDataSource::supportsFilters(nsIMsgIncomingServer *aServer)
{
  bool supportsFilters;
  nsresult rv = aServer->GetCanHaveFilters(&supportsFilters);
  NS_ENSURE_SUCCESS(rv, false);

  return supportsFilters;
}

bool
nsMsgAccountManagerDataSource::canGetMessages(nsIMsgIncomingServer *aServer)
{
  nsCString type;
  nsresult rv = aServer->GetType(type);
  NS_ENSURE_SUCCESS(rv, false);

  nsAutoCString contractid(NS_MSGPROTOCOLINFO_CONTRACTID_PREFIX);
  contractid.Append(type);

  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo = do_GetService(contractid.get(), &rv);
  NS_ENSURE_SUCCESS(rv, false);

  bool canGetMessages = false;
  protocolInfo->GetCanGetMessages(&canGetMessages);

  return canGetMessages;
}

bool
nsMsgAccountManagerDataSource::canGetIncomingMessages(nsIMsgIncomingServer *aServer)
{
  nsCString type;
  nsresult rv = aServer->GetType(type);
  NS_ENSURE_SUCCESS(rv, false);

  nsAutoCString contractid(NS_MSGPROTOCOLINFO_CONTRACTID_PREFIX);
  contractid.Append(type);

  nsCOMPtr<nsIMsgProtocolInfo> protocolInfo = do_GetService(contractid.get(), &rv);
  NS_ENSURE_SUCCESS(rv, false);

  bool canGetIncomingMessages = false;
  protocolInfo->GetCanGetIncomingMessages(&canGetIncomingMessages);

  return canGetIncomingMessages;
}

nsresult
nsMsgAccountManagerDataSource::HasAssertionAccountRoot(nsIRDFResource *aProperty,
                                                       nsIRDFNode *aTarget,
                                                       bool aTruthValue,
                                                       bool *_retval)
{

  nsresult rv;

  // set up default
  *_retval = false;

  // for child and settings arcs, just make sure it's a valid server:
  if (isContainment(aProperty)) {

    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = getServerForFolderNode(aTarget, getter_AddRefs(server));
    if (NS_FAILED(rv) || !server) return rv;

    nsCString serverKey;
    server->GetKey(serverKey);

    nsCOMPtr<nsIMsgAccountManager> am = do_QueryReferent(mAccountManager, &rv);
    if (NS_FAILED(rv)) return rv;

    nsCOMPtr<nsISupportsArray> serverArray;
    rv = am->GetAllServers(getter_AddRefs(serverArray));
    if (NS_FAILED(rv)) return rv;

    findServerByKeyEntry entry;
    entry.serverKey = serverKey;
    entry.found = false;

    serverArray->EnumerateForwards(findServerByKey, &entry);
    (*_retval) = entry.found;
  }

  return NS_OK;
}

bool
nsMsgAccountManagerDataSource::isContainment(nsIRDFResource *aProperty)
{

  if (aProperty == kNC_Child ||
      aProperty == kNC_Settings)
    return true;
  return false;
}

// returns failure if the object is not a root server
nsresult
nsMsgAccountManagerDataSource::getServerForFolderNode(nsIRDFNode *aResource,
                                                      nsIMsgIncomingServer **aResult)
{
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(aResource, &rv);
  if (NS_SUCCEEDED(rv)) 
  {
    bool isServer;
    rv = folder->GetIsServer(&isServer);
    if (NS_SUCCEEDED(rv) && isServer) 
      return folder->GetServer(aResult);
  }
  return NS_ERROR_FAILURE;
}

bool
nsMsgAccountManagerDataSource::findServerByKey(nsISupports *aElement,
                                               void *aData)
{
  nsresult rv;
  findServerByKeyEntry *entry = (findServerByKeyEntry*)aData;

  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(aElement, &rv);
  if (NS_FAILED(rv)) return true;

  nsCString key;
  server->GetKey(key);
  if (key.Equals(entry->serverKey))
  {
    entry->found = true;
    return false;        // stop when found
  }

  return true;
}

nsresult
nsMsgAccountManagerDataSource::getStringBundle()
{
  if (mStringBundle) return NS_OK;

  nsCOMPtr<nsIStringBundleService> strBundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(strBundleService, NS_ERROR_UNEXPECTED);

  return strBundleService->CreateBundle("chrome://messenger/locale/prefs.properties",
                                      getter_AddRefs(mStringBundle));
}

NS_IMETHODIMP
nsMsgAccountManagerDataSource::OnServerLoaded(nsIMsgIncomingServer* aServer)
{
  nsCOMPtr<nsIMsgFolder> serverFolder;
  nsresult rv = aServer->GetRootFolder(getter_AddRefs(serverFolder));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIRDFResource> serverResource = do_QueryInterface(serverFolder,&rv);
  if (NS_FAILED(rv)) return rv;

  NotifyObservers(kNC_AccountRoot, kNC_Child, serverResource, nullptr, true, false);
  NotifyObservers(kNC_AccountRoot, kNC_Settings, serverResource, nullptr, true, false);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManagerDataSource::OnServerUnloaded(nsIMsgIncomingServer* aServer)
{
  nsCOMPtr<nsIMsgFolder> serverFolder;
  nsresult rv = aServer->GetRootFolder(getter_AddRefs(serverFolder));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIRDFResource> serverResource = do_QueryInterface(serverFolder,&rv);
  if (NS_FAILED(rv)) return rv;


  NotifyObservers(kNC_AccountRoot, kNC_Child, serverResource, nullptr, false, false);
  NotifyObservers(kNC_AccountRoot, kNC_Settings, serverResource, nullptr, false, false);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManagerDataSource::OnServerChanged(nsIMsgIncomingServer *server)
{
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::OnItemPropertyChanged(nsIMsgFolder *, nsIAtom *, char const *, char const *)
{
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::OnItemUnicharPropertyChanged(nsIMsgFolder *, nsIAtom *, const PRUnichar *, const PRUnichar *)
{
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::OnItemRemoved(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::OnItemPropertyFlagChanged(nsIMsgDBHdr *, nsIAtom *, uint32_t, uint32_t)
{
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::OnItemAdded(nsIMsgFolder *, nsISupports *)
{
  return NS_OK;
}


nsresult
nsMsgAccountManagerDataSource::OnItemBoolPropertyChanged(nsIMsgFolder *aItem,
                                                         nsIAtom *aProperty,
                                                         bool aOldValue,
                                                         bool aNewValue)
{
  if (aProperty == kDefaultServerAtom) {
    nsCOMPtr<nsIRDFResource> resource(do_QueryInterface(aItem));
    NotifyObservers(resource, kNC_IsDefaultServer, kTrueLiteral, nullptr, aNewValue, false);
  }
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::OnItemEvent(nsIMsgFolder *, nsIAtom *)
{
  return NS_OK;
}

nsresult
nsMsgAccountManagerDataSource::OnItemIntPropertyChanged(nsIMsgFolder *, nsIAtom *, int32_t, int32_t)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManagerDataSource::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *aData)
{
  nsMsgRDFDataSource::Observe(aSubject, aTopic, aData);

  return NS_OK;
}
