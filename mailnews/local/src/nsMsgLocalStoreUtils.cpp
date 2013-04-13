/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
#include "msgCore.h"    // precompiled header...
#include "nsMsgLocalStoreUtils.h"
#include "nsIFile.h"
#include "prprf.h"

#define EXTRA_SAFETY_SPACE 0x400000 // (4MiB)

nsMsgLocalStoreUtils::nsMsgLocalStoreUtils()
{
}

nsresult
nsMsgLocalStoreUtils::AddDirectorySeparator(nsIFile *path)
{
  nsAutoString leafName;
  path->GetLeafName(leafName);
  leafName.AppendLiteral(FOLDER_SUFFIX);
  return path->SetLeafName(leafName);
}

bool
nsMsgLocalStoreUtils::nsShouldIgnoreFile(nsAString& name)
{
  PRUnichar firstChar = name.First();
  if (firstChar == '.' || firstChar == '#' ||
      name.CharAt(name.Length() - 1) == '~')
    return true;

  if (name.LowerCaseEqualsLiteral("msgfilterrules.dat") ||
      name.LowerCaseEqualsLiteral("rules.dat") ||
      name.LowerCaseEqualsLiteral("filterlog.html") ||
      name.LowerCaseEqualsLiteral("junklog.html") ||
      name.LowerCaseEqualsLiteral("rulesbackup.dat"))
    return true;

  // don't add summary files to the list of folders;
  // don't add popstate files to the list either, or rules (sort.dat).
  if (StringEndsWith(name, NS_LITERAL_STRING(".snm")) ||
      name.LowerCaseEqualsLiteral("popstate.dat") ||
      name.LowerCaseEqualsLiteral("sort.dat") ||
      name.LowerCaseEqualsLiteral("mailfilt.log") ||
      name.LowerCaseEqualsLiteral("filters.js") ||
      StringEndsWith(name, NS_LITERAL_STRING(".toc")))
    return true;

  // ignore RSS data source files
  if (name.LowerCaseEqualsLiteral("feeds.rdf") ||
      name.LowerCaseEqualsLiteral("feeditems.rdf"))
    return true;

  // The .mozmsgs dir is for spotlight support
    return (StringEndsWith(name, NS_LITERAL_STRING(".mozmsgs")) ||
            StringEndsWith(name, NS_LITERAL_STRING(".sbd")) ||
            StringEndsWith(name, NS_LITERAL_STRING(SUMMARY_SUFFIX)));
}

/**
 * We're passed a stream positioned at the start of the message.
 * We start reading lines, looking for x-mozilla-keys: headers; If we're
 * adding the keyword and we find a header with the desired keyword already
 * in it, we don't need to do anything. Likewise, if removing keyword and we
 * don't find it,we don't need to do anything. Otherwise, if adding, we need
 * to see if there's an x-mozilla-keys header with room for the new keyword.
 *  If so, we replace the corresponding number of spaces with the keyword.
 * If no room, we can't do anything until the folder is compacted and another
 * x-mozilla-keys header is added. In that case, we set a property
 * on the header, which the compaction code will check.
 * This is not true for maildir, however, since it won't require compaction.
 */

void
nsMsgLocalStoreUtils::ChangeKeywordsHelper(nsIMsgDBHdr *message,
                                           uint64_t desiredOffset,
                                           nsLineBuffer<char> *lineBuffer,
                                           nsTArray<nsCString> &keywordArray,
                                           bool aAdd,
                                           nsIOutputStream *outputStream,
                                           nsISeekableStream *seekableStream,
                                           nsIInputStream *inputStream)
{
  uint32_t bytesWritten;

  for (uint32_t i = 0; i < keywordArray.Length(); i++)
  {
    nsAutoCString header;
    nsAutoCString keywords;
    bool done = false;
    uint32_t len = 0;
    nsAutoCString keywordToWrite(" ");

    keywordToWrite.Append(keywordArray[i]);
    seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, desiredOffset);
    // need to reset lineBuffer, which is cheaper than creating a new one.
    lineBuffer->start = lineBuffer->end = lineBuffer->buf;
    bool inKeywordHeader = false;
    bool foundKeyword = false;
    int64_t offsetToAddKeyword = 0;
    bool more;
    message->GetMessageSize(&len);
    // loop through
    while (!done)
    {
      int64_t lineStartPos;
      seekableStream->Tell(&lineStartPos);
      // we need to adjust the linestart pos by how much extra the line
      // buffer has read from the stream.
      lineStartPos -= (lineBuffer->end - lineBuffer->start);
      // NS_ReadLine doesn't return line termination chars.
      nsCString keywordHeaders;
      nsresult rv = NS_ReadLine(inputStream, lineBuffer, keywordHeaders, &more);
      if (NS_SUCCEEDED(rv))
      {
        if (keywordHeaders.IsEmpty())
          break; // passed headers; no x-mozilla-keywords header; give up.
        if (StringBeginsWith(keywordHeaders,
                             NS_LITERAL_CSTRING(HEADER_X_MOZILLA_KEYWORDS)))
          inKeywordHeader = true;
        else if (inKeywordHeader && (keywordHeaders.CharAt(0) == ' ' ||
                                     keywordHeaders.CharAt(0) == '\t'))
          ; // continuation header line
        else if (inKeywordHeader)
          break;
        else
          continue;
        uint32_t keywordHdrLength = keywordHeaders.Length();
        int32_t startOffset, keywordLength;
        // check if we have the keyword
        if (MsgFindKeyword(keywordArray[i], keywordHeaders, &startOffset,
                           &keywordLength))
        {
          foundKeyword = true;
          if (!aAdd) // if we're removing, remove it, and break;
          {
            keywordHeaders.Cut(startOffset, keywordLength);
            for (int32_t j = keywordLength; j > 0; j--)
              keywordHeaders.Append(' ');
            seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, lineStartPos);
            outputStream->Write(keywordHeaders.get(), keywordHeaders.Length(),
                                &bytesWritten);
          }
          offsetToAddKeyword = 0;
          // if adding and we already have the keyword, done
          done = true;
          break;
        }
        // argh, we need to check all the lines to see if we already have the
        // keyword, but if we don't find it, we want to remember the line and
        // position where we have room to add the keyword.
        if (aAdd)
        {
          nsAutoCString curKeywordHdr(keywordHeaders);
          // strip off line ending spaces.
          curKeywordHdr.Trim(" ", false, true);
          if (!offsetToAddKeyword && curKeywordHdr.Length() +
                keywordToWrite.Length() < keywordHdrLength)
            offsetToAddKeyword = lineStartPos + curKeywordHdr.Length();
        }
      }
    }
    if (aAdd && !foundKeyword)
    {
      if (!offsetToAddKeyword)
        message->SetUint32Property("growKeywords", 1);
      else
      {
        seekableStream->Seek(nsISeekableStream::NS_SEEK_SET,
                             offsetToAddKeyword);
        outputStream->Write(keywordToWrite.get(), keywordToWrite.Length(),
                            &bytesWritten);
      }
    }
  }
}

nsresult
nsMsgLocalStoreUtils::UpdateFolderFlag(nsIMsgDBHdr *mailHdr, bool bSet,
                                       nsMsgMessageFlagType flag,
                                       nsIOutputStream *fileStream)
{
  uint32_t statusOffset;
  uint64_t msgOffset;
  (void) mailHdr->GetStatusOffset(&statusOffset);
  // This probably means there's no x-mozilla-status header, so
  // we just ignore this.
  if (statusOffset == 0)
    return NS_OK;
  (void)mailHdr->GetMessageOffset(&msgOffset);
  uint64_t statusPos = msgOffset + statusOffset;
  nsresult rv;
  nsCOMPtr<nsISeekableStream> seekableStream(do_QueryInterface(fileStream, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, statusPos);
  NS_ENSURE_SUCCESS(rv, rv);
  char buf[50];
  buf[0] = '\0';
  nsCOMPtr<nsIInputStream> inputStream = do_QueryInterface(fileStream, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  uint32_t bytesRead;
  if (NS_SUCCEEDED(inputStream->Read(buf, X_MOZILLA_STATUS_LEN + 6,
                                     &bytesRead)))
  {
    buf[bytesRead] = '\0';
    if (strncmp(buf, X_MOZILLA_STATUS, X_MOZILLA_STATUS_LEN) == 0 &&
      strncmp(buf + X_MOZILLA_STATUS_LEN, ": ", 2) == 0 &&
      strlen(buf) >= X_MOZILLA_STATUS_LEN + 6)
    {
      uint32_t flags;
      uint32_t bytesWritten;
      (void)mailHdr->GetFlags(&flags);
      if (!(flags & nsMsgMessageFlags::Expunged))
      {
        char *p = buf + X_MOZILLA_STATUS_LEN + 2;

        nsresult errorCode = NS_OK;
        flags = nsDependentCString(p).ToInteger(&errorCode, 16);

        uint32_t curFlags;
        (void)mailHdr->GetFlags(&curFlags);
        flags = (flags & nsMsgMessageFlags::Queued) |
          (curFlags & ~nsMsgMessageFlags::RuntimeOnly);
        if (bSet)
          flags |= flag;
        else
          flags &= ~flag;
      }
      else
      {
        flags &= ~nsMsgMessageFlags::RuntimeOnly;
      }
      seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, statusPos);
      // We are filing out x-mozilla-status flags here
      PR_snprintf(buf, sizeof(buf), X_MOZILLA_STATUS_FORMAT,
        flags & 0x0000FFFF);
      int32_t lineLen = PL_strlen(buf);
      uint64_t status2Pos = statusPos + lineLen;
      fileStream->Write(buf, lineLen, &bytesWritten);

      if (flag & 0xFFFF0000)
      {
        // time to upate x-mozilla-status2
        // first find it by finding end of previous line, see bug 234935
        seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, status2Pos);
        do
        {
          rv = inputStream->Read(buf, 1, &bytesRead);
          status2Pos++;
        } while (NS_SUCCEEDED(rv) && (*buf == '\n' || *buf == '\r'));
        status2Pos--;
        seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, status2Pos);
        if (NS_SUCCEEDED(inputStream->Read(buf, X_MOZILLA_STATUS2_LEN + 10,
                                           &bytesRead)))
        {
          if (strncmp(buf, X_MOZILLA_STATUS2, X_MOZILLA_STATUS2_LEN) == 0 &&
            strncmp(buf + X_MOZILLA_STATUS2_LEN, ": ", 2) == 0 &&
            strlen(buf) >= X_MOZILLA_STATUS2_LEN + 10)
          {
            uint32_t dbFlags;
            (void)mailHdr->GetFlags(&dbFlags);
            dbFlags &= 0xFFFF0000;
            seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, status2Pos);
            PR_snprintf(buf, sizeof(buf), X_MOZILLA_STATUS2_FORMAT, dbFlags);
            fileStream->Write(buf, PL_strlen(buf), &bytesWritten);
          }
        }
      }
    }
    else
    {
#ifdef DEBUG
      printf("Didn't find %s where expected at position %ld\n"
        "instead, found %s.\n",
        X_MOZILLA_STATUS, (long) statusPos, buf);
#endif
      rv = NS_ERROR_FAILURE;
    }
  }
  else
    rv = NS_ERROR_FAILURE;
  return rv;
}

/**
 * Returns true if there is enough space on disk.
 *
 * @param aFile  Any file in the message store that is on a logical
 *               disk volume so that it can be queried for disk space.
 * @param aSpaceRequested  The size of free space there must be on the disk
 *                         to return true.
 */
bool
nsMsgLocalStoreUtils::DiskSpaceAvailableInStore(nsIFile *aFile, uint64_t aSpaceRequested)
{
  int64_t diskFree;
  nsresult rv = aFile->GetDiskSpaceAvailable(&diskFree);
  if (NS_SUCCEEDED(rv)) {
#ifdef DEBUG
    printf("GetDiskSpaceAvailable returned: %lld bytes\n", diskFree);
#endif
    // When checking for disk space available, take into consideration
    // possible database changes, therefore ask for a little more
    // (EXTRA_SAFETY_SPACE) than what the requested size is. Also, due to disk
    // sector sizes, allocation blocks, etc. The space "available" may be greater
    // than the actual space usable.
    return ((aSpaceRequested + EXTRA_SAFETY_SPACE) < (uint64_t) diskFree);
  } else {
    // The call to GetDiskSpaceAvailable FAILED!
    // This will happen on certain platforms where GetDiskSpaceAvailable
    // is not implemented. Since people on those platforms still need
    // to download mail, we will simply bypass the disk-space check.
    //
    // We'll leave a debug message to warn people.
#ifdef DEBUG
    printf("Call to GetDiskSpaceAvailable FAILED! \n");
#endif
    return true;
  }
}
