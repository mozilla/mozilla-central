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

import java.io.BufferedWriter;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;

import testopia.API.TestCaseRun;
import testopia.API.TestRun;
import testopia.API.TestopiaTestCase;
import testopia.API.User;

public class TestopiaConnector 
{
	private int planID; 
	private int runID;
	private int defaultPriority;
	private String defaultCategory;
	private TestRun testRun;
	private String username; 
	private String password; 
	private URL serverURL;
	private HashMap<String, HashMap> testCasesMap;
	private HashMap<Integer, HashMap> testRunCasesMap;
	private int authorID; 
	private String email;
	private OptionalValues optionalValues; 
	private BufferedWriter out;
	private boolean blockers;
	private boolean newTestCaseRunEveryTime;
	
	/**
	 * This constuctor is for already created TestPlans
	 * @param testPlanID
	 * @param testRunID
	 * @param userName
	 * @param password
	 * @param serverURL
	 * @throws Exception
	 */
	public TestopiaConnector(int testPlanID, int testRunID, String userName, 
			String password, String email, URL serverURL, 
			OptionalValues optionaValues, BufferedWriter out, boolean blockers, int defaultPriority, String defaultCategory, boolean newTestCaseRunEveryTime) throws Exception
	{
		this.planID = testPlanID; 
		this.runID = testRunID;
		this.username = userName; 
		this.password = password; 
		this.serverURL = serverURL; 
		this.email = email; 
		this.out = out; 
		this.blockers = blockers; 
		this.defaultPriority = defaultPriority;
		this.defaultCategory = defaultCategory;
		this.newTestCaseRunEveryTime = newTestCaseRunEveryTime;
		
		//make the array of testCases into a hashmap 
		testRun = new TestRun(userName, password, serverURL, testRunID);
		Object[] testCases = testRun.getTestCases();
		
		HashMap<String, HashMap> testCasesMap = new HashMap<String, HashMap>(testCases.length);
		for(int i = 0; i < testCases.length; i++)
		{
			String key = (String)((HashMap)testCases[i]).get("summary");
			testCasesMap.put(key, (HashMap)testCases[i]);
		}
		
		this.testCasesMap = testCasesMap; 
		
		//make the array of testRunCases into a hashmap 
		Object[] testRunCases = testRun.getTestCaseRuns();	
		
		HashMap<Integer, HashMap> testRunCasesMap = new HashMap<Integer, HashMap>(testRunCases.length);
		for(int i = 0; i < testRunCases.length; i++)
		{
			Integer key = (Integer)((HashMap)testRunCases[i]).get("case_id");
			testRunCasesMap.put(key, (HashMap)testRunCases[i]);
		}
		
		this.testRunCasesMap = testRunCasesMap; 
		
		//get the userID
		User user = new User(username, password, email, serverURL);
		this.authorID = user.getAttributes();
		
		//get the optionalValues object
		this.optionalValues = optionaValues; 
		
	}
	
	/**
	 * This takes a parsed junit result and will either create a testcase and testCaseRun or updates them
	 * @param name
	 * @param message
	 * @param caseStatusID
	 * @param categoryID
	 * @param buildID
	 * @param environmentID
	 * @throws Exception 
	 */
	public void processTestCase(String name, String message, Integer buildID, 
			Integer environmentID, String className, boolean blocker) throws Exception
	{
		//setup failsafe defaults 
		Integer caseStatusID = 2; 
	    Integer categoryID = 1;
	    int authorID = this.authorID;
	    Integer priorityID = this.defaultPriority; 
		
		if(buildID == null)
			buildID = 2; 
		
		if(environmentID == null)
			environmentID = 1; 
		
		int passedOrFailed;
		
		//check to see if the testCase passed or is blocked
		if(message == null)
			passedOrFailed = 2; 
		else if(blockers == true && blocker == true)
			passedOrFailed = 6; 
		else
			passedOrFailed = 3;
		
		
		//get optionalValues setup to give data for the current class
		boolean classExists = optionalValues.selectClass(className);
		
		//if data exists on the current class, then use that data instead of the 
		//defaults
		String tempAssignee;
		int tempPriority;
		ArrayList<Integer> components = null;
		Integer category = null;  
		
		if(classExists)
		{
			//get optional data if it exists
			tempAssignee = optionalValues.getAssignee();
			if(!tempAssignee.equals("null"))
			{
				User user = new User(username, password, tempAssignee, serverURL);
				authorID = user.getAttributes();
			}
			
			
			tempPriority = optionalValues.getPriority();
			if(tempPriority != 0)
			{
				priorityID = tempPriority;
			}
			
			//get the components for the class
			components = optionalValues.getComponents();
			
			//get the categories for the class
			category = optionalValues.getCategories();
		}
				
			
		HashMap testCaseMap = testCasesMap.get(name);
		
		int caseID = 0; 
		
		// make new testCase if it doesn't exist, otherwise get caseID
		if(testCaseMap == null)
		{
			TestopiaTestCase testCase = new TestopiaTestCase(username, password, serverURL, null);
			categoryID = testCase.getCategoryIdByName(defaultCategory);
			caseID = testCase.makeTestCase(authorID, caseStatusID, categoryID, true, planID, name, priorityID);
			
			
			//add all the components, if components exist
			if(components != null)
			{
				for(Integer componentID: components)
				{
					testCase.addComponent(componentID);
				}
				
			}
			
			//update the category if it exists 
			if(category != null)
			{
				testCase.setCategoryID(category);			
				testCase.update();
			}
		}
		
		else
		{			
			caseID = (Integer)testCaseMap.get("case_id");
			TestopiaTestCase testCase = new TestopiaTestCase(username, password, serverURL, caseID);
			
			if(classExists)
			{
				//check to see if the testCase's priority needs to be updated
				Integer priority = null; 
				try {
					priority = (Integer) testCaseMap.get("priority_id");
				}

				catch (Exception e) {
				}
				
				
				if(priorityID != null && (priority == null || priorityID != priority.intValue()))
					testCase.setPriorityID(priorityID);
			
				//get the components for the testCase
				Object[] componentArray = testCase.getComponents();
				List tempList = Arrays.asList(componentArray);
				ArrayList<Object> componentList = new ArrayList<Object>(tempList);
				ArrayList<Integer> componentInts = new ArrayList<Integer>();
				testCase.update();
			
				//get all the component IDs out and put them into a new ArrayList
				for(Object componentObject: componentList)
				{
					HashMap componentMap = (HashMap)componentObject;
					componentInts.add((Integer)componentMap.get("id"));
				}
			
				//loop to see if the component exists already			
				for(Object componentID: components)
				{
					//if it exists, remove it from the list
					if( componentInts.contains(componentID))
						componentInts.remove(componentID);
				
					//otherwise, add the component to the list
					else
						testCase.addComponent((Integer)componentID);
				}
			
				//if any components are left, then remove them from the arrayList
				for(Integer componentID: componentInts)
				{
					testCase.removeComponent(componentID);
				}
			
				//update the category if it exists 
				if(category != null)
				{
					testCase.setCategoryID(category);			
					testCase.update();
				}
			
				}	
			}	
		
		//check to see if testCase exists in testRun 
		HashMap testRunCaseMap = testRunCasesMap.get(caseID);
		
		//if it's null or newTestCaseRunEveryTime is true, then add to test run, otherwise update testRunCase
		if(testRunCaseMap == null || newTestCaseRunEveryTime == true )
		{
			TestCaseRun caseRun = new TestCaseRun(username, password, caseID, runID, 
					buildID, environmentID, null, serverURL);
			
			//try and create testCaseRun 
			try 
			{
				int makeTestCaseRunResult = caseRun.makeTestCaseRun(authorID, 1);
				if(makeTestCaseRunResult == 0){
					//Try to update instead
					int caseRunID = (Integer)testRunCaseMap.get("case_run_id");
					System.out.println("Attempting to Update TestCaseRun "+caseRunID);
					TestCaseRun caseRunTryAgain = new TestCaseRun(username, password, caseID, runID, 
							buildID, environmentID, caseRunID, serverURL);
				}
				caseRun.setStatus(passedOrFailed);
				
				if(message != null)
					caseRun.setNotes(message);
				
				caseRun.update();
			} 
			catch (Exception e) 
			{
				
				e.printStackTrace();
			}
		}
		
		else
		{
			//if the testCaseRun exists, update it with the new information 
			int caseRunID = (Integer)testRunCaseMap.get("case_run_id");
			TestCaseRun caseRun = new TestCaseRun(username, password, caseID, runID, 
					buildID, environmentID, caseRunID, serverURL);
			
			if(message != null)
				caseRun.setNotes(message);
			else
				caseRun.setNotes("Passed at " + new Date());
			
			caseRun.setBuildID(buildID);
			caseRun.setStatus(passedOrFailed);
			
			
			//check to see if the assignee needs to be updated
			Integer currentAssignee = (Integer)testRunCaseMap.get("assignee");
			if(currentAssignee == null || authorID != currentAssignee)
			{
				caseRun.setAssigneeID(authorID);
			}
			
			//try and push the update to testopia
			try
			{
				caseRun.update();
			} catch (Exception e) 
			{
				e.printStackTrace();
			}
			
		}
		
		//log the results
		if(!classExists)
		{
			out.write("Class Not In Optional Data: " + className + "\n");
		}
		
	}
	
}
