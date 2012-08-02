/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbLDAPListenerBase.h"
#include "nsIWindowWatcher.h"
#include "nsIDOMWindow.h"
#include "nsIAuthPrompt.h"
#include "nsIStringBundle.h"
#include "nsILDAPMessage.h"
#include "nsILDAPErrors.h"
#include "nsILoginManager.h"
#include "nsILoginInfo.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMemory.h"
#include "mozilla/Services.h"

using namespace mozilla;

nsAbLDAPListenerBase::nsAbLDAPListenerBase(nsILDAPURL* url,
                                           nsILDAPConnection* connection,
                                           const nsACString &login,
                                           const PRInt32 timeOut) :
  mDirectoryUrl(url), mConnection(connection), mLogin(login),
  mTimeOut(timeOut), mBound(false), mInitialized(false),
  mLock("nsAbLDAPListenerBase.mLock")
{
}

nsAbLDAPListenerBase::~nsAbLDAPListenerBase()
{
}

nsresult nsAbLDAPListenerBase::Initiate()
{
  if (!mConnection || !mDirectoryUrl)
    return NS_ERROR_NULL_POINTER;

  if (mInitialized)
    return NS_OK;

  mInitialized = true;

  return NS_OK;
}

// If something fails in this function, we must call InitFailed() so that the
// derived class (and listener) knows to cancel what its doing as there is
// a problem.
NS_IMETHODIMP nsAbLDAPListenerBase::OnLDAPInit(nsILDAPConnection *aConn, nsresult aStatus)
{
  if (!mConnection || !mDirectoryUrl)
  {
    InitFailed();
    return NS_ERROR_NULL_POINTER;
  }

  nsresult rv;
  nsString passwd;

  // Make sure that the Init() worked properly
  if (NS_FAILED(aStatus))
  {
    InitFailed();
    return NS_OK;
  }

  // If mLogin is set, we're expected to use it to get a password.
  //
  if (!mLogin.IsEmpty() && !mSaslMechanism.EqualsLiteral("GSSAPI"))
  {
    // get the string bundle service
    //
    nsCOMPtr<nsIStringBundleService> stringBundleSvc = 
      mozilla::services::GetStringBundleService();
    if (!stringBundleSvc)
    {
      NS_ERROR("nsAbLDAPListenerBase::OnLDAPInit():"
               " error getting string bundle service");
      InitFailed();
      return NS_ERROR_UNEXPECTED;
    }

    // get the LDAP string bundle
    //
    nsCOMPtr<nsIStringBundle> ldapBundle;
    rv = stringBundleSvc->CreateBundle("chrome://mozldap/locale/ldap.properties",
                                       getter_AddRefs(ldapBundle));
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPListenerBase::OnLDAPInit(): error creating string"
               "bundle chrome://mozldap/locale/ldap.properties");
      InitFailed();
      return rv;
    }

    // get the title for the authentication prompt
    //
    nsString authPromptTitle;
    rv = ldapBundle->GetStringFromName(NS_LITERAL_STRING("authPromptTitle").get(),
                                       getter_Copies(authPromptTitle));
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPListenerBase::OnLDAPInit(): error getting"
               "'authPromptTitle' string from bundle "
               "chrome://mozldap/locale/ldap.properties");
      InitFailed();
      return rv;
    }

    // get the host name for the auth prompt
    //
    nsCAutoString host;
    rv = mDirectoryUrl->GetAsciiHost(host);
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPListenerBase::OnLDAPInit(): error getting ascii host"
               "name from directory url");
      InitFailed();
      return rv;
    }

    // hostTemp is only necessary to work around a code-generation 
    // bug in egcs 1.1.2 (the version of gcc that comes with Red Hat 6.2),
    // which is the default compiler for Mozilla on linux at the moment.
    //
    NS_ConvertASCIItoUTF16 hostTemp(host);
    const PRUnichar *hostArray[1] = { hostTemp.get() };

    // format the hostname into the authprompt text string
    //
    nsString authPromptText;
    rv = ldapBundle->FormatStringFromName(NS_LITERAL_STRING("authPromptText").get(),
                                          hostArray,
                                          sizeof(hostArray) / sizeof(const PRUnichar *),
                                          getter_Copies(authPromptText));
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPListenerBase::OnLDAPInit():"
               "error getting 'authPromptText' string from bundle "
               "chrome://mozldap/locale/ldap.properties");
      InitFailed();
      return rv;
    }

    // get the window watcher service, so we can get an auth prompter
    //
    nsCOMPtr<nsIWindowWatcher> windowWatcherSvc = 
      do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv);
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPListenerBase::OnLDAPInit():"
               " couldn't get window watcher service.");
      InitFailed();
      return rv;
    }

    // get the addressbook window, as it will be used to parent the auth
    // prompter dialog
    //
    nsCOMPtr<nsIDOMWindow> abDOMWindow;
    rv = windowWatcherSvc->GetWindowByName(NS_LITERAL_STRING("addressbookWindow").get(),
                                           nullptr,
                                           getter_AddRefs(abDOMWindow));
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPListenerBase::OnLDAPInit():"
               " error getting addressbook Window");
      InitFailed();
      return rv;
    }

    // get the auth prompter itself
    //
    nsCOMPtr<nsIAuthPrompt> authPrompter;
    rv = windowWatcherSvc->GetNewAuthPrompter(abDOMWindow,
                                              getter_AddRefs(authPrompter));
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPMessageBase::OnLDAPInit():"
               " error getting auth prompter");
      InitFailed();
      return rv;
    }

    // get authentication password, prompting the user if necessary
    //
    // we're going to use the URL spec of the server as the "realm" for 
    // wallet to remember the password by / for.

    // Get the specification
    nsCString spec;
    rv = mDirectoryUrl->GetSpec(spec);
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPMessageBase::OnLDAPInit():"
               " error getting directory url spec");
      InitFailed();
      return rv;
    }

    bool status;
    rv = authPrompter->PromptPassword(authPromptTitle.get(),
                                      authPromptText.get(),
                                      NS_ConvertUTF8toUTF16(spec).get(),
                                      nsIAuthPrompt::SAVE_PASSWORD_PERMANENTLY,
                                      getter_Copies(passwd),
                                      &status);
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPMessageBase::OnLDAPInit(): failed to prompt for"
               " password");
      InitFailed();
      return rv;
    }
    else if (!status)
    {
      InitFailed(true);
      return NS_OK;
    }
  }

  // Initiate the LDAP operation
  mOperation = do_CreateInstance(NS_LDAPOPERATION_CONTRACTID, &rv);
  if (NS_FAILED(rv))
  {
    NS_ERROR("nsAbLDAPMessageBase::OnLDAPInit(): failed to create ldap operation");
    InitFailed();
    return rv;
  }

  rv = mOperation->Init(mConnection, this, nullptr);
  if (NS_FAILED(rv))
  {
    NS_ERROR("nsAbLDAPMessageBase::OnLDAPInit(): failed to Initialise operation");
    InitFailed();
    return rv;
  }

  // Try non-password mechanisms first
  if (mSaslMechanism.EqualsLiteral("GSSAPI"))
  {
    nsCAutoString service;
    rv = mDirectoryUrl->GetAsciiHost(service);
    NS_ENSURE_SUCCESS(rv, rv);

    service.Insert(NS_LITERAL_CSTRING("ldap@"), 0);

    nsCOMPtr<nsIAuthModule> authModule =
      do_CreateInstance(NS_AUTH_MODULE_CONTRACTID_PREFIX "sasl-gssapi", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = mOperation->SaslBind(service, mSaslMechanism, authModule);
    if (NS_FAILED(rv))
    {
      NS_ERROR("nsAbLDAPMessageBase::OnLDAPInit(): "
               "failed to perform GSSAPI bind");
      mOperation = 0; // Break Listener -> Operation -> Listener ref cycle
      InitFailed();
    }
    return rv;
  }

  // Bind
  rv = mOperation->SimpleBind(NS_ConvertUTF16toUTF8(passwd));
  if (NS_FAILED(rv))
  {
    NS_ERROR("nsAbLDAPMessageBase::OnLDAPInit(): failed to perform bind operation");
    mOperation = 0; // Break Listener->Operation->Listener reference cycle
    InitFailed();
  }
  return rv;
}

nsresult nsAbLDAPListenerBase::OnLDAPMessageBind(nsILDAPMessage *aMessage)
{
  if (mBound)
    return NS_OK;

  // see whether the bind actually succeeded
  //
  PRInt32 errCode;
  nsresult rv = aMessage->GetErrorCode(&errCode);
  NS_ENSURE_SUCCESS(rv, rv);

  if (errCode != nsILDAPErrors::SUCCESS)
  {
    // if the login failed, tell the wallet to forget this password
    //
    if (errCode == nsILDAPErrors::INAPPROPRIATE_AUTH ||
        errCode == nsILDAPErrors::INVALID_CREDENTIALS)
    {
      // Login failed, so try again - but first remove the existing login(s)
      // so that the user gets prompted. This may not be the best way of doing
      // things, we need to review that later.

      nsCOMPtr<nsILoginManager> loginMgr =
        do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCString spec;
      rv = mDirectoryUrl->GetSpec(spec);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCString prePath;
      rv = mDirectoryUrl->GetPrePath(prePath);
      NS_ENSURE_SUCCESS(rv, rv);

      PRUint32 count;
      nsILoginInfo** logins;

      rv = loginMgr->FindLogins(&count, NS_ConvertUTF8toUTF16(prePath),
                                EmptyString(),
                                NS_ConvertUTF8toUTF16(spec), &logins);
      NS_ENSURE_SUCCESS(rv, rv);

      // Typically there should only be one-login stored for this url, however,
      // just in case there isn't.
      for (PRUint32 i = 0; i < count; ++i)
      {
        rv = loginMgr->RemoveLogin(logins[i]);
        if (NS_FAILED(rv))
        {
          NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);
          return rv;
        }
      }
      NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);

      // XXX We should probably pop up an error dialog telling
      // the user that the login failed here, rather than just bringing 
      // up the password dialog again, which is what calling OnLDAPInit()
      // does.
      return OnLDAPInit(nullptr, NS_OK);
    }

    // Don't know how to handle this, so use the message error code in
    // the failure return value so we hopefully get it back to the UI.
    return NS_ERROR_GENERATE_FAILURE(NS_ERROR_MODULE_LDAP, errCode);
  }

  mBound = true;
  return DoTask();
}
