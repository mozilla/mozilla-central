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
 * Contributor(s):  Kyle Yuan <kyle.yuan@sun.com>
 */

package org.mozilla.webclient;

import java.util.List;

/**
 *
 * <p>Indicates the browser is requesting a new window be created to
 * display a new <code>BrowserControlCanvas</code> instance.  This
 * mechanism is only necessary if your embedding application wishes to
 * allow the browser to pop up new windows (or tabs).  Such is often the
 * case when the user clicks on an href with a "target" attribute, or
 * the embedding application wants to enable some right-click "open in
 * new window" or "open in new tab" feature.</p>
 * 
 * <p>Usage contract:</p>
 *
 * <p>The unfortunately complex usage contract to accomodate differences
 * in the UI threading models in a platform indepent manner.</p>
 *
 * <p>On the application main thread, do something like this:</p>
 *
 * <code><pre>

final List<Runnable> realizeNewWindowRunnableList = 
   new CopyOnWriteArrayList<Runnable>();
 
<a href="EventRegistrationImpl.html">eventRegistration</a>.setNewWindowListener(new NewWindowListener() {
   public void eventDispatched(WebclientEvent wcEvent) {
     NewWindowEvent event = (NewWindowEvent) wcEvent;
     final BrowserControlCanvas secondCanvas;
		    
     try {
       secondBrowserControl = 
         BrowserControlFactory.newBrowserControl();
       secondCanvas = (BrowserControlCanvas)
         secondBrowserControl.queryInterface(BrowserControl.BROWSER_CONTROL_CANVAS_NAME);
     } catch (Throwable e) {
       System.out.println(e.getMessage());
       fail();
       return;
     }
	 event.setBrowserControl(secondBrowserControl);
     event.setRealizeNewWindowRunnableList(realizeNewWindowRunnableList);
     event.setRealizeNewWindowRunnable(new Runnable() {
       public void run() {
         secondFrame.add(secondCanvas, BorderLayout.CENTER);
         secondFrame.setVisible(true);
         secondCanvas.setVisible(true);
       }
       public String toString() {
         return "WindowCreatorTest newWindowRunnable";
         }
       });
    }  
  });

// ... continue with browser code.

  while (realizeNewWindowRunnableList.isEmpty()) {
    Thread.currentThread().sleep(1000);
  }
  
  for (Runnable cur : realizeNewWindowRunnableList) {
    cur.run();
  }
 * </pre></code>
 *
 * <p>The above code accomplishes the folliwng goals:</p>

 * <p>Create a thread safe list data structure.  This will hold the
 * <code>Runnable</code> that we define to create the parent window and
 * make it visible.  Add a <code><a
 * href="NewWindowListener.html">NewWindowListener</a></code> instance
 * to the "main" <code>BrowserControl</code>.  When this listener
 * instance receives an <code>eventDispatched</code> call (on a platform
 * specific <code>Thread</code>), it must create a <b>new</b>
 * <code>BrowserControl</code>, gets its
 * <code>BrowserControlCanvas</code>, store the canvas into the event,
 * store the thread safe list data structure into the event, and store a
 * Runnable into the event that adds the canvas to its parent container,
 * and sets the parent container and the canvas visible.  This Runnable
 * will be called at a platform specific time, on a platform specific
 * <code>Thread</code>.  The <code>toString()</code> implementation is
 * just good practice for debugging.</p>
 *
 * <p>Meanwhile, back on the main thread the thread safe list data
 * structure mest be polled, as often as desired, until Runnable appears
 * in the list.  It will have been placed there by the Webclient API and
 * the embedding application is required to run() it on the main
 * thread.</p>
 * 
 */

public class NewWindowEvent extends WebclientEvent
{

//
// Constructors
//

public NewWindowEvent(Object source, long newType,
                         Object newEventData)
{
    super(source, newType, newEventData);
}

protected BrowserControl browserControl;
public BrowserControl getBrowserControl() {
	return browserControl;
}
    
public void setBrowserControl(BrowserControl newBrowserControl) {
	browserControl = newBrowserControl;
}

private Runnable realizeNewWindowRunnable;

protected List<Runnable> browserWillAdd;

public void setRealizeNewWindowRunnableList(List<Runnable> browserWillAdd){
    this.browserWillAdd = browserWillAdd;
}

public List<Runnable> getRealizeNewWindowRunnableList() {
    return browserWillAdd;
}

    public Runnable getRealizeNewWindowRunnable() {
        return realizeNewWindowRunnable;
    }

    public void setRealizeNewWindowRunnable(Runnable realizeNewWindowRunnable) {
        this.realizeNewWindowRunnable = realizeNewWindowRunnable;
    }

} // end of class NewWindowEvent
