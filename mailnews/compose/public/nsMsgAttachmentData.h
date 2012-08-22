/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef __MSGATTACHMENTDATA_H__
#define __MSGATTACHMENTDATA_H__

#include "nsIURL.h"
#include "nsStringGlue.h"
#include "nsIMsgSend.h"

// Attachment file/URL structures - we're letting libmime use this directly
class nsMsgAttachmentData : public nsIMsgAttachmentData
{
public:
  NS_DECL_NSIMSGATTACHMENTDATA
  NS_DECL_ISUPPORTS

  nsMsgAttachmentData();
  ~nsMsgAttachmentData();

  nsCOMPtr<nsIURI> m_url;   // The URL to attach.

  nsCString m_desiredType;  // The type to which this document should be
                            // converted.  Legal values are NULL, TEXT_PLAIN
                            // and APPLICATION_POSTSCRIPT (which are macros
                            // defined in net.h); other values are ignored.

  nsCString m_realType;     // The type of the URL if known, otherwise NULL. For example, if 
                            // you were attaching a temp file which was known to contain HTML data, 
                            // you would pass in TEXT_HTML as the real_type, to override whatever type 
                            // the name of the tmp file might otherwise indicate.

  nsCString m_realEncoding; // Goes along with real_type

  nsCString m_realName;     // The original name of this document, which will eventually show up in the 
                            // Content-Disposition header. For example, if you had copied a document to a 
                            // tmp file, this would be the original, human-readable name of the document.

  nsCString m_description;  // If you put a string here, it will show up as the Content-Description header.  
                            // This can be any explanatory text; it's not a file name.             

  nsCString m_disposition;  // The Content-Disposition header (if any). a
                            // nsMsgAttachmentData can very well have
                            // Content-Disposition: inline value, instead of
                            // "attachment".
  nsCString m_cloudPartInfo; // For X-Mozilla-Cloud-Part header, if any

  // Mac-specific data that should show up as optional parameters
  // to the content-type header.
  nsCString m_xMacType;
  nsCString m_xMacCreator;

  int32_t m_size;                  // The size of the attachment. May be 0.
  bool    m_isExternalAttachment;  // Flag for determining if the attachment is external
  bool    m_isDownloaded;          // Flag for determining if the attachment has already been downloaded
  bool    m_hasFilename;           // Tells whether the name is provided by us or if it's a Part 1.2-like attachment
  bool    m_displayableInline;     // Tells whether the attachment could be displayed inline
};

class nsMsgAttachedFile : public nsIMsgAttachedFile
{
public:
  NS_DECL_NSIMSGATTACHEDFILE
  NS_DECL_ISUPPORTS

  nsMsgAttachedFile();
  ~nsMsgAttachedFile();

  nsCOMPtr<nsIURI> m_origUrl; // Where it came from on the network (or even elsewhere on the local disk.)

  nsCOMPtr<nsIFile>  m_tmpFile;    // The tmp file in which the (possibly converted) data now resides.

  nsCString m_type;        // The type of the data in file_name (not necessarily the same as the type of orig_url.)

  nsCString m_encoding;    // Likewise, the encoding of the tmp file. This will be set only if the original 
                            // document had an encoding already; we don't do base64 encoding and so forth until 
                            // it's time to assemble a full MIME message of all parts.


  nsCString m_description;    // For Content-Description header
  nsCString m_cloudPartInfo; // For X-Mozilla-Cloud-Part header, if any
  nsCString m_xMacType;    // mac-specific info 
  nsCString m_xMacCreator; // mac-specific info 
  nsCString m_realName;      // The real name of the file. 

  // Some statistics about the data that was written to the file, so that when
  // it comes time to compose a MIME message, we can make an informed decision
  // about what Content-Transfer-Encoding would be best for this attachment.
  // (If it's encoded already, we ignore this information and ship it as-is.)
  uint32_t    m_size;
  uint32_t    m_unprintableCount;
  uint32_t    m_highbitCount;
  uint32_t    m_ctlCount;
  uint32_t    m_nullCount;
  uint32_t    m_maxLineLength;
};
#endif
