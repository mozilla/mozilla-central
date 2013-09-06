/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <mapidefs.h>
#include <mapi.h>

#include "msgCore.h"
#include "nsComposeStrings.h"
#include "msgMapiMain.h"
#include "nsIServiceManager.h"
#include "nsCOMPtr.h"

nsMAPIConfiguration *nsMAPIConfiguration::m_pSelfRef = nullptr;
uint32_t nsMAPIConfiguration::session_generator = 0;
uint32_t nsMAPIConfiguration::sessionCount = 0;

nsMAPIConfiguration *nsMAPIConfiguration::GetMAPIConfiguration()
{
  if (m_pSelfRef == nullptr)
    m_pSelfRef = new nsMAPIConfiguration();

  return m_pSelfRef;
}

nsMAPIConfiguration::nsMAPIConfiguration()
: m_nMaxSessions(MAX_SESSIONS)
{
  m_Lock = PR_NewLock();
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

int16_t nsMAPIConfiguration::RegisterSession(uint32_t aHwnd,
                const PRUnichar *aUserName, const PRUnichar *aPassword,
                bool aForceDownLoad, bool aNewSession,
                uint32_t *aSession, const char *aIdKey)
{
  int16_t nResult = 0;
  uint32_t n_SessionId = 0;

  PR_Lock(m_Lock);

  // Check whether max sessions is exceeded

  if (sessionCount >= m_nMaxSessions)
  {
    PR_Unlock(m_Lock);
    return -1;
  }

  if (aUserName != nullptr && aUserName[0] != '\0')
    m_ProfileMap.Get(nsDependentString(aUserName), &n_SessionId);

  // try to share a session; if not create a session
  if (n_SessionId > 0)
  {
    nsMAPISession *pTemp = nullptr;
    m_SessionMap.Get(n_SessionId, &pTemp);
    if (pTemp != nullptr)
    {
      pTemp->IncrementSession();
      *aSession = n_SessionId;
      nResult = 1;
    }
  }
  else if (aNewSession || n_SessionId == 0) // checking for n_SessionId is a concession
  {
    // create a new session; if new session is specified OR there is no session
    nsMAPISession *pTemp = nullptr;
    pTemp = new nsMAPISession(aHwnd, aUserName,
                           aPassword, aForceDownLoad, aIdKey);

    if (pTemp != nullptr)
    {
      session_generator++;

      // I don't think there will be (2 power 32) sessions alive
      // in a cycle.  This is an assumption

      if (session_generator == 0)
          session_generator++;
      m_SessionMap.Put(session_generator, pTemp);
      if (aUserName != nullptr && aUserName[0] != '\0')
        m_ProfileMap.Put(nsDependentString(aUserName), session_generator);
      *aSession = session_generator;
      sessionCount++;
      nResult = 1;
    }
  }

  PR_Unlock(m_Lock);
  return nResult;
}

bool nsMAPIConfiguration::UnRegisterSession(uint32_t aSessionID)
{
  bool bResult = false;

  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nullptr;
    m_SessionMap.Get(aSessionID, &pTemp);

    if (pTemp != nullptr)
    {
      if (pTemp->DecrementSession() == 0)
      {
        if (pTemp->m_pProfileName.get() != nullptr)
          m_ProfileMap.Remove(pTemp->m_pProfileName);
        m_SessionMap.Remove(aSessionID);
        sessionCount--;
        bResult = true;
      }
    }
  }

  PR_Unlock(m_Lock);
  return bResult;
}

bool nsMAPIConfiguration::IsSessionValid(uint32_t aSessionID)
{
  if (aSessionID == 0)
    return false;
  bool retValue = false;
  PR_Lock(m_Lock);
  retValue = m_SessionMap.Get(aSessionID, NULL);
  PR_Unlock(m_Lock);
  return retValue;
}

PRUnichar *nsMAPIConfiguration::GetPassword(uint32_t aSessionID)
{
  PRUnichar *pResult = nullptr;

  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nullptr;
    m_SessionMap.Get(aSessionID, &pTemp);

    if (pTemp)
      pResult = pTemp->GetPassword();
  }
  PR_Unlock(m_Lock);
  return pResult;
}

void *nsMAPIConfiguration::GetMapiListContext(uint32_t aSessionID)
{
  void *pResult = nullptr;

  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nullptr;
    m_SessionMap.Get(aSessionID, &pTemp);
    if (pTemp)
      pResult = pTemp->GetMapiListContext();
  }

  PR_Unlock(m_Lock);
  return pResult;
}

void nsMAPIConfiguration::SetMapiListContext(uint32_t aSessionID, void *mapiListContext)
{
  PR_Lock(m_Lock);

  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nullptr;
    m_SessionMap.Get(aSessionID, &pTemp);
    if (pTemp)
      pTemp->SetMapiListContext(mapiListContext);
  }

  PR_Unlock(m_Lock);
}

void nsMAPIConfiguration::GetIdKey(uint32_t aSessionID, nsCString& aKey)
{
  PR_Lock(m_Lock);
  if (aSessionID != 0)
  {
    nsMAPISession *pTemp = nullptr;
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
    case NS_ERROR_SMTP_AUTH_FAILURE :
    case NS_ERROR_SMTP_AUTH_GSSAPI :
    case NS_ERROR_SMTP_AUTH_MECH_NOT_SUPPORTED :
    case NS_ERROR_SMTP_AUTH_NOT_SUPPORTED :
    case NS_ERROR_SMTP_AUTH_CHANGE_ENCRYPT_TO_PLAIN_NO_SSL :
    case NS_ERROR_SMTP_AUTH_CHANGE_ENCRYPT_TO_PLAIN_SSL :
    case NS_ERROR_SMTP_AUTH_CHANGE_PLAIN_TO_ENCRYPT :
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


nsMAPISession::nsMAPISession(uint32_t aHwnd, const PRUnichar *aUserName,
                             const PRUnichar *aPassword, 
                             bool aForceDownLoad, const char *aKey)
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

uint32_t nsMAPISession::IncrementSession()
{
  return ++m_nShared;
}

uint32_t nsMAPISession::DecrementSession()
{
  return --m_nShared;
}

uint32_t nsMAPISession::GetSessionCount()
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
