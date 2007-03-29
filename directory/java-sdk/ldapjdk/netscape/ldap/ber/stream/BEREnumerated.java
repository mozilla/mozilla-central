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
package netscape.ldap.ber.stream;

import java.util.*;
import java.io.*;

/**
 * This class is for the Enumerated object.
 *
 * <pre>
 * ENCODING RULE:
 *   Primitive Definite length.
 *   tag = 0x0a
 *   length = (short or long form)
 *   one or more contents octets hold integral value
 *   value in two's complement
 *
 * Example:  (Enumerated - 1)
 *   0A 01 01
 * </pre>
 *
 * @version 1.0
 * seeAlso CCITT X.209
 */
public class BEREnumerated extends BERIntegral {

    /**
     * Constructs an enumerated element with a value.
     * @param value integral value
     */
    public BEREnumerated(int value) {
        super(value);
    }

    /**
     * Constructs an enumerated element with the input stream.
     * @param stream input stream from which to decode
     * @param bytes_read array of 1 int; value incremented by
     * number of bytes read from array
     * @exception IOException failed to construct
     */
    public BEREnumerated(InputStream stream, int[] bytes_read)
        throws IOException {
        super(stream, bytes_read);
    }

    /**
     * Gets the element type.
     * @param element type
     */
    public int getType() {
        return BERElement.ENUMERATED;
    }

    /**
     * Gets the string representation.
     * @return string representation of tag.
     */
    public String toString() {
        return "Enumerated {" + getValue() + "}";
    }
}
