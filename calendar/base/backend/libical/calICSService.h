/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#if !defined(INCLUDED_CALICSSERVICE_H)
#define INCLUDED_CALICSSERVICE_H

#include "nsCOMPtr.h"
#include "calIICSService.h"
#include "calITimezoneProvider.h"
#include "nsInterfaceHashtable.h"
#include "nsProxyRelease.h"
#include "nsThreadUtils.h"
#include "calUtils.h"

extern "C" {
#include "ical.h"
}

class calICSService : public calIICSService,
                      public nsIClassInfo,
                      public cal::XpcomBase
{
protected:
    class ParserWorker : public nsRunnable {
    public:
      ParserWorker(nsIThread *mainThread,
                   nsIThread *workerThread,
                   const nsACString &icsString,
                   calITimezoneProvider *tzProvider,
                   calIIcsComponentParsingListener *listener) :
        mString(icsString), mProvider(tzProvider),
        mMainThread(mainThread), mWorkerThread(workerThread)
      {
        mListener = new nsMainThreadPtrHolder<calIIcsComponentParsingListener>(listener);
      }

      NS_DECL_NSIRUNNABLE

    protected:
      nsCString mString;
      nsCOMPtr<calITimezoneProvider> mProvider;
      nsMainThreadPtrHandle<calIIcsComponentParsingListener> mListener;
      nsCOMPtr<nsIThread> mMainThread;
      nsCOMPtr<nsIThread> mWorkerThread;

      class ParserWorkerCompleter : public nsRunnable {
      public:
        ParserWorkerCompleter(nsIThread *workerThread,
                              nsresult status,
                              calIIcalComponent *component,
                              const nsMainThreadPtrHandle<calIIcsComponentParsingListener> &listener) :
          mListener(listener), mComp(component),
          mStatus(status), mWorkerThread(workerThread)
        {
        }

        NS_DECL_NSIRUNNABLE
      protected:
        nsCOMPtr<nsIThread> mWorkerThread;
        nsMainThreadPtrHandle<calIIcsComponentParsingListener> mListener;
        nsCOMPtr<calIIcalComponent> mComp;
        nsresult mStatus;
      };
    };
public:
    calICSService();

    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSICLASSINFO
    NS_DECL_CALIICSSERVICE
};

class calIcalComponent;

class calIcalProperty : public calIIcalProperty,
                        public cal::XpcomBase
{
    friend class calIcalComponent;
public:
    calIcalProperty(icalproperty * prop, calIIcalComponent * parent)
        : mProperty(prop), mParent(parent) {}

    NS_DECL_ISUPPORTS
    NS_DECL_CALIICALPROPERTY

protected:
    virtual ~calIcalProperty();

    static nsresult getDatetime_(calIcalComponent *parent,
                                 icalproperty *prop,
                                 calIDateTime **dtp);
    static nsresult setDatetime_(calIcalComponent *parent,
                                 icalproperty *prop,
                                 calIDateTime *dt);

    icalproperty *              mProperty;
    nsCOMPtr<calIIcalComponent> mParent;
};

class calIcalComponent : public calIIcalComponent,
                         public nsIClassInfo,
                         public cal::XpcomBase
{
    friend class calIcalProperty;
public:
    calIcalComponent(icalcomponent *ical, calIIcalComponent *parent,
                     calITimezoneProvider *tzProvider = nullptr)
        : mComponent(ical), mTimezone(nullptr), mTzProvider(tzProvider), mParent(parent)
    {
    }

    // VTIMEZONE ctor
    calIcalComponent(icaltimezone * icaltz, icalcomponent * ical) : mComponent(ical), mTimezone(icaltz) {
    }

    NS_DECL_THREADSAFE_ISUPPORTS
    NS_DECL_NSICLASSINFO
    NS_DECL_CALIICALCOMPONENT

protected:
    virtual ~calIcalComponent();

    calITimezoneProvider * getTzProvider() const {
        // walk up the parents to find a tz provider:
        calIcalComponent const * that = this;
        while (that) {
            calITimezoneProvider * const ret = that->mTzProvider;
            if (ret) {
                return ret;
            }
            calIIcalComponent * const p = that->mParent;
            that = static_cast<calIcalComponent const *>(p);
        }
        return nullptr;
    }

    calIcalComponent * getParentVCalendarOrThis() {
        // walk up the parents to find a VCALENDAR:
        calIcalComponent * that = this;
        while (that && icalcomponent_isa(that->mComponent) != ICAL_VCALENDAR_COMPONENT) {
            calIIcalComponent * const p = that->mParent;
            that = static_cast<calIcalComponent *>(p);
        }
        if (!that)
            that = this;
        return that;
    }

    nsresult GetDateTimeAttribute(icalproperty_kind kind, calIDateTime ** dtp);
    nsresult SetDateTimeAttribute(icalproperty_kind kind, calIDateTime * dt);

    nsresult SetPropertyValue(icalproperty_kind kind, icalvalue *val);
    nsresult SetProperty(icalproperty_kind kind, icalproperty *prop);

    nsresult GetStringProperty(icalproperty_kind kind, nsACString &str);
    nsresult SetStringProperty(icalproperty_kind kind, const nsACString &str);

    nsresult GetIntProperty(icalproperty_kind kind, int32_t *valp);
    nsresult SetIntProperty(icalproperty_kind kind, int32_t i);

    void ClearAllProperties(icalproperty_kind kind);

    nsresult Serialize(char ** icalstr);

    nsInterfaceHashtable<nsCStringHashKey, calITimezone> mReferencedTimezones;
    icalcomponent *                                      mComponent;
    icaltimezone *                                       mTimezone; // set iff VTIMEZONE
    nsCOMPtr<calITimezoneProvider> const                 mTzProvider;
    nsCOMPtr<calIIcalComponent>                          mParent;
};

inline calIcalProperty * toIcalProperty(calIIcalProperty * p) {
    return static_cast<calIcalProperty *>(p);
}
inline calIcalComponent * toIcalComponent(calIIcalComponent * p) {
    return static_cast<calIcalComponent *>(p);
}

#endif // INCLUDED_CALICSSERVICE_H
