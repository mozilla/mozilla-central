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
import java.util.StringTokenizer;
import java.io.*;

/**
 * This class is for the Object ID object.
 * <P>See CCITT X.209.
 *
 * @version 1.0
 */
public class BERObjectId extends BERElement {
    /**
     * Values of each component of the OID
     */
    private int[] m_value = null;

    /**
     * Constructs an object ID element from an array of values.
     * @param value object ID value as array of components
     */
    public BERObjectId(int[] value) {
        m_value = new int[value.length];
        System.arraycopy(value,0,m_value,0,value.length);
    }

    /**
     * Constructs an object id element from a string.
     * @param value object id value in format "2.100.3"
     */
    public BERObjectId(String value) {
        StringTokenizer tokenizer = new StringTokenizer(value, ".");
        m_value = new int[tokenizer.countTokens()];
        for (int i=0; i<m_value.length; i++)
            m_value[i] = Integer.parseInt(tokenizer.nextToken());
    }

    /**
     * Constructs an object id element from an input stream.
     * @param stream source
     * @param bytes_read array of 1 int; value incremented by
     * number of bytes read from stream
     * @exception IOException failed to construct
     */
    public BERObjectId(InputStream stream, int[] bytes_read) throws IOException {
        int contents_length = super.readLengthOctets(stream, bytes_read);

        bytes_read[0] += contents_length;
        int[] contents_read = new int[1];

        Vector oid = new Vector(10);
        contents_read[0] = 0;
        int sub_id = readSubIdentifier(stream, contents_read);

        contents_length -= contents_read[0];
        if (sub_id < 40)
            oid.addElement(new Integer(0));
        else if (sub_id < 80)
            oid.addElement(new Integer(1));
        else
            oid.addElement(new Integer(2));
        oid.addElement(new Integer(
            sub_id - (((Integer)oid.elementAt(
                oid.size()-1)).intValue() * 40)));

        while (contents_length > 0) {
            contents_read[0] = 0;
            sub_id = readSubIdentifier(stream, contents_read);

            contents_length -= contents_read[0];
            oid.addElement(new Integer(sub_id));
        }
        m_value = new int[oid.size()];
        for (int i = 0; i<oid.size(); i++)
            m_value[i] = ((Integer)oid.elementAt(i)).intValue();
    }

    /**
     * Sends the BER encoding directly to a stream. Note that OID must
     * have >= 2 identifier components (values).
     * @param stream output stream
     * @exception IOException failed to write
     */
    public void write(OutputStream stream) throws IOException {
        stream.write(BERElement.OBJECTID);

        ByteArrayOutputStream contents_stream = new ByteArrayOutputStream();

        /* first subidentifier packs two component values */
        writeSubIdentifier(contents_stream,m_value[0]*40 + m_value[1]);

        for (int i = 2; i < m_value.length; i++)  {
            writeSubIdentifier(contents_stream,m_value[i]);
        }
        byte[] contents_buffer = contents_stream.toByteArray();
        sendDefiniteLength(stream, contents_buffer.length);
        stream.write(contents_buffer);
    }

    /**
     * Reads a sub identifier from stream.
     * @param stream input stream
     * @param bytes_read array of 1 int; value incremented by
     * number of bytes read from stream
     */
    private int readSubIdentifier(InputStream stream, int[] bytes_read)
        throws IOException {
        int octet;
        int sub_id = 0;
        do {
            octet = stream.read();
            bytes_read[0]++;
            sub_id = (sub_id << 7) | (octet & 0x7F);
        } while ((octet & 0x80) > 0);
        return sub_id;
    }

    /**
     * Sends the BER encoding of a sub identifier directly to stream.
     * @param stream output stream
     * @param value sub-identifier value
     */
    private void writeSubIdentifier(OutputStream stream, int value)
        throws IOException {
        ByteArrayOutputStream sub_id_stream = new ByteArrayOutputStream();
        /* gather octets in reverse order */
        while (value > 0) {
            sub_id_stream.write(value & 0x7F);
            value = value >> 7;
        }
        byte[] sub_id_buffer = sub_id_stream.toByteArray();
        for (int i=sub_id_buffer.length-1; i>0; i--) {
            /* all but last octet have bit 8 = 1 */
            stream.write(sub_id_buffer[i] | 0x80);
        }
        stream.write(sub_id_buffer[0]);    /* last octet has bit 8 = 0 */
    }

    /**
     * Gets the element value.
     * @return element value.
     */
    public int[] getValue() {
        return m_value;
    }

    /**
     * Gets the element type.
     * @return element type.
     */
    public int getType() {
        return BERElement.OBJECTID;
    }

    /**
     * Gets the string representation.
     * @return string representation of element.
     */
    public String toString() {
        if (m_value == null)
            return "ObjectIdentifier (null)";
        String oid = "";
        for (int i = 0; i < m_value.length; i++) {
            if (i != 0)
                oid = oid + " ";
            oid = oid + m_value[i];
        }
        return "ObjectIdentifier {" + oid + "}";
    }
}
