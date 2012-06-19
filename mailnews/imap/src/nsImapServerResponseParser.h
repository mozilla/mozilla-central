/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsIMAPServerResponseParser_H_
#define _nsIMAPServerResponseParser_H_

#include "nsIMAPHostSessionList.h"
#include "nsImapSearchResults.h"
#include "nsStringGlue.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsImapUtils.h"
#include "nsAutoPtr.h"

class nsIMAPNamespace;
class nsIMAPNamespaceList;
class nsIMAPBodyShell;
class nsIMAPBodypart;
class nsImapSearchResultIterator;
class nsImapFlagAndUidState;
class nsCString;

#include "nsIMAPGenericParser.h"

class nsImapServerResponseParser : public nsIMAPGenericParser
{
public:
  nsImapServerResponseParser(nsImapProtocol &imapConnection);
  virtual ~nsImapServerResponseParser();

  // Overridden from the base parser class
  virtual bool       LastCommandSuccessful();
  virtual void HandleMemoryFailure();

  // aignoreBadAndNOResponses --> don't throw a error dialog if this command results in a NO or Bad response
  // from the server..in other words the command is "exploratory" and we don't really care if it succeeds or fails.
  // This value is typically FALSE for almost all cases.
  virtual void ParseIMAPServerResponse(const char *aCurrentCommand,
                                       bool aIgnoreBadAndNOResponses,
                                       char *aGreetingWithCapability = NULL);
  virtual void InitializeState();
  bool    CommandFailed();
  void    SetCommandFailed(bool failed);

    enum eIMAPstate {
        kNonAuthenticated,
        kAuthenticated,
        kFolderSelected
    } ;

  virtual eIMAPstate GetIMAPstate();
  virtual bool WaitingForMoreClientInput() { return fWaitingForMoreClientInput; }
  const char *GetSelectedMailboxName();   // can be NULL

  // if we get a PREAUTH greeting from the server, initialize the parser to begin in
  // the kAuthenticated state
  void PreauthSetAuthenticatedState();

  // these functions represent the state of the currently selected
  // folder
  bool       CurrentFolderReadOnly();
  PRInt32    NumberOfMessages();
  PRInt32    NumberOfRecentMessages();
  PRInt32    NumberOfUnseenMessages();
  PRInt32    FolderUID();
  PRUint32   CurrentResponseUID();
  PRUint32   HighestRecordedUID();
  void       SetCurrentResponseUID(PRUint32 uid);
  bool       IsNumericString(const char *string);
  PRInt32    SizeOfMostRecentMessage();
  void       SetTotalDownloadSize(PRInt32 newSize) { fTotalDownloadSize = newSize; }
  void       SetFetchingEverythingRFC822(bool fetchingEverythingRFC822) { fFetchEverythingRFC822 = fetchingEverythingRFC822;}

  nsImapSearchResultIterator *CreateSearchResultIterator();
  void ResetSearchResultSequence() {fSearchResults->ResetSequence();}

  // create a struct mailbox_spec from our info, used in
  // libmsg c interface
  nsImapMailboxSpec *CreateCurrentMailboxSpec(const char *mailboxName = nsnull);

  // Resets the flags state.
  void ResetFlagInfo();

  // set this to false if you don't want to alert the user to server
  // error messages
  void SetReportingErrors(bool reportThem) { fReportingErrors=reportThem;}
  bool GetReportingErrors() { return fReportingErrors; }

  eIMAPCapabilityFlags GetCapabilityFlag() { return fCapabilityFlag; }
  void   SetCapabilityFlag(eIMAPCapabilityFlags capability) {fCapabilityFlag = capability;}
  bool ServerHasIMAP4Rev1Capability() { return ((fCapabilityFlag & kIMAP4rev1Capability) != 0); }
  bool ServerHasACLCapability() { return ((fCapabilityFlag & kACLCapability) != 0); }
  bool ServerHasNamespaceCapability() { return ((fCapabilityFlag & kNamespaceCapability) != 0); }
  bool ServerIsNetscape3xServer() { return fServerIsNetscape3xServer; }
  bool ServerHasServerInfo() {return ((fCapabilityFlag & kXServerInfoCapability) != 0); }
  bool ServerIsAOLServer() {return ((fCapabilityFlag & kAOLImapCapability) != 0); }
  void SetFetchingFlags(bool aFetchFlags) { fFetchingAllFlags = aFetchFlags;}
  void ResetCapabilityFlag() ;

  nsCString& GetMailAccountUrl() { return fMailAccountUrl; }
  const char *GetXSenderInfo() { return fXSenderInfo; }
  void FreeXSenderInfo() { PR_FREEIF(fXSenderInfo); }
  nsCString& GetManageListsUrl() { return fManageListsUrl; }
  nsCString& GetManageFiltersUrl() {return fManageFiltersUrl;}
  const char *GetManageFolderUrl() {return fFolderAdminUrl;}
  nsCString &GetServerID() {return fServerIdResponse;}

  // Call this when adding a pipelined command to the session
  void IncrementNumberOfTaggedResponsesExpected(const char *newExpectedTag);

  // Interrupt a Fetch, without really Interrupting (through netlib)
  bool GetLastFetchChunkReceived();
  void ClearLastFetchChunkReceived();
  virtual PRUint16	SupportsUserFlags() { return fSupportsUserDefinedFlags; }
  virtual PRUint16  SettablePermanentFlags() { return fSettablePermanentFlags;}
  void SetFlagState(nsIImapFlagAndUidState *state);
  bool GetDownloadingHeaders();
  bool GetFillingInShell();
  void UseCachedShell(nsIMAPBodyShell *cachedShell);
  void SetHostSessionList(nsIImapHostSessionList *aHostSession);
  char  *fAuthChallenge;    // the challenge returned by the server in
                            //response to authenticate using CRAM-MD5 or NTLM
  bool            fCondStoreEnabled;  
  bool            fUseModSeq;  // can use mod seq for currently selected folder
  PRUint64        fHighestModSeq;

protected:
  virtual void    flags();
  virtual void    envelope_data();
  virtual void    xaolenvelope_data();
  virtual void    parse_address(nsCAutoString &addressLine);
  virtual void    internal_date();
  virtual nsresult BeginMessageDownload(const char *content_type);

  virtual void    response_data();
  virtual void    resp_text();
  virtual void    resp_cond_state(bool isTagged);
  virtual void    text_mime2();
  virtual void    text();
  virtual void    parse_folder_flags();
  virtual void    enable_data();
  virtual void    language_data();
  virtual void    authChallengeResponse_data();
  virtual void    resp_text_code();
  virtual void    response_done();
  virtual void    response_tagged();
  virtual void    response_fatal();
  virtual void    resp_cond_bye();
  virtual void    id_data();
  virtual void    mailbox_data();
  virtual void    numeric_mailbox_data();
  virtual void    capability_data();
  virtual void    xserverinfo_data();
  virtual void    xmailboxinfo_data();
  virtual void    namespace_data();
  virtual void    myrights_data(bool unsolicited);
  virtual void    acl_data();
  virtual void    bodystructure_data();
  nsIMAPBodypart  *bodystructure_part(char *partNum, nsIMAPBodypart *parentPart);
  nsIMAPBodypart  *bodystructure_leaf(char *partNum, nsIMAPBodypart *parentPart);
  nsIMAPBodypart  *bodystructure_multipart(char *partNum, nsIMAPBodypart *parentPart);
  virtual void    mime_data();
  virtual void    mime_part_data();
  virtual void    mime_header_data();
  virtual void    quota_data();
  virtual void    msg_fetch();
  virtual void    msg_obsolete();
  virtual void    msg_fetch_headers(const char *partNum);
  virtual void    msg_fetch_content(bool chunk, PRInt32 origin, const char *content_type);
  virtual bool    msg_fetch_quoted();
  virtual bool    msg_fetch_literal(bool chunk, PRInt32 origin);
  virtual void    mailbox_list(bool discoveredFromLsub);
  virtual void    mailbox(nsImapMailboxSpec *boxSpec);

  virtual void    ProcessOkCommand(const char *commandToken);
  virtual void    ProcessBadCommand(const char *commandToken);
  virtual void    PreProcessCommandToken(const char *commandToken,
                                             const char *currentCommand);
  virtual void    PostProcessEndOfLine();

  // Overridden from the nsIMAPGenericParser, to retrieve the next line
  // from the open socket.
  virtual bool    GetNextLineForParser(char **nextLine);
  // overriden to do logging
  virtual void    SetSyntaxError(bool error, const char *msg = nsnull);

private:
  bool            fProcessingTaggedResponse;
  bool            fCurrentCommandFailed;
  bool            fReportingErrors;


  bool            fCurrentFolderReadOnly;
  bool            fCurrentLineContainedFlagInfo;
  bool            fFetchingAllFlags;
  bool            fWaitingForMoreClientInput;
  // when issuing a fetch command, are we fetching everything or just a part?
  bool            fFetchEverythingRFC822;
  // Is the server a Netscape 3.x Messaging Server?
  bool            fServerIsNetscape3xServer;
  bool            fDownloadingHeaders;
  bool            fCurrentCommandIsSingleMessageFetch;
  bool            fGotPermanentFlags;
  imapMessageFlagsType   fSavedFlagInfo;
  nsTArray<nsCString> fCustomFlags;

  PRUint16  fSupportsUserDefinedFlags;
  PRUint16  fSettablePermanentFlags;

  PRInt32           fFolderUIDValidity;
  PRInt32           fNumberOfUnseenMessages;
  PRInt32           fNumberOfExistingMessages;
  PRInt32           fNumberOfRecentMessages;
  PRUint32          fCurrentResponseUID;
  PRUint32          fHighestRecordedUID;
  // used to handle server that sends msg size after headers
  PRUint32          fReceivedHeaderOrSizeForUID;
  PRInt32           fSizeOfMostRecentMessage;
  PRInt32           fTotalDownloadSize;

  PRInt32           fStatusUnseenMessages;
  PRInt32           fStatusRecentMessages;
  PRUint32          fStatusNextUID;
  PRUint32          fStatusExistingMessages;

  int               fNumberOfTaggedResponsesExpected;

  char              *fCurrentCommandTag;

  nsCString         fZeroLengthMessageUidString;

  char              *fSelectedMailboxName;

  nsImapSearchResultSequence    *fSearchResults;

  nsCOMPtr <nsIImapFlagAndUidState> fFlagState;		// NOT owned by us, it's a copy, do not destroy

  eIMAPstate               fIMAPstate;

  eIMAPCapabilityFlags      fCapabilityFlag;
  nsCString     fMailAccountUrl;
  char          *fNetscapeServerVersionString;
  char          *fXSenderInfo; /* changed per message download */
  char          *fLastAlert; /* used to avoid displaying the same alert over and over */
  nsCString     fManageListsUrl;
  nsCString    fManageFiltersUrl;
  char          *fFolderAdminUrl;
  nsCString    fServerIdResponse; // RFC 

  PRInt32 fFetchResponseIndex;

  // used for aborting a fetch stream when we're pseudo-Interrupted
  PRInt32 numberOfCharsInThisChunk;
  PRInt32 charsReadSoFar;
  bool fLastChunk;

  // points to the current body shell, if any
  nsRefPtr<nsIMAPBodyShell> m_shell;

  // The connection object
  nsImapProtocol &fServerConnection;

  nsIImapHostSessionList *fHostSessionList;
  nsTArray<nsMsgKey> fCopyResponseKeyArray;
};

#endif
