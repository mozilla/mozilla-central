/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgCompUtils_H_
#define _nsMsgCompUtils_H_

#include "nscore.h"
#include "nsMsgSend.h"
#include "nsMsgCompFields.h"
#include "nsIMsgSend.h"
#include "nsIMsgCompUtils.h"

class nsIPrompt; 

#define ANY_SERVER "anyfolder://"

// these are msg hdr property names for storing the original
// msg uri's and disposition(replied/forwarded) when queuing
// messages to send later.
#define ORIG_URI_PROPERTY "origURIs"
#define QUEUED_DISPOSITION_PROPERTY "queuedDisposition"

class nsMsgCompUtils : public nsIMsgCompUtils
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGCOMPUTILS

  nsMsgCompUtils();
  virtual ~nsMsgCompUtils();
};

PR_BEGIN_EXTERN_C

//
// Create a file spec or file name using the name passed
// in as a template
//
nsresult    nsMsgCreateTempFile(const char *tFileName, nsIFile **tFile);
char        *nsMsgCreateTempFileName(const char *tFileName);


//
// Various utilities for building parts of MIME encoded 
// messages during message composition
//

nsresult    mime_sanity_check_fields_recipients (
                            const char *to,
                            const char *cc,
                            const char *bcc,
                            const char *newsgroups);

nsresult    mime_sanity_check_fields (
                            const char *from,
                            const char *reply_to,
                            const char *to,
                            const char *cc,
                            const char *bcc,
                            const char *fcc,
                            const char *newsgroups,
                            const char *followup_to,
                            const char * /*subject*/,
                            const char * /*references*/,
                            const char * /*organization*/,
                            const char * /*other_random_headers*/);

char        *mime_generate_headers (nsMsgCompFields *fields,
                                    const char *charset,
                                    nsMsgDeliverMode deliver_mode,
                                    nsIPrompt * aPrompt, nsresult *status);

char        *mime_make_separator(const char *prefix);
char        *mime_gen_content_id(uint32_t aPartNum, const char *aEmailAddress);

char        *mime_generate_attachment_headers (
                           const char *type,
                           const char *type_param,
                           const char *encoding,
                           const char *description,
                           const char *x_mac_type,
                           const char *x_mac_creator,
                           const char *real_name,
                           const char *base_url,
                           bool digest_p,
                           nsMsgAttachmentHandler *ma,
                           const char *attachmentCharset, // charset of the attachment (can be null)
                           const char *bodyCharset,       // charset of the main body
                           bool bodyIsAsciiOnly,
                           const char *content_id,
                           bool       aBodyDocument);

char        *msg_generate_message_id (nsIMsgIdentity*);

bool        mime_7bit_data_p (const char *string, uint32_t size);

char        *mime_fix_header_1 (const char *string, bool addr_p, bool news_p);
char        *mime_fix_header (const char *string);
char        *mime_fix_addr_header (const char *string);
char        *mime_fix_news_header (const char *string);

bool        mime_type_requires_b64_p (const char *type);
bool        mime_type_needs_charset (const char *type);

char        *msg_make_filename_qtext(const char *srcText, bool stripCRLFs);

// Rip apart the URL and extract a reasonable value for the `real_name' slot.
void        msg_pick_real_name (nsMsgAttachmentHandler *attachment, const PRUnichar *proposedName, const char *charset);

//
// Informational calls...
//
void        nsMsgMIMESetConformToStandard (bool conform_p);
bool        nsMsgMIMEGetConformToStandard (void);

//
// network service type calls...
//
nsresult    nsMsgNewURL(nsIURI** aInstancePtrResult, const char * aSpec);
bool        nsMsgIsLocalFile(const char *url);
char        *nsMsgGetLocalFileFromURL(const char *url);

char        *nsMsgParseURLHost(const char *url);

char        *GenerateFileNameFromURI(nsIURI *aURL);

//
// Folder calls...
//
void GetFolderURIFromUserPrefs(nsMsgDeliverMode   aMode, nsIMsgIdentity *identity, nsCString& uri);

// Check if we should use format=flowed
bool UseFormatFlowed(const char *charset);


PR_END_EXTERN_C


#endif /* _nsMsgCompUtils_H_ */

