/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIPrefLocalizedString.h"
#include "nsILineInputStream.h"
#include "nsMsgAttachmentHandler.h"
#include "prmem.h"
#include "nsMsgCopy.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsMsgSend.h"
#include "nsMsgCompUtils.h"
#include "nsMsgI18N.h"
#include "nsURLFetcher.h"
#include "nsMimeTypes.h"
#include "nsMsgCompCID.h"
#include "nsIMsgMessageService.h"
#include "nsMsgUtils.h"
#include "nsMsgPrompts.h"
#include "nsTextFormatter.h"
#include "nsIPrompt.h"
#include "nsITextToSubURI.h"
#include "nsIURL.h"
#include "nsIFileURL.h"
#include "nsNetCID.h"
#include "nsIMimeStreamConverter.h"
#include "nsMsgMimeCID.h"
#include "nsNetUtil.h"
#include "nsNativeCharsetUtils.h"
#include "nsComposeStrings.h"
#include "nsIZipWriter.h"
#include "nsIDirectoryEnumerator.h"
#include "mozilla/Services.h"
#include "mozilla/mailnews/MimeEncoder.h"

///////////////////////////////////////////////////////////////////////////
// Mac Specific Attachment Handling for AppleDouble Encoded Files
///////////////////////////////////////////////////////////////////////////
#ifdef XP_MACOSX

#define AD_WORKING_BUFF_SIZE                  8192

extern void         MacGetFileType(nsIFile *fs, bool *useDefault, char **type, char **encoding);

#include "nsILocalFileMac.h"

/* static */
nsresult nsSimpleZipper::Zip(nsIFile *aInputFile, nsIFile *aOutputFile)
{
  // create zipwriter object
  nsresult rv;
  nsCOMPtr<nsIZipWriter> zipWriter = do_CreateInstance("@mozilla.org/zipwriter;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = zipWriter->Open(aOutputFile, PR_RDWR | PR_CREATE_FILE | PR_TRUNCATE);
  NS_ENSURE_SUCCESS(rv, rv); 
  
  rv = AddToZip(zipWriter, aInputFile, EmptyCString());
  NS_ENSURE_SUCCESS(rv, rv);

  // we're done.
  zipWriter->Close();
  return rv;
}

/* static */
nsresult nsSimpleZipper::AddToZip(nsIZipWriter *aZipWriter, 
                                  nsIFile *aFile,
                                  const nsACString &aPath)
{
  // find out the path this file/dir should have in the zip
  nsCString leafName;
  aFile->GetNativeLeafName(leafName);
  nsCString currentPath(aPath);
  currentPath += leafName;
    
  bool isDirectory;
  aFile->IsDirectory(&isDirectory);
  // append slash for a directory entry
  if (isDirectory)
    currentPath.Append('/');
  
  // add the file or directory entry to the zip
  nsresult rv = aZipWriter->AddEntryFile(currentPath, nsIZipWriter::COMPRESSION_DEFAULT, aFile, false);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // if it's a directory, add all its contents too
  if (isDirectory) {
    nsCOMPtr<nsISimpleEnumerator> e;
    nsresult rv = aFile->GetDirectoryEntries(getter_AddRefs(e));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIDirectoryEnumerator> dirEnumerator = do_QueryInterface(e, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIFile> currentFile;
    while (NS_SUCCEEDED(dirEnumerator->GetNextFile(getter_AddRefs(currentFile))) && currentFile) {
      rv = AddToZip(aZipWriter, currentFile, currentPath);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }
  
  return NS_OK;
}
#endif // XP_MACOSX

//
// Class implementation...
//
nsMsgAttachmentHandler::nsMsgAttachmentHandler() :
  mRequest(nullptr),
  mCompFields(nullptr),   // Message composition fields for the sender
  m_bogus_attachment(false),
  m_done(false),
  m_already_encoded_p(false),
  m_decrypted_p(false),
  mDeleteFile(false),
  mMHTMLPart(false),
  mPartUserOmissionOverride(false),
  mMainBody(false),
  mSendViaCloud(false),
  mNodeIndex(-1),
  // For analyzing the attachment file...
  m_size(0),
  m_unprintable_count(0),
  m_highbit_count(0),
  m_ctl_count(0),
  m_null_count(0),
  m_have_cr(0), 
  m_have_lf(0), 
  m_have_crlf(0),
  m_prev_char_was_cr(false),
  m_current_column(0),
  m_max_column(0),
  m_lines(0),
  m_file_analyzed(false),

  // Mime
  m_encoder(nullptr)
{
}

nsMsgAttachmentHandler::~nsMsgAttachmentHandler()
{
  if (mTmpFile && mDeleteFile)
    mTmpFile->Remove(false);

  if (mOutFile)
    mOutFile->Close();

  CleanupTempFile();
}

void
nsMsgAttachmentHandler::CleanupTempFile()
{
#ifdef XP_MACOSX
  if (mEncodedWorkingFile) {
    mEncodedWorkingFile->Remove(false);
    mEncodedWorkingFile = nullptr;
  }
#endif // XP_MACOSX
}

void
nsMsgAttachmentHandler::AnalyzeDataChunk(const char *chunk, int32_t length)
{
  unsigned char *s = (unsigned char *) chunk;
  unsigned char *end = s + length;
  for (; s < end; s++)
  {
    if (*s > 126)
    {
      m_highbit_count++;
      m_unprintable_count++;
    }
    else if (*s < ' ' && *s != '\t' && *s != '\r' && *s != '\n')
    {
      m_unprintable_count++;
      m_ctl_count++;
      if (*s == 0)
        m_null_count++;
    }

    if (*s == '\r' || *s == '\n')
    {
      if (*s == '\r')
      {
        if (m_prev_char_was_cr)
          m_have_cr = 1;
        else
          m_prev_char_was_cr = true;
      }
      else
      {
        if (m_prev_char_was_cr)
        {
          if (m_current_column == 0)
          {
            m_have_crlf = 1;
            m_lines--;
          }
          else
            m_have_cr = m_have_lf = 1;
          m_prev_char_was_cr = false;
        }
        else
          m_have_lf = 1;
      }
      if (m_max_column < m_current_column)
        m_max_column = m_current_column;
      m_current_column = 0;
      m_lines++;
    }
    else
    {
      m_current_column++;
    }
  }
}

void
nsMsgAttachmentHandler::AnalyzeSnarfedFile(void)
{
  char chunk[1024];
  uint32_t numRead = 0;

  if (m_file_analyzed)
    return;

  if (mTmpFile)
  {
    int64_t fileSize;
    mTmpFile->GetFileSize(&fileSize);
    m_size = (uint32_t) fileSize;
    nsCOMPtr <nsIInputStream> inputFile;
    nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(inputFile), mTmpFile);
    if (NS_FAILED(rv))
      return;
    {
      do
      {
        rv = inputFile->Read(chunk, sizeof(chunk), &numRead);
        if (numRead)
          AnalyzeDataChunk(chunk, numRead);
      }
      while (numRead && NS_SUCCEEDED(rv));
      if (m_prev_char_was_cr)
        m_have_cr = 1;

      inputFile->Close();
      m_file_analyzed = true;
    }
  }
}

//
// Given a content-type and some info about the contents of the document,
// decide what encoding it should have.
//
nsresult
nsMsgAttachmentHandler::PickEncoding(const char *charset, nsIMsgSend *mime_delivery_state)
{
  nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));

  bool needsB64 = false;
  bool forceB64 = false;

  if (mSendViaCloud)
  {
    m_encoding = ENCODING_7BIT;
    return NS_OK;
  }
  if (m_already_encoded_p)
    goto DONE;

  AnalyzeSnarfedFile();

  /* Allow users to override our percentage-wise guess on whether
  the file is text or binary */
  if (pPrefBranch)
    pPrefBranch->GetBoolPref ("mail.file_attach_binary", &forceB64);

  if (!mMainBody && (forceB64 || mime_type_requires_b64_p (m_type.get()) ||
    m_have_cr + m_have_lf + m_have_crlf != 1))
  {
    /* If the content-type is "image/" or something else known to be binary
       or several flavors of newlines are present, always use base64
       (so that we don't get confused by newline conversions.)
     */
    needsB64 = true;
  }
  else
  {
  /* Otherwise, we need to pick an encoding based on the contents of
  the document.
     */

    bool encode_p;
    bool force_p = false;

    /*
      force quoted-printable if the sender does not allow
      conversion to 7bit
    */
    if (mCompFields) {
      if (mCompFields->GetForceMsgEncoding())
        force_p = true;
    }
    else if (mime_delivery_state) {
      if (((nsMsgComposeAndSend *)mime_delivery_state)->mCompFields->GetForceMsgEncoding())
        force_p = true;
    }

    if (force_p || (m_max_column > 900))
      encode_p = true;
    else if (UseQuotedPrintable() && m_unprintable_count)
      encode_p = true;

      else if (m_null_count)  /* If there are nulls, we must always encode,
        because sendmail will blow up. */
        encode_p = true;
      else
        encode_p = false;

        /* MIME requires a special case that these types never be encoded.
      */
      if (StringBeginsWith(m_type, NS_LITERAL_CSTRING("message"),
                           nsCaseInsensitiveCStringComparator()) ||
         StringBeginsWith(m_type, NS_LITERAL_CSTRING("multipart"),
                          nsCaseInsensitiveCStringComparator()))
      {
        encode_p = false;
        if (m_desiredType.LowerCaseEqualsLiteral(TEXT_PLAIN))
          m_desiredType.Truncate();
      }

      // If the Mail charset is multibyte, we force it to use Base64 for attachments.
      if ((!mMainBody && charset && nsMsgI18Nmultibyte_charset(charset)) &&
          (m_type.LowerCaseEqualsLiteral(TEXT_HTML) ||
           m_type.LowerCaseEqualsLiteral(TEXT_MDL) ||
           m_type.LowerCaseEqualsLiteral(TEXT_PLAIN) ||
           m_type.LowerCaseEqualsLiteral(TEXT_RICHTEXT) ||
           m_type.LowerCaseEqualsLiteral(TEXT_ENRICHED) ||
           m_type.LowerCaseEqualsLiteral(TEXT_VCARD) ||
           m_type.LowerCaseEqualsLiteral(APPLICATION_DIRECTORY) || /* text/x-vcard synonym */
           m_type.LowerCaseEqualsLiteral(TEXT_CSS) ||
           m_type.LowerCaseEqualsLiteral(TEXT_JSSS)))
        needsB64 = true;
      else if (charset && nsMsgI18Nstateful_charset(charset))
        m_encoding = ENCODING_7BIT;
      else if (encode_p &&
        m_unprintable_count > (m_size / 10))
        /* If the document contains more than 10% unprintable characters,
        then that seems like a good candidate for base64 instead of
        quoted-printable.
        */
        needsB64 = true;
      else if (encode_p)
        m_encoding = ENCODING_QUOTED_PRINTABLE;
      else if (m_highbit_count > 0)
        m_encoding = ENCODING_8BIT;
      else
        m_encoding = ENCODING_7BIT;
  }

  // always base64 binary data.
  if (needsB64)
    m_encoding = ENCODING_BASE64;

  /* Now that we've picked an encoding, initialize the filter.
  */
  NS_ASSERTION(!m_encoder, "not-null m_encoder");
  if (m_encoding.LowerCaseEqualsLiteral(ENCODING_BASE64))
  {
    m_encoder = MimeEncoder::GetBase64Encoder(mime_encoder_output_fn,
      mime_delivery_state);
  }
  else if (m_encoding.LowerCaseEqualsLiteral(ENCODING_QUOTED_PRINTABLE))
  {
    m_encoder = MimeEncoder::GetQPEncoder(mime_encoder_output_fn,
      mime_delivery_state);
  }
  else
  {
    m_encoder = nullptr;
  }

  /* Do some cleanup for documents with unknown content type.
    There are two issues: how they look to MIME users, and how they look to
    non-MIME users.

      If the user attaches a "README" file, which has unknown type because it
      has no extension, we still need to send it with no encoding, so that it
      is readable to non-MIME users.

        But if the user attaches some random binary file, then base64 encoding
        will have been chosen for it (above), and in this case, it won't be
        immediately readable by non-MIME users.  However, if we type it as
        text/plain instead of application/octet-stream, it will show up inline
        in a MIME viewer, which will probably be ugly, and may possibly have
        bad charset things happen as well.

          So, the heuristic we use is, if the type is unknown, then the type is
          set to application/octet-stream for data which needs base64 (binary data)
          and is set to text/plain for data which didn't need base64 (unencoded or
          lightly encoded data.)
  */
DONE:
  if (m_type.IsEmpty() || m_type.LowerCaseEqualsLiteral(UNKNOWN_CONTENT_TYPE))
  {
    if (m_already_encoded_p)
      m_type = APPLICATION_OCTET_STREAM;
    else if (m_encoding.LowerCaseEqualsLiteral(ENCODING_BASE64) ||
             m_encoding.LowerCaseEqualsLiteral(ENCODING_UUENCODE))
      m_type = APPLICATION_OCTET_STREAM;
    else
      m_type = TEXT_PLAIN;
  }
  return NS_OK;
}

nsresult
nsMsgAttachmentHandler::PickCharset()
{
  if (!m_charset.IsEmpty() || !m_type.LowerCaseEqualsLiteral(TEXT_PLAIN))
    return NS_OK;

  nsCOMPtr<nsIFile> tmpFile =
    do_QueryInterface(mTmpFile);
  if (!tmpFile)
    return NS_OK;
  
  return MsgDetectCharsetFromFile(tmpFile, m_charset);
}
    
static nsresult
FetcherURLDoneCallback(nsresult aStatus,
                       const nsACString &aContentType,
                       const nsACString &aCharset,
                       int32_t totalSize,
                       const PRUnichar* aMsg, void *tagData)
{
  nsMsgAttachmentHandler *ma = (nsMsgAttachmentHandler *) tagData;
  NS_ASSERTION(ma != nullptr, "not-null mime attachment");

  if (ma != nullptr)
  {
    ma->m_size = totalSize;
    if (!aContentType.IsEmpty())
    {
#ifdef XP_MACOSX
      //Do not change the type if we are dealing with an encoded (e.g., appledouble or zip) file
      if (!ma->mEncodedWorkingFile)
#else
        // can't send appledouble on non-macs
      if (!aContentType.EqualsLiteral("multipart/appledouble"))
#endif
        ma->m_type = aContentType;
    }

    if (!aCharset.IsEmpty())
      ma->m_charset = aCharset;

    return ma->UrlExit(aStatus, aMsg);
  }
  else
    return NS_OK;
}

nsresult
nsMsgAttachmentHandler::SnarfMsgAttachment(nsMsgCompFields *compFields)
{
  nsresult rv = NS_ERROR_INVALID_ARG;
  nsCOMPtr <nsIMsgMessageService> messageService;

  if (m_uri.Find("-message:", CaseInsensitiveCompare) != -1)
  {
    nsCOMPtr <nsIFile> tmpFile;
    rv = nsMsgCreateTempFile("nsmail.tmp", getter_AddRefs(tmpFile));
    NS_ENSURE_SUCCESS(rv, rv);
    mTmpFile = do_QueryInterface(tmpFile);
    mDeleteFile = true;
    mCompFields = compFields;
    m_type = MESSAGE_RFC822;
    m_overrideType = MESSAGE_RFC822;
    if (!mTmpFile)
    {
      rv = NS_ERROR_FAILURE;
      goto done;
    }

    rv = MsgNewBufferedFileOutputStream(getter_AddRefs(mOutFile), mTmpFile, -1, 00600);
    if (NS_FAILED(rv) || !mOutFile)
    {
      if (m_mime_delivery_state)
      {
        nsCOMPtr<nsIMsgSendReport> sendReport;
        m_mime_delivery_state->GetSendReport(getter_AddRefs(sendReport));
        if (sendReport)
        {
          nsAutoString error_msg;
          nsMsgBuildMessageWithTmpFile(mTmpFile, error_msg);
          sendReport->SetMessage(nsIMsgSendReport::process_Current, error_msg.get(), false);
        }
      }
      rv =  NS_MSG_UNABLE_TO_OPEN_TMP_FILE;
      goto done;
    }

    nsCOMPtr<nsIURLFetcher> fetcher = do_CreateInstance(NS_URLFETCHER_CONTRACTID, &rv);
    if (NS_FAILED(rv) || !fetcher)
    {
      if (NS_SUCCEEDED(rv))
        rv =  NS_ERROR_UNEXPECTED;
      goto done;
    }

    rv = fetcher->Initialize(mTmpFile, mOutFile, FetcherURLDoneCallback, this);
    rv = GetMessageServiceFromURI(m_uri, getter_AddRefs(messageService));
    if (NS_SUCCEEDED(rv) && messageService)
    {
      nsAutoCString uri(m_uri);
      uri += (uri.FindChar('?') == kNotFound) ? '?' : '&';
      uri.Append("fetchCompleteMessage=true");
      nsCOMPtr<nsIStreamListener> strListener;
      fetcher->QueryInterface(NS_GET_IID(nsIStreamListener), getter_AddRefs(strListener));

      // initialize a new stream converter, that uses the strListener as its input
      // obtain the input stream listener from the new converter,
      // and pass the converter's input stream listener to DisplayMessage

      m_mime_parser = do_CreateInstance(NS_MAILNEWS_MIME_STREAM_CONVERTER_CONTRACTID, &rv);
      if (NS_FAILED(rv))
        goto done;

      // Set us as the output stream for HTML data from libmime...
      nsCOMPtr<nsIMimeStreamConverter> mimeConverter = do_QueryInterface(m_mime_parser);
      if (mimeConverter)
      {
        mimeConverter->SetMimeOutputType(nsMimeOutput::nsMimeMessageDecrypt);
        mimeConverter->SetForwardInline(false);
        mimeConverter->SetIdentity(nullptr);
        mimeConverter->SetOriginalMsgURI(nullptr);
      }

      nsCOMPtr<nsIStreamListener> convertedListener = do_QueryInterface(m_mime_parser, &rv);
      if (NS_FAILED(rv))
        goto done;

      nsCOMPtr<nsIURI> aURL;
      rv = messageService->GetUrlForUri(uri.get(), getter_AddRefs(aURL), nullptr);

      rv = NS_NewInputStreamChannel(getter_AddRefs(m_converter_channel), aURL, nullptr);
      if (NS_FAILED(rv))
        goto done;

      rv = m_mime_parser->AsyncConvertData("message/rfc822", "message/rfc822",
                                           strListener, m_converter_channel);
      if (NS_FAILED(rv))
        goto done;

      rv = messageService->DisplayMessage(uri.get(), convertedListener, nullptr, nullptr, nullptr, nullptr);
    }
  }
done:
  if (NS_FAILED(rv))
  {
      if (mOutFile)
      {
        mOutFile->Close();
        mOutFile = nullptr;
      }

      if (mTmpFile)
      {
        mTmpFile->Remove(false);
        mTmpFile = nullptr;
      }
  }

  return rv;
}

#ifdef XP_MACOSX
bool nsMsgAttachmentHandler::HasResourceFork(FSRef *fsRef)
{
  FSCatalogInfo catalogInfo;
  OSErr err = FSGetCatalogInfo(fsRef, kFSCatInfoDataSizes + kFSCatInfoRsrcSizes, &catalogInfo, nullptr, nullptr, nullptr);
  return (err == noErr && catalogInfo.rsrcLogicalSize != 0);
}
#endif

nsresult
nsMsgAttachmentHandler::SnarfAttachment(nsMsgCompFields *compFields)
{
  NS_ASSERTION (! m_done, "Already done");

  if (!mURL)
    return SnarfMsgAttachment(compFields);

  mCompFields = compFields;

  // First, get as file spec and create the stream for the
  // temp file where we will save this data
  nsCOMPtr <nsIFile> tmpFile;
  nsresult rv = nsMsgCreateTempFile("nsmail.tmp", getter_AddRefs(tmpFile));
  NS_ENSURE_SUCCESS(rv, rv);
  mTmpFile = do_QueryInterface(tmpFile);
  mDeleteFile = true;

  rv = MsgNewBufferedFileOutputStream(getter_AddRefs(mOutFile), mTmpFile, -1, 00600);
  if (NS_FAILED(rv) || !mOutFile)
  {
    if (m_mime_delivery_state)
    {
      nsCOMPtr<nsIMsgSendReport> sendReport;
      m_mime_delivery_state->GetSendReport(getter_AddRefs(sendReport));
      if (sendReport)
      {
        nsAutoString error_msg;
        nsMsgBuildMessageWithTmpFile(mTmpFile, error_msg);
        sendReport->SetMessage(nsIMsgSendReport::process_Current, error_msg.get(), false);
      }
    }
    mTmpFile->Remove(false);
    mTmpFile = nullptr;
    return NS_MSG_UNABLE_TO_OPEN_TMP_FILE;
  }

  nsCString sourceURISpec;
  mURL->GetSpec(sourceURISpec);
#ifdef XP_MACOSX
  if (!m_bogus_attachment && StringBeginsWith(sourceURISpec, NS_LITERAL_CSTRING("file://")))
  {
    // Unescape the path (i.e. un-URLify it) before making a FSSpec
    nsAutoCString filePath;
    filePath.Adopt(nsMsgGetLocalFileFromURL(sourceURISpec.get()));
    nsAutoCString unescapedFilePath;
    MsgUnescapeString(filePath, 0, unescapedFilePath);

    nsCOMPtr<nsIFile> sourceFile;
    NS_NewNativeLocalFile(unescapedFilePath, true, getter_AddRefs(sourceFile));
    if (!sourceFile)
      return NS_ERROR_FAILURE;
      
    // check if it is a bundle. if it is, we'll zip it. 
    // if not, we'll apple encode it (applesingle or appledouble)
    nsCOMPtr<nsILocalFileMac> macFile(do_QueryInterface(sourceFile));
    bool isPackage;
    macFile->IsPackage(&isPackage);
    if (isPackage)
      rv = ConvertToZipFile(macFile);
    else
      rv = ConvertToAppleEncoding(sourceURISpec, unescapedFilePath, macFile);
    
    NS_ENSURE_SUCCESS(rv, rv);
  }
#endif /* XP_MACOSX */

  //
  // Ok, here we are, we need to fire the URL off and get the data
  // in the temp file
  //
  // Create a fetcher for the URL attachment...
  
  nsCOMPtr<nsIURLFetcher> fetcher = do_CreateInstance(NS_URLFETCHER_CONTRACTID, &rv);
  if (NS_FAILED(rv) || !fetcher)
  {
    if (NS_SUCCEEDED(rv))
      return NS_ERROR_UNEXPECTED;
    else
      return rv;
  }

  return fetcher->FireURLRequest(mURL, mTmpFile, mOutFile, FetcherURLDoneCallback, this);
}

#ifdef XP_MACOSX
nsresult
nsMsgAttachmentHandler::ConvertToZipFile(nsILocalFileMac *aSourceFile)
{
  // append ".zip" to the real file name
  nsAutoCString zippedName;
  nsresult rv = aSourceFile->GetNativeLeafName(zippedName);
  NS_ENSURE_SUCCESS(rv, rv);
  zippedName.AppendLiteral(".zip");

  // create a temporary file that we'll work on
  nsCOMPtr <nsIFile> tmpFile;
  rv = nsMsgCreateTempFile(zippedName.get(), getter_AddRefs(tmpFile));
  NS_ENSURE_SUCCESS(rv, rv);
  mEncodedWorkingFile = do_QueryInterface(tmpFile);

  // point our URL at the zipped temp file
  NS_NewFileURI(getter_AddRefs(mURL), mEncodedWorkingFile);

  // zip it!
  rv = nsSimpleZipper::Zip(aSourceFile, mEncodedWorkingFile);
  NS_ENSURE_SUCCESS(rv, rv);

  // set some metadata for this attachment, that will affect the MIME headers.
  m_type = APPLICATION_ZIP;
  m_realName = zippedName.get();

  return NS_OK;
}

nsresult
nsMsgAttachmentHandler::ConvertToAppleEncoding(const nsCString &aFileURI, 
                                               const nsCString &aFilePath, 
                                               nsILocalFileMac *aSourceFile)
{
  // convert the apple file to AppleDouble first, and then patch the
  // address in the url.
  
  //We need to retrieve the file type and creator...

  char fileInfo[32];
  OSType type, creator;

  nsresult rv = aSourceFile->GetFileType(&type);
  if (NS_FAILED(rv))
    return rv;
  PR_snprintf(fileInfo, sizeof(fileInfo), "%X", type);
  m_xMacType = fileInfo;

  rv = aSourceFile->GetFileCreator(&creator);
  if (NS_FAILED(rv))
    return rv;
  PR_snprintf(fileInfo, sizeof(fileInfo), "%X", creator);
  m_xMacCreator = fileInfo;

  FSRef fsRef;
  aSourceFile->GetFSRef(&fsRef);
  bool sendResourceFork = HasResourceFork(&fsRef);

  // if we have a resource fork, check the filename extension, maybe we don't need the resource fork!
  if (sendResourceFork)
  {
    nsCOMPtr<nsIURL> fileUrl(do_CreateInstance(NS_STANDARDURL_CONTRACTID));
    if (fileUrl)
    {
      rv = fileUrl->SetSpec(aFileURI);
      if (NS_SUCCEEDED(rv))
      {
        nsAutoCString ext;
        rv = fileUrl->GetFileExtension(ext);
        if (NS_SUCCEEDED(rv) && !ext.IsEmpty())
        {
          sendResourceFork =
          PL_strcasecmp(ext.get(), "TXT") &&
          PL_strcasecmp(ext.get(), "JPG") &&
          PL_strcasecmp(ext.get(), "GIF") &&
          PL_strcasecmp(ext.get(), "TIF") &&
          PL_strcasecmp(ext.get(), "HTM") &&
          PL_strcasecmp(ext.get(), "HTML") &&
          PL_strcasecmp(ext.get(), "ART") &&
          PL_strcasecmp(ext.get(), "XUL") &&
          PL_strcasecmp(ext.get(), "XML") &&
          PL_strcasecmp(ext.get(), "CSS") &&
          PL_strcasecmp(ext.get(), "JS");
        }
      }
    }
  }

  // Only use appledouble if we aren't uuencoding.
  if( sendResourceFork )
  {
    char *separator;

    separator = mime_make_separator("ad");
    if (!separator)
      return NS_ERROR_OUT_OF_MEMORY;

    nsCOMPtr <nsIFile> tmpFile;
    nsresult rv = nsMsgCreateTempFile("appledouble", getter_AddRefs(tmpFile));
    if (NS_SUCCEEDED(rv))
      mEncodedWorkingFile = do_QueryInterface(tmpFile);
    if (!mEncodedWorkingFile)
    {
      PR_FREEIF(separator);
      return NS_ERROR_OUT_OF_MEMORY;
    }

    //
    // RICHIE_MAC - ok, here's the deal, we have a file that we need
    // to encode in appledouble encoding for the resource fork and put that
    // into the mEncodedWorkingFile location. Then, we need to patch the new file
    // spec into the array and send this as part of the 2 part appledouble/mime
    // encoded mime part.
    //
    AppleDoubleEncodeObject     *obj = new (AppleDoubleEncodeObject);
    if (obj == NULL)
    {
      mEncodedWorkingFile = nullptr;
      PR_FREEIF(separator);
      return NS_ERROR_OUT_OF_MEMORY;
    }

    rv = MsgGetFileStream(mEncodedWorkingFile, getter_AddRefs(obj->fileStream));
    if (NS_FAILED(rv) || !obj->fileStream)
    {
      PR_FREEIF(separator);
      delete obj;
      return NS_ERROR_OUT_OF_MEMORY;
    }

    int32_t     bSize = AD_WORKING_BUFF_SIZE;

    char  *working_buff = nullptr;
    while (!working_buff && (bSize >= 512))
    {
      working_buff = (char *)PR_CALLOC(bSize);
      if (!working_buff)
        bSize /= 2;
    }

    if (!working_buff)
    {
      PR_FREEIF(separator);
      delete obj;
      return NS_ERROR_OUT_OF_MEMORY;
    }

    obj->buff = working_buff;
    obj->s_buff = bSize;

    //
    //  Setup all the need information on the apple double encoder.
    //
    ap_encode_init(&(obj->ap_encode_obj), aFilePath.get(), separator);

    int32_t count;

    OSErr status = noErr;
    m_size = 0;
    while (status == noErr)
    {
      status = ap_encode_next(&(obj->ap_encode_obj), obj->buff, bSize, &count);
      if (status == noErr || status == errDone)
      {
        //
        // we got the encode data, so call the next stream to write it to the disk.
        //
        uint32_t bytesWritten;
        obj->fileStream->Write(obj->buff, count, &bytesWritten);
        if (bytesWritten != (uint32_t) count)
          status = errFileWrite;
      }
    }

    ap_encode_end(&(obj->ap_encode_obj), (status >= 0)); // if this is true, ok, false abort
    if (obj->fileStream)
      obj->fileStream->Close();

    PR_FREEIF(obj->buff);               /* free the working buff.   */
    PR_FREEIF(obj);

    nsCOMPtr <nsIURI> fileURI;
    NS_NewFileURI(getter_AddRefs(fileURI), mEncodedWorkingFile);

    nsCOMPtr<nsIFileURL> theFileURL = do_QueryInterface(fileURI, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCString newURLSpec;
    NS_ENSURE_SUCCESS(rv, rv);
    fileURI->GetSpec(newURLSpec);

    if (newURLSpec.IsEmpty())
    {
      PR_FREEIF(separator);
      return NS_ERROR_OUT_OF_MEMORY;
    }

    if (NS_FAILED(nsMsgNewURL(getter_AddRefs(mURL), newURLSpec.get())))
    {
      PR_FREEIF(separator);
      return NS_ERROR_OUT_OF_MEMORY;
    }

    // Now after conversion, also patch the types.
    char        tmp[128];
    PR_snprintf(tmp, sizeof(tmp), MULTIPART_APPLEDOUBLE ";\r\n boundary=\"%s\"", separator);
    PR_FREEIF(separator);
    m_type = tmp;
  }
  else
  {
    if ( sendResourceFork )
    {
      // For now, just do the encoding, but in the old world we would ask the
      // user about doing this conversion
      printf("...we could ask the user about this conversion, but for now, nahh..\n");
    }

    bool      useDefault;
    char      *macType, *macEncoding;
    if (m_type.IsEmpty() || m_type.LowerCaseEqualsLiteral(TEXT_PLAIN))
    {
# define TEXT_TYPE  0x54455854  /* the characters 'T' 'E' 'X' 'T' */
# define text_TYPE  0x74657874  /* the characters 't' 'e' 'x' 't' */

      if (type != TEXT_TYPE && type != text_TYPE)
      {
        MacGetFileType(aSourceFile, &useDefault, &macType, &macEncoding);
        m_type = macType;
      }
    }
    // don't bother to set the types if we failed in getting the file info.
  }

  return NS_OK;
}
#endif // XP_MACOSX

nsresult
nsMsgAttachmentHandler::LoadDataFromFile(nsIFile *file, nsString &sigData, bool charsetConversion)
{
  int32_t       readSize;
  char          *readBuf;

  nsCOMPtr <nsIInputStream> inputFile;
  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(inputFile), file);
  if (NS_FAILED(rv))
    return NS_MSG_ERROR_WRITING_FILE;

  int64_t fileSize;
  file->GetFileSize(&fileSize);
  readSize = (uint32_t) fileSize;

  readBuf = (char *)PR_Malloc(readSize + 1);
  if (!readBuf)
    return NS_ERROR_OUT_OF_MEMORY;
  memset(readBuf, 0, readSize + 1);

  uint32_t bytesRead;
  inputFile->Read(readBuf, readSize, &bytesRead);
  inputFile->Close();

  nsDependentCString cstringReadBuf(readBuf, bytesRead);
  if (charsetConversion)
  {
    if (NS_FAILED(ConvertToUnicode(m_charset.get(), cstringReadBuf, sigData)))
      CopyASCIItoUTF16(cstringReadBuf, sigData);
  }
  else
    CopyASCIItoUTF16(cstringReadBuf, sigData);

  PR_FREEIF(readBuf);
  return NS_OK;
}

nsresult
nsMsgAttachmentHandler::Abort()
{
  nsCOMPtr<nsIRequest> saveRequest;
  saveRequest.swap(mRequest);

  if (mTmpFile)
  {
    if (mDeleteFile)
      mTmpFile->Remove(false);
    mTmpFile = nullptr;
  }

  NS_ASSERTION(m_mime_delivery_state != nullptr, "not-null m_mime_delivery_state");

  if (m_done)
    return NS_OK;

  if (saveRequest)
    return saveRequest->Cancel(NS_ERROR_ABORT);
  else
    if (m_mime_delivery_state)
    {
      m_mime_delivery_state->SetStatus(NS_ERROR_ABORT);
      m_mime_delivery_state->NotifyListenerOnStopSending(nullptr, NS_ERROR_ABORT, 0, nullptr);
    }
  return NS_OK;

}

nsresult
nsMsgAttachmentHandler::UrlExit(nsresult status, const PRUnichar* aMsg)
{
  NS_ASSERTION(m_mime_delivery_state != nullptr, "not-null m_mime_delivery_state");

  // Close the file, but don't delete the disk file (or the file spec.)
  if (mOutFile)
  {
    mOutFile->Close();
    mOutFile = nullptr;
  }
  // this silliness is because Windows nsIFile caches its file size
  // so if an output stream writes to it, it will still return the original
  // cached size.
  if (mTmpFile)
  {
    nsCOMPtr <nsIFile> tmpFile;
    mTmpFile->Clone(getter_AddRefs(tmpFile));
    mTmpFile = do_QueryInterface(tmpFile);
  }
  mRequest = nullptr;

  // First things first, we are now going to see if this is an HTML
  // Doc and if it is, we need to see if we can determine the charset
  // for this part by sniffing the HTML file.
  // This is needed only when the charset is not set already.
  // (e.g. a charset may be specified in HTTP header)
  //
  if (!m_type.IsEmpty() && m_charset.IsEmpty() &&
      m_type.LowerCaseEqualsLiteral(TEXT_HTML))
    m_charset = nsMsgI18NParseMetaCharset(mTmpFile);

  nsresult mimeDeliveryStatus;
  m_mime_delivery_state->GetStatus(&mimeDeliveryStatus);

  if (mimeDeliveryStatus == NS_ERROR_ABORT)
    status = NS_ERROR_ABORT;

  if (NS_FAILED(status) && status != NS_ERROR_ABORT && NS_SUCCEEDED(mimeDeliveryStatus))
  {
    // At this point, we should probably ask a question to the user
    // if we should continue without this attachment.
    //
    bool              keepOnGoing = true;
    nsCString    turl;
    nsString     msg;
    PRUnichar         *printfString = nullptr;
    nsresult rv;
    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties", getter_AddRefs(bundle));
    NS_ENSURE_SUCCESS(rv, rv);
    nsMsgDeliverMode mode = nsIMsgSend::nsMsgDeliverNow;
    m_mime_delivery_state->GetDeliveryMode(&mode);
    if (mode == nsIMsgSend::nsMsgSaveAsDraft || mode == nsIMsgSend::nsMsgSaveAsTemplate)
      bundle->GetStringFromID(NS_MSG_FAILURE_ON_OBJ_EMBED_WHILE_SAVING, getter_Copies(msg));
    else
      bundle->GetStringFromID(NS_MSG_FAILURE_ON_OBJ_EMBED_WHILE_SENDING, getter_Copies(msg));
    if (!m_realName.IsEmpty())
      printfString = nsTextFormatter::smprintf(msg.get(), m_realName.get());
    else if (NS_SUCCEEDED(mURL->GetSpec(turl)) && !turl.IsEmpty())
    {
      nsAutoCString unescapedUrl;
      MsgUnescapeString(turl, 0, unescapedUrl);
      if (unescapedUrl.IsEmpty())
        printfString = nsTextFormatter::smprintf(msg.get(), turl.get());
      else
        printfString = nsTextFormatter::smprintf(msg.get(), unescapedUrl.get());
    }
    else
      printfString = nsTextFormatter::smprintf(msg.get(), "?");

    nsCOMPtr<nsIPrompt> aPrompt;
    if (m_mime_delivery_state)
      m_mime_delivery_state->GetDefaultPrompt(getter_AddRefs(aPrompt));
    nsMsgAskBooleanQuestionByString(aPrompt, printfString, &keepOnGoing);
    PR_FREEIF(printfString);

    if (keepOnGoing)
    {
      status = NS_OK;
      m_bogus_attachment = true; //That will cause this attachment to be ignored.
    }
    else
    {
      status = NS_ERROR_ABORT;
      m_mime_delivery_state->SetStatus(status);
      nsresult ignoreMe;
      m_mime_delivery_state->Fail(status, nullptr, &ignoreMe);
      m_mime_delivery_state->NotifyListenerOnStopSending(nullptr, status, 0, nullptr);
      SetMimeDeliveryState(nullptr);
      return status;
    }
  }

  m_done = true;

  //
  // Ok, now that we have the file here on disk, we need to see if there was
  // a need to do conversion to plain text...if so, the magic happens here,
  // otherwise, just move on to other attachments...
  //
  if (NS_SUCCEEDED(status) && !m_type.LowerCaseEqualsLiteral(TEXT_PLAIN) &&
      m_desiredType.LowerCaseEqualsLiteral(TEXT_PLAIN))
  {
    //
    // Conversion to plain text desired.
    // Now use the converter service here to do the right
    // thing and convert this data to plain text for us!
    //
    nsAutoString      conData;

    if (NS_SUCCEEDED(LoadDataFromFile(mTmpFile, conData, true)))
    {
      if (NS_SUCCEEDED(ConvertBufToPlainText(conData, UseFormatFlowed(m_charset.get()), true)))
      {
        if (mDeleteFile)
          mTmpFile->Remove(false);

        nsCOMPtr<nsIOutputStream> outputStream;
        nsresult rv = NS_NewLocalFileOutputStream(getter_AddRefs(outputStream), mTmpFile,  PR_WRONLY | PR_CREATE_FILE, 00600);

        if (NS_SUCCEEDED(rv))
        {
          nsAutoCString tData;
          if (NS_FAILED(ConvertFromUnicode(m_charset.get(), conData, tData)))
            LossyCopyUTF16toASCII(conData, tData);
          if (!tData.IsEmpty())
          {
            uint32_t bytesWritten;
            (void) outputStream->Write(tData.get(), tData.Length(), &bytesWritten);
          }
          outputStream->Close();
          // this silliness is because Windows nsIFile caches its file size
          // so if an output stream writes to it, it will still return the original
          // cached size.
          if (mTmpFile)
          {
            nsCOMPtr <nsIFile> tmpFile;
            mTmpFile->Clone(getter_AddRefs(tmpFile));
            mTmpFile = do_QueryInterface(tmpFile);
          }

        }
      }
    }

    m_type = m_desiredType;
    m_desiredType.Truncate();
    m_encoding.Truncate();
  }

  uint32_t pendingAttachmentCount = 0;
  m_mime_delivery_state->GetPendingAttachmentCount(&pendingAttachmentCount);
  NS_ASSERTION (pendingAttachmentCount > 0, "no more pending attachment");

  m_mime_delivery_state->SetPendingAttachmentCount(pendingAttachmentCount - 1);

  bool processAttachmentsSynchronously = false;
  m_mime_delivery_state->GetProcessAttachmentsSynchronously(&processAttachmentsSynchronously);
  if (NS_SUCCEEDED(status) && processAttachmentsSynchronously)
  {
    /* Find the next attachment which has not yet been loaded,
     if any, and start it going.
     */
    uint32_t i;
    nsMsgAttachmentHandler *next = 0;
    nsTArray<nsRefPtr<nsMsgAttachmentHandler>> *attachments;

    m_mime_delivery_state->GetAttachmentHandlers(&attachments);

    for (i = 0; i < attachments->Length(); i++)
    {
      if (!(*attachments)[i]->m_done)
      {
        next = (*attachments)[i];
        //
        // rhp: We need to get a little more understanding to failed URL
        // requests. So, at this point if most of next is NULL, then we
        // should just mark it fetched and move on! We probably ignored
        // this earlier on in the send process.
        //
        if ( (!next->mURL) && (next->m_uri.IsEmpty()) )
        {
          (*attachments)[i]->m_done = true;
          (*attachments)[i]->SetMimeDeliveryState(nullptr);
          m_mime_delivery_state->GetPendingAttachmentCount(&pendingAttachmentCount);
          m_mime_delivery_state->SetPendingAttachmentCount(pendingAttachmentCount - 1);
          next->mPartUserOmissionOverride = true;
          next = nullptr;
          continue;
        }

        break;
      }
    }

    if (next)
    {
      nsresult status = next->SnarfAttachment(mCompFields);
      if (NS_FAILED(status))
      {
        nsresult ignoreMe;
        m_mime_delivery_state->Fail(status, nullptr, &ignoreMe);
        m_mime_delivery_state->NotifyListenerOnStopSending(nullptr, status, 0, nullptr);
        SetMimeDeliveryState(nullptr);
        return NS_ERROR_UNEXPECTED;
      }
    }
  }

  m_mime_delivery_state->GetPendingAttachmentCount(&pendingAttachmentCount);
  if (pendingAttachmentCount == 0)
  {
    // If this is the last attachment, then either complete the
    // delivery (if successful) or report the error by calling
    // the exit routine and terminating the delivery.
    if (NS_FAILED(status))
    {
      nsresult ignoreMe;
      m_mime_delivery_state->Fail(status, aMsg, &ignoreMe);
      m_mime_delivery_state->NotifyListenerOnStopSending(nullptr, status, aMsg, nullptr);
      SetMimeDeliveryState(nullptr);
      return NS_ERROR_UNEXPECTED;
    }
    else
    {
      status = m_mime_delivery_state->GatherMimeAttachments ();
      if (NS_FAILED(status))
      {
        nsresult ignoreMe;
        m_mime_delivery_state->Fail(status, aMsg, &ignoreMe);
        m_mime_delivery_state->NotifyListenerOnStopSending(nullptr, status, aMsg, nullptr);
        SetMimeDeliveryState(nullptr);
        return NS_ERROR_UNEXPECTED;
      }
    }
  }
  else
  {
    // If this is not the last attachment, but it got an error,
    // then report that error and continue
    if (NS_FAILED(status))
    {
      nsresult ignoreMe;
      m_mime_delivery_state->Fail(status, aMsg, &ignoreMe);
    }
  }

  SetMimeDeliveryState(nullptr);
  return NS_OK;
}


nsresult
nsMsgAttachmentHandler::GetMimeDeliveryState(nsIMsgSend** _retval)
{
  NS_ENSURE_ARG(_retval);
  *_retval = m_mime_delivery_state;
  NS_IF_ADDREF(*_retval);
  return NS_OK;
}

nsresult
nsMsgAttachmentHandler::SetMimeDeliveryState(nsIMsgSend* mime_delivery_state)
{
  /*
    Because setting m_mime_delivery_state to null could destroy ourself as
    m_mime_delivery_state it's our parent, we need to protect ourself against
    that!

    This extra comptr is necessary,
    see bug http://bugzilla.mozilla.org/show_bug.cgi?id=78967
  */
  nsCOMPtr<nsIMsgSend> temp = m_mime_delivery_state; /* Should lock our parent until the end of the function */
  m_mime_delivery_state = mime_delivery_state;
  return NS_OK;
}
