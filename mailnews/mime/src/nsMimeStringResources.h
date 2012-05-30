/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _NAME_OF_THIS_HEADER_FILE__
#define _NAME_OF_THIS_HEADER_FILE__

/* Note that the negative values are not actually strings: they are error
 * codes masquerading as strings. Do not pass them to MimeGetStringByID()
 * expecting to get anything back for your trouble.
 */
#define  MIME_OUT_OF_MEMORY                        -1000
#define  MIME_UNABLE_TO_OPEN_TMP_FILE              -1001
#define  MIME_ERROR_WRITING_FILE                   -1002
#define  MIME_MHTML_SUBJECT                        1000
#define  MIME_MHTML_RESENT_COMMENTS                1001
#define  MIME_MHTML_RESENT_DATE                    1002
#define  MIME_MHTML_RESENT_SENDER                  1003
#define  MIME_MHTML_RESENT_FROM                    1004
#define  MIME_MHTML_RESENT_TO                      1005
#define  MIME_MHTML_RESENT_CC                      1006
#define  MIME_MHTML_DATE                           1007
#define  MIME_MHTML_SENDER                         1008
#define  MIME_MHTML_FROM                           1009
#define  MIME_MHTML_REPLY_TO                       1010
#define  MIME_MHTML_ORGANIZATION                   1011
#define  MIME_MHTML_TO                             1012
#define  MIME_MHTML_CC                             1013
#define  MIME_MHTML_NEWSGROUPS                     1014
#define  MIME_MHTML_FOLLOWUP_TO                    1015
#define  MIME_MHTML_REFERENCES                     1016
#define  MIME_MHTML_MESSAGE_ID                     1021
#define  MIME_MHTML_BCC                            1023
#define  MIME_MSG_LINK_TO_DOCUMENT                 1026
#define  MIME_MSG_DOCUMENT_INFO                    1027
#define  MIME_MSG_ATTACHMENT                       1028
#define  MIME_MSG_DEFAULT_ATTACHMENT_NAME          1040
#define  MIME_FORWARDED_MESSAGE_HTML_USER_WROTE    1041

#endif /* _NAME_OF_THIS_HEADER_FILE__ */
