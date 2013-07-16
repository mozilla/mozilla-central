/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Attributes.h"
#include "nsIRDFDataSource.h"
#include "nsIRDFService.h"

#include "nsIFolderListener.h"
#include "nsMsgRDFDataSource.h"

#include "nsITransactionManager.h"
#include "nsCOMArray.h"
#include "nsIMutableArray.h"
/**
 * The mail data source.
 */
class nsMsgFolderDataSource : public nsMsgRDFDataSource,
                              public nsIFolderListener
{
public:
  
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIFOLDERLISTENER

  nsMsgFolderDataSource(void);
  virtual ~nsMsgFolderDataSource (void);
  virtual nsresult Init() MOZ_OVERRIDE;
  virtual void Cleanup() MOZ_OVERRIDE;

  // nsIRDFDataSource methods
  NS_IMETHOD GetURI(char* *uri) MOZ_OVERRIDE;

  NS_IMETHOD GetSource(nsIRDFResource* property,
                       nsIRDFNode* target,
                       bool tv,
                       nsIRDFResource** source /* out */) MOZ_OVERRIDE;

  NS_IMETHOD GetTarget(nsIRDFResource* source,
                       nsIRDFResource* property,
                       bool tv,
                       nsIRDFNode** target) MOZ_OVERRIDE;

  NS_IMETHOD GetSources(nsIRDFResource* property,
                        nsIRDFNode* target,
                        bool tv,
                        nsISimpleEnumerator** sources) MOZ_OVERRIDE;

  NS_IMETHOD GetTargets(nsIRDFResource* source,
                        nsIRDFResource* property,    
                        bool tv,
                        nsISimpleEnumerator** targets) MOZ_OVERRIDE;

  NS_IMETHOD Assert(nsIRDFResource* source,
                    nsIRDFResource* property, 
                    nsIRDFNode* target,
                    bool tv) MOZ_OVERRIDE;

  NS_IMETHOD Unassert(nsIRDFResource* source,
                      nsIRDFResource* property,
                      nsIRDFNode* target) MOZ_OVERRIDE;

  NS_IMETHOD HasAssertion(nsIRDFResource* source,
                          nsIRDFResource* property,
                          nsIRDFNode* target,
                          bool tv,
                          bool* hasAssertion) MOZ_OVERRIDE;

  NS_IMETHOD HasArcOut(nsIRDFResource *aSource, nsIRDFResource *aArc,
                       bool *result) MOZ_OVERRIDE;

  NS_IMETHOD ArcLabelsIn(nsIRDFNode* node,
                         nsISimpleEnumerator** labels) MOZ_OVERRIDE;

  NS_IMETHOD ArcLabelsOut(nsIRDFResource* source,
                          nsISimpleEnumerator** labels) MOZ_OVERRIDE; 

  NS_IMETHOD GetAllResources(nsISimpleEnumerator** aResult) MOZ_OVERRIDE;

  NS_IMETHOD GetAllCmds(nsIRDFResource* source,
                            nsISimpleEnumerator/*<nsIRDFResource>*/** commands
                        ) MOZ_OVERRIDE;

  NS_IMETHOD IsCommandEnabled(nsISupportsArray/*<nsIRDFResource>*/* aSources,
                              nsIRDFResource*   aCommand,
                              nsISupportsArray/*<nsIRDFResource>*/* aArguments,
                              bool* aResult) MOZ_OVERRIDE;

  NS_IMETHOD DoCommand(nsISupportsArray/*<nsIRDFResource>*/* aSources,
                       nsIRDFResource*   aCommand,
                       nsISupportsArray/*<nsIRDFResource>*/* aArguments) MOZ_OVERRIDE;
protected:

  nsresult GetSenderName(nsAutoString& sender, nsAutoString *senderUserName);

  nsresult createFolderNode(nsIMsgFolder *folder, nsIRDFResource* property,
                            nsIRDFNode **target);
  nsresult createFolderNameNode(nsIMsgFolder *folder, nsIRDFNode **target, bool sort);
  nsresult createFolderOpenNode(nsIMsgFolder *folder,nsIRDFNode **target);
  nsresult createFolderTreeNameNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createFolderTreeSimpleNameNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createFolderSpecialNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createFolderServerTypeNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createServerIsDeferredNode(nsIMsgFolder* folder,
                                      nsIRDFNode **target);
  nsresult createFolderCanCreateFoldersOnServerNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderCanFileMessagesOnServerNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderIsServerNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderIsSecureNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderCanSubscribeNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderSupportsOfflineNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderCanFileMessagesNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderCanCreateSubfoldersNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderCanRenameNode(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderCanCompactNode(nsIMsgFolder *folder,
                                     nsIRDFNode **target);
  nsresult createTotalMessagesNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createUnreadMessagesNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createFolderSizeNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createCharsetNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createBiffStateNodeFromFolder(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createBiffStateNodeFromFlag(uint32_t flag, nsIRDFNode **target);
  nsresult createHasUnreadMessagesNode(nsIMsgFolder *folder, bool aIncludeSubfolders, nsIRDFNode **target);
  nsresult createNewMessagesNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createFolderNoSelectNode(nsIMsgFolder *folder,
                                    nsIRDFNode **target);
  nsresult createFolderVirtualNode(nsIMsgFolder *folder,
                                    nsIRDFNode **target);
  nsresult createInVFEditSearchScopeNode(nsIMsgFolder* folder,
                                      nsIRDFNode **target);
  nsresult createFolderImapSharedNode(nsIMsgFolder *folder,
                                    nsIRDFNode **target);
  nsresult createFolderSynchronizeNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createFolderSyncDisabledNode(nsIMsgFolder *folder, nsIRDFNode **target);
  nsresult createCanSearchMessages(nsIMsgFolder *folder,
                                      nsIRDFNode **target);
  nsresult createFolderChildNode(nsIMsgFolder *folder, nsIRDFNode **target);

  nsresult getFolderArcLabelsOut(nsCOMArray<nsIRDFResource> &aArcs);
  
  nsresult DoDeleteFromFolder(nsIMsgFolder *folder,
                nsISupportsArray *arguments, nsIMsgWindow *msgWindow, bool reallyDelete);

  nsresult DoCopyToFolder(nsIMsgFolder *dstFolder, nsISupportsArray *arguments,
              nsIMsgWindow *msgWindow, bool isMove);

  nsresult DoFolderCopyToFolder(nsIMsgFolder *dstFolder, nsISupportsArray *arguments,
              nsIMsgWindow *msgWindow, bool isMoveFolder);

  nsresult DoNewFolder(nsIMsgFolder *folder, nsISupportsArray *arguments, 
                        nsIMsgWindow *window);

  nsresult DoFolderAssert(nsIMsgFolder *folder, nsIRDFResource *property, nsIRDFNode *target);
  nsresult DoFolderUnassert(nsIMsgFolder *folder, nsIRDFResource *property, nsIRDFNode *target);

  nsresult DoFolderHasAssertion(nsIMsgFolder *folder, nsIRDFResource *property, nsIRDFNode *target,
                                bool tv, bool *hasAssertion);

  nsresult GetBiffStateString(uint32_t biffState, nsAutoCString & biffStateStr);

  nsresult CreateUnreadMessagesNameString(int32_t unreadMessages, nsAutoString &nameString);
  nsresult CreateArcsOutEnumerator();

  virtual nsresult OnItemAddedOrRemoved(nsIMsgFolder *parentItem, nsISupports *item, bool added);

  nsresult OnUnreadMessagePropertyChanged(nsIRDFResource *folderResource, int32_t oldValue, int32_t newValue);
  nsresult OnTotalMessagePropertyChanged(nsIRDFResource *folderResource, int32_t oldValue, int32_t newValue);
  nsresult OnFolderSizePropertyChanged(nsIRDFResource *folderResource, int32_t oldValue, int32_t newValue);
  nsresult OnFolderSortOrderPropertyChanged(nsIRDFResource *folderResource, int32_t oldValue, int32_t newValue);
  nsresult NotifyFolderTreeNameChanged(nsIMsgFolder *folder, nsIRDFResource *folderResource, int32_t aUnreadMessages);
  nsresult NotifyFolderTreeSimpleNameChanged(nsIMsgFolder *folder, nsIRDFResource *folderResource);
  nsresult NotifyFolderNameChanged(nsIMsgFolder *folder, nsIRDFResource *folderResource);
  nsresult NotifyAncestors(nsIMsgFolder *aFolder, nsIRDFResource *aPropertyResource, nsIRDFNode *aNode);
  nsresult GetNumMessagesNode(int32_t numMessages, nsIRDFNode **node);
  nsresult GetFolderSizeNode(int32_t folderSize, nsIRDFNode **node);
  nsresult CreateLiterals(nsIRDFService *rdf);

  virtual nsresult GetFolderDisplayName(nsIMsgFolder *folder, nsString& folderName);

  static nsIRDFResource* kNC_Child;
  static nsIRDFResource* kNC_Folder;
  static nsIRDFResource* kNC_Name;
  static nsIRDFResource* kNC_Open;
  static nsIRDFResource* kNC_FolderTreeName;
  static nsIRDFResource* kNC_FolderTreeSimpleName;
  static nsIRDFResource* kNC_NameSort;
  static nsIRDFResource* kNC_FolderTreeNameSort;
  static nsIRDFResource* kNC_Columns;
  static nsIRDFResource* kNC_MSGFolderRoot;
  static nsIRDFResource* kNC_SpecialFolder;
  static nsIRDFResource* kNC_ServerType;
  static nsIRDFResource* kNC_IsDeferred;
  static nsIRDFResource* kNC_CanCreateFoldersOnServer;
  static nsIRDFResource* kNC_CanFileMessagesOnServer;
  static nsIRDFResource* kNC_IsServer;
  static nsIRDFResource* kNC_IsSecure;
  static nsIRDFResource* kNC_CanSubscribe;
  static nsIRDFResource* kNC_SupportsOffline;
  static nsIRDFResource* kNC_CanFileMessages;
  static nsIRDFResource* kNC_CanCreateSubfolders;
  static nsIRDFResource* kNC_CanRename;
  static nsIRDFResource* kNC_CanCompact;
  static nsIRDFResource* kNC_TotalMessages;
  static nsIRDFResource* kNC_TotalUnreadMessages;
  static nsIRDFResource* kNC_FolderSize;
  static nsIRDFResource* kNC_Charset;
  static nsIRDFResource* kNC_BiffState;
  static nsIRDFResource* kNC_HasUnreadMessages;
  static nsIRDFResource* kNC_NewMessages;
  static nsIRDFResource* kNC_SubfoldersHaveUnreadMessages;
  static nsIRDFResource* kNC_NoSelect;
  static nsIRDFResource* kNC_ImapShared;
  static nsIRDFResource* kNC_Synchronize;
  static nsIRDFResource* kNC_SyncDisabled;
  static nsIRDFResource* kNC_CanSearchMessages;
  static nsIRDFResource* kNC_VirtualFolder;
  static nsIRDFResource* kNC_InVFEditSearchScope;
  static nsIRDFResource* kNC_UnreadFolders; // maybe should be in nsMsgFlatFolderDataSource?
  static nsIRDFResource* kNC_FavoriteFolders; // maybe should be in nsMsgFlatFolderDataSource?
  static nsIRDFResource* kNC_RecentFolders; // maybe should be in nsMsgFlatFolderDataSource?
  // commands
  static nsIRDFResource* kNC_Delete;
  static nsIRDFResource* kNC_ReallyDelete;
  static nsIRDFResource* kNC_NewFolder;
  static nsIRDFResource* kNC_GetNewMessages;
  static nsIRDFResource* kNC_Copy;
  static nsIRDFResource* kNC_Move;
  static nsIRDFResource* kNC_CopyFolder;
  static nsIRDFResource* kNC_MoveFolder;
  static nsIRDFResource* kNC_MarkAllMessagesRead;
  static nsIRDFResource* kNC_Compact;
  static nsIRDFResource* kNC_CompactAll;
  static nsIRDFResource* kNC_Rename;
  static nsIRDFResource* kNC_EmptyTrash;
  static nsIRDFResource* kNC_DownloadFlagged;
  //Cached literals
  nsCOMPtr<nsIRDFNode> kTrueLiteral;
  nsCOMPtr<nsIRDFNode> kFalseLiteral;

  // property atoms
  static nsIAtom* kTotalMessagesAtom;
  static nsIAtom* kTotalUnreadMessagesAtom;
  static nsIAtom* kFolderSizeAtom;
  static nsIAtom* kBiffStateAtom;
  static nsIAtom* kSortOrderAtom;
  static nsIAtom* kNewMessagesAtom;
  static nsIAtom* kNameAtom;
  static nsIAtom* kSynchronizeAtom;
  static nsIAtom* kOpenAtom;
  static nsIAtom* kIsDeferredAtom;
  static nsIAtom* kIsSecureAtom;
  static nsrefcnt gFolderResourceRefCnt;
  static nsIAtom* kCanFileMessagesAtom;
  static nsIAtom* kInVFEditSearchScopeAtom;
  
  nsCOMArray<nsIRDFResource> kFolderArcsOutArray;

};


class nsMsgFlatFolderDataSource : public nsMsgFolderDataSource
{
public:
  // constructor could take a filter to filter out folders.
  nsMsgFlatFolderDataSource();
  virtual ~nsMsgFlatFolderDataSource();
  virtual nsresult Init() MOZ_OVERRIDE;
  virtual void Cleanup() MOZ_OVERRIDE;

  NS_IMETHOD GetURI(char* *uri) MOZ_OVERRIDE;
  NS_IMETHOD GetTargets(nsIRDFResource* source,
                        nsIRDFResource* property,    
                        bool tv,
                        nsISimpleEnumerator** targets) MOZ_OVERRIDE;
  NS_IMETHOD GetTarget(nsIRDFResource* source,
                       nsIRDFResource* property,
                       bool tv,
                       nsIRDFNode** target) MOZ_OVERRIDE;

  NS_IMETHOD HasAssertion(nsIRDFResource* source,
                            nsIRDFResource* property,
                            nsIRDFNode* target,
                            bool tv,
                            bool* hasAssertion) MOZ_OVERRIDE;
protected:
  virtual nsresult GetFolderDisplayName(nsIMsgFolder *folder,
                                        nsString& folderName) MOZ_OVERRIDE;
  virtual void EnsureFolders();
  virtual bool WantsThisFolder(nsIMsgFolder *folder);
          bool ResourceIsOurRoot(nsIRDFResource *resource);
  virtual nsresult OnItemAddedOrRemoved(nsIMsgFolder *parentItem, nsISupports *item,
                                        bool added) MOZ_OVERRIDE;

  nsCOMArray <nsIMsgFolder> m_folders;
  nsCOMPtr<nsIRDFResource>  m_rootResource; // the resource for our root
  nsCString m_dsName;
  bool m_builtFolders;
};


class nsMsgUnreadFoldersDataSource : public nsMsgFlatFolderDataSource
{
public:
  nsMsgUnreadFoldersDataSource() {m_dsName = "mailnewsunreadfolders";}
  virtual ~nsMsgUnreadFoldersDataSource() {}
  virtual nsresult NotifyPropertyChanged(nsIRDFResource *resource, 
                    nsIRDFResource *propertyResource, nsIRDFNode *newNode, 
                    nsIRDFNode *oldNode = nullptr) MOZ_OVERRIDE;
protected:
  virtual bool WantsThisFolder(nsIMsgFolder *folder) MOZ_OVERRIDE;
};

class nsMsgFavoriteFoldersDataSource : public nsMsgFlatFolderDataSource
{
public:
  nsMsgFavoriteFoldersDataSource() {m_dsName = "mailnewsfavefolders";}
  virtual ~nsMsgFavoriteFoldersDataSource() {}
protected:
  virtual bool WantsThisFolder(nsIMsgFolder *folder) MOZ_OVERRIDE;
};

class nsMsgRecentFoldersDataSource : public nsMsgFlatFolderDataSource
{
public:
  nsMsgRecentFoldersDataSource() {m_dsName = "mailnewsrecentfolders";
                                  m_cutOffDate = 0; m_maxNumFolders = 15;}
  virtual ~nsMsgRecentFoldersDataSource() {}
  virtual nsresult NotifyPropertyChanged(nsIRDFResource *resource, 
                    nsIRDFResource *property, nsIRDFNode *newNode, 
                    nsIRDFNode *oldNode) MOZ_OVERRIDE;
  NS_IMETHOD OnItemAdded(nsIMsgFolder *parentItem, nsISupports *item) MOZ_OVERRIDE;
  virtual void Cleanup() MOZ_OVERRIDE;
protected:
  virtual void EnsureFolders() MOZ_OVERRIDE;
  uint32_t m_cutOffDate;
  uint32_t m_maxNumFolders;
};
