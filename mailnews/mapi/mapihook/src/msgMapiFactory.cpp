/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#undef UNICODE
#undef _UNICODE

#include "msgMapiFactory.h"
#include "msgMapiImp.h"
#include "msgMapi.h"

CMapiFactory ::CMapiFactory()
: m_cRef(1)
{
}

CMapiFactory::~CMapiFactory()
{
}

STDMETHODIMP CMapiFactory::QueryInterface(const IID& aIid, void** aPpv)
{    
    if ((aIid == IID_IUnknown) || (aIid == IID_IClassFactory))
    {
        *aPpv = static_cast<IClassFactory*>(this); 
    }
    else
    {
        *aPpv = nullptr;
        return E_NOINTERFACE;
    }
    reinterpret_cast<IUnknown*>(*aPpv)->AddRef();
    return S_OK;
}

STDMETHODIMP_(ULONG) CMapiFactory::AddRef()
{
    return ++m_cRef;
}

STDMETHODIMP_(ULONG) CMapiFactory::Release() 
{
    int32_t temp = --m_cRef;
    if (m_cRef == 0)
    {
        delete this;
        return 0;
    }

    return temp;
}

STDMETHODIMP CMapiFactory::CreateInstance(IUnknown* aUnknownOuter,
                                           const IID& aIid,
                                           void** aPpv) 
{
    // Cannot aggregate.

    if (aUnknownOuter != nullptr)
    {
        return CLASS_E_NOAGGREGATION ;
    }

    // Create component.

    CMapiImp* pImp = new CMapiImp();
    if (pImp == nullptr)
    {
        return E_OUTOFMEMORY ;
    }

    // Get the requested interface.
    HRESULT hr = pImp->QueryInterface(aIid, aPpv);

    // Release the IUnknown pointer.
    // (If QueryInterface failed, component will delete itself.)

    pImp->Release();
    return hr;
}

STDMETHODIMP CMapiFactory::LockServer(BOOL aLock) 
{
    return S_OK ;
}
