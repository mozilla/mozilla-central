/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is the mozilla.org LDAP XPCOM SDK.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mosedale <dmose@mozilla.org>
 *   Leif Hedstrom <leif@netscape.com>
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

#include "nsIClassInfoImpl.h"
#include "mozilla/ModuleUtils.h"

#include "nsLDAPInternal.h"
#include "nsLDAPURL.h"
#include "nsLDAPConnection.h"
#include "nsLDAPOperation.h"
#include "nsLDAPMessage.h"
#include "nsLDAPModification.h"
#include "nsLDAPServer.h"
#include "nsLDAPService.h"
#include "nsLDAPBERValue.h"
#include "nsLDAPBERElement.h"
#include "nsLDAPControl.h"
#ifdef MOZ_PREF_EXTENSIONS
#include "nsLDAPSyncQuery.h"
#endif
#include "ldappr.h"

#ifdef MOZ_LDAP_XPCOM_EXPERIMENTAL
#include "nsLDAPChannel.h"
#endif

// use the default constructor
//
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPConnection)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPOperation)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPMessage)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsLDAPModification, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPURL)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsLDAPService, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPBERValue)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPBERElement)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPControl)
#ifdef MOZ_PREF_EXTENSIONS
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPSyncQuery)
#endif
#ifdef MOZ_LDAP_XPCOM_EXPERIMENTAL
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPChannel)
#endif

NS_DEFINE_NAMED_CID(NS_LDAPCONNECTION_CID);
NS_DEFINE_NAMED_CID(NS_LDAPOPERATION_CID);
NS_DEFINE_NAMED_CID(NS_LDAPMESSAGE_CID);
NS_DEFINE_NAMED_CID(NS_LDAPMODIFICATION_CID);
NS_DEFINE_NAMED_CID(NS_LDAPSERVER_CID);
NS_DEFINE_NAMED_CID(NS_LDAPSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_LDAPURL_CID);
NS_DEFINE_NAMED_CID(NS_LDAPBERVALUE_CID);
NS_DEFINE_NAMED_CID(NS_LDAPBERELEMENT_CID);
#ifdef MOZ_LDAP_XPCOM_EXPERIMENTAL
NS_DEFINE_NAMED_CID(NS_LDAPCHANNEL_CID);
#endif
#ifdef MOZ_PREF_EXTENSIONS
NS_DEFINE_NAMED_CID(NS_LDAPSYNCQUERY_CID);
#endif
NS_DEFINE_NAMED_CID(NS_LDAPCONTROL_CID);

// a table of the CIDs implemented by this module
//

const mozilla::Module::CIDEntry kLDAPProtocolCIDs[] = {
  { &kNS_LDAPCONNECTION_CID, false, NULL, nsLDAPConnectionConstructor},
  { &kNS_LDAPOPERATION_CID, false, NULL, nsLDAPOperationConstructor},
  { &kNS_LDAPMESSAGE_CID, false, NULL, nsLDAPMessageConstructor},
  { &kNS_LDAPMODIFICATION_CID, false, NULL, nsLDAPModificationConstructor},
  { &kNS_LDAPSERVER_CID, false, NULL, nsLDAPServerConstructor},
  { &kNS_LDAPSERVICE_CID, false, NULL, nsLDAPServiceConstructor},
  { &kNS_LDAPURL_CID, false, NULL, nsLDAPURLConstructor},
  { &kNS_LDAPBERVALUE_CID, false, NULL, nsLDAPBERValueConstructor},
  { &kNS_LDAPBERELEMENT_CID, false, NULL, nsLDAPBERElementConstructor},
#ifdef MOZ_LDAP_XPCOM_EXPERIMENTAL
  { &kNS_LDAPCHANNEL_CID, false, NULL, nsLDAPChannelConstructor},
#endif
#ifdef MOZ_PREF_EXTENSIONS
  { &kNS_LDAPSYNCQUERY_CID, false, NULL, nsLDAPSyncQueryConstructor},
#endif
  { &kNS_LDAPCONTROL_CID, false, NULL, nsLDAPControlConstructor},
  { NULL }
};


const mozilla::Module::ContractIDEntry kLDAPProtocolContracts[] = {
  { "@mozilla.org/network/ldap-connection;1", &kNS_LDAPCONNECTION_CID},
  { "@mozilla.org/network/ldap-operation;1", &kNS_LDAPOPERATION_CID},
  { "@mozilla.org/network/ldap-message;1", &kNS_LDAPMESSAGE_CID},
  { "@mozilla.org/network/ldap-modification;1", &kNS_LDAPMODIFICATION_CID},
  { "@mozilla.org/network/ldap-server;1", &kNS_LDAPSERVER_CID},
  { "@mozilla.org/network/ldap-service;1", &kNS_LDAPSERVICE_CID},
  { "@mozilla.org/network/ldap-url;1", &kNS_LDAPURL_CID},
  { "@mozilla.org/network/ldap-ber-value;1", &kNS_LDAPBERVALUE_CID},
  { "@mozilla.org/network/ldap-ber-element;1", &kNS_LDAPBERELEMENT_CID},
#ifdef MOZ_LDAP_XPCOM_EXPERIMENTAL
  { "@mozilla.org/network/ldap-channel;1", &kNS_LDAPCHANNEL_CID},
#endif
#ifdef MOZ_PREF_EXTENSIONS
  { "@mozilla.org/ldapsyncquery;1", &kNS_LDAPSYNCQUERY_CID},
#endif
  { "@mozilla.org/network/ldap-control;1", &kNS_LDAPCONTROL_CID},
  { NULL }
};

static nsresult
nsLDAPInitialize()
{
#ifdef PR_LOGGING
    gLDAPLogModule = PR_NewLogModule("ldap");
    if (!gLDAPLogModule) {
        PR_fprintf(PR_STDERR, 
                   "nsLDAP_Initialize(): PR_NewLogModule() failed\n");
        return NS_ERROR_NOT_AVAILABLE;
    }
#endif

    // use NSPR under the hood for all networking
    //
    int rv = prldap_install_routines( NULL, 1 /* shared */ );

    if (rv != LDAP_SUCCESS) {
        PR_LOG(gLDAPLogModule, PR_LOG_ERROR,
               ("nsLDAPInitialize(): pr_ldap_install_routines() failed: %s\n",
               ldap_err2string(rv)));
        return NS_ERROR_FAILURE;
    }

    // Never block for more than 10000 milliseconds (ie 10 seconds) doing any 
    // sort of I/O operation.
    //
    rv = prldap_set_session_option(0, 0, PRLDAP_OPT_IO_MAX_TIMEOUT, 
                                   10000);
    if (rv != LDAP_SUCCESS) {
        PR_LOG(gLDAPLogModule, PR_LOG_ERROR,
               ("nsLDAPInitialize(): error setting PRLDAP_OPT_IO_MAX_TIMEOUT:"
                " %s\n", ldap_err2string(rv)));
        return NS_ERROR_FAILURE;
    }

    return NS_OK;
}

static const mozilla::Module kLDAPProtocolModule = {
    mozilla::Module::kVersion,
    kLDAPProtocolCIDs,
    kLDAPProtocolContracts,
    NULL,
    NULL,
    nsLDAPInitialize,
    NULL
};

NSMODULE_DEFN(ldap) = &kLDAPProtocolModule;

#ifdef PR_LOGGING
PRLogModuleInfo *gLDAPLogModule = 0;
#endif
