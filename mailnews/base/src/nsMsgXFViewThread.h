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
 * David Bienvenu.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
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
#ifndef nsMsgXFViewThread_h__
#define nsMsgXFViewThread_h__

#include "msgCore.h"
#include "nsCOMArray.h"
#include "nsIMsgThread.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsMsgDBView.h"

class nsMsgSearchDBView;

class nsMsgXFViewThread : public nsIMsgThread
{
public:

  nsMsgXFViewThread(nsMsgSearchDBView *view);
  virtual ~nsMsgXFViewThread();

  NS_DECL_NSIMSGTHREAD
  NS_DECL_ISUPPORTS

  PRBool    IsHdrParentOf(nsIMsgDBHdr *possibleParent,
                          nsIMsgDBHdr *possibleChild);

  void      ChangeUnreadChildCount(PRInt32 delta);
  void      ChangeChildCount(PRInt32 delta);

  nsresult  AddHdr(nsIMsgDBHdr *newHdr, PRBool reparentChildren, 
                   PRUint32 &whereInserted, nsIMsgDBHdr **outParent);
  PRInt32   HdrIndex(nsIMsgDBHdr *hdr);
  PRUint32  ChildLevelAt(PRUint32 msgIndex) {return m_levels[msgIndex];}
  PRUint32  MsgCount() {return m_numChildren;};

protected:
  nsMsgSearchDBView *m_view;
  PRUint32        m_numUnreadChildren;	
  PRUint32        m_numChildren;
  PRUint32        m_flags;
  PRUint32        m_newestMsgDate;
  nsTArray<nsMsgKey> m_keys;
  nsCOMArray<nsIMsgFolder> m_folders;
  nsTArray<PRUint8> m_levels;
};

#endif
