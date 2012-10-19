/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsSmtpServer_h_
#define __nsSmtpServer_h_


#include "nsStringGlue.h"
#include "nsISmtpServer.h"
#include "nsIPrefBranch.h"
#include "nsWeakReference.h"

class nsSmtpServer : public nsISmtpServer,
                     public nsSupportsWeakReference
{
public:
    nsSmtpServer();
    virtual ~nsSmtpServer();
    
    NS_DECL_ISUPPORTS
    NS_DECL_NSISMTPSERVER

private:
    nsCString mKey;
    nsCOMPtr<nsIPrefBranch> mPrefBranch;
    nsCOMPtr<nsIPrefBranch> mDefPrefBranch;
                                                                                                                                               
    nsresult getPrefs();
    void getIntPrefWithDefault(const char *prefName, int32_t *val,
                               int32_t defval);
    nsresult GetPasswordWithoutUI(const nsString &serverUri);

    nsCString m_password;
    bool m_logonFailed;
};

#endif
