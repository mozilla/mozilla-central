/*
 * libjingle
 * Copyright 2004 Google Inc.
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

#include "talk/session/phone/devicemanager.h"

#include "talk/base/fileutils.h"
#include "talk/base/logging.h"
#include "talk/base/pathutils.h"
#include "talk/base/stringutils.h"
#include "talk/base/thread.h"
#include "talk/session/phone/filevideocapturer.h"
#include "talk/session/phone/mediacommon.h"

#ifdef HAVE_LMI
#include "talk/session/phone/lmivideocapturer.h"
#elif HAVE_WEBRTC_VIDEO
#include "talk/session/phone/webrtcvideocapturer.h"
#endif

namespace cricket {
// Initialize to empty string.
const char DeviceManagerInterface::kDefaultDeviceName[] = "";

DeviceManager::DeviceManager()
    : initialized_(false) {
}

DeviceManager::~DeviceManager() {
  if (initialized()) {
    Terminate();
  }
}

bool DeviceManager::Init() {
  if (!initialized()) {
    if (!watcher()->Start()) {
      return false;
    }
    set_initialized(true);
  }
  return true;
}

void DeviceManager::Terminate() {
  if (initialized()) {
    watcher()->Stop();
    set_initialized(false);
  }
}

int DeviceManager::GetCapabilities() {
  std::vector<Device> devices;
  int caps = VIDEO_RECV;
  if (GetAudioInputDevices(&devices) && !devices.empty()) {
    caps |= AUDIO_SEND;
  }
  if (GetAudioOutputDevices(&devices) && !devices.empty()) {
    caps |= AUDIO_RECV;
  }
  if (GetVideoCaptureDevices(&devices) && !devices.empty()) {
    caps |= VIDEO_SEND;
  }
  return caps;
}

bool DeviceManager::GetAudioInputDevices(std::vector<Device>* devices) {
  return GetAudioDevices(true, devices);
}

bool DeviceManager::GetAudioOutputDevices(std::vector<Device>* devices) {
  return GetAudioDevices(false, devices);
}

bool DeviceManager::GetAudioInputDevice(const std::string& name, Device* out) {
  return GetAudioDevice(true, name, out);
}

bool DeviceManager::GetAudioOutputDevice(const std::string& name, Device* out) {
  return GetAudioDevice(false, name, out);
}

bool DeviceManager::GetVideoCaptureDevices(std::vector<Device>* devices) {
  devices->clear();
#if defined(ANDROID) || defined(IOS)
  // TODO: Incomplete. Use ANDROID implementation for IOS
  // to quiet compiler.
  // On Android, we treat the camera(s) as a single device. Even if there are
  // multiple cameras, that's abstracted away at a higher level.
  Device dev("camera", "1");    // name and ID
  devices->push_back(dev);
#else
  return false;
#endif
}

bool DeviceManager::GetVideoCaptureDevice(const std::string& name,
                                          Device* out) {
  // If the name is empty, return the default device.
  if (name.empty() || name == kDefaultDeviceName) {
    LOG(LS_INFO) << "Creating default VideoCapturer";
    return GetDefaultVideoCaptureDevice(out);
  }

  std::vector<Device> devices;
  if (!GetVideoCaptureDevices(&devices)) {
    return false;
  }

  for (std::vector<Device>::const_iterator it = devices.begin();
      it != devices.end(); ++it) {
    if (name == it->name) {
      LOG(LS_INFO) << "Creating VideoCapturer for " << name;
      *out = *it;
      return true;
    }
  }

  // If the name is a valid path to a file, then we'll create a simulated device
  // with the filename. The LmiMediaEngine will know to use a FileVideoCapturer
  // for these devices.
  if (talk_base::Filesystem::IsFile(name)) {
    LOG(LS_INFO) << "Creating FileVideoCapturer";
    *out = FileVideoCapturer::CreateFileVideoCapturerDevice(name);
    return true;
  }

  return false;
}

VideoCapturer* DeviceManager::CreateVideoCapturer(const Device& device) const {
#if defined(IOS) || defined(ANDROID)
  LOG_F(LS_ERROR) << " should never be called!";
  return NULL;
#endif
  // TODO: throw out the creation of a file video capturer once the
  // refactoring is completed.
  if (FileVideoCapturer::IsFileVideoCapturerDevice(device)) {
    FileVideoCapturer* capturer = new FileVideoCapturer;
    if (!capturer->Init(device)) {
      delete capturer;
      return NULL;
    }
    capturer->set_repeat(talk_base::kForever);
    return capturer;
  }
#ifdef HAVE_LMI
  CricketLmiVideoCapturer* capturer = new CricketLmiVideoCapturer;
#elif HAVE_WEBRTC_VIDEO
  WebRtcVideoCapturer* capturer = new WebRtcVideoCapturer;
#else
  return NULL;
#endif
#if defined(HAVE_LMI) || defined(HAVE_WEBRTC_VIDEO)
  if (!capturer->Init(device)) {
    delete capturer;
    return NULL;
  }
  return capturer;
#endif
}

bool DeviceManager::GetAudioDevices(bool input,
                                    std::vector<Device>* devs) {
  devs->clear();
#ifdef ANDROID
  // Under Android, we don't access the device file directly.
  // Arbitrary use 0 for the mic and 1 for the output.
  // These ids are used in MediaEngine::SetSoundDevices(in, out);
  // The strings are for human consumption.
  if (input) {
      devs->push_back(Device("audiorecord", 0));
  } else {
      devs->push_back(Device("audiotrack", 1));
  }
  return true;
#else
  return false;
#endif
}

bool DeviceManager::GetAudioDevice(bool is_input, const std::string& name,
                                   Device* out) {
  // If the name is empty, return the default device id.
  if (name.empty() || name == kDefaultDeviceName) {
    *out = Device(name, -1);
    return true;
  }

  std::vector<Device> devices;
  bool ret = is_input ? GetAudioInputDevices(&devices) :
                        GetAudioOutputDevices(&devices);
  if (ret) {
    ret = false;
    for (size_t i = 0; i < devices.size(); ++i) {
      if (devices[i].name == name) {
        *out = devices[i];
        ret = true;
        break;
      }
    }
  }
  return ret;
}

bool DeviceManager::GetDefaultVideoCaptureDevice(Device* device) {
  bool ret = false;
  // We just return the first device.
  std::vector<Device> devices;
  ret = (GetVideoCaptureDevices(&devices) && !devices.empty());
  if (ret) {
    *device = devices[0];
  }
  return ret;
}

bool DeviceManager::ShouldDeviceBeIgnored(const std::string& device_name,
    const char* const exclusion_list[]) {
  // If exclusion_list is empty return directly.
  if (!exclusion_list)
    return false;

  int i = 0;
  while (exclusion_list[i]) {
    if (strnicmp(device_name.c_str(), exclusion_list[i],
        strlen(exclusion_list[i])) == 0) {
      LOG(LS_INFO) << "Ignoring device " << device_name;
      return true;
    }
    ++i;
  }
  return false;
}

bool DeviceManager::FilterDevices(std::vector<Device>* devices,
    const char* const exclusion_list[]) {
  if (!devices) {
    return false;
  }

  for (std::vector<Device>::iterator it = devices->begin();
       it != devices->end(); ) {
    if (ShouldDeviceBeIgnored(it->name, exclusion_list)) {
      it = devices->erase(it);
    } else {
      ++it;
    }
  }
  return true;
}

}  // namespace cricket
