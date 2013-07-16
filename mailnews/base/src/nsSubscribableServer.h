/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsSubscribableServer_h__
#define nsSubscribableServer_h__

#include "nsCOMPtr.h"
#include "nsISubscribableServer.h"
#include "nsIMsgIncomingServer.h"
#include "nsIRDFService.h"
#include "nsSubscribeDataSource.h"
#include "nsIRDFResource.h"

typedef struct _subscribeTreeNode {
  char *name;
  bool isSubscribed;
  struct _subscribeTreeNode *prevSibling;
  struct _subscribeTreeNode *nextSibling;
  struct _subscribeTreeNode *firstChild;
  struct _subscribeTreeNode *lastChild;
  struct _subscribeTreeNode *parent;
  struct _subscribeTreeNode *cachedChild;
#ifdef HAVE_SUBSCRIBE_DESCRIPTION
  PRUnichar *description;
#endif
#ifdef HAVE_SUBSCRIBE_MESSAGES
  uint32_t messages;
#endif
  bool isSubscribable;
} SubscribeTreeNode;

#if defined(DEBUG_sspitzer) || defined(DEBUG_seth)
#define DEBUG_SUBSCRIBE 1
#endif

class nsSubscribableServer : public nsISubscribableServer
{
 public:
  nsSubscribableServer();
  virtual ~nsSubscribableServer();

  nsresult Init();

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSISUBSCRIBABLESERVER
  
private:
  nsresult ConvertNameToUnichar(const char *inStr, PRUnichar **outStr);
  nsCOMPtr <nsISubscribeListener> mSubscribeListener;
  nsCOMPtr <nsIMsgIncomingServer> mIncomingServer;
  nsCOMPtr <nsISubscribeDataSource> mSubscribeDS;
  char mDelimiter;
  bool mShowFullName;
  bool mStopped;

  nsCOMPtr <nsIRDFResource>      kNC_Child;
  nsCOMPtr <nsIRDFResource>      kNC_Subscribed;
  nsCOMPtr <nsIRDFLiteral>       kTrueLiteral;
  nsCOMPtr <nsIRDFLiteral>       kFalseLiteral;

  nsCOMPtr <nsIRDFService>       mRDFService;

  SubscribeTreeNode *mTreeRoot;
  nsresult FreeSubtree(SubscribeTreeNode *node);
  nsresult CreateNode(SubscribeTreeNode *parent, const char *name, SubscribeTreeNode **result);
  nsresult AddChildNode(SubscribeTreeNode *parent, const char *name, SubscribeTreeNode **child);
  nsresult FindAndCreateNode(const nsACString &aPath,
                             SubscribeTreeNode **aResult);
  nsresult NotifyAssert(SubscribeTreeNode *subjectNode, nsIRDFResource *property, SubscribeTreeNode *objectNode);
  nsresult NotifyChange(SubscribeTreeNode *subjectNode, nsIRDFResource *property, bool value);
  nsresult Notify(nsIRDFResource *subject, nsIRDFResource *property, nsIRDFNode *object, bool isAssert, bool isChange);
  void BuildURIFromNode(SubscribeTreeNode *node, nsACString &uri);
  nsresult EnsureSubscribeDS();
  nsresult EnsureRDFService();
};

#endif // nsSubscribableServer_h__
