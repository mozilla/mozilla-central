/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

#ifndef nsMsgSearchSession_h___
#define nsMsgSearchSession_h___

#include "nscore.h"
#include "nsMsgSearchCore.h"
#include "nsIMsgSearchSession.h"
#include "nsIUrlListener.h"
#include "nsIMsgWindow.h"
#include "nsITimer.h"
#include "nsMsgSearchArray.h"
#include "nsISupportsArray.h"
#include "nsCOMArray.h"
#include "nsWeakReference.h"
#include "nsTObserverArray.h"

class nsMsgSearchAdapter;
class nsMsgSearchBoolExpression;

class nsMsgSearchSession : public nsIMsgSearchSession, public nsIUrlListener, public nsSupportsWeakReference
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGSEARCHSESSION
  NS_DECL_NSIURLLISTENER

  nsMsgSearchSession();
  virtual ~nsMsgSearchSession();

protected:
  nsWeakPtr m_msgWindowWeak;
  nsresult Initialize();
  nsresult StartTimer();
  nsresult TimeSlice (PRBool *aDone);
  nsMsgSearchScopeTerm *GetRunningScope();
  void StopRunning();
  nsresult BeginSearching();
  nsresult DoNextSearch();
  nsresult BuildUrlQueue ();
  nsresult AddUrl(const char *url);
  nsresult SearchWOUrls ();
  nsresult GetNextUrl();
  nsresult NotifyListenersDone(nsresult status);
  void EnableFolderNotifications(PRBool aEnable);
  void ReleaseFolderDBRef();

  nsMsgSearchScopeTermArray m_scopeList;
  nsCOMPtr <nsISupportsArray> m_termList;

  nsTArray<nsCOMPtr<nsIMsgSearchNotify> > m_listenerList;
  nsTArray<PRInt32> m_listenerFlagList;
  /**
   * Iterator index for m_listenerList/m_listenerFlagList.  We used to use an
   * nsTObserverArray for m_listenerList but its auto-adjusting iterator was
   * not helping us keep our m_listenerFlagList iterator correct.
   *
   * We are making the simplifying assumption that our notifications are
   * non-reentrant.  In the exceptional case that it turns out they are
   * reentrant, we assume that this is the result of canceling a search while
   * the session is active and initiating a new one.  In that case, we assume
   * the outer iteration can safely be abandoned.
   *
   * This value is defined to be the index of the next listener we will process.
   * This allows us to use the sentinel value of -1 to convey that no iteration
   * is in progress (and the iteration process to abort if the value transitions
   * to -1, which we always set on conclusion of our loop).
   */
  PRInt32 m_iListener;

  nsMsgResultArray m_resultList;

  void DestroyTermList ();
  void DestroyScopeList ();
  void DestroyResultList ();

  static void TimerCallback(nsITimer *aTimer, void *aClosure);
  // support for searching multiple scopes in serial
  nsresult TimeSliceSerial (PRBool *aDone);
  nsresult TimeSliceParallel ();

  nsMsgSearchAttribValue m_sortAttribute;
  PRInt32 m_idxRunningScope;
  nsMsgSearchType m_searchType;
  PRBool m_handlingError;
  PRInt32 m_urlQueueIndex;
  nsCStringArray m_urlQueue;
  nsCOMPtr <nsITimer> m_backgroundTimer;
  PRBool m_searchPaused;
  nsMsgSearchBoolExpression *m_expressionTree;
};

#endif
