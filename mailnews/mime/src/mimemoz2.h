/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEMOZ_H_
#define _MIMEMOZ_H_

#include "prtypes.h"
#include "nsStreamConverter.h"
#include "nsIMimeEmitter.h"
#include "nsIURI.h"
#include "mozITXTToHTMLConv.h"
#include "nsIMsgSend.h"
#include "nsIMimeConverter.h"

// SHERRY - Need to get these out of here eventually

#ifdef XP_UNIX
#undef Bool
#endif



#include "mimei.h"

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

#include "nsIPrefBranch.h"

typedef struct _nsMIMESession nsMIMESession;

/* stream functions */
typedef unsigned int
(*MKSessionWriteReadyFunc) (nsMIMESession *stream);

#define MAX_WRITE_READY (((unsigned) (~0) << 1) >> 1)   /* must be <= than MAXINT!!!!! */

typedef int
(*MKSessionWriteFunc) (nsMIMESession *stream, const char *str, PRInt32 len);

typedef void
(*MKSessionCompleteFunc) (nsMIMESession *stream);

typedef void
(*MKSessionAbortFunc) (nsMIMESession *stream, int status);

/* streamclass function */
struct _nsMIMESession {

    const char * name;         /* Just for diagnostics */

    void       * window_id;    /* used for progress messages, etc. */

    void       * data_object;  /* a pointer to whatever
                                * structure you wish to have
                                * passed to the routines below
                                * during writes, etc...
                                *
                                * this data object should hold
                                * the document, document
                                * structure or a pointer to the
                                * document.
                                */

    MKSessionWriteReadyFunc  is_write_ready;   /* checks to see if the stream is ready
                                               * for writing.  Returns 0 if not ready
                                               * or the number of bytes that it can
                                               * accept for write
                                               */
    MKSessionWriteFunc       put_block;        /* writes a block of data to the stream */
    MKSessionCompleteFunc    complete;         /* normal end */
    MKSessionAbortFunc       abort;            /* abnormal end */

    bool                    is_multipart;    /* is the stream part of a multipart sequence */
};

/*
 * This is for the reworked mime parser.
 */
class mime_stream_data {           /* This object is the state we pass around
                                       amongst the various stream functions
                                       used by MIME_MessageConverter(). */
public:
  mime_stream_data();

  char                *url_name;
  char                *orig_url_name; /* original url name */
  nsCOMPtr<nsIChannel> channel;
  nsMimeOutputType    format_out;
  void                *pluginObj2;  /* The new XP-COM stream converter object */
  nsMIMESession       *istream;     /* Holdover - new stream we're writing out image data-if any. */
  MimeObject          *obj;         /* The root parser object */
  MimeDisplayOptions  *options;     /* Data for communicating with libmime.a */
  MimeHeaders         *headers;     /* Copy of outer most mime header */

  nsIMimeEmitter      *output_emitter;  /* Output emitter engine for libmime */
  bool                firstCheck;   /* Is this the first look at the stream data */
};

//
// This object is the state we use for loading drafts and templates...
//
class mime_draft_data
{
public:
  mime_draft_data();
  char                *url_name;           // original url name */
  nsMimeOutputType    format_out;          // intended output format; should be FO_OPEN_DRAFT */
  nsMIMESession       *stream;             // not used for now
  MimeObject          *obj;                // The root
  MimeDisplayOptions  *options;            // data for communicating with libmime
  MimeHeaders         *headers;            // Copy of outer most mime header
  nsTArray<nsMsgAttachedFile*> attachments;// attachments
  nsMsgAttachedFile   *messageBody;        // message body
  nsMsgAttachedFile   *curAttachment;       // temp

  nsCOMPtr <nsIFile> tmpFile;
  nsCOMPtr <nsIOutputStream> tmpFileStream;      // output file handle

  MimeDecoderData     *decoder_data;
  char                *mailcharset;        // get it from CHARSET of Content-Type
  bool                forwardInline;
  bool                forwardInlineFilter;
  bool                overrideComposeFormat; // Override compose format (for forward inline).
  nsString            forwardToAddress;
  nsCOMPtr<nsIMsgIdentity>      identity;
  char                *originalMsgURI;     // the original URI of the message we are currently processing
  nsCOMPtr<nsIMsgDBHdr>         origMsgHdr;
};

////////////////////////////////////////////////////////////////
// Bridge routines for legacy mime code
////////////////////////////////////////////////////////////////

// Create bridge stream for libmime
extern "C"
void         *mime_bridge_create_display_stream(nsIMimeEmitter      *newEmitter,
                                                nsStreamConverter   *newPluginObj2,
                                                nsIURI              *uri,
                                                nsMimeOutputType    format_out,
                                                PRUint32            whattodo,
                                                nsIChannel          *aChannel);

// To get the mime emitter...
extern "C" nsIMimeEmitter   *GetMimeEmitter(MimeDisplayOptions *opt);

// To support 2 types of emitters...we need these routines :-(
extern "C" nsresult     mimeSetNewURL(nsMIMESession *stream, char *url);
extern "C" nsresult     mimeEmitterAddAttachmentField(MimeDisplayOptions *opt, const char *field, const char *value);
extern "C" nsresult     mimeEmitterAddHeaderField(MimeDisplayOptions *opt, const char *field, const char *value);
extern "C" nsresult     mimeEmitterAddAllHeaders(MimeDisplayOptions *opt, const char *allheaders, const PRInt32 allheadersize);
extern "C" nsresult     mimeEmitterStartAttachment(MimeDisplayOptions *opt, const char *name, const char *contentType, const char *url,
                                                   bool aIsExternalAttachment);
extern "C" nsresult     mimeEmitterEndAttachment(MimeDisplayOptions *opt);
extern "C" nsresult     mimeEmitterEndAllAttachments(MimeDisplayOptions *opt);
extern "C" nsresult     mimeEmitterStartBody(MimeDisplayOptions *opt, bool bodyOnly, const char *msgID, const char *outCharset);
extern "C" nsresult     mimeEmitterEndBody(MimeDisplayOptions *opt);
extern "C" nsresult     mimeEmitterEndHeader(MimeDisplayOptions *opt, MimeObject *obj);
extern "C" nsresult     mimeEmitterStartHeader(MimeDisplayOptions *opt, bool rootMailHeader, bool headerOnly, const char *msgID,
                                               const char *outCharset);
extern "C" nsresult     mimeEmitterUpdateCharacterSet(MimeDisplayOptions *opt, const char *aCharset);

extern "C" nsresult     MimeGetAttachmentList(MimeObject *tobj, const char *aMessageURL, nsMsgAttachmentData **data);

/* To Get the connnection to prefs service manager */
extern "C" nsIPrefBranch      *GetPrefBranch(MimeDisplayOptions *opt);

// Get the text converter...
mozITXTToHTMLConv           *GetTextConverter(MimeDisplayOptions *opt);

nsresult
HTML2Plaintext(const nsString& inString, nsString& outString,
               PRUint32 flags, PRUint32 wrapCol);
nsresult
HTMLSanitize(const nsString& inString, nsString& outString);

extern "C" char             *MimeGetStringByID(PRInt32 stringID);
extern "C" char             *MimeGetStringByName(const PRUnichar *stringName);

// Utility to create a nsIURI object...
extern "C" nsresult         nsMimeNewURI(nsIURI** aInstancePtrResult, const char *aSpec, nsIURI *aBase);

extern "C" nsresult SetMailCharacterSetToMsgWindow(MimeObject *obj, const char *aCharacterSet);

extern "C"  nsresult GetMailNewsFont(MimeObject *obj, bool styleFixed, PRInt32 *fontPixelSize, PRInt32 *fontSizePercentage, nsCString& fontLang);


#ifdef __cplusplus
}
#endif /* __cplusplus */

#endif /* _MIMEMOZ_H_ */

