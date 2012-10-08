/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/ModuleUtils.h"
#include "calDateTime.h"
#include "calDuration.h"
#include "calPeriod.h"
#include "calICSService.h"
#include "calRecurrenceRule.h"

#include "calBaseCID.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(calDateTime)
NS_DEFINE_NAMED_CID(CAL_DATETIME_CID);

NS_GENERIC_FACTORY_CONSTRUCTOR(calDuration)
NS_DEFINE_NAMED_CID(CAL_DURATION_CID);

NS_GENERIC_FACTORY_CONSTRUCTOR(calICSService)
NS_DEFINE_NAMED_CID(CAL_ICSSERVICE_CID);

NS_GENERIC_FACTORY_CONSTRUCTOR(calPeriod)
NS_DEFINE_NAMED_CID(CAL_PERIOD_CID);

NS_GENERIC_FACTORY_CONSTRUCTOR(calRecurrenceRule)
NS_DEFINE_NAMED_CID(CAL_RECURRENCERULE_CID);


const mozilla::Module::CIDEntry kCalBaseCIDs[] = {
    { &kCAL_DATETIME_CID, false, NULL, calDateTimeConstructor },
    { &kCAL_DURATION_CID, false, NULL, calDurationConstructor },
    { &kCAL_ICSSERVICE_CID, true, NULL, calICSServiceConstructor },
    { &kCAL_PERIOD_CID, false, NULL, calPeriodConstructor },
    { &kCAL_RECURRENCERULE_CID, false, NULL, calRecurrenceRuleConstructor },
    { NULL }
};

const mozilla::Module::ContractIDEntry kCalBaseContracts[] = {
    { CAL_DATETIME_CONTRACTID, &kCAL_DATETIME_CID },
    { CAL_DURATION_CONTRACTID, &kCAL_DURATION_CID },
    { CAL_ICSSERVICE_CONTRACTID, &kCAL_ICSSERVICE_CID },
    { CAL_PERIOD_CONTRACTID, &kCAL_PERIOD_CID },
    { CAL_RECURRENCERULE_CONTRACTID, &kCAL_RECURRENCERULE_CID },
    { NULL }
};

static nsresult
nsInitBaseModule()
{
    // This needs to be done once in the application, we want to make
    // sure that new parameters are not thrown away
    ical_set_unknown_token_handling_setting(ICAL_ASSUME_IANA_TOKEN);
    return NS_OK;
}

static const mozilla::Module kCalBaseModule = {
    mozilla::Module::kVersion,
    kCalBaseCIDs,
    kCalBaseContracts,
    NULL,
    NULL,
    nsInitBaseModule
};

NSMODULE_DEFN(calBaseModule) = &kCalBaseModule;
