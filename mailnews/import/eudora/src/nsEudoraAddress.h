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
  nsresult ImportAddresses(uint32_t *pBytes, bool *pAbort, const PRUnichar *pName, nsIFile *pSrc, nsIAddrDatabase *pDb, nsString& errors);


private:
  void       EmptyAliases(void);
  void      ProcessLine(const char *pLine, int32_t len, nsString& errors);
  int32_t     CountWhiteSpace(const char *pLine, int32_t len);
  CAliasEntry  *  ProcessAlias(const char *pLine, int32_t len, nsString& errors);
  void      ProcessNote(const char *pLine, int32_t len, nsString& errors);
  int32_t      GetAliasName(const char *pLine, int32_t len, nsCString& name);
  CAliasEntry *  ResolveAlias(nsCString& name);
  void       ResolveEntries(nsCString& name, nsVoidArray& list, nsVoidArray& result, bool addResolvedEntries, bool wasResolved, int32_t& numResolved);
  void      BuildABCards(uint32_t *pBytes, nsIAddrDatabase *pDb);
  void      AddSingleCard(CAliasEntry *pEntry, nsVoidArray &emailList, nsIAddrDatabase *pDb);
  nsresult  AddSingleList(CAliasEntry *pEntry, nsVoidArray &emailList, nsIAddrDatabase *pDb);
  nsresult  AddGroupMembersAsCards(nsVoidArray &membersArray, nsIAddrDatabase *pDb);
  void      RememberGroupMembers(nsVoidArray &membersArray, nsVoidArray &emailList);
  int32_t      FindAlias(nsCString& name);
  void      ExtractNoteField(nsCString& note, nsCString& field, const char *pFieldName);
  void FormatExtraDataInNoteField(int32_t labelStringID, nsCString& extraData, nsString& noteUTF16);
  void      SanitizeValue(nsCString& val);
  void      SplitString(nsCString& val1, nsCString& val2);

public:
  static int32_t     CountQuote(const char *pLine, int32_t len);
  static int32_t     CountComment(const char *pLine, int32_t len);
  static int32_t     CountAngle(const char *pLine, int32_t len);

private:
  nsVoidArray    m_alias;
};



#endif /* nsEudoraAddress_h__ */

