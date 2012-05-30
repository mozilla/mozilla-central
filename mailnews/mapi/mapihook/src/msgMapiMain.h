/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MSG_MAPI_MAIN_H_
#define NSG_MAPI_MAIN_H_

#define        MAX_NAME_LEN    256
#define        MAX_PW_LEN      256
#define        MAX_SESSIONS    50
#define        MAPI_SENDCOMPLETE_EVENT   "SendCompletionEvent"

#define MAPI_PROPERTIES_CHROME "chrome://messenger-mapi/locale/mapi.properties"
#define PREF_MAPI_WARN_PRIOR_TO_BLIND_SEND "mapi.blind-send.warn"
#define PREF_MAPI_BLIND_SEND_ENABLED "mapi.blind-send.enabled"

#include "nspr.h"
#include "nsDataHashtable.h"
#include "nsClassHashtable.h"
#include "nsStringGlue.h"

class nsMAPISession;

class nsMAPIConfiguration
{
private :

  static PRUint32 session_generator;
  static PRUint32 sessionCount;
  static nsMAPIConfiguration *m_pSelfRef;
  PRLock *m_Lock;
  PRUint32  m_nMaxSessions;

  nsDataHashtable<nsStringHashKey, PRUint32> m_ProfileMap;
  nsClassHashtable<nsUint32HashKey, nsMAPISession> m_SessionMap;
  nsMAPIConfiguration();

public :
  static nsMAPIConfiguration *GetMAPIConfiguration();
  void OpenConfiguration();
  PRInt16 RegisterSession(PRUint32 aHwnd, const PRUnichar *aUserName, \
                          const PRUnichar *aPassword, bool aForceDownLoad, \
                          bool aNewSession, PRUint32 *aSession, const char *aIdKey);
  bool IsSessionValid(PRUint32 aSessionID);
  bool UnRegisterSession(PRUint32 aSessionID);
  PRUnichar *GetPassword(PRUint32 aSessionID);
  void GetIdKey(PRUint32 aSessionID, nsCString& aKey);
  void *GetMapiListContext(PRUint32 aSessionID);
  void SetMapiListContext(PRUint32 aSessionID, void *mapiListContext);
  ~nsMAPIConfiguration();

  // a util func
  static HRESULT GetMAPIErrorFromNSError (nsresult res) ;
};

class nsMAPISession
{
  friend class nsMAPIConfiguration;

  private :
    bool     m_bIsForcedDownLoad;
    bool     m_bApp_or_Service;
    PRUint32 m_hAppHandle;
    PRUint32 m_nShared;
    nsCString m_pIdKey;
    nsString m_pProfileName;
    nsString m_pPassword;
    PRInt32 m_messageIndex;
    void   *m_listContext; // used by findNext

  public :
    nsMAPISession(PRUint32 aHwnd, const PRUnichar *aUserName, \
                  const PRUnichar *aPassword, \
                  bool aForceDownLoad, const char *aKey);
    PRUint32 IncrementSession();
    PRUint32 DecrementSession();
    PRUint32 GetSessionCount();
    PRUnichar *nsMAPISession::GetPassword();
    void GetIdKey(nsCString& aKey);
    ~nsMAPISession();
    // For enumerating Messages...
    void SetMapiListContext( void *listContext) { m_listContext = listContext; } 
    void *GetMapiListContext( ) { return m_listContext; }
};

#endif    // MSG_MAPI_MAIN_H_
