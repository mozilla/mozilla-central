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
  *
  */
package testopia.Test;

import java.io.File;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;

import org.jdom.Element;
import org.jdom.input.SAXBuilder;

import testopia.API.TestopiaTestCase;

/**
 * parses the optionaldata xml file
 * @author anelson
 *
 */
public class OptionalValues {
	private HashMap<String, OptionalData> testCaseMap; 
	private OptionalData currentlySelected; 
	
	public OptionalValues()
	{
		File XMLOptionalValues = new File("OptionalData.xml");
		Element optionalData = null; 
		
		testCaseMap = new HashMap<String, OptionalData>();
		currentlySelected = null;
		
		//get the optional data from XML 
		try 
		{
			//make a list from the XML file
			optionalData = new SAXBuilder().build(XMLOptionalValues).getRootElement();
		} 
		catch (Exception e) 
		{
			e.printStackTrace();		
	    }
		
		//get testsuites 
		List testSuite = optionalData.getChildren("testsuite");
		Iterator testSuiteIT = testSuite.iterator();
		
		List testCases = null; 
		Element testSuiteElement = null; 
		Element testCase = null; 
		
		//loops for all test suites
		while(testSuiteIT.hasNext())
		{
			testSuiteElement = (Element)testSuiteIT.next();
			testCases = testSuiteElement.getChildren("testcase");
			Iterator testCasesIT = testCases.iterator();
			
			//loops for all testcases
			while (testCasesIT.hasNext()) {
				testCase = (Element) testCasesIT.next();

				// get the values for the testcase
				OptionalData entry = new OptionalData();
				String className = testCase.getAttributeValue("classname");

				// get the assignee
				String assignee = testCase.getChildText("assignee");
				entry.setAssignee(assignee);

				// get the category
				String category = testCase.getChildText("category");
				entry.setCategory(Integer.parseInt(category));			

				// get components
				Element components = testCase.getChild("components");
				Iterator componentsIT = components.getChildren("component").iterator();
				while (componentsIT.hasNext()) 
				{
					Element component = (Element) componentsIT.next();
					String stringcomponent = component.getContent(0).getValue();
					Integer intcomponent = Integer.parseInt(stringcomponent);
					entry.addComponent(intcomponent);
				}

				// get the priority
				String priority = testCase.getChildText("priority");
				Integer intPriority = Integer.parseInt(priority);
				entry.setPriority(intPriority);

				// add the testCase to the hashmap
				testCaseMap.put(className, entry);
			}
		}

	}
	
	public static void main(String args[])
	{
		OptionalValues values = new OptionalValues();
		values.selectClass("className");
		System.out.println(values.getAssignee());
	}
	
	/**
	 * Use select class to get a specific class out of the HashMap and allow
	 * access to the classes data via the get methods
	 * @param className String - the name of the class selected
	 */
	public boolean selectClass(String className)
	{
		currentlySelected = testCaseMap.get(className);
		if(currentlySelected == null)
			return false;
		return true; 
			
	}
	
	public Integer getCategories()
	{	
		if(currentlySelected != null)
			return currentlySelected.getCategory();
		
		return null;
	}
	
	public int getPriority()
	{
		if(currentlySelected != null)
			return currentlySelected.getPriority();
		
		return 0;
	}
	
	public String getAssignee()
	{
		if(currentlySelected != null)
			return currentlySelected.getAssignee(); 
		
		return null;
	}
	
	public ArrayList<Integer> getComponents()
	{
		if(currentlySelected != null)
			return currentlySelected.getComponents();
		
		return null;
	}
}
