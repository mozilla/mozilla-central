/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MSG_MAPI_HOOK_H_
#define MSG_MAPI_HOOK_H_

#include "prtypes.h"

class nsMapiHook
{
    public :

        static bool DisplayLoginDialog(bool aLogin, PRUnichar **aUsername, 
                        PRUnichar **aPassword);
        static bool VerifyUserName(const nsString& aUsername, nsCString& aIdKey);

        static bool IsBlindSendAllowed () ;
        static nsresult BlindSendMail (unsigned long aSession, nsIMsgCompFields * aCompFields) ;
        static nsresult ShowComposerWindow (unsigned long aSession, nsIMsgCompFields * aCompFields) ;
        static nsresult PopulateCompFields(lpnsMapiMessage aMessage, nsIMsgCompFields * aCompFields) ;
        static nsresult PopulateCompFieldsWithConversion(lpnsMapiMessage aMessage, 
                                        nsIMsgCompFields * aCompFields) ;
        static nsresult PopulateCompFieldsForSendDocs(nsIMsgCompFields * aCompFields, 
                                        ULONG aFlags, LPTSTR aDelimChar, LPTSTR aFilePaths) ;
        static nsresult HandleAttachments (nsIMsgCompFields * aCompFields, int32_t aFileCount, 
                                        lpnsMapiFileDesc aFiles, BOOL aIsUnicode) ;
        static void CleanUp();

        static bool isMapiService;
};

#endif  // MSG_MAPI_HOOK_H_
