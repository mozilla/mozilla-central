/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The feed parser depends on FeedItem.js, Feed.js.
function FeedParser() {
  this.mSerializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].
                     createInstance(Ci.nsIDOMSerializer);
}

FeedParser.prototype =
{
  // parseFeed() returns an array of parsed items ready for processing.  It is
  // currently a synchronous operation.  If there is an error parsing the feed,
  // parseFeed returns an empty feed in addition to calling aFeed.onParseError.
  parseFeed: function (aFeed, aDOM, aBaseURI)
  {
    if (!(aDOM instanceof Ci.nsIDOMXMLDocument))
    {
      // No xml doc.
      aFeed.onParseError(aFeed);
      return new Array();
    }

    let doc = aDOM.documentElement;
    if (doc.namespaceURI == FeedUtils.MOZ_PARSERERROR_NS)
    {
      // Gecko caught a basic parsing error.
      let errStr = doc.firstChild.textContent + "\n" +
                   doc.firstElementChild.textContent;
      FeedUtils.log.info("FeedParser.parseFeed: - " + errStr);
      aFeed.onParseError(aFeed);
      return new Array();
    }
    else if(doc.namespaceURI == FeedUtils.RDF_SYNTAX_NS &&
            doc.getElementsByTagNameNS(FeedUtils.RSS_NS, "channel")[0])
    {
      aFeed.mFeedType = "RSS_1.xRDF"
      FeedUtils.log.debug("FeedParser.parseFeed: type:url - " +
                          aFeed.mFeedType +" : " +aFeed.url);
      // aSource can be misencoded (XMLHttpRequest converts to UTF-8 by default),
      // but the DOM is almost always right because it uses the hints in the
      // XML file.  This is slower, but not noticably so.  Mozilla doesn't have
      // the XMLHttpRequest.responseBody property that IE has, which provides
      // access to the unencoded response.
      let xmlString = this.mSerializer.serializeToString(doc);
      return this.parseAsRSS1(aFeed, xmlString, aBaseURI);
    }
    else if (doc.namespaceURI == FeedUtils.ATOM_03_NS)
    {
      aFeed.mFeedType = "ATOM_0.3"
      FeedUtils.log.debug("FeedParser.parseFeed: type:url - " +
                          aFeed.mFeedType +" : " +aFeed.url);
      return this.parseAsAtom(aFeed, aDOM);
    }
    else if (doc.namespaceURI == FeedUtils.ATOM_IETF_NS)
    {
      aFeed.mFeedType = "ATOM_IETF"
      FeedUtils.log.debug("FeedParser.parseFeed: type:url - " +
                          aFeed.mFeedType +" : " +aFeed.url);
      return this.parseAsAtomIETF(aFeed, aDOM);
    }
    else if (doc.getElementsByTagNameNS(FeedUtils.RSS_090_NS, "channel")[0])
    {
      aFeed.mFeedType = "RSS_0.90"
      FeedUtils.log.debug("FeedParser.parseFeed: type:url - " +
                          aFeed.mFeedType +" : " +aFeed.url);
      return this.parseAsRSS2(aFeed, aDOM);
    }
    else
    {
      // Parse as RSS 0.9x.  In theory even RSS 1.0 feeds could be parsed by
      // the 0.9x parser if the RSS namespace were the default.
      let rssVer = doc.localName == "rss" ? doc.getAttribute("version") : null;
      if (rssVer)
        aFeed.mFeedType = "RSS_" + rssVer;
      else
        aFeed.mFeedType = "RSS_0.9x?";
      FeedUtils.log.debug("FeedParser.parseFeed: type:url - " +
                          aFeed.mFeedType +" : " +aFeed.url);
      return this.parseAsRSS2(aFeed, aDOM);
    }
  },

  parseAsRSS2: function (aFeed, aDOM)
  {
    // Get the first channel (assuming there is only one per RSS File).
    let parsedItems = new Array();

    let channel = aDOM.querySelector("channel");
    if (!channel)
      return aFeed.onParseError(aFeed);

    // Usually the empty string, unless this is RSS .90.
    let nsURI = channel.namespaceURI || "";
    FeedUtils.log.debug("FeedParser.parseAsRSS2: channel nsURI - " + nsURI);

    let tags = this.childrenByTagNameNS(channel, nsURI, "title");
    aFeed.title = aFeed.title || this.getNodeValue(tags ? tags[0] : null);
    tags = this.childrenByTagNameNS(channel, nsURI, "description");
    aFeed.description = this.getNodeValue(tags ? tags[0] : null);
    tags = this.childrenByTagNameNS(channel, nsURI, "link");
    aFeed.link = this.getNodeValue(tags ? tags[0] : null);

    if (!aFeed.parseItems)
      return parsedItems;

    aFeed.invalidateItems();
    // XXX use getElementsByTagNameNS for now; childrenByTagNameNS would be
    // better, but RSS .90 is still with us.
    let itemNodes = aDOM.getElementsByTagNameNS(nsURI, "item");
    itemNodes = itemNodes ? itemNodes : [];
    FeedUtils.log.debug("FeedParser.parseAsRSS2: items to parse - " +
                        itemNodes.length);

    for (let itemNode of itemNodes)
    {
      if (!itemNode.childElementCount)
        continue;
      let item = new FeedItem();
      item.feed = aFeed;
      item.characterSet = "UTF-8";
      item.enclosures = [];

      tags = this.childrenByTagNameNS(itemNode, nsURI, "link");
      let link = this.getNodeValue(tags ? tags[0] : null);
      tags = this.childrenByTagNameNS(itemNode, nsURI, "guid");
      let guidNode = tags ? tags[0] : null;

      let guid;
      let isPermaLink = false;
      if (guidNode)
      {
        guid = this.getNodeValue(guidNode);
        // isPermaLink is true if the value is "true" or if the attribute is
        // not present; all other values, including "false" and "False" and
        // for that matter "TRuE" and "meatcake" are false.
        if (!guidNode.hasAttribute("isPermaLink") ||
            guidNode.getAttribute("isPermaLink") == "true")
          isPermaLink = true;
        // If attribute isPermaLink is missing, it is good to check the validity
        // of <guid> value as an URL to avoid linking to non-URL strings.
        if (!guidNode.hasAttribute("isPermaLink"))
        {
          try
          {
            Services.io.newURI(guid, null, null);
            if (Services.io.extractScheme(guid) == "tag")
              isPermaLink = false;
          }
          catch (ex)
          {
            isPermaLink = false;
          }
        }

        item.id = guid;
        item.isStoredWithId = true;
      }

      item.url = (guid && isPermaLink) ? guid : link ? link : null;
      tags = this.childrenByTagNameNS(itemNode, nsURI, "description");
      item.description = this.getNodeValue(tags ? tags[0] : null);
      tags = this.childrenByTagNameNS(itemNode, nsURI, "title");
      item.title = this.getNodeValue(tags ? tags[0] : null) ||
                   (item.description ?
                      this.stripTags(item.description).substr(0, 150) : null) ||
                   item.title;

      tags = this.childrenByTagNameNS(itemNode, nsURI, "author");
      if (!tags)
        tags = this.childrenByTagNameNS(itemNode, FeedUtils.DC_NS, "creator");
      item.author = this.getNodeValue(tags ? tags[0] : null) ||
                    aFeed.title ||
                    item.author;

      tags = this.childrenByTagNameNS(itemNode, nsURI, "pubDate");
      if (!tags || !this.getNodeValue(tags[0]))
        tags = this.childrenByTagNameNS(itemNode, FeedUtils.DC_NS, "date");
      item.date = this.getNodeValue(tags ? tags[0] : null) || item.date;

      if (!item.id)
        item.id = item.feed.url + "#" + (item.date || item.title);

      // If the date is invalid, users will see the beginning of the epoch
      // unless we reset it here, so they'll see the current time instead.
      // This is typical aggregator behavior.
      if (item.date)
      {
        item.date = item.date.trim();
        if (!this.isValidRFC822Date(item.date))
        {
          // XXX Use this on the other formats as well.
          item.date = this.dateRescue(item.date);
        }
      }

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.RSS_CONTENT_NS, "encoded");
      item.content = this.getNodeValue(tags ? tags[0] : null);

      // Handle <enclosures> and <media:content>, which may be in a
      // <media:group> (if present).
      tags = this.childrenByTagNameNS(itemNode, nsURI, "enclosure");
      let encUrls = [];
      if (tags)
        for (let tag of tags)
        {
          let url = tag.getAttribute("url");
          if (url)
          {
            item.enclosures.push(new FeedEnclosure(url,
                                                   tag.getAttribute("type"),
                                                   tag.getAttribute("length")));
            encUrls.push(url);
          }
        }

      tags = itemNode.getElementsByTagNameNS(FeedUtils.MRSS_NS, "content");
      if (tags)
        for (let tag of tags)
        {
          let url = tag.getAttribute("url");
          if (url && encUrls.indexOf(url) == -1)
            item.enclosures.push(new FeedEnclosure(url,
                                                   tag.getAttribute("type"),
                                                   tag.getAttribute("fileSize")));
        }

      parsedItems.push(item);
    }

    return parsedItems;
  },

  parseAsRSS1 : function(aFeed, aSource, aBaseURI)
  {
    let parsedItems = new Array();

    // RSS 1.0 is valid RDF, so use the RDF parser/service to extract data.
    // Create a new RDF data source and parse the feed into it.
    let ds = Cc["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"].
             createInstance(Ci.nsIRDFDataSource);

    let rdfparser = Cc["@mozilla.org/rdf/xml-parser;1"].
                    createInstance(Ci.nsIRDFXMLParser);
    rdfparser.parseString(ds, aBaseURI, aSource);

    // Get information about the feed as a whole.
    let channel = ds.GetSource(FeedUtils.RDF_TYPE, FeedUtils.RSS_CHANNEL, true);

    aFeed.title = aFeed.title ||
                  this.getRDFTargetValue(ds, channel, FeedUtils.RSS_TITLE) ||
                  aFeed.url;
    aFeed.description = this.getRDFTargetValue(ds, channel, FeedUtils.RSS_DESCRIPTION) ||
                        "";
    aFeed.link = this.getRDFTargetValue(ds, channel, FeedUtils.RSS_LINK) ||
                 aFeed.url;

    if (!aFeed.parseItems)
      return parsedItems;

    aFeed.invalidateItems();

    let items = ds.GetTarget(channel, FeedUtils.RSS_ITEMS, true);
    if (items)
      items = FeedUtils.rdfContainerUtils.MakeSeq(ds, items).GetElements();
 
    // If the channel doesn't list any items, look for resources of type "item"
    // (a hacky workaround for some buggy feeds).
    if (!items || !items.hasMoreElements())
      items = ds.GetSources(FeedUtils.RDF_TYPE, FeedUtils.RSS_ITEM, true);

    let index = 0;
    while (items.hasMoreElements())
    {
      let itemResource = items.getNext().QueryInterface(Ci.nsIRDFResource);
      let item = new FeedItem();
      item.feed = aFeed;
      item.characterSet = "UTF-8";

      // Prefer the value of the link tag to the item URI since the URI could be
      // a relative URN.
      let uri = itemResource.Value;
      let link = this.getRDFTargetValue(ds, itemResource, FeedUtils.RSS_LINK);

      // XXX Check for bug258465 - entities appear escaped  in the value
      // returned by getRDFTargetValue when they shouldn't.
      //debug("link comparison\n" + " uri: " + uri + "\nlink: " + link);

      item.url = link || uri;
      item.id = item.url;
      item.description = this.getRDFTargetValue(ds, itemResource,
                                                FeedUtils.RSS_DESCRIPTION);
      item.title = this.getRDFTargetValue(ds, itemResource, FeedUtils.RSS_TITLE) ||
                   this.getRDFTargetValue(ds, itemResource, FeedUtils.DC_SUBJECT) ||
                   (item.description ?
                     (this.stripTags(item.description).substr(0, 150)) : null) ||
                   item.title;
      item.author = this.getRDFTargetValue(ds, itemResource, FeedUtils.DC_CREATOR) ||
                    this.getRDFTargetValue(ds, channel, FeedUtils.DC_CREATOR) ||
                    aFeed.title ||
                    item.author;
      item.date = this.getRDFTargetValue(ds, itemResource, FeedUtils.DC_DATE) ||
                  item.date;
      item.content = this.getRDFTargetValue(ds, itemResource,
                                            FeedUtils.RSS_CONTENT_ENCODED);

      parsedItems[index++] = item;
    }
    FeedUtils.log.debug("FeedParser.parseAsRSS1: items parsed - " + index);

    return parsedItems;
  },

  parseAsAtom: function(aFeed, aDOM)
  {
    let parsedItems = new Array();

    // Get the first channel (assuming there is only one per Atom File).
    let channel = aDOM.querySelector("feed");
    if (!channel)
    {
      aFeed.onParseError(aFeed);
      return parsedItems;
    }

    let tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_03_NS, "title");
    aFeed.title = aFeed.title ||
                  this.stripTags(this.getNodeValue(tags ? tags[0] : null));
    tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_03_NS, "tagline");
    aFeed.description = this.getNodeValue(tags ? tags[0] : null);
    tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_03_NS, "link");
    aFeed.link = this.findAtomLink("alternate", tags);

    if (!aFeed.parseItems)
      return parsedItems;

    aFeed.invalidateItems();
    let items = this.childrenByTagNameNS(channel, FeedUtils.ATOM_03_NS, "entry");
    items = items ? items : [];
    FeedUtils.log.debug("FeedParser.parseAsAtom: items to parse - " +
                        items.length);

    for (let itemNode of items)
    {
      if (!itemNode.childElementCount)
        continue;
      let item = new FeedItem();
      item.feed = aFeed;
      item.characterSet = "UTF-8";

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "link");
      item.url = this.findAtomLink("alternate", tags);

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "id");
      item.id = this.getNodeValue(tags ? tags[0] : null);
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "summary");
      item.description = this.getNodeValue(tags ? tags[0] : null);
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "title");
      item.title = this.getNodeValue(tags ? tags[0] : null) ||
                   (item.description ? item.description.substr(0, 150) : null) ||
                   item.title;

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "author");
      if (!tags)
        tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "contributor");
      if (!tags)
        tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_03_NS, "author");

      let authorEl = tags ? tags[0] : null;

      let author = "";
      if (authorEl)
      {
        tags = this.childrenByTagNameNS(authorEl, FeedUtils.ATOM_03_NS, "name");
        let name = this.getNodeValue(tags ? tags[0] : null);
        tags = this.childrenByTagNameNS(authorEl, FeedUtils.ATOM_03_NS, "email");
        let email = this.getNodeValue(tags ? tags[0] : null);
        if (name)
          author = name + (email ? " <" + email + ">" : "");
        else if (email)
          author = email;
      }

      item.author = author || item.author || aFeed.title;

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "modified");
      if (!tags || !this.getNodeValue(tags[0]))
        tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "issued");
      if (!tags || !this.getNodeValue(tags[0]))
        tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_03_NS, "created");

      item.date = this.getNodeValue(tags ? tags[0] : null) || item.date;

      // XXX We should get the xml:base attribute from the content tag as well
      // and use it as the base HREF of the message.
      // XXX Atom feeds can have multiple content elements; we should differentiate
      // between them and pick the best one.
      // Some Atom feeds wrap the content in a CTYPE declaration; others use
      // a namespace to identify the tags as HTML; and a few are buggy and put
      // HTML tags in without declaring their namespace so they look like Atom.
      // We deal with the first two but not the third.
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_03_NS, "content");
      let contentNode = tags ? tags[0] : null;

      let content;
      if (contentNode)
      {
        content = "";
        for (let j = 0; j < contentNode.childNodes.length; j++)
        {
          let node = contentNode.childNodes.item(j);
          if (node.nodeType == node.CDATA_SECTION_NODE)
            content += node.data;
          else
            content += this.mSerializer.serializeToString(node);
        }
      
        if (contentNode.getAttribute("mode") == "escaped")
        {
          content = content.replace(/&lt;/g, "<");
          content = content.replace(/&gt;/g, ">");
          content = content.replace(/&amp;/g, "&");
        }

        if (content == "")
          content = null;
      }

      item.content = content;
      parsedItems.push(item);
    }

    return parsedItems;
  },

  parseAsAtomIETF: function(aFeed, aDOM)
  {
    let parsedItems = new Array();

    // Get the first channel (assuming there is only one per Atom File).
    let channel = this.childrenByTagNameNS(aDOM, FeedUtils.ATOM_IETF_NS, "feed")[0];
    if (!channel)
    {
      aFeed.onParseError(aFeed);
      return parsedItems;
    }

    let tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_IETF_NS, "title");
    aFeed.title = aFeed.title ||
                  this.stripTags(this.serializeTextConstruct(tags ? tags[0] : null));

    tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_IETF_NS, "subtitle");
    aFeed.description = this.serializeTextConstruct(tags ? tags[0] : null);

    tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_IETF_NS, "link");
    aFeed.link = this.findAtomLink("alternate", tags);

    if (!aFeed.parseItems)
      return parsedItems;

    aFeed.invalidateItems();
    let items = this.childrenByTagNameNS(channel, FeedUtils.ATOM_IETF_NS, "entry");
    items = items ? items : [];
    FeedUtils.log.debug("FeedParser.parseAsAtomIETF: items to parse - " +
                        items.length);

    for (let itemNode of items)
    {
      if (!itemNode.childElementCount)
        continue;
      let item = new FeedItem();
      item.feed = aFeed;
      item.characterSet = "UTF-8";
      item.isStoredWithId = true;
      item.enclosures = [];

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "link");
      item.url = this.findAtomLink("alternate", tags) || aFeed.link;
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "id");
      item.id = this.getNodeValue(tags ? tags[0] : null);
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "summary");
      item.description = this.serializeTextConstruct(tags ? tags[0] : null);
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "title");
      item.title = this.stripTags(this.serializeTextConstruct(tags ? tags[0] : null) ||
                                  (item.description ?
                                     item.description.substr(0, 150) : null) ||
                                  item.title);

      // XXX Support multiple authors.
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "source");
      let source = tags ? tags[0] : null;

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "author");
      if (!tags)
        tags = this.childrenByTagNameNS(source, FeedUtils.ATOM_IETF_NS, "author");
      if (!tags)
        tags = this.childrenByTagNameNS(channel, FeedUtils.ATOM_IETF_NS, "author");

      let authorEl = tags ? tags[0] : null;

      let author = "";
      if (authorEl)
      {
        tags = this.childrenByTagNameNS(authorEl, FeedUtils.ATOM_IETF_NS, "name");
        let name = this.getNodeValue(tags ? tags[0] : null);
        tags = this.childrenByTagNameNS(authorEl, FeedUtils.ATOM_IETF_NS, "email");
        let email = this.getNodeValue(tags ? tags[0] : null);
        if (name)
          author = name + (email ? " <" + email + ">" : "");
        else if (email)
          author = email;
      }

      item.author = author || item.author || aFeed.title;

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "updated");
      if (!tags || !this.getNodeValue(tags[0]))
        tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "published");
      if (!tags || !this.getNodeValue(tags[0]))
        tags = this.childrenByTagNameNS(source, FeedUtils.ATOM_IETF_NS, "published");
      item.date = this.getNodeValue(tags ? tags[0] : null) || item.date;

      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "content");
      item.content = this.serializeTextConstruct(tags ? tags[0] : null);

      if (item.content)
        item.xmlContentBase = tags ? tags[0].baseURI : null;
      else if (item.description)
      {
        tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "summary");
        item.xmlContentBase = tags ? tags[0].baseURI : null;
      }
      else
        item.xmlContentBase = itemNode.baseURI;

      // Handle <link rel="enclosure"> (if present).
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_IETF_NS, "link");
      if (tags)
        for (let tag of tags)
        {
          if (tag.getAttribute("rel") == "enclosure" && tag.getAttribute("href"))
            item.enclosures.push(new FeedEnclosure(tag.getAttribute("href"),
                                                   tag.getAttribute("type"),
                                                   tag.getAttribute("length"),
                                                   tag.getAttribute("title")));
        }

      // Handle atom threading extension, RFC4685.  There may be 1 or more tags,
      // and each must contain a ref attribute with 1 Message-Id equivalent
      // value.  This is the only attr of interest in the spec for presentation.
      tags = this.childrenByTagNameNS(itemNode, FeedUtils.ATOM_THREAD_NS, "in-reply-to");
      if (tags)
      {
        for (let tag of tags)
        {
          let ref = tag.getAttribute("ref");
          if (ref)
            item.inReplyTo += item.normalizeMessageID(ref) + " ";
        }
        item.inReplyTo = item.inReplyTo.trimRight();
      }

      parsedItems.push(item);
    }

    return parsedItems;
  },

  serializeTextConstruct: function(textElement)
  {
    let content = "";
    if (textElement)
    {
      let textType = textElement.getAttribute("type");

      // Atom spec says consider it "text" if not present.
      if (!textType)
        textType = "text";

      // There could be some strange content type we don't handle.
      if (textType != "text" && textType != "html" && textType != "xhtml")
        return null;

      for (let j = 0; j < textElement.childNodes.length; j++)
      {
        let node = textElement.childNodes.item(j);
        if (node.nodeType == node.CDATA_SECTION_NODE)
          content += this.xmlEscape(node.data);
        else
          content += this.mSerializer.serializeToString(node);
      }

      if (textType == "html")
        content = this.xmlUnescape(content);
    }

    // Other parts of the code depend on this being null if there's no content.
    return content ? content : null;
  },

  getRDFTargetValue: function(ds, source, property)
  {
    let node = ds.GetTarget(source, property, true);
    if (node)
    {
      try
      {
        node = node.QueryInterface(Ci.nsIRDFLiteral);
        if (node)
          return node.Value;
      }
      catch (e)
      {
        // If the RDF was bogus, do nothing.  Rethrow if it's some other problem.
        if (!((e instanceof Ci.nsIXPCException) &&
              e.result == Cr.NS_ERROR_NO_INTERFACE))
          throw new Error("FeedParser.getRDFTargetValue: " + e);
      }
    }

    return null;
  },

  getNodeValue: function(node)
  {
    if (node && node.textContent)
      return node.textContent.trim();
    else if (node && node.firstChild)
    {
      let ret = "";
      for (let child = node.firstChild; child; child = child.nextSibling)
      {
        let value = this.getNodeValue(child);
        if (value)
          ret += value;
      }

      if (ret)
        return ret;
    }

    return null;
  },

  // Finds elements that are direct children of the first arg.
  childrenByTagNameNS: function(aElement, aNamespace, aTagName)
  {
    if (!aElement)
      return null;
    let matches = aElement.getElementsByTagNameNS(aNamespace, aTagName);
    let matchingChildren = new Array();
    for (let match of matches)
    {
      if (match.parentNode == aElement)
        matchingChildren.push(match)
    }

    return matchingChildren.length ? matchingChildren : null;
  },

  findAtomLink: function(linkRel, linkElements)
  {
    if (!linkElements)
      return null;

    // XXX Need to check for MIME type and hreflang.
    for (let alink of linkElements) {
      if (alink &&
          // If there's a link rel.
          ((alink.getAttribute("rel") && alink.getAttribute("rel") == linkRel) ||
           // If there isn't, assume 'alternate'.
           (!alink.getAttribute("rel") && (linkRel == "alternate"))) &&
          alink.getAttribute("href"))
      {
        // Atom links are interpreted relative to xml:base.
        try {
          return Services.io.newURI(alink.baseURI, null, null).
                             resolve(alink.getAttribute("href"));
        }
        catch (ex) {}
      }
    }

    return null;
  },

  stripTags: function(someHTML)
  {
    return someHTML ? someHTML.replace(/<[^>]+>/g, "") : someHTML;
  },

  xmlUnescape: function(s)
  {
    s = s.replace(/&lt;/g, "<");
    s = s.replace(/&gt;/g, ">");
    s = s.replace(/&amp;/g, "&");
    return s;
  },

  xmlEscape: function(s)
  {
    s = s.replace(/&/g, "&amp;");
    s = s.replace(/>/g, "&gt;");
    s = s.replace(/</g, "&lt;");
    return s;
  },

  // Date validator for RSS feeds
  FZ_RFC822_RE: "^(((Mon)|(Tue)|(Wed)|(Thu)|(Fri)|(Sat)|(Sun)), *)?\\d\\d?" +
    " +((Jan)|(Feb)|(Mar)|(Apr)|(May)|(Jun)|(Jul)|(Aug)|(Sep)|(Oct)|(Nov)|(Dec))" +
    " +\\d\\d(\\d\\d)? +\\d\\d:\\d\\d(:\\d\\d)? +(([+-]?\\d\\d\\d\\d)|(UT)|(GMT)" +
    "|(EST)|(EDT)|(CST)|(CDT)|(MST)|(MDT)|(PST)|(PDT)|\\w)$",

  isValidRFC822Date: function(pubDate)
  {
    let regex = new RegExp(this.FZ_RFC822_RE);
    return regex.test(pubDate);
  },

  dateRescue: function(dateString)
  {
    // Deal with various kinds of invalid dates.
    if (!isNaN(parseInt(dateString)))
    {
      // It's an integer, so maybe it's a timestamp.
      let d = new Date(parseInt(dateString) * 1000);
      let now = new Date();
      let yeardiff = now.getFullYear() - d.getFullYear();
      FeedUtils.log.trace("FeedParser.dateRescue: Rescue Timestamp date - " +
                          d.toString() + " ,year diff - " + yeardiff);
      if (yeardiff >= 0 && yeardiff < 3)
        // It's quite likely the correct date.
        return d.toString();
    }

    if (dateString.search(/^\d\d\d\d/) != -1)
      //Could be an ISO8601/W3C date.
      return new Date(dateString).toUTCString();

    // Can't help.  Set to current time.
    return (new Date()).toString();
  }
};
