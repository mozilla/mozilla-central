/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _NSDIRPREFS_H_
#define _NSDIRPREFS_H_

//
// XXX nsDirPrefs is being greatly reduced if not removed altogether. Directory
// Prefs etc. should be handled via their appropriate nsAb*Directory classes.
//

class nsVoidArray;

#define kPreviousListVersion   2
#define kCurrentListVersion    3
#define PREF_LDAP_GLOBAL_TREE_NAME "ldap_2"
#define PREF_LDAP_VERSION_NAME     "ldap_2.version"
#define PREF_LDAP_SERVER_TREE_NAME "ldap_2.servers"

#define kMainLdapAddressBook "ldap.mab"   /* v3 main ldap address book file */

/* DIR_Server.dirType */
typedef enum
{
	LDAPDirectory,
	HTMLDirectory,
  PABDirectory,
  MAPIDirectory,
  FixedQueryLDAPDirectory = 777
} DirectoryType;

typedef enum
{
	idNone = 0,					/* Special value                          */ 
	idPrefName,
	idPosition, 
	idDescription,
	idFileName,
	idUri,
	idType
} DIR_PrefId;

#define DIR_Server_typedef 1     /* this quiets a redeclare warning in libaddr */

typedef struct DIR_Server
{
	/* Housekeeping fields */
	char   *prefName;			/* preference name, this server's subtree */
	int32_t  position;			/* relative position in server list       */

	/* General purpose fields */
	char   *description;		/* human readable name                    */
	char   *fileName;			/* XP path name of local DB               */
	DirectoryType dirType;	
  char    *uri;       // URI of the address book

  // Set whilst saving the server to avoid updating it again
  bool savingServer;
} DIR_Server;

/* We are developing a new model for managing DIR_Servers. In the 4.0x world, the FEs managed each list. 
	Calls to FE_GetDirServer caused the FEs to manage and return the DIR_Server list. In our new view of the
	world, the back end does most of the list management so we are going to have the back end create and 
	manage the list. Replace calls to FE_GetDirServers() with DIR_GetDirServers(). */

nsVoidArray* DIR_GetDirectories();
DIR_Server* DIR_GetServerFromList(const char* prefName);
nsresult DIR_ShutDown(void);  /* FEs should call this when the app is shutting down. It frees all DIR_Servers regardless of ref count values! */

nsresult DIR_AddNewAddressBook(const nsAString &dirName,
                               const nsACString &fileName,
                               const nsACString &uri, 
                               DirectoryType dirType,
                               const nsACString &prefName,
                               DIR_Server** pServer);
nsresult DIR_ContainsServer(DIR_Server* pServer, bool *hasDir);

nsresult DIR_DeleteServerFromList (DIR_Server *);

void    DIR_SavePrefsForOneServer(DIR_Server *server);

void DIR_SetServerFileName(DIR_Server* pServer);

#endif /* dirprefs.h */
