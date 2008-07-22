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
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Srilatha Moturi <srilatha@netscape.com>
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

#include "nsCOMPtr.h"
#include "nsIServiceManager.h"
#include "nsMsgBaseCID.h"
#include "nsMsgI18N.h"
#include "nsComm4xMail.h"
#include "nsIImportService.h"
#include "nsIImportMailboxDescriptor.h"
#include "nsComm4xMailStringBundle.h"
#include "nsComm4xMailImport.h"
#include "nsUnicharUtils.h"
#include "Comm4xMailDebugLog.h"
#include "prmem.h"
#include "nsNativeCharsetUtils.h"
#include "nsServiceManagerUtils.h"

#define  kCopyBufferSize    8192
#define  kMailReadBufferSize  16384


static PRBool
nsShouldIgnoreFile(nsString& name)
{
    PRUnichar firstChar=name.CharAt(0);
    if (firstChar == '.' || firstChar == '#' || name.CharAt(name.Length() - 1) == '~')
      return PR_TRUE;

    if (name.LowerCaseEqualsLiteral("rules.dat") || name.LowerCaseEqualsLiteral("rulesbackup.dat"))
        return PR_TRUE;


    // don't add summary files to the list of folders;
    // don't add popstate files to the list either, or rules (sort.dat).
    if (StringEndsWith(name, NS_LITERAL_STRING(".snm")) ||
        name.LowerCaseEqualsLiteral("popstate.dat") ||
        name.LowerCaseEqualsLiteral("sort.dat") ||
        name.LowerCaseEqualsLiteral("mailfilt.log") ||
        name.LowerCaseEqualsLiteral("filters.js") ||
        StringEndsWith(name, NS_LITERAL_STRING(".toc")) ||
        StringEndsWith(name, NS_LITERAL_STRING(".sbd")))
        return PR_TRUE;

    return PR_FALSE;
}

nsComm4xMail::nsComm4xMail()
{
}

nsComm4xMail::~nsComm4xMail()
{
}

nsresult nsComm4xMail::FindMailboxes(nsIFile *pRoot, nsISupportsArray **ppArray)
{
    nsresult rv = NS_NewISupportsArray(ppArray);
    if (NS_FAILED(rv)) {
        IMPORT_LOG0("FAILED to allocate the nsISupportsArray\n");
        return rv;
    }

    nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
    if (NS_FAILED(rv))
        return rv;

    m_depth = 0;

    return (ScanMailDir(pRoot, *ppArray, impSvc));
}


nsresult nsComm4xMail::ScanMailDir(nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport)
{

    m_depth++;
    nsresult rv = IterateMailDir(pFolder, pArray, pImport);
    m_depth--;

    return rv;
}

nsresult nsComm4xMail::IterateMailDir(nsIFile *pFolder, nsISupportsArray *pArray, nsIImportService *pImport)
{
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = pFolder->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  directoryEnumerator->HasMoreElements(&hasMore);
  while (hasMore && NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsISupports> aSupport;
    rv = directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsILocalFile> currentFolderPath(do_QueryInterface(aSupport, &rv));
    directoryEnumerator->HasMoreElements(&hasMore);

    PRBool                    isFile;
    nsCString            pName;
    nsCString            dirName;
    nsAutoString              currentFolderNameStr;
    PRBool                    isDirectory, exists;
    nsAutoString              ext;


    rv = currentFolderPath->GetLeafName(currentFolderNameStr);
    isFile = PR_FALSE;
    currentFolderPath->IsFile(&isFile);
    if (isFile)
    {
      if (!nsShouldIgnoreFile(currentFolderNameStr))
      {
        rv = FoundMailbox(currentFolderPath, &currentFolderNameStr, pArray, pImport);
        if (NS_FAILED(rv))
          return rv;
        currentFolderNameStr.AppendLiteral(".sbd");
        rv = currentFolderPath->SetLeafName(currentFolderNameStr);
        if (NS_FAILED(rv))
          return rv;
        exists = PR_FALSE;
        currentFolderPath->Exists(&exists);
        isDirectory = PR_FALSE;
        currentFolderPath->IsDirectory(&isDirectory);
        if (exists && isDirectory) {
          rv = ScanMailDir (currentFolderPath, pArray, pImport);
          if (NS_FAILED(rv))
            return rv;
        }
      }
    }
  }
  return rv;
}

nsresult nsComm4xMail::FoundMailbox(nsIFile *mailFile, nsAutoString *pName, nsISupportsArray *pArray, nsIImportService *pImport)
{
    nsCOMPtr<nsIImportMailboxDescriptor>    desc;

    nsCString pPath;
    mailFile->GetNativePath(pPath);
    if (!pPath.IsEmpty())
      IMPORT_LOG2("Found comm4x mailbox: %s, m_depth = %d\n", pPath.get(), m_depth);
    else
      IMPORT_LOG2("Can't get native path but found comm4x mailbox: %s, m_depth = %d\n", NS_ConvertUTF16toUTF8(*pName).get(), m_depth);

    nsresult rv = pImport->CreateNewMailboxDescriptor(getter_AddRefs(desc));
    if (NS_SUCCEEDED(rv)) {
        PRInt64        sz = 0;
        mailFile->GetFileSize(&sz);
        desc->SetDisplayName(pName->get());
        desc->SetDepth(m_depth);
        desc->SetSize((PRUint32) sz);
        nsCOMPtr <nsILocalFile> pFile;
        desc->GetFile(getter_AddRefs(pFile));
        if (pFile) {
          nsCOMPtr <nsILocalFile> localMailFile = do_QueryInterface(mailFile);
          pFile->InitWithFile(localMailFile);
        }
        nsCOMPtr <nsISupports> pInterface = do_QueryInterface(desc);
        if (pInterface)
            pArray->AppendElement(pInterface);
    }
    return NS_OK;
}

