/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef MapiMessage_h___
#define MapiMessage_h___

#include "nsTArray.h"
#include "nsStringGlue.h"
#include "nsIFile.h"
#include "MapiApi.h"
#include "nsIMsgSend.h"

#include <vector>

#ifndef PR_LAST_VERB_EXECUTED
#define PR_LAST_VERB_EXECUTED PROP_TAG(PT_LONG, 0x1081)
#endif

#define EXCHIVERB_REPLYTOSENDER (102)
#define EXCHIVERB_REPLYTOALL    (103)
#define EXCHIVERB_FORWARD       (104)

#ifndef PR_ATTACH_CONTENT_ID
#define PR_ATTACH_CONTENT_ID PROP_TAG(PT_TSTRING,	0x3712)
#endif
#ifndef PR_ATTACH_CONTENT_ID_W
#define PR_ATTACH_CONTENT_ID_W PROP_TAG(PT_UNICODE,	0x3712)
#endif
#ifndef PR_ATTACH_CONTENT_ID_A
#define PR_ATTACH_CONTENT_ID_A PROP_TAG(PT_STRING8,	0x3712)
#endif

#ifndef PR_ATTACH_FLAGS
#define PR_ATTACH_FLAGS PROP_TAG(PT_LONG,	0x3714)
#endif

#ifndef ATT_INVISIBLE_IN_HTML
#define ATT_INVISIBLE_IN_HTML (0x1)
#endif
#ifndef ATT_INVISIBLE_IN_RTF
#define ATT_INVISIBLE_IN_RTF  (0x2)
#endif
#ifndef ATT_MHTML_REF
#define ATT_MHTML_REF         (0x4)
#endif

//////////////////////////////////////////////////////////////////////////////

class CMapiMessageHeaders {
public:
  // Special headers that MUST appear at most once (see RFC822)
  enum SpecialHeader { hdrNone=-1, hdrFirst = 0, // utility values
                       hdrDate=hdrFirst,
                       hdrFrom,
                       hdrSender,
                       hdrReplyTo,
                       hdrTo,
                       hdrCc,
                       hdrBcc,
                       hdrMessageID,
                       hdrSubject,
                       hdrMimeVersion,
                       hdrContentType,
                       hdrContentTransferEncoding,
                       hdrMax // utility value
                     };

  CMapiMessageHeaders(const char* headers = 0) { Assign(headers); }
  ~CMapiMessageHeaders();
  void Assign(const char* headers);

  inline bool IsEmpty() const { return m_headerFields.empty(); }
  // if no such header exists then 0 is returned, else the first value returned
  const char* Value(const char* name) const;
  // if no such header exists then 0 is returned
  const char* Value(SpecialHeader special) const;

  void UnfoldValue(const char* name, nsString& dest, const char* fallbackCharset) const;
  void UnfoldValue(SpecialHeader special, nsString& dest, const char* fallbackCharset) const;

  // value must be utf-8 or 7-bit; supposed that this function will be called
  // when the charset of the value is known
  // TODO: if replace is set, then all headers with this name will be removed
  //  and one with this value will be added, otherwise a new header is added
  // (Unnecessary for now)
  int SetValue(const char* name, const char* value, bool replace = true);
  int SetValue(SpecialHeader special, const char* value);

  static const char* SpecialName(SpecialHeader special);

  nsresult ToStream(nsIOutputStream *pDst) const;
private:
  class CHeaderField {
  public:
    CHeaderField(const char* begin, int len);
    CHeaderField(const char* name, const char* body, bool utf8 = false);
    ~CHeaderField();
    inline bool Valid() const { return m_fname; }
    inline const char* fname() const { return m_fname; }
    inline const char* fbody() const { return m_fbody; }
    
    // txt must be utf-8 or 7-bit; supposed that this function will be called
    // when the charset of the txt is known
    void set_fbody(const char* txt);

    void GetUnfoldedString(nsString& dest, const char* fallbackCharset) const;
  private:
    char* m_fname;
    char* m_fbody;
    bool m_fbody_utf8;
  }; //class HeaderField

  class write_to_stream {
  public:
    write_to_stream(nsIOutputStream *pDst) : m_pDst(pDst), m_rv(NS_OK) {}
    void operator () (const CHeaderField* f);
    inline operator nsresult() const { return m_rv; }
  private:
    nsIOutputStream *m_pDst;
    nsresult m_rv;
  };

  // Search helper
  class fname_equals {
  public:
    fname_equals(const char* search) : m_search(search) {}
    inline bool operator () (const CHeaderField* f) const { return stricmp(f->fname(), m_search) == 0; }
  private:
    const char* m_search;
  }; // class fname_equals

  // The common array of special headers' names
  static const char* Specials[hdrMax];
  
  std::vector<CHeaderField*> m_headerFields;
  CHeaderField* m_SpecialHeaders[hdrMax]; // Pointers into the m_headerFields

  void ClearHeaderFields();
  void Add(CHeaderField* f);
  static SpecialHeader CheckSpecialHeader(const char* fname);
  const CHeaderField* CFind(const char* name) const;
  inline CHeaderField* Find(const char* name) { return const_cast<CHeaderField*>(CFind(name)); }

}; // class CMapiMessageHeaders

//////////////////////////////////////////////////////

class CMapiMessage {
public:
  CMapiMessage(LPMESSAGE  lpMsg);
  ~CMapiMessage();

  // Attachments
  // Ordinary (not embedded) attachments.
  nsresult GetAttachments(nsIArray **aArray);
  // Embedded attachments
  size_t EmbeddedAttachmentsCount() const { return m_embattachments.size(); }
  bool GetEmbeddedAttachmentInfo(unsigned int i, nsIURI **uri, const char **cid,
                                 const char **name) const;
  // We don't check MSGFLAG_HASATTACH, since it returns true even if there are
  // only embedded attachmentsin the message. TB only counts the ordinary
  // attachments when shows the message status, so here we check only for the
  // ordinary attachments.
  inline bool HasAttach() const { return !m_stdattachments.empty(); }

  // Retrieve info for message
  inline bool BodyIsHtml(void) const { return m_bodyIsHtml;}
  const char *GetFromLine(int& len) const {
    if (m_fromLine.IsEmpty())
      return NULL; 
    else {
      len = m_fromLine.Length();
      return m_fromLine.get();}
  }
  inline CMapiMessageHeaders *GetHeaders() { return &m_headers; }
  inline const wchar_t *GetBody(void) const { return m_body.get(); }
  inline size_t GetBodyLen(void) const { return m_body.Length(); }
  void GetBody(nsCString& dest) const;
  inline const char *GetBodyCharset(void) const { return m_mimeCharset.get();}
  inline bool IsRead() const { return m_msgFlags & MSGFLAG_READ; }
  inline bool IsReplied() const {
    return (m_msgLastVerb == EXCHIVERB_REPLYTOSENDER) ||
           (m_msgLastVerb == EXCHIVERB_REPLYTOALL); }
  inline bool IsForvarded() const {
    return m_msgLastVerb == EXCHIVERB_FORWARD; }

  bool    HasContentHeader(void) const {
    return !m_mimeContentType.IsEmpty();}
  bool    HasMimeVersion(void) const {
    return m_headers.Value(CMapiMessageHeaders::hdrMimeVersion); }
  const char *GetMimeContent(void) const { return m_mimeContentType.get();}
  int32_t     GetMimeContentLen(void) const { return m_mimeContentType.Length();}
  const char *GetMimeBoundary(void) const { return m_mimeBoundary.get();}

   // The only required part of a message is its header
  inline bool ValidState() const { return !m_headers.IsEmpty(); }
  inline bool FullMessageDownloaded() const { return !m_dldStateHeadersOnly; }

private:
  struct attach_data {
    nsCOMPtr<nsIURI> orig_url;
    nsCOMPtr<nsIFile> tmp_file;
    char *type;
    char *encoding;
    char *real_name;
    char *cid;
    bool delete_file;
    attach_data() : type(0), encoding(0), real_name(0), cid(0), delete_file(false) {}
  };

  static const nsCString    m_whitespace;

  LPMESSAGE    m_lpMsg;

  bool         m_dldStateHeadersOnly; // if the message has not been downloaded yet
  CMapiMessageHeaders     m_headers;
  nsCString    m_fromLine; // utf-8
  nsCString    m_mimeContentType; // utf-8
  nsCString    m_mimeBoundary; // utf-8
  nsCString    m_mimeCharset; // utf-8

  std::vector<attach_data*> m_stdattachments;
  std::vector<attach_data*> m_embattachments; // Embedded

  nsString     m_body; // to be converted from UTF-16 using m_mimeCharset
  bool         m_bodyIsHtml;

  uint32_t m_msgFlags;
  uint32_t m_msgLastVerb;

  nsCOMPtr<nsIIOService> m_pIOService;

  void    GetDownloadState();

  // Headers - fetch will get PR_TRANSPORT_MESSAGE_HEADERS
  // or if they do not exist will build a header from
  //  PR_DISPLAY_TO, _CC, _BCC
  //  PR_SUBJECT
  //  PR_MESSAGE_RECIPIENTS
  // and PR_CREATION_TIME if needed?
  bool    FetchHeaders(void);
  bool    FetchBody(void);
  void    FetchFlags(void);

  static bool GetTmpFile(/*out*/ nsIFile **aResult);
  static bool CopyMsgAttachToFile(LPATTACH lpAttach, /*out*/ nsIFile **tmp_file);
  static bool CopyBinAttachToFile(LPATTACH lpAttach, nsIFile **tmp_file);

  static void ClearAttachment(attach_data* data);
  void    ClearAttachments();
  bool    AddAttachment(DWORD aNum);
  bool    IterateAttachTable(LPMAPITABLE tbl);
  bool    GetURL(nsIFile *aFile, nsIURI **url);
  void    ProcessAttachments();

  bool    EnsureHeader(CMapiMessageHeaders::SpecialHeader special, ULONG mapiTag);
  bool    EnsureDate();

  void    ProcessContentType();
  bool    CheckBodyInCharsetRange(const char* charset);
  void    FormatDateTime(SYSTEMTIME& tm, nsCString& s, bool includeTZ = true);
  void    BuildFromLine(void);

  inline static bool IsSpace(char c) {
    return c == ' ' || c == '\r' || c == '\n' || c == '\b' || c == '\t';}
  inline static bool IsSpace(wchar_t c) { 
    return ((c & 0xFF) == c) && IsSpace(static_cast<char>(c)); } // Avoid false detections
};

#endif /* MapiMessage_h__ */
