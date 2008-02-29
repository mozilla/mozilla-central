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
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Date;
import java.util.Iterator;
import java.util.List;

import org.jdom.Content;
import org.jdom.Element;
import org.jdom.JDOMException;
import org.jdom.Text;
import org.jdom.input.SAXBuilder;
import org.jdom.output.XMLOutputter;

import testopia.API.Build;
import testopia.API.Environment;
import testopia.API.Product;

public class JunitToTestopia {
	private File XMLTestopiaData; 
	private ParseAnt parser; 
	private TestopiaConnector connector; 
	private File XMLFile; 
	private int testPlanID; 
	private int testRunID; 
	private String userName; 
	private String password; 
	private String email; 
	private URL serverURL;
	private int buildID; 
	private int environmentID;
	private int productID;
	private int defaultPriority;
	private String defaultCategory;
	private OptionalValues optionalValues; 
	private boolean blockers; 
	private boolean newTestCaseRunEveryTime;
	public static void main(String args[]) throws Exception
	{	
		
		String buildName = null; 
		String path = null; 
		String environmentName = null; 
		String runID = null;
		
		//if parameters are being passed, use them 
		if (args.length == 4) 
		{
			buildName = args[0];
			path = args[1];
			environmentName = args[2];
			runID = args[3];
		}
		
		FileWriter fout = new FileWriter("log.txt", true);
		BufferedWriter out = new BufferedWriter(fout);
		out.write("\nTAP LOG:\n");
		Date date = new Date();
		out.write("Start Time: " + date.toString()  + "\n");
		
		System.out.println("Start Time: " + date);
		JunitToTestopia junit = new JunitToTestopia(buildName, path, 
				environmentName, runID, out); 
		junit.pushToTestopia();
		Date date2 = new Date();
		System.out.println("End Time: " + date2);		
		out.write("Stop Time: " + date2.toString()  + "\n");
		
		out.close();
		fout.close();
	}
	
	public JunitToTestopia(String buildName, String path, 
			String environmentName, String runID, BufferedWriter out) throws Exception
	{
		//gets testopia data
		XMLTestopiaData = new File("testopiaData.xml"); 
		parseXML(buildName, path, environmentName, runID);
		
		optionalValues = new OptionalValues();
				
		//sets up the connector to talk to testopia
		connector = new TestopiaConnector(testPlanID,testRunID,userName, 
		password,email, serverURL, optionalValues, out, blockers, defaultPriority, defaultCategory, newTestCaseRunEveryTime);
		
		//gets the paser setup with the xml results 
		parser = new ParseAnt(XMLFile, connector, buildID, environmentID);
		
	}
	
	/**
	 * Has the parser parse and upload all the files to testopia 
	 * @throws Exception 
	 *
	 */		
	public void pushToTestopia() throws Exception
	{
		parser.processXMl();
	}

	private void parseXML(String passedBuildName, String passedPath, 
			String passedEnvironmentName, String passedRunID) 
	throws MalformedURLException
	{	
		Element testopiaData = null; 
		
		//get the testSuite data from XML 
		try 
		{
			//make a list from the XML file
			testopiaData = new SAXBuilder().build(XMLTestopiaData).getRootElement();
		} 
		catch (Exception e) 
		{
			e.printStackTrace();		
	    }
		
		//get data out of XML file
		Element userNameElement = testopiaData.getChild("username");
		userName = userNameElement.getContent(0).getValue(); 
		
		Element passwordElement = testopiaData.getChild("password");
		password = passwordElement.getContent(0).getValue(); 
		
		Element buildIDElement = testopiaData.getChild("buildID");
		String buildIDString = buildIDElement.getContent(0).getValue();
				
		Element environmentIDElemet = testopiaData.getChild("environmentID");
		String environmentIDString = environmentIDElemet.getContent(0).getValue();
		
		Element productIDElement = testopiaData.getChild("productID");
		String productIDString = productIDElement.getContent(0).getValue();
		
		Element emailElement = testopiaData.getChild("email");
		email = emailElement.getContent(0).getValue();
		
		Element planIDElement = testopiaData.getChild("planID");
		String planIDString = planIDElement.getContent(0).getValue();
		testPlanID = new Integer(planIDString);
		
		//override local XML data if xml data is passed 
		if(passedRunID != null)
		{
			Element runIDElement = testopiaData.getChild("runID");
			String runIDString = passedRunID;
			testRunID = new Integer(runIDString);
			Text runIDText = new Text(runIDString);
			runIDElement.setContent(0, runIDText);
		}
		//otherwise, use testopiaXMLData
		else
		{
			Element runIDElement = testopiaData.getChild("runID");
			String runIDString = runIDElement.getContent(0).getValue();
			testRunID = new Integer(runIDString); 
		}
		
		//override local XML data if xml data is passed 
		if(passedPath != null)
		{
			Element xmlLocationElement = testopiaData.getChild("xmlResultsLocation");
			String xmlLocationString = passedPath;
			XMLFile = new File(xmlLocationString);
			Text pathText = new Text(xmlLocationString);
			xmlLocationElement.setContent(0, pathText);
		}
		
		//otherwise, use testopiaXMLData
		else
		{
			Element xmlLocationElement = testopiaData.getChild("xmlResultsLocation");
			String xmlLocationString = xmlLocationElement.getContent(0).getValue();
			XMLFile = new File(xmlLocationString);
		}
		
		Element serverURLElement = testopiaData.getChild("serverURL");
		String serverURLString = serverURLElement.getContent(0).getValue();
		serverURL = new URL(serverURLString);
		
		
		
		//create product, environment and build as necessary 
		if(productIDString.equals("0"))
		{
			String productName = testopiaData.getChild("productName").getContent(0).getValue();
			Product product = new Product(userName, password, serverURL);
			productID = product.getProductIDByName(productName);
			Text productText = new Text(new Integer(productID).toString());
			productIDElement.setContent(0, productText);
		}
		
		else
			productID = Integer.parseInt(productIDString);
		
		
		if(buildIDString.equals("0") || passedBuildName != null)
		{
			Build build = new Build(userName, password, serverURL);
			
			//override local XML data if xml data is passed 
			if(passedBuildName != null )
			{
				buildID = build.makeBuild(passedBuildName, productID, true, "---");
			}
			
			//otherwise, use testopiaXMLData 
			else 
			{
				String buildName = testopiaData.getChild("buildName").getContent(0).getValue();
				buildID = build.makeBuild(buildName, productID, true, "---"); 
			}
			
			
			
			Text buildText = new Text(new Integer(buildID).toString());
			buildIDElement.setContent(0, buildText);
		}
		else
			buildID = Integer.parseInt(buildIDString); 
		
		if(environmentIDString.equals("0") || passedEnvironmentName != null)
		{
			Environment environment = new Environment(userName, password, serverURL);
			
			//override local XML data if xml data is passed 
			if(passedEnvironmentName != null)
			{
				environmentID = environment.makeEnvironment(passedEnvironmentName, productID, true);
			}
			
			//otherwise, use testopiaXMLData
			else
			{			
				String environmentName = testopiaData.getChild("environmentName").getContent(0).getValue();			
				environmentID = environment.makeEnvironment(environmentName, productID, true);
			}
			Text environmentText = new Text(new Integer(environmentID).toString());
			environmentIDElemet.setContent(0, environmentText);		
		}
		else
			environmentID = Integer.parseInt(environmentIDString);
		
		
		Element blocker = testopiaData.getChild("blockers");
		String blockers = blocker.getContent(0).getValue();
		
		//detect if blockers are turned on
		if(blockers.trim().equalsIgnoreCase("yes"))
			this.blockers = true; 
		else 
			this.blockers = false; 
		
		
		Element newTestCaseRunEveryTimeElement = testopiaData.getChild("newTestCaseRunEveryTime");
		String newTestCaseRunEveryTimeString = newTestCaseRunEveryTimeElement.getContent(0).getValue();
		
		//detect if newTestCaseRunEveryTime is turned on
		if(newTestCaseRunEveryTimeString.trim().equalsIgnoreCase("yes"))
			this.newTestCaseRunEveryTime = true; 
		else 
			this.newTestCaseRunEveryTime = false; 
				
		
		//Set the default Priority 
		Element prioritySetting = testopiaData.getChild("priority");
		String priorityString = prioritySetting.getContent(0).getValue();
		defaultPriority = Integer.parseInt(priorityString);
		
		//Set the default Category 
		Element categorySetting = testopiaData.getChild("category");
		defaultCategory = categorySetting.getContent(0).getValue();
		
		//write the updated testopia file to disk, to keep buildID and environmentID
		XMLOutputter outputter = new XMLOutputter();
		
	    try 
	    {
	     FileWriter writer = new FileWriter(XMLTestopiaData);
	      outputter.output(testopiaData, writer);       
	    }
	    catch (IOException e) 
	    {
	      System.err.println(e);
	    }
		
	}
}
