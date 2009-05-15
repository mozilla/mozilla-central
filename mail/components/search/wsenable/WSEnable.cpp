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
 * The Original Code is Windows Search integration.
 *
 * The Initial Developer of the Original Code is
 *  Siddharth Agarwal <sid1337@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
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

#include <SearchAPI.h>
#include <shellapi.h>
#include <objbase.h>
#include <string>

static const CLSID CLSID_CSearchManager = {0x7d096c5f, 0xac08, 0x4f1f, {0xbe, 0xb7, 0x5c, 0x22, 0xc5, 0x17, 0xce, 0x39}};
static const IID IID_ISearchManager = {0xab310581, 0xac80, 0x11d1, {0x8d, 0xf3, 0x00, 0xc0, 0x4f, 0xb6, 0xef, 0x69}};

static const WCHAR* const sFoldersToIndex[] = {L"\\Mail\\", L"\\ImapMail\\", L"\\News\\"};

struct RegKey
{
  HKEY mRoot;
  LPWSTR mSubKey;
  LPWSTR mName;
  LPWSTR mValue;

  RegKey(HKEY aRoot, LPWSTR aSubKey, LPWSTR aName, LPWSTR aValue)
    : mRoot(aRoot), mSubKey(aSubKey), mName(aName), mValue(aValue) {}
};

static const RegKey* const sRegKeys[] =
{
  new RegKey(HKEY_LOCAL_MACHINE,
             L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\PropertySystem\\PropertyHandlers\\.wdseml",
             L"",
             L"{5FA29220-36A1-40f9-89C6-F4B384B7642E}"),
  new RegKey(HKEY_CLASSES_ROOT,
             L".wdseml",
             L"Content Type",
             L"message/rfc822"),
  new RegKey(HKEY_CLASSES_ROOT,
             L".wdseml\\PersistentHandler",
             L"",
             L"{5645c8c4-e277-11cf-8fda-00aa00a14f93}"),
  new RegKey(HKEY_CLASSES_ROOT,
             L".wdseml\\shellex\\{8895B1C6-B41F-4C1C-A562-0D564250836F}",
             L"",
             L"{b9815375-5d7f-4ce2-9245-c9d4da436930}"),
  new RegKey(HKEY_LOCAL_MACHINE,
             L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\explorer\\KindMap",
             L".wdseml",
             L"email;communication")
};

HRESULT GetCrawlScopeManager(ISearchCrawlScopeManager **aCrawlScopeManager)
{
  *aCrawlScopeManager = NULL;

  ISearchManager* searchManager;
  HRESULT hr = CoCreateInstance(CLSID_CSearchManager, NULL, CLSCTX_ALL, IID_ISearchManager, (void**)&searchManager);
  if (SUCCEEDED(hr))
  {
    ISearchCatalogManager* catalogManager;
    hr = searchManager->GetCatalog(L"SystemIndex", &catalogManager);
    if (SUCCEEDED(hr))
    {
      hr = catalogManager->GetCrawlScopeManager(aCrawlScopeManager);
      catalogManager->Release();
    }
    searchManager->Release();
  }
  return hr;
}

LSTATUS SetRegistryKeys()
{
  LSTATUS rv = ERROR_SUCCESS;
  for (int i = 0; rv == ERROR_SUCCESS && i < _countof(sRegKeys); i++)
  {
    const RegKey *key = sRegKeys[i];
    HKEY subKey;
    // Since we're administrator, we should be able to do this just fine
    rv = RegCreateKeyExW(key->mRoot, key->mSubKey, 0, NULL, REG_OPTION_NON_VOLATILE,
          KEY_ALL_ACCESS | KEY_WOW64_64KEY, NULL, &subKey, NULL);
    if (rv == ERROR_SUCCESS)
      rv = RegSetValueExW(subKey, key->mName, 0, REG_SZ, (LPBYTE) key->mValue, 
            (lstrlenW(key->mValue) + 1) * sizeof(WCHAR));
    RegCloseKey(subKey);
  }

  return rv;
}

int APIENTRY wWinMain(HINSTANCE hInstance,
                      HINSTANCE hPrevInstance,
                      LPWSTR    lpCmdLine,
                      int       nCmdShow)
{
  UNREFERENCED_PARAMETER(lpCmdLine);

  HRESULT hr = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
  if (SUCCEEDED(hr))
  {
    int argc;
    LPWSTR *argv = CommandLineToArgvW(lpCmdLine, &argc);
    if (argc != 2)
      hr = E_INVALIDARG;
    if (SUCCEEDED(hr))
    {
      ISearchCrawlScopeManager* crawlScopeManager;
      hr = GetCrawlScopeManager(&crawlScopeManager);
      if (SUCCEEDED(hr))
      {
        if (*argv[0] == L'1')
        {
          // We first add the required registry entries
          LSTATUS rv = SetRegistryKeys();
          if (rv != ERROR_SUCCESS)
            hr = E_FAIL;

          // Next, we add rules for each of the three folders
          for (int i = 0; SUCCEEDED(hr) && i < _countof(sFoldersToIndex); i++)
          {
            std::wstring path = L"file:///";
            path.append(argv[1]);
            path.append(sFoldersToIndex[i]);
            // Add only if the rule isn't already there
            BOOL isIncluded = FALSE;
            hr = crawlScopeManager->IncludedInCrawlScope(path.c_str(), &isIncluded);
            if (SUCCEEDED(hr) && !isIncluded)
              hr = crawlScopeManager->AddUserScopeRule(path.c_str(), TRUE, TRUE, TRUE);
          }
        }
        else if (*argv[0] == L'0')
        {
          // This is simple, we just exclude the profile dir and override children
          std::wstring path = L"file:///";
          path.append(argv[1]);
          hr = crawlScopeManager->AddUserScopeRule(path.c_str(), FALSE, TRUE, TRUE);
        }
        else
          hr = E_INVALIDARG;

        if (SUCCEEDED(hr))
        {
          hr = crawlScopeManager->SaveAll();
        }
        crawlScopeManager->Release();
      }
    }
    LocalFree(argv);
  }

  return hr;
}
