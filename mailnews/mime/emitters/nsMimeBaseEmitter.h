/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsMimeBaseEmitter_h_
#define _nsMimeBaseEmitter_h_

#include "prio.h"
#include "nsIMimeEmitter.h"
#include "nsMimeRebuffer.h"
#include "nsIStreamListener.h"
#include "nsIInputStream.h"
#include "nsIOutputStream.h"
#include "nsIAsyncInputStream.h"
#include "nsIURI.h"
#include "nsIChannel.h"
#include "nsIMimeMiscStatus.h"
#include "nsIMsgHeaderParser.h"
#include "nsIPipe.h"
#include "nsIStringBundle.h"
#include "nsCOMPtr.h"
#include "nsVoidArray.h"
#include "nsIMimeConverter.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIDateTimeFormat.h"

//
// The base emitter will serve as the place to do all of the caching,
// sorting, etc... of mail headers and bodies for this internally developed
// emitter library. The other emitter classes in this file (nsMimeHTMLEmitter, etc.)
// will only be concerned with doing output processing ONLY.
//

//
// Used for keeping track of the attachment information...
//
typedef struct {
  char      *displayName;
  char      *urlSpec;
  char      *contentType;
  bool      isExternalAttachment;
} attachmentInfoType;

//
// For header info...
//
typedef struct {
  char      *name;
  char      *value;
} headerInfoType;

class nsMimeBaseEmitter : public nsIMimeEmitter,
                          public nsIInterfaceRequestor
{
public:
  nsMimeBaseEmitter ();
  virtual             ~nsMimeBaseEmitter (void);

  // nsISupports interface
  NS_DECL_THREADSAFE_ISUPPORTS

  NS_DECL_NSIMIMEEMITTER
  NS_DECL_NSIINTERFACEREQUESTOR

  // Utility output functions...
  NS_IMETHOD          UtilityWrite(const nsACString &buf);
  NS_IMETHOD          UtilityWriteCRLF(const char *buf);

  // For string bundle usage...
  char                *MimeGetStringByName(const char *aHeaderName);
  char                *MimeGetStringByID(int32_t aID);
  char                *LocalizeHeaderName(const char *aHeaderName, const char *aDefaultName);

  // For header processing...
  const char          *GetHeaderValue(const char  *aHeaderName);

  // To write out a stored header array as HTML
  virtual nsresult            WriteHeaderFieldHTMLPrefix(const nsACString &name);
  virtual nsresult            WriteHeaderFieldHTML(const char *field, const char *value);
  virtual nsresult            WriteHeaderFieldHTMLPostfix();

protected:
  // Internal methods...
  void                CleanupHeaderArray(nsVoidArray *aArray);

  // For header output...
  nsresult            DumpSubjectFromDate();
  nsresult            DumpToCC();
  nsresult            DumpRestOfHeaders();
  nsresult            OutputGenericHeader(const char *aHeaderVal);

  nsresult            WriteHelper(const nsACString &buf, uint32_t *countWritten);

  // For string bundle usage...
  nsCOMPtr<nsIStringBundle>  m_stringBundle;        // for translated strings
  nsCOMPtr<nsIStringBundle>  m_headerStringBundle;  // for non-translated header strings

  // For buffer management on output
  MimeRebuffer        *mBufferMgr;

  // mscott
  // don't ref count the streams....the emitter is owned by the converter
  // which owns these streams...
  //
  nsIOutputStream     *mOutStream;
  nsIInputStream      *mInputStream;
  nsIStreamListener   *mOutListener;
  nsCOMPtr<nsIChannel> mChannel;

  // For gathering statistics on processing...
  uint32_t            mTotalWritten;
  uint32_t            mTotalRead;

  // Output control and info...
  bool                mDocHeader;         // For header determination...
  nsIURI              *mURL;              // the url for the data being processed...
  int32_t             mHeaderDisplayType; // The setting for header output...
  nsCString           mHTMLHeaders;       // HTML Header Data...

  // For attachment processing...
  int32_t             mAttachCount;
  nsVoidArray         *mAttachArray;
  attachmentInfoType  *mCurrentAttachment;

  // For header caching...
  nsVoidArray         *mHeaderArray;
  nsVoidArray         *mEmbeddedHeaderArray;
  nsCOMPtr<nsIMsgHeaderParser>  mHeaderParser;

  // For body caching...
  bool                mBodyStarted;
  nsCString           mBody;
  bool                mFirstHeaders;

  // For the format being used...
  int32_t             mFormat;

  // For I18N Conversion...
  nsCOMPtr<nsIMimeConverter> mUnicodeConverter;
  nsString            mCharset;
  nsCOMPtr<nsIDateTimeFormat> mDateFormatter;
  nsresult GenerateDateString(const char * dateString, nsACString& formattedDate,
                              bool showDateForToday);
  // The caller is expected to free the result of GetLocalizedDateString
  char* GetLocalizedDateString(const char * dateString);
};

#endif /* _nsMimeBaseEmitter_h_ */
