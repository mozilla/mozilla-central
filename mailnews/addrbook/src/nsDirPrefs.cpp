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
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Dan Mosedale <dmose@mozilla.org>
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

/* directory server preferences (used to be dirprefs.c in 4.x) */

#include "nsIPrefService.h"
#include "nsIPrefBranch2.h"
#include "nsDirPrefs.h"
#include "nsIPrefLocalizedString.h"
#include "nsIObserver.h"
#include "nsVoidArray.h"
#include "nsServiceManagerUtils.h"
#include "nsMemory.h"
#include "nsIAddrDatabase.h"
#include "nsAbBaseCID.h"
#include "nsIAbManager.h"
#include "nsILocalFile.h"
#include "nsWeakReference.h"
#include "nsIAbMDBDirectory.h"
#if defined(MOZ_LDAP_XPCOM)
#include "nsIAbLDAPDirectory.h"
#endif
#include "prmem.h"
#include "prprf.h"
#include "plstr.h"
#include "nsQuickSort.h"

#include <ctype.h>

/*****************************************************************************
 * Private definitions
 */

/* Default settings for site-configurable prefs */
#define kDefaultPosition 1
static PRBool dir_IsServerDeleted(DIR_Server * server);

static char *DIR_GetStringPref(const char *prefRoot, const char *prefLeaf, const char *defaultValue);
static PRInt32 DIR_GetIntPref(const char *prefRoot, const char *prefLeaf, PRInt32 defaultValue);

static char * dir_ConvertDescriptionToPrefName(DIR_Server * server);

void DIR_SetFileName(char** filename, const char* leafName);
static void DIR_SetIntPref(const char *prefRoot, const char *prefLeaf, PRInt32 value, PRInt32 defaultValue);
static DIR_Server *dir_MatchServerPrefToServer(nsVoidArray *wholeList, const char *pref);
static PRBool dir_ValidateAndAddNewServer(nsVoidArray *wholeList, const char *fullprefname);
static void DIR_DeleteServerList(nsVoidArray *wholeList);

static char *dir_CreateServerPrefName(DIR_Server *server);
static void DIR_GetPrefsForOneServer(DIR_Server *server);

static void DIR_InitServer(DIR_Server *server, DirectoryType dirType = (DirectoryType)0);
static DIR_PrefId  DIR_AtomizePrefName(const char *prefname);

#define DIR_POS_APPEND                     0x80000000
#define DIR_POS_DELETE                     0x80000001
static PRBool DIR_SetServerPosition(nsVoidArray *wholeList, DIR_Server *server, PRInt32 position);

/* These two routines should be called to initialize and save 
 * directory preferences from the XP Java Script preferences
 */
static nsresult DIR_GetServerPreferences(nsVoidArray** list);
static void DIR_SaveServerPreferences(nsVoidArray *wholeList);

static PRInt32 dir_UserId = 0;
nsVoidArray *dir_ServerList = nsnull;

/*****************************************************************************
 * Functions for creating the new back end managed DIR_Server list.
 */
class DirPrefObserver : public nsSupportsWeakReference,
                        public nsIObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER
};

NS_IMPL_ISUPPORTS2(DirPrefObserver, nsISupportsWeakReference, nsIObserver)

NS_IMETHODIMP DirPrefObserver::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *aData)
{
  nsCOMPtr<nsIPrefBranch> prefBranch(do_QueryInterface(aSubject));

  const char *prefname = NS_ConvertUTF16toUTF8(aData).get();

  DIR_PrefId id = DIR_AtomizePrefName(prefname);

  // Just get out if we get nothing here - we don't need to do anything
  if (id == idNone)
    return NS_OK;

  /* Check to see if the server is in the unified server list.
   */
  DIR_Server *server = dir_MatchServerPrefToServer(dir_ServerList, prefname);
  if (server)
  {
    /* If the server is in the process of being saved, just ignore this
     * change.  The DIR_Server structure is not really changing.
     */
    if (server->savingServer)
      return NS_OK;

    /* If the pref that changed is the position, read it in.  If the new
     * position is zero, remove the server from the list.
     */
    if (id == idPosition)
    {
      PRInt32 position;

      /* We must not do anything if the new position is the same as the
       * position in the DIR_Server.  This avoids recursion in cases
       * where we are deleting the server.
       */
      prefBranch->GetIntPref(prefname, &position);
      if (position != server->position)
      {
        server->position = position;
        if (dir_IsServerDeleted(server))
          DIR_SetServerPosition(dir_ServerList, server, DIR_POS_DELETE);
      }
    }

    if (id == idDescription)
      // Ensure the local copy of the description is kept up to date.
      server->description = DIR_GetStringPref(prefname, "description", nsnull);
  }
  /* If the server is not in the unified list, we may need to add it.  Servers
   * are only added when the position, serverName and description are valid.
   */
  else if (id == idPosition || id == idType || id == idDescription)
  {
    dir_ValidateAndAddNewServer(dir_ServerList, prefname);
  }

  return NS_OK;
}

// A pointer to the pref observer
static DirPrefObserver *prefObserver = nsnull;

static nsresult DIR_GetDirServers()
{
  nsresult rv = NS_OK;

  if (!dir_ServerList)
  {
    /* we need to build the DIR_Server list */ 
    rv = DIR_GetServerPreferences(&dir_ServerList);

    /* Register the preference call back if necessary. */
    if (NS_SUCCEEDED(rv) && !prefObserver)
    {
      nsCOMPtr<nsIPrefBranch2> pbi(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
      if (NS_FAILED(rv))
        return rv;
      prefObserver = new DirPrefObserver();

      if (!prefObserver)
        return NS_ERROR_OUT_OF_MEMORY;

      NS_ADDREF(prefObserver);

      pbi->AddObserver(PREF_LDAP_SERVER_TREE_NAME, prefObserver, PR_TRUE);
    }
  }
  return rv;
}

nsVoidArray* DIR_GetDirectories()
{
    if (!dir_ServerList)
        DIR_GetDirServers();
  return dir_ServerList;
}

DIR_Server* DIR_GetServerFromList(const char* prefName)
{
  DIR_Server* result = nsnull;

  if (!dir_ServerList)
    DIR_GetDirServers();

  if (dir_ServerList)
  {
    PRInt32 count = dir_ServerList->Count();
    PRInt32 i;
    for (i = 0; i < count; ++i)
    {
      DIR_Server *server = (DIR_Server *)dir_ServerList->ElementAt(i);

      if (server && strcmp(server->prefName, prefName) == 0)
      {
        result = server;
        break;
      }
    }
  }
  return result;
}

static nsresult SavePrefsFile()
{
  nsresult rv;
  nsCOMPtr<nsIPrefService> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return rv;
  return pPref->SavePrefFile(nsnull);
}

nsresult DIR_ShutDown()  /* FEs should call this when the app is shutting down. It frees all DIR_Servers regardless of ref count values! */
{
  nsresult rv = SavePrefsFile();
  NS_ENSURE_SUCCESS(rv, rv);

  DIR_DeleteServerList(dir_ServerList);
  dir_ServerList = nsnull;

  /* unregister the preference call back, if necessary.
  * we need to do this as DIR_Shutdown() is called when switching profiles
  * when using turbo.  (see nsAbDirectoryDataSource::Observe())
  * When switching profiles, prefs get unloaded and then re-loaded
  * we don't want our callback to get called for all that.
  * We'll reset our callback the first time DIR_GetDirServers() is called
  * after we've switched profiles.
  */
  NS_IF_RELEASE(prefObserver);
  
  return NS_OK;
}

nsresult DIR_ContainsServer(DIR_Server* pServer, PRBool *hasDir)
{
  if (dir_ServerList)
  {
    PRInt32 count = dir_ServerList->Count();
    PRInt32 i;
    for (i = 0; i < count; i++)
    {
      DIR_Server* server = (DIR_Server *)(dir_ServerList->ElementAt(i));
      if (server == pServer)
      {
        *hasDir = PR_TRUE;
        return NS_OK;
      }
    }
  }
  *hasDir = PR_FALSE;
  return NS_OK;
}

nsresult DIR_AddNewAddressBook(const nsAString &dirName,
                               const nsACString &fileName,
                               const nsACString &uri, 
                               DirectoryType dirType,
                               const nsACString &prefName,
                               DIR_Server** pServer)
{
  DIR_Server * server = (DIR_Server *) PR_Malloc(sizeof(DIR_Server));
  if (!server)
    return NS_ERROR_OUT_OF_MEMORY;

  DIR_InitServer(server, dirType);
  if (!dir_ServerList)
    DIR_GetDirServers();
  if (dir_ServerList)
  {
    NS_ConvertUTF16toUTF8 utf8str(dirName);
    server->description = ToNewCString(utf8str);
    server->position = kDefaultPosition; // don't set position so alphabetic sort will happen.
    
    if (!fileName.IsEmpty())
      server->fileName = ToNewCString(fileName);
    else if (dirType == PABDirectory) 
      DIR_SetFileName(&server->fileName, kPersonalAddressbook);
    else if (dirType == LDAPDirectory)
      DIR_SetFileName(&server->fileName, kMainLdapAddressBook);

    if (dirType != PABDirectory) {
      if (!uri.IsEmpty())
        server->uri = ToNewCString(uri);
    }

    if (!prefName.IsEmpty())
      server->prefName = ToNewCString(prefName);

    dir_ServerList->AppendElement(server);

    DIR_SavePrefsForOneServer(server); 

    *pServer = server;
    
    // save new address book into pref file 
    return SavePrefsFile();
  }
  return NS_ERROR_FAILURE;
}

/*****************************************************************************
 * Functions for creating DIR_Servers
 */
static void DIR_InitServer(DIR_Server *server, DirectoryType dirType)
{
  if (!server) {
    NS_WARNING("DIR_InitServer: server parameter not initialized");
    return;
  }

  memset(server, 0, sizeof(DIR_Server));
  server->position = kDefaultPosition;
  server->uri = nsnull;
  server->savingServer = PR_FALSE;
  server->dirType = dirType;
}

/* Function for setting the position of a server.  Can be used to append,
 * delete, or move a server in a server list.
 *
 * The third parameter specifies the new position the server is to occupy.
 * The resulting position may differ depending on the lock state of the
 * given server and other servers in the list.  The following special values
 * are supported:
 *   DIR_POS_APPEND - Appends the server to the end of the list.  If the server
 *                    is already in the list, does nothing.
 *   DIR_POS_DELETE - Deletes the given server from the list.  Note that this
 *                    does not cause the server structure to be freed.
 *
 * Returns PR_TRUE if the server list was re-sorted.
 */
static PRBool DIR_SetServerPosition(nsVoidArray *wholeList, DIR_Server *server, PRInt32 position)
 {
   NS_ENSURE_ARG_POINTER(wholeList);

   PRInt32    i, count, num;
   PRBool     resort = PR_FALSE;
   DIR_Server *s=nsnull;
   
   switch (position) {
   case DIR_POS_APPEND:
   /* Do nothing if the request is to append a server that is already
     * in the list.
     */
     count = wholeList->Count();
     for (i= 0; i < count; i++)
     {
       if  ((s = (DIR_Server *)wholeList->ElementAt(i)) != nsnull)
         if (s == server)
           return PR_FALSE;
     }
     /* In general, if there are any servers already in the list, set the
     * position to the position of the last server plus one.  If there
     * are none, set it to position 1.
     */
     if (count > 0)
     {
       s = (DIR_Server *)wholeList->ElementAt(count - 1);
       server->position = s->position + 1;
     }
     else
       server->position = 1;
     
     wholeList->AppendElement(server);
     break;
     
   case DIR_POS_DELETE:
       /* Remove the prefs corresponding to the given server.  If the prefName
       * value is nsnull, the server has never been saved and there are no
       * prefs to remove.
     */
     if (server->prefName)
     {
       nsresult rv;
       nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
       if (NS_FAILED(rv))
         return PR_FALSE;

       pPref->DeleteBranch(server->prefName);

       // mark the server as deleted by setting its position to 0
       DIR_SetIntPref(server->prefName, "position", 0, -1);
     }
     
     /* If the server is in the server list, remove it.
     */
     num = wholeList->IndexOf(server);
     if (num >= 0)
     {
     /* The list does not need to be re-sorted if the server is the
     * last one in the list.
       */
       count = wholeList->Count();
       if (num == count - 1)
       {
         wholeList->RemoveElementAt(num);
       }
       else
       {
         resort = PR_TRUE;
         wholeList->RemoveElement(server);
       }
     }
     break;
     
   default:
   /* See if the server is already in the list.
     */
     count = wholeList->Count();
     for (i= 0; i < count; i++)
     {
       if  ((s = (DIR_Server *)wholeList->ElementAt(i)) != nsnull)
         if (s == server)
           break;
     }
     
     /* If the server is not in the list, add it to the beginning and re-sort.
     */
     if (s == nsnull)
     {
       server->position = position;
       wholeList->AppendElement(server);
       resort = PR_TRUE;
     }
     
       /* Don't re-sort if the server is already in the requested position.
     */
     else if (server->position != position)
     {
       server->position = position;
       wholeList->RemoveElement(server);
       wholeList->AppendElement(server);
       resort = PR_TRUE;
     }
     break;
        }
        
        /* Make sure our position changes get saved back to prefs
        */
        DIR_SaveServerPreferences(wholeList);
        
        return resort;
}

/*****************************************************************************
 * DIR_Server Callback Notification Functions
 */

/* dir_matchServerPrefToServer
 *
 * This function finds the DIR_Server in the unified DIR_Server list to which
 * the given preference string belongs.
 */
static DIR_Server *dir_MatchServerPrefToServer(nsVoidArray *wholeList, const char *pref)
{
  DIR_Server *server;

  PRInt32 count = wholeList->Count();
  PRInt32 i;
  for (i = 0; i < count; i++)
  {
    if ((server = (DIR_Server *)wholeList->ElementAt(i)) != nsnull)
    {
      if (server->prefName && PL_strstr(pref, server->prefName) == pref)
      {
        char c = pref[PL_strlen(server->prefName)];
        if (c == 0 || c == '.')
          return server;
      }
    }
  }
  return nsnull;
}

/* dir_ValidateAndAddNewServer
 *
 * This function verifies that the position, serverName and description values
 * are set for the given prefName.  If they are then it adds the server to the
 * unified server list.
 */
static PRBool dir_ValidateAndAddNewServer(nsVoidArray *wholeList, const char *fullprefname)
{
  PRBool rc = PR_FALSE;

  const char *endname = PL_strchr(&fullprefname[PL_strlen(PREF_LDAP_SERVER_TREE_NAME) + 1], '.');
  if (endname)
  {
    char *prefname = (char *)PR_Malloc(endname - fullprefname + 1);
    if (prefname)
    {
      PRInt32 dirType;
      char *t1 = nsnull, *t2 = nsnull;

      PL_strncpyz(prefname, fullprefname, endname - fullprefname + 1);

      dirType = DIR_GetIntPref(prefname, "dirType", -1);
      if (dirType != -1 &&
          DIR_GetIntPref(prefname, "position", 0) != 0 &&
          (t1 = DIR_GetStringPref(prefname, "description", nsnull)) != nsnull)
      {
        if (dirType == PABDirectory ||
           (t2 = DIR_GetStringPref(prefname, "serverName",  nsnull)) != nsnull)
        {
          DIR_Server *server = (DIR_Server *)PR_Malloc(sizeof(DIR_Server));
          if (server)
          {
            DIR_InitServer(server, (DirectoryType)dirType);
            server->prefName = prefname;
            DIR_GetPrefsForOneServer(server);
            DIR_SetServerPosition(wholeList, server, server->position);
            rc = PR_TRUE;
          }
          PR_FREEIF(t2);
        }
        PR_Free(t1);
      }
      else
        PR_Free(prefname);
    }
  }

  return rc;
}

static DIR_PrefId DIR_AtomizePrefName(const char *prefname)
{
  if (!prefname)
    return idNone;

  DIR_PrefId rc = idNone;

  /* Skip the "ldap_2.servers.<server-name>." portion of the string.
   */
  if (PL_strstr(prefname, PREF_LDAP_SERVER_TREE_NAME) == prefname)
  {
    prefname = PL_strchr(&prefname[PL_strlen(PREF_LDAP_SERVER_TREE_NAME) + 1], '.');
    if (!prefname)
      return idNone;
    else
      prefname = prefname + 1;
  }

  switch (prefname[0]) {
  case 'd':
    switch (prefname[1]) {
    case 'e': /* description */
      rc = idDescription;
      break;
    case 'i': /* dirType */
      rc = idType;
      break;
    }
    break;

  case 'f':
    rc = idFileName;
    break;

  case 'p':
    switch (prefname[1]) {
    case 'o':
      switch (prefname[2]) {
      case 's': /* position */
        rc = idPosition;
        break;
      }
      break;
    }
    break;

  case 'u': /* uri */
    rc = idUri;
    break;
  }

  return rc;
}

/*****************************************************************************
 * Functions for destroying DIR_Servers 
 */

/* this function determines if the passed in server is no longer part of the of
   the global server list. */
static PRBool dir_IsServerDeleted(DIR_Server * server)
{
  return (server && server->position == 0);
}

/* when the back end manages the server list, deleting a server just decrements its ref count,
   in the old world, we actually delete the server */
static void DIR_DeleteServer(DIR_Server *server)
{
  if (server)
  {
    /* when destroying the server check its clear flag to see if things need cleared */
#ifdef XP_FileRemove
    if (DIR_TestFlag(server, DIR_CLEAR_SERVER))
    {
      if (server->fileName)
        XP_FileRemove (server->fileName, xpAddrBookNew);
    }
#endif /* XP_FileRemove */
    PR_Free(server->prefName);
    PR_Free(server->description);
    PR_Free(server->fileName);
    PR_Free(server->uri);
    PR_Free(server);
  }
}

nsresult DIR_DeleteServerFromList(DIR_Server *server)
{
  if (!server)
    return NS_ERROR_NULL_POINTER;

  nsresult rv = NS_OK;
  nsCOMPtr<nsILocalFile> dbPath;

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv); 
  if (NS_SUCCEEDED(rv))
    rv = abManager->GetUserProfileDirectory(getter_AddRefs(dbPath));
  
  if (NS_SUCCEEDED(rv))
  {
    // close the database, as long as it isn't the special ones 
    // (personal addressbook and collected addressbook)
    // which can never be deleted.  There was a bug where we would slap in
    // "abook.mab" as the file name for LDAP directories, which would cause a crash
    // on delete of LDAP directories.  this is just extra protection.
    if (server->fileName &&
        strcmp(server->fileName, kPersonalAddressbook) && 
        strcmp(server->fileName, kCollectedAddressbook))
    {
      nsCOMPtr<nsIAddrDatabase> database;

      rv = dbPath->AppendNative(nsDependentCString(server->fileName));
      NS_ENSURE_SUCCESS(rv, rv);

      // close file before delete it
      nsCOMPtr<nsIAddrDatabase> addrDBFactory = 
               do_GetService(NS_ADDRDATABASE_CONTRACTID, &rv);

      if (NS_SUCCEEDED(rv) && addrDBFactory)
        rv = addrDBFactory->Open(dbPath, PR_FALSE, PR_TRUE, getter_AddRefs(database));
      if (database)  /* database exists */
      {
        database->ForceClosed();
        rv = dbPath->Remove(PR_FALSE);
        NS_ENSURE_SUCCESS(rv, rv);
      }
    }

    nsVoidArray *dirList = DIR_GetDirectories();
    DIR_SetServerPosition(dirList, server, DIR_POS_DELETE);
    DIR_DeleteServer(server);

    return SavePrefsFile();
  }

  return NS_ERROR_NULL_POINTER;
}

static void DIR_DeleteServerList(nsVoidArray *wholeList)
{
  if (wholeList)
  {
    DIR_Server *server = nsnull;
  
    /* TBD: Send notifications? */
    PRInt32 count = wholeList->Count();
    PRInt32 i;
    for (i = count - 1; i >=0; i--)
    {
      server = (DIR_Server *)wholeList->ElementAt(i);
      if (server != nsnull)
        DIR_DeleteServer(server);
    }
    delete wholeList;
  }
}

/*****************************************************************************
 * Functions for managing JavaScript prefs for the DIR_Servers 
 */

PR_STATIC_CALLBACK(int)
comparePrefArrayMembers(const void* aElement1, const void* aElement2, void* aData)
{
    const char* element1 = *static_cast<const char* const *>(aElement1);
    const char* element2 = *static_cast<const char* const *>(aElement2);
    const PRUint32 offset = *((const PRUint32*)aData);

    // begin the comparison at |offset| chars into the string -
    // this avoids comparing the "ldap_2.servers." portion of every element,
    // which will always remain the same.
    return strcmp(element1 + offset, element2 + offset);
}

static nsresult dir_GetChildList(const nsCString &aBranch,
                                 PRUint32 *aCount, char ***aChildList)
{
    PRUint32 branchLen = aBranch.Length();

    nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID);
    if (!prefBranch) {
        return NS_ERROR_FAILURE;
    }

    nsresult rv = prefBranch->GetChildList(aBranch.get(), aCount, aChildList);
    if (NS_FAILED(rv)) {
        return rv;
    }

    // traverse the list, and truncate all the descendant strings to just
    // one branch level below the root branch.
    for (PRUint32 i = *aCount; i--; ) {
        // The prefname we passed to GetChildList was of the form
        // "ldap_2.servers." and we are returned the descendants
        // in the form of "ldap_2.servers.servername.foo"
        // But we want the prefbranch of the servername, so
        // write a NUL character in to terminate the string early.
        char *endToken = strchr((*aChildList)[i] + branchLen, '.');
        if (endToken)
            *endToken = '\0';
    }

    if (*aCount > 1) {
        // sort the list, in preparation for duplicate entry removal
        NS_QuickSort(*aChildList, *aCount, sizeof(char*), comparePrefArrayMembers, &branchLen);

        // traverse the list and remove duplicate entries.
        // we use two positions in the list; the current entry and the next
        // entry; and perform a bunch of in-place ptr moves. so |cur| points
        // to the last unique entry, and |next| points to some (possibly much
        // later) entry to test, at any given point. we know we have >= 2
        // elements in the list here, so we just init the two counters sensibly
        // to begin with.
        PRUint32 cur = 0;
        for (PRUint32 next = 1; next < *aCount; ++next) {
            // check if the elements are equal or unique
            if (!comparePrefArrayMembers(&((*aChildList)[cur]), &((*aChildList)[next]), &branchLen)) {
                // equal - just free & increment the next element ptr

                nsMemory::Free((*aChildList)[next]);
            } else {
                // cur & next are unique, so we need to shift the element.
                // ++cur will point to the next free location in the
                // reduced array (it's okay if that's == next)
                (*aChildList)[++cur] = (*aChildList)[next];
            }
        }

        // update the unique element count
        *aCount = cur + 1;
    }

    return NS_OK;
}

static char *DIR_GetStringPref(const char *prefRoot, const char *prefLeaf, const char *defaultValue)
{
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    if (NS_FAILED(rv))
        return nsnull;

    nsCString value;
    nsCAutoString prefLocation(prefRoot);

    prefLocation.Append('.');
    prefLocation.Append(prefLeaf);
 
    if (NS_SUCCEEDED(pPref->GetCharPref(prefLocation.get(), getter_Copies(value))))
    {
        /* unfortunately, there may be some prefs out there which look like this */
        if (value.EqualsLiteral("(null)")) 
        {
            if (defaultValue)
                value = defaultValue;
            else
                value.Truncate();
        }

        if (value.IsEmpty())
        {
          rv = pPref->GetCharPref(prefLocation.get(), getter_Copies(value));
        }
    }
    else
        value = defaultValue; 

    return ToNewCString(value);
}

/*
  Get localized unicode string pref from properties file, convert into an UTF8 string 
  since address book prefs store as UTF8 strings.  So far there are 2 default 
  prefs stored in addressbook.properties.
  "ldap_2.servers.pab.description"
  "ldap_2.servers.history.description"
*/

static char *DIR_GetLocalizedStringPref
(const char *prefRoot, const char *prefLeaf, const char *defaultValue)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));

  if (NS_FAILED(rv))
    return nsnull;

  nsCAutoString prefLocation(prefRoot);
  prefLocation.Append('.');
  prefLocation.Append(prefLeaf);

  nsString wvalue;
  nsCOMPtr<nsIPrefLocalizedString> locStr;

  rv = pPref->GetComplexValue(prefLocation.get(), NS_GET_IID(nsIPrefLocalizedString), getter_AddRefs(locStr));
  if (NS_SUCCEEDED(rv))
    rv = locStr->ToString(getter_Copies(wvalue));

  char *value = nsnull;
  if (!wvalue.IsEmpty())
  {
    NS_ConvertUTF16toUTF8 utf8str(wvalue.get());
    value = ToNewCString(utf8str);
  }
  else
    value = defaultValue ? strdup(defaultValue) : nsnull;

  return value;
}

static PRInt32 DIR_GetIntPref(const char *prefRoot, const char *prefLeaf, PRInt32 defaultValue)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));

  if (NS_FAILED(rv))
    return defaultValue;

  PRInt32 value;
  nsCAutoString prefLocation(prefRoot);

  prefLocation.Append('.');
  prefLocation.Append(prefLeaf);

  if (NS_FAILED(pPref->GetIntPref(prefLocation.get(), &value)))
    value = defaultValue;

  return value;
}

/* This will convert from the old preference that was a path and filename */
/* to a just a filename */
static void DIR_ConvertServerFileName(DIR_Server* pServer)
{
  char* leafName = pServer->fileName;
  char* newLeafName = nsnull;
#if defined(XP_WIN) || defined(XP_OS2)
  /* jefft -- bug 73349 This is to allow users share same address book.
   * It only works if the user specify a full path filename.
   */
#ifdef XP_FileIsFullPath
  if (! XP_FileIsFullPath(leafName))
    newLeafName = XP_STRRCHR (leafName, '\\');
#endif /* XP_FileIsFullPath */
#else
  newLeafName = strrchr(leafName, '/');
#endif
    pServer->fileName = newLeafName ? strdup(newLeafName + 1) : strdup(leafName);
  if (leafName) PR_Free(leafName);
}

/* This will generate a correct filename and then remove the path.
 * Note: we are assuming that the default name is in the native
 * filesystem charset. The filename will be returned as a UTF8
 * string.
 */
void DIR_SetFileName(char** fileName, const char* defaultName)
{
  if (!fileName)
    return;

  nsresult rv = NS_OK;
  nsCOMPtr<nsILocalFile> dbPath;

  *fileName = nsnull;

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv); 
  if (NS_SUCCEEDED(rv))
    rv = abManager->GetUserProfileDirectory(getter_AddRefs(dbPath));
  if (NS_SUCCEEDED(rv))
  {
    rv = dbPath->AppendNative(nsDependentCString(defaultName));
    if (NS_SUCCEEDED(rv))
    {
      rv = dbPath->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0664);

      nsAutoString realFileName;
      rv = dbPath->GetLeafName(realFileName);

      if (NS_SUCCEEDED(rv))
        *fileName = ToNewUTF8String(realFileName);
    }
  }
}

/****************************************************************
Helper function used to generate a file name from the description
of a directory. Caller must free returned string. 
An extension is not applied 
*****************************************************************/

static char * dir_ConvertDescriptionToPrefName(DIR_Server * server)
{
#define MAX_PREF_NAME_SIZE 25
  char * fileName = nsnull;
  char fileNameBuf[MAX_PREF_NAME_SIZE];
  PRInt32 srcIndex = 0;
  PRInt32 destIndex = 0;
  PRInt32 numSrcBytes = 0;
  const char * descr = nsnull;
  if (server && server->description)
  {
    descr = server->description;
    numSrcBytes = PL_strlen(descr);
    while (srcIndex < numSrcBytes && destIndex < MAX_PREF_NAME_SIZE-1)
    {
      if (isdigit(descr[srcIndex]) || isalpha(descr[srcIndex]) )
      {
        fileNameBuf[destIndex] = descr[srcIndex];
        destIndex++;
      }

      srcIndex++;
    }

    fileNameBuf[destIndex] = '\0'; /* zero out the last character */
  }

  if (destIndex) /* have at least one character in the file name? */
  fileName = strdup(fileNameBuf);

  return fileName;
}


void DIR_SetServerFileName(DIR_Server *server)
{
  char * tempName = nsnull; 
  const char * prefName = nsnull;
  PRUint32 numHeaderBytes = 0; 

  if (server && (!server->fileName || !(*server->fileName)) )
  {
          PR_FREEIF(server->fileName); // might be one byte empty string.
    /* make sure we have a pref name...*/
    if (!server->prefName || !*server->prefName)
      server->prefName = dir_CreateServerPrefName(server);

    /* set default personal address book file name*/
    if ((server->position == 1) && (server->dirType == PABDirectory))
            server->fileName = strdup(kPersonalAddressbook);
    else
    {
      /* now use the pref name as the file name since we know the pref name
         will be unique */
      prefName = server->prefName;
      if (prefName && *prefName)
      {
        /* extract just the pref name part and not the ldap tree name portion from the string */
        numHeaderBytes = PL_strlen(PREF_LDAP_SERVER_TREE_NAME) + 1; /* + 1 for the '.' b4 the name */
        if (PL_strlen(prefName) > numHeaderBytes) 
                    tempName = strdup(prefName + numHeaderBytes);

        if (tempName)
        {
          server->fileName = PR_smprintf("%s%s", tempName, kABFileName_CurrentSuffix);
          PR_Free(tempName);
        }
      }
    }

    if (!server->fileName || !*server->fileName) /* when all else has failed, generate a default name */
    {
      if (server->dirType == LDAPDirectory)
        DIR_SetFileName(&(server->fileName), kMainLdapAddressBook); /* generates file name with an ldap prefix */
      else
        DIR_SetFileName(&(server->fileName), kPersonalAddressbook);
    }
  }
}

static char *dir_CreateServerPrefName (DIR_Server *server)
{
  /* we are going to try to be smart in how we generate our server
     pref name. We'll try to convert the description into a pref name
     and then verify that it is unique. If it is unique then use it... */
  char * leafName = dir_ConvertDescriptionToPrefName(server);
  char * prefName = nsnull;
  PRBool isUnique = PR_FALSE;

  if (!leafName || !*leafName)
  {
    // we need to handle this in case the description has no alphanumeric chars
    // it's very common for cjk users
    leafName = strdup("_nonascii");
  }

  if (leafName)
  {
    PRInt32 uniqueIDCnt = 0;
        char **children = nsnull;
    /* we need to verify that this pref string name is unique */
    prefName = PR_smprintf(PREF_LDAP_SERVER_TREE_NAME".%s", leafName);
    isUnique = PR_FALSE;
    PRUint32 prefCount;
    nsresult rv = dir_GetChildList(NS_LITERAL_CSTRING(PREF_LDAP_SERVER_TREE_NAME "."),
                                   &prefCount, &children);
    if (NS_SUCCEEDED(rv))
    {
      while (!isUnique && prefName)
      {
        isUnique = PR_TRUE; /* now flip the logic and assume we are unique until we find a match */
        for (PRUint32 i = 0; i < prefCount && isUnique; ++i)
        {
          if (!PL_strcasecmp(children[i], prefName)) /* are they the same branch? */
            isUnique = PR_FALSE;
        }
        if (!isUnique) /* then try generating a new pref name and try again */
        {
          PR_smprintf_free(prefName);
          prefName = PR_smprintf(PREF_LDAP_SERVER_TREE_NAME".%s_%d", leafName, ++uniqueIDCnt);
        }
      } /* if we have a list of pref Names */

      NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(prefCount, children);
    } /* while we don't have a unique name */

    // fallback to "user_directory_N" form if we failed to verify
    if (!isUnique && prefName)
    {
      PR_smprintf_free(prefName);
      prefName = nsnull;
    }

    PR_Free(leafName);

  } /* if leafName */

  if (!prefName) /* last resort if we still don't have a pref name is to use user_directory string */
    return PR_smprintf(PREF_LDAP_SERVER_TREE_NAME".user_directory_%d", ++dir_UserId);
  else
    return prefName;
}

static void DIR_GetPrefsForOneServer(DIR_Server *server)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return;
  
  char    *prefstring = server->prefName;

  // this call fills in tempstring with the position pref, and
  // we then check to see if it's locked.
  server->position = DIR_GetIntPref (prefstring, "position", kDefaultPosition);

  // For default address books, this will get the name from the chrome
  // file referenced, for other address books it'll just retrieve it from prefs
  // as normal.
  server->description = DIR_GetLocalizedStringPref(prefstring, "description", "");
  
  server->dirType = (DirectoryType)DIR_GetIntPref (prefstring, "dirType", LDAPDirectory);

  server->fileName = DIR_GetStringPref (prefstring, "filename", "");
  // if we don't have a file name try and get one
  if (!server->fileName || !*(server->fileName)) 
    DIR_SetServerFileName (server);
  if (server->fileName && *server->fileName)
    DIR_ConvertServerFileName(server);

  // the string "s" is the default uri ( <scheme> + "://" + <filename> )
  nsCString s((server->dirType == PABDirectory || server->dirType == MAPIDirectory) ?
#if defined(MOZ_LDAP_XPCOM)
    kMDBDirectoryRoot : kLDAPDirectoryRoot);
#else
    // Fallback to the all directory root in the non-ldap enabled case.
    kMDBDirectoryRoot : kAllDirectoryRoot);
#endif
  s.Append (server->fileName);
  server->uri = DIR_GetStringPref (prefstring, "uri", s.get ());
}

static nsresult dir_GetPrefs(nsVoidArray **list)
{
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    if (NS_FAILED(rv))
        return rv;

    (*list) = new nsVoidArray();
    if (!(*list))
        return NS_ERROR_OUT_OF_MEMORY;

    char **children;
    PRUint32 prefCount;

    rv = dir_GetChildList(NS_LITERAL_CSTRING(PREF_LDAP_SERVER_TREE_NAME "."),
                          &prefCount, &children);
    if (NS_FAILED(rv))
        return rv;

    /* TBD: Temporary code to read broken "ldap" preferences tree.
     *      Remove line with if statement after M10.
     */
    if (dir_UserId == 0)
        pPref->GetIntPref(PREF_LDAP_GLOBAL_TREE_NAME".user_id", &dir_UserId);

    for (PRUint32 i = 0; i < prefCount; ++i)
    {
        DIR_Server *server;

        server = (DIR_Server *)PR_Calloc(1, sizeof(DIR_Server));
        if (server)
        {
            DIR_InitServer(server);
            server->prefName = strdup(children[i]);
            DIR_GetPrefsForOneServer(server);
            if (server->description && server->description[0] && 
                ((server->dirType == PABDirectory ||
                  server->dirType == MAPIDirectory ||
                  server->dirType == FixedQueryLDAPDirectory ||  // this one might go away
                  server->dirType == LDAPDirectory)))
            {
                if (!dir_IsServerDeleted(server))
                {
                    (*list)->AppendElement(server);
                }
                else
                    DIR_DeleteServer(server);
            }
            else
            {
                DIR_DeleteServer(server);
            }
        }
    }

    NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(prefCount, children);

    return NS_OK;
}

// I don't think we care about locked positions, etc.
void DIR_SortServersByPosition(nsVoidArray *serverList)
{
  int i, j;
  DIR_Server *server;
  
  int count = serverList->Count();
  for (i = 0; i < count - 1; i++)
  {
    for (j = i + 1; j < count; j++)
    {
      if (((DIR_Server *) serverList->ElementAt(j))->position < ((DIR_Server *) serverList->ElementAt(i))->position)
      {
        server        = (DIR_Server *) serverList->ElementAt(i);
        serverList->ReplaceElementAt(serverList->ElementAt(j), i);
        serverList->ReplaceElementAt(server, j);
      }
    }
  }
}

static nsresult DIR_GetServerPreferences(nsVoidArray** list)
{
  nsresult err;
  nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &err));
  if (NS_FAILED(err))
    return err;

  PRInt32 version = -1;
  nsVoidArray *newList = nsnull;
  
  /* Update the ldap list version and see if there are old prefs to migrate. */
  err = pPref->GetIntPref(PREF_LDAP_VERSION_NAME, &version);
  NS_ENSURE_SUCCESS(err, err);

  /* Find the new-style "ldap_2.servers" tree in prefs */
  err = dir_GetPrefs(&newList);

  if (version < kCurrentListVersion)
  {
    pPref->SetIntPref(PREF_LDAP_VERSION_NAME, kCurrentListVersion);
  }
 
  DIR_SortServersByPosition(newList);

  *list = newList;

  return err;
}

static void DIR_SetStringPref(const char *prefRoot, const char *prefLeaf, const char *value, const char *defaultValue)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv)); 
  if (NS_FAILED(rv)) 
    return;

  nsCString defaultPref;
  nsCAutoString prefLocation(prefRoot);

  prefLocation.Append('.');
  prefLocation.Append(prefLeaf);

  if (NS_SUCCEEDED(pPref->GetCharPref(prefLocation.get(), getter_Copies(defaultPref))))
  {
    /* If there's a default pref, just set ours in and let libpref worry 
     * about potential defaults in all.js
     */
    if (value) /* added this check to make sure we have a value before we try to set it..*/
      rv = pPref->SetCharPref (prefLocation.get(), value);
    else
      rv = pPref->ClearUserPref(prefLocation.get());
  }
  else
  {
    /* If there's no default pref, look for a user pref, and only set our value in
     * if the user pref is different than one of them.
     */
    nsCString userPref;
    if (NS_SUCCEEDED(pPref->GetCharPref (prefLocation.get(), getter_Copies(userPref))))
    {
      if (value && (defaultValue ? PL_strcasecmp(value, defaultValue) : value != defaultValue))
        rv = pPref->SetCharPref (prefLocation.get(), value);
      else
        rv = pPref->ClearUserPref(prefLocation.get());
    }
    else
    {
      if (value && (defaultValue ? PL_strcasecmp(value, defaultValue) : value != defaultValue))
        rv = pPref->SetCharPref (prefLocation.get(), value); 
    }
  }

  NS_ASSERTION(NS_SUCCEEDED(rv), "Could not set pref in DIR_SetStringPref");
}

static void DIR_SetLocalizedStringPref
(const char *prefRoot, const char *prefLeaf, const char *value)
{
  nsresult rv;
  nsCOMPtr<nsIPrefService> prefSvc(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));

  if (NS_FAILED(rv))
    return;

  nsCAutoString prefLocation(prefRoot);
  prefLocation.Append('.');

  nsCOMPtr<nsIPrefBranch> prefBranch;
  rv = prefSvc->GetBranch(prefLocation.get(), getter_AddRefs(prefBranch));
  if (NS_FAILED(rv))
    return;

  nsString wvalue;
  nsCOMPtr<nsIPrefLocalizedString> newStr(
    do_CreateInstance(NS_PREFLOCALIZEDSTRING_CONTRACTID, &rv));
  if (NS_FAILED(rv))
  {
    NS_ASSERTION(NS_SUCCEEDED(rv), "Could not createInstance in DIR_SetLocalizedStringPref");
    return;
  }

  NS_ConvertUTF8toUTF16 newValue(value);

  rv = newStr->SetData(newValue.get());
  if (NS_FAILED(rv))
  {
    NS_ASSERTION(NS_SUCCEEDED(rv), "Could not set pref data in DIR_SetLocalizedStringPref");
    return;
  }
  nsCOMPtr<nsIPrefLocalizedString> locStr;
  if (NS_SUCCEEDED(prefBranch->GetComplexValue(prefLeaf,
                                               NS_GET_IID(nsIPrefLocalizedString),
                                               getter_AddRefs(locStr))))
  {
    nsString data;
    locStr->GetData(getter_Copies(data));

    // Only set the pref if the data values aren't the same (i.e. don't change
    // unnecessarily, but also, don't change in the case that its a chrome
    // string pointing to the value we want to set the pref to).
    if (newValue != data)
      rv = prefBranch->SetComplexValue(prefLeaf,
                                       NS_GET_IID(nsIPrefLocalizedString),
                                       newStr);
  }
  else {
    // No value set, but check the default pref branch (i.e. user may have
    // cleared the pref)
    nsCOMPtr<nsIPrefBranch> dPB;
    rv = prefSvc->GetDefaultBranch(prefLocation.get(),
                                   getter_AddRefs(dPB));

    if (NS_SUCCEEDED(dPB->GetComplexValue(prefLeaf,
                                          NS_GET_IID(nsIPrefLocalizedString),
                                          getter_AddRefs(locStr))))
    {
      // Default branch has a value
      nsString data;
      locStr->GetData(getter_Copies(data));

      if (newValue != data)
        // If the vales aren't the same, set the data on the main pref branch
        rv = prefBranch->SetComplexValue(prefLeaf,
                                         NS_GET_IID(nsIPrefLocalizedString),
                                         newStr);
      else
        // Else if they are, kill the user pref
        rv = prefBranch->ClearUserPref(prefLeaf);
    }
    else
      // No values set anywhere, so just set the pref
      rv = prefBranch->SetComplexValue(prefLeaf,
                                       NS_GET_IID(nsIPrefLocalizedString),
                                       newStr);
  }

  NS_ASSERTION(NS_SUCCEEDED(rv), "Could not set pref in DIR_SetLocalizedStringPref");
}


static void DIR_SetIntPref(const char *prefRoot, const char *prefLeaf, PRInt32 value, PRInt32 defaultValue)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv)); 
  if (NS_FAILED(rv)) 
    return;

  PRInt32 defaultPref;
  nsCAutoString prefLocation(prefRoot);

  prefLocation.Append('.');
  prefLocation.Append(prefLeaf);

  if (NS_SUCCEEDED(pPref->GetIntPref(prefLocation.get(), &defaultPref)))
  {
    /* solve the problem where reordering user prefs must override default prefs */
    rv = pPref->SetIntPref(prefLocation.get(), value);
  }
  else
  {
    PRInt32 userPref;
    if (NS_SUCCEEDED(pPref->GetIntPref(prefLocation.get(), &userPref)))
    {
      if (value != defaultValue)
        rv = pPref->SetIntPref(prefLocation.get(), value);
      else
        rv = pPref->ClearUserPref(prefLocation.get());
    }
    else
    {
      if (value != defaultValue)
        rv = pPref->SetIntPref(prefLocation.get(), value); 
    }
  }

  NS_ASSERTION(NS_SUCCEEDED(rv), "Could not set pref in DIR_SetIntPref");
}

void DIR_SavePrefsForOneServer(DIR_Server *server)
{
  if (!server)
    return;

  char *prefstring;

  if (server->prefName == nsnull)
    server->prefName = dir_CreateServerPrefName(server);
  prefstring = server->prefName;

  server->savingServer = PR_TRUE;

  DIR_SetIntPref (prefstring, "position", server->position, kDefaultPosition);

  // Only save the non-default address book name
  DIR_SetLocalizedStringPref(prefstring, "description", server->description);

  DIR_SetStringPref(prefstring, "filename", server->fileName, "");
  DIR_SetIntPref(prefstring, "dirType", server->dirType, LDAPDirectory);

  if (server->dirType != PABDirectory)
    DIR_SetStringPref(prefstring, "uri", server->uri, "");

  server->savingServer = PR_FALSE;
}

static void DIR_SaveServerPreferences(nsVoidArray *wholeList)
{
  if (wholeList)
  {
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> pPref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv)); 
    if (NS_FAILED(rv)) {
      NS_WARNING("DIR_SaveServerPreferences: Failed to get the pref service\n");
      return;
    }

    PRInt32  i;
    PRInt32  count = wholeList->Count();
    DIR_Server *server;

    for (i = 0; i < count; i++)
    {
      server = (DIR_Server *) wholeList->ElementAt(i);
      if (server)
        DIR_SavePrefsForOneServer(server);
    }
    pPref->SetIntPref(PREF_LDAP_GLOBAL_TREE_NAME".user_id", dir_UserId);
  }
}
