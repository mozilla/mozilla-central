/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef _NSMSGUTILS_H
#define _NSMSGUTILS_H

#include "nsIURL.h"
#include "nsStringGlue.h"
#include "nsIEnumerator.h"
#include "msgCore.h"
#include "nsCOMPtr.h"
#include "MailNewsTypes2.h"
#include "nsTArray.h"

class nsILocalFile;
class nsIPrefBranch;
class nsIMsgFolder;
class nsIMsgMessageService;
class nsIUrlListener;
class nsIOutputStream;
class nsIInputStream;
class nsIMsgDatabase;
class nsIMutableArray;
class nsIProxyInfo;

//These are utility functions that can used throughout the mailnews code

NS_MSG_BASE nsresult GetMessageServiceContractIDForURI(const char *uri, nsCString &contractID);

NS_MSG_BASE nsresult GetMessageServiceFromURI(const nsACString& uri, nsIMsgMessageService **aMessageService);

NS_MSG_BASE nsresult GetMsgDBHdrFromURI(const char *uri, nsIMsgDBHdr **msgHdr);

NS_MSG_BASE nsresult CreateStartupUrl(const char *uri, nsIURI** aUrl);

NS_MSG_BASE nsresult NS_MsgGetPriorityFromString(
                       const char * const priority,
                       nsMsgPriorityValue & outPriority);

NS_MSG_BASE nsresult NS_MsgGetPriorityValueString(
                       const nsMsgPriorityValue p,
                       nsACString & outValueString);

NS_MSG_BASE nsresult NS_MsgGetUntranslatedPriorityName(
                       const nsMsgPriorityValue p,
                       nsACString & outName);

NS_MSG_BASE nsresult NS_MsgHashIfNecessary(nsAutoString &name);
NS_MSG_BASE nsresult NS_MsgHashIfNecessary(nsCAutoString &name);

NS_MSG_BASE nsresult NS_MsgCreatePathStringFromFolderURI(const char *aFolderURI, 
                                                         nsCString& aPathString,
                                                         PRBool aIsNewsFolder=PR_FALSE);

NS_MSG_BASE PRBool NS_MsgStripRE(const char **stringP, PRUint32 *lengthP, char **modifiedSubject=nsnull);

NS_MSG_BASE char * NS_MsgSACopy(char **destination, const char *source);

NS_MSG_BASE char * NS_MsgSACat(char **destination, const char *source);

NS_MSG_BASE nsresult NS_MsgEscapeEncodeURLPath(const nsAString& aStr,
                                               nsCString& aResult);

NS_MSG_BASE nsresult NS_MsgDecodeUnescapeURLPath(const nsACString& aPath,
                                                 nsAString& aResult);

NS_MSG_BASE PRBool WeAreOffline();

// Check if a folder with aFolderUri exists
NS_MSG_BASE nsresult GetExistingFolder(const nsCString& aFolderURI, nsIMsgFolder **aFolder);

// Escape lines starting with "From ", ">From ", etc. in a buffer.
NS_MSG_BASE nsresult EscapeFromSpaceLine(nsIOutputStream *ouputStream, char *start, const char *end);
NS_MSG_BASE PRBool IsAFromSpaceLine(char *start, const char *end);

NS_MSG_BASE nsresult NS_GetPersistentFile(const char *relPrefName,
                                          const char *absPrefName,
                                          const char *dirServiceProp, // Can be NULL
                                          PRBool& gotRelPref,
                                          nsILocalFile **aFile,
                                          nsIPrefBranch *prefBranch = nsnull);

NS_MSG_BASE nsresult NS_SetPersistentFile(const char *relPrefName,
                                          const char *absPrefName,
                                          nsILocalFile *aFile,
                                          nsIPrefBranch *prefBranch = nsnull);

NS_MSG_BASE nsresult IsRFC822HeaderFieldName(const char *aHdr, PRBool *aResult);

NS_MSG_BASE nsresult NS_GetUnicharPreferenceWithDefault(nsIPrefBranch *prefBranch,   //can be null, if so uses the root branch
                                                        const char *prefName,
                                                        const nsAString& defValue,
                                                        nsAString& prefValue);
 
NS_MSG_BASE nsresult NS_GetLocalizedUnicharPreferenceWithDefault(nsIPrefBranch *prefBranch,   //can be null, if so uses the root branch
                                                                 const char *prefName,
                                                                 const nsAString& defValue,
                                                                 nsAString& prefValue);

  /**
   * this needs a listener, because we might have to create the folder
   * on the server, and that is asynchronous
   */
NS_MSG_BASE nsresult GetOrCreateFolder(const nsACString & aURI, nsIUrlListener *aListener);

// Returns true if the nsIURI is a message under an RSS account
NS_MSG_BASE nsresult IsRSSArticle(nsIURI * aMsgURI, PRBool *aIsRSSArticle);

// digest needs to be a pointer to a 16 byte buffer
#define DIGEST_LENGTH 16

NS_MSG_BASE nsresult MSGCramMD5(const char *text, PRInt32 text_len, const char *key, PRInt32 key_len, unsigned char *digest);
NS_MSG_BASE nsresult MSGApopMD5(const char *text, PRInt32 text_len, const char *password, PRInt32 password_len, unsigned char *digest);

// helper functions to convert a 64bits PRTime into a 32bits value (compatible time_t) and vice versa.
NS_MSG_BASE void PRTime2Seconds(PRTime prTime, PRUint32 *seconds);
NS_MSG_BASE void PRTime2Seconds(PRTime prTime, PRInt32 *seconds);
NS_MSG_BASE void Seconds2PRTime(PRUint32 seconds, PRTime *prTime);
// helper function to generate current date+time as a string
NS_MSG_BASE void MsgGenerateNowStr(nsACString &nowStr);

// Appends the correct summary file extension onto the supplied fileLocation
// and returns it in summaryLocation.
NS_MSG_BASE nsresult GetSummaryFileLocation(nsILocalFile* fileLocation,
                                            nsILocalFile** summaryLocation);

// Gets a special directory and appends the supplied file name onto it.
NS_MSG_BASE nsresult GetSpecialDirectoryWithFileName(const char* specialDirName,
                                                     const char* fileName,
                                                     nsIFile** result);

NS_MSG_BASE nsresult MsgGetFileStream(nsILocalFile *file, nsIOutputStream **fileStream);

NS_MSG_BASE nsresult MsgReopenFileStream(nsILocalFile *file, nsIInputStream *fileStream);

// fills in the position of the passed in keyword in the passed in keyword list
// and returns false if the keyword isn't present
NS_MSG_BASE PRBool MsgFindKeyword(const nsCString &keyword, nsCString &keywords, PRInt32 *aStartOfKeyword, PRInt32 *aLength);

NS_MSG_BASE PRBool MsgHostDomainIsTrusted(nsCString &host, nsCString &trustedMailDomains);

NS_MSG_BASE nsresult FolderUriFromDirInProfile(nsILocalFile *aLocalPath, nsACString &mailboxUri);

// gets an nsILocalFile from a UTF-8 file:// path
NS_MSG_BASE nsresult MsgGetLocalFileFromURI(const nsACString &aUTF8Path, nsILocalFile **aFile);

NS_MSG_BASE void MsgStripQuotedPrintable (unsigned char *src);

NS_MSG_BASE void MsgCompressWhitespace(nsCString& aString);

/*
 * Utility function copied from nsReadableUtils
 */
NS_MSG_BASE PRBool MsgIsUTF8(const nsACString& aString);

/*
 * Utility functions that call functions from nsINetUtil
 */

NS_MSG_BASE nsresult MsgEscapeString(const nsACString &aStr,
                                     PRUint32 aType, nsACString &aResult);

NS_MSG_BASE nsresult MsgUnescapeString(const nsACString &aStr, 
                                       PRUint32 aFlags, nsACString &aResult);

NS_MSG_BASE nsresult MsgEscapeURL(const nsACString &aStr, PRUint32 aFlags,
                                  nsACString &aResult);

/*
 * Utility functions that got moved from nsEscape
 */

NS_MSG_BASE char *MsgEscapeHTML(const char *string);

NS_MSG_BASE PRUnichar *MsgEscapeHTML(const PRUnichar *aSourceBuffer,
                                     PRInt32 aSourceBufferLen);

// Converts an array of nsMsgKeys plus a database, to an array of nsIMsgDBHdrs.
NS_MSG_BASE nsresult MsgGetHeadersFromKeys(nsIMsgDatabase *aDB, 
                                           const nsTArray<nsMsgKey> &aKeys,
                                           nsIMutableArray *aHeaders);
 
NS_MSG_BASE nsresult MsgExamineForProxy(const char *scheme, const char *host,
                                        PRInt32 port, nsIProxyInfo **proxyInfo);

NS_MSG_BASE PRInt32 FindCharInSet(const nsCString &aString,
                                  const char* aChars, PRUint32 aOffset = 0);
NS_MSG_BASE PRInt32 FindCharInSet(const nsString &aString,
                                  const char* aChars, PRUint32 aOffset = 0);


// advances bufferOffset to the beginning of the next line, if we don't
// get to maxBufferOffset first. Returns PR_FALSE if we didn't get to the
// next line.
NS_MSG_BASE PRBool MsgAdvanceToNextLine(const char *buffer, PRUint32 &bufferOffset,
                                   PRUint32 maxBufferOffset);

#ifdef MOZILLA_1_9_1_BRANCH
/**
 * Parses a given string using the delimiter passed in. Items parsed from the
 * string will be appended to the array. This version is only used on the
 * MOZILLA_1_9_1_BRANCH as the trunk already has a suitable function.
 *
 * @param string
 *        The string to parse.
 * @param delimiter
 *        A delimter character.
 * @param array
 *        The array to append tokens to.
 */
NS_MSG_BASE PRBool ParseString(const nsACString& string, char delimiter, nsTArray<nsCString>& array);
#endif

#endif

