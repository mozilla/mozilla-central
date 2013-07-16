/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __nsMsgAccountManagerDS_h
#define __nsMsgAccountManagerDS_h

#include "mozilla/Attributes.h"
#include "nscore.h"
#include "nsError.h"
#include "nsIID.h"
#include "nsCOMPtr.h"
#include "nsIStringBundle.h"

#include "nsMsgRDFDataSource.h"
#include "nsIMsgAccountManager.h"
#include "nsIIncomingServerListener.h"
#include "nsIMsgProtocolInfo.h"
#include "nsWeakPtr.h"
#include "nsIMutableArray.h"
#include "nsCOMArray.h"

/* {3f989ca4-f77a-11d2-969d-006008948010} */
#define NS_MSGACCOUNTMANAGERDATASOURCE_CID \
  {0x3f989ca4, 0xf77a, 0x11d2, \
    {0x96, 0x9d, 0x00, 0x60, 0x08, 0x94, 0x80, 0x10}}

class nsMsgAccountManagerDataSource : public nsMsgRDFDataSource,
                                      public nsIFolderListener,
                                      public nsIIncomingServerListener
{

public:
    
  nsMsgAccountManagerDataSource();
  virtual ~nsMsgAccountManagerDataSource();
  virtual nsresult Init() MOZ_OVERRIDE;

  virtual void Cleanup() MOZ_OVERRIDE;
  // service manager shutdown method
  
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIFOLDERLISTENER
  NS_DECL_NSIINCOMINGSERVERLISTENER
  NS_DECL_NSIOBSERVER
  // RDF datasource methods
  NS_IMETHOD GetTarget(nsIRDFResource *source,
                       nsIRDFResource *property,
                       bool aTruthValue,
                       nsIRDFNode **_retval);
  NS_IMETHOD GetTargets(nsIRDFResource *source,
                        nsIRDFResource *property,
                        bool aTruthValue,
                        nsISimpleEnumerator **_retval) MOZ_OVERRIDE;
  NS_IMETHOD ArcLabelsOut(nsIRDFResource *source,
                          nsISimpleEnumerator **_retval) MOZ_OVERRIDE;

  NS_IMETHOD HasAssertion(nsIRDFResource *aSource, nsIRDFResource *aProperty,
                          nsIRDFNode *aTarget, bool aTruthValue,
                          bool *_retval) MOZ_OVERRIDE;
  NS_IMETHOD HasArcOut(nsIRDFResource *source, nsIRDFResource *aArc,
                       bool *result) MOZ_OVERRIDE;
    
protected:

  nsresult HasAssertionServer(nsIMsgIncomingServer *aServer,
                              nsIRDFResource *aProperty,
                              nsIRDFNode *aTarget,
                              bool aTruthValue, bool *_retval);

  nsresult HasAssertionAccountRoot(nsIRDFResource *aProperty,
                                   nsIRDFNode *aTarget,
                                   bool aTruthValue, bool *_retval);
  
  bool isDefaultServer(nsIMsgIncomingServer *aServer);
  bool supportsFilters(nsIMsgIncomingServer *aServer);
  bool canGetMessages(nsIMsgIncomingServer *aServer);
  bool canGetIncomingMessages(nsIMsgIncomingServer *aServer);
  
  static bool isContainment(nsIRDFResource *aProperty);
  nsresult getServerForFolderNode(nsIRDFNode *aResource,
                                  nsIMsgIncomingServer **aResult);
  
  nsresult createRootResources(nsIRDFResource *aProperty,
                               nsCOMArray<nsIRDFResource> *aNodeArray);
  nsresult createSettingsResources(nsIRDFResource *aSource,
                                   nsCOMArray<nsIRDFResource> *aNodeArray);
  nsresult appendGenericSettingsResources(nsIMsgIncomingServer *server,\
                                          nsCOMArray<nsIRDFResource> *aNodeArray);
  nsresult appendGenericSetting(const char *name,
                                nsCOMArray<nsIRDFResource> *aNodeArray);

  static nsIRDFResource* kNC_Name;
  static nsIRDFResource* kNC_FolderTreeName;
  static nsIRDFResource* kNC_FolderTreeSimpleName;
  static nsIRDFResource* kNC_NameSort;
  static nsIRDFResource* kNC_FolderTreeNameSort;
  static nsIRDFResource* kNC_PageTag;
  static nsIRDFResource* kNC_IsDefaultServer;
  static nsIRDFResource* kNC_SupportsFilters;
  static nsIRDFResource* kNC_CanGetMessages;
  static nsIRDFResource* kNC_CanGetIncomingMessages;
  
  static nsIRDFResource* kNC_Child;
  static nsIRDFResource* kNC_AccountRoot;
  
  static nsIRDFResource* kNC_Account;
  static nsIRDFResource* kNC_Server;
  static nsIRDFResource* kNC_Identity;
  static nsIRDFResource* kNC_Settings;
  static nsIRDFResource* kNC_Junk;

  static nsIRDFResource* kNC_PageTitleMain;
  static nsIRDFResource* kNC_PageTitleServer;
  static nsIRDFResource* kNC_PageTitleCopies;
  static nsIRDFResource* kNC_PageTitleSynchronization;
  static nsIRDFResource* kNC_PageTitleDiskSpace;
  static nsIRDFResource* kNC_PageTitleAddressing;
  static nsIRDFResource* kNC_PageTitleSMTP;
  static nsIRDFResource* kNC_PageTitleJunk;

  static nsIRDFLiteral* kTrueLiteral;

  static nsIAtom* kDefaultServerAtom;

  static nsrefcnt gAccountManagerResourceRefCnt;

  static nsresult getAccountArcs(nsIMutableArray **aResult);
  static nsresult getAccountRootArcs(nsIMutableArray **aResult);
  
private:
  nsresult serverHasIdentities(nsIMsgIncomingServer *aServer, bool *aResult);
  nsresult getStringBundle();

  static nsCOMPtr<nsIMutableArray> mAccountArcsOut;
  static nsCOMPtr<nsIMutableArray> mAccountRootArcsOut;
  nsWeakPtr mAccountManager;
  nsCOMPtr<nsIStringBundle> mStringBundle;
};

#endif /* __nsMsgAccountManagerDS_h */
