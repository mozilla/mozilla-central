/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgLocalFolderHdrs_H
#define _nsMsgLocalFolderHdrs_H

/* The Netscape-specific header fields that we use for storing our
   various bits of state in mail folders.
 */
#define X_MOZILLA_STATUS           "X-Mozilla-Status"
#define X_MOZILLA_STATUS_FORMAT    X_MOZILLA_STATUS ": %04.4x"
#define X_MOZILLA_STATUS_LEN      /*1234567890123456*/      16

#define X_MOZILLA_STATUS2          "X-Mozilla-Status2"
#define X_MOZILLA_STATUS2_FORMAT   X_MOZILLA_STATUS2 ": %08.8x"
#define X_MOZILLA_STATUS2_LEN	  /*12345678901234567*/		17

#define X_MOZILLA_DRAFT_INFO	   "X-Mozilla-Draft-Info"
#define X_MOZILLA_DRAFT_INFO_LEN  /*12345678901234567890*/  20

#define X_MOZILLA_NEWSHOST         "X-Mozilla-News-Host"
#define X_MOZILLA_NEWSHOST_LEN    /*1234567890123456789*/   19

#define X_UIDL                     "X-UIDL"
#define X_UIDL_LEN                /*123456*/                 6

#define CONTENT_LENGTH             "Content-Length"
#define CONTENT_LENGTH_LEN        /*12345678901234*/        14

/* Provide a common means of detecting empty lines in a message. i.e. to detect the end of headers among other things...*/
#define EMPTY_MESSAGE_LINE(buf) (buf[0] == '\r' || buf[0] == '\n' || buf[0] == '\0')

/* blank filled header to store keyword/tags in the mailbox */
#define X_MOZILLA_KEYWORDS     "X-Mozilla-Keys" ":                                                                                 " MSG_LINEBREAK
#define X_MOZILLA_KEYWORDS_LEN (sizeof(X_MOZILLA_KEYWORDS) - 1)

#endif
