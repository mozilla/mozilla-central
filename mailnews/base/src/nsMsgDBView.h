/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgDBView_H_
#define _nsMsgDBView_H_

#include "nsIMsgDBView.h"
#include "nsIMsgWindow.h"
#include "nsIMessenger.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIDBChangeListener.h"
#include "nsITreeView.h"
#include "nsITreeBoxObject.h"
#include "nsITreeSelection.h"
#include "nsIMsgFolder.h"
#include "nsIDateTimeFormat.h"
#include "nsIMsgHeaderParser.h"
#include "nsIDOMElement.h"
#include "nsIAtom.h"
#include "nsIImapIncomingServer.h"
#include "nsIWeakReference.h"
#include "nsIMsgFilterPlugin.h"
#include "nsIStringBundle.h"
#include "nsMsgTagService.h"
#include "nsCOMArray.h"
#include "nsTArray.h"
#include "nsIMsgCustomColumnHandler.h"
#include "nsAutoPtr.h"
#include "nsIWeakReferenceUtils.h"
#define MESSENGER_STRING_URL       "chrome://messenger/locale/messenger.properties"

class nsVoidArray;

typedef nsAutoTArray<nsMsgViewIndex, 1> nsMsgViewIndexArray;

enum eFieldType {
    kCollationKey,
    kU32
};

// this is used in an nsTArray<> to keep track of a multi-column sort
class MsgViewSortColumnInfo
{
public:
  MsgViewSortColumnInfo(const MsgViewSortColumnInfo &other);
  MsgViewSortColumnInfo() {}
  bool operator == (const MsgViewSortColumnInfo &other) const;
  nsMsgViewSortTypeValue mSortType;
  nsMsgViewSortOrderValue mSortOrder;
  // if mSortType == byCustom, info about the custom column sort
  nsString mCustomColumnName;
  nsCOMPtr <nsIMsgCustomColumnHandler> mColHandler;
} ;

// reserve the top 8 bits in the msg flags for the view-only flags.
#define MSG_VIEW_FLAGS 0xEE000000
#define MSG_VIEW_FLAG_HASCHILDREN 0x40000000
#define MSG_VIEW_FLAG_DUMMY 0x20000000
#define MSG_VIEW_FLAG_ISTHREAD 0x8000000

/* There currently only 5 labels defined */
#define PREF_LABELS_MAX 5
#define PREF_LABELS_DESCRIPTION  "mailnews.labels.description."
#define PREF_LABELS_COLOR  "mailnews.labels.color."

#define LABEL_COLOR_STRING " lc-"
#define LABEL_COLOR_WHITE_STRING "#FFFFFF"

struct IdUint32
{
  nsMsgKey    id;
  uint32_t    bits;
  uint32_t    dword;
  nsIMsgFolder* folder;
};

struct IdKey : public IdUint32
{
  // actually a variable length array, whose actual size is determined
  // when the struct is allocated.
  uint8_t     key[1];
};

struct IdKeyPtr : public IdUint32
{
  uint8_t     *key;
};

// This is an abstract implementation class.
// The actual view objects will be instances of sub-classes of this class
class nsMsgDBView : public nsIMsgDBView, public nsIDBChangeListener,
                    public nsITreeView,
                    public nsIJunkMailClassificationListener
{
public:
  nsMsgDBView();
  virtual ~nsMsgDBView();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGDBVIEW
  NS_DECL_NSIDBCHANGELISTENER
  NS_DECL_NSITREEVIEW
  NS_DECL_NSIJUNKMAILCLASSIFICATIONLISTENER

  nsMsgViewIndex GetInsertIndexHelper(nsIMsgDBHdr *msgHdr, nsTArray<nsMsgKey> &keys,
                                      nsCOMArray<nsIMsgFolder> *folders,
                                        nsMsgViewSortOrderValue sortOrder,
                                        nsMsgViewSortTypeValue sortType);
  int32_t  SecondarySort(nsMsgKey key1, nsISupports *folder1, nsMsgKey key2, nsISupports *folder2,
                         class viewSortInfo *comparisonContext);

protected:
  static nsrefcnt gInstanceCount;

  static PRUnichar* kHighestPriorityString;
  static PRUnichar* kHighPriorityString;
  static PRUnichar* kLowestPriorityString;
  static PRUnichar* kLowPriorityString;
  static PRUnichar* kNormalPriorityString;

  static nsIAtom* kJunkMsgAtom;
  static nsIAtom* kNotJunkMsgAtom;

  static PRUnichar* kReadString;
  static PRUnichar* kRepliedString;
  static PRUnichar* kForwardedString;
  static PRUnichar* kNewString;

  nsCOMPtr<nsITreeBoxObject> mTree;
  nsCOMPtr<nsITreeSelection> mTreeSelection;
  uint32_t mNumSelectedRows; // we cache this to determine when to push command status notifications.
  bool           mSuppressMsgDisplay; // set when the message pane is collapsed
  bool           mSuppressCommandUpdating;
  bool           mRemovingRow; // set when we're telling the outline a row is being removed. used to suppress msg loading.
                        // during delete/move operations.
  bool          mCommandsNeedDisablingBecauseOfSelection;
  bool          mSuppressChangeNotification;
  bool          mGoForwardEnabled;
  bool          mGoBackEnabled;
  
  virtual const char * GetViewName(void) {return "MsgDBView"; }
  nsresult FetchAuthor(nsIMsgDBHdr * aHdr, nsAString &aAuthorString);
  nsresult FetchRecipients(nsIMsgDBHdr * aHdr, nsAString &aRecipientsString);
  nsresult FetchSubject(nsIMsgDBHdr * aMsgHdr, uint32_t aFlags, nsAString &aValue);
  nsresult FetchDate(nsIMsgDBHdr * aHdr, nsAString & aDateString, bool rcvDate = false);
  nsresult FetchStatus(uint32_t aFlags, nsAString &aStatusString);
  nsresult FetchSize(nsIMsgDBHdr * aHdr, nsAString & aSizeString);
  nsresult FetchPriority(nsIMsgDBHdr *aHdr, nsAString & aPriorityString);
  nsresult FetchLabel(nsIMsgDBHdr *aHdr, nsAString & aLabelString);
  nsresult FetchTags(nsIMsgDBHdr *aHdr, nsAString & aTagString);
  nsresult FetchKeywords(nsIMsgDBHdr *aHdr, nsACString & keywordString);
  nsresult FetchRowKeywords(nsMsgViewIndex aRow, nsIMsgDBHdr *aHdr,
                            nsACString & keywordString);
  nsresult FetchAccount(nsIMsgDBHdr * aHdr, nsAString& aAccount);
  nsresult CycleThreadedColumn(nsIDOMElement * aElement);

  // The default enumerator is over the db, but things like
  // quick search views will enumerate just the displayed messages.
  virtual nsresult GetMessageEnumerator(nsISimpleEnumerator **enumerator);
  // this is a message enumerator that enumerates based on the view contents
  virtual nsresult GetViewEnumerator(nsISimpleEnumerator **enumerator);

  // Save and Restore Selection are a pair of routines you should
  // use when performing an operation which is going to change the view
  // and you want to remember the selection. (i.e. for sorting). 
  // Call SaveAndClearSelection and we'll give you an array of msg keys for
  // the current selection. We also freeze and clear the selection. 
  // When you are done changing the view, 
  // call RestoreSelection passing in the same array
  // and we'll restore the selection AND unfreeze selection in the UI.
  nsresult SaveAndClearSelection(nsMsgKey *aCurrentMsgKey, nsTArray<nsMsgKey> &aMsgKeyArray);
  nsresult RestoreSelection(nsMsgKey aCurrentmsgKey, nsTArray<nsMsgKey> &aMsgKeyArray);

  // this is not safe to use when you have a selection
  // RowCountChanged() will call AdjustSelection() 
  // it should be called after SaveAndClearSelection() and before
  // RestoreSelection()
  nsresult AdjustRowCount(int32_t rowCountBeforeSort, int32_t rowCountAfterSort);

  nsresult GetSelectedIndices(nsMsgViewIndexArray& selection);
  nsresult GenerateURIForMsgKey(nsMsgKey aMsgKey, nsIMsgFolder *folder, nsACString &aURI);
// routines used in building up view
  virtual bool WantsThisThread(nsIMsgThread * thread);
  virtual nsresult AddHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex *resultIndex = nullptr);
  bool GetShowingIgnored() {return (m_viewFlags & nsMsgViewFlagsType::kShowIgnored) != 0;}
  bool OperateOnMsgsInCollapsedThreads();

  virtual nsresult OnNewHeader(nsIMsgDBHdr *aNewHdr, nsMsgKey parentKey, bool ensureListed);
  virtual nsMsgViewIndex GetInsertIndex(nsIMsgDBHdr *msgHdr);
  nsMsgViewIndex GetIndexForThread(nsIMsgDBHdr *hdr);
  nsMsgViewIndex GetThreadRootIndex(nsIMsgDBHdr *msgHdr);
  virtual nsresult GetMsgHdrForViewIndex(nsMsgViewIndex index, nsIMsgDBHdr **msgHdr);
  // given a view index, return the index of the top-level msg in the thread.
  nsMsgViewIndex GetThreadIndex(nsMsgViewIndex msgIndex);

  virtual void InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                              nsMsgKey msgKey, uint32_t flags, uint32_t level);
  virtual void SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index, 
                              nsMsgKey msgKey, uint32_t flags, uint32_t level);
  virtual bool InsertEmptyRows(nsMsgViewIndex viewIndex, int32_t numRows);
  virtual void RemoveRows(nsMsgViewIndex viewIndex, int32_t numRows);
  nsresult ToggleExpansion(nsMsgViewIndex index, uint32_t *numChanged);
  nsresult ExpandByIndex(nsMsgViewIndex index, uint32_t *pNumExpanded);
  nsresult CollapseByIndex(nsMsgViewIndex index, uint32_t *pNumCollapsed);
  nsresult ExpandAll();
  nsresult CollapseAll();
  nsresult ExpandAndSelectThread();

  // helper routines for thread expanding and collapsing.
  nsresult GetThreadCount(nsMsgViewIndex viewIndex, uint32_t *pThreadCount);
  /**
   * Retrieve the view index of the first displayed message in the given thread.
   * @param threadHdr The thread you care about.
   * @param allowDummy Should dummy headers be returned when the non-dummy
   *     header is available?  If the root node of the thread is a dummy header
   *     and you pass false, then we will return the first child of the thread
   *     unless the thread is elided, in which case we will return the root.
   *     If you pass true, we will always return the root.
   * @return the view index of the first message in the thread, if any.
   */
  nsMsgViewIndex GetIndexOfFirstDisplayedKeyInThread(nsIMsgThread *threadHdr,
      bool allowDummy=false);
  virtual nsresult GetFirstMessageHdrToDisplayInThread(nsIMsgThread *threadHdr, nsIMsgDBHdr **result);
  virtual nsMsgViewIndex ThreadIndexOfMsg(nsMsgKey msgKey,
                            nsMsgViewIndex msgIndex = nsMsgViewIndex_None,
                            int32_t *pThreadCount = nullptr,
                            uint32_t *pFlags = nullptr);
  nsMsgViewIndex ThreadIndexOfMsgHdr(nsIMsgDBHdr *msgHdr,
                                 nsMsgViewIndex msgIndex = nsMsgViewIndex_None,
                                 int32_t *pThreadCount = nullptr,
                                 uint32_t *pFlags = nullptr);
  nsMsgKey GetKeyOfFirstMsgInThread(nsMsgKey key);
  int32_t CountExpandedThread(nsMsgViewIndex index);
  virtual  nsresult ExpansionDelta(nsMsgViewIndex index, int32_t *expansionDelta);
  void ReverseSort();
  void ReverseThreads();
  nsresult SaveSortInfo(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  nsresult PersistFolderInfo(nsIDBFolderInfo **dbFolderInfo);
  void     SetMRUTimeForFolder(nsIMsgFolder *folder);

  nsMsgKey  GetAt(nsMsgViewIndex index)
                  {return m_keys.SafeElementAt(index, nsMsgKey_None);}
  nsMsgViewIndex FindViewIndex(nsMsgKey  key)
     {return FindKey(key, false);}
  /**
   * Find the message header if it is visible in this view.  (Messages in
   *     threads/groups that are elided will not be
   * @param msgHdr Message header to look for.
   * @param startIndex The index to start looking from.
   * @param allowDummy Are dummy headers acceptable?  If yes, then for a group
   *     with a dummy header, we return the root of the thread (the dummy
   *     header), otherwise we return the actual "content" header for the
   *     message.
   * @return The view index of the header found, if any.
   */
  virtual nsMsgViewIndex FindHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startIndex = 0,
                                 bool allowDummy=false);
  virtual nsMsgViewIndex FindKey(nsMsgKey key, bool expand);
  virtual nsresult GetDBForViewIndex(nsMsgViewIndex index, nsIMsgDatabase **db);
  virtual nsCOMArray<nsIMsgFolder>* GetFolders();
  virtual nsresult GetFolderFromMsgURI(const char *aMsgURI, nsIMsgFolder **aFolder);

  virtual nsresult ListIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex viewIndex, uint32_t *pNumListed);
  nsresult ListUnreadIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex startOfThreadViewIndex, uint32_t *pNumListed);
  nsMsgViewIndex FindParentInThread(nsMsgKey parentKey, nsMsgViewIndex startOfThreadViewIndex);
  virtual nsresult ListIdsInThreadOrder(nsIMsgThread *threadHdr,
                                        nsMsgKey parentKey, uint32_t level,
                                        nsMsgViewIndex *viewIndex,
                                        uint32_t *pNumListed);
  uint32_t GetSize(void) {return(m_keys.Length());}

  // notification api's
  void  NoteStartChange(nsMsgViewIndex firstlineChanged, int32_t numChanged,
                        nsMsgViewNotificationCodeValue changeType);
  void  NoteEndChange(nsMsgViewIndex firstlineChanged, int32_t numChanged,
                        nsMsgViewNotificationCodeValue changeType);

  // for commands
  virtual nsresult ApplyCommandToIndices(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                                         int32_t numIndices);
  virtual nsresult ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    int32_t numIndices, nsIMsgFolder *destFolder);
  virtual nsresult CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool isMove, nsIMsgFolder *destFolder);
  virtual nsresult DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool deleteStorage);
  nsresult GetHeadersFromSelection(uint32_t *indices, uint32_t numIndices, nsIMutableArray *messageArray);
  virtual nsresult ListCollapsedChildren(nsMsgViewIndex viewIndex,
                                         nsIMutableArray *messageArray);

  nsresult SetMsgHdrJunkStatus(nsIJunkMailPlugin *aJunkPlugin,
                               nsIMsgDBHdr *aMsgHdr,
                               nsMsgJunkStatus aNewClassification);
  nsresult ToggleReadByIndex(nsMsgViewIndex index);
  nsresult SetReadByIndex(nsMsgViewIndex index, bool read);
  nsresult SetThreadOfMsgReadByIndex(nsMsgViewIndex index, nsTArray<nsMsgKey> &keysMarkedRead, bool read);
  nsresult SetFlaggedByIndex(nsMsgViewIndex index, bool mark);
  nsresult SetLabelByIndex(nsMsgViewIndex index, nsMsgLabelValue label);
  nsresult OrExtraFlag(nsMsgViewIndex index, uint32_t orflag);
  nsresult AndExtraFlag(nsMsgViewIndex index, uint32_t andflag);
  nsresult SetExtraFlag(nsMsgViewIndex index, uint32_t extraflag);
  virtual nsresult RemoveByIndex(nsMsgViewIndex index);
  virtual void OnExtraFlagChanged(nsMsgViewIndex /*index*/, uint32_t /*extraFlag*/) {}
  virtual void OnHeaderAddedOrDeleted() {}	
  nsresult ToggleWatched( nsMsgViewIndex* indices,	int32_t numIndices);
  nsresult SetThreadWatched(nsIMsgThread *thread, nsMsgViewIndex index, bool watched);
  nsresult SetThreadIgnored(nsIMsgThread *thread, nsMsgViewIndex threadIndex, bool ignored);
  nsresult SetSubthreadKilled(nsIMsgDBHdr *header, nsMsgViewIndex msgIndex, bool ignored);
  nsresult DownloadForOffline(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices);
  nsresult DownloadFlaggedForOffline(nsIMsgWindow *window);
  nsMsgViewIndex	GetThreadFromMsgIndex(nsMsgViewIndex index, nsIMsgThread **threadHdr);
  /// Should junk commands be enabled for the current message in the view?
  bool JunkControlsEnabled(nsMsgViewIndex aViewIndex);

  // for sorting
  nsresult GetFieldTypeAndLenForSort(nsMsgViewSortTypeValue sortType, uint16_t *pMaxLen, eFieldType *pFieldType);
  nsresult GetCollationKey(nsIMsgDBHdr *msgHdr, nsMsgViewSortTypeValue sortType, uint8_t **result, 
                          uint32_t *len, nsIMsgCustomColumnHandler* colHandler = nullptr);
  nsresult GetLongField(nsIMsgDBHdr *msgHdr, nsMsgViewSortTypeValue sortType, uint32_t *result, 
                          nsIMsgCustomColumnHandler* colHandler = nullptr);
  static int FnSortIdKey(const void *pItem1, const void *pItem2, void *privateData);
  static int FnSortIdKeyPtr(const void *pItem1, const void *pItem2, void *privateData);
  static int FnSortIdUint32(const void *pItem1, const void *pItem2, void *privateData);

  nsresult GetStatusSortValue(nsIMsgDBHdr *msgHdr, uint32_t *result);
  nsresult GetLocationCollationKey(nsIMsgDBHdr *msgHdr, uint8_t **result, uint32_t *len);
  void PushSort(const MsgViewSortColumnInfo &newSort);
  nsresult EncodeColumnSort(nsString &columnSortString);
  nsresult DecodeColumnSort(nsString &columnSortString);
  // for view navigation
  nsresult NavigateFromPos(nsMsgNavigationTypeValue motion, nsMsgViewIndex startIndex, nsMsgKey *pResultKey, 
              nsMsgViewIndex *pResultIndex, nsMsgViewIndex *pThreadIndex, bool wrap);
  nsresult FindNextFlagged(nsMsgViewIndex startIndex, nsMsgViewIndex *pResultIndex);
  nsresult FindFirstNew(nsMsgViewIndex *pResultIndex);
  nsresult FindPrevUnread(nsMsgKey startKey, nsMsgKey *pResultKey, nsMsgKey *resultThreadId);
  nsresult FindFirstFlagged(nsMsgViewIndex *pResultIndex);
  nsresult FindPrevFlagged(nsMsgViewIndex startIndex, nsMsgViewIndex *pResultIndex);
  nsresult MarkThreadOfMsgRead(nsMsgKey msgId, nsMsgViewIndex msgIndex, nsTArray<nsMsgKey> &idsMarkedRead, bool bRead);
  nsresult MarkThreadRead(nsIMsgThread *threadHdr, nsMsgViewIndex threadIndex, nsTArray<nsMsgKey> &idsMarkedRead, bool bRead);
  bool IsValidIndex(nsMsgViewIndex index);
  nsresult ToggleIgnored(nsMsgViewIndex * indices, int32_t numIndices, nsMsgViewIndex *resultIndex, bool *resultToggleState);
  nsresult ToggleMessageKilled(nsMsgViewIndex * indices, int32_t numIndices, nsMsgViewIndex *resultIndex, bool *resultToggleState);
  bool OfflineMsgSelected(nsMsgViewIndex * indices, int32_t numIndices);
  bool NonDummyMsgSelected(nsMsgViewIndex * indices, int32_t numIndices);
  PRUnichar * GetString(const PRUnichar *aStringName);
  nsresult GetPrefLocalizedString(const char *aPrefName, nsString& aResult);
  nsresult GetLabelPrefStringAndAtom(const char *aPrefName, nsString& aColor, nsIAtom** aColorAtom);
  nsresult AppendKeywordProperties(const nsACString& keywords, nsAString& properties, bool addSelectedTextProperty);
  nsresult InitLabelStrings(void);
  nsresult CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater);
  void InitializeAtomsAndLiterals();
  virtual int32_t FindLevelInThread(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startOfThread, nsMsgViewIndex viewIndex);
  nsresult GetImapDeleteModel(nsIMsgFolder *folder);
  nsresult UpdateDisplayMessage(nsMsgViewIndex viewPosition);
  nsresult GetDBForHeader(nsIMsgDBHdr *msgHdr, nsIMsgDatabase **db);

  bool AdjustReadFlag(nsIMsgDBHdr *msgHdr, uint32_t *msgFlags);
  void FreeAll(nsVoidArray *ptrs);
  void ClearHdrCache();
  nsTArray<nsMsgKey> m_keys;
  nsTArray<uint32_t> m_flags;
  nsTArray<uint8_t> m_levels;
  nsMsgImapDeleteModel mDeleteModel;

  // cache the most recently asked for header and corresponding msgKey.
  nsCOMPtr <nsIMsgDBHdr>  m_cachedHdr;
  nsMsgKey                m_cachedMsgKey;

  // we need to store the message key for the message we are currenty displaying to ensure we
  // don't try to redisplay the same message just because the selection changed (i.e. after a sort)
  nsMsgKey                m_currentlyDisplayedMsgKey;
  nsCString               m_currentlyDisplayedMsgUri;
  nsMsgViewIndex          m_currentlyDisplayedViewIndex;
  // if we're deleting messages, we want to hold off loading messages on selection changed until the delete is done
  // and we want to batch notifications.
  bool m_deletingRows;
  // for certain special folders 
  // and decendents of those folders
  // (like the "Sent" folder, "Sent/Old Sent")
  // the Sender column really shows recipients.

  // Server types for this view's folder
  bool mIsNews;             // we have special icons for news
  bool mIsRss;              // rss affects enabling of junk commands
  bool mIsXFVirtual;        // a virtual folder with multiple folders

  bool mShowSizeInLines;    // for news we show lines instead of size when true
  bool mSortThreadsByRoot;  // as opposed to by the newest message
  bool m_sortValid;
  bool mSelectionSummarized;
  // we asked the front end to summarize the selection and it did not.
  bool mSummarizeFailed;
  uint8_t      m_saveRestoreSelectionDepth;

  nsCOMPtr <nsIMsgDatabase> m_db;
  nsCOMPtr <nsIMsgFolder> m_folder;
  nsCOMPtr <nsIMsgFolder> m_viewFolder; // for virtual folders, the VF db.
  nsString mMessageType;
  nsTArray <MsgViewSortColumnInfo> m_sortColumns;
  nsMsgViewSortTypeValue  m_sortType;
  nsMsgViewSortOrderValue m_sortOrder;
  nsMsgViewSortTypeValue m_secondarySort;
  nsMsgViewSortOrderValue m_secondarySortOrder;
  nsMsgViewFlagsTypeValue m_viewFlags;

  // I18N date formatter service which we'll want to cache locally.
  nsCOMPtr<nsIDateTimeFormat> mDateFormatter;
  nsCOMPtr<nsIMsgHeaderParser> mHeaderParser;
  nsCOMPtr<nsIMsgTagService> mTagService;
  nsWeakPtr mMessengerWeak;
  nsWeakPtr mMsgWindowWeak;
  nsCOMPtr<nsIMsgDBViewCommandUpdater> mCommandUpdater; // we push command update notifications to the UI from this.
  nsCOMPtr<nsIStringBundle> mMessengerStringBundle;  

  // used for the preference labels
  nsString mLabelPrefDescriptions[PREF_LABELS_MAX];
  nsString mLabelPrefColors[PREF_LABELS_MAX];
  // used to cache the atoms created for each color to be displayed
  static nsIAtom* mLabelPrefColorAtoms[PREF_LABELS_MAX];

  // used to determine when to start and end
  // junk plugin batches
  uint32_t mNumMessagesRemainingInBatch;

  // these are the headers of the messages in the current
  // batch/series of batches of messages manually marked
  // as junk
  nsCOMPtr<nsIMutableArray> mJunkHdrs;
  
  nsTArray<uint32_t> mIndicesToNoteChange;

  // the saved search views keep track of the XX most recently deleted msg ids, so that if the 
  // delete is undone, we can add the msg back to the search results, even if it no longer
  // matches the search criteria (e.g., a saved search over unread messages).
  // We use mRecentlyDeletedArrayIndex to treat the array as a list of the XX
  // most recently deleted msgs.
  nsTArray<nsCString> mRecentlyDeletedMsgIds;
  uint32_t mRecentlyDeletedArrayIndex;
  void RememberDeletedMsgHdr(nsIMsgDBHdr *msgHdr);
  bool WasHdrRecentlyDeleted(nsIMsgDBHdr *msgHdr);
  
  //these hold pointers (and IDs) for the nsIMsgCustomColumnHandler object that constitutes the custom column handler
  nsCOMArray <nsIMsgCustomColumnHandler> m_customColumnHandlers;
  nsTArray<nsString> m_customColumnHandlerIDs;
  
  nsIMsgCustomColumnHandler* GetColumnHandler(const PRUnichar*);
  nsIMsgCustomColumnHandler* GetCurColumnHandlerFromDBInfo();

#ifdef DEBUG_David_Bienvenu
void InitEntryInfoForIndex(nsMsgViewIndex i, IdKeyPtr &EntryInfo);
void ValidateSort();
#endif

protected:
  static nsresult   InitDisplayFormats();

private:
  static nsDateFormatSelector  m_dateFormatDefault;
  static nsDateFormatSelector  m_dateFormatThisWeek;
  static nsDateFormatSelector  m_dateFormatToday;
  bool ServerSupportsFilterAfterTheFact();

  nsresult PerformActionsOnJunkMsgs(bool msgsAreJunk);
  nsresult DetermineActionsForJunkChange(bool msgsAreJunk,
                                         nsIMsgFolder *srcFolder,
                                         bool &moveMessages,
                                         bool &changeReadState,
                                         nsIMsgFolder** targetFolder);

  class nsMsgViewHdrEnumerator : public nsISimpleEnumerator 
  {
  public:
    NS_DECL_ISUPPORTS

    // nsISimpleEnumerator methods:
    NS_DECL_NSISIMPLEENUMERATOR

    // nsMsgThreadEnumerator methods:
    nsMsgViewHdrEnumerator(nsMsgDBView *view);
    ~nsMsgViewHdrEnumerator();

    nsRefPtr <nsMsgDBView> m_view;
    nsMsgViewIndex m_curHdrIndex;
  };
};

#endif
