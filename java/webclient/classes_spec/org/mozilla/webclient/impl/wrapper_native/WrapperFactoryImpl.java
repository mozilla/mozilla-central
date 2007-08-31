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
 * The Original Code is RaptorCanvas.
 *
 * The Initial Developer of the Original Code is Kirk Baker and
 * Ian Wilkinson. Portions created by Kirk Baker and Ian Wilkinson are
 * Copyright (C) 1999 Kirk Baker and Ian Wilkinson. All
 * Rights Reserved.
 *
 * Contributor(s):  Ed Burns <edburns@acm.org>
 */

package org.mozilla.webclient.impl.wrapper_native;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.mozilla.util.Assert;
import org.mozilla.util.Log;
import org.mozilla.util.Utilities;
import org.mozilla.util.ReturnRunnable;

import org.mozilla.webclient.BrowserControl;
import org.mozilla.webclient.BrowserControlCanvas;
import org.mozilla.webclient.impl.BrowserControlImpl;
import org.mozilla.webclient.Bookmarks;
import org.mozilla.webclient.Preferences;
import org.mozilla.webclient.ProfileManager;
import org.mozilla.webclient.ImplObject;

import org.mozilla.webclient.impl.WrapperFactory;
import org.mozilla.webclient.impl.Service;

import org.mozilla.dom.DOMAccessor;

import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.CountDownLatch;

/**
 * <p>This class is the hub of the startup and shutdown sequence for
 * Webclient.  It is a singleton and owns references to other app
 * singletons:</p>
 *
 * 	<ul>
 * 	  <li><p>{@link NativeEventThread}</p></li>
 *
 * 	  <li><p>{@link Bookmarks}</p></li>
 * 
 * 	  <li><p>{@link Preferences}</p></li>
 * 
 * 	  <li><p>{@link ProfileManager}</p></li>

 * 	  <li><p>the native object singleton corresponding to this java
 * 	  object (if necessary)</p></li>
 * 
 *	</ul>
 *
 * <p>It maintains a set of {@link BrowserControlImpl} instances so that
 * we may return the native pointer for each one.</p>
 *
 * <p>This class is responsible for creating and initializing and
 * deleting {@link BrowserControlImpl} instances, as well as ensuring
 * that the native counterpart is proprely maintained in kind.</p>
 *
 * <p>This class has a tight contract with {@link
 * NativeEventThread}.</p>
 */

public class WrapperFactoryImpl extends Object implements WrapperFactory {
    //
    // Constants
    //

    public static final String JAVADOM_LOADED_PROPERTY_NAME = 
	"org.mozilla.webclient.impl.wrapper_native.javadomjni.loaded";
    
    //
    // Class Variables
    //
    
    public static final String LOG = "org.mozilla.webclient.impl.wrapper_native.CurrentPageImpl";

    public static final Logger LOGGER = Log.getLogger(LOG);
    
    
    
    //
    // Instance Variables
    //
    
    // Attribute Instance Variables
    
    protected String platformCanvasClassName = null;
    protected String profileName = "webclient";
    protected boolean initialized = false;
    protected boolean terminated = false;
    protected CountDownLatch oneCountLatch = null;
    
    // Relationship Instance Variables
    
    private NativeEventThread eventThread = null; // OWNER
    private int nativeWrapperFactory;

    private Map browserControls;
    
    /**
     * <p>App singleton.  WrapperFactoryImpl is the owner of this reference.
     * We maintain a reference so we can remove it at shutdown time.</p>
     */
    
    protected Bookmarks bookmarks = null;
    
    /**
     * <p>App singleton.  WrapperFactoryImpl is the owner of this reference.
     * We maintain a reference so we can remove it at shutdown time.</p>
     */
    protected Preferences prefs = null;
    
    /**
     * <p>App singleton.  WrapperFactoryImpl is the owner of this reference.
     * We maintain a reference so we can remove it at shutdown time.</p>
     */
    
    protected ProfileManager profileManager = null;
    
    //
    // Constructors and Initializers    
    //
    
    public WrapperFactoryImpl()
    {
	super();
	browserControls = new HashMap();
        oneCountLatch = new CountDownLatch(1);
    }
    
    
    //
    // Class methods
    //
    
    //
    // Methods from webclient.WrapperFactory
    //
    
    public CountDownLatch getOneCountLatch() {
        return oneCountLatch;
    }

    public BrowserControl newBrowserControl() throws InstantiationException, IllegalAccessException, IllegalStateException {
	verifyInitialized();

	if (terminated) {
	    throw new IllegalStateException("Already terminated");
	}
	
	BrowserControl result = new BrowserControlImpl(this);
	final int nativeBrowserControl = nativeCreateBrowserControl();
	eventThread.pushBlockingReturnRunnable(new ReturnRunnable() {
		public Object run() {
		    WrapperFactoryImpl.this.nativeInitBrowserControl(nativeWrapperFactory, nativeBrowserControl);
		    return null;
                }
                public String toString() {
                    return "WCRunnable.nativeInitBrowserControl";
                }

	    });

	browserControls.put(result, new Integer(nativeBrowserControl));
        if (1 == browserControls.size()) {
            copyProxySettingsIfNecessary();
        }
	return result;
    }
    
    public void deleteBrowserControl(BrowserControl toDelete) {
	verifyInitialized();
	Integer nativeBc;

	if (null != (nativeBc = (Integer) browserControls.get(toDelete))) {
	    final int nativeBrowserControl = nativeBc.intValue();
	    eventThread.pushBlockingReturnRunnable(new ReturnRunnable() {
		    public Object run() {
			WrapperFactoryImpl.this.nativeDestroyBrowserControl(nativeBrowserControl);
			return null;
		    }
                    public String toString() {
                        return "WCRunnable.nativeDeleteBrowserControl";
                    }

		});
	}
    }
    
    
    /**
       
    * @param interfaceName IMPORTANT!!!! This method assumes that
    * interfaceName is one of the actual strings from the interface
    * definition for BrowserControl.  That is, this method is only called
    * from BrowserControlImpl, and is only invoked like this
    
    <CODE><PRE>
    
    // BrowserControlImpl code...
    
    if (WINDOW_CONTROL_NAME.equals(interfaceName)) {
    if (null == windowControl) {
    windowControl = 
    (WindowControl) wrapperFactory.newImpl(WINDOW_CONTROL_NAME,
    this);
    }
    return windowControl;
    }
    
    </PRE></CODE>
    
    * <P>
    * This is done to avoid a costly string compare.  This shortcut is
    * justified since WrapperFactoryImpl is only called from
    * BrowserControlImpl <B>and</B> the only values for interfaceName that
    * make sense are those defined in BrowserControl class variables ending
    * with _NAME.
    * </P>
    
    * @see org.mozilla.webclient.BrowserControl.BROWSER_CONTROL_CANVAS_NAME
    
    */

    public Object newImpl(String interfaceName,
			  BrowserControl browserControl) throws ClassNotFoundException {
	
	if (BrowserControl.BROWSER_CONTROL_CANVAS_NAME == interfaceName) {
	    Class bcClass = Utilities.loadClass(getPlatformCanvasClassName(),
                    this);
	    BrowserControlCanvas canvas = null;
	    try {
		canvas = (BrowserControlCanvas) bcClass.newInstance();
	    }
	    catch (IllegalAccessException e) {
		throw new ClassNotFoundException(e.getMessage());
	    }
	    catch (InstantiationException e) {
		throw new ClassNotFoundException(e.getMessage());
	    }
	    canvas.initialize(browserControl);
	    return canvas;
	}

	Object result = null;
	if (!nativeDoesImplement(interfaceName)) {
	    throw new ClassNotFoundException("Can't instantiate " + 
					     interfaceName + 
					     ": not implemented.");
	}
	if (BrowserControl.WINDOW_CONTROL_NAME == interfaceName) {
	    result = new WindowControlImpl(this, browserControl);
	}
	if (BrowserControl.NAVIGATION_NAME == interfaceName) {
	    result = new NavigationImpl(this, browserControl);
	}
	if (BrowserControl.HISTORY_NAME == interfaceName) {
	    result = new HistoryImpl(this, browserControl);
	}
	if (BrowserControl.CURRENT_PAGE_NAME == interfaceName) {
	    result = new CurrentPageImpl(this, browserControl);
	}
	if (BrowserControl.EVENT_REGISTRATION_NAME == interfaceName) {
	    result = new EventRegistrationImpl(this, browserControl);
	}
	if (BrowserControl.BOOKMARKS_NAME == interfaceName) {
	    Assert.assert_it(null != bookmarks);
	    // PENDING(edburns): 20070130 XULRunner has no bookmarks result = bookmarks;
	}
	if (BrowserControl.PREFERENCES_NAME == interfaceName) {
	    Assert.assert_it(null != prefs);
	    result = prefs;
	}
	if (BrowserControl.PROFILE_MANAGER_NAME == interfaceName) {
	    Assert.assert_it(null != profileManager);
	    result = profileManager;
	}
	return result;
    }

    public void setProfile(String profileName) {
	this.profileName = profileName;
    }

    public String getProfile() {
	return profileName;
    }
    
    public int loadNativeLibrariesIfNecessary() {
        System.loadLibrary("webclient");
	System.setProperty(JAVADOM_LOADED_PROPERTY_NAME,  "true");
	try {
	    System.loadLibrary("javadomjni");
            DOMAccessor.setRunner(NativeEventThread.instance);
	    DOMAccessor.setNativeLibraryLoaded(true);
	}
	catch (Exception ex) {
	    System.setProperty(JAVADOM_LOADED_PROPERTY_NAME,  "false");
	}
  
        nativeWrapperFactory = nativeCreateNativeWrapperFactory();
	Assert.assert_it(-1 != nativeWrapperFactory);
        return nativeWrapperFactory;
    }
    
    public void initialize(String verifiedBinDirAbsolutePath) throws SecurityException, UnsatisfiedLinkError {
	if (initialized) {
	    return;
	}
	
	// 
	// Do the first initialization call
	//
        
        // Get the NativeEventThread, using reflection
        try {
            Class bcCanvasClass = Utilities.loadClass(getPlatformCanvasClassName(),
                    this);
            Method newNativeEventThread =
                    bcCanvasClass.getDeclaredMethod("newNativeEventThread",
                    WrapperFactory.class);
            assert(null != newNativeEventThread);

            eventThread = (NativeEventThread) newNativeEventThread.invoke(null, this);
        }
        catch (ClassNotFoundException cnfe) {
            LOGGER.log(Level.SEVERE, "Unable to find class for " + 
                    getPlatformCanvasClassName(), cnfe);
        }
        catch (IllegalAccessException ise) {
            LOGGER.log(Level.SEVERE, "Unable to invoke method 'newNativeEventThread' on class " + 
                    getPlatformCanvasClassName(), ise);
        }
        catch (InvocationTargetException ite) {
            LOGGER.log(Level.SEVERE, "While invokeing method 'newNativeEventThread' on class " +
                    getPlatformCanvasClassName() + " the method threw an exception: ", 
                    ite.getCause());
        }
        catch (NoSuchMethodException nsme) {
            LOGGER.log(Level.SEVERE, "Unable to find method 'newNativeEventThread' on class " + 
                    getPlatformCanvasClassName(), nsme);
        }
	
	final String finalStr = new String(verifiedBinDirAbsolutePath);
	
	eventThread.pushRunnable(new Runnable() {
		public void run() {
		    WrapperFactoryImpl.this.nativeAppInitialize(finalStr,
								nativeWrapperFactory,
								eventThread);
                }
                public String toString() {
                    return "Runnable.nativeAppInitialize";
                }


	    });
	
	eventThread.start();
        
        try {
            getOneCountLatch().await();
        }
        catch (Exception e) {
            if (LOGGER.isLoggable(Level.SEVERE)) {
                LOGGER.log(Level.SEVERE,
                        "WrapperFactoryImpl.initialize(): interrupted while waiting\n\t for NativeEventThread to countDown(): ", e);
            }
            throw new UnsatisfiedLinkError(e.getMessage());
        }


	//
	// create app singletons
	//
	profileManager = new ProfileManagerImpl(this);
	Assert.assert_it(null != profileManager);
	prefs = new PreferencesImpl(this);
	Assert.assert_it(null != prefs);
	bookmarks = new BookmarksImpl(this);
	Assert.assert_it(null != bookmarks);

	initialized = true;
	try {
	    eventThread.pushBlockingReturnRunnable(new ReturnRunnable() {
		    public Object run() {
			
			((Service)WrapperFactoryImpl.this.profileManager).startup();
			((Service)WrapperFactoryImpl.this.prefs).startup();
			// PENDING(edburns): 20070130 XULRunner has no bookmarks ((Service)WrapperFactoryImpl.this.bookmarks).startup();
			
			WrapperFactoryImpl.this.nativeAppSetup(nativeWrapperFactory);
			return null;
		    }
                    public String toString() {
                        return "WCRunnable.nativeAppSetup";
                    }

		});
	}
	catch (RuntimeException e) {
	    initialized = false;
	    System.out.println("WrapperFactoryImpl.initialize: Can't start up singleton services: " + e + " " + e.getMessage());
	}


    }
    
    private enum ProxyEnum {
        httpProxyHost,
        httpProxyPort,
        httpNonProxyHosts,
        ftpProxyHost,
        ftpProxyPort,
        ftpNonProxyHosts,
        socksProxyHost,
        socksProxyPort,
        sslProxyHost,
        sslProxyPort,        
        gopherProxyHost,
        gopherProxyPort        
    }
    
    private static final List<String []> ProxyPropNames; 
    
    static { ProxyPropNames = new ArrayList<String []>();
        ProxyPropNames.add(new String [] { "http.proxyHost", "network.proxy.http"});
        ProxyPropNames.add(new String [] { "http.proxyPort", "network.proxy.http_port"});
        ProxyPropNames.add(new String [] { "http.nonProxyHosts", "network.proxy.no_proxies_on"});
        ProxyPropNames.add(new String [] { "ftp.proxyHost", "network.proxy.ftp"});
        ProxyPropNames.add(new String [] { "ftp.proxyPort", "network.proxy.ftp_port"});
        ProxyPropNames.add(new String [] { "ftp.nonProxyHosts", ""});
        ProxyPropNames.add(new String [] { "socksProxyHost", "network.proxy.socks"});
        ProxyPropNames.add(new String [] { "socksProxyPort", "network.proxy.socks_port"});
        ProxyPropNames.add(new String [] { "ssl.proxyHost", "network.proxy.ssl" });
        ProxyPropNames.add(new String [] { "ssl.proxyPort", "network.proxy.ssl_port" });
        ProxyPropNames.add(new String [] { "gopher.proxyHost", "network.proxy.gopher" });
        ProxyPropNames.add(new String [] { "gopher.proxyPort", "network.proxy.gopher_port" });
    }
    
    private static final int Java = 0;
    private static final int Mozilla = 1;
    
    private static final String [] JavaProxyPropertyValues = new String[ProxyPropNames.size()];
        
    public void copyProxySettingsIfNecessary() {
        assert(ProxyEnum.values().length == ProxyPropNames.size());
        
        Properties props = System.getProperties();
        int i = 0, len = ProxyPropNames.size();
        // get proxy related property values from the System Properties
        for (i = 0; i < len; i++) {
            JavaProxyPropertyValues[i] = props.getProperty(ProxyPropNames.get(i)[Java]);
        }
        // If there are any network related properties in the System Properties...
        if (null != JavaProxyPropertyValues[ProxyEnum.httpProxyHost.ordinal()] ||
                null != JavaProxyPropertyValues[ProxyEnum.ftpProxyHost.ordinal()] ||
                null != JavaProxyPropertyValues[ProxyEnum.socksProxyHost.ordinal()] ||
                null != JavaProxyPropertyValues[ProxyEnum.sslProxyHost.ordinal()] ||
                null != JavaProxyPropertyValues[ProxyEnum.gopherProxyHost.ordinal()]) {
            // turn on manual property configuration.
            prefs.setPref("network.proxy.type", "1");
        }
        
        // If the only proxy related property that is set is the http proxy host... 
        if (null != JavaProxyPropertyValues[ProxyEnum.httpProxyHost.ordinal()] &&
                null == JavaProxyPropertyValues[ProxyEnum.ftpProxyHost.ordinal()] &&
                null == JavaProxyPropertyValues[ProxyEnum.socksProxyHost.ordinal()] &&
                null == JavaProxyPropertyValues[ProxyEnum.sslProxyHost.ordinal()] &&
                null == JavaProxyPropertyValues[ProxyEnum.gopherProxyHost.ordinal()]) {
            // make sure the rest of the protocols share the http proxy settings
            prefs.setPref("network.proxy.share_proxy_settings", "true");
        }
        
        String val = null;
        ProxyEnum proxyType;
        len = ProxyEnum.values().length;
        for (i = 0; i < len; i++) {
            proxyType = ProxyEnum.values()[i];
            // If the current proxy property is a hostname property...
            if (proxyType.toString().endsWith("Host")) {
                // If there is a value for this hostname property, (ie http.proxyHost)
                if (null != (val = JavaProxyPropertyValues[proxyType.ordinal()])) {
                    prefs.setPref(ProxyPropNames.get(proxyType.ordinal())[Mozilla], val);
                    // If there is no port specified for this host...
                    if (null == (val = JavaProxyPropertyValues[proxyType.ordinal() + 1])) {
                        // Use 80, per the Sun Documentation
                        val = "80";
                    }
                    prefs.setPref(ProxyPropNames.get(proxyType.ordinal() + 1)[Mozilla], val);
                }
                // If this is the http proxy host...
                if (proxyType.toString().equals("httpProxyHost")) {
                    // and there is a "no proxy for these http hosts"
                    if (null != 
                        (val = JavaProxyPropertyValues[ProxyEnum.httpNonProxyHosts.ordinal()])) {
                        val = val.replaceAll("[|]", ",");
                        // Set the appropriate mozilla pref.
                        prefs.setPref(ProxyPropNames.get(ProxyEnum.httpNonProxyHosts.ordinal())[Mozilla],
                                val);
                    }
                }
            }
        }
    }

    public void verifyInitialized() throws IllegalStateException
    {
	if (!initialized) {
        throw new IllegalStateException("Webclient has not been initialized.");
    }
}

public void terminate() throws Exception
{
    if (terminated) {
	throw new IllegalStateException("Already terminated");
    }

    eventThread.pushBlockingReturnRunnable(new ReturnRunnable() {
	    public Object run() {
		Assert.assert_it(null != bookmarks);
// PENDING(edburns): 20070130 XULRunner has no bookmarks		((Service)bookmarks).shutdown();
		((ImplObject)bookmarks).delete();
		bookmarks = null;
		
		Assert.assert_it(null != prefs);
		((Service)prefs).shutdown();
		((ImplObject)prefs).delete();
		prefs = null;
		
		Assert.assert_it(null != profileManager);
		((Service)profileManager).shutdown();
		((ImplObject)profileManager).delete();
		profileManager = null;
		nativeTerminate(nativeWrapperFactory);
		WrapperFactoryImpl.this.terminated = true;
		return null;
	    }
            public String toString() {
                return "WCRunnable.nativeTerminate";
            }

	});
    
    eventThread.delete();
    eventThread = null;
}

    public int getNativeWrapperFactory() {
	return nativeWrapperFactory;
    }

public int getNativeBrowserControl(BrowserControl bc) {
    verifyInitialized();
    Integer result = (Integer) browserControls.get(bc);
    if (null != result) {
	return result.intValue();
    }
    return -1;
}

//
// helper methods
// 

/**
 *
 * <p>Called from {@link #loadNativeLibrary}.  This method simply
 * figures out the proper name for the class that is the
 * BrowserControlCanvas.  Sets the {@link #platformCanvasClassName} ivar
 * as a side effect.</p>
 */

protected String getPlatformCanvasClassName()
{
    if (null != platformCanvasClassName) {
        return platformCanvasClassName;
    }

    String osName = System.getProperty("os.name");
    
    if (null != osName) {
        if (-1 != osName.indexOf("indows")) {
            platformCanvasClassName = "org.mozilla.webclient.impl.wrapper_native.Win32BrowserControlCanvas";
        }
        else if (-1 != osName.indexOf("Mac OS X")) {
            platformCanvasClassName = "org.mozilla.webclient.impl.wrapper_native.CocoaBrowserControlCanvas";
        }
        else {
            platformCanvasClassName = "org.mozilla.webclient.impl.wrapper_native.GtkBrowserControlCanvas";
        }
    }
    
    return platformCanvasClassName;
}

// 
// Native methods
//

native int nativeCreateNativeWrapperFactory() throws RuntimeException;

/**

 * <p>This is called only once, at the very beginning of program execution.
 * This method allows the native code to handle ONE TIME initialization
 * tasks.  Per-window initialization tasks are handled in
 * {@link #nativeCreateBrowserControl}. </p>

 * <p>For mozilla, this means initializing XPCOM.</p>

 */

native void nativeAppInitialize (String verifiedBinDirAbsolutePath, int nativeWrapperFactory, NativeEventThread nativeThread) throws RuntimeException;

/**
 *
 * <p>Place to put any final app setup, after the app singletons have
 * been started.</p>
 */

native void nativeAppSetup(int nativeWrapperFactory) throws RuntimeException;

/**

 * Called only once, at program termination.  Results are undefined if
 * the number of browser windows currently open is greater than zero.

 */

native void nativeTerminate(int nativeWrapperFactory) throws RuntimeException;

/**

 * This is called whenever java calls newImpl on an instance of this
 * class.  This method allows the native code to declare which of the
 * "webclient.*" interfaces it supports.  See the comments for the
 * newImpl method for the format of valid values for interfaceName.

 * @see org.mozilla.webclient.wrapper_native.WrapperFactoryImpl.newImpl

 */

native boolean nativeDoesImplement(String interfaceName);

/**
 * <p>The one and only entry point to do per-window initialization.</p>

 * <p>Takes the int from ImplObjectNative.getNativeBrowserControl, the
 * meaning of which is left up to the implementation, and does any
 * per-window creation and initialization tasks. </P>

 * <p>For mozilla, this means creating the nsIWebShell instance,
 * attaching to the native event queue, creating the nsISessionHistory
 * instance, etc.</p>  

 * <p>This used to be NativeEventThread.nativeStartup().</p>

 */

native int nativeCreateBrowserControl() throws RuntimeException;

native void nativeInitBrowserControl(int nativeWrapperFactory, int nativeBrowserControl) throws RuntimeException;

/*

 * <p>The one and only de-allocater for the nativeBrowserControl</p>

 * <p>This used to be NativeEventThread.nativeShutdown().

 */

native int nativeDestroyBrowserControl(int nativeBrowserControl) throws RuntimeException;

} // end of class WrapperFactoryImpl
