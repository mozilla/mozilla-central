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
  * The Original Code is the Bugzilla Testopia Java API.
  *
  * The Initial Developer of the Original Code is Andrew Nelson.
  * Portions created by Andrew Nelson are Copyright (C) 2006
  * Novell. All Rights Reserved.
  *
  * Contributor(s): Andrew Nelson <anelson@novell.com>
  * 				Jason Sabin <jsabin@novell.com>
  *
  */
package testopia.Test;

import java.io.File;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Iterator;
import java.util.List;

import org.jdom.Element;
import org.jdom.JDOMException;
import org.jdom.input.SAXBuilder;

/**
 * 
 * @author anelson
 * Parses the given XML document into testsuites and testcases, so that
 * testopia can be updated 
 */
public class ParseAnt {
	private File XMLFile;
	private TestopiaConnector testopiaConnector;
	private Integer buildID; 
	private Integer environmentID;
		
	public ParseAnt(File XMLFile, TestopiaConnector testopiaConnector, 
			Integer buildID, Integer environmentID)
	{		
		this.XMLFile = XMLFile;
		this.testopiaConnector = testopiaConnector; 
		this.buildID = buildID;
		this.environmentID = environmentID;
	}
	
	/**
	 * Process the XML and uploads the results to testopia 
	 * @throws Exception 
	 *
	 */
	public void processXMl() throws Exception
	{
		
		List testSuites = null; 
		
		//get the testSuite data from XML 
		try 
		{
			testSuites = (new SAXBuilder()).build(XMLFile).getRootElement().getChildren("testsuite");
		} 
		catch (Exception e) 
		{
			e.printStackTrace();		
	    }
		
		//if there are suites listed in the xml file
		//parse through the testCases 
		if (testSuites.size() != 0) 
		{
			List testCases = null;
			Iterator testSuiteIt = testSuites.iterator();
			Iterator testCaseIt = null;
			
			//for all testsuites 
			while (testSuiteIt.hasNext()) 
			{
				Element testSuite = (Element) testSuiteIt.next();
				
				//get package and suite information 
				String classname = testSuite.getAttribute("package").getValue()
						+ "." + testSuite.getAttribute("name").getValue();
				String suitename = testSuite.getAttribute("name")
						.getValue();
				
				System.out.println("-->Processing class '" + classname + "'");
				System.out.println("-->Working on suite '" + suitename + "'");
				
				testCases = testSuite.getChildren("testcase");
				testCaseIt = testCases.iterator();
				String name = null;
				String message = null; 
				String testCaseName = null; 
				
				//loop for all testcases 
				while(testCaseIt.hasNext())
				{
					Element testCase = (Element) testCaseIt.next();
					name = 	testCase.getAttributeValue("name");
					testCaseName = testCase.getAttributeValue("classname");
					Element failure = testCase.getChild("failure");
					Element error = testCase.getChild("error");
					boolean blocker = false;
					
//					get the failure message, otherwise reset message to null
					if(failure!=null)
					{
						message = failure.getContent(0).getValue();										
					
					}
					
					else if(error != null)
					{
						message = error.getContent(0).getValue();
						blocker = true; 
					}
				
					else if(failure == null && error == null)
						message = null;
									
					name = testCaseName + "." + name; 
					testopiaConnector.processTestCase(name, message, buildID, environmentID, testCaseName, blocker);
					
				}
				
				
				
			}
		}

	}
}
