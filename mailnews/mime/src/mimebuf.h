/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Original Code has been modified by IBM Corporation. Modifications made by IBM
 * described herein are Copyright (c) International Business Machines Corporation, 2000.
 * Modifications to Mozilla code or documentation identified per MPL Section 3.3
 *
 * Date             Modified by     Description of modification
 * 04/20/2000       IBM Corp.      OS/2 VisualAge build.
 */

#ifndef _MIMEBUF_H_
#define _MIMEBUF_H_

extern "C" int mime_GrowBuffer (uint32_t desired_size,
               uint32_t element_size, uint32_t quantum,
               char **buffer, int32_t *size);

extern "C" int mime_LineBuffer (const char *net_buffer, int32_t net_buffer_size,
               char **bufferP, int32_t *buffer_sizeP,
               int32_t *buffer_fpP,
               bool convert_newlines_p,
               int32_t (* per_line_fn) (char *line, int32_t
                         line_length, void *closure),
               void *closure);

extern "C" int mime_ReBuffer (const char *net_buffer, int32_t net_buffer_size,
             uint32_t desired_buffer_size,
             char **bufferP, uint32_t *buffer_sizeP,
             uint32_t *buffer_fpP,
             int32_t (*per_buffer_fn) (char *buffer,
                         uint32_t buffer_size,
                         void *closure),
             void *closure);


#endif /* _MIMEBUF_H_ */
