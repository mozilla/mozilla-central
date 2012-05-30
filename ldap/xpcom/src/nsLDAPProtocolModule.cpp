/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

NS_DEFINE_NAMED_CID(NS_LDAPCONNECTION_CID);
NS_DEFINE_NAMED_CID(NS_LDAPOPERATION_CID);
NS_DEFINE_NAMED_CID(NS_LDAPMESSAGE_CID);
NS_DEFINE_NAMED_CID(NS_LDAPMODIFICATION_CID);
NS_DEFINE_NAMED_CID(NS_LDAPSERVER_CID);
NS_DEFINE_NAMED_CID(NS_LDAPSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_LDAPURL_CID);
NS_DEFINE_NAMED_CID(NS_LDAPBERVALUE_CID);
NS_DEFINE_NAMED_CID(NS_LDAPBERELEMENT_CID);
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

NSMODULE_DEFN(nsLDAPProtocolModule) = &kLDAPProtocolModule;

#ifdef PR_LOGGING
PRLogModuleInfo *gLDAPLogModule = 0;
#endif
