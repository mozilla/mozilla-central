/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsIMAPNamespace_H_
#define _nsIMAPNamespace_H_

#include "nsVoidArray.h"

class nsIMAPNamespace
{
  
public:
  nsIMAPNamespace(EIMAPNamespaceType type, const char *prefix, char delimiter, bool from_prefs);
  
  ~nsIMAPNamespace();
  
  EIMAPNamespaceType    GetType() { return m_namespaceType; }
  const char *          GetPrefix() { return m_prefix; }
  char                  GetDelimiter() { return m_delimiter; }
  void                  SetDelimiter(char delimiter, bool delimiterFilledIn);
  bool                  GetIsDelimiterFilledIn() { return m_delimiterFilledIn; }
  bool                  GetIsNamespaceFromPrefs() { return m_fromPrefs; }
  
  // returns -1 if this box is not part of this namespace,
  // or the length of the prefix if it is part of this namespace
  int                   MailboxMatchesNamespace(const char *boxname);
  
protected:
  EIMAPNamespaceType m_namespaceType;
  char    *m_prefix;
  char    m_delimiter;
  bool    m_fromPrefs;
  bool    m_delimiterFilledIn;
  
};


// represents an array of namespaces for a given host
class nsIMAPNamespaceList
{
public:
  ~nsIMAPNamespaceList();
  
  static nsIMAPNamespaceList *CreatensIMAPNamespaceList();
  
  nsresult InitFromString(const char *nameSpaceString, EIMAPNamespaceType nstype);
  nsresult OutputToString(nsCString &OutputString);
  int UnserializeNamespaces(const char *str, char **prefixes, int len);
  nsresult SerializeNamespaces(char **prefixes, int len, nsCString &serializedNamespace);
  
  void ClearNamespaces(bool deleteFromPrefsNamespaces, bool deleteServerAdvertisedNamespaces, bool reallyDelete);
  int	GetNumberOfNamespaces();
  int	GetNumberOfNamespaces(EIMAPNamespaceType);
  nsIMAPNamespace *GetNamespaceNumber(int nodeIndex);
  nsIMAPNamespace *GetNamespaceNumber(int nodeIndex, EIMAPNamespaceType);
  
  nsIMAPNamespace *GetDefaultNamespaceOfType(EIMAPNamespaceType type);
  int AddNewNamespace(nsIMAPNamespace *ns);
  nsIMAPNamespace *GetNamespaceForMailbox(const char *boxname);
  static nsIMAPNamespace* GetNamespaceForFolder(const char *hostName,
                                           const char *canonicalFolderName,
                                           char delimiter);
  static bool GetFolderIsNamespace(const char *hostName,
                              const char *canonicalFolderName,
                              char delimiter,nsIMAPNamespace *namespaceForFolder);
  static char* GetFolderNameWithoutNamespace(nsIMAPNamespace *namespaceForFolder, const char *canonicalFolderName);
  static char *AllocateServerFolderName(const char *canonicalFolderName, char delimiter);
  static char *GetFolderOwnerNameFromPath(nsIMAPNamespace *namespaceForFolder, const char *canonicalFolderName);
  static char *AllocateCanonicalFolderName(const char *onlineFolderName, char delimiter);
  static void  SuggestHierarchySeparatorForNamespace(nsIMAPNamespace *namespaceForFolder, char delimiterFromFolder);
  static char *GenerateFullFolderNameWithDefaultNamespace(const char *hostName,
                                                                                const char *canonicalFolderName,
                                                                                const char *owner,
                                                                                EIMAPNamespaceType nsType,
                                                                                nsIMAPNamespace **nsUsed);

protected:
  nsIMAPNamespaceList();	// use CreatensIMAPNamespaceList to create one
  
  nsVoidArray m_NamespaceList;
  
};


#endif
