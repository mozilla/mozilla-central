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
 * This class is for the Choice object. Note that this class may be
 * used by a client.
 * <P>See CCITT X.209.
 *
 * <pre>
 * ENCODING RULE:
 *   Encoding is the encoding of the specific type used.
 * </pre>
 *
 * @version 1.0
 */
public class BERChoice extends BERElement {
    /**
     * Internal variables
     */
    private BERElement m_value = null;

    /**
     * Constructs a choice element.
     * @param value any BERElement value
     */
    public BERChoice(BERElement value) {
        m_value = value;
    }

    /**
     * Constructs a choice element from an input stream.
     * Note that with the current decoding architecture choice types
     * will not be decoded as choices but rather as the types
     * chosen. The following method will never be called.
     * @param stream input stream
     * @param bytes_read array of 1 int; value incremented by
     * number of bytes read from stream
     * @exception IOException failed to construct
     */
    public BERChoice(BERTagDecoder decoder, InputStream stream,
                     int[] bytes_read) throws IOException {
        m_value = getElement(decoder, stream, bytes_read);
    }

    /**
     * Sends the BER encoding of the chosen type directly to a stream.
     * @param stream output stream
     * @exception IOException failed to write
     */
    public void write(OutputStream stream) throws IOException {
        m_value.write(stream);
    }

    /**
     * Gets the value of the chosen type.
     * @param element type
     */
    public BERElement getValue() {
        return m_value;
    }

    /**
     * Gets the element type.
     * @param element type
     */
    public int getType() {
        return BERElement.CHOICE;
    }

    /**
     * Gets the string representation.
     * @return string representation of tag.
     */
    public String toString() {
        return "CHOICE {" + m_value + "}";
    }
}
