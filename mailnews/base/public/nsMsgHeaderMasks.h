/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _msgHeaderMasks_h_
#define _msgHeaderMasks_h_

DO NOT USE ANYMORE!!!
/* This set enumerates the header fields which may be displayed in the
   message composition window.
 */
#define MSG_FROM_HEADER_MASK                0x00000001
#define MSG_REPLY_TO_HEADER_MASK            0x00000002
#define MSG_TO_HEADER_MASK					        0x00000004
#define MSG_CC_HEADER_MASK					        0x00000008
#define MSG_BCC_HEADER_MASK					        0x00000010
#define MSG_FCC_HEADER_MASK					        0x00000020
#define MSG_NEWSGROUPS_HEADER_MASK          0x00000040
#define MSG_FOLLOWUP_TO_HEADER_MASK         0x00000080
#define MSG_SUBJECT_HEADER_MASK             0x00000100
#define MSG_ATTACHMENTS_HEADER_MASK         0x00000200

/* These next four are typically not ever displayed in the UI, but are still
   stored and used internally. */
#define MSG_ORGANIZATION_HEADER_MASK		    0x00000400
#define MSG_REFERENCES_HEADER_MASK			    0x00000800
#define MSG_OTHERRANDOMHEADERS_HEADER_MASK  0x00001000
#define MSG_NEWSPOSTURL_HEADER_MASK			    0x00002000

#define MSG_PRIORITY_HEADER_MASK			      0x00004000
//#define MSG_NEWS_FCC_HEADER_MASK			0x00008000
//#define MSG_MESSAGE_ENCODING_HEADER_MASK	0x00010000
#define MSG_CHARACTER_SET_HEADER_MASK		    0x00008000
#define MSG_MESSAGE_ID_HEADER_MASK			    0x00010000
//#define MSG_NEWS_BCC_HEADER_MASK            0x00080000

/* This is also not exposed to the UI; it's used internally to help remember
   whether the original message had an HTML portion that we can quote. */
//#define MSG_HTML_PART_HEADER_MASK			0x00100000

/* The "body=" pseudo-header (as in "mailto:me?body=hi+there") */
//#define MSG_DEFAULTBODY_HEADER_MASK			0x00200000

#define MSG_X_TEMPLATE_HEADER_MASK          0x00020000

#define MSG_FCC2_HEADER_MASK                0x00400000

/* IMAP folders for posting */
//#define MSG_IMAP_FOLDER_HEADER_MASK			0x02000000


#endif
