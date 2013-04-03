/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"  // for pre-compiled headers

#include "nsImapCore.h"
#include "nsIMAPNamespace.h"
#include "nsImapProtocol.h"
#include "nsMsgImapCID.h"
#include "nsImapUrl.h"
#include "nsStringGlue.h"
#include "nsServiceManagerUtils.h"

//////////////////// nsIMAPNamespace  /////////////////////////////////////////////////////////////

static NS_DEFINE_CID(kCImapHostSessionListCID, NS_IIMAPHOSTSESSIONLIST_CID);

nsIMAPNamespace::nsIMAPNamespace(EIMAPNamespaceType type, const char *prefix, char delimiter, bool from_prefs)
{
	m_namespaceType = type;
	m_prefix = PL_strdup(prefix);
	m_fromPrefs = from_prefs;

	m_delimiter = delimiter;
	m_delimiterFilledIn = !m_fromPrefs;	// if it's from the prefs, we can't be sure about the delimiter until we list it.
}

nsIMAPNamespace::~nsIMAPNamespace()
{
	PR_FREEIF(m_prefix);
}

void nsIMAPNamespace::SetDelimiter(char delimiter, bool delimiterFilledIn)
{
  m_delimiter = delimiter;
  m_delimiterFilledIn = delimiterFilledIn;
}

// returns -1 if this box is not part of this namespace,
// or the length of the prefix if it is part of this namespace
int nsIMAPNamespace::MailboxMatchesNamespace(const char *boxname)
{
	if (!boxname) return -1;

	// If the namespace is part of the boxname
    if (!m_prefix || !*m_prefix)
        return 0;

	if (PL_strstr(boxname, m_prefix) == boxname)
		return PL_strlen(m_prefix);

	// If the boxname is part of the prefix
	// (Used for matching Personal mailbox with Personal/ namespace, etc.)
	if (PL_strstr(m_prefix, boxname) == m_prefix)
		return PL_strlen(boxname);
	return -1;
}


nsIMAPNamespaceList *nsIMAPNamespaceList::CreatensIMAPNamespaceList()
{
	nsIMAPNamespaceList *rv = new nsIMAPNamespaceList();
	return rv;
}

nsIMAPNamespaceList::nsIMAPNamespaceList()
{
}

int nsIMAPNamespaceList::GetNumberOfNamespaces()
{
	return m_NamespaceList.Count();
}


nsresult nsIMAPNamespaceList::InitFromString(const char *nameSpaceString, EIMAPNamespaceType nstype)
{
	nsresult rv = NS_OK;
	if (nameSpaceString)
	{
		int numNamespaces = UnserializeNamespaces(nameSpaceString, nullptr, 0);
		char **prefixes = (char**) PR_CALLOC(numNamespaces * sizeof(char*));
		if (prefixes)
		{
			int len = UnserializeNamespaces(nameSpaceString, prefixes, numNamespaces);
			for (int i = 0; i < len; i++)
			{
				char *thisns = prefixes[i];
				char delimiter = '/';	// a guess
				if (PL_strlen(thisns) >= 1)
					delimiter = thisns[PL_strlen(thisns)-1];
				nsIMAPNamespace *ns = new nsIMAPNamespace(nstype, thisns, delimiter, true);
				if (ns)
					AddNewNamespace(ns);
				PR_FREEIF(thisns);
			}
			PR_Free(prefixes);
		}
	}

	return rv;
}

nsresult nsIMAPNamespaceList::OutputToString(nsCString &string)
{
	nsresult rv = NS_OK;

	return rv;
}


int nsIMAPNamespaceList::GetNumberOfNamespaces(EIMAPNamespaceType type)
{
	int nodeIndex = 0, count = 0;
	for (nodeIndex=m_NamespaceList.Count()-1; nodeIndex >= 0; nodeIndex--)
	{
		nsIMAPNamespace *nspace = (nsIMAPNamespace *) m_NamespaceList.ElementAt(nodeIndex);
		if (nspace->GetType() == type)
		{
			count++;
		}
	}
	return count;
}

int nsIMAPNamespaceList::AddNewNamespace(nsIMAPNamespace *ns)
{
	// If the namespace is from the NAMESPACE response, then we should see if there
	// are any namespaces previously set by the preferences, or the default namespace.  If so, remove these.

	if (!ns->GetIsNamespaceFromPrefs())
	{
		int nodeIndex;
        // iterate backwards because we delete elements
		for (nodeIndex=m_NamespaceList.Count()-1; nodeIndex >= 0; nodeIndex--)
		{
			nsIMAPNamespace *nspace = (nsIMAPNamespace *) m_NamespaceList.ElementAt(nodeIndex);
			// if we find existing namespace(s) that matches the 
			// new one, we'll just remove the old ones and let the
			// new one get added when we've finished checking for
			// matching namespaces or namespaces that came from prefs.
			if (nspace &&
                            (nspace->GetIsNamespaceFromPrefs() ||
                            (!PL_strcmp(ns->GetPrefix(), nspace->GetPrefix()) &&
			     ns->GetType() == nspace->GetType() &&
			     ns->GetDelimiter() == nspace->GetDelimiter())))
			{
				m_NamespaceList.RemoveElementAt(nodeIndex);
				delete nspace; 
			}
		}
	}

	// Add the new namespace to the list.  This must come after the removing code,
	// or else we could never add the initial kDefaultNamespace type to the list.
	m_NamespaceList.AppendElement(ns);

	return 0;
}


// chrisf - later, fix this to know the real concept of "default" namespace of a given type
nsIMAPNamespace *nsIMAPNamespaceList::GetDefaultNamespaceOfType(EIMAPNamespaceType type)
{
	nsIMAPNamespace *rv = 0, *firstOfType = 0;

	int nodeIndex, count = m_NamespaceList.Count();
	for (nodeIndex= 0; nodeIndex < count && !rv; nodeIndex++)
	{
		nsIMAPNamespace *ns = (nsIMAPNamespace *) m_NamespaceList.ElementAt(nodeIndex);
		if (ns->GetType() == type)
		{
			if (!firstOfType)
				firstOfType = ns;
			if (!(*(ns->GetPrefix())))
			{
				// This namespace's prefix is ""
				// Therefore it is the default
				rv = ns;
			}
		}
	}
	if (!rv)
		rv = firstOfType;
	return rv;
}

nsIMAPNamespaceList::~nsIMAPNamespaceList()
{
	ClearNamespaces(true, true, true);
}

// ClearNamespaces removes and deletes the namespaces specified, and if there are no namespaces left,
void nsIMAPNamespaceList::ClearNamespaces(bool deleteFromPrefsNamespaces, bool deleteServerAdvertisedNamespaces, bool reallyDelete)
{
	int nodeIndex;
	
    // iterate backwards because we delete elements
	for (nodeIndex=m_NamespaceList.Count()-1; nodeIndex >= 0; nodeIndex--)
	{
		nsIMAPNamespace *ns = (nsIMAPNamespace *) m_NamespaceList.ElementAt(nodeIndex);
		if (ns->GetIsNamespaceFromPrefs())
		{
			if (deleteFromPrefsNamespaces)
			{
				m_NamespaceList.RemoveElementAt(nodeIndex);
				if (reallyDelete)
					delete ns;
			}
		}
		else if (deleteServerAdvertisedNamespaces)
		{
			m_NamespaceList.RemoveElementAt(nodeIndex);
			if (reallyDelete)
				delete ns;
		}
	}
}

nsIMAPNamespace *nsIMAPNamespaceList::GetNamespaceNumber(int nodeIndex)
{
  NS_ASSERTION(nodeIndex >= 0 && nodeIndex < GetNumberOfNamespaces(), "invalid IMAP namespace node index");
  if (nodeIndex < 0) nodeIndex = 0;

  // XXX really could be just ElementAt; that's why we have the assertion
  return 	(nsIMAPNamespace *) m_NamespaceList.SafeElementAt(nodeIndex);
}

nsIMAPNamespace *nsIMAPNamespaceList::GetNamespaceNumber(int nodeIndex, EIMAPNamespaceType type)
{
  int nodeCount, count = 0;
  for (nodeCount=m_NamespaceList.Count()-1; nodeCount >= 0; nodeCount--)
  {
    nsIMAPNamespace *nspace = (nsIMAPNamespace *) m_NamespaceList.ElementAt(nodeCount);
    if (nspace->GetType() == type)
    {
      count++;
      if (count == nodeIndex)
        return nspace;
    }
  }
  return nullptr;
}

nsIMAPNamespace *nsIMAPNamespaceList::GetNamespaceForMailbox(const char *boxname)
{
  // We want to find the LONGEST substring that matches the beginning of this mailbox's path.
  // This accounts for nested namespaces  (i.e. "Public/" and "Public/Users/")
  
  // Also, we want to match the namespace's mailbox to that namespace also:
  // The Personal box will match the Personal/ namespace, etc.
  
  // these lists shouldn't be too long (99% chance there won't be more than 3 or 4)
  // so just do a linear search
  
  int lengthMatched = -1;
  int currentMatchedLength = -1;
  nsIMAPNamespace *rv = nullptr;
  int nodeIndex = 0;
  
  if (!PL_strcasecmp(boxname, "INBOX"))
    return GetDefaultNamespaceOfType(kPersonalNamespace);
  
  for (nodeIndex=m_NamespaceList.Count()-1; nodeIndex >= 0; nodeIndex--)
  {
    nsIMAPNamespace *nspace = (nsIMAPNamespace *) m_NamespaceList.ElementAt(nodeIndex);
    currentMatchedLength = nspace->MailboxMatchesNamespace(boxname);
    if (currentMatchedLength > lengthMatched)
    {
      rv = nspace;
      lengthMatched = currentMatchedLength;
    }
  }
  
  return rv;
}

#define SERIALIZER_SEPARATORS ","

/**
 * If len is one, copies the first element of prefixes into serializedNamespaces.
 * If len > 1, copies len strings from prefixes into serializedNamespaces
 * as a comma-separated list of quoted strings.
 */
nsresult nsIMAPNamespaceList::SerializeNamespaces(char **prefixes, int len,
                                                  nsCString &serializedNamespaces)
{
  if (len <= 0)
    return NS_OK;

  if (len == 1)
  {
    serializedNamespaces.Assign(prefixes[0]);
    return NS_OK;
  }

  for (int i = 0; i < len; i++)
  {
    if (i > 0)
      serializedNamespaces.AppendLiteral(",");

    serializedNamespaces.AppendLiteral("\"");
    serializedNamespaces.Append(prefixes[i]);
    serializedNamespaces.AppendLiteral("\"");
  }
  return NS_OK;
}

/* str is the string which needs to be unserialized.
   If prefixes is NULL, simply returns the number of namespaces in str.  (len is ignored)
   If prefixes is not NULL, it should be an array of length len which is to be filled in
   with newly-allocated string.  Returns the number of strings filled in.
*/
int nsIMAPNamespaceList::UnserializeNamespaces(const char *str, char **prefixes, int len)
{
  if (!str)
    return 0;
  if (!prefixes)
  {
    if (str[0] != '"')
      return 1;
    else
    {
      int count = 0;
      char *ourstr = PL_strdup(str);
      char *origOurStr = ourstr;
      if (ourstr)
      {
        char *token = NS_strtok(SERIALIZER_SEPARATORS, &ourstr );
        while (token != nullptr)
        {
          token = NS_strtok(SERIALIZER_SEPARATORS, &ourstr );
          count++;
        }
        PR_Free(origOurStr);
      }
      return count;
    }
  }
  else
  {
    if ((str[0] != '"') && (len >= 1))
    {
      prefixes[0] = PL_strdup(str);
      return 1;
    }
    else
    {
      int count = 0;
      char *ourstr = PL_strdup(str);
      char *origOurStr = ourstr;
      if (ourstr)
      {
        char *token = NS_strtok(SERIALIZER_SEPARATORS, &ourstr );
        while ((count < len) && (token != nullptr))
        {
          
          char *current = PL_strdup(token), *where = current;
          if (where[0] == '"')
            where++;
          if (where[PL_strlen(where)-1] == '"')
            where[PL_strlen(where)-1] = 0;
          prefixes[count] = PL_strdup(where);
          PR_FREEIF(current);
          token = NS_strtok(SERIALIZER_SEPARATORS, &ourstr );
          count++;
        }
        PR_Free(origOurStr);
      }
      return count;
    }
  }
}




char *nsIMAPNamespaceList::AllocateCanonicalFolderName(const char *onlineFolderName, char delimiter)
{
  char *canonicalPath = nullptr;
  if (delimiter)
    canonicalPath = nsImapUrl::ReplaceCharsInCopiedString(onlineFolderName, delimiter , '/');
  else
    canonicalPath = PL_strdup(onlineFolderName);
  
  // eat any escape characters for escaped dir separators
  if (canonicalPath)
  {
    char *currentEscapeSequence = strstr(canonicalPath, "\\/");
    while (currentEscapeSequence)
    {
      strcpy(currentEscapeSequence, currentEscapeSequence+1);
      currentEscapeSequence = strstr(currentEscapeSequence+1, "\\/");
    }
  }
  
  return canonicalPath;
}



/*
  GetFolderNameWithoutNamespace takes as input a folder name
  in canonical form, and the namespace for the given folder.  It returns an allocated
  string of the folder's path with the namespace string stripped out.  For instance,
  when passed the folder Folders/a/b where the namespace is "Folders/", it will return
  "a/b".  Similarly, if the folder name is "#news/comp/mail/imap" in canonical form,
  with a real delimiter of "." and a namespace of "#news.", it will return "comp/mail/imap".
  The return value is always in canonical form.
*/
char* nsIMAPNamespaceList::GetFolderNameWithoutNamespace(nsIMAPNamespace *namespaceForFolder, const char *canonicalFolderName)
{
  NS_ASSERTION(canonicalFolderName, "null folder name");
#ifdef DEBUG
  NS_ASSERTION(namespaceForFolder || !PL_strcasecmp(canonicalFolderName, "INBOX"), "need namespace or INBOX");
#endif
  
  char *retFolderName = nullptr;
  
  if (!PL_strcasecmp(canonicalFolderName, "INBOX"))
    return PL_strdup(canonicalFolderName);
  
  // convert the canonical path to the online path
  char *convertedFolderName = nsIMAPNamespaceList::AllocateServerFolderName(canonicalFolderName, namespaceForFolder->GetDelimiter());
  if (convertedFolderName)
  {
    char *beginFolderPath = nullptr;
    if (strlen(convertedFolderName) <= strlen(namespaceForFolder->GetPrefix()))
      beginFolderPath = convertedFolderName;
    else
      beginFolderPath = convertedFolderName + strlen(namespaceForFolder->GetPrefix());
    NS_ASSERTION(beginFolderPath, "empty folder path");
    retFolderName = nsIMAPNamespaceList::AllocateCanonicalFolderName(beginFolderPath, namespaceForFolder->GetDelimiter());
    PR_Free(convertedFolderName);
  }
  
  NS_ASSERTION(retFolderName, "returning null folder name");
  return retFolderName;
}


nsIMAPNamespace* nsIMAPNamespaceList::GetNamespaceForFolder(const char *hostName,
                                                    const char *canonicalFolderName,
                                                    char delimiter)
{
  if (!hostName || !canonicalFolderName)
    return nullptr;
  
  nsIMAPNamespace *resultNamespace = nullptr;
  nsresult rv;
  char *convertedFolderName = nsIMAPNamespaceList::AllocateServerFolderName(canonicalFolderName, delimiter);

  if (convertedFolderName)
  {

    nsCOMPtr<nsIImapHostSessionList> hostSessionList = 
             do_GetService(kCImapHostSessionListCID, &rv);
    if (NS_FAILED(rv)) 
      return nullptr;
    hostSessionList->GetNamespaceForMailboxForHost(hostName, convertedFolderName, resultNamespace);
    PR_Free(convertedFolderName);
  }
  else
  {
    NS_ASSERTION(false, "couldn't get converted folder name");
  }
  
  return resultNamespace;
}

/* static */
char *nsIMAPNamespaceList::AllocateServerFolderName(const char *canonicalFolderName, char delimiter)
{
  if (delimiter)
    return nsImapUrl::ReplaceCharsInCopiedString(canonicalFolderName, '/', delimiter);
  else
    return NS_strdup(canonicalFolderName);
}

/*
	GetFolderOwnerNameFromPath takes as inputs a folder name
	in canonical form, and a namespace for that folder.
	The namespace MUST be of type kOtherUsersNamespace, hence the folder MUST be
	owned by another user.  This function extracts the folder owner's name from the
	canonical name of the folder, and returns an allocated copy of that owner's name
*/
/* static */
char *nsIMAPNamespaceList::GetFolderOwnerNameFromPath(nsIMAPNamespace *namespaceForFolder, const char *canonicalFolderName)
{
  if (!namespaceForFolder || !canonicalFolderName)
  {
    NS_ASSERTION(false,"null namespace or canonical folder name");
    return nullptr;
  }
  
  char *rv = nullptr;
  
  // convert the canonical path to the online path
  char *convertedFolderName = AllocateServerFolderName(canonicalFolderName, namespaceForFolder->GetDelimiter());
  if (convertedFolderName)
  {
#ifdef DEBUG
    NS_ASSERTION(strlen(convertedFolderName) > strlen(namespaceForFolder->GetPrefix()), "server folder name invalid");
#endif
    if (strlen(convertedFolderName) > strlen(namespaceForFolder->GetPrefix()))
    {
      char *owner = convertedFolderName + strlen(namespaceForFolder->GetPrefix());
      NS_ASSERTION(owner, "couldn't find folder owner");
      char *nextDelimiter = strchr(owner, namespaceForFolder->GetDelimiter());
      // if !nextDelimiter, then the path is of the form Shared/Users/chrisf   (no subfolder)
      if (nextDelimiter)
      {
        *nextDelimiter = 0;
      }
      rv = PL_strdup(owner);
    }
    PR_Free(convertedFolderName);
  }
  else
  {
    NS_ASSERTION(false, "couldn't allocate server folder name");
  }
  
  return rv;
}

/*
GetFolderIsNamespace returns TRUE if the given folder is the folder representing
a namespace.
*/

bool nsIMAPNamespaceList::GetFolderIsNamespace(const char *hostName,
                                                 const char *canonicalFolderName,
                                                 char delimiter,nsIMAPNamespace *namespaceForFolder)
{
  NS_ASSERTION(namespaceForFolder, "null namespace");
  
  bool rv = false;
  
  const char *prefix = namespaceForFolder->GetPrefix();
  NS_ASSERTION(prefix, "namespace has no prefix");
  if (!prefix || !*prefix)	// empty namespace prefix
    return false;
  
  char *convertedFolderName = AllocateServerFolderName(canonicalFolderName, delimiter);
  if (convertedFolderName)
  {
    bool lastCharIsDelimiter = (prefix[strlen(prefix) - 1] == delimiter);
    
    if (lastCharIsDelimiter)
    {
      rv = ((strncmp(convertedFolderName, prefix, strlen(convertedFolderName)) == 0) &&
        (strlen(convertedFolderName) == strlen(prefix) - 1));
    }
    else
    {
      rv = (strcmp(convertedFolderName, prefix) == 0);
    }
    
    PR_Free(convertedFolderName);
  }
  else
  {
    NS_ASSERTION(false, "couldn't allocate server folder name");
  }
  
  return rv;
}

/*
  SuggestHierarchySeparatorForNamespace takes a namespace from libmsg
  and a hierarchy delimiter.  If the namespace has not been filled in from
  online NAMESPACE command yet, it fills in the suggested delimiter to be
  used from then on (until it is overridden by an online response).
*/

void nsIMAPNamespaceList::SuggestHierarchySeparatorForNamespace(nsIMAPNamespace *namespaceForFolder, char delimiterFromFolder)
{
  NS_ASSERTION(namespaceForFolder, "need namespace");
  if (namespaceForFolder && !namespaceForFolder->GetIsDelimiterFilledIn())
    namespaceForFolder->SetDelimiter(delimiterFromFolder, false);
}


/*
 GenerateFullFolderNameWithDefaultNamespace takes a folder name in canonical form,
  converts it to online form, allocates a string to contain the full online server name
  including the namespace prefix of the default namespace of the given type, in the form:
  PR_smprintf("%s%s", prefix, onlineServerName) if there is a NULL owner
  PR_smprintf("%s%s%c%s", prefix, owner, delimiter, onlineServerName) if there is an owner
  It then converts this back to canonical form and returns it (allocated) to libmsg.
  It returns NULL if there is no namespace of the given type.
  If nsUsed is not passed in as NULL, then *nsUsed is filled in and returned;  it is the
  namespace used for generating the folder name.
*/
char *nsIMAPNamespaceList::GenerateFullFolderNameWithDefaultNamespace(const char *hostName,
                                                                                const char *canonicalFolderName,
                                                                                const char *owner,
                                                                                EIMAPNamespaceType nsType,
                                                                                nsIMAPNamespace **nsUsed)
{
  nsresult rv = NS_OK;

  nsCOMPtr<nsIImapHostSessionList> hostSession = 
           do_GetService(kCImapHostSessionListCID, &rv);
  NS_ENSURE_SUCCESS(rv, nullptr);
  nsIMAPNamespace *ns;
  char *fullFolderName = nullptr;
  rv = hostSession->GetDefaultNamespaceOfTypeForHost(hostName, nsType, ns);
  NS_ENSURE_SUCCESS(rv, nullptr);
  if (ns)
  {
    if (nsUsed)
      *nsUsed = ns;
    const char *prefix = ns->GetPrefix();
    char *convertedFolderName = AllocateServerFolderName(canonicalFolderName, ns->GetDelimiter());
    if (convertedFolderName)
    {
      char *convertedReturnName = nullptr;
      if (owner)
      {
        convertedReturnName = PR_smprintf("%s%s%c%s", prefix, owner, ns->GetDelimiter(), convertedFolderName);
      }
      else
      {
        convertedReturnName = PR_smprintf("%s%s", prefix, convertedFolderName);
      }
      
      if (convertedReturnName)
      {
        fullFolderName = AllocateCanonicalFolderName(convertedReturnName, ns->GetDelimiter());
        PR_Free(convertedReturnName);
      }
      PR_Free(convertedFolderName);
    }
    else
    {
      NS_ASSERTION(false, "couldn't allocate server folder name");
    }
  }
  else
  {
    // Could not find other users namespace on the given host
    NS_ASSERTION(false, "couldn't find namespace for given host");
  }
  return (fullFolderName);
}

