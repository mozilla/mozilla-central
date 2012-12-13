/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#ifndef __nsMsgRDFDataSource_h
#define __nsMsgRDFDataSource_h

#include "nsCOMPtr.h"
#include "nsIRDFDataSource.h"
#include "nsIRDFService.h"
#include "nsIServiceManager.h"
#include "nsCOMArray.h"
#include "nsIObserver.h"
#include "nsITransactionManager.h"
#include "nsIMsgWindow.h"
#include "nsIMsgRDFDataSource.h"
#include "nsWeakReference.h"
#include "nsCycleCollectionParticipant.h"

class nsMsgRDFDataSource : public nsIRDFDataSource,
                           public nsIObserver,
                           public nsSupportsWeakReference,
                           public nsIMsgRDFDataSource
{
 public:
  nsMsgRDFDataSource();
  virtual ~nsMsgRDFDataSource();
  virtual nsresult Init();

  NS_DECL_CYCLE_COLLECTING_ISUPPORTS
  NS_DECL_CYCLE_COLLECTION_CLASS_AMBIGUOUS(nsMsgRDFDataSource,
                                           nsIRDFDataSource)
  NS_DECL_NSIMSGRDFDATASOURCE
  NS_DECL_NSIRDFDATASOURCE
  NS_DECL_NSIOBSERVER

  // called to reset the datasource to an empty state
  // if you need to release yourself as an observer/listener, do it here
  virtual void Cleanup();

 protected:
  nsIRDFService *getRDFService();
  static bool assertEnumFunc(nsIRDFObserver *aObserver, void *aData);
  static bool unassertEnumFunc(nsIRDFObserver *aObserver, void *aData);
  static bool changeEnumFunc(nsIRDFObserver *aObserver, void *aData);
  nsresult  NotifyObservers(nsIRDFResource *subject, nsIRDFResource *property,
                            nsIRDFNode *newObject, nsIRDFNode *oldObject, 
                            bool assert, bool change);

  virtual nsresult NotifyPropertyChanged(nsIRDFResource *resource, 
                    nsIRDFResource *propertyResource, nsIRDFNode *newNode, 
                    nsIRDFNode *oldNode = nullptr);

  nsCOMPtr<nsIMsgWindow> mWindow;

  bool m_shuttingDown;
  bool mInitialized;

 private:
  nsCOMPtr<nsIRDFService> mRDFService;
  nsCOMArray<nsIRDFObserver> mObservers;
};

#endif
