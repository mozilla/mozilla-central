/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is RaptorCanvas.
 *
 * The Initial Developer of the Original Code is Kirk Baker and
 * Ian Wilkinson. Portions created by Kirk Baker and Ian Wilkinson are
 * Copyright (C) 1999 Kirk Baker and Ian Wilkinson. All
 * Rights Reserved.
 *
 * Contributor(s): Ed Burns <edburns@acm.org>
 */

package org.mozilla.mcp;

/*
 * RandomHTMLInputStream.java
 */

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Random;

/**

 * This class simulates a nasty, misbehavin' InputStream.

 * It randomly throws IOExceptions, blocks on read, and is bursty.

 */ 

class RandomHTMLInputStream extends InputStream
{

//
// Class variables
//

private static final int MAX_AVAILABLE = 4096;
private static final int MIN_AVAILABLE = 71;

private static final String HTML_START = "<HTML><BODY><PRE>START Random Data\n";
private static final String HTML_END = "\nEND Random Data</PRE></BODY></HTML>\n";


/**

 * This makes it so only when we get a random between 0 and 100 number
 * that evenly divides by three do we throw an IOException

 */

private static final int EXCEPTION_DIVISOR = 179;

private static final byte [] CHARSET;

//
// relationship ivars
//

private Random random;

//
// attribute ivars
//

private boolean isClosed;

private boolean firstRead;

private boolean randomExceptions = true;

/**

 * the number of times that read(bytearray) can be called and still get
 * data.  

 */

private int numReads;

private int available;

/**    

 * @param yourNumReads must be at least 2

 */

static {
    String charSet = " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890[]{}";
    CHARSET = charSet.getBytes();
}

public RandomHTMLInputStream(int yourNumReads, boolean yourRandomExceptions)
{
    this(yourNumReads, -1, yourRandomExceptions);
}

public RandomHTMLInputStream(int yourNumReads, int size, boolean yourRandomExceptions)
{
    randomExceptions = yourRandomExceptions;

    random = new Random(1234);

    isClosed = false;
    firstRead = true;
    numReads = yourNumReads;
    if (-1 == size) {
        available = MAX_AVAILABLE;
    }
    else {
        available = size;
    }
}

public int available() throws IOException
{
    int result;
    if (shouldThrowException()) {
        throw new IOException("It's time for an IOException!");
    }
    if (isClosed) {
        result = 0;
    }
    else {
        result = available;
    }
    return result;
}

public int read() throws IOException
{
    int result = 0;
    if (shouldThrowException()) {
        throw new IOException("It's time for an IOException!");
    }

    if (0 < available) {
        result = (int) 'a';
        available--;
    }
    else {
        result = -1;
    }
    return result;
}

public int read(byte[] b, int off, int len) throws IOException
{
    if (shouldThrowException()) {
        throw new IOException("It's time for an IOException!");
    }

    byte [] bytes;
    int i = 0;
    int max = 0;
    int numRead = 0;

    // base write case, the stream has been closed
    if (isClosed) {
        return -1;
    }
    // write case 0, no more reads left
    if (0 == numReads) {
        available = 0;
        return -1;
    }

    if (firstRead) {
        maybeSleep();
        // write case 1, yes enough length to write htmlHead
        max = HTML_START.length();
        if (numRead < len) {
            bytes = HTML_START.getBytes();
            for (i = 0; i < max; i++) {
                b[off+i] = bytes[i];
            }
            numRead += max;
            available -= max;
        }
        firstRead = false;
    }
    else {
        // If this is the last read...
        if (1 == numReads) {
            numRead = writeHTMLEnd(b, off, len);
        }
        else {
            // If we have more bytes than HTML_END.length...
            if (HTML_END.length() <= available) {
                // Write some random stuff.
                // If what we have is greater than or equal to what was asked for...
                if (len <= available) {
                    // If both len and available are less than or equal to HTML_END...
                    if ((len - HTML_END.length()) <= 0) {
                        // just write HTML_END.
                        numRead = writeHTMLEnd(b, off, len);
                        numReads = 0;
                        return numRead;
                    }
                    else {
                        // otherwise, write some filler
                        max = len - HTML_END.length();
                    }
                }
                else {
                    // otherwise, write some filler
                    max = available - HTML_END.length();
                    if (0 == max) {
                        // just write HTML_END.
                        numRead = writeHTMLEnd(b, off, len);
                        numReads = 0;
                        return numRead;
                    }
                }
                maybeSleep();
                bytes = new byte[max];
                for (i = 0; i < max; i++) {
                    if (0 == (i % 78)) {
                        b[off+i] = (byte) '\n';
                    }
                    else {
                        b[off+i] = CHARSET[random.nextInt(CHARSET.length)];
                    }
                }
                numRead += max;
                available -= max;
            }
            else {
                // Otherwise, just write HTML_END
                writeHTMLEnd(b, off, len);
            }
        }
    }
    numReads--;
    return numRead;
}

public void close() throws IOException
{
    if (shouldThrowException()) {
        throw new IOException("It's time for an IOException!");
    }
    isClosed = true;
    try {
        synchronized(this) {
            this.notify();
        }
    }
    catch (Exception e) {
        throw new IOException("RandomHTMLInputStream: Can't notify listeners");
    }
}

private int writeHTMLEnd(byte [] b, int off, int len) {
    int numRead = -1;
    byte [] bytes = HTML_END.getBytes();
    int i, max = 0;
    
    // Determine how many bytes of HTML_END to write.
    
    // If we have enough space to write out HTML_END,...
    if (bytes.length <= available) {
        // verify the caller can handle all of HTML_END...
        if (bytes.length <= len) {
            // write out the whole HTML_END.
            max = bytes.length;
        }
        // if not, write out only the first len bytes of HTML_END
        else {
            max = len;
        }
    }
    else {
        // We do not have enough space to write out HTML_END.
        if (available <= len) {
            // If what we have is less than or equal to what the caller asked for...
            max = available;
        }
        else {
            // What we have is more than the caller asked for.
            max = len;
        }
    }
    for (i = 0; i < max; i++) {
        b[off+i] = bytes[i];
    }
    numRead = max;
    available -= max;
    
    return numRead;
}

private void maybeSleep() throws IOException {
    if (random.nextBoolean()) {
        try {
            System.out.println("RandomHTMLInputStream:: sleeping");
            System.out.flush();
            Thread.sleep(3000);
        }
        catch (Exception e) {
            throw new IOException(e.getMessage());
        }
    }
}

private boolean shouldThrowException()
{
    if (!randomExceptions) {
        return false;
    }
    int nextInt = random.nextInt(10000);

    boolean result = false;

    if (nextInt > EXCEPTION_DIVISOR) {
        result = (0 == (nextInt % EXCEPTION_DIVISOR));
    }
    return result;
}


}
