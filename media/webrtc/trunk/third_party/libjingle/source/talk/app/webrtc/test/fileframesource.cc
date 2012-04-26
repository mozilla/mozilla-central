/*
 * libjingle
 * Copyright 2011, Google Inc.
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

#include "talk/app/webrtc/test/fileframesource.h"

#include "talk/base/stream.h"

FileFrameSource::FileFrameSource()
    : i420_file_(new talk_base::FileStream()) {}

FileFrameSource::~FileFrameSource() {}

FileFrameSource* FileFrameSource::Create(const std::string& file_name) {
  FileFrameSource* file_frame_source = new FileFrameSource();
  if (!file_frame_source->Init(file_name)) {
    delete file_frame_source;
    return NULL;
  }
  return file_frame_source;
}

bool FileFrameSource::GetFrame(uint8* frame, size_t* size_in_bytes) {
  int error = 0;
  *size_in_bytes = 0;
  talk_base::StreamResult state = i420_file_->Read(
      frame,
      GetI420FrameLengthInBytes(),
      size_in_bytes,
      &error);
  if (state == talk_base::SR_EOS) {
    // Loop file if end is reached.
    if (!i420_file_->SetPosition(0)) {
      *size_in_bytes = 0;
      return false;
    }
    state = i420_file_->Read(frame, GetI420FrameLengthInBytes(), size_in_bytes,
                             &error);
  }
  if (state != talk_base::SR_SUCCESS) {
    *size_in_bytes = 0;
    return false;
  }
  ASSERT(*size_in_bytes == GetI420FrameLengthInBytes());
  return true;
}

bool FileFrameSource::Init(const std::string& file_name) {
  int error = 0;
  const bool success = i420_file_->Open(file_name, "rb", &error);
  if (!success) {
    LOG(LS_ERROR) << "Opening file " << file_name <<
        "failed with error code: " << error << ".";
  }
  return success;
}

size_t FileFrameSource::GetI420FrameLengthInBytes() {
  return webrtc_testing::GetI420FrameLengthInBytes(width_, height_);
}
