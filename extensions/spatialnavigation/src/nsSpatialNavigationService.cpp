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
 * The Original Code is Spatial Navigation
 *
 * The Initial Developer of the Original Code is 
 * Douglas F. Turner II  <dougt@meer.net>
 * Portions created by the Initial Developer are Copyright (C) 2004-2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "nsSpatialNavigationPrivate.h"
#include "nsIObserverService.h"

nsSpatialNavigationService::nsSpatialNavigationService()  
{
  mEnabled             = PR_TRUE;
  mIgnoreTextFields    = PR_TRUE;
  mDisableJSWhenFocusing = PR_TRUE;

  mKeyCodeLeft         = nsIDOMKeyEvent::DOM_VK_LEFT;
  mKeyCodeRight        = nsIDOMKeyEvent::DOM_VK_RIGHT;
  mKeyCodeUp           = nsIDOMKeyEvent::DOM_VK_UP;
  mKeyCodeDown         = nsIDOMKeyEvent::DOM_VK_DOWN;

  mKeyCodeModifier     = 0x00000012 | 0x00100000; // By default ALT and SHIFT
}  

nsSpatialNavigationService::~nsSpatialNavigationService()  
{
}  

NS_IMPL_ISUPPORTS1(nsSpatialNavigationService, nsIObserver)

NS_IMETHODIMP
nsSpatialNavigationService::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *aData)
{
  nsresult rv;

  if (!strcmp(aTopic,"domwindowopened")) 
  {
    nsCOMPtr<nsIDOMWindow> chromeWindow = do_QueryInterface(aSubject);
    
    nsSpatialNavigation* sn = new nsSpatialNavigation(this);

    if (!sn)
      return NS_ERROR_OUT_OF_MEMORY;

    sn->Init(chromeWindow);
    
    mObjects.AppendObject(sn);  // the array owns the only reference to sn.

    return NS_OK;
  }
  
  if (!strcmp(aTopic,"domwindowclosed")) 
  {
    nsCOMPtr<nsIDOMWindow> chromeWindow = do_QueryInterface(aSubject);
    // need to find it in our array
  
    PRInt32 count = mObjects.Count();
    for (PRInt32 i = 0; i < count; i++)
    {
      nsISpatialNavigation* sn = mObjects[i];
      nsCOMPtr<nsIDOMWindow> attachedWindow;
      sn->GetAttachedWindow(getter_AddRefs(attachedWindow));

      if (attachedWindow == chromeWindow) 
      {
        sn->Shutdown();
        mObjects.RemoveObjectAt(i);
        return NS_OK;
      }
    }
    return NS_OK;
  }

  
  if (!strcmp(aTopic,"app-startup")) 
  {
    nsCOMPtr<nsIWindowWatcher> windowWatcher = do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    windowWatcher->RegisterNotification(this);
    
    nsCOMPtr<nsIPrefBranch2> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    prefBranch->AddObserver("snav.", this, PR_FALSE);
    
    nsCOMPtr<nsIObserverService> observerService = 
             do_GetService(NS_OBSERVERSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = observerService->AddObserver(this, "profile-after-change", PR_FALSE);
    NS_ENSURE_SUCCESS(rv, rv);
    
    return NS_OK;
  }
  
  if (!strcmp(aTopic,"profile-after-change"))
  {
    // the profile has loaded, read in the preferences
    nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    PRBool tempBool;
    PRInt32 tempInt32;
    
    // note that if Get*Pref fails, the pref may not exist, so we fallback to
    // the defaults as defined in the constructor
    
    rv = prefBranch->GetBoolPref("snav.enabled", &tempBool);
    if (NS_SUCCEEDED(rv))
      mEnabled = tempBool;
    rv = prefBranch->GetBoolPref("snav.ignoreTextFields", &tempBool);
    if (NS_SUCCEEDED(rv))
      mIgnoreTextFields = tempBool;
    rv = prefBranch->GetIntPref("snav.directionalBias", &tempInt32);
    if (NS_SUCCEEDED(rv))
    {
      gDirectionalBias = tempInt32;
      if (gDirectionalBias == 0)
        gDirectionalBias = 1;
    }
    rv = prefBranch->GetBoolPref("snav.disableJS", &tempBool);
    if (NS_SUCCEEDED(rv))
      mDisableJSWhenFocusing = tempBool;
    rv = prefBranch->GetIntPref("snav.rectFudge", &tempInt32);
    if (NS_SUCCEEDED(rv))
      gRectFudge = tempInt32;
    rv = prefBranch->GetIntPref("snav.keyCode.left", &tempInt32);
    if (NS_SUCCEEDED(rv))
      mKeyCodeLeft = tempInt32;
    rv = prefBranch->GetIntPref("snav.keyCode.right", &tempInt32);
    if (NS_SUCCEEDED(rv))
      mKeyCodeRight = tempInt32;
    rv = prefBranch->GetIntPref("snav.keyCode.up", &tempInt32);
    if (NS_SUCCEEDED(rv))
      mKeyCodeUp = tempInt32;
    rv = prefBranch->GetIntPref("snav.keyCode.down", &tempInt32);
    if (NS_SUCCEEDED(rv))
      mKeyCodeDown = tempInt32;
    rv = prefBranch->GetIntPref("snav.keyCode.modifier", &tempInt32);
    if (NS_SUCCEEDED(rv))
      mKeyCodeModifier = tempInt32;
    
    return NS_OK;
  }
  
  if (!strcmp(aTopic, NS_PREFBRANCH_PREFCHANGE_TOPIC_ID)) 
  {
    nsCOMPtr<nsIPrefBranch> prefBranch = do_QueryInterface(aSubject);
    nsXPIDLCString cstr;
    
    const char* pref = NS_ConvertUTF16toUTF8(aData).get();

    if (!strcmp(pref, "snav.enabled"))
    {
      prefBranch->GetBoolPref(pref, &mEnabled);
    }
    else if (!strcmp(pref, "snav.ignoreTextFields"))
    {
      prefBranch->GetBoolPref(pref, &mIgnoreTextFields);
    }
    else if (!strcmp(pref, "snav.directionalBias"))
    {
      prefBranch->GetIntPref(pref, &gDirectionalBias);
      if (gDirectionalBias == 0)
        gDirectionalBias = 1;
    }
    else if (!strcmp(pref, "snav.disableJS"))
    {
      prefBranch->GetBoolPref(pref, &mDisableJSWhenFocusing);
    }
    else if (!strcmp(pref, "snav.rectFudge"))
    {
      prefBranch->GetIntPref(pref, &gRectFudge);
    }
    else if (!strcmp(pref, "snav.keyCode.left"))
    {
      prefBranch->GetIntPref(pref, &mKeyCodeLeft);
    }
    else if (!strcmp(pref, "snav.keyCode.right"))
    {
      prefBranch->GetIntPref(pref, &mKeyCodeRight);
    }
    else if (!strcmp(pref, "snav.keyCode.up"))
    {
      prefBranch->GetIntPref(pref, &mKeyCodeUp);
    }    
    else if (!strcmp(pref, "snav.keyCode.down"))
    {
      prefBranch->GetIntPref(pref, &mKeyCodeDown);
    }    
    else if (!strcmp(pref, "snav.keyCode.modifier"))
    {
      prefBranch->GetIntPref(pref, &mKeyCodeModifier);
    }
    
    return NS_OK;
  }
  
  return NS_OK;
}


//------------------------------------------------------------------------------
//  XPCOM REGISTRATION BELOW
//------------------------------------------------------------------------------

#define SpatialNavigation_CID \
{ 0xd1b91385, 0xe1c1, 0x46ec, \
{0x8d, 0x15, 0x88, 0x0c, 0x45, 0xbe, 0x8e, 0x0e} }

#define SpatialNavigation_ContractID "@mozilla.org/spatialNavigation/service;1"

#define SpatialNavigationService_CID \
{ 0x4125624b, 0xaf22, 0x4d50, \
{ 0x87, 0xf6, 0x40, 0x19, 0xc9, 0x85, 0x7b, 0x58} }

#define SpatialNavigationService_ContractID "@mozilla.org/spatialnavigation/service"

static NS_METHOD SpatialNavigationServiceRegistration(nsIComponentManager *aCompMgr,
                                                      nsIFile *aPath,
                                                      const char *registryLocation,
                                                      const char *componentType,
                                                      const nsModuleComponentInfo *info)
{
  nsresult rv;
  
  nsCOMPtr<nsIServiceManager> servman = do_QueryInterface((nsISupports*)aCompMgr, &rv);
  if (NS_FAILED(rv))
    return rv;
  
  
  nsCOMPtr<nsICategoryManager> catman;
  servman->GetServiceByContractID(NS_CATEGORYMANAGER_CONTRACTID, 
                                  NS_GET_IID(nsICategoryManager), 
                                  getter_AddRefs(catman));
  
  if (NS_FAILED(rv))
    return rv;
  
  char* previous = nsnull;
  rv = catman->AddCategoryEntry("app-startup",
                                "SpatialNavigationService", 
                                SpatialNavigationService_ContractID,
                                PR_TRUE, 
                                PR_TRUE, 
                                &previous);
  if (previous)
    nsMemory::Free(previous);
  
  return rv;
}

static NS_METHOD SpatialNavigationServiceUnregistration(nsIComponentManager *aCompMgr,
                                                        nsIFile *aPath,
                                                        const char *registryLocation,
                                                        const nsModuleComponentInfo *info)
{
  nsresult rv;
  
  nsCOMPtr<nsIServiceManager> servman = do_QueryInterface((nsISupports*)aCompMgr, &rv);
  if (NS_FAILED(rv))
    return rv;
  
  nsCOMPtr<nsICategoryManager> catman;
  servman->GetServiceByContractID(NS_CATEGORYMANAGER_CONTRACTID, 
                                  NS_GET_IID(nsICategoryManager), 
                                  getter_AddRefs(catman));
  
  if (NS_FAILED(rv))
    return rv;
  
  rv = catman->DeleteCategoryEntry("app-startup",
                                   "SpatialNavigationService", 
                                   PR_TRUE);
  
  return rv;
}



NS_GENERIC_FACTORY_CONSTRUCTOR(nsSpatialNavigationService)
  
  
static const nsModuleComponentInfo components[] =
{
  { "SpatialNavigationService", 
    SpatialNavigationService_CID, 
    SpatialNavigationService_ContractID,
    nsSpatialNavigationServiceConstructor,
    SpatialNavigationServiceRegistration,
    SpatialNavigationServiceUnregistration
  }
  
};

NS_IMPL_NSGETMODULE(SpatialNavigationModule, components)
