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
package org.ietf.ldap.ber.stream;

import java.util.*;
import java.io.*;

/**
 * This class is for the NULL type.
 * <P>See CCITT X.209.
 *
 * <pre>
 * ENCODING RULE:
 *   tag = 0x05
 *   length value is zero (short or long form).
 *   no contents
 *
 * Example 1:  (short form)
 *   05 00
 * Example 2:  (long form)
 *   05 81 00
 * </pre>
 *
 * @version 1.0
 */
public class BERNull extends BERElement {
    /**
     * Constructs a NULL element.
     */
    public BERNull() {
    }

    /**
     * Constructs a null element from an input stream.
     * @param stream input stream from socket
     * @param bytes_read array of 1 int; value incremented by
     * number of bytes read from stream
     * @exception IOException failed to construct
     */
    public BERNull(InputStream stream, int[] bytes_read) throws IOException {
        /* The result should be zero of course */
        readLengthOctets(stream,bytes_read);
    }

    /**
     * Sends the BER encoding directly to stream.
     * @param stream output stream
     * @exception IOException failed to write
     */
    public void write(OutputStream stream) throws IOException {
        byte[] buffer = new byte[2];
        buffer[0] = (byte)BERElement.NULL;  /* NULL tag */
        buffer[1] = 0x00;  /* length */
        stream.write(buffer);
    }

    /**
     * Gets the element type.
     * @return element type.
     */
    public int getType() {
        return BERElement.NULL;
    }

    /**
     * Gets the string representation.
     * @return string representation of tag.
     */
    public String toString() {
        return "Null {}";
    }
}
