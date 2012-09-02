/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#undef _UNICODE
#undef UNICODE

#include <objbase.h>
#include "nsStringGlue.h"
#include "Registry.h"

#define MAPI_PROXY_DLL_NAME   "MapiProxy.dll"
#define MAPI_STARTUP_ARG      " /MAPIStartUp"
#define MAX_SIZE              2048

// Size of a CLSID as a string
const int CLSID_STRING_SIZE = 39;

// Proxy/Stub Dll Routines

typedef HRESULT (__stdcall ProxyServer)();


// Convert a CLSID to a char string.

BOOL CLSIDtochar(const CLSID& clsid, char* szCLSID,
                 int length)
{
    LPOLESTR wszCLSID = NULL;

    // Get CLSID
    HRESULT hr = StringFromCLSID(clsid, &wszCLSID);
    if (FAILED(hr))
        return FALSE;

    // Covert from wide characters to non-wide.
    wcstombs(szCLSID, wszCLSID, length);

    // Free memory.
    CoTaskMemFree(wszCLSID);

    return TRUE;
}

// Create a key and set its value.

BOOL setKeyAndValue(nsAutoCString keyName, const char* subKey,
                    const char* theValue)
{
    HKEY hKey;
    BOOL retValue = TRUE;

    nsAutoCString theKey(keyName);
    if (subKey != NULL)
    {
        theKey += "\\";
        theKey += subKey;
    }

    // Create and open key and subkey.
    long lResult = RegCreateKeyEx(HKEY_CLASSES_ROOT, theKey.get(), 
                                  0, NULL, REG_OPTION_NON_VOLATILE,
                                  KEY_ALL_ACCESS, NULL, &hKey, NULL);
    if (lResult != ERROR_SUCCESS)
        return FALSE ;

    // Set the Value.
    if (theValue != NULL)
    {
       lResult = RegSetValueEx(hKey, NULL, 0, REG_SZ, (BYTE *)theValue, 
                      strlen(theValue)+1);
       if (lResult != ERROR_SUCCESS)
           retValue = FALSE;
    }

    RegCloseKey(hKey);
    return TRUE;
}

// Delete a key and all of its descendents.

LONG recursiveDeleteKey(HKEY hKeyParent,           // Parent of key to delete
                        const char* lpszKeyChild)  // Key to delete
{
    // Open the child.
    HKEY hKeyChild ;
    LONG lRes = RegOpenKeyEx(hKeyParent, lpszKeyChild, 0,
                             KEY_ALL_ACCESS, &hKeyChild) ;
    if (lRes != ERROR_SUCCESS)
    {
        return lRes ;
    }

    // Enumerate all of the decendents of this child.
    FILETIME time ;
    char szBuffer[MAX_SIZE] ;
    DWORD dwSize = MAX_SIZE ;
    while (RegEnumKeyEx(hKeyChild, 0, szBuffer, &dwSize, NULL,
                        NULL, NULL, &time) == S_OK)
    {
        // Delete the decendents of this child.
        lRes = recursiveDeleteKey(hKeyChild, szBuffer) ;
        if (lRes != ERROR_SUCCESS)
        {
            // Cleanup before exiting.
            RegCloseKey(hKeyChild) ;
            return lRes;
        }
        dwSize = MAX_SIZE;
    }

    // Close the child.
    RegCloseKey(hKeyChild) ;

    // Delete this child.
    return RegDeleteKey(hKeyParent, lpszKeyChild) ;
}

void RegisterProxy()
{
    HINSTANCE h = NULL;
    ProxyServer *RegisterFunc = NULL;

    char szModule[MAX_SIZE];
    char *pTemp = NULL;

    HMODULE hModule = GetModuleHandle(NULL);
    DWORD dwResult  = ::GetModuleFileName(hModule, szModule,
                                          sizeof(szModule)/sizeof(char));
    if (dwResult == 0)
        return;

    pTemp = strrchr(szModule, '\\');
    if (pTemp == NULL)
        return;

    *pTemp = '\0';
    nsAutoCString proxyPath(szModule);

    proxyPath += "\\";
    proxyPath += MAPI_PROXY_DLL_NAME;

    h = LoadLibrary(proxyPath.get());
    if (h == NULL)
        return;

    RegisterFunc = (ProxyServer *) GetProcAddress(h, "DllRegisterServer");
    if (RegisterFunc)
        RegisterFunc();

    FreeLibrary(h);
}

void UnRegisterProxy()
{
    HINSTANCE h = NULL;
    ProxyServer *UnRegisterFunc = NULL;

    char szModule[MAX_SIZE];
    char *pTemp = NULL;

    HMODULE hModule = GetModuleHandle(NULL);
    DWORD dwResult  = ::GetModuleFileName(hModule, szModule,
                                          sizeof(szModule)/sizeof(char));
    if (dwResult == 0)
        return;

    pTemp = strrchr(szModule, '\\');
    if (pTemp == NULL)
        return;

    *pTemp = '\0';
    nsAutoCString proxyPath(szModule);

    proxyPath += "\\";
    proxyPath += MAPI_PROXY_DLL_NAME;

    h = LoadLibrary(proxyPath.get());
    if (h == NULL)
        return;

    UnRegisterFunc = (ProxyServer *) GetProcAddress(h, "DllUnregisterServer");
    if (UnRegisterFunc)
        UnRegisterFunc();

    FreeLibrary(h);
}

// Register the component in the registry.

HRESULT RegisterServer(const CLSID& clsid,         // Class ID
                       const char* szFriendlyName, // Friendly Name
                       const char* szVerIndProgID, // Programmatic
                       const char* szProgID)       //   IDs
{
    HMODULE hModule = GetModuleHandle(NULL);
    char szModuleName[MAX_SIZE];
    char szCLSID[CLSID_STRING_SIZE];

    nsAutoCString independentProgId(szVerIndProgID);
    nsAutoCString progId(szProgID);

    DWORD dwResult = ::GetModuleFileName(hModule, szModuleName,
                              sizeof(szModuleName)/sizeof(char));

    if (dwResult == 0)
        return S_FALSE;

    nsAutoCString moduleName(szModuleName);
    nsAutoCString registryKey("CLSID\\");

    moduleName += MAPI_STARTUP_ARG;

    // Convert the CLSID into a char.

    if (!CLSIDtochar(clsid, szCLSID, sizeof(szCLSID)))
        return S_FALSE;
    registryKey += szCLSID;

    // Add the CLSID to the registry.
    if (!setKeyAndValue(registryKey, NULL, szFriendlyName))
        return S_FALSE;

    if (!setKeyAndValue(registryKey, "LocalServer32", moduleName.get()))
        return S_FALSE;

    // Add the ProgID subkey under the CLSID key.
    if (!setKeyAndValue(registryKey, "ProgID", szProgID))
        return S_FALSE;

    // Add the version-independent ProgID subkey under CLSID key.
    if (!setKeyAndValue(registryKey, "VersionIndependentProgID", szVerIndProgID))
        return S_FALSE;

    // Add the version-independent ProgID subkey under HKEY_CLASSES_ROOT.
    if (!setKeyAndValue(independentProgId, NULL, szFriendlyName))
        return S_FALSE; 
    if (!setKeyAndValue(independentProgId, "CLSID", szCLSID))
        return S_FALSE;
    if (!setKeyAndValue(independentProgId, "CurVer", szProgID))
        return S_FALSE;

    // Add the versioned ProgID subkey under HKEY_CLASSES_ROOT.
    if (!setKeyAndValue(progId, NULL, szFriendlyName))
        return S_FALSE; 
    if (!setKeyAndValue(progId, "CLSID", szCLSID))
        return S_FALSE;

    RegisterProxy();

    return S_OK;
}

LONG UnregisterServer(const CLSID& clsid,         // Class ID
                      const char* szVerIndProgID, // Programmatic
                      const char* szProgID)       //   IDs
{
    LONG lResult = S_OK;

    // Convert the CLSID into a char.

    char szCLSID[CLSID_STRING_SIZE];
    if (!CLSIDtochar(clsid, szCLSID, sizeof(szCLSID)))
        return S_FALSE;

    UnRegisterProxy();

    nsAutoCString registryKey("CLSID\\");
    registryKey += szCLSID;

    lResult = recursiveDeleteKey(HKEY_CLASSES_ROOT, registryKey.get());
    if (lResult == ERROR_SUCCESS || lResult == ERROR_FILE_NOT_FOUND)
        return lResult;

    registryKey += "\\LocalServer32";

    // Delete only the path for this server.

    lResult = recursiveDeleteKey(HKEY_CLASSES_ROOT, registryKey.get());
    if (lResult != ERROR_SUCCESS && lResult != ERROR_FILE_NOT_FOUND)
        return lResult;

    // Delete the version-independent ProgID Key.
    lResult = recursiveDeleteKey(HKEY_CLASSES_ROOT, szVerIndProgID);
    if (lResult != ERROR_SUCCESS && lResult != ERROR_FILE_NOT_FOUND)
        return lResult;

    lResult = recursiveDeleteKey(HKEY_CLASSES_ROOT, szProgID);

    return lResult;
}
