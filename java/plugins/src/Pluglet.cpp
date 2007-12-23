/* 
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
#include "nsIServiceManager.h"

#include "Pluglet.h"
#include "iPlugletEngine.h"
#include "PlugletStreamListener.h"
#include "PlugletPeer.h"
#include "Registry.h"
#include "PlugletViewFactory.h"
#include "PlugletLog.h"
#include "nsMemory.h"




jmethodID Pluglet::initializeMID = NULL;
jmethodID Pluglet::startMID = NULL;
jmethodID Pluglet::stopMID = NULL;
jmethodID Pluglet::destroyMID = NULL;
jmethodID Pluglet::newStreamMID = NULL;
jmethodID Pluglet::setWindowMID = NULL;
jmethodID Pluglet::printMID = NULL;

static NS_DEFINE_IID(kIPluginInstanceIID, NS_IPLUGININSTANCE_IID);

NS_IMPL_ISUPPORTS2(Pluglet, 
		   nsIPluginInstance,
		   nsIPluglet)


Pluglet::Pluglet(jobject object) : peer(nsnull) {
    nsresult rv;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);
    if (NS_FAILED(rv)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::Pluglet: Cannot access iPlugletEngine service\n"));
	return;
    }

    JNIEnv *jniEnv = nsnull;
    rv = plugletEngine->GetJNIEnv(&jniEnv);
    if (NS_FAILED(rv)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::Pluglet: plugletEngine->GetJNIEnv failed\n"));
	return;
    }
	
    
    jthis = jniEnv->NewGlobalRef(object);
    //nb check for null
    view = PlugletViewFactory::GetPlugletView();
    Registry::SetPeer(jthis,(jlong)this);
}

Pluglet::~Pluglet() {
    Registry::Remove(jthis);
    JNIEnv *jniEnv = nsnull;
    nsresult rv;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);
    if (plugletEngine) {
	rv = plugletEngine->GetJNIEnv(&jniEnv);
	if (NS_FAILED(rv)) {
	    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
		   ("Pluglet::~Pluglet: plugletEngine->GetJNIEnv failed\n"));
	    return;
	}
	jniEnv->DeleteGlobalRef(jthis);
	if (jniEnv->ExceptionOccurred()) {
            jniEnv->ExceptionDescribe();
        }
    }

    peer = nsnull;
}

NS_METHOD Pluglet::HandleEvent(nsPluginEvent* event, PRBool* handled) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::HandleEvent; stub\n"));
    //nb we do not need it under win32
    return NS_OK;
}

NS_METHOD Pluglet::Initialize(nsIPluginInstancePeer* _peer) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::Initialize\n"));
    JNIEnv *env = nsnull;
    nsresult rv;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);

    rv = plugletEngine->GetJNIEnv(&env);

    if (NS_FAILED(rv)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::Initialize: plugletEngine->GetJNIEnv failed\n"));
	return rv;
    }
    if (!printMID) {
	jclass clazz = env->FindClass("org/mozilla/pluglet/Pluglet");
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
	initializeMID = env->GetMethodID(clazz,"initialize","(Lorg/mozilla/pluglet/mozilla/PlugletPeer;)V");
        if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
	startMID = env->GetMethodID(clazz,"start","()V");
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
	stopMID = env->GetMethodID(clazz,"stop","()V");
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
	destroyMID = env->GetMethodID(clazz,"destroy","()V");
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
	newStreamMID = env->GetMethodID(clazz,"newStream","()Lorg/mozilla/pluglet/PlugletStreamListener;");
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
	setWindowMID = env->GetMethodID(clazz,"setWindow","(Ljava/awt/Frame;)V");
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
	printMID = env->GetMethodID(clazz,"print","(Ljava/awt/print/PrinterJob;)V");
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
        }
    }
    peer = _peer;
    if (peer) {
	jobject obj = PlugletPeer::GetJObject(peer);
	if (!obj) {
	    return NS_ERROR_FAILURE;
	}
	env->CallVoidMethod(jthis,initializeMID,obj);
    }
    return NS_OK;
}

NS_METHOD Pluglet::GetPeer(nsIPluginInstancePeer* *result) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::GetPeer\n"));
    NS_ADDREF(*result = peer);
    return NS_OK;
}

NS_METHOD Pluglet::Start(void) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::Start\n"));
    JNIEnv *env = nsnull;
    nsresult rv;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::Start: plugletEngine->GetJNIEnv failed\n"));
	return rv;
    }
    env->CallVoidMethod(jthis,startMID);
    if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
     }
    return NS_OK;
}
NS_METHOD Pluglet::Stop(void) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::Stop\n"));
    JNIEnv *env = nsnull;
    nsresult rv;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::Stop: plugletEngine->GetJNIEnv failed\n"));
	return rv;
    }
    env->CallVoidMethod(jthis,stopMID);
    if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
    }
    return NS_OK;
}
NS_METHOD Pluglet::Destroy(void) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::Destroy\n"));
    JNIEnv *env = nsnull;
    nsresult rv;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::Destroy: plugletEngine->GetJNIEnv failed\n"));
	return rv;
    }

    env->CallVoidMethod(jthis,destroyMID);
    if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
     }
    return NS_OK;
}

NS_METHOD Pluglet::NewStream(nsIPluginStreamListener** listener) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::NewStream\n"));
    if(!listener) {
	return NS_ERROR_FAILURE;
    }
    nsresult rv;
    JNIEnv *env;
    nsCOMPtr<iPlugletEngine> plugletEngine = 
	do_GetService(PLUGLETENGINE_ContractID, &rv);
    rv = plugletEngine->GetJNIEnv(&env);
    if (NS_FAILED(rv)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::Destroy: plugletEngine->GetJNIEnv failed\n"));
	return rv;
    }

    jobject obj = env->CallObjectMethod(jthis,newStreamMID);
    if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
    }
    if (obj) {
	*listener = new PlugletStreamListener(obj);
	(*listener)->AddRef();
    }
    return NS_OK;
}

NS_METHOD Pluglet::GetValue(nsPluginInstanceVariable variable, void *value) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::GetValue; stub\n"));
    return NS_ERROR_FAILURE;
}

NS_METHOD Pluglet::SetWindow(nsPluginWindow* window) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::SetWindow\n"));
    if (view->SetWindow(window) == PR_TRUE) {
	nsresult rv;
	JNIEnv *env;
	nsCOMPtr<iPlugletEngine> plugletEngine = 
	    do_GetService(PLUGLETENGINE_ContractID, &rv);
	rv = plugletEngine->GetJNIEnv(&env);
	if (NS_FAILED(rv)) {
	    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
		   ("Pluglet::Destroy: plugletEngine->GetJNIEnv failed\n"));
	    return rv;
	}

	env->CallVoidMethod(jthis,setWindowMID,view->GetJObject());
	if (env->ExceptionOccurred()) {
            env->ExceptionDescribe();
            return NS_ERROR_FAILURE;
	}
    }
    return NS_OK;
}

NS_METHOD Pluglet::Print(nsPluginPrint* platformPrint) {
    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	    ("Pluglet::Print; stub\n"));
    //nb
    return NS_OK;
}

NS_IMETHODIMP Pluglet::CallPlugletMethod(const char *methodName, PRUint32 *inArgc, 
					 char ***inArgv) 
{
    nsresult rv = NS_OK;

    if (NULL != methodName && 0 < strlen(methodName) && NULL != inArgc && NULL != inArgv && (10 < (int)inArgc)) {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::CallPlugletMethod: methodName: %s\n", methodName));

	jmethodID plugletMethodMID = Registry::GetMethodIDForPlugletMethod(jthis, methodName, 
									   (jint) *inArgc);
	if (NULL != plugletMethodMID) {
	    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
		   ("Pluglet::CallPlugletMethod: found match for methodName: %s\n", methodName));
	    nsresult rv = NS_ERROR_FAILURE;
	    nsCOMPtr<iPlugletEngine> plugletEngine = 
		do_GetService(PLUGLETENGINE_ContractID, &rv);;
	    if (NS_FAILED(rv)) {
		return rv;
	    }
	    JNIEnv *env = nsnull;
	    rv = plugletEngine->GetJNIEnv(&env);
	    if (NS_FAILED(rv)) {
		return rv;
	    }
	    jstring resultJstr;

	    if (0 == *inArgc) {
		resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID);
	    }
	    else {
		char **args = *inArgv;
		if (1 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    if (jstr0) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0);
		    }
		    env->DeleteLocalRef(jstr0);
		}
		else if (2 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    if (jstr0 && jstr1) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		}
		else if (3 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    if (jstr0 && jstr1 && jstr2) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		}
		else if (4 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    jstring jstr3 = env->NewStringUTF(args[3]);
		    if (jstr0 && jstr1 && jstr2 && jstr3) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2,
								     jstr3);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		    env->DeleteLocalRef(jstr3);
		}
		else if (5 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    jstring jstr3 = env->NewStringUTF(args[3]);
		    jstring jstr4 = env->NewStringUTF(args[4]);
		    if (jstr0 && jstr1 && jstr2 && jstr3 && jstr4) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2,
								     jstr3, jstr4);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		    env->DeleteLocalRef(jstr3);
		    env->DeleteLocalRef(jstr4);
		}
		else if (6 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    jstring jstr3 = env->NewStringUTF(args[3]);
		    jstring jstr4 = env->NewStringUTF(args[4]);
		    jstring jstr5 = env->NewStringUTF(args[5]);
		    if (jstr0 && jstr1 && jstr2 && jstr3 && jstr4 && jstr5) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2,
								     jstr3, jstr4, jstr5);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		    env->DeleteLocalRef(jstr3);
		    env->DeleteLocalRef(jstr4);
		    env->DeleteLocalRef(jstr5);
		}
		else if (7 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    jstring jstr3 = env->NewStringUTF(args[3]);
		    jstring jstr4 = env->NewStringUTF(args[4]);
		    jstring jstr5 = env->NewStringUTF(args[5]);
		    jstring jstr6 = env->NewStringUTF(args[6]);
		    if (jstr0 && jstr1 && jstr2 && jstr3 && jstr4 && jstr5 && jstr6) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2,
								     jstr3, jstr4, jstr5, jstr6);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		    env->DeleteLocalRef(jstr3);
		    env->DeleteLocalRef(jstr4);
		    env->DeleteLocalRef(jstr5);
		    env->DeleteLocalRef(jstr6);
		}
		else if (8 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    jstring jstr3 = env->NewStringUTF(args[3]);
		    jstring jstr4 = env->NewStringUTF(args[4]);
		    jstring jstr5 = env->NewStringUTF(args[5]);
		    jstring jstr6 = env->NewStringUTF(args[6]);
		    jstring jstr7 = env->NewStringUTF(args[7]);
		    if (jstr0 && jstr1 && jstr2 && jstr3 && jstr4 && jstr5 && jstr6 && jstr7) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2,
								     jstr3, jstr4, jstr5, jstr6, jstr7);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		    env->DeleteLocalRef(jstr3);
		    env->DeleteLocalRef(jstr4);
		    env->DeleteLocalRef(jstr5);
		    env->DeleteLocalRef(jstr6);
		    env->DeleteLocalRef(jstr7);
		}
		else if (9 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    jstring jstr3 = env->NewStringUTF(args[3]);
		    jstring jstr4 = env->NewStringUTF(args[4]);
		    jstring jstr5 = env->NewStringUTF(args[5]);
		    jstring jstr6 = env->NewStringUTF(args[6]);
		    jstring jstr7 = env->NewStringUTF(args[7]);
		    jstring jstr8 = env->NewStringUTF(args[8]);
		    if (jstr0 && jstr1 && jstr2 && jstr3 && jstr4 && jstr5 && jstr6 && jstr7 && jstr8) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2,
								     jstr3, jstr4, jstr5, jstr6, jstr7, jstr8);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		    env->DeleteLocalRef(jstr3);
		    env->DeleteLocalRef(jstr4);
		    env->DeleteLocalRef(jstr5);
		    env->DeleteLocalRef(jstr6);
		    env->DeleteLocalRef(jstr7);
		    env->DeleteLocalRef(jstr8);
		}
		else if (10 == *inArgc) {
		    jstring jstr0 = env->NewStringUTF(args[0]);
		    jstring jstr1 = env->NewStringUTF(args[1]);
		    jstring jstr2 = env->NewStringUTF(args[2]);
		    jstring jstr3 = env->NewStringUTF(args[3]);
		    jstring jstr4 = env->NewStringUTF(args[4]);
		    jstring jstr5 = env->NewStringUTF(args[5]);
		    jstring jstr6 = env->NewStringUTF(args[6]);
		    jstring jstr7 = env->NewStringUTF(args[7]);
		    jstring jstr8 = env->NewStringUTF(args[8]);
		    jstring jstr9 = env->NewStringUTF(args[9]);
		    if (jstr0 && jstr1 && jstr2 && jstr3 && jstr4 && jstr5 && jstr6 && jstr7 && jstr8 && jstr9) {
			resultJstr = (jstring) env->CallObjectMethod(jthis, plugletMethodMID, jstr0, jstr1, jstr2,
								     jstr3, jstr4, jstr5, jstr6, jstr7, jstr8, jstr9);
		    }
		    env->DeleteLocalRef(jstr0);
		    env->DeleteLocalRef(jstr1);
		    env->DeleteLocalRef(jstr2);
		    env->DeleteLocalRef(jstr3);
		    env->DeleteLocalRef(jstr4);
		    env->DeleteLocalRef(jstr5);
		    env->DeleteLocalRef(jstr6);
		    env->DeleteLocalRef(jstr7);
		    env->DeleteLocalRef(jstr8);
		    env->DeleteLocalRef(jstr9);
		}
	    }

	    if (NULL != resultJstr) {
		jboolean isCopy;
		const char * result = env->GetStringUTFChars(resultJstr, &isCopy);
		if (NULL != result) {
		    const static char *strings[1];
		    strings[0] = result;
		    // Taken from xpctest_array.cpp.  Thanks jband
		    const static PRUint32 scount = sizeof(strings)/sizeof(strings[0]);
		    char** out = (char**) nsMemory::Alloc(scount * sizeof(char*));
		    if(!out) {
			return NS_ERROR_OUT_OF_MEMORY;
		    }
		    for(PRUint32 i = 0; i < scount; ++i) {
			out[i] = (char*) nsMemory::Clone(strings[i], strlen(strings[i])+1);
			if(!out[i]) {
			    nsMemory::Free(out);
			    return NS_ERROR_OUT_OF_MEMORY;
			}
		    }
		    *inArgc = 1;
		    *inArgv = out;
		}
		if (isCopy == JNI_TRUE) {
		    env->ReleaseStringUTFChars(resultJstr, result);
		}
	    }

	}
	else {
	    PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
		   ("Pluglet::CallPlugletMethod: no match for methodName: %s\n", methodName));
	}
    }
    else {
	PR_LOG(PlugletLog::log, PR_LOG_DEBUG,
	       ("Pluglet::CallPlugletMethod: invalid arguments\n"));
	
    }

    return NS_OK;
}









