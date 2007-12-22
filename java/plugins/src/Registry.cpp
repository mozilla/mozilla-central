/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- 
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

#include "iPlugletEngine.h"
#include "Registry.h"
#include "nsCOMPtr.h"

#include "nsServiceManagerUtils.h"

jclass Registry::clazz = NULL;
jmethodID Registry::setPeerMID = NULL;
jmethodID Registry::removeMID = NULL;
jmethodID Registry::findMatchingPlugletMethodMID = NULL;

void Registry::SetPeer(jobject key, jlong peer) {
    if (!clazz) {
        Initialize();
        if(!clazz) {
            return;
        }
    }
    nsresult rv = NS_ERROR_FAILURE;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);;
    if (NS_FAILED(rv)) {
	return;
    }
    JNIEnv *env = nsnull;
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	return;
    }

    env->CallStaticVoidMethod(clazz,setPeerMID,key,peer);
    if (env->ExceptionOccurred()) {
        env->ExceptionDescribe();
        return;
    }
}

void Registry::Remove(jobject key) {
    if (!clazz) {   // it is impossible
        Initialize();
        if(!clazz) {
            return;
        }
    }
    nsresult rv = NS_ERROR_FAILURE;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);;
    if (NS_FAILED(rv)) {
	return;
    }
    JNIEnv *env = nsnull;
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	return;
    }

    env->CallStaticVoidMethod(clazz,removeMID,key);
    if (env->ExceptionOccurred()) {
        env->ExceptionDescribe();
        return;
    }
}

jmethodID Registry::GetMethodIDForPlugletMethod(jobject plugletInstance, const char *methodName,
                                                jint numStringArgs) 
{
    jmethodID result = NULL;

    if (!clazz) {   // it is impossible
        Initialize();
        if(!clazz) {
            return result;
        }
    }

    if (NULL == methodName || 0 == strlen(methodName)) {
        return result;
    }
    nsresult rv = NS_ERROR_FAILURE;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);;
    if (NS_FAILED(rv)) {
	return result;
    }
    JNIEnv *env = nsnull;
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	return result;
    }

    env->ExceptionClear();

    jstring methodNameJstr = env->NewStringUTF(methodName);
    jstring methodSignatureJstr;
    methodSignatureJstr = (jstring)
        env->CallStaticObjectMethod(clazz, findMatchingPlugletMethodMID, 
                                    plugletInstance, methodNameJstr, numStringArgs);
    if (env->ExceptionOccurred()) {
        env->ExceptionDescribe();
        env->ExceptionClear();
        return result;
    }

    if (NULL != methodSignatureJstr) {
        jboolean isCopy;
        const char *signature = env->GetStringUTFChars(methodSignatureJstr, &isCopy);

        if (NULL != signature) {
            jclass plugletClass = env->GetObjectClass(plugletInstance);
            result = env->GetMethodID(plugletClass, methodName, signature);
            if (isCopy == JNI_TRUE) {
                env->ReleaseStringUTFChars(methodSignatureJstr, signature);
            }
        }
        env->DeleteLocalRef(methodSignatureJstr);
    }

    env->DeleteLocalRef(methodNameJstr);

    if (env->ExceptionOccurred()) {
        env->ExceptionDescribe();
        env->ExceptionClear();
    }

    return result;
}


void Registry::Initialize() {
    nsresult rv = NS_ERROR_FAILURE;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);;
    if (NS_FAILED(rv)) {
	return;
    }
    JNIEnv *env = nsnull;
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	return;
    }

    if(!env) {
        return;
    }
    clazz = env->FindClass("org/mozilla/pluglet/Registry");
    if(!clazz) {
        env->ExceptionDescribe();
	    return;
	}
    setPeerMID = env->GetStaticMethodID(clazz,"setPeer","(Ljava/lang/Object;J)V");
    if (!setPeerMID) {
        env->ExceptionDescribe();
        clazz = NULL;
        return;
    }
    removeMID = env->GetStaticMethodID(clazz,"remove","(Ljava/lang/Object;)V");
    if (!removeMID) {
        env->ExceptionDescribe();
        clazz = NULL;
        return;
    }
    findMatchingPlugletMethodMID = env->GetStaticMethodID(clazz,"findMatchingPlugletMethod","(Lorg/mozilla/pluglet/Pluglet;Ljava/lang/String;I)Ljava/lang/String;");
    if (!findMatchingPlugletMethodMID) {
        env->ExceptionDescribe();
        clazz = NULL;
        return;
    }


}











