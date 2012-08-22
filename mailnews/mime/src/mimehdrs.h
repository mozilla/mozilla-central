/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEHDRS_H_
#define _MIMEHDRS_H_

#include "modlmime.h"

/* This file defines the interface to message-header parsing and formatting
   code, including conversion to HTML. */

/* Other structs defined later in this file.
 */

/* Creation and destruction.
 */
extern MimeHeaders *MimeHeaders_new (void);
//extern void MimeHeaders_free (MimeHeaders *);
//extern MimeHeaders *MimeHeaders_copy (MimeHeaders *);


/* Feed this method the raw data from which you would like a header
   block to be parsed, one line at a time.  Feed it a blank line when
   you're done.  Returns negative on allocation-related failure.
 */
extern int MimeHeaders_parse_line (const char *buffer, int32_t size,
                   MimeHeaders *hdrs);


/* Converts a MimeHeaders object into HTML, by writing to the provided
   output function.
 */
extern int MimeHeaders_write_headers_html (MimeHeaders *hdrs,
                       MimeDisplayOptions *opt,
                       bool               attachment);

/*
 * Writes all headers to the mime emitter.
 */
extern int
MimeHeaders_write_all_headers (MimeHeaders *, MimeDisplayOptions *, bool);

/* Writes the headers as text/plain.
   This writes out a blank line after the headers, unless
   dont_write_content_type is true, in which case the header-block
   is not closed off, and none of the Content- headers are written.
 */
extern int MimeHeaders_write_raw_headers (MimeHeaders *hdrs,
                      MimeDisplayOptions *opt,
                      bool dont_write_content_type);


/* Some crypto-related HTML-generated utility routines.
 * XXX This may not be needed. XXX
 */
extern char *MimeHeaders_open_crypto_stamp(void);
extern char *MimeHeaders_finish_open_crypto_stamp(void);
extern char *MimeHeaders_close_crypto_stamp(void);
extern char *MimeHeaders_make_crypto_stamp(bool encrypted_p,

   bool signed_p,

   bool good_p,

   bool unverified_p,

   bool close_parent_stamp_p,

   const char *stamp_url);

/* Does all the heuristic silliness to find the filename in the given headers.
 */
extern char *MimeHeaders_get_name(MimeHeaders *hdrs, MimeDisplayOptions *opt);

extern char *mime_decode_filename(const char *name, const char* charset,
                                  MimeDisplayOptions *opt);

extern "C"  char * MIME_StripContinuations(char *original);

/**
 * Convert this value to a unicode string, based on the charset.
 */
extern void MimeHeaders_convert_header_value(MimeDisplayOptions *opt,
                                             nsCString &value,
                                             bool convert_charset_only);
#endif /* _MIMEHDRS_H_ */
