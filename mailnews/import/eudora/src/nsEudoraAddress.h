/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsEudoraAddress_h__
#define nsEudoraAddress_h__

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsVoidArray.h"
#include "nsIFile.h"
#include "nsISupportsArray.h"
#include "nsCOMPtr.h"
#include "nsIImportService.h"


class nsIAddrDatabase;
class CAliasEntry;
class CAliasData;
class nsIStringBundle;

/////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////

class nsEudoraAddress {
public:
  nsEudoraAddress();
  virtual ~nsEudoraAddress();

  // Things that must be overridden because they are platform specific.
    // retrieve the mail folder
  virtual bool      FindAddressFolder(nsIFile **pFolder) { return false;}
    // get the list of mailboxes
  virtual nsresult  FindAddressBooks(nsIFile *pRoot, nsISupportsArray **ppArray) { return NS_ERROR_FAILURE;}

  // Non-platform specific common stuff
    // import a mailbox
  nsresult ImportAddresses(PRUint32 *pBytes, bool *pAbort, const PRUnichar *pName, nsIFile *pSrc, nsIAddrDatabase *pDb, nsString& errors);


private:
  void       EmptyAliases(void);
  void      ProcessLine(const char *pLine, PRInt32 len, nsString& errors);
  PRInt32     CountWhiteSpace(const char *pLine, PRInt32 len);
  CAliasEntry  *  ProcessAlias(const char *pLine, PRInt32 len, nsString& errors);
  void      ProcessNote(const char *pLine, PRInt32 len, nsString& errors);
  PRInt32      GetAliasName(const char *pLine, PRInt32 len, nsCString& name);
  CAliasEntry *  ResolveAlias(nsCString& name);
  void       ResolveEntries(nsCString& name, nsVoidArray& list, nsVoidArray& result, bool addResolvedEntries, bool wasResolved, PRInt32& numResolved);
  void      BuildABCards(PRUint32 *pBytes, nsIAddrDatabase *pDb);
  void      AddSingleCard(CAliasEntry *pEntry, nsVoidArray &emailList, nsIAddrDatabase *pDb);
  nsresult  AddSingleList(CAliasEntry *pEntry, nsVoidArray &emailList, nsIAddrDatabase *pDb);
  nsresult  AddGroupMembersAsCards(nsVoidArray &membersArray, nsIAddrDatabase *pDb);
  void      RememberGroupMembers(nsVoidArray &membersArray, nsVoidArray &emailList);
  PRInt32      FindAlias(nsCString& name);
  void      ExtractNoteField(nsCString& note, nsCString& field, const char *pFieldName);
  void FormatExtraDataInNoteField(PRInt32 labelStringID, nsCString& extraData, nsString& noteUTF16);
  void      SanitizeValue(nsCString& val);
  void      SplitString(nsCString& val1, nsCString& val2);

public:
  static PRInt32     CountQuote(const char *pLine, PRInt32 len);
  static PRInt32     CountComment(const char *pLine, PRInt32 len);
  static PRInt32     CountAngle(const char *pLine, PRInt32 len);

private:
  nsVoidArray    m_alias;
};



#endif /* nsEudoraAddress_h__ */

