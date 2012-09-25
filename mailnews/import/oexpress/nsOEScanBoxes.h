/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOEScanBoxes_h___
#define nsOEScanBoxes_h___

#include "nsStringGlue.h"
#include "nsIImportModule.h"
#include "nsVoidArray.h"
#include "nsISupportsArray.h"
#include "nsIFile.h"
#include "nsIImportService.h"

class nsIInputStream;

class nsOEScanBoxes {
public:
  nsOEScanBoxes();
  ~nsOEScanBoxes();

  static bool    FindMail(nsIFile *pWhere);

  bool    GetMailboxes(nsIFile *pWhere, nsISupportsArray **pArray);


private:
  typedef struct {
    uint32_t  index;
    uint32_t  parent;
    int32_t    child;
    int32_t    sibling;
    int32_t    type;
    nsString  mailName;
    nsCString  fileName;
    bool      processed; // used by entries on m_pendingChildArray list
  } MailboxEntry;

  static bool    Find50Mail(nsIFile *pWhere);

  void  Reset(void);
  bool    FindMailBoxes(nsIFile * descFile);
  bool    Find50MailBoxes(nsIFile * descFile);

  // If find mailboxes fails you can use this routine to get the raw mailbox file names
  void  ScanMailboxDir(nsIFile * srcDir);
  bool    Scan50MailboxDir(nsIFile * srcDir);

  MailboxEntry *  GetIndexEntry(uint32_t index);
  void      AddChildEntry(MailboxEntry *pEntry, uint32_t rootIndex);
  MailboxEntry *  NewMailboxEntry(uint32_t id, uint32_t parent, const char *prettyName, char *pFileName);
  void        ProcessPendingChildEntries(uint32_t parent, uint32_t rootIndex, nsVoidArray &childArray);
  void        RemoveProcessedChildEntries();


  bool        ReadLong(nsIInputStream * stream, int32_t& val, uint32_t offset);
  bool        ReadLong(nsIInputStream * stream, uint32_t& val, uint32_t offset);
  bool        ReadString(nsIInputStream * stream, nsString& str, uint32_t offset);
  bool        ReadString(nsIInputStream * stream, nsCString& str, uint32_t offset);
  uint32_t     CountMailboxes(MailboxEntry *pBox);

  void       BuildMailboxList(MailboxEntry *pBox, nsIFile * root, int32_t depth, nsISupportsArray *pArray);
  bool         GetMailboxList(nsIFile * root, nsISupportsArray **pArray);

private:
  MailboxEntry *        m_pFirst;
  nsVoidArray          m_entryArray;
  nsVoidArray          m_pendingChildArray; // contains child folders whose parent folders have not showed up.

  nsCOMPtr<nsIImportService>  mService;
};

#endif // nsOEScanBoxes_h__
