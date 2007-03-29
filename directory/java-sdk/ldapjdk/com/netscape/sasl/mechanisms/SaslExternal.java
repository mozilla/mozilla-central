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

package com.netscape.sasl.mechanisms;

import java.io.*;
import com.netscape.sasl.*;

/**
 * This class provides the implementation of the EXTERNAL mechanism driver.
 * This mechanism is passed in the SASL External bind request to retrieve the
 * current result code from the server.
 */
public class SaslExternal implements SaslClient {

    /**
     * Default constructor
     */
    public SaslExternal() {
    }

    /**
     * Retrieves the initial response.
     *
     * @return The possibly null byte array containing the initial response.
     * It is null if the mechanism does not have an initial response.
     * @exception SaslException If an error occurred while creating
     * the initial response.
     */
    public byte[] createInitialResponse() throws SaslException {
        return null;
    }

    /**
     * Evaluates the challenge data and generates a response.
     *
     * @param challenge The non-null challenge sent from the server.
     *
     * @return The possibly null reponse to send to the server.
     * It is null if the challenge accompanied a "SUCCESS" status
     * and the challenge only contains data for the client to
     * update its state and no response needs to be sent to the server.
     * @exception SaslException If an error occurred while processing
     * the challenge or generating a response.
     */
    public byte[] evaluateChallenge(byte[] challenge) 
        throws SaslException {
        return null;
    }

    /**
     * Returns the name of mechanism driver.
     * @return The mechanism name.
     */
    public String getMechanismName() {
        return MECHANISM_NAME;
    }

    /**
     * The method may be called at any time to determine if the authentication
     * process is finished.
     * @return <CODE>true</CODE> if authentication is complete. For this class,
     * always returns <CODE>true</CODE>.
     */
    public boolean isComplete() {
        return true;
    }

    /**
     * Retrieves an input stream for the session. It may return
	 * the same stream that is passed in, if no processing is to be
	 * done by the client object.
     *
     * This method can only be called if isComplete() returns true.
     * @param is The original input stream for reading from the server.
     * @return An input stream for reading from the server, which
	 * may include processing the original stream. For this class, the
     * input parameter is always returned.
     * @exception IOException If the authentication exchange has not completed
     * or an error occurred while getting the stream.
     */
    public InputStream getInputStream(InputStream is)
        throws IOException {
        return is;
    }

    /**
     * Retrieves an output stream for the session. It may return
	 * the same stream that is passed in, if no processing is to be
	 * done by the client object.
     *
     * This method can only be called if isComplete() returns true.
     * @param is The original output stream for writing to the server.
     * @return An output stream for writing to the server, which
	 * may include processing the original stream. For this class, the
     * input parameter is always returned.
     * @exception IOException If the authentication exchange has not completed
     * or an error occurred while getting the stream.
     */
    public OutputStream getOutputStream(OutputStream os)
        throws IOException {
        return os;
    }

    private final static String MECHANISM_NAME = "EXTERNAL";
}
