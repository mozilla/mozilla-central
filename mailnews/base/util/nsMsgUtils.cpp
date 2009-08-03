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
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Prasad Sunkari <prasad@medhas.org>
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

#include "msgCore.h"
#include "nsIMsgHdr.h"
#include "nsMsgUtils.h"
#include "nsMsgFolderFlags.h"
#include "nsStringGlue.h"
#include "nsIServiceManager.h"
#include "nsCOMPtr.h"
#include "nsIImapUrl.h"
#include "nsIMailboxUrl.h"
#include "nsINntpUrl.h"
#include "nsMsgNewsCID.h"
#include "nsMsgLocalCID.h"
#include "nsMsgBaseCID.h"
#include "nsMsgImapCID.h"
#include "nsMsgI18N.h"
#include "nsNativeCharsetUtils.h"
#include "nsCharTraits.h"
#include "prprf.h"
#include "prmem.h"
#include "nsNetCID.h"
#include "nsIIOService.h"
#include "nsIRDFService.h"
#include "nsIMimeConverter.h"
#include "nsMsgMimeCID.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsISupportsPrimitives.h"
#include "nsIPrefLocalizedString.h"
#include "nsIRelativeFilePref.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsISpamSettings.h"
#include "nsISignatureVerifier.h"
#include "nsICryptoHash.h"
#include "nsNativeCharsetUtils.h"
#include "nsDirectoryServiceUtils.h"
#include "nsIRssIncomingServer.h"
#include "nsIMsgFolder.h"
#include "nsIMsgMessageService.h"
#include "nsIMsgAccountManager.h"
#include "nsIOutputStream.h"
#include "nsMsgFileStream.h"
#include "nsIFileURL.h"
#include "nsNetUtil.h"
#include "nsIMsgDatabase.h"
#include "nsIMutableArray.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsArrayUtils.h"
#include "nsIStringBundle.h"
#include "nsIMsgWindow.h"
#include "nsIWindowWatcher.h"
#include "nsIPrompt.h"

static NS_DEFINE_CID(kImapUrlCID, NS_IMAPURL_CID);
static NS_DEFINE_CID(kCMailboxUrl, NS_MAILBOXURL_CID);
static NS_DEFINE_CID(kCNntpUrlCID, NS_NNTPURL_CID);

#define ILLEGAL_FOLDER_CHARS ";#"
#define ILLEGAL_FOLDER_CHARS_AS_FIRST_LETTER "."
#define ILLEGAL_FOLDER_CHARS_AS_LAST_LETTER  ".~ "

nsresult GetMessageServiceContractIDForURI(const char *uri, nsCString &contractID)
{
  nsresult rv = NS_OK;
  //Find protocol
  nsCAutoString uriStr(uri);
  PRInt32 pos = uriStr.FindChar(':');
  if (pos == -1)
    return NS_ERROR_FAILURE;

  nsCAutoString protocol(StringHead(uriStr, pos));

  if (protocol.Equals("file") && uriStr.Find("application/x-message-display") != -1)
    protocol.Assign("mailbox");
  //Build message service contractid
  contractID = "@mozilla.org/messenger/messageservice;1?type=";
  contractID += protocol.get();

  return rv;
}

nsresult GetMessageServiceFromURI(const nsACString& uri, nsIMsgMessageService **aMessageService)
{
  nsresult rv;

  nsCAutoString contractID;
  rv = GetMessageServiceContractIDForURI(PromiseFlatCString(uri).get(), contractID);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIMsgMessageService> msgService = do_GetService(contractID.get(), &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  NS_IF_ADDREF(*aMessageService = msgService);
  return rv;
}

nsresult GetMsgDBHdrFromURI(const char *uri, nsIMsgDBHdr **msgHdr)
{
  nsCOMPtr <nsIMsgMessageService> msgMessageService;
  nsresult rv = GetMessageServiceFromURI(nsDependentCString(uri), getter_AddRefs(msgMessageService));
  NS_ENSURE_SUCCESS(rv,rv);
  if (!msgMessageService) return NS_ERROR_FAILURE;

  return msgMessageService->MessageURIToMsgHdr(uri, msgHdr);
}

nsresult CreateStartupUrl(const char *uri, nsIURI** aUrl)
{
  nsresult rv = NS_ERROR_NULL_POINTER;
  if (!uri || !*uri || !aUrl) return rv;
  *aUrl = nsnull;

  // XXX fix this, so that base doesn't depend on imap, local or news.
  // we can't do NS_NewURI(uri, aUrl), because these are imap-message://, mailbox-message://, news-message:// uris.
  // I think we should do something like GetMessageServiceFromURI() to get the service, and then have the service create the
  // appropriate nsI*Url, and then QI to nsIURI, and return it.
  // see bug #110689
  if (PL_strncasecmp(uri, "imap", 4) == 0)
  {
    nsCOMPtr<nsIImapUrl> imapUrl = do_CreateInstance(kImapUrlCID, &rv);

    if (NS_SUCCEEDED(rv) && imapUrl)
      rv = imapUrl->QueryInterface(NS_GET_IID(nsIURI),
      (void**) aUrl);
  }
  else if (PL_strncasecmp(uri, "mailbox", 7) == 0)
  {
    nsCOMPtr<nsIMailboxUrl> mailboxUrl = do_CreateInstance(kCMailboxUrl, &rv);
    if (NS_SUCCEEDED(rv) && mailboxUrl)
      rv = mailboxUrl->QueryInterface(NS_GET_IID(nsIURI),
      (void**) aUrl);
  }
  else if (PL_strncasecmp(uri, "news", 4) == 0)
  {
    nsCOMPtr<nsINntpUrl> nntpUrl = do_CreateInstance(kCNntpUrlCID, &rv);
    if (NS_SUCCEEDED(rv) && nntpUrl)
      rv = nntpUrl->QueryInterface(NS_GET_IID(nsIURI),
      (void**) aUrl);
  }
  if (*aUrl)
    (*aUrl)->SetSpec(nsDependentCString(uri));
  return rv;
}


// Where should this live? It's a utility used to convert a string priority,
//  e.g., "High, Low, Normal" to an enum.
// Perhaps we should have an interface that groups together all these
//  utilities...
nsresult NS_MsgGetPriorityFromString(
           const char * const priority,
           nsMsgPriorityValue & outPriority)
{
  if (!priority)
    return NS_ERROR_NULL_POINTER;

  // Note: Checking the values separately and _before_ the names,
  //        hoping for a much faster match;
  //       Only _drawback_, as "priority" handling is not truly specified:
  //        some softwares may have the number meanings reversed (1=Lowest) !?
  if (PL_strchr(priority, '1'))
    outPriority = nsMsgPriority::highest;
  else if (PL_strchr(priority, '2'))
    outPriority = nsMsgPriority::high;
  else if (PL_strchr(priority, '3'))
    outPriority = nsMsgPriority::normal;
  else if (PL_strchr(priority, '4'))
    outPriority = nsMsgPriority::low;
  else if (PL_strchr(priority, '5'))
    outPriority = nsMsgPriority::lowest;
  else if (PL_strcasestr(priority, "Highest"))
    outPriority = nsMsgPriority::highest;
       // Important: "High" must be tested after "Highest" !
  else if (PL_strcasestr(priority, "High") ||
           PL_strcasestr(priority, "Urgent"))
    outPriority = nsMsgPriority::high;
  else if (PL_strcasestr(priority, "Normal"))
    outPriority = nsMsgPriority::normal;
  else if (PL_strcasestr(priority, "Lowest"))
    outPriority = nsMsgPriority::lowest;
       // Important: "Low" must be tested after "Lowest" !
  else if (PL_strcasestr(priority, "Low") ||
           PL_strcasestr(priority, "Non-urgent"))
    outPriority = nsMsgPriority::low;
  else
    // "Default" case gets default value.
    outPriority = nsMsgPriority::Default;

  return NS_OK;
}

nsresult NS_MsgGetPriorityValueString(
           const nsMsgPriorityValue p,
           nsACString & outValueString)
{
  switch (p)
  {
    case nsMsgPriority::highest:
      outValueString.AssignLiteral("1");
      break;
    case nsMsgPriority::high:
      outValueString.AssignLiteral("2");
      break;
    case nsMsgPriority::normal:
      outValueString.AssignLiteral("3");
      break;
    case nsMsgPriority::low:
      outValueString.AssignLiteral("4");
      break;
    case nsMsgPriority::lowest:
      outValueString.AssignLiteral("5");
      break;
    case nsMsgPriority::none:
    case nsMsgPriority::notSet:
      // Note: '0' is a "fake" value; we expect to never be in this case.
      outValueString.AssignLiteral("0");
      break;
    default:
      NS_ASSERTION(PR_FALSE, "invalid priority value");
  }

  return NS_OK;
}

nsresult NS_MsgGetUntranslatedPriorityName(
           const nsMsgPriorityValue p,
           nsACString & outName)
{
  switch (p)
  {
    case nsMsgPriority::highest:
      outName.AssignLiteral("Highest");
      break;
    case nsMsgPriority::high:
      outName.AssignLiteral("High");
      break;
    case nsMsgPriority::normal:
      outName.AssignLiteral("Normal");
      break;
    case nsMsgPriority::low:
      outName.AssignLiteral("Low");
      break;
    case nsMsgPriority::lowest:
      outName.AssignLiteral("Lowest");
      break;
    case nsMsgPriority::none:
    case nsMsgPriority::notSet:
      // Note: 'None' is a "fake" value; we expect to never be in this case.
      outName.AssignLiteral("None");
      break;
    default:
      NS_ASSERTION(PR_FALSE, "invalid priority value");
  }

  return NS_OK;
}


/* this used to be XP_StringHash2 from xp_hash.c */
/* phong's linear congruential hash  */
static PRUint32 StringHash(const char *ubuf, PRInt32 len = -1)
{
  unsigned char * buf = (unsigned char*) ubuf;
  PRUint32 h=1;
  unsigned char *end = buf + (len == -1 ? strlen(ubuf) : len);
  while(buf < end) {
    h = 0x63c63cd9*h + 0x9c39c33d + (int32)*buf;
    buf++;
  }
  return h;
}

inline PRUint32 StringHash(const nsAutoString& str)
{
    return StringHash(reinterpret_cast<const char*>(str.get()),
                      str.Length() * 2);
}

/* Utility functions used in a few places in mailnews */
PRInt32
FindCharInSet(const nsCString &aString,
              const char* aChars, PRUint32 aOffset) 
{
  PRInt32 len = strlen(aChars);
  PRInt32 index = -1;
  for (int i = aOffset; i < len; i++) {
    index = aString.FindChar(aChars[i]);
    if (index != -1)
      return index;
  }
  return -1;
}

PRInt32
FindCharInSet(const nsString &aString,
              const char* aChars, PRUint32 aOffset)
{
  PRInt32 len = strlen(aChars);
  PRInt32 index = -1;
  for (int i = aOffset; i < len; i++) {
    index = aString.FindChar(aChars[i]);
    if (index != -1)
      return index;
  }
  return -1;
}

PRInt32
RFindCharInSet(const nsCString &aString, const char* aChars) 
{
  PRInt32 len = strlen(aChars);
  PRInt32 index = -1;
  for (int i = 0; i < len; i++) {
    index = aString.RFindChar(aChars[i]);
    if (index != -1)
      return index;
  }
  return -1;
}

PRInt32
RFindCharInSet(const nsString &aString, const char* aChars) 
{
  PRInt32 len = strlen(aChars);
  PRInt32 index = -1;
  for (int i = 0; i < len; i++) {
    index = aString.RFindChar(aChars[i]);
    if (index != -1)
      return index;
  }
  return -1;
}

// XXX : this may have other clients, in which case we'd better move it to
//       xpcom/io/nsNativeCharsetUtils with nsAString in place of nsAutoString
static PRBool ConvertibleToNative(const nsAutoString& str)
{
    nsCAutoString native;
    nsAutoString roundTripped;
    NS_CopyUnicodeToNative(str, native);
    NS_CopyNativeToUnicode(native, roundTripped);
    return str.Equals(roundTripped);
}

#if defined(XP_UNIX) || defined(XP_BEOS)
  const static PRUint32 MAX_LEN = 55;
#elif defined(XP_WIN32)
  const static PRUint32 MAX_LEN = 55;
#elif defined(XP_OS2)
  const static PRUint32 MAX_LEN = 55;
#else
  #error need_to_define_your_max_filename_length
#endif

nsresult NS_MsgHashIfNecessary(nsCAutoString &name)
{
  nsCAutoString str(name);

  // Given a filename, make it safe for filesystem
  // certain filenames require hashing because they
  // are too long or contain illegal characters
  PRInt32 illegalCharacterIndex = FindCharInSet(str, 
                                                FILE_PATH_SEPARATOR 
                                                FILE_ILLEGAL_CHARACTERS 
                                                ILLEGAL_FOLDER_CHARS);

  // Need to check the first ('.') and last ('.', '~' and ' ') char
  if (illegalCharacterIndex == -1)
  {
    PRInt32 lastIndex = str.Length() - 1;
    if (NS_LITERAL_CSTRING(ILLEGAL_FOLDER_CHARS_AS_FIRST_LETTER).FindChar(str[0]) != -1)
      illegalCharacterIndex = 0;
    else if (NS_LITERAL_CSTRING(ILLEGAL_FOLDER_CHARS_AS_LAST_LETTER).FindChar(str[lastIndex]) != -1)
      illegalCharacterIndex = lastIndex;
    else
      illegalCharacterIndex = -1;
  }

  char hashedname[MAX_LEN + 1];
  if (illegalCharacterIndex == -1)
  {
    // no illegal chars, it's just too long
    // keep the initial part of the string, but hash to make it fit
    if (str.Length() > MAX_LEN)
    {
      PL_strncpy(hashedname, str.get(), MAX_LEN + 1);
      PR_snprintf(hashedname + MAX_LEN - 8, 9, "%08lx",
                (unsigned long) StringHash(str.get()));
      name = hashedname;
    }
  }
  else
  {
      // found illegal chars, hash the whole thing
      // if we do substitution, then hash, two strings
      // could hash to the same value.
      // for example, on mac:  "foo__bar", "foo:_bar", "foo::bar"
      // would map to "foo_bar".  this way, all three will map to
      // different values
      PR_snprintf(hashedname, 9, "%08lx",
                (unsigned long) StringHash(str.get()));
      name = hashedname;
  }

  return NS_OK;
}

// XXX : The number of UTF-16 2byte code units are half the number of
// bytes in legacy encodings for CJK strings and non-Latin1 in UTF-8.
// The ratio can be 1/3 for CJK strings in UTF-8. However, we can
// get away with using the same MAX_LEN for nsCString and nsString
// because MAX_LEN is defined rather conservatively in the first place.
nsresult NS_MsgHashIfNecessary(nsAutoString &name)
{
  PRInt32 illegalCharacterIndex = FindCharInSet(name,
                                                FILE_PATH_SEPARATOR 
                                                FILE_ILLEGAL_CHARACTERS 
                                                ILLEGAL_FOLDER_CHARS);

  // Need to check the first ('.') and last ('.', '~' and ' ') char
  if (illegalCharacterIndex == -1)
  {
    PRInt32 lastIndex = name.Length() - 1;
    if (NS_LITERAL_STRING(ILLEGAL_FOLDER_CHARS_AS_FIRST_LETTER).FindChar(name[0]) != -1)
      illegalCharacterIndex = 0;
    else if (NS_LITERAL_STRING(ILLEGAL_FOLDER_CHARS_AS_LAST_LETTER).FindChar(name[lastIndex]) != -1)
      illegalCharacterIndex = lastIndex;
    else
      illegalCharacterIndex = -1;
  }

  char hashedname[9];
  PRInt32 keptLength = -1;
  if (illegalCharacterIndex != -1)
    keptLength = illegalCharacterIndex;
  else if (!ConvertibleToNative(name))
    keptLength = 0;
  else if (name.Length() > MAX_LEN) {
    keptLength = MAX_LEN-8;
    // To avoid keeping only the high surrogate of a surrogate pair
    if (NS_IS_HIGH_SURROGATE(name.CharAt(keptLength-1)))
        --keptLength;
  }

  if (keptLength >= 0) {
    PR_snprintf(hashedname, 9, "%08lx", (unsigned long) StringHash(name));
    name.SetLength(keptLength);
    name.Append(NS_ConvertASCIItoUTF16(hashedname));
  }

  return NS_OK;
}


nsresult NS_MsgCreatePathStringFromFolderURI(const char *aFolderURI,
                                             nsCString& aPathCString,
                                             PRBool aIsNewsFolder)
{
  // A file name has to be in native charset. Here we convert
  // to UTF-16 and check for 'unsafe' characters before converting
  // to native charset.
  NS_ENSURE_TRUE(MsgIsUTF8(nsDependentCString(aFolderURI)), NS_ERROR_UNEXPECTED);
  NS_ConvertUTF8toUTF16 oldPath(aFolderURI);

  nsAutoString pathPiece, path;

  PRInt32 startSlashPos = oldPath.FindChar('/');
  PRInt32 endSlashPos = (startSlashPos >= 0)
    ? oldPath.FindChar('/', startSlashPos + 1) - 1 : oldPath.Length() - 1;
  if (endSlashPos < 0)
    endSlashPos = oldPath.Length();
  // trick to make sure we only add the path to the first n-1 folders
  PRBool haveFirst=PR_FALSE;
  while (startSlashPos != -1) {
    pathPiece.Assign(Substring(oldPath, startSlashPos + 1, endSlashPos - startSlashPos));
    // skip leading '/' (and other // style things)
    if (!pathPiece.IsEmpty())
    {

      // add .sbd onto the previous path
      if (haveFirst)
      {
        path.AppendLiteral(".sbd/");
      }

      if (aIsNewsFolder)
      {
          nsCAutoString tmp;
          CopyUTF16toMUTF7(pathPiece, tmp);
          CopyASCIItoUTF16(tmp, pathPiece);
      }

      NS_MsgHashIfNecessary(pathPiece);
      path += pathPiece;
      haveFirst=PR_TRUE;
    }
    // look for the next slash
    startSlashPos = endSlashPos + 1;

    endSlashPos = (startSlashPos >= 0)
      ? oldPath.FindChar('/', startSlashPos + 1)  - 1: oldPath.Length() - 1;
    if (endSlashPos < 0)
      endSlashPos = oldPath.Length();

    if (startSlashPos >= endSlashPos)
      break;
  }
  return NS_CopyUnicodeToNative(path, aPathCString);
}

PRBool NS_MsgStripRE(const char **stringP, PRUint32 *lengthP, char **modifiedSubject)
{
  const char *s, *s_end;
  const char *last;
  PRUint32 L;
  PRBool result = PR_FALSE;
  NS_ASSERTION(stringP, "bad null param");
  if (!stringP) return PR_FALSE;

  // get localizedRe pref
  nsresult rv;
  nsString utf16LocalizedRe;
  NS_GetLocalizedUnicharPreferenceWithDefault(nsnull,
                                              "mailnews.localizedRe",
                                              EmptyString(),
                                              utf16LocalizedRe);
  NS_ConvertUTF16toUTF8 localizedRe(utf16LocalizedRe);

  // hardcoded "Re" so that noone can configure Mozilla standards incompatible
  nsCAutoString checkString("Re,RE,re,rE");
  if (!localizedRe.IsEmpty()) {
    checkString.Append(',');
    checkString.Append(localizedRe);
  }

  // decode the string
  nsCString decodedString;
  nsCOMPtr<nsIMimeConverter> mimeConverter;
  // we cannot strip "Re:" for MIME encoded subject without modifying the original
  if (modifiedSubject && strstr(*stringP, "=?"))
  {
    mimeConverter = do_GetService(NS_MIME_CONVERTER_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv))
      rv = mimeConverter->DecodeMimeHeaderToCharPtr(
        *stringP, nsnull, PR_FALSE, PR_TRUE, getter_Copies(decodedString));
  }

  s = !decodedString.IsEmpty() ? decodedString.get() : *stringP;
  L = lengthP ? *lengthP : strlen(s);

  s_end = s + L;
  last = s;

 AGAIN:

  while (s < s_end && IS_SPACE(*s))
  s++;

  const char *tokPtr = checkString.get();
  while (*tokPtr)
  {
    //tokenize the comma separated list
    PRSize tokenLength = 0;
    while (*tokPtr && *tokPtr != ',') {
      tokenLength++;
      tokPtr++;
    }
    //check if the beginning of s is the actual token
    if (tokenLength && !strncmp(s, tokPtr - tokenLength, tokenLength))
    {
      if (s[tokenLength] == ':')
      {
        s = s + tokenLength + 1; /* Skip over "Re:" */
        result = PR_TRUE;        /* Yes, we stripped it. */
        goto AGAIN;              /* Skip whitespace and try again. */
      }
      else if (s[tokenLength] == '[' || s[tokenLength] == '(')
      {
        const char *s2 = s + tokenLength + 1; /* Skip over "Re[" */

        /* Skip forward over digits after the "[". */
        while (s2 < (s_end - 2) && isdigit((unsigned char)*s2))
          s2++;

        /* Now ensure that the following thing is "]:"
           Only if it is do we alter `s'. */
        if ((s2[0] == ']' || s2[0] == ')') && s2[1] == ':')
        {
          s = s2 + 2;       /* Skip over "]:" */
          result = PR_TRUE; /* Yes, we stripped it. */
          goto AGAIN;       /* Skip whitespace and try again. */
        }
      }
    }
    if (*tokPtr)
      tokPtr++;
  }

  if (!decodedString.IsEmpty())
  {
    // encode the string back if any modification is made
    if (s != decodedString.get())
    {
      // extract between "=?" and "?"
      // e.g. =?ISO-2022-JP?
      const char *p1 = strstr(*stringP, "=?");
      if (p1)
      {
        p1 += sizeof("=?")-1;         // skip "=?"
        const char *p2 = strchr(p1, '?');   // then search for '?'
        if (p2)
        {
          char charset[nsIMimeConverter::MAX_CHARSET_NAME_LENGTH] = "";
          if (nsIMimeConverter::MAX_CHARSET_NAME_LENGTH >= (p2 - p1))
            strncpy(charset, p1, p2 - p1);
          rv = mimeConverter->EncodeMimePartIIStr_UTF8(nsDependentCString(s), PR_FALSE, charset,
            sizeof("Subject:"), nsIMimeConverter::MIME_ENCODED_WORD_SIZE,
            modifiedSubject);
          if (NS_SUCCEEDED(rv))
            return result;
        }
      }
    }
    else
      s = *stringP;   // no modification, set the original encoded string
  }


  /* Decrease length by difference between current ptr and original ptr.
   Then store the current ptr back into the caller. */
  if (lengthP)
    *lengthP -= (s - (*stringP));
  *stringP = s;

  return result;
}

/*  Very similar to strdup except it free's too
 */
char * NS_MsgSACopy (char **destination, const char *source)
{
  if(*destination)
  {
    PR_Free(*destination);
    *destination = 0;
  }
  if (! source)
    *destination = nsnull;
  else
  {
    *destination = (char *) PR_Malloc (PL_strlen(source) + 1);
    if (*destination == nsnull)
      return(nsnull);

    PL_strcpy (*destination, source);
  }
  return *destination;
}

/*  Again like strdup but it concatinates and free's and uses Realloc
*/
char * NS_MsgSACat (char **destination, const char *source)
{
  if (source && *source)
    if (*destination)
    {
      int length = PL_strlen (*destination);
      *destination = (char *) PR_Realloc (*destination, length + PL_strlen(source) + 1);
      if (*destination == nsnull)
        return(nsnull);

      PL_strcpy (*destination + length, source);
    }
    else
    {
      *destination = (char *) PR_Malloc (PL_strlen(source) + 1);
      if (*destination == nsnull)
        return(nsnull);

      PL_strcpy (*destination, source);
    }
  return *destination;
}

nsresult NS_MsgEscapeEncodeURLPath(const nsAString& aStr, nsCString& aResult)
{
  return MsgEscapeString(NS_ConvertUTF16toUTF8(aStr), nsINetUtil::ESCAPE_URL_PATH, aResult);
}

nsresult NS_MsgDecodeUnescapeURLPath(const nsACString& aPath,
                                     nsAString& aResult)
{
  nsCAutoString unescapedName;
  MsgUnescapeString(aPath, nsINetUtil::ESCAPE_URL_FILE_BASENAME |
                 nsINetUtil::ESCAPE_URL_FORCED, unescapedName);
  CopyUTF8toUTF16(unescapedName, aResult);
  return NS_OK;
}

PRBool WeAreOffline()
{
  nsresult rv = NS_OK;
  PRBool offline = PR_FALSE;

  nsCOMPtr <nsIIOService> ioService = do_GetService(NS_IOSERVICE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv) && ioService)
    ioService->GetOffline(&offline);

  return offline;
}

nsresult GetExistingFolder(const nsCString& aFolderURI, nsIMsgFolder **aFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);

  *aFolder = nsnull;

  nsresult rv;
  nsCOMPtr<nsIRDFService> rdf(do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> resource;
  rv = rdf->GetResource(aFolderURI, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgFolder> thisFolder;
  thisFolder = do_QueryInterface(resource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Parent doesn't exist means that this folder doesn't exist.
  nsCOMPtr<nsIMsgFolder> parentFolder;
  rv = thisFolder->GetParent(getter_AddRefs(parentFolder));
  if (NS_SUCCEEDED(rv) && parentFolder)
    NS_ADDREF(*aFolder = thisFolder);
  return rv;
}

PRBool IsAFromSpaceLine(char *start, const char *end)
{
  nsresult rv = PR_FALSE;
  while ((start < end) && (*start == '>'))
    start++;
  // If the leading '>'s are followed by an 'F' then we have a possible case here.
  if ( (*start == 'F') && (end-start > 4) && !strncmp(start, "From ", 5) )
    rv = PR_TRUE;
  return rv;
}

//
// This function finds all lines starting with "From " or "From " preceeding
// with one or more '>' (ie, ">From", ">>From", etc) in the input buffer
// (between 'start' and 'end') and prefix them with a ">" .
//
nsresult EscapeFromSpaceLine(nsIOutputStream *outputStream, char *start, const char *end)
{
  nsresult rv;
  char *pChar;
  PRUint32 written;

  pChar = start;
  while (start < end)
  {
    while ((pChar < end) && (*pChar != '\r') && (*(pChar+1) != '\n'))
      pChar++;

    if (pChar < end)
    {
      // Found a line so check if it's a qualified "From " line.
      if (IsAFromSpaceLine(start, pChar))
        rv = outputStream->Write(">", 1, &written);
      PRInt32 lineTerminatorCount = (*(pChar + 1) == '\n') ? 2 : 1;
      rv = outputStream->Write(start, pChar - start + lineTerminatorCount, &written);
      NS_ENSURE_SUCCESS(rv,rv);
      pChar += lineTerminatorCount;
      start = pChar;
    }
    else if (start < end)
    {
      // Check and flush out the remaining data and we're done.
      if (IsAFromSpaceLine(start, end))
        rv = outputStream->Write(">", 1, &written);
      rv = outputStream->Write(start, end-start, &written);
      NS_ENSURE_SUCCESS(rv,rv);
      break;
    }
  }
  return NS_OK;
}

nsresult IsRFC822HeaderFieldName(const char *aHdr, PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aHdr);
  NS_ENSURE_ARG_POINTER(aResult);
  PRUint32 length = strlen(aHdr);
  for(PRUint32 i=0; i<length; i++)
  {
    char c = aHdr[i];
    if ( c < '!' || c == ':' || c > '~')
    {
      *aResult = PR_FALSE;
      return NS_OK;
    }
  }
  *aResult = PR_TRUE;
  return NS_OK;
}

// Warning, currently this routine only works for the Junk Folder
nsresult
GetOrCreateFolder(const nsACString &aURI, nsIUrlListener *aListener)
{
  nsresult rv;
  nsCOMPtr <nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // get the corresponding RDF resource
  // RDF will create the folder resource if it doesn't already exist
  nsCOMPtr<nsIRDFResource> resource;
  rv = rdf->GetResource(aURI, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgFolder> folderResource;
  folderResource = do_QueryInterface(resource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // don't check validity of folder - caller will handle creating it
  nsCOMPtr<nsIMsgIncomingServer> server;
  // make sure that folder hierarchy is built so that legitimate parent-child relationship is established
  rv = folderResource->GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);
  if (!server)
    return NS_ERROR_UNEXPECTED;

  nsCOMPtr <nsIMsgFolder> msgFolder;
  rv = server->GetMsgFolderFromURI(folderResource, aURI, getter_AddRefs(msgFolder));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIMsgFolder> parent;
  rv = msgFolder->GetParent(getter_AddRefs(parent));
  if (NS_FAILED(rv) || !parent)
  {
    nsCOMPtr <nsILocalFile> folderPath;
    // for local folders, path is to the berkeley mailbox.
    // for imap folders, path needs to have .msf appended to the name
    msgFolder->GetFilePath(getter_AddRefs(folderPath));

    nsCString type;
    rv = server->GetType(type);
    NS_ENSURE_SUCCESS(rv,rv);

    PRBool isImapFolder = type.Equals("imap");
    // if we can't get the path from the folder, then try to create the storage.
    // for imap, it doesn't matter if the .msf file exists - it still might not
    // exist on the server, so we should try to create it
    PRBool exists = PR_FALSE;
    if (!isImapFolder && folderPath)
      folderPath->Exists(&exists);
    if (!exists)
    {
      // Hack to work around a localization bug with the Junk Folder.
      // Please see Bug #270261 for more information...
      nsString localizedJunkName;
      msgFolder->GetName(localizedJunkName);

      // force the junk folder name to be Junk so it gets created on disk correctly...
      msgFolder->SetName(NS_LITERAL_STRING("Junk"));
      msgFolder->SetFlag(nsMsgFolderFlags::Junk);
      rv = msgFolder->CreateStorageIfMissing(aListener);
      NS_ENSURE_SUCCESS(rv,rv);

      // now restore the localized folder name...
      msgFolder->SetName(localizedJunkName);

      // XXX TODO
      // JUNK MAIL RELATED
      // ugh, I hate this hack
      // we have to do this (for now)
      // because imap and local are different (one creates folder asynch, the other synch)
      // one will notify the listener, one will not.
      // I blame nsMsgCopy.
      // we should look into making it so no matter what the folder type
      // we always call the listener
      // this code should move into local folder's version of CreateStorageIfMissing()
      if (!isImapFolder && aListener) {
        rv = aListener->OnStartRunningUrl(nsnull);
        NS_ENSURE_SUCCESS(rv,rv);

        rv = aListener->OnStopRunningUrl(nsnull, NS_OK);
        NS_ENSURE_SUCCESS(rv,rv);
      }
    }
  }
  else {
    // if the folder exists, we should set the junk flag on it
    // which is what the listener will do
    if (aListener) {
      rv = aListener->OnStartRunningUrl(nsnull);
      NS_ENSURE_SUCCESS(rv,rv);

      rv = aListener->OnStopRunningUrl(nsnull, NS_OK);
      NS_ENSURE_SUCCESS(rv,rv);
    }
  }

  return NS_OK;
}

nsresult IsRSSArticle(nsIURI * aMsgURI, PRBool *aIsRSSArticle)
{
  nsresult rv;
  *aIsRSSArticle = PR_FALSE;

  nsCOMPtr<nsIMsgMessageUrl> msgUrl = do_QueryInterface(aMsgURI, &rv);
  if (NS_FAILED(rv)) return rv;

  nsCString resourceURI;
  msgUrl->GetUri(getter_Copies(resourceURI));

  // get the msg service for this URI
  nsCOMPtr<nsIMsgMessageService> msgService;
  rv = GetMessageServiceFromURI(resourceURI, getter_AddRefs(msgService));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  rv = msgService->MessageURIToMsgHdr(resourceURI.get(), getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aMsgURI, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // get the folder and the server from the msghdr
  nsCOMPtr<nsIRssIncomingServer> rssServer;
  nsCOMPtr<nsIMsgFolder> folder;
  rv = msgHdr->GetFolder(getter_AddRefs(folder));
  if (NS_SUCCEEDED(rv) && folder)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    folder->GetServer(getter_AddRefs(server));
    rssServer = do_QueryInterface(server);

    if (rssServer)
      *aIsRSSArticle = PR_TRUE;
  }

  return rv;
}


// digest needs to be a pointer to a DIGEST_LENGTH (16) byte buffer
nsresult MSGCramMD5(const char *text, PRInt32 text_len, const char *key, PRInt32 key_len, unsigned char *digest)
{
  nsresult rv;

  nsCAutoString hash;
  nsCOMPtr<nsICryptoHash> hasher = do_CreateInstance("@mozilla.org/security/hash;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);


  // this code adapted from http://www.cis.ohio-state.edu/cgi-bin/rfc/rfc2104.html

  char innerPad[65];    /* inner padding - key XORd with innerPad */
  char outerPad[65];    /* outer padding - key XORd with outerPad */
  int i;
  /* if key is longer than 64 bytes reset it to key=MD5(key) */
  if (key_len > 64)
  {

    rv = hasher->Init(nsICryptoHash::MD5);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = hasher->Update((const PRUint8*) key, key_len);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = hasher->Finish(PR_FALSE, hash);
    NS_ENSURE_SUCCESS(rv, rv);

    key = hash.get();
    key_len = DIGEST_LENGTH;
  }

  /*
   * the HMAC_MD5 transform looks like:
   *
   * MD5(K XOR outerPad, MD5(K XOR innerPad, text))
   *
   * where K is an n byte key
   * innerPad is the byte 0x36 repeated 64 times
   * outerPad is the byte 0x5c repeated 64 times
   * and text is the data being protected
   */

  /* start out by storing key in pads */
  memset(innerPad, 0, sizeof innerPad);
  memset(outerPad, 0, sizeof outerPad);
  memcpy(innerPad, key,  key_len);
  memcpy(outerPad, key, key_len);

  /* XOR key with innerPad and outerPad values */
  for (i=0; i<64; i++)
  {
    innerPad[i] ^= 0x36;
    outerPad[i] ^= 0x5c;
  }
  /*
   * perform inner MD5
   */
  nsCAutoString result;
  rv = hasher->Init(nsICryptoHash::MD5); /* init context for 1st pass */
  rv = hasher->Update((const PRUint8*)innerPad, 64);       /* start with inner pad */
  rv = hasher->Update((const PRUint8*)text, text_len);     /* then text of datagram */
  rv = hasher->Finish(PR_FALSE, result);   /* finish up 1st pass */

  /*
   * perform outer MD5
   */
  hasher->Init(nsICryptoHash::MD5);       /* init context for 2nd pass */
  rv = hasher->Update((const PRUint8*)outerPad, 64);    /* start with outer pad */
  rv = hasher->Update((const PRUint8*)result.get(), 16);/* then results of 1st hash */
  rv = hasher->Finish(PR_FALSE, result);    /* finish up 2nd pass */

  if (result.Length() != DIGEST_LENGTH)
    return NS_ERROR_UNEXPECTED;

  memcpy(digest, result.get(), DIGEST_LENGTH);

  return rv;

}


// digest needs to be a pointer to a DIGEST_LENGTH (16) byte buffer
nsresult MSGApopMD5(const char *text, PRInt32 text_len, const char *password, PRInt32 password_len, unsigned char *digest)
{
  nsresult rv;
  nsCAutoString result;

  nsCOMPtr<nsICryptoHash> hasher = do_CreateInstance("@mozilla.org/security/hash;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = hasher->Init(nsICryptoHash::MD5);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = hasher->Update((const PRUint8*) text, text_len);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = hasher->Update((const PRUint8*) password, password_len);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = hasher->Finish(PR_FALSE, result);
  NS_ENSURE_SUCCESS(rv, rv);

  if (result.Length() != DIGEST_LENGTH)
    return NS_ERROR_UNEXPECTED;

  memcpy(digest, result.get(), DIGEST_LENGTH);
  return rv;
}

NS_MSG_BASE nsresult NS_GetPersistentFile(const char *relPrefName,
                                          const char *absPrefName,
                                          const char *dirServiceProp,
                                          PRBool& gotRelPref,
                                          nsILocalFile **aFile,
                                          nsIPrefBranch *prefBranch)
{
    NS_ENSURE_ARG_POINTER(aFile);
    *aFile = nsnull;
    NS_ENSURE_ARG(relPrefName);
    NS_ENSURE_ARG(absPrefName);
    gotRelPref = PR_FALSE;

    nsCOMPtr<nsIPrefBranch> mainBranch;
    if (!prefBranch) {
        nsCOMPtr<nsIPrefService> prefService(do_GetService(NS_PREFSERVICE_CONTRACTID));
        if (!prefService) return NS_ERROR_FAILURE;
        prefService->GetBranch(nsnull, getter_AddRefs(mainBranch));
        if (!mainBranch) return NS_ERROR_FAILURE;
        prefBranch = mainBranch;
    }

    nsCOMPtr<nsILocalFile> localFile;

    // Get the relative first
    nsCOMPtr<nsIRelativeFilePref> relFilePref;
    prefBranch->GetComplexValue(relPrefName,
                                NS_GET_IID(nsIRelativeFilePref), getter_AddRefs(relFilePref));
    if (relFilePref) {
        relFilePref->GetFile(getter_AddRefs(localFile));
        NS_ASSERTION(localFile, "An nsIRelativeFilePref has no file.");
        if (localFile)
            gotRelPref = PR_TRUE;
    }

    // If not, get the old absolute
    if (!localFile) {
        prefBranch->GetComplexValue(absPrefName,
                                    NS_GET_IID(nsILocalFile), getter_AddRefs(localFile));

        // If not, and given a dirServiceProp, use directory service.
        if (!localFile && dirServiceProp) {
            nsCOMPtr<nsIProperties> dirService(do_GetService("@mozilla.org/file/directory_service;1"));
            if (!dirService) return NS_ERROR_FAILURE;
            dirService->Get(dirServiceProp, NS_GET_IID(nsILocalFile), getter_AddRefs(localFile));
            if (!localFile) return NS_ERROR_FAILURE;
        }
    }

    if (localFile) {
        *aFile = localFile;
        NS_ADDREF(*aFile);
        return NS_OK;
    }

    return NS_ERROR_FAILURE;
}

NS_MSG_BASE nsresult NS_SetPersistentFile(const char *relPrefName,
                                          const char *absPrefName,
                                          nsILocalFile *aFile,
                                          nsIPrefBranch *prefBranch)
{
    NS_ENSURE_ARG(relPrefName);
    NS_ENSURE_ARG(absPrefName);
    NS_ENSURE_ARG(aFile);

    nsCOMPtr<nsIPrefBranch> mainBranch;
    if (!prefBranch) {
        nsCOMPtr<nsIPrefService> prefService(do_GetService(NS_PREFSERVICE_CONTRACTID));
        if (!prefService) return NS_ERROR_FAILURE;
        prefService->GetBranch(nsnull, getter_AddRefs(mainBranch));
        if (!mainBranch) return NS_ERROR_FAILURE;
        prefBranch = mainBranch;
    }

    // Write the absolute for backwards compatibilty's sake.
    // Or, if aPath is on a different drive than the profile dir.
    nsresult rv = prefBranch->SetComplexValue(absPrefName, NS_GET_IID(nsILocalFile), aFile);

    // Write the relative path.
    nsCOMPtr<nsIRelativeFilePref> relFilePref;
    NS_NewRelativeFilePref(aFile, nsDependentCString(NS_APP_USER_PROFILE_50_DIR), getter_AddRefs(relFilePref));
    if (relFilePref) {
        nsresult rv2 = prefBranch->SetComplexValue(relPrefName, NS_GET_IID(nsIRelativeFilePref), relFilePref);
        if (NS_FAILED(rv2) && NS_SUCCEEDED(rv))
            prefBranch->ClearUserPref(relPrefName);
    }

    return rv;
}

NS_MSG_BASE nsresult NS_GetUnicharPreferenceWithDefault(nsIPrefBranch *prefBranch,  //can be null, if so uses the root branch
                                                        const char *prefName,
                                                        const nsAString& defValue,
                                                        nsAString& prefValue)
{
    NS_ENSURE_ARG(prefName);

    nsCOMPtr<nsIPrefBranch> pbr;
    if(!prefBranch) {
        pbr = do_GetService(NS_PREFSERVICE_CONTRACTID);
        prefBranch = pbr;
    }

  nsCOMPtr<nsISupportsString> str;
    nsresult rv = prefBranch->GetComplexValue(prefName, NS_GET_IID(nsISupportsString), getter_AddRefs(str));
    if (NS_SUCCEEDED(rv))
    str->GetData(prefValue);
  else
    prefValue = defValue;
    return NS_OK;
}

NS_MSG_BASE nsresult NS_GetLocalizedUnicharPreferenceWithDefault(nsIPrefBranch *prefBranch,  //can be null, if so uses the root branch
                                                                 const char *prefName,
                                                                 const nsAString& defValue,
                                                                 nsAString& prefValue)
{
    NS_ENSURE_ARG(prefName);

    nsCOMPtr<nsIPrefBranch> pbr;
    if(!prefBranch) {
        pbr = do_GetService(NS_PREFSERVICE_CONTRACTID);
        prefBranch = pbr;
    }

    nsCOMPtr<nsIPrefLocalizedString> str;
    nsresult rv = prefBranch->GetComplexValue(prefName, NS_GET_IID(nsIPrefLocalizedString), getter_AddRefs(str));
    if (NS_SUCCEEDED(rv))
  {
    nsString tmpValue;
    str->ToString(getter_Copies(tmpValue));
    prefValue.Assign(tmpValue);
  }
    else
        prefValue = defValue;
    return NS_OK;
}

void PRTime2Seconds(PRTime prTime, PRUint32 *seconds)
{
  PRInt64 microSecondsPerSecond, intermediateResult;

  LL_I2L(microSecondsPerSecond, PR_USEC_PER_SEC);
  LL_DIV(intermediateResult, prTime, microSecondsPerSecond);
  LL_L2UI((*seconds), intermediateResult);
}

void PRTime2Seconds(PRTime prTime, PRInt32 *seconds)
{
  PRInt64 microSecondsPerSecond, intermediateResult;

  LL_I2L(microSecondsPerSecond, PR_USEC_PER_SEC);
  LL_DIV(intermediateResult, prTime, microSecondsPerSecond);
  LL_L2I((*seconds), intermediateResult);
}

void Seconds2PRTime(PRUint32 seconds, PRTime *prTime)
{
  PRInt64 microSecondsPerSecond, intermediateResult;

  LL_I2L(microSecondsPerSecond, PR_USEC_PER_SEC);
  LL_UI2L(intermediateResult, seconds);
  LL_MUL((*prTime), intermediateResult, microSecondsPerSecond);
}

nsresult GetSummaryFileLocation(nsILocalFile* fileLocation, nsILocalFile** summaryLocation)
{
  nsresult rv;
  nsCOMPtr <nsILocalFile> newSummaryLocation = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  newSummaryLocation->InitWithFile(fileLocation);
  nsString fileName;

  rv = newSummaryLocation->GetLeafName(fileName);
  if (NS_FAILED(rv))
    return rv;

  fileName.Append(NS_LITERAL_STRING(SUMMARY_SUFFIX));
  rv = newSummaryLocation->SetLeafName(fileName);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*summaryLocation = newSummaryLocation);
  return NS_OK;
}

void MsgGenerateNowStr(nsACString &nowStr)
{
  char dateBuf[100];
  dateBuf[0] = '\0';
  PRExplodedTime exploded;
  PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &exploded);
  PR_FormatTimeUSEnglish(dateBuf, sizeof(dateBuf), "%a %b %d %H:%M:%S %Y", &exploded);
  nowStr.Assign(dateBuf);
}


// Gets a special directory and appends the supplied file name onto it.
nsresult GetSpecialDirectoryWithFileName(const char* specialDirName,
                                         const char* fileName,
                                         nsIFile** result)
{
  nsresult rv = NS_GetSpecialDirectory(specialDirName, result);
  NS_ENSURE_SUCCESS(rv, rv);

  return (*result)->AppendNative(nsDependentCString(fileName));
}


nsresult MsgGetFileStream(nsILocalFile *file, nsIOutputStream **fileStream)
{
  nsMsgFileStream *newFileStream = new nsMsgFileStream;
  NS_ENSURE_TRUE(newFileStream, NS_ERROR_OUT_OF_MEMORY);
  nsresult rv = newFileStream->InitWithFile(file);
  if (NS_SUCCEEDED(rv))
    rv = newFileStream->QueryInterface(NS_GET_IID(nsIOutputStream), (void **) fileStream);
  return rv;
}

nsresult MsgReopenFileStream(nsILocalFile *file, nsIInputStream *fileStream)
{
  nsMsgFileStream *msgFileStream = static_cast<nsMsgFileStream *>(fileStream);
  if (msgFileStream)
    return msgFileStream->InitWithFile(file);
  else
    return NS_ERROR_FAILURE;
}

PRBool MsgFindKeyword(const nsCString &keyword, nsCString &keywords, PRInt32 *aStartOfKeyword, PRInt32 *aLength)
{
#ifdef MOZILLA_INTERNAL_API
// nsTString_CharT::Find(const nsCString& aString,
//                       PRBool aIgnoreCase=PR_FALSE,
//                       PRInt32 aOffset=0,
//                       PRInt32 aCount=-1 ) const;
#define FIND_KEYWORD(keywords,keyword,offset) ((keywords).Find((keyword), PR_FALSE, (offset)))
#else
// nsAString::Find(const self_type& aStr,
//                 PRUint32 aOffset,
//                 ComparatorFunc c = DefaultComparator) const;
#define FIND_KEYWORD(keywords,keyword,offset) ((keywords).Find((keyword), static_cast<PRUint32>(offset)))
#endif
  // 'keyword' is the single keyword we're looking for
  // 'keywords' is a space delimited list of keywords to be searched,
  // which may be just a single keyword or even be empty
  const PRInt32 kKeywordLen = keyword.Length();
  const char* start = keywords.BeginReading();
  const char* end = keywords.EndReading();
  *aStartOfKeyword = FIND_KEYWORD(keywords, keyword, 0);
  while (*aStartOfKeyword >= 0)
  {
    const char* matchStart = start + *aStartOfKeyword;
    const char* matchEnd = matchStart + kKeywordLen;
    // For a real match, matchStart must be the start of keywords or preceded
    // by a space and matchEnd must be the end of keywords or point to a space.
    if ((matchStart == start || *(matchStart - 1) == ' ') &&
        (matchEnd == end || *matchEnd == ' '))
    {
      *aLength = kKeywordLen;
      return PR_TRUE;
    }
    *aStartOfKeyword = FIND_KEYWORD(keywords, keyword, *aStartOfKeyword + kKeywordLen);
  }

  *aLength = 0;
  return PR_FALSE;
#undef FIND_KEYWORD
}

PRBool MsgHostDomainIsTrusted(nsCString &host, nsCString &trustedMailDomains)
{
  const char *end;
  PRUint32 hostLen, domainLen;
  PRBool domainIsTrusted = PR_FALSE;

  const char *domain = trustedMailDomains.BeginReading();
  const char *domainEnd = trustedMailDomains.EndReading();
  const char *hostStart = host.BeginReading();
  hostLen = host.Length();

  do {
    // skip any whitespace
    while (*domain == ' ' || *domain == '\t')
      ++domain;

    // find end of this domain in the string
    end = strchr(domain, ',');
    if (!end)
      end = domainEnd;

    // to see if the hostname is in the domain, check if the domain
    // matches the end of the hostname.
    domainLen = end - domain;
    if (domainLen && hostLen >= domainLen) {
      const char *hostTail = hostStart + hostLen - domainLen;
      if (PL_strncasecmp(domain, hostTail, domainLen) == 0)
      {
        // now, make sure either that the hostname is a direct match or
        // that the hostname begins with a dot.
        if (hostLen == domainLen || *hostTail == '.' || *(hostTail - 1) == '.')
        {
          domainIsTrusted = PR_TRUE;
          break;
        }
      }
    }

    domain = end + 1;
  } while (*end);
  return domainIsTrusted;
}

nsresult FolderUriFromDirInProfile(nsILocalFile *aLocalPath, nsACString &mailboxUri)
{
  nsresult rv;

  nsCOMPtr<nsIMsgAccountManager> accountManager =
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIArray> folderArray;
  rv = accountManager->GetAllFolders(getter_AddRefs(folderArray));
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 count;
  rv = folderArray->GetLength(&count);
  NS_ENSURE_SUCCESS(rv, rv);

  for (PRUint32 i = 0; i < count; i++)
  {
    nsCOMPtr<nsIMsgFolder> folder(do_QueryElementAt(folderArray, i, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsILocalFile> folderPath;
    rv = folder->GetFilePath(getter_AddRefs(folderPath));
    NS_ENSURE_SUCCESS(rv, rv);

    // Check if we're equal
    PRBool isEqual;
    rv = folderPath->Equals(aLocalPath, &isEqual);
    NS_ENSURE_SUCCESS(rv, rv);

    if (isEqual)
      return folder->GetURI(mailboxUri);
  }
  return NS_ERROR_FAILURE;
}

nsresult MsgGetLocalFileFromURI(const nsACString &aUTF8Path, nsILocalFile **aFile)
{
  nsresult rv;
  nsCOMPtr<nsIURI> argURI;
  rv = NS_NewURI(getter_AddRefs(argURI), aUTF8Path);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIFileURL> argFileURL(do_QueryInterface(argURI, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> argFile;
  rv = argFileURL->GetFile(getter_AddRefs(argFile));
  NS_ENSURE_SUCCESS(rv, rv);
  return CallQueryInterface(argFile, aFile);
}

/*
 * Function copied from nsReadableUtils.
 * Migrating to frozen linkage is the only change done
 */
NS_MSG_BASE PRBool MsgIsUTF8(const nsACString& aString)
{
  const char *done_reading = aString.EndReading();

  PRInt32 state = 0;
  PRBool overlong = PR_FALSE;
  PRBool surrogate = PR_FALSE;
  PRBool nonchar = PR_FALSE;
  PRUint16 olupper = 0; // overlong byte upper bound.
  PRUint16 slower = 0;  // surrogate byte lower bound.

  const char *ptr = aString.BeginReading();

  while (ptr < done_reading) {
    PRUint8 c;
    
    if (0 == state) {

      c = *ptr++;

      if ((c & 0x80) == 0x00) 
        continue;

      if ( c <= 0xC1 ) // [80-BF] where not expected, [C0-C1] for overlong.
        return PR_FALSE;
      else if ((c & 0xE0) == 0xC0) 
        state = 1;
      else if ((c & 0xF0) == 0xE0) {
        state = 2;
        if ( c == 0xE0 ) { // to exclude E0[80-9F][80-BF] 
          overlong = PR_TRUE;
          olupper = 0x9F;
        } else if ( c == 0xED ) { // ED[A0-BF][80-BF] : surrogate codepoint
          surrogate = PR_TRUE;
          slower = 0xA0;
        } else if ( c == 0xEF ) // EF BF [BE-BF] : non-character
          nonchar = PR_TRUE;
      } else if ( c <= 0xF4 ) { // XXX replace /w UTF8traits::is4byte when it's updated to exclude [F5-F7].(bug 199090)
        state = 3;
        nonchar = PR_TRUE;
        if ( c == 0xF0 ) { // to exclude F0[80-8F][80-BF]{2}
          overlong = PR_TRUE;
          olupper = 0x8F;
        }
        else if ( c == 0xF4 ) { // to exclude F4[90-BF][80-BF] 
          // actually not surrogates but codepoints beyond 0x10FFFF
          surrogate = PR_TRUE;
          slower = 0x90;
        }
      } else
        return PR_FALSE; // Not UTF-8 string
    }
    
    while (ptr < done_reading && state) {
      c = *ptr++;
      --state;

      // non-character : EF BF [BE-BF] or F[0-7] [89AB]F BF [BE-BF]
      if ( nonchar &&  ( !state &&  c < 0xBE ||
           state == 1 && c != 0xBF  ||
           state == 2 && 0x0F != (0x0F & c) ))
        nonchar = PR_FALSE;

      if ((c & 0xC0) != 0x80 || overlong && c <= olupper ||
           surrogate && slower <= c || nonchar && !state )
        return PR_FALSE; // Not UTF-8 string
      overlong = surrogate = PR_FALSE;
    }
  }
  return !state; // state != 0 at the end indicates an invalid UTF-8 seq. 
}

NS_MSG_BASE void MsgStripQuotedPrintable (unsigned char *src)
{
  // decode quoted printable text in place

  if (!*src)
    return;
  unsigned char *dest = src;
  int srcIdx = 0, destIdx = 0;

  while (src[srcIdx] != 0)
  {
    if (src[srcIdx] == '=')
    {
      unsigned char *token = &src[srcIdx];
      unsigned char c = 0;

      // decode the first quoted char
      if (token[1] >= '0' && token[1] <= '9')
        c = token[1] - '0';
      else if (token[1] >= 'A' && token[1] <= 'F')
        c = token[1] - ('A' - 10);
      else if (token[1] >= 'a' && token[1] <= 'f')
        c = token[1] - ('a' - 10);
      else
      {
        // first char after '=' isn't hex. check if it's a normal char
        // or a soft line break. If it's a soft line break, eat the
        // CR/LF/CRLF.
        if (src[srcIdx + 1] == '\r' || src[srcIdx + 1] == '\n')
        {
          srcIdx++; // soft line break, ignore the '=';
          if (src[srcIdx] == '\r' || src[srcIdx] == '\n')
          {
            srcIdx++;
            if (src[srcIdx] == '\n')
              srcIdx++;
          }
        }
        else // normal char, copy it.
        {
          dest[destIdx++] = src[srcIdx++]; // aka token[0]
        }
        continue;
      }

      // decode the second quoted char
      c = (c << 4);
      if (token[2] >= '0' && token[2] <= '9')
        c += token[2] - '0';
      else if (token[2] >= 'A' && token[2] <= 'F')
        c += token[2] - ('A' - 10);
      else if (token[2] >= 'a' && token[2] <= 'f')
        c += token[2] - ('a' - 10);
      else
      {
        // second char after '=' isn't hex. copy the '=' as a normal char and keep going
        dest[destIdx++] = src[srcIdx++]; // aka token[0]
        continue;
      }

      // if we got here, we successfully decoded a quoted printable sequence,
      // so bump each pointer past it and move on to the next char;
      dest[destIdx++] = c;
      srcIdx += 3;

    }
    else
      dest[destIdx++] = src[srcIdx++];
  }

  dest[destIdx] = src[srcIdx]; // null terminate
}

NS_MSG_BASE nsresult MsgEscapeString(const nsACString &aStr,
                                     PRUint32 aType, nsACString &aResult)
{
  nsresult rv;
  nsCOMPtr<nsINetUtil> nu = do_GetService(NS_NETUTIL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return nu->EscapeString(aStr, aType, aResult);
}

NS_MSG_BASE nsresult MsgUnescapeString(const nsACString &aStr, PRUint32 aFlags, 
                                       nsACString &aResult)
{
  nsresult rv;
  nsCOMPtr<nsINetUtil> nu = do_GetService(NS_NETUTIL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return nu->UnescapeString(aStr, aFlags, aResult);
}

NS_MSG_BASE nsresult MsgEscapeURL(const nsACString &aStr, PRUint32 aFlags,
                                  nsACString &aResult)
{
  nsresult rv;
  nsCOMPtr<nsINetUtil> nu = do_GetService(NS_NETUTIL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return nu->EscapeURL(aStr, aFlags, aResult);
}

NS_MSG_BASE char *MsgEscapeHTML(const char *string)
{
  char *rv = nsnull;
  /* XXX Hardcoded max entity len. The +1 is for the trailing null. */
  PRUint32 len = PL_strlen(string);
  if (len >= (PR_UINT32_MAX / 6))
    return nsnull;

  rv = (char *)NS_Alloc( (6 * len) + 1 );
  char *ptr = rv;

  if (rv)
  {
    for(; *string != '\0'; string++)
    {
      if (*string == '<')
      {
        *ptr++ = '&';
        *ptr++ = 'l';
        *ptr++ = 't';
        *ptr++ = ';';
      }
      else if (*string == '>')
      {
        *ptr++ = '&';
        *ptr++ = 'g';
        *ptr++ = 't';
        *ptr++ = ';';
      }
      else if (*string == '&')
      {
        *ptr++ = '&';
        *ptr++ = 'a';
        *ptr++ = 'm';
        *ptr++ = 'p';
        *ptr++ = ';';
      }
      else if (*string == '"')
      {
        *ptr++ = '&';
        *ptr++ = 'q';
        *ptr++ = 'u';
        *ptr++ = 'o';
        *ptr++ = 't';
        *ptr++ = ';';
      }
      else if (*string == '\'')
      {
        *ptr++ = '&';
        *ptr++ = '#';
        *ptr++ = '3';
        *ptr++ = '9';
        *ptr++ = ';';
      }
      else
      {
        *ptr++ = *string;
      }
    }
    *ptr = '\0';
  }
  return(rv);
}

NS_MSG_BASE PRUnichar *MsgEscapeHTML(const PRUnichar *aSourceBuffer, 
                                      PRInt32 aSourceBufferLen)
{
  // if the caller didn't calculate the length
  if (aSourceBufferLen == -1) {
    aSourceBufferLen = NS_strlen(aSourceBuffer); // ...then I will
  }

  /* XXX Hardcoded max entity len. */
  if (aSourceBufferLen >=
    ((PR_UINT32_MAX - sizeof(PRUnichar)) / (6 * sizeof(PRUnichar))) )
      return nsnull;

  PRUnichar *resultBuffer = (PRUnichar *)nsMemory::Alloc(aSourceBufferLen *
                            6 * sizeof(PRUnichar) + sizeof(PRUnichar('\0')));
                                                        
  PRUnichar *ptr = resultBuffer;

  if (resultBuffer) {
    PRInt32 i;

    for(i = 0; i < aSourceBufferLen; i++) {
      if(aSourceBuffer[i] == '<') {
        *ptr++ = '&';
        *ptr++ = 'l';
        *ptr++ = 't';
        *ptr++ = ';';
      } else if(aSourceBuffer[i] == '>') {
        *ptr++ = '&';
        *ptr++ = 'g';
        *ptr++ = 't';
        *ptr++ = ';';
      } else if(aSourceBuffer[i] == '&') {
        *ptr++ = '&';
        *ptr++ = 'a';
        *ptr++ = 'm';
        *ptr++ = 'p';
        *ptr++ = ';';
      } else if (aSourceBuffer[i] == '"') {
        *ptr++ = '&';
        *ptr++ = 'q';
        *ptr++ = 'u';
        *ptr++ = 'o';
        *ptr++ = 't';
        *ptr++ = ';';
      } else if (aSourceBuffer[i] == '\'') {
        *ptr++ = '&';
        *ptr++ = '#';
        *ptr++ = '3';
        *ptr++ = '9';
        *ptr++ = ';';
      } else {
        *ptr++ = aSourceBuffer[i];
      }
    }
    *ptr = 0;
  }

  return resultBuffer;
}

NS_MSG_BASE void MsgCompressWhitespace(nsCString& aString)
{
#ifdef MOZILLA_INTERNAL_API
  // Use the convenience function provided by the internal API.
  aString.CompressWhitespace(PR_TRUE, PR_TRUE);
#else
  // This code is frozen linkage specific
  aString.Trim(" \f\n\r\t\v");

  char *start, *end;
  aString.BeginWriting(&start, &end);

  for (char *cur = start; cur < end; ++cur) {
    if (!IS_SPACE(*cur))
      continue;

    *cur = ' ';

    if (!IS_SPACE(*(cur + 1)))
      continue;

    // Loop through the white space
    char *wend = cur + 2;
    while (IS_SPACE(*wend)) 
      ++wend;

    PRUint32 wlen = wend - cur - 1;

    // fix "end"
    end -= wlen;

    // move everything forwards a bit
    for (char *m = cur + 1; m < end; ++m) {
      *m = *(m + wlen);
    }
  }

  // Set the new length.
  aString.SetLength(end - start);
#endif
}

NS_MSG_BASE nsresult MsgGetHeadersFromKeys(nsIMsgDatabase *aDB, const nsTArray<nsMsgKey> &aMsgKeys,
                                           nsIMutableArray *aHeaders)
{
  PRUint32 count = aMsgKeys.Length();
  nsresult rv = NS_OK;

  for (PRUint32 kindex = 0; kindex < count; kindex++)
  {
    nsMsgKey key = aMsgKeys.ElementAt(kindex);
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    PRBool hasKey;
    rv = aDB->ContainsKey(key, &hasKey);
    NS_ENSURE_SUCCESS(rv, rv);

    // This function silently skips when the key is not found. This is an expected case.
    if (hasKey)
    {
      rv = aDB->GetMsgHdrForKey(key, getter_AddRefs(msgHdr));
      NS_ENSURE_SUCCESS(rv, rv);

      aHeaders->AppendElement(msgHdr, PR_FALSE);
    }
  }

  return rv;
}

PRBool MsgAdvanceToNextLine(const char *buffer, PRUint32 &bufferOffset, PRUint32 maxBufferOffset)
{
  PRBool result = PR_FALSE;
  for (; bufferOffset < maxBufferOffset; bufferOffset++)
  {
    if (buffer[bufferOffset] == '\r' || buffer[bufferOffset] == '\n')
    {
      bufferOffset++;
      if (buffer[bufferOffset- 1] == '\r' && buffer[bufferOffset] == '\n')
        bufferOffset++;
      result = PR_TRUE;
      break;
    }
  }
  return result;
}

NS_MSG_BASE nsresult
MsgExamineForProxy(const char *scheme, const char *host,
                   PRInt32 port, nsIProxyInfo **proxyInfo)
{
  nsresult rv;
  nsCOMPtr<nsIProtocolProxyService> pps =
          do_GetService(NS_PROTOCOLPROXYSERVICE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv)) {
    nsCAutoString spec(scheme);
    spec.Append("://");
    spec.Append(host);
    spec.Append(':');
    spec.AppendInt(port);
    // XXXXX - Under no circumstances whatsoever should any code which
    // wants a uri do this. I do this here because I do not, in fact,
    // actually want a uri (the dummy uris created here may not be 
    // syntactically valid for the specific protocol), and all we need
    // is something which has a valid scheme, hostname, and a string
    // to pass to PAC if needed - bbaetz
    nsCOMPtr<nsIURI> uri = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv)) {
      rv = uri->SetSpec(spec);
      if (NS_SUCCEEDED(rv))
        rv = pps->Resolve(uri, 0, proxyInfo);
    }
  }
  return rv;
}

NS_MSG_BASE nsresult MsgPromptLoginFailed(nsIMsgWindow *aMsgWindow,
                                          const nsCString &aHostname,
                                          PRInt32 *aResult)
{
  NS_ENSURE_ARG_POINTER(aMsgWindow);
  nsCOMPtr<nsIPrompt> dialog;
  aMsgWindow->GetPromptDialog(getter_AddRefs(dialog));

  nsresult rv;

  // If we haven't got one, use a default dialog.
  if (!dialog)
  {
    nsCOMPtr<nsIWindowWatcher> wwatch =
      do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = wwatch->GetNewPrompter(0, getter_AddRefs(dialog));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCOMPtr<nsIStringBundleService> bundleSvc =
    do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleSvc->CreateBundle("chrome://messenger/locale/messenger.properties",
                               getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString message;
  NS_ConvertUTF8toUTF16 hostNameUTF16(aHostname);
  const PRUnichar *formatStrings[] = { hostNameUTF16.get() };

  rv = bundle->FormatStringFromName(NS_LITERAL_STRING("mailServerLoginFailed").get(),
                                    formatStrings, 1,
                                    getter_Copies(message));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString title;
  rv = bundle->GetStringFromName(
    NS_LITERAL_STRING("mailServerLoginFailedTitle").get(), getter_Copies(title));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString button0;
  rv = bundle->GetStringFromName(
    NS_LITERAL_STRING("mailServerLoginFailedRetryButton").get(),
    getter_Copies(button0));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString button2;
  rv = bundle->GetStringFromName(
    NS_LITERAL_STRING("mailServerLoginFailedEnterNewPasswordButton").get(),
    getter_Copies(button2));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool dummyValue;
  return dialog->ConfirmEx(
    title.get(), message.get(),
    (nsIPrompt::BUTTON_TITLE_IS_STRING * nsIPrompt::BUTTON_POS_0) +
    (nsIPrompt::BUTTON_TITLE_CANCEL * nsIPrompt::BUTTON_POS_1) +
    (nsIPrompt::BUTTON_TITLE_IS_STRING * nsIPrompt::BUTTON_POS_2),
    button0.get(), nsnull, button2.get(), nsnull, &dummyValue, aResult);
}
