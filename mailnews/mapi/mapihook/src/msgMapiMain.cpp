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
 * The Original Code is Mozilla
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corp.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Krishna Mohan Khandrika (kkhandrika@netscape.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include <mapidefs.h>
#include <mapi.h>

#include "msgCore.h"
#include "nsComposeStrings.h"
#include "msgMapiMain.h"
#include "nsIServiceManager.h"
#include "nsCOMPtr.h"

nsMAPIConfiguration *nsMAPIConfiguration::m_pSelfRef = nsnull;
PRUint32 nsMAPIConfiguration::session_generator = 0;
PRUint32 nsMAPIConfiguration::sessionCount = 0;

nsMAPIConfiguration *nsMAPIConfiguration::GetMAPIConfiguration()
{
  if (m_pSelfRef == nsnull)
    m_pSelfRef = new nsMAPIConfiguration();

  return m_pSelfRef;
}

nsMAPIConfiguration::nsMAPIConfiguration()
: m_nMaxSessions(MAX_SESSIONS)
{
  m_Lock = PR_NewLock();
  m_SessionMap.Init();
  m_ProfileMap.Init();
}

nsMAPIConfiguration::~nsMAPIConfiguration()
{
  if (m_Lock)
    PR_DestroyLock(m_Lock);
}

void nsMAPIConfiguration::OpenConfiguration()
{
  // No. of max. sessions is set to MAX_SESSIONS.  In future
  // if it is decided to have configuration (registry)
  // parameter, this function can be used to set the
  // max sessions;

  return;
}

PRInt16 nsMAPIConfiguration::RegisterSession(PRUint32 aHwnd,
                const PRUnichar *aUserName, const PRUnichar *aPassword,
                PRBool aForceDownLoad, PRBool aNewSession,
                PRUint32 *aSession, const char *aIdKey)
{
  PRInt16 nResult = 0;
  PRUint32 n_SessionId = 0;

  PR_Lock(m_Lock);

  // Check whether max sessions is exceeded

  if (sessionCount >= m_nMaxSessions)
  {
    PR_Unlock(m_Lock);
    return -1;
  }

  if (aUserName != nsnull && aUserName[0] != '\0')
    m_ProfileMap.Get(nsDependentString(aUserName), &n_SessionId);

  // try to share a session; if not create a session
  if (n_SessionId > 0)
  {
    nsMAPISession *pTemp = nsnull;
    m_SessionMap.Get(n_SessionId, &pTemp);
    if (pTemp != nsnull)
    {
      pTemp->IncrementSession();
      *aSession = n_SessionId;
      nResult = 1;
    }
  }
  else if (aNewSession || n_SessionId == 0) // checking for n_SessionId is a concession
  {
    // create a new session; if new session is specified OR there is no session
    nsMAPISession *pTemp = nsnull;
    pTemp = new nsMAPISession(aHwnd, aUserName,
                           aPassword, aForceDownLoad, aIdKey);

    if (pTemp != nsnull)
    {
      session_generator++;

      // I don't think there will be (2 power 32) sessions alive
      // in a cycle.  This is an assumption

      if (session_generator == 0)
          session_generator++;
      m_SessionMap.Put(session_generator, pTemp);
      if (aUserName != nsnull && aUserName[0] != '\0')
        m_ProfileMap.Put(nsDependentString(aUserName), session_generator);
      *aSession = session_generator;
      sessionCount++;
      nResult = 1;
    }
  }

  PR_Unlock(m_Lock);
  return nResult;
}

PRBool nsMAPIConfiguration::UnRegisterSession(PRUint32 aSessionID)
{
  PRBool bResult = PR_FALSE;

  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nsnull;
    m_SessionMap.Get(aSessionID, &pTemp);

    if (pTemp != nsnull)
    {
      if (pTemp->DecrementSession() == 0)
      {
        if (pTemp->m_pProfileName.get() != nsnull)
          m_ProfileMap.Remove(pTemp->m_pProfileName);
        m_SessionMap.Remove(aSessionID);
        sessionCount--;
        bResult = PR_TRUE;
      }
    }
  }

  PR_Unlock(m_Lock);
  return bResult;
}

PRBool nsMAPIConfiguration::IsSessionValid(PRUint32 aSessionID)
{
  if (aSessionID == 0)
    return PR_FALSE;
  PRBool retValue = PR_FALSE;
  PR_Lock(m_Lock);
  retValue = m_SessionMap.Get(aSessionID, NULL);
  PR_Unlock(m_Lock);
  return retValue;
}

PRUnichar *nsMAPIConfiguration::GetPassword(PRUint32 aSessionID)
{
  PRUnichar *pResult = nsnull;

  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nsnull;
    m_SessionMap.Get(aSessionID, &pTemp);

    if (pTemp)
      pResult = pTemp->GetPassword();
  }
  PR_Unlock(m_Lock);
  return pResult;
}

void *nsMAPIConfiguration::GetMapiListContext(PRUint32 aSessionID)
{
  void *pResult = nsnull;

  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nsnull;
    m_SessionMap.Get(aSessionID, &pTemp);
    if (pTemp)
      pResult = pTemp->GetMapiListContext();
  }

  PR_Unlock(m_Lock);
  return pResult;
}

void nsMAPIConfiguration::SetMapiListContext(PRUint32 aSessionID, void *mapiListContext)
{
  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nsnull;
    m_SessionMap.Get(aSessionID, &pTemp);
    if (pTemp)
      pTemp->SetMapiListContext(mapiListContext);
  }

  PR_Unlock(m_Lock);
}

void nsMAPIConfiguration::GetIdKey(PRUint32 aSessionID, nsCString& aKey)
{
  PR_Lock(m_Lock);
  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nsnull;
    m_SessionMap.Get(aSessionID, &pTemp);
    if (pTemp)
      pTemp->GetIdKey(aKey);
  }
  PR_Unlock(m_Lock);
  return;
}

// util func
HRESULT nsMAPIConfiguration::GetMAPIErrorFromNSError (nsresult res)
{
  HRESULT hr = SUCCESS_SUCCESS;

  if (NS_SUCCEEDED (res)) return hr;

  // if failure return the related MAPI failure code
  switch (res)
  {
    case NS_MSG_NO_RECIPIENTS :
      hr = MAPI_E_BAD_RECIPTYPE;
      break;
    case NS_ERROR_COULD_NOT_GET_USERS_MAIL_ADDRESS :
      hr = MAPI_E_INVALID_RECIPS;
      break;
    case NS_ERROR_COULD_NOT_LOGIN_TO_SMTP_SERVER :
      hr = MAPI_E_LOGIN_FAILURE;
      break;
    case NS_MSG_UNABLE_TO_OPEN_FILE :
    case NS_MSG_UNABLE_TO_OPEN_TMP_FILE :
    case NS_MSG_COULDNT_OPEN_FCC_FOLDER :
    case NS_ERROR_FILE_INVALID_PATH :
      hr = MAPI_E_ATTACHMENT_OPEN_FAILURE;
      break;
    case NS_ERROR_FILE_TARGET_DOES_NOT_EXIST :
      hr = MAPI_E_ATTACHMENT_NOT_FOUND;
      break;
    case NS_MSG_CANCELLING :
      hr = MAPI_E_USER_ABORT;
      break;
    case NS_MSG_ERROR_WRITING_FILE :
    case NS_MSG_UNABLE_TO_SAVE_TEMPLATE :
    case NS_MSG_UNABLE_TO_SAVE_DRAFT :
      hr = MAPI_E_ATTACHMENT_WRITE_FAILURE;
      break;
    default:
      hr = MAPI_E_FAILURE;
      break;
  }

  return hr;
}


nsMAPISession::nsMAPISession(PRUint32 aHwnd, const PRUnichar *aUserName,
                             const PRUnichar *aPassword, 
                             PRBool aForceDownLoad, const char *aKey)
: m_bIsForcedDownLoad(aForceDownLoad),
  m_hAppHandle(aHwnd),
  m_nShared(1),
  m_pIdKey(aKey)
{
  m_listContext = NULL;
  m_pProfileName.Assign(aUserName);
  m_pPassword.Assign(aPassword);
}

nsMAPISession::~nsMAPISession()
{
}

PRUint32 nsMAPISession::IncrementSession()
{
  return ++m_nShared;
}

PRUint32 nsMAPISession::DecrementSession()
{
  return --m_nShared;
}

PRUint32 nsMAPISession::GetSessionCount()
{
  return m_nShared;
}

PRUnichar *nsMAPISession::GetPassword()
{
  return (PRUnichar *)m_pPassword.get();
}

void nsMAPISession::GetIdKey(nsCString& aKey)
{
  aKey = m_pIdKey;
  return;
}
