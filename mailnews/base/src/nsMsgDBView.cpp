/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "prmem.h"
#include "nsArrayUtils.h"
#include "nsIMsgCustomColumnHandler.h"
#include "nsMsgDBView.h"
#include "nsISupports.h"
#include "nsIMsgFolder.h"
#include "nsIDBFolderInfo.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgFolder.h"
#include "MailNewsTypes2.h"
#include "nsMsgUtils.h"
#include "nsQuickSort.h"
#include "nsIMsgImapMailFolder.h"
#include "nsImapCore.h"
#include "nsMsgFolderFlags.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIDOMElement.h"
#include "nsDateTimeFormatCID.h"
#include "nsMsgMimeCID.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIPrefLocalizedString.h"
#include "nsIMsgSearchSession.h"
#include "nsIMsgCopyService.h"
#include "nsMsgBaseCID.h"
#include "nsISpamSettings.h"
#include "nsIMsgAccountManager.h"
#include "nsITreeColumns.h"
#include "nsTextFormatter.h"
#include "nsIMutableArray.h"
#include "nsIMimeConverter.h"
#include "nsMsgMessageFlags.h"
#include "nsIPrompt.h"
#include "nsIWindowWatcher.h"
#include "nsMsgDBCID.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMemory.h"
#include "nsAlgorithm.h"
#include "nsIAbManager.h"
#include "nsIAbDirectory.h"
#include "nsIAbCard.h"
#include "mozilla/Services.h"
#include "nsVoidArray.h"
#include <algorithm>

nsrefcnt nsMsgDBView::gInstanceCount  = 0;

nsIAtom * nsMsgDBView::kJunkMsgAtom = nullptr;
nsIAtom * nsMsgDBView::kNotJunkMsgAtom = nullptr;

PRUnichar * nsMsgDBView::kHighestPriorityString = nullptr;
PRUnichar * nsMsgDBView::kHighPriorityString = nullptr;
PRUnichar * nsMsgDBView::kLowestPriorityString = nullptr;
PRUnichar * nsMsgDBView::kLowPriorityString = nullptr;
PRUnichar * nsMsgDBView::kNormalPriorityString = nullptr;
PRUnichar * nsMsgDBView::kReadString = nullptr;
PRUnichar * nsMsgDBView::kRepliedString = nullptr;
PRUnichar * nsMsgDBView::kForwardedString = nullptr;
PRUnichar * nsMsgDBView::kNewString = nullptr;

nsDateFormatSelector  nsMsgDBView::m_dateFormatDefault = kDateFormatShort;
nsDateFormatSelector  nsMsgDBView::m_dateFormatThisWeek = kDateFormatShort;
nsDateFormatSelector  nsMsgDBView::m_dateFormatToday = kDateFormatNone;

static const uint32_t kMaxNumSortColumns = 2;

static void GetCachedName(const nsCString& unparsedString,
                          int32_t displayVersion, nsACString& cachedName);

static void UpdateCachedName(nsIMsgDBHdr *aHdr, const char *header_field,
                             const nsAString& newName);

// this is passed into NS_QuickSort as custom data.
class viewSortInfo
{
public:
  nsMsgDBView *view;
  nsIMsgDatabase *db;
  bool isSecondarySort;
  bool ascendingSort;
};


NS_IMPL_ADDREF(nsMsgDBView)
NS_IMPL_RELEASE(nsMsgDBView)

NS_INTERFACE_MAP_BEGIN(nsMsgDBView)
   NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMsgDBView)
   NS_INTERFACE_MAP_ENTRY(nsIMsgDBView)
   NS_INTERFACE_MAP_ENTRY(nsIDBChangeListener)
   NS_INTERFACE_MAP_ENTRY(nsITreeView)
   NS_INTERFACE_MAP_ENTRY(nsIJunkMailClassificationListener)
NS_INTERFACE_MAP_END

nsMsgDBView::nsMsgDBView()
{
  /* member initializers and constructor code */
  m_sortValid = false;
  m_sortOrder = nsMsgViewSortOrder::none;
  m_viewFlags = nsMsgViewFlagsType::kNone;
  m_secondarySort = nsMsgViewSortType::byId;
  m_secondarySortOrder = nsMsgViewSortOrder::ascending;
  m_cachedMsgKey = nsMsgKey_None;
  m_currentlyDisplayedMsgKey = nsMsgKey_None;
  m_currentlyDisplayedViewIndex = nsMsgViewIndex_None;
  mNumSelectedRows = 0;
  mSuppressMsgDisplay = false;
  mSuppressCommandUpdating = false;
  mSuppressChangeNotification = false;
  mSummarizeFailed = false;
  mSelectionSummarized = false;
  mGoForwardEnabled = false;
  mGoBackEnabled = false;

  mIsNews = false;
  mIsRss = false;
  mIsXFVirtual = false;
  mDeleteModel = nsMsgImapDeleteModels::MoveToTrash;
  m_deletingRows = false;
  mNumMessagesRemainingInBatch = 0;
  mShowSizeInLines = false;

  /* mCommandsNeedDisablingBecauseOfSelection - A boolean that tell us if we needed to disable commands because of what's selected.
    If we're offline w/o a downloaded msg selected, or a dummy message was selected.
  */

  mCommandsNeedDisablingBecauseOfSelection = false;
  mRemovingRow = false;
  m_saveRestoreSelectionDepth = 0;
  mRecentlyDeletedArrayIndex = 0;
  // initialize any static atoms or unicode strings
  if (gInstanceCount == 0)
  {
    InitializeAtomsAndLiterals();
    InitDisplayFormats();
  }

  InitLabelStrings();
  gInstanceCount++;
}

void nsMsgDBView::InitializeAtomsAndLiterals()
{
  kJunkMsgAtom = MsgNewAtom("junk").get();
  kNotJunkMsgAtom = MsgNewAtom("notjunk").get();

  // priority strings
  kHighestPriorityString = GetString(NS_LITERAL_STRING("priorityHighest").get());
  kHighPriorityString = GetString(NS_LITERAL_STRING("priorityHigh").get());
  kLowestPriorityString = GetString(NS_LITERAL_STRING("priorityLowest").get());
  kLowPriorityString = GetString(NS_LITERAL_STRING("priorityLow").get());
  kNormalPriorityString = GetString(NS_LITERAL_STRING("priorityNormal").get());

  kReadString = GetString(NS_LITERAL_STRING("read").get());
  kRepliedString = GetString(NS_LITERAL_STRING("replied").get());
  kForwardedString = GetString(NS_LITERAL_STRING("forwarded").get());
  kNewString = GetString(NS_LITERAL_STRING("new").get());
}

nsMsgDBView::~nsMsgDBView()
{
  if (m_db)
    m_db->RemoveListener(this);

  gInstanceCount--;
  if (gInstanceCount <= 0)
  {
    NS_IF_RELEASE(kJunkMsgAtom);
    NS_IF_RELEASE(kNotJunkMsgAtom);

    NS_Free(kHighestPriorityString);
    NS_Free(kHighPriorityString);
    NS_Free(kLowestPriorityString);
    NS_Free(kLowPriorityString);
    NS_Free(kNormalPriorityString);

    NS_Free(kReadString);
    NS_Free(kRepliedString);
    NS_Free(kForwardedString);
    NS_Free(kNewString);
  }
}

nsresult nsMsgDBView::InitLabelStrings()
{
  nsresult rv = NS_OK;
  nsCString prefString;

  for(int32_t i = 0; i < PREF_LABELS_MAX; i++)
  {
    prefString.Assign(PREF_LABELS_DESCRIPTION);
    prefString.AppendInt(i + 1);
    rv = GetPrefLocalizedString(prefString.get(), mLabelPrefDescriptions[i]);
  }
  return rv;
}

// helper function used to fetch strings from the messenger string bundle
PRUnichar * nsMsgDBView::GetString(const PRUnichar *aStringName)
{
  nsresult    res = NS_ERROR_UNEXPECTED;
  PRUnichar   *ptrv = nullptr;

  if (!mMessengerStringBundle)
  {
    static const char propertyURL[] = MESSENGER_STRING_URL;
    nsCOMPtr<nsIStringBundleService> sBundleService =
      mozilla::services::GetStringBundleService();
    if (sBundleService)
      res = sBundleService->CreateBundle(propertyURL, getter_AddRefs(mMessengerStringBundle));
  }

  if (mMessengerStringBundle)
    res = mMessengerStringBundle->GetStringFromName(aStringName, &ptrv);

  if ( NS_SUCCEEDED(res) && (ptrv) )
    return ptrv;
  else
    return NS_strdup(aStringName);
}

// helper function used to fetch localized strings from the prefs
nsresult nsMsgDBView::GetPrefLocalizedString(const char *aPrefName, nsString& aResult)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIPrefBranch> prefBranch;
  nsCOMPtr<nsIPrefLocalizedString> pls;
  nsString ucsval;

  prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = prefBranch->GetComplexValue(aPrefName, NS_GET_IID(nsIPrefLocalizedString), getter_AddRefs(pls));
  NS_ENSURE_SUCCESS(rv, rv);
  pls->ToString(getter_Copies(ucsval));
  aResult = ucsval.get();
  return rv;
}

nsresult nsMsgDBView::AppendKeywordProperties(const nsACString& keywords, nsAString& properties, bool addSelectedTextProperty)
{
  // get the top most keyword's color and append that as a property.
  nsresult rv;
  if (!mTagService)
  {
    mTagService = do_GetService(NS_MSGTAGSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCString topKey;
  rv = mTagService->GetTopKey(keywords, topKey);
  NS_ENSURE_SUCCESS(rv, rv);
  if (topKey.IsEmpty())
    return NS_OK;

  nsCString color;
  rv = mTagService->GetColorForKey(topKey, color);
  if (NS_SUCCEEDED(rv) && !color.IsEmpty())
  {
    if (addSelectedTextProperty)
    {
      if (color.EqualsLiteral(LABEL_COLOR_WHITE_STRING))
        properties.AppendLiteral(" lc-black");
      else
        properties.AppendLiteral(" lc-white");
    }
    color.Replace(0, 1, NS_LITERAL_CSTRING(LABEL_COLOR_STRING));
    properties.AppendASCII(color.get());
  }
  return rv;
}

///////////////////////////////////////////////////////////////////////////
// nsITreeView Implementation Methods (and helper methods)
///////////////////////////////////////////////////////////////////////////

static nsresult GetDisplayNameInAddressBook(const nsACString& emailAddress,
                                            nsAString& displayName)
{
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager(do_GetService("@mozilla.org/abmanager;1",
                                   &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = abManager->GetDirectories(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupports> supports;
  nsCOMPtr<nsIAbDirectory> directory;
  nsCOMPtr<nsIAbCard> cardForAddress;
  bool hasMore;

  // Scan the addressbook to find out the card of the email address
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) &&
         hasMore && !cardForAddress)
  {
    rv = enumerator->GetNext(getter_AddRefs(supports));
    NS_ENSURE_SUCCESS(rv, rv);
    directory = do_QueryInterface(supports);
    if (directory)
    {
      rv = directory->CardForEmailAddress(emailAddress,
                        getter_AddRefs(cardForAddress));

      if (NS_SUCCEEDED(rv) && cardForAddress)
        break; // the card is found,so stop looping
    }
  }

  if (cardForAddress)
  {
    bool preferDisplayName = true;
    cardForAddress->GetPropertyAsBool("PreferDisplayName",&preferDisplayName);

    if (preferDisplayName)
      rv = cardForAddress->GetDisplayName(displayName);
  }

  return rv;
}

/* The unparsedString has following format
 * "version|displayname"
 */
static void GetCachedName(const nsCString& unparsedString,
                          int32_t displayVersion, nsACString& cachedName)
{
  nsresult err;

  //get verion #
  int32_t cachedVersion = unparsedString.ToInteger(&err);
  if (cachedVersion != displayVersion)
    return;

  //get cached name
  int32_t pos = unparsedString.FindChar('|');
  if (pos != kNotFound)
    cachedName = Substring(unparsedString, pos + 1);
}

static void UpdateCachedName(nsIMsgDBHdr *aHdr, const char *header_field,
                             const nsAString& newName)
{
  nsCString newCachedName;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
  int32_t  currentDisplayNameVersion = 0;

  prefs->GetIntPref("mail.displayname.version", &currentDisplayNameVersion);

  // save version number
  newCachedName.AppendInt(currentDisplayNameVersion);
  newCachedName.Append("|");

  // save name
  newCachedName.Append(NS_ConvertUTF16toUTF8(newName));

  aHdr->SetStringProperty(header_field,newCachedName.get());
}

nsresult nsMsgDBView::FetchAuthor(nsIMsgDBHdr * aHdr, nsAString &aSenderString)
{
  nsCString unparsedAuthor;
  bool showCondensedAddresses = false;
  int32_t  currentDisplayNameVersion = 0;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));

  prefs->GetIntPref("mail.displayname.version", &currentDisplayNameVersion);

  aHdr->GetStringProperty("sender_name", getter_Copies(unparsedAuthor));

  prefs->GetBoolPref("mail.showCondensedAddresses", &showCondensedAddresses);

  // if the author is already computed, use it
  if (!unparsedAuthor.IsEmpty())
  {
    nsCString cachedDisplayName;

    GetCachedName(unparsedAuthor, currentDisplayNameVersion, cachedDisplayName);
    if (!cachedDisplayName.IsEmpty())
    {
      CopyUTF8toUTF16(cachedDisplayName, aSenderString);
      return NS_OK;
    }
  }

  nsString decodedAuthor;
  nsresult rv = aHdr->GetMime2DecodedAuthor(decodedAuthor);

  if (!mHeaderParser)
    mHeaderParser = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID);

  if (mHeaderParser)
  {
    nsCString name,emailAddress;
    uint32_t numAddresses;

    rv = mHeaderParser->ParseHeaderAddresses(
      NS_ConvertUTF16toUTF8(decodedAuthor).get(), getter_Copies(name),
      getter_Copies(emailAddress), &numAddresses);

    if (NS_SUCCEEDED(rv) && showCondensedAddresses)
      GetDisplayNameInAddressBook(emailAddress,aSenderString);

    if (NS_SUCCEEDED(rv) && aSenderString.IsEmpty() && !name.IsEmpty())
    {
      nsCString charset;
      nsCOMPtr<nsIMsgFolder> folder;

      aHdr->GetFolder(getter_AddRefs(folder));
      bool charsetOverride;
      folder->GetCharsetOverride(&charsetOverride);
      if (charsetOverride ||
          NS_FAILED(aHdr->GetCharset(getter_Copies(charset))) ||
          charset.IsEmpty() ||
          charset.Equals("us-ascii"))
        folder->GetCharset(charset);

      nsCOMPtr<nsIMimeConverter>
        mimeConverter(do_GetService(NS_MIME_CONVERTER_CONTRACTID,&rv));

      rv = mimeConverter->DecodeMimeHeader(name.get(),
                                           charset.get(),
                                           charsetOverride,
                                           true,
                                           aSenderString);
      if (NS_FAILED(rv) || aSenderString.IsEmpty())
        CopyUTF8toUTF16(name, aSenderString);

      // If the name is surrounded by quotes, strip them. In the future, we
      // may want to handle this in ParseHeaderAddresses.
      if ((aSenderString.First() == '"' && aSenderString.Last() == '"') ||
          (aSenderString.First() == '\'' && aSenderString.Last() == '\''))
        aSenderString = Substring(aSenderString, 1, aSenderString.Length()-2);
    }
  }

  if (aSenderString.IsEmpty())
    // if we got here then just return the original string
    aSenderString = decodedAuthor;

  UpdateCachedName(aHdr, "sender_name", aSenderString);

  return NS_OK;
}

nsresult nsMsgDBView::FetchAccount(nsIMsgDBHdr * aHdr, nsAString& aAccount)
{
  nsCString accountKey;

  nsresult rv = aHdr->GetAccountKey(getter_Copies(accountKey));

  // Cache the account manager?
  nsCOMPtr<nsIMsgAccountManager> accountManager(
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgAccount> account;
  nsCOMPtr<nsIMsgIncomingServer> server;
  if (!accountKey.IsEmpty())
    rv = accountManager->GetAccount(accountKey, getter_AddRefs(account));

  if (account)
  {
    account->GetIncomingServer(getter_AddRefs(server));
  }
  else
  {
    nsCOMPtr<nsIMsgFolder> folder;
    aHdr->GetFolder(getter_AddRefs(folder));
    if (folder)
     folder->GetServer(getter_AddRefs(server));
  }
  if (server)
    server->GetPrettyName(aAccount);
  else
    CopyASCIItoUTF16(accountKey, aAccount);
  return NS_OK;
}

nsresult nsMsgDBView::FetchRecipients(nsIMsgDBHdr * aHdr, nsAString &aRecipientsString)
{
  nsString unparsedRecipients;
  nsCString recipients;
  int32_t currentDisplayNameVersion = 0;
  bool showCondensedAddresses = false;
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));

  prefs->GetIntPref("mail.displayname.version", &currentDisplayNameVersion);
  prefs->GetBoolPref("mail.showCondensedAddresses", &showCondensedAddresses);

  aHdr->GetStringProperty("recipient_names", getter_Copies(recipients));

  if (!recipients.IsEmpty())
  {
    nsCString cachedRecipients;

    GetCachedName(recipients, currentDisplayNameVersion, cachedRecipients);

    // recipients have already been cached,check if the addressbook
    // was changed after cache.
    if (!cachedRecipients.IsEmpty())
    {
      CopyUTF8toUTF16(cachedRecipients, aRecipientsString);
      return NS_OK;
    }
  }

  mHeaderParser = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID);

  nsresult rv = aHdr->GetMime2DecodedRecipients(unparsedRecipients);

  // *sigh* how sad, we need to convert our beautiful unicode string to utf8
  // so we can extract the name part of the address...then convert it back to
  // unicode again.
  if (mHeaderParser)
  {
    char *names;
    char *emailAddresses;
    uint32_t numAddresses;

    rv = mHeaderParser->ParseHeaderAddresses(
                            NS_ConvertUTF16toUTF8(unparsedRecipients).get(),
                            &names, &emailAddresses,&numAddresses);

    if (NS_SUCCEEDED(rv))
    {
      char *curAddressPtr = emailAddresses;
      char *curNamePtr = names;

      nsCOMPtr<nsISimpleEnumerator> enumerator;
      nsCOMPtr<nsIAbManager>
        abManager(do_GetService("@mozilla.org/abmanager;1", &rv));
      NS_ENSURE_SUCCESS(rv, NS_OK);

      // go through each email address in the recipients and
      // compute its display name.
      for (uint32_t i = 0; i < numAddresses; i++)
      {
        nsString recipient;
        nsDependentCString curAddress(curAddressPtr);
        nsDependentCString curName(curNamePtr);

        curAddressPtr += curAddress.Length() + 1;
        curNamePtr += curName.Length() + 1;

        if (showCondensedAddresses)
          GetDisplayNameInAddressBook(curAddress,recipient);

        if (recipient.IsEmpty())
        {
          // we can't use the display name in the card,
          // use the name contained in the header or email address.
          if (!curName.IsEmpty())
            CopyUTF8toUTF16(curName, recipient);
          else
            CopyUTF8toUTF16(curAddress, recipient);
        }

        // add ',' and end of each recipient
        if (i != 0)
          aRecipientsString.Append(NS_LITERAL_STRING(","));

        aRecipientsString.Append(recipient);
      }
    }
    PR_FREEIF(names);
    PR_FREEIF(emailAddresses);
  }
  else
    aRecipientsString = unparsedRecipients;

  UpdateCachedName(aHdr, "recipient_names", aRecipientsString);

  return NS_OK;
}

nsresult nsMsgDBView::FetchSubject(nsIMsgDBHdr * aMsgHdr, uint32_t aFlags, nsAString &aValue)
{
  if (aFlags & nsMsgMessageFlags::HasRe)
  {
    nsString subject;
    aMsgHdr->GetMime2DecodedSubject(subject);
    aValue.AssignLiteral("Re: ");
    aValue.Append(subject);
  }
  else
    aMsgHdr->GetMime2DecodedSubject(aValue);
  return NS_OK;
}

// in case we want to play around with the date string, I've broken it out into
// a separate routine.  Set rcvDate to true to get the Received: date instead
// of the Date: date.
nsresult nsMsgDBView::FetchDate(nsIMsgDBHdr * aHdr, nsAString &aDateString, bool rcvDate)
{
  PRTime dateOfMsg;
  PRTime dateOfMsgLocal;
  uint32_t rcvDateSecs;
  nsresult rv;

  if (!mDateFormatter)
    mDateFormatter = do_CreateInstance(NS_DATETIMEFORMAT_CONTRACTID);

  NS_ENSURE_TRUE(mDateFormatter, NS_ERROR_FAILURE);
  // Silently return Date: instead if Received: is unavailable
  if (rcvDate)
  {
    rv = aHdr->GetUint32Property("dateReceived", &rcvDateSecs);
    if (rcvDateSecs != 0)
      Seconds2PRTime(rcvDateSecs, &dateOfMsg);
  }
  if (!rcvDate || rcvDateSecs == 0)
    rv = aHdr->GetDate(&dateOfMsg);

  PRTime currentTime = PR_Now();
  PRExplodedTime explodedCurrentTime;
  PR_ExplodeTime(currentTime, PR_LocalTimeParameters, &explodedCurrentTime);
  PRExplodedTime explodedMsgTime;
  PR_ExplodeTime(dateOfMsg, PR_LocalTimeParameters, &explodedMsgTime);

  // if the message is from today, don't show the date, only the time. (i.e. 3:15 pm)
  // if the message is from the last week, show the day of the week.   (i.e. Mon 3:15 pm)
  // in all other cases, show the full date (03/19/01 3:15 pm)

  nsDateFormatSelector dateFormat = m_dateFormatDefault;
  if (explodedCurrentTime.tm_year == explodedMsgTime.tm_year &&
      explodedCurrentTime.tm_month == explodedMsgTime.tm_month &&
      explodedCurrentTime.tm_mday == explodedMsgTime.tm_mday)
  {
    // same day...
    dateFormat = m_dateFormatToday;
  }
  // the following chunk of code allows us to show a day instead of a number if the message was received
  // within the last 7 days. i.e. Mon 5:10pm. (depending on the mail.ui.display.dateformat.thisweek pref)
  // The concrete format used is dependent on a preference setting (see InitDisplayFormats).
  else if (currentTime > dateOfMsg)
  {
    // Convert the times from GMT to local time
    int64_t GMTLocalTimeShift = PR_USEC_PER_SEC *
      int64_t(explodedCurrentTime.tm_params.tp_gmt_offset +
       explodedCurrentTime.tm_params.tp_dst_offset);
    currentTime += GMTLocalTimeShift;
    dateOfMsgLocal = dateOfMsg + GMTLocalTimeShift;

    // Find the most recent midnight
    int64_t todaysMicroSeconds = currentTime % PR_USEC_PER_DAY;
    int64_t mostRecentMidnight = currentTime - todaysMicroSeconds;

    // most recent midnight minus 6 days
    int64_t mostRecentWeek = mostRecentMidnight - (PR_USEC_PER_DAY * 6);

    // was the message sent during the last week?
    if (dateOfMsgLocal >= mostRecentWeek)
    { // yes ....
      dateFormat = m_dateFormatThisWeek;
    }
  }

  if (NS_SUCCEEDED(rv))
    rv = mDateFormatter->FormatPRTime(nullptr /* nsILocale* locale */,
                                      dateFormat,
                                      kTimeFormatNoSeconds,
                                      dateOfMsg,
                                      aDateString);

  return rv;
}

nsresult nsMsgDBView::FetchStatus(uint32_t aFlags, nsAString &aStatusString)
{
  if (aFlags & nsMsgMessageFlags::Replied)
    aStatusString = kRepliedString;
  else if (aFlags & nsMsgMessageFlags::Forwarded)
    aStatusString = kForwardedString;
  else if (aFlags & nsMsgMessageFlags::New)
    aStatusString = kNewString;
  else if (aFlags & nsMsgMessageFlags::Read)
    aStatusString = kReadString;

  return NS_OK;
}

nsresult nsMsgDBView::FetchSize(nsIMsgDBHdr * aHdr, nsAString &aSizeString)
{
  nsresult rv;
  nsAutoString formattedSizeString;
  uint32_t msgSize = 0;

  // for news, show the line count, not the size if the user wants so
  if (mShowSizeInLines)
  {
    aHdr->GetLineCount(&msgSize);
    formattedSizeString.AppendInt(msgSize);
  }
  else
  {
    uint32_t flags = 0;

    aHdr->GetFlags(&flags);
    if (flags & nsMsgMessageFlags::Partial)
      aHdr->GetUint32Property("onlineSize", &msgSize);

    if (msgSize == 0)
      aHdr->GetMessageSize(&msgSize);

    rv = FormatFileSize(msgSize, true, formattedSizeString);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  aSizeString = formattedSizeString;
  // the formattingString Length includes the null terminator byte!
  if (!formattedSizeString.Last())
    aSizeString.SetLength(formattedSizeString.Length() - 1);
  return NS_OK;
}

nsresult nsMsgDBView::FetchPriority(nsIMsgDBHdr *aHdr, nsAString & aPriorityString)
{
  nsMsgPriorityValue priority = nsMsgPriority::notSet;
  aHdr->GetPriority(&priority);

  switch (priority)
  {
  case nsMsgPriority::highest:
    aPriorityString = kHighestPriorityString;
    break;
  case nsMsgPriority::high:
    aPriorityString = kHighPriorityString;
    break;
  case nsMsgPriority::low:
    aPriorityString = kLowPriorityString;
    break;
  case nsMsgPriority::lowest:
    aPriorityString = kLowestPriorityString;
    break;
  case nsMsgPriority::normal:
    aPriorityString = kNormalPriorityString;
    break;
  default:
    break;
  }

  return NS_OK;
}

nsresult nsMsgDBView::FetchKeywords(nsIMsgDBHdr *aHdr, nsACString &keywordString)
{
  NS_ENSURE_ARG_POINTER(aHdr);
  nsresult rv = NS_OK;
  if (!mTagService)
  {
    mTagService = do_GetService(NS_MSGTAGSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  nsMsgLabelValue label = 0;

  rv = aHdr->GetLabel(&label);
  nsCString keywords;
  aHdr->GetStringProperty("keywords", getter_Copies(keywords));
  if (label > 0)
  {
    nsAutoCString labelStr("$label");
    labelStr.Append((char) (label + '0'));
    if (keywords.Find(labelStr, CaseInsensitiveCompare) == -1)
    {
      if (!keywords.IsEmpty())
        keywords.Append(' ');
      keywords.Append(labelStr);
    }
  }
  keywordString = keywords;
  return NS_OK;
}

// If the row is a collapsed thread, we roll-up the keywords in all the
// messages in the thread, otherwise, return just the keywords for the row.
nsresult nsMsgDBView::FetchRowKeywords(nsMsgViewIndex aRow, nsIMsgDBHdr *aHdr,
                                       nsACString &keywordString)
{
  nsresult rv = FetchKeywords(aHdr,keywordString);
  NS_ENSURE_SUCCESS(rv, rv);

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    if ((m_flags[aRow] & MSG_VIEW_FLAG_ISTHREAD)
        && (m_flags[aRow] & nsMsgMessageFlags::Elided))
    {
      nsCOMPtr<nsIMsgThread> thread;
      rv = GetThreadContainingIndex(aRow, getter_AddRefs(thread));
      if (NS_SUCCEEDED(rv) && thread)
      {
        uint32_t numChildren;
        thread->GetNumChildren(&numChildren);
        nsCOMPtr<nsIMsgDBHdr> msgHdr;
        nsCString moreKeywords;
        for (uint32_t index = 0; index < numChildren; index++)
        {
          thread->GetChildHdrAt(index, getter_AddRefs(msgHdr));
          rv = FetchKeywords(msgHdr, moreKeywords);
          NS_ENSURE_SUCCESS(rv, rv);

          if (!keywordString.IsEmpty() && !moreKeywords.IsEmpty())
            keywordString.Append(' ');
          keywordString.Append(moreKeywords);
        }
      }
    }
  }
  return rv;
}

nsresult nsMsgDBView::FetchTags(nsIMsgDBHdr *aHdr, nsAString &aTagString)
{
  NS_ENSURE_ARG_POINTER(aHdr);
  nsresult rv = NS_OK;
  if (!mTagService)
  {
    mTagService = do_GetService(NS_MSGTAGSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsString tags;
  nsCString keywords;
  aHdr->GetStringProperty("keywords", getter_Copies(keywords));

  nsMsgLabelValue label = 0;
  rv = aHdr->GetLabel(&label);
  if (label > 0)
  {
    nsAutoCString labelStr("$label");
    labelStr.Append((char) (label + '0'));
    if (keywords.Find(labelStr, CaseInsensitiveCompare) == -1)
      FetchLabel(aHdr, tags);
  }

  nsTArray<nsCString> keywordsArray;
  ParseString(keywords, ' ', keywordsArray);
  nsAutoString tag;

  for (uint32_t i = 0; i < keywordsArray.Length(); i++)
  {
    rv = mTagService->GetTagForKey(keywordsArray[i], tag);
    if (NS_SUCCEEDED(rv) && !tag.IsEmpty())
    {
      if (!tags.IsEmpty())
        tags.Append((PRUnichar) ' ');
      tags.Append(tag);
    }
  }

  aTagString = tags;
  return NS_OK;
}

nsresult nsMsgDBView::FetchLabel(nsIMsgDBHdr *aHdr, nsAString &aLabelString)
{
  nsresult rv = NS_OK;
  nsMsgLabelValue label = 0;

  NS_ENSURE_ARG_POINTER(aHdr);

  rv = aHdr->GetLabel(&label);
  NS_ENSURE_SUCCESS(rv, rv);

  // we don't care if label is not between 1 and PREF_LABELS_MAX inclusive.
  if ((label < 1) || (label > PREF_LABELS_MAX))
  {
    aLabelString.Truncate();
    return NS_OK;
  }

  // We need to subtract 1 because mLabelPrefDescriptions is 0 based.
  aLabelString = mLabelPrefDescriptions[label - 1];
  return NS_OK;
}


/*if you call SaveAndClearSelection make sure to call RestoreSelection otherwise
m_saveRestoreSelectionDepth will be incorrect and will lead to selection msg problems*/

nsresult nsMsgDBView::SaveAndClearSelection(nsMsgKey *aCurrentMsgKey, nsTArray<nsMsgKey> &aMsgKeyArray)
{
  // we don't do anything on nested Save / Restore calls.
  m_saveRestoreSelectionDepth++;
  if (m_saveRestoreSelectionDepth != 1)
    return NS_OK;

  if (!mTreeSelection || !mTree)
    return NS_OK;

  // first, freeze selection.
  mTreeSelection->SetSelectEventsSuppressed(true);

  // second, save the current index.
  if (aCurrentMsgKey)
  {
    int32_t currentIndex;
    if (NS_SUCCEEDED(mTreeSelection->GetCurrentIndex(&currentIndex)) &&
        currentIndex >= 0 && uint32_t(currentIndex) < GetSize())
      *aCurrentMsgKey = m_keys[currentIndex];
    else
      *aCurrentMsgKey = nsMsgKey_None;
  }

  // third, get an array of view indices for the selection.
  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);
  int32_t numIndices = selection.Length();
  aMsgKeyArray.SetLength(numIndices);

  // now store the msg key for each selected item.
  nsMsgKey msgKey;
  for (int32_t index = 0; index < numIndices; index++)
  {
    msgKey = m_keys[selection[index]];
    aMsgKeyArray[index] = msgKey;
  }

  // clear the selection, we'll manually restore it later.
  if (mTreeSelection)
    mTreeSelection->ClearSelection();

  return NS_OK;
}

nsresult nsMsgDBView::RestoreSelection(nsMsgKey aCurrentMsgKey, nsTArray<nsMsgKey> &aMsgKeyArray)
{
  // we don't do anything on nested Save / Restore calls.
  m_saveRestoreSelectionDepth--;
  if (m_saveRestoreSelectionDepth)
    return NS_OK;

  if (!mTreeSelection)  // don't assert.
    return NS_OK;

  // turn our message keys into corresponding view indices
  int32_t arraySize = aMsgKeyArray.Length();
  nsMsgViewIndex  currentViewPosition = nsMsgViewIndex_None;
  nsMsgViewIndex  newViewPosition = nsMsgViewIndex_None;

  // if we are threaded, we need to do a little more work
  // we need to find (and expand) all the threads that contain messages
  // that we had selected before.
  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    for (int32_t index = 0; index < arraySize; index ++)
    {
      FindKey(aMsgKeyArray[index], true /* expand */);
    }
  }

  for (int32_t index = 0; index < arraySize; index ++)
  {
    newViewPosition = FindKey(aMsgKeyArray[index], false);
    // add the index back to the selection.
    if (newViewPosition != nsMsgViewIndex_None)
      mTreeSelection->ToggleSelect(newViewPosition);
  }

  // make sure the currentView was preserved....
  if (aCurrentMsgKey != nsMsgKey_None)
    currentViewPosition = FindKey(aCurrentMsgKey, true);

  if (mTree)
    mTreeSelection->SetCurrentIndex(currentViewPosition);

  // make sure the current message is once again visible in the thread pane
  // so we don't have to go search for it in the thread pane
  if (mTree && currentViewPosition != nsMsgViewIndex_None)
    mTree->EnsureRowIsVisible(currentViewPosition);

  // unfreeze selection.
  mTreeSelection->SetSelectEventsSuppressed(false);
  return NS_OK;
}

nsresult nsMsgDBView::GenerateURIForMsgKey(nsMsgKey aMsgKey, nsIMsgFolder *folder, nsACString & aURI)
{
  NS_ENSURE_ARG(folder);
  return folder->GenerateMessageURI(aMsgKey, aURI);
}

nsresult nsMsgDBView::GetMessageEnumerator(nsISimpleEnumerator **enumerator)
{
  return m_db->EnumerateMessages(enumerator);
}

nsresult nsMsgDBView::CycleThreadedColumn(nsIDOMElement * aElement)
{
  nsAutoString currentView;

  // toggle threaded/unthreaded mode
  aElement->GetAttribute(NS_LITERAL_STRING("currentView"), currentView);
  if (currentView.EqualsLiteral("threaded"))
    aElement->SetAttribute(NS_LITERAL_STRING("currentView"), NS_LITERAL_STRING("unthreaded"));
  else
     aElement->SetAttribute(NS_LITERAL_STRING("currentView"), NS_LITERAL_STRING("threaded"));

  // i think we need to create a new view and switch it in this circumstance since
  // we are toggline between threaded and non threaded mode.
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::IsEditable(int32_t row, nsITreeColumn* col, bool* _retval)
{
  NS_ENSURE_ARG_POINTER(col);
  NS_ENSURE_ARG_POINTER(_retval);
  //attempt to retreive a custom column handler. If it exists call it and return
  const PRUnichar* colID;
  col->GetIdConst(&colID);

  nsIMsgCustomColumnHandler* colHandler = GetColumnHandler(colID);

  if (colHandler)
  {
    colHandler->IsEditable(row, col, _retval);
    return NS_OK;
  }

  *_retval = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::IsSelectable(int32_t row, nsITreeColumn* col, bool* _retval)
{
  *_retval = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetCellValue(int32_t row, nsITreeColumn* col, const nsAString& value)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetCellText(int32_t row, nsITreeColumn* col, const nsAString& value)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetRowCount(int32_t *aRowCount)
{
  *aRowCount = GetSize();
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetSelection(nsITreeSelection * *aSelection)
{
  *aSelection = mTreeSelection;
  NS_IF_ADDREF(*aSelection);
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetSelection(nsITreeSelection * aSelection)
{
  mTreeSelection = aSelection;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::ReloadMessageWithAllParts()
{
  if (m_currentlyDisplayedMsgUri.IsEmpty() || mSuppressMsgDisplay)
    return NS_OK;

  nsAutoCString forceAllParts(m_currentlyDisplayedMsgUri);
  forceAllParts += (forceAllParts.FindChar('?') == kNotFound) ? '?' : '&';
  forceAllParts.AppendLiteral("fetchCompleteMessage=true");
  nsCOMPtr<nsIMessenger> messenger (do_QueryReferent(mMessengerWeak));
  NS_ENSURE_TRUE(messenger, NS_ERROR_FAILURE);

  nsresult rv = messenger->OpenURL(forceAllParts);
  NS_ENSURE_SUCCESS(rv, rv);

  UpdateDisplayMessage(m_currentlyDisplayedViewIndex);
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::ReloadMessage()
{
  if (m_currentlyDisplayedMsgUri.IsEmpty() || mSuppressMsgDisplay)
    return NS_OK;
  nsCOMPtr<nsIMessenger> messenger (do_QueryReferent(mMessengerWeak));
  NS_ENSURE_TRUE(messenger, NS_ERROR_FAILURE);

  nsresult rv = messenger->OpenURL(m_currentlyDisplayedMsgUri);
  NS_ENSURE_SUCCESS(rv, rv);

  UpdateDisplayMessage(m_currentlyDisplayedViewIndex);
  return NS_OK;
}

nsresult nsMsgDBView::UpdateDisplayMessage(nsMsgViewIndex viewPosition)
{
  nsresult rv;
  if (mCommandUpdater)
  {
    // get the subject and the folder for the message and inform the front end that
    // we changed the message we are currently displaying.
    if (viewPosition != nsMsgViewIndex_None)
    {
      nsCOMPtr <nsIMsgDBHdr> msgHdr;
      rv = GetMsgHdrForViewIndex(viewPosition, getter_AddRefs(msgHdr));
      NS_ENSURE_SUCCESS(rv,rv);

      nsString subject;
      FetchSubject(msgHdr, m_flags[viewPosition], subject);

      nsCString keywords;
      rv = msgHdr->GetStringProperty("keywords", getter_Copies(keywords));
      NS_ENSURE_SUCCESS(rv,rv);

      nsCOMPtr<nsIMsgFolder> folder = m_viewFolder ? m_viewFolder : m_folder;

      mCommandUpdater->DisplayMessageChanged(folder, subject, keywords);

      if (folder)
      {
        rv = folder->SetLastMessageLoaded(m_keys[viewPosition]);
        NS_ENSURE_SUCCESS(rv,rv);
      }
    } // if view position is valid
  } // if we have an updater
  return NS_OK;
}

// given a msg key, we will load the message for it.
NS_IMETHODIMP nsMsgDBView::LoadMessageByMsgKey(nsMsgKey aMsgKey)
{
  return LoadMessageByViewIndex(FindKey(aMsgKey, false));
}

NS_IMETHODIMP nsMsgDBView::LoadMessageByViewIndex(nsMsgViewIndex aViewIndex)
{
  NS_ASSERTION(aViewIndex != nsMsgViewIndex_None,"trying to load nsMsgViewIndex_None");
  if (aViewIndex == nsMsgViewIndex_None) return NS_ERROR_UNEXPECTED;

  nsCString uri;
  nsresult rv = GetURIForViewIndex(aViewIndex, uri);
  if (!mSuppressMsgDisplay && !m_currentlyDisplayedMsgUri.Equals(uri))
  {
    NS_ENSURE_SUCCESS(rv,rv);
    nsCOMPtr<nsIMessenger> messenger (do_QueryReferent(mMessengerWeak));
    NS_ENSURE_TRUE(messenger, NS_ERROR_FAILURE);
    messenger->OpenURL(uri);
    m_currentlyDisplayedMsgKey = m_keys[aViewIndex];
    m_currentlyDisplayedMsgUri = uri;
    m_currentlyDisplayedViewIndex = aViewIndex;
    UpdateDisplayMessage(m_currentlyDisplayedViewIndex);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::LoadMessageByUrl(const char *aUrl)
{
  NS_ASSERTION(aUrl, "trying to load a null url");
  if (!mSuppressMsgDisplay)
  {
    nsresult rv;
    nsCOMPtr<nsIMessenger> messenger (do_QueryReferent(mMessengerWeak, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    messenger->LoadURL(NULL, nsDependentCString(aUrl));
    m_currentlyDisplayedMsgKey = nsMsgKey_None;
    m_currentlyDisplayedMsgUri.Truncate();
    m_currentlyDisplayedViewIndex = nsMsgViewIndex_None;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SelectionChanged()
{
  // if the currentSelection changed then we have a message to display - not if we are in the middle of deleting rows
  if (m_deletingRows)
    return NS_OK;

  uint32_t numSelected = 0;

  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);
  nsMsgViewIndex *indices = selection.Elements();
  numSelected = selection.Length();

  bool commandsNeedDisablingBecauseOfSelection = false;

  if(indices)
  {
    if (WeAreOffline())
      commandsNeedDisablingBecauseOfSelection = !OfflineMsgSelected(indices, numSelected);
    if (!NonDummyMsgSelected(indices, numSelected))
      commandsNeedDisablingBecauseOfSelection = true;
  }
  bool selectionSummarized = false;
  mSummarizeFailed = false;
  // let the front-end adjust the message pane appropriately with either
  // the message body, or a summary of the selection
  if (mCommandUpdater)
  {
    mCommandUpdater->SummarizeSelection(&selectionSummarized);
    // check if the selection was not summarized, but we expected it to be,
    // and if so, remember it so GetHeadersFromSelection won't include
    // the messages in collapsed threads.
    if (!selectionSummarized &&
        (numSelected > 1 || (numSelected == 1 &&
                              m_flags[indices[0]] & nsMsgMessageFlags::Elided &&
                              OperateOnMsgsInCollapsedThreads())))
      mSummarizeFailed = true;
  }

  bool summaryStateChanged = selectionSummarized != mSelectionSummarized;

  mSelectionSummarized = selectionSummarized;
  // if only one item is selected then we want to display a message
  if (numSelected == 1 && !selectionSummarized)
  {
    int32_t startRange;
    int32_t endRange;
    nsresult rv = mTreeSelection->GetRangeAt(0, &startRange, &endRange);
    NS_ENSURE_SUCCESS(rv, NS_OK); // tree doesn't care if we failed

    if (startRange >= 0 && startRange == endRange &&
        uint32_t(startRange) < GetSize())
    {
      if (!mRemovingRow)
      {
        if (!mSuppressMsgDisplay)
          LoadMessageByViewIndex(startRange);
        else
          UpdateDisplayMessage(startRange);
      }
    }
    else
      numSelected = 0; // selection seems bogus, so set to 0.
  }
  else {
    // if we have zero or multiple items selected, we shouldn't be displaying any message
    m_currentlyDisplayedMsgKey = nsMsgKey_None;
    m_currentlyDisplayedMsgUri.Truncate();
    m_currentlyDisplayedViewIndex = nsMsgViewIndex_None;
  }

  // determine if we need to push command update notifications out to the UI or not.

  // we need to push a command update notification iff, one of the following conditions are met
  // (1) the selection went from 0 to 1
  // (2) it went from 1 to 0
  // (3) it went from 1 to many
  // (4) it went from many to 1 or 0
  // (5) a different msg was selected - perhaps it was offline or not...matters only when we are offline
  // (6) we did a forward/back, or went from having no history to having history - not sure how to tell this.
  // (7) whether the selection was summarized or not changed.

  // I think we're going to need to keep track of whether forward/back were enabled/should be enabled,
  // and when this changes, force a command update.

  bool enableGoForward = false;
  bool enableGoBack = false;

  NavigateStatus(nsMsgNavigationType::forward, &enableGoForward);
  NavigateStatus(nsMsgNavigationType::back, &enableGoBack);
  if (!summaryStateChanged &&
      (numSelected == mNumSelectedRows ||
      (numSelected > 1 && mNumSelectedRows > 1)) && (commandsNeedDisablingBecauseOfSelection == mCommandsNeedDisablingBecauseOfSelection)
      && enableGoForward == mGoForwardEnabled && enableGoBack == mGoBackEnabled)
  {
  }
  // don't update commands if we're suppressing them, or if we're removing rows, unless it was the last row.
  else if (!mSuppressCommandUpdating && mCommandUpdater && (!mRemovingRow || GetSize() == 0)) // o.t. push an updated
  {
    mCommandUpdater->UpdateCommandStatus();
  }

  mCommandsNeedDisablingBecauseOfSelection = commandsNeedDisablingBecauseOfSelection;
  mGoForwardEnabled = enableGoForward;
  mGoBackEnabled = enableGoBack;
  mNumSelectedRows = numSelected;
  return NS_OK;
}

nsresult nsMsgDBView::GetSelectedIndices(nsMsgViewIndexArray& selection)
{
  if (mTreeSelection)
  {
    int32_t viewSize = GetSize();
    int32_t count;
    mTreeSelection->GetCount(&count);
    selection.SetLength(count);
    count = 0;
    int32_t selectionCount;
    mTreeSelection->GetRangeCount(&selectionCount);
    for (int32_t i = 0; i < selectionCount; i++)
    {
      int32_t startRange = -1;
      int32_t endRange = -1;
      mTreeSelection->GetRangeAt(i, &startRange, &endRange);
      if (startRange >= 0 && startRange < viewSize)
      {
        for (int32_t rangeIndex = startRange; rangeIndex <= endRange && rangeIndex < viewSize; rangeIndex++)
          selection[count++] = rangeIndex;
      }
    }
    NS_ASSERTION(selection.Length() == uint32_t(count), "selection count is wrong");
    selection.SetLength(count);
  }
  else
  {
    // if there is no tree selection object then we must be in stand alone message mode.
    // in that case the selected indices are really just the current message key.
    nsMsgViewIndex viewIndex = FindViewIndex(m_currentlyDisplayedMsgKey);
    if (viewIndex != nsMsgViewIndex_None)
      selection.AppendElement(viewIndex);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetRowProperties(int32_t index, nsAString& properties)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  // this is where we tell the tree to apply styles to a particular row
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsresult rv = NS_OK;

  rv = GetMsgHdrForViewIndex(index, getter_AddRefs(msgHdr));

  if (NS_FAILED(rv) || !msgHdr) {
    ClearHdrCache();
    return NS_MSG_INVALID_DBVIEW_INDEX;
  }

  nsCString keywordProperty;
  FetchRowKeywords(index, msgHdr, keywordProperty);
  if (!keywordProperty.IsEmpty())
    AppendKeywordProperties(keywordProperty, properties, false);

  // give the custom column handlers a chance to style the row.
  for (int i = 0; i < m_customColumnHandlers.Count(); i++)
  {
    nsString extra;
    m_customColumnHandlers[i]->GetRowProperties(index, extra);
    if (!extra.IsEmpty())
    {
      properties.Append(' ');
      properties.Append(extra);
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetColumnProperties(nsITreeColumn* col, nsAString& properties)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetCellProperties(int32_t aRow, nsITreeColumn *col, nsAString& properties)
{
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  // this is where we tell the tree to apply styles to a particular row
  // i.e. if the row is an unread message...

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsresult rv = NS_OK;

  rv = GetMsgHdrForViewIndex(aRow, getter_AddRefs(msgHdr));

  if (NS_FAILED(rv) || !msgHdr)
  {
    ClearHdrCache();
    return NS_MSG_INVALID_DBVIEW_INDEX;
  }

  const PRUnichar* colID;
  col->GetIdConst(&colID);
  nsIMsgCustomColumnHandler* colHandler = GetColumnHandler(colID);
  if (colHandler != nullptr)
    colHandler->GetCellProperties(aRow, col, properties);

  if (!properties.IsEmpty())
    properties.Append(' ');

  properties.Append(mMessageType);

  uint32_t flags;
  msgHdr->GetFlags(&flags);

  if (!(flags & nsMsgMessageFlags::Read))
    properties.AppendLiteral(" unread");
  else
    properties.AppendLiteral(" read");

  if (flags & nsMsgMessageFlags::Replied)
    properties.AppendLiteral(" replied");

  if (flags & nsMsgMessageFlags::Forwarded)
    properties.AppendLiteral(" forwarded");

  if (flags & nsMsgMessageFlags::New)
    properties.AppendLiteral(" new");

  if (m_flags[aRow] & nsMsgMessageFlags::Marked)
    properties.AppendLiteral(" flagged");

  // For threaded display add the ignoreSubthread property to the
  // subthread top row (this row). For non-threaded add it to all rows.
  if (!(m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay) &&
      (flags & nsMsgMessageFlags::Ignored)) {
    properties.AppendLiteral(" ignoreSubthread");
  }
  else {
    bool ignored;
    msgHdr->GetIsKilled(&ignored);
    if (ignored)
      properties.AppendLiteral(" ignoreSubthread");
  }

  nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_folder);

  if ((flags & nsMsgMessageFlags::Offline) || (localFolder && !(flags & nsMsgMessageFlags::Partial)))
    properties.AppendLiteral(" offline");

  if (flags & nsMsgMessageFlags::Attachment)
    properties.AppendLiteral(" attach");

  if ((mDeleteModel == nsMsgImapDeleteModels::IMAPDelete) && (flags & nsMsgMessageFlags::IMAPDeleted))
    properties.AppendLiteral(" imapdeleted");

  nsCString imageSize;
  msgHdr->GetStringProperty("imageSize", getter_Copies(imageSize));
  if (!imageSize.IsEmpty())
    properties.AppendLiteral(" hasimage");

  nsCString junkScoreStr;
  msgHdr->GetStringProperty("junkscore", getter_Copies(junkScoreStr));
  if (!junkScoreStr.IsEmpty()) {
    if (junkScoreStr.ToInteger(&rv) == nsIJunkMailPlugin::IS_SPAM_SCORE)
      properties.AppendLiteral(" junk");
    else
      properties.AppendLiteral(" notjunk");
    NS_ASSERTION(NS_SUCCEEDED(rv), "Converting junkScore to integer failed.");
  }

  nsCString keywords;
  FetchRowKeywords(aRow, msgHdr, keywords);
  if (!keywords.IsEmpty())
    AppendKeywordProperties(keywords, properties, true);

  // this is a double fetch of the keywords property since we also fetch
  // it for the tags - do we want to do this?
  // I'm not sure anyone uses the kw- property, though it could be nice
  // for people wanting to extend the thread pane.
  nsCString keywordProperty;
  msgHdr->GetStringProperty("keywords", getter_Copies(keywordProperty));
  if (!keywordProperty.IsEmpty())
  {
    NS_ConvertUTF8toUTF16 keywords(keywordProperty);
    int32_t spaceIndex = 0;
    do
    {
      spaceIndex = keywords.FindChar(' ');
      int32_t endOfKeyword = (spaceIndex == -1) ? keywords.Length() : spaceIndex;
      properties.AppendLiteral(" kw-");
      properties.Append(StringHead(keywords, endOfKeyword));
      if (spaceIndex > 0)
        keywords.Cut(0, endOfKeyword + 1);
    }
    while (spaceIndex > 0);
  }

#ifdef SUPPORT_PRIORITY_COLORS
  // add special styles for priority
  nsMsgPriorityValue priority;
  msgHdr->GetPriority(&priority);
  switch (priority)
  {
  case nsMsgPriority::highest:
    properties.append(" priority-highest");
    break;
  case nsMsgPriority::high:
    properties.append(" priority-high");
    break;
  case nsMsgPriority::low:
    properties.append(" priority-low");
    break;
  case nsMsgPriority::lowest:
    properties.append(" priority-lowest");
    break;
  default:
    break;
  }
#endif


  nsCOMPtr <nsIMsgThread> thread;
  rv = GetThreadContainingIndex(aRow, getter_AddRefs(thread));
  if (NS_SUCCEEDED(rv) && thread)
  {
    uint32_t numUnreadChildren;
    thread->GetNumUnreadChildren(&numUnreadChildren);
    if (numUnreadChildren > 0)
      properties.AppendLiteral(" hasUnread");

    // For threaded display add the ignore/watch properties to the
    // thread top row. For non-threaded add it to all rows.
    if (!(m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay) ||
         ((m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay) &&
        (m_flags[aRow] & MSG_VIEW_FLAG_ISTHREAD))) {
      thread->GetFlags(&flags);
      if (flags & nsMsgMessageFlags::Watched)
        properties.AppendLiteral(" watch");
      if (flags & nsMsgMessageFlags::Ignored)
        properties.AppendLiteral(" ignore");
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::IsContainer(int32_t index, bool *_retval)
{
  if (!IsValidIndex(index))
      return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    uint32_t flags = m_flags[index];
    *_retval = !!(flags & MSG_VIEW_FLAG_HASCHILDREN);
  }
  else
    *_retval = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::IsContainerOpen(int32_t index, bool *_retval)
{
  if (!IsValidIndex(index))
      return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    uint32_t flags = m_flags[index];
    *_retval = (flags & MSG_VIEW_FLAG_HASCHILDREN) && !(flags & nsMsgMessageFlags::Elided);
  }
  else
    *_retval = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::IsContainerEmpty(int32_t index, bool *_retval)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    uint32_t flags = m_flags[index];
    *_retval = !(flags & MSG_VIEW_FLAG_HASCHILDREN);
  }
  else
    *_retval = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::IsSeparator(int32_t index, bool *_retval)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  *_retval = false;

  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetParentIndex(int32_t rowIndex, int32_t *_retval)
{
  *_retval = -1;

  int32_t rowIndexLevel;
  nsresult rv = GetLevel(rowIndex, &rowIndexLevel);
  NS_ENSURE_SUCCESS(rv, rv);

  int32_t i;
  for(i = rowIndex; i >= 0; i--)
  {
    int32_t l;
    GetLevel(i, &l);
    if (l < rowIndexLevel)
    {
      *_retval = i;
      break;
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::HasNextSibling(int32_t rowIndex, int32_t afterIndex, bool *_retval)
{
  *_retval = false;

  int32_t rowIndexLevel;
  GetLevel(rowIndex, &rowIndexLevel);

  int32_t i;
  int32_t count;
  GetRowCount(&count);
  for(i = afterIndex + 1; i < count; i++)
  {
    int32_t l;
    GetLevel(i, &l);
    if (l < rowIndexLevel)
      break;
    if (l == rowIndexLevel)
    {
      *_retval = true;
      break;
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetLevel(int32_t index, int32_t *_retval)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
    *_retval = m_levels[index];
  else
    *_retval = 0;
  return NS_OK;
}

// search view will override this since headers can span db's
nsresult nsMsgDBView::GetMsgHdrForViewIndex(nsMsgViewIndex index, nsIMsgDBHdr **msgHdr)
{
  nsresult rv = NS_OK;
  nsMsgKey key = m_keys[index];
  if (key == nsMsgKey_None || !m_db)
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (key == m_cachedMsgKey)
  {
    *msgHdr = m_cachedHdr;
    NS_IF_ADDREF(*msgHdr);
  }
  else
  {
    rv = m_db->GetMsgHdrForKey(key, msgHdr);
    if (NS_SUCCEEDED(rv))
    {
      m_cachedHdr = *msgHdr;
      m_cachedMsgKey = key;
    }
  }

  return rv;
}

void nsMsgDBView::InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                                 nsMsgKey msgKey, uint32_t flags, uint32_t level)
{
  if ((int32_t) index < 0 || index > m_keys.Length())
  {
    // Something's gone wrong in a caller, but we have no clue why
    // Return without adding the header to the view
    NS_ERROR("Index for message header insertion out of array range!");
    return;
  }
  m_keys.InsertElementAt(index, msgKey);
  m_flags.InsertElementAt(index, flags);
  m_levels.InsertElementAt(index, level);
}

void nsMsgDBView::SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index,
                              nsMsgKey msgKey, uint32_t flags, uint32_t level)
{
  m_keys[index] = msgKey;
  m_flags[index] = flags;
  m_levels[index] = level;
}

nsresult nsMsgDBView::GetFolderForViewIndex(nsMsgViewIndex index, nsIMsgFolder **aFolder)
{
  NS_IF_ADDREF(*aFolder = m_folder);
  return NS_OK;
}

nsresult nsMsgDBView::GetDBForViewIndex(nsMsgViewIndex index, nsIMsgDatabase **db)
{
  NS_IF_ADDREF(*db = m_db);
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetImageSrc(int32_t aRow, nsITreeColumn* aCol, nsAString& aValue)
{
  NS_ENSURE_ARG_POINTER(aCol);
  //attempt to retreive a custom column handler. If it exists call it and return
  const PRUnichar* colID;
  aCol->GetIdConst(&colID);

  nsIMsgCustomColumnHandler* colHandler = GetColumnHandler(colID);

  if (colHandler)
  {
    colHandler->GetImageSrc(aRow, aCol, aValue);
    return NS_OK;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::GetProgressMode(int32_t aRow, nsITreeColumn* aCol, int32_t* _retval)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetCellValue(int32_t aRow, nsITreeColumn* aCol, nsAString& aValue)
{
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsresult rv = GetMsgHdrForViewIndex(aRow, getter_AddRefs(msgHdr));

  if (NS_FAILED(rv) || !msgHdr)
  {
    ClearHdrCache();
    return NS_MSG_INVALID_DBVIEW_INDEX;
  }

  const PRUnichar* colID;
  aCol->GetIdConst(&colID);

  uint32_t flags;
  msgHdr->GetFlags(&flags);

  aValue.Truncate();
  // provide a string "value" for cells that do not normally have text.
  // use empty string for the normal states "Read", "Not Starred", "No Attachment" and "Not Junk"
  switch (colID[0])
  {
    case 'a': // attachment column
      if (flags & nsMsgMessageFlags::Attachment) {
        nsString tmp_str;
        tmp_str.Adopt(GetString(NS_LITERAL_STRING("messageHasAttachment").get()));
        aValue.Assign(tmp_str);
      }
      break;
    case 'f': // flagged (starred) column
      if (flags & nsMsgMessageFlags::Marked) {
        nsString tmp_str;
        tmp_str.Adopt(GetString(NS_LITERAL_STRING("messageHasFlag").get()));
        aValue.Assign(tmp_str);
      }
      break;
    case 'j': // junk column
      if (JunkControlsEnabled(aRow))
      {
        nsCString junkScoreStr;
        msgHdr->GetStringProperty("junkscore", getter_Copies(junkScoreStr));
        // Only need to assing a real value for junk, it's empty already
        // as it should be for non-junk.
        if (!junkScoreStr.IsEmpty() &&
            (junkScoreStr.ToInteger(&rv) == nsIJunkMailPlugin::IS_SPAM_SCORE))
          aValue.AssignLiteral("messageJunk");

        NS_ASSERTION(NS_SUCCEEDED(rv), "Converting junkScore to integer failed.");
      }
      break;
    case 't':
      if (colID[1] == 'h' && (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
      {       // thread column
        bool isContainer, isContainerEmpty, isContainerOpen;
        IsContainer(aRow, &isContainer);
        if (isContainer)
        {
          IsContainerEmpty(aRow, &isContainerEmpty);
          if (!isContainerEmpty)
          {
            nsString tmp_str;

            IsContainerOpen(aRow, &isContainerOpen);
            tmp_str.Adopt(GetString(isContainerOpen ?
                                   NS_LITERAL_STRING("messageExpanded").get() :
                                   NS_LITERAL_STRING("messageCollapsed").get()));
            aValue.Assign(tmp_str);
          }
        }
      }
      break;
    case 'u': // read/unread column
      if (!(flags & nsMsgMessageFlags::Read)) {
        nsString tmp_str;
        tmp_str.Adopt(GetString(NS_LITERAL_STRING("messageUnread").get()));
        aValue.Assign(tmp_str);
      }
      break;
    default:
      aValue.Assign(colID);
      break;
  }
  return rv;
}

void nsMsgDBView::RememberDeletedMsgHdr(nsIMsgDBHdr *msgHdr)
{
  nsCString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  if (mRecentlyDeletedArrayIndex >= mRecentlyDeletedMsgIds.Length())
    mRecentlyDeletedMsgIds.AppendElement(messageId);
  else
    mRecentlyDeletedMsgIds[mRecentlyDeletedArrayIndex] = messageId;
  // only remember last 20 deleted msgs.
  mRecentlyDeletedArrayIndex = (mRecentlyDeletedArrayIndex + 1) % 20;
}

bool nsMsgDBView::WasHdrRecentlyDeleted(nsIMsgDBHdr *msgHdr)
{
  nsCString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  return mRecentlyDeletedMsgIds.Contains(messageId);
}

//add a custom column handler
NS_IMETHODIMP nsMsgDBView::AddColumnHandler(const nsAString& column, nsIMsgCustomColumnHandler* handler)
{

  uint32_t index = m_customColumnHandlerIDs.IndexOf(column);

  nsAutoString strColID(column);

  //does not exist
  if (index == m_customColumnHandlerIDs.NoIndex)
  {
    m_customColumnHandlerIDs.AppendElement(strColID);
    m_customColumnHandlers.AppendObject(handler);
  }
  else
  {
    //insert new handler into the appropriate place in the COMPtr array
    //no need to replace the column ID (it's the same)
    m_customColumnHandlers.ReplaceObjectAt(handler, index);

  }
  // Check if the column name matches any of the columns in
  // m_sortColumns, and if so, set m_sortColumns[i].mColHandler
  for (uint32_t i = 0; i < m_sortColumns.Length(); i++)
  {
    MsgViewSortColumnInfo &sortInfo = m_sortColumns[i];
    if (sortInfo.mSortType == nsMsgViewSortType::byCustom &&
          sortInfo.mCustomColumnName.Equals(column))
      sortInfo.mColHandler = handler;
  }
  return NS_OK;
}

//remove a custom column handler
NS_IMETHODIMP nsMsgDBView::RemoveColumnHandler(const nsAString& aColID)
{

  // here we should check if the column name matches any of the columns in
  // m_sortColumns, and if so, clear m_sortColumns[i].mColHandler
  int32_t index = m_customColumnHandlerIDs.IndexOf(aColID);

  if (index != -1)
  {
    m_customColumnHandlerIDs.RemoveElementAt(index);
    m_customColumnHandlers.RemoveObjectAt(index);
    // Check if the column name matches any of the columns in
    // m_sortColumns, and if so, clear m_sortColumns[i].mColHandler
    for (uint32_t i = 0; i < m_sortColumns.Length(); i++)
    {
      MsgViewSortColumnInfo &sortInfo = m_sortColumns[i];
      if (sortInfo.mSortType == nsMsgViewSortType::byCustom &&
            sortInfo.mCustomColumnName.Equals(aColID))
        sortInfo.mColHandler = nullptr;
    }

    return NS_OK;
  }

  return NS_ERROR_FAILURE; //can't remove a column that isn't currently custom handled
}

//TODO: NS_ENSURE_SUCCESS
nsIMsgCustomColumnHandler* nsMsgDBView::GetCurColumnHandlerFromDBInfo()
{

  nsAutoString colID;
  GetCurCustomColumn(colID);
  return GetColumnHandler(colID.get());
}

NS_IMETHODIMP nsMsgDBView::SetCurCustomColumn(const nsAString& aColID)
{
  if (!m_db)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIDBFolderInfo>  dbInfo;
  m_db->GetDBFolderInfo(getter_AddRefs(dbInfo));

  if (!dbInfo)
    return NS_ERROR_FAILURE;

  return dbInfo->SetProperty("customSortCol", aColID);
}

NS_IMETHODIMP nsMsgDBView::GetCurCustomColumn(nsAString &result)
{
  if (!m_db)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIDBFolderInfo>  dbInfo;
  m_db->GetDBFolderInfo(getter_AddRefs(dbInfo));

  if (!dbInfo)
    return NS_ERROR_FAILURE;

  return dbInfo->GetProperty("customSortCol", result);
}

nsIMsgCustomColumnHandler* nsMsgDBView::GetColumnHandler(const PRUnichar *colID)
{
  int32_t index = m_customColumnHandlerIDs.IndexOf(nsDependentString(colID));
  return (index > -1) ? m_customColumnHandlers[index] : nullptr;
}

NS_IMETHODIMP nsMsgDBView::GetColumnHandler(const nsAString& aColID, nsIMsgCustomColumnHandler** aHandler)
{
  NS_ENSURE_ARG_POINTER(aHandler);
  nsAutoString column(aColID);
  NS_IF_ADDREF(*aHandler = GetColumnHandler(column.get()));
  return (*aHandler) ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgDBView::GetCellText(int32_t aRow, nsITreeColumn* aCol, nsAString& aValue)
{
  const PRUnichar* colID;
  aCol->GetIdConst(&colID);

  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  aValue.Truncate();

  //attempt to retreive a custom column handler. If it exists call it and return
  nsIMsgCustomColumnHandler* colHandler = GetColumnHandler(colID);

  if (colHandler)
  {
    colHandler->GetCellText(aRow, aCol, aValue);
    return NS_OK;
  }

  return CellTextForColumn(aRow, colID, aValue);
}

NS_IMETHODIMP nsMsgDBView::CellTextForColumn(int32_t aRow,
                                             const PRUnichar *aColumnName,
                                             nsAString &aValue)
{
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  nsresult rv = GetMsgHdrForViewIndex(aRow, getter_AddRefs(msgHdr));

  if (NS_FAILED(rv) || !msgHdr)
  {
    ClearHdrCache();
    return NS_MSG_INVALID_DBVIEW_INDEX;
  }

  nsCOMPtr<nsIMsgThread> thread;

  switch (aColumnName[0])
  {
  case 's':
    if (aColumnName[1] == 'u') // subject
      rv = FetchSubject(msgHdr, m_flags[aRow], aValue);
    else if (aColumnName[1] == 'e') // sender
      rv = FetchAuthor(msgHdr, aValue);
    else if (aColumnName[1] == 'i') // size
      rv = FetchSize(msgHdr, aValue);
    else if (aColumnName[1] == 't') // status
    {
      uint32_t flags;
      msgHdr->GetFlags(&flags);
      rv = FetchStatus(flags, aValue);
    }
    break;
  case 'r':
    if (aColumnName[3] == 'i') // recipient
      rv = FetchRecipients(msgHdr, aValue);
    else if (aColumnName[3] == 'e') // received
      rv = FetchDate(msgHdr, aValue, true);
    break;
  case 'd':  // date
    rv = FetchDate(msgHdr, aValue);
    break;
  case 'p': // priority
    rv = FetchPriority(msgHdr, aValue);
    break;
  case 'a': // account
    if (aColumnName[1] == 'c') // account
      rv = FetchAccount(msgHdr, aValue);
    break;
  case 't':
    // total msgs in thread column
    if (aColumnName[1] == 'o' && (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
    {
      if (m_flags[aRow] & MSG_VIEW_FLAG_ISTHREAD)
      {
        rv = GetThreadContainingIndex(aRow, getter_AddRefs(thread));
        if (NS_SUCCEEDED(rv) && thread)
        {
          nsAutoString formattedCountString;
          uint32_t numChildren;
          thread->GetNumChildren(&numChildren);
          formattedCountString.AppendInt(numChildren);
          aValue.Assign(formattedCountString);
        }
      }
    }
    else if (aColumnName[1] == 'a') // tags
    {
      rv = FetchTags(msgHdr, aValue);
    }
    break;
  case 'u':
    // unread msgs in thread col
    if (aColumnName[6] == 'C' && (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
    {
      if (m_flags[aRow] & MSG_VIEW_FLAG_ISTHREAD)
      {
        rv = GetThreadContainingIndex(aRow, getter_AddRefs(thread));
        if (NS_SUCCEEDED(rv) && thread)
        {
          nsAutoString formattedCountString;
          uint32_t numUnreadChildren;
          thread->GetNumUnreadChildren(&numUnreadChildren);
          if (numUnreadChildren > 0)
          {
            formattedCountString.AppendInt(numUnreadChildren);
            aValue.Assign(formattedCountString);
          }
        }
      }
    }
    break;
  case 'j':
    {
      nsCString junkScoreStr;
      msgHdr->GetStringProperty("junkscore", getter_Copies(junkScoreStr));
      CopyASCIItoUTF16(junkScoreStr, aValue);
    }
    break;
  case 'i': // id
    {
      nsAutoString keyString;
      nsMsgKey key;
      msgHdr->GetMessageKey(&key);
      keyString.AppendInt((int64_t)key);
      aValue.Assign(keyString);
    }
  default:
    break;
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetTree(nsITreeBoxObject *tree)
{
  mTree = tree;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::ToggleOpenState(int32_t index)
{
  uint32_t numChanged;
  nsresult rv = ToggleExpansion(index, &numChanged);
  NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::CycleHeader(nsITreeColumn* aCol)
{
    // let HandleColumnClick() in threadPane.js handle it
    // since it will set / clear the sort indicators.
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::CycleCell(int32_t row, nsITreeColumn* col)
{
  if (!IsValidIndex(row))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  const PRUnichar* colID;
  col->GetIdConst(&colID);

  //attempt to retreive a custom column handler. If it exists call it and return
  nsIMsgCustomColumnHandler* colHandler = GetColumnHandler(colID);

  if (colHandler)
  {
    colHandler->CycleCell(row, col);
    return NS_OK;
  }

  switch (colID[0])
  {
  case 'u': // unreadButtonColHeader
    if (colID[6] == 'B')
      ApplyCommandToIndices(nsMsgViewCommandType::toggleMessageRead, (nsMsgViewIndex *) &row, 1);
   break;
  case 't': // tag cell, threaded cell or total cell
    if (colID[1] == 'h')
    {
      ExpandAndSelectThreadByIndex(row, false);
    }
    else if (colID[1] == 'a')
    {
      // ### Do we want to keep this behaviour but switch it to tags?
      // We could enumerate over the tags and go to the next one - it looks
      // to me like this wasn't working before tags landed, so maybe not
      // worth bothering with.
    }
    break;
  case 'f': // flagged column
    // toggle the flagged status of the element at row.
    if (m_flags[row] & nsMsgMessageFlags::Marked)
      ApplyCommandToIndices(nsMsgViewCommandType::unflagMessages, (nsMsgViewIndex *) &row, 1);
    else
      ApplyCommandToIndices(nsMsgViewCommandType::flagMessages, (nsMsgViewIndex *) &row, 1);
    break;
  case 'j': // junkStatus column
    {
      if (!JunkControlsEnabled(row))
        return NS_OK;

      nsCOMPtr <nsIMsgDBHdr> msgHdr;

      nsresult rv = GetMsgHdrForViewIndex(row, getter_AddRefs(msgHdr));
      if (NS_SUCCEEDED(rv) && msgHdr)
      {
        nsCString junkScoreStr;
        rv = msgHdr->GetStringProperty("junkscore", getter_Copies(junkScoreStr));
        if (junkScoreStr.IsEmpty() || (junkScoreStr.ToInteger(&rv) == nsIJunkMailPlugin::IS_HAM_SCORE))
          ApplyCommandToIndices(nsMsgViewCommandType::junk, (nsMsgViewIndex *) &row, 1);
        else
          ApplyCommandToIndices(nsMsgViewCommandType::unjunk, (nsMsgViewIndex *) &row, 1);

        NS_ASSERTION(NS_SUCCEEDED(rv), "Converting junkScore to integer failed.");
      }
    }
    break;
  default:
    break;

  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::PerformAction(const PRUnichar *action)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::PerformActionOnRow(const PRUnichar *action, int32_t row)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::PerformActionOnCell(const PRUnichar *action, int32_t row, nsITreeColumn* col)
{
  return NS_OK;
}

///////////////////////////////////////////////////////////////////////////
// end nsITreeView Implementation Methods
///////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP nsMsgDBView::Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder, nsMsgViewFlagsTypeValue viewFlags, int32_t *pCount)
{
  m_viewFlags = viewFlags;
  m_sortOrder = sortOrder;
  m_sortType = sortType;

  nsresult rv;
  nsCOMPtr<nsIMsgAccountManager> accountManager =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  bool userNeedsToAuthenticate = false;
  // if we're PasswordProtectLocalCache, then we need to find out if the server is authenticated.
  (void) accountManager->GetUserNeedsToAuthenticate(&userNeedsToAuthenticate);
  if (userNeedsToAuthenticate)
    return NS_MSG_USER_NOT_AUTHENTICATED;

  if (folder) // search view will have a null folder
  {
    nsCOMPtr <nsIDBFolderInfo> folderInfo;
    rv = folder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(m_db));
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    msgDBService->RegisterPendingListener(folder, this);
    m_folder = folder;
    m_viewFolder = folder;

    SetMRUTimeForFolder(m_folder);

    // restore m_sortColumns from db
    nsString sortColumnsString;
    folderInfo->GetProperty("sortColumns", sortColumnsString);
    DecodeColumnSort(sortColumnsString);
    // determine if we are in a news folder or not.
    // if yes, we'll show lines instead of size, and special icons in the thread pane
    nsCOMPtr <nsIMsgIncomingServer> server;
    rv = folder->GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv,rv);
    nsCString type;
    rv = server->GetType(type);
    NS_ENSURE_SUCCESS(rv,rv);

    // I'm not sure this is correct, because XF virtual folders with mixed news
    // and mail can have this set.
    mIsNews = MsgLowerCaseEqualsLiteral(type, "nntp");

    // Default to a virtual folder if folder not set, since synthetic search
    // views may not have a folder.
    uint32_t folderFlags = nsMsgFolderFlags::Virtual;
    if (folder)
      folder->GetFlags(&folderFlags);
    mIsXFVirtual = folderFlags & nsMsgFolderFlags::Virtual;

    if (!mIsXFVirtual && MsgLowerCaseEqualsLiteral(type, "rss"))
      mIsRss = true;

    // special case nntp --> news since we'll break themes if we try to be consistent
    if (mIsNews)
      mMessageType.AssignLiteral("news");
    else
      CopyUTF8toUTF16(type, mMessageType);

    GetImapDeleteModel(nullptr);

    if (mIsNews)
    {
      nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID));
      if (prefs)
      {
        bool temp;
        rv = prefs->GetBoolPref("news.show_size_in_lines", &temp);
        if (NS_SUCCEEDED(rv))
          mShowSizeInLines = temp;
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::Close()
{
  int32_t oldSize = GetSize();
  // this is important, because the tree will ask us for our
  // row count, which get determine from the number of keys.
  m_keys.Clear();
  // be consistent
  m_flags.Clear();
  m_levels.Clear();

  // clear these out since they no longer apply if we're switching a folder
  if (mJunkHdrs)
    mJunkHdrs->Clear();

  // this needs to happen after we remove all the keys, since RowCountChanged() will call our GetRowCount()
  if (mTree)
    mTree->RowCountChanged(0, -oldSize);

  ClearHdrCache();
  if (m_db)
  {
    m_db->RemoveListener(this);
    m_db = nullptr;
  }
  if (m_folder)
  {
    nsresult rv;
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    msgDBService->UnregisterPendingListener(this);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::OpenWithHdrs(nsISimpleEnumerator *aHeaders, nsMsgViewSortTypeValue aSortType,
                                        nsMsgViewSortOrderValue aSortOrder, nsMsgViewFlagsTypeValue aViewFlags,
                                        int32_t *aCount)
{
  NS_ASSERTION(false, "not implemented");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgDBView::Init(nsIMessenger * aMessengerInstance, nsIMsgWindow * aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater)
{
  mMessengerWeak = do_GetWeakReference(aMessengerInstance);
  mMsgWindowWeak = do_GetWeakReference(aMsgWindow);
  mCommandUpdater = aCmdUpdater;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetSuppressCommandUpdating(bool aSuppressCommandUpdating)
{
  mSuppressCommandUpdating = aSuppressCommandUpdating;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetSuppressCommandUpdating(bool * aSuppressCommandUpdating)
{
  *aSuppressCommandUpdating = mSuppressCommandUpdating;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetSuppressMsgDisplay(bool aSuppressDisplay)
{
  uint32_t numSelected = 0;
  GetNumSelected(&numSelected);

  bool forceDisplay = false;
  if (mSuppressMsgDisplay && !aSuppressDisplay && numSelected == 1)
    forceDisplay = true;

  mSuppressMsgDisplay = aSuppressDisplay;
  if (forceDisplay)
  {
    // get the view indexfor the currently selected message
    nsMsgViewIndex viewIndex;
    nsresult rv = GetViewIndexForFirstSelectedMsg(&viewIndex);
    if (NS_SUCCEEDED(rv) && viewIndex != nsMsgViewIndex_None)
       LoadMessageByViewIndex(viewIndex);
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetSuppressMsgDisplay(bool * aSuppressDisplay)
{
  *aSuppressDisplay = mSuppressMsgDisplay;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetUsingLines(bool * aUsingLines)
{
  *aUsingLines = mShowSizeInLines;
  return NS_OK;
}

int CompareViewIndices (const void *v1, const void *v2, void *)
{
  nsMsgViewIndex i1 = *(nsMsgViewIndex*) v1;
  nsMsgViewIndex i2 = *(nsMsgViewIndex*) v2;
  return i1 - i2;
}

NS_IMETHODIMP nsMsgDBView::GetIndicesForSelection(uint32_t *length, nsMsgViewIndex **indices)
{
  NS_ENSURE_ARG_POINTER(length);
  *length = 0;
  NS_ENSURE_ARG_POINTER(indices);
  *indices = nullptr;

  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);
  uint32_t numIndices = selection.Length();
  if (!numIndices) return NS_OK;
  *length = numIndices;

  uint32_t datalen = numIndices * sizeof(nsMsgViewIndex);
  *indices = (nsMsgViewIndex *)NS_Alloc(datalen);
  if (!*indices) return NS_ERROR_OUT_OF_MEMORY;
  memcpy(*indices, selection.Elements(), datalen);
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetMsgHdrsForSelection(nsIMutableArray **aResult)
{
  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);
  uint32_t numIndices = selection.Length();

  nsresult rv;
  nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = GetHeadersFromSelection(selection.Elements(), numIndices, messages);
  NS_ENSURE_SUCCESS(rv, rv);
  messages.forget(aResult);
  return rv;
}

NS_IMETHODIMP nsMsgDBView::GetURIsForSelection(uint32_t *length, char ***uris)
{
  nsresult rv = NS_OK;

  NS_ENSURE_ARG_POINTER(length);
  *length = 0;

  NS_ENSURE_ARG_POINTER(uris);
  *uris = nullptr;

  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);
  uint32_t numIndices = selection.Length();
  if (!numIndices) return NS_OK;

  nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = GetHeadersFromSelection(selection.Elements(), numIndices, messages);
  NS_ENSURE_SUCCESS(rv, rv);
  messages->GetLength(length);
  uint32_t numMsgsSelected = *length;

  char **outArray, **next;
  next = outArray = (char **)nsMemory::Alloc(numMsgsSelected * sizeof(char *));
  if (!outArray) return NS_ERROR_OUT_OF_MEMORY;
  for (uint32_t i = 0; i < numMsgsSelected; i++)
  {
    nsCString tmpUri;
    nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(messages, i, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsIMsgFolder> folder;
    nsMsgKey msgKey;
    msgHdr->GetMessageKey(&msgKey);
    msgHdr->GetFolder(getter_AddRefs(folder));
    rv = GenerateURIForMsgKey(msgKey, folder, tmpUri);
    NS_ENSURE_SUCCESS(rv,rv);
    *next = ToNewCString(tmpUri);
    if (!*next)
      return NS_ERROR_OUT_OF_MEMORY;

    next++;
  }

  *uris = outArray;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetURIForViewIndex(nsMsgViewIndex index, nsACString &result)
{
  nsresult rv;
  nsCOMPtr <nsIMsgFolder> folder = m_folder;
  if (!folder)
  {
    rv = GetFolderForViewIndex(index, getter_AddRefs(folder));
    NS_ENSURE_SUCCESS(rv,rv);
  }
  if (index == nsMsgViewIndex_None || index >= m_flags.Length() ||
      m_flags[index] & MSG_VIEW_FLAG_DUMMY)
    return NS_MSG_INVALID_DBVIEW_INDEX;
  return GenerateURIForMsgKey(m_keys[index], folder, result);
}

NS_IMETHODIMP nsMsgDBView::DoCommandWithFolder(nsMsgViewCommandTypeValue command, nsIMsgFolder *destFolder)
{
  NS_ENSURE_ARG_POINTER(destFolder);

  nsMsgViewIndexArray selection;

  GetSelectedIndices(selection);

  nsMsgViewIndex *indices = selection.Elements();
  int32_t numIndices = selection.Length();

  nsresult rv = NS_OK;
  switch (command) {
    case nsMsgViewCommandType::copyMessages:
    case nsMsgViewCommandType::moveMessages:
        NoteStartChange(nsMsgViewNotificationCode::none, 0, 0);
        rv = ApplyCommandToIndicesWithFolder(command, indices, numIndices, destFolder);
        NoteEndChange(nsMsgViewNotificationCode::none, 0, 0);
        break;
    default:
        NS_ASSERTION(false, "invalid command type");
        rv = NS_ERROR_UNEXPECTED;
        break;
  }
  return rv;

}

NS_IMETHODIMP nsMsgDBView::DoCommand(nsMsgViewCommandTypeValue command)
{
  nsMsgViewIndexArray selection;

  GetSelectedIndices(selection);

  nsMsgViewIndex *indices = selection.Elements();
  int32_t numIndices = selection.Length();
  nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));

  nsresult rv = NS_OK;
  switch (command)
  {
  case nsMsgViewCommandType::downloadSelectedForOffline:
    return DownloadForOffline(msgWindow, indices, numIndices);
  case nsMsgViewCommandType::downloadFlaggedForOffline:
    return DownloadFlaggedForOffline(msgWindow);
  case nsMsgViewCommandType::markMessagesRead:
  case nsMsgViewCommandType::markMessagesUnread:
  case nsMsgViewCommandType::toggleMessageRead:
  case nsMsgViewCommandType::flagMessages:
  case nsMsgViewCommandType::unflagMessages:
  case nsMsgViewCommandType::deleteMsg:
  case nsMsgViewCommandType::undeleteMsg:
  case nsMsgViewCommandType::deleteNoTrash:
  case nsMsgViewCommandType::markThreadRead:
  case nsMsgViewCommandType::junk:
  case nsMsgViewCommandType::unjunk:
    NoteStartChange(nsMsgViewNotificationCode::none, 0, 0);
    rv = ApplyCommandToIndices(command, indices, numIndices);
    NoteEndChange(nsMsgViewNotificationCode::none, 0, 0);
    break;
  case nsMsgViewCommandType::selectAll:
    if (mTreeSelection && mTree)
    {
        // if in threaded mode, we need to expand all before selecting
        if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
            rv = ExpandAll();
        mTreeSelection->SelectAll();
        NS_ASSERTION(mTree, "SelectAll cleared mTree!");
        if (mTree)
          mTree->Invalidate();
    }
    break;
  case nsMsgViewCommandType::selectThread:
    rv = ExpandAndSelectThread();
    break;
  case nsMsgViewCommandType::selectFlagged:
    if (!mTreeSelection)
      rv = NS_ERROR_UNEXPECTED;
    else
    {
      mTreeSelection->SetSelectEventsSuppressed(true);
      mTreeSelection->ClearSelection();
      // XXX ExpandAll?
      nsMsgViewIndex numIndices = GetSize();
      for (nsMsgViewIndex curIndex = 0; curIndex < numIndices; curIndex++)
      {
        if (m_flags[curIndex] & nsMsgMessageFlags::Marked)
          mTreeSelection->ToggleSelect(curIndex);
      }
      mTreeSelection->SetSelectEventsSuppressed(false);
    }
    break;
  case nsMsgViewCommandType::markAllRead:
    if (m_folder)
    {
      SetSuppressChangeNotifications(true);
      rv = m_folder->MarkAllMessagesRead(msgWindow);
      SetSuppressChangeNotifications(false);
      if (mTree)
        mTree->Invalidate();
    }
    break;
  case nsMsgViewCommandType::toggleThreadWatched:
    rv = ToggleWatched(indices,  numIndices);
    break;
  case nsMsgViewCommandType::expandAll:
    rv = ExpandAll();
    m_viewFlags |= nsMsgViewFlagsType::kExpandAll;
    SetViewFlags(m_viewFlags);
    NS_ASSERTION(mTree, "no tree, see bug #114956");
    if(mTree)
      mTree->Invalidate();
    break;
  case nsMsgViewCommandType::collapseAll:
    rv = CollapseAll();
    m_viewFlags &= ~nsMsgViewFlagsType::kExpandAll;
    SetViewFlags(m_viewFlags);
    NS_ASSERTION(mTree, "no tree, see bug #114956");
    if(mTree)
      mTree->Invalidate();
    break;
  default:
    NS_ASSERTION(false, "invalid command type");
    rv = NS_ERROR_UNEXPECTED;
    break;
  }
  return rv;
}

bool nsMsgDBView::ServerSupportsFilterAfterTheFact()
{
  if (!m_folder)  // cross folder virtual folders might not have a folder set.
    return false;

  nsCOMPtr <nsIMsgIncomingServer> server;
  nsresult rv = m_folder->GetServer(getter_AddRefs(server));
  if (NS_FAILED(rv))
    return false; // unexpected

  // filter after the fact is implement using search
  // so if you can't search, you can't filter after the fact
  bool canSearch;
  rv = server->GetCanSearchMessages(&canSearch);
  if (NS_FAILED(rv))
    return false; // unexpected

  return canSearch;
}

NS_IMETHODIMP nsMsgDBView::GetCommandStatus(nsMsgViewCommandTypeValue command, bool *selectable_p, nsMsgViewCommandCheckStateValue *selected_p)
{
  nsresult rv = NS_OK;

  bool haveSelection;
  int32_t rangeCount;
  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);
  int32_t numIndices = selection.Length();
  nsMsgViewIndex *indices = selection.Elements();
  // if range count is non-zero, we have at least one item selected, so we have a selection
  if (mTreeSelection && NS_SUCCEEDED(mTreeSelection->GetRangeCount(&rangeCount)) && rangeCount > 0)
    haveSelection = NonDummyMsgSelected(indices, numIndices);
  else
  // If we don't have a tree selection we must be in stand alone mode.
    haveSelection = m_currentlyDisplayedViewIndex != nsMsgViewIndex_None;

  switch (command)
  {
  case nsMsgViewCommandType::deleteMsg:
  case nsMsgViewCommandType::deleteNoTrash:
    {
      bool canDelete;
      if (m_folder && NS_SUCCEEDED(m_folder->GetCanDeleteMessages(&canDelete)) && !canDelete)
        *selectable_p = false;
      else
        *selectable_p = haveSelection;
    }
    break;
  case nsMsgViewCommandType::applyFilters:
    // disable if no messages
    // XXX todo, check that we have filters, and at least one is enabled
    *selectable_p = GetSize();
    if (*selectable_p)
      *selectable_p = ServerSupportsFilterAfterTheFact();
    break;
  case nsMsgViewCommandType::runJunkControls:
    // disable if no messages
    // XXX todo, check that we have JMC enabled?
    *selectable_p = GetSize() && JunkControlsEnabled(nsMsgViewIndex_None);
    break;
  case nsMsgViewCommandType::deleteJunk:
    {
      // disable if no messages, or if we can't delete (like news and certain imap folders)
      bool canDelete;
      *selectable_p = GetSize() && (m_folder && NS_SUCCEEDED(m_folder->GetCanDeleteMessages(&canDelete)) && canDelete);
    }
    break;
  case nsMsgViewCommandType::markMessagesRead:
  case nsMsgViewCommandType::markMessagesUnread:
  case nsMsgViewCommandType::toggleMessageRead:
  case nsMsgViewCommandType::flagMessages:
  case nsMsgViewCommandType::unflagMessages:
  case nsMsgViewCommandType::toggleThreadWatched:
  case nsMsgViewCommandType::markThreadRead:
  case nsMsgViewCommandType::downloadSelectedForOffline:
    *selectable_p = haveSelection;
    break;
  case nsMsgViewCommandType::junk:
  case nsMsgViewCommandType::unjunk:
    *selectable_p = haveSelection && JunkControlsEnabled(selection[0]);
    break;
  case nsMsgViewCommandType::cmdRequiringMsgBody:
    *selectable_p = haveSelection && (!WeAreOffline() || OfflineMsgSelected(indices, numIndices));
    break;
  case nsMsgViewCommandType::downloadFlaggedForOffline:
  case nsMsgViewCommandType::markAllRead:
    *selectable_p = true;
    break;
  default:
    NS_ASSERTION(false, "invalid command type");
    rv = NS_ERROR_FAILURE;
  }
  return rv;
}

// This method needs to be overridden by the various view classes
// that have different kinds of threads. For example, in a
// threaded quick search db view, we'd only want to include children
// of the thread that fit the view (IMO). And when we have threaded
// cross folder views, we would include all the children of the
// cross-folder thread.
nsresult nsMsgDBView::ListCollapsedChildren(nsMsgViewIndex viewIndex,
                                            nsIMutableArray *messageArray)
{
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  nsCOMPtr<nsIMsgThread> thread;
  GetMsgHdrForViewIndex(viewIndex, getter_AddRefs(msgHdr));
  if (!msgHdr)
  {
    NS_ASSERTION(false, "couldn't find message to expand");
    return NS_MSG_MESSAGE_NOT_FOUND;
  }
  nsresult rv = GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(thread));
  NS_ENSURE_SUCCESS(rv, rv);
  uint32_t numChildren;
  thread->GetNumChildren(&numChildren);
  for (uint32_t i = 1; i < numChildren && NS_SUCCEEDED(rv); i++)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    rv = thread->GetChildHdrAt(i, getter_AddRefs(msgHdr));
    if (!msgHdr)
      continue;
    rv = messageArray->AppendElement(msgHdr, false);
  }
  return rv;
}

bool nsMsgDBView::OperateOnMsgsInCollapsedThreads()
{
  if (mTreeSelection)
  {
    nsCOMPtr<nsITreeBoxObject> selTree;
    mTreeSelection->GetTree(getter_AddRefs(selTree));
    // no tree means stand-alone message window
    if (!selTree)
      return false;
  }

  nsresult rv = NS_OK;
  nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, false);

  bool includeCollapsedMsgs = false;
  prefBranch->GetBoolPref("mail.operate_on_msgs_in_collapsed_threads", &includeCollapsedMsgs);
  return includeCollapsedMsgs;
}

nsresult nsMsgDBView::GetHeadersFromSelection(uint32_t *indices,
                                              uint32_t numIndices,
                                              nsIMutableArray *messageArray)
{
  nsresult rv = NS_OK;

  // Don't include collapsed messages if the front end failed to summarize
  // the selection.
  bool includeCollapsedMsgs = OperateOnMsgsInCollapsedThreads() &&
                                !mSummarizeFailed;

  for (uint32_t index = 0;
       index < (nsMsgViewIndex) numIndices && NS_SUCCEEDED(rv); index++)
  {
    nsMsgViewIndex viewIndex = indices[index];
    if (viewIndex == nsMsgViewIndex_None)
      continue;
    uint32_t viewIndexFlags = m_flags[viewIndex];
    if (viewIndexFlags & MSG_VIEW_FLAG_DUMMY)
    {
      // if collapsed dummy header selected, list its children
      if (includeCollapsedMsgs && viewIndexFlags & nsMsgMessageFlags::Elided &&
          m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
        rv = ListCollapsedChildren(viewIndex, messageArray);
      continue;
    }
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    rv = GetMsgHdrForViewIndex(viewIndex, getter_AddRefs(msgHdr));
    if (NS_SUCCEEDED(rv) && msgHdr)
    {
      rv = messageArray->AppendElement(msgHdr, false);
      if (NS_SUCCEEDED(rv) && includeCollapsedMsgs &&
          viewIndexFlags & nsMsgMessageFlags::Elided &&
          viewIndexFlags & MSG_VIEW_FLAG_HASCHILDREN &&
          m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
      {
        rv = ListCollapsedChildren(viewIndex, messageArray);
      }
    }
  }
  return rv;
}

nsresult
nsMsgDBView::CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool isMove, nsIMsgFolder *destFolder)
{
  if (m_deletingRows)
  {
    NS_ASSERTION(false, "Last move did not complete");
    return NS_OK;
  }

  nsresult rv;
  NS_ENSURE_ARG_POINTER(destFolder);
  nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = GetHeadersFromSelection(indices, numIndices, messageArray);
  NS_ENSURE_SUCCESS(rv, rv);

  m_deletingRows = isMove && mDeleteModel != nsMsgImapDeleteModels::IMAPDelete;
  if (m_deletingRows)
    mIndicesToNoteChange.AppendElements(indices, numIndices);

  nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return copyService->CopyMessages(m_folder /* source folder */, messageArray, destFolder, isMove, nullptr /* listener */, window, true /*allowUndo*/);
}

nsresult
nsMsgDBView::ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    int32_t numIndices, nsIMsgFolder *destFolder)
{
  nsresult rv = NS_OK;
  NS_ENSURE_ARG_POINTER(destFolder);

  nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
  switch (command) {
    case nsMsgViewCommandType::copyMessages:
        NS_ASSERTION(!(m_folder == destFolder), "The source folder and the destination folder are the same");
        if (m_folder != destFolder)
          rv = CopyMessages(msgWindow, indices, numIndices, false /* isMove */, destFolder);
        break;
    case nsMsgViewCommandType::moveMessages:
        NS_ASSERTION(!(m_folder == destFolder), "The source folder and the destination folder are the same");
        if (m_folder != destFolder)
          rv = CopyMessages(msgWindow, indices, numIndices, true     /* isMove */, destFolder);
        break;
    default:
        NS_ASSERTION(false, "unhandled command");
        rv = NS_ERROR_UNEXPECTED;
        break;
    }
    return rv;
}

nsresult
nsMsgDBView::ApplyCommandToIndices(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
          int32_t numIndices)
{
  NS_ASSERTION(numIndices >= 0, "nsMsgDBView::ApplyCommandToIndices(): "
               "numIndices is negative!");

  if (numIndices == 0)
    return NS_OK; // return quietly, just in case

  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = GetFolderForViewIndex(indices[0], getter_AddRefs(folder));
  nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
  if (command == nsMsgViewCommandType::deleteMsg)
    return DeleteMessages(msgWindow, indices, numIndices, false);
  if (command == nsMsgViewCommandType::deleteNoTrash)
    return DeleteMessages(msgWindow, indices, numIndices, true);

  nsTArray<nsMsgKey> imapUids;
  nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(folder);
  bool thisIsImapFolder = (imapFolder != nullptr);
  nsCOMPtr<nsIJunkMailPlugin> junkPlugin;

  // if this is a junk command, get the junk plugin.
  if (command == nsMsgViewCommandType::junk ||
      command == nsMsgViewCommandType::unjunk)
  {
    // get the folder from the first item; we assume that
    // all messages in the view are from the same folder (no
    // more junk status column in the 'search messages' dialog
    // like in earlier versions...)

     nsCOMPtr<nsIMsgIncomingServer> server;
     rv = folder->GetServer(getter_AddRefs(server));
     NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgFilterPlugin> filterPlugin;
    rv = server->GetSpamFilterPlugin(getter_AddRefs(filterPlugin));
    NS_ENSURE_SUCCESS(rv, rv);

    junkPlugin = do_QueryInterface(filterPlugin, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!mJunkHdrs)
    {
      mJunkHdrs = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv,rv);
    }
  }

  folder->EnableNotifications(nsIMsgFolder::allMessageCountNotifications, false, true /*dbBatching*/);

  // no sense going through the code that handles messages in collasped threads
  // for mark thread read.
  if (command == nsMsgViewCommandType::markThreadRead)
  {
    for (int32_t index = 0; index < numIndices; index++)
      SetThreadOfMsgReadByIndex(indices[index], imapUids, true);
  }
  else
  {
    // Turn the selection into an array of msg hdrs. This may include messages
    // in collapsed threads
    uint32_t length;
    nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = GetHeadersFromSelection(indices, numIndices, messages);
    NS_ENSURE_SUCCESS(rv, rv);
    messages->GetLength(&length);

    if (thisIsImapFolder)
      imapUids.SetLength(length);

    for (uint32_t i = 0; i < length; i++)
    {
      nsMsgKey msgKey;
      nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(messages, i);
      msgHdr->GetMessageKey(&msgKey);
      if (thisIsImapFolder)
        imapUids[i] = msgKey;

      switch (command)
      {
      case nsMsgViewCommandType::junk:
        mNumMessagesRemainingInBatch++;
        mJunkHdrs->AppendElement(msgHdr, false);
        rv = SetMsgHdrJunkStatus(junkPlugin.get(), msgHdr,
                                 nsIJunkMailPlugin::JUNK);
        break;
      case nsMsgViewCommandType::unjunk:
        mNumMessagesRemainingInBatch++;
        mJunkHdrs->AppendElement(msgHdr, false);
        rv = SetMsgHdrJunkStatus(junkPlugin.get(), msgHdr,
                                 nsIJunkMailPlugin::GOOD);
        break;
      case nsMsgViewCommandType::toggleMessageRead:
      case nsMsgViewCommandType::undeleteMsg:
      case nsMsgViewCommandType::markMessagesRead:
      case nsMsgViewCommandType::markMessagesUnread:
      case nsMsgViewCommandType::unflagMessages:
      case nsMsgViewCommandType::flagMessages:
        break; // this is completely handled in the code below.
      default:
        NS_ERROR("unhandled command");
        break;
      }
    }

    switch (command)
    {
      case nsMsgViewCommandType::toggleMessageRead:
      {
        nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(messages, 0);
        if (!msgHdr)
          break;
        uint32_t msgFlags;
        msgHdr->GetFlags(&msgFlags);
        folder->MarkMessagesRead(messages,
                                 !(msgFlags & nsMsgMessageFlags::Read));
      }
        break;
      case nsMsgViewCommandType::markMessagesRead:
      case nsMsgViewCommandType::markMessagesUnread:
        folder->MarkMessagesRead(messages,
                                 command == nsMsgViewCommandType::markMessagesRead);
        break;
      case nsMsgViewCommandType::unflagMessages:
      case nsMsgViewCommandType::flagMessages:
        folder->MarkMessagesFlagged(messages,
                                    command == nsMsgViewCommandType::flagMessages);
        break;
      default:
        break;

    }
    // Provide junk-related batch notifications
    if ((command == nsMsgViewCommandType::junk) &&
        (command == nsMsgViewCommandType::unjunk)) {
      nsCOMPtr<nsIMsgFolderNotificationService>
        notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
        notifier->NotifyItemEvent(messages,
                                  NS_LITERAL_CSTRING("JunkStatusChanged"),
                                  (command == nsMsgViewCommandType::junk) ?
                                    kJunkMsgAtom : kNotJunkMsgAtom);
    }
  }

  folder->EnableNotifications(nsIMsgFolder::allMessageCountNotifications, true, true /*dbBatching*/);

  if (thisIsImapFolder)
  {
    imapMessageFlagsType flags = kNoImapMsgFlag;
    bool addFlags = false;
    nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
    switch (command)
    {
    case nsMsgViewCommandType::markThreadRead:
      flags |= kImapMsgSeenFlag;
      addFlags = true;
      break;
    case nsMsgViewCommandType::undeleteMsg:
      flags = kImapMsgDeletedFlag;
      addFlags = false;
      break;
    case nsMsgViewCommandType::junk:
        return imapFolder->StoreCustomKeywords(msgWindow,
                    NS_LITERAL_CSTRING("Junk"),
                    NS_LITERAL_CSTRING("NonJunk"),
                    imapUids.Elements(), imapUids.Length(),
                    nullptr);
    case nsMsgViewCommandType::unjunk:
      {
        nsCOMPtr<nsIMsgDBHdr> msgHdr;
        GetHdrForFirstSelectedMessage(getter_AddRefs(msgHdr));
        uint32_t msgFlags = 0;
        if (msgHdr)
          msgHdr->GetFlags(&msgFlags);
        if (msgFlags & nsMsgMessageFlags::IMAPDeleted)
          imapFolder->StoreImapFlags(kImapMsgDeletedFlag, false,
                                     imapUids.Elements(),
                                     imapUids.Length(), nullptr);
        return imapFolder->StoreCustomKeywords(msgWindow,
                    NS_LITERAL_CSTRING("NonJunk"),
                    NS_LITERAL_CSTRING("Junk"),
                    imapUids.Elements(), imapUids.Length(),
                    nullptr);
      }

    default:
      break;
    }

    if (flags != kNoImapMsgFlag)  // can't get here without thisIsImapThreadPane == TRUE
      imapFolder->StoreImapFlags(flags, addFlags, imapUids.Elements(), imapUids.Length(), nullptr);

  }

  return rv;
}

// view modifications methods by index

// This method just removes the specified line from the view. It does
// NOT delete it from the database.
nsresult nsMsgDBView::RemoveByIndex(nsMsgViewIndex index)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;
  m_keys.RemoveElementAt(index);
  m_flags.RemoveElementAt(index);
  m_levels.RemoveElementAt(index);

  // the call to NoteChange() has to happen after we remove the key
  // as NoteChange() will call RowCountChanged() which will call our GetRowCount()
  if (!m_deletingRows)
    NoteChange(index, -1, nsMsgViewNotificationCode::insertOrDelete); // an example where view is not the listener - D&D messages

  return NS_OK;
}

nsresult nsMsgDBView::DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool deleteStorage)
{
  if (m_deletingRows)
  {
    NS_WARNING("Last delete did not complete");
    return NS_OK;
  }
  nsresult rv;
  nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = GetHeadersFromSelection(indices, numIndices, messageArray);
  NS_ENSURE_SUCCESS(rv, rv);
  uint32_t numMsgs;
  messageArray->GetLength(&numMsgs);

  const char *warnCollapsedPref = "mail.warn_on_collapsed_thread_operation";
  const char *warnShiftDelPref = "mail.warn_on_shift_delete";
  const char *warnNewsPref = "news.warn_on_delete";
  const char *activePref = nullptr;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  if (uint32_t(numIndices) != numMsgs)
  {
    bool pref = false;
    prefBranch->GetBoolPref(warnCollapsedPref, &pref);
    if (pref)
      activePref = warnCollapsedPref;
  }

  if (!activePref && deleteStorage)
  {
    bool pref = false;
    prefBranch->GetBoolPref(warnShiftDelPref, &pref);
    if (pref)
      activePref = warnShiftDelPref;
  }

  if (!activePref && mIsNews)
  {
    bool pref = false;
    prefBranch->GetBoolPref(warnNewsPref, &pref);
    if (pref)
      activePref = warnNewsPref;
  }

  if (activePref)
  {
    nsCOMPtr<nsIPrompt> dialog;

    nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = wwatch->GetNewPrompter(0, getter_AddRefs(dialog));
    NS_ENSURE_SUCCESS(rv, rv);
    bool dontAsk = false; // "Don't ask..." - unchecked by default.
    int32_t buttonPressed = 0;

    nsString dialogTitle;
    nsString confirmString;
    nsString checkboxText;
    nsString buttonApplyNowText;
    dialogTitle.Adopt(GetString(NS_LITERAL_STRING("confirmMsgDelete.title").get()));
    checkboxText.Adopt(GetString(NS_LITERAL_STRING("confirmMsgDelete.dontAsk.label").get()));
    buttonApplyNowText.Adopt(GetString(NS_LITERAL_STRING("confirmMsgDelete.delete.label").get()));

    if (activePref == warnCollapsedPref)
      confirmString.Adopt(GetString(NS_LITERAL_STRING("confirmMsgDelete.collapsed.desc").get()));
    else // if (activePref == warnShiftDelPref || activePref == warnNewsPref)
      confirmString.Adopt(GetString(NS_LITERAL_STRING("confirmMsgDelete.deleteNoTrash.desc").get()));

    const uint32_t buttonFlags =
      (nsIPrompt::BUTTON_TITLE_IS_STRING * nsIPrompt::BUTTON_POS_0) +
      (nsIPrompt::BUTTON_TITLE_CANCEL * nsIPrompt::BUTTON_POS_1);
    rv = dialog->ConfirmEx(dialogTitle.get(), confirmString.get(), buttonFlags,
                           buttonApplyNowText.get(), nullptr, nullptr,
                           checkboxText.get(), &dontAsk, &buttonPressed);
    NS_ENSURE_SUCCESS(rv, rv);
    if (buttonPressed)
      return NS_ERROR_FAILURE;
    if (dontAsk)
      prefBranch->SetBoolPref(activePref, false);
  }

  if (mDeleteModel != nsMsgImapDeleteModels::IMAPDelete)
    m_deletingRows = true;

  if (m_deletingRows)
    mIndicesToNoteChange.AppendElements(indices, numIndices);

  rv = m_folder->DeleteMessages(messageArray, window, deleteStorage, false, nullptr, true /*allow Undo*/ );
  if (NS_FAILED(rv))
    m_deletingRows = false;
  return rv;
}

nsresult nsMsgDBView::DownloadForOffline(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
  for (nsMsgViewIndex index = 0; index < (nsMsgViewIndex) numIndices; index++)
  {
    nsMsgKey key = m_keys[indices[index]];
    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    rv = m_db->GetMsgHdrForKey(key, getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv,rv);
    if (msgHdr)
    {
      uint32_t flags;
      msgHdr->GetFlags(&flags);
      if (!(flags & nsMsgMessageFlags::Offline))
        messageArray->AppendElement(msgHdr, false);
    }
  }
  m_folder->DownloadMessagesForOffline(messageArray, window);
  return rv;
}

nsresult nsMsgDBView::DownloadFlaggedForOffline(nsIMsgWindow *window)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID));
  nsCOMPtr <nsISimpleEnumerator> enumerator;
  rv = GetMessageEnumerator(getter_AddRefs(enumerator));
  if (NS_SUCCEEDED(rv) && enumerator)
  {
    bool hasMore;

    while (NS_SUCCEEDED(rv = enumerator->HasMoreElements(&hasMore)) && hasMore)
    {
      nsCOMPtr <nsIMsgDBHdr> pHeader;
      rv = enumerator->GetNext(getter_AddRefs(pHeader));
      NS_ASSERTION(NS_SUCCEEDED(rv), "nsMsgDBEnumerator broken");
      if (pHeader && NS_SUCCEEDED(rv))
      {
        uint32_t flags;
        pHeader->GetFlags(&flags);
        if ((flags & nsMsgMessageFlags::Marked) && !(flags & nsMsgMessageFlags::Offline))
          messageArray->AppendElement(pHeader, false);
      }
    }
  }
  m_folder->DownloadMessagesForOffline(messageArray, window);
  return rv;
}

// read/unread handling.
nsresult nsMsgDBView::ToggleReadByIndex(nsMsgViewIndex index)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;
  return SetReadByIndex(index, !(m_flags[index] & nsMsgMessageFlags::Read));
}

nsresult nsMsgDBView::SetReadByIndex(nsMsgViewIndex index, bool read)
{
  nsresult rv;

  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;
  if (read)
  {
    OrExtraFlag(index, nsMsgMessageFlags::Read);
    // MarkRead() will clear this flag in the db
    // and then call OnKeyChange(), but
    // because we are the instigator of the change
    // we'll ignore the change.
    //
    // so we need to clear it in m_flags
    // to keep the db and m_flags in sync
    AndExtraFlag(index, ~nsMsgMessageFlags::New);
  }
  else
  {
    AndExtraFlag(index, ~nsMsgMessageFlags::Read);
  }

  nsCOMPtr <nsIMsgDatabase> dbToUse;
  rv = GetDBForViewIndex(index, getter_AddRefs(dbToUse));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = dbToUse->MarkRead(m_keys[index], read, this);
  NoteChange(index, 1, nsMsgViewNotificationCode::changed);
  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    nsMsgViewIndex threadIndex = GetThreadIndex(index);
    if (threadIndex != index)
      NoteChange(threadIndex, 1, nsMsgViewNotificationCode::changed);
  }
  return rv;
}

nsresult nsMsgDBView::SetThreadOfMsgReadByIndex(nsMsgViewIndex index, nsTArray<nsMsgKey> &keysMarkedRead, bool /*read*/)
{
  nsresult rv;

  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;
  rv = MarkThreadOfMsgRead(m_keys[index], index, keysMarkedRead, true);
  return rv;
}

nsresult nsMsgDBView::SetFlaggedByIndex(nsMsgViewIndex index, bool mark)
{
  nsresult rv;

  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  nsCOMPtr <nsIMsgDatabase> dbToUse;
  rv = GetDBForViewIndex(index, getter_AddRefs(dbToUse));
  NS_ENSURE_SUCCESS(rv, rv);

  if (mark)
    OrExtraFlag(index, nsMsgMessageFlags::Marked);
  else
    AndExtraFlag(index, ~nsMsgMessageFlags::Marked);

  rv = dbToUse->MarkMarked(m_keys[index], mark, this);
  NoteChange(index, 1, nsMsgViewNotificationCode::changed);
  return rv;
}

nsresult nsMsgDBView::SetMsgHdrJunkStatus(nsIJunkMailPlugin *aJunkPlugin,
                                          nsIMsgDBHdr *aMsgHdr,
                                          nsMsgJunkStatus aNewClassification)
{
    // get the old junk score
    //
    nsCString junkScoreStr;
    nsresult rv = aMsgHdr->GetStringProperty("junkscore", getter_Copies(junkScoreStr));

    // and the old origin
    //
    nsCString oldOriginStr;
    rv = aMsgHdr->GetStringProperty("junkscoreorigin",
                                   getter_Copies(oldOriginStr));

    // if this was not classified by the user, say so
    //
    nsMsgJunkStatus oldUserClassification;
    if (oldOriginStr.get()[0] != 'u') {
        oldUserClassification = nsIJunkMailPlugin::UNCLASSIFIED;
    }
    else {
        // otherwise, pass the actual user classification
        if (junkScoreStr.IsEmpty())
          oldUserClassification = nsIJunkMailPlugin::UNCLASSIFIED;
        else if (junkScoreStr.ToInteger(&rv) == nsIJunkMailPlugin::IS_SPAM_SCORE)
          oldUserClassification = nsIJunkMailPlugin::JUNK;
        else
          oldUserClassification = nsIJunkMailPlugin::GOOD;

        NS_ASSERTION(NS_SUCCEEDED(rv), "Converting junkScore to integer failed.");
    }

    // get the URI for this message so we can pass it to the plugin
    //
    nsCString uri;
    nsMsgKey msgKey;
    nsCOMPtr<nsIMsgFolder> folder;
    nsCOMPtr<nsIMsgDatabase> db;
    aMsgHdr->GetMessageKey(&msgKey);
    rv = aMsgHdr->GetFolder(getter_AddRefs(folder));
    NS_ENSURE_SUCCESS(rv, rv);
    GenerateURIForMsgKey(msgKey, folder, uri);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = folder->GetMsgDatabase(getter_AddRefs(db));
    NS_ENSURE_SUCCESS(rv, rv);

    // tell the plugin about this change, so that it can (potentially)
    // adjust its database appropriately
    nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
    rv = aJunkPlugin->SetMessageClassification(
        uri.get(), oldUserClassification, aNewClassification, msgWindow, this);
    NS_ENSURE_SUCCESS(rv, rv);

    // this routine is only reached if the user someone touched the UI
    // and told us the junk status of this message.
    // Set origin first so that listeners on the junkscore will
    // know the correct origin.
    rv = db->SetStringProperty(msgKey, "junkscoreorigin", "user");
    NS_ASSERTION(NS_SUCCEEDED(rv), "SetStringPropertyByIndex failed");

    // set the junk score on the message itself

    nsAutoCString msgJunkScore;
    msgJunkScore.AppendInt(aNewClassification == nsIJunkMailPlugin::JUNK ?
          nsIJunkMailPlugin::IS_SPAM_SCORE:
          nsIJunkMailPlugin::IS_HAM_SCORE);
    db->SetStringProperty(msgKey, "junkscore", msgJunkScore.get());
    NS_ENSURE_SUCCESS(rv, rv);

    return rv;
}

nsresult
nsMsgDBView::GetFolderFromMsgURI(const char *aMsgURI, nsIMsgFolder **aFolder)
{
  NS_IF_ADDREF(*aFolder = m_folder);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::OnMessageClassified(const char *aMsgURI,
                                 nsMsgJunkStatus aClassification,
                                 uint32_t aJunkPercent)

{
  // Note: we know all messages in a batch have the same
  // classification, since unlike OnMessageClassified
  // methods in other classes (such as nsLocalMailFolder
  // and nsImapMailFolder), this class, nsMsgDBView, currently
  // only triggers message classifications due to a command to
  // mark some of the messages in the view as junk, or as not
  // junk - so the classification is dictated to the filter,
  // not suggested by it.
  //
  // for this reason the only thing we (may) have to do is
  // perform the action on all of the junk messages
  //

  uint32_t numJunk;
  mJunkHdrs->GetLength(&numJunk);
  NS_ASSERTION((aClassification == nsIJunkMailPlugin::GOOD) ||
                numJunk,
                "the classification of a manually-marked junk message has"
                "been classified as junk, yet there seem to be no such outstanding messages");

  // is this the last message in the batch?

  if (--mNumMessagesRemainingInBatch == 0 && numJunk > 0)
  {
    PerformActionsOnJunkMsgs(aClassification == nsIJunkMailPlugin::JUNK);
    mJunkHdrs->Clear();
  }
  return NS_OK;
}

nsresult
nsMsgDBView::PerformActionsOnJunkMsgs(bool msgsAreJunk)
{
  uint32_t numJunkHdrs;
  mJunkHdrs->GetLength(&numJunkHdrs);
  if (!numJunkHdrs)
  {
    NS_ERROR("no indices of marked-as-junk messages to act on");
    return NS_OK;
  }

  nsCOMPtr<nsIMsgFolder> srcFolder;
  nsCOMPtr<nsIMsgDBHdr> firstHdr(do_QueryElementAt(mJunkHdrs, 0));
  firstHdr->GetFolder(getter_AddRefs(srcFolder));

  bool moveMessages, changeReadState;
  nsCOMPtr<nsIMsgFolder> targetFolder;

  nsresult rv = DetermineActionsForJunkChange(msgsAreJunk, srcFolder,
                                              moveMessages, changeReadState,
                                              getter_AddRefs(targetFolder));
  NS_ENSURE_SUCCESS(rv,rv);

  // nothing to do, bail out
  if (!(moveMessages || changeReadState))
    return NS_OK;
  if (changeReadState)
  {
    // notes on marking junk as read:
    // 1. there are 2 occasions on which junk messages are marked as
    //    read: after a manual marking (here and in the front end) and after
    //    automatic classification by the bayesian filter (see code for local
    //    mail folders and for imap mail folders). The server-specific
    //    markAsReadOnSpam pref only applies to the latter, the former is
    //    controlled by "mailnews.ui.junk.manualMarkAsJunkMarksRead".
    // 2. even though move/delete on manual mark may be
    //    turned off, we might still need to mark as read

    NoteStartChange(nsMsgViewNotificationCode::none, 0, 0);
    rv = srcFolder->MarkMessagesRead(mJunkHdrs, msgsAreJunk);
    NoteEndChange(nsMsgViewNotificationCode::none, 0, 0);
    NS_ASSERTION(NS_SUCCEEDED(rv), "marking marked-as-junk messages as read failed");
  }
  if (moveMessages)
  {
    // check if one of the messages to be junked is actually selected
    // if more than one message being junked, one must be selected.
    // if no tree selection at all, must be in stand-alone message window.
    bool junkedMsgSelected = numJunkHdrs > 1 || !mTreeSelection;
    for (nsMsgViewIndex junkIndex = 0; !junkedMsgSelected && junkIndex < numJunkHdrs; junkIndex++)
    {
      nsCOMPtr<nsIMsgDBHdr> junkHdr(do_QueryElementAt(mJunkHdrs, junkIndex, &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      nsMsgViewIndex hdrIndex = FindHdr(junkHdr);
      if (hdrIndex != nsMsgViewIndex_None)
        mTreeSelection->IsSelected(hdrIndex, &junkedMsgSelected);
    }

    // if a junked msg is selected, tell the FE to call SetNextMessageAfterDelete() because a delete is coming
    if (junkedMsgSelected && mCommandUpdater)
    {
      rv = mCommandUpdater->UpdateNextMessageAfterDelete();
      NS_ENSURE_SUCCESS(rv,rv);
    }

    nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
    NoteStartChange(nsMsgViewNotificationCode::none, 0, 0);
    if (targetFolder)
    {
      nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = copyService->CopyMessages(srcFolder , mJunkHdrs, targetFolder,
                                     true, nullptr, msgWindow, true);
    }
    else if (msgsAreJunk)
    {
      if (mDeleteModel == nsMsgImapDeleteModels::IMAPDelete)
      {
        // Unfortunately the DeleteMessages in this case is interpreted by IMAP as
        //  a delete toggle. So what we have to do is to assemble a new delete
        //  array, keeping only those that are not deleted.
        //
        nsCOMPtr<nsIMutableArray> hdrsToDelete = do_CreateInstance("@mozilla.org/array;1", &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        uint32_t cnt;
        rv = mJunkHdrs->GetLength(&cnt);
        for (uint32_t i = 0; i < cnt; i++)
        {
          nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(mJunkHdrs, i);
          if (msgHdr)
          {
            uint32_t flags;
            msgHdr->GetFlags(&flags);
            if (!(flags & nsMsgMessageFlags::IMAPDeleted))
              hdrsToDelete->AppendElement(msgHdr, false);
          }
        }
        hdrsToDelete->GetLength(&cnt);
        if (cnt)
          rv = srcFolder->DeleteMessages(hdrsToDelete, msgWindow, false, false,
                                         nullptr, true);
      }
      else
        rv = srcFolder->DeleteMessages(mJunkHdrs, msgWindow, false, false,
                                       nullptr, true);

    }
    else if (mDeleteModel == nsMsgImapDeleteModels::IMAPDelete)
    {
      nsCOMPtr<nsIMsgImapMailFolder> imapFolder(do_QueryInterface(srcFolder));
      nsTArray<nsMsgKey> imapUids;
      imapUids.SetLength(numJunkHdrs);
      for (uint32_t i = 0; i < numJunkHdrs; i++)
      {
        nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(mJunkHdrs, i);
        msgHdr->GetMessageKey(&imapUids[i]);
      }

      imapFolder->StoreImapFlags(kImapMsgDeletedFlag, false, imapUids.Elements(),
                                 imapUids.Length(), nullptr);
    }
    NoteEndChange(nsMsgViewNotificationCode::none, 0, 0);

    NS_ASSERTION(NS_SUCCEEDED(rv), "move or deletion of message marked-as-junk/non junk failed");
  }
  return rv;
}

nsresult
nsMsgDBView::DetermineActionsForJunkChange(bool msgsAreJunk,
                                           nsIMsgFolder *srcFolder,
                                           bool &moveMessages,
                                           bool &changeReadState,
                                           nsIMsgFolder** targetFolder)
{
  // there are two possible actions which may be performed
  // on messages marked as spam: marking as read and moving
  // somewhere...When a message is marked as non junk,
  // it may be moved to the inbox, and marked unread.

  moveMessages = false;
  changeReadState = false;

  // ... the 'somewhere', junkTargetFolder, can be a folder,
  // but if it remains null we'll delete the messages

  *targetFolder = nullptr;

  uint32_t folderFlags;
  srcFolder->GetFlags(&folderFlags);

  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = srcFolder->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // handle the easy case of marking a junk message as good first...
  // set the move target folder to the inbox, if any.
  if (!msgsAreJunk)
  {
    if (folderFlags & nsMsgFolderFlags::Junk)
    {
      prefBranch->GetBoolPref("mail.spam.markAsNotJunkMarksUnRead",
                              &changeReadState);
      nsCOMPtr<nsIMsgFolder> rootMsgFolder;
      rv = server->GetRootMsgFolder(getter_AddRefs(rootMsgFolder));
      NS_ENSURE_SUCCESS(rv,rv);
      rootMsgFolder->GetFolderWithFlags(nsMsgFolderFlags::Inbox, targetFolder);
      moveMessages = targetFolder != nullptr;
    }
    return NS_OK;
  }

  nsCOMPtr <nsISpamSettings> spamSettings;
  rv = server->GetSpamSettings(getter_AddRefs(spamSettings));
  NS_ENSURE_SUCCESS(rv, rv);

  // When the user explicitly marks a message as junk, we can mark it as read,
  // too. This is independent of the "markAsReadOnSpam" pref, which applies
  // only to automatically-classified messages.
  // Note that this behaviour should match the one in the front end for marking
  // as junk via toolbar/context menu.
  prefBranch->GetBoolPref("mailnews.ui.junk.manualMarkAsJunkMarksRead",
                          &changeReadState);

  // now let's determine whether we'll be taking the second action,
  // the move / deletion (and also determine which of these two)

  bool manualMark;
  (void)spamSettings->GetManualMark(&manualMark);
  if (!manualMark)
    return NS_OK;

  int32_t manualMarkMode;
  (void)spamSettings->GetManualMarkMode(&manualMarkMode);
  NS_ASSERTION(manualMarkMode == nsISpamSettings::MANUAL_MARK_MODE_MOVE
            || manualMarkMode == nsISpamSettings::MANUAL_MARK_MODE_DELETE,
            "bad manual mark mode");

  if (manualMarkMode == nsISpamSettings::MANUAL_MARK_MODE_MOVE)
  {
    // if this is a junk folder
    // (not only "the" junk folder for this account)
    // don't do the move
    if (folderFlags & nsMsgFolderFlags::Junk)
      return NS_OK;

    nsCString spamFolderURI;
    rv = spamSettings->GetSpamFolderURI(getter_Copies(spamFolderURI));
    NS_ENSURE_SUCCESS(rv,rv);

    NS_ASSERTION(!spamFolderURI.IsEmpty(), "spam folder URI is empty, can't move");
    if (!spamFolderURI.IsEmpty())
    {
      rv = GetExistingFolder(spamFolderURI, targetFolder);
      if (NS_SUCCEEDED(rv) && *targetFolder)
      {
        moveMessages = true;
      }
      else
      {
        // XXX ToDo: GetOrCreateFolder will only create a folder with localized
        //           name "Junk" regardless of spamFolderURI. So if someone
        //           sets the junk folder to an existing folder of a different
        //           name, then deletes that folder, this will fail to create
        //           the correct folder.
        rv = GetOrCreateFolder(spamFolderURI, nullptr /* aListener */);
        if (NS_SUCCEEDED(rv))
          rv = GetExistingFolder(spamFolderURI, targetFolder);
        NS_ASSERTION(NS_SUCCEEDED(rv) && *targetFolder, "GetOrCreateFolder failed");
      }
    }
    return NS_OK;
  }

  // at this point manualMarkMode == nsISpamSettings::MANUAL_MARK_MODE_DELETE)

  // if this is in the trash, let's not delete
  if (folderFlags & nsMsgFolderFlags::Trash)
    return NS_OK;

  return srcFolder->GetCanDeleteMessages(&moveMessages);
}

// reversing threads involves reversing the threads but leaving the
// expanded messages ordered relative to the thread, so we
// make a copy of each array and copy them over.
void nsMsgDBView::ReverseThreads()
{
    nsTArray<uint32_t> newFlagArray;
    nsTArray<nsMsgKey> newKeyArray;
    nsTArray<uint8_t> newLevelArray;

    uint32_t viewSize = GetSize();
    uint32_t startThread = viewSize;
    uint32_t nextThread = viewSize;
    uint32_t destIndex = 0;

    newKeyArray.SetLength(m_keys.Length());
    newFlagArray.SetLength(m_flags.Length());
    newLevelArray.SetLength(m_levels.Length());

    while (startThread)
    {
        startThread--;

        if (m_flags[startThread] & MSG_VIEW_FLAG_ISTHREAD)
        {
            for (uint32_t sourceIndex = startThread; sourceIndex < nextThread; sourceIndex++)
            {
                newKeyArray[destIndex] = m_keys[sourceIndex];
                newFlagArray[destIndex] = m_flags[sourceIndex];
                newLevelArray[destIndex] = m_levels[sourceIndex];
                destIndex++;
            }
            nextThread = startThread; // because we're copying in reverse order
        }
    }
    m_keys.SwapElements(newKeyArray);
    m_flags.SwapElements(newFlagArray);
    m_levels.SwapElements(newLevelArray);
}

void nsMsgDBView::ReverseSort()
{
    uint32_t topIndex = GetSize();

    nsCOMArray<nsIMsgFolder> *folders = GetFolders();

    // go up half the array swapping values
    for (uint32_t bottomIndex = 0; bottomIndex < --topIndex; bottomIndex++)
    {
        // swap flags
        uint32_t tempFlags = m_flags[bottomIndex];
        m_flags[bottomIndex] = m_flags[topIndex];
        m_flags[topIndex] = tempFlags;

        // swap keys
        nsMsgKey tempKey = m_keys[bottomIndex];
        m_keys[bottomIndex] = m_keys[topIndex];
        m_keys[topIndex] = tempKey;

        if (folders)
        {
            // swap folders --
            // needed when search is done across multiple folders
            nsIMsgFolder *bottomFolder = folders->ObjectAt(bottomIndex);
            nsIMsgFolder *topFolder = folders->ObjectAt(topIndex);
            folders->ReplaceObjectAt(topFolder, bottomIndex);
            folders->ReplaceObjectAt(bottomFolder, topIndex);
        }
        // no need to swap elements in m_levels; since we only call
        // ReverseSort in non-threaded mode, m_levels are all the same.
    }
}
int
nsMsgDBView::FnSortIdKey(const void *pItem1, const void *pItem2, void *privateData)
{
    int32_t retVal = 0;
    nsresult rv;
    viewSortInfo* sortInfo = (viewSortInfo *) privateData;

    IdKey** p1 = (IdKey**)pItem1;
    IdKey** p2 = (IdKey**)pItem2;

    nsIMsgDatabase *db = sortInfo->db;

    rv = db->CompareCollationKeys((*p1)->dword, (*p1)->key, (*p2)->dword,
                                  (*p2)->key, &retVal);
    NS_ASSERTION(NS_SUCCEEDED(rv),"compare failed");

    if (retVal)
      return sortInfo->ascendingSort ? retVal : -retVal;
    if (sortInfo->view->m_secondarySort == nsMsgViewSortType::byId)
      return (sortInfo->view->m_secondarySortOrder == nsMsgViewSortOrder::ascending &&
              (*p1)->id >= (*p2)->id) ? 1 : -1;
    else
      return sortInfo->view->SecondarySort((*p1)->id, (*p1)->folder, (*p2)->id, (*p2)->folder, sortInfo);
    // here we'd use the secondary sort
}

int
nsMsgDBView::FnSortIdKeyPtr(const void *pItem1, const void *pItem2, void *privateData)
{
  int32_t retVal = 0;
  nsresult rv;

  IdKeyPtr** p1 = (IdKeyPtr**)pItem1;
  IdKeyPtr** p2 = (IdKeyPtr**)pItem2;
  viewSortInfo* sortInfo = (viewSortInfo *) privateData;

  nsIMsgDatabase *db = sortInfo->db;

  rv = db->CompareCollationKeys((*p1)->dword, (*p1)->key, (*p2)->dword,
                                (*p2)->key, &retVal);
  NS_ASSERTION(NS_SUCCEEDED(rv),"compare failed");

  if (retVal)
    return sortInfo->ascendingSort ? retVal : -retVal;

  if (sortInfo->view->m_secondarySort == nsMsgViewSortType::byId)
    return (sortInfo->view->m_secondarySortOrder == nsMsgViewSortOrder::ascending &&
            (*p1)->id >= (*p2)->id) ? 1 : -1;
  else
    return sortInfo->view->SecondarySort((*p1)->id, (*p1)->folder, (*p2)->id, (*p2)->folder, sortInfo);
}

int
nsMsgDBView::FnSortIdUint32(const void *pItem1, const void *pItem2, void *privateData)
{
  IdUint32** p1 = (IdUint32**)pItem1;
  IdUint32** p2 = (IdUint32**)pItem2;
  viewSortInfo* sortInfo = (viewSortInfo *) privateData;

  if ((*p1)->dword > (*p2)->dword)
    return (sortInfo->ascendingSort) ? 1 : -1;
  else if ((*p1)->dword < (*p2)->dword)
      return (sortInfo->ascendingSort) ? -1 : 1;
  if (sortInfo->view->m_secondarySort == nsMsgViewSortType::byId)
    return (sortInfo->view->m_secondarySortOrder == nsMsgViewSortOrder::ascending &&
            (*p1)->id >= (*p2)->id) ? 1 : -1;
  else
    return sortInfo->view->SecondarySort((*p1)->id, (*p1)->folder, (*p2)->id, (*p2)->folder, sortInfo);
}


// XXX are these still correct?
//To compensate for memory alignment required for
//systems such as HP-UX these values must be 4 bytes
//aligned.  Don't break this when modify the constants
const int kMaxSubjectKey = 160;
const int kMaxLocationKey = 160;  // also used for account
const int kMaxAuthorKey = 160;
const int kMaxRecipientKey = 80;

//
// There are cases when pFieldType is not set:
// one case returns NS_ERROR_UNEXPECTED;
// the other case now return NS_ERROR_NULL_POINTER (this is only when
// colHandler below is null, but is very unlikely).
// The latter case used to return NS_OK, which was incorrect.
//
nsresult nsMsgDBView::GetFieldTypeAndLenForSort(nsMsgViewSortTypeValue sortType, uint16_t *pMaxLen, eFieldType *pFieldType)
{
    NS_ENSURE_ARG_POINTER(pMaxLen);
    NS_ENSURE_ARG_POINTER(pFieldType);

    switch (sortType)
    {
        case nsMsgViewSortType::bySubject:
            *pFieldType = kCollationKey;
            *pMaxLen = kMaxSubjectKey;
            break;
        case nsMsgViewSortType::byAccount:
        case nsMsgViewSortType::byTags:
        case nsMsgViewSortType::byLocation:
            *pFieldType = kCollationKey;
            *pMaxLen = kMaxLocationKey;
            break;
        case nsMsgViewSortType::byRecipient:
            *pFieldType = kCollationKey;
            *pMaxLen = kMaxRecipientKey;
            break;
        case nsMsgViewSortType::byAuthor:
            *pFieldType = kCollationKey;
            *pMaxLen = kMaxAuthorKey;
            break;
        case nsMsgViewSortType::byDate:
        case nsMsgViewSortType::byReceived:
        case nsMsgViewSortType::byPriority:
        case nsMsgViewSortType::byThread:
        case nsMsgViewSortType::byId:
        case nsMsgViewSortType::bySize:
        case nsMsgViewSortType::byFlagged:
        case nsMsgViewSortType::byUnread:
        case nsMsgViewSortType::byStatus:
        case nsMsgViewSortType::byJunkStatus:
        case nsMsgViewSortType::byAttachments:
            *pFieldType = kU32;
            *pMaxLen = 0;
            break;
        case nsMsgViewSortType::byCustom:
        {
          nsIMsgCustomColumnHandler* colHandler = GetCurColumnHandlerFromDBInfo();

          if (colHandler != nullptr)
          {
            bool isString;
            colHandler->IsString(&isString);

            if (isString)
            {
              *pFieldType = kCollationKey;
              *pMaxLen = kMaxRecipientKey; //80 - do we need a seperate k?
            }
            else
            {
              *pFieldType = kU32;
              *pMaxLen = 0;
            }
          }
          else
          {
            NS_WARNING("colHandler is null. *pFieldType is not set.");
            return NS_ERROR_NULL_POINTER;
          }
          break;
        }
        default:
        {
           nsAutoCString message("unexpected switch value: sortType=");
           message.AppendInt(sortType);
           NS_WARNING(message.get());
           return NS_ERROR_UNEXPECTED;
        }
    }

    return NS_OK;
}

#define MSG_STATUS_MASK (nsMsgMessageFlags::Replied | nsMsgMessageFlags::Forwarded)

nsresult nsMsgDBView::GetStatusSortValue(nsIMsgDBHdr *msgHdr, uint32_t *result)
{
  NS_ENSURE_ARG_POINTER(msgHdr);
  NS_ENSURE_ARG_POINTER(result);

  uint32_t messageFlags;
  nsresult rv = msgHdr->GetFlags(&messageFlags);
  NS_ENSURE_SUCCESS(rv,rv);

  if (messageFlags & nsMsgMessageFlags::New)
  {
    // happily, new by definition stands alone
    *result = 0;
    return NS_OK;
  }

  switch (messageFlags & MSG_STATUS_MASK)
  {
    case nsMsgMessageFlags::Replied:
        *result = 2;
        break;
    case nsMsgMessageFlags::Forwarded | nsMsgMessageFlags::Replied:
        *result = 1;
        break;
    case nsMsgMessageFlags::Forwarded:
        *result = 3;
        break;
    default:
        *result = (messageFlags & nsMsgMessageFlags::Read) ? 4 : 5;
        break;
    }

    return NS_OK;
}

nsresult nsMsgDBView::GetLongField(nsIMsgDBHdr *msgHdr, nsMsgViewSortTypeValue sortType, uint32_t *result, nsIMsgCustomColumnHandler* colHandler)
{
  nsresult rv;
  NS_ENSURE_ARG_POINTER(msgHdr);
  NS_ENSURE_ARG_POINTER(result);

  bool isRead;
  uint32_t bits;

  switch (sortType)
  {
    case nsMsgViewSortType::bySize:
      rv = (mShowSizeInLines) ? msgHdr->GetLineCount(result) : msgHdr->GetMessageSize(result);
      break;
    case nsMsgViewSortType::byPriority:
        nsMsgPriorityValue priority;
        rv = msgHdr->GetPriority(&priority);

        // treat "none" as "normal" when sorting.
        if (priority == nsMsgPriority::none)
            priority = nsMsgPriority::normal;

        // we want highest priority to have lowest value
        // so ascending sort will have highest priority first.
        *result = nsMsgPriority::highest - priority;
        break;
    case nsMsgViewSortType::byStatus:
        rv = GetStatusSortValue(msgHdr,result);
        break;
    case nsMsgViewSortType::byFlagged:
        bits = 0;
        rv = msgHdr->GetFlags(&bits);
        *result = !(bits & nsMsgMessageFlags::Marked);  //make flagged come out on top.
        break;
    case nsMsgViewSortType::byUnread:
        rv = msgHdr->GetIsRead(&isRead);
        if (NS_SUCCEEDED(rv))
            *result = !isRead;
        break;
    case nsMsgViewSortType::byJunkStatus:
      {
        nsCString junkScoreStr;
        rv = msgHdr->GetStringProperty("junkscore", getter_Copies(junkScoreStr));
        // unscored messages should come before messages that are scored
        // junkScoreStr is "", and "0" - "100"
        // normalize to 0 - 101
        *result = junkScoreStr.IsEmpty() ? (0) : atoi(junkScoreStr.get()) + 1;
      }
      break;
     case nsMsgViewSortType::byAttachments:
        bits = 0;
        rv = msgHdr->GetFlags(&bits);
        *result = !(bits & nsMsgMessageFlags::Attachment);
      break;
    case nsMsgViewSortType::byDate:
      // when sorting threads by date, we want the date of the newest msg
      // in the thread
      if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay
        && ! (m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
      {
        nsCOMPtr <nsIMsgThread> thread;
        rv = GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(thread));
        if (NS_SUCCEEDED(rv))
        {
          thread->GetNewestMsgDate(result);
          break;
        }
      }
      rv = msgHdr->GetDateInSeconds(result);
      break;
    case nsMsgViewSortType::byReceived:
      // when sorting threads by received date, we want the received date of the newest msg
      // in the thread
      if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay
        && ! (m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
      {
        nsCOMPtr <nsIMsgThread> thread;
        rv = GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(thread));
        NS_ENSURE_SUCCESS(rv, rv);
        thread->GetNewestMsgDate(result);
      }
      else
      {
        rv = msgHdr->GetUint32Property("dateReceived", result);  // Already in seconds...
        if (*result == 0)  // Use Date instead, we have no Received property
          rv = msgHdr->GetDateInSeconds(result);
      }
      break;
    case nsMsgViewSortType::byCustom:
      if (colHandler != nullptr)
      {
        colHandler->GetSortLongForRow(msgHdr, result);
        rv = NS_OK;
      }
      else
      {
        NS_ASSERTION(false, "should not be here (Sort Type: byCustom (Long), but no custom handler)");
        rv = NS_ERROR_UNEXPECTED;
      }
      break;
    case nsMsgViewSortType::byId:
        // handled by caller, since caller knows the key
    default:
        NS_ERROR("should not be here");
        rv = NS_ERROR_UNEXPECTED;
        break;
    }

    NS_ENSURE_SUCCESS(rv,rv);
    return NS_OK;
}

MsgViewSortColumnInfo::MsgViewSortColumnInfo(const MsgViewSortColumnInfo &other)
{
  mSortType = other.mSortType;
  mSortOrder = other.mSortOrder;
  mCustomColumnName = other.mCustomColumnName;
  mColHandler = other.mColHandler;
}

bool MsgViewSortColumnInfo::operator== (const MsgViewSortColumnInfo& other) const
{
  return (mSortType == nsMsgViewSortType::byCustom) ?
    mCustomColumnName.Equals(other.mCustomColumnName) : mSortType == other.mSortType;
}

nsresult nsMsgDBView::EncodeColumnSort(nsString &columnSortString)
{
  for (uint32_t i = 0; i < m_sortColumns.Length(); i++)
  {
    MsgViewSortColumnInfo &sortInfo = m_sortColumns[i];
    columnSortString.Append((char) sortInfo.mSortType);
    columnSortString.Append((char) sortInfo.mSortOrder + '0');
    if (sortInfo.mSortType == nsMsgViewSortType::byCustom)
    {
      columnSortString.Append(sortInfo.mCustomColumnName);
      columnSortString.Append((PRUnichar) '\r');
    }
  }
  return NS_OK;
}

nsresult nsMsgDBView::DecodeColumnSort(nsString &columnSortString)
{
  const PRUnichar *stringPtr = columnSortString.BeginReading();
  while (*stringPtr)
  {
    MsgViewSortColumnInfo sortColumnInfo;
    sortColumnInfo.mSortType = (nsMsgViewSortTypeValue) *stringPtr++;
    sortColumnInfo.mSortOrder = (nsMsgViewSortOrderValue) (*stringPtr++) - '0';
    if (sortColumnInfo.mSortType == nsMsgViewSortType::byCustom)
    {
      while (*stringPtr && *stringPtr != '\r')
        sortColumnInfo.mCustomColumnName.Append(*stringPtr++);
      sortColumnInfo.mColHandler = GetColumnHandler(sortColumnInfo.mCustomColumnName.get());
      if (*stringPtr) // advance past '\r'
        stringPtr++;
    }
    m_sortColumns.AppendElement(sortColumnInfo);
  }
  return NS_OK;
}

void nsMsgDBView::PushSort(const MsgViewSortColumnInfo &newSort)
{
  // no sense in keeping secondary sorts if primary sort is date or id
  if (newSort.mSortType == nsMsgViewSortType::byDate || newSort.mSortType == nsMsgViewSortType::byId)
    m_sortColumns.Clear();
  int32_t sortIndex = m_sortColumns.IndexOf(newSort, 0);
  if (sortIndex != kNotFound)
    m_sortColumns. RemoveElementAt(sortIndex);
  m_sortColumns.InsertElementAt(0, newSort);
  if (m_sortColumns.Length() > kMaxNumSortColumns)
    m_sortColumns.RemoveElementAt(kMaxNumSortColumns);
}

nsresult
nsMsgDBView::GetCollationKey(nsIMsgDBHdr *msgHdr, nsMsgViewSortTypeValue sortType, uint8_t **result, uint32_t *len, nsIMsgCustomColumnHandler* colHandler)
{
  nsresult rv = NS_ERROR_UNEXPECTED;
  NS_ENSURE_ARG_POINTER(msgHdr);
  NS_ENSURE_ARG_POINTER(result);

  switch (sortType)
  {
    case nsMsgViewSortType::bySubject:
        rv = msgHdr->GetSubjectCollationKey(len, result);
        break;
    case nsMsgViewSortType::byLocation:
        rv = GetLocationCollationKey(msgHdr, result, len);
        break;
    case nsMsgViewSortType::byRecipient:
      {
        nsString recipients;
        rv = FetchRecipients(msgHdr, recipients);
        if (NS_SUCCEEDED(rv))
        {
          nsCOMPtr <nsIMsgDatabase> dbToUse = m_db;
          if (!dbToUse) // probably search view
          {
            rv = GetDBForHeader(msgHdr, getter_AddRefs(dbToUse));
            NS_ENSURE_SUCCESS(rv,rv);
          }
          rv = dbToUse->CreateCollationKey(recipients, len, result);
        }
      }
      break;
    case nsMsgViewSortType::byAuthor:
      {
        rv = msgHdr->GetAuthorCollationKey(len, result);
        nsString author;
        rv = FetchAuthor(msgHdr, author);
        if (NS_SUCCEEDED(rv))
        {
          nsCOMPtr <nsIMsgDatabase> dbToUse = m_db;
          if (!dbToUse) // probably search view
          {
            rv = GetDBForHeader(msgHdr, getter_AddRefs(dbToUse));
            NS_ENSURE_SUCCESS(rv,rv);
          }
          rv = dbToUse->CreateCollationKey(author, len, result);
        }
      }
      break;
    case nsMsgViewSortType::byAccount:
    case nsMsgViewSortType::byTags:
      {
        nsString str;
        nsCOMPtr <nsIMsgDatabase> dbToUse = m_db;

        if (!dbToUse) // probably search view
          GetDBForViewIndex(0, getter_AddRefs(dbToUse));

        rv = (sortType == nsMsgViewSortType::byAccount)
            ? FetchAccount(msgHdr, str)
            : FetchTags(msgHdr, str);

        if (NS_SUCCEEDED(rv) && dbToUse)
          rv = dbToUse->CreateCollationKey(str, len, result);
      }
      break;
    case nsMsgViewSortType::byCustom:
      if (colHandler != nullptr)
      {
        nsAutoString strKey;
        rv = colHandler->GetSortStringForRow(msgHdr, strKey);
        NS_ASSERTION(NS_SUCCEEDED(rv),"failed to get sort string for custom row");
        nsAutoString strTemp(strKey);

        nsCOMPtr <nsIMsgDatabase> dbToUse = m_db;
        if (!dbToUse) // probably search view
        {
          rv = GetDBForHeader(msgHdr, getter_AddRefs(dbToUse));
          NS_ENSURE_SUCCESS(rv,rv);
        }
        rv = dbToUse->CreateCollationKey(strKey, len, result);
      }
      else
      {
        NS_ERROR("should not be here (Sort Type: byCustom (String), but no custom handler)");
        rv = NS_ERROR_UNEXPECTED;
      }
      break;
    default:
        rv = NS_ERROR_UNEXPECTED;
        break;
    }

    // bailing out with failure will stop the sort and leave us in
    // a bad state.  try to continue on, instead
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed to get the collation key");
    if (NS_FAILED(rv))
    {
        *result = nullptr;
        *len = 0;
    }
    return NS_OK;
}

// As the location collation key is created getting folder from the msgHdr,
// it is defined in this file and not from the db.
nsresult
nsMsgDBView::GetLocationCollationKey(nsIMsgDBHdr *msgHdr, uint8_t **result, uint32_t *len)
{
  nsCOMPtr <nsIMsgFolder> folder;

  nsresult rv = msgHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv,rv);
  nsCOMPtr <nsIMsgDatabase> dbToUse;
  rv = folder->GetMsgDatabase(getter_AddRefs(dbToUse));
  NS_ENSURE_SUCCESS(rv,rv);

  nsString locationString;
  rv = folder->GetPrettiestName(locationString);
  NS_ENSURE_SUCCESS(rv,rv);

  return dbToUse->CreateCollationKey(locationString, len, result);
}

nsresult nsMsgDBView::SaveSortInfo(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder)
{
  if (m_viewFolder)
  {
    nsCOMPtr <nsIDBFolderInfo> folderInfo;
    nsCOMPtr <nsIMsgDatabase> db;
    nsresult rv = m_viewFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(db));
    if (NS_SUCCEEDED(rv) && folderInfo)
    {
      // save off sort type and order, view type and flags
      folderInfo->SetSortType(sortType);
      folderInfo->SetSortOrder(sortOrder);

      nsString sortColumnsString;
      rv = EncodeColumnSort(sortColumnsString);
      NS_ENSURE_SUCCESS(rv, rv);
      folderInfo->SetProperty("sortColumns", sortColumnsString);
    }
  }
  return NS_OK;
}

int32_t  nsMsgDBView::SecondarySort(nsMsgKey key1, nsISupports *supports1, nsMsgKey key2, nsISupports *supports2, viewSortInfo *comparisonContext)
{

  // we need to make sure that in the case of the secondary sort field also matching,
  // we don't recurse
  if (comparisonContext->isSecondarySort)
    return key1 > key2;

  nsCOMPtr<nsIMsgFolder> folder1, folder2;
  nsCOMPtr <nsIMsgDBHdr> hdr1, hdr2;
  folder1 = do_QueryInterface(supports1);
  folder2 = do_QueryInterface(supports2);
  nsresult rv = folder1->GetMessageHeader(key1, getter_AddRefs(hdr1));
  NS_ENSURE_SUCCESS(rv, 0);
  rv = folder2->GetMessageHeader(key2, getter_AddRefs(hdr2));
  NS_ENSURE_SUCCESS(rv, 0);
  IdKeyPtr EntryInfo1, EntryInfo2;
  EntryInfo1.key = nullptr;
  EntryInfo2.key = nullptr;

  uint16_t  maxLen;
  eFieldType fieldType;
  nsMsgViewSortTypeValue sortType = comparisonContext->view->m_secondarySort;
  nsMsgViewSortOrderValue sortOrder = comparisonContext->view->m_secondarySortOrder;
  // The following may leave fieldType undefined.
  // In this case, we can return 0 right away since
  // it is the value returned in the default case of
  // switch (fieldType) statement below.
  rv = GetFieldTypeAndLenForSort(sortType, &maxLen, &fieldType);
  NS_ENSURE_SUCCESS(rv, 0);

  const void *pValue1 = &EntryInfo1, *pValue2 = &EntryInfo2;

  int (* comparisonFun) (const void *pItem1, const void *pItem2, void *privateData) = nullptr;
  int retStatus = 0;
  hdr1->GetMessageKey(&EntryInfo1.id);
  hdr2->GetMessageKey(&EntryInfo2.id);

  //check if a custom column handler exists. If it does then grab it and pass it in
  //to either GetCollationKey or GetLongField - we need the custom column handler for
  // the previous sort, if any.
  nsIMsgCustomColumnHandler* colHandler = nullptr; // GetCurColumnHandlerFromDBInfo();
  if (sortType == nsMsgViewSortType::byCustom &&
      comparisonContext->view->m_sortColumns.Length() > 1)
    colHandler = comparisonContext->view->m_sortColumns[1].mColHandler;


  switch (fieldType)
  {
    case kCollationKey:
      rv = GetCollationKey(hdr1, sortType, &EntryInfo1.key, &EntryInfo1.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
      comparisonFun = FnSortIdKeyPtr;
      break;
    case kU32:
      if (sortType == nsMsgViewSortType::byId)
        EntryInfo1.dword = EntryInfo1.id;
      else
        GetLongField(hdr1, sortType, &EntryInfo1.dword, colHandler);
      comparisonFun = FnSortIdUint32;
      break;
    default:
      return 0;
  }
  bool saveAscendingSort = comparisonContext->ascendingSort;
  comparisonContext->isSecondarySort = true;
  comparisonContext->ascendingSort = (sortOrder == nsMsgViewSortOrder::ascending);
  if (fieldType == kCollationKey)
  {
    PR_FREEIF(EntryInfo2.key);
    rv = GetCollationKey(hdr2, sortType, &EntryInfo2.key, &EntryInfo2.dword, colHandler);
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
  }
  else if (fieldType == kU32)
  {
    if (sortType == nsMsgViewSortType::byId)
      EntryInfo2.dword = EntryInfo2.id;
    else
      GetLongField(hdr2, sortType, &EntryInfo2.dword, colHandler);
  }
  retStatus = (*comparisonFun)(&pValue1, &pValue2, comparisonContext);

  comparisonContext->isSecondarySort = false;
  comparisonContext->ascendingSort = saveAscendingSort;

  return retStatus;
}


NS_IMETHODIMP nsMsgDBView::Sort(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder)
{
  nsresult rv;
  // if we're doing a stable sort, we can't just reverse the messages.
  // And the custom column we're sorting on might have changed, so to be
  // on the safe side, resort.
  if (m_sortType == sortType && m_sortValid && sortType != nsMsgViewSortType::byCustom
    && m_sortColumns.Length() < 2)
  {
    // same as it ever was.  do nothing
    if (m_sortOrder == sortOrder)
      return NS_OK;

    // for secondary sort, remember the sort order on a per column basis.
    if (m_sortColumns.Length())
      m_sortColumns[0].mSortOrder = sortOrder;
    SaveSortInfo(sortType, sortOrder);
    if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
      ReverseThreads();
    else
      ReverseSort();

    m_sortOrder = sortOrder;
    // we just reversed the sort order...we still need to invalidate the view
    return NS_OK;
  }

  if (sortType == nsMsgViewSortType::byThread)
    return NS_OK;

  if (m_sortType != sortType)
  {
    MsgViewSortColumnInfo sortColumnInfo;
    sortColumnInfo.mSortType = sortType;
    sortColumnInfo.mSortOrder = sortOrder;
    if (sortType == nsMsgViewSortType::byCustom)
    {
      GetCurCustomColumn(sortColumnInfo.mCustomColumnName);
      sortColumnInfo.mColHandler = GetCurColumnHandlerFromDBInfo();
    }

    PushSort(sortColumnInfo);
  }

  if (m_sortColumns.Length() > 1)
  {
    m_secondarySort = m_sortColumns[1].mSortType;
    m_secondarySortOrder = m_sortColumns[1].mSortOrder;
  }
  SaveSortInfo(sortType, sortOrder);
  // figure out how much memory we'll need, and the malloc it
  uint16_t maxLen;
  eFieldType fieldType;

  // If we did not obtain proper fieldType, it needs to be checked
  // because the subsequent code does not handle it very well.
  rv = GetFieldTypeAndLenForSort(sortType, &maxLen, &fieldType);
  NS_ENSURE_SUCCESS(rv,rv);

  nsVoidArray ptrs;
  uint32_t arraySize = GetSize();

  if (!arraySize)
    return NS_OK;

  nsCOMArray<nsIMsgFolder> *folders = GetFolders();

  IdKey** pPtrBase = (IdKey**)PR_Malloc(arraySize * sizeof(IdKey*));
  NS_ASSERTION(pPtrBase, "out of memory, can't sort");
  if (!pPtrBase) return NS_ERROR_OUT_OF_MEMORY;
  ptrs.AppendElement((void *)pPtrBase); // remember this pointer so we can free it later

  // build up the beast, so we can sort it.
  uint32_t numSoFar = 0;
  const uint32_t keyOffset = offsetof(IdKey, key);
  // calc max possible size needed for all the rest
  uint32_t maxSize = (keyOffset + maxLen) * (arraySize - numSoFar);

  const uint32_t maxBlockSize = (uint32_t) 0xf000L;
  uint32_t allocSize = std::min(maxBlockSize, maxSize);
  char *pTemp = (char *) PR_Malloc(allocSize);
  NS_ASSERTION(pTemp, "out of memory, can't sort");
  if (!pTemp)
  {
    FreeAll(&ptrs);
    return NS_ERROR_OUT_OF_MEMORY;
  }

  ptrs.AppendElement(pTemp); // remember this pointer so we can free it later

  char *pBase = pTemp;
  bool more = true;

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  uint8_t *keyValue = nullptr;
  uint32_t longValue;
  while (more && numSoFar < arraySize)
  {
    nsMsgKey thisKey = m_keys[numSoFar];
    if (sortType != nsMsgViewSortType::byId)
    {
      rv = GetMsgHdrForViewIndex(numSoFar, getter_AddRefs(msgHdr));
      NS_ASSERTION(NS_SUCCEEDED(rv) && msgHdr, "header not found");
      if (NS_FAILED(rv) || !msgHdr)
      {
        FreeAll(&ptrs);
        return NS_ERROR_UNEXPECTED;
      }
    }
    else
    {
      msgHdr = nullptr;
    }

    //check if a custom column handler exists. If it does then grab it and pass it in
    //to either GetCollationKey or GetLongField
    nsIMsgCustomColumnHandler* colHandler = GetCurColumnHandlerFromDBInfo();

    // could be a problem here if the ones that appear here are different than the ones already in the array
    uint32_t actualFieldLen = 0;

    if (fieldType == kCollationKey)
    {
      rv = GetCollationKey(msgHdr, sortType, &keyValue, &actualFieldLen, colHandler);
      NS_ENSURE_SUCCESS(rv,rv);

      longValue = actualFieldLen;
    }
    else
    {
      if (sortType == nsMsgViewSortType::byId)
      {
        longValue = thisKey;
      }
      else
      {
        rv = GetLongField(msgHdr, sortType, &longValue, colHandler);
        NS_ENSURE_SUCCESS(rv,rv);
      }
    }

    // check to see if this entry fits into the block we have allocated so far
    // pTemp - pBase = the space we have used so far
    // sizeof(EntryInfo) + fieldLen = space we need for this entry
    // allocSize = size of the current block
    if ((uint32_t)(pTemp - pBase) + (keyOffset + actualFieldLen) >= allocSize)
    {
      maxSize = (keyOffset + maxLen) * (arraySize - numSoFar);
      allocSize = std::min(maxBlockSize, maxSize);
      // make sure allocSize is big enough for the current value
      allocSize = std::max(allocSize, keyOffset + actualFieldLen);
      pTemp = (char *) PR_Malloc(allocSize);
      NS_ASSERTION(pTemp, "out of memory, can't sort");
      if (!pTemp)
      {
        FreeAll(&ptrs);
        return NS_ERROR_OUT_OF_MEMORY;
      }
      pBase = pTemp;
      ptrs.AppendElement(pTemp); // remember this pointer so we can free it later
    }

    // now store this entry away in the allocated memory
    IdKey *info = (IdKey*)pTemp;
    pPtrBase[numSoFar] = info;
    info->id = thisKey;
    info->bits = m_flags[numSoFar];
    info->dword = longValue;
    //info->pad = 0;
    info->folder = folders ? folders->ObjectAt(numSoFar) : m_folder.get();

    memcpy(info->key, keyValue, actualFieldLen);
    //In order to align memory for systems that require it, such as HP-UX
    //calculate the correct value to pad the actualFieldLen value
    const uint32_t align = sizeof(IdKey) - sizeof(IdUint32) - 1;
    actualFieldLen = (actualFieldLen + align) & ~align;

    pTemp += keyOffset + actualFieldLen;
    ++numSoFar;
    PR_Free(keyValue);
  }

  viewSortInfo qsPrivateData;
  qsPrivateData.view = this;
  qsPrivateData.isSecondarySort = false;
  qsPrivateData.ascendingSort = (sortOrder == nsMsgViewSortOrder::ascending);

  nsCOMPtr <nsIMsgDatabase> dbToUse = m_db;

  if (!dbToUse) // probably search view
    GetDBForViewIndex(0, getter_AddRefs(dbToUse));
  qsPrivateData.db = dbToUse;
  if (dbToUse)
  {
    // do the sort
    switch (fieldType)
    {
      case kCollationKey:
        NS_QuickSort(pPtrBase, numSoFar, sizeof(IdKey*), FnSortIdKey, &qsPrivateData);
        break;
      case kU32:
        NS_QuickSort(pPtrBase, numSoFar, sizeof(IdKey*), FnSortIdUint32, &qsPrivateData);
        break;
      default:
        NS_ERROR("not supposed to get here");
        break;
    }
  }

  // now put the IDs into the array in proper order
  for (uint32_t i = 0; i < numSoFar; i++)
  {
    m_keys[i] = pPtrBase[i]->id;
    m_flags[i] = pPtrBase[i]->bits;

    if (folders)
      folders->ReplaceObjectAt(pPtrBase[i]->folder, i);
  }

  m_sortType = sortType;
  m_sortOrder = sortOrder;

  // free all the memory we allocated
  FreeAll(&ptrs);

  m_sortValid = true;
  //m_db->SetSortInfo(sortType, sortOrder);

  return NS_OK;
}

void nsMsgDBView::FreeAll(nsVoidArray *ptrs)
{
  int32_t i;
  int32_t count = (int32_t) ptrs->Count();
  if (count == 0)
    return;

  for (i=(count - 1);i>=0;i--)
    PR_Free((void *) ptrs->ElementAt(i));
  ptrs->Clear();
}

nsMsgViewIndex nsMsgDBView::GetIndexOfFirstDisplayedKeyInThread(
    nsIMsgThread *threadHdr, bool allowDummy)
{
  nsMsgViewIndex  retIndex = nsMsgViewIndex_None;
  uint32_t        childIndex = 0;
  // We could speed up the unreadOnly view by starting our search with the first
  // unread message in the thread. Sometimes, that will be wrong, however, so
  // let's skip it until we're sure it's necessary.
  //  (m_viewFlags & nsMsgViewFlagsType::kUnreadOnly)
  //    ? threadHdr->GetFirstUnreadKey(m_db) : threadHdr->GetChildAt(0);
  uint32_t numThreadChildren;
  threadHdr->GetNumChildren(&numThreadChildren);
  while (retIndex == nsMsgViewIndex_None && childIndex < numThreadChildren)
  {
    nsCOMPtr<nsIMsgDBHdr> childHdr;
    threadHdr->GetChildHdrAt(childIndex++, getter_AddRefs(childHdr));
    if (childHdr)
      retIndex = FindHdr(childHdr, 0, allowDummy);
  }
  return retIndex;
}

nsresult nsMsgDBView::GetFirstMessageHdrToDisplayInThread(nsIMsgThread *threadHdr, nsIMsgDBHdr **result)
{
  nsresult rv;

  if (m_viewFlags & nsMsgViewFlagsType::kUnreadOnly)
    rv = threadHdr->GetFirstUnreadChild(result);
  else
    rv = threadHdr->GetChildHdrAt(0, result);
  return rv;
}

// Find the view index of the thread containing the passed msgKey, if
// the thread is in the view. MsgIndex is passed in as a shortcut if
// it turns out the msgKey is the first message in the thread,
// then we can avoid looking for the msgKey.
nsMsgViewIndex nsMsgDBView::ThreadIndexOfMsg(nsMsgKey msgKey,
                                            nsMsgViewIndex msgIndex /* = nsMsgViewIndex_None */,
                                            int32_t *pThreadCount /* = NULL */,
                                            uint32_t *pFlags /* = NULL */)
{
  if (! (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
    return nsMsgViewIndex_None;
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsresult rv = m_db->GetMsgHdrForKey(msgKey, getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, nsMsgViewIndex_None);
  return ThreadIndexOfMsgHdr(msgHdr, msgIndex, pThreadCount, pFlags);
}

nsMsgViewIndex nsMsgDBView::GetThreadIndex(nsMsgViewIndex msgIndex)
{
  if (!IsValidIndex(msgIndex))
    return nsMsgViewIndex_None;

  // scan up looking for level 0 message.
  while (m_levels[msgIndex] && msgIndex)
    --msgIndex;
  return msgIndex;
}

nsMsgViewIndex
nsMsgDBView::ThreadIndexOfMsgHdr(nsIMsgDBHdr *msgHdr,
                                 nsMsgViewIndex msgIndex,
                                 int32_t *pThreadCount,
                                 uint32_t *pFlags)
{
  nsCOMPtr<nsIMsgThread> threadHdr;
  nsresult rv = GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(threadHdr));
  NS_ENSURE_SUCCESS(rv, nsMsgViewIndex_None);

  nsMsgViewIndex retIndex = nsMsgViewIndex_None;

  if (threadHdr != nullptr)
  {
    if (msgIndex == nsMsgViewIndex_None)
      msgIndex = FindHdr(msgHdr, 0, true);

    if (msgIndex == nsMsgViewIndex_None)  // hdr is not in view, need to find by thread
    {
      msgIndex = GetIndexOfFirstDisplayedKeyInThread(threadHdr, true);
      //nsMsgKey    threadKey = (msgIndex == nsMsgViewIndex_None) ? nsMsgKey_None : GetAt(msgIndex);
      if (pFlags)
        threadHdr->GetFlags(pFlags);
    }
    nsMsgViewIndex startOfThread = msgIndex;
    while ((int32_t) startOfThread >= 0 && m_levels[startOfThread] != 0)
      startOfThread--;
    retIndex = startOfThread;
    if (pThreadCount)
    {
      int32_t numChildren = 0;
      nsMsgViewIndex threadIndex = startOfThread;
      do
      {
        threadIndex++;
        numChildren++;
      }
      while (threadIndex < m_levels.Length() && m_levels[threadIndex] != 0);
      *pThreadCount = numChildren;
    }
  }
  return retIndex;
}

nsMsgKey nsMsgDBView::GetKeyOfFirstMsgInThread(nsMsgKey key)
{
  // Just report no key for any failure. This can occur when a
  // message is deleted from a threaded view
  nsCOMPtr <nsIMsgThread> pThread;
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsresult rv = m_db->GetMsgHdrForKey(key, getter_AddRefs(msgHdr));
  if (NS_FAILED(rv))
    return nsMsgKey_None;
  rv = GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(pThread));
  if (NS_FAILED(rv))
    return nsMsgKey_None;
  nsMsgKey  firstKeyInThread = nsMsgKey_None;

  if (!pThread)
    return firstKeyInThread;

  // ### dmb UnreadOnly - this is wrong. But didn't seem to matter in 4.x
  pThread->GetChildKeyAt(0, &firstKeyInThread);
  return firstKeyInThread;
}

NS_IMETHODIMP nsMsgDBView::GetKeyAt(nsMsgViewIndex index, nsMsgKey *result)
{
  NS_ENSURE_ARG(result);
  *result = GetAt(index);
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetFlagsAt(nsMsgViewIndex aIndex, uint32_t *aResult)
{
  NS_ENSURE_ARG(aResult);
  if (!IsValidIndex(aIndex))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  *aResult = m_flags[aIndex];
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetMsgHdrAt(nsMsgViewIndex aIndex, nsIMsgDBHdr **aResult)
{
  NS_ENSURE_ARG(aResult);
  if (!IsValidIndex(aIndex))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  return GetMsgHdrForViewIndex(aIndex, aResult);
}

nsMsgViewIndex nsMsgDBView::FindHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startIndex,
                                    bool allowDummy)
{
  nsMsgKey msgKey;
  msgHdr->GetMessageKey(&msgKey);
  nsMsgViewIndex viewIndex = m_keys.IndexOf(msgKey, startIndex);
  if (viewIndex == nsMsgViewIndex_None)
    return viewIndex;
  // if we're supposed to allow dummies, and the previous index is a dummy that
  //  is not elided, then it must be the dummy corresponding to our node and
  //  we should return that instead.
  if (allowDummy && viewIndex
      && (m_flags[viewIndex-1] & MSG_VIEW_FLAG_DUMMY)
      && !(m_flags[viewIndex-1] & nsMsgMessageFlags::Elided))
    viewIndex--;
  // else if we're not allowing dummies, and we found a dummy, look again
  // one past the dummy.
  else if (!allowDummy && m_flags[viewIndex] & MSG_VIEW_FLAG_DUMMY)
    return m_keys.IndexOf(msgKey, viewIndex + 1);
  return viewIndex;
}

nsMsgViewIndex nsMsgDBView::FindKey(nsMsgKey key, bool expand)
{
  nsMsgViewIndex retIndex = nsMsgViewIndex_None;
  retIndex = (nsMsgViewIndex) (m_keys.IndexOf(key));
  // for dummy headers, try to expand if the caller says so. And if the thread is
  // expanded, ignore the dummy header and return the real header index.
  if (retIndex != nsMsgViewIndex_None && m_flags[retIndex] & MSG_VIEW_FLAG_DUMMY &&  !(m_flags[retIndex] & nsMsgMessageFlags::Elided))
    return (nsMsgViewIndex) m_keys.IndexOf(key, retIndex + 1);
  if (key != nsMsgKey_None && (retIndex == nsMsgViewIndex_None || m_flags[retIndex] & MSG_VIEW_FLAG_DUMMY)
    && expand && m_db)
  {
    nsMsgKey threadKey = GetKeyOfFirstMsgInThread(key);
    if (threadKey != nsMsgKey_None)
    {
      nsMsgViewIndex threadIndex = FindKey(threadKey, false);
      if (threadIndex != nsMsgViewIndex_None)
      {
        uint32_t flags = m_flags[threadIndex];
        if (((flags & nsMsgMessageFlags::Elided) &&
             NS_SUCCEEDED(ExpandByIndex(threadIndex, nullptr)))
            || (flags & MSG_VIEW_FLAG_DUMMY))
          retIndex = (nsMsgViewIndex) m_keys.IndexOf(key, threadIndex + 1);
      }
    }
  }
  return retIndex;
}

nsresult nsMsgDBView::GetThreadCount(nsMsgViewIndex index, uint32_t *pThreadCount)
{
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsresult rv = GetMsgHdrForViewIndex(index, getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsIMsgThread> pThread;
  rv = GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(pThread));
  if (NS_SUCCEEDED(rv) && pThread != nullptr)
    rv = pThread->GetNumChildren(pThreadCount);
  return rv;
}

// This counts the number of messages in an expanded thread, given the
// index of the first message in the thread.
int32_t nsMsgDBView::CountExpandedThread(nsMsgViewIndex index)
{
  int32_t numInThread = 0;
  nsMsgViewIndex startOfThread = index;
  while ((int32_t) startOfThread >= 0 && m_levels[startOfThread] != 0)
    startOfThread--;
  nsMsgViewIndex threadIndex = startOfThread;
  do
  {
    threadIndex++;
    numInThread++;
  }
  while (threadIndex < m_levels.Length() && m_levels[threadIndex] != 0);

  return numInThread;
}

// returns the number of lines that would be added (> 0) or removed (< 0)
// if we were to try to expand/collapse the passed index.
nsresult nsMsgDBView::ExpansionDelta(nsMsgViewIndex index, int32_t *expansionDelta)
{
  uint32_t numChildren;
  nsresult  rv;

  *expansionDelta = 0;
  if (index >= ((nsMsgViewIndex) m_keys.Length()))
    return NS_MSG_MESSAGE_NOT_FOUND;
  char  flags = m_flags[index];

  if (!(m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
    return NS_OK;

  // The client can pass in the key of any message
  // in a thread and get the expansion delta for the thread.

  if (flags & nsMsgMessageFlags::Elided)
  {
    rv = GetThreadCount(index, &numChildren);
    NS_ENSURE_SUCCESS(rv, rv);
    *expansionDelta = numChildren - 1;
  }
  else
  {
    numChildren = CountExpandedThread(index);
    *expansionDelta = - (int32_t) (numChildren - 1);
  }

  return NS_OK;
}

nsresult nsMsgDBView::ToggleExpansion(nsMsgViewIndex index, uint32_t *numChanged)
{
  nsresult rv;
  NS_ENSURE_ARG(numChanged);
  *numChanged = 0;
  nsMsgViewIndex threadIndex = GetThreadIndex(index);
  if (threadIndex == nsMsgViewIndex_None)
  {
    NS_ASSERTION(false, "couldn't find thread");
    return NS_MSG_MESSAGE_NOT_FOUND;
  }
  int32_t  flags = m_flags[threadIndex];

  // if not a thread, or doesn't have children, no expand/collapse
  // If we add sub-thread expand collapse, this will need to be relaxed
  if (!(flags & MSG_VIEW_FLAG_ISTHREAD) || !(flags & MSG_VIEW_FLAG_HASCHILDREN))
    return NS_MSG_MESSAGE_NOT_FOUND;
  if (flags & nsMsgMessageFlags::Elided)
    rv = ExpandByIndex(threadIndex, numChanged);
  else
    rv = CollapseByIndex(threadIndex, numChanged);

  // if we collaps/uncollapse a thread, this changes the selected URIs
  SelectionChanged();
  return rv;
}

nsresult nsMsgDBView::ExpandAndSelectThread()
{
    nsresult rv;

    NS_ASSERTION(mTreeSelection, "no tree selection");
    if (!mTreeSelection) return NS_ERROR_UNEXPECTED;

    int32_t index;
    rv = mTreeSelection->GetCurrentIndex(&index);
    NS_ENSURE_SUCCESS(rv,rv);

    rv = ExpandAndSelectThreadByIndex(index, false);
    NS_ENSURE_SUCCESS(rv,rv);
    return NS_OK;
}

nsresult nsMsgDBView::ExpandAndSelectThreadByIndex(nsMsgViewIndex index, bool augment)
{
  nsresult rv;

  nsMsgViewIndex threadIndex;
  bool inThreadedMode = (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay);

  if (inThreadedMode)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    GetMsgHdrForViewIndex(index, getter_AddRefs(msgHdr));
    threadIndex = ThreadIndexOfMsgHdr(msgHdr, index);
    if (threadIndex == nsMsgViewIndex_None)
    {
      NS_ASSERTION(false, "couldn't find thread");
      return NS_MSG_MESSAGE_NOT_FOUND;
    }
  }
  else
  {
    threadIndex = index;
  }

  int32_t flags = m_flags[threadIndex];
  int32_t count = 0;

  if (inThreadedMode && (flags & MSG_VIEW_FLAG_ISTHREAD) && (flags & MSG_VIEW_FLAG_HASCHILDREN))
  {
    // if closed, expand this thread.
    if (flags & nsMsgMessageFlags::Elided)
    {
      uint32_t numExpanded;
      rv = ExpandByIndex(threadIndex, &numExpanded);
      NS_ENSURE_SUCCESS(rv,rv);
    }

    // get the number of messages in the expanded thread
    // so we know how many to select
    count = CountExpandedThread(threadIndex);
  }
  else
  {
    count = 1;
  }
  NS_ASSERTION(count > 0, "bad count");

  // update the selection

  NS_ASSERTION(mTreeSelection, "no tree selection");
  if (!mTreeSelection) return NS_ERROR_UNEXPECTED;

  // the count should be 1 or greater. if there was only one message in the thread, we just select it.
  // if more, we select all of them.
  mTreeSelection->RangedSelect(threadIndex + count - 1, threadIndex, augment);
  return NS_OK;
}

nsresult nsMsgDBView::ExpandAll()
{
  if (mTree)
    mTree->BeginUpdateBatch();
  for (int32_t i = GetSize() - 1; i >= 0; i--)
  {
    uint32_t numExpanded;
    uint32_t flags = m_flags[i];
    if (flags & nsMsgMessageFlags::Elided)
      ExpandByIndex(i, &numExpanded);
  }
  if (mTree)
    mTree->EndUpdateBatch();
  SelectionChanged();
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread)
{
  return m_db->GetThreadContainingMsgHdr(msgHdr, pThread);
}

nsresult nsMsgDBView::ExpandByIndex(nsMsgViewIndex index, uint32_t *pNumExpanded)
{
  if ((uint32_t) index >= m_keys.Length())
    return NS_MSG_MESSAGE_NOT_FOUND;

  uint32_t      flags = m_flags[index];
  uint32_t      numExpanded = 0;

  NS_ASSERTION(flags & nsMsgMessageFlags::Elided, "can't expand an already expanded thread");
  flags &= ~nsMsgMessageFlags::Elided;

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsCOMPtr <nsIMsgThread> pThread;
  nsresult rv = GetThreadContainingIndex(index, getter_AddRefs(pThread));
  NS_ENSURE_SUCCESS(rv, rv);
  if (m_viewFlags & nsMsgViewFlagsType::kUnreadOnly)
  {
    if (flags & nsMsgMessageFlags::Read)
      m_levels.AppendElement(0);  // keep top level hdr in thread, even though read.
    rv = ListUnreadIdsInThread(pThread,  index, &numExpanded);
  }
  else
    rv = ListIdsInThread(pThread,  index, &numExpanded);

  if (numExpanded > 0)
  {
    m_flags[index] = flags;
    NoteChange(index, 1, nsMsgViewNotificationCode::changed);
  }
  NoteStartChange(index + 1, numExpanded, nsMsgViewNotificationCode::insertOrDelete);
  NoteEndChange(index + 1, numExpanded, nsMsgViewNotificationCode::insertOrDelete);
  if (pNumExpanded != nullptr)
    *pNumExpanded = numExpanded;
  return rv;
}

nsresult nsMsgDBView::CollapseAll()
{
  for (uint32_t i = 0; i < GetSize(); i++)
  {
    uint32_t numExpanded;
    uint32_t flags = m_flags[i];
    if (!(flags & nsMsgMessageFlags::Elided) && (flags & MSG_VIEW_FLAG_HASCHILDREN))
      CollapseByIndex(i, &numExpanded);
  }
  SelectionChanged();
  return NS_OK;
}

nsresult nsMsgDBView::CollapseByIndex(nsMsgViewIndex index, uint32_t *pNumCollapsed)
{
  nsresult  rv;
  int32_t  flags = m_flags[index];
  int32_t  rowDelta = 0;

  if (flags & nsMsgMessageFlags::Elided || !(m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay) || !(flags & MSG_VIEW_FLAG_HASCHILDREN))
    return NS_OK;

  if (index > m_keys.Length())
    return NS_MSG_MESSAGE_NOT_FOUND;

  rv = ExpansionDelta(index, &rowDelta);
  NS_ENSURE_SUCCESS(rv, rv);

  flags |= nsMsgMessageFlags::Elided;

  m_flags[index] = flags;
  NoteChange(index, 1, nsMsgViewNotificationCode::changed);

  int32_t numRemoved = -rowDelta; // don't count first header in thread
  if (index + 1 + numRemoved > m_keys.Length())
  {
    NS_ERROR("trying to remove too many rows");
    numRemoved -= (index + 1 + numRemoved) - m_keys.Length();
    if (numRemoved <= 0)
      return NS_MSG_MESSAGE_NOT_FOUND;
  }
  NoteStartChange(index + 1, rowDelta, nsMsgViewNotificationCode::insertOrDelete);
  // start at first id after thread.
  RemoveRows(index + 1, numRemoved);
  if (pNumCollapsed != nullptr)
    *pNumCollapsed = numRemoved;
  NoteEndChange(index + 1, rowDelta, nsMsgViewNotificationCode::insertOrDelete);

  return rv;
}

nsresult nsMsgDBView::OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, bool /*ensureListed*/)
{
    nsresult rv = NS_OK;
    // views can override this behaviour, which is to append to view.
    // This is the mail behaviour, but threaded views will want
    // to insert in order...
    if (newHdr)
  rv = AddHdr(newHdr);
    return rv;
}

NS_IMETHODIMP nsMsgDBView::GetThreadContainingIndex(nsMsgViewIndex index, nsIMsgThread **resultThread)
{
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsresult rv = GetMsgHdrForViewIndex(index, getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, rv);
  return GetThreadContainingMsgHdr(msgHdr, resultThread);
}

nsMsgViewIndex
nsMsgDBView::GetIndexForThread(nsIMsgDBHdr *msgHdr)
{
  // Take advantage of the fact that we're already sorted
  // and find the insert index via a binary search, though expanded threads
  // make that tricky.

  nsMsgViewIndex highIndex = m_keys.Length();
  nsMsgViewIndex lowIndex = 0;
  IdKeyPtr EntryInfo1, EntryInfo2;
  EntryInfo1.key = nullptr;
  EntryInfo2.key = nullptr;

  nsresult rv;
  uint16_t  maxLen;
  eFieldType fieldType;
  // The following may leave fieldType undefined.
  // In this case, we can return highIndex right away since
  // it is the value returned in the default case of
  // switch (fieldType) statement below.
  rv = GetFieldTypeAndLenForSort(m_sortType, &maxLen, &fieldType);
  NS_ENSURE_SUCCESS(rv, highIndex);

  const void *pValue1 = &EntryInfo1, *pValue2 = &EntryInfo2;

  int retStatus = 0;
  msgHdr->GetMessageKey(&EntryInfo1.id);
  msgHdr->GetFolder(&EntryInfo1.folder);
  EntryInfo1.folder->Release();
  //check if a custom column handler exists. If it does then grab it and pass it in
  //to either GetCollationKey or GetLongField
  nsIMsgCustomColumnHandler* colHandler = GetCurColumnHandlerFromDBInfo();

  viewSortInfo comparisonContext;
  comparisonContext.view = this;
  comparisonContext.isSecondarySort = false;
  comparisonContext.ascendingSort = (m_sortOrder == nsMsgViewSortOrder::ascending);
  nsCOMPtr <nsIMsgDatabase> hdrDB;
  EntryInfo1.folder->GetMsgDatabase(getter_AddRefs(hdrDB));
  comparisonContext.db = hdrDB.get();
  switch (fieldType)
  {
    case kCollationKey:
      rv = GetCollationKey(msgHdr, m_sortType, &EntryInfo1.key, &EntryInfo1.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
      break;
    case kU32:
      if (m_sortType == nsMsgViewSortType::byId)
        EntryInfo1.dword = EntryInfo1.id;
      else
        GetLongField(msgHdr, m_sortType, &EntryInfo1.dword, colHandler);
      break;
    default:
      return highIndex;
  }
  while (highIndex > lowIndex)
  {
    nsMsgViewIndex tryIndex = (lowIndex + highIndex) / 2;
    // need to adjust tryIndex if it's not a thread.
    while (m_levels[tryIndex] && tryIndex)
      tryIndex--;

    if (tryIndex < lowIndex)
    {
      NS_ERROR("try index shouldn't be less than low index");
      break;
    }
    EntryInfo2.id = m_keys[tryIndex];
    GetFolderForViewIndex(tryIndex, &EntryInfo2.folder);
    EntryInfo2.folder->Release();

    nsCOMPtr <nsIMsgDBHdr> tryHdr;
    nsCOMPtr <nsIMsgDatabase> db;
    // ### this should get the db from the folder...
    GetDBForViewIndex(tryIndex, getter_AddRefs(db));
    if (db)
      rv = db->GetMsgHdrForKey(EntryInfo2.id, getter_AddRefs(tryHdr));
    if (!tryHdr)
      break;
    if (tryHdr == msgHdr)
    {
      NS_WARNING("didn't expect header to already be in view");
      highIndex = tryIndex;
      break;
    }
    if (fieldType == kCollationKey)
    {
      PR_FREEIF(EntryInfo2.key);
      rv = GetCollationKey(tryHdr, m_sortType, &EntryInfo2.key, &EntryInfo2.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
      retStatus = FnSortIdKeyPtr(&pValue1, &pValue2, &comparisonContext);
    }
    else if (fieldType == kU32)
    {
      if (m_sortType == nsMsgViewSortType::byId)
        EntryInfo2.dword = EntryInfo2.id;
      else
        GetLongField(tryHdr, m_sortType, &EntryInfo2.dword, colHandler);
      retStatus = FnSortIdUint32(&pValue1, &pValue2, &comparisonContext);
    }
    if (retStatus == 0)
    {
      highIndex = tryIndex;
      break;
    }

    if (retStatus < 0)
    {
      highIndex = tryIndex;
      // we already made sure tryIndex was at a thread at the top of the loop.
    }
    else
    {
      lowIndex = tryIndex + 1;
      while (lowIndex < GetSize() && m_levels[lowIndex])
        lowIndex++;
    }
  }

  PR_Free(EntryInfo1.key);
  PR_Free(EntryInfo2.key);
  return highIndex;
}

nsMsgViewIndex nsMsgDBView::GetInsertIndexHelper(nsIMsgDBHdr *msgHdr, nsTArray<nsMsgKey> &keys,
                                                 nsCOMArray<nsIMsgFolder> *folders,
                                                 nsMsgViewSortOrderValue sortOrder, nsMsgViewSortTypeValue sortType)
{
  nsMsgViewIndex highIndex = keys.Length();
  nsMsgViewIndex lowIndex = 0;
  IdKeyPtr EntryInfo1, EntryInfo2;
  EntryInfo1.key = nullptr;
  EntryInfo2.key = nullptr;

  nsresult rv;
  uint16_t  maxLen;
  eFieldType fieldType;
  // The following may leave fieldType undefined.
  // In this case, we can return highIndex right away since
  // it is the value returned in the default case of
  // switch (fieldType) statement below.
  rv = GetFieldTypeAndLenForSort(sortType, &maxLen, &fieldType);
  NS_ENSURE_SUCCESS(rv, highIndex);

  const void *pValue1 = &EntryInfo1, *pValue2 = &EntryInfo2;

  int (* comparisonFun) (const void *pItem1, const void *pItem2, void *privateData) = nullptr;
  int retStatus = 0;
  msgHdr->GetMessageKey(&EntryInfo1.id);
  msgHdr->GetFolder(&EntryInfo1.folder);
  EntryInfo1.folder->Release();
  //check if a custom column handler exists. If it does then grab it and pass it in
  //to either GetCollationKey or GetLongField
  nsIMsgCustomColumnHandler* colHandler = GetCurColumnHandlerFromDBInfo();

  viewSortInfo comparisonContext;
  comparisonContext.view = this;
  comparisonContext.isSecondarySort = false;
  comparisonContext.ascendingSort = (sortOrder == nsMsgViewSortOrder::ascending);
  rv = EntryInfo1.folder->GetMsgDatabase(&comparisonContext.db);
  NS_ENSURE_SUCCESS(rv, highIndex);
  comparisonContext.db->Release();
  switch (fieldType)
  {
    case kCollationKey:
      rv = GetCollationKey(msgHdr, sortType, &EntryInfo1.key, &EntryInfo1.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
      comparisonFun = FnSortIdKeyPtr;
      break;
    case kU32:
      if (sortType == nsMsgViewSortType::byId)
        EntryInfo1.dword = EntryInfo1.id;
      else
        GetLongField(msgHdr, sortType, &EntryInfo1.dword, colHandler);
      comparisonFun = FnSortIdUint32;
      break;
    default:
      return highIndex;
  }
  while (highIndex > lowIndex)
  {
    nsMsgViewIndex tryIndex = (lowIndex + highIndex - 1) / 2;
    EntryInfo2.id = keys[tryIndex];
    EntryInfo2.folder = folders ? folders->ObjectAt(tryIndex) : m_folder.get();

    nsCOMPtr <nsIMsgDBHdr> tryHdr;
    EntryInfo2.folder->GetMessageHeader(EntryInfo2.id, getter_AddRefs(tryHdr));
    if (!tryHdr)
      break;
    if (fieldType == kCollationKey)
    {
      PR_FREEIF(EntryInfo2.key);
      rv = GetCollationKey(tryHdr, sortType, &EntryInfo2.key, &EntryInfo2.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
    }
    else if (fieldType == kU32)
    {
      if (sortType == nsMsgViewSortType::byId) {
        EntryInfo2.dword = EntryInfo2.id;
      }
      else {
        GetLongField(tryHdr, sortType, &EntryInfo2.dword, colHandler);
      }
    }
    retStatus = (*comparisonFun)(&pValue1, &pValue2, &comparisonContext);
    if (retStatus == 0)
    {
      highIndex = tryIndex;
      break;
    }

    if (retStatus < 0)
    {
      highIndex = tryIndex;
    }
    else
    {
      lowIndex = tryIndex + 1;
    }
  }

  PR_Free(EntryInfo1.key);
  PR_Free(EntryInfo2.key);
  return highIndex;
}

nsMsgViewIndex nsMsgDBView::GetInsertIndex(nsIMsgDBHdr *msgHdr)
{
  if (!GetSize())
    return 0;

  if ((m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay) != 0
        && !(m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
        && m_sortOrder != nsMsgViewSortType::byId)
    return GetIndexForThread(msgHdr);

  return GetInsertIndexHelper(msgHdr, m_keys, GetFolders(), m_sortOrder, m_sortType);
}

nsresult  nsMsgDBView::AddHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex *resultIndex)
{
  uint32_t  flags = 0;
#ifdef DEBUG_bienvenu
  NS_ASSERTION(m_keys.Length() == m_flags.Length() && (int) m_keys.Length() == m_levels.Length(), "view arrays out of sync!");
#endif

  if (resultIndex)
    *resultIndex = nsMsgViewIndex_None;

  if (!GetShowingIgnored())
  {
    nsCOMPtr <nsIMsgThread> thread;
    GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(thread));
    if (thread)
    {
      thread->GetFlags(&flags);
      if (flags & nsMsgMessageFlags::Ignored)
        return NS_OK;
    }

    bool ignored;
    msgHdr->GetIsKilled(&ignored);
    if (ignored)
       return NS_OK;
  }

  nsMsgKey msgKey, threadId;
  nsMsgKey threadParent;
  msgHdr->GetMessageKey(&msgKey);
  msgHdr->GetThreadId(&threadId);
  msgHdr->GetThreadParent(&threadParent);

  msgHdr->GetFlags(&flags);
  // ### this isn't quite right, is it? Should be checking that our thread parent key is none?
  if (threadParent == nsMsgKey_None)
    flags |= MSG_VIEW_FLAG_ISTHREAD;
  nsMsgViewIndex insertIndex = GetInsertIndex(msgHdr);
  if (insertIndex == nsMsgViewIndex_None)
  {
    // if unreadonly, level is 0 because we must be the only msg in the thread.
    int32_t levelToAdd = 0;

    if (m_sortOrder == nsMsgViewSortOrder::ascending)
    {
      InsertMsgHdrAt(GetSize(), msgHdr, msgKey, flags, levelToAdd);
      if (resultIndex)
        *resultIndex = GetSize() - 1;

      // the call to NoteChange() has to happen after we add the key
      // as NoteChange() will call RowCountChanged() which will call our GetRowCount()
      NoteChange(GetSize() - 1, 1, nsMsgViewNotificationCode::insertOrDelete);
    }
    else
    {
      InsertMsgHdrAt(0, msgHdr, msgKey, flags, levelToAdd);
      if (resultIndex)
        *resultIndex = 0;

      // the call to NoteChange() has to happen after we insert the key
      // as NoteChange() will call RowCountChanged() which will call our GetRowCount()
      NoteChange(0, 1, nsMsgViewNotificationCode::insertOrDelete);
    }
    m_sortValid = false;
  }
  else
  {
    InsertMsgHdrAt(insertIndex, msgHdr, msgKey, flags, 0);
    if (resultIndex)
      *resultIndex = insertIndex;
    // the call to NoteChange() has to happen after we add the key
    // as NoteChange() will call RowCountChanged() which will call our GetRowCount()
    NoteChange(insertIndex, 1, nsMsgViewNotificationCode::insertOrDelete);
  }
  OnHeaderAddedOrDeleted();
  return NS_OK;
}

bool nsMsgDBView::WantsThisThread(nsIMsgThread * /*threadHdr*/)
{
  return true; // default is to want all threads.
}

nsMsgViewIndex nsMsgDBView::FindParentInThread(nsMsgKey parentKey, nsMsgViewIndex startOfThreadViewIndex)
{
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  while (parentKey != nsMsgKey_None)
  {
    nsMsgViewIndex parentIndex = m_keys.IndexOf(parentKey, startOfThreadViewIndex);
    if (parentIndex != nsMsgViewIndex_None)
      return parentIndex;

    if (NS_FAILED(m_db->GetMsgHdrForKey(parentKey, getter_AddRefs(msgHdr))))
      break;

    msgHdr->GetThreadParent(&parentKey);
  }

  return startOfThreadViewIndex;
}

nsresult nsMsgDBView::ListIdsInThreadOrder(nsIMsgThread *threadHdr, nsMsgKey parentKey,
                                           uint32_t level, nsMsgViewIndex *viewIndex,
                                           uint32_t *pNumListed)
{
  nsresult rv = NS_OK;
  nsCOMPtr <nsISimpleEnumerator> msgEnumerator;
  threadHdr->EnumerateMessages(parentKey, getter_AddRefs(msgEnumerator));
  uint32_t numChildren;
  (void) threadHdr->GetNumChildren(&numChildren);
  NS_ASSERTION(numChildren, "Empty thread in view/db");
  if (!numChildren)
    return NS_OK;  // bogus, but harmless.

  numChildren--; // account for the existing thread root

  // skip the first one.
  bool hasMore;
  nsCOMPtr <nsISupports> supports;
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  while (NS_SUCCEEDED(rv) && NS_SUCCEEDED(rv = msgEnumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = msgEnumerator->GetNext(getter_AddRefs(supports));
    if (NS_SUCCEEDED(rv) && supports)
    {
      if (*pNumListed == numChildren)
      {
        NS_NOTREACHED("thread corrupt in db");
        // if we've listed more messages than are in the thread, then the db
        // is corrupt, and we should invalidate it.
        // we'll use this rv to indicate there's something wrong with the db
        // though for now it probably won't get paid attention to.
        m_db->SetSummaryValid(false);
        rv = NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE;
        break;
      }

      msgHdr = do_QueryInterface(supports);
      if (!(m_viewFlags & nsMsgViewFlagsType::kShowIgnored))
      {
        bool ignored;
        msgHdr->GetIsKilled(&ignored);
        // We are not going to process subthreads, horribly invalidating the
        // numChildren characteristic
        if (ignored)
          continue;
      }

      nsMsgKey msgKey;
      uint32_t msgFlags, newFlags;
      msgHdr->GetMessageKey(&msgKey);
      msgHdr->GetFlags(&msgFlags);
      AdjustReadFlag(msgHdr, &msgFlags);
      SetMsgHdrAt(msgHdr, *viewIndex, msgKey, msgFlags & ~MSG_VIEW_FLAGS, level);
      // turn off thread or elided bit if they got turned on (maybe from new only view?)
      msgHdr->AndFlags(~(MSG_VIEW_FLAG_ISTHREAD | nsMsgMessageFlags::Elided), &newFlags);
      (*pNumListed)++;
      (*viewIndex)++;
      rv = ListIdsInThreadOrder(threadHdr, msgKey, level + 1, viewIndex, pNumListed);
    }
  }
  return rv; // we don't want to return the rv from the enumerator when it reaches the end, do we?
}

bool nsMsgDBView::InsertEmptyRows(nsMsgViewIndex viewIndex, int32_t numRows)
{
  return m_keys.InsertElementsAt(viewIndex, numRows, 0) &&
         m_flags.InsertElementsAt(viewIndex, numRows, 0) &&
         m_levels.InsertElementsAt(viewIndex, numRows, 1);
}

void nsMsgDBView::RemoveRows(nsMsgViewIndex viewIndex, int32_t numRows)
{
  m_keys.RemoveElementsAt(viewIndex, numRows);
  m_flags.RemoveElementsAt(viewIndex, numRows);
  m_levels.RemoveElementsAt(viewIndex, numRows);
}

NS_IMETHODIMP nsMsgDBView::InsertTreeRows(nsMsgViewIndex aIndex,
                                          uint32_t aNumRows,
                                          nsMsgKey aKey,
                                          nsMsgViewFlagsTypeValue aFlags,
                                          uint32_t aLevel,
                                          nsIMsgFolder *aFolder)
{
  if (GetSize() < aIndex)
    return NS_ERROR_UNEXPECTED;

  nsCOMArray<nsIMsgFolder> *folders = GetFolders();
  if (folders)
  {
    // In a search/xfvf view only, a folder is required.
    NS_ENSURE_ARG_POINTER(aFolder);
    for (int32_t i = 0; i < aNumRows; i++)
      // Insert into m_folders.
      if (!folders->InsertObjectAt(aFolder, aIndex + i))
        return NS_ERROR_UNEXPECTED;
  }

  if (m_keys.InsertElementsAt(aIndex, aNumRows, aKey) &&
      m_flags.InsertElementsAt(aIndex, aNumRows, aFlags) &&
      m_levels.InsertElementsAt(aIndex, aNumRows, aLevel))
    return NS_OK;

  return NS_ERROR_UNEXPECTED;
}

NS_IMETHODIMP nsMsgDBView::RemoveTreeRows(nsMsgViewIndex aIndex,
                                          uint32_t aNumRows)
{
  // Prevent a crash if attempting to remove rows which don't exist.
  if (GetSize() < aIndex + aNumRows)
    return NS_ERROR_UNEXPECTED;

  nsMsgDBView::RemoveRows(aIndex, aNumRows);

  nsCOMArray<nsIMsgFolder> *folders = GetFolders();
  if (folders)
    // In a search/xfvf view only, remove from m_folders.
    if (!folders->RemoveObjectsAt(aIndex, aNumRows))
      return NS_ERROR_UNEXPECTED;

  return NS_OK;
}

nsresult nsMsgDBView::ListIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex startOfThreadViewIndex, uint32_t *pNumListed)
{
  NS_ENSURE_ARG(threadHdr);
  // these children ids should be in thread order.
  nsresult rv = NS_OK;
  uint32_t i;
  nsMsgViewIndex viewIndex = startOfThreadViewIndex + 1;
  *pNumListed = 0;

  uint32_t numChildren;
  threadHdr->GetNumChildren(&numChildren);
  NS_ASSERTION(numChildren, "Empty thread in view/db");
  if (!numChildren)
    return NS_OK;

  numChildren--; // account for the existing thread root
  if (!InsertEmptyRows(viewIndex, numChildren))
    return NS_ERROR_OUT_OF_MEMORY;

  // ### need to rework this when we implemented threading in group views.
  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay && ! (m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
  {
    nsMsgKey parentKey = m_keys[startOfThreadViewIndex];
    // If the thread is bigger than the hdr cache, expanding the thread
    // can be slow. Increasing the hdr cache size will help a fair amount.
    uint32_t hdrCacheSize;
    m_db->GetMsgHdrCacheSize(&hdrCacheSize);
    if (numChildren > hdrCacheSize)
      m_db->SetMsgHdrCacheSize(numChildren);
    // If this fails, *pNumListed will be 0, and we'll fall back to just
    // enumerating the messages in the thread below.
    rv = ListIdsInThreadOrder(threadHdr, parentKey, 1, &viewIndex, pNumListed);
    if (numChildren > hdrCacheSize)
      m_db->SetMsgHdrCacheSize(hdrCacheSize);
  }
  if (! *pNumListed)
  {
    uint32_t ignoredHeaders = 0;
    // if we're not threaded, just list em out in db order
    for (i = 1; i <= numChildren; i++)
    {
      nsCOMPtr <nsIMsgDBHdr> msgHdr;
      threadHdr->GetChildHdrAt(i, getter_AddRefs(msgHdr));

      if (msgHdr != nullptr)
      {
        if (!(m_viewFlags & nsMsgViewFlagsType::kShowIgnored))
        {
          bool killed;
          msgHdr->GetIsKilled(&killed);
          if (killed)
          {
            ignoredHeaders++;
            continue;
          }
        }

        nsMsgKey msgKey;
        uint32_t msgFlags, newFlags;
        msgHdr->GetMessageKey(&msgKey);
        msgHdr->GetFlags(&msgFlags);
        AdjustReadFlag(msgHdr, &msgFlags);
        SetMsgHdrAt(msgHdr, viewIndex, msgKey, msgFlags & ~MSG_VIEW_FLAGS, 1);
        // here, we're either flat, or we're grouped - in either case, level is 1
        // turn off thread or elided bit if they got turned on (maybe from new only view?)
        if (i > 0)
          msgHdr->AndFlags(~(MSG_VIEW_FLAG_ISTHREAD | nsMsgMessageFlags::Elided), &newFlags);
        (*pNumListed)++;
        viewIndex++;
      }
    }
    if (ignoredHeaders + *pNumListed < numChildren)
    {
      NS_NOTREACHED("thread corrupt in db");
      // if we've listed fewer messages than are in the thread, then the db
      // is corrupt, and we should invalidate it.
      // we'll use this rv to indicate there's something wrong with the db
      // though for now it probably won't get paid attention to.
      m_db->SetSummaryValid(false);
      rv = NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE;
    }
  }

  // We may have added too many elements (i.e., subthreads were cut)
  // ### fix for cross folder view case.
  if (*pNumListed < numChildren)
    RemoveRows(viewIndex, numChildren - *pNumListed);
  return rv;
}

int32_t nsMsgDBView::FindLevelInThread(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startOfThread, nsMsgViewIndex viewIndex)
{
  nsCOMPtr <nsIMsgDBHdr> curMsgHdr = msgHdr;
  nsMsgKey msgKey;
  msgHdr->GetMessageKey(&msgKey);

  // look through the ancestors of the passed in msgHdr in turn, looking for them in the view, up to the start of
  // the thread. If we find an ancestor, then our level is one greater than the level of the ancestor.
  while (curMsgHdr)
  {
    nsMsgKey parentKey;
    curMsgHdr->GetThreadParent(&parentKey);
    if (parentKey == nsMsgKey_None)
      break;

    // scan up to find view index of ancestor, if any
    for (nsMsgViewIndex indexToTry = viewIndex; indexToTry && indexToTry-- >= startOfThread;)
    {
      if (m_keys[indexToTry] == parentKey)
        return m_levels[indexToTry] + 1;
    }

    // if msgHdr's key is its parentKey, we'll loop forever, so protect
    // against that corruption.
    if (msgKey == parentKey || NS_FAILED(m_db->GetMsgHdrForKey(parentKey, getter_AddRefs(curMsgHdr))))
    {
      NS_ERROR("msgKey == parentKey, or GetMsgHdrForKey failed, this used to be an infinte loop condition");
      curMsgHdr = nullptr;
    }
    else
    {
      // need to update msgKey so the check for a msgHdr with matching
      // key+parentKey will work after first time through loop
      curMsgHdr->GetMessageKey(&msgKey);
    }
  }
  return 1;
}

// ### Can this be combined with GetIndexForThread??
nsMsgViewIndex
nsMsgDBView::GetThreadRootIndex(nsIMsgDBHdr *msgHdr)
{
  if (!msgHdr)
  {
    NS_WARNING("null msgHdr parameter");
    return nsMsgViewIndex_None;
  }

  // Take advantage of the fact that we're already sorted
  // and find the thread root via a binary search.

  nsMsgViewIndex highIndex = m_keys.Length();
  nsMsgViewIndex lowIndex = 0;
  IdKeyPtr EntryInfo1, EntryInfo2;
  EntryInfo1.key = nullptr;
  EntryInfo2.key = nullptr;

  nsresult rv;
  uint16_t maxLen;
  eFieldType fieldType;
  // The following may leave fieldType undefined.
  // In this case, we can return highIndex right away since
  // it is the value returned in the default case of
  // switch (fieldType) statement below.
  rv = GetFieldTypeAndLenForSort(m_sortType, &maxLen, &fieldType);
  NS_ENSURE_SUCCESS(rv, highIndex);

  const void *pValue1 = &EntryInfo1, *pValue2 = &EntryInfo2;

  int retStatus = 0;
  msgHdr->GetMessageKey(&EntryInfo1.id);
  msgHdr->GetFolder(&EntryInfo1.folder);
  EntryInfo1.folder->Release();
  //check if a custom column handler exists. If it does then grab it and pass it in
  //to either GetCollationKey or GetLongField
  nsIMsgCustomColumnHandler* colHandler = GetCurColumnHandlerFromDBInfo();

  viewSortInfo comparisonContext;
  comparisonContext.view = this;
  comparisonContext.isSecondarySort = false;
  comparisonContext.ascendingSort = (m_sortOrder == nsMsgViewSortOrder::ascending);
  nsCOMPtr<nsIMsgDatabase> hdrDB;
  EntryInfo1.folder->GetMsgDatabase(getter_AddRefs(hdrDB));
  comparisonContext.db = hdrDB.get();
  switch (fieldType)
  {
    case kCollationKey:
      rv = GetCollationKey(msgHdr, m_sortType, &EntryInfo1.key, &EntryInfo1.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
      break;
    case kU32:
      if (m_sortType == nsMsgViewSortType::byId)
        EntryInfo1.dword = EntryInfo1.id;
      else
        GetLongField(msgHdr, m_sortType, &EntryInfo1.dword, colHandler);
      break;
    default:
      return highIndex;
  }
  while (highIndex > lowIndex)
  {
    nsMsgViewIndex tryIndex = (lowIndex + highIndex) / 2;
    // need to adjust tryIndex if it's not a thread.
    while (m_levels[tryIndex] && tryIndex)
      tryIndex--;

    if (tryIndex < lowIndex)
    {
      NS_ERROR("try index shouldn't be less than low index");
      break;
    }
    EntryInfo2.id = m_keys[tryIndex];
    GetFolderForViewIndex(tryIndex, &EntryInfo2.folder);
    EntryInfo2.folder->Release();

    nsCOMPtr<nsIMsgDBHdr> tryHdr;
    nsCOMPtr<nsIMsgDatabase> db;
    // ### this should get the db from the folder...
    GetDBForViewIndex(tryIndex, getter_AddRefs(db));
    if (db)
      rv = db->GetMsgHdrForKey(EntryInfo2.id, getter_AddRefs(tryHdr));
    if (!tryHdr)
      break;
    if (tryHdr == msgHdr)
    {
      highIndex = tryIndex;
      break;
    }
    if (fieldType == kCollationKey)
    {
      PR_FREEIF(EntryInfo2.key);
      rv = GetCollationKey(tryHdr, m_sortType, &EntryInfo2.key, &EntryInfo2.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
      retStatus = FnSortIdKeyPtr(&pValue1, &pValue2, &comparisonContext);
    }
    else if (fieldType == kU32)
    {
      if (m_sortType == nsMsgViewSortType::byId)
        EntryInfo2.dword = EntryInfo2.id;
      else
        GetLongField(tryHdr, m_sortType, &EntryInfo2.dword, colHandler);
      retStatus = FnSortIdUint32(&pValue1, &pValue2, &comparisonContext);
    }
    if (retStatus == 0)
    {
      highIndex = tryIndex;
      break;
    }

    if (retStatus < 0)
    {
      highIndex = tryIndex;
      // we already made sure tryIndex was at a thread at the top of the loop.
    }
    else
    {
      lowIndex = tryIndex + 1;
      while (lowIndex < GetSize() && m_levels[lowIndex])
        lowIndex++;
    }
  }

  nsCOMPtr<nsIMsgDBHdr> resultHdr;
  GetMsgHdrForViewIndex(highIndex, getter_AddRefs(resultHdr));

  if (resultHdr != msgHdr)
  {
    NS_WARNING("didn't find hdr");
    highIndex = FindHdr(msgHdr);
#ifdef DEBUG_David_Bienvenu
    if (highIndex != nsMsgViewIndex_None)
    {
      NS_WARNING("but find hdr did");
      printf("level of found hdr = %d\n", m_levels[highIndex]);
      ValidateSort();
    }
#endif
    return highIndex;
  }
  PR_Free(EntryInfo1.key);
  PR_Free(EntryInfo2.key);
  return msgHdr == resultHdr ? highIndex : nsMsgViewIndex_None;
}

#ifdef DEBUG_David_Bienvenu

void nsMsgDBView::InitEntryInfoForIndex(nsMsgViewIndex i, IdKeyPtr &EntryInfo)
{
  EntryInfo.key = nullptr;

  nsresult rv;
  uint16_t maxLen;
  eFieldType fieldType;
  // The following may leave fieldType undefined.
  rv = GetFieldTypeAndLenForSort(m_sortType, &maxLen, &fieldType);
  NS_ASSERTION(NS_SUCCEEDED(rv),"failed to obtain fieldType");

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  GetMsgHdrForViewIndex(i, getter_AddRefs(msgHdr));

  msgHdr->GetMessageKey(&EntryInfo.id);
  msgHdr->GetFolder(&EntryInfo.folder);
  EntryInfo.folder->Release();
  //check if a custom column handler exists. If it does then grab it and pass it in
  //to either GetCollationKey or GetLongField
  nsIMsgCustomColumnHandler* colHandler = GetCurColumnHandlerFromDBInfo();

  nsCOMPtr<nsIMsgDatabase> hdrDB;
  EntryInfo.folder->GetMsgDatabase(getter_AddRefs(hdrDB));
  switch (fieldType)
  {
    case kCollationKey:
      PR_FREEIF(EntryInfo.key);
      rv = GetCollationKey(msgHdr, m_sortType, &EntryInfo.key, &EntryInfo.dword, colHandler);
      NS_ASSERTION(NS_SUCCEEDED(rv),"failed to create collation key");
      break;
    case kU32:
      if (m_sortType == nsMsgViewSortType::byId)
        EntryInfo.dword = EntryInfo.id;
      else
        GetLongField(msgHdr, m_sortType, &EntryInfo.dword, colHandler);
      break;
    default:
      NS_ERROR("invalid field type");
  }
}

void nsMsgDBView::ValidateSort()
{
  IdKeyPtr EntryInfo1, EntryInfo2;
  nsCOMPtr<nsIMsgDBHdr> hdr1, hdr2;

  uint16_t  maxLen;
  eFieldType fieldType;
  // It is not entirely clear what we should do since,
  // if fieldType is not available, there is no way to know
  // how to compare the field to check for sorting.
  // So we bomb out here. It is OK since this is debug code
  // inside  #ifdef DEBUG_David_Bienvenu
  rv = GetFieldTypeAndLenForSort(m_sortType, &maxLen, &fieldType);
  NS_ASSERTION(NS_SUCCEEDED(rv),"failed to obtain fieldType");

  viewSortInfo comparisonContext;
  comparisonContext.view = this;
  comparisonContext.isSecondarySort = false;
  comparisonContext.ascendingSort = (m_sortOrder == nsMsgViewSortOrder::ascending);
  nsCOMPtr<nsIMsgDatabase> db;
  GetDBForViewIndex(0, getter_AddRefs(db));
  // this is only for comparing collation keys - it could be any db.
  comparisonContext.db = db.get();

  for (nsMsgViewIndex i = 0; i < m_keys.Length();)
  {
    // ignore non threads
    if (m_levels[i])
    {
      i++;
      continue;
    }

    // find next header.
    nsMsgViewIndex j = i + 1;
    while (j < m_keys.Length() && m_levels[j])
      j++;
    if (j == m_keys.Length())
      break;

    InitEntryInfoForIndex(i, EntryInfo1);
    InitEntryInfoForIndex(j, EntryInfo2);
    const void *pValue1 = &EntryInfo1, *pValue2 = &EntryInfo2;
    int retStatus = 0;
    if (fieldType == kCollationKey)
      retStatus = FnSortIdKeyPtr(&pValue1, &pValue2, &comparisonContext);
    else if (fieldType == kU32)
      retStatus = FnSortIdUint32(&pValue1, &pValue2, &comparisonContext);

    if (retStatus && (retStatus < 0) == (m_sortOrder == nsMsgViewSortOrder::ascending))
    {
      NS_ERROR("view not sorted correctly");
      break;
    }
    // j is the new i.
    i = j;
  }
}

#endif

nsresult nsMsgDBView::ListUnreadIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex startOfThreadViewIndex, uint32_t *pNumListed)
{
  NS_ENSURE_ARG(threadHdr);
  // these children ids should be in thread order.
  nsMsgViewIndex viewIndex = startOfThreadViewIndex + 1;
  *pNumListed = 0;
  nsMsgKey topLevelMsgKey = m_keys[startOfThreadViewIndex];

  uint32_t numChildren;
  threadHdr->GetNumChildren(&numChildren);
  uint32_t i;
  for (i = 0; i < numChildren; i++)
  {
    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    threadHdr->GetChildHdrAt(i, getter_AddRefs(msgHdr));
    if (msgHdr != nullptr)
    {
      if (!(m_viewFlags & nsMsgViewFlagsType::kShowIgnored))
      {
        bool killed;
        msgHdr->GetIsKilled(&killed);
        if (killed)
          continue;
      }

      nsMsgKey msgKey;
      uint32_t msgFlags;
      msgHdr->GetMessageKey(&msgKey);
      msgHdr->GetFlags(&msgFlags);
      bool isRead = AdjustReadFlag(msgHdr, &msgFlags);
      if (!isRead)
      {
        // just make sure flag is right in db.
        m_db->MarkHdrRead(msgHdr, false, nullptr);
        if (msgKey != topLevelMsgKey)
        {
          InsertMsgHdrAt(viewIndex, msgHdr, msgKey, msgFlags,
                FindLevelInThread(msgHdr, startOfThreadViewIndex, viewIndex));
          viewIndex++;
          (*pNumListed)++;
        }
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, uint32_t aOldFlags,
                                       uint32_t aNewFlags, nsIDBChangeListener *aInstigator)
{
  // if we're not the instigator, update flags if this key is in our view
  if (aInstigator != this)
  {
    NS_ENSURE_ARG_POINTER(aHdrChanged);
    nsMsgKey msgKey;
    aHdrChanged->GetMessageKey(&msgKey);
    nsMsgViewIndex index = FindHdr(aHdrChanged);
    if (index != nsMsgViewIndex_None)
    {
      uint32_t viewOnlyFlags = m_flags[index] & (MSG_VIEW_FLAGS | nsMsgMessageFlags::Elided);

      // ### what about saving the old view only flags, like IsThread and HasChildren?
      // I think we'll want to save those away.
      m_flags[index] = aNewFlags | viewOnlyFlags;
      // tell the view the extra flag changed, so it can
      // update the previous view, if any.
      OnExtraFlagChanged(index, aNewFlags);
      NoteChange(index, 1, nsMsgViewNotificationCode::changed);
    }

    uint32_t deltaFlags = (aOldFlags ^ aNewFlags);
    if (deltaFlags & (nsMsgMessageFlags::Read | nsMsgMessageFlags::New))
    {
      nsMsgViewIndex threadIndex =
            ThreadIndexOfMsgHdr(aHdrChanged, index, nullptr, nullptr);
      // may need to fix thread counts
      if (threadIndex != nsMsgViewIndex_None && threadIndex != index)
        NoteChange(threadIndex, 1, nsMsgViewNotificationCode::changed);
    }
 }
  // don't need to propagate notifications, right?
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::OnHdrDeleted(nsIMsgDBHdr *aHdrChanged, nsMsgKey aParentKey, int32_t aFlags,
                            nsIDBChangeListener *aInstigator)
{
  nsMsgViewIndex deletedIndex = FindHdr(aHdrChanged);
  if (deletedIndex != nsMsgViewIndex_None)
  {
    // Check if this message is currently selected. If it is, tell the frontend
    // to be prepared for a delete.
    if (mTreeSelection && mCommandUpdater)
    {
      bool isMsgSelected = false;
      mTreeSelection->IsSelected(deletedIndex, &isMsgSelected);
      if (isMsgSelected)
        mCommandUpdater->UpdateNextMessageAfterDelete();
    }

    RemoveByIndex(deletedIndex);
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::OnHdrAdded(nsIMsgDBHdr *aHdrChanged, nsMsgKey aParentKey, int32_t aFlags,
                          nsIDBChangeListener *aInstigator)
{
  return OnNewHeader(aHdrChanged, aParentKey, false);
  // probably also want to pass that parent key in, since we went to the trouble
  // of figuring out what it is.
}

NS_IMETHODIMP
nsMsgDBView::OnHdrPropertyChanged(nsIMsgDBHdr *aHdrToChange, bool aPreChange, uint32_t *aStatus,
                                 nsIDBChangeListener * aInstigator)
{
  if (aPreChange)
    return NS_OK;

  if (aHdrToChange)
  {
    nsMsgViewIndex index = FindHdr(aHdrToChange);
    if (index != nsMsgViewIndex_None)
      NoteChange(index, 1, nsMsgViewNotificationCode::changed);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::OnParentChanged (nsMsgKey aKeyChanged, nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeListener *aInstigator)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator)
{
  if (m_db)
  {
    m_db->RemoveListener(this);
    m_db = nullptr;
  }

  int32_t saveSize = GetSize();
  ClearHdrCache();

  // this is important, because the tree will ask us for our
  // row count, which get determine from the number of keys.
  m_keys.Clear();
  // be consistent
  m_flags.Clear();
  m_levels.Clear();

  // tell the tree all the rows have gone away
  if (mTree)
    mTree->RowCountChanged(0, -saveSize);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::OnEvent(nsIMsgDatabase *aDB, const char *aEvent)
{
  if (!strcmp(aEvent, "DBOpened"))
    m_db = aDB;
  return NS_OK;
}


NS_IMETHODIMP nsMsgDBView::OnReadChanged(nsIDBChangeListener *aInstigator)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::OnJunkScoreChanged(nsIDBChangeListener *aInstigator)
{
  return NS_OK;
}

void nsMsgDBView::ClearHdrCache()
{
  m_cachedHdr = nullptr;
  m_cachedMsgKey = nsMsgKey_None;
}

NS_IMETHODIMP nsMsgDBView::SetSuppressChangeNotifications(bool aSuppressChangeNotifications)
{
  mSuppressChangeNotification = aSuppressChangeNotifications;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetSuppressChangeNotifications(bool * aSuppressChangeNotifications)
{
  NS_ENSURE_ARG_POINTER(aSuppressChangeNotifications);
  *aSuppressChangeNotifications = mSuppressChangeNotification;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::NoteChange(nsMsgViewIndex firstLineChanged,
                                      int32_t numChanged,
                                      nsMsgViewNotificationCodeValue changeType)
{
  if (mTree && !mSuppressChangeNotification)
  {
    switch (changeType)
    {
    case nsMsgViewNotificationCode::changed:
      mTree->InvalidateRange(firstLineChanged, firstLineChanged + numChanged - 1);
      break;
    case nsMsgViewNotificationCode::insertOrDelete:
      if (numChanged < 0)
        mRemovingRow = true;
      // the caller needs to have adjusted m_keys before getting here, since
      // RowCountChanged() will call our GetRowCount()
      mTree->RowCountChanged(firstLineChanged, numChanged);
      mRemovingRow = false;
    case nsMsgViewNotificationCode::all:
      ClearHdrCache();
      break;
    }
  }
  return NS_OK;
}

void nsMsgDBView::NoteStartChange(nsMsgViewIndex firstlineChanged, int32_t numChanged,
                                  nsMsgViewNotificationCodeValue changeType)
{
}
void nsMsgDBView::NoteEndChange(nsMsgViewIndex firstlineChanged, int32_t numChanged,
                                nsMsgViewNotificationCodeValue changeType)
{
  // send the notification now.
  NoteChange(firstlineChanged, numChanged, changeType);
}

NS_IMETHODIMP nsMsgDBView::GetSortOrder(nsMsgViewSortOrderValue *aSortOrder)
{
    NS_ENSURE_ARG_POINTER(aSortOrder);
    *aSortOrder = m_sortOrder;
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetSortType(nsMsgViewSortTypeValue *aSortType)
{
    NS_ENSURE_ARG_POINTER(aSortType);
    *aSortType = m_sortType;
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetSortType(nsMsgViewSortTypeValue aSortType)
{
    m_sortType = aSortType;
    return NS_OK;
}


NS_IMETHODIMP nsMsgDBView::GetViewType(nsMsgViewTypeValue *aViewType)
{
    NS_ERROR("you should be overriding this");
    return NS_ERROR_UNEXPECTED;
}

NS_IMETHODIMP nsMsgDBView::GetSecondarySortOrder(nsMsgViewSortOrderValue *aSortOrder)
{
    NS_ENSURE_ARG_POINTER(aSortOrder);
    *aSortOrder = m_secondarySortOrder;
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetSecondarySortOrder(nsMsgViewSortOrderValue aSortOrder)
{
    m_secondarySortOrder = aSortOrder;
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetSecondarySortType(nsMsgViewSortTypeValue *aSortType)
{
    NS_ENSURE_ARG_POINTER(aSortType);
    *aSortType = m_secondarySort;
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetSecondarySortType(nsMsgViewSortTypeValue aSortType)
{
    m_secondarySort = aSortType;
    return NS_OK;
}

nsresult nsMsgDBView::PersistFolderInfo(nsIDBFolderInfo **dbFolderInfo)
{
  nsresult rv = m_db->GetDBFolderInfo(dbFolderInfo);
  NS_ENSURE_SUCCESS(rv, rv);
  // save off sort type and order, view type and flags
  (*dbFolderInfo)->SetSortType(m_sortType);
  (*dbFolderInfo)->SetSortOrder(m_sortOrder);
  (*dbFolderInfo)->SetViewFlags(m_viewFlags);
  nsMsgViewTypeValue viewType;
  GetViewType(&viewType);
  (*dbFolderInfo)->SetViewType(viewType);
  return rv;
}


NS_IMETHODIMP nsMsgDBView::GetViewFlags(nsMsgViewFlagsTypeValue *aViewFlags)
{
    NS_ENSURE_ARG_POINTER(aViewFlags);
    *aViewFlags = m_viewFlags;
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetViewFlags(nsMsgViewFlagsTypeValue aViewFlags)
{
  // if we're turning off threaded display, we need to expand all so that all
  // messages will be displayed.
  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay && ! (aViewFlags & nsMsgViewFlagsType::kThreadedDisplay))
  {
    ExpandAll();
    m_sortValid = false; // invalidate the sort so sorting will do something
  }
  m_viewFlags = aViewFlags;

  if (m_viewFolder)
  {
    nsCOMPtr <nsIMsgDatabase> db;
    nsCOMPtr <nsIDBFolderInfo> folderInfo;
    nsresult rv = m_viewFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(db));
    NS_ENSURE_SUCCESS(rv,rv);
    return folderInfo->SetViewFlags(aViewFlags);
  }
  else
    return NS_OK;
}

nsresult nsMsgDBView::MarkThreadOfMsgRead(nsMsgKey msgId, nsMsgViewIndex msgIndex, nsTArray<nsMsgKey> &idsMarkedRead, bool bRead)
{
    nsCOMPtr <nsIMsgThread> threadHdr;
    nsresult rv = GetThreadContainingIndex(msgIndex, getter_AddRefs(threadHdr));
    NS_ENSURE_SUCCESS(rv, rv);

    nsMsgViewIndex threadIndex;

    NS_ASSERTION(threadHdr, "threadHdr is null");
    if (!threadHdr)
        return NS_MSG_MESSAGE_NOT_FOUND;

    nsCOMPtr<nsIMsgDBHdr> firstHdr;
    rv = threadHdr->GetChildHdrAt(0, getter_AddRefs(firstHdr));
    NS_ENSURE_SUCCESS(rv, rv);
    nsMsgKey firstHdrId;
    firstHdr->GetMessageKey(&firstHdrId);
    if (msgId != firstHdrId)
        threadIndex = GetIndexOfFirstDisplayedKeyInThread(threadHdr);
    else
        threadIndex = msgIndex;
    return MarkThreadRead(threadHdr, threadIndex, idsMarkedRead, bRead);
}

nsresult nsMsgDBView::MarkThreadRead(nsIMsgThread *threadHdr, nsMsgViewIndex threadIndex, nsTArray<nsMsgKey> &idsMarkedRead, bool bRead)
{
    bool threadElided = true;
    if (threadIndex != nsMsgViewIndex_None)
        threadElided = (m_flags[threadIndex] & nsMsgMessageFlags::Elided);

    uint32_t numChildren;
    threadHdr->GetNumChildren(&numChildren);
    idsMarkedRead.SetCapacity(numChildren);
    for (int32_t childIndex = 0; childIndex < (int32_t) numChildren ; childIndex++)
    {
        nsCOMPtr <nsIMsgDBHdr> msgHdr;
        threadHdr->GetChildHdrAt(childIndex, getter_AddRefs(msgHdr));
        NS_ASSERTION(msgHdr, "msgHdr is null");
        if (!msgHdr)
            continue;

        bool isRead;

        nsMsgKey hdrMsgId;
        msgHdr->GetMessageKey(&hdrMsgId);
        nsCOMPtr<nsIMsgDatabase> db;
        nsresult rv = GetDBForHeader(msgHdr, getter_AddRefs(db));
        NS_ENSURE_SUCCESS(rv, rv);
        db->IsRead(hdrMsgId, &isRead);

        if (isRead != bRead)
        {
            // MarkHdrRead will change the unread count on the thread
            db->MarkHdrRead(msgHdr, bRead, nullptr);
            // insert at the front.  should we insert at the end?
            idsMarkedRead.InsertElementAt(0, hdrMsgId);
        }
    }

    return NS_OK;
}

bool nsMsgDBView::AdjustReadFlag(nsIMsgDBHdr *msgHdr, uint32_t *msgFlags)
{
  // if we're a cross-folder view, just bail on this.
  if (GetFolders())
    return *msgFlags & nsMsgMessageFlags::Read;
  bool isRead = false;
  nsMsgKey msgKey;
  msgHdr->GetMessageKey(&msgKey);
  m_db->IsRead(msgKey, &isRead);
    // just make sure flag is right in db.
#ifdef DEBUG_David_Bienvenu
  NS_ASSERTION(isRead == ((*msgFlags & nsMsgMessageFlags::Read) != 0), "msgFlags out of sync");
#endif
  if (isRead)
    *msgFlags |= nsMsgMessageFlags::Read;
  else
    *msgFlags &= ~nsMsgMessageFlags::Read;
  m_db->MarkHdrRead(msgHdr, isRead, nullptr);
  return isRead;
}

// Starting from startIndex, performs the passed in navigation, including
// any marking read needed, and returns the resultId and resultIndex of the
// destination of the navigation.  If no message is found in the view,
// it returns a resultId of nsMsgKey_None and an resultIndex of nsMsgViewIndex_None.
NS_IMETHODIMP nsMsgDBView::ViewNavigate(nsMsgNavigationTypeValue motion, nsMsgKey *pResultKey, nsMsgViewIndex *pResultIndex, nsMsgViewIndex *pThreadIndex, bool wrap)
{
    NS_ENSURE_ARG_POINTER(pResultKey);
    NS_ENSURE_ARG_POINTER(pResultIndex);
    NS_ENSURE_ARG_POINTER(pThreadIndex);

    int32_t currentIndex;
    nsMsgViewIndex startIndex;

    if (!mTreeSelection) // we must be in stand alone message mode
    {
      currentIndex = FindViewIndex(m_currentlyDisplayedMsgKey);
    }
    else
    {
      nsresult rv = mTreeSelection->GetCurrentIndex(&currentIndex);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    startIndex = currentIndex;
    return nsMsgDBView::NavigateFromPos(motion, startIndex, pResultKey, pResultIndex, pThreadIndex, wrap);
}

nsresult nsMsgDBView::NavigateFromPos(nsMsgNavigationTypeValue motion, nsMsgViewIndex startIndex, nsMsgKey *pResultKey, nsMsgViewIndex *pResultIndex, nsMsgViewIndex *pThreadIndex, bool wrap)
{
    nsresult rv = NS_OK;
    nsMsgKey resultThreadKey;
    nsMsgViewIndex curIndex;
    nsMsgViewIndex lastIndex = (GetSize() > 0) ? (nsMsgViewIndex) GetSize() - 1 : nsMsgViewIndex_None;
    nsMsgViewIndex threadIndex = nsMsgViewIndex_None;

    // if there aren't any messages in the view, bail out.
    if (GetSize() <= 0)
    {
      *pResultIndex = nsMsgViewIndex_None;
      *pResultKey = nsMsgKey_None;
      return NS_OK;
    }

    switch (motion)
    {
        case nsMsgNavigationType::firstMessage:
            *pResultIndex = 0;
            *pResultKey = m_keys[0];
            break;
        case nsMsgNavigationType::nextMessage:
            // return same index and id on next on last message
            *pResultIndex = std::min(startIndex + 1, lastIndex);
            *pResultKey = m_keys[*pResultIndex];
            break;
        case nsMsgNavigationType::previousMessage:
            *pResultIndex = (startIndex != nsMsgViewIndex_None && startIndex > 0) ? startIndex - 1 : 0;
            *pResultKey = m_keys[*pResultIndex];
            break;
        case nsMsgNavigationType::lastMessage:
            *pResultIndex = lastIndex;
            *pResultKey = m_keys[*pResultIndex];
            break;
        case nsMsgNavigationType::firstFlagged:
            rv = FindFirstFlagged(pResultIndex);
            if (IsValidIndex(*pResultIndex))
                *pResultKey = m_keys[*pResultIndex];
            break;
        case nsMsgNavigationType::nextFlagged:
            rv = FindNextFlagged(startIndex + 1, pResultIndex);
            if (IsValidIndex(*pResultIndex))
                *pResultKey = m_keys[*pResultIndex];
            break;
        case nsMsgNavigationType::previousFlagged:
            rv = FindPrevFlagged(startIndex, pResultIndex);
            if (IsValidIndex(*pResultIndex))
                *pResultKey = m_keys[*pResultIndex];
            break;
        case nsMsgNavigationType::firstNew:
            rv = FindFirstNew(pResultIndex);
            if (IsValidIndex(*pResultIndex))
                *pResultKey = m_keys[*pResultIndex];
            break;
        case nsMsgNavigationType::firstUnreadMessage:
            startIndex = nsMsgViewIndex_None;        // note fall thru - is this motion ever used?
        case nsMsgNavigationType::nextUnreadMessage:
            for (curIndex = (startIndex == nsMsgViewIndex_None) ? 0 : startIndex; curIndex <= lastIndex && lastIndex != nsMsgViewIndex_None; curIndex++) {
                uint32_t flags = m_flags[curIndex];

                // don't return start index since navigate should move
                if (!(flags & (nsMsgMessageFlags::Read | MSG_VIEW_FLAG_DUMMY)) && (curIndex != startIndex))
                {
                    *pResultIndex = curIndex;
                    *pResultKey = m_keys[*pResultIndex];
                    break;
                }
                // check for collapsed thread with new children
                if ((m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay) && flags & MSG_VIEW_FLAG_ISTHREAD && flags & nsMsgMessageFlags::Elided) {
                    nsCOMPtr <nsIMsgThread> threadHdr;
                    GetThreadContainingIndex(curIndex, getter_AddRefs(threadHdr));
                    NS_ENSURE_SUCCESS(rv, rv);

                    NS_ASSERTION(threadHdr, "threadHdr is null");
                    if (!threadHdr)
                        continue;
                    uint32_t numUnreadChildren;
                    threadHdr->GetNumUnreadChildren(&numUnreadChildren);
                    if (numUnreadChildren > 0)
                    {
                        uint32_t numExpanded;
                        ExpandByIndex(curIndex, &numExpanded);
                        lastIndex += numExpanded;
                        if (pThreadIndex)
                            *pThreadIndex = curIndex;
                    }
                }
            }
            if (curIndex > lastIndex)
            {
                // wrap around by starting at index 0.
                if (wrap)
                {
                    nsMsgKey startKey = GetAt(startIndex);

                    rv = NavigateFromPos(nsMsgNavigationType::nextUnreadMessage, nsMsgViewIndex_None, pResultKey, pResultIndex, pThreadIndex, false);

                    if (*pResultKey == startKey)
                    {
                        // wrapped around and found start message!
                        *pResultIndex = nsMsgViewIndex_None;
                        *pResultKey = nsMsgKey_None;
                    }
                }
                else
                {
                    *pResultIndex = nsMsgViewIndex_None;
                    *pResultKey = nsMsgKey_None;
                }
            }
            break;
        case nsMsgNavigationType::previousUnreadMessage:
            if (startIndex == nsMsgViewIndex_None)
              break;
            rv = FindPrevUnread(m_keys[startIndex], pResultKey,
                                &resultThreadKey);
            if (NS_SUCCEEDED(rv))
            {
                *pResultIndex = FindViewIndex(*pResultKey);
                if (*pResultKey != resultThreadKey && (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
                {
                    threadIndex  = GetThreadIndex(*pResultIndex);
                    if (*pResultIndex == nsMsgViewIndex_None)
                    {
                        nsCOMPtr <nsIMsgThread> threadHdr;
                        nsCOMPtr <nsIMsgDBHdr> msgHdr;
                        rv = m_db->GetMsgHdrForKey(*pResultKey, getter_AddRefs(msgHdr));
                        NS_ENSURE_SUCCESS(rv, rv);
                        rv = GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(threadHdr));
                        NS_ENSURE_SUCCESS(rv, rv);

                        NS_ASSERTION(threadHdr, "threadHdr is null");
                        if (threadHdr)
                            break;
                        uint32_t numUnreadChildren;
                        threadHdr->GetNumUnreadChildren(&numUnreadChildren);
                        if (numUnreadChildren > 0)
                        {
                            uint32_t numExpanded;
                            ExpandByIndex(threadIndex, &numExpanded);
                        }
                        *pResultIndex = FindViewIndex(*pResultKey);
                    }
                }
                if (pThreadIndex)
                    *pThreadIndex = threadIndex;
            }
            break;
        case nsMsgNavigationType::lastUnreadMessage:
            break;
        case nsMsgNavigationType::nextUnreadThread:
            if (startIndex != nsMsgViewIndex_None)
              ApplyCommandToIndices(nsMsgViewCommandType::markThreadRead, &startIndex, 1);

            return NavigateFromPos(nsMsgNavigationType::nextUnreadMessage, startIndex, pResultKey, pResultIndex, pThreadIndex, true);
        case nsMsgNavigationType::toggleThreadKilled:
            {
                bool resultKilled;
                nsMsgViewIndexArray selection;
                GetSelectedIndices(selection);
                ToggleIgnored(selection.Elements(), selection.Length(), &threadIndex, &resultKilled);
                if (resultKilled)
                {
                    return NavigateFromPos(nsMsgNavigationType::nextUnreadThread, threadIndex, pResultKey, pResultIndex, pThreadIndex, true);
                }
                else
                {
                    *pResultIndex = nsMsgViewIndex_None;
                    *pResultKey = nsMsgKey_None;
                    return NS_OK;
                }
            }
        case nsMsgNavigationType::toggleSubthreadKilled:
            {
                bool resultKilled;
                nsMsgViewIndexArray selection;
                GetSelectedIndices(selection);
                ToggleMessageKilled(selection.Elements(), selection.Length(),
                    &threadIndex, &resultKilled);
                if (resultKilled)
                {
                    return NavigateFromPos(nsMsgNavigationType::nextUnreadMessage, threadIndex, pResultKey, pResultIndex, pThreadIndex, true);
                }
                else
                {
                    *pResultIndex = nsMsgViewIndex_None;
                    *pResultKey = nsMsgKey_None;
                    return NS_OK;
                }
            }
          // check where navigate says this will take us. If we have the message in the view,
          // return it. Otherwise, return an error.
      case nsMsgNavigationType::back:
      case nsMsgNavigationType::forward:
        {
          nsCString folderUri, msgUri;
          nsCString viewFolderUri;
          nsCOMPtr<nsIMsgFolder> curFolder = m_viewFolder ? m_viewFolder : m_folder;
          if (curFolder)
            curFolder->GetURI(viewFolderUri);
          int32_t relPos = (motion == nsMsgNavigationType::forward)
            ? 1 : (m_currentlyDisplayedMsgKey != nsMsgKey_None) ? -1 : 0;
          int32_t curPos;
          nsresult rv;
          nsCOMPtr<nsIMessenger> messenger (do_QueryReferent(mMessengerWeak, &rv));
          NS_ENSURE_SUCCESS(rv, rv);
          rv = messenger->GetFolderUriAtNavigatePos(relPos, folderUri);
          NS_ENSURE_SUCCESS(rv, rv);
          // Empty viewFolderUri means we're in a search results view.
          if (viewFolderUri.IsEmpty() || folderUri.Equals(viewFolderUri))
          {
            nsCOMPtr <nsIMsgDBHdr> msgHdr;
            rv = messenger->GetMsgUriAtNavigatePos(relPos, msgUri);
            NS_ENSURE_SUCCESS(rv, rv);
            messenger->MsgHdrFromURI(msgUri, getter_AddRefs(msgHdr));
            if (msgHdr)
            {
              messenger->GetNavigatePos(&curPos);
              curPos += relPos;
              *pResultIndex = FindHdr(msgHdr);
              messenger->SetNavigatePos(curPos);
              msgHdr->GetMessageKey(pResultKey);
              return NS_OK;
            }
          }
          *pResultIndex = nsMsgViewIndex_None;
          *pResultKey = nsMsgKey_None;
          break;

        }
        default:
            NS_ERROR("unsupported motion");
            break;
    }
    return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::NavigateStatus(nsMsgNavigationTypeValue motion, bool *_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);

    bool enable = false;
    nsresult rv = NS_ERROR_FAILURE;
    nsMsgKey resultKey = nsMsgKey_None;
    int32_t index = nsMsgKey_None;
    nsMsgViewIndex resultIndex = nsMsgViewIndex_None;
    if (mTreeSelection)
      (void) mTreeSelection->GetCurrentIndex(&index);
    else
      index = FindViewIndex(m_currentlyDisplayedMsgKey);
    nsCOMPtr<nsIMessenger> messenger (do_QueryReferent(mMessengerWeak));
    // warning - we no longer validate index up front because fe passes in -1 for no
    // selection, so if you use index, be sure to validate it before using it
    // as an array index.
    switch (motion)
    {
        case nsMsgNavigationType::firstMessage:
        case nsMsgNavigationType::lastMessage:
            if (GetSize() > 0)
                enable = true;
            break;
        case nsMsgNavigationType::nextMessage:
            if (IsValidIndex(index) && uint32_t(index) < GetSize() - 1)
                enable = true;
            break;
        case nsMsgNavigationType::previousMessage:
            if (IsValidIndex(index) && index != 0 && GetSize() > 1)
                enable = true;
            break;
        case nsMsgNavigationType::firstFlagged:
            rv = FindFirstFlagged(&resultIndex);
            enable = (NS_SUCCEEDED(rv) && resultIndex != nsMsgViewIndex_None);
            break;
        case nsMsgNavigationType::nextFlagged:
            rv = FindNextFlagged(index + 1, &resultIndex);
            enable = (NS_SUCCEEDED(rv) && resultIndex != nsMsgViewIndex_None);
            break;
        case nsMsgNavigationType::previousFlagged:
            if (IsValidIndex(index) && index != 0)
                rv = FindPrevFlagged(index, &resultIndex);
            enable = (NS_SUCCEEDED(rv) && resultIndex != nsMsgViewIndex_None);
            break;
        case nsMsgNavigationType::firstNew:
            rv = FindFirstNew(&resultIndex);
            enable = (NS_SUCCEEDED(rv) && resultIndex != nsMsgViewIndex_None);
            break;
        case nsMsgNavigationType::readMore:
            enable = true;  // for now, always true.
            break;
        case nsMsgNavigationType::nextFolder:
        case nsMsgNavigationType::nextUnreadThread:
        case nsMsgNavigationType::nextUnreadMessage:
        case nsMsgNavigationType::toggleThreadKilled:
            enable = true;  // always enabled
            break;
        case nsMsgNavigationType::previousUnreadMessage:
            if (IsValidIndex(index))
            {
                nsMsgKey threadId;
                rv = FindPrevUnread(m_keys[index], &resultKey, &threadId);
                enable = (resultKey != nsMsgKey_None);
            }
            break;
        case nsMsgNavigationType::forward:
        case nsMsgNavigationType::back:
        {
          uint32_t curPos;
          uint32_t historyCount;

          if (messenger)
          {
            messenger->GetNavigateHistory(&curPos, &historyCount, nullptr);
            int32_t desiredPos = (int32_t) curPos;
            if (motion == nsMsgNavigationType::forward)
              desiredPos++;
            else
              desiredPos--; //? operator code didn't work for me
            enable = (desiredPos >= 0 && desiredPos < (int32_t) historyCount / 2);
          }
        }
          break;

        default:
            NS_ERROR("unexpected");
            break;
    }

    *_retval = enable;
    return NS_OK;
}

// Note that these routines do NOT expand collapsed threads! This mimics the old behaviour,
// but it's also because we don't remember whether a thread contains a flagged message the
// same way we remember if a thread contains new messages. It would be painful to dive down
// into each collapsed thread to update navigate status.
// We could cache this info, but it would still be expensive the first time this status needs
// to get updated.
nsresult nsMsgDBView::FindNextFlagged(nsMsgViewIndex startIndex, nsMsgViewIndex *pResultIndex)
{
    nsMsgViewIndex lastIndex = (nsMsgViewIndex) GetSize() - 1;
    nsMsgViewIndex curIndex;

    *pResultIndex = nsMsgViewIndex_None;

    if (GetSize() > 0)
    {
        for (curIndex = startIndex; curIndex <= lastIndex; curIndex++)
        {
            uint32_t flags = m_flags[curIndex];
            if (flags & nsMsgMessageFlags::Marked)
            {
                *pResultIndex = curIndex;
                break;
            }
        }
    }

    return NS_OK;
}

nsresult nsMsgDBView::FindFirstNew(nsMsgViewIndex *pResultIndex)
{
  if (m_db)
  {
    nsMsgKey firstNewKey = nsMsgKey_None;
    m_db->GetFirstNew(&firstNewKey);
    *pResultIndex = (firstNewKey != nsMsgKey_None)
        ? FindKey(firstNewKey, true) : nsMsgViewIndex_None;
  }
  return NS_OK;
}

nsresult nsMsgDBView::FindPrevUnread(nsMsgKey startKey, nsMsgKey *pResultKey,
                                     nsMsgKey *resultThreadId)
{
    nsMsgViewIndex startIndex = FindViewIndex(startKey);
    nsMsgViewIndex curIndex = startIndex;
    nsresult rv = NS_MSG_MESSAGE_NOT_FOUND;

    if (startIndex == nsMsgViewIndex_None)
        return NS_MSG_MESSAGE_NOT_FOUND;

    *pResultKey = nsMsgKey_None;
    if (resultThreadId)
        *resultThreadId = nsMsgKey_None;

    for (; (int) curIndex >= 0 && (*pResultKey == nsMsgKey_None); curIndex--)
    {
        uint32_t flags = m_flags[curIndex];

        if (curIndex != startIndex && flags & MSG_VIEW_FLAG_ISTHREAD && flags & nsMsgMessageFlags::Elided)
        {
            NS_ERROR("fix this");
            //nsMsgKey threadId = m_keys[curIndex];
            //rv = m_db->GetUnreadKeyInThread(threadId, pResultKey, resultThreadId);
            if (NS_SUCCEEDED(rv) && (*pResultKey != nsMsgKey_None))
                break;
        }
        if (!(flags & (nsMsgMessageFlags::Read | MSG_VIEW_FLAG_DUMMY)) && (curIndex != startIndex))
        {
            *pResultKey = m_keys[curIndex];
            rv = NS_OK;
            break;
        }
    }
    // found unread message but we don't know the thread
    NS_ASSERTION(!(*pResultKey != nsMsgKey_None && resultThreadId && *resultThreadId == nsMsgKey_None),
      "fix this");
    return rv;
}

nsresult nsMsgDBView::FindFirstFlagged(nsMsgViewIndex *pResultIndex)
{
    return FindNextFlagged(0, pResultIndex);
}

nsresult nsMsgDBView::FindPrevFlagged(nsMsgViewIndex startIndex, nsMsgViewIndex *pResultIndex)
{
    nsMsgViewIndex curIndex;

    *pResultIndex = nsMsgViewIndex_None;

    if (GetSize() > 0 && IsValidIndex(startIndex))
    {
        curIndex = startIndex;
        do
        {
            if (curIndex != 0)
                curIndex--;

            uint32_t flags = m_flags[curIndex];
            if (flags & nsMsgMessageFlags::Marked)
            {
                *pResultIndex = curIndex;
                break;
            }
        }
        while (curIndex != 0);
    }
    return NS_OK;
}

bool nsMsgDBView::IsValidIndex(nsMsgViewIndex index)
{
    return index != nsMsgViewIndex_None &&
           (index < (nsMsgViewIndex) m_keys.Length());
}

nsresult nsMsgDBView::OrExtraFlag(nsMsgViewIndex index, uint32_t orflag)
{
  uint32_t  flag;
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;
  flag = m_flags[index];
  flag |= orflag;
  m_flags[index] = flag;
  OnExtraFlagChanged(index, flag);
  return NS_OK;
}

nsresult nsMsgDBView::AndExtraFlag(nsMsgViewIndex index, uint32_t andflag)
{
  uint32_t  flag;
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;
  flag = m_flags[index];
  flag &= andflag;
  m_flags[index] = flag;
  OnExtraFlagChanged(index, flag);
  return NS_OK;
}

nsresult nsMsgDBView::SetExtraFlag(nsMsgViewIndex index, uint32_t extraflag)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;
  m_flags[index] = extraflag;
  OnExtraFlagChanged(index, extraflag);
  return NS_OK;
}


nsresult nsMsgDBView::ToggleIgnored(nsMsgViewIndex * indices, int32_t numIndices, nsMsgViewIndex *resultIndex, bool *resultToggleState)
{
  nsCOMPtr <nsIMsgThread> thread;

  // Ignored state is toggled based on the first selected thread
  nsMsgViewIndex threadIndex = GetThreadFromMsgIndex(indices[0], getter_AddRefs(thread));
  uint32_t threadFlags;
  thread->GetFlags(&threadFlags);
  uint32_t ignored = threadFlags & nsMsgMessageFlags::Ignored;

  // Process threads in reverse order
  // Otherwise collapsing the threads will invalidate the indices
  threadIndex = nsMsgViewIndex_None;
  while (numIndices)
  {
    numIndices--;
    if (indices[numIndices] < threadIndex)
    {
      threadIndex = GetThreadFromMsgIndex(indices[numIndices], getter_AddRefs(thread));
      thread->GetFlags(&threadFlags);
      if ((threadFlags & nsMsgMessageFlags::Ignored) == ignored)
        SetThreadIgnored(thread, threadIndex, !ignored);
    }
  }

  if (resultIndex)
    *resultIndex = threadIndex;
  if (resultToggleState)
    *resultToggleState = !ignored;

  return NS_OK;
}

nsresult nsMsgDBView::ToggleMessageKilled(nsMsgViewIndex * indices, int32_t numIndices, nsMsgViewIndex *resultIndex, bool *resultToggleState)
{
  NS_ENSURE_ARG_POINTER(resultToggleState);

  nsCOMPtr <nsIMsgDBHdr> header;
  // Ignored state is toggled based on the first selected message
  nsresult rv = GetMsgHdrForViewIndex(indices[0], getter_AddRefs(header));
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t msgFlags;
  header->GetFlags(&msgFlags);
  uint32_t ignored = msgFlags & nsMsgMessageFlags::Ignored;

  // Process messages in reverse order
  // Otherwise the indices may be invalidated...
  nsMsgViewIndex msgIndex = nsMsgViewIndex_None;
  while (numIndices)
  {
    numIndices--;
    if (indices[numIndices] < msgIndex)
    {
      msgIndex = indices[numIndices];
      rv = GetMsgHdrForViewIndex(msgIndex, getter_AddRefs(header));
      NS_ENSURE_SUCCESS(rv, rv);
      header->GetFlags(&msgFlags);
      if ((msgFlags & nsMsgMessageFlags::Ignored) == ignored)
        SetSubthreadKilled(header, msgIndex, !ignored);
    }
  }

  if (resultIndex)
    *resultIndex = msgIndex;
  if (resultToggleState)
    *resultToggleState = !ignored;

  return NS_OK;
}

nsMsgViewIndex  nsMsgDBView::GetThreadFromMsgIndex(nsMsgViewIndex index,
                                                   nsIMsgThread **threadHdr)
{
  nsMsgKey        msgKey = GetAt(index);
  nsMsgViewIndex  threadIndex;

  if (threadHdr == nullptr)
    return nsMsgViewIndex_None;

  nsresult rv = GetThreadContainingIndex(index, threadHdr);
  NS_ENSURE_SUCCESS(rv,nsMsgViewIndex_None);

  if (*threadHdr == nullptr)
    return nsMsgViewIndex_None;

  nsMsgKey threadKey;
  (*threadHdr)->GetThreadKey(&threadKey);
  if (msgKey !=threadKey)
    threadIndex = GetIndexOfFirstDisplayedKeyInThread(*threadHdr);
  else
    threadIndex = index;
  return threadIndex;
}

nsresult nsMsgDBView::ToggleWatched( nsMsgViewIndex* indices,  int32_t numIndices)
{
  nsCOMPtr <nsIMsgThread> thread;

  // Watched state is toggled based on the first selected thread
  nsMsgViewIndex threadIndex = GetThreadFromMsgIndex(indices[0], getter_AddRefs(thread));
  uint32_t threadFlags;
  thread->GetFlags(&threadFlags);
  uint32_t watched = threadFlags & nsMsgMessageFlags::Watched;

  // Process threads in reverse order
  // for consistency with ToggleIgnored
  threadIndex = nsMsgViewIndex_None;
  while (numIndices)
  {
    numIndices--;
    if (indices[numIndices] < threadIndex)
    {
      threadIndex = GetThreadFromMsgIndex(indices[numIndices], getter_AddRefs(thread));
      thread->GetFlags(&threadFlags);
      if ((threadFlags & nsMsgMessageFlags::Watched) == watched)
        SetThreadWatched(thread, threadIndex, !watched);
    }
  }

  return NS_OK;
}

nsresult nsMsgDBView::SetThreadIgnored(nsIMsgThread *thread, nsMsgViewIndex threadIndex, bool ignored)
{
  if (!IsValidIndex(threadIndex))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  NoteChange(threadIndex, 1, nsMsgViewNotificationCode::changed);
  if (ignored)
  {
    nsTArray<nsMsgKey> idsMarkedRead;

    MarkThreadRead(thread, threadIndex, idsMarkedRead, true);
    CollapseByIndex(threadIndex, nullptr);
  }
  return m_db->MarkThreadIgnored(thread, m_keys[threadIndex], ignored, this);
}

nsresult nsMsgDBView::SetSubthreadKilled(nsIMsgDBHdr *header, nsMsgViewIndex msgIndex, bool ignored)
{
  if (!IsValidIndex(msgIndex))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  NoteChange(msgIndex, 1, nsMsgViewNotificationCode::changed);
  nsresult rv;

  rv = m_db->MarkHeaderKilled(header, ignored, this);
  NS_ENSURE_SUCCESS(rv, rv);

  if (ignored)
  {
    nsCOMPtr <nsIMsgThread> thread;
    nsresult rv;
    rv = GetThreadContainingMsgHdr(header, getter_AddRefs(thread));
    if (NS_FAILED(rv))
      return NS_OK; // So we didn't mark threads read

    uint32_t children, current;
    thread->GetNumChildren(&children);

    nsMsgKey headKey;
    header->GetMessageKey(&headKey);

    for (current = 0; current < children; current++)
    {
       nsMsgKey newKey;
       thread->GetChildKeyAt(current, &newKey);
       if (newKey == headKey)
         break;
    }

    // Process all messages, starting with this message.
    for (; current < children; current++)
    {
       nsCOMPtr <nsIMsgDBHdr> nextHdr;
       bool isKilled;

       thread->GetChildHdrAt(current, getter_AddRefs(nextHdr));
       nextHdr->GetIsKilled(&isKilled);

       // Ideally, the messages should stop processing here.
       // However, the children are ordered not by thread...
       if (isKilled)
         nextHdr->MarkRead(true);
    }
  }
  return NS_OK;
}

nsresult nsMsgDBView::SetThreadWatched(nsIMsgThread *thread, nsMsgViewIndex index, bool watched)
{
  if (!IsValidIndex(index))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  NoteChange(index, 1, nsMsgViewNotificationCode::changed);
  return m_db->MarkThreadWatched(thread, m_keys[index], watched, this);
}

NS_IMETHODIMP nsMsgDBView::GetMsgFolder(nsIMsgFolder **aMsgFolder)
{
  NS_ENSURE_ARG_POINTER(aMsgFolder);
  NS_IF_ADDREF(*aMsgFolder = m_folder);
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SetViewFolder(nsIMsgFolder *aMsgFolder)
{
  m_viewFolder = aMsgFolder;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetViewFolder(nsIMsgFolder **aMsgFolder)
{
  NS_ENSURE_ARG_POINTER(aMsgFolder);
  NS_IF_ADDREF(*aMsgFolder = m_viewFolder);
  return NS_OK;
}


NS_IMETHODIMP
nsMsgDBView::GetNumSelected(uint32_t *aNumSelected)
{
  NS_ENSURE_ARG_POINTER(aNumSelected);

  if (!mTreeSelection)
  {
    // No tree selection can mean we're in the stand alone mode.
    *aNumSelected = (m_currentlyDisplayedMsgKey != nsMsgKey_None) ? 1 : 0;
    return NS_OK;
  }

  bool includeCollapsedMsgs = OperateOnMsgsInCollapsedThreads();

  // We call this a lot from the front end JS, so make it fast.
  nsresult rv = mTreeSelection->GetCount((int32_t*)aNumSelected);
  if (!*aNumSelected || !includeCollapsedMsgs ||
       !(m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
    return rv;

  int32_t numSelectedIncludingCollapsed = *aNumSelected;
  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);
  int32_t numIndices = selection.Length();
  // iterate over the selection, counting up the messages in collapsed
  // threads.
  for (int32_t i = 0; i < numIndices; i++)
  {
    if (m_flags[selection[i]] & nsMsgMessageFlags::Elided)
    {
      int32_t collapsedCount;
      ExpansionDelta(selection[i], &collapsedCount);
      numSelectedIncludingCollapsed += collapsedCount;
    }
  }
  *aNumSelected = numSelectedIncludingCollapsed;
  return rv;
}

NS_IMETHODIMP nsMsgDBView::GetNumMsgsInView(int32_t *aNumMsgs)
{
  NS_ENSURE_ARG_POINTER(aNumMsgs);
  return (m_folder) ? m_folder->GetTotalMessages(false, aNumMsgs) :
                    NS_ERROR_FAILURE;
}
/**
 * @note For the IMAP delete model, this applies to both deleting and
 *       undeleting a message.
 */
NS_IMETHODIMP
nsMsgDBView::GetMsgToSelectAfterDelete(nsMsgViewIndex *msgToSelectAfterDelete)
{
  NS_ENSURE_ARG_POINTER(msgToSelectAfterDelete);
  *msgToSelectAfterDelete = nsMsgViewIndex_None;

  bool isMultiSelect = false;
  int32_t startFirstRange = nsMsgViewIndex_None;
  int32_t endFirstRange = nsMsgViewIndex_None;
  if (!mTreeSelection)
  {
    // If we don't have a tree selection then we must be in stand alone mode.
    // return the index of the current message key as the first selected index.
    *msgToSelectAfterDelete = FindViewIndex(m_currentlyDisplayedMsgKey);
  }
  else
  {
    int32_t selectionCount;
    int32_t startRange;
    int32_t endRange;
    nsresult rv = mTreeSelection->GetRangeCount(&selectionCount);
    NS_ENSURE_SUCCESS(rv, rv);
    for (int32_t i = 0; i < selectionCount; i++)
    {
      rv = mTreeSelection->GetRangeAt(i, &startRange, &endRange);
      NS_ENSURE_SUCCESS(rv, rv);

      // save off the first range in case we need it later
      if (i == 0) {
        startFirstRange = startRange;
        endFirstRange = endRange;
      } else {
        // If the tree selection is goofy (eg adjacent or overlapping ranges),
        // complain about it, but don't try and cope.  Just live with the fact
        // that one of the deleted messages is going to end up selected.
        NS_WARN_IF_FALSE(endFirstRange != startRange,
                         "goofy tree selection state: two ranges are adjacent!");
      }
      *msgToSelectAfterDelete = std::min(*msgToSelectAfterDelete,
                                       (nsMsgViewIndex)startRange);
    }

    // Multiple selection either using Ctrl, Shift, or one of the affordances
    // to select an entire thread.
    isMultiSelect = (selectionCount > 1 || (endRange-startRange) > 0);
  }

  if (*msgToSelectAfterDelete == nsMsgViewIndex_None)
    return NS_OK;

  nsCOMPtr<nsIMsgFolder> folder;
  GetMsgFolder(getter_AddRefs(folder));
  nsCOMPtr<nsIMsgImapMailFolder> imapFolder = do_QueryInterface(folder);
  bool thisIsImapFolder = (imapFolder != nullptr);
  // Need to update the imap-delete model, can change more than once in a session.
  if (thisIsImapFolder)
    GetImapDeleteModel(nullptr);

  // If mail.delete_matches_sort_order is true,
  // for views sorted in descending order (newest at the top), make msgToSelectAfterDelete
  // advance in the same direction as the sort order.
  bool deleteMatchesSort = false;
  if (m_sortOrder == nsMsgViewSortOrder::descending && *msgToSelectAfterDelete)
  {
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> prefBranch (do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    prefBranch->GetBoolPref("mail.delete_matches_sort_order", &deleteMatchesSort);
  }

  if (mDeleteModel == nsMsgImapDeleteModels::IMAPDelete)
  {
    if (isMultiSelect)
    {
      if (deleteMatchesSort)
        *msgToSelectAfterDelete = startFirstRange - 1;
      else
        *msgToSelectAfterDelete = endFirstRange + 1;
    }
    else
    {
      if (deleteMatchesSort)
        *msgToSelectAfterDelete -= 1;
      else
        *msgToSelectAfterDelete += 1;
    }
  }
  else if (deleteMatchesSort)
  {
    *msgToSelectAfterDelete -= 1;
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::GetRemoveRowOnMoveOrDelete(bool *aRemoveRowOnMoveOrDelete)
{
  NS_ENSURE_ARG_POINTER(aRemoveRowOnMoveOrDelete);
  nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_folder);
  if (!imapFolder)
  {
    *aRemoveRowOnMoveOrDelete = true;
    return NS_OK;
  }

  // need to update the imap-delete model, can change more than once in a session.
  GetImapDeleteModel(nullptr);

  // unlike the other imap delete models, "mark as deleted" does not remove rows on delete (or move)
  *aRemoveRowOnMoveOrDelete = (mDeleteModel != nsMsgImapDeleteModels::IMAPDelete);
  return NS_OK;
}


NS_IMETHODIMP
nsMsgDBView::GetCurrentlyDisplayedMessage(nsMsgViewIndex *currentlyDisplayedMessage)
{
  NS_ENSURE_ARG_POINTER(currentlyDisplayedMessage);
  *currentlyDisplayedMessage = FindViewIndex(m_currentlyDisplayedMsgKey);
  return NS_OK;
}

// if nothing selected, return an NS_ERROR
NS_IMETHODIMP
nsMsgDBView::GetHdrForFirstSelectedMessage(nsIMsgDBHdr **hdr)
{
  NS_ENSURE_ARG_POINTER(hdr);

  nsresult rv;
  nsMsgKey key;
  rv = GetKeyForFirstSelectedMessage(&key);
  // don't assert, it is legal for nothing to be selected
  if (NS_FAILED(rv)) return rv;

  if (!m_db)
    return NS_MSG_MESSAGE_NOT_FOUND;

  rv = m_db->GetMsgHdrForKey(key, hdr);
  NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

// if nothing selected, return an NS_ERROR
NS_IMETHODIMP
nsMsgDBView::GetURIForFirstSelectedMessage(nsACString &uri)
{
  nsresult rv;
  nsMsgViewIndex viewIndex;
  rv = GetViewIndexForFirstSelectedMsg(&viewIndex);
  // don't assert, it is legal for nothing to be selected
  if (NS_FAILED(rv)) return rv;

  return GetURIForViewIndex(viewIndex, uri);
}

NS_IMETHODIMP
nsMsgDBView::OnDeleteCompleted(bool aSucceeded)
{
  if (m_deletingRows && aSucceeded)
  {
    uint32_t numIndices = mIndicesToNoteChange.Length();
    if (numIndices && mTree)
    {
      if (numIndices > 1)
        mIndicesToNoteChange.Sort();

      // the call to NoteChange() has to happen after we are done removing the keys
      // as NoteChange() will call RowCountChanged() which will call our GetRowCount()
      if (numIndices > 1)
        mTree->BeginUpdateBatch();
      for (uint32_t i = 0; i < numIndices; i++)
        NoteChange(mIndicesToNoteChange[i], -1, nsMsgViewNotificationCode::insertOrDelete);
      if (numIndices > 1)
        mTree->EndUpdateBatch();
    }
    mIndicesToNoteChange.Clear();
  }

 m_deletingRows = false;
 return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::GetDb(nsIMsgDatabase **aDB)
{
  NS_ENSURE_ARG_POINTER(aDB);
  NS_IF_ADDREF(*aDB = m_db);
  return NS_OK;
}

bool nsMsgDBView::OfflineMsgSelected(nsMsgViewIndex * indices, int32_t numIndices)
{
  nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_folder);
  if (localFolder)
    return true;

  for (nsMsgViewIndex index = 0; index < (nsMsgViewIndex) numIndices; index++)
  {
    // For cross-folder saved searches, we need to check if any message
    // is in a local folder.
    if (!m_folder)
    {
      nsCOMPtr<nsIMsgFolder> folder;
      GetFolderForViewIndex(indices[index], getter_AddRefs(folder));
      nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(folder);
      if (localFolder)
        return true;
    }

    uint32_t flags = m_flags[indices[index]];
    if ((flags & nsMsgMessageFlags::Offline))
      return true;
  }
  return false;
}

bool nsMsgDBView::NonDummyMsgSelected(nsMsgViewIndex * indices, int32_t numIndices)
{
  bool includeCollapsedMsgs = OperateOnMsgsInCollapsedThreads();

  for (nsMsgViewIndex index = 0; index < (nsMsgViewIndex) numIndices; index++)
  {
    uint32_t flags = m_flags[indices[index]];
    // We now treat having a collapsed dummy message selected as if
    // the whole group was selected so we can apply commands to the group.
    if (!(flags & MSG_VIEW_FLAG_DUMMY) ||
        (flags & nsMsgMessageFlags::Elided && includeCollapsedMsgs))
      return true;
  }
  return false;
}

NS_IMETHODIMP nsMsgDBView::GetViewIndexForFirstSelectedMsg(nsMsgViewIndex *aViewIndex)
{
  NS_ENSURE_ARG_POINTER(aViewIndex);
  // If we don't have a tree selection we must be in stand alone mode...
  if (!mTreeSelection)
  {
    *aViewIndex = m_currentlyDisplayedViewIndex;
    return NS_OK;
  }

  int32_t startRange;
  int32_t endRange;
  nsresult rv = mTreeSelection->GetRangeAt(0, &startRange, &endRange);
  // don't assert, it is legal for nothing to be selected
  if (NS_FAILED(rv))
    return rv;

  // check that the first index is valid, it may not be if nothing is selected
  if (startRange < 0 || uint32_t(startRange) >= GetSize())
    return NS_ERROR_UNEXPECTED;

  *aViewIndex = startRange;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::GetKeyForFirstSelectedMessage(nsMsgKey *key)
{
  NS_ENSURE_ARG_POINTER(key);
  // If we don't have a tree selection we must be in stand alone mode...
  if (!mTreeSelection)
  {
    *key = m_currentlyDisplayedMsgKey;
    return NS_OK;
  }

  int32_t startRange;
  int32_t endRange;
  nsresult rv = mTreeSelection->GetRangeAt(0, &startRange, &endRange);
  // don't assert, it is legal for nothing to be selected
  if (NS_FAILED(rv))
    return rv;

  // check that the first index is valid, it may not be if nothing is selected
  if (startRange < 0 || uint32_t(startRange) >= GetSize())
    return NS_ERROR_UNEXPECTED;

  if (m_flags[startRange] & MSG_VIEW_FLAG_DUMMY)
    return NS_MSG_INVALID_DBVIEW_INDEX;

  *key = m_keys[startRange];
  return NS_OK;
}

nsCOMArray<nsIMsgFolder>* nsMsgDBView::GetFolders()
{
  return nullptr;
}

nsresult nsMsgDBView::AdjustRowCount(int32_t rowCountBeforeSort, int32_t rowCountAfterSort)
{
  int32_t rowChange = rowCountAfterSort - rowCountBeforeSort;

  if (rowChange)
  {
    // this is not safe to use when you have a selection
    // RowCountChanged() will call AdjustSelection()
    uint32_t numSelected = 0;
    GetNumSelected(&numSelected);
    NS_ASSERTION(numSelected == 0, "it is not save to call AdjustRowCount() when you have a selection");

    if (mTree)
      mTree->RowCountChanged(0, rowChange);
  }
  return NS_OK;
}

nsresult nsMsgDBView::GetImapDeleteModel(nsIMsgFolder *folder)
{
   nsresult rv = NS_OK;
   nsCOMPtr <nsIMsgIncomingServer> server;
   if (folder) //for the search view
     folder->GetServer(getter_AddRefs(server));
   else if (m_folder)
     m_folder->GetServer(getter_AddRefs(server));
   nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryInterface(server, &rv);
   if (NS_SUCCEEDED(rv) && imapServer )
     imapServer->GetDeleteModel(&mDeleteModel);
   return rv;
}


//
// CanDrop
//
// Can't drop on the thread pane.
//
NS_IMETHODIMP nsMsgDBView::CanDrop(int32_t index,
                                   int32_t orient,
                                   nsIDOMDataTransfer *dataTransfer,
                                   bool *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = false;

  return NS_OK;
}


//
// Drop
//
// Can't drop on the thread pane.
//
NS_IMETHODIMP nsMsgDBView::Drop(int32_t row,
                                int32_t orient,
                                nsIDOMDataTransfer *dataTransfer)
{
  return NS_OK;
}


//
// IsSorted
//
// ...
//
NS_IMETHODIMP nsMsgDBView::IsSorted(bool *_retval)
{
  *_retval = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SelectFolderMsgByKey(nsIMsgFolder *aFolder, nsMsgKey aKey)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  if (aKey == nsMsgKey_None)
    return NS_ERROR_FAILURE;

  // this is OK for non search views.

  nsMsgViewIndex viewIndex = FindKey(aKey, true /* expand */);

  if (mTree)
    mTreeSelection->SetCurrentIndex(viewIndex);

  // make sure the current message is once again visible in the thread pane
  // so we don't have to go search for it in the thread pane
  if (mTree && viewIndex != nsMsgViewIndex_None)
  {
    mTreeSelection->Select(viewIndex);
    mTree->EnsureRowIsVisible(viewIndex);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgDBView::SelectMsgByKey(nsMsgKey aKey)
{
  NS_ASSERTION(aKey != nsMsgKey_None, "bad key");
  if (aKey == nsMsgKey_None)
    return NS_OK;

  // use SaveAndClearSelection()
  // and RestoreSelection() so that we'll clear the current selection
  // but pass in a different key array so that we'll
  // select (and load) the desired message

  nsAutoTArray<nsMsgKey, 1> preservedSelection;
  nsresult rv = SaveAndClearSelection(nullptr, preservedSelection);
  NS_ENSURE_SUCCESS(rv,rv);

  // now, restore our desired selection
  nsAutoTArray<nsMsgKey, 1> keyArray;
  keyArray.AppendElement(aKey);

  // if the key was not found
  // (this can happen with "remember last selected message")
  // nothing will be selected
  rv = RestoreSelection(aKey, keyArray);
  NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater, nsIMsgDBView **_retval)
{
  nsMsgDBView* newMsgDBView = new nsMsgDBView();

  if (!newMsgDBView)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = CopyDBView(newMsgDBView, aMessengerInstance, aMsgWindow, aCmdUpdater);
  NS_ENSURE_SUCCESS(rv,rv);

  NS_IF_ADDREF(*_retval = newMsgDBView);
  return NS_OK;
}

nsresult nsMsgDBView::CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater)
{
  NS_ENSURE_ARG_POINTER(aNewMsgDBView);
  if (aMsgWindow)
  {
    aNewMsgDBView->mMsgWindowWeak = do_GetWeakReference(aMsgWindow);
    aMsgWindow->SetOpenFolder(m_viewFolder? m_viewFolder : m_folder);
  }
  aNewMsgDBView->mMessengerWeak = do_GetWeakReference(aMessengerInstance);
  aNewMsgDBView->mCommandUpdater = aCmdUpdater;
  aNewMsgDBView->m_folder = m_folder;
  aNewMsgDBView->m_viewFlags = m_viewFlags;
  aNewMsgDBView->m_sortOrder = m_sortOrder;
  aNewMsgDBView->m_sortType = m_sortType;
  aNewMsgDBView->m_db = m_db;
  aNewMsgDBView->mDateFormatter = mDateFormatter;
  if (m_db)
    aNewMsgDBView->m_db->AddListener(aNewMsgDBView);
  aNewMsgDBView->mIsNews = mIsNews;
  aNewMsgDBView->mIsRss = mIsRss;
  aNewMsgDBView->mIsXFVirtual = mIsXFVirtual;
  aNewMsgDBView->mShowSizeInLines = mShowSizeInLines;
  aNewMsgDBView->mHeaderParser = mHeaderParser;
  aNewMsgDBView->mDeleteModel = mDeleteModel;
  aNewMsgDBView->m_flags = m_flags;
  aNewMsgDBView->m_levels = m_levels;
  aNewMsgDBView->m_keys = m_keys;

  aNewMsgDBView->m_customColumnHandlerIDs = m_customColumnHandlerIDs;
  aNewMsgDBView->m_customColumnHandlers.AppendObjects(m_customColumnHandlers);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::GetSearchSession(nsIMsgSearchSession* *aSession)
{
  NS_ASSERTION(false, "should be overriden by child class");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMsgDBView::SetSearchSession(nsIMsgSearchSession *aSession)
{
  NS_ASSERTION(false, "should be overriden by child class");
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMsgDBView::GetSupportsThreading(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::FindIndexFromKey(nsMsgKey aMsgKey, bool aExpand, nsMsgViewIndex *aIndex)
{
  NS_ENSURE_ARG_POINTER(aIndex);

  *aIndex = FindKey(aMsgKey, aExpand);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgDBView::FindIndexOfMsgHdr(nsIMsgDBHdr *aMsgHdr, bool aExpand, nsMsgViewIndex *aIndex)
{
  NS_ENSURE_ARG(aMsgHdr);
  NS_ENSURE_ARG_POINTER(aIndex);

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    nsMsgViewIndex threadIndex = ThreadIndexOfMsgHdr(aMsgHdr);
    if (threadIndex != nsMsgViewIndex_None)
    {
      if (aExpand && (m_flags[threadIndex] & nsMsgMessageFlags::Elided))
        ExpandByIndex(threadIndex, nullptr);
      *aIndex = FindHdr(aMsgHdr, threadIndex);
    }
    else
      *aIndex = nsMsgViewIndex_None;
  }
  else
    *aIndex = FindHdr(aMsgHdr);

  return NS_OK;
}

static void getDateFormatPref( nsIPrefBranch* _prefBranch, const char* _prefLocalName, nsDateFormatSelector& _format )
{
  // read
  int32_t nFormatSetting( 0 );
  nsresult result = _prefBranch->GetIntPref( _prefLocalName, &nFormatSetting );
  if ( NS_SUCCEEDED( result ) )
  {
    // translate
    nsDateFormatSelector res( nFormatSetting );
    // transfer if valid
    if ( ( res >= kDateFormatNone ) && ( res <= kDateFormatWeekday ) )
      _format = res;
  }
}

nsresult nsMsgDBView::InitDisplayFormats()
{
  m_dateFormatDefault   = kDateFormatShort;
  m_dateFormatThisWeek  = kDateFormatShort;
  m_dateFormatToday     = kDateFormatNone;

  nsresult rv = NS_OK;
  nsCOMPtr<nsIPrefService> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  nsCOMPtr<nsIPrefBranch> dateFormatPrefs;
  rv = prefs->GetBranch("mail.ui.display.dateformat.", getter_AddRefs(dateFormatPrefs));
  NS_ENSURE_SUCCESS(rv,rv);

  getDateFormatPref( dateFormatPrefs, "default", m_dateFormatDefault );
  getDateFormatPref( dateFormatPrefs, "thisweek", m_dateFormatThisWeek );
  getDateFormatPref( dateFormatPrefs, "today", m_dateFormatToday );
  return rv;
}

void nsMsgDBView::SetMRUTimeForFolder(nsIMsgFolder *folder)
{
  uint32_t seconds;
  PRTime2Seconds(PR_Now(), &seconds);
  nsAutoCString nowStr;
  nowStr.AppendInt(seconds);
  folder->SetStringProperty(MRU_TIME_PROPERTY, nowStr);
}


NS_IMPL_ISUPPORTS1(nsMsgDBView::nsMsgViewHdrEnumerator, nsISimpleEnumerator)

nsMsgDBView::nsMsgViewHdrEnumerator::nsMsgViewHdrEnumerator(nsMsgDBView *view)
{
  // we need to clone the view because the caller may clear the
  // current view immediately. It also makes it easier to expand all
  // if we're working on a copy.
  nsCOMPtr<nsIMsgDBView> clonedView;
  view->CloneDBView(nullptr, nullptr, nullptr, getter_AddRefs(clonedView));
  m_view = static_cast<nsMsgDBView*>(clonedView.get());
  // make sure we enumerate over collapsed threads by expanding all.
  m_view->ExpandAll();
  m_curHdrIndex = 0;
}

nsMsgDBView::nsMsgViewHdrEnumerator::~nsMsgViewHdrEnumerator()
{
  if (m_view)
    m_view->Close();
}

NS_IMETHODIMP nsMsgDBView::nsMsgViewHdrEnumerator::GetNext(nsISupports **aItem)
{
  NS_ENSURE_ARG_POINTER(aItem);

  if (m_curHdrIndex >= m_view->GetSize())
    return NS_ERROR_FAILURE;

  // Ignore dummy header. We won't have empty groups, so
  // we know the view index is good.
  if (m_view->m_flags[m_curHdrIndex] & MSG_VIEW_FLAG_DUMMY)
    ++m_curHdrIndex;

  nsCOMPtr<nsIMsgDBHdr> nextHdr;

  nsresult rv = m_view->GetMsgHdrForViewIndex(m_curHdrIndex++, getter_AddRefs(nextHdr));
  NS_IF_ADDREF(*aItem = nextHdr);
  return rv;
}

NS_IMETHODIMP nsMsgDBView::nsMsgViewHdrEnumerator::HasMoreElements(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = m_curHdrIndex < m_view->GetSize();
  return NS_OK;
}

nsresult nsMsgDBView::GetViewEnumerator(nsISimpleEnumerator **enumerator)
{
  NS_IF_ADDREF(*enumerator = new nsMsgViewHdrEnumerator(this));
  return (*enumerator) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

nsresult nsMsgDBView::GetDBForHeader(nsIMsgDBHdr *msgHdr, nsIMsgDatabase **db)
{
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = msgHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);
  return folder->GetMsgDatabase(db);
}

/**
 * Determine whether junk commands should be enabled on this view.
 * Junk commands are always enabled for mail. For nntp and rss, they
 * may be selectively enabled using an inherited folder property.
 *
 * @param  aViewIndex  view index of the message to check
 * @return             true if junk controls should be enabled
 */
bool nsMsgDBView::JunkControlsEnabled(nsMsgViewIndex aViewIndex)
{
  // For normal mail, junk commands are always enabled.
  if (!(mIsNews || mIsRss || mIsXFVirtual))
    return true;

  // we need to check per message or folder
  nsCOMPtr <nsIMsgFolder> folder = m_folder;
  if (!folder && aViewIndex != nsMsgViewIndex_None)
    GetFolderForViewIndex(aViewIndex, getter_AddRefs(folder));
  if (folder)
  {
    // Check if this is a mail message in search folders.
    if (mIsXFVirtual)
    {
      nsCOMPtr <nsIMsgIncomingServer> server;
      folder->GetServer(getter_AddRefs(server));
      nsAutoCString type;
      if (server)
        server->GetType(type);
      if (!(MsgLowerCaseEqualsLiteral(type, "nntp") || MsgLowerCaseEqualsLiteral(type, "rss")))
        return true;
    }

    // For rss and news, check the inherited folder property.
    nsAutoCString junkEnableOverride;
    folder->GetInheritedStringProperty("dobayes.mailnews@mozilla.org#junk",
                                       junkEnableOverride);
    if (junkEnableOverride.EqualsLiteral("true"))
      return true;
  }

  return false;
}
