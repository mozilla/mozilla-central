/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsMsgRDFUtils.h"
#include "nsIServiceManager.h"
#include "prprf.h"
#include "nsCOMPtr.h"
#include "nsMemory.h"

nsresult createNode(const PRUnichar *str, nsIRDFNode **node, nsIRDFService *rdfService)
{
  nsresult rv;
  nsCOMPtr<nsIRDFLiteral> value;

  NS_ASSERTION(rdfService, "rdfService is null");
  if (!rdfService) return NS_OK;

  if (str) {
    rv = rdfService->GetLiteral(str, getter_AddRefs(value));
  } 
  else {
    rv = rdfService->GetLiteral(EmptyString().get(), getter_AddRefs(value));
  }

  if (NS_SUCCEEDED(rv)) {
    *node = value;
    NS_IF_ADDREF(*node);
  }
  return rv;
}

nsresult createIntNode(int32_t value, nsIRDFNode **node, nsIRDFService *rdfService)
{
  *node = nullptr;
  nsresult rv; 
  if (!rdfService) return NS_ERROR_NULL_POINTER;  
  nsCOMPtr<nsIRDFInt> num;
  rv = rdfService->GetIntLiteral(value, getter_AddRefs(num));
  if(NS_SUCCEEDED(rv)) {
    *node = num;
    NS_IF_ADDREF(*node);
  }
  return rv;
}

nsresult createBlobNode(uint8_t *value, uint32_t &length, nsIRDFNode **node, nsIRDFService *rdfService)
{
  NS_ENSURE_ARG_POINTER(node);
  NS_ENSURE_ARG_POINTER(rdfService);
  
  *node = nullptr;
  nsCOMPtr<nsIRDFBlob> blob;
  nsresult rv = rdfService->GetBlobLiteral(value, length, getter_AddRefs(blob));
  NS_ENSURE_SUCCESS(rv,rv);
  NS_IF_ADDREF(*node = blob);
  return rv;
}

nsresult GetTargetHasAssertion(nsIRDFDataSource *dataSource, nsIRDFResource* folderResource,
                               nsIRDFResource *property,bool tv, nsIRDFNode *target,bool* hasAssertion)
{
  NS_ENSURE_ARG_POINTER(hasAssertion);
  
  nsCOMPtr<nsIRDFNode> currentTarget;
  
  nsresult rv = dataSource->GetTarget(folderResource, property,tv, getter_AddRefs(currentTarget));
  if(NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIRDFLiteral> value1(do_QueryInterface(target));
    nsCOMPtr<nsIRDFLiteral> value2(do_QueryInterface(currentTarget));
    if(value1 && value2)
      //If the two values are equal then it has this assertion
      *hasAssertion = (value1 == value2);
  }
  else
    rv = NS_NOINTERFACE;
  
  return rv;
  
}

