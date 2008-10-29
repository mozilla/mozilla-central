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
 *   Paul Sandoz   <paul.sandoz@sun.com>
 *   Csaba Borbola <csaba.borbola@sun.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Mark Banner <mark@standard8.demon.co.uk>
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

#include "nsIPrefService.h"
#include "nsAbBSDirectory.h"

#include "nsRDFCID.h"
#include "nsIRDFService.h"

#include "nsDirPrefs.h"
#include "nsAbBaseCID.h"
#include "nsAddrDatabase.h"
#include "nsIAbManager.h"
#include "nsIAbMDBDirectory.h"
#include "nsServiceManagerUtils.h"
#include "nsAbDirFactoryService.h"
#include "nsAbMDBDirFactory.h"
#include "nsArrayEnumerator.h"

#include "nsCRTGlue.h"

nsAbBSDirectory::nsAbBSDirectory()
: nsRDFResource(),
mInitialized(PR_FALSE)
{
  mServers.Init(13);
}

nsAbBSDirectory::~nsAbBSDirectory()
{
}

NS_IMPL_ISUPPORTS_INHERITED1(nsAbBSDirectory, nsRDFResource, nsIAbDirectory)

nsresult nsAbBSDirectory::CreateDirectoriesFromFactory(const nsACString &aURI,
                                                       DIR_Server *aServer,
                                                       PRBool aNotify)
{
  nsresult rv;

  // Get the directory factory service
  nsCOMPtr<nsIAbDirFactoryService> dirFactoryService = 
    do_GetService(NS_ABDIRFACTORYSERVICE_CONTRACTID,&rv);
  NS_ENSURE_SUCCESS (rv, rv);
		
  // Get the directory factory from the URI
  nsCOMPtr<nsIAbDirFactory> dirFactory;
  rv = dirFactoryService->GetDirFactory(aURI, getter_AddRefs(dirFactory));
  NS_ENSURE_SUCCESS (rv, rv);
  
  // Create the directories
  nsCOMPtr<nsISimpleEnumerator> newDirEnumerator;
  rv = dirFactory->GetDirectories(NS_ConvertUTF8toUTF16(aServer->description),
                                  aURI,
                                  nsDependentCString(aServer->prefName),
                                  getter_AddRefs(newDirEnumerator));
  NS_ENSURE_SUCCESS (rv, rv);
  
  // Enumerate through the directories adding them
  // to the sub directories array
  PRBool hasMore;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);

  while (NS_SUCCEEDED(newDirEnumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    nsCOMPtr<nsISupports> newDirSupports;
    rv = newDirEnumerator->GetNext(getter_AddRefs(newDirSupports));
    if(NS_FAILED(rv))
      continue;
    
    nsCOMPtr<nsIAbDirectory> childDir = do_QueryInterface(newDirSupports, &rv); 
    if(NS_FAILED(rv))
      continue;
    
    // Define a relationship between the preference
    // entry and the directory
    mServers.Put(childDir, aServer);

    mSubDirectories.AppendObject(childDir);

    // Inform the listener, i.e. the RDF directory data
    // source that a new address book has been added
    if (aNotify && abManager)
      abManager->NotifyDirectoryItemAdded(this, childDir);
  }
  
  return NS_OK;
}

NS_IMETHODIMP nsAbBSDirectory::GetChildNodes(nsISimpleEnumerator* *aResult)
{
  nsresult rv = EnsureInitialized();
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_NewArrayEnumerator(aResult, mSubDirectories);
}

nsresult nsAbBSDirectory::EnsureInitialized()
{
  if (mInitialized)
    return NS_OK;

  nsresult rv;
  nsCOMPtr<nsIAbDirFactoryService> dirFactoryService = 
    do_GetService(NS_ABDIRFACTORYSERVICE_CONTRACTID,&rv);
  NS_ENSURE_SUCCESS (rv, rv);
    
  nsVoidArray *directories = DIR_GetDirectories();
  if (!directories)
    return NS_ERROR_FAILURE;
    
  PRInt32 count = directories->Count();
  for (PRInt32 i = 0; i < count; i++)
  {
    DIR_Server *server = (DIR_Server *)(directories->ElementAt(i));
      
    // if this is a 4.x, local .na2 addressbook (PABDirectory)
    // we must skip it.
    // mozilla can't handle 4.x .na2 addressbooks
    // note, the filename might be na2 for 4.x LDAP directories
    // (we used the .na2 file for replication), and we don't want to skip
    // those.  see bug #127007
    PRUint32 fileNameLen = strlen(server->fileName);
    if (((fileNameLen > kABFileName_PreviousSuffixLen) && 
      strcmp(server->fileName + fileNameLen - kABFileName_PreviousSuffixLen,
             kABFileName_PreviousSuffix) == 0) &&
      (server->dirType == PABDirectory))
      continue;
      
    // Set the uri property
    nsCAutoString URI (server->uri);
    // This is in case the uri is never set
    // in the nsDirPref.cpp code.
    if (!server->uri) 
    {
      URI = NS_LITERAL_CSTRING(kMDBDirectoryRoot);
      URI += nsDependentCString(server->fileName);
    }
      
    /*
     * Check that we are not converting from a
     * a 4.x address book file e.g. pab.na2
     * check if the URI ends with ".na2"
     */
    if (StringEndsWith(URI, NS_LITERAL_CSTRING(kABFileName_PreviousSuffix))) 
      URI.Replace(kMDBDirectoryRootLen, URI.Length() - kMDBDirectoryRootLen, server->fileName);
      
    // Create the directories
    rv = CreateDirectoriesFromFactory(URI, server, PR_FALSE /* notify */);

    // If we failed, this could be because something has set a pref for us
    // which is now broke (e.g. no factory present). So just ignore this one
    // and move on.
    if (NS_FAILED(rv))
      NS_WARNING("CreateDirectoriesFromFactory failed - Invalid factory?");
  }
    
  mInitialized = PR_TRUE;
  // sort directories by position...
  return NS_OK;
}

NS_IMETHODIMP nsAbBSDirectory::CreateNewDirectory(const nsAString &aDirName,
                                                  const nsACString &aURI,
                                                  PRUint32 aType,
                                                  const nsACString &aPrefName,
                                                  nsACString &aResult)
{
  nsresult rv = EnsureInitialized();
  NS_ENSURE_SUCCESS(rv, rv);

  /*
   * TODO
   * This procedure is still MDB specific
   * due to the dependence on the current
   * nsDirPref.cpp code
	 */

  nsCString URI(aURI);

  /*
   * The creation of the address book in the preferences
   * is very MDB implementation specific.
   * If the fileName attribute is null then it will
   * create an appropriate file name.
   * Somehow have to resolve this issue so that it
   * is more general.
   *
   */
  DIR_Server* server = nsnull;
  rv = DIR_AddNewAddressBook(aDirName, EmptyCString(), URI,
                             (DirectoryType)aType, aPrefName, &server);
  NS_ENSURE_SUCCESS (rv, rv);
  
  if (aType == PABDirectory) {
    // Add the URI property
    URI.AssignLiteral(kMDBDirectoryRoot);
    URI.Append(nsDependentCString(server->fileName));
  }

  aResult.Assign(server->prefName);

  rv = CreateDirectoriesFromFactory(URI, server, PR_TRUE /* notify */);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

NS_IMETHODIMP nsAbBSDirectory::CreateDirectoryByURI(const nsAString &aDisplayName,
                                                    const nsACString &aURI)
{
  nsresult rv = EnsureInitialized();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString fileName;
  if (StringBeginsWith(aURI, NS_LITERAL_CSTRING(kMDBDirectoryRoot)))
    fileName = StringTail(aURI, aURI.Length() - kMDBDirectoryRootLen);

  DIR_Server * server = nsnull;
  rv = DIR_AddNewAddressBook(aDisplayName, fileName, aURI,
                             PABDirectory, EmptyCString(), &server);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = CreateDirectoriesFromFactory(aURI, server, PR_TRUE /* notify */);
  NS_ENSURE_SUCCESS(rv,rv);
	return rv;
}

struct GetDirectories
{
  GetDirectories(DIR_Server* aServer) : mServer(aServer) { }

  nsCOMArray<nsIAbDirectory> directories;
  DIR_Server* mServer;
};

static PLDHashOperator
GetDirectories_getDirectory(nsISupports *aKey, DIR_Server* aData, void* aClosure)
{
  GetDirectories* getDirectories = (GetDirectories*)aClosure;

  if (aData == getDirectories->mServer) {
    nsCOMPtr<nsIAbDirectory> abDir = do_QueryInterface(aKey);
    getDirectories->directories.AppendObject(abDir);
  }

  return PL_DHASH_NEXT;
}

NS_IMETHODIMP nsAbBSDirectory::DeleteDirectory(nsIAbDirectory *directory)
{
  NS_ENSURE_ARG_POINTER(directory);

  nsresult rv = EnsureInitialized();
  NS_ENSURE_SUCCESS(rv, rv);

  DIR_Server *server = nsnull;
  mServers.Get(directory, &server);

  if (!server)
    return NS_ERROR_FAILURE;

  GetDirectories getDirectories(server);
  mServers.EnumerateRead(GetDirectories_getDirectory,
                         (void*)&getDirectories);

  DIR_DeleteServerFromList(server);

  nsCOMPtr<nsIAbDirFactoryService> dirFactoryService = 
    do_GetService(NS_ABDIRFACTORYSERVICE_CONTRACTID,&rv);
  NS_ENSURE_SUCCESS (rv, rv);

  PRUint32 count = getDirectories.directories.Count();

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID);

  for (PRUint32 i = 0; i < count; i++) {
    nsCOMPtr<nsIAbDirectory> d = getDirectories.directories[i];

    mServers.Remove(d);
    rv = mSubDirectories.RemoveObject(d);

    if (abManager)
      abManager->NotifyDirectoryDeleted(this, d);

    nsCOMPtr<nsIRDFResource> resource(do_QueryInterface (d, &rv));
    nsCString uri;
    resource->GetValueUTF8(uri);

    nsCOMPtr<nsIAbDirFactory> dirFactory;
    rv = dirFactoryService->GetDirFactory(uri, getter_AddRefs(dirFactory));
    if (NS_FAILED(rv))
      continue;

    rv = dirFactory->DeleteDirectory(d);
  }

  return rv;
}

NS_IMETHODIMP nsAbBSDirectory::HasDirectory(nsIAbDirectory *dir, PRBool *hasDir)
{
  if (!hasDir)
    return NS_ERROR_NULL_POINTER;

  nsresult rv = EnsureInitialized();
  NS_ENSURE_SUCCESS(rv, rv);

  DIR_Server *dirServer = nsnull;
  mServers.Get(dir, &dirServer);
  return DIR_ContainsServer(dirServer, hasDir);
}

NS_IMETHODIMP nsAbBSDirectory::UseForAutocomplete(const nsACString &aIdentityKey,
                                                  PRBool *aResult)
{
  // For the "root" directory (kAllDirectoryRoot) always return true so that
  // we can search sub directories that may or may not be local.
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = PR_TRUE;
  return NS_OK;
}
