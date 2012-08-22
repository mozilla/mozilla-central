/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#include "nsEudoraEditor.h"
#include "nsISupportsArray.h"
#include "nsComponentManagerUtils.h"
#include "nsStringGlue.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "nsImportEmbeddedImageData.h"

static char *     sEudoraEmbeddedContentLines[] = {
  "Embedded Content: ",
  "\0"  //  Explicit terminating string
};

// Lightly adapted from code in Windows Eudora that hashes the img src cid.
static uint32_t EudoraHashString(const char* pszStr)
{
  uint32_t        ulSum = 0;
  const uint32_t  kKRHashPrime = 2147483629;

  // algorithm: KRHash---derived from Karp & Rabin, Harvard Center for Research
  // in Computing Technology Tech. Report TR-31-81. The constant prime number,
  // kKRHashPrime, happens to be the largest prime number that will fit in
  // 31 bits, except for 2^31-1 itself.

  for (; *pszStr; pszStr++)
  {
    for (int32_t nBit = 0x80; nBit != 0; nBit >>= 1)
    {
      ulSum += ulSum;
      if (ulSum >= kKRHashPrime)
        ulSum -= kKRHashPrime;
      if ((*pszStr) & nBit)
        ++ulSum;
      if (ulSum>= kKRHashPrime)
        ulSum -= kKRHashPrime;
    }
  }

  return ulSum + 1;
}


nsEudoraEditor::nsEudoraEditor(const char * pBody, nsIFile * pMailImportLocation)
  : m_body(pBody)
{
  m_pMailImportLocation = pMailImportLocation;
}


nsEudoraEditor::~nsEudoraEditor()
{
}

nsresult nsEudoraEditor::GetEmbeddedObjects(nsISupportsArray ** aNodeList)
{
  NS_ENSURE_ARG_POINTER(aNodeList);

  // Check to see if we were already called
  if (m_EmbeddedObjectList != nullptr)
  {
    *aNodeList = m_EmbeddedObjectList;
    return NS_OK;
  }

  // Create array in m_EmbeddedObjectList
  nsresult rv = NS_NewISupportsArray(getter_AddRefs(m_EmbeddedObjectList));
  NS_ENSURE_SUCCESS(rv, rv);

  // Return m_EmbeddedObjectList in aNodeList and increment ref count - caller
  // assumes that we incremented the ref count.
  NS_IF_ADDREF(*aNodeList = m_EmbeddedObjectList);

  // Create the embedded folder spec
  nsCOMPtr<nsIFile>   embeddedFolderSpec;
  // Create the embedded image spec
  nsCOMPtr<nsIFile>   embeddedImageSpec;

  // Fill in the details for the embedded folder spec - "Embedded" folder
  // inside of the mail folder. We don't bother to check to see if the embedded
  // folder exists, because it seems to me that would only save time in the
  // unexpected case where it doesn't exist. Keep in mind that we will be checking
  // for the existence of any embedded images anyway - if the folder doesn't
  // exist that check will fail.
  rv = m_pMailImportLocation->Clone(getter_AddRefs(embeddedFolderSpec));
  NS_ENSURE_SUCCESS(rv, rv);
  embeddedFolderSpec->AppendNative(NS_LITERAL_CSTRING("Embedded"));

  // Look for the start of the last closing tag so that we only search for
  // valid "Embedded Content" lines. (In practice this is not super important,
  // but there were some proof of concept exploits at one point where "Embedded
  // Content" lines were faked in the body of messages).
  int32_t     startLastClosingTag = m_body.RFind("</");
  if (startLastClosingTag == kNotFound)
    startLastClosingTag = 0;
  bool        foundEmbeddedContentLines = false;

  // Search for various translations of "Embedded Content" - as of this writing only
  // one that I know of, but then again I didn't realize that Eudora translators had
  // ever translated "Attachment Converted" as suggested by other Eudora importing code.
  for (int32_t i = 0; *sEudoraEmbeddedContentLines[i] != '\0'; i++)
  {
    // Search for "Embedded Content: " lines starting after last closing tag (if any)
    int32_t   startEmbeddedContentLine = startLastClosingTag;
    int32_t   lenEmbeddedContentTag = strlen(sEudoraEmbeddedContentLines[i]);

    while ((startEmbeddedContentLine = m_body.Find(sEudoraEmbeddedContentLines[i],
                                                   true,
                                                   startEmbeddedContentLine+1)) != kNotFound)
    {
      // Found this translation of "Embedded Content" - remember that so that we don't
      // bother looking for any other translations.
      foundEmbeddedContentLines = true;

      // Extract the file name from the embedded content line
      int32_t   startFileName = startEmbeddedContentLine + lenEmbeddedContentTag;
      int32_t   endFileName = m_body.Find(":", false, startFileName);

      // Create the file spec for the embedded image
      embeddedFolderSpec->Clone(getter_AddRefs(embeddedImageSpec));
      embeddedImageSpec->Append(Substring(m_body, startFileName, endFileName - startFileName));

      // Verify that the embedded image spec exists and is a file
      bool      isFile = false;
      bool      exists = false;
      if (NS_FAILED(embeddedImageSpec->Exists(&exists)) || NS_FAILED(embeddedImageSpec->IsFile(&isFile)))
        continue;
      if (!exists || !isFile)
        continue;

      // Extract CID hash from the embedded content line
      int32_t     cidHashValue;
      int32_t     startCIDHash = m_body.Find(",", false, endFileName);
      if (startCIDHash != kNotFound)
      {
        startCIDHash++;
        int32_t   endCIDHash = m_body.Find(",", false, startCIDHash);

        if (endCIDHash != kNotFound)
        {
          nsString    cidHash;
          cidHash.Assign(Substring(m_body, startCIDHash, endCIDHash - startCIDHash));

          if (!cidHash.IsEmpty())
          {
            // Convert CID hash string to numeric value
            nsresult aErrorCode;
            cidHashValue = cidHash.ToInteger(&aErrorCode, 16);
          }
        }
      }

      // Get the URL for the embedded image
      nsCString     embeddedImageURL;
      rv = NS_GetURLSpecFromFile(embeddedImageSpec, embeddedImageURL);
      NS_ENSURE_SUCCESS(rv, rv);

      NS_ConvertASCIItoUTF16 srcUrl(embeddedImageURL);
      nsString cid;
      // We're going to remember the original cid in the image element,
      // which the send code will retrieve as the kMozCIDAttrName property.
      GetEmbeddedImageCID(cidHashValue, srcUrl, cid);
      nsCOMPtr<nsIURI> embeddedFileURI;
      NS_NewFileURI(getter_AddRefs(embeddedFileURI), embeddedImageSpec);

      // Create the embedded image node
      nsImportEmbeddedImageData *imageData =
        new nsImportEmbeddedImageData(embeddedFileURI, NS_LossyConvertUTF16toASCII(cid));

      // Append the embedded image node to the list
      m_EmbeddedObjectList->AppendElement(imageData);

      int32_t   endEmbeddedContentLine = m_body.Find("\r\n", true, startEmbeddedContentLine+1);
      if (endEmbeddedContentLine != kNotFound)
      {
        // We recognized the "Embedded Content" line correctly and found the associated image.
        // Remove the Eudora specific line about it now.
        m_body.Cut(startEmbeddedContentLine, endEmbeddedContentLine - startEmbeddedContentLine + 2);

        // Backup by one to correct where we start looking for the next line
        startEmbeddedContentLine--;
      }
    }

    // Assume at most one translation for "Embedded Content: " in a given message
    if (foundEmbeddedContentLines)
      break;
  }

  return NS_OK;
}

bool nsEudoraEditor::GetEmbeddedImageCID(uint32_t aCIDHash, const nsAString & aOldRef, nsString &aCID)
{
  bool      foundMatch = false;
  int32_t   startImageTag = 0;
  int32_t   closeImageTag = 0;

  while ((startImageTag = m_body.Find("<img", true, closeImageTag)) != kNotFound)
  {
    closeImageTag = m_body.Find(">", false, startImageTag);

    // We should always find a close tag, bail if we don't
    if (closeImageTag == kNotFound)
      break;

    // Find the source attribute and make sure it's for our image tag
    int32_t   startSrcValue = m_body.Find("src", true, startImageTag);
    if ((startSrcValue == kNotFound) || (startSrcValue > closeImageTag))
      continue;

    // Move past the src
    startSrcValue += 3;

    // Move past any whitespace
    while (isspace(m_body.CharAt(startSrcValue)))
      ++startSrcValue;

    // We should find an = now
    if (m_body.CharAt(startSrcValue) != '=')
      continue;

    // Move past =
    ++startSrcValue;

    // Move past any whitespace
    while (isspace(m_body.CharAt(startSrcValue)))
      ++startSrcValue;

    // Get the quote char and verify that it's valid
    char    quoteChar = static_cast <char> (m_body.CharAt(startSrcValue));
    if ((quoteChar != '"') && (quoteChar != '\''))
      continue;

    // Move past the quote
    ++startSrcValue;

    int32_t   endSrcValue = m_body.FindChar(quoteChar, startSrcValue);
    int32_t   srcLength = endSrcValue - startSrcValue;

    nsString  srcValue;
    aCID.Assign(Substring(m_body, startSrcValue, srcLength));

    if (aCIDHash != 0)
    {
      // Verify source value starts with "cid:"
      if (!StringBeginsWith(aCID, NS_LITERAL_STRING("cid:"), nsCaseInsensitiveStringComparator()))
        continue;

      // Remove "cid:" from the start
      aCID.Cut(0, 4);

      uint32_t  hashValue = EudoraHashString(NS_LossyConvertUTF16toASCII(aCID).get());
      foundMatch = (hashValue == aCIDHash);
    }
    else
    {
      foundMatch = aCID.Equals(aOldRef);
    }
  }

  return foundMatch;
}


bool nsEudoraEditor::HasEmbeddedContent()
{
  // Simple quick test to see if there's any embedded content lines
  bool     bHasEmbeddedContent = false;

  for (int32_t i = 0; *sEudoraEmbeddedContentLines[i] != '\0'; i++)
  {
    bHasEmbeddedContent = (m_body.Find(sEudoraEmbeddedContentLines[i], true, 0) != kNotFound);

    if (bHasEmbeddedContent)
      break;
  }

  return bHasEmbeddedContent;
}

