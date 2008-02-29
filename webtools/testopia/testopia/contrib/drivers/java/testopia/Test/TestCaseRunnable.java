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

import testopia.API.TestopiaTestCase;

public class TestCaseRunnable implements Runnable 
{
	private TestopiaTestCase testCase; 
	private int authorID; 
	private int caseStatusID; 
	private int categoryID; 
	private boolean isAutomated; 
	private int planID; 
	private String name; 
	private Integer priorityID; 
	private Integer caseID; 
	
	public TestCaseRunnable(TestopiaTestCase testCase, int authorID, int caseStatusID,
			int categoryID, boolean isAutomated, int planID, 
			String name, Integer priorityID, Integer caseID)
	{
		this.testCase = testCase; 
		this.authorID = authorID; 
		this.caseStatusID = caseStatusID; 
		this.categoryID = categoryID; 
		this.isAutomated = isAutomated; 
		this.planID = planID; 
		this.name = name; 
		this.priorityID = priorityID; 
		this.caseID = caseID; 
		
	}
	
	public void run() 
	{
		caseID = testCase.makeTestCase(authorID, caseStatusID, categoryID, true, planID, name, null);
	}

	public static void main(String args[]) 
	{
		//(new Thread(new TestCaseRunnable())).start();
	}

}

