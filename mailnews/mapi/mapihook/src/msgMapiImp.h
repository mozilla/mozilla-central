/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MSG_MAPI_IMP_H
#define MSG_MAPI_IMP_H

#include <windows.h>
#include <mapi.h>
#include "msgMapi.h"
#include "nspr.h"
#include "nscore.h"
#include "nsISupportsImpl.h" // ThreadSafeAutoRefCnt

class nsIMsgFolder;
class MsgMapiListContext;

const CLSID CLSID_CMapiImp = {0x29f458be, 0x8866, 0x11d5, {0xa3, 0xdd, 0x0, 0xb0, 0xd0, 0xf3, 0xba, 0xa7}};

// this class implements the MS COM interface nsIMapi that provides the methods
// called by mapi32.dll to perform the mail operations as specified by MAPI.
// These class methods in turn use the Mozilla Mail XPCOM interfaces to do so.
class CMapiImp : public nsIMapi
{

public :

  // IUnknown

  STDMETHODIMP            QueryInterface(const IID& aIid, void** aPpv);
  STDMETHODIMP_(ULONG)    AddRef();
  STDMETHODIMP_(ULONG)    Release();

  // Interface INsMapi

  STDMETHODIMP Login(unsigned long aUIArg, LOGIN_PW_TYPE aLogin, 
                     LOGIN_PW_TYPE aPassWord, unsigned long aFlags,
                     unsigned long *aSessionId);

  STDMETHODIMP SendMail( unsigned long aSession, lpnsMapiMessage aMessage,
       short aRecipCount, lpnsMapiRecipDesc aRecips , 
       short aFileCount, lpnsMapiFileDesc aFiles , 
       unsigned long aFlags, unsigned long aReserved) ;

  STDMETHODIMP SendDocuments( unsigned long aSession, LPTSTR aDelimChar,
                              LPTSTR aFilePaths, LPTSTR aFileNames, ULONG aFlags);

  STDMETHODIMP FindNext(  unsigned long aSession, unsigned long ulUIParam, LPTSTR lpszMessageType,
                            LPTSTR lpszSeedMessageID, unsigned long flFlags, unsigned long ulReserved,
                            unsigned char lpszMessageID[64] );

  STDMETHODIMP ReadMail(unsigned long lhSession, unsigned long ulUIParam, LPTSTR lpszMessageID,
                            unsigned long flFlags, unsigned long ulReserved, lpnsMapiMessage *lppMessage);
  STDMETHODIMP DeleteMail(unsigned long lhSession, unsigned long ulUIParam, LPTSTR lpszMessageID,
                            unsigned long flFlags, unsigned long ulReserved);
  STDMETHODIMP SaveMail(unsigned long lhSession, unsigned long ulUIParam, lpnsMapiMessage lppMessage,
                            unsigned long flFlags, unsigned long ulReserved, LPTSTR lpszMessageID);

  STDMETHODIMP Initialize();
  STDMETHODIMP IsValid();
  STDMETHODIMP IsValidSession(unsigned long aSession);

  STDMETHODIMP Logoff (unsigned long aSession);
  STDMETHODIMP CleanUp();

  CMapiImp();
  ~CMapiImp();

  LONG InitContext(unsigned long session, MsgMapiListContext **listContext);
  nsresult GetDefaultInbox(nsIMsgFolder **inboxFolder);

private :
  PRLock *m_Lock;
  mozilla::ThreadSafeAutoRefCnt m_cRef;
};

#endif // MSG_MAPI_IMP_H
