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

#include "talk/app/webrtc/test/staticframesource.h"

#include <memory.h>

bool StaticFrameSource::GetFrame(uint8* frame, size_t* size_in_bytes) {
  const int y_plane_size = width_ * height_;
  const int u_plane_size = width_ * height_ / 4;
  const int v_plane_size = width_ * height_ / 4;
  const int plane_size = y_plane_size + u_plane_size + v_plane_size;

  const int some_random_y_value = 128;
  const int some_random_u_value = 64;
  const int some_random_v_value = 32;

  // Set Y plane.
  memset(frame, some_random_y_value, y_plane_size);
  // Set U plane.
  int write_position = y_plane_size;
  memset(&frame[write_position], some_random_u_value, u_plane_size);
  // Set V plane.
  write_position += u_plane_size;
  memset(&frame[write_position], some_random_v_value, v_plane_size);

  *size_in_bytes = plane_size;
  return true;
}
