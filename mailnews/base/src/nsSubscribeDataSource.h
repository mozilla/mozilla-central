/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsSubscribeDataSource_h__
#define nsSubscribeDataSource_h__

#include "nsIRDFService.h"
#include "nsIRDFDataSource.h"
#include "nsIRDFResource.h"
#include "nsIRDFLiteral.h"
#include "nsCOMPtr.h"
#include "nsISubscribableServer.h"
#include "nsTObserverArray.h"

/**
 * The subscribe data source.
 */
class nsSubscribeDataSource : public nsIRDFDataSource, public nsISubscribeDataSource
{

public:
  nsSubscribeDataSource();
  virtual ~nsSubscribeDataSource();

  nsresult Init();

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIRDFDATASOURCE
  NS_DECL_NSISUBSCRIBEDATASOURCE

private:
  nsCOMPtr <nsIRDFResource>      kNC_Child;
  nsCOMPtr <nsIRDFResource>      kNC_Name;    
  nsCOMPtr <nsIRDFResource>      kNC_LeafName;
  nsCOMPtr <nsIRDFResource>      kNC_Subscribed;
  nsCOMPtr <nsIRDFResource>      kNC_Subscribable;
  nsCOMPtr <nsIRDFResource>      kNC_ServerType;
  nsCOMPtr <nsIRDFLiteral>       kTrueLiteral;
  nsCOMPtr <nsIRDFLiteral>       kFalseLiteral;

  nsCOMPtr <nsIRDFService>       mRDFService;
  nsTObserverArray<nsCOMPtr<nsIRDFObserver> >  mObservers;

  nsresult GetServerAndRelativePathFromResource(nsIRDFResource *source, nsISubscribableServer **server, char **relativePath);
  nsresult GetServerType(nsISubscribableServer *server, nsACString& serverType);
};

#endif /* nsSubscribedDataSource_h__ */
