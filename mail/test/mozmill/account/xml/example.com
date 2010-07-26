<?xml version="1.0" encoding="UTF-8"?>
<clientConfig>
  <emailProvider id="example.com">
    <domain>example.com</domain>
    <displayName>Example</displayName>
    <displayShortName>Example</displayShortName>
    <incomingServer type="pop3">
      <hostname>testin.%EMAILDOMAIN%</hostname>
      <port>995</port>
      <socketType>SSL</socketType>
      <username>%EMAILLOCALPART%</username>
      <authentication>plain</authentication>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>testout.%EMAILDOMAIN%</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <username>%EMAILADDRESS%</username>
      <authentication>plain</authentication>
      <addThisServer>true</addThisServer>
      <useGlobalPreferredServer>false</useGlobalPreferredServer>
    </outgoingServer>
  </emailProvider>
</clientConfig>
