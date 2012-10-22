/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsImapCore_H_
#define _nsImapCore_H_

#include "MailNewsTypes.h"
#include "nsStringGlue.h"
#include "nsIMailboxSpec.h"
#include "nsIImapFlagAndUidState.h"

class nsIMAPNamespace;
class nsImapProtocol;
class nsImapFlagAndUidState;

/* imap message flags */
typedef uint16_t imapMessageFlagsType;

/* used for communication between imap thread and event sinks */
#define kNoFlags     0x00 /* RFC flags */
#define kMarked      0x01
#define kUnmarked    0x02
#define kNoinferiors 0x04
#define kNoselect    0x08
#define kImapTrash   0x10 /* Navigator flag */
#define kJustExpunged 0x20 /* This update is a post expunge url update. */
#define kPersonalMailbox 0x40 /* this mailbox is in the personal namespace */
#define kPublicMailbox 0x80 /* this mailbox is in the public namespace */
#define kOtherUsersMailbox 0x100 /* this mailbox is in the other users' namespace */
#define kNameSpace 0x200 /* this mailbox IS a namespace */
#define kNewlyCreatedFolder 0x400 /* this folder was just created */
#define kImapDrafts 0x800 /* XLIST says this is the drafts folder */
#define kImapSpam 0x1000 /* XLIST says this is the spam folder */
#define kImapSent 0x2000 /* XLIST says this is the sent folder */
#define kImapInbox 0x4000 /* XLIST says this is the INBOX folder */
#define kImapAllMail 0x8000 /* XLIST says this is AllMail (GMail) */
#define kImapXListTrash 0x10000 /* XLIST says this is the trash */

/* flags for individual messages */
/* currently the ui only offers \Seen and \Flagged */
#define kNoImapMsgFlag                0x0000
#define kImapMsgSeenFlag              0x0001
#define kImapMsgAnsweredFlag          0x0002
#define kImapMsgFlaggedFlag           0x0004
#define kImapMsgDeletedFlag           0x0008
#define kImapMsgDraftFlag             0x0010
#define kImapMsgRecentFlag            0x0020
#define	kImapMsgForwardedFlag         0x0040		/* Not always supported, check mailbox folder */
#define kImapMsgMDNSentFlag           0x0080		/* Not always supported. check mailbox folder */
#define kImapMsgCustomKeywordFlag     0x0100            /* this msg has a custom keyword */
#define kImapMsgLabelFlags            0x0E00            /* supports 5 labels only supported if the folder supports keywords */
#define kImapMsgSupportMDNSentFlag    0x2000
#define kImapMsgSupportForwardedFlag  0x4000
/**
 * We use a separate xlist trash flag so we can prefer the GMail trash
 * over an existing Trash folder we may have created.
 */
#define kImapMsgSupportUserFlag       0x8000		
/* This seems to be the most cost effective way of
* piggying back the server support user flag info.
*/

/* if a url creator does not know the hierarchyDelimiter, use this */
#define kOnlineHierarchySeparatorUnknown '^'
#define kOnlineHierarchySeparatorNil '|'

#define IMAP_URL_TOKEN_SEPARATOR ">"
#define kUidUnknown -1
// Special initial value meaning ACLs need to be loaded from DB.
#define kAclInvalid ((uint32_t) -1)

// this has to do with Mime Parts on Demand. It used to live in net.h
// I'm not sure where this will live, but here is OK temporarily
typedef enum {
	IMAP_CONTENT_NOT_MODIFIED = 0,
	IMAP_CONTENT_MODIFIED_VIEW_INLINE,
	IMAP_CONTENT_MODIFIED_VIEW_AS_LINKS,
	IMAP_CONTENT_FORCE_CONTENT_NOT_MODIFIED
} IMAP_ContentModifiedType;

// I think this should really go in an imap.h equivalent file
typedef enum {
    kPersonalNamespace = 0,
    kOtherUsersNamespace,
    kPublicNamespace,
    kDefaultNamespace,
    kUnknownNamespace
} EIMAPNamespaceType;


/**
 * IMAP server feature, mostly CAPABILITY responses
 *
 * one of the cap flags below
 */
typedef uint64_t eIMAPCapabilityFlag;
/**
 * IMAP server features, mostly CAPABILITY responses
 *
 * any set of the cap flags below, i.e.
 * i.e. 0, 1 or more |eIMAPCapabilityFlag|.
 */
typedef uint64_t eIMAPCapabilityFlags;

const eIMAPCapabilityFlag kCapabilityUndefined = 0x00000000;
const eIMAPCapabilityFlag kCapabilityDefined = 0x00000001;
const eIMAPCapabilityFlag kHasAuthLoginCapability = 0x00000002;  /* AUTH LOGIN (not the same as kHasAuthOldLoginCapability) */
const eIMAPCapabilityFlag kHasAuthOldLoginCapability = 0x00000004;  /* original IMAP login method */
const eIMAPCapabilityFlag kHasXSenderCapability = 0x00000008;
const eIMAPCapabilityFlag kIMAP4Capability = 0x00000010;           /* RFC1734 */
const eIMAPCapabilityFlag kIMAP4rev1Capability = 0x00000020;       /* RFC2060 */
const eIMAPCapabilityFlag kIMAP4other = 0x00000040;                        /* future rev?? */
const eIMAPCapabilityFlag kNoHierarchyRename = 0x00000080;                         /* no hierarchy rename */
const eIMAPCapabilityFlag kACLCapability = 0x00000100;           /* ACL extension */
const eIMAPCapabilityFlag kNamespaceCapability = 0x00000200;     /* IMAP4 Namespace Extension */
const eIMAPCapabilityFlag kHasIDCapability = 0x00000400;  /* client user agent id extension */
const eIMAPCapabilityFlag kXServerInfoCapability = 0x00000800;  /* XSERVERINFO extension for admin urls */
const eIMAPCapabilityFlag kHasAuthPlainCapability = 0x00001000; /* new form of auth plain base64 login */
const eIMAPCapabilityFlag kUidplusCapability = 0x00002000;   /* RFC 2359 UIDPLUS extension */
const eIMAPCapabilityFlag kLiteralPlusCapability = 0x00004000; /* RFC 2088 LITERAL+ extension */
const eIMAPCapabilityFlag kAOLImapCapability = 0x00008000;     /* aol imap extensions */
const eIMAPCapabilityFlag kHasLanguageCapability = 0x00010000; /* language extensions */
const eIMAPCapabilityFlag kHasCRAMCapability = 0x00020000; /* CRAM auth extension */
const eIMAPCapabilityFlag kQuotaCapability = 0x00040000; /* RFC 2087 quota extension */
const eIMAPCapabilityFlag kHasIdleCapability = 0x00080000;  /* RFC 2177 idle extension */
const eIMAPCapabilityFlag kHasAuthNTLMCapability = 0x00100000;  /* AUTH NTLM extension */
const eIMAPCapabilityFlag kHasAuthMSNCapability = 0x00200000;   /* AUTH MSN extension */
const eIMAPCapabilityFlag kHasStartTLSCapability =0x00400000;   /* STARTTLS support */
const eIMAPCapabilityFlag kHasAuthNoneCapability = 0x00800000; /* needs no login */
const eIMAPCapabilityFlag kHasAuthGssApiCapability = 0x01000000; /* GSSAPI AUTH */
const eIMAPCapabilityFlag kHasCondStoreCapability = 0x02000000; /* RFC 3551 CondStore extension */
const eIMAPCapabilityFlag kHasEnableCapability = 0x04000000; /* RFC 5161 ENABLE extension */
const eIMAPCapabilityFlag kHasXListCapability = 0x08000000;  /* XLIST extension */
const eIMAPCapabilityFlag kHasCompressDeflateCapability = 0x10000000;  /* RFC 4978 COMPRESS extension */
const eIMAPCapabilityFlag kHasAuthExternalCapability = 0x20000000;  /* RFC 2222 SASL AUTH EXTERNAL */
const eIMAPCapabilityFlag kHasMoveCapability = 0x40000000;  /* Proposed MOVE RFC */
const eIMAPCapabilityFlag kHasHighestModSeqCapability = 0x80000000;  /* Subset of RFC 3551 */
// above are 32bit; below start the uint64_t bits 33-64
const eIMAPCapabilityFlag kHasExtendedListCapability = 0x100000000LL;  /* RFC 5258 */
const eIMAPCapabilityFlag kHasSpecialUseCapability = 0x200000000LL;  /* RFC 6154: Sent, Draft etc. folders */


// this used to be part of the connection object class - maybe we should move it into 
// something similar
typedef enum {
    kEveryThingRFC822,
    kEveryThingRFC822Peek,
    kHeadersRFC822andUid,
    kUid,
    kFlags,
    kRFC822Size,
    kRFC822HeadersOnly,
    kMIMEPart,
    kMIMEHeader,
    kBodyStart
} nsIMAPeFetchFields;

typedef struct _utf_name_struct {
	bool toUtf7Imap;
	unsigned char *sourceString;
	unsigned char *convertedString;
} utf_name_struct;

typedef struct _ProgressInfo {
  PRUnichar *message;
  int32_t currentProgress;
  int32_t maxProgress;
} ProgressInfo;

typedef enum {
    eContinue,
    eContinueNew,
    eListMyChildren,
    eNewServerDirectory,
    eCancelled 
} EMailboxDiscoverStatus;

#endif
