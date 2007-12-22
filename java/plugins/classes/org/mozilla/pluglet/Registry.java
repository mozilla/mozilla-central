/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- 
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Sun Microsystems,
 * Inc. Portions created by Sun are
 * Copyright (C) 1999 Sun Microsystems, Inc. All
 * Rights Reserved.
 *
 * Contributor(s): 
 */
package org.mozilla.pluglet;

import java.lang.reflect.Method;
import java.util.*;

public class Registry {
    static Hashtable table = null;
    public static void setPeer(Object key,long peer) {
        if (table == null) {
            table = new Hashtable(10);
        }
        table.put(key, new Long(peer));
    }
    public static long getPeer(Object key) {
        if (table == null) {
            return 0;
        }
        Object obj = table.get(key);
        if (obj == null) {
            return 0;
        } else {
            return ((Long)obj).longValue(); 
        }
    }
    public static void remove(Object key) {
        if (table != null) {
            table.remove(key);
        }
    }
    
    public static String findMatchingPlugletMethod(Pluglet pluglet, 
            String methodName, int numStringArgs) {
        String result = null;
        Class plugletClass = pluglet.getClass();
        Method [] methods = plugletClass.getMethods();
        boolean foundMatch = false;
        Method matchingMethod = null;
        // For each of the methods on the Pluglet
        for (Method cur : methods) {
            if (foundMatch) {
                break;
            }
            // See if the name of the method matches the name we
            // are looking for.
            if (cur.getName().equals(methodName)) {
                // If so, does it return String?
                if (String.class == cur.getReturnType()) {
                    // If so, do the number of arguments match?
                    Class [] paramTypes = cur.getParameterTypes();
                    if (numStringArgs == paramTypes.length) {
                        foundMatch = true;
                        matchingMethod = cur;
                        // If so, are all the arguments of type String?
                        for (Class curClass : paramTypes) {
                            if (String.class != curClass) {
                                // If not, this method is not a match.
                                foundMatch = false;
                                matchingMethod = null;
                                break;
                            }
                        }
                    }
                    // No, the number of arguments do not match, not a match
                    else {
                        foundMatch = false;
                    }
                }
                // No, it does not return String, not a match.
                else {
                    foundMatch = false;
                }
            }
            // No, the name does not match, not a match
            else {
                foundMatch = false;
            }
        }
        
        if (foundMatch) {
           StringBuilder signature = new StringBuilder();
           signature.append('(');
           for (int i = 0; i < numStringArgs; i++) {
               signature.append("Ljava/lang/String;");
           }
           signature.append(")Ljava/lang/String;");
           result = signature.toString();
        }
        
        return result;
    }
  
}
