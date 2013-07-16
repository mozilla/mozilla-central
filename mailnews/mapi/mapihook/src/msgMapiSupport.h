/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MSG_MAPI_SUPPORT_H_
#define MSG_MAPI_SUPPORT_H_

#include "nsIObserver.h"
#include "nsIMapiSupport.h"
#include "msgMapiFactory.h"

#define NS_IMAPISUPPORT_CID \
  {0x8967fed2, 0xc8bb, 0x11d5, \
    { 0xa3, 0xe9, 0x00, 0xb0, 0xd0, 0xf3, 0xba, 0xa7 }}

class nsMapiSupport : public nsIMapiSupport,
                      public nsIObserver
{
    public :
        nsMapiSupport();
        ~nsMapiSupport();

        // Declare all interface methods we must implement.
        NS_DECL_THREADSAFE_ISUPPORTS
        NS_DECL_NSIOBSERVER
        NS_DECL_NSIMAPISUPPORT

    private :

        DWORD   m_dwRegister;
        CMapiFactory *m_nsMapiFactory;
};

#endif  // MSG_MAPI_SUPPORT_H_
