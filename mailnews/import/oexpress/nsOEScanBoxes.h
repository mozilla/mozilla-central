/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOEScanBoxes_h___
#define nsOEScanBoxes_h___

#include "prtypes.h"
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
    PRUint32  index;
    PRUint32  parent;
    PRInt32    child;
    PRInt32    sibling;
    PRInt32    type;
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

  MailboxEntry *  GetIndexEntry(PRUint32 index);
  void      AddChildEntry(MailboxEntry *pEntry, PRUint32 rootIndex);
  MailboxEntry *  NewMailboxEntry(PRUint32 id, PRUint32 parent, const char *prettyName, char *pFileName);
  void        ProcessPendingChildEntries(PRUint32 parent, PRUint32 rootIndex, nsVoidArray &childArray);
  void        RemoveProcessedChildEntries();


  bool        ReadLong(nsIInputStream * stream, PRInt32& val, PRUint32 offset);
  bool        ReadLong(nsIInputStream * stream, PRUint32& val, PRUint32 offset);
  bool        ReadString(nsIInputStream * stream, nsString& str, PRUint32 offset);
  bool        ReadString(nsIInputStream * stream, nsCString& str, PRUint32 offset);
  PRUint32     CountMailboxes(MailboxEntry *pBox);

  void       BuildMailboxList(MailboxEntry *pBox, nsIFile * root, PRInt32 depth, nsISupportsArray *pArray);
  bool         GetMailboxList(nsIFile * root, nsISupportsArray **pArray);

private:
  MailboxEntry *        m_pFirst;
  nsVoidArray          m_entryArray;
  nsVoidArray          m_pendingChildArray; // contains child folders whose parent folders have not showed up.

  nsCOMPtr<nsIImportService>  mService;
};

#endif // nsOEScanBoxes_h__
