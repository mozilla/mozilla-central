/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001-2003
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Dan Mosedale <dmose@netscape.com>
 *   David Bienvenu <bienvenu@mozilla.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#ifndef _nsMsgDBView_H_
#define _nsMsgDBView_H_

#include "nsIMsgDBView.h"
#include "nsIMsgWindow.h"
#include "nsIMessenger.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsMsgLineBuffer.h" // for nsByteArray
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIDBChangeListener.h"
#include "nsITreeView.h"
#include "nsITreeBoxObject.h"
#include "nsITreeSelection.h"
#include "nsVoidArray.h"
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
#define MESSENGER_STRING_URL       "chrome://messenger/locale/messenger.properties"

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
  PRBool operator == (const MsgViewSortColumnInfo &other) const;
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

#define LABEL_COLOR_STRING "lc-"
#define LABEL_COLOR_WHITE_STRING "#FFFFFF"

struct IdUint32
{
  nsMsgKey    id;
  PRUint32    bits;
  PRUint32    dword;
  nsIMsgFolder* folder;
};

struct IdKey : public IdUint32
{
  // actually a variable length array, whose actual size is determined
  // when the struct is allocated.
  PRUint8     key[1];
};

struct IdKeyPtr : public IdUint32
{
  PRUint8     *key;
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
  PRInt32  SecondarySort(nsMsgKey key1, nsISupports *folder1, nsMsgKey key2, nsISupports *folder2,
                         class viewSortInfo *comparisonContext);

protected:
  static nsrefcnt gInstanceCount;
  // atoms used for styling the view. we're going to have a lot of
  // these so i'm going to make them static.
  static nsIAtom* kUnreadMsgAtom;
  static nsIAtom* kNewMsgAtom;
  static nsIAtom* kReadMsgAtom;
  static nsIAtom* kRepliedMsgAtom;
  static nsIAtom* kForwardedMsgAtom;
  static nsIAtom* kOfflineMsgAtom;
  static nsIAtom* kFlaggedMsgAtom;
  static nsIAtom* kImapDeletedMsgAtom;
  static nsIAtom* kAttachMsgAtom;
  static nsIAtom* kHasUnreadAtom;
  static nsIAtom* kWatchThreadAtom;
  static nsIAtom* kIgnoreThreadAtom;
  static nsIAtom* kIgnoreSubthreadAtom;
  static nsIAtom* kHasImageAtom;

#ifdef SUPPORT_PRIORITY_COLORS
  static nsIAtom* kHighestPriorityAtom;
  static nsIAtom* kHighPriorityAtom;
  static nsIAtom* kLowestPriorityAtom;
  static nsIAtom* kLowPriorityAtom;
#endif

  static PRUnichar* kHighestPriorityString;
  static PRUnichar* kHighPriorityString;
  static PRUnichar* kLowestPriorityString;
  static PRUnichar* kLowPriorityString;
  static PRUnichar* kNormalPriorityString;

  static nsIAtom* kLabelColorWhiteAtom;
  static nsIAtom* kLabelColorBlackAtom;

  static nsIAtom* kJunkMsgAtom;
  static nsIAtom* kNotJunkMsgAtom;

  static nsIAtom* kDummyMsgAtom;

  static PRUnichar* kReadString;
  static PRUnichar* kRepliedString;
  static PRUnichar* kForwardedString;
  static PRUnichar* kNewString;

  static PRUnichar* kKiloByteString;

  nsCOMPtr<nsITreeBoxObject> mTree;
  nsCOMPtr<nsITreeSelection> mTreeSelection;
  PRUint32 mNumSelectedRows; // we cache this to determine when to push command status notifications.
  PRPackedBool   mSuppressMsgDisplay; // set when the message pane is collapsed
  PRPackedBool   mSuppressCommandUpdating;
  PRPackedBool   mRemovingRow; // set when we're telling the outline a row is being removed. used to suppress msg loading.
                        // during delete/move operations.
  PRPackedBool  mCommandsNeedDisablingBecauseOfSelection;
  PRPackedBool  mSuppressChangeNotification;
  PRPackedBool  mGoForwardEnabled;
  PRPackedBool  mGoBackEnabled;
  
  virtual const char * GetViewName(void) {return "MsgDBView"; }
  nsresult FetchAuthor(nsIMsgDBHdr * aHdr, nsAString &aAuthorString);
  nsresult FetchRecipients(nsIMsgDBHdr * aHdr, nsAString &aRecipientsString);
  nsresult FetchSubject(nsIMsgDBHdr * aMsgHdr, PRUint32 aFlags, nsAString &aValue);
  nsresult FetchDate(nsIMsgDBHdr * aHdr, nsAString & aDateString, PRBool rcvDate = PR_FALSE);
  nsresult FetchStatus(PRUint32 aFlags, nsAString &aStatusString);
  nsresult FetchSize(nsIMsgDBHdr * aHdr, nsAString & aSizeString);
  nsresult FetchPriority(nsIMsgDBHdr *aHdr, nsAString & aPriorityString);
  nsresult FetchLabel(nsIMsgDBHdr *aHdr, nsAString & aLabelString);
  nsresult FetchTags(nsIMsgDBHdr *aHdr, nsAString & aTagString);
  nsresult FetchKeywords(nsIMsgDBHdr *aHdr, nsACString & keywordString);
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
  nsresult AdjustRowCount(PRInt32 rowCountBeforeSort, PRInt32 rowCountAfterSort);

  nsresult GetSelectedIndices(nsMsgViewIndexArray& selection);
  nsresult GenerateURIForMsgKey(nsMsgKey aMsgKey, nsIMsgFolder *folder, nsACString &aURI);
// routines used in building up view
  virtual PRBool WantsThisThread(nsIMsgThread * thread);
  virtual nsresult AddHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex *resultIndex = nsnull);
  PRBool GetShowingIgnored() {return (m_viewFlags & nsMsgViewFlagsType::kShowIgnored) != 0;}
  PRBool OperateOnMsgsInCollapsedThreads();

  virtual nsresult OnNewHeader(nsIMsgDBHdr *aNewHdr, nsMsgKey parentKey, PRBool ensureListed);
  virtual nsMsgViewIndex GetInsertIndex(nsIMsgDBHdr *msgHdr);
  nsMsgViewIndex GetIndexForThread(nsIMsgDBHdr *hdr);
  nsMsgViewIndex GetThreadRootIndex(nsIMsgDBHdr *msgHdr);
  virtual nsresult GetMsgHdrForViewIndex(nsMsgViewIndex index, nsIMsgDBHdr **msgHdr);
  // given a view index, return the index of the top-level msg in the thread.
  nsMsgViewIndex GetThreadIndex(nsMsgViewIndex msgIndex);

  virtual void InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level);
  virtual void SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index, 
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level);
  virtual PRBool InsertEmptyRows(nsMsgViewIndex viewIndex, PRInt32 numRows);
  virtual void RemoveRows(nsMsgViewIndex viewIndex, PRInt32 numRows);
  nsresult ToggleExpansion(nsMsgViewIndex index, PRUint32 *numChanged);
  nsresult ExpandByIndex(nsMsgViewIndex index, PRUint32 *pNumExpanded);
  nsresult CollapseByIndex(nsMsgViewIndex index, PRUint32 *pNumCollapsed);
  nsresult ExpandAll();
  nsresult CollapseAll();
  nsresult ExpandAndSelectThread();

  // helper routines for thread expanding and collapsing.
  nsresult GetThreadCount(nsMsgViewIndex viewIndex, PRUint32 *pThreadCount);
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
      PRBool allowDummy=PR_FALSE);
  virtual nsresult GetFirstMessageHdrToDisplayInThread(nsIMsgThread *threadHdr, nsIMsgDBHdr **result);
  virtual nsMsgViewIndex ThreadIndexOfMsg(nsMsgKey msgKey,
                            nsMsgViewIndex msgIndex = nsMsgViewIndex_None,
                            PRInt32 *pThreadCount = nsnull,
                            PRUint32 *pFlags = nsnull);
  nsMsgViewIndex ThreadIndexOfMsgHdr(nsIMsgDBHdr *msgHdr,
                                 nsMsgViewIndex msgIndex = nsMsgViewIndex_None,
                                 PRInt32 *pThreadCount = nsnull,
                                 PRUint32 *pFlags = nsnull);
  virtual nsresult GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread);
  nsMsgKey GetKeyOfFirstMsgInThread(nsMsgKey key);
  PRInt32 CountExpandedThread(nsMsgViewIndex index);
  virtual  nsresult ExpansionDelta(nsMsgViewIndex index, PRInt32 *expansionDelta);
  void ReverseSort();
  void ReverseThreads();
  nsresult SaveSortInfo(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  nsresult PersistFolderInfo(nsIDBFolderInfo **dbFolderInfo);
  void     SetMRUTimeForFolder(nsIMsgFolder *folder);

  nsMsgKey  GetAt(nsMsgViewIndex index)
                  {return m_keys.SafeElementAt(index, nsMsgKey_None);}
  nsMsgViewIndex FindViewIndex(nsMsgKey  key)
     {return FindKey(key, PR_FALSE);}
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
                                 PRBool allowDummy=PR_FALSE);
  virtual nsMsgViewIndex FindKey(nsMsgKey key, PRBool expand);
  virtual nsresult GetDBForViewIndex(nsMsgViewIndex index, nsIMsgDatabase **db);
  virtual nsCOMArray<nsIMsgFolder>* GetFolders();
  virtual nsresult GetFolderFromMsgURI(const char *aMsgURI, nsIMsgFolder **aFolder);

  virtual nsresult ListIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex viewIndex, PRUint32 *pNumListed);
  nsresult ListUnreadIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex startOfThreadViewIndex, PRUint32 *pNumListed);
  nsMsgViewIndex FindParentInThread(nsMsgKey parentKey, nsMsgViewIndex startOfThreadViewIndex);
  virtual nsresult ListIdsInThreadOrder(nsIMsgThread *threadHdr,
                                        nsMsgKey parentKey, PRInt32 level,
                                        nsMsgViewIndex *viewIndex,
                                        PRUint32 *pNumListed);
  PRInt32  GetSize(void) {return(m_keys.Length());}

  // notification api's
  void  EnableChangeUpdates();
  void  DisableChangeUpdates();
  void  NoteChange(nsMsgViewIndex firstlineChanged, PRInt32 numChanged,
                    nsMsgViewNotificationCodeValue changeType);
  void  NoteStartChange(nsMsgViewIndex firstlineChanged, PRInt32 numChanged,
                        nsMsgViewNotificationCodeValue changeType);
  void  NoteEndChange(nsMsgViewIndex firstlineChanged, PRInt32 numChanged,
                        nsMsgViewNotificationCodeValue changeType);

  // for commands
  virtual nsresult ApplyCommandToIndices(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                                         PRInt32 numIndices);
  virtual nsresult ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    PRInt32 numIndices, nsIMsgFolder *destFolder);
  virtual nsresult CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, PRBool isMove, nsIMsgFolder *destFolder);
  virtual nsresult DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, PRBool deleteStorage);
  nsresult GetHeadersFromSelection(PRUint32 *indices, PRUint32 numIndices, nsIMutableArray *messageArray);
  virtual nsresult ListCollapsedChildren(nsMsgViewIndex viewIndex,
                                         nsIMutableArray *messageArray);

  nsresult SetMsgHdrJunkStatus(nsIJunkMailPlugin *aJunkPlugin,
                               nsIMsgDBHdr *aMsgHdr,
                               nsMsgJunkStatus aNewClassification);
  nsresult ToggleReadByIndex(nsMsgViewIndex index);
  nsresult SetReadByIndex(nsMsgViewIndex index, PRBool read);
  nsresult SetThreadOfMsgReadByIndex(nsMsgViewIndex index, nsTArray<nsMsgKey> &keysMarkedRead, PRBool read);
  nsresult SetFlaggedByIndex(nsMsgViewIndex index, PRBool mark);
  nsresult SetLabelByIndex(nsMsgViewIndex index, nsMsgLabelValue label);
  nsresult OrExtraFlag(nsMsgViewIndex index, PRUint32 orflag);
  nsresult AndExtraFlag(nsMsgViewIndex index, PRUint32 andflag);
  nsresult SetExtraFlag(nsMsgViewIndex index, PRUint32 extraflag);
  virtual nsresult RemoveByIndex(nsMsgViewIndex index);
  virtual void OnExtraFlagChanged(nsMsgViewIndex /*index*/, PRUint32 /*extraFlag*/) {}
  virtual void OnHeaderAddedOrDeleted() {}	
  nsresult ToggleWatched( nsMsgViewIndex* indices,	PRInt32 numIndices);
  nsresult SetThreadWatched(nsIMsgThread *thread, nsMsgViewIndex index, PRBool watched);
  nsresult SetThreadIgnored(nsIMsgThread *thread, nsMsgViewIndex threadIndex, PRBool ignored);
  nsresult SetSubthreadKilled(nsIMsgDBHdr *header, nsMsgViewIndex msgIndex, PRBool ignored);
  nsresult DownloadForOffline(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices);
  nsresult DownloadFlaggedForOffline(nsIMsgWindow *window);
  nsMsgViewIndex	GetThreadFromMsgIndex(nsMsgViewIndex index, nsIMsgThread **threadHdr);

  // for sorting
  nsresult GetFieldTypeAndLenForSort(nsMsgViewSortTypeValue sortType, PRUint16 *pMaxLen, eFieldType *pFieldType);
  nsresult GetCollationKey(nsIMsgDBHdr *msgHdr, nsMsgViewSortTypeValue sortType, PRUint8 **result, 
                          PRUint32 *len, nsIMsgCustomColumnHandler* colHandler = nsnull);
  nsresult GetLongField(nsIMsgDBHdr *msgHdr, nsMsgViewSortTypeValue sortType, PRUint32 *result, 
                          nsIMsgCustomColumnHandler* colHandler = nsnull);
  static int FnSortIdKey(const void *pItem1, const void *pItem2, void *privateData);
  static int FnSortIdKeyPtr(const void *pItem1, const void *pItem2, void *privateData);
  static int FnSortIdUint32(const void *pItem1, const void *pItem2, void *privateData);

  nsresult GetStatusSortValue(nsIMsgDBHdr *msgHdr, PRUint32 *result);
  nsresult GetLocationCollationKey(nsIMsgDBHdr *msgHdr, PRUint8 **result, PRUint32 *len);
  void PushSort(const MsgViewSortColumnInfo &newSort);
  nsresult EncodeColumnSort(nsString &columnSortString);
  nsresult DecodeColumnSort(nsString &columnSortString);
  // for view navigation
  nsresult NavigateFromPos(nsMsgNavigationTypeValue motion, nsMsgViewIndex startIndex, nsMsgKey *pResultKey, 
              nsMsgViewIndex *pResultIndex, nsMsgViewIndex *pThreadIndex, PRBool wrap);
  nsresult FindNextFlagged(nsMsgViewIndex startIndex, nsMsgViewIndex *pResultIndex);
  nsresult FindFirstNew(nsMsgViewIndex *pResultIndex);
  nsresult FindPrevUnread(nsMsgKey startKey, nsMsgKey *pResultKey, nsMsgKey *resultThreadId);
  nsresult FindFirstFlagged(nsMsgViewIndex *pResultIndex);
  nsresult FindPrevFlagged(nsMsgViewIndex startIndex, nsMsgViewIndex *pResultIndex);
  nsresult MarkThreadOfMsgRead(nsMsgKey msgId, nsMsgViewIndex msgIndex, nsTArray<nsMsgKey> &idsMarkedRead, PRBool bRead);
  nsresult MarkThreadRead(nsIMsgThread *threadHdr, nsMsgViewIndex threadIndex, nsTArray<nsMsgKey> &idsMarkedRead, PRBool bRead);
  PRBool IsValidIndex(nsMsgViewIndex index);
  nsresult ToggleIgnored(nsMsgViewIndex * indices, PRInt32 numIndices, nsMsgViewIndex *resultIndex, PRBool *resultToggleState);
  nsresult ToggleMessageKilled(nsMsgViewIndex * indices, PRInt32 numIndices, nsMsgViewIndex *resultIndex, PRBool *resultToggleState);
  PRBool OfflineMsgSelected(nsMsgViewIndex * indices, PRInt32 numIndices);
  PRBool NonDummyMsgSelected(nsMsgViewIndex * indices, PRInt32 numIndices);
  PRUnichar * GetString(const PRUnichar *aStringName);
  nsresult GetPrefLocalizedString(const char *aPrefName, nsString& aResult);
  nsresult GetLabelPrefStringAndAtom(const char *aPrefName, nsString& aColor, nsIAtom** aColorAtom);
  nsresult AppendKeywordProperties(const nsACString& keywords, nsISupportsArray *properties, PRBool addSelectedTextProperty);
  nsresult InitLabelStrings(void);
  nsresult CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater);
  void InitializeAtomsAndLiterals();
  virtual PRInt32 FindLevelInThread(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startOfThread, nsMsgViewIndex viewIndex);
  nsresult GetImapDeleteModel(nsIMsgFolder *folder);
  nsresult UpdateDisplayMessage(nsMsgViewIndex viewPosition);

  PRBool AdjustReadFlag(nsIMsgDBHdr *msgHdr, PRUint32 *msgFlags);
  void FreeAll(nsVoidArray *ptrs);
  void ClearHdrCache();
  nsTArray<nsMsgKey> m_keys;
  nsTArray<PRUint32> m_flags;
  nsTArray<PRUint8> m_levels;
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
  PRPackedBool m_deletingRows;
  // for certain special folders 
  // and decendents of those folders
  // (like the "Sent" folder, "Sent/Old Sent")
  // the Sender column really shows recipients.
  PRPackedBool mIsNews;             // we have special icons for news
  PRPackedBool mShowSizeInLines;    // for news we show lines instead of size when true
  PRPackedBool m_sortValid;
  PRPackedBool mSelectionSummarized;
  // we asked the front end to summarize the selection and it did not.
  PRPackedBool mSummarizeFailed;
  PRUint8      m_saveRestoreSelectionDepth;

  nsCOMPtr <nsIMsgDatabase> m_db;
  nsCOMPtr <nsIMsgFolder> m_folder;
  nsCOMPtr <nsIMsgFolder> m_viewFolder; // for virtual folders, the VF db.
  nsCOMPtr <nsIAtom> mMessageTypeAtom; // news, rss, mail, etc. 
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
  PRUint32 mNumMessagesRemainingInBatch;

  // these are the headers of the messages in the current
  // batch/series of batches of messages manually marked
  // as junk
  nsCOMPtr<nsIMutableArray> mJunkHdrs;
  
  nsTArray<PRUint32> mIndicesToNoteChange;

  // the saved search views keep track of the XX most recently deleted msg ids, so that if the 
  // delete is undone, we can add the msg back to the search results, even if it no longer
  // matches the search criteria (e.g., a saved search over unread messages).
  // We use mRecentlyDeletedArrayIndex to treat the array as a list of the XX
  // most recently deleted msgs.
  nsCStringArray mRecentlyDeletedMsgIds;
  PRInt32        mRecentlyDeletedArrayIndex;
  void RememberDeletedMsgHdr(nsIMsgDBHdr *msgHdr);
  PRBool WasHdrRecentlyDeleted(nsIMsgDBHdr *msgHdr);
  
  //these hold pointers (and IDs) for the nsIMsgCustomColumnHandler object that constitutes the custom column handler
  nsCOMArray <nsIMsgCustomColumnHandler> m_customColumnHandlers;
  nsStringArray m_customColumnHandlerIDs;
  
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
  PRBool ServerSupportsFilterAfterTheFact();

  nsresult PerformActionsOnJunkMsgs(PRBool msgsAreJunk);
  nsresult DetermineActionsForJunkChange(PRBool msgsAreJunk,
                                         nsIMsgFolder *srcFolder,
                                         PRBool &moveMessages,
                                         PRBool &changeReadState,
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
