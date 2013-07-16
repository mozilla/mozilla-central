/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#define MAPI_STARTUP_ARG       "/MAPIStartUp"

#ifdef MOZ_LOGGING
// this has to be before the pre-compiled header
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif
#include <mapidefs.h>
#include <mapi.h>
#include <tchar.h>
#include <direct.h>
#include "nsCOMPtr.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsISupports.h"
#include "nsIPromptService.h"
#include "nsIAppStartup.h"
#include "nsIAppShellService.h"
#include "nsIDOMWindow.h"
#include "nsINativeAppSupport.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsIStringBundle.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsStringGlue.h"
#include "nsUnicharUtils.h"
#include "nsIMsgAttachment.h"
#include "nsIMsgCompFields.h"
#include "nsIMsgComposeParams.h"
#include "nsIMsgCompose.h"
#include "nsMsgCompCID.h"
#include "nsIMsgSend.h"
#include "nsIMsgComposeService.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIDirectoryService.h"
#include "nsMsgI18N.h"
#include "msgMapi.h"
#include "msgMapiHook.h"
#include "msgMapiSupport.h"
#include "msgMapiMain.h"
#include "nsThreadUtils.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "mozilla/Services.h"
#include "nsIArray.h"
#include "nsArrayUtils.h"
#include "nsEmbedCID.h"

extern PRLogModuleInfo *MAPI;

class nsMAPISendListener : public nsIMsgSendListener
{
public:

    virtual ~nsMAPISendListener() { }

    // nsISupports interface
    NS_DECL_THREADSAFE_ISUPPORTS

    /* void OnStartSending (in string aMsgID, in uint32_t aMsgSize); */
    NS_IMETHOD OnStartSending(const char *aMsgID, uint32_t aMsgSize) { return NS_OK; }

    /* void OnProgress (in string aMsgID, in uint32_t aProgress, in uint32_t aProgressMax); */
    NS_IMETHOD OnProgress(const char *aMsgID, uint32_t aProgress, uint32_t aProgressMax) { return NS_OK;}

    /* void OnStatus (in string aMsgID, in wstring aMsg); */
    NS_IMETHOD OnStatus(const char *aMsgID, const PRUnichar *aMsg) { return NS_OK;}

    /* void OnStopSending (in string aMsgID, in nsresult aStatus, in wstring aMsg, in nsIFile returnFile); */
    NS_IMETHOD OnStopSending(const char *aMsgID, nsresult aStatus, const PRUnichar *aMsg,
                           nsIFile *returnFile) {
        PR_CEnterMonitor(this);
        PR_CNotifyAll(this);
        m_done = true;
        PR_CExitMonitor(this);
        return NS_OK ;
    }

	/* void OnSendNotPerformed */
	NS_IMETHOD OnSendNotPerformed(const char *aMsgID, nsresult aStatus)
	{
		return OnStopSending(aMsgID, aStatus, nullptr, nullptr) ;
	}

    /* void OnGetDraftFolderURI (); */
    NS_IMETHOD OnGetDraftFolderURI(const char *aFolderURI) {return NS_OK;}

    static nsresult CreateMAPISendListener( nsIMsgSendListener **ppListener);

    bool IsDone() { return m_done ; }

protected :
    nsMAPISendListener() {
        m_done = false;
    }

    bool            m_done;
};


NS_IMPL_ISUPPORTS1(nsMAPISendListener, nsIMsgSendListener)

nsresult nsMAPISendListener::CreateMAPISendListener( nsIMsgSendListener **ppListener)
{
    NS_ENSURE_ARG_POINTER(ppListener) ;

    *ppListener = new nsMAPISendListener();
    if (! *ppListener)
        return NS_ERROR_OUT_OF_MEMORY;

    NS_ADDREF(*ppListener);
    return NS_OK;
}

bool nsMapiHook::isMapiService = false;

void nsMapiHook::CleanUp()
{
    // This routine will be fully implemented in future
    // to cleanup mapi related stuff inside mozilla code.
}

bool nsMapiHook::DisplayLoginDialog(bool aLogin, PRUnichar **aUsername,
                      PRUnichar **aPassword)
{
  nsresult rv;
  bool btnResult = false;

  nsCOMPtr<nsIPromptService> dlgService(do_GetService(NS_PROMPTSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv) && dlgService)
  {
    nsCOMPtr<nsIStringBundleService> bundleService =
      mozilla::services::GetStringBundleService();
    if (!bundleService) return false;

    nsCOMPtr<nsIStringBundle> bundle;
    rv = bundleService->CreateBundle(MAPI_PROPERTIES_CHROME, getter_AddRefs(bundle));
    if (NS_FAILED(rv) || !bundle) return false;

    nsCOMPtr<nsIStringBundle> brandBundle;
    rv = bundleService->CreateBundle(
                    "chrome://branding/locale/brand.properties",
                    getter_AddRefs(brandBundle));
    if (NS_FAILED(rv)) return false;

    nsString brandName;
    rv = brandBundle->GetStringFromName(
                       NS_LITERAL_STRING("brandFullName").get(),
                       getter_Copies(brandName));
    if (NS_FAILED(rv)) return false;

    nsString loginTitle;
    const PRUnichar *brandStrings[] = { brandName.get() };
    NS_NAMED_LITERAL_STRING(loginTitlePropertyTag, "loginTitle");
    const PRUnichar *dTitlePropertyTag = loginTitlePropertyTag.get();
    rv = bundle->FormatStringFromName(dTitlePropertyTag, brandStrings, 1,
                                      getter_Copies(loginTitle));
    if (NS_FAILED(rv)) return false;

    if (aLogin)
    {
      nsString loginText;
      rv = bundle->GetStringFromName(NS_LITERAL_STRING("loginTextwithName").get(),
                                     getter_Copies(loginText));
      if (NS_FAILED(rv) || loginText.IsEmpty()) return false;

      bool dummyValue = false;
      rv = dlgService->PromptUsernameAndPassword(nullptr, loginTitle.get(),
                                                 loginText.get(), aUsername, aPassword,
                                                 nullptr, &dummyValue, &btnResult);
    }
    else
    {
      //nsString loginString;
      nsString loginText;
      const PRUnichar *userNameStrings[] = { *aUsername };

      NS_NAMED_LITERAL_STRING(loginTextPropertyTag, "loginText");
      const PRUnichar *dpropertyTag = loginTextPropertyTag.get();
      rv = bundle->FormatStringFromName(dpropertyTag, userNameStrings, 1,
                                        getter_Copies(loginText));
      if (NS_FAILED(rv)) return false;

      bool dummyValue = false;
      rv = dlgService->PromptPassword(nullptr, loginTitle.get(), loginText.get(),
                                      aPassword, nullptr, &dummyValue, &btnResult);
    }
  }

  return btnResult;
}

bool nsMapiHook::VerifyUserName(const nsString& aUsername, nsCString& aIdKey)
{
  nsresult rv;

  if (aUsername.IsEmpty())
    return false;

  nsCOMPtr<nsIMsgAccountManager> accountManager(do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv));
  if (NS_FAILED(rv)) return false;
  nsCOMPtr<nsIArray> identities;
  rv = accountManager->GetAllIdentities(getter_AddRefs(identities));
  if (NS_FAILED(rv)) return false;

  uint32_t numIndentities = 0;
  identities->GetLength(&numIndentities);

  for (uint32_t i = 0; i < numIndentities; i++)
  {
    nsCOMPtr<nsIMsgIdentity> thisIdentity(do_QueryElementAt(identities, i, &rv));
    if (NS_SUCCEEDED(rv) && thisIdentity)
    {
      nsCString email;
      rv = thisIdentity->GetEmail(email);
      if (NS_FAILED(rv)) continue;

      // get the username from the email and compare with the username
      int32_t index = email.FindChar('@');
      if (index != -1)
        email.SetLength(index);

      if (aUsername.Equals(NS_ConvertASCIItoUTF16(email)))
        return NS_SUCCEEDED(thisIdentity->GetKey(aIdKey));
    }
  }

  return false;
}

bool
nsMapiHook::IsBlindSendAllowed()
{
  bool enabled = false;
  bool warn = true;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID);
  if (prefBranch) {
      prefBranch->GetBoolPref(PREF_MAPI_WARN_PRIOR_TO_BLIND_SEND, &warn);
      prefBranch->GetBoolPref(PREF_MAPI_BLIND_SEND_ENABLED, &enabled);
  }
  if (!enabled)
      return false;

  if (!warn)
      return true; // Everything is okay.

  nsresult rv;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  if (!bundleService) return false;

  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle(MAPI_PROPERTIES_CHROME, getter_AddRefs(bundle));
  if (NS_FAILED(rv) || !bundle) return false;

  nsString warningMsg;
  rv = bundle->GetStringFromName(NS_LITERAL_STRING("mapiBlindSendWarning").get(),
                                      getter_Copies(warningMsg));
  if (NS_FAILED(rv)) return false;

  nsString dontShowAgainMessage;
  rv = bundle->GetStringFromName(NS_LITERAL_STRING("mapiBlindSendDontShowAgain").get(),
                                      getter_Copies(dontShowAgainMessage));
  if (NS_FAILED(rv)) return false;

  nsCOMPtr<nsIPromptService> dlgService(do_GetService(NS_PROMPTSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv) || !dlgService) return false;

  bool continueToWarn = true;
  bool okayToContinue = false;
  dlgService->ConfirmCheck(nullptr, nullptr, warningMsg.get(), dontShowAgainMessage.get(), &continueToWarn, &okayToContinue);

  if (!continueToWarn && okayToContinue && prefBranch)
    prefBranch->SetBoolPref(PREF_MAPI_WARN_PRIOR_TO_BLIND_SEND, false);

  return okayToContinue;
}

// this is used for Send without UI
nsresult nsMapiHook::BlindSendMail (unsigned long aSession, nsIMsgCompFields * aCompFields)
{
  nsresult rv = NS_OK ;

  if (!IsBlindSendAllowed())
    return NS_ERROR_FAILURE;

  /** create nsIMsgComposeParams obj and other fields to populate it **/

  nsCOMPtr<nsIDOMWindow>  hiddenWindow;
  // get parent window
  nsCOMPtr<nsIAppShellService> appService = do_GetService( "@mozilla.org/appshell/appShellService;1", &rv);
  if (NS_FAILED(rv)|| (!appService) ) return rv ;

  rv = appService->GetHiddenDOMWindow(getter_AddRefs(hiddenWindow));
  if ( NS_FAILED(rv) ) return rv ;
  // smtp password and Logged in used IdKey from MapiConfig (session obj)
  nsMAPIConfiguration * pMapiConfig = nsMAPIConfiguration::GetMAPIConfiguration() ;
  if (!pMapiConfig) return NS_ERROR_FAILURE ;  // get the singelton obj
  PRUnichar * password = pMapiConfig->GetPassword(aSession) ;
  // password
  nsAutoCString smtpPassword;
  LossyCopyUTF16toASCII(password, smtpPassword);

  // Id key
  nsCString MsgIdKey;
  pMapiConfig->GetIdKey(aSession, MsgIdKey);

  // get the MsgIdentity for the above key using AccountManager
  nsCOMPtr <nsIMsgAccountManager> accountManager = do_GetService (NS_MSGACCOUNTMANAGER_CONTRACTID) ;
  if (NS_FAILED(rv) || (!accountManager) ) return rv ;

  nsCOMPtr <nsIMsgIdentity> pMsgId ;
  rv = accountManager->GetIdentity (MsgIdKey, getter_AddRefs(pMsgId)) ;
  if (NS_FAILED(rv) ) return rv ;

  // create a send listener to get back the send status
  nsCOMPtr <nsIMsgSendListener> sendListener ;
  rv = nsMAPISendListener::CreateMAPISendListener(getter_AddRefs(sendListener)) ;
  if (NS_FAILED(rv) || (!sendListener) ) return rv;

  // create the compose params object
  nsCOMPtr<nsIMsgComposeParams> pMsgComposeParams (do_CreateInstance(NS_MSGCOMPOSEPARAMS_CONTRACTID, &rv));
  if (NS_FAILED(rv) || (!pMsgComposeParams) ) return rv ;

  // populate the compose params
  bool forcePlainText;
  aCompFields->GetForcePlainText(&forcePlainText);
  pMsgComposeParams->SetType(nsIMsgCompType::New);
  pMsgComposeParams->SetFormat(forcePlainText ? nsIMsgCompFormat::PlainText : nsIMsgCompFormat::HTML);
  pMsgComposeParams->SetIdentity(pMsgId);
  pMsgComposeParams->SetComposeFields(aCompFields);
  pMsgComposeParams->SetSendListener(sendListener) ;
  pMsgComposeParams->SetSmtpPassword(smtpPassword.get());

  // create the nsIMsgCompose object to send the object
  nsCOMPtr<nsIMsgCompose> pMsgCompose (do_CreateInstance(NS_MSGCOMPOSE_CONTRACTID, &rv));
  if (NS_FAILED(rv) || (!pMsgCompose) ) return rv ;

  /** initialize nsIMsgCompose, Send the message, wait for send completion response **/

  rv = pMsgCompose->Initialize(pMsgComposeParams, hiddenWindow, nullptr);
  if (NS_FAILED(rv)) return rv ;

  // If we're in offline mode, we'll need to queue it for later. No point in trying to send it.
  return pMsgCompose->SendMsg(WeAreOffline() ? nsIMsgSend::nsMsgQueueForLater : nsIMsgSend::nsMsgDeliverNow,
			      pMsgId, nullptr, nullptr, nullptr);
  if (NS_FAILED(rv)) return rv ;

  // assign to interface pointer from nsCOMPtr to facilitate typecast below
  nsIMsgSendListener * pSendListener = sendListener ;

  // we need to wait here to make sure that we return only after send is completed
  // so we will have a event loop here which will process the events till the Send IsDone.
  nsCOMPtr<nsIThread> thread(do_GetCurrentThread());
  while ( !((nsMAPISendListener *) pSendListener)->IsDone() )
  {
    PR_CEnterMonitor(pSendListener);
    PR_CWait(pSendListener, PR_MicrosecondsToInterval(1000UL));
    PR_CExitMonitor(pSendListener);
    NS_ProcessPendingEvents(thread);
  }

  return rv ;
}

// this is used to populate comp fields with Unicode data
nsresult nsMapiHook::PopulateCompFields(lpnsMapiMessage aMessage,
                                    nsIMsgCompFields * aCompFields)
{
  nsresult rv = NS_OK ;

  if (aMessage->lpOriginator)
    aCompFields->SetFrom (NS_ConvertASCIItoUTF16((char *) aMessage->lpOriginator->lpszAddress));

  nsAutoString To ;
  nsAutoString Cc ;
  nsAutoString Bcc ;

  NS_NAMED_LITERAL_STRING(Comma, ",");

  if (aMessage->lpRecips)
  {
    for (int i=0 ; i < (int) aMessage->nRecipCount ; i++)
    {
      if (aMessage->lpRecips[i].lpszAddress || aMessage->lpRecips[i].lpszName)
      {
        const char *addressWithoutType = (aMessage->lpRecips[i].lpszAddress)
          ? aMessage->lpRecips[i].lpszAddress : aMessage->lpRecips[i].lpszName;
        if (!PL_strncasecmp(addressWithoutType, "SMTP:", 5))
          addressWithoutType += 5;
        switch (aMessage->lpRecips[i].ulRecipClass)
        {
        case MAPI_TO :
          if (!To.IsEmpty())
            To += Comma;
          To.Append(NS_ConvertASCIItoUTF16(addressWithoutType));
          break;

        case MAPI_CC :
          if (!Cc.IsEmpty())
            Cc += Comma;
          Cc.Append(NS_ConvertASCIItoUTF16(addressWithoutType));
          break;

        case MAPI_BCC :
          if (!Bcc.IsEmpty())
            Bcc += Comma;
          Bcc.Append(NS_ConvertASCIItoUTF16(addressWithoutType));
          break;
        }
      }
    }
  }

  PR_LOG(MAPI, PR_LOG_DEBUG, ("to: %s cc: %s bcc: %s \n", NS_ConvertUTF16toUTF8(To).get(), NS_ConvertUTF16toUTF8(Cc).get(), NS_ConvertUTF16toUTF8(Bcc).get()));
  // set To, Cc, Bcc
  aCompFields->SetTo (To) ;
  aCompFields->SetCc (Cc) ;
  aCompFields->SetBcc (Bcc) ;

  // set subject
  if (aMessage->lpszSubject)
    aCompFields->SetSubject(NS_ConvertASCIItoUTF16(aMessage->lpszSubject));

  // handle attachments as File URL
  rv = HandleAttachments (aCompFields, aMessage->nFileCount, aMessage->lpFiles, true) ;
  if (NS_FAILED(rv)) return rv ;

  // set body
  if (aMessage->lpszNoteText)
  {
      nsString Body;
      CopyASCIItoUTF16(aMessage->lpszNoteText, Body);
      if (Body.Last() != '\n')
        Body.AppendLiteral(CRLF);

      if (Body.Find("<html>") == kNotFound)
        aCompFields->SetForcePlainText(true);

      rv = aCompFields->SetBody(Body) ;
  }
  return rv ;
}

nsresult nsMapiHook::HandleAttachments (nsIMsgCompFields * aCompFields, int32_t aFileCount,
                                        lpnsMapiFileDesc aFiles, BOOL aIsUnicode)
{
    nsresult rv = NS_OK ;

    nsAutoCString Attachments ;
    nsAutoCString TempFiles ;

    nsCOMPtr <nsIFile> pFile = do_CreateInstance (NS_LOCAL_FILE_CONTRACTID, &rv) ;
    if (NS_FAILED(rv) || (!pFile) ) return rv ;
    nsCOMPtr <nsIFile> pTempDir = do_CreateInstance (NS_LOCAL_FILE_CONTRACTID, &rv) ;
    if (NS_FAILED(rv) || (!pTempDir) ) return rv ;

    for (int i=0 ; i < aFileCount ; i++)
    {
        bool bTempFile = false ;
        if (aFiles[i].lpszPathName)
        {
            // check if attachment exists
            if (aIsUnicode)
                pFile->InitWithPath (nsDependentString(aFiles[i].lpszPathName));
            else
                pFile->InitWithNativePath (nsDependentCString((const char*)aFiles[i].lpszPathName));

            bool bExist ;
            rv = pFile->Exists(&bExist) ;
            PR_LOG(MAPI, PR_LOG_DEBUG, ("nsMapiHook::HandleAttachments: filename: %s path: %s exists = %s \n", (const char*)aFiles[i].lpszFileName, (const char*)aFiles[i].lpszPathName, bExist ? "true" : "false"));
            if (NS_FAILED(rv) || (!bExist) ) return NS_ERROR_FILE_TARGET_DOES_NOT_EXIST ;

            //Temp Directory
            nsCOMPtr <nsIFile> pTempDir;
            NS_GetSpecialDirectory(NS_OS_TEMP_DIR, getter_AddRefs(pTempDir));

            // create a new sub directory called moz_mapi underneath the temp directory
            pTempDir->AppendRelativePath(NS_LITERAL_STRING("moz_mapi"));
            pTempDir->Exists (&bExist) ;
            if (!bExist)
            {
                rv = pTempDir->Create(nsIFile::DIRECTORY_TYPE, 777) ;
                if (NS_FAILED(rv)) return rv ;
            }

            // rename or copy the existing temp file with the real file name

            nsAutoString leafName ;
            // convert to Unicode using Platform charset
            // leafName already contains a unicode leafName from lpszPathName. If we were given
            // a value for lpszFileName, use it. Otherwise stick with leafName
            if (aFiles[i].lpszFileName)
            {
              nsAutoString wholeFileName;
                if (aIsUnicode)
                    wholeFileName.Assign(aFiles[i].lpszFileName);
                else
                    ConvertToUnicode(nsMsgI18NFileSystemCharset(), (char *) aFiles[i].lpszFileName, wholeFileName);
                // need to find the last '\' and find the leafname from that.
                int32_t lastSlash = wholeFileName.RFindChar(PRUnichar('\\'));
                if (lastSlash != kNotFound)
                  leafName.Assign(Substring(wholeFileName, lastSlash + 1));
                else
                  leafName.Assign(wholeFileName);
            }
            else
              pFile->GetLeafName (leafName);

            nsCOMPtr<nsIMsgAttachment> attachment = do_CreateInstance(NS_MSGATTACHMENT_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);
            attachment->SetName(leafName);

            nsCOMPtr<nsIFile> pTempFile;
            rv = pTempDir->Clone(getter_AddRefs(pTempFile));
            if (NS_FAILED(rv) || !pTempFile)
              return rv;

            pTempFile->Append(leafName);
            pTempFile->Exists(&bExist);
            if (bExist)
            {
              rv = pTempFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0777);
              NS_ENSURE_SUCCESS(rv, rv);
              pTempFile->Remove(false); // remove so we can copy over it.
              pTempFile->GetLeafName(leafName);
            }
            // copy the file to its new location and file name
            pFile->CopyTo(pTempDir, leafName);
            // point pFile to the new location of the attachment
            pFile->InitWithFile(pTempDir);
            pFile->Append(leafName);

            // create MsgCompose attachment object
            attachment->SetTemporary(true); // this one is a temp file so set the flag for MsgCompose

            // now set the attachment object
            nsAutoCString pURL ;
            NS_GetURLSpecFromFile(pFile, pURL);
            attachment->SetUrl(pURL);

            // set the file size
            int64_t fileSize;
            pFile->GetFileSize(&fileSize);
            attachment->SetSize(fileSize);

            // add the attachment
            rv = aCompFields->AddAttachment (attachment);
            if (NS_FAILED(rv))
              PR_LOG(MAPI, PR_LOG_DEBUG, ("nsMapiHook::HandleAttachments: AddAttachment rv =  %lx\n", rv));
        }
    }
    return rv ;
}


// this is used to convert non Unicode data and then populate comp fields
nsresult nsMapiHook::PopulateCompFieldsWithConversion(lpnsMapiMessage aMessage,
                                    nsIMsgCompFields * aCompFields)
{
  nsresult rv = NS_OK;

  if (aMessage->lpOriginator)
  {
    nsAutoString From;
    From.Append(NS_ConvertASCIItoUTF16((char *) aMessage->lpOriginator->lpszAddress));
    aCompFields->SetFrom (From);
  }

  nsAutoString To;
  nsAutoString Cc;
  nsAutoString Bcc;
  NS_NAMED_LITERAL_STRING(Comma, ",");
  if (aMessage->lpRecips)
  {
    for (int i=0 ; i < (int) aMessage->nRecipCount ; i++)
    {
      if (aMessage->lpRecips[i].lpszAddress || aMessage->lpRecips[i].lpszName)
      {
        const char *addressWithoutType = (aMessage->lpRecips[i].lpszAddress)
          ? aMessage->lpRecips[i].lpszAddress : aMessage->lpRecips[i].lpszName;
        if (!PL_strncasecmp(addressWithoutType, "SMTP:", 5))
          addressWithoutType += 5;

        switch (aMessage->lpRecips[i].ulRecipClass)
        {
        case MAPI_TO :
          if (!To.IsEmpty())
            To += Comma ;
          To.Append(NS_ConvertASCIItoUTF16(addressWithoutType));
          break ;

        case MAPI_CC :
          if (!Cc.IsEmpty())
            Cc += Comma ;
          Cc.Append(NS_ConvertASCIItoUTF16(addressWithoutType));
          break ;

        case MAPI_BCC :
          if (!Bcc.IsEmpty())
              Bcc += Comma ;
          Bcc.Append(NS_ConvertASCIItoUTF16(addressWithoutType));
          break ;
        }
      }
    }
  }

  // set To, Cc, Bcc
  aCompFields->SetTo (To) ;
  aCompFields->SetCc (Cc) ;
  aCompFields->SetBcc (Bcc) ;

  PR_LOG(MAPI, PR_LOG_DEBUG, ("to: %s cc: %s bcc: %s \n", NS_ConvertUTF16toUTF8(To).get(), NS_ConvertUTF16toUTF8(Cc).get(), NS_ConvertUTF16toUTF8(Bcc).get()));

  nsAutoCString platformCharSet;
  // set subject
  if (aMessage->lpszSubject)
  {
    nsAutoString Subject ;
    if (platformCharSet.IsEmpty())
      platformCharSet.Assign(nsMsgI18NFileSystemCharset());
    rv = ConvertToUnicode(platformCharSet.get(), (char *) aMessage->lpszSubject, Subject);
    if (NS_FAILED(rv)) return rv;
    aCompFields->SetSubject(Subject);
  }

  // handle attachments as File URL
  rv = HandleAttachments (aCompFields, aMessage->nFileCount, aMessage->lpFiles, false) ;
  if (NS_FAILED(rv)) return rv ;

  // set body
  if (aMessage->lpszNoteText)
  {
    nsAutoString Body ;
    if (platformCharSet.IsEmpty())
      platformCharSet.Assign(nsMsgI18NFileSystemCharset());
    rv = ConvertToUnicode(platformCharSet.get(), (char *) aMessage->lpszNoteText, Body);
    if (NS_FAILED(rv)) return rv ;
    if (Body.Last() != '\n')
      Body.AppendLiteral(CRLF);

    if (Body.Find("<html>") == kNotFound)
      aCompFields->SetForcePlainText(true);

    rv = aCompFields->SetBody(Body) ;
  }

#ifdef RAJIV_DEBUG
  // testing what all was set in CompFields
  printf ("To : %S \n", To.get()) ;
  printf ("CC : %S \n", Cc.get() ) ;
  printf ("BCC : %S \n", Bcc.get() ) ;
#endif

  return rv ;
}

// this is used to populate the docs as attachments in the Comp fields for Send Documents
nsresult nsMapiHook::PopulateCompFieldsForSendDocs(nsIMsgCompFields * aCompFields, ULONG aFlags,
                            PRUnichar * aDelimChar, PRUnichar * aFilePaths)
{
  nsAutoString strDelimChars ;
  nsString strFilePaths;
  nsresult rv = NS_OK ;
  bool bExist ;

  if (aFlags & MAPI_UNICODE)
  {
    if (aDelimChar)
      strDelimChars.Assign (aDelimChar);
    if (aFilePaths)
      strFilePaths.Assign (aFilePaths);
  }
  else
  {
    if (aDelimChar)
      strDelimChars.Assign(aDelimChar);
    if (aFilePaths)
      strFilePaths.Assign ( aFilePaths);
  }

  // check for comma in filename
  if (strDelimChars.FindChar(',') == kNotFound)  // if comma is not in the delimiter specified by user
  {
    if (strFilePaths.FindChar(',') != kNotFound) // if comma found in filenames return error
      return NS_ERROR_FILE_INVALID_PATH;
  }

  nsCString Attachments ;

  // only 1 file is to be sent, no delim specified
  if (strDelimChars.IsEmpty())
      strDelimChars.AssignLiteral(";");

  int32_t offset = 0 ;
  int32_t FilePathsLen = strFilePaths.Length() ;
  if (FilePathsLen)
  {
    nsAutoString Subject ;

    // multiple files to be sent, delim specified
    nsCOMPtr <nsIFile> pFile = do_CreateInstance (NS_LOCAL_FILE_CONTRACTID, &rv) ;
    if (NS_FAILED(rv) || (!pFile) ) return rv ;

    PRUnichar * newFilePaths = (PRUnichar *) strFilePaths.get() ;
    while (offset != kNotFound)
    {
      //Temp Directory
      nsCOMPtr <nsIFile> pTempDir;
      NS_GetSpecialDirectory(NS_OS_TEMP_DIR, getter_AddRefs(pTempDir));

      // if not already existing, create another temp dir for mapi within Win temp dir
      // this is windows only so we can do "\\"
      pTempDir->AppendRelativePath (NS_LITERAL_STRING("moz_mapi"));
      pTempDir->Exists(&bExist) ;
      if (!bExist)
      {
        rv = pTempDir->Create(nsIFile::DIRECTORY_TYPE, 777) ;
        if (NS_FAILED(rv)) return rv ;
      }

      nsString RemainingPaths ;
      RemainingPaths.Assign(newFilePaths) ;
      offset = RemainingPaths.Find (strDelimChars) ;
      if (offset != kNotFound)
      {
        RemainingPaths.SetLength (offset) ;
        if ((offset + strDelimChars.Length()) < FilePathsLen)
          newFilePaths += offset + strDelimChars.Length() ;
        else
          offset = kNotFound;
        FilePathsLen -= offset + strDelimChars.Length();
      }

      if (RemainingPaths[1] != ':' && RemainingPaths[1] != '\\')
      {
        char cwd[MAX_PATH];
        if (_getdcwd(_getdrive(), cwd, MAX_PATH))
        {
          nsAutoString cwdStr;
          CopyASCIItoUTF16(cwd, cwdStr);
          cwdStr.Append('\\');
          RemainingPaths.Insert(cwdStr, 0);
        }
      }

      pFile->InitWithPath (RemainingPaths) ;

      rv = pFile->Exists(&bExist) ;
      if (NS_FAILED(rv) || (!bExist) ) return NS_ERROR_FILE_TARGET_DOES_NOT_EXIST ;

      // filename of the file attachment
      nsAutoString leafName ;
      pFile->GetLeafName (leafName) ;
      if(NS_FAILED(rv) || leafName.IsEmpty()) return rv ;

      if (!Subject.IsEmpty())
          Subject.AppendLiteral(", ");
      Subject += leafName;

      // create MsgCompose attachment object
      nsCOMPtr<nsIMsgAttachment> attachment = do_CreateInstance(NS_MSGATTACHMENT_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      nsDependentString fileNameNative(leafName.get());
      rv = pFile->CopyTo(pTempDir, fileNameNative);
      if (NS_FAILED(rv)) return rv;

      // now turn pTempDir into a full file path to the temp file
      pTempDir->Append(fileNameNative);

      // this one is a temp file so set the flag for MsgCompose
      attachment->SetTemporary(true);

      // now set the attachment object
      nsAutoCString pURL;
      NS_GetURLSpecFromFile(pTempDir, pURL);
      attachment->SetUrl(pURL);

      // set the file size
      int64_t fileSize;
      pFile->GetFileSize(&fileSize);
      attachment->SetSize(fileSize);

      // add the attachment
      rv = aCompFields->AddAttachment (attachment);
      if (NS_FAILED(rv)) return rv;
    }

    rv = aCompFields->SetBody(Subject) ;
  }

  return rv ;
}

// this used for Send with UI
nsresult nsMapiHook::ShowComposerWindow (unsigned long aSession, nsIMsgCompFields * aCompFields)
{
    nsresult rv = NS_OK ;

    // create a send listener to get back the send status
    nsCOMPtr <nsIMsgSendListener> sendListener ;
    rv = nsMAPISendListener::CreateMAPISendListener(getter_AddRefs(sendListener)) ;
    if (NS_FAILED(rv) || (!sendListener) ) return rv ;

    // create the compose params object
    nsCOMPtr<nsIMsgComposeParams> pMsgComposeParams (do_CreateInstance(NS_MSGCOMPOSEPARAMS_CONTRACTID, &rv));
    if (NS_FAILED(rv) || (!pMsgComposeParams) ) return rv ;

    bool forcePlainText;
    aCompFields->GetForcePlainText(&forcePlainText);
    pMsgComposeParams->SetFormat(forcePlainText ? nsIMsgCompFormat::Default : nsIMsgCompFormat::HTML);
    // populate the compose params
    pMsgComposeParams->SetType(nsIMsgCompType::New);
    pMsgComposeParams->SetFormat(nsIMsgCompFormat::Default);
    pMsgComposeParams->SetComposeFields(aCompFields);
    pMsgComposeParams->SetSendListener(sendListener) ;

    /** get the nsIMsgComposeService object to open the compose window **/
    nsCOMPtr <nsIMsgComposeService> compService = do_GetService (NS_MSGCOMPOSESERVICE_CONTRACTID) ;
    if (NS_FAILED(rv)|| (!compService) ) return rv ;

    rv = compService->OpenComposeWindowWithParams(nullptr, pMsgComposeParams) ;
    if (NS_FAILED(rv)) return rv ;

    return rv ;
}
