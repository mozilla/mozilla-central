/*
 * libjingle
 * Copyright 2004--2010, Google Inc.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  1. Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#ifndef TALK_SESSION_PHONE_LIBUDEVSYMBOLTABLE_H_
#define TALK_SESSION_PHONE_LIBUDEVSYMBOLTABLE_H_

#include "talk/base/latebindingsymboltable.h"

namespace cricket {

// The libudev symbols we need, as an X-Macro list.
// This list must contain precisely every libudev function that is used in
// devicemanager.cc.
#define LIBUDEV_SYMBOLS_LIST \
  X(udev_device_unref) \
  X(udev_monitor_enable_receiving) \
  X(udev_monitor_filter_add_match_subsystem_devtype) \
  X(udev_monitor_get_fd) \
  X(udev_monitor_new_from_netlink) \
  X(udev_monitor_receive_device) \
  X(udev_monitor_unref) \
  X(udev_new) \
  X(udev_unref)

LATE_BINDING_SYMBOL_TABLE_DECLARE_BEGIN(LibUDevSymbolTable)
#define X(sym) \
    LATE_BINDING_SYMBOL_TABLE_DECLARE_ENTRY(LibUDevSymbolTable, sym)
LIBUDEV_SYMBOLS_LIST
#undef X
LATE_BINDING_SYMBOL_TABLE_DECLARE_END(LibUDevSymbolTable)

}  // namespace cricket

#endif  // TALK_SESSION_PHONE_LIBUDEVSYMBOLTABLE_H_
