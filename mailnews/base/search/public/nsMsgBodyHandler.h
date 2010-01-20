
#ifndef __nsMsgBodyHandler_h
#define __nsMsgBodyHandler_h

#include "nsIMsgSearchScopeTerm.h"
#include "nsILineInputStream.h"
//---------------------------------------------------------------------------
// nsMsgBodyHandler: used to retrieve lines from POP and IMAP offline messages.
// This is a helper class used by nsMsgSearchTerm::MatchBody
//---------------------------------------------------------------------------
class nsMsgBodyHandler
{
public:
  nsMsgBodyHandler (nsIMsgSearchScopeTerm *,
    PRUint32 offset,
    PRUint32 length,
    nsIMsgDBHdr * msg,
    nsIMsgDatabase * db);

  // we can also create a body handler when doing arbitrary header
  // filtering...we need the list of headers and the header size as well
  // if we are doing filtering...if ForFilters is false, headers and
  // headersSize is ignored!!!
  nsMsgBodyHandler (nsIMsgSearchScopeTerm *, PRUint64 offset,
    PRUint32 length, nsIMsgDBHdr * msg, nsIMsgDatabase * db,
    const char * headers /* NULL terminated list of headers */,
    PRUint32 headersSize, PRBool ForFilters);

  virtual ~nsMsgBodyHandler();

  // returns next message line in buf
  PRInt32 GetNextLine(nsCString &buf);

  // Transformations
  void SetStripHtml (PRBool strip) { m_stripHtml = strip; }
  void SetStripHeaders (PRBool strip) { m_stripHeaders = strip; }

protected:
  void Initialize();  // common initialization code

  // filter related methods. For filtering we always use the headers
  // list instead of the database...
  PRBool m_Filtering;
  PRInt32 GetNextFilterLine(nsCString &buf);
  // pointer into the headers list in the original message hdr db...
  const char * m_headers;
  PRUint32 m_headersSize;
  PRUint32 m_headerBytesRead;

  // local / POP related methods
  void OpenLocalFolder();

  // goes through the mail folder
  PRInt32 GetNextLocalLine(nsCString &buf);

  nsIMsgSearchScopeTerm *m_scope;
  nsCOMPtr <nsILineInputStream> m_fileLineStream;
  nsCOMPtr <nsILocalFile> m_localFile;
  // local file state
  //  XP_File  *m_localFile;
  // need a file stream here, I bet

  // current offset into the mail folder file.
  PRUint64 m_localFileOffset;
  /**
   * The number of lines in the message.  If |m_lineCountInBodyLines| then this
   * is the number of body lines, otherwise this is the entire number of lines
   * in the message.  This is important so we know when to stop reading the file
   * without accidentally reading part of the next message.
   */
  PRUint32 m_numLocalLines;
  /**
   * When true, |m_numLocalLines| is the number of body lines in the message,
   * when false it is the entire number of lines in the message.
   *
   * When a message is an offline IMAP or news message, then the number of lines
   * will be the entire number of lines, so this should be false.  When the
   * message is a local message, the number of lines will be the number of body
   * lines.
   */
  PRBool m_lineCountInBodyLines;

  // Offline IMAP related methods & state


  nsIMsgDBHdr * m_msgHdr;
  nsIMsgDatabase * m_db;

  // Transformations
  // With the exception of m_isMultipart, these all apply to the various parts
  PRBool m_stripHeaders;   // PR_TRUE if we're supposed to strip of message headers
  PRBool m_stripHtml;      // PR_TRUE if we're supposed to strip off HTML tags
  PRBool m_pastHeaders;  // PR_TRUE if we've already skipped over the headers
  PRBool m_partIsHtml;     // PR_TRUE if the Content-type header claims text/html
  PRBool m_base64part;     // PR_TRUE if the current part is in base64
  PRBool m_isMultipart;    // PR_TRUE if the message is a multipart/* message
  PRBool m_partIsText;     // PR_TRUE if the current part is text/*

  nsCString boundary;      // The boundary string to look for

  // See implementation for comments
  PRInt32 ApplyTransformations (const nsCString &line, PRInt32 length,
                                PRBool &returnThisLine, nsCString &buf);
  void SniffPossibleMIMEHeader (nsCString &line);
  static void StripHtml (nsCString &buf);
  static void Base64Decode (nsCString &buf);
};
#endif
