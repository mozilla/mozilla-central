/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/ModuleUtils.h"

/* Include all of the interfaces our factory can generate components for */
#include "nsSMIMEStub.h"
#include "nsMimeContentTypeHandler.h"

////////////////////////////////////////////////////////////////////////
// Define the contructor function for the CID
//
// What this does is defines a function nsMimeContentTypeHandlerConstructor
// which we will specific in the nsModuleComponentInfo table. This function will
// be used by the generic factory to create an instance.
//
// NOTE: This creates an instance by using the default constructor
//
//NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimeContentTypeHandler)
extern "C" MimeObjectClass *
MIME_SMimeCreateContentTypeHandlerClass(const char *content_type, 
                                        contentTypeHandlerInitStruct *initStruct);

static NS_IMETHODIMP
nsSMimeMimeContentTypeHandlerConstructor(nsISupports *aOuter,
                                         REFNSIID aIID,
                                         void **aResult)
{
  nsresult rv;
  nsMimeContentTypeHandler *inst = nullptr;

  if (NULL == aResult) {
    rv = NS_ERROR_NULL_POINTER;
    return rv;
  }
  *aResult = NULL;
  if (NULL != aOuter) {
    rv = NS_ERROR_NO_AGGREGATION;
    return rv;
  }
  inst = new nsMimeContentTypeHandler(SMIME_CONTENT_TYPE, 
                                      &MIME_SMimeCreateContentTypeHandlerClass);
  if (inst == NULL) {
    return NS_ERROR_OUT_OF_MEMORY;
  }
  NS_ADDREF(inst);
  rv = inst->QueryInterface(aIID,aResult);
  NS_RELEASE(inst);

  return rv;
}

////////////////////////////////////////////////////////////////////////
// Define a table of CIDs implemented by this module along with other
// information like the function to create an instance, contractid, and
// class name.
//
NS_DEFINE_NAMED_CID(NS_SMIME_CONTENT_TYPE_HANDLER_CID);

static const mozilla::Module::CIDEntry kSMIMEContentHandlerCIDs[] =
{
  { &kNS_SMIME_CONTENT_TYPE_HANDLER_CID, false, NULL,
    nsSMimeMimeContentTypeHandlerConstructor },
  { &kNS_SMIME_CONTENT_TYPE_HANDLER_CID, false, NULL,
    nsSMimeMimeContentTypeHandlerConstructor },
  { NULL }
};

static const mozilla::Module::ContractIDEntry kSMIMEContentHandlerContracts[] =
{
  { "@mozilla.org/mimecth;1?type=application/x-pkcs7-mime",
    &kNS_SMIME_CONTENT_TYPE_HANDLER_CID },
  { "@mozilla.org/mimecth;1?type=application/pkcs7-mime",
    &kNS_SMIME_CONTENT_TYPE_HANDLER_CID },
  { NULL }
};

static const mozilla::Module kSMIMEContentHandlerModule =
{
  mozilla::Module::kVersion,
  kSMIMEContentHandlerCIDs,
  kSMIMEContentHandlerContracts
};

NSMODULE_DEFN(nsSMIMEModule) = &kSMIMEContentHandlerModule;
