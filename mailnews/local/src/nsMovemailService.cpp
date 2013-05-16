/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifdef MOZ_LOGGING
#define FORCE_PR_LOG
#endif

#include <unistd.h>    // for link(), used in spool-file locking

#include "prenv.h"
#include "private/pprio.h"     // for our kernel-based locking
#include "nspr.h"

#include "msgCore.h"    // precompiled header...

#include "nsMovemailService.h"
#include "nsIMovemailService.h"
#include "nsIMsgIncomingServer.h"
#include "nsIMovemailIncomingServer.h"
#include "nsIMsgProtocolInfo.h"
#include "nsParseMailbox.h"
#include "nsIMsgFolder.h"
#include "nsIPrompt.h"

#include "nsIFile.h"
#include "nsMailDirServiceDefs.h"
#include "nsMsgUtils.h"

#include "nsCOMPtr.h"
#include "nsMsgFolderFlags.h"

#include "nsILineInputStream.h"
#include "nsISeekableStream.h"
#include "nsNetUtil.h"
#include "nsAutoPtr.h"
#include "nsIStringBundle.h"
#include "nsIMsgPluggableStore.h"
#include "mozilla/Services.h"

#include "prlog.h"
#if defined(PR_LOGGING)
//
// export NSPR_LOG_MODULES=Movemail:5
//
static PRLogModuleInfo *gMovemailLog = nullptr;
#define LOG(args) PR_LOG(gMovemailLog, PR_LOG_DEBUG, args)
#else
#define LOG(args)
#endif

#define PREF_MAIL_ROOT_MOVEMAIL "mail.root.movemail"            // old - for backward compatibility only
#define PREF_MAIL_ROOT_MOVEMAIL_REL "mail.root.movemail-rel"

#define LOCK_SUFFIX ".lock"
#define MOZLOCK_SUFFIX ".mozlock"

const char * gDefaultSpoolPaths[] = {
  "/var/spool/mail/",
  "/usr/spool/mail/",
  "/var/mail/",
  "/usr/mail/"
};
#define NUM_DEFAULT_SPOOL_PATHS (sizeof(gDefaultSpoolPaths)/sizeof(gDefaultSpoolPaths[0]))

namespace {
class MOZ_STACK_CLASS SpoolLock
{
public:
  /**
   * Try to create a lock for the spool file while we operate on it.
   *
   * @param aSpoolName  The path to the spool file.
   * @param aSeconds    The number of seconds to retry the locking.
   * @param aMovemail   The movemail service requesting the lock.
   * @param aServer     The nsIMsgIncomingServer requesting the lock.
   */
  SpoolLock(nsACString *aSpoolPath, int aSeconds, nsMovemailService &aMovemail,
            nsIMsgIncomingServer *aServer);

  ~SpoolLock();

  bool isLocked();

private:
  bool mLocked;
  nsCString mSpoolName;
  bool mUsingLockFile;
  nsRefPtr<nsMovemailService> mOwningService;
  nsCOMPtr<nsIMsgIncomingServer> mServer;

  bool ObtainSpoolLock(unsigned int aSeconds);
  bool YieldSpoolLock();
};

}

nsMovemailService::nsMovemailService()
{
#if defined(PR_LOGGING)
  if (!gMovemailLog)
      gMovemailLog = PR_NewLogModule("Movemail");
#endif
  LOG(("nsMovemailService created: 0x%x\n", this));
}

nsMovemailService::~nsMovemailService()
{}


NS_IMPL_ISUPPORTS2(nsMovemailService,
                   nsIMovemailService,
                   nsIMsgProtocolInfo)


NS_IMETHODIMP
nsMovemailService::CheckForNewMail(nsIUrlListener * aUrlListener,
                                   nsIMsgFolder *inbox,
                                   nsIMovemailIncomingServer *movemailServer,
                                   nsIURI ** aURL)
{
  nsresult rv = NS_OK;
  LOG(("nsMovemailService::CheckForNewMail\n"));
  return rv;
}

void
nsMovemailService::Error(const char* errorCode,
                         const PRUnichar **params,
                         uint32_t length)
{
  if (!mMsgWindow) return;

  nsCOMPtr<nsIPrompt> dialog;
  nsresult rv = mMsgWindow->GetPromptDialog(getter_AddRefs(dialog));
  if (NS_FAILED(rv))
    return;

  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  if (!bundleService)
    return;
  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(bundle));
  if (NS_FAILED(rv))
    return;

  nsString errStr;
  // Format the error string if necessary
  if (params)
    bundle->FormatStringFromName(NS_ConvertASCIItoUTF16(errorCode).get(),
                                 params, length, getter_Copies(errStr));
  else
    bundle->GetStringFromName(NS_ConvertASCIItoUTF16(errorCode).get(),
                              getter_Copies(errStr));

  if (!errStr.IsEmpty()) {
    dialog->Alert(nullptr, errStr.get());
  }
}

SpoolLock::SpoolLock(nsACString *aSpoolName, int aSeconds,
                     nsMovemailService &aMovemail,
                     nsIMsgIncomingServer *aServer)
: mLocked(false),
  mSpoolName(*aSpoolName),
  mOwningService(&aMovemail),
  mServer(aServer)
{
  if (!ObtainSpoolLock(aSeconds)) {
    NS_ConvertUTF8toUTF16 lockFile(mSpoolName);
    lockFile.AppendLiteral(LOCK_SUFFIX);
    const PRUnichar* params[] = { lockFile.get() };
    mOwningService->Error("movemailCantCreateLock", params, 1);
    return;
  }
  mServer->SetServerBusy(true);
  mLocked = true;
}

SpoolLock::~SpoolLock() {
  if (mLocked && !YieldSpoolLock()) {
    NS_ConvertUTF8toUTF16 lockFile(mSpoolName);
    lockFile.AppendLiteral(LOCK_SUFFIX);
    const PRUnichar* params[] = { lockFile.get() };
    mOwningService->Error("movemailCantDeleteLock", params, 1);
  }
  mServer->SetServerBusy(false);
}

bool
SpoolLock::isLocked() {
  return mLocked;
}

bool
SpoolLock::ObtainSpoolLock(unsigned int aSeconds /* number of seconds to retry */)
{
  /*
   * Locking procedures:
   * If the directory is not writable, we want to use the appropriate system
   * utilites to lock the file.
   * If the directory is writable, we want to go through the create-and-link
   * locking procedures to make it atomic for certain networked file systems.
   * This involves creating a .mozlock file and attempting to hard-link it to
   * the customary .lock file.
   */
  nsCOMPtr<nsIFile> spoolFile;
  nsresult rv = NS_NewNativeLocalFile(mSpoolName,
                                      true,
                                      getter_AddRefs(spoolFile));
  NS_ENSURE_SUCCESS(rv, false);

  nsCOMPtr<nsIFile> directory;
  rv = spoolFile->GetParent(getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, false);

  rv = directory->IsWritable(&mUsingLockFile);
  NS_ENSURE_SUCCESS(rv, false);

  if (!mUsingLockFile) {
    LOG(("Attempting to use kernel file lock"));
    PRFileDesc *fd;
    rv = spoolFile->OpenNSPRFileDesc(PR_RDWR, 0, &fd);
    NS_ENSURE_SUCCESS(rv, false);
    PRStatus lock_result;
    unsigned int retry_count = 0;

    do {
      lock_result = PR_TLockFile(fd);
  
      retry_count++;
      LOG(("Attempt %d of %d to lock file", retry_count, aSeconds));
      if (aSeconds > 0 && lock_result == PR_FAILURE) {
        // pause 1sec, waiting for .lock to go away
        PRIntervalTime sleepTime = 1000; // 1 second
        PR_Sleep(sleepTime);
      }
    } while (lock_result == PR_FAILURE && retry_count < aSeconds);
    LOG(("Lock result: %d", lock_result));
    PR_Close(fd);
    return lock_result == PR_SUCCESS;
  }
  // How to lock using files:
  // step 1: create SPOOLNAME.mozlock
  //        1a: can remove it if it already exists (probably crash-droppings)
  // step 2: hard-link SPOOLNAME.mozlock to SPOOLNAME.lock for NFS atomicity
  //        2a: if SPOOLNAME.lock is >60sec old then nuke it from orbit
  //        2b: repeat step 2 until retry-count expired or hard-link succeeds
  // step 3: remove SPOOLNAME.mozlock
  // step 4: If step 2 hard-link failed, fail hard; we do not hold the lock
  // DONE.
  //
  // (step 2a not yet implemented)

  nsAutoCString mozlockstr(mSpoolName);
  mozlockstr.AppendLiteral(MOZLOCK_SUFFIX);
  nsAutoCString lockstr(mSpoolName);
  lockstr.AppendLiteral(LOCK_SUFFIX);

  // Create nsIFile for the spool.mozlock file
  nsCOMPtr<nsIFile> tmplocfile;
  rv = NS_NewNativeLocalFile(mozlockstr, true, getter_AddRefs(tmplocfile));
  NS_ENSURE_SUCCESS(rv, false);

  // THOUGHT: hmm, perhaps use MakeUnique to generate us a unique mozlock?
  // ... perhaps not, MakeUnique implementation looks racey -- use mktemp()?

  // step 1: create SPOOLNAME.mozlock
  rv = tmplocfile->Create(nsIFile::NORMAL_FILE_TYPE, 0666);
  if (NS_FAILED(rv) && rv != NS_ERROR_FILE_ALREADY_EXISTS) {
    // can't create our .mozlock file... game over already
    LOG(("Failed to create file %s\n", mozlockstr.get()));
    return false;
  }

  // step 2: hard-link .mozlock file to .lock file (this wackiness
  //         is necessary for non-racey locking on NFS-mounted spool dirs)
  // n.b. XPCOM utilities don't support hard-linking yet, so we
  // skip out to <unistd.h> and the POSIX interface for link()
  int link_result = 0;
  unsigned int retry_count = 0;

  do {
    link_result = link(mozlockstr.get(), lockstr.get());

    retry_count++;
    LOG(("Attempt %d of %d to create lock file", retry_count, aSeconds));

    if (aSeconds > 0 && link_result == -1) {
      // pause 1sec, waiting for .lock to go away
      PRIntervalTime sleepTime = 1000; // 1 second
      PR_Sleep(sleepTime);
    }
  } while (link_result == -1 && retry_count < aSeconds);
  LOG(("Link result: %d", link_result));

  // step 3: remove .mozlock file, in any case
  rv = tmplocfile->Remove(false /* non-recursive */);
  if (NS_FAILED(rv)) {
    // Could not delete our .mozlock file... very unusual, but
    // not fatal.
    LOG(("Unable to delete %s", mozlockstr.get()));
  }

  // step 4: now we know whether we succeeded or failed
  return link_result == 0;
}


/**
 * Remove our mail-spool-file lock (n.b. we should only try this if
 * we're the ones who made the lock in the first place! I.e. if mLocked is true.)
 */
bool
SpoolLock::YieldSpoolLock()
{
  LOG(("YieldSpoolLock(%s)", mSpoolName.get()));

  if (!mUsingLockFile) {
    nsCOMPtr<nsIFile> spoolFile;
    nsresult rv = NS_NewNativeLocalFile(mSpoolName,
                                        true,
                                        getter_AddRefs(spoolFile));
    NS_ENSURE_SUCCESS(rv, false);

    PRFileDesc *fd;
    rv = spoolFile->OpenNSPRFileDesc(PR_RDWR, 0, &fd);
    NS_ENSURE_SUCCESS(rv, false);

    bool unlockSucceeded = PR_UnlockFile(fd) == PR_SUCCESS;
    PR_Close(fd);
    if (unlockSucceeded)
      LOG(("YieldSpoolLock was successful."));
    return unlockSucceeded;
  }

  nsAutoCString lockstr(mSpoolName);
  lockstr.AppendLiteral(LOCK_SUFFIX);

  nsresult rv;

  // Create nsIFile for the spool.lock file
  nsCOMPtr<nsIFile> locklocfile;
  rv = NS_NewNativeLocalFile(lockstr, true, getter_AddRefs(locklocfile));
  NS_ENSURE_SUCCESS(rv, false);

  // Check if the lock file exists
  bool exists;
  rv = locklocfile->Exists(&exists);
  NS_ENSURE_SUCCESS(rv, false);

  // Delete the file if it exists
  if (exists) {
    rv = locklocfile->Remove(false /* non-recursive */);
    NS_ENSURE_SUCCESS(rv, false);
  }

  LOG(("YieldSpoolLock was successful."));

  // Success.
  return true;
}

static nsresult
LocateSpoolFile(nsACString & spoolPath)
{
  bool isFile;
  nsresult rv;

  nsCOMPtr<nsIFile> spoolFile;
  rv = NS_NewNativeLocalFile(EmptyCString(), true, getter_AddRefs(spoolFile));
  NS_ENSURE_SUCCESS(rv, rv);

  char * mailEnv = PR_GetEnv("MAIL");
  char * userEnv = PR_GetEnv("USER");
  if (!userEnv)
    userEnv = PR_GetEnv("USERNAME");

  if (mailEnv) {
    rv = spoolFile->InitWithNativePath(nsDependentCString(mailEnv));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = spoolFile->IsFile(&isFile);
    if (NS_SUCCEEDED(rv) && isFile)
      spoolPath = mailEnv;
  }
  else if (userEnv) {
    // Try to build the mailbox path from the username and a number
    // of guessed spool directory paths.
    nsAutoCString tmpPath;
    uint32_t i;
    for (i = 0; i < NUM_DEFAULT_SPOOL_PATHS; i++) {
      tmpPath = gDefaultSpoolPaths[i];
      tmpPath += userEnv;
      rv = spoolFile->InitWithNativePath(tmpPath);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = spoolFile->IsFile(&isFile);
      if (NS_SUCCEEDED(rv) && isFile) {
        spoolPath = tmpPath;
        break;
      }
    }
  }

  return rv;
}

nsresult
nsMovemailService::GetNewMail(nsIMsgWindow *aMsgWindow,
                              nsIUrlListener* /* aUrlListener */,
                              nsIMsgFolder* /* aMsgFolder */,
                              nsIMovemailIncomingServer *aMovemailServer,
                              nsIURI ** /* aURL */)
{
  LOG(("nsMovemailService::GetNewMail"));

  NS_ENSURE_ARG_POINTER(aMovemailServer);
  // It is OK if aMsgWindow is null.
  mMsgWindow = aMsgWindow;

  nsresult rv;

  nsCOMPtr<nsIMsgIncomingServer> in_server =
      do_QueryInterface(aMovemailServer, &rv);
  NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && in_server,
    NS_MSG_INVALID_OR_MISSING_SERVER);

  // Attempt to locate the mail spool file
  nsAutoCString spoolPath;
  rv = in_server->GetCharValue("spoolDir", spoolPath);
  if (NS_FAILED(rv) || spoolPath.IsEmpty())
    rv = LocateSpoolFile(spoolPath);
  if (NS_FAILED(rv) || spoolPath.IsEmpty()) {
    Error("movemailSpoolFileNotFound", nullptr, 0);
    return NS_ERROR_FAILURE;
  }

  NS_ConvertUTF8toUTF16 wideSpoolPath(spoolPath);
  const PRUnichar* spoolPathString[] = { wideSpoolPath.get() };

  // Create an input stream for the spool file
  nsCOMPtr<nsIFile> spoolFile;
  rv = NS_NewNativeLocalFile(spoolPath, true, getter_AddRefs(spoolFile));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIInputStream> spoolInputStream;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(spoolInputStream), spoolFile);
  if (NS_FAILED(rv)) {
    Error("movemailCantOpenSpoolFile", spoolPathString, 1);
    return rv;
  }

  // Get a line input interface for the spool file
  nsCOMPtr<nsILineInputStream> lineInputStream =
    do_QueryInterface(spoolInputStream, &rv);
  NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && lineInputStream, rv);

  nsCOMPtr<nsIMsgFolder> serverFolder;
  nsCOMPtr<nsIMsgFolder> inbox;

  rv = in_server->GetRootFolder(getter_AddRefs(serverFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = serverFolder->GetFolderWithFlags(nsMsgFolderFlags::Inbox,
                                        getter_AddRefs(inbox));
  NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && inbox, rv);

  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  rv = in_server->GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);

  // create a new mail parser
  nsRefPtr<nsParseNewMailState> newMailParser = new nsParseNewMailState;

  // Try and obtain the lock for the spool file.
  SpoolLock lock(&spoolPath, 5, *this, in_server);
  if (!lock.isLocked())
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgDBHdr> newHdr;
  nsCOMPtr<nsIOutputStream> outputStream;

  // MIDDLE of the FUN : consume the mailbox data.
  bool isMore = true;
  nsAutoCString buffer;
  uint32_t bytesWritten = 0;
  while (isMore &&
         NS_SUCCEEDED(lineInputStream->ReadLine(buffer, &isMore)))
  {
    // If first string is empty and we're now at EOF then abort parsing.
    if (buffer.IsEmpty() && !isMore && !bytesWritten) {
      LOG(("Empty spool file"));
      break;
    }

    buffer.AppendLiteral(MSG_LINEBREAK);

    if (isMore && StringBeginsWith(buffer, NS_LITERAL_CSTRING("From "))) {
      // Finish previous header and message, if any.
      if (newHdr) {
        outputStream->Flush();
        newMailParser->PublishMsgHeader(nullptr);
        rv = msgStore->FinishNewMessage(outputStream, newHdr);
        NS_ENSURE_SUCCESS(rv, rv);
        newMailParser->Clear();
      }
      bool reusable;
      rv = msgStore->GetNewMsgOutputStream(inbox, getter_AddRefs(newHdr),
                                           &reusable, getter_AddRefs(outputStream));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIInputStream> inputStream = do_QueryInterface(outputStream, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = newMailParser->Init(serverFolder, inbox,
                               nullptr, newHdr, outputStream);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    if (!outputStream) {
      // If we do not have outputStream here, something bad happened.
      // We probably didn't find the proper message start delimiter "From "
      // and are now reading in the middle of a message. Bail out.
      Error("movemailCantParseSpool", spoolPathString, 1);
      return NS_ERROR_UNEXPECTED;
    }

    newMailParser->HandleLine(buffer.BeginWriting(), buffer.Length());
    rv = outputStream->Write(buffer.get(), buffer.Length(), &bytesWritten);
    NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && (bytesWritten == buffer.Length()),
                   NS_ERROR_FAILURE);

    // "From " lines delimit messages, start a new one here.
    if (isMore && StringBeginsWith(buffer, NS_LITERAL_CSTRING("From "))) {
      buffer.AssignLiteral("X-Mozilla-Status: 8000" MSG_LINEBREAK);
      newMailParser->HandleLine(buffer.BeginWriting(), buffer.Length());
      rv = outputStream->Write(buffer.get(), buffer.Length(), &bytesWritten);
      NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && (bytesWritten == buffer.Length()),
                     NS_ERROR_FAILURE);

      buffer.AssignLiteral("X-Mozilla-Status2: 00000000" MSG_LINEBREAK);
      newMailParser->HandleLine(buffer.BeginWriting(), buffer.Length());
      rv = outputStream->Write(buffer.get(), buffer.Length(), &bytesWritten);
      NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && (bytesWritten == buffer.Length()),
                     NS_ERROR_FAILURE);
    }
  }
  if (outputStream) {
    outputStream->Flush();
    newMailParser->PublishMsgHeader(nullptr);
    newMailParser->OnStopRequest(nullptr, nullptr, NS_OK);
    rv = msgStore->FinishNewMessage(outputStream, newHdr);
    NS_ENSURE_SUCCESS(rv, rv);
    outputStream->Close();
  }
  // Truncate the spool file as we parsed it successfully.
  rv = spoolFile->SetFileSize(0);
  if (NS_FAILED(rv)) {
    Error("movemailCantTruncateSpoolFile", spoolPathString, 1);
  }

  LOG(("GetNewMail returning rv=%d", rv));
  return rv;
}


NS_IMETHODIMP
nsMovemailService::SetDefaultLocalPath(nsIFile *aPath)
{
  NS_ENSURE_ARG(aPath);
  return NS_SetPersistentFile(PREF_MAIL_ROOT_MOVEMAIL_REL, PREF_MAIL_ROOT_MOVEMAIL, aPath);
}

NS_IMETHODIMP
nsMovemailService::GetDefaultLocalPath(nsIFile ** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = nullptr;

  nsresult rv;
  bool havePref;
  nsCOMPtr<nsIFile> localFile;
  rv = NS_GetPersistentFile(PREF_MAIL_ROOT_MOVEMAIL_REL,
                            PREF_MAIL_ROOT_MOVEMAIL,
                            NS_APP_MAIL_50_DIR,
                            havePref,
                            getter_AddRefs(localFile));
  if (NS_FAILED(rv)) return rv;

  bool exists;
  rv = localFile->Exists(&exists);
  if (NS_SUCCEEDED(rv) && !exists)
    rv = localFile->Create(nsIFile::DIRECTORY_TYPE, 0775);
  if (NS_FAILED(rv)) return rv;

  if (!havePref || !exists) {
    rv = NS_SetPersistentFile(PREF_MAIL_ROOT_MOVEMAIL_REL, PREF_MAIL_ROOT_MOVEMAIL, localFile);
    NS_ASSERTION(NS_SUCCEEDED(rv), "Failed to set root dir pref.");
  }

  NS_IF_ADDREF(*aResult = localFile);
  return NS_OK;
}


NS_IMETHODIMP
nsMovemailService::GetServerIID(nsIID* *aServerIID)
{
  *aServerIID = new nsIID(NS_GET_IID(nsIMovemailIncomingServer));
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetRequiresUsername(bool *aRequiresUsername)
{
  NS_ENSURE_ARG_POINTER(aRequiresUsername);
  *aRequiresUsername = false;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetPreflightPrettyNameWithEmailAddress(bool *aPreflightPrettyNameWithEmailAddress)
{
  NS_ENSURE_ARG_POINTER(aPreflightPrettyNameWithEmailAddress);
  *aPreflightPrettyNameWithEmailAddress = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetCanLoginAtStartUp(bool *aCanLoginAtStartUp)
{
  NS_ENSURE_ARG_POINTER(aCanLoginAtStartUp);
  *aCanLoginAtStartUp = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetCanDelete(bool *aCanDelete)
{
  NS_ENSURE_ARG_POINTER(aCanDelete);
  *aCanDelete = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetCanGetMessages(bool *aCanGetMessages)
{
  NS_ENSURE_ARG_POINTER(aCanGetMessages);
  *aCanGetMessages = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetCanGetIncomingMessages(bool *aCanGetIncomingMessages)
{
  NS_ENSURE_ARG_POINTER(aCanGetIncomingMessages);
  *aCanGetIncomingMessages = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetCanDuplicate(bool *aCanDuplicate)
{
  NS_ENSURE_ARG_POINTER(aCanDuplicate);
  *aCanDuplicate = false;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetDefaultDoBiff(bool *aDoBiff)
{
  NS_ENSURE_ARG_POINTER(aDoBiff);
  // by default, do biff for movemail
  *aDoBiff = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetDefaultServerPort(bool isSecure, int32_t *aDefaultPort)
{
  NS_ENSURE_ARG_POINTER(aDefaultPort);
  *aDefaultPort = -1;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetShowComposeMsgLink(bool *showComposeMsgLink)
{
  NS_ENSURE_ARG_POINTER(showComposeMsgLink);
  *showComposeMsgLink = true;
  return NS_OK;
}

NS_IMETHODIMP
nsMovemailService::GetFoldersCreatedAsync(bool *aAsyncCreation)
{
  NS_ENSURE_ARG_POINTER(aAsyncCreation);
  *aAsyncCreation = false;
  return NS_OK;
}
