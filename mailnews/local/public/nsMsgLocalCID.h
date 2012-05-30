/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgLocalCID_h__
#define nsMsgLocalCID_h__

#include "nsISupports.h"
#include "nsIFactory.h"
#include "nsIComponentManager.h"
#include "nsMsgBaseCID.h"

#define NS_POP3INCOMINGSERVER_TYPE "pop3"

//
// nsLocalMailFolderResourceCID
//
#define NS_LOCALMAILFOLDERRESOURCE_CONTRACTID \
  NS_RDF_RESOURCE_FACTORY_CONTRACTID_PREFIX "mailbox"
#define  NS_LOCALMAILFOLDERRESOURCE_CID              \
{ /* e490d22c-cd67-11d2-8cca-0060b0fc14a3 */         \
  0xe490d22c,                     \
    0xcd67,                                          \
    0x11d2,                                          \
    {0x8c, 0xca, 0x00, 0x60, 0xb0, 0xfc, 0x14, 0xa3} \
}

//
// nsPop3IncomingServer
//
#define NS_POP3INCOMINGSERVER_CONTRACTID \
  NS_MSGINCOMINGSERVER_CONTRACTID_PREFIX NS_POP3INCOMINGSERVER_TYPE

#define NS_POP3INCOMINGSERVER_CID                  \
{ /* D2876E51-E62C-11d2-B7FC-00805F05FFA5 */      \
 0xd2876e51, 0xe62c, 0x11d2,                      \
 {0xb7, 0xfc, 0x0, 0x80, 0x5f, 0x5, 0xff, 0xa5 }}

#ifdef HAVE_MOVEMAIL
//
// nsMovemailIncomingServer
//
#define NS_MOVEMAILINCOMINGSERVER_CONTRACTID \
  NS_MSGINCOMINGSERVER_CONTRACTID_PREFIX "movemail"

#define NS_MOVEMAILINCOMINGSERVER_CID                  \
{ /* efbb77e4-1dd2-11b2-bbcf-961563396fec */      \
 0xefbb77e4, 0x1dd2, 0x11b2,                      \
 {0xbb, 0xcf, 0x96, 0x15, 0x63, 0x39, 0x6f, 0xec }}

#endif /* HAVE_MOVEMAIL */

//
// nsNoIncomingServer
//
#define NS_NOINCOMINGSERVER_CONTRACTID \
  NS_MSGINCOMINGSERVER_CONTRACTID_PREFIX "none"

#define NS_NOINCOMINGSERVER_CID              \
{ /* {ca5ffe7e-5f47-11d3-9a51-004005263078} */  \
  0xca5ffe7e, 0x5f47, 0x11d3,       \
  {0x9a, 0x51, 0x00, 0x40, 0x05, 0x26, 0x30, 0x78}}


//
// nsMsgMailboxService
#define NS_MAILBOXSERVICE_CONTRACTID1  \
  "@mozilla.org/messenger/mailboxservice;1"

#define NS_MAILBOXSERVICE_CONTRACTID2 \
  "@mozilla.org/messenger/messageservice;1?type=mailbox"

#define NS_MAILBOXSERVICE_CONTRACTID3 \
  "@mozilla.org/messenger/messageservice;1?type=mailbox-message"

#define NS_MAILBOXSERVICE_CONTRACTID4 \
  NS_NETWORK_PROTOCOL_CONTRACTID_PREFIX "mailbox"

#define NS_MAILBOXSERVICE_CID                         \
{ /* EEF82462-CB69-11d2-8065-006008128C4E */      \
 0xeef82462, 0xcb69, 0x11d2,                      \
 {0x80, 0x65, 0x0, 0x60, 0x8, 0x12, 0x8c, 0x4e}}


//
// nsMailboxUrl
//
#define NS_MAILBOXURL_CONTRACTID  \
  "@mozilla.org/messenger/mailboxurl;1"

/* 46EFCB10-CB6D-11d2-8065-006008128C4E */
#define NS_MAILBOXURL_CID                      \
{ 0x46efcb10, 0xcb6d, 0x11d2,                  \
    { 0x80, 0x65, 0x0, 0x60, 0x8, 0x12, 0x8c, 0x4e } }


//
// nsPop3Url
//
#define NS_POP3URL_CONTRACTID \
  "@mozilla.org/messenger/popurl;1"

/* EA1B0A11-E6F4-11d2-8070-006008128C4E */
#define NS_POP3URL_CID                         \
{ 0xea1b0a11, 0xe6f4, 0x11d2,                   \
    { 0x80, 0x70, 0x0, 0x60, 0x8, 0x12, 0x8c, 0x4e } }


//
// nsPop3Service
//

#define NS_POP3SERVICE_CONTRACTID1 \
  "@mozilla.org/messenger/popservice;1"

#define NS_POP3SERVICE_CONTRACTID2 \
  NS_NETWORK_PROTOCOL_CONTRACTID_PREFIX "pop"

#define NS_POP3PROTOCOLINFO_CONTRACTID \
  NS_MSGPROTOCOLINFO_CONTRACTID_PREFIX NS_POP3INCOMINGSERVER_TYPE

#define NS_POP3SERVICE_CID                \
{ /* 3BB459E3-D746-11d2-806A-006008128C4E */      \
 0x3bb459e3, 0xd746, 0x11d2,              \
  { 0x80, 0x6a, 0x0, 0x60, 0x8, 0x12, 0x8c, 0x4e }}

//
// nsNoneService
//

#define NS_NONESERVICE_CONTRACTID \
  "@mozilla.org/messenger/noneservice;1"

#define NS_NONEPROTOCOLINFO_CONTRACTID \
  NS_MSGPROTOCOLINFO_CONTRACTID_PREFIX "none"

#define NS_NONESERVICE_CID                \
{ /* 75b63b46-1dd2-11b2-9873-bb375e1550fa */      \
 0x75b63b46, 0x1dd2, 0x11b2,              \
 { 0x98, 0x73, 0xbb, 0x37, 0x5e, 0x15, 0x50, 0xfa }}

#ifdef HAVE_MOVEMAIL
//
// nsMovemailService
//

#define NS_MOVEMAILSERVICE_CONTRACTID \
  "@mozilla.org/messenger/movemailservice;1"

#define NS_MOVEMAILPROTOCOLINFO_CONTRACTID \
  NS_MSGPROTOCOLINFO_CONTRACTID_PREFIX "movemail"

#define NS_MOVEMAILSERVICE_CID                \
{ /* 0e4db62e-1dd2-11b2-a5e4-f128fe4f1b69 */      \
 0x0e4db62e, 0x1dd2, 0x11b2,              \
 { 0xa5, 0xe4, 0xf1, 0x28, 0xfe, 0x4f, 0x1b, 0x69 }}
#endif /* HAVE_MOVEMAIL */

//
// nsParseMailMsgState
//
#define NS_PARSEMAILMSGSTATE_CONTRACTID \
  "@mozilla.org/messenger/messagestateparser;1"

#define NS_PARSEMAILMSGSTATE_CID \
{ /* 2B79AC51-1459-11d3-8097-006008128C4E */ \
 0x2b79ac51, 0x1459, 0x11d3, \
  {0x80, 0x97, 0x0, 0x60, 0x8, 0x12, 0x8c, 0x4e} }

//
// nsMsgMailboxParser
//

#define NS_MAILBOXPARSER_CONTRACTID \
  "@mozilla.org/messenger/mailboxparser;1"

/* 46EFCB10-CB6D-11d2-8065-006008128C4E */
#define NS_MAILBOXPARSER_CID                      \
{ 0x8597ab60, 0xd4e2, 0x11d2,                  \
    { 0x80, 0x69, 0x0, 0x60, 0x8, 0x12, 0x8c, 0x4e } }

#define NS_RSSSERVICE_CONTRACTID \
  "@mozilla.org/messenger/rssservice;1"

#define NS_RSSPROTOCOLINFO_CONTRACTID \
  NS_MSGPROTOCOLINFO_CONTRACTID_PREFIX "rss"

#define NS_RSSSERVICE_CID                \
{ /* 44aef4ce-475b-42e3-bc42-7730d5ce7365 */      \
 0x44aef4ce, 0x475b, 0x42e3,              \
 { 0xbc, 0x42, 0x77, 0x30, 0xd5, 0xce, 0x73, 0x65 }}

#define NS_RSSINCOMINGSERVER_CONTRACTID \
  NS_MSGINCOMINGSERVER_CONTRACTID_PREFIX "rss"

#define NS_RSSINCOMINGSERVER_CID                  \
{ /* 3a874285-5520-41a0-bcda-a3dee3dbf4f3 */      \
 0x3a874285, 0x5520, 0x41a0,                      \
 {0xbc, 0xda, 0xa3, 0xde, 0xe3, 0xdb, 0xf4, 0xf3 }}

#define NS_BRKMBOXSTORE_CID \
{ /* 36358199-a0e4-4b68-929f-77c01de34c67 */ \
 0x36358199, 0xa0e4, 0x4b68, \
 {0x92, 0x9f, 0x77, 0xc0, 0x1d, 0xe3, 0x4c, 0x67}}

#define NS_BRKMBOXSTORE_CONTRACTID \
  "@mozilla.org/msgstore/berkeleystore;1"

#define NS_MAILDIRSTORE_CID \
{ /* 1F993EDA-7DD9-11DF-819A-6257DFD72085 */ \
 0x1F993EDA, 0x7DD9, 0x11DF, \
 { 0x81, 0x9A, 0x62, 0x57, 0xDF, 0xD7, 0x20, 0x85 }}

#define NS_MAILDIRSTORE_CONTRACTID \
  "@mozilla.org/msgstore/maildirstore;1"

#endif // nsMsgLocalCID_h__
