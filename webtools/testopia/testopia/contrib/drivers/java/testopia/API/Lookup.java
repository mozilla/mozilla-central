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
package testopia.API;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.HashMap;
import java.util.StringTokenizer;
import java.util.Map.Entry;

public class Lookup {
	public static URL url;
	
	public static void main(String args[]) throws Exception
	{
		//declare variables 
		url = new URL("http://apibugzillastage.provo.novell.com/tr_xmlrpc.cgi");
		
		//get username and password
		System.out.println("Welcome to Testopia Lookup tool 1.0");
		StringBuilder command = new StringBuilder();
		StringBuilder object = new StringBuilder();
		System.out.println("Please Eneter your bugzilla username");
		
		StringBuilder userNameStringBuilder = new StringBuilder();
		processInput(userNameStringBuilder, null, null);
	
		System.out.println("Please enter your bugzilla password");
		StringBuilder passwordStringBuilder = new StringBuilder();
		processInput(passwordStringBuilder, null, null);
		
		
		System.out.println("You may now enter a command query");
		System.out.println("To see a list of supported queries, please");
		System.out.println("read the lookupHelp.txt");		
		
		
		//begin query loop
		String username = userNameStringBuilder.toString();
		String password = passwordStringBuilder.toString();
		StringBuilder secondObject;
		while(true)
		{
			command = new StringBuilder();
			object = new StringBuilder();
			secondObject = new StringBuilder();
			//get input from console
			processInput(command, object, null);
			
			System.out.println("Query Result:");
		
			if(command.toString().equals("build"))
			{
				Build build = new Build(username, password, url);
				int buildId = build.getBuildIDByName(object.toString());
				System.out.println(buildId);
			}
		
			else if(command.toString().equals("component"))
			{
				TestPlan testPlan = new TestPlan(username, password, url, new Integer(object.toString()));
				Object[] objects = testPlan.getComponents();
				for(Object o : objects)
					System.out.println(o.toString());				
			}
			
			else if(command.toString().equals("environmentByProduct"))
			{
				Environment environment = new Environment(username, password, url);
						
				HashMap<String, Object> map = environment.listEnvironments(object.toString(), null);
				
				System.out.println("Environment Name: " + map.get("name"));
				System.out.println("Environment ID: " + map.get("environment_id"));

			}
			
			else if(command.toString().equals("environmentByName"))
			{
				Environment environment = new Environment(username, password, url);
						
				HashMap<String, Object> map = environment.listEnvironments(object.toString(), null);
				
				System.out.println("Environment Name: " + map.get("name"));
				System.out.println("Environment ID: " + map.get("environment_id"));

			}
			
			else if(command.toString().equals("exit"))
			{
				System.out.println("Thanks For Using the Lookup Tool");
				break;
			}
		
			else
			{
				System.out.println("unrecognized command");
			}
			
			System.out.println("You may now enter another command query, or type exit to exit");
		}
	}
	
	/**
	 * Helper method to take input from console
	 * @param command - first parameter
	 * @param object - second parameter
	 */
	public static void processInput(StringBuilder command, StringBuilder object, StringBuilder secondObject)
	{
		InputStream in = System.in;
		BufferedReader reader = new BufferedReader(new InputStreamReader(in));
		StringTokenizer token = null;
		try {
			token = new StringTokenizer(reader.readLine(), ":");
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
				
		if(token.hasMoreTokens())
			command.append(token.nextToken()); 
		if(token.hasMoreTokens() && object != null)
			object.append(token.nextToken());
		if(token.hasMoreTokens() && secondObject != null)
			secondObject.append(token.nextToken());
		
	}

}
