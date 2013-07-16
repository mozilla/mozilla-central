/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
*/

#ifdef MOZ_LOGGING
// sorry, this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "prthread.h"
#include "prprf.h"
#include "nscore.h"
#include "nsCOMPtr.h"
#include "nsISupportsArray.h"

#include "nsIImportMail.h"
#include "nsIImportGeneric.h"
#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "nsIImportMailboxDescriptor.h"

#include "nsStringGlue.h"
#include "nsUnicharUtils.h"

#include "nsMsgUtils.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgFolder.h"
#include "nsImportStringBundle.h"
#include "nsIStringBundle.h"
#include "nsTextFormatter.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIImportService.h"
#include "ImportDebug.h"
#include "plstr.h"
#include "MailNewsTypes.h"
#include "nsThreadUtils.h"
#include "mozilla/Services.h"

#define IMPORT_MSGS_URL       "chrome://messenger/locale/importMsgs.properties"

////////////////////////////////////////////////////////////////////////

static void ImportMailThread(void *stuff);

class ImportThreadData;

class nsImportGenericMail : public nsIImportGeneric
{
public:

  nsImportGenericMail();
  virtual ~nsImportGenericMail();

  NS_DECL_THREADSAFE_ISUPPORTS

  /* nsISupports GetData (in string dataId); */
  NS_IMETHOD GetData(const char *dataId, nsISupports **_retval);

  NS_IMETHOD SetData(const char *dataId, nsISupports *pData);

  NS_IMETHOD GetStatus(const char *statusKind, int32_t *_retval);

  NS_IMETHOD WantsProgress(bool *_retval);

  NS_IMETHODIMP BeginImport(nsISupportsString *successLog, nsISupportsString *errorLog, bool *_retval) ;

  NS_IMETHOD ContinueImport(bool *_retval);

  NS_IMETHOD GetProgress(int32_t *_retval);

  NS_IMETHOD CancelImport(void);

private:
  bool    CreateFolder(nsIMsgFolder **ppFolder);
  void  GetDefaultMailboxes(void);
  void  GetDefaultLocation(void);
  void  GetDefaultDestination(void);
  void  GetMailboxName(uint32_t index, nsISupportsString *pStr);

public:
  static void  SetLogs(nsString& success, nsString& error, nsISupportsString *pSuccess, nsISupportsString *pError);
  static void ReportError(int32_t id, const PRUnichar *pName, nsString *pStream, nsIStringBundle* aBundle);

private:
  nsString      m_pName;  // module name that created this interface
  nsIMsgFolder *    m_pDestFolder;
  bool          m_deleteDestFolder;
  bool          m_createdFolder;
  nsCOMPtr <nsIFile> m_pSrcLocation;
  bool          m_gotLocation;
  bool          m_found;
  bool          m_userVerify;
  nsIImportMail *    m_pInterface;
  nsISupportsArray *  m_pMailboxes;
  nsISupportsString *m_pSuccessLog;
  nsISupportsString *m_pErrorLog;
  uint32_t      m_totalSize;
  bool          m_doImport;
  ImportThreadData *  m_pThreadData;
    bool          m_performingMigration;
  nsCOMPtr<nsIStringBundle> m_stringBundle;
};

class ImportThreadData {
public:
  bool            driverAlive;
  bool            threadAlive;
  bool            abort;
  bool            fatalError;
  uint32_t        currentTotal;
  uint32_t        currentSize;
  nsIMsgFolder *      destRoot;
  bool            ownsDestRoot;
  nsISupportsArray *    boxes;
  nsIImportMail *      mailImport;
  nsISupportsString *  successLog;
  nsISupportsString *  errorLog;
  uint32_t        currentMailbox;
    bool            performingMigration;
  nsIStringBundle *stringBundle;

  ImportThreadData();
  ~ImportThreadData();
  void DriverDelete();
  void ThreadDelete();
  void DriverAbort();
};

// forward decl for proxy methods
nsresult ProxyGetSubFolders(nsIMsgFolder *aFolder,
                            nsISimpleEnumerator **aEnumerator);
nsresult ProxyGetChildNamed(nsIMsgFolder *aFolder,const nsAString & aName,
                            nsIMsgFolder **aChild);
nsresult ProxyGetParent(nsIMsgFolder *aFolder, nsIMsgFolder **aParent);
nsresult ProxyContainsChildNamed(nsIMsgFolder *aFolder, const nsAString &aName,
                                 bool *aResult);
nsresult ProxyGenerateUniqueSubfolderName(nsIMsgFolder *aFolder,
                                          const nsAString& aPrefix,
                                          nsIMsgFolder *aOtherFolder,
                                          nsAString& aName);
nsresult ProxyCreateSubfolder(nsIMsgFolder *aFolder, const nsAString &aName);
nsresult ProxyForceDBClosed(nsIMsgFolder *aFolder);

nsresult NS_NewGenericMail(nsIImportGeneric** aImportGeneric)
{
    NS_PRECONDITION(aImportGeneric != nullptr, "null ptr");
    if (! aImportGeneric)
        return NS_ERROR_NULL_POINTER;

  nsImportGenericMail *pGen = new nsImportGenericMail();

  if (pGen == nullptr)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(pGen);
  nsresult rv = pGen->QueryInterface(NS_GET_IID(nsIImportGeneric), (void **)aImportGeneric);
  NS_RELEASE(pGen);

    return rv;
}

nsImportGenericMail::nsImportGenericMail()
{
  m_found = false;
  m_userVerify = false;
  m_gotLocation = false;
  m_pInterface = nullptr;
  m_pMailboxes = nullptr;
  m_pSuccessLog = nullptr;
  m_pErrorLog = nullptr;
  m_totalSize = 0;
  m_doImport = false;
  m_pThreadData = nullptr;

  m_pDestFolder = nullptr;
  m_deleteDestFolder = false;
  m_createdFolder = false;
    m_performingMigration = false;

  // Init logging module.
  if (!IMPORTLOGMODULE)
    IMPORTLOGMODULE = PR_NewLogModule("IMPORT");

  nsresult rv = nsImportStringBundle::GetStringBundle(IMPORT_MSGS_URL, getter_AddRefs(m_stringBundle));
  if (NS_FAILED(rv))
    IMPORT_LOG0("Failed to get string bundle for Importing Mail");
}


nsImportGenericMail::~nsImportGenericMail()
{
  if (m_pThreadData) {
    m_pThreadData->DriverAbort();
    m_pThreadData = nullptr;
  }

  NS_IF_RELEASE(m_pDestFolder);
  NS_IF_RELEASE(m_pInterface);
  NS_IF_RELEASE(m_pMailboxes);
  NS_IF_RELEASE(m_pSuccessLog);
  NS_IF_RELEASE(m_pErrorLog);
}



NS_IMPL_ISUPPORTS1(nsImportGenericMail, nsIImportGeneric)


NS_IMETHODIMP nsImportGenericMail::GetData(const char *dataId, nsISupports **_retval)
{
  nsresult rv = NS_OK;

  NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = nullptr;
  if (!PL_strcasecmp(dataId, "mailInterface")) {
    *_retval = m_pInterface;
    NS_IF_ADDREF(m_pInterface);
  }

  if (!PL_strcasecmp(dataId, "mailBoxes")) {
    if (!m_pMailboxes)
      GetDefaultMailboxes();
    *_retval = m_pMailboxes;
    NS_IF_ADDREF(m_pMailboxes);
  }

  if (!PL_strcasecmp(dataId, "mailLocation")) {
    if (!m_pSrcLocation)
      GetDefaultLocation();
    NS_IF_ADDREF(*_retval = m_pSrcLocation);
  }

  if (!PL_strcasecmp(dataId, "mailDestination")) {
    if (!m_pDestFolder)
      GetDefaultDestination();
    NS_IF_ADDREF(*_retval = m_pDestFolder);
  }

  if (!PL_strcasecmp(dataId, "migration")) {
        nsCOMPtr<nsISupportsPRBool> migrationString = do_CreateInstance(NS_SUPPORTS_PRBOOL_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        migrationString->SetData(m_performingMigration);
        NS_IF_ADDREF(*_retval = migrationString);
  }

  if (!PL_strcasecmp(dataId, "currentMailbox")) {
    // create an nsISupportsString, get the current mailbox
    // name being imported and put it in the string
    nsCOMPtr<nsISupportsString>  data = do_CreateInstance(NS_SUPPORTS_STRING_CONTRACTID, &rv);
    if (NS_FAILED(rv))
      return rv;
    if (m_pThreadData) {
      GetMailboxName(m_pThreadData->currentMailbox, data);
    }
    NS_ADDREF(*_retval = data);
  }

  return rv;
}

NS_IMETHODIMP nsImportGenericMail::SetData(const char *dataId, nsISupports *item)
{
  nsresult rv = NS_OK;
  NS_PRECONDITION(dataId != nullptr, "null ptr");
  if (!dataId)
    return NS_ERROR_NULL_POINTER;

  if (!PL_strcasecmp(dataId, "mailInterface")) {
    NS_IF_RELEASE(m_pInterface);
    if (item)
      item->QueryInterface(NS_GET_IID(nsIImportMail), (void **) &m_pInterface);
  }
  if (!PL_strcasecmp(dataId, "mailBoxes")) {
    NS_IF_RELEASE(m_pMailboxes);
    if (item)
      item->QueryInterface(NS_GET_IID(nsISupportsArray), (void **) &m_pMailboxes);
  }

  if (!PL_strcasecmp(dataId, "mailLocation")) {
    NS_IF_RELEASE(m_pMailboxes);
    m_pSrcLocation = nullptr;
    if (item) {
      nsresult rv;
      nsCOMPtr <nsIFile> location = do_QueryInterface(item, &rv);
      NS_ENSURE_SUCCESS(rv,rv);
      m_pSrcLocation = location;
    }
  }

  if (!PL_strcasecmp(dataId, "mailDestination")) {
    NS_IF_RELEASE(m_pDestFolder);
    if (item)
      item->QueryInterface(NS_GET_IID(nsIMsgFolder), (void **) &m_pDestFolder);
    m_deleteDestFolder = false;
  }

  if (!PL_strcasecmp(dataId, "name")) {
    nsCOMPtr<nsISupportsString> nameString;
    if (item) {
      item->QueryInterface(NS_GET_IID(nsISupportsString), getter_AddRefs(nameString));
      rv = nameString->GetData(m_pName);
    }
  }

  if (!PL_strcasecmp(dataId, "migration")) {
    nsCOMPtr<nsISupportsPRBool> migrationString;
    if (item) {
      item->QueryInterface(NS_GET_IID(nsISupportsPRBool), getter_AddRefs(migrationString));
      rv = migrationString->GetData(&m_performingMigration);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImportGenericMail::GetStatus(const char *statusKind, int32_t *_retval)
{
  NS_PRECONDITION(statusKind != nullptr, "null ptr");
  NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (!statusKind || !_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = 0;

  if (!PL_strcasecmp(statusKind, "isInstalled")) {
    GetDefaultLocation();
    *_retval = (int32_t) m_found;
  }

  if (!PL_strcasecmp(statusKind, "canUserSetLocation")) {
    GetDefaultLocation();
    *_retval = (int32_t) m_userVerify;
  }

  return NS_OK;
}


void nsImportGenericMail::GetDefaultLocation(void)
{
  if (!m_pInterface)
    return;

  if (m_pSrcLocation && m_gotLocation)
    return;

  m_gotLocation = true;

  nsCOMPtr <nsIFile> pLoc;
  m_pInterface->GetDefaultLocation(getter_AddRefs(pLoc), &m_found, &m_userVerify);
  if (!m_pSrcLocation)
    m_pSrcLocation = pLoc;
}

void nsImportGenericMail::GetDefaultMailboxes(void)
{
  if (!m_pInterface || m_pMailboxes || !m_pSrcLocation)
    return;

  m_pInterface->FindMailboxes(m_pSrcLocation, &m_pMailboxes);
}

void nsImportGenericMail::GetDefaultDestination(void)
{
  if (m_pDestFolder)
    return;
  if (!m_pInterface)
    return;

  nsIMsgFolder *  rootFolder;
  m_deleteDestFolder = false;
  m_createdFolder = false;
  if (CreateFolder(&rootFolder)) {
    m_pDestFolder = rootFolder;
    m_deleteDestFolder = true;
    m_createdFolder = true;
    return;
  }
  IMPORT_LOG0("*** GetDefaultDestination: Failed to create a default import destination folder.");
}

NS_IMETHODIMP nsImportGenericMail::WantsProgress(bool *_retval)
{
  NS_PRECONDITION(_retval != nullptr, "null ptr");
  NS_ENSURE_ARG_POINTER(_retval);

  if (m_pThreadData) {
    m_pThreadData->DriverAbort();
    m_pThreadData = nullptr;
  }

  if (!m_pMailboxes) {
    GetDefaultLocation();
    GetDefaultMailboxes();
  }

  if (!m_pDestFolder) {
    GetDefaultDestination();
  }

  bool result = false;

  if (m_pMailboxes) {
    uint32_t    i;
    bool        import;
    uint32_t    count = 0;
    uint32_t    size;
    uint32_t    totalSize = 0;

    (void) m_pMailboxes->Count(&count);
    for (i = 0; i < count; i++) {
      nsCOMPtr<nsIImportMailboxDescriptor> box =
        do_QueryElementAt(m_pMailboxes, i);
      if (box) {
        import = false;
        size = 0;
        nsresult rv = box->GetImport(&import);
        if (NS_SUCCEEDED(rv) && import) {
          (void) box->GetSize(&size);
          result = true;
        }
        totalSize += size;
      }
    }

    m_totalSize = totalSize;
  }

  m_doImport = result;

  *_retval = result;

  return NS_OK;
}

void nsImportGenericMail::GetMailboxName(uint32_t index, nsISupportsString *pStr)
{
  if (m_pMailboxes) {
    nsCOMPtr<nsIImportMailboxDescriptor> box(do_QueryElementAt(m_pMailboxes, index));
    if (box) {
      nsAutoString name;
      box->GetDisplayName(getter_Copies(name));
      if (!name.IsEmpty()) {
        pStr->SetData(name);
      }
    }
  }
}

NS_IMETHODIMP nsImportGenericMail::BeginImport(nsISupportsString *successLog, nsISupportsString *errorLog, bool *_retval)
{
  NS_PRECONDITION(_retval != nullptr, "null ptr");
    if (!_retval)
        return NS_ERROR_NULL_POINTER;

  nsString  success;
  nsString  error;

  if (!m_doImport) {
    nsImportStringBundle::GetStringByID(IMPORT_NO_MAILBOXES,
                                        m_stringBundle, success);
    SetLogs(success, error, successLog, errorLog);
    *_retval = true;
    return NS_OK;
  }

  if (!m_pInterface || !m_pMailboxes) {
    IMPORT_LOG0("*** BeginImport: Either the interface or source mailbox is not set properly.");
    nsImportStringBundle::GetStringByID(IMPORT_ERROR_MB_NOTINITIALIZED,
                                        m_stringBundle, error);
    SetLogs(success, error, successLog, errorLog);
    *_retval = false;
    return NS_OK;
  }

  if (!m_pDestFolder) {
    IMPORT_LOG0("*** BeginImport: The destination mailbox is not set properly.");
    nsImportStringBundle::GetStringByID(IMPORT_ERROR_MB_NODESTFOLDER,
                                        m_stringBundle, error);
    SetLogs(success, error, successLog, errorLog);
    *_retval = false;
    return NS_OK;
  }

  if (m_pThreadData) {
    m_pThreadData->DriverAbort();
    m_pThreadData = nullptr;
  }

  NS_IF_RELEASE(m_pSuccessLog);
  NS_IF_RELEASE(m_pErrorLog);
  m_pSuccessLog = successLog;
  m_pErrorLog = errorLog;
  NS_IF_ADDREF(m_pSuccessLog);
  NS_IF_ADDREF(m_pErrorLog);


  // kick off the thread to do the import!!!!
  m_pThreadData = new ImportThreadData();
  m_pThreadData->boxes = m_pMailboxes;
  NS_ADDREF(m_pMailboxes);
  m_pThreadData->mailImport = m_pInterface;
  NS_ADDREF(m_pInterface);
  m_pThreadData->errorLog = m_pErrorLog;
  NS_IF_ADDREF(m_pErrorLog);
  m_pThreadData->successLog = m_pSuccessLog;
  NS_IF_ADDREF(m_pSuccessLog);

  m_pThreadData->ownsDestRoot = m_deleteDestFolder;
  m_pThreadData->destRoot = m_pDestFolder;
    m_pThreadData->performingMigration = m_performingMigration;
  NS_IF_ADDREF(m_pDestFolder);

  NS_IF_ADDREF(m_pThreadData->stringBundle = m_stringBundle);

  PRThread *pThread = PR_CreateThread(PR_USER_THREAD, &ImportMailThread, m_pThreadData,
                  PR_PRIORITY_NORMAL,
                  PR_LOCAL_THREAD,
                  PR_UNJOINABLE_THREAD,
                  0);
  if (!pThread) {
    m_pThreadData->ThreadDelete();
    m_pThreadData->abort = true;
    m_pThreadData->DriverAbort();
    m_pThreadData = nullptr;
    *_retval = false;
    nsImportStringBundle::GetStringByID(IMPORT_ERROR_MB_NOTHREAD,
                                        m_stringBundle, error);
    SetLogs(success, error, successLog, errorLog);
  }
  else
    *_retval = true;

  return NS_OK;

}


NS_IMETHODIMP nsImportGenericMail::ContinueImport(bool *_retval)
{
    NS_PRECONDITION(_retval != nullptr, "null ptr");
    if (!_retval)
        return NS_ERROR_NULL_POINTER;

  *_retval = true;
  if (m_pThreadData) {
    if (m_pThreadData->fatalError)
      *_retval = false;
  }

  return NS_OK;
}


NS_IMETHODIMP nsImportGenericMail::GetProgress(int32_t *_retval)
{
  // This returns the progress from the the currently
  // running import mail or import address book thread.
    NS_PRECONDITION(_retval != nullptr, "null ptr");
    if (!_retval)
        return NS_ERROR_NULL_POINTER;

  if (!m_pThreadData || !(m_pThreadData->threadAlive)) {
    *_retval = 100;
    return NS_OK;
  }

  uint32_t sz = 0;
  if (m_pThreadData->currentSize && m_pInterface) {
    if (NS_FAILED(m_pInterface->GetImportProgress(&sz)))
      sz = 0;
  }


  // *_retval = (int32_t) (((uint32_t)(m_pThreadData->currentTotal + sz) * (uint32_t)100) / m_totalSize);

  if (m_totalSize) {
    double  perc;
    perc = (double) m_pThreadData->currentTotal;
    perc += sz;
    perc *= 100;
    perc /= m_totalSize;
    *_retval = (int32_t) perc;
    if (*_retval > 100)
      *_retval = 100;
  }
  else
    *_retval = 0;

  // never return 100% while the thread is still alive
  if (*_retval > 99)
    *_retval = 99;

  return NS_OK;
}

void nsImportGenericMail::ReportError(int32_t id, const PRUnichar *pName, nsString *pStream, nsIStringBundle *aBundle)
{
  if (!pStream)
    return;

  // load the error string
  PRUnichar *pFmt = nsImportStringBundle::GetStringByID(id, aBundle);
  PRUnichar *pText = nsTextFormatter::smprintf(pFmt, pName);
  pStream->Append(pText);
  nsTextFormatter::smprintf_free(pText);
  NS_Free(pFmt);
  pStream->Append(NS_ConvertASCIItoUTF16(MSG_LINEBREAK));
}


void nsImportGenericMail::SetLogs(nsString& success, nsString& error, nsISupportsString *pSuccess, nsISupportsString *pError)
{
    nsAutoString str;
    if (pSuccess) {
        pSuccess->GetData(str);
        str.Append(success);
        pSuccess->SetData(str);
    }
    if (pError) {
        pError->GetData(str);
        str.Append(error);
        pError->SetData(str);
    }
}

NS_IMETHODIMP nsImportGenericMail::CancelImport(void)
{
  if (m_pThreadData) {
    m_pThreadData->abort = true;
    m_pThreadData->DriverAbort();
    m_pThreadData = nullptr;
  }

  return NS_OK;
}


ImportThreadData::ImportThreadData()
{
  fatalError = false;
  driverAlive = true;
  threadAlive = true;
  abort = false;
  currentTotal = 0;
  currentSize = 0;
  destRoot = nullptr;
  ownsDestRoot = false;
  boxes = nullptr;
  mailImport = nullptr;
  successLog = nullptr;
  errorLog = nullptr;
  stringBundle = nullptr;
}

ImportThreadData::~ImportThreadData()
{
  NS_IF_RELEASE(destRoot);
  NS_IF_RELEASE(boxes);
  NS_IF_RELEASE(mailImport);
  NS_IF_RELEASE(errorLog);
  NS_IF_RELEASE(successLog);
  NS_IF_RELEASE(stringBundle);
}

void ImportThreadData::DriverDelete(void)
{
  driverAlive = false;
  if (!driverAlive && !threadAlive)
    delete this;
}

void ImportThreadData::ThreadDelete()
{
  threadAlive = false;
  if (!driverAlive && !threadAlive)
    delete this;
}

void ImportThreadData::DriverAbort()
{
  if (abort && !threadAlive && destRoot) {
    if (ownsDestRoot) {
      destRoot->RecursiveDelete(true, nullptr);
    }
    else {
      // FIXME: just delete the stuff we created?
    }
  }
  else
    abort = true;
  DriverDelete();
}



static void
ImportMailThread(void *stuff)
{
  ImportThreadData *pData = (ImportThreadData *)stuff;

  IMPORT_LOG0("ImportMailThread: Starting...");

  nsresult rv = NS_OK;

  nsCOMPtr<nsIMsgFolder>    destRoot(pData->destRoot);

  uint32_t  count = 0;
  rv = pData->boxes->Count(&count);

  uint32_t    i;
  bool        import;
  uint32_t    size;
  uint32_t    depth = 1;
  uint32_t    newDepth;
  nsString    lastName;
  PRUnichar *    pName;

  nsCOMPtr<nsIMsgFolder>    curFolder(destRoot);

  nsCOMPtr<nsIMsgFolder>          newFolder;
  nsCOMPtr<nsIMsgFolder>          subFolder;
  nsCOMPtr<nsISimpleEnumerator>   enumerator;

  bool              exists;

  nsString  success;
  nsString  error;

  // GetSubFolders() will initialize folders if they are not already initialized.
  ProxyGetSubFolders(curFolder, getter_AddRefs(enumerator));

  IMPORT_LOG1("ImportMailThread: Total number of folders to import = %d.", count);

  // Note that the front-end js script only displays one import result string so
  // we combine both good and bad import status into one string (in var 'success').

  for (i = 0; (i < count) && !(pData->abort); i++) {
    nsCOMPtr<nsIImportMailboxDescriptor> box =
      do_QueryElementAt(pData->boxes, i);
    if (box) {
      pData->currentMailbox = i;

      import = false;
      size = 0;
      rv = box->GetImport(&import);
      if (import)
        rv = box->GetSize(&size);
      rv = box->GetDepth(&newDepth);
      if (newDepth > depth) {
          // OK, we are going to add a subfolder under the last/previous folder we processed, so
          // find this folder (stored in 'lastName') who is going to be the new parent folder.
        IMPORT_LOG1("ImportMailThread: Processing child folder '%s'.", NS_ConvertUTF16toUTF8(lastName).get());
        rv = ProxyGetChildNamed(curFolder, lastName, getter_AddRefs(subFolder));
        if (NS_FAILED(rv)) {
          IMPORT_LOG1("*** ImportMailThread: Failed to get the interface for child folder '%s'.", NS_ConvertUTF16toUTF8(lastName).get());
          nsImportGenericMail::ReportError(IMPORT_ERROR_MB_FINDCHILD,
                                           lastName.get(),
                                           &error, pData->stringBundle);
          pData->fatalError = true;
          break;
        }
        curFolder = subFolder;
        // Make sure this new parent folder obj has the correct subfolder list so far.
        rv = ProxyGetSubFolders(curFolder, getter_AddRefs(enumerator));
      }
      else if (newDepth < depth) {
        rv = NS_OK;
        while ((newDepth < depth) && NS_SUCCEEDED(rv)) {
          rv = curFolder->GetParent(getter_AddRefs(curFolder));
          if (NS_FAILED(rv)) {
            IMPORT_LOG1("*** ImportMailThread: Failed to get the interface for parent folder '%s'.", lastName.get());
            nsImportGenericMail::ReportError(IMPORT_ERROR_MB_FINDCHILD,
                                             lastName.get(), &error,
                                             pData->stringBundle);
            pData->fatalError = true;
            break;
          }
          depth--;
        }
        if (NS_FAILED(rv)) {
          IMPORT_LOG1("*** ImportMailThread: Failed to get the proxy interface for parent folder '%s'.", lastName.get());
          nsImportStringBundle::GetStringByID(IMPORT_ERROR_MB_NOPROXY,
                                              pData->stringBundle, error);
          pData->fatalError = true;
          break;
        }
      }
      depth = newDepth;
      pName = nullptr;
      box->GetDisplayName(&pName);
      if (pName) {
        lastName = pName;
        NS_Free(pName);
      }
      else
        lastName.AssignLiteral("Unknown!");

      // translate the folder name if we are doing migration, but
      // only for special folders which are at the root level
      if (pData->performingMigration && depth == 1)
        pData->mailImport->TranslateFolderName(lastName, lastName);

      exists = false;
      rv = ProxyContainsChildNamed(curFolder, lastName, &exists);

      // If we are performing profile migration (as opposed to importing) then we are starting
      // with empty local folders. In that case, always choose to over-write the existing local folder
      // with this name. Don't create a unique subfolder name. Otherwise you end up with "Inbox, Inbox0"
      // or "Unsent Folders, UnsentFolders0"
      if (exists && !pData->performingMigration) {
        nsString subName;
        ProxyGenerateUniqueSubfolderName(curFolder, lastName, nullptr, subName);
        if (!subName.IsEmpty())
          lastName.Assign(subName);
      }

      IMPORT_LOG1("ImportMailThread: Creating new import folder '%s'.", NS_ConvertUTF16toUTF8(lastName).get());
      ProxyCreateSubfolder(curFolder, lastName); // this may fail if the folder already exists..that's ok

      rv = ProxyGetChildNamed(curFolder, lastName, getter_AddRefs(newFolder));
      if (NS_FAILED(rv)) {
        IMPORT_LOG1("*** ImportMailThread: Failed to locate subfolder '%s' after it's been created.", lastName.get());
        nsImportGenericMail::ReportError(IMPORT_ERROR_MB_CREATE, lastName.get(),
                                         &error, pData->stringBundle);
      }

      if (size && import && newFolder && NS_SUCCEEDED(rv)) {
        bool fatalError = false;
        pData->currentSize = size;
        PRUnichar *pSuccess = nullptr;
        PRUnichar *pError = nullptr;
        rv = pData->mailImport->ImportMailbox(box, newFolder, &pError, &pSuccess, &fatalError);
        if (pError) {
          error.Append(pError);
          NS_Free(pError);
        }
        if (pSuccess) {
          success.Append(pSuccess);
          NS_Free(pSuccess);
        }

        pData->currentSize = 0;
        pData->currentTotal += size;
        
        // commit to the db synchronously, but using a proxy since it doesn't like being used
        // elsewhere than from the main thread.
        // OK, we've copied the actual folder/file over if the folder size is not 0
        // (ie, the msg summary is no longer valid) so close the msg database so that
        // when the folder is reopened the folder db can be reconstructed (which
        // validates msg summary and forces folder to be reparsed).
        rv = ProxyForceDBClosed(newFolder);
        fatalError = NS_FAILED(rv);

        if (fatalError) {
          IMPORT_LOG1("*** ImportMailThread: ImportMailbox returned fatalError, mailbox #%d\n", (int) i);
          pData->fatalError = true;
          break;
        }
      }
    }
  }

  // Now save the new acct info to pref file.
  nsCOMPtr <nsIMsgAccountManager> accMgr = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
        if (NS_SUCCEEDED(rv) && accMgr) {
    rv = accMgr->SaveAccountInfo();
    NS_ASSERTION(NS_SUCCEEDED(rv), "Can't save account info to pref file");
  }

  nsImportGenericMail::SetLogs(success, error, pData->successLog, pData->errorLog);

  if (pData->abort || pData->fatalError) {
    IMPORT_LOG0("*** ImportMailThread: Abort or fatalError flag was set\n");
    if (pData->ownsDestRoot) {
      IMPORT_LOG0("Calling destRoot->RecursiveDelete\n");
      destRoot->RecursiveDelete(true, nullptr);
    }
    else {
      // FIXME: just delete the stuff we created?
    }
  }

  IMPORT_LOG1("Import mailbox thread done: %d\n", (int) pData->currentTotal);

  pData->ThreadDelete();

}

// Creates a folder in Local Folders with the module name + mail
// for e.g: Outlook Mail
bool nsImportGenericMail::CreateFolder(nsIMsgFolder **ppFolder)
{
  nsresult rv;
  *ppFolder = nullptr;

  nsCOMPtr<nsIStringBundle> bundle;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  if (!bundleService)
      return false;
  rv = bundleService->CreateBundle(IMPORT_MSGS_URL, getter_AddRefs(bundle));
  if (NS_FAILED(rv))
      return false;
  nsString folderName;
  if (!m_pName.IsEmpty()) {
    const PRUnichar *moduleName[] = { m_pName.get() };
    rv = bundle->FormatStringFromName(NS_LITERAL_STRING("ImportModuleFolderName").get(),
                                      moduleName, 1,
                                      getter_Copies(folderName));
  }
  else {
    rv = bundle->GetStringFromName(NS_LITERAL_STRING("DefaultFolderName").get(),
                                   getter_Copies(folderName));
  }
  if (NS_FAILED(rv)) {
      IMPORT_LOG0("*** Failed to get Folder Name!\n");
      return false;
  }
  nsCOMPtr <nsIMsgAccountManager> accMgr = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Failed to create account manager!\n");
    return false;
  }

  nsCOMPtr <nsIMsgIncomingServer> server;
  rv = accMgr->GetLocalFoldersServer(getter_AddRefs(server));
  // if Local Folders does not exist already, create it
  if (NS_FAILED(rv) || !server)
  {
    rv = accMgr->CreateLocalMailAccount();
    if (NS_FAILED(rv)) {
      IMPORT_LOG0("*** Failed to create Local Folders!\n");
      return false;
    }

    rv = accMgr->GetLocalFoldersServer(getter_AddRefs(server));
  }

  if (NS_SUCCEEDED(rv) && server) {
    nsCOMPtr <nsIMsgFolder> localRootFolder;
    rv = server->GetRootMsgFolder(getter_AddRefs(localRootFolder));
    if (localRootFolder) {
      // we need to call GetSubFolders() so that the folders get initialized
      // if they are not initialized yet.
      nsCOMPtr<nsISimpleEnumerator> aEnumerator;
      rv = localRootFolder->GetSubFolders(getter_AddRefs(aEnumerator));
      if (NS_SUCCEEDED(rv)) {
        // check if the folder name we picked already exists.
        bool exists = false;
        rv = localRootFolder->ContainsChildNamed(folderName, &exists);
        if (exists) {
          nsString name;
          localRootFolder->GenerateUniqueSubfolderName(folderName, nullptr, name);
          if (!name.IsEmpty())
            folderName.Assign(name);
          else {
            IMPORT_LOG0("*** Failed to find a unique folder name!\n");
            return false;
          }
        }
        IMPORT_LOG1("Creating folder for importing mail: '%s'\n", NS_ConvertUTF16toUTF8(folderName).get());

        // Bug 564162 identifies a dataloss design flaw.
        // A working Thunderbird client can have mail in Local Folders and a
        // subsequent import 'Everything' will trigger a migration which
        // overwrites existing mailboxes with the imported mailboxes.
        rv = localRootFolder->CreateSubfolder(folderName, nullptr);
        if (NS_SUCCEEDED(rv)) {
          rv = localRootFolder->GetChildNamed(folderName, ppFolder);
          if (*ppFolder) {
            IMPORT_LOG1("Folder '%s' created successfully\n", NS_ConvertUTF16toUTF8(folderName).get());
            return true;
          }
        }
      }
    } // if localRootFolder
  } // if server
  IMPORT_LOG0("****** FAILED TO CREATE FOLDER FOR IMPORT\n");
  return false;
}

/**
 * These are the proxy objects we use to proxy nsIMsgFolder methods back
 * the the main thread. Since there are only five, we can hand roll them.
 * A better design might be a co-routine-ish design where the ui thread
 * hands off each folder to the import thread and when the thread finishes
 * the folder, the main thread hands it the next folder.
 */

class GetSubFoldersRunnable : public nsRunnable
{
public:
  GetSubFoldersRunnable(nsIMsgFolder *aFolder,
                        nsISimpleEnumerator **aEnumerator);
  NS_DECL_NSIRUNNABLE
private:
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsISimpleEnumerator **m_enumerator;
};

GetSubFoldersRunnable::GetSubFoldersRunnable(nsIMsgFolder *aFolder,
                                             nsISimpleEnumerator **aEnumerator) :
  m_folder(aFolder), m_enumerator(aEnumerator)
{
}

NS_IMETHODIMP GetSubFoldersRunnable::Run()
{
  return m_folder->GetSubFolders(m_enumerator);
}


nsresult ProxyGetSubFolders(nsIMsgFolder *aFolder, nsISimpleEnumerator **aEnumerator)
{
  nsRefPtr<GetSubFoldersRunnable> getSubFolders =
    new GetSubFoldersRunnable(aFolder, aEnumerator);
  return NS_DispatchToMainThread(getSubFolders, NS_DISPATCH_SYNC);
}

class GetChildNamedRunnable : public nsRunnable
{
public:
  GetChildNamedRunnable(nsIMsgFolder *aFolder, const nsAString& aName, nsIMsgFolder **aChild);
  NS_DECL_NSIRUNNABLE
protected:
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsString m_name;
  nsIMsgFolder **m_child;
};

GetChildNamedRunnable::GetChildNamedRunnable(nsIMsgFolder *aFolder,
                                             const nsAString & aName,
                                             nsIMsgFolder **aChild) :
  m_folder(aFolder), m_name(aName), m_child(aChild)
{
}

NS_IMETHODIMP GetChildNamedRunnable::Run()
{
  return m_folder->GetChildNamed(m_name, m_child);
}


nsresult ProxyGetChildNamed(nsIMsgFolder *aFolder, const nsAString & aName,
                            nsIMsgFolder **aChild)
{
  nsRefPtr<GetChildNamedRunnable> getChildNamed =
    new GetChildNamedRunnable(aFolder, aName, aChild);
  return NS_DispatchToMainThread(getChildNamed, NS_DISPATCH_SYNC);
}

class GetParentRunnable : public nsRunnable
{
public:
  GetParentRunnable(nsIMsgFolder *aFolder, nsIMsgFolder **aParent);
  NS_DECL_NSIRUNNABLE
protected:
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsIMsgFolder **m_parent;
};

GetParentRunnable::GetParentRunnable(nsIMsgFolder *aFolder, nsIMsgFolder **aParent) :
  m_folder(aFolder), m_parent(aParent)
{
}

NS_IMETHODIMP GetParentRunnable::Run()
{
  return m_folder->GetParent(m_parent);
}


nsresult ProxyGetParent(nsIMsgFolder *aFolder, nsIMsgFolder **aParent)
{
  nsRefPtr<GetParentRunnable> getParent =
    new GetParentRunnable(aFolder, aParent);
  return NS_DispatchToMainThread(getParent, NS_DISPATCH_SYNC);
}

class ContainsChildNamedRunnable : public nsRunnable
{
public:
  ContainsChildNamedRunnable(nsIMsgFolder *aFolder, const nsAString& aName, bool *aResult);
  NS_DECL_NSIRUNNABLE
protected:
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsString m_name;
  bool *m_result;
};

ContainsChildNamedRunnable::ContainsChildNamedRunnable(nsIMsgFolder *aFolder,
                                                       const nsAString &aName,
                                                       bool *aResult) :
  m_folder(aFolder), m_name(aName), m_result(aResult)
{
}

NS_IMETHODIMP ContainsChildNamedRunnable::Run()
{
  return m_folder->ContainsChildNamed(m_name, m_result);
}


nsresult ProxyContainsChildNamed(nsIMsgFolder *aFolder, const nsAString &aName,
                                 bool *aResult)
{
  nsRefPtr<ContainsChildNamedRunnable> containsChildNamed =
    new ContainsChildNamedRunnable(aFolder, aName, aResult);
  return NS_DispatchToMainThread(containsChildNamed, NS_DISPATCH_SYNC);
}


class GenerateUniqueSubfolderNameRunnable : public nsRunnable
{
public:
  GenerateUniqueSubfolderNameRunnable(nsIMsgFolder *aFolder,
                                      const nsAString& prefix,
                                      nsIMsgFolder *otherFolder,
                                      nsAString& name);
  NS_DECL_NSIRUNNABLE
protected:
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsString m_prefix;
  nsCOMPtr<nsIMsgFolder> m_otherFolder;
  nsString m_name;
};

GenerateUniqueSubfolderNameRunnable::GenerateUniqueSubfolderNameRunnable(
  nsIMsgFolder *aFolder, const nsAString& aPrefix, nsIMsgFolder *aOtherFolder,
  nsAString& aName)
  : m_folder(aFolder), m_prefix(aPrefix), m_otherFolder(aOtherFolder), m_name(aName)
{
}

NS_IMETHODIMP GenerateUniqueSubfolderNameRunnable::Run()
{
  return m_folder->GenerateUniqueSubfolderName(m_prefix, m_otherFolder, m_name);
}


nsresult ProxyGenerateUniqueSubfolderName(nsIMsgFolder *aFolder,
                                          const nsAString& aPrefix,
                                          nsIMsgFolder *aOtherFolder,
                                          nsAString& aName)

{
  nsRefPtr<GenerateUniqueSubfolderNameRunnable> generateUniqueSubfolderName =
    new GenerateUniqueSubfolderNameRunnable(aFolder, aPrefix, aOtherFolder, aName);
  return NS_DispatchToMainThread(generateUniqueSubfolderName, NS_DISPATCH_SYNC);
}

class CreateSubfolderRunnable : public nsRunnable
{
public:
  CreateSubfolderRunnable(nsIMsgFolder *aFolder, const nsAString& aName);
  NS_DECL_NSIRUNNABLE
protected:
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsString m_name;
};

CreateSubfolderRunnable::CreateSubfolderRunnable(nsIMsgFolder *aFolder,
                                                 const nsAString &aName) :
  m_folder(aFolder), m_name(aName)
{
}

NS_IMETHODIMP CreateSubfolderRunnable::Run()
{
  return m_folder->CreateSubfolder(m_name, nullptr);
}


nsresult ProxyCreateSubfolder(nsIMsgFolder *aFolder, const nsAString &aName)
{
  nsRefPtr<CreateSubfolderRunnable> createSubfolder =
    new CreateSubfolderRunnable(aFolder, aName);
  return NS_DispatchToMainThread(createSubfolder, NS_DISPATCH_SYNC);
}

class ForceDBClosedRunnable : public nsRunnable
{
public:
  ForceDBClosedRunnable(nsIMsgFolder *aFolder);
  NS_DECL_NSIRUNNABLE
protected:
  nsCOMPtr<nsIMsgFolder> m_folder;
};

ForceDBClosedRunnable::ForceDBClosedRunnable(nsIMsgFolder *aFolder) :
  m_folder(aFolder)
{
}

NS_IMETHODIMP ForceDBClosedRunnable::Run()
{
  return m_folder->ForceDBClosed();
}

nsresult ProxyForceDBClosed(nsIMsgFolder *aFolder)
{
  nsRefPtr<ForceDBClosedRunnable> forceDBClosed =
    new ForceDBClosedRunnable(aFolder);
  return NS_DispatchToMainThread(forceDBClosed, NS_DISPATCH_SYNC);
}


