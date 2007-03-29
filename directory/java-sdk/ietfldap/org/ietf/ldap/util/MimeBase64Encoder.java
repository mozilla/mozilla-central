/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1999
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
package org.ietf.ldap.util;


/** Implements a plaintext -> Base64 encoder.
 */
public final class MimeBase64Encoder extends MimeEncoder {

    static final long serialVersionUID = 8781620079813078315L;
    private int buf = 0;                     // a 24-bit quantity
    private int buf_bytes = 0;               // how many octets are set in it
    private byte line[] = new byte[74];      // output buffer
    private int line_length = 0;             // output buffer fill pointer

    static private final byte crlf[] = "\r\n".getBytes();

    static private final char map[] = {
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',     // 0-7
      'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',     // 8-15
      'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',     // 16-23
      'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f',     // 24-31
      'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',     // 32-39
      'o', 'p', 'q', 'r', 's', 't', 'u', 'v',     // 40-47
      'w', 'x', 'y', 'z', '0', '1', '2', '3',     // 48-55
      '4', '5', '6', '7', '8', '9', '+', '/',     // 56-63
    };

    private final void encode_token() {
        int i = line_length;
        line[i]   = (byte)map[0x3F & (buf >> 18)];   // sextet 1 (octet 1)
        line[i+1] = (byte)map[0x3F & (buf >> 12)];   // sextet 2 (octet 1 and 2)
        line[i+2] = (byte)map[0x3F & (buf >> 6)];    // sextet 3 (octet 2 and 3)
        line[i+3] = (byte)map[0x3F & buf];           // sextet 4 (octet 3)
        line_length += 4;
        buf = 0;
        buf_bytes = 0;
    }

    private final void encode_partial_token() {
        int i = line_length;
        line[i]   = (byte)map[0x3F & (buf >> 18)];   // sextet 1 (octet 1)
        line[i+1] = (byte)map[0x3F & (buf >> 12)];   // sextet 2 (octet 1 and 2)

        if (buf_bytes == 1)
            line[i+2] = (byte)'=';
        else
            line[i+2] = (byte)map[0x3F & (buf >> 6)];  // sextet 3 (octet 2 and 3)

        if (buf_bytes <= 2)
            line[i+3] = (byte)'=';
        else
            line[i+3] = (byte)map[0x3F & buf];         // sextet 4 (octet 3)
        line_length += 4;
        buf = 0;
        buf_bytes = 0;
    }

    private final void flush_line(ByteBuf out) {
        out.append(line, 0, line_length);
        line_length = 0;
    }

    /** Given a sequence of input bytes, produces a sequence of output bytes
        using the base64 encoding.  If there are bytes in `out' already, the
        new bytes are appended, so the caller should do `out.setLength(0)'
        first if that's desired.
     */
    public final void translate(ByteBuf in, ByteBuf out) {

        byte inb[] = in.toBytes();
        int in_length = in.length();

        for (int i = 0; i < in_length; i++) {
            if (buf_bytes == 0)
                buf = (buf & 0x00FFFF) | (inb[i] << 16);
            else if (buf_bytes == 1)
                buf = (buf & 0xFF00FF) | ((inb[i] << 8) & 0x00FFFF);
            else
                buf = (buf & 0xFFFF00) | (inb[i] & 0x0000FF);

            if ((++buf_bytes) == 3) {
                encode_token();
                if (line_length >= 72) {
                    flush_line(out);
                }
            }

            if (i == (in_length-1)) {
                if ((buf_bytes > 0) && (buf_bytes < 3))
                    encode_partial_token();
                if (line_length > 0)
                    flush_line(out);
            }
        }

        for (int i=0; i<line.length; i++)
            line[i] = 0;
    }

    /** Tell the base64 encoder that no more input data will be forthcoming.
        This may result in output, as a result of flushing the internal buffer.
        This object must not be used again after calling eof().  If there are
        bytes in `out' already, the new bytes are appended, so the caller should
        do `out.setLength(0)' first if that's desired.
     */
    public final void eof(ByteBuf out) {
        if (buf_bytes != 0)
            encode_partial_token();
        flush_line(out);
        for (int i=0; i<line.length; i++)
            line[i] = 0;
    }
}
